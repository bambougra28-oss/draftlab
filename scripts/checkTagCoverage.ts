/**
 * Champion tag coverage report.
 *
 * Counts how many champions in the live universe are tagged in
 * `data/championTags.json`. The universe comes from a local DraftGap dataset
 * sample when `DRAFTLAB_DATASET` points to one, otherwise from Data Dragon's
 * champion list. Exits non-zero if any champion is untagged.
 *
 * Run: pnpm coverage:tags
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const tagsPath = resolve(here, '..', 'data', 'championTags.json');

interface TagsFile {
    champions: Record<string, { name: string }>;
}

const tags = JSON.parse(readFileSync(tagsPath, 'utf8')) as TagsFile;
const tagged = new Set(Object.keys(tags.champions));

async function loadUniverse(): Promise<Map<string, string>> {
    const sample = process.env.DRAFTLAB_DATASET;
    if (sample) {
        const ds = JSON.parse(readFileSync(sample, 'utf8')) as {
            championData: Record<string, { name?: string }>;
        };
        return new Map(Object.entries(ds.championData).map(([key, v]) => [key, v.name ?? key]));
    }

    const versions = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json()) as string[];
    const version = versions[0];
    const data = (await (
        await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)
    ).json()) as { data: Record<string, { key: string; name: string }> };
    return new Map(Object.values(data.data).map((c) => [c.key, c.name]));
}

const universe = await loadUniverse();
const missing = [...universe.entries()].filter(([key]) => !tagged.has(key));
const total = universe.size;
const covered = total - missing.length;
const pct = total === 0 ? 0 : (covered / total) * 100;

console.log(`Champion tag coverage: ${covered} / ${total} (${pct.toFixed(2)}%)`);

if (missing.length > 0) {
    console.log('Missing:');
    for (const [key, name] of missing) console.log(`  ${key}\t${name}`);
    process.exit(1);
}

console.log('All champions tagged.');
