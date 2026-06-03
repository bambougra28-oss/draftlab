/**
 * Champion tags — public API barrel.
 *
 * Re-exports the schema types and validator, and provides a cached loader for
 * the bundled `data/championTags.json` (validated once on first access).
 */
import rawTags from '../../../data/championTags.json';
import { validateTagsFile } from './loader';
import type { ChampionTagsFile } from './types';

export * from './types';
export * from './loader';

let cached: ChampionTagsFile | null = null;

/** Load, validate (once) and cache the bundled champion tags. */
export function loadDefaultTags(): ChampionTagsFile {
    if (cached === null) {
        cached = validateTagsFile(rawTags);
    }
    return cached;
}
