import { describe, it, expect } from 'vitest';
import { assessPocketPickRisk } from '$lib/strategic/pocketPickRiskAssessor';
import type { ChampionTag } from '$lib/tags/types';

const lowTag = { confidence: 'low' } as ChampionTag;
const highTag = { confidence: 'high' } as ChampionTag;

describe('pocketPickRiskAssessor', () => {
    it('reports no risk with no reasons', () => {
        expect(assessPocketPickRisk({ tag: highTag }).risk).toBe('none');
        expect(assessPocketPickRisk({}).reasons).toEqual([]);
    });

    it('flags a low-confidence tag', () => {
        const a = assessPocketPickRisk({ tag: lowTag });
        expect(a.reasons).toContain('tagged_low_confidence');
        expect(a.risk).toBe('low');
    });

    it('flags low stage presence strictly below the threshold', () => {
        expect(assessPocketPickRisk({ stagePresence: 0.02 }).reasons).toContain('low_stage_presence');
        expect(assessPocketPickRisk({ stagePresence: 0.05 }).reasons).not.toContain('low_stage_presence');
    });

    it('flags a recent buff', () => {
        expect(assessPocketPickRisk({ recentlyBuffed: true }).reasons).toContain('recent_buff');
    });

    it('escalates risk as reasons stack', () => {
        expect(assessPocketPickRisk({ tag: lowTag, stagePresence: 0.01 }).risk).toBe('medium');
        expect(assessPocketPickRisk({ tag: lowTag, stagePresence: 0.01, recentlyBuffed: true }).risk).toBe('high');
    });
});
