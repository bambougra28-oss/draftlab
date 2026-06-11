/**
 * Gate COACH (run #2, chantier A) — tests calculés À LA MAIN depuis la règle
 * gelée (docs/run2/A-coach-gate.md §1.3-1.4, §2.2) :
 *  - percentile avec égalités à ½ (l'exemple du contrat §2.2 inclus) ;
 *  - crédit 1 / ½ / 0 ;
 *  - scoreGameForGate sur tables posées (skips dans l'ordre de la règle,
 *    template-mismatch sur ban skippé, side-coverage à 3 tours, anomalie) ;
 *  - baseline B1 (rang de présence) qui reproduit un crédit calculé à la main
 *    sur EXACTEMENT les mêmes tours que le modèle (protocole §1.4) ;
 *  - TEST D'ÉQUIVALENCE OBLIGATOIRE : la chaîne du runner (imports liveDraft
 *    + navigate) reproduit exactement candidates[].championKey et
 *    enemyExpectation de recommendNext (état synthétique, roster absent) ;
 *  - racine forcée ≡ navigate non forcé pour le candidat classé premier,
 *    memo partagé sans contamination ;
 *  - runner scripts/backtest/coachGate.ts : rendu byte-stable sur le
 *    mini-corpus synthétique (fixtures coachgate/) + --smoke aveugle.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    creditOf,
    eligibilitySkipOf,
    percentileAmong,
    scoreGameForGate,
    type CoachTurnScore,
    type ScoreGameDeps
} from '$lib/backtest/coachGate';
import {
    draftStateFromActions,
    enemyDistributionOf,
    rankOurCandidates,
    recommendNext,
    type CoachContext
} from '$lib/intel/liveDraft';
import { navigate, nextSlotOf, type NavigatorMemoEntry } from '$lib/strategic/draftNavigator';
import { buildTendencyTable } from '$lib/aggregates/tendency';
import { buildDraftActions } from '$lib/data/draftRecord';
import type { DraftRecord, DraftSide } from '$lib/data/types';

// ---- percentileAmong / creditOf : contrats §1.3 et §2.2, à la main ------------

describe('percentileAmong', () => {
    it('exemple du contrat §2.2 : (1 + 0,5)/3 = 0,5', () => {
        expect(percentileAmong(0.52, [0.5, 0.52, 0.55])).toBe(0.5);
    });

    it('au-dessus de tous : 1 ; en dessous de tous : 0', () => {
        expect(percentileAmong(0.7, [0.5, 0.6])).toBe(1);
        expect(percentileAmong(0.4, [0.5, 0.6])).toBe(0);
    });

    it('égalité pure : chaque tie vaut ½', () => {
        expect(percentileAmong(0.5, [0.5, 0.5])).toBe(0.5);
        // (above 1 + ties 2·0,5)/4 = 0,5
        expect(percentileAmong(0.5, [0.4, 0.5, 0.5, 0.6])).toBe(0.5);
    });

    it('comparateurs vides : NaN (jamais atteint via scoreGameForGate)', () => {
        expect(percentileAmong(0.5, [])).toBeNaN();
    });
});

describe('creditOf', () => {
    it('égalité exacte = ½ (contrat §2.2)', () => {
        expect(creditOf(0.61, 0.61)).toBe(0.5);
    });

    it('vainqueur au-dessus = 1, en dessous = 0', () => {
        expect(creditOf(0.62, 0.61)).toBe(1);
        expect(creditOf(0.6, 0.61)).toBe(0);
    });
});

// ---- fabrique de records synthétiques (template tournoi, blue first) -----------

interface Cols {
    picks: (string | undefined)[];
    bans: (string | undefined)[];
}

function recordOf(blue: Cols, red: Cols, winner?: DraftSide): DraftRecord {
    const { actions } = buildDraftActions({
        blue: { picks: blue.picks, bans: blue.bans },
        red: { picks: red.picks, bans: red.bans },
        firstPickSide: 'blue',
        resolveKey: (key) => key
    });
    const record: DraftRecord = {
        gameId: 'TEST-G1',
        blueTeam: 'NOUS',
        redTeam: 'EUX',
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-11T00:00:00Z' }
    };
    if (winner !== undefined) record.winner = winner;
    return record;
}

/** Picks : blue A1..A5 (seqs 7,10,11,18,19), red E1..E5 (8,9,12,17,20). */
const fullRecord = (winner?: DraftSide): DraftRecord =>
    recordOf(
        { picks: ['A1', 'A2', 'A3', 'A4', 'A5'], bans: ['b1', 'b3', 'b5', 'b8', 'b10'] },
        { picks: ['E1', 'E2', 'E3', 'E4', 'E5'], bans: ['b2', 'b4', 'b6', 'b7', 'b9'] },
        winner
    );

