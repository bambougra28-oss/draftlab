import { describe, it, expect } from 'vitest';
import {
    comparePatches,
    groupByPatch,
    parsePatch,
    walkForward
} from '$lib/backtest/walkforward';

/** Synthetic record shape used across the walk-forward tests. */
interface Rec {
    id: string;
    patch?: string;
    won: boolean;
}

const rec = (id: string, patch: string | undefined, won: boolean): Rec => ({ id, patch, won });

describe('walkforward — patch ordering', () => {
    it('parsePatch reads major.minor and rejects non-numeric strings', () => {
        expect(parsePatch('26.10')).toEqual({ major: 26, minor: 10 });
        expect(parsePatch('26.10.1')).toEqual({ major: 26, minor: 10 }); // hotfix suffix ignored
        expect(parsePatch('26')).toEqual({ major: 26, minor: 0 }); // bare major → minor 0
        expect(parsePatch('preseason')).toBeUndefined();
        expect(parsePatch('')).toBeUndefined();
    });

    it('comparePatches is numeric on major.minor, never lexical', () => {
        // Lexical order would put '26.10' BEFORE '26.2' — the exact bug the
        // numeric comparison exists to prevent.
        expect(comparePatches('26.2', '26.10')).toBeLessThan(0);
        expect(comparePatches('25.24', '26.1')).toBeLessThan(0);
        expect(comparePatches('26.10', '26.2')).toBeGreaterThan(0);
        expect(comparePatches('26.10', '26.10')).toBe(0);
    });

    it('groupByPatch sorts 25.24 → 26.1 → 26.2 → 26.10 (natural order)', () => {
        const groups = groupByPatch([
            rec('d', '26.10', true),
            rec('a', '25.24', true),
            rec('c', '26.2', false),
            rec('b', '26.1', true),
            rec('e', '26.10', false)
        ]);
        expect(groups.map((g) => g.patch)).toEqual(['25.24', '26.1', '26.2', '26.10']);
        // Items of one patch are grouped together, input order preserved.
        expect(groups[3].items.map((i) => i.id)).toEqual(['d', 'e']);
    });

    it('groupByPatch drops temporally unplaceable records', () => {
        // A record without a parseable patch has no position on the timeline:
        // keeping it would risk the very leakage the harness must prevent.
        const groups = groupByPatch([
            rec('a', '26.1', true),
            rec('x', undefined, true),
            rec('y', 'preseason', false)
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].items.map((i) => i.id)).toEqual(['a']);
    });
});

