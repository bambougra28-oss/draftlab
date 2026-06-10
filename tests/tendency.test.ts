import { describe, it, expect } from 'vitest';
import {
    buildTendencyTable,
    cellKey,
    evidenceString,
    predict,
    recencyWeight,
    slotGroupOf
} from '$lib/aggregates/tendency';
import type { DraftAction, DraftPhase, DraftRecord, DraftSide } from '$lib/data/types';

/** Local DraftRecord factory — teams and dates matter here. */
function phaseOf(seq: number): DraftPhase {
    if (seq <= 6) return 'ban1';
    if (seq <= 12) return 'pick1';
    if (seq <= 16) return 'ban2';
    return 'pick2';
}

function pick(seq: number, side: DraftSide, championKey: string): DraftAction {
    return { seq, type: 'pick', phase: phaseOf(seq), side, championKey, championName: championKey };
}

function ban(seq: number, side: DraftSide, championKey: string): DraftAction {
    return { seq, type: 'ban', phase: phaseOf(seq), side, championKey, championName: championKey };
}

function game(
    gameId: string,
    date: string | undefined,
    teams: { blue: string; red: string },
    actions: DraftAction[]
): DraftRecord {
    const record: DraftRecord = {
        gameId,
        blueTeam: teams.blue,
        redTeam: teams.red,
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-10T00:00:00Z' }
    };
    if (date !== undefined) record.date = date;
    return record;
}

const NOW = '2026-06-10T00:00:00Z';
const T1 = { blue: 'T1', red: 'X1' };

/**
 * Team corpus for T1 (now = 2026-06-10, λ = 0.9 → weights 1 / 0.9 / 0.81):
 *  tg1 (age 0w, w=1):    T1 blue — bans x1,x2,x3; first-picks a. X1 red picks o1,o2.
 *  tg2 (age 1w, w=0.9):  T1 blue — bans x1; first-picks a.
 *  tg3 (age 2w, w=0.81): T1 blue — first-picks r.
 *  tg4 (age 0w, w=1):    T1 RED — picks b1,b2 in P2-3.
 *  tg5 (age 1w, w=0.9):  T1 RED — picks b1,b3 in P2-3.
 */
const teamRecords: DraftRecord[] = [
    game('tg1', '2026-06-10T00:00:00Z', T1, [
        ban(1, 'blue', 'x1'),
        ban(3, 'blue', 'x2'),
        ban(5, 'blue', 'x3'),
        pick(7, 'blue', 'a'),
        pick(8, 'red', 'o1'),
        pick(9, 'red', 'o2')
    ]),
    game('tg2', '2026-06-03T00:00:00Z', T1, [ban(1, 'blue', 'x1'), pick(7, 'blue', 'a')]),
    game('tg3', '2026-05-27T00:00:00Z', T1, [pick(7, 'blue', 'r')]),
    game('tg4', '2026-06-10T00:00:00Z', { blue: 'X2', red: 'T1' }, [pick(8, 'red', 'b1'), pick(9, 'red', 'b2')]),
    game('tg5', '2026-06-03T00:00:00Z', { blue: 'X3', red: 'T1' }, [pick(8, 'red', 'b1'), pick(9, 'red', 'b3')])
];

/**
 * League corpus: P1-blue picks a,a,r,r,k → prior {a: 0.4, r: 0.4, k: 0.2};
 * B1-B3-blue bans x1,x9 → prior {x1: 0.5, x9: 0.5}. Old dates on purpose —
 * the prior must not be recency-weighted.
 */
function leagueCorpus(date: string): DraftRecord[] {
    const L = (n: number): { blue: string; red: string } => ({ blue: `L${n}`, red: `M${n}` });
    return [
        game('lg1', date, L(1), [pick(7, 'blue', 'a'), ban(1, 'blue', 'x1')]),
        game('lg2', date, L(2), [pick(7, 'blue', 'a'), ban(1, 'blue', 'x9')]),
        game('lg3', date, L(3), [pick(7, 'blue', 'r')]),
        game('lg4', date, L(4), [pick(7, 'blue', 'r')]),
        game('lg5', date, L(5), [pick(7, 'blue', 'k')])
    ];
}

const leagueRecords = leagueCorpus('2026-03-01T00:00:00Z');

const table = buildTendencyTable(teamRecords, leagueRecords, {
    alpha: 5,
    lambdaPerWeek: 0.9,
    now: NOW,
    team: 'T1'
});

