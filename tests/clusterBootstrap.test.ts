/**
 * clusterBootstrap: cluster-resampled paired CI (hand-traced rng stubs) and
 * tie-aware Spearman (hand-computed ranks) — the run #2 shared statistics.
 */
import { describe, it, expect } from 'vitest';
import { clusterBootstrapDeltaCI, spearman, type PairedObservation } from '$lib/backtest/clusterBootstrap';
import { mulberry32 } from '$lib/backtest/metrics';

const obs = (cluster: string, model: number, baseline: number): PairedObservation => ({
    cluster,
    model,
    baseline
});

describe('clusterBootstrapDeltaCI', () => {
    it('a single cluster collapses the CI onto the point delta', () => {
        const result = clusterBootstrapDeltaCI([obs('s1', 1, 0), obs('s1', 0, 0)], {
            iterations: 50,
            rng: mulberry32(42)
        });
        expect(result.delta).toBeCloseTo(0.5, 12);
        expect(result.ci95.lo).toBeCloseTo(0.5, 12);
        expect(result.ci95.hi).toBeCloseTo(0.5, 12);
        expect(result.clusters).toBe(1);
        expect(result.observations).toBe(2);
    });

    it('resamples whole clusters — hand-traced with a stubbed rng', () => {
        // c1: delta +1 ; c2: delta −1 ; full sample: 0.
        // Stub draws: [c1,c2], [c1,c1], [c2,c2] → deltas {0, +1, −1}.
        const sequence = [0, 0.9, 0, 0, 0.9, 0.9];
        let i = 0;
        const result = clusterBootstrapDeltaCI([obs('c1', 1, 0), obs('c2', 0, 1)], {
            iterations: 3,
            rng: () => sequence[i++]
        });
        expect(result.delta).toBeCloseTo(0, 12);
        // Sorted deltas [−1, 0, 1], type-7: q.025 → −0.95 ; q.975 → +0.95.
        expect(result.ci95.lo).toBeCloseTo(-0.95, 12);
        expect(result.ci95.hi).toBeCloseTo(0.95, 12);
        expect(result.clusters).toBe(2);
    });

    it('honesty property: clustering correlated units WIDENS the CI', () => {
        // 12 observations, deltas ±1 balanced. Clustered: 4 blocks of 3
        // perfectly correlated units (cluster means ±1, only 4 draws per
        // resample → extremes frequent). Unclustered: 12 singleton draws —
        // the mean concentrates, the interval tightens.
        const correlated: PairedObservation[] = [];
        const independent: PairedObservation[] = [];
        const sign = (c: string): number => (c === 'A' || c === 'C' ? 1 : 0);
        for (const cluster of ['A', 'B', 'C', 'D']) {
            for (let k = 0; k < 3; k++) {
                correlated.push(obs(cluster, sign(cluster), 1 - sign(cluster)));
                independent.push(obs(`${cluster}${k}`, sign(cluster), 1 - sign(cluster)));
            }
        }
        const wide = clusterBootstrapDeltaCI(correlated, { iterations: 300, rng: mulberry32(42) });
        const narrow = clusterBootstrapDeltaCI(independent, { iterations: 300, rng: mulberry32(42) });
        expect(wide.ci95.hi - wide.ci95.lo).toBeGreaterThan(narrow.ci95.hi - narrow.ci95.lo);
    });

    it('degenerates to NaN on an empty sample', () => {
        const result = clusterBootstrapDeltaCI([], { iterations: 10, rng: mulberry32(1) });
        expect(Number.isNaN(result.delta)).toBe(true);
        expect(Number.isNaN(result.ci95.lo)).toBe(true);
        expect(result.clusters).toBe(0);
    });
});

describe('spearman', () => {
    it('±1 on perfect monotone relations', () => {
        expect(spearman([1, 2, 3], [10, 20, 30])).toBeCloseTo(1, 12);
        expect(spearman([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 12);
    });

    it('hand-computed mixed case: ranks (1,2,3) vs (3,1,2) → −0,5', () => {
        expect(spearman([1, 2, 3], [3, 1, 2])).toBeCloseTo(-0.5, 12);
    });

    it('ties take average ranks (2.5, 2.5) and keep a perfect relation at 1', () => {
        expect(spearman([1, 2, 2, 3], [10, 20, 20, 30])).toBeCloseTo(1, 12);
    });

    it('NaN on zero variance or n < 2', () => {
        expect(Number.isNaN(spearman([1, 2, 3], [5, 5, 5]))).toBe(true);
        expect(Number.isNaN(spearman([1], [2]))).toBe(true);
        expect(Number.isNaN(spearman([1, 2], [1]))).toBe(true);
    });
});
