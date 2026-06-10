import { describe, it, expect } from 'vitest';
import {
    accuracy,
    banHitAtK,
    bootstrapDeltaCI,
    brier,
    logLoss,
    mulberry32,
    pickInRangeAtK,
    reliabilityBins,
    wilson95
} from '$lib/backtest/metrics';

describe('metrics — log loss / Brier / accuracy', () => {
    it('logLoss matches the hand-computed two-pair example', () => {
        // Hand: −(ln 0.8 + ln 0.4)/2.
        //   ln 0.8 = −0.2231435513142097, ln 0.4 = −0.9162907318741551
        //   sum = −1.1394342831883648 → mean negated = 0.5697171415941824
        const loss = logLoss([
            { p: 0.8, won: true },
            { p: 0.6, won: false }
        ]);
        expect(loss).toBeCloseTo(0.5697171415941824, 10);
    });

    it('logLoss of constant 0.5 forecasts is ln 2', () => {
        // Hand: every pair costs −ln 0.5 = ln 2 = 0.6931471805599453.
        const loss = logLoss([
            { p: 0.5, won: true },
            { p: 0.5, won: false }
        ]);
        expect(loss).toBeCloseTo(0.6931471805599453, 12);
    });

    it('logLoss clamps hard 0/1 predictions to a finite penalty', () => {
        // p = 1 on a loss would be −ln 0 = Infinity; the clamp at 1 − 1e-15
        // turns it into −ln(1e-15) ≈ 34.54, huge but finite.
        const loss = logLoss([{ p: 1, won: false }]);
        expect(Number.isFinite(loss)).toBe(true);
        expect(loss).toBeGreaterThan(30);
    });

    it('logLoss / brier / accuracy return NaN on an empty sample', () => {
        expect(Number.isNaN(logLoss([]))).toBe(true);
        expect(Number.isNaN(brier([]))).toBe(true);
        expect(Number.isNaN(accuracy([]))).toBe(true);
    });

    it('brier matches the hand-computed two-pair example', () => {
        // Hand: ((0.8 − 1)² + (0.6 − 0)²)/2 = (0.04 + 0.36)/2 = 0.40/2 = 0.2.
        const score = brier([
            { p: 0.8, won: true },
            { p: 0.6, won: false }
        ]);
        expect(score).toBeCloseTo(0.2, 12);
    });

    it('brier is 0 for perfect and 1 for maximally wrong forecasts', () => {
        // Hand: (1 − 1)² = 0 ; (1 − 0)² = 1.
        expect(brier([{ p: 1, won: true }])).toBe(0);
        expect(brier([{ p: 1, won: false }])).toBe(1);
    });

    it('accuracy counts hard calls at the 0.5 threshold', () => {
        // Hand: 0.8>0.5 & won → 1 ; 0.6>0.5 & lost → 0 ; 0.3<0.5 & lost → 1.
        // Total 2/3 = 0.6666….
        const acc = accuracy([
            { p: 0.8, won: true },
            { p: 0.6, won: false },
            { p: 0.3, won: false }
        ]);
        expect(acc).toBeCloseTo(2 / 3, 12);
    });

    it('accuracy gives exactly half credit at p = 0.5 (50/50 baseline scores 0.5)', () => {
        // Hand: (0.5 + 0.5)/2 = 0.5 whatever the outcomes — the mandatory
        // p = 0.5 baseline must land at 0.5 regardless of corpus win rate.
        const acc = accuracy([
            { p: 0.5, won: true },
            { p: 0.5, won: false }
        ]);
        expect(acc).toBe(0.5);
    });
});

describe('metrics — wilson95', () => {
    it('matches the hand-computed interval for 8/10', () => {
        // Hand, z = 1.96, z² = 3.8416, p̂ = 0.8, n = 10:
        //   denom  = 1 + z²/n            = 1.38416
        //   center = p̂ + z²/2n           = 0.8 + 0.19208 = 0.99208
        //   margin = z·√(p̂(1−p̂)/n + z²/4n²) = 1.96·√(0.016 + 0.009604)
        //          = 1.96·√0.025604 = 1.96·0.1600125 = 0.3136245
        //   lo = (0.99208 − 0.3136245)/1.38416 = 0.6784555/1.38416 ≈ 0.49016
        //   hi = (0.99208 + 0.3136245)/1.38416 = 1.3057045/1.38416 ≈ 0.94332
        const { lo, hi } = wilson95(8, 10);
        expect(lo).toBeCloseTo(0.49016, 4);
        expect(hi).toBeCloseTo(0.94332, 4);
    });

    it('matches the hand-computed interval for 0/10', () => {
        // Hand: p̂ = 0 → margin = 1.96·√(z²/400) = 1.96·0.098 = 0.19208 which
        // equals the center term z²/2n exactly, so lo = 0 ;
        // hi = 2·0.19208/1.38416 = 0.38416/1.38416 ≈ 0.27754.
        const { lo, hi } = wilson95(0, 10);
        expect(lo).toBeCloseTo(0, 10);
        expect(hi).toBeCloseTo(0.27754, 4);
    });

    it('is symmetric: interval of k/n mirrors interval of (n−k)/n', () => {
        // Wilson is equivariant under p̂ → 1 − p̂, a hand-checkable identity.
        const a = wilson95(8, 10);
        const b = wilson95(2, 10);
        expect(b.lo).toBeCloseTo(1 - a.hi, 12);
        expect(b.hi).toBeCloseTo(1 - a.lo, 12);
    });

    it('returns the no-information interval [0, 1] when n = 0', () => {
        expect(wilson95(0, 0)).toEqual({ lo: 0, hi: 1 });
    });
});