describe('recencyWeight', () => {
    it('decays λ^weeks: 0w → 1, 1w → 0.9, 2w → 0.81, 3.5w → 0.9^3.5', () => {
        expect(recencyWeight('2026-06-10T00:00:00Z', NOW, 0.9)).toBe(1);
        expect(recencyWeight('2026-06-03T00:00:00Z', NOW, 0.9)).toBeCloseTo(0.9, 12);
        expect(recencyWeight('2026-05-27T00:00:00Z', NOW, 0.9)).toBeCloseTo(0.81, 12);
        // 3.5 weeks = 24.5 days before now → 0.9^3.5 = 0.729·√0.9
        //           = 0.729 · 0.9486832981 = 0.6915901243.
        expect(recencyWeight('2026-05-16T12:00:00Z', NOW, 0.9)).toBeCloseTo(0.6915901243, 9);
    });

    it('clamps future dates to weight 1 and full-weights undated records', () => {
        expect(recencyWeight('2026-07-01T00:00:00Z', NOW, 0.9)).toBe(1);
        expect(recencyWeight(undefined, NOW, 0.9)).toBe(1);
        expect(recencyWeight('not-a-date', NOW, 0.9)).toBe(1);
    });
});

describe('slotGroupOf', () => {
    it('routes picks to pick rotations and bans to ban phases', () => {
        expect(slotGroupOf({ type: 'pick', seq: 7 })).toBe('P1');
        expect(slotGroupOf({ type: 'pick', seq: 19 })).toBe('P8-9');
        expect(slotGroupOf({ type: 'ban', seq: 14 })).toBe('B4-B5');
        // Off-template combinations resolve to nothing.
        expect(slotGroupOf({ type: 'pick', seq: 1 })).toBeUndefined();
        expect(slotGroupOf({ type: 'ban', seq: 7 })).toBeUndefined();
    });
});

describe('buildTendencyTable — cell aggregates', () => {
    it('(P1, blue): λ-weighted counts a=1.9, r=0.81; raw 2+1 of 3', () => {
        // a: tg1 (1) + tg2 (0.9) = 1.9 ; r: tg3 (0.81). totalWeight = 2.71.
        const cell = table.cells.get(cellKey('P1', 'blue'));
        expect(cell?.counts.get('a')).toBeCloseTo(1.9, 12);
        expect(cell?.counts.get('r')).toBeCloseTo(0.81, 12);
        expect(cell?.totalWeight).toBeCloseTo(2.71, 12);
        expect(cell?.rawCounts.get('a')).toBe(2);
        expect(cell?.rawCounts.get('r')).toBe(1);
        expect(cell?.totalRaw).toBe(3);
        // League prior frequencies 2/5, 2/5, 1/5.
        expect(cell?.prior.get('a')).toBeCloseTo(0.4, 12);
        expect(cell?.prior.get('k')).toBeCloseTo(0.2, 12);
    });

    it('multi-slot groups count actions, not games: (P2-3, red) totals 4 raw / 3.8 weighted', () => {
        // tg4 contributes 2 actions at w=1, tg5 contributes 2 at w=0.9 → 3.8.
        const cell = table.cells.get(cellKey('P2-3', 'red'));
        expect(cell?.totalRaw).toBe(4);
        expect(cell?.totalWeight).toBeCloseTo(3.8, 12);
        expect(cell?.counts.get('b1')).toBeCloseTo(1.9, 12);
    });
});