const UNIVERSE = new Set([
    ...['A1', 'A2', 'A3', 'A4', 'A5', 'E1', 'E2', 'E3', 'E4', 'E5'],
    ...['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10'],
    ...['X1', 'X2', 'X3', 'Y1', 'Y2', 'Y3', 'Z1', 'Z2', 'W1', 'W2', 'W3', 'V1', 'V2', 'V3'],
    ...['R1', 'R2', 'R3', 'K1']
]);

/** C_t posés par seq — le réel n'est dans C_t qu'au seq 7. */
const POSED_CANDIDATES: Record<number, string[]> = {
    7: ['A1', 'X1', 'X2', 'X3'],
    10: ['Y1', 'Y2', 'Y3'],
    11: ['Z1', 'Z2'],
    18: ['W1', 'W2', 'W3'],
    19: ['V1', 'V2', 'V3'],
    8: ['R1', 'R2', 'R3'],
    9: ['R1', 'R2', 'R3'],
    12: ['R1', 'R2', 'R3'],
    17: ['R1', 'R2', 'R3'],
    20: ['R1', 'R2', 'R3']
};

/** Valeurs posées par seq. Rouges : réel 0,55 vs [0,50 ; 0,55 ; 0,60] → ρ = 0,5. */
const POSED_VALUES: Record<number, Record<string, number>> = {
    7: { A1: 0.62, X1: 0.5, X2: 0.55, X3: 0.6 },
    10: { A2: 0.55, Y1: 0.5, Y2: 0.55, Y3: 0.6 },
    11: { A3: 0.7, Z1: 0.6, Z2: 0.65 },
    18: { A4: 0.4, W1: 0.5, W2: 0.6, W3: 0.7 },
    19: { A5: 0.5, V1: 0.5, V2: 0.5, V3: 0.6 },
    8: { E1: 0.55, R1: 0.5, R2: 0.55, R3: 0.6 },
    9: { E2: 0.55, R1: 0.5, R2: 0.55, R3: 0.6 },
    12: { E3: 0.55, R1: 0.5, R2: 0.55, R3: 0.6 },
    17: { E4: 0.55, R1: 0.5, R2: 0.55, R3: 0.6 },
    20: { E5: 0.55, R1: 0.5, R2: 0.55, R3: 0.6 }
};

const posedValueAt = (seq: number, key: string): number => {
    const value = POSED_VALUES[seq]?.[key];
    if (value === undefined) throw new Error(`valeur posée manquante : seq ${seq}, ${key}`);
    return value;
};

const posedDeps = (): ScoreGameDeps => ({
    availableOf: () => new Set(UNIVERSE),
    candidatesOf: (_state, slot) => POSED_CANDIDATES[slot.seq] ?? [],
    valueOf: (_state, slot, key) => posedValueAt(slot.seq, key)
});

// ---- scoreGameForGate : agrégation et skips, tout à la main --------------------

