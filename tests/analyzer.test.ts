import { describe, it, expect } from 'vitest';
import { analyzeDraft, analyzeChampion } from '$lib/engine/analyzer';
import { winrateToRating } from '$lib/engine/ratings';
import { buildMockDataset, makeTeam } from '$lib/dataset/mock';
import { Role, type AnalyzeDraftConfig } from '$lib/types';

const config: AnalyzeDraftConfig = {
    ignoreChampionWinrates: false,
    riskLevel: 'medium',
    minGames: 0
};

// Five champions, one per role, with mildly varied solo winrates, plus a weaker
// support alternative ('6') for the advantage test.
const dataset = buildMockDataset([
    { key: '1', roles: { [Role.Top]: { wins: 520, games: 1000 } } },
    { key: '2', roles: { [Role.Jungle]: { wins: 510, games: 1000 } } },
    { key: '3', roles: { [Role.Middle]: { wins: 500, games: 1000 } } },
    { key: '4', roles: { [Role.Bottom]: { wins: 505, games: 1000 } } },
    { key: '5', roles: { [Role.Support]: { wins: 495, games: 1000 } } },
    { key: '6', roles: { [Role.Support]: { wins: 400, games: 1000 } } }
]);

const team = makeTeam([
    [Role.Top, '1'],
    [Role.Jungle, '2'],
    [Role.Middle, '3'],
    [Role.Bottom, '4'],
    [Role.Support, '5']
]);

const enemyWeakerSupport = makeTeam([
    [Role.Top, '1'],
    [Role.Jungle, '2'],
    [Role.Middle, '3'],
    [Role.Bottom, '4'],
    [Role.Support, '6']
]);

describe('analyzer — analyzeDraft', () => {
    it('mirror draft is exactly 50%', () => {
        const result = analyzeDraft(dataset, team, team, config);
        expect(result.totalRating).toBeCloseTo(0, 6);
        expect(result.winrate).toBeCloseTo(0.5, 10);
    });

    it('a stronger ally (better support) pushes the winrate above 50%', () => {
        expect(analyzeDraft(dataset, team, enemyWeakerSupport, config).winrate).toBeGreaterThan(0.5);
    });

    it('totalRating is antisymmetric under swapping ally/enemy', () => {
        const a = analyzeDraft(dataset, team, enemyWeakerSupport, config).totalRating;
        const b = analyzeDraft(dataset, enemyWeakerSupport, team, config).totalRating;
        expect(b).toBeCloseTo(-a, 6);
    });

    it('ignoreChampionWinrates skips the solo-champion pass', () => {
        const result = analyzeDraft(dataset, team, team, { ...config, ignoreChampionWinrates: true });
        expect(result.allyChampionRating.championResults).toHaveLength(0);
        expect(result.allyChampionRating.totalRating).toBe(0);
    });
});

describe('analyzer — analyzeChampion smoothing', () => {
    it('with a single dataset the rating equals the raw winrate rating', () => {
        const c = analyzeChampion(dataset, dataset, Role.Top, '1', 1000);
        expect(c.games).toBe(1000);
        expect(c.rating).toBeCloseTo(winrateToRating(0.52), 6);
    });

    it('pulls a thin, extreme patch sample toward the 30-day baseline', () => {
        const patch = buildMockDataset([{ key: '7', roles: { [Role.Middle]: { wins: 8, games: 10 } } }]);
        const full = buildMockDataset([{ key: '7', roles: { [Role.Middle]: { wins: 5000, games: 10000 } } }]);
        const c = analyzeChampion(patch, full, Role.Middle, '7', 1000);
        // 8/10 = 80% raw, but blended toward 50% over 1000 prior games.
        expect(c.rating).toBeGreaterThan(0);
        expect(c.rating).toBeLessThan(winrateToRating(0.8));
        expect(c.wins).toBe(8);
        expect(c.games).toBe(10);
    });

    it('a stronger prior pulls the patch sample closer to the baseline', () => {
        const patch = buildMockDataset([{ key: '7', roles: { [Role.Middle]: { wins: 80, games: 100 } } }]);
        const full = buildMockDataset([{ key: '7', roles: { [Role.Middle]: { wins: 500, games: 1000 } } }]);
        const weakPrior = analyzeChampion(patch, full, Role.Middle, '7', 100).rating;
        const strongPrior = analyzeChampion(patch, full, Role.Middle, '7', 3000).rating;
        expect(weakPrior).toBeGreaterThan(strongPrior);
        expect(strongPrior).toBeGreaterThan(0);
    });
});
