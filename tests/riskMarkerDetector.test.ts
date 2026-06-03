import { describe, it, expect } from 'vitest';
import { detectRiskMarkers, type RiskMarker, type RiskMarkerId } from '$lib/strategic/riskMarkerDetector';
import type { GamePlanResult } from '$lib/strategic/gamePlanClassifier';
import { buildMockDataset } from '$lib/dataset/mock';
import { Role } from '$lib/types';
import type { ChampionTag, ChampionTagsFile, GamePlanArchetype } from '$lib/tags/types';

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

function tagsOf(tags: ChampionTag[]): ChampionTagsFile {
    const champions: Record<string, ChampionTag> = {};
    tags.forEach((t, i) => (champions[String(i + 1)] = t));
    return { version: '1.0', schemaVersion: 1, patchTagged: 't', lastUpdated: 't', champions };
}

const keys = (tags: ChampionTag[]): string[] => tags.map((_, i) => String(i + 1));
const ids = (markers: RiskMarker[]): RiskMarkerId[] => markers.map((m) => m.id);

function gp(primary: GamePlanArchetype): GamePlanResult {
    const distribution = { siege: 0, split: 0, pick: 0, protect: 0, engage: 0 } as Record<GamePlanArchetype, number>;
    distribution[primary] = 1;
    return { distribution, primary, secondary: 'siege', confidence: 'high', ambiguous: false };
}

