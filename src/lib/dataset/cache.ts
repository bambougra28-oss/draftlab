/**
 * 24h client-side cache for dataset JSON, backed by localStorage.
 *
 * The 30-day dataset (~50 MB) exceeds the localStorage quota; writes that throw
 * QuotaExceededError are swallowed (the app still works, just uncached). Moving
 * the large dataset to IndexedDB is a tracked step-up — see docs/STEP_UP.md.
 *
 * All functions accept an explicit `storage`/`now` so the logic is testable in
 * a Node environment with a fake Storage.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
    cachedAt: number;
    data: T;
}

function getStorage(explicit?: Storage): Storage | null {
    if (explicit) return explicit;
    return typeof localStorage !== 'undefined' ? localStorage : null;
}

export function readCache<T>(key: string, now: number = Date.now(), storage?: Storage): T | null {
    const store = getStorage(storage);
    if (!store) return null;

    const raw = store.getItem(key);
    if (!raw) return null;

    try {
        const entry = JSON.parse(raw) as CacheEntry<T>;
        if (now - entry.cachedAt > TTL_MS) {
            store.removeItem(key);
            return null;
        }
        return entry.data;
    } catch {
        return null;
    }
}

export function writeCache<T>(key: string, data: T, now: number = Date.now(), storage?: Storage): boolean {
    const store = getStorage(storage);
    if (!store) return false;

    const entry: CacheEntry<T> = { cachedAt: now, data };
    try {
        store.setItem(key, JSON.stringify(entry));
        return true;
    } catch {
        // QuotaExceededError or serialization failure — degrade gracefully.
        return false;
    }
}

export function clearCache(key: string, storage?: Storage): void {
    getStorage(storage)?.removeItem(key);
}

export const CACHE_TTL_MS = TTL_MS;
