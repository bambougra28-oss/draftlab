import { describe, it, expect } from 'vitest';
import {
    betaCdf,
    betaQuantile,
    shrinkWinrate,
    fitBetaPriorMoments,
    FALLBACK_PRIOR_N
} from '$lib/estimators/posterior';

// The incomplete-beta machinery is validated through mathematical identities
// and closed-form special cases — no constants pulled from external tables.

describe('posterior — regularized incomplete beta I_x(a, b)', () => {
    it('Beta(1,1) is the uniform: I_x(1,1) = x', () => {
        // Beta(1,1) has density 1 on [0,1], so its CDF is x itself.
        for (const x of [0.05, 0.2, 0.5, 0.73, 0.99]) {
            expect(betaCdf(x, 1, 1)).toBeCloseTo(x, 12);
        }
    });

    it('satisfies the symmetry identity I_x(a,b) = 1 − I_{1−x}(b,a)', () => {
        // Direct consequence of integrating the density from the other end.
        // Exercises both branches of the continued-fraction dispatch.
        for (const [a, b] of [[2.5, 7], [0.5, 0.5], [10, 3]]) {
            for (const x of [0.1, 0.3, 0.5, 0.8]) {
                expect(betaCdf(x, a, b)).toBeCloseTo(1 - betaCdf(1 - x, b, a), 12);
            }
        }
    });

    it('matches the polynomial CDFs of Beta(1,2), Beta(2,1), Beta(2,2)', () => {
        // Beta(1,2): density 2(1−t) → CDF ∫ = 2x − x².
        // Beta(2,1): density 2t → CDF x².
        // Beta(2,2): density 6t(1−t) → CDF 3x² − 2x³.
        for (const x of [0.1, 0.25, 0.4, 0.6, 0.9]) {
            expect(betaCdf(x, 1, 2)).toBeCloseTo(2 * x - x * x, 12);
            expect(betaCdf(x, 2, 1)).toBeCloseTo(x * x, 12);
            expect(betaCdf(x, 2, 2)).toBeCloseTo(3 * x * x - 2 * x * x * x, 12);
        }
    });

    it('saturates outside [0,1] and is monotone increasing inside', () => {
        expect(betaCdf(0, 3, 4)).toBe(0);
        expect(betaCdf(-1, 3, 4)).toBe(0);
        expect(betaCdf(1, 3, 4)).toBe(1);
        expect(betaCdf(2, 3, 4)).toBe(1);
        let prev = 0;
        for (let x = 0.1; x < 1; x += 0.1) {
            const cur = betaCdf(x, 3, 4);
            expect(cur).toBeGreaterThan(prev);
            prev = cur;
        }
    });

    it('rejects non-positive shapes and out-of-range quantile probabilities', () => {
        expect(() => betaCdf(0.5, 0, 1)).toThrow(RangeError);
        expect(() => betaCdf(0.5, 1, -2)).toThrow(RangeError);
        expect(() => betaQuantile(0.5, 0, 1)).toThrow(RangeError);
        expect(() => betaQuantile(-0.1, 1, 1)).toThrow(RangeError);
        expect(() => betaQuantile(1.1, 1, 1)).toThrow(RangeError);
    });
});

