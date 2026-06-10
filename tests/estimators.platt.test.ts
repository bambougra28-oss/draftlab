import { describe, it, expect } from 'vitest';
import { plattFit, plattApply, meanLogLoss, type PlattPair } from '$lib/estimators/platt';

/** n pairs at probability p, of which `wins` were won — a calibration bin. */
const group = (p: number, n: number, wins: number): PlattPair[] => {
    const pairs: PlattPair[] = [];
    for (let i = 0; i < n; i++) pairs.push({ p, won: i < wins });
    return pairs;
};

describe('platt — plattFit', () => {
    it('keeps the identity (a≈0, b≈1) on perfectly calibrated data', () => {
        // Each bin's empirical frequency equals its predicted p, so at the
        // identity the score equations Σ(q−y) = 0 and Σ(q−y)z = 0 hold bin by
        // bin (q = p, and wins = n·p exactly) — (0, 1) is the MLE.
        const pairs = [
            ...group(0.8, 10, 8),
            ...group(0.6, 10, 6),
            ...group(0.5, 10, 5),
            ...group(0.4, 10, 4),
            ...group(0.2, 10, 2)
        ];
        const fit = plattFit(pairs);
        expect(fit.a).toBeCloseTo(0, 8);
        expect(fit.b).toBeCloseTo(1, 8);
    });

    it('fits b = 0.5 (< 1) on over-confident predictions (hand-derived)', () => {
        // Predictions p = 0.8 / 0.2 (z = ±ln4) but observed frequencies are
        // only 2/3 and 1/3. Score equations: σ(a + b·ln4) = 2/3 and
        // σ(a − b·ln4) = 1/3, i.e. a + b·ln4 = ln2 and a − b·ln4 = −ln2
        // → a = 0, b = ln2/ln4 = 0.5 exactly.
        const fit = plattFit([...group(0.8, 12, 8), ...group(0.2, 12, 4)]);
        expect(fit.a).toBeCloseTo(0, 8);
        expect(fit.b).toBeCloseTo(0.5, 8);
        expect(fit.b).toBeLessThan(1);
    });

    it('fits b > 1 on under-confident predictions (hand-derived)', () => {
        // Predictions 0.6 / 0.4 (z = ±ln1.5) with frequencies 0.8 / 0.2:
        // a + b·ln1.5 = logit(0.8) = ln4 and a − b·ln1.5 = −ln4
        // → a = 0, b = ln4/ln1.5 ≈ 3.41902.
        const fit = plattFit([...group(0.6, 10, 8), ...group(0.4, 10, 2)]);
        expect(fit.a).toBeCloseTo(0, 7);
        expect(fit.b).toBeCloseTo(Math.log(4) / Math.log(1.5), 7);
        expect(fit.b).toBeGreaterThan(1);
    });

    it('absorbs a pure bias in a, leaving b at 1', () => {
        // All p = 0.5 → z = 0: b carries no information (its gradient is
        // identically 0, the ridge keeps the step defined). a solves
        // Σ(σ(a) − y) = 0 → σ(a) = 7/10 → a = logit(0.7) = ln(7/3).
        const fit = plattFit(group(0.5, 10, 7));
        expect(fit.a).toBeCloseTo(Math.log(7 / 3), 8);
        expect(fit.b).toBeCloseTo(1, 12);
    });

    it('lowers the mean log loss on miscalibrated data (hand-checked)', () => {
        // Over-confident dataset of the b = 0.5 fit. Raw mean log loss:
        // wins at 0.8 (8) and losses at 0.2 (8) contribute −ln 0.8 each (16×),
        // losses at 0.8 (4) and wins at 0.2 (4) contribute −ln 0.2 each (8×):
        // raw = (16·(−ln 0.8) + 8·(−ln 0.2))/24 ≈ 0.685242.
        // Calibrated probabilities are 2/3 and 1/3 → by the same counting:
        // cal = (16·(−ln(2/3)) + 8·(−ln(1/3)))/24 ≈ 0.636514.
        const pairs = [...group(0.8, 12, 8), ...group(0.2, 12, 4)];
        const rawLoss = meanLogLoss(pairs);
        expect(rawLoss).toBeCloseTo((16 * -Math.log(0.8) + 8 * -Math.log(0.2)) / 24, 12);
        const fit = plattFit(pairs);
        const calibrated = pairs.map((pair) => ({ p: plattApply(fit, pair.p), won: pair.won }));
        const calLoss = meanLogLoss(calibrated);
        expect(calLoss).toBeCloseTo((16 * -Math.log(2 / 3) + 8 * -Math.log(1 / 3)) / 24, 6);
        expect(calLoss).toBeLessThan(rawLoss);
    });

    it('stays finite on separable (all-won) data', () => {
        // The bounded Newton budget is the implicit regularizer here.
        const fit = plattFit(group(0.6, 6, 6));
        expect(Number.isFinite(fit.a)).toBe(true);
        expect(Number.isFinite(fit.b)).toBe(true);
        expect(plattApply(fit, 0.6)).toBeGreaterThan(0.9);
    });

    it('rejects an empty fit or loss', () => {
        expect(() => plattFit([])).toThrow(RangeError);
        expect(() => meanLogLoss([])).toThrow(RangeError);
    });
});

describe('platt — plattApply', () => {
    it('is the identity at (a=0, b=1) and matches a hand value at b=0.5', () => {
        expect(plattApply({ a: 0, b: 1 }, 0.3)).toBeCloseTo(0.3, 10);
        expect(plattApply({ a: 0, b: 1 }, 0.5)).toBeCloseTo(0.5, 10);
        // σ(0.5·logit(0.8)) = σ(0.5·ln4) = σ(ln2) = 1/(1 + e^{−ln2})
        //                   = 1/(1 + 1/2) = 2/3.
        expect(plattApply({ a: 0, b: 0.5 }, 0.8)).toBeCloseTo(2 / 3, 10);
    });

    it('clamps extreme inputs to finite probabilities and stays monotone', () => {
        const params = { a: 0.2, b: 0.7 };
        const atZero = plattApply(params, 0);
        const atOne = plattApply(params, 1);
        expect(atZero).toBeGreaterThan(0);
        expect(atZero).toBeLessThan(0.01);
        expect(atOne).toBeGreaterThan(0.99);
        expect(atOne).toBeLessThan(1);
        // b > 0 → calibrated probability increases with the raw one.
        expect(plattApply(params, 0.2)).toBeLessThan(plattApply(params, 0.5));
        expect(plattApply(params, 0.5)).toBeLessThan(plattApply(params, 0.8));
    });
});

describe('platt — meanLogLoss', () => {
    it('averages the negative log likelihood (hand-computed)', () => {
        // (−ln 0.8 − ln 0.5)/2 ≈ (0.223144 + 0.693147)/2 ≈ 0.458145.
        const loss = meanLogLoss([
            { p: 0.8, won: true },
            { p: 0.5, won: false }
        ]);
        expect(loss).toBeCloseTo((-Math.log(0.8) - Math.log(0.5)) / 2, 12);
    });
});