describe('metrics — reliabilityBins', () => {
    it('buckets pairs into fixed-width bins with hand-computed cell stats', () => {
        // Hand, 10 bins:
        //   bin 0 [0, 0.1): {0.05, lost}          → n=1, meanP=0.05, rate=0, gap=+0.05
        //   bin 1 [0.1, 0.2): {0.15, won}, {0.18, lost}
        //       → n=2, meanP=(0.15+0.18)/2=0.165, rate=1/2=0.5, gap=0.165−0.5=−0.335
        //   bin 9 [0.9, 1]: {0.95, won}           → n=1, meanP=0.95, rate=1, gap=−0.05
        const bins = reliabilityBins([
            { p: 0.05, won: false },
            { p: 0.15, won: true },
            { p: 0.18, won: false },
            { p: 0.95, won: true }
        ]);

        expect(bins).toHaveLength(10);
        expect(bins[0]).toMatchObject({ lo: 0, hi: 0.1, n: 1, actualRate: 0 });
        expect(bins[0].meanP).toBeCloseTo(0.05, 12);
        expect(bins[0].gap).toBeCloseTo(0.05, 12);

        expect(bins[1].n).toBe(2);
        expect(bins[1].meanP).toBeCloseTo(0.165, 12);
        expect(bins[1].actualRate).toBeCloseTo(0.5, 12);
        expect(bins[1].gap).toBeCloseTo(-0.335, 12);

        expect(bins[9].n).toBe(1);
        expect(bins[9].gap).toBeCloseTo(-0.05, 12);
    });

    it('keeps empty bins with n = 0 and NaN stats (fixed diagram shape)', () => {
        const bins = reliabilityBins([{ p: 0.05, won: true }]);
        expect(bins[5].n).toBe(0);
        expect(Number.isNaN(bins[5].meanP)).toBe(true);
        expect(Number.isNaN(bins[5].actualRate)).toBe(true);
        expect(Number.isNaN(bins[5].gap)).toBe(true);
    });

    it('puts p = 1 in the last bin (inclusive upper edge)', () => {
        // floor(1·10) = 10 would overflow; the clamp sends it to bin 9.
        const bins = reliabilityBins([{ p: 1, won: true }]);
        expect(bins[9].n).toBe(1);
    });

    it('honors a custom bin count', () => {
        // 4 bins of width 0.25: p = 0.3 → floor(0.3·4) = bin 1 [0.25, 0.5).
        const bins = reliabilityBins([{ p: 0.3, won: true }], 4);
        expect(bins).toHaveLength(4);
        expect(bins[1]).toMatchObject({ lo: 0.25, hi: 0.5, n: 1 });
    });
});

describe('metrics — ban-hit@k / pick-in-range@k', () => {
    it('banHitAtK counts top-k suggestions found among actual bans', () => {
        const suggested = ['aatrox', 'azir', 'corki', 'draven', 'ezreal'];
        const actual = ['corki', 'aatrox', 'fiora'];
        // Hand: top-5 ∩ actual = {aatrox, corki} → 2 ; top-2 = {aatrox, azir},
        // only aatrox is banned → 1.
        expect(banHitAtK(suggested, actual, 5)).toBe(2);
        expect(banHitAtK(suggested, actual, 2)).toBe(1);
        expect(banHitAtK(suggested, actual, 0)).toBe(0);
    });

    it('banHitAtK counts a duplicated suggestion only once', () => {
        // A duplicated hit must not inflate the score beyond reality.
        expect(banHitAtK(['aatrox', 'aatrox', 'azir'], ['aatrox'], 3)).toBe(1);
    });

    it('pickInRangeAtK is true exactly when the pick sits in the top-k', () => {
        const range = ['rell', 'nautilus', 'alistar'];
        expect(pickInRangeAtK(range, 'alistar', 3)).toBe(true);
        expect(pickInRangeAtK(range, 'alistar', 2)).toBe(false); // rank 3 > k
        expect(pickInRangeAtK(range, 'leona', 3)).toBe(false); // not in range
    });
});

