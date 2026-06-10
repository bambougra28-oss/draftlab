/**
 * R1 / STEP_UP #3 — IndexedDB-backed dataset cache.
 *
 * The 30-day DraftGap feed (~50 MB) exceeds the localStorage quota, so writes
 * silently failed and every session re-downloaded it. Datasets now persist in
 * the `datasets` IndexedDB store (schema v2) with the same 24h TTL. All
 * functions degrade gracefully (null/false) when IndexedDB is unavailable —
 * callers keep the localStorage path as fallback for small payloads.
 */
import { idbDelete, idbGet, idbPut } from '$lib/storage/idb';
import { CACHE_TTL_MS } from './cache';

interface DatasetCacheEntry<T> {
    id: string;
    cachedAt: number;
    data: T;
}

function idbAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
}

export async function readCacheIdb<T>(key: string, now: number = Date.now()): Promise<T | null> {
    if (!idbAvailable()) return null;
    try {
        const entry = await idbGet<DatasetCacheEntry<T>>('datasets', key);
        if (!entry) return null;
        if (now - entry.cachedAt > CACHE_TTL_MS) {
            await idbDelete('datasets', key);
            return null;
        }
        return entry.data;
    } catch {
        return null;
    }
}

export async function writeCacheIdb<T>(key: string, data: T, now: number = Date.now()): Promise<boolean> {
    if (!idbAvailable()) return false;
    try {
        await idbPut('datasets', { id: key, cachedAt: now, data });
        return true;
    } catch {
        // Quota/serialization failure — degrade gracefully, caller may fall back.
        return false;
    }
}

export async function clearCacheIdb(key: string): Promise<void> {
    if (!idbAvailable()) return;
    try {
        await idbDelete('datasets', key);
    } catch {
        // ignore
    }
}
