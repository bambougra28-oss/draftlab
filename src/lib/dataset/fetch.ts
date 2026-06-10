/**
 * Dataset fetching (M1_VALIDATION two-dataset model).
 *
 *  - `current-patch.json` — solo champion stats on the active patch (sparse).
 *  - `30-days.json`       — broader sample; the only source of pair-level data
 *                           and the prior target for solo smoothing.
 *
 * Both are cached for 24h (see ./cache). `fetchImpl` is injectable for tests.
 */
import type { Dataset } from '$lib/types';
import { clearCache, readCache, writeCache } from './cache';
import { readCacheIdb, writeCacheIdb } from './idbCache';

export const FULL_DATASET_URL = 'https://bucket.draftgap.com/datasets/v5/30-days.json';
export const PATCH_DATASET_URL = 'https://bucket.draftgap.com/datasets/v5/current-patch.json';

const FULL_CACHE_KEY = 'draftlab:dataset:30-days';
const PATCH_CACHE_KEY = 'draftlab:dataset:current-patch';

type FetchLike = typeof fetch;

export interface FetchDatasetOptions {
    fetchImpl?: FetchLike;
    /** Bypass the cache and overwrite it with a fresh fetch. */
    force?: boolean;
}

async function fetchJson(url: string, fetchImpl: FetchLike): Promise<Dataset> {
    const res = await fetchImpl(url);
    if (!res.ok) {
        throw new Error(`Dataset fetch failed: ${res.status} ${res.statusText} (${url})`);
    }
    return (await res.json()) as Dataset;
}

async function loadCached(
    url: string,
    cacheKey: string,
    { fetchImpl = fetch, force = false }: FetchDatasetOptions = {}
): Promise<Dataset> {
    if (!force) {
        // IndexedDB first (STEP_UP #3 — the ~50 MB feed fits there), then the
        // legacy localStorage entry as a one-time migration read.
        const idbCached = await readCacheIdb<Dataset>(cacheKey);
        if (idbCached) return idbCached;
        const cached = readCache<Dataset>(cacheKey);
        if (cached) return cached;
    }
    const data = await fetchJson(url, fetchImpl);
    const wroteIdb = await writeCacheIdb(cacheKey, data);
    if (wroteIdb) {
        clearCache(cacheKey); // free the localStorage quota once migrated
    } else {
        writeCache(cacheKey, data); // non-IDB environment — legacy behavior
    }
    return data;
}

export function fetchFullDataset(opts?: FetchDatasetOptions): Promise<Dataset> {
    return loadCached(FULL_DATASET_URL, FULL_CACHE_KEY, opts);
}

export function fetchPatchDataset(opts?: FetchDatasetOptions): Promise<Dataset> {
    return loadCached(PATCH_DATASET_URL, PATCH_CACHE_KEY, opts);
}

export interface DatasetPair {
    /** current-patch sample (solo champion signal). */
    dataset: Dataset;
    /** 30-day dataset (priors + pair data). */
    fullDataset: Dataset;
}

/** Fetch both datasets in parallel. */
export async function fetchDatasetPair(opts?: FetchDatasetOptions): Promise<DatasetPair> {
    const [dataset, fullDataset] = await Promise.all([
        fetchPatchDataset(opts),
        fetchFullDataset(opts)
    ]);
    return { dataset, fullDataset };
}
