import { describe, it, expect } from 'vitest';
import { inferRoles } from '$lib/strategic/inferRoles';
import { buildMockDataset } from '$lib/dataset/mock';
import { Role } from '$lib/types';

describe('inferRoles', () => {
    const ds = buildMockDataset([
        { key: 'top', roles: { [Role.Top]: { wins: 0, games: 1000 }, [Role.Middle]: { wins: 0, games: 10 } } },
        { key: 'jg', roles: { [Role.Jungle]: { wins: 0, games: 1000 } } },
        { key: 'mid', roles: { [Role.Middle]: { wins: 0, games: 1000 } } },
        { key: 'bot', roles: { [Role.Bottom]: { wins: 0, games: 1000 } } },
        { key: 'sup', roles: { [Role.Support]: { wins: 0, games: 1000 } } }
    ]);

    it('assigns five single-role champions to their lanes', () => {
        const m = inferRoles(['top', 'jg', 'mid', 'bot', 'sup'], ds);
        expect(m.get(Role.Top)).toBe('top');
        expect(m.get(Role.Jungle)).toBe('jg');
        expect(m.get(Role.Middle)).toBe('mid');
        expect(m.get(Role.Bottom)).toBe('bot');
        expect(m.get(Role.Support)).toBe('sup');
    });

    it('gives a contested role to the champion with the wider gap', () => {
        const ds2 = buildMockDataset([
            { key: 'A', roles: { [Role.Middle]: { wins: 0, games: 1000 } } }, // mid-only, huge gap
            { key: 'B', roles: { [Role.Middle]: { wins: 0, games: 900 }, [Role.Top]: { wins: 0, games: 800 } } } // flexible
        ]);
        const m = inferRoles(['A', 'B'], ds2);
        expect(m.get(Role.Middle)).toBe('A');
        expect(m.get(Role.Top)).toBe('B'); // B falls back to its next-best free role
    });

    it('returns a partial map for fewer than five picks', () => {
        const m = inferRoles(['mid', 'jg'], ds);
        expect(m.size).toBe(2);
        expect(m.get(Role.Middle)).toBe('mid');
        expect(m.get(Role.Jungle)).toBe('jg');
    });

    it('still places champions with no dataset signal into leftover roles', () => {
        const m = inferRoles(['mid', 'unknown'], ds);
        expect(m.size).toBe(2);
        expect(m.get(Role.Middle)).toBe('mid');
        expect([...m.values()]).toContain('unknown');
    });
});
