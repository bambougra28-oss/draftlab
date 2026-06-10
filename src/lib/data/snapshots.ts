/**
 * R1 — Immutable dated snapshots (DA-V2-3).
 *
 * Every provider sync writes a snapshot: `{id, source, kind, fetchedAt,
 * label?, payload}`. Snapshots are never mutated — "pool as-of-date",
 * honest backtests and week-over-week diffs all read from them. Persisted
 * in the `snapshots` IndexedDB store (schema v2).
 */
import { idbDelete, idbGet, idbGetAll, idbPut } from '$lib/storage/idb';

export type SnapshotKind = 'draft-records' | 'team' | 'player-pools' | 'aggregate' | 'raw';

export interface SnapshotMeta {
    id: string;
    /** Provider id ('leaguepedia', 'oracles-elixir', 'golgg', 'manual', …). */
    source: string;
    kind: SnapshotKind;
    /** ISO timestamp of the fetch. */
    fetchedAt: string;
    /** Human label, e.g. tournament or team the snapshot covers. */
    label?: string;
    /** Number of records in the payload when it is an array. */
    count?: number;
}

export interface Snapshot<T = unknown> extends SnapshotMeta {
    payload: T;
}

const STORE = 'snapshots' as const;

export interface SaveSnapshotInput<T> {
    source: string;
    kind: SnapshotKind;
    payload: T;
    label?: string;
    /** Injectable clock/id for tests. */
    fetchedAt?: string;
    id?: string;
}

export async function saveSnapshot<T>(input: SaveSnapshotInput<T>): Promise<Snapshot<T>> {
    const snapshot: Snapshot<T> = {
        id: input.id ?? crypto.randomUUID(),
        source: input.source,
        kind: input.kind,
        fetchedAt: input.fetchedAt ?? new Date().toISOString(),
        label: input.label,
        count: Array.isArray(input.payload) ? input.payload.length : undefined,
        payload: input.payload
    };
    await idbPut(STORE, snapshot);
    return snapshot;
}

export function getSnapshot<T = unknown>(id: string): Promise<Snapshot<T> | undefined> {
    return idbGet<Snapshot<T>>(STORE, id);
}

export interface SnapshotFilter {
    source?: string;
    kind?: SnapshotKind;
    /** Keep snapshots fetched at/before this ISO timestamp (as-of queries). */
    asOf?: string;
}

/** Snapshot metadata (payload stripped), newest first, optionally filtered. */
export async function listSnapshots(filter: SnapshotFilter = {}): Promise<SnapshotMeta[]> {
    const all = await idbGetAll<Snapshot>(STORE);
    return all
        .filter(
            (s) =>
                (filter.source === undefined || s.source === filter.source) &&
                (filter.kind === undefined || s.kind === filter.kind) &&
                (filter.asOf === undefined || s.fetchedAt <= filter.asOf)
        )
        .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))
        .map((s) => ({
            id: s.id,
            source: s.source,
            kind: s.kind,
            fetchedAt: s.fetchedAt,
            label: s.label,
            count: s.count
        }));
}

/**
 * The latest snapshot at-or-before `asOf` for a (source, kind, label?) —
 * the primitive behind "pool as-of-date" replays.
 */
export async function latestSnapshotAsOf<T = unknown>(
    filter: SnapshotFilter & { label?: string }
): Promise<Snapshot<T> | undefined> {
    const metas = await listSnapshots(filter);
    const match = filter.label === undefined ? metas[0] : metas.find((m) => m.label === filter.label);
    return match ? getSnapshot<T>(match.id) : undefined;
}

export function deleteSnapshot(id: string): Promise<undefined> {
    return idbDelete(STORE, id);
}
