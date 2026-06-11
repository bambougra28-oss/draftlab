/**
 * Chantier D (run #2) — tests de la lib de gate `$lib/backtest/planCoverage`.
 *
 * TOUS les nombres attendus sont calculés À LA MAIN depuis la règle gelée
 * (docs/run2/D-plans-branches.md §1) — jamais copiés d'une exécution. Le
 * mini-corpus est synthétique : 2 patchs, 3 équipes (T, U, V), bans sautés
 * inclus (les slots absents des fixtures SONT des bans sautés : m ≤ 10 par
 * construction).
 *
 * Dérivation de la cellule (B1-B3, blue) du mini-corpus :
 *   Train (patch 1.1, datés 2026-01-01) :
 *     t1 (T en blue) bans seq 1/3/5 : C, D, E
 *     t2 (U en blue) bans seq 1/3/5 : A, B, C
 *   Prior ligue (toutes actions) : C 2/6, A 1/6, B 1/6, D 1/6, E 1/6.
 *   Évidence équipe T (now 2026-01-08 → âge 7 j = 1 semaine → poids λ¹ = 0,9) :
 *     C/D/E poids 0,9 chacun, rawCount 1.
 *   Table ÉQUIPE (α 5) : masse(C) = 0,9 + 5·(2/6) ; masse(D) = masse(E)
 *     = 0,9 + 5/6 ; masse(A) = masse(B) = 5/6 ; total = 2,7 + 5 = 7,7.
 *     Ordre predict : C, D, E, A, B (égalités → rawCount, puis clé asc).
 *   Table LIGUE (bras B, []) : p = prior renormalisé = prior ;
 *     ordre : C, A, B, D, E.
 */
import { describe, it, expect } from 'vitest';
import {
    PLAN_COVERAGE_FROZEN,
    buildPlanCoverageData,
    clusterPairedBootstrap,
    dayUtcOf,
    enemyActionsOf,
    heldDepth,
    hitsAt,
    makeTableCache,
    meanHeldDepthAt,
    nowDayOf,
    presenceRanking,
    presenceRanks,
    scoreCorpus,
    surviveGrid,
    unitHits,
    unitRanks,
    type RankedUnit,
    type ScoredCorpus,
    type ScoredUnit
} from '$lib/backtest/planCoverage';
import { predict } from '$lib/aggregates/tendency';
import { mulberry32 } from '$lib/backtest/metrics';
import { DRAFT_TEMPLATE } from '$lib/data/draftRecord';
import type { DraftAction, DraftRecord } from '$lib/data/types';

// ---- fixtures synthétiques -----------------------------------------------------

/** Action sur le template blue-first (slots absents = bans sautés). */
function act(seq: number, championKey: string): DraftAction {
    const slot = DRAFT_TEMPLATE.find((s) => s.seq === seq);
    if (slot === undefined) throw new Error(`seq ${seq} hors template`);
    return {
        seq,
        type: slot.type,
        phase: slot.phase,
        side: slot.first ? 'blue' : 'red',
        championKey,
        championName: championKey
    };
}

function rec(
    gameId: string,
    patch: string | undefined,
    date: string | undefined,
    blueTeam: string,
    redTeam: string,
    actions: DraftAction[]
): DraftRecord {
    return {
        gameId,
        ...(patch !== undefined ? { patch } : {}),
        ...(date !== undefined ? { date } : {}),
        blueTeam,
        redTeam,
        firstPickSide: 'blue',
        orderConfidence: 'assumed-blue-first',
        actions,
        warnings: [],
        provenance: { source: 'synthetic', fetchedAt: '2026-01-01T00:00:00.000Z' }
    };
}

/** Train : 2 records patch 1.1, seuls les bans B1-B3 côté blue existent. */
const t1 = rec('t1', '1.1', '2026-01-01', 'T', 'U', [act(1, 'C'), act(3, 'D'), act(5, 'E')]);
const t2 = rec('t2', '1.1', '2026-01-01', 'U', 'T', [act(1, 'A'), act(3, 'B'), act(5, 'C')]);

