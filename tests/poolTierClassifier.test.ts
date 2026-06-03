import { describe, it, expect } from 'vitest';
import { classifyPoolTier, effectiveGames } from '$lib/strategic/poolTierClassifier';

describe('poolTierClassifier', () => {
    it('classifies by effective game count', () => {
        expect(classifyPoolTier({ games: 25 })).toBe('strongest');
        expect(classifyPoolTier({ games: 12 })).toBe('match-ready');
        expect(classifyPoolTier({ games: 5 })).toBe('scrim-ready');
        expect(classifyPoolTier({ games: 1 })).toBe('learning');
    });

    it('does not derate within the 60-day grace window', () => {
        expect(effectiveGames(20, 60)).toBe(20);
        expect(classifyPoolTier({ games: 20, daysSinceLastPlayed: 30 })).toBe('strongest');
    });

    it('derates stale games and can drop a tier', () => {
        expect(effectiveGames(24, 240)).toBeCloseTo(6); // 24 * 60/240
        expect(classifyPoolTier({ games: 24, daysSinceLastPlayed: 240 })).toBe('scrim-ready');
    });
});
