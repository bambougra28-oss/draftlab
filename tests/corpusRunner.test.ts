import { describe, it, expect } from 'vitest';
import { runCorpusScorecard, type CorpusRunnerOptions } from '$lib/backtest/corpusRunner';
import type { DraftAction, DraftPhase, DraftRecord, DraftSide } from '$lib/data/types';

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
    patch: string | undefined,
    teams: { blue: string; red: string },
    actions: DraftAction[],
    winner?: DraftSide
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
    if (patch !== undefined) record.patch = patch;
    if (winner !== undefined) record.winner = winner;
    return record;
}

const AB = { blue: 'AAA', red: 'BBB' };
const BA = { blue: 'BBB', red: 'AAA' };
const CD = { blue: 'CCC', red: 'DDD' };
const GH = { blue: 'GGG', red: 'HHH' };

/**
 * Hand-built 3-patch corpus (no dates → recency weight 1 everywhere).
 *
 * OUTCOME track (only w-records carry a winner):
 *   26.1: blue, red → fold-2 train winrate 0.5.
 *   26.2: blue, blue → fold-3 train winrate 3/4.
 *   26.3: blue.
 *   side-only pairs: (0.5,B), (0.5,B), (0.75,B)
 *   → log loss = (ln2 + ln2 + ln(4/3))/3, Brier = 0.1875, accuracy = 2/3.
 *
 * PICK track (pick-in-range@8). Train 26.1 picks: AAA first-picks r (g11);
 * fillers f1..f8 picked twice each (g12..g15); gb1/gb2 pick p1 (P1 blue) and
 * p2. Scored picks: g21 r (26.2), g31 r, g32 n1 (26.3).
 *   model (team tendency table): g21 hit (AAA's P1-blue evidence), g31 hit,
 *   g32 miss (BBB has no P1-blue history and n1 is not in the league prior)
 *   → 2/3.
 *   baseline (raw frequency top-8): r is always ranked behind the 8 fillers
 *   (count ties break by key) → 0/3.
 *
 * BAN track (ban-hit@5). Train 26.1: gb1 bans x1..x6, gb2 bans x1..x4; both
 * pick p1/p2 (presence 1.0 without any ban).
 *   fold 2 (gb3 bans x1,x2,x4,x6): model top-5 by ban totals = x1,x2,x3,x4,x5
 *   → 3 hits; baseline top-5 by presence = p1,p2,x1,x2,x3 → 2 hits.
 *   fold 3 (gb4 bans x6,x5): model = x1,x2,x4,x3,x6 → 1 hit; baseline =
 *   x1,x2,x4,p1,p2 → 0 hit.
 *   → model 2.0 hits/game, baseline 1.0; every paired resample yields Δ = 1.
 *
 * One record with an unparseable patch must be dropped from every track.
 */
