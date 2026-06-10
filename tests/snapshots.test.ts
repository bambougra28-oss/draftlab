import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    saveSnapshot,
    getSnapshot,
    listSnapshots,
    latestSnapshotAsOf,
    deleteSnapshot
} from '$lib/data/snapshots';
import { idbClear, idbGet, idbPut, DB_VERSION } from '$lib/storage/idb';

beforeEach(async () => {
    await idbClear('snapshots');
});

describe('snapshots store (schema v2)', () => {
    it('is on schema v2 with the new stores reachable', async () => {
        expect(DB_VERSION).toBe(2);
        // Both new stores accept writes (would throw NotFoundError otherwise).
        await idbPut('snapshots', { id: 'probe-snap' });
        await idbPut('datasets', { id: 'probe-ds' });
        expect(await idbGet('snapshots', 'probe-snap')).toBeDefined();
        expect(await idbGet('datasets', 'probe-ds')).toBeDefined();
    });

    it('coexists with the v1 stores (plans still readable/writable)', async () => {
        await idbPut('plans', { id: 'p1', name: 'Plan A' });
        expect(await idbGet('plans', 'p1')).toMatchObject({ name: 'Plan A' });
    });
});

describe('saveSnapshot / getSnapshot', () => {
    it('round-trips a payload with metadata and array count', async () => {
        const saved = await saveSnapshot({
            source: 'leaguepedia',
            kind: 'draft-records',
            label: 'LCK/2026',
            payload: [{ gameId: 'g1' }, { gameId: 'g2' }],
            fetchedAt: '2026-06-10T10:00:00Z',
            id: 'snap-1'
        });
        expect(saved.count).toBe(2);
        const loaded = await getSnapshot<{ gameId: string }[]>('snap-1');
        expect(loaded?.payload.map((r) => r.gameId)).toEqual(['g1', 'g2']);
        expect(loaded?.fetchedAt).toBe('2026-06-10T10:00:00Z');
        expect(loaded?.label).toBe('LCK/2026');
    });

    it('leaves count undefined for non-array payloads', async () => {
        const saved = await saveSnapshot({
            source: 'golgg',
            kind: 'team',
            payload: { id: '2924', name: 'ZYB Esport' },
            id: 'snap-team'
        });
        expect(saved.count).toBeUndefined();
    });
});

describe('listSnapshots / latestSnapshotAsOf', () => {
    beforeEach(async () => {
        await saveSnapshot({
            source: 'leaguepedia', kind: 'draft-records', label: 'LCK/2026',
            payload: [1], fetchedAt: '2026-06-01T00:00:00Z', id: 'a'
        });
        await saveSnapshot({
            source: 'leaguepedia', kind: 'draft-records', label: 'LCK/2026',
            payload: [1, 2], fetchedAt: '2026-06-08T00:00:00Z', id: 'b'
        });
        await saveSnapshot({
            source: 'golgg', kind: 'team', label: 'ZYB Esport',
            payload: {}, fetchedAt: '2026-06-05T00:00:00Z', id: 'c'
        });
    });

    it('lists newest-first with filters and strips payloads', async () => {
        const all = await listSnapshots();
        expect(all.map((m) => m.id)).toEqual(['b', 'c', 'a']);
        expect('payload' in all[0]).toBe(false);

        const lpOnly = await listSnapshots({ source: 'leaguepedia' });
        expect(lpOnly.map((m) => m.id)).toEqual(['b', 'a']);

        const teams = await listSnapshots({ kind: 'team' });
        expect(teams.map((m) => m.id)).toEqual(['c']);
    });

    it('latestSnapshotAsOf replays the state at a past date', async () => {
        const atJune2 = await latestSnapshotAsOf<number[]>({
            source: 'leaguepedia',
            kind: 'draft-records',
            asOf: '2026-06-02T00:00:00Z'
        });
        expect(atJune2?.id).toBe('a');
        expect(atJune2?.payload).toEqual([1]);

        const now = await latestSnapshotAsOf<number[]>({ source: 'leaguepedia', kind: 'draft-records' });
        expect(now?.id).toBe('b');

        const labelled = await latestSnapshotAsOf({ source: 'golgg', kind: 'team', label: 'ZYB Esport' });
        expect(labelled?.id).toBe('c');
    });

    it('deleteSnapshot removes the entry', async () => {
        await deleteSnapshot('c');
        expect(await getSnapshot('c')).toBeUndefined();
    });
});