/** Game scorée : patch 1.2, m = 6 des deux côtés (phase 2 entièrement sautée). */
const g1 = rec('g1', '1.2', '2026-01-08', 'T', 'U', [
    act(1, 'E'),
    act(2, 'C'),
    act(3, 'D'),
    act(4, 'F'),
    act(5, 'A'),
    act(6, 'G'),
    act(7, 'H'),
    act(8, 'I'),
    act(9, 'J'),
    act(10, 'K'),
    act(11, 'L'),
    act(12, 'M')
]);

const CORPUS = [t1, t2, g1];

// ---- temps ----------------------------------------------------------------------

describe('dayUtcOf / nowDayOf (§1.3)', () => {
    it('extrait le jour UTC et tolère les dates illisibles', () => {
        expect(dayUtcOf('2026-05-05T14:30:00Z')).toBe('2026-05-05');
        expect(dayUtcOf('garbage')).toBeUndefined();
        expect(dayUtcOf(undefined)).toBeUndefined();
    });

    it('now(g) = jour de la game, sinon jour de la date max du train, sinon undefined', () => {
        expect(nowDayOf({ date: '2026-05-05T14:30:00Z' }, [])).toBe('2026-05-05');
        expect(nowDayOf({}, [{ date: '2026-04-01' }, { date: '2026-04-09' }])).toBe('2026-04-09');
        expect(nowDayOf({}, [{}])).toBeUndefined();
    });
});

// ---- hit / survive / heldDepth (§1.4) --------------------------------------------

describe('heldDepth / hitsAt', () => {
    it('D = préfixe de hits, 0 si hit₁ faux, plafonné au cap', () => {
        expect(heldDepth([true, true, false, true], 6)).toBe(2);
        expect(heldDepth([false, true, true, true, true, true], 6)).toBe(0);
        expect(heldDepth([true, true, true, true, true, true, true], 6)).toBe(6); // cap
        expect(heldDepth([], 6)).toBe(0);
    });

    it('hitsAt : rang défini et ≤ K', () => {
        expect(hitsAt([1, 4, 5, undefined], 4)).toEqual([true, true, false, false]);
    });
});

describe('surviveGrid + identité moyenne(D) = Σ survive (§1.4-§1.5)', () => {
    // 3 unités m = 6, K = 2, ranks main-calculés :
    //   u1 [1,1,2,5,1,1] → hits TTTFTT → survive 1,1,1,0,0,0 → D = 3
    //   u2 [1,3,1,1,1,1] → hits TFTTTT → survive 1,0,0,0,0,0 → D = 1
    //   u3 [2,1,1,1,1,2] → hits TTTTTT → survive 1,1,1,1,1,1 → D = 6
    const units: RankedUnit[] = [
        { ranks: [1, 1, 2, 5, 1, 1] },
        { ranks: [1, 3, 1, 1, 1, 1] },
        { ranks: [2, 1, 1, 1, 1, 2] }
    ];

    it('cellules de survie main-calculées', () => {
        const grid = surviveGrid(units, [2], [1, 2, 3, 4, 5, 6]);
        expect(grid.map((c) => c.rate)).toEqual([1, 2 / 3, 2 / 3, 1 / 3, 1 / 3, 1 / 3]);
        expect(grid.every((c) => c.n === 3)).toBe(true);
        // Wilson borné et autour du taux.
        expect(grid[0].wilson.lo).toBeGreaterThan(0);
        expect(grid[0].wilson.hi).toBeLessThanOrEqual(1);
    });

    it("l'identité structurelle tient : moyenne(D) = Σ_P survive(K,P)", () => {
        const mean = meanHeldDepthAt(units, 2, 6); // (3+1+6)/3 = 10/3
        expect(mean).toBeCloseTo(10 / 3, 12);
        const sum = surviveGrid(units, [2], [1, 2, 3, 4, 5, 6]).reduce((s, c) => s + c.rate, 0);
        expect(sum).toBeCloseTo(mean, 12);
    });

    it('une unité m < P sort de la cellule (n diminue), jamais tronquée en silence', () => {
        const grid = surviveGrid([{ ranks: [1, 1] }, { ranks: [1, 1, 1] }], [1], [3]);
        expect(grid[0].n).toBe(1); // seule l'unité m = 3 est définie à P = 3
        expect(grid[0].survivors).toBe(1);
    });
});

