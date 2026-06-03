import { describe, it, expect } from 'vitest';
import { suggestBans } from '$lib/strategic/banPrioritySuggester';

describe('banPrioritySuggester', () => {
    it('marks a comfort + pocket + meta threat as must-ban', () => {
        const [b] = suggestBans([
            { championKey: '1', poolTier: 'strongest', pocketRisk: 'high', metaStrength: 1 }
        ]);
        expect(b.tier).toBe('must-ban');
        expect(b.rationale.length).toBeGreaterThan(0);
    });

    it('grades a moderate threat in a middle tier', () => {
        const [b] = suggestBans([{ championKey: '1', poolTier: 'match-ready', pocketRisk: 'medium' }]);
        expect(['high', 'medium']).toContain(b.tier);
    });

    it('skips a low / unknown threat', () => {
        const [b] = suggestBans([{ championKey: '1', poolTier: 'learning', pocketRisk: 'none' }]);
        expect(b.tier).toBe('skip');
    });

    it('forces skip for a consumed champion in a Fearless series', () => {
        const [b] = suggestBans(
            [{ championKey: '1', poolTier: 'strongest', pocketRisk: 'high', consumed: true }],
            { fearless: true }
        );
        expect(b.tier).toBe('skip');
        expect(b.rationale[0]).toContain('Fearless');
    });

    it('still bans a strong consumed champion outside Fearless', () => {
        const [b] = suggestBans(
            [{ championKey: '1', poolTier: 'strongest', pocketRisk: 'high', consumed: true }],
            { fearless: false }
        );
        expect(b.tier).toBe('must-ban');
    });

    it('sorts highest priority first', () => {
        const out = suggestBans([
            { championKey: 'low', poolTier: 'learning' },
            { championKey: 'top', poolTier: 'strongest', pocketRisk: 'high', metaStrength: 1 },
            { championKey: 'mid', poolTier: 'match-ready', pocketRisk: 'medium' }
        ]);
        expect(out[0].championKey).toBe('top');
        expect(out[out.length - 1].championKey).toBe('low');
    });
});
