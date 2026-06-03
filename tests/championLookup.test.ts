import { describe, it, expect } from 'vitest';
import { lookupChampion, normalizeChampionName, defaultLookup } from '$lib/pro/championLookup';

// Display name ↔ slug pairs gol.gg renders inconsistently.
const APOSTROPHE_CHAMPS: [string, string][] = [
    ["Kai'Sa", 'Kaisa'],
    ["Kha'Zix", 'Khazix'],
    ["Cho'Gath", 'Chogath'],
    ["Vel'Koz", 'Velkoz'],
    ["Rek'Sai", 'RekSai'],
    ["Kog'Maw", 'KogMaw'],
    ["K'Sante", 'KSante']
];

const SPACE_CHAMPS: [string, string][] = [
    ['Twisted Fate', 'TwistedFate'],
    ['Master Yi', 'MasterYi'],
    ['Miss Fortune', 'MissFortune'],
    ['Tahm Kench', 'TahmKench'],
    ['Lee Sin', 'LeeSin']
];

describe('normalizeChampionName', () => {
    it('strips case, apostrophes, spaces and punctuation', () => {
        expect(normalizeChampionName("Kai'Sa")).toBe('kaisa');
        expect(normalizeChampionName('Twisted Fate')).toBe('twistedfate');
        expect(normalizeChampionName('Dr. Mundo')).toBe('drmundo');
    });

    it('treats a curly apostrophe like a straight one', () => {
        expect(normalizeChampionName('Kai’Sa')).toBe(normalizeChampionName("Kai'Sa"));
    });
});

describe('championLookup', () => {
    it.each(APOSTROPHE_CHAMPS)('maps "%s" and slug "%s" to the same key', (name, slug) => {
        const fromName = lookupChampion(name);
        expect(fromName).toBeDefined();
        expect(lookupChampion(slug)).toBe(fromName);
    });

    it.each(SPACE_CHAMPS)('maps "%s" and slug "%s" to the same key', (name, slug) => {
        const fromName = lookupChampion(name);
        expect(fromName).toBeDefined();
        expect(lookupChampion(slug)).toBe(fromName);
    });

    it('resolves Wukong from both its name and its MonkeyKing id', () => {
        const wukong = lookupChampion('Wukong');
        expect(wukong).toBeDefined();
        expect(lookupChampion('MonkeyKing')).toBe(wukong);
    });

    it('resolves a curly-apostrophe rendering', () => {
        expect(lookupChampion('Kai’Sa')).toBe(lookupChampion("Kai'Sa"));
    });

    it('returns undefined for an unknown champion', () => {
        expect(lookupChampion('Notachampion')).toBeUndefined();
    });

    it('exposes a reusable cached lookup', () => {
        expect(defaultLookup().has('Ahri')).toBe(true);
    });
});