// ---- cache de tables (§1.3, clés gelées) ------------------------------------------

describe('makeTableCache — clés gelées (corpus, patch, équipe, now-jour) / (corpus, patch)', () => {
    it('deux games même (patch, équipe) à des JOURS différents ⇒ tables bras A DIFFÉRENTES', () => {
        const cache = makeTableCache([t1, t2]);
        const day8 = cache.teamTable('1.2', 'T', '2026-01-08');
        const day15 = cache.teamTable('1.2', 'T', '2026-01-15');
        expect(day8).not.toBe(day15);
        // p(D | B1-B3, blue) main-calculé : (λ^w + 5/6) / (3λ^w + 5)
        //   jour 8  (1 semaine,  λ¹ = 0,9)  → 1,7333…/7,7
        //   jour 15 (2 semaines, λ² = 0,81) → 1,6433…/7,43
        const pD = (table: ReturnType<typeof cache.teamTable>): number => {
            const preds = predict(table, { slotGroup: 'B1-B3', side: 'blue' });
            const d = preds.find((p) => p.championKey === 'D');
            if (d === undefined) throw new Error('D absent des prédictions');
            return d.p;
        };
        expect(pD(day8)).toBeCloseTo((0.9 + 5 / 6) / (3 * 0.9 + 5), 12);
        expect(pD(day15)).toBeCloseTo((0.81 + 5 / 6) / (3 * 0.81 + 5), 12);
        expect(pD(day8)).not.toBeCloseTo(pD(day15), 4);
    });

    it('même (patch, équipe, jour) ⇒ MÊME table (réutilisation comptée)', () => {
        const cache = makeTableCache([t1, t2]);
        const a = cache.teamTable('1.2', 'T', '2026-01-08');
        const b = cache.teamTable('1.2', 'T', '2026-01-15');
        const c = cache.teamTable('1.2', 'T', '2026-01-08');
        expect(c).toBe(a);
        expect(b).not.toBe(a);
        expect(cache.stats().teamTables).toBe(2);
        expect(cache.stats().teamRequests).toBe(3);
    });

    it('bras B : clé (patch) seule — indépendante du jour, p = prior ligue conditionnel', () => {
        const cache = makeTableCache([t1, t2]);
        const one = cache.leagueTable('1.2');
        const two = cache.leagueTable('1.2');
        expect(two).toBe(one);
        expect(cache.stats().leagueTables).toBe(1);
        expect(cache.stats().leagueRequests).toBe(2);
        // Prior conditionnel (B1-B3, blue) : C 1/3 puis A, B, D, E à 1/6.
        const preds = predict(one, { slotGroup: 'B1-B3', side: 'blue' });
        expect(preds.map((p) => p.championKey)).toEqual(['C', 'A', 'B', 'D', 'E']);
        expect(preds[0].p).toBeCloseTo(1 / 3, 12);
        expect(preds[1].p).toBeCloseTo(1 / 6, 12);
    });

    it('trainFor : patchs strictement antérieurs uniquement (premier patch ⇒ train vide)', () => {
        const cache = makeTableCache(CORPUS);
        expect(cache.trainFor('1.1')).toHaveLength(0);
        expect(cache.trainFor('1.2').map((r) => r.gameId)).toEqual(['t1', 't2']);
    });
});

// ---- scoring d'une unité (§1.4 : exclusions de préfixe) ---------------------------

