import { describe, it, expect } from 'vitest';
import { decayStats, patchAge, PATCHES_PER_YEAR } from '$lib/estimators/decay';

describe('decay — decayStats', () => {
    it('λ = 1 keeps raw sums (no decay)', () => {
        const res = decayStats(
            [
                { wins: 6, games: 10, age: 0 },
                { wins: 5, games: 10, age: 3 }
            ],
            1
        );
        expect(res.wins).toBe(11);
        expect(res.games).toBe(20);
        expect(res.effectiveSample).toBe(20);
    });

    it('weights each entry by λ^age (hand-computed)', () => {
        // λ = 0.8 → weights 1, 0.8, 0.64:
        // wins  = 6·1 + 5·0.8 + 2·0.64 = 6 + 4 + 1.28 = 11.28
        // games = 10·1 + 10·0.8 + 10·0.64 = 10 + 8 + 6.4 = 24.4
        const res = decayStats(
            [
                { wins: 6, games: 10, age: 0 },
                { wins: 5, games: 10, age: 1 },
                { wins: 2, games: 10, age: 2 }
            ],
            0.8
        );
        expect(res.wins).toBeCloseTo(11.28, 10);
        expect(res.games).toBeCloseTo(24.4, 10);
        // The decayed game count IS the effective sample (research §1.5).
        expect(res.effectiveSample).toBe(res.games);
    });

    it('returns zeros on no entries', () => {
        expect(decayStats([], 0.9)).toEqual({ wins: 0, games: 0, effectiveSample: 0 });
    });

    it('clamps negative ages to 0 — decay never amplifies', () => {
        // age −2 would mean λ^−2 = 1.5625× amplification; clamped to weight 1.
        const res = decayStats([{ wins: 5, games: 10, age: -2 }], 0.8);
        expect(res.wins).toBe(5);
        expect(res.games).toBe(10);
    });

    it('rejects λ outside (0, 1]', () => {
        expect(() => decayStats([], 0)).toThrow(RangeError);
        expect(() => decayStats([], -0.5)).toThrow(RangeError);
        expect(() => decayStats([], 1.2)).toThrow(RangeError);
    });
});

describe('decay — patchAge', () => {
    it('computes minor-index deltas, including across the year rollover', () => {
        expect(patchAge('26.05', '26.05')).toBe(0);
        expect(patchAge('26.03', '26.05')).toBe(2);
        // Year rollover: 25.24 → 26.01 is one step under the ~24/year calendar:
        // (26−25)·24 + (1−24) = 24 − 23 = 1.
        expect(patchAge('25.24', '26.01')).toBe(1);
        // (26−25)·24 + (3−20) = 24 − 17 = 7.
        expect(patchAge('25.20', '26.03')).toBe(7);
        expect(PATCHES_PER_YEAR).toBe(24);
    });

    it('clamps patches newer than the current one to age 0', () => {
        expect(patchAge('26.07', '26.05')).toBe(0);
        expect(patchAge('27.01', '26.24')).toBe(0);
    });

    it('tolerates hotfix suffixes and rejects malformed labels', () => {
        // '26.05b' parses as minor 5 → age vs 26.07 = 2.
        expect(patchAge('26.05b', '26.07')).toBe(2);
        expect(patchAge(' 26.05', '26.07')).toBe(2);
        expect(patchAge('garbage', '26.05')).toBeUndefined();
        expect(patchAge('26', '26.05')).toBeUndefined();
        expect(patchAge('26.05', '')).toBeUndefined();
    });
});