describe('scoreGameForGate', () => {
    it('game complète : percentiles, top1Agree, regret et crédit calculés à la main', () => {
        const result = scoreGameForGate(fullRecord('blue'), posedDeps());
        if ('skipped' in result) throw new Error(`skip inattendu : ${result.skipped}`);
        const { score } = result;

        // Tours bleus, dans l'ordre des seqs de pick (7, 10, 11, 18, 19) :
        // ρ = 1 (3/3) ; 0,5 ((1+0,5)/3) ; 1 (2/2) ; 0 ; 1/3 ((0+2·0,5)/3).
        const blue = score.turns.filter((t) => t.side === 'blue');
        expect(blue.map((t) => t.seq)).toEqual([7, 10, 11, 18, 19]);
        expect(blue[0].percentile).toBe(1);
        expect(blue[1].percentile).toBe(0.5);
        expect(blue[2].percentile).toBe(1);
        expect(blue[3].percentile).toBe(0);
        expect(blue[4].percentile).toBeCloseTo(1 / 3, 12);
        expect(blue.map((t) => t.comparators)).toEqual([3, 3, 2, 3, 3]);

        // seq 7 : A1 ∈ C_t et v max → top1Agree, regret 0. Ailleurs réel ∉ C_t.
        expect(blue[0].top1Agree).toBe(true);
        expect(blue[0].regret).toBe(0);
        expect(blue[1].top1Agree).toBe(false);
        expect(blue[1].regret).toBeCloseTo(0.05, 12); // 0,60 − 0,55
        expect(blue[2].regret).toBeCloseTo(-0.05, 12); // 0,65 − 0,70 (réel meilleur)
        expect(blue[3].regret).toBeCloseTo(0.3, 12); // 0,70 − 0,40

        // Rouges : 5 tours à ρ = 0,5 exactement.
        const red = score.turns.filter((t) => t.side === 'red');
        expect(red.map((t) => t.seq)).toEqual([8, 9, 12, 17, 20]);
        for (const turn of red) expect(turn.percentile).toBe(0.5);

        // R(blue) = (1 + 0,5 + 1 + 0 + 1/3)/5 = 17/30 ; R(red) = 0,5 → crédit 1.
        expect(score.winnerMean).toBeCloseTo(17 / 30, 12);
        expect(score.loserMean).toBe(0.5);
        expect(score.credit).toBe(1);
        expect(result.discarded).toEqual([]);
        expect(result.anomalies).toBe(0);
    });

    it('mêmes valeurs, vainqueur rouge : crédit 0 (0,5 < 17/30)', () => {
        const result = scoreGameForGate(fullRecord('red'), posedDeps());
        if ('skipped' in result) throw new Error(`skip inattendu : ${result.skipped}`);
        expect(result.score.winnerMean).toBe(0.5);
        expect(result.score.loserMean).toBeCloseTo(17 / 30, 12);
        expect(result.score.credit).toBe(0);
    });

    it('égalité exacte des moyennes de side : crédit ½', () => {
        const record = fullRecord('blue');
        const realKeys = new Set(['A1', 'A2', 'A3', 'A4', 'A5', 'E1', 'E2', 'E3', 'E4', 'E5']);
        const result = scoreGameForGate(record, {
            availableOf: () => new Set(UNIVERSE),
            candidatesOf: () => ['R1', 'R2', 'R3'],
            // Tout side : réel 0,55 vs [0,50 ; 0,55 ; 0,60] → ρ = 0,5 partout.
            valueOf: (_state, _slot, key) =>
                realKeys.has(key) ? 0.55 : { R1: 0.5, R2: 0.55, R3: 0.6 }[key]!
        });
        if ('skipped' in result) throw new Error(`skip inattendu : ${result.skipped}`);
        expect(result.score.winnerMean).toBe(0.5);
        expect(result.score.loserMean).toBe(0.5);
        expect(result.score.credit).toBe(0.5);
    });

    it('skips dans l’ordre de la règle : no-winner avant unresolved-picks', () => {
        const noWinner = scoreGameForGate(fullRecord(), posedDeps());
        expect('skipped' in noWinner && noWinner.skipped).toBe('no-winner');

        // Pick rouge seq 20 absent (cellule blanche) → unresolved-picks.
        const missingPick = recordOf(
            { picks: ['A1', 'A2', 'A3', 'A4', 'A5'], bans: ['b1', 'b3', 'b5', 'b8', 'b10'] },
            { picks: ['E1', 'E2', 'E3', 'E4', ''], bans: ['b2', 'b4', 'b6', 'b7', 'b9'] },
            'blue'
        );
        const unresolved = scoreGameForGate(missingPick, posedDeps());
        expect('skipped' in unresolved && unresolved.skipped).toBe('unresolved-picks');

        // Les deux défauts cumulés → c'est le vainqueur qui manque d'abord.
        const both = recordOf(
            { picks: ['A1', 'A2', 'A3', 'A4', 'A5'], bans: ['b1', 'b3', 'b5', 'b8', 'b10'] },
            { picks: ['E1', 'E2', 'E3', 'E4', ''], bans: ['b2', 'b4', 'b6', 'b7', 'b9'] }
        );
        const bothResult = scoreGameForGate(both, posedDeps());
        expect('skipped' in bothResult && bothResult.skipped).toBe('no-winner');
    });

    it('ban seq 6 skippé : seq 7 écarté template-mismatch, game encore scorée, crédit recalculé', () => {
        // Ban rouge n°3 blanc → seq 6 absent → au tour 7, nextSlotOf rend le
        // slot 6 (ban) ≠ pick 7 → tour écarté. Blue garde 4 tours (≥ 4).
        const record = recordOf(
            { picks: ['A1', 'A2', 'A3', 'A4', 'A5'], bans: ['b1', 'b3', 'b5', 'b8', 'b10'] },
            { picks: ['E1', 'E2', 'E3', 'E4', 'E5'], bans: ['b2', 'b4', '', 'b7', 'b9'] },
            'blue'
        );
        const result = scoreGameForGate(record, posedDeps());
        if ('skipped' in result) throw new Error(`skip inattendu : ${result.skipped}`);
        expect(result.discarded).toEqual([{ seq: 7, side: 'blue', reason: 'template-mismatch' }]);
        expect(result.score.turns).toHaveLength(9);
        // R(blue) = (0,5 + 1 + 0 + 1/3)/4 = 11/24 < R(red) = 0,5 → crédit 0.
        expect(result.score.winnerMean).toBeCloseTo(11 / 24, 12);
        expect(result.score.loserMean).toBe(0.5);
        expect(result.score.credit).toBe(0);
    });

    it('side à 3 tours (2 tours bleus sans comparateurs) : skip side-coverage', () => {
        const deps = posedDeps();
        const result = scoreGameForGate(fullRecord('blue'), {
            ...deps,
            // Aux seqs 18/19, C_t posé à un seul comparateur → tours écartés.
            candidatesOf: (_state, slot) =>
                slot.seq === 18 || slot.seq === 19 ? ['K1'] : (POSED_CANDIDATES[slot.seq] ?? []),
            valueOf: (_state, slot, key) => (key === 'K1' ? 0.5 : posedValueAt(slot.seq, key))
        });
        expect('skipped' in result && result.skipped).toBe('side-coverage');
        expect(result.discarded).toEqual([
            { seq: 18, side: 'blue', reason: 'too-few-comparators' },
            { seq: 19, side: 'blue', reason: 'too-few-comparators' }
        ]);
    });

    it('pick réel hors disponibilité : anomalie comptée, jamais un crash', () => {
        const deps = posedDeps();
        const result = scoreGameForGate(fullRecord('blue'), {
            ...deps,
            availableOf: () => {
                const available = new Set(UNIVERSE);
                available.delete('A1'); // collision lockout simulée
                return available;
            }
        });
        if ('skipped' in result) throw new Error(`skip inattendu : ${result.skipped}`);
        expect(result.anomalies).toBe(1);
        expect(result.score.credit).toBe(1); // le scoring lui-même est inchangé
    });

    it('baseline B1 (rang de présence) : crédit 1 calculé à la main, mêmes tours que le modèle', () => {
        // Ordre de présence posé : [A1..A5, X1, X2, X3] → v = −index, absent = −8.
        const presenceOrder = ['A1', 'A2', 'A3', 'A4', 'A5', 'X1', 'X2', 'X3'];
        const presenceValue = new Map<string, number>(presenceOrder.map((key, i) => [key, -i]));
        const b1Deps: ScoreGameDeps = {
            availableOf: () => new Set(UNIVERSE),
            candidatesOf: () => ['X1', 'X2', 'X3'],
            valueOf: (_state, _slot, key) => presenceValue.get(key) ?? -presenceOrder.length
        };
        const b1 = scoreGameForGate(fullRecord('blue'), b1Deps);
        if ('skipped' in b1) throw new Error(`skip inattendu : ${b1.skipped}`);
        // Blue : v(A_i) ∈ [0 ; −4] > v(X*) ∈ [−5 ; −7] → ρ = 1 ×5 → R = 1.
        // Red : E* absents → v = −8 < −7 → ρ = 0 ×5 → R = 0. Crédit = 1.
        expect(b1.score.winnerMean).toBe(1);
        expect(b1.score.loserMean).toBe(0);
        expect(b1.score.credit).toBe(1);

        // Protocole §1.4 : mêmes tours scorés quel que soit valueOf.
        const other = scoreGameForGate(fullRecord('blue'), {
            ...b1Deps,
            valueOf: (_state, _slot, key) => key.charCodeAt(0) + key.length
        });
        if ('skipped' in other) throw new Error(`skip inattendu : ${other.skipped}`);
        const turnsOf = (turns: CoachTurnScore[]): [number, DraftSide, number][] =>
            turns.map((t) => [t.seq, t.side, t.comparators]);
        expect(turnsOf(other.score.turns)).toEqual(turnsOf(b1.score.turns));
    });
});

