import { describe, it, expect } from 'vitest';
import {
    DDRAGON_FALLBACK_VERSION,
    VERSION_CACHE_KEY,
    VERSION_TTL_MS,
    championIconUrl,
    championIdByKey,
    championNameByKey,
    fetchDataDragonVersion
} from '$lib/dataDragon/version';

/** Minimal in-memory Storage so the cache logic runs in Node. */
function fakeStorage(initial: Record<string, string> = {}): Storage {
    const map = new Map<string, string>(Object.entries(initial));
    return {
        get length() {
            return map.size;
        },
        clear: () => map.clear(),
        getItem: (key: string) => map.get(key) ?? null,
        key: (index: number) => [...map.keys()][index] ?? null,
        removeItem: (key: string) => {
            map.delete(key);
        },
        setItem: (key: string, value: string) => {
            map.set(key, value);
        }
    };
}

/** A fetch stub returning the given JSON payload, counting its calls. */
function okFetch(payload: unknown, calls = { count: 0 }): typeof fetch {
    return (async () => {
        calls.count++;
        return { ok: true, status: 200, json: async () => payload } as Response;
    }) as typeof fetch;
}

const offlineFetch: typeof fetch = (async () => {
    throw new Error('offline');
}) as typeof fetch;

/** Cache entry as the module serializes it. */
const entry = (cachedAt: number, version: string): string => JSON.stringify({ cachedAt, version });

describe('dataDragon/version — fetchDataDragonVersion', () => {
    it('fetches versions.json and returns the first (newest) entry', async () => {
        const storage = fakeStorage();
        const version = await fetchDataDragonVersion({
            fetchImpl: okFetch(['26.12.1', '26.11.1']),
            now: 1_000,
            storage
        });
        expect(version).toBe('26.12.1');
        // The fetched value is cached with the injected clock.
        expect(storage.getItem(VERSION_CACHE_KEY)).toBe(entry(1_000, '26.12.1'));
    });

    it('serves a fresh cache without hitting the network (age == TTL is still fresh)', async () => {
        // cachedAt=1000, now=1000+TTL → age is exactly TTL_MS; freshness rule is
        // `now - cachedAt <= TTL`, so the cache must be used and fetch not called.
        const calls = { count: 0 };
        const storage = fakeStorage({ [VERSION_CACHE_KEY]: entry(1_000, '26.10.1') });
        const version = await fetchDataDragonVersion({
            fetchImpl: okFetch(['26.12.1'], calls),
            now: 1_000 + VERSION_TTL_MS,
            storage
        });
        expect(version).toBe('26.10.1');
        expect(calls.count).toBe(0);
    });

    it('refetches once the cache is older than 24h', async () => {
        // now = cachedAt + TTL + 1 → 1 ms past the window → must refetch.
        const storage = fakeStorage({ [VERSION_CACHE_KEY]: entry(1_000, '26.10.1') });
        const now = 1_000 + VERSION_TTL_MS + 1;
        const version = await fetchDataDragonVersion({
            fetchImpl: okFetch(['26.12.1']),
            now,
            storage
        });
        expect(version).toBe('26.12.1');
        expect(storage.getItem(VERSION_CACHE_KEY)).toBe(entry(now, '26.12.1'));
    });

    it('falls back to the STALE cache when offline', async () => {
        const storage = fakeStorage({ [VERSION_CACHE_KEY]: entry(0, '26.9.1') });
        // Cache is long expired (now ≫ TTL) but the network is down → stale wins.
        const version = await fetchDataDragonVersion({
            fetchImpl: offlineFetch,
            now: 10 * VERSION_TTL_MS,
            storage
        });
        expect(version).toBe('26.9.1');
    });

    it('falls back to the pinned constant when offline with an empty cache', async () => {
        const version = await fetchDataDragonVersion({
            fetchImpl: offlineFetch,
            now: 1_000,
            storage: fakeStorage()
        });
        expect(version).toBe(DDRAGON_FALLBACK_VERSION);
    });

    it('treats a malformed payload (empty array / non-array) as a failure', async () => {
        const storage = fakeStorage();
        expect(await fetchDataDragonVersion({ fetchImpl: okFetch([]), now: 1, storage })).toBe(
            DDRAGON_FALLBACK_VERSION
        );
        expect(
            await fetchDataDragonVersion({ fetchImpl: okFetch({ not: 'an array' }), now: 1, storage })
        ).toBe(DDRAGON_FALLBACK_VERSION);
    });

    it('still returns the fetched version when the cache write throws (quota)', async () => {
        const broken = fakeStorage();
        broken.setItem = () => {
            throw new Error('QuotaExceededError');
        };
        const version = await fetchDataDragonVersion({
            fetchImpl: okFetch(['26.12.1']),
            now: 1,
            storage: broken
        });
        expect(version).toBe('26.12.1');
    });

    it('ignores a corrupt cache entry and refetches', async () => {
        const storage = fakeStorage({ [VERSION_CACHE_KEY]: 'not json{{' });
        const version = await fetchDataDragonVersion({
            fetchImpl: okFetch(['26.12.1']),
            now: 1,
            storage
        });
        expect(version).toBe('26.12.1');
    });
});

describe('dataDragon/version — key → id mapping + icon URL', () => {
    it('maps numeric keys to Data Dragon ids via the bundled tags', () => {
        // Hand-checked against data/championTags.json: key "157" is Yasuo.
        expect(championIdByKey('157')).toBe('Yasuo');
        expect(championNameByKey('157')).toBe('Yasuo');
        expect(championIdByKey('99999')).toBeUndefined();
    });

    it('builds the versioned CDN icon URL from a numeric key', () => {
        expect(championIconUrl('157', '26.12.1')).toBe(
            'https://ddragon.leagueoflegends.com/cdn/26.12.1/img/champion/Yasuo.png'
        );
    });

    it('returns null for an unknown champion key', () => {
        expect(championIconUrl('99999', '26.12.1')).toBeNull();
    });
});
