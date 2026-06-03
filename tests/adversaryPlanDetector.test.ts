import { describe, it, expect } from 'vitest';
import { detectAdversaryPlan } from '$lib/strategic/adversaryPlanDetector';
import { classifyGamePlan } from '$lib/strategic/gamePlanClassifier';
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

const engage = (id: string, over: Partial<ChampionTag> = {}) => tag({ id, engageTool: 'hard-aoe', range: 'melee', ...over });

const engageTags = tagsOf({
    '1': engage('a'),
    '2': engage('b'),
    '3': engage('c'),
    '4': engage('d'),
    '5': engage('e')
});

describe('adversaryPlanDetector', () => {
    it('reads a full engage comp as a confident, converged Engage plan', () => {
        const r = detectAdversaryPlan(['1', '2', '3', '4', '5'], { tagsFile: engageTags });
        expect(r.primary).toBe('engage');
        expect(r.confidence).toBeGreaterThan(0.4);
        expect(r.converged).toBe(true);
        expect(r.recommendation).toContain('désengage');
        expect(r.evolution).toHaveLength(5);
    });

    it('caps confidence on a single pick (not converged)', () => {
        const r = detectAdversaryPlan(['1'], { tagsFile: engageTags });
        expect(r.confidence).toBeLessThan(0.4);
        expect(r.converged).toBe(false);
    });

    it('tracks evolution length with the number of picks', () => {
        expect(detectAdversaryPlan(['1', '2', '3'], { tagsFile: engageTags }).evolution).toHaveLength(3);
    });

    it('handles an empty enemy comp', () => {
        const r = detectAdversaryPlan([], { tagsFile: engageTags });
        expect(r.recommendation).toContain('Pas encore');
        expect(r.converged).toBe(false);
        expect(r.evolution).toEqual([]);
    });

    it('blend preserves ordering — capped primary equals the raw classifier primary at 5 picks', () => {
        const picks = ['1', '2', '3', '4', '5'];
        const raw = classifyGamePlan(picks, engageTags);
        expect(detectAdversaryPlan(picks, { tagsFile: engageTags }).primary).toBe(raw.primary);
    });

    it('surfaces a pocket-pick warning for a low-confidence tag', () => {
        const tags = tagsOf({ '6': engage('f', { confidence: 'low' }) });
        const r = detectAdversaryPlan(['6'], { tagsFile: tags });
        expect(r.pocketPickWarnings.map((w) => w.championKey)).toContain('6');
        expect(r.pocketPickWarnings[0].reasons).toContain('tagged_low_confidence');
    });

    it('honours explicit pocket-pick signals (stage presence)', () => {
        const r = detectAdversaryPlan(['1'], { tagsFile: engageTags, pocketPickByKey: { '1': { stagePresence: 0.01 } } });
        expect(r.pocketPickWarnings[0]?.reasons).toContain('low_stage_presence');
    });
});
