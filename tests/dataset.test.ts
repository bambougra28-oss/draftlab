import { describe, it, expect, vi } from 'vitest';
import { buildMockDataset } from '$lib/dataset/mock';
import { readCache, writeCache, clearCache, CACHE_TTL_MS } from '$lib/dataset/cache';
import { fetchDatasetPair, FULL_DATASET_URL, PATCH_DATASET_URL } from '$lib/dataset/fetch';
import { Role, type Dataset } from '$lib/types';

function fakeStorage(): Storage {
    const m = new Map<string, string>();
    return {
        getItem: (k: string) => m.get(k) ?? null,
        setItem: (k: string, v: string) => void m.set(k, String(v)),
        removeItem: (k: string) => void m.delete(k),
        clear: () => m.clear(),
        key: (i: number) => Array.from(m.keys())[i] ?? null,
        get length() {
            return m.size;
        }
    } as Storage;
}

describe('dataset — mock builder', () => {
    it('creates all five roles with empty defaults', () => {
        const ds = buildMockDataset([{ key: '1', roles: { [Role.Top]: { wins: 1, games: 2 } } }]);
        const champ = ds.championData['1'];
        expect(Object.keys(champ.statsByRole)).toHaveLength(5);
        expect(champ.statsByRole[Role.Top]).toMatchObject({ wins: 1, games: 2 });
        expect(champ.statsByRole[Role.Jungle]).toMatchObject({ wins: 0, games: 0 });
        expect(champ.statsByRole[Role.Top].statsByTime).toHaveLength(5);
    });

    it('folds matchups and synergies into nested maps', () => {
        const ds = buildMockDataset([
            {
                key: '1',
                roles: {
                    [Role.Top]: {
                        wins: 10,
                        games: 20,
                        matchups: [{ role: Role.Top, key: '99', wins: 6, games: 10 }],
                        synergies: [{ role: Role.Jungle, key: '2', wins: 7, games: 10 }]
                    }
                }
            }
        ]);
        const roleData = ds.championData['1'].statsByRole[Role.Top];
        expect(roleData.matchup[Role.Top]['99']).toEqual({ wins: 6, games: 10 });
        expect(roleData.synergy[Role.Jungle]['2']).toEqual({ wins: 7, games: 10 });
    });
});

describe('dataset — cache', () => {
    it('returns null when the key is absent', () => {
        expect(readCache('missing', 1000, fakeStorage())).toBeNull();
    });

    it('round-trips a value within the TTL', () => {
        const store = fakeStorage();
        writeCache('k', { hello: 1 }, 1000, store);
        expect(readCache('k', 1000, store)).toEqual({ hello: 1 });
    });

    it('expires entries older than the TTL', () => {
        const store = fakeStorage();
        writeCache('k', { hello: 1 }, 1000, store);
        expect(readCache('k', 1000 + CACHE_TTL_MS + 1, store)).toBeNull();
    });

    it('swallows quota errors and reports failure', () => {
        const throwing = {
            getItem: () => null,
            setItem: () => {
                throw new DOMException('quota', 'QuotaExceededError');
            },
            removeItem: () => {},
            clear: () => {},
            key: () => null,
            length: 0
        } as Storage;
        expect(writeCache('k', { big: 'x' }, 1000, throwing)).toBe(false);
    });

    it('clearCache removes the entry', () => {
        const store = fakeStorage();
        writeCache('k', 1, 1000, store);
        clearCache('k', store);
        expect(readCache('k', 1000, store)).toBeNull();
    });
});

describe('dataset — fetchDatasetPair', () => {
    it('fetches both URLs in parallel and labels them correctly', async () => {
        const urls: string[] = [];
        const fetchImpl = vi.fn(async (url: string | URL) => {
            const u = String(url);
            urls.push(u);
            const payload: Dataset = buildMockDataset([
                { key: '1', roles: { [Role.Top]: { wins: 1, games: 2 } } }
            ]);
            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => payload
            } as Response;
        }) as unknown as typeof fetch;

        const pair = await fetchDatasetPair({ fetchImpl, force: true });

        expect(urls).toContain(PATCH_DATASET_URL);
        expect(urls).toContain(FULL_DATASET_URL);
        expect(pair.dataset.championData['1']).toBeDefined();
        expect(pair.fullDataset.championData['1']).toBeDefined();
    });

    it('throws a helpful error on a non-ok response', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            json: async () => ({})
        } as Response)) as unknown as typeof fetch;

        await expect(fetchDatasetPair({ fetchImpl, force: true })).rejects.toThrow(/503/);
    });
});