describe('unitRanks / unitHits — E_i = préfixe des DEUX côtés', () => {
    const cache = makeTableCache([t1, t2]);

    it('bras A (équipe T, blue) : rangs main-calculés [3, 1, 1, miss, miss, miss]', () => {
        const table = cache.teamTable('1.2', 'T', '2026-01-08');
        // a₁ = E, E₁ = {} → ordre [C,D,E,A,B] → rang 3.
        // a₂ = D, E₂ = {E(seq1), C(seq2)} → [D,A,B] → rang 1 (l'exclusion mord).
        // a₃ = A, E₃ = {E,C,D,F} → [A,B] → rang 1.
        // picks seq 7/10/11 : cellules sans données train → miss honnête.
        expect(unitRanks(g1, 'blue', table)).toEqual([3, 1, 1, undefined, undefined, undefined]);
        expect(unitHits(g1, 'blue', table, 4)).toEqual([true, true, true, false, false, false]);
        expect(unitHits(g1, 'blue', table, 2)).toEqual([false, true, true, false, false, false]);
    });

    it('bras B (ligue) : rangs main-calculés [5, 3, 1, miss, miss, miss]', () => {
        const table = cache.leagueTable('1.2');
        // a₁ = E : ordre [C,A,B,D,E] → 5 ; a₂ = D : exclude {E,C} → [A,B,D] → 3 ;
        // a₃ = A : exclude {E,C,D,F} → [A,B] → 1.
        expect(unitRanks(g1, 'blue', table)).toEqual([5, 3, 1, undefined, undefined, undefined]);
    });

    it('côté red : aucune cellule train ⇒ tout miss (pred vide = miss honnête)', () => {
        const table = cache.teamTable('1.2', 'U', '2026-01-08');
        expect(unitRanks(g1, 'red', table)).toEqual(new Array(6).fill(undefined));
    });

    it('enemyActionsOf trie par seq et filtre par côté', () => {
        expect(enemyActionsOf(g1, 'blue').map((a) => a.seq)).toEqual([1, 3, 5, 7, 10, 11]);
        expect(enemyActionsOf(g1, 'red').map((a) => a.seq)).toEqual([2, 4, 6, 8, 9, 12]);
    });
});

// ---- baseline secondaire : présence brute (§1.3) ----------------------------------

describe('presenceRanking / presenceRanks — filtrage AVANT troncature, jamais renormalisé', () => {
    it('classement par comptes d’actions, ex æquo compte desc puis clé asc', () => {
        const ranking = presenceRanking([t1, t2]);
        // Comptes : C 2 ; A, B, D, E 1 chacun → [C, A, B, D, E].
        expect(ranking.map((e) => e.championKey)).toEqual(['C', 'A', 'B', 'D', 'E']);
        expect(ranking[0].count).toBe(2);
    });

    it('rangs de g1 : E_i appliqué par filtrage de la liste classée', () => {
        const ranking = presenceRanking([t1, t2]);
        // blue : E (liste pleine → rang 5) ; D (exclude {E,C} → [A,B,D] → 3) ;
        //        A (exclude {E,C,D,F} → [A,B] → 1) ; picks H/K/L absents → miss.
        expect(presenceRanks(g1, 'blue', ranking)).toEqual([5, 3, 1, undefined, undefined, undefined]);
        // red (slot- et side-AGNOSTIQUE, la présence ne connaît pas les cellules) :
        //   C (exclude {E} → [C,A,B,D] → rang 1) ; F/G/I/J/M absents → miss.
        expect(presenceRanks(g1, 'red', ranking)).toEqual([1, undefined, undefined, undefined, undefined, undefined]);
    });
});

// ---- bootstrap apparié + clusterisé par game (§1.6) --------------------------------

