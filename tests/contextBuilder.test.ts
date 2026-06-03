import { describe, it, expect } from 'vitest';
import { buildPlayerContext, buildSideContext, relativeTimeLabel, poolForRole } from '$lib/pro/contextBuilder';
import { Role, type Team } from '$lib/types';
import type { ProTeam } from '$lib/pro/types';

function team(): ProTeam {
    return {
        id: '1',
        name: 'Test',
        league: 'lfl',
        players: [
            { id: 'p1', name: 'Top', role: Role.Top, pool: [{ championKey: 'aatrox', games: 10, wins: 6 }, { championKey: 'jax', games: 2, wins: 1 }] },
            { id: 'p2', name: 'Jg', role: Role.Jungle, pool: [] }
        ],
        sideStats: { blue: { wins: 5, games: 8 }, red: { wins: 3, games: 8 } },
        recentDrafts: [],
        warnings: []
    };
}

describe('contextBuilder — buildPlayerContext', () => {
    it('marks a well-played champion as comfort with its winrate', () => {
        const picks: Team = new Map([[Role.Top, 'aatrox']]);
        const ctx = buildPlayerContext(team(), picks);
        expect(ctx[Role.Top]?.comfortMode).toBe('comfort');
        expect(ctx[Role.Top]?.playerStats).toEqual({ games: 10, winrate: 0.6 });
    });

    it('marks a thin pool (1–4 games) as cheese', () => {
        const ctx = buildPlayerContext(team(), new Map([[Role.Top, 'jax']]));
        expect(ctx[Role.Top]?.comfortMode).toBe('cheese');
    });

    it('marks an out-of-pool pick as unavailable with null stats', () => {
        const ctx = buildPlayerContext(team(), new Map([[Role.Jungle, 'leesin']]));
        expect(ctx[Role.Jungle]?.comfortMode).toBe('unavailable');
        expect(ctx[Role.Jungle]?.playerStats).toBeNull();
    });

    it('skips roles with no pick', () => {
        const ctx = buildPlayerContext(team(), new Map());
        expect(Object.keys(ctx)).toHaveLength(0);
    });
});

describe('contextBuilder — buildSideContext', () => {
    it('maps both teams records and sides', () => {
        const ctx = buildSideContext(team(), team(), 'blue', 'red');
        expect(ctx.ally.side).toBe('blue');
        expect(ctx.enemy.side).toBe('red');
        expect(ctx.ally.record.blue).toEqual({ wins: 5, games: 8 });
        expect(ctx.enemy.record.red).toEqual({ wins: 3, games: 8 });
    });
});

describe('contextBuilder — helpers', () => {
    it('poolForRole returns the assigned player pool', () => {
        expect(poolForRole(team(), Role.Top)).toHaveLength(2);
        expect(poolForRole(team(), Role.Middle)).toEqual([]);
    });

    it('relativeTimeLabel formats minutes / hours / days', () => {
        const now = 10_000_000_000;
        expect(relativeTimeLabel(now, now)).toBe("à l'instant");
        expect(relativeTimeLabel(now - 5 * 60_000, now)).toBe('il y a 5 min');
        expect(relativeTimeLabel(now - 3 * 3_600_000, now)).toBe('il y a 3 h');
        expect(relativeTimeLabel(now - 2 * 86_400_000, now)).toBe('il y a 2 j');
    });
});
