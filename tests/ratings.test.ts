import { describe, it, expect } from 'vitest';
import {
    ratingToWinrate,
    winrateToRating,
    getMatchupWinrate,
    getDuoWinrate
} from '$lib/engine/ratings';

describe('ratings — Elo conversions', () => {
    it('rating 0 → 50%', () => {
        expect(ratingToWinrate(0)).toBeCloseTo(0.5, 10);
    });

    it('rating +400 → ~90.9%', () => {
        expect(ratingToWinrate(400)).toBeCloseTo(1 / 1.1, 10);
    });

    it('is monotonic in rating difference', () => {
        expect(ratingToWinrate(100)).toBeGreaterThan(ratingToWinrate(-100));
        expect(ratingToWinrate(-100)).toBeLessThan(0.5);
    });

    it('winrateToRating(0.5) = 0', () => {
        expect(winrateToRating(0.5)).toBeCloseTo(0, 10);
    });

    it('round-trips rating → winrate → rating', () => {
        for (const r of [-300, -50, 0, 75, 250]) {
            expect(winrateToRating(ratingToWinrate(r))).toBeCloseTo(r, 6);
        }
    });

    it('getMatchupWinrate is 50% for equal base winrates', () => {
        expect(getMatchupWinrate(0.55, 0.55)).toBeCloseTo(0.5, 10);
    });

    it('getMatchupWinrate favours the stronger champion', () => {
        expect(getMatchupWinrate(0.6, 0.5)).toBeGreaterThan(0.5);
        expect(getMatchupWinrate(0.5, 0.6)).toBeLessThan(0.5);
    });

    it('getDuoWinrate stacks two advantages above either alone', () => {
        expect(getDuoWinrate(0.55, 0.55)).toBeGreaterThan(0.55);
        expect(getDuoWinrate(0.5, 0.5)).toBeCloseTo(0.5, 10);
    });
});
