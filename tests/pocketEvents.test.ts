/**
 * Chantier F — pocketEvents (définitions structurelles F1/F2, gelées).
 *
 * Nombre de tests DÉRIVÉ À LA MAIN depuis les contrats de la spec
 * (docs/run2/F-pocket-picks.md §3.1/§3.2) :
 *  - seuils gelés (0 / ≤2 / ≥20 / ≥5) ............................ 1 test
 *  - isPocketEvent P1∧P2∧P3 aux bornes (2 incl., 3 excl., P1, P3
 *    paramètre injecté) ........................................... 4 tests
 *  - isNoveltyContrastEvent aux bornes (20 incl., 19 excl., P1, P3) 4 tests
 *  - tallyPocketTrain/pocketCountsOf (comptes à la main, bans et
 *    irrésolus ignorés, inconnus → 0) ............................. 3 tests
 *  - classes F2 : A aux bornes 5/4, (c,r)=1, B 0/1/undefined,
 *    flex jamais événement, flex déplacé = classe A ............... 5 tests
 *  - roleCompleteSidePicks (tri seq, rôle manquant/irrésolu, 4) ... 3 tests
 *  - oneSideOf (4 cas) / noveltyGameVerdictOf (pocket-present,
 *    both-sides) .................................................. 3 tests
 *  - eventNeighborsOf : 1 évt → 4 voisins ; double évt → 3 chacun
 *    (scores mutuels exclus) ; évt hors side ignoré ............... 3 tests
 *  - fixture g2-nasus (données CORRIGÉES) : séquence KC-G2-KC-G2-G2
 *    + Nasus G2 jungle seq 17 ; événement = pocket P1-P3 (selon la
 *    liste injectée) ∧ classe B ................................... 2 tests
 *  TOTAL ........................................................... 28 tests
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    ESTABLISHED_FOLD_MIN,
    NOVELTY_LEAGUE_TRAIN_MIN,
    POCKET_LEAGUE_TRAIN_MAX,
    POCKET_TEAM_TRAIN_MAX,
    eventNeighborsOf,
    foldCountsOf,
    isClassAEvent,
    isClassBEvent,
    isLegitimateFlex,
    isNoveltyContrastEvent,
    isPocketEvent,
    noveltyGameVerdictOf,
    oneSideOf,
    pocketCountsOf,
    roleCompleteSidePicks,
    tallyPocketTrain
} from '$lib/backtest/pocketEvents';
import { fitRolePriors } from '$lib/aggregates/rolePriors';
import type { DraftAction, DraftRecord, DraftSide } from '$lib/data/types';
import { Role } from '$lib/types';

// ---- fabrique de records synthétiques -----------------------------------------

interface PickSpec {
    side: DraftSide;
    championKey: string;
    role?: Role;
    seq?: number;
}

function recordOf(blueTeam: string, redTeam: string, picks: PickSpec[], bans: PickSpec[] = []): DraftRecord {
    let nextSeq = 7;
    const actions: DraftAction[] = picks.map((p) => {
        const action: DraftAction = {
            seq: p.seq ?? nextSeq++,
            type: 'pick',
            phase: 'pick1',
            side: p.side,
            championKey: p.championKey,
            championName: p.championKey
        };
        if (p.role !== undefined) action.role = p.role;
        return action;
    });
    let banSeq = 1;
    for (const b of bans) {
        actions.push({
            seq: b.seq ?? banSeq++,
            type: 'ban',
            phase: 'ban1',
            side: b.side,
            championKey: b.championKey,
            championName: b.championKey
        });
    }
    return {
        gameId: `synth-${blueTeam}-${redTeam}-${actions.length}`,
        blueTeam,
        redTeam,
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions,
        warnings: [],
        provenance: { source: 'manual', fetchedAt: '2026-06-11T00:00:00Z' }
    };
}

const NO_NEW = new Set<string>();

// ---- seuils gelés ---------------------------------------------------------------

describe('seuils gelés §3.1/§3.2', () => {
    it('0 / ≤2 / ≥20 / ≥5 — aucune autre valeur', () => {
        expect(POCKET_TEAM_TRAIN_MAX).toBe(0);
        expect(POCKET_LEAGUE_TRAIN_MAX).toBe(2);
        expect(NOVELTY_LEAGUE_TRAIN_MIN).toBe(20);
        expect(ESTABLISHED_FOLD_MIN).toBe(5);
    });
});

// ---- isPocketEvent ----------------------------------------------------------------

describe('isPocketEvent — P1 ∧ P2 ∧ P3 aux bornes', () => {
    it('borne P2 incluse : équipe 0, ligue 2 → événement', () => {
        expect(isPocketEvent('c', { teamTrainPicks: 0, leagueTrainPicks: 2 }, NO_NEW)).toBe(true);
    });

    it('P2 dépassé d’un : ligue 3 → pas un événement', () => {
        expect(isPocketEvent('c', { teamTrainPicks: 0, leagueTrainPicks: 3 }, NO_NEW)).toBe(false);
    });

    it('P1 cassé : équipe 1 → pas un événement (même ligue 0)', () => {
        expect(isPocketEvent('c', { teamTrainPicks: 1, leagueTrainPicks: 0 }, NO_NEW)).toBe(false);
    });

    it('P3 est un PARAMÈTRE injecté : champion dans la liste → exclu, hors liste → admis', () => {
        const counts = { teamTrainPicks: 0, leagueTrainPicks: 0 };
        expect(isPocketEvent('mel', counts, new Set(['mel']))).toBe(false);
        expect(isPocketEvent('mel', counts, new Set(['autre']))).toBe(true);
    });
});

// ---- isNoveltyContrastEvent ---------------------------------------------------------

describe('isNoveltyContrastEvent — P1 ∧ ligue ≥ 20 ∧ P3', () => {
    it('borne incluse : équipe 0, ligue 20 → nouveauté banale', () => {
        expect(isNoveltyContrastEvent('c', { teamTrainPicks: 0, leagueTrainPicks: 20 }, NO_NEW)).toBe(true);
    });

    it('ligue 19 → pas une nouveauté banale', () => {
        expect(isNoveltyContrastEvent('c', { teamTrainPicks: 0, leagueTrainPicks: 19 }, NO_NEW)).toBe(false);
    });

    it('P1 cassé : équipe 1, ligue 25 → non', () => {
        expect(isNoveltyContrastEvent('c', { teamTrainPicks: 1, leagueTrainPicks: 25 }, NO_NEW)).toBe(false);
    });

    it('P3 : nouveau champion (liste injectée) → non, même à ligue 25', () => {
        expect(
            isNoveltyContrastEvent('mel', { teamTrainPicks: 0, leagueTrainPicks: 25 }, new Set(['mel']))
        ).toBe(false);
    });
});

// ---- tallyPocketTrain / pocketCountsOf ---------------------------------------------

describe('tallyPocketTrain / pocketCountsOf', () => {
    // Train à la main : T picke A deux fois (une côté blue, une côté red),
    // U picke B deux fois ⇒ ligue A=2, B=2 ; équipe T : A=2 ; équipe U : B=2.
    const train = [
        recordOf('T', 'U', [
            { side: 'blue', championKey: 'A', role: Role.Top },
            { side: 'red', championKey: 'B', role: Role.Top }
        ]),
        recordOf('U', 'T', [
            { side: 'red', championKey: 'A', role: Role.Top },
            { side: 'blue', championKey: 'B', role: Role.Top }
        ])
    ];

    it('comptes équipe et ligue exacts (équipe = côté agissant du record)', () => {
        const tallies = tallyPocketTrain(train);
        expect(pocketCountsOf(tallies, 'T', 'A')).toEqual({ teamTrainPicks: 2, leagueTrainPicks: 2 });
        expect(pocketCountsOf(tallies, 'U', 'B')).toEqual({ teamTrainPicks: 2, leagueTrainPicks: 2 });
        expect(pocketCountsOf(tallies, 'T', 'B')).toEqual({ teamTrainPicks: 0, leagueTrainPicks: 2 });
    });

    it('bans et picks irrésolus ne comptent jamais', () => {
        const tallies = tallyPocketTrain([
            recordOf(
                'T',
                'U',
                [
                    { side: 'blue', championKey: 'A', role: Role.Top },
                    { side: 'red', championKey: '', role: Role.Top }
                ],
                [{ side: 'red', championKey: 'A' }]
            )
        ]);
        expect(pocketCountsOf(tallies, 'T', 'A')).toEqual({ teamTrainPicks: 1, leagueTrainPicks: 1 });
        expect(pocketCountsOf(tallies, 'U', '')).toEqual({ teamTrainPicks: 0, leagueTrainPicks: 0 });
    });

    it('équipe ou champion inconnus du train → comptes 0 (P1/P2 vrais par défaut)', () => {
        const tallies = tallyPocketTrain(train);
        expect(pocketCountsOf(tallies, 'Inconnue', 'A')).toEqual({ teamTrainPicks: 0, leagueTrainPicks: 2 });
        expect(pocketCountsOf(tallies, 'T', 'Z')).toEqual({ teamTrainPicks: 0, leagueTrainPicks: 0 });
    });
});

// ---- classes F2 (fold) ---------------------------------------------------------------

describe('classes F2 — A « hors-rôle établi », B « hors-corpus », flex', () => {
    it('classe A au seuil : (c, r) = 0 ∧ total 5 → oui ; total 4 → non', () => {
        expect(isClassAEvent(foldCountsOf({ [Role.Top]: 5 }), Role.Jungle)).toBe(true);
        expect(isClassAEvent(foldCountsOf({ [Role.Top]: 4 }), Role.Jungle)).toBe(false);
    });

    it('(c, r) = 1 → jamais classe A (le rôle a déjà été vu)', () => {
        expect(isClassAEvent(foldCountsOf({ [Role.Jungle]: 1, [Role.Top]: 9 }), Role.Jungle)).toBe(false);
    });

    it('classe B : total 0 → oui (y compris champion absent du fold) ; total 1 → non', () => {
        expect(isClassBEvent(foldCountsOf({}))).toBe(true);
        expect(isClassBEvent(foldCountsOf(undefined))).toBe(true);
        expect(isClassBEvent(foldCountsOf({ [Role.Top]: 1 }))).toBe(false);
    });

    it('FLEX légitime (deux rôles ≥ 1, joué dans l’un d’eux) : jamais un événement', () => {
        const counts = foldCountsOf({ [Role.Top]: 3, [Role.Middle]: 2 });
        expect(isLegitimateFlex(counts, Role.Top)).toBe(true);
        expect(isLegitimateFlex(counts, Role.Middle)).toBe(true);
        expect(isClassAEvent(counts, Role.Top)).toBe(false);
        expect(isClassAEvent(counts, Role.Middle)).toBe(false);
        expect(isClassBEvent(counts)).toBe(false);
    });

    it('flex DÉPLACÉ dans un 3ᵉ rôle jamais vu (total ≥ 5) → classe A, pas un flex au rôle joué', () => {
        const counts = foldCountsOf({ [Role.Top]: 3, [Role.Middle]: 2 });
        expect(isLegitimateFlex(counts, Role.Jungle)).toBe(false);
        expect(isClassAEvent(counts, Role.Jungle)).toBe(true);
    });
});

// ---- roleCompleteSidePicks --------------------------------------------------------------

describe('roleCompleteSidePicks — patron du harnais roleInference', () => {
    it('5 picks résolus avec rôle, triés par seq (entrée désordonnée)', () => {
        const record = recordOf('T', 'U', [
            { side: 'blue', championKey: 'e', role: Role.Support, seq: 19 },
            { side: 'blue', championKey: 'a', role: Role.Top, seq: 7 },
            { side: 'blue', championKey: 'd', role: Role.Bottom, seq: 18 },
            { side: 'blue', championKey: 'b', role: Role.Jungle, seq: 10 },
            { side: 'blue', championKey: 'c', role: Role.Middle, seq: 11 },
            { side: 'red', championKey: 'x', role: Role.Top, seq: 8 }
        ]);
        const picks = roleCompleteSidePicks(record, 'blue');
        expect(picks?.map((p) => p.championKey)).toEqual(['a', 'b', 'c', 'd', 'e']);
        expect(picks?.map((p) => p.seq)).toEqual([7, 10, 11, 18, 19]);
    });

    it('rôle manquant ou pick irrésolu → undefined (side non rôle-complet)', () => {
        const noRole = recordOf('T', 'U', [
            { side: 'blue', championKey: 'a', role: Role.Top },
            { side: 'blue', championKey: 'b', role: Role.Jungle },
            { side: 'blue', championKey: 'c', role: Role.Middle },
            { side: 'blue', championKey: 'd', role: Role.Bottom },
            { side: 'blue', championKey: 'e' }
        ]);
        expect(roleCompleteSidePicks(noRole, 'blue')).toBeUndefined();
        const unresolved = recordOf('T', 'U', [
            { side: 'blue', championKey: 'a', role: Role.Top },
            { side: 'blue', championKey: 'b', role: Role.Jungle },
            { side: 'blue', championKey: 'c', role: Role.Middle },
            { side: 'blue', championKey: 'd', role: Role.Bottom },
            { side: 'blue', championKey: '', role: Role.Support }
        ]);
        expect(roleCompleteSidePicks(unresolved, 'blue')).toBeUndefined();
    });

    it('4 picks → undefined', () => {
        const record = recordOf('T', 'U', [
            { side: 'blue', championKey: 'a', role: Role.Top },
            { side: 'blue', championKey: 'b', role: Role.Jungle },
            { side: 'blue', championKey: 'c', role: Role.Middle },
            { side: 'blue', championKey: 'd', role: Role.Bottom }
        ]);
        expect(roleCompleteSidePicks(record, 'blue')).toBeUndefined();
    });
});

// ---- oneSideOf / noveltyGameVerdictOf ------------------------------------------------------

describe('one-side / both-sides par game (F1)', () => {
    it('oneSideOf : les 4 cas', () => {
        expect(oneSideOf(false, false)).toEqual({ kind: 'none' });
        expect(oneSideOf(true, false)).toEqual({ kind: 'one-side', side: 'blue' });
        expect(oneSideOf(false, true)).toEqual({ kind: 'one-side', side: 'red' });
        expect(oneSideOf(true, true)).toEqual({ kind: 'both-sides' });
    });

    it('classe contraste : un side nouveauté ∧ zéro pocket → scorée ; pocket présent (un camp ou l’autre) → exclue', () => {
        expect(noveltyGameVerdictOf(true, false, false, false)).toEqual({ kind: 'one-side', side: 'blue' });
        expect(noveltyGameVerdictOf(true, false, true, false)).toEqual({ kind: 'pocket-present' });
        expect(noveltyGameVerdictOf(true, false, false, true)).toEqual({ kind: 'pocket-present' });
    });

    it('nouveauté des deux côtés (sans pocket) → both-sides, exclue comptée', () => {
        expect(noveltyGameVerdictOf(true, true, false, false)).toEqual({ kind: 'both-sides' });
    });
});

// ---- eventNeighborsOf ------------------------------------------------------------------------

describe('eventNeighborsOf — exclusion mécanique des scores mutuels tautologiques', () => {
    const side = ['v1', 'v2', 'v3', 'x', 'y'];

    it('1 événement → 4 voisins (l’événement lui-même jamais voisin)', () => {
        const neighbors = eventNeighborsOf(side, new Set(['x']));
        expect([...neighbors.keys()]).toEqual(['x']);
        expect(neighbors.get('x')).toEqual(['v1', 'v2', 'v3', 'y']);
    });

    it('double événement → 3 voisins CHACUN (pas 4) : x ∉ voisins(y), y ∉ voisins(x)', () => {
        const neighbors = eventNeighborsOf(side, new Set(['x', 'y']));
        expect(neighbors.get('x')).toEqual(['v1', 'v2', 'v3']);
        expect(neighbors.get('y')).toEqual(['v1', 'v2', 'v3']);
    });

    it('événement absent du side ignoré (clés = side ∩ événements)', () => {
        const neighbors = eventNeighborsOf(side, new Set(['x', 'hors-side']));
        expect([...neighbors.keys()]).toEqual(['x']);
    });
});

// ---- fixture g2-nasus (cas fondateur, données CORRIGÉES) --------------------------------------

describe('fixture g2-nasus — données corrigées du cas fondateur', () => {
    const series = JSON.parse(
        readFileSync(join(process.cwd(), 'tests', 'fixtures', 'pocket', 'g2-nasus.json'), 'utf8')
    ) as DraftRecord[];

    it('séquence des vainqueurs KC-G2-KC-G2-G2 ; Nasus = G2, game 5, seq 17, rôle Jungle', () => {
        const winners = series.map((g) => (g.winner === 'blue' ? g.blueTeam : g.redTeam));
        expect(winners).toEqual(['Karmine Corp', 'G2 Esports', 'Karmine Corp', 'G2 Esports', 'G2 Esports']);
        const g5 = series[4];
        expect(g5.series?.gameNumber).toBe(5);
        const nasus = g5.actions.find((a) => a.championKey === '75');
        expect(nasus?.side).toBe('red');
        expect(g5.redTeam).toBe('G2 Esports');
        expect(nasus?.seq).toBe(17);
        expect(nasus?.role).toBe(Role.Jungle);
    });

    it('événement Nasus (train = games 1-4) : pocket P1-P3 si la liste injectée l’admet, et classe B', () => {
        const train = series.slice(0, 4);
        const tallies = tallyPocketTrain(train);
        const counts = pocketCountsOf(tallies, 'G2 Esports', '75');
        expect(counts).toEqual({ teamTrainPicks: 0, leagueTrainPicks: 0 });
        expect(isPocketEvent('75', counts, NO_NEW)).toBe(true);
        // Liste DDragon injectée contenant Nasus ⇒ P3 le rejette (paramètre, pas constante).
        expect(isPocketEvent('75', counts, new Set(['75']))).toBe(false);
        // Classe B : fold (fitRolePriors du harnais) sans aucun pick de Nasus.
        const fold = fitRolePriors(train);
        const foldCounts = foldCountsOf(fold.byChampion.get('75'));
        expect(isClassBEvent(foldCounts)).toBe(true);
        expect(isClassAEvent(foldCounts, Role.Jungle)).toBe(false);
        // Le side G2 de la G5 est rôle-complet (5 picks résolus avec rôles).
        expect(roleCompleteSidePicks(series[4], 'red')?.map((p) => p.championKey)).toEqual([
            '12',
            '34',
            '235',
            '75',
            '240'
        ]);
    });
});