describe('eligibilitySkipOf', () => {
    it('ordre de la règle : vainqueur puis 10 picks ; null si éligible', () => {
        expect(eligibilitySkipOf(fullRecord('blue'))).toBeNull();
        expect(eligibilitySkipOf(fullRecord())).toBe('no-winner');
        const missing = recordOf(
            { picks: ['A1', 'A2', 'A3', 'A4', 'A5'], bans: ['b1', 'b3', 'b5', 'b8', 'b10'] },
            { picks: ['E1', 'E2', 'E3', 'E4', ''], bans: ['b2', 'b4', 'b6', 'b7', 'b9'] },
            'blue'
        );
        expect(eligibilitySkipOf(missing)).toBe('unresolved-picks');
    });
});

// ---- équivalence OBLIGATOIRE : chaîne runner ↔ recommendNext --------------------
// État synthétique, roster absent (fallback présence), clés réelles du fichier
// de tags. Évaluateur jouet : 0,5 + Σ poids alliés − Σ poids ennemis.

const WEIGHTS: Record<string, number> = {
    '54': 0.1, // Malphite
    '103': 0.05, // Ahri
    '18': 0.04, // Tristana
    '13': 0.03, // Ryze
    '60': 0.02, // Elise
    '412': 0.01, // Thresh
    '111': 0.06, // Nautilus (range adverse)
    '117': 0.02 // Lulu (range adverse)
};
const toyEvaluate = (allyKeys: string[], enemyKeys: string[]): number =>
    0.5 +
    allyKeys.reduce((acc, key) => acc + (WEIGHTS[key] ?? 0), 0) -
    enemyKeys.reduce((acc, key) => acc + (WEIGHTS[key] ?? 0), 0);