const records: DraftRecord[] = [
    // ---- patch 26.1 ----
    game('w11', '26.1', AB, [], 'blue'),
    game('w12', '26.1', AB, [], 'red'),
    game('g11', '26.1', AB, [pick(7, 'blue', 'r')]),
    game('g12', '26.1', CD, [pick(8, 'red', 'f1'), pick(9, 'red', 'f2'), pick(10, 'blue', 'f3'), pick(11, 'blue', 'f4')]),
    game('g13', '26.1', CD, [pick(8, 'red', 'f5'), pick(9, 'red', 'f6'), pick(10, 'blue', 'f7'), pick(11, 'blue', 'f8')]),
    game('g14', '26.1', CD, [pick(8, 'red', 'f1'), pick(9, 'red', 'f2'), pick(10, 'blue', 'f3'), pick(11, 'blue', 'f4')]),
    game('g15', '26.1', CD, [pick(8, 'red', 'f5'), pick(9, 'red', 'f6'), pick(10, 'blue', 'f7'), pick(11, 'blue', 'f8')]),
    game('gb1', '26.1', GH, [
        ban(1, 'blue', 'x1'),
        ban(2, 'red', 'x2'),
        ban(3, 'blue', 'x3'),
        ban(4, 'red', 'x4'),
        ban(5, 'blue', 'x5'),
        ban(6, 'red', 'x6'),
        pick(7, 'blue', 'p1'),
        pick(8, 'red', 'p2')
    ]),
    game('gb2', '26.1', GH, [
        ban(1, 'blue', 'x1'),
        ban(2, 'red', 'x2'),
        ban(3, 'blue', 'x3'),
        ban(4, 'red', 'x4'),
        pick(7, 'blue', 'p1'),
        pick(8, 'red', 'p2')
    ]),
    // ---- patch 26.2 ----
    game('w21', '26.2', AB, [], 'blue'),
    game('w22', '26.2', AB, [], 'blue'),
    game('g21', '26.2', AB, [pick(7, 'blue', 'r')]),
    game('gb3', '26.2', GH, [ban(1, 'blue', 'x1'), ban(2, 'red', 'x2'), ban(3, 'blue', 'x4'), ban(4, 'red', 'x6')]),
    // ---- patch 26.3 ----
    game('w31', '26.3', AB, [], 'blue'),
    game('g31', '26.3', AB, [pick(7, 'blue', 'r')]),
    game('g32', '26.3', BA, [pick(7, 'blue', 'n1')]),
    game('gb4', '26.3', GH, [ban(1, 'blue', 'x6'), ban(2, 'red', 'x5')]),
    // ---- temporally unplaceable: dropped ----
    game('junk', 'TBD', AB, [pick(7, 'blue', 'r')], 'blue')
];

const options: CorpusRunnerOptions = { seed: 7, generatedAt: '2026-06-10T12:00:00Z' };

const LN2 = Math.LN2;
const SIDE_ONLY_LOG_LOSS = (LN2 + LN2 - Math.log(0.75)) / 3;

describe('runCorpusScorecard — corpus bookkeeping', () => {
    const { results } = runCorpusScorecard(records, options);

    it('counts records, drops the unplaceable one, resolves the patch label', () => {
        expect(results.records).toBe(18);
        expect(results.usableRecords).toBe(17);
        expect(results.droppedNoPatch).toBe(1);
        // Default label = last patch of the corpus timeline.
        expect(results.patch).toBe('26.3');
        expect(results.seed).toBe(7);
        expect(results.generatedAt).toBe('2026-06-10T12:00:00Z');
    });
});

describe('runCorpusScorecard — outcome track (side-only vs p=0,5)', () => {
    const { results } = runCorpusScorecard(records, options);

    it('scores 3 predictions over 2 folds with the hand-computed metrics', () => {
        expect(results.outcome.n).toBe(3);
        expect(results.outcome.foldCount).toBe(2);
        expect(results.outcome.sideOnly.logLoss).toBeCloseTo(SIDE_ONLY_LOG_LOSS, 12);
        expect(results.outcome.sideOnly.brier).toBeCloseTo(0.1875, 12);
        expect(results.outcome.sideOnly.accuracy).toBeCloseTo(2 / 3, 12);
    });

    it('the coin baseline is exactly ln 2 / 0.25 / 0.5', () => {
        expect(results.outcome.coinFlip.logLoss).toBeCloseTo(LN2, 12);
        expect(results.outcome.coinFlip.brier).toBeCloseTo(0.25, 12);
        expect(results.outcome.coinFlip.accuracy).toBeCloseTo(0.5, 12);
    });

    it('publishes the seeded bootstrap delta of side-only − coin', () => {
        expect(results.outcome.deltas?.logLoss.delta).toBeCloseTo(SIDE_ONLY_LOG_LOSS - LN2, 12);
        expect(results.outcome.deltas?.brier.delta).toBeCloseTo(0.1875 - 0.25, 12);
        expect(results.outcome.deltas?.accuracy.delta).toBeCloseTo(2 / 3 - 0.5, 12);
        const ci = results.outcome.deltas?.logLoss.ci95;
        expect(ci !== undefined && ci.lo <= ci.hi).toBe(true);
    });
});