describe('clusterPairedBootstrap', () => {
    interface Unit {
        game: string;
        value: number;
    }
    const a: Unit[] = [
        { game: 'g1', value: 1 },
        { game: 'g1', value: 1 },
        { game: 'g2', value: 0 }
    ];
    const b: Unit[] = [
        { game: 'g1', value: 0 },
        { game: 'g1', value: 0 },
        { game: 'g2', value: 1 }
    ];

    it('main-tracé avec rng stub : les 2 unités d’une game voyagent ensemble', () => {
        // Tirages (2 clusters par resample) : [g1,g2] → Δ 1/3 ; [g1,g1] → Δ 1 ;
        // [g2,g2] → Δ −1. Triés [−1, 1/3, 1], type-7 :
        //   q.025 : h = 0,05 → −1 + 0,05·(4/3) = −0,93333…
        //   q.975 : h = 1,95 → 1/3 + 0,95·(2/3) = 0,96666…
        const seq = [0, 0.9, 0, 0.4, 0.9, 0.9];
        let i = 0;
        const result = clusterPairedBootstrap(
            a,
            b,
            (u) => u.game,
            (u) => u.value,
            { iterations: 3, rng: () => seq[i++] }
        );
        expect(result.delta).toBeCloseTo(1 / 3, 12);
        expect(result.ci95.lo).toBeCloseTo(-1 + 0.05 * (4 / 3), 12);
        expect(result.ci95.hi).toBeCloseTo(1 / 3 + 0.95 * (2 / 3), 12);
        expect(result.clusters).toBe(2);
        expect(result.observations).toBe(3);
    });

    it('déterministe : mulberry32(1) rejoué donne le MÊME IC', () => {
        const run = () =>
            clusterPairedBootstrap(
                a,
                b,
                (u) => u.game,
                (u) => u.value,
                { iterations: 200, rng: mulberry32(1) }
            );
        const first = run();
        const second = run();
        expect(second.ci95.lo).toBe(first.ci95.lo);
        expect(second.ci95.hi).toBe(first.ci95.hi);
    });

    it('refuse des échantillons non appariés', () => {
        expect(() =>
            clusterPairedBootstrap(
                a,
                b.slice(0, 2),
                (u) => u.game,
                (u) => u.value,
                { iterations: 10, rng: mulberry32(1) }
            )
        ).toThrow(/appari/);
    });
});

// ---- pipeline corpus (§1.2 éligibilité + §1.5 agrégats) ----------------------------

describe('scoreCorpus — mini-corpus main-calculé', () => {
    const scored = scoreCorpus('synth', CORPUS);

    it('premier patch jamais scoré, comptes d’éligibilité exacts', () => {
        expect(scored.notes.records).toBe(3);
        expect(scored.notes.discardedFirstPatch).toBe(2); // t1, t2
        expect(scored.notes.gamesScored).toBe(1); // g1
        expect(scored.notes.discardedNoPatch).toBe(0);
        expect(scored.notes.discardedUnresolved).toBe(0);
        expect(scored.notes.unitsDiscardedNoDatedTrain).toBe(0);
        expect(scored.notes.unitsMLt6).toBe(0);
        expect(scored.notes.units).toBe(2);
    });

    it('unités (g1, blue) et (g1, red) : rangs des trois bras', () => {
        const blue = scored.units.find((u) => u.side === 'blue');
        const red = scored.units.find((u) => u.side === 'red');
        if (blue === undefined || red === undefined) throw new Error('unités manquantes');
        expect(blue.team).toBe('T');
        expect(blue.m).toBe(6);
        expect(blue.ranksModel).toEqual([3, 1, 1, undefined, undefined, undefined]);
        expect(blue.ranksBaseline).toEqual([5, 3, 1, undefined, undefined, undefined]);
        expect(blue.ranksPresence).toEqual([5, 3, 1, undefined, undefined, undefined]);
        expect(blue.teamGamesInTrain).toBe(2); // T apparaît dans t1 et t2
        expect(red.team).toBe('U');
        expect(red.ranksModel).toEqual(new Array(6).fill(undefined));
        expect(red.ranksPresence).toEqual([1, undefined, undefined, undefined, undefined, undefined]);
    });

    it('stats de cache : 2 tables équipe (T, U), 1 table ligue', () => {
        expect(scored.cacheStats.teamTables).toBe(2);
        expect(scored.cacheStats.teamRequests).toBe(2);
        expect(scored.cacheStats.leagueTables).toBe(1);
        expect(scored.cacheStats.leagueRequests).toBe(2);
    });

    it('éligibilité : patch absent/illisible, action non résolue, m < 6, now introuvable', () => {
        const e3 = rec('e3', '2.1', undefined, 'T', 'U', [act(1, 'A')]); // train NON daté
        const eligibility = scoreCorpus('elig', [
            rec('e1', undefined, '2026-03-01', 'T', 'U', [act(1, 'A')]),
            rec('e2', 'abc', '2026-03-01', 'T', 'U', [act(1, 'A')]),
            e3,
            rec('e4', '2.2', '2026-03-01', 'T', 'U', [act(1, '')]), // non résolue
            rec('e5', '2.2', '2026-03-01', 'T', 'U', [act(1, 'B')]), // m = 1 < 6 des 2 côtés
            rec('e6', '2.2', undefined, 'T', 'U', [act(1, 'D')]) // ni game ni train datés
        ]);
        expect(eligibility.notes.discardedNoPatch).toBe(2); // e1 + e2
        expect(eligibility.notes.discardedFirstPatch).toBe(1); // e3
        expect(eligibility.notes.discardedUnresolved).toBe(1); // e4
        expect(eligibility.notes.gamesScored).toBe(2); // e5 + e6
        expect(eligibility.notes.unitsDiscardedNoDatedTrain).toBe(2); // e6 × 2 côtés
        // e5 : blue m = 1, red m = 0 → 2 unités comptées m < 6.
        expect(eligibility.notes.unitsMLt6).toBe(2);
        expect(eligibility.notes.units).toBe(2);
    });
});