/** Record d'historique adverse : red P6 varie (cellule de tendance non vide). */
function tableRecord(gameId: string, redThirdPick: string): DraftRecord {
    const { actions } = buildDraftActions({
        blue: { bans: [], picks: ['13', '60', '412'] },
        red: { bans: [], picks: ['145', '68', redThirdPick] },
        firstPickSide: 'blue',
        resolveKey: (key) => key
    });
    return {
        gameId,
        date: '2026-06-01',
        blueTeam: 'NOUS',
        redTeam: 'EUX',
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-01T00:00:00Z' }
    };
}

/** État : 6 bans + picks 54(B), 145(R), 68(R), 103(B) → seq 11, pick bleu. */
function equivalenceState() {
    const { actions } = buildDraftActions({
        blue: { bans: ['86', '23', '36'], picks: ['54', '103'] },
        red: { bans: ['75', '77', '106'], picks: ['145', '68'] },
        firstPickSide: 'blue',
        resolveKey: (key) => key
    });
    return draftStateFromActions(actions);
}

function equivalenceCtx(): CoachContext {
    const history = [tableRecord('e1', '111'), tableRecord('e2', '117')];
    return {
        ourSide: 'blue',
        evaluate: toyEvaluate,
        table: buildTendencyTable(history, history, { now: '2026-06-10T00:00:00Z', team: 'EUX' }),
        fallbackCandidates: ['18', '13', '60', '412', '120', '122', '11'],
        depth: 2,
        topK: 4,
        candidateCount: 6
    };
}

