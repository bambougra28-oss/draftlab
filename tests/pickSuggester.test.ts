import { describe, it, expect } from 'vitest';
import { suggestPicks } from '$lib/strategic/pickSuggester';
import { buildMockDataset } from '$lib/dataset/mock';
import { Role } from '$lib/types';
import type { ChampionTag, ChampionTagsFile } from '$lib/tags/types';

function tag(over: Partial<ChampionTag> & { id: string }): ChampionTag {
    return {
        name: over.id,
        damageType: 'AD',
        range: 'melee',
        engageTool: 'none',
        disengageTools: [],
        mobility: 'medium',
        scalingWindow: 'mid',
        hyperCarry: false,
        confidence: 'high',
        taggedBy: 'user',
        ...over
    };
}
function tagsOf(champions: Record<string, ChampionTag>): ChampionTagsFile {
    return { version: '1.0', schemaVersion: 1, patchTagged: 't', lastUpdated: 't', champions };
}

describe('pickSuggester', () => {
    it('ranks a plan-aligned candidate first', () => {
        const tags = tagsOf({
            eng: tag({ id: 'eng', engageTool: 'hard-aoe', range: 'melee' }),
            poke: tag({ id: 'poke', range: 'ranged-long', damageType: 'AP', engageTool: 'none', mobility: 'low' })
        });
        const out = suggestPicks({ allyComp: ['x'], targetPlan: 'engage', candidates: ['eng', 'poke'], tagsFile: tags });
        expect(out[0].championKey).toBe('eng');
        expect(out[0].rationale).toContain('Aligné sur le plan engage');
    });

    it('rewards filling a missing engage tool', () => {
        // ally has only a no-engage champion → engage is a gap.
        const tags = tagsOf({
            adc: tag({ id: 'adc', range: 'ranged-short', engageTool: 'none' }),
            eng: tag({ id: 'eng', engageTool: 'hard-aoe', range: 'melee' })
        });
        const out = suggestPicks({ allyComp: ['adc'], targetPlan: 'engage', candidates: ['eng'], tagsFile: tags });
        expect(out[0].axes.gapFill).toBeGreaterThan(0);
        expect(out[0].rationale).toContain("Comble : outil d'engage");
    });

    it('rewards filling an absent damage type', () => {
        const tags = tagsOf({
            ad1: tag({ id: 'ad1', damageType: 'AD' }),
            ap: tag({ id: 'ap', damageType: 'AP', range: 'ranged-short' })
        });
        const out = suggestPicks({ allyComp: ['ad1'], targetPlan: 'pick', candidates: ['ap'], tagsFile: tags });
        expect(out[0].rationale).toContain('Comble : dégâts AP');
    });

    it('penalises redundancy on an already all-AD comp', () => {
        const tags = tagsOf({
            a: tag({ id: 'a', damageType: 'AD' }),
            b: tag({ id: 'b', damageType: 'AD' }),
            c: tag({ id: 'c', damageType: 'AD' }),
            d: tag({ id: 'd', damageType: 'AD' })
        });
        const out = suggestPicks({ allyComp: ['a', 'b', 'c'], targetPlan: 'split', candidates: ['d'], tagsFile: tags });
        expect(out[0].axes.penalty).toBe(1);
        expect(out[0].rationale).toContain('Redondance : dégâts AD déjà saturés');
    });

    it('respects the limit', () => {
        const tags = tagsOf({ a: tag({ id: 'a' }), b: tag({ id: 'b' }), c: tag({ id: 'c' }) });
        const out = suggestPicks({ allyComp: [], targetPlan: 'engage', candidates: ['a', 'b', 'c'], tagsFile: tags, limit: 2 });
        expect(out).toHaveLength(2);
    });

    it('boosts candidates with a favourable matchup when a dataset is supplied', () => {
        const tags = tagsOf({
            c1: tag({ id: 'c1', engageTool: 'hard-aoe', range: 'melee' }),
            c2: tag({ id: 'c2', engageTool: 'hard-aoe', range: 'melee' })
        });
        const dataset = buildMockDataset([
            { key: 'c1', roles: { [Role.Top]: { wins: 0, games: 100, matchups: [{ role: Role.Top, key: 'E', wins: 60, games: 100 }] } } },
            { key: 'c2', roles: { [Role.Top]: { wins: 0, games: 100, matchups: [{ role: Role.Top, key: 'E', wins: 40, games: 100 }] } } },
            { key: 'E', roles: { [Role.Top]: { wins: 0, games: 100 } } }
        ]);
        const out = suggestPicks({
            allyComp: [],
            enemyComp: ['E'],
            targetPlan: 'engage',
            candidates: ['c1', 'c2'],
            dataset,
            tagsFile: tags
        });
        expect(out[0].championKey).toBe('c1');
        expect(out[0].axes.counter).toBeGreaterThan(0);
        expect(out.find((s) => s.championKey === 'c2')?.axes.counter).toBeLessThan(0);
    });
});
