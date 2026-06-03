import { describe, it, expect } from 'vitest';
import {
    validateTagsFile,
    parseChampionTag,
    getTag,
    getTagByName,
    allTags,
    tagKeys,
    TagValidationError
} from '$lib/tags/loader';
import { loadDefaultTags } from '$lib/tags';
import { DAMAGE_TYPES, RANGES, ENGAGE_TOOLS, MOBILITIES, SCALING_WINDOWS } from '$lib/tags/types';

const validChampion = () => ({
    id: 'Annie',
    name: 'Annie',
    damageType: 'AP',
    range: 'ranged-short',
    engageTool: 'hard-aoe',
    disengageTools: [],
    mobility: 'low',
    scalingWindow: 'mid',
    hyperCarry: false,
    confidence: 'medium',
    taggedBy: 'user',
    notes: 'R Tibbers AoE stun.'
});

const validFile = () => ({
    version: '1.0',
    schemaVersion: 1,
    patchTagged: '26.09',
    lastUpdated: '2026-05-02',
    champions: { '1': validChampion() }
});

describe('validateTagsFile — top-level', () => {
    it('accepts a well-formed file', () => {
        const file = validateTagsFile(validFile());
        expect(file.schemaVersion).toBe(1);
        expect(Object.keys(file.champions)).toEqual(['1']);
    });

    it('rejects a non-object root', () => {
        expect(() => validateTagsFile(null)).toThrow(TagValidationError);
        expect(() => validateTagsFile('nope')).toThrow(TagValidationError);
    });

    it.each(['version', 'schemaVersion', 'patchTagged', 'lastUpdated', 'champions'])(
        'rejects a file missing the top-level field "%s"',
        (field) => {
            const f = validFile() as Record<string, unknown>;
            delete f[field];
            expect(() => validateTagsFile(f)).toThrow(/top-level field/);
        }
    );

    it('rejects an unsupported schemaVersion', () => {
        expect(() => validateTagsFile({ ...validFile(), schemaVersion: 2 })).toThrow(/schemaVersion/);
    });

    it('rejects a non-object champions map', () => {
        expect(() => validateTagsFile({ ...validFile(), champions: [] })).toThrow(/champions must be an object/);
    });
});

describe('parseChampionTag — per-champion', () => {
    it('parses a valid champion (with optional notes)', () => {
        const tag = parseChampionTag('1', validChampion());
        expect(tag.id).toBe('Annie');
        expect(tag.engageTool).toBe('hard-aoe');
        expect(tag.disengageTools).toEqual([]);
    });

    it('parses optional secondaryDamageType and gamePlanHints', () => {
        const tag = parseChampionTag('96', {
            ...validChampion(),
            id: 'KogMaw',
            name: "Kog'Maw",
            damageType: 'AD',
            secondaryDamageType: 'AP',
            hyperCarry: true,
            gamePlanHints: ['protect']
        });
        expect(tag.secondaryDamageType).toBe('AP');
        expect(tag.gamePlanHints).toEqual(['protect']);
        expect(tag.hyperCarry).toBe(true);
    });

    it('rejects a non-object entry', () => {
        expect(() => parseChampionTag('1', 42)).toThrow(/not an object/);
    });

    it.each(['id', 'name', 'damageType', 'range', 'engageTool', 'mobility', 'scalingWindow', 'hyperCarry'])(
        'rejects a champion missing "%s"',
        (field) => {
            const c = validChampion() as Record<string, unknown>;
            delete c[field];
            expect(() => parseChampionTag('1', c)).toThrow(/missing field/);
        }
    );

    it('rejects an invalid damageType', () => {
        expect(() => parseChampionTag('1', { ...validChampion(), damageType: 'MR' })).toThrow(/damageType/);
    });

    it('rejects an invalid range', () => {
        expect(() => parseChampionTag('1', { ...validChampion(), range: 'melee-ish' })).toThrow(/range/);
    });

    it('rejects an invalid engageTool', () => {
        expect(() => parseChampionTag('1', { ...validChampion(), engageTool: 'super' })).toThrow(/engageTool/);
    });

    it('rejects a non-boolean hyperCarry', () => {
        expect(() => parseChampionTag('1', { ...validChampion(), hyperCarry: 'yes' })).toThrow(/hyperCarry/);
    });

    it('rejects a non-array disengageTools', () => {
        expect(() => parseChampionTag('1', { ...validChampion(), disengageTools: 'peel' })).toThrow(/disengageTools/);
    });

    it('rejects an invalid disengageTools entry', () => {
        expect(() => parseChampionTag('1', { ...validChampion(), disengageTools: ['peel', 'slow'] })).toThrow(
            /disengageTools entry/
        );
    });

    it('rejects an invalid gamePlanHints entry', () => {
        expect(() => parseChampionTag('1', { ...validChampion(), gamePlanHints: ['poke'] })).toThrow(
            /gamePlanHints entry/
        );
    });

    it('rejects non-string notes', () => {
        expect(() => parseChampionTag('1', { ...validChampion(), notes: 5 })).toThrow(/notes/);
    });
});

describe('lookups', () => {
    const file = validateTagsFile({
        ...validFile(),
        champions: {
            '1': validChampion(),
            '4': { ...validChampion(), id: 'TwistedFate', name: 'Twisted Fate' }
        }
    });

    it('getTag resolves by key', () => {
        expect(getTag(file, '1')?.name).toBe('Annie');
    });

    it('getTag returns undefined for an unknown key', () => {
        expect(getTag(file, '999')).toBeUndefined();
    });

    it('getTagByName matches display name (case-insensitive)', () => {
        expect(getTagByName(file, 'twisted fate')?.id).toBe('TwistedFate');
    });

    it('getTagByName matches the Data Dragon id', () => {
        expect(getTagByName(file, 'TwistedFate')?.name).toBe('Twisted Fate');
    });

    it('allTags / tagKeys expose the collection', () => {
        expect(allTags(file)).toHaveLength(2);
        expect(tagKeys(file).sort()).toEqual(['1', '4']);
    });
});

describe('on-disk — bundled championTags.json', () => {
    const file = loadDefaultTags();

    it('contains 172 champions and validates without error', () => {
        expect(Object.keys(file.champions)).toHaveLength(172);
        expect(file.schemaVersion).toBe(1);
    });

    it('spot-checks a known champion', () => {
        expect(file.champions['1'].name).toBe('Annie');
        expect(file.champions['1'].damageType).toBe('AP');
    });

    it('every tag uses only known enum values', () => {
        for (const tag of allTags(file)) {
            expect(DAMAGE_TYPES).toContain(tag.damageType);
            expect(RANGES).toContain(tag.range);
            expect(ENGAGE_TOOLS).toContain(tag.engageTool);
            expect(MOBILITIES).toContain(tag.mobility);
            expect(SCALING_WINDOWS).toContain(tag.scalingWindow);
        }
    });

    it('is fully user-tagged (no claude-only entries left)', () => {
        expect(allTags(file).every((t) => t.taggedBy === 'user')).toBe(true);
    });
});