describe('posterior — quantile (inverse CDF)', () => {
    it('median of any symmetric Beta(a,a) is 0.5', () => {
        // The density of Beta(a,a) is symmetric around 0.5, so the median is 0.5.
        for (const a of [0.5, 1, 3, 25]) {
            expect(betaQuantile(0.5, a, a)).toBeCloseTo(0.5, 9);
        }
    });

    it('matches the closed-form quantile of Beta(1,2): q(p) = 1 − √(1−p)', () => {
        // Inverting the CDF p = 2x − x²: x² − 2x + p = 0 → x = 1 − √(1−p)
        // (the root inside [0,1]).
        for (const p of [0.025, 0.3, 0.5, 0.975]) {
            expect(betaQuantile(p, 1, 2)).toBeCloseTo(1 - Math.sqrt(1 - p), 9);
        }
    });

    it('round-trips cdf(quantile(p)) ≈ p across shapes', () => {
        // Inversion correctness without external constants: the quantile is
        // defined as the CDF inverse, so the round-trip must be the identity.
        for (const [a, b] of [[1.3, 4.7], [40, 60], [0.5, 0.5], [200, 150]]) {
            for (const p of [0.025, 0.1, 0.5, 0.9, 0.975]) {
                expect(betaCdf(betaQuantile(p, a, b), a, b)).toBeCloseTo(p, 9);
            }
        }
    });

    it('returns exact bounds at p = 0 and p = 1', () => {
        expect(betaQuantile(0, 2, 5)).toBe(0);
        expect(betaQuantile(1, 2, 5)).toBe(1);
    });
});

describe('posterior — shrinkWinrate', () => {
    it('computes the documented posterior arithmetic', () => {
        // alpha = 7 + 10·0.5 = 12 ; beta = (10−7) + 10·0.5 = 8
        // mean = 12/20 = 0.6 ; n = the 10 real games.
        const post = shrinkWinrate(7, 10, 0.5, 10);
        expect(post.alpha).toBe(12);
        expect(post.beta).toBe(8);
        expect(post.mean).toBeCloseTo(0.6, 12);
        expect(post.n).toBe(10);
        expect(post.ci95[0]).toBeLessThan(post.mean);
        expect(post.ci95[1]).toBeGreaterThan(post.mean);
    });

    it('returns the prior on an empty sample, with the uniform ci95', () => {
        // 0 games with priorMean 0.5, priorN 2 → Beta(1,1) = uniform:
        // mean 0.5 and quantiles q(p) = p → ci95 = [0.025, 0.975] exactly.
        const post = shrinkWinrate(0, 0, 0.5, 2);
        expect(post.mean).toBeCloseTo(0.5, 12);
        expect(post.n).toBe(0);
        expect(post.ci95[0]).toBeCloseTo(0.025, 9);
        expect(post.ci95[1]).toBeCloseTo(0.975, 9);
    });

    it('shrinks between prior and raw, fades with evidence, narrows the interval', () => {
        // 7/10 raw = 0.7, prior 0.5 → posterior mean 0.6 sits strictly between.
        const thin = shrinkWinrate(7, 10, 0.5, 10);
        expect(thin.mean).toBeGreaterThan(0.5);
        expect(thin.mean).toBeLessThan(0.7);
        // 600/1000 with priorN 10: mean = 605/1010 ≈ 0.59901 — the data dominates.
        const fat = shrinkWinrate(600, 1000, 0.5, 10);
        expect(fat.mean).toBeCloseTo(605 / 1010, 12);
        expect(Math.abs(fat.mean - 0.6)).toBeLessThan(0.002);
        // 10× the evidence at the same rate → strictly narrower ci95.
        const w100 = shrinkWinrate(60, 100, 0.5, 10);
        const widthThin = w100.ci95[1] - w100.ci95[0];
        const widthFat = fat.ci95[1] - fat.ci95[0];
        expect(widthFat).toBeLessThan(widthThin);
    });

    it('rejects malformed samples and degenerate priors', () => {
        expect(() => shrinkWinrate(11, 10, 0.5, 10)).toThrow(RangeError); // wins > games
        expect(() => shrinkWinrate(-1, 10, 0.5, 10)).toThrow(RangeError);
        expect(() => shrinkWinrate(5, 10, 0.5, 0)).toThrow(RangeError); // no prior mass
        expect(() => shrinkWinrate(5, 10, 0, 10)).toThrow(RangeError); // degenerate mean
        expect(() => shrinkWinrate(5, 10, 1, 10)).toThrow(RangeError);
    });
});