describe('metrics — mulberry32', () => {
    // The generator is a published bit-mixing function, not hand-computable
    // arithmetic — what the harness relies on (and what we test) is its
    // CONTRACT: determinism per seed, [0, 1) range, seed sensitivity.
    it('is deterministic for a fixed seed', () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        const seqA = [a(), a(), a(), a(), a()];
        const seqB = [b(), b(), b(), b(), b()];
        expect(seqA).toEqual(seqB);
    });

    it('emits values in [0, 1) and differs across seeds', () => {
        const rng = mulberry32(7);
        for (let i = 0; i < 100; i++) {
            const v = rng();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
        expect(mulberry32(1)()).not.toBe(mulberry32(2)());
    });
});

describe('metrics — bootstrapDeltaCI', () => {
    it('identical paired samples give delta 0 and a degenerate {0, 0} CI', () => {
        // Hand-provable invariant: with A = B element-wise the paired resample
        // applies the SAME indices to both sides, so every iteration's delta
        // is exactly 0 — and so are both CI ends.
        const pairs = [
            { p: 0.8, won: true },
            { p: 0.6, won: false },
            { p: 0.4, won: true }
        ];
        const out = bootstrapDeltaCI(pairs, pairs, logLoss, { rng: mulberry32(42) });
        expect(out.delta).toBe(0);
        expect(out.ci95).toEqual({ lo: 0, hi: 0 });
    });

    it('constant samples give a fully hand-computed delta and CI', () => {
        // Every resample of 4 identical pairs is the same multiset, so every
        // iteration's delta equals the full-sample delta:
        //   logLoss(A) = −ln 0.8 = 0.2231435513142097
        //   logLoss(B) = −ln 0.5 = 0.6931471805599453
        //   delta = ln(0.5/0.8) = ln 0.625 = −0.4700036292457356
        const a = Array.from({ length: 4 }, () => ({ p: 0.8, won: true }));
        const b = Array.from({ length: 4 }, () => ({ p: 0.5, won: true }));
        const out = bootstrapDeltaCI(a, b, logLoss, { iterations: 200, rng: mulberry32(1) });
        expect(out.delta).toBeCloseTo(-0.4700036292457356, 12);
        expect(out.ci95.lo).toBeCloseTo(-0.4700036292457356, 12);
        expect(out.ci95.hi).toBe(out.ci95.lo);
    });

    it('is reproducible for a fixed seed and moves with the seed', () => {
        const a = [
            { p: 0.9, won: true },
            { p: 0.2, won: false },
            { p: 0.7, won: true },
            { p: 0.4, won: false }
        ];
        const b = a.map(({ won }) => ({ p: 0.5, won }));
        const run1 = bootstrapDeltaCI(a, b, brier, { iterations: 300, rng: mulberry32(99) });
        const run2 = bootstrapDeltaCI(a, b, brier, { iterations: 300, rng: mulberry32(99) });
        const run3 = bootstrapDeltaCI(a, b, brier, { iterations: 300, rng: mulberry32(100) });
        expect(run1).toEqual(run2); // same seed → byte-identical CI
        expect(run3.ci95).not.toEqual(run1.ci95); // new seed → new resamples
    });

    it('drives resampling through the injected rng (rng ≡ 0 picks index 0 only)', () => {
        // A stub rng returning 0 forces every resample to repeat pair #0:
        //   brier(A*) = (0.9 − 1)² = 0.01 ; brier(B*) = (0.5 − 1)² = 0.25
        //   → every iteration delta = −0.24, hence CI = {−0.24, −0.24}.
        // Full-sample delta is different (hand):
        //   brier(A) = (0.01 + 0.04 + 0.09 + 0.16)/4 = 0.3/4 = 0.075
        //   brier(B) = 0.25 (all (0.5 − y)² = 0.25) → delta = −0.175.
        const a = [
            { p: 0.9, won: true },
            { p: 0.2, won: false },
            { p: 0.7, won: true },
            { p: 0.4, won: false }
        ];
        const b = a.map(({ won }) => ({ p: 0.5, won }));
        const out = bootstrapDeltaCI(a, b, brier, { iterations: 50, rng: () => 0 });
        expect(out.delta).toBeCloseTo(-0.175, 12);
        expect(out.ci95.lo).toBeCloseTo(-0.24, 12);
        expect(out.ci95.hi).toBeCloseTo(-0.24, 12);
    });
});
