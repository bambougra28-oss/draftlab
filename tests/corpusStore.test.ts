import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    corpusStatus,
    fetchCorpusManifest,
    importBundledCorpora,
    loadAllCorpusRecords,
    loadCorpusRecords
} from '$lib/intel/corpusStore';
import { idbClear } from '$lib/storage/idb';
import type { DraftRecord } from '$lib/data/types';

beforeEach(async () => {
    await idbClear('snapshots');
});

function record(gameId: string): DraftRecord {
    return {
        gameId,
        blueTeam: 'T1',
        redTeam: 'Gen.G',
        firstPickSide: 'blue',
        orderConfidence: 'assumed-blue-first',
        actions: [],
        warnings: [],
        provenance: { source: 'leaguepedia', fetchedAt: '2026-06-10T00:00:00Z' }
    };
}

const MANIFEST = {
    attribution: 'Data from Leaguepedia (lol.fandom.com), CC BY-SA 3.0',
    files: [
        { file: 'lck-2026.json', league: 'lck', records: 2, from: '2026-01-14', to: '2026-06-07', pulledAt: '2026-06-10T13:00:00Z' },
        { file: 'lfl-2026.json', league: 'lfl', records: 1, from: '2026-01-10', to: '2026-06-03', pulledAt: '2026-06-10T13:01:00Z' }
    ]
};

/** Stub fetch serving the manifest and per-league files; counts calls. */
function stubFetch(overrides: Record<string, unknown> = {}) {
    const calls: string[] = [];
    const bodies: Record<string, unknown> = {
        '/corpus/index.json': MANIFEST,
        '/corpus/lck-2026.json': [record('lck-1'), record('lck-2')],
        '/corpus/lfl-2026.json': [record('lfl-1')],
        ...overrides
    };
    const fetchImpl = (async (url: string | URL) => {
        const key = String(url);
        calls.push(key);
        const body = bodies[key];
        if (body === undefined) return { ok: false, status: 404, json: async () => ({}) } as Response;
        if (body === 'BROKEN') return { ok: false, status: 500, json: async () => ({}) } as Response;
        return { ok: true, status: 200, json: async () => body } as Response;
    }) as unknown as typeof fetch;
    return { fetchImpl, calls };
}

describe('fetchCorpusManifest', () => {
    it('returns the parsed manifest with attribution', async () => {
        const { fetchImpl } = stubFetch();
        const manifest = await fetchCorpusManifest({ fetchImpl });
        expect(manifest.files.map((f) => f.league)).toEqual(['lck', 'lfl']);
        expect(manifest.attribution).toContain('CC BY-SA');
    });

    it('throws on a non-ok response', async () => {
        const { fetchImpl } = stubFetch({ '/corpus/index.json': undefined });
        await expect(fetchCorpusManifest({ fetchImpl })).rejects.toThrow('404');
    });
});

describe('importBundledCorpora', () => {
    it('imports every league into snapshots and reports counts', async () => {
        const { fetchImpl } = stubFetch();
        const report = await importBundledCorpora({ fetchImpl });
        expect(report.imported.map((s) => [s.league, s.records])).toEqual([
            ['lck', 2],
            ['lfl', 1]
        ]);
        expect(report.skipped).toEqual([]);
        expect(report.warnings).toEqual([]);

        const status = await corpusStatus();
        expect(status.map((s) => [s.league, s.records, s.pulledAt])).toEqual([
            ['lck', 2, '2026-06-10T13:00:00Z'],
            ['lfl', 1, '2026-06-10T13:01:00Z']
        ]);
    });

    it('is idempotent: same pulledAt ⇒ skipped, no refetch of the files', async () => {
        const first = stubFetch();
        await importBundledCorpora({ fetchImpl: first.fetchImpl });

        const second = stubFetch();
        const report = await importBundledCorpora({ fetchImpl: second.fetchImpl });
        expect(report.imported).toEqual([]);
        expect(report.skipped).toEqual(['lck', 'lfl']);
        expect(second.calls).toEqual(['/corpus/index.json']); // manifest only
    });

    it('re-imports a league whose manifest pulledAt moved forward', async () => {
        const { fetchImpl } = stubFetch();
        await importBundledCorpora({ fetchImpl });

        const newer = JSON.parse(JSON.stringify(MANIFEST));
        newer.files[0].pulledAt = '2026-06-11T08:00:00Z';
        const refreshed = stubFetch({
            '/corpus/index.json': newer,
            '/corpus/lck-2026.json': [record('lck-1'), record('lck-2'), record('lck-3')]
        });
        const report = await importBundledCorpora({ fetchImpl: refreshed.fetchImpl });
        expect(report.imported.map((s) => [s.league, s.records])).toEqual([['lck', 3]]);
        expect(report.skipped).toEqual(['lfl']);

        const status = await corpusStatus();
        expect(status.find((s) => s.league === 'lck')?.records).toBe(3);
    });

    it('degrades a broken file to a warning without blocking the others', async () => {
        const { fetchImpl } = stubFetch({ '/corpus/lck-2026.json': 'BROKEN' });
        const report = await importBundledCorpora({ fetchImpl });
        expect(report.imported.map((s) => s.league)).toEqual(['lfl']);
        expect(report.warnings.some((w) => w.includes('lck'))).toBe(true);
    });
});

describe('loadCorpusRecords', () => {
    it('returns the latest imported records for a league, null otherwise', async () => {
        const { fetchImpl } = stubFetch();
        await importBundledCorpora({ fetchImpl });
        const records = await loadCorpusRecords('lck');
        expect(records?.map((r) => r.gameId)).toEqual(['lck-1', 'lck-2']);
        expect(await loadCorpusRecords('lec')).toBeNull();
    });
});

describe('loadAllCorpusRecords', () => {
    it('merges every imported league (empty array when nothing imported)', async () => {
        expect(await loadAllCorpusRecords()).toEqual([]);
        const { fetchImpl } = stubFetch();
        await importBundledCorpora({ fetchImpl });
        const all = await loadAllCorpusRecords();
        expect(all.map((r) => r.gameId).sort()).toEqual(['lck-1', 'lck-2', 'lfl-1']);
    });
});
