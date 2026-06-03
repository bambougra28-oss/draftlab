import { describe, it, expect } from 'vitest';
import { analyzeDraft, teamSideOffset, computeSideOffset } from '$lib/engine/analyzer';
import { buildMockDataset, makeTeam } from '$lib/dataset/mock';
import { Role, type AnalyzeDraftConfig, type SideContext, type TeamSideRecord } from '$lib/types';

const neutral: TeamSideRecord = { blue: { wins: 4, games: 8 }, red: { wins: 4, games: 8 } };
const blueStrong: TeamSideRecord = { blue: { wins: 7, games: 8 }, red: { wins: 1, games: 8 } };

describe('side — teamSideOffset', () => {
    it('is ~0 for a 50% side record after smoothing', () => {
        expect(teamSideOffset(neutral, 'blue')).toBeCloseTo(0, 6);
    });

    it('is positive for a strong blue-side record', () => {
        expect(teamSideOffset(blueStrong, 'blue')).toBeGreaterThan(0);
    });

    it('smooths a small sample heavily toward 0.5 (7/8 → ~55%)', () => {
        // withPrior({7,8}, 50, 0.5) = {32, 58} → 0.5517 → modest positive offset
        const offset = teamSideOffset(blueStrong, 'blue');
        const weakerPrior = teamSideOffset(blueStrong, 'blue', { sidePriorGames: 10 });
        // A lighter prior lets the strong side WR show more → larger offset.
        expect(weakerPrior).toBeGreaterThan(offset);
    });
});

describe('side — computeSideOffset', () => {
    it('is 0 with no side context', () => {
        expect(computeSideOffset(undefined)).toBe(0);
    });

    it('is positive when ally has the better side record', () => {
        const ctx: SideContext = {
            ally: { record: blueStrong, side: 'blue' },
            enemy: { record: neutral, side: 'red' }
        };
        expect(computeSideOffset(ctx)).toBeGreaterThan(0);
    });

    it('flips sign when the teams swap', () => {
        const ctx: SideContext = {
            ally: { record: neutral, side: 'red' },
            enemy: { record: blueStrong, side: 'blue' }
        };
        expect(computeSideOffset(ctx)).toBeLessThan(0);
    });
});

describe('side — integration through analyzeDraft', () => {
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

    it('a favourable side record lifts the winrate above the mirror baseline', () => {
        const sideContext: SideContext = {
            ally: { record: blueStrong, side: 'blue' },
            enemy: { record: neutral, side: 'red' }
        };
        expect(analyzeDraft(dataset, team, team, { ...base, sideContext }).winrate).toBeGreaterThan(0.5);
    });

    it('no side context leaves the mirror at 50% (no regression)', () => {
        expect(analyzeDraft(dataset, team, team, base).winrate).toBeCloseTo(0.5, 10);
    });
});
