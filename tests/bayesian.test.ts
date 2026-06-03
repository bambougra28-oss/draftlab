import { describe, it, expect } from 'vitest';
import {
    addStats,
    multiplyStats,
    divideStats,
    averageStats,
    withPrior,
    winrateOf
} from '$lib/engine/bayesian';

describe('bayesian — smoothing primitives', () => {
    it('addStats sums wins and games', () => {
        expect(addStats({ wins: 2, games: 5 }, { wins: 3, games: 4 })).toEqual({ wins: 5, games: 9 });
    });

    it('addStats with no arguments is the empty tally', () => {
        expect(addStats()).toEqual({ wins: 0, games: 0 });
    });

    it('multiply / divide scale both fields', () => {
        expect(multiplyStats({ wins: 2, games: 4 }, 3)).toEqual({ wins: 6, games: 12 });
        expect(divideStats({ wins: 6, games: 12 }, 3)).toEqual({ wins: 2, games: 4 });
    });

    it('averageStats averages element-wise', () => {
        expect(averageStats({ wins: 2, games: 4 }, { wins: 4, games: 8 })).toEqual({ wins: 3, games: 6 });
    });

    it('withPrior pulls a thin sample toward the prior winrate', () => {
        const blended = withPrior({ wins: 1, games: 1 }, 1000, 0.5);
        expect(blended).toEqual({ wins: 501, games: 1001 });
        expect(blended.wins / blended.games).toBeCloseTo(0.5005, 4);
    });

    it('withPrior leaves a large sample close to its raw winrate', () => {
        const blended = withPrior({ wins: 600, games: 1000 }, 10, 0.5);
        expect(blended.wins / blended.games).toBeCloseTo(0.6, 2);
    });

    it('winrateOf falls back to 0.5 on an empty sample', () => {
        expect(winrateOf({ wins: 0, games: 0 })).toBe(0.5);
        expect(winrateOf({ wins: 3, games: 6 })).toBe(0.5);
        expect(winrateOf({ wins: 6, games: 10 })).toBe(0.6);
    });
});
