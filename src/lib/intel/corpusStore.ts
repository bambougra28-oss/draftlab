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
import { parseOraclesElixirCsv } from '$lib/data/providers/oraclesElixir';

export const CORPUS_MANIFEST_URL = '/corpus/index.json';
export const CORPUS_SOURCE = 'leaguepedia';
/** User-imported Oracle's Elixir corpus — PREFERRED over the bundled leaguepedia
 *  corpus per league (cleaner, broader, current; the user supplies the CSV). */
export const OE_SOURCE = 'oracles-elixir';
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
    /** Which corpus won for this league: OE_SOURCE or CORPUS_SOURCE. */
    source: string;
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
    /** SvelteKit `paths.base` (''=root). Prefixes the bundled `/corpus/*` URLs
     *  so the store works under a project subpath (GitHub Pages /draftlab). */
    basePath?: string;
}

export async function fetchCorpusManifest(options: CorpusStoreOptions = {}): Promise<CorpusManifest> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const res = await fetchImpl(options.baseUrl ?? `${options.basePath ?? ''}${CORPUS_MANIFEST_URL}`);
    if (!res.ok) throw new Error(`corpus manifest: HTTP ${res.status}`);
    return (await res.json()) as CorpusManifest;
}

/**
 * Latest imported snapshot per league. Oracle's Elixir snapshots take
 * precedence over bundled leaguepedia ones (imported first, "first wins"); a
 * league only the bundle has still shows. `source` carries which won.
 */
export async function corpusStatus(): Promise<CorpusLeagueStatus[]> {
    const byLeague = new Map<string, CorpusLeagueStatus>();
    for (const source of [OE_SOURCE, CORPUS_SOURCE]) {
        const metas = await listSnapshots({ source, kind: CORPUS_KIND });
        for (const meta of metas) {
            const league = meta.label ?? '?';
            if (!byLeague.has(league)) {
                byLeague.set(league, {
                    league,
                    records: meta.count ?? 0,
                    pulledAt: meta.fetchedAt,
                    snapshotId: meta.id,
                    source
                });
            }
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

    // Idempotency keyed on the LEAGUEPEDIA snapshots only (decoupled from any
    // imported OE snapshots, which must not force bundled re-imports).
    const lpMetas = await listSnapshots({ source: CORPUS_SOURCE, kind: CORPUS_KIND });
    const existing = new Map<string, string>();
    for (const meta of lpMetas) {
        const lg = meta.label ?? '?';
        if (!existing.has(lg)) existing.set(lg, meta.fetchedAt);
    }
    for (const entry of manifest.files) {
        const pulledAt = entry.pulledAt ?? nowIso();
        if (existing.get(entry.league) === pulledAt) {
            report.skipped.push(entry.league);
            continue;
        }
        try {
            const res = await fetchImpl(`${options.basePath ?? ''}/corpus/${entry.file}`);
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
                snapshotId: snapshot.id,
                source: CORPUS_SOURCE
            });
        } catch (error) {
            report.warnings.push(
                `Corpus ${entry.league} : import échoué (${error instanceof Error ? error.message : String(error)}).`
            );
        }
    }
    return report;
}

/**
 * Records of the latest snapshot for a league, or null when not imported.
 * Prefers the user-imported Oracle's Elixir corpus, falling back to the bundled
 * leaguepedia one — so every intel read uses the best data the user has.
 */
export async function loadCorpusRecords(league: string): Promise<DraftRecord[] | null> {
    const oe = await latestSnapshotAsOf<DraftRecord[]>({
        source: OE_SOURCE,
        kind: CORPUS_KIND,
        label: league
    });
    if (oe) return oe.payload;
    const lp = await latestSnapshotAsOf<DraftRecord[]>({
        source: CORPUS_SOURCE,
        kind: CORPUS_KIND,
        label: league
    });
    return lp?.payload ?? null;
}

/**
 * Import a user-supplied Oracle's Elixir CSV (the yearly esports dump) as the
 * pro corpus — one immutable snapshot per league, PREFERRED over the bundle.
 * The raw CSV never leaves the browser (not redistributable; the user brings
 * their own download from oracleselixir.com). Per-league failures degrade to
 * warnings. Attribution: see ORACLES_ELIXIR_ATTRIBUTION.
 */
export async function importOracleElixirCorpus(
    csvText: string,
    options: { now?: () => string } = {}
): Promise<ImportReport> {
    const fetchedAt = (options.now ?? (() => new Date().toISOString()))();
    const report: ImportReport = { imported: [], skipped: [], warnings: [] };

    let records: DraftRecord[];
    let skippedGames: string[];
    try {
        ({ records, skipped: skippedGames } = parseOraclesElixirCsv(csvText, fetchedAt));
    } catch (error) {
        report.warnings.push(
            `CSV Oracle's Elixir illisible : ${error instanceof Error ? error.message : String(error)}`
        );
        return report;
    }
    if (records.length === 0) {
        report.warnings.push('Aucun game lisible dans le CSV (en-tête Oracle’s Elixir attendu).');
        return report;
    }
    if (skippedGames.length > 0) {
        report.warnings.push(`${skippedGames.length} game(s) sans deux lignes d'équipe ignorée(s).`);
    }

    // Label by LOWERCASE league so OE's 'LCK' aligns with the bundle's 'lck'
    // (and the app's league ids) — the majors then supersede transparently.
    const byLeague = new Map<string, DraftRecord[]>();
    for (const record of records) {
        const league = (record.league ?? '?').toLowerCase();
        const bucket = byLeague.get(league);
        if (bucket) bucket.push(record);
        else byLeague.set(league, [record]);
    }

    for (const [league, leagueRecords] of byLeague) {
        try {
            const snapshot = await saveSnapshot({
                source: OE_SOURCE,
                kind: CORPUS_KIND,
                label: league,
                payload: leagueRecords,
                fetchedAt
            });
            report.imported.push({
                league,
                records: leagueRecords.length,
                pulledAt: fetchedAt,
                snapshotId: snapshot.id,
                source: OE_SOURCE
            });
        } catch (error) {
            report.warnings.push(
                `Ligue ${league} : snapshot échoué (${error instanceof Error ? error.message : String(error)}).`
            );
        }
    }
    report.imported.sort((a, b) => a.league.localeCompare(b.league));
    return report;
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
