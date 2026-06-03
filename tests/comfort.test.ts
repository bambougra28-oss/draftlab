import { describe, it, expect } from 'vitest';
import { analyzeDraft, blendedPriorWinrate } from '$lib/engine/analyzer';
import { buildMockDataset, makeTeam } from '$lib/dataset/mock';
import { Role, type AnalyzeDraftConfig, type PlayerContext } from '$lib/types';

// Closed-form targets from M2 Ping 2 (baseline 0.51).
describe('comfort — blendedPriorWinrate (closed form)', () => {
    const B = 0.51;

    it('comfort 1g @ 100% → 511/1001', () => {
        expect(blendedPriorWinrate(B, { playerStats: { games: 1, winrate: 1 }, comfortMode: 'comfort' })).toBeCloseTo(511 / 1001, 9);
    });

    it('comfort 50g @ 60% → 540/1050', () => {
        expect(blendedPriorWinrate(B, { playerStats: { games: 50, winrate: 0.6 }, comfortMode: 'comfort' })).toBeCloseTo(540 / 1050, 9);
    });

    it('comfort 200g @ 60% → 0.525', () => {
        expect(blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'comfort' })).toBeCloseTo(0.525, 9);
    });

    it('cheese 200g @ 60% → 570/1100 (attenuated)', () => {
        expect(blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'cheese' })).toBeCloseTo(570 / 1100, 9);
    });

    it('"none" mode behaves exactly like "comfort"', () => {
        const none = blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'none' });
        const comfort = blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'comfort' });
        expect(none).toBeCloseTo(comfort, 12);
    });

    it('unavailable falls back to the baseline', () => {
        expect(blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'unavailable' })).toBe(B);
    });

    it('null player stats fall back to the baseline', () => {
        expect(blendedPriorWinrate(B, { playerStats: null, comfortMode: 'comfort' })).toBe(B);
    });

    it('zero games falls back to the baseline', () => {
        expect(blendedPriorWinrate(B, { playerStats: { games: 0, winrate: 1 }, comfortMode: 'comfort' })).toBe(B);
    });

    it('no slot at all falls back to the baseline', () => {
        expect(blendedPriorWinrate(B, undefined)).toBe(B);
    });

    it('honours a defaultPriorGames override', () => {
        // (200*0.6 + 500*0.51) / 700
        expect(
            blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'comfort' }, { defaultPriorGames: 500 })
        ).toBeCloseTo(375 / 700, 9);
    });

    it('honours a cheeseAttenuationFactor override', () => {
        // effGames 140 → (140*0.6 + 1000*0.51) / 1140
        expect(
            blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'cheese' }, { cheeseAttenuationFactor: 0.7 })
        ).toBeCloseTo(594 / 1140, 9);
    });
});

describe('comfort — integration through analyzeDraft', () => {
    const dataset = buildMockDataset([
        { key: '1', roles: { [Role.Top]: { wins: 500, games: 1000 } } },
        { key: '2', roles: { [Role.Jungle]: { wins: 500, games: 1000 } } },
        { key: '3', roles: { [Role.Middle]: { wins: 500, games: 1000 } } },
        { key: '4', roles: { [Role.Bottom]: { wins: 500, games: 1000 } } },
        { key: '5', roles: { [Role.Support]: { wins: 500, games: 1000 } } }
    ]);
    const team = makeTeam([
        [Role.Top, '1'],
        [Role.Jungle, '2'],
        [Role.Middle, '3'],
        [Role.Bottom, '4'],
        [Role.Support, '5']
    ]);
    const base: AnalyzeDraftConfig = { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 };

    it('a comfort signal on an ally lifts the winrate above the mirror baseline', () => {
        const playerContext: PlayerContext = {
            [Role.Top]: { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'comfort' }
        };
        const lifted = analyzeDraft(dataset, team, team, { ...base, playerContext }).winrate;
        expect(lifted).toBeGreaterThan(0.5);
    });

    it('an all-empty context collapses to the M1 path (no regression)', () => {
        const emptyContext: PlayerContext = {
            [Role.Top]: { playerStats: null, comfortMode: 'none' },
            [Role.Jungle]: { playerStats: null, comfortMode: 'none' },
            [Role.Middle]: { playerStats: null, comfortMode: 'none' },
            [Role.Bottom]: { playerStats: null, comfortMode: 'none' },
            [Role.Support]: { playerStats: null, comfortMode: 'none' }
        };
        const withEmpty = analyzeDraft(dataset, team, team, { ...base, playerContext: emptyContext }).winrate;
        const without = analyzeDraft(dataset, team, team, base).winrate;
        expect(withEmpty).toBeCloseTo(without, 12);
        expect(without).toBeCloseTo(0.5, 10);
    });
});