describe('posterior — fitBetaPriorMoments', () => {
    it('fits the method-of-moments prior on hand-computed populations', () => {
        // Winrates 0.4, 0.5, 0.6: μ = 0.5 ; σ² = (0.01 + 0 + 0.01)/2 = 0.01
        // α+β = μ(1−μ)/σ² − 1 = 0.25/0.01 − 1 = 24.
        const tight = fitBetaPriorMoments([
            { wins: 40, games: 100 },
            { wins: 50, games: 100 },
            { wins: 60, games: 100 }
        ]);
        expect(tight.mean).toBeCloseTo(0.5, 12);
        expect(tight.priorN).toBeCloseTo(24, 9);
        // Winrates 0.3, 0.5, 0.7: σ² = (0.04 + 0 + 0.04)/2 = 0.04
        // α+β = 0.25/0.04 − 1 = 6.25 − 1 = 5.25 — wider spread, weaker prior.
        const wide = fitBetaPriorMoments([
            { wins: 30, games: 100 },
            { wins: 50, games: 100 },
            { wins: 70, games: 100 }
        ]);
        expect(wide.mean).toBeCloseTo(0.5, 12);
        expect(wide.priorN).toBeCloseTo(5.25, 9);
    });

    it('falls back to the pooled mean and FALLBACK_PRIOR_N below 3 usable samples', () => {
        // Two samples → moments unusable. Pooled mean = (6+14)/(10+20) = 2/3.
        const two = fitBetaPriorMoments([
            { wins: 6, games: 10 },
            { wins: 14, games: 20 }
        ]);
        expect(two.mean).toBeCloseTo(2 / 3, 12);
        expect(two.priorN).toBe(FALLBACK_PRIOR_N);
        // games = 0 samples carry no winrate — ignored, still only 2 usable.
        const withEmpty = fitBetaPriorMoments([
            { wins: 6, games: 10 },
            { wins: 14, games: 20 },
            { wins: 0, games: 0 }
        ]);
        expect(withEmpty.priorN).toBe(FALLBACK_PRIOR_N);
        // No data at all → neutral 0.5.
        const none = fitBetaPriorMoments([]);
        expect(none.mean).toBe(0.5);
        expect(none.priorN).toBe(FALLBACK_PRIOR_N);
    });

    it('caps priorN at 1000 when the population variance is ≈ 0', () => {
        // All winrates exactly 0.5 → σ² = 0 → α+β diverges → documented cap.
        const flat = fitBetaPriorMoments([
            { wins: 5, games: 10 },
            { wins: 10, games: 20 },
            { wins: 50, games: 100 }
        ]);
        expect(flat.mean).toBeCloseTo(0.5, 12);
        expect(flat.priorN).toBe(1000);
        // Degenerate all-win population: zero variance AND the mean is clamped
        // to 0.99 so the prior stays a proper Beta for shrinkWinrate.
        const allWins = fitBetaPriorMoments([
            { wins: 10, games: 10 },
            { wins: 20, games: 20 },
            { wins: 5, games: 5 }
        ]);
        expect(allWins.mean).toBe(0.99);
        expect(allWins.priorN).toBe(1000);
    });

    it('floors priorN at 1 on over-dispersed populations', () => {
        // Winrates 0, 1, 0, 1: μ = 0.5 ; σ² = 4·0.25/3 = 1/3 > μ(1−μ) = 0.25
        // → α+β = 0.25/(1/3) − 1 = −0.25 ≤ 0: no Beta explains this spread,
        // so pooling is reduced to the documented floor of 1 pseudo-game.
        const wild = fitBetaPriorMoments([
            { wins: 0, games: 10 },
            { wins: 10, games: 10 },
            { wins: 0, games: 10 },
            { wins: 10, games: 10 }
        ]);
        expect(wild.mean).toBeCloseTo(0.5, 12);
        expect(wild.priorN).toBe(1);
    });
});
