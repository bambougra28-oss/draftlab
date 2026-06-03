/**
 * M2 — Champion name/slug → key lookup.
 *
 * gol.gg renders champions sometimes as display names ("Kai'Sa", "Twisted
 * Fate") and sometimes as slugs ("Kaisa", "TwistedFate"). We index both the
 * display name and the Data Dragon id of every tagged champion under a single
 * normalized form (lowercase, apostrophes/spaces/punctuation stripped), so a
 * lookup resolves either rendering. Wukong/MonkeyKing is covered for free since
 * its id is "MonkeyKing" and its name is "Wukong".
 */
import { loadDefaultTags } from '$lib/tags';
import type { ChampionTagsFile } from '$lib/tags/types';

export function normalizeChampionName(value: string): string {
    return value.toLowerCase().replace(/[’'`.\s_-]/g, '');
}

export class ChampionLookup {
    private readonly byNorm = new Map<string, string>();

    constructor(file: ChampionTagsFile) {
        for (const [key, tag] of Object.entries(file.champions)) {
            this.byNorm.set(normalizeChampionName(tag.name), key);
            this.byNorm.set(normalizeChampionName(tag.id), key);
        }
    }

    lookup(nameOrSlug: string): string | undefined {
        return this.byNorm.get(normalizeChampionName(nameOrSlug));
    }

    has(nameOrSlug: string): boolean {
        return this.byNorm.has(normalizeChampionName(nameOrSlug));
    }
}

let cached: ChampionLookup | null = null;

export function defaultLookup(): ChampionLookup {
    if (cached === null) cached = new ChampionLookup(loadDefaultTags());
    return cached;
}

export function lookupChampion(nameOrSlug: string, file?: ChampionTagsFile): string | undefined {
    return (file ? new ChampionLookup(file) : defaultLookup()).lookup(nameOrSlug);
}