describe('runCorpusScorecard — pick-in-range@8', () => {
    const { results } = runCorpusScorecard(records, options);

    it('team conditioning hits 2/3 where raw frequency hits 0/3', () => {
        expect(results.pickInRange.n).toBe(3);
        expect(results.pickInRange.foldCount).toBe(2);
        expect(results.pickInRange.model).toBeCloseTo(2 / 3, 12);
        expect(results.pickInRange.baseline).toBe(0);
        expect(results.pickInRange.delta?.delta).toBeCloseTo(2 / 3, 12);
    });
});

describe('runCorpusScorecard — ban-hit@5', () => {
    const { results } = runCorpusScorecard(records, options);

    it('ban-total ranking averages 2 hits/game, presence ranking 1', () => {
        expect(results.banHit.n).toBe(2);
        expect(results.banHit.foldCount).toBe(2);
        expect(results.banHit.model).toBeCloseTo(2, 12);
        expect(results.banHit.baseline).toBeCloseTo(1, 12);
    });

    it('every paired resample yields Δ = +1 → degenerate CI and a beats verdict', () => {
        expect(results.banHit.delta?.delta).toBeCloseTo(1, 12);
        expect(results.banHit.delta?.ci95).toEqual({ lo: 1, hi: 1 });
        const banEntry = results.entries.find((e) => e.metric.startsWith('ban-hit@5'));
        expect(banEntry?.verdict).toBe('beats');
    });
});

describe('runCorpusScorecard — markdown rendering', () => {
    const { markdown, results } = runCorpusScorecard(records, { ...options, patch: '26.99-test' });

    it('renders via renderScorecard with all the published sections', () => {
        expect(markdown).toContain('# Scorecard corpus — Summit Gate (R9) — Patch 26.99-test');
        expect(markdown).toContain('| Métrique | Valeur | Baseline | Δ (IC 95 %) | Verdict |');
        expect(markdown).toContain('## Notes');
        expect(markdown).toContain('## Légende');
        expect(markdown).toContain('pick-in-range@8');
        expect(markdown).toContain('ban-hit@5');
        expect(markdown).toContain('seed 7');
        expect(markdown).toContain('cibles fixées après première mesure');
        expect(results.patch).toBe('26.99-test');
    });

    it('publishes exactly the six metric rows, every one next to its baseline', () => {
        expect(results.entries).toHaveLength(6);
        expect(results.entries.map((e) => e.metric)).toEqual([
            'log loss — issue de partie (side-only vs p=0,5)',
            'Brier — issue de partie (side-only vs p=0,5)',
            'accuracy — issue de partie (side-only vs p=0,5)',
            'pick-in-range@8 — tendances (vs fréquence brute)',
            'ban-hit@5 — bans du train (vs présence)',
            'ban-hit@5 par side — banEV complet (vs présence)'
        ]);
        for (const entry of results.entries) {
            expect(Number.isNaN(entry.baseline)).toBe(false);
        }
    });
});

describe('runCorpusScorecard — determinism and degraded corpora', () => {
    it('same corpus + same seed + same timestamp ⇒ byte-identical scorecard', () => {
        const first = runCorpusScorecard(records, options);
        const second = runCorpusScorecard(records, options);
        expect(second.markdown).toBe(first.markdown);
        expect(second.results).toEqual(first.results);
    });

    it('an empty corpus still renders an honest card (no fold, NaN → —)', () => {
        const { markdown, results } = runCorpusScorecard([], options);
        expect(results.patch).toBe('corpus');
        expect(results.outcome.n).toBe(0);
        expect(results.pickInRange.n).toBe(0);
        expect(results.banHit.n).toBe(0);
        expect(results.outcome.deltas).toBeUndefined();
        expect(Number.isNaN(results.pickInRange.model)).toBe(true);
        expect(markdown).toContain('| — |');
    });

    it('a single-patch corpus produces zero folds (nothing to test on)', () => {
        const single = records.filter((r) => r.patch === '26.1');
        const { results } = runCorpusScorecard(single, options);
        expect(results.outcome.foldCount).toBe(0);
        expect(results.pickInRange.foldCount).toBe(0);
        expect(results.banHit.foldCount).toBe(0);
    });
});
