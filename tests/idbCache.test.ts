import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { readCacheIdb, writeCacheIdb, clearCacheIdb } from '$lib/dataset/idbCache';
import { CACHE_TTL_MS } from '$lib/dataset/cache';
import { idbClear } from '$lib/storage/idb';

beforeEach(async () => {
    await idbClear('datasets');
});

describe('IndexedDB dataset cache (STEP_UP #3)', () => {
    it('round-trips a value within the TTL', async () => {
        expect(await writeCacheIdb('k', { hello: 1 }, 1000)).toBe(true);
        expect(await readCacheIdb('k', 1000)).toEqual({ hello: 1 });
    });

    it('expires entries older than the TTL', async () => {
        await writeCacheIdb('k', { hello: 1 }, 1000);
        expect(await readCacheIdb('k', 1000 + CACHE_TTL_MS + 1)).toBeNull();
        // Expired entry was purged, not just hidden.
        expect(await readCacheIdb('k', 1000)).toBeNull();
    });

    it('returns null for a missing key', async () => {
        expect(await readCacheIdb('absent')).toBeNull();
    });

    it('clearCacheIdb removes the entry', async () => {
        await writeCacheIdb('k', 42, 1000);
        await clearCacheIdb('k');
        expect(await readCacheIdb('k', 1000)).toBeNull();
    });
});