describe('équivalence chaîne runner ↔ recommendNext (roster absent)', () => {
    it('candidates[].championKey, valeurs et enemyExpectation reproduits exactement', () => {
        const state = equivalenceState();
        const ctx = equivalenceCtx();
        const advice = recommendNext(state, ctx);

        // La chaîne du runner : mêmes fonctions shippées importées + navigate.
        const slot = nextSlotOf(state);
        expect(slot).toMatchObject({ seq: 11, type: 'pick', side: 'blue' });
        const shipped6 = rankOurCandidates(ctx, state, 6);
        expect(shipped6).toEqual(['18', '13', '60', '412', '120', '122']);
        const manual = navigate(state, {
            ourSide: 'blue',
            ourCandidates: () => shipped6,
            enemyDistribution: (s, enemySlot) => enemyDistributionOf(ctx, s, enemySlot),
            evaluate: toyEvaluate,
            depth: 2,
            topK: 4
        });

        // Équivalence exacte clé par clé, valeur par valeur.
        expect(manual.candidates.map((c) => c.championKey)).toEqual(
            advice.candidates.map((c) => c.championKey)
        );
        manual.candidates.forEach((candidate, index) => {
            expect(candidate.value).toBe(advice.candidates[index].winAfter);
        });
        expect(enemyDistributionOf(ctx, state, slot!).slice(0, 5)).toEqual(advice.enemyExpectation);

        // Et les nombres attendus, à la main : racine = 4 candidats (topK),
        // v(x) = 0,5 + (0,15 + poids(x)) − E[poids adverse P6] avec
        // E = ½·0,06 + ½·0,02 = 0,04 → 18: 0,65 ; 13: 0,64 ; 60: 0,63 ; 412: 0,62.
        expect(advice.candidates.map((c) => c.championKey)).toEqual(['18', '13', '60', '412']);
        expect(advice.candidates[0].winAfter).toBeCloseTo(0.65, 10);
        expect(advice.candidates[1].winAfter).toBeCloseTo(0.64, 10);
        expect(advice.candidates[2].winAfter).toBeCloseTo(0.63, 10);
        expect(advice.candidates[3].winAfter).toBeCloseTo(0.62, 10);
        // P4-5|blue du train adverse : {60, 412}, p = ½ chacun, clé asc.
        expect(advice.enemyExpectation).toEqual([
            { championKey: '412', p: 0.5 },
            { championKey: '60', p: 0.5 }
        ]);
    });

    it('racine forcée ≡ navigate non forcé pour le candidat classé premier (memo partagé sain)', () => {
        const state = equivalenceState();
        const ctx = equivalenceCtx();
        const shipped6 = rankOurCandidates(ctx, state, 6);
        const unforced = navigate(state, {
            ourSide: 'blue',
            ourCandidates: () => shipped6,
            enemyDistribution: (s, enemySlot) => enemyDistributionOf(ctx, s, enemySlot),
            evaluate: toyEvaluate,
            depth: 2,
            topK: 4
        });
        expect(unforced.candidates[0].championKey).toBe('18');

        const memo = new Map<string, NavigatorMemoEntry>();
        const forcedValueOf = (championKey: string): number => {
            const result = navigate(state, {
                ourSide: 'blue',
                ourCandidates: (s) =>
                    s.actions.length === state.actions.length ? [championKey] : shipped6,
                enemyDistribution: (s, enemySlot) => enemyDistributionOf(ctx, s, enemySlot),
                evaluate: toyEvaluate,
                depth: 2,
                topK: 4,
                memo // partagé entre les racines forcées du même tour (§1.3)
            });
            expect(result.candidates).toHaveLength(1);
            expect(result.candidates[0].championKey).toBe(championKey);
            return result.candidates[0].value;
        };

        const valueByKey = new Map(unforced.candidates.map((c) => [c.championKey, c.value]));
        expect(forcedValueOf('18')).toBe(valueByKey.get('18'));
        expect(forcedValueOf('13')).toBe(valueByKey.get('13')); // memo déjà chaud : zéro contamination
        expect(forcedValueOf('18')).toBeCloseTo(0.65, 10);
    });
});

// ---- runner : rendu byte-stable + smoke aveugle (fixtures synthétiques) --------

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..');
const runnerScript = resolve(repoRoot, 'scripts', 'backtest', 'coachGate.ts');
const fixtureCorpus = 'tests/fixtures/coachgate/corpus.json';
const fixtureDataset = 'tests/fixtures/coachgate/dataset.json';

