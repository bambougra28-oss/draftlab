import { describe, it, expect } from 'vitest';
import { classifyGamePlan } from '$lib/strategic/gamePlanClassifier';
import { loadDefaultTags } from '$lib/tags';
import { GAME_PLAN_ARCHETYPES, type ChampionTag, type ChampionTagsFile, type GamePlanArchetype } from '$lib/tags/types';

function tag(over: Partial<ChampionTag> & { id: string }): ChampionTag {
    return {
        name: over.id,
        damageType: 'AD',
        range: 'melee',
        engageTool: 'none',
        disengageTools: [],
        mobility: 'low',
        scalingWindow: 'mid',
        hyperCarry: false,
        confidence: 'high',
        taggedBy: 'user',
        ...over
    };
}

function fileOf(tags: ChampionTag[]): ChampionTagsFile {
    const champions: Record<string, ChampionTag> = {};
    tags.forEach((t, i) => (champions[String(i + 1)] = t));
    return { version: '1.0', schemaVersion: 1, patchTagged: 'test', lastUpdated: 'test', champions };
}

const keysOf = (file: ChampionTagsFile) => Object.keys(file.champions);

describe('gamePlanClassifier — vote mechanics', () => {
    it('weights a long-range artillery mage toward Siege', () => {
        const file = fileOf([
            tag({ id: 'Ziggs', range: 'ranged-long', damageType: 'AP', engageTool: 'none', mobility: 'low' })
        ]);
        expect(classifyGamePlan(keysOf(file), file).primary).toBe('siege');
    });

    it('weights a hard-AoE initiator toward Engage', () => {
        const file = fileOf([tag({ id: 'Malphite', engageTool: 'hard-aoe', range: 'melee', scalingWindow: 'mid' })]);
        expect(classifyGamePlan(keysOf(file), file).primary).toBe('engage');
    });

    it('weights a mobile soft-CC assassin toward Pick', () => {
        const file = fileOf([
            tag({ id: 'Ahri', engageTool: 'soft-single', mobility: 'high', range: 'ranged-short', damageType: 'AP' })
        ]);
        expect(classifyGamePlan(keysOf(file), file).primary).toBe('pick');
    });

    it('weights a peeling enchanter toward Protect', () => {
        const file = fileOf([
            tag({
                id: 'Lulu',
                disengageTools: ['peel'],
                scalingWindow: 'late',
                range: 'ranged-short',
                engageTool: 'none',
                damageType: 'AP',
                mobility: 'low'
            })
        ]);
        expect(classifyGamePlan(keysOf(file), file).primary).toBe('protect');
    });

    it('weights a melee AD late-game duelist toward Split', () => {
        const file = fileOf([
            tag({ id: 'Fiora', range: 'melee', damageType: 'AD', scalingWindow: 'late', mobility: 'medium', engageTool: 'none' })
        ]);
        expect(classifyGamePlan(keysOf(file), file).primary).toBe('split');
    });

    it('applies gamePlanHints as a soft nudge', () => {
        const spec = {
            id: 'X',
            engageTool: 'soft-single',
            range: 'ranged-short',
            damageType: 'AP',
            mobility: 'low',
            scalingWindow: 'mid'
        } as const;
        const a = classifyGamePlan(['1'], fileOf([tag({ ...spec })]));
        const b = classifyGamePlan(['1'], fileOf([tag({ ...spec, gamePlanHints: ['siege'] })]));
        expect(b.distribution.siege).toBeGreaterThan(a.distribution.siege);
    });
});

describe('gamePlanClassifier — edges & invariants', () => {
    it('returns a uniform, ambiguous distribution for an empty comp (D5)', () => {
        const r = classifyGamePlan([], fileOf([]));
        expect(r.ambiguous).toBe(true);
        for (const a of GAME_PLAN_ARCHETYPES) expect(r.distribution[a]).toBeCloseTo(0.2, 10);
        expect(r.confidence).toBe('low');
    });

    it('ignores unknown champion keys', () => {
        const r = classifyGamePlan(['999'], fileOf([tag({ id: 'A' })]));
        expect(r.ambiguous).toBe(true);
    });

    it('distribution always sums to 1 (D2)', () => {
        const file = fileOf([
            tag({ id: 'A', engageTool: 'hard-aoe' }),
            tag({ id: 'B', range: 'ranged-long', damageType: 'AP' })
        ]);
        const r = classifyGamePlan(keysOf(file), file);
        const sum = GAME_PLAN_ARCHETYPES.reduce((s, a) => s + r.distribution[a], 0);
        expect(sum).toBeCloseTo(1, 10);
    });

    it('scales confidence with comp size (D6)', () => {
        const mk = (n: number) => fileOf(Array.from({ length: n }, (_, i) => tag({ id: `C${i}`, engageTool: 'hard-aoe' })));
        expect(classifyGamePlan(keysOf(mk(2)), mk(2)).confidence).toBe('low');
        expect(classifyGamePlan(keysOf(mk(3)), mk(3)).confidence).toBe('medium');
        expect(classifyGamePlan(keysOf(mk(5)), mk(5)).confidence).toBe('high');
    });

    it('flags ambiguous when no archetype reaches 40% (D3)', () => {
        const file = fileOf([
            tag({ id: 'eng', engageTool: 'hard-aoe', range: 'melee', scalingWindow: 'mid', mobility: 'low' }),
            tag({ id: 'sieg', range: 'ranged-long', damageType: 'AP', engageTool: 'none', mobility: 'low' }),
            tag({ id: 'pck', engageTool: 'soft-single', range: 'ranged-short', damageType: 'AP', mobility: 'high', scalingWindow: 'mid' })
        ]);
        const r = classifyGamePlan(keysOf(file), file);
        expect(Math.max(...GAME_PLAN_ARCHETYPES.map((a) => r.distribution[a]))).toBeLessThan(0.4);
        expect(r.ambiguous).toBe(true);
    });
});

describe('gamePlanClassifier — smoke (real championTags.json)', () => {
    const real = loadDefaultTags();
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    function key(nameOrId: string): string {
        const target = norm(nameOrId);
        const entry = Object.entries(real.champions).find(
            ([, t]) => norm(t.name) === target || norm(t.id) === target
        );
        if (!entry) throw new Error(`champion not found: ${nameOrId}`);
        return entry[0];
    }
    const top2 = (keys: string[]): GamePlanArchetype[] => {
        const r = classifyGamePlan(keys);
        return [r.primary, r.secondary];
    };

    it('Maokai + Malphite + Kennen reads as Engage', () => {
        expect(classifyGamePlan([key('Maokai'), key('Malphite'), key('Kennen')]).primary).toBe('engage');
    });

    it("Janna + Lulu + Yuumi + Caitlyn + Kog'Maw has Protect in top-2", () => {
        expect(top2([key('Janna'), key('Lulu'), key('Yuumi'), key('Caitlyn'), key('KogMaw')])).toContain('protect');
    });

    it('Caitlyn + Lulu + Ziggs + Jayce has Siege in top-2', () => {
        expect(top2([key('Caitlyn'), key('Lulu'), key('Ziggs'), key('Jayce')])).toContain('siege');
    });

    it('Fiora + Ryze + Camille has Split in top-2', () => {
        expect(top2([key('Fiora'), key('Ryze'), key('Camille')])).toContain('split');
    });

    it('LeBlanc + Ahri + Rell + Ashe has Pick in top-2', () => {
        expect(top2([key('Leblanc'), key('Ahri'), key('Rell'), key('Ashe')])).toContain('pick');
    });
});