describe('riskMarkerDetector', () => {
    it('returns [] for an empty ally comp', () => {
        expect(detectRiskMarkers([], [], { tagsFile: tagsOf([]) })).toEqual([]);
    });

    it('flags no-frontline when no melee frontline exists', () => {
        const tags = [tag({ id: 'a', range: 'ranged-short' }), tag({ id: 'b', range: 'ranged-long' })];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags) }))).toContain('no-frontline');
    });

    it('does not flag no-frontline with a melee engager present', () => {
        const tags = [tag({ id: 'a', range: 'melee', engageTool: 'hard-aoe' }), tag({ id: 'b', range: 'ranged-long' })];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags) }))).not.toContain('no-frontline');
    });

    it('flags damage-100-ad when every champion is pure AD', () => {
        const tags = [tag({ id: 'a', damageType: 'AD', range: 'melee', engageTool: 'hard-aoe' }), tag({ id: 'b', damageType: 'AD', range: 'ranged-short' })];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags) }))).toContain('damage-100-ad');
    });

    it('does not flag damage-100-ad when an AP champion is present', () => {
        const tags = [tag({ id: 'a', damageType: 'AD', range: 'melee', engageTool: 'hard-aoe' }), tag({ id: 'b', damageType: 'AP', range: 'ranged-short' })];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags) }))).not.toContain('damage-100-ad');
    });

    it('flags damage-100-ap when every champion is pure AP', () => {
        const tags = [tag({ id: 'a', damageType: 'AP', range: 'melee', engageTool: 'hard-aoe' }), tag({ id: 'b', damageType: 'AP', range: 'ranged-long' })];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags) }))).toContain('damage-100-ap');
    });

    it('flags no-engage-tool as warning by default', () => {
        const tags = [tag({ id: 'a', range: 'melee', engageTool: 'none', scalingWindow: 'mid' }), tag({ id: 'b', range: 'ranged-long', engageTool: 'none' })];
        const marker = detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags) }).find((m) => m.id === 'no-engage-tool');
        expect(marker?.severity).toBe('warning');
    });

    it('escalates no-engage-tool to critical for an Engage plan', () => {
        const tags = [tag({ id: 'a', range: 'melee', engageTool: 'none' })];
        const marker = detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags), allyGamePlan: gp('engage') }).find((m) => m.id === 'no-engage-tool');
        expect(marker?.severity).toBe('critical');
    });

    it('downgrades no-engage-tool to info for a Pick plan', () => {
        const tags = [tag({ id: 'a', range: 'ranged-short', engageTool: 'none' })];
        const marker = detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags), allyGamePlan: gp('pick') }).find((m) => m.id === 'no-engage-tool');
        expect(marker?.severity).toBe('info');
    });

    it('does not flag no-engage-tool when an engager is present', () => {
        const tags = [tag({ id: 'a', range: 'melee', engageTool: 'hard-aoe' })];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags) }))).not.toContain('no-engage-tool');
    });

    it('flags no-disengage-vs-engage when enemy plays Engage and we have none', () => {
        const tags = [tag({ id: 'a', disengageTools: [] }), tag({ id: 'b', disengageTools: [] })];
        const m = detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags), enemyGamePlan: gp('engage') });
        const marker = m.find((x) => x.id === 'no-disengage-vs-engage');
        expect(marker?.severity).toBe('critical');
    });

    it('does not flag no-disengage-vs-engage when we have disengage', () => {
        const tags = [tag({ id: 'a', disengageTools: ['peel'] })];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags), enemyGamePlan: gp('engage') }))).not.toContain('no-disengage-vs-engage');
    });

    it('does not flag no-disengage-vs-engage when enemy is not Engage', () => {
        const tags = [tag({ id: 'a', disengageTools: [] })];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags), enemyGamePlan: gp('pick') }))).not.toContain('no-disengage-vs-engage');
    });

    it('flags difficult-lane-matchup for a sub-45% matchup with enough games', () => {
        const tags = [tag({ id: 'a' })];
        const dataset = buildMockDataset([
            { key: '1', roles: { [Role.Top]: { wins: 0, games: 0, matchups: [{ role: Role.Top, key: '99', wins: 40, games: 100 }] } } }
        ]);
        expect(ids(detectRiskMarkers(['1'], ['99'], { tagsFile: tagsOf(tags), dataset }))).toContain('difficult-lane-matchup');
    });

    it('does not flag difficult-lane-matchup at or above 45%', () => {
        const tags = [tag({ id: 'a' })];
        const dataset = buildMockDataset([
            { key: '1', roles: { [Role.Top]: { wins: 0, games: 0, matchups: [{ role: Role.Top, key: '99', wins: 48, games: 100 }] } } }
        ]);
        expect(ids(detectRiskMarkers(['1'], ['99'], { tagsFile: tagsOf(tags), dataset }))).not.toContain('difficult-lane-matchup');
    });

    it('does not flag difficult-lane-matchup below the games threshold', () => {
        const tags = [tag({ id: 'a' })];
        const dataset = buildMockDataset([
            { key: '1', roles: { [Role.Top]: { wins: 0, games: 0, matchups: [{ role: Role.Top, key: '99', wins: 10, games: 50 }] } } }
        ]);
        expect(ids(detectRiskMarkers(['1'], ['99'], { tagsFile: tagsOf(tags), dataset }))).not.toContain('difficult-lane-matchup');
    });

    it('flags homogeneous-scaling when 3+ champions share a window', () => {
        const tags = [
            tag({ id: 'a', scalingWindow: 'late', range: 'melee', engageTool: 'hard-aoe' }),
            tag({ id: 'b', scalingWindow: 'late', range: 'ranged-short' }),
            tag({ id: 'c', scalingWindow: 'late', range: 'ranged-long' })
        ];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags) }))).toContain('homogeneous-scaling');
    });

    it('does not flag homogeneous-scaling below 3 champions', () => {
        const tags = [tag({ id: 'a', scalingWindow: 'late' }), tag({ id: 'b', scalingWindow: 'late' })];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags) }))).not.toContain('homogeneous-scaling');
    });

    it('flags low-mobility-vs-pick when enemy plays Pick and 3+ allies are immobile', () => {
        const tags = [tag({ id: 'a', mobility: 'low' }), tag({ id: 'b', mobility: 'low' }), tag({ id: 'c', mobility: 'low' })];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags), enemyGamePlan: gp('pick') }))).toContain('low-mobility-vs-pick');
    });

    it('does not flag low-mobility-vs-pick with only 2 immobile allies', () => {
        const tags = [tag({ id: 'a', mobility: 'low' }), tag({ id: 'b', mobility: 'low' }), tag({ id: 'c', mobility: 'high' })];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags), enemyGamePlan: gp('pick') }))).not.toContain('low-mobility-vs-pick');
    });

    it('flags split-without-waveclear for a Split plan lacking long-range AP', () => {
        const tags = [tag({ id: 'a', range: 'melee', damageType: 'AD' }), tag({ id: 'b', range: 'ranged-short', damageType: 'AP' })];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags), allyGamePlan: gp('split') }))).toContain('split-without-waveclear');
    });

    it('does not flag split-without-waveclear when a long-range AP mage is present', () => {
        const tags = [tag({ id: 'a', range: 'ranged-long', damageType: 'AP' }), tag({ id: 'b', range: 'melee' })];
        expect(ids(detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags), allyGamePlan: gp('split') }))).not.toContain('split-without-waveclear');
    });

    it('sorts markers critical → warning → info', () => {
        const tags = [
            tag({ id: 'a', damageType: 'AD', scalingWindow: 'late', range: 'melee', engageTool: 'hard-aoe' }),
            tag({ id: 'b', damageType: 'AD', scalingWindow: 'late', range: 'ranged-short' }),
            tag({ id: 'c', damageType: 'AD', scalingWindow: 'late', range: 'ranged-long' })
        ];
        const m = detectRiskMarkers(keys(tags), [], { tagsFile: tagsOf(tags), enemyGamePlan: gp('engage') });
        const rank = { critical: 0, warning: 1, info: 2 };
        for (let i = 1; i < m.length; i++) {
            expect(rank[m[i].severity]).toBeGreaterThanOrEqual(rank[m[i - 1].severity]);
        }
        const severities = m.map((x) => x.severity);
        expect(severities).toContain('critical');
        expect(severities).toContain('warning');
        expect(severities).toContain('info');
    });
});