const runnerArgs = (extra: string[]): string[] => [
    '--experimental-transform-types',
    '--no-warnings',
    runnerScript,
    fixtureCorpus,
    '--dataset',
    fixtureDataset,
    '--full-dataset',
    fixtureDataset,
    '--seed',
    '42',
    '--generated-at',
    '2026-06-11T00:00:00.000Z',
    ...extra
];

describe('runner scripts/backtest/coachGate.ts (mini-corpus synthétique)', () => {
    it(
        'rendu byte-stable à seed/--generated-at fixés + couverture calculée à la main',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'coachgate-'));
            const out1 = join(dir, 'rapport-1.md');
            const out2 = join(dir, 'rapport-2.md');
            execFileSync(process.execPath, runnerArgs(['--out', out1]), { cwd: repoRoot, stdio: 'pipe' });
            execFileSync(process.execPath, runnerArgs(['--out', out2]), { cwd: repoRoot, stdio: 'pipe' });
            const report1 = readFileSync(out1, 'utf8');
            const report2 = readFileSync(out2, 'utf8');
            expect(report1).toBe(report2); // byte-stable

            // Structure du rapport (patron postdiction).
            expect(report1).toContain('# Gate COACH — postdiction « conseil suivi »');
            expect(report1).toContain('## Verdict (critères gelés §1.5)');
            expect(report1).toContain('## Métrique primaire — taux de discrimination (TD)');
            expect(report1).toContain('## Baseline B1 — coach-présence (baseline ACTIVE)');
            expect(report1).toContain('### S5 — TD poolé sous IC bootstrap clusterisé par série');
            expect(report1).toContain('## Couverture');
            expect(report1).toContain('## Notes honnêtes');
            expect(report1).toContain('seed 42');
            expect(report1).toContain('sha256');

            // Couverture, comptes à la main depuis la fixture (9 records :
            // 2× patch 1.1 et 1× patch non parseable → no-fold ; 1 sans
            // vainqueur ; 1 pick non résolu ; 4 scorées dont CG-G6 à 9 tours
            // — ban 6 skippé → 1 template-mismatch ; 39 tours, 19 avec nœud
            // adverse actif {7,9,11,17,19} ×3 + {9,11,17,19} ; C_t = présence
            // du train [901,902,903,941] jamais le pick réel → 0/39).
            expect(report1).toContain('| TOUS corpus | 4 |');
            expect(report1).toContain('9 records → 4 éligibles (1 sans vainqueur, 1 avec picks non résolus, 3 sans fold)');
            expect(report1).toContain('4 scorées (0 écartées side-coverage)');
            expect(report1).toContain('39 tours scorés');
            expect(report1).toContain('écartés : 1 template-mismatch, 0 too-few-comparators');
            expect(report1).toContain('distribution adverse active 19/39 tours');
            expect(report1).toContain('pick réel déjà dans C_t 0/39');
            expect(report1).toContain('anomalies 0');
            // Détecteur Fearless : seule SER-1 game 2 est examinée (10 picks, 0 réutilisé).
            expect(report1).toContain('0/10 → lockouts ON');
            // Clusters du bootstrap : SER-1 + CG-G3 + CG-G6 = 3.
            expect(report1).toContain('(3 clusters, 4 games, 1000 resamples, seed 42)');
        },
        240000
    );

    it(
        '--smoke aveugle : timing + couverture en comptes, aucun taux, aucun rapport écrit',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'coachgate-smoke-'));
            const out = join(dir, 'rapport-smoke.md');
            const stdout = execFileSync(process.execPath, runnerArgs(['--out', out, '--smoke']), {
                cwd: repoRoot,
                encoding: 'utf8'
            });
            expect(stdout).toContain('[smoke] corpus tests/fixtures/coachgate/corpus.json');
            expect(stdout).toContain('lockouts ON');
            expect(stdout).toContain('records 9');
            expect(stdout).toContain('games éligibles 4 · scorées 4 · tours scorés 39');
            expect(stdout).toContain('template-mismatch 1');
            expect(stdout).toContain('durée');
            // Aveugle : aucun taux, aucun pourcentage, aucun TD, rien d'écrit.
            expect(stdout).not.toMatch(/TD/);
            expect(stdout).not.toMatch(/%/);
            expect(existsSync(out)).toBe(false);
        },
        240000
    );
});
