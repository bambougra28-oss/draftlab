import { describe, it, expect } from 'vitest';
import { LEAGUE_REGISTRY, leagueById, leaguepediaPrefix } from '$lib/data/leagues';
import { LEAGUES } from '$lib/pro/types';

describe('league registry (2026)', () => {
    it('has unique ids and every league enabled (STEP_UP #10)', () => {
        const ids = LEAGUE_REGISTRY.map((l) => l.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(LEAGUE_REGISTRY.every((l) => l.enabled)).toBe(true);
    });

    it('reflects the 2026 landscape: LCS and CBLOL separate, no LTA', () => {
        expect(leagueById('lcs')).toBeDefined();
        expect(leagueById('cblol')).toBeDefined();
        expect(leagueById('lta')).toBeUndefined();
        expect(leagueById('lck')?.tier).toBe('tier1');
        expect(leagueById('lfl')?.tier).toBe('erl');
        expect(leagueById('worlds')?.tier).toBe('international');
    });

    it('substitutes the year into the Leaguepedia prefix', () => {
        expect(leaguepediaPrefix('lck', 2026)).toBe('LCK/2026');
        expect(leaguepediaPrefix('first-stand', 2026)).toBe('First Stand/2026');
        expect(leaguepediaPrefix('unknown', 2026)).toBeUndefined();
    });

    it('drives the legacy LEAGUES view (same ids, all enabled)', () => {
        expect(LEAGUES.map((l) => l.id)).toEqual(LEAGUE_REGISTRY.map((l) => l.id));
        expect(LEAGUES.every((l) => l.enabled)).toBe(true);
    });
});