describe('predict — Dirichlet posterior', () => {
    it('(P1, blue): hand-computed α=5 posterior', () => {
        // Masses m_c = W_c + α·P_league(c):
        //   a: 1.9 + 5·0.4 = 3.9 ; r: 0.81 + 5·0.4 = 2.81 ; k: 0 + 5·0.2 = 1.
        // Total = 2.71 + 5 = 7.71 (= 3.9 + 2.81 + 1, sanity).
        //   p_a = 3.9/7.71 = 0.5058365759
        //   p_r = 2.81/7.71 = 0.3644617380
        //   p_k = 1/7.71  = 0.1297016861
        const predictions = predict(table, { slotGroup: 'P1', side: 'blue' });
        expect(predictions.map((e) => e.championKey)).toEqual(['a', 'r', 'k']);
        expect(predictions[0].p).toBeCloseTo(0.5058365759, 9);
        expect(predictions[1].p).toBeCloseTo(0.3644617380, 9);
        expect(predictions[2].p).toBeCloseTo(0.1297016861, 9);
        // The posterior is a distribution.
        expect(predictions.reduce((s, e) => s + e.p, 0)).toBeCloseTo(1, 12);
    });

    it('entries expose coach-readable evidence: weighted count, raw count, raw total', () => {
        const predictions = predict(table, { slotGroup: 'P1', side: 'blue' });
        const a = predictions.find((e) => e.championKey === 'a');
        expect(a?.count).toBeCloseTo(1.9, 12);
        expect(a?.rawCount).toBe(2);
        expect(a?.total).toBe(3);
        // k is a prior-only candidate: never seen from the team.
        const k = predictions.find((e) => e.championKey === 'k');
        expect(k?.count).toBe(0);
        expect(k?.rawCount).toBe(0);
        expect(k?.total).toBe(3);
    });

    it('renormalizes after exclusions (a banned away)', () => {
        // Remaining masses: r 2.81, k 1 → total 3.81.
        //   p_r = 2.81/3.81 = 0.7375328084 ; p_k = 1/3.81 = 0.2624671916.
        const predictions = predict(table, { slotGroup: 'P1', side: 'blue', exclude: new Set(['a']) });
        expect(predictions.map((e) => e.championKey)).toEqual(['r', 'k']);
        expect(predictions[0].p).toBeCloseTo(0.7375328084, 9);
        expect(predictions[1].p).toBeCloseTo(0.2624671916, 9);
    });

    it('degrades to the weighted team frequency when the league never saw the context', () => {
        // League corpus has no (P2-3, red) action → effective α = 0:
        //   p_b1 = 1.9/3.8 = 0.5 ; p_b2 = 1/3.8 = 0.2631578947 ; p_b3 = 0.9/3.8 = 0.2368421053.
        const predictions = predict(table, { slotGroup: 'P2-3', side: 'red' });
        expect(predictions.map((e) => e.championKey)).toEqual(['b1', 'b2', 'b3']);
        expect(predictions[0].p).toBeCloseTo(0.5, 12);
        expect(predictions[1].p).toBeCloseTo(0.2631578947, 9);
        expect(predictions[2].p).toBeCloseTo(0.2368421053, 9);
    });

    it('never counts the opponent: X1\'s P2-3 picks stay out of T1\'s table', () => {
        // tg1 had X1 (red) picking o1/o2 in P2-3 — filtered by team: 'T1'.
        const keys = predict(table, { slotGroup: 'P2-3', side: 'red' }).map((e) => e.championKey);
        expect(keys).not.toContain('o1');
        expect(keys).not.toContain('o2');
    });

    it('predicts ban phases too, breaking exact ties by champion key', () => {
        // (B1-B3, blue) team counts: x1 = 1 + 0.9 = 1.9, x2 = 1, x3 = 1 (W = 3.9).
        // Prior {x1: 0.5, x9: 0.5} → masses x1 4.4, x9 2.5, x2 1, x3 1; total 8.9.
        //   p_x1 = 4.4/8.9 = 0.4943820225 ; p_x9 = 2.5/8.9 = 0.2808988764
        //   p_x2 = p_x3 = 1/8.9 = 0.1123595506 → tie → key order x2 < x3.
        const predictions = predict(table, { slotGroup: 'B1-B3', side: 'blue' });
        expect(predictions.map((e) => e.championKey)).toEqual(['x1', 'x9', 'x2', 'x3']);
        expect(predictions[0].p).toBeCloseTo(0.4943820225, 9);
        expect(predictions[1].p).toBeCloseTo(0.2808988764, 9);
        expect(predictions[2].p).toBeCloseTo(0.1123595506, 9);
    });

    it('league prior ignores recency (same league actions, any dates)', () => {
        const recentLeague = buildTendencyTable(teamRecords, leagueCorpus('2026-06-09T00:00:00Z'), {
            alpha: 5,
            lambdaPerWeek: 0.9,
            now: NOW,
            team: 'T1'
        });
        expect(predict(recentLeague, { slotGroup: 'P1', side: 'blue' })).toEqual(
            predict(table, { slotGroup: 'P1', side: 'blue' })
        );
    });

    it('defaults to α=5 and λ=0.9 when omitted', () => {
        const defaulted = buildTendencyTable(teamRecords, leagueRecords, { now: NOW, team: 'T1' });
        expect(defaulted.alpha).toBe(5);
        expect(defaulted.lambdaPerWeek).toBe(0.9);
        expect(predict(defaulted, { slotGroup: 'P1', side: 'blue' })).toEqual(
            predict(table, { slotGroup: 'P1', side: 'blue' })
        );
    });

    it('returns [] for a context nobody ever played', () => {
        expect(predict(table, { slotGroup: 'P6', side: 'blue' })).toEqual([]);
    });

    it('without a team filter, every action in the records counts', () => {
        const unfiltered = buildTendencyTable(teamRecords, [], { now: NOW });
        const keys = predict(unfiltered, { slotGroup: 'P2-3', side: 'red' }).map((e) => e.championKey);
        expect(keys).toContain('o1');
        expect(keys).toContain('o2');
        expect(keys).toContain('b1');
    });
});

describe('evidenceString', () => {
    it('renders coach-facing counts in French', () => {
        expect(evidenceString({ rawCount: 4, total: 6 })).toBe('4 des 6 dernières');
        expect(evidenceString({ rawCount: 1, total: 1 })).toBe('1 de la dernière');
        expect(evidenceString({ rawCount: 0, total: 6 })).toBe('jamais sur les 6 dernières');
        expect(evidenceString({ rawCount: 0, total: 1 })).toBe('jamais sur la dernière');
        expect(evidenceString({ rawCount: 0, total: 0 })).toBe('aucune donnée');
    });
});