// ---- agrégation publiée + verdict (§1.5-§1.6) --------------------------------------

describe('buildPlanCoverageData — pool, identité, verdict', () => {
    const scored = scoreCorpus('synth', CORPUS);
    const data = buildPlanCoverageData([scored], { rng: mulberry32(42) });

    it('profondeurs moyennes main-calculées : modèle 1,5 vs baseline 0 (K = 4, cap 6)', () => {
        // blue : D_A = 3 (rangs 3,1,1 tous ≤ 4), D_B = 0 (rang 5 > 4) ; red : 0/0.
        expect(data.pool.unitsPrimary).toBe(2);
        expect(data.pool.meanDepthModel).toBeCloseTo(1.5, 12);
        expect(data.pool.meanDepthBaseline).toBeCloseTo(0, 12);
        // présence : blue D = 0 (rang 5 > 4), red D = 1 (rang 1) → 0,5.
        expect(data.pool.meanDepthPresence).toBeCloseTo(0.5, 12);
    });

    it("l'identité moyenne(D) = Σ survive est PUBLIÉE et exacte pour les deux bras", () => {
        expect(data.pool.identityModel.meanHeldDepth).toBeCloseTo(1.5, 12);
        expect(data.pool.identityModel.surviveSum).toBeCloseTo(data.pool.identityModel.meanHeldDepth, 12);
        expect(data.pool.identityBaseline.surviveSum).toBeCloseTo(data.pool.identityBaseline.meanHeldDepth, 12);
    });

    it('grille : cellules main-calculées (K = 4 et K = 1)', () => {
        const cell = (k: number, p: number) => {
            const found = data.pool.gridModel.find((c) => c.k === k && c.p === p);
            if (found === undefined) throw new Error(`cellule (${k}, ${p}) absente`);
            return found;
        };
        expect(cell(4, 1).rate).toBeCloseTo(0.5, 12); // blue survit (rang 3 ≤ 4), red non
        expect(cell(4, 3).rate).toBeCloseTo(0.5, 12);
        expect(cell(4, 4).rate).toBeCloseTo(0, 12); // pick seq 10 : miss
        expect(cell(1, 1).rate).toBeCloseTo(0, 12); // rang 3 > 1
        expect(cell(4, 7).n).toBe(0); // m = 6 : P = 7 indéfini partout
        expect(Number.isNaN(cell(4, 7).rate)).toBe(true);
        // Grille complète : {1,2,4,6,8} × {1…10} pour les deux bras.
        expect(data.pool.gridModel).toHaveLength(50);
        expect(data.pool.gridBaseline).toHaveLength(50);
    });

    it('taux par slotGroup (K = 4) : B1-B3 modèle 3/6, baseline 2/6', () => {
        const b13 = data.pool.slotGroupRates.find((r) => r.slotGroup === 'B1-B3');
        if (b13 === undefined) throw new Error('B1-B3 absent');
        expect(b13.n).toBe(6);
        expect(b13.hitsModel).toBe(3);
        expect(b13.rateModel).toBeCloseTo(0.5, 12);
        expect(b13.hitsBaseline).toBe(2);
        expect(b13.rateBaseline).toBeCloseTo(2 / 6, 12);
        const p1 = data.pool.slotGroupRates.find((r) => r.slotGroup === 'P1');
        expect(p1?.n).toBe(1);
        expect(p1?.hitsModel).toBe(0);
    });

    it('tranches descriptives : tout le monde < 10 games au train', () => {
        const lt = data.pool.slices.find((s) => s.label.includes('<'));
        const ge = data.pool.slices.find((s) => s.label.includes('≥'));
        expect(lt?.n).toBe(2);
        expect(lt?.meanDepthModel).toBeCloseTo(1.5, 12);
        expect(ge?.n).toBe(0);
        expect(Number.isNaN(ge?.meanDepthModel ?? NaN)).toBe(true);
    });

    it('verdict : Δ = 1,5, une seule game ⇒ IC dégénéré [1,5 ; 1,5] ⇒ VERT (lo > 0)', () => {
        expect(data.pool.primary.delta).toBeCloseTo(1.5, 12);
        expect(data.pool.primary.ci95.lo).toBeCloseTo(1.5, 12);
        expect(data.pool.primary.ci95.hi).toBeCloseTo(1.5, 12);
        expect(data.pool.primary.clusters).toBe(1);
        expect(data.pool.primary.observations).toBe(2);
        expect(data.pool.verdictVert).toBe(true);
    });

    it('Δ nul ⇒ lo = 0 ⇒ PAS vert (strictement positif exigé)', () => {
        const unit = (game: string, ranks: (number | undefined)[]): ScoredUnit => ({
            corpus: 'x',
            gameId: game,
            side: 'blue',
            team: 'T',
            m: ranks.length,
            slotGroups: new Array(ranks.length).fill(undefined),
            ranksModel: ranks,
            ranksBaseline: ranks, // identiques ⇒ Δ = 0 partout
            ranksPresence: ranks,
            teamGamesInTrain: 0
        });
        const corpus: ScoredCorpus = {
            label: 'x',
            notes: {
                records: 2,
                gamesScored: 2,
                discardedNoPatch: 0,
                discardedUnresolved: 0,
                discardedFirstPatch: 0,
                unitsDiscardedNoDatedTrain: 0,
                unitsMLt6: 0,
                units: 2
            },
            units: [unit('ga', [1, 1, 1, 1, 1, 1]), unit('gb', [9, 9, 9, 9, 9, 9])],
            cacheStats: { teamTables: 0, teamRequests: 0, leagueTables: 0, leagueRequests: 0 }
        };
        const flat = buildPlanCoverageData([corpus], { rng: mulberry32(42) });
        expect(flat.pool.primary.delta).toBe(0);
        expect(flat.pool.primary.ci95.lo).toBe(0);
        expect(flat.pool.verdictVert).toBe(false);
    });

    it('rejouer mulberry32(42) reproduit exactement le même IC (pré-enregistrement)', () => {
        const again = buildPlanCoverageData([scoreCorpus('synth', CORPUS)], { rng: mulberry32(42) });
        expect(again.pool.primary.ci95).toEqual(data.pool.primary.ci95);
    });

    it('résumé par corpus : colonne K = 4 + point d’usage', () => {
        expect(data.perCorpus).toHaveLength(1);
        const corpus = data.perCorpus[0];
        expect(corpus.label).toBe('synth');
        expect(corpus.unitsPrimary).toBe(2);
        expect(corpus.meanDepthModel).toBeCloseTo(1.5, 12);
        expect(corpus.columnModel).toHaveLength(10); // P = 1…10 à K = 4
        expect(corpus.columnModel[0].rate).toBeCloseTo(0.5, 12);
    });

    it('les paramètres gelés sont bien ceux de la règle', () => {
        expect(PLAN_COVERAGE_FROZEN.alpha).toBe(5);
        expect(PLAN_COVERAGE_FROZEN.lambdaPerWeek).toBe(0.9);
        expect(PLAN_COVERAGE_FROZEN.ks).toEqual([1, 2, 4, 6, 8]);
        expect(PLAN_COVERAGE_FROZEN.kUsage).toBe(4);
        expect(PLAN_COVERAGE_FROZEN.pCap).toBe(6);
        expect(PLAN_COVERAGE_FROZEN.iterations).toBe(1000);
        expect(data.kUsage).toBe(4);
        expect(data.pCap).toBe(6);
    });
});