describe('walkforward — walkForward', () => {
    // Shared scenario (records intentionally shuffled — ordering is the
    // harness's job): 26.1 = {a1 won, a2 lost}, 26.2 = {b1 won, b2 won},
    // 26.10 = {c1 lost}. Model = raw train win rate, predicted for every item.
    const items: Rec[] = [
        rec('c1', '26.10', false),
        rec('a1', '26.1', true),
        rec('b1', '26.2', true),
        rec('a2', '26.1', false),
        rec('b2', '26.2', true)
    ];
    const winRateSpec = {
        fit: (train: Rec[]) => train.filter((t) => t.won).length / train.length,
        predict: (model: number) => model,
        outcome: (item: Rec) => item.won
    };

    it('scores each patch with hand-computed fold metrics', () => {
        const out = walkForward(items, winRateSpec);

        expect(out.folds).toHaveLength(2);

        // Fold 1 — test 26.2, fit on 26.1 only: p = 1/2.
        // pairs = [{0.5, won}, {0.5, won}] →
        //   logLoss = −ln 0.5 = ln 2 = 0.6931471805599453
        //   brier   = (0.25 + 0.25)/2 = 0.25
        //   accuracy = half credit at p = 0.5 → 0.5
        const f1 = out.folds[0];
        expect(f1.trainPatches).toEqual(['26.1']);
        expect(f1.testPatch).toBe('26.2');
        expect(f1.pairs).toEqual([
            { p: 0.5, won: true },
            { p: 0.5, won: true }
        ]);
        expect(f1.logLoss).toBeCloseTo(0.6931471805599453, 12);
        expect(f1.brier).toBeCloseTo(0.25, 12);
        expect(f1.accuracy).toBe(0.5);

        // Fold 2 — test 26.10, fit on 26.1 + 26.2: p = 3/4.
        // pairs = [{0.75, lost}] →
        //   logLoss = −ln(1 − 0.75) = −ln 0.25 = 1.3862943611198906
        //   brier   = 0.75² = 0.5625
        //   accuracy = 0 (predicted win, observed loss)
        const f2 = out.folds[1];
        expect(f2.trainPatches).toEqual(['26.1', '26.2']);
        expect(f2.testPatch).toBe('26.10');
        expect(f2.logLoss).toBeCloseTo(1.3862943611198906, 12);
        expect(f2.brier).toBeCloseTo(0.5625, 12);
        expect(f2.accuracy).toBe(0);
    });

    it('aggregates as a micro-average over pooled pairs (hand-computed)', () => {
        const { aggregate } = walkForward(items, winRateSpec);
        // Hand, 3 pooled pairs:
        //   logLoss = (ln 2 + ln 2 + ln 4)/3 = (0.6931472·2 + 1.3862944)/3
        //           = 2.7725887222397812/3 = 0.9241962407465937
        //   brier   = (0.25 + 0.25 + 0.5625)/3 = 1.0625/3 = 0.3541666…
        //   accuracy = (0.5 + 0.5 + 0)/3 = 1/3
        expect(aggregate.n).toBe(3);
        expect(aggregate.pairs).toHaveLength(3);
        expect(aggregate.logLoss).toBeCloseTo(0.9241962407465937, 12);
        expect(aggregate.brier).toBeCloseTo(1.0625 / 3, 12);
        expect(aggregate.accuracy).toBeCloseTo(1 / 3, 12);
    });

    it('never leaks: fit sees only strictly earlier patches (counter-proven)', () => {
        const fitTrainIds: string[][] = [];
        let predictCalls = 0;
        walkForward(items, {
            fit: (train: Rec[]) => {
                fitTrainIds.push(train.map((t) => t.id));
                return null;
            },
            predict: () => {
                predictCalls += 1;
                return 0.5;
            },
            outcome: (item: Rec) => item.won
        });

        // fit is called exactly once per fold, with exactly the records of
        // the strictly earlier patches — the test patch is NEVER inside.
        expect(fitTrainIds).toEqual([
            ['a1', 'a2'], // fold testing 26.2
            ['a1', 'a2', 'b1', 'b2'] // fold testing 26.10
        ]);
        // predict is called once per test item: 2 (patch 26.2) + 1 (26.10).
        expect(predictCalls).toBe(3);
    });

    it('excludes unplaceable records from both training and testing', () => {
        const seen: string[] = [];
        const out = walkForward(
            [...items, rec('ghost', undefined, true), rec('ghost2', 'finals', true)],
            {
                fit: (train: Rec[]) => {
                    seen.push(...train.map((t) => t.id));
                    return 0.5;
                },
                predict: (model: number) => model,
                outcome: (item: Rec) => item.won
            }
        );
        expect(seen).not.toContain('ghost');
        expect(seen).not.toContain('ghost2');
        // Pooled pairs count unchanged: ghosts were not tested either.
        expect(out.aggregate.n).toBe(3);
    });

    it('honors minTrainSize by skipping early folds but keeping their data', () => {
        // Patches: 26.1 (1 record), 26.2 (1 record), 26.3 (1 record).
        // With minTrainSize = 2: the 26.2 fold is skipped (train = 1 < 2),
        // 26.3 is scored with train = both earlier records.
        const small = [rec('a', '26.1', true), rec('b', '26.2', false), rec('c', '26.3', true)];
        const out = walkForward(small, { ...winRateSpec, minTrainSize: 2 });
        expect(out.folds).toHaveLength(1);
        expect(out.folds[0].testPatch).toBe('26.3');
        expect(out.folds[0].trainPatches).toEqual(['26.1', '26.2']);
        // fit on {won, lost} → p = 0.5 for the single test pair.
        expect(out.folds[0].pairs).toEqual([{ p: 0.5, won: true }]);
    });

    it('yields no folds and a NaN aggregate on a single patch (no history)', () => {
        const out = walkForward([rec('a', '26.1', true), rec('b', '26.1', false)], winRateSpec);
        expect(out.folds).toEqual([]);
        expect(out.aggregate.n).toBe(0);
        expect(Number.isNaN(out.aggregate.logLoss)).toBe(true);
        expect(Number.isNaN(out.aggregate.brier)).toBe(true);
        expect(Number.isNaN(out.aggregate.accuracy)).toBe(true);
    });
});
