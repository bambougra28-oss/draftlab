/**
 * M5.2 — Data Dragon version + champion icon URLs.
 *
 * Champion icons live on the Riot Data Dragon CDN under a patch-versioned path,
 * so we need the latest version string from `versions.json`. It is cached in
 * localStorage for 24h (same TTL policy as the dataset cache). Offline
 * behaviour, in order of preference: fresh cache → network → STALE cache (an
 * expired entry is still the best truth we have when the network is down) →
 * a pinned fallback constant. This module keeps its own tiny cache record
 * instead of reusing `$lib/dataset/cache` because that helper *deletes*
 * expired entries on read, which would destroy the stale-fallback tier.
 *
 * The key→id mapping (e.g. "157" → "Yasuo") comes from the bundled champion
 * tags file — the dataset and the whole engine speak numeric keys, while
 * Data Dragon asset paths use the string id.
 *
 * `fetchImpl` / `now` / `storage` are injectable so the logic is fully
 * testable in Node; browser defaults only sit at the parameter edge.
 */
import { loadDefaultTags } from '$lib/tags';
import type { ChampionTagsFile } from '$lib/tags/types';

export const DDRAGON_VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json';

/**
 * Last-resort version when both network and cache are empty. Pinned to the
 * patch current at write time (26.11, per ARCHITECTURE_V2 §5.2 — CDragon was
 * observed up to date on 26.11 the same day); icons keep loading offline-first
 * even on a cold start, at worst one patch behind.
 */
export const DDRAGON_FALLBACK_VERSION = '26.11.1';

export const VERSION_CACHE_KEY = 'draftlab:ddragon:version';
export const VERSION_TTL_MS = 24 * 60 * 60 * 1000;

interface VersionCacheEntry {
    cachedAt: number;
    version: string;
}

export interface FetchVersionOptions {
    fetchImpl?: typeof fetch;
    /** Injectable clock (ms epoch) — defaults to the system clock at the edge. */
    now?: number;
    /** Injectable storage — defaults to `localStorage` when available. */
    storage?: Storage;
}

function resolveStorage(explicit?: Storage): Storage | null {
    if (explicit) return explicit;
    return typeof localStorage !== 'undefined' ? localStorage : null;
}

function readEntry(storage: Storage | null): VersionCacheEntry | null {
    const raw = storage?.getItem(VERSION_CACHE_KEY);
    if (!raw) return null;
    try {
        const entry = JSON.parse(raw) as VersionCacheEntry;
        if (typeof entry.cachedAt !== 'number' || typeof entry.version !== 'string') return null;
        return entry;
    } catch {
        return null;
    }
}

function writeEntry(storage: Storage | null, entry: VersionCacheEntry): void {
    try {
        storage?.setItem(VERSION_CACHE_KEY, JSON.stringify(entry));
    } catch {
        // QuotaExceededError — degrade gracefully, the version is still returned.
    }
}

/** First entry of `versions.json` (Riot orders newest-first), or null if malformed. */
function parseVersions(payload: unknown): string | null {
    if (!Array.isArray(payload)) return null;
    const first = payload[0];
    return typeof first === 'string' && first.length > 0 ? first : null;
}

/**
 * Resolve the current Data Dragon version: fresh cache → network (re-cached) →
 * stale cache → `DDRAGON_FALLBACK_VERSION`. Never rejects.
 */
export async function fetchDataDragonVersion(options: FetchVersionOptions = {}): Promise<string> {
    const { fetchImpl = fetch, now = Date.now() } = options;
    const storage = resolveStorage(options.storage);

    const cached = readEntry(storage);
    if (cached && now - cached.cachedAt <= VERSION_TTL_MS) {
        return cached.version;
    }

    try {
        const res = await fetchImpl(DDRAGON_VERSIONS_URL);
        if (!res.ok) throw new Error(`versions.json fetch failed: ${res.status}`);
        const version = parseVersions(await res.json());
        if (version === null) throw new Error('versions.json: malformed payload');
        writeEntry(storage, { cachedAt: now, version });
        return version;
    } catch {
        // Offline fallback: a stale cached version beats a pinned constant.
        return cached?.version ?? DDRAGON_FALLBACK_VERSION;
    }
}

/** Data Dragon string id for a numeric champion key (e.g. "157" → "Yasuo"). */
export function championIdByKey(
    championKey: string,
    tagsFile: ChampionTagsFile = loadDefaultTags()
): string | undefined {
    return tagsFile.champions[championKey]?.id;
}

/** Display name for a numeric champion key (e.g. "157" → "Yasuo"). */
export function championNameByKey(
    championKey: string,
    tagsFile: ChampionTagsFile = loadDefaultTags()
): string | undefined {
    return tagsFile.champions[championKey]?.name;
}

/**
 * Square champion icon URL for a numeric key on a given ddragon version, or
 * null when the key is unknown to the tags file.
 */
export function championIconUrl(
    championKey: string,
    version: string,
    tagsFile: ChampionTagsFile = loadDefaultTags()
): string | null {
    const id = championIdByKey(championKey, tagsFile);
    if (id === undefined) return null;
    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`;
}

/**
 * Tall loading-screen art (308×560) for a numeric key — the immersive slot
 * backgrounds. The loading path is NOT patch-versioned on the CDN, so no
 * version resolution is needed.
 */
export function championLoadingUrl(
    championKey: string,
    tagsFile: ChampionTagsFile = loadDefaultTags()
): string | null {
    const id = championIdByKey(championKey, tagsFile);
    if (id === undefined) return null;
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${id}_0.jpg`;
}
