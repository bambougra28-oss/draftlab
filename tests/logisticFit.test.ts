import { describe, it, expect } from 'vitest';
import { logisticFit, logisticPredict, type LogisticRow } from '$lib/estimators/logisticFit';
import { plattFit, type PlattPair } from '$lib/estimators/platt';

const OPTS = { ridge: 1e-6, maxIter: 50 };
const logit = (p: number): number => Math.log(p / (1 - p));

/** n pairs at probability p, of which `wins` were won — a calibration bin. */
const group = (p: number, n: number, wins: number): PlattPair[] => {
    const pairs: PlattPair[] = [];
    for (let i = 0; i < n; i++) pairs.push({ p, won: i < wins });
    return pairs;
};
const asRows = (pairs: PlattPair[]): LogisticRow[] =>
    pairs.map((pair) => ({ x: [logit(pair.p)], y: pair.won ? 1 : 0 }));

describe('logisticFit — fit', () => {
    it('separable by a single feature → positive slope, predictions rise with x', () => {
        const rows: LogisticRow[] = [
            { x: [-2], y: 0 },
            { x: [-1], y: 0 },
            { x: [1], y: 1 },
            { x: [2], y: 1 }
        ];
        const fit = logisticFit(rows, OPTS);
        expect(fit.beta[1]).toBeGreaterThan(0);
        expect(logisticPredict(fit, [-2])).toBeLessThan(logisticPredict(fit, [2]));
    });

    it('intercept-only (no features) → β₀ = logit(base rate) (hand-derived)', () => {
        // 7 wins / 10, empty feature vector: σ(β₀) = 0.7 → β₀ = ln(7/3).
        const rows: LogisticRow[] = Array.from({ length: 10 }, (_, i) => ({ x: [], y: i < 7 ? 1 : 0 }));
        const fit = logisticFit(rows, OPTS);
        expect(fit.beta).toHaveLength(1);
        expect(fit.beta[0]).toBeCloseTo(Math.log(7 / 3), 6);
        expect(logisticPredict(fit, [])).toBeCloseTo(0.7, 6);
    });

    // ---- ANCHOR (amendment R3): on a single feature z = logit(p), logisticFit
    //      reproduces plattFit (a, b) to 1e-10 — same init (β₀=0, βⱼ=1 ≡ a=0,
    //      b=1), same full-diagonal ridge, same Newton, same data. This is the
    //      load-bearing equivalence behind the design's R4↔E3 claim.
    it('reproduces plattFit on the over-confident dataset (a≈0, b≈0.5)', () => {
        const pairs = [...group(0.8, 12, 8), ...group(0.2, 12, 4)];
        const pf = plattFit(pairs);
        const lf = logisticFit(asRows(pairs), OPTS);
        expect(lf.beta[0]).toBeCloseTo(pf.a, 10);
        expect(lf.beta[1]).toBeCloseTo(pf.b, 10);
        expect(lf.beta[1]).toBeCloseTo(0.5, 8);
    });

    it('reproduces plattFit on the under-confident dataset (b > 1)', () => {
        const pairs = [...group(0.6, 10, 8), ...group(0.4, 10, 2)];
        const pf = plattFit(pairs);
        const lf = logisticFit(asRows(pairs), OPTS);
        expect(lf.beta[0]).toBeCloseTo(pf.a, 10);
        expect(lf.beta[1]).toBeCloseTo(pf.b, 10);
        expect(lf.beta[1]).toBeGreaterThan(1);
    });

    it('reproduces plattFit on a constant-z (b stays 1, bias in a) dataset', () => {
        // All p = 0.5 → z = 0 ; plattFit keeps b at the init 1, a = logit(0.7).
        const pairs = group(0.5, 10, 7);
        const pf = plattFit(pairs);
        const lf = logisticFit(asRows(pairs), OPTS);
        expect(lf.beta[0]).toBeCloseTo(pf.a, 10);
        expect(lf.beta[1]).toBeCloseTo(pf.b, 10);
        expect(lf.beta[1]).toBeCloseTo(1, 10);
    });

    it('is deterministic (same input → identical β)', () => {
        const rows = asRows([...group(0.7, 8, 5), ...group(0.3, 8, 3)]);
        expect(logisticFit(rows, OPTS).beta).toEqual(logisticFit(rows, OPTS).beta);
    });

    it('stays finite on perfectly separable data (budget is the regularizer)', () => {
        const rows: LogisticRow[] = [
            { x: [-1], y: 0 },
            { x: [-1], y: 0 },
            { x: [1], y: 1 },
            { x: [1], y: 1 }
        ];
        const fit = logisticFit(rows, OPTS);
        expect(fit.beta.every(Number.isFinite)).toBe(true);
    });

    it('handles 3 features (the R4 design dimension) without NaN', () => {
        const rows: LogisticRow[] = [
            { x: [-2, 1, 0], y: 0 },
            { x: [-1, -1, 1], y: 0 },
            { x: [1, 0, -1], y: 1 },
            { x: [2, -1, 1], y: 1 },
            { x: [0.5, 0.5, 0.5], y: 1 },
            { x: [-0.5, -0.5, -0.5], y: 0 }
        ];
        const fit = logisticFit(rows, OPTS);
        expect(fit.beta).toHaveLength(4);
        expect(fit.beta.every(Number.isFinite)).toBe(true);
    });

    it('rejects an empty fit and mismatched feature lengths', () => {
        expect(() => logisticFit([], OPTS)).toThrow(RangeError);
        expect(() => logisticFit([{ x: [1, 2], y: 1 }, { x: [1], y: 0 }], OPTS)).toThrow(RangeError);
    });
});
