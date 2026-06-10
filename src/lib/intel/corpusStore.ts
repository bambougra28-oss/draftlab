/**
 * Corpus pro dans l'app — bundled Leaguepedia corpora → IndexedDB snapshots.
 *
 * The repo ships the normalized DraftRecord corpora as static assets
 * (`/corpus/index.json` manifest + one JSON per league, CC BY-SA attribution
 * inside the manifest). This store imports them into immutable snapshots
 * (DA-V2-3, source 'leaguepedia', kind 'draft-records', label = league id) so
 * every intel read in the browser works on the SAME data the harness scores —
 * both-sided records with exact per-team order, roles and patches, instead of
 * gol.gg's one-sided recent slice.
 *
 * Import is idempotent: a league is skipped when the latest snapshot already
 * carries the manifest's `pulledAt`. Pure I/O seams (fetchImpl, clock)
 * injectable for tests.
 */
import { latestSnapshotAsOf, listSnapshots, saveSnapshot } from '$lib/data/snapshots';
import type { DraftRecord } from '$lib/data/types';

export const CORPUS_MANIFEST_URL = '/corpus/index.json';
export const CORPUS_SOURCE = 'leaguepedia';
export const CORPUS_KIND = 'draft-records' as const;

export interface CorpusManifestEntry {
    file: string;
    league: string;
    records: number;
    from: string | null;
    to: string | null;
    pulledAt: string | null;
}

export interface CorpusManifest {
    attribution: string;
    files: CorpusManifestEntry[];
}

export interface CorpusLeagueStatus {
    league: string;
    records: number;
    /** Manifest pull timestamp carried by the snapshot (provenance). */
    pulledAt: string;
    snapshotId: string;
}

export interface ImportReport {
    imported: CorpusLeagueStatus[];
    skipped: string[];
    warnings: string[];
}

export interface CorpusStoreOptions {
    fetchImpl?: typeof fetch;
    /** Injected clock for snapshot timestamps when the manifest has none. */
    now?: () => string;
    baseUrl?: string;
}

export async function fetchCorpusManifest(options: CorpusStoreOptions = {}): Promise<CorpusManifest> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const res = await fetchImpl(options.baseUrl ?? CORPUS_MANIFEST_URL);
    if (!res.ok) throw new Error(`corpus manifest: HTTP ${res.status}`);
    return (await res.json()) as CorpusManifest;
}

/** Latest imported snapshot per league (newest fetchedAt wins). */
export async function corpusStatus(): Promise<CorpusLeagueStatus[]> {
    const metas = await listSnapshots({ source: CORPUS_SOURCE, kind: CORPUS_KIND });
    const byLeague = new Map<string, CorpusLeagueStatus>();
    for (const meta of metas) {
        const league = meta.label ?? '?';
        if (!byLeague.has(league)) {
            byLeague.set(league, {
                league,
                records: meta.count ?? 0,
                pulledAt: meta.fetchedAt,
                snapshotId: meta.id
            });
        }
    }
    return [...byLeague.values()].sort((a, b) => a.league.localeCompare(b.league));
}

/**
 * Import every bundled league corpus that is missing or newer than the local
 * snapshot. Returns what was imported/skipped — failures degrade to warnings
 * (a broken file must not block the other leagues).
 */
export async function importBundledCorpora(options: CorpusStoreOptions = {}): Promise<ImportReport> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const nowIso = options.now ?? (() => new Date().toISOString());
    const report: ImportReport = { imported: [], skipped: [], warnings: [] };

    let manifest: CorpusManifest;
    try {
        manifest = await fetchCorpusManifest(options);
    } catch (error) {
        report.warnings.push(`Manifeste corpus illisible : ${error instanceof Error ? error.message : String(error)}`);
        return report;
    }

    const existing = new Map((await corpusStatus()).map((s) => [s.league, s]));
    for (const entry of manifest.files) {
        const pulledAt = entry.pulledAt ?? nowIso();
        const current = existing.get(entry.league);
        if (current !== undefined && current.pulledAt === pulledAt) {
            report.skipped.push(entry.league);
            continue;
        }
        try {
            const res = await fetchImpl(`/corpus/${entry.file}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const records = (await res.json()) as DraftRecord[];
            const snapshot = await saveSnapshot({
                source: CORPUS_SOURCE,
                kind: CORPUS_KIND,
                label: entry.league,
                payload: records,
                fetchedAt: pulledAt
            });
            report.imported.push({
                league: entry.league,
                records: records.length,
                pulledAt,
                snapshotId: snapshot.id
            });
        } catch (error) {
            report.warnings.push(
                `Corpus ${entry.league} : import échoué (${error instanceof Error ? error.message : String(error)}).`
            );
        }
    }
    return report;
}

/** Records of the latest snapshot for a league, or null when not imported. */
export async function loadCorpusRecords(league: string): Promise<DraftRecord[] | null> {
    const snapshot = await latestSnapshotAsOf<DraftRecord[]>({
        source: CORPUS_SOURCE,
        kind: CORPUS_KIND,
        label: league
    });
    return snapshot?.payload ?? null;
}

/**
 * Every imported league corpus merged — the fitting set for cross-league
 * estimators (tag-pair cells). Leagues are disjoint by construction (one
 * snapshot per league id), so no dedup is needed.
 */
export async function loadAllCorpusRecords(): Promise<DraftRecord[]> {
    const statuses = await corpusStatus();
    const all: DraftRecord[] = [];
    for (const status of statuses) {
        const records = await loadCorpusRecords(status.league);
        if (records !== null) all.push(...records);
    }
    return all;
}
