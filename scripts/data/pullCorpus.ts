/**
 * R1 acceptance — Leaguepedia corpus puller (CLI composition root).
 *
 * Logs in with the bot password (env DRAFTLAB_LP_USER / DRAFTLAB_LP_PASS),
 * pulls every draft whose ScoreboardGames.OverviewPage matches the given
 * LIKE patterns, normalizes through the R1 provider, dedupes by gameId and
 * writes a DraftRecord[] JSON plus a data-quality report to stdout
 * (distinct pages, patches, unresolved champion names — new releases missing
 * from the tag file show up here first).
 *
 * Run: node --experimental-transform-types --no-warnings scripts/data/pullCorpus.ts \
 *        --like "LCK/2026%" [--like "LFL/2026%"] --out static/corpus/lck-2026.json \
 *        [--fresh-days 3]
 *      (= pnpm corpus ; transform-types est requis : la chaîne d'imports charge
 *      l'enum Role de $lib/types, refusé par strip-only.)
 *
 * Intégrité Bo (chantier G, leçon Nasus — pull du 10 juin 2026) : après
 * construction des records, `validateBoIntegrity` détecte les séquences BoN
 * impossibles (game-after-clinch, decider-winner-mismatch, doublons, gaps,
 * équipes), les imprime en clair et les écrit dans le manifeste
 * (`integrity: { violations, checkedAt }`). Quarantaine fraîcheur : les
 * records datés de moins de --fresh-days jours (défaut 3) sont comptés et
 * signalés (`freshness: { withinDays, count }`) — les saisies wiki fraîches
 * sont les plus exposées aux erreurs humaines. AUCUN abort automatique : le
 * pull aboutit toujours, les violations sont des données pour l'architecte.
 *
 * Same $lib module hook as scripts/backtest/runCorpus.ts (Node >= 22.15).
 * Data: Leaguepedia (lol.fandom.com), CC BY-SA 3.0 — keep the attribution
 * notice next to any committed corpus.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const libRootHref = pathToFileURL(resolve(repoRoot, 'src', 'lib')).href;

registerHooks({
    resolve(specifier, context, nextResolve) {
        const isLib = specifier.startsWith('$lib/');
        const base = isLib ? `${libRootHref}/${specifier.slice('$lib/'.length)}` : specifier;
        const candidates = isLib
            ? [`${base}.ts`, `${base}/index.ts`]
            : base.startsWith('./') || base.startsWith('../')
              ? [base, `${base}.ts`, `${base}/index.ts`]
              : [base];
        let lastError: unknown;
        for (const candidate of candidates) {
            try {
                return nextResolve(candidate, context);
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    },
    // Vite imports .json without attributes; plain node ESM requires
    // `with { type: 'json' }` — serve JSON modules ourselves instead.
    load(url, context, nextLoad) {
        if (url.endsWith('.json')) {
            return {
                format: 'json',
                source: readFileSync(fileURLToPath(url), 'utf8'),
                shortCircuit: true
            };
        }
        return nextLoad(url, context);
    }
});

type CargoModule = typeof import('../../src/lib/data/providers/leaguepediaCargo');
type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type BoIntegrityModule = typeof import('../../src/lib/data/boIntegrity');
type BoViolation = import('../../src/lib/data/boIntegrity').BoViolation;
const { MwSession, fetchDraftRecords, fetchDraftRecordsExport, fetchDraftRecordsSplit, LEAGUEPEDIA_ATTRIBUTION } =
    (await import(`${libRootHref}/data/providers/leaguepediaCargo.ts`)) as CargoModule;
const { validateBoIntegrity, countFreshRecords } = (await import(
    `${libRootHref}/data/boIntegrity.ts`
)) as BoIntegrityModule;

// ---- argv -------------------------------------------------------------------

const likes: string[] = [];
let outPath: string | undefined;
let freshDays = 3;
let splitJoin = false;
let viaExport = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--like') likes.push(argv[++i]);
    else if (argv[i] === '--out') outPath = argv[++i];
    else if (argv[i] === '--fresh-days') freshDays = Number(argv[++i]);
    else if (argv[i] === '--split-join') splitJoin = true;
    else if (argv[i] === '--export') viaExport = true;
}
if (likes.length === 0 || outPath === undefined || !Number.isFinite(freshDays) || freshDays < 0) {
    console.error(
        'Usage: pnpm corpus -- --like "LCK/2026%" [--like ...] --out static/corpus/<name>.json [--fresh-days 3] [--split-join] [--export]'
    );
    process.exit(1);
}

const user = process.env.DRAFTLAB_LP_USER;
const pass = process.env.DRAFTLAB_LP_PASS;
if (!user || !pass) {
    console.error('DRAFTLAB_LP_USER / DRAFTLAB_LP_PASS manquants (bot password Leaguepedia).');
    process.exit(1);
}

// ---- pull -------------------------------------------------------------------

console.log(`Login bot: ${user.split('@')[0]}@…`);
const session = await MwSession.login({ username: user, password: pass });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

if (splitJoin) console.log('Mode split-join : SG seul puis PB par chunks IN — le join serveur throttlé est contourné.');
if (viaExport) console.log('Mode export : Special:CargoExport — chemin de code hors bucket API.');
const all: DraftRecord[] = [];
for (const like of likes) {
    const safe = like.replace(/'/g, "\\'");
    let records: DraftRecord[] | undefined;
    for (let attempt = 1; attempt <= 5 && records === undefined; attempt++) {
        try {
            const query = { where: `SG.OverviewPage LIKE '${safe}'`, orderBy: 'SG.DateTime_UTC ASC' };
            if (viaExport) {
                records = await fetchDraftRecordsExport(query, {
                    transport: session.transport,
                    pageDelayMs: 2500
                });
            } else if (splitJoin) {
                const { records: split, missingDrafts } = await fetchDraftRecordsSplit(query, {
                    transport: session.transport,
                    pageDelayMs: 2500
                });
                records = split;
                if (missingDrafts.length > 0) {
                    console.log(
                        `  ${like} → ${missingDrafts.length} scoreboard(s) sans table de draft (remakes/forfaits/trous amont) :`
                    );
                    for (const gid of missingDrafts) console.log(`      ${gid}`);
                }
            } else {
                records = await fetchDraftRecords(query, { transport: session.transport, pageDelayMs: 2500 });
            }
        } catch (error) {
            if ((error as { code?: string }).code !== 'ratelimited' || attempt === 5) throw error;
            console.log(`  ${like} → rate-limited (tentative ${attempt}/5), pause 75 s…`);
            await sleep(75_000);
        }
    }
    console.log(`  ${like} → ${records!.length} drafts`);
    all.push(...records!);
}

// Dedupe by gameId (patterns can overlap), keep chronological order.
const byId = new Map<string, DraftRecord>();
for (const record of all) byId.set(record.gameId, record);
const corpus = [...byId.values()].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

// ---- data-quality report ----------------------------------------------------

const pages = new Map<string, number>();
const patches = new Map<string, number>();
const unresolved = new Map<string, number>();
let warningCount = 0;
for (const record of corpus) {
    pages.set(record.tournament ?? '?', (pages.get(record.tournament ?? '?') ?? 0) + 1);
    patches.set(record.patch ?? '(absent)', (patches.get(record.patch ?? '(absent)') ?? 0) + 1);
    warningCount += record.warnings.length;
    for (const action of record.actions) {
        if (action.championKey === '') {
            unresolved.set(action.championName, (unresolved.get(action.championName) ?? 0) + 1);
        }
    }
}

console.log(`\nCorpus : ${corpus.length} drafts uniques, ${warningCount} warnings cumulés.`);
console.log('Tournois :');
for (const [page, n] of [...pages.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(4)}  ${page}`);
}
console.log(`Patchs : ${[...patches.keys()].sort().join(', ')}`);
if (unresolved.size > 0) {
    console.log('CHAMPIONS NON RÉSOLUS (tags à compléter) :');
    for (const [name, n] of [...unresolved.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${n.toString().padStart(4)}× ${name}`);
    }
} else {
    console.log('Champions : 100 % résolus vers les clés Data Dragon.');
}

// ---- intégrité Bo + quarantaine fraîcheur (chantier G, leçon Nasus) ----------
// AUCUN abort : le pull aboutit toujours ; les violations sont des données
// pour l'architecte (manifeste + sortie console).

const generatedAt = new Date().toISOString();
const violations = validateBoIntegrity(corpus);
if (violations.length === 0) {
    console.log('\nIntégrité Bo : aucune violation détectée.');
} else {
    console.log(`\nINTÉGRITÉ Bo : ${violations.length} violation(s) détectée(s) — le pull aboutit, à auditer :`);
    for (const violation of violations) {
        console.log(`  [${violation.kind}] série ${violation.matchId} · game ${violation.gameId}`);
        console.log(`      ${violation.detailFr}`);
    }
}
const freshCount = countFreshRecords(corpus, freshDays, Date.parse(generatedAt));
if (freshCount > 0) {
    console.warn(
        `quarantaine fraîcheur : ${freshCount} records saisis il y a moins de ${freshDays} jours ` +
            `— re-pull recommandé avant tout run de gate`
    );
} else {
    console.log(`Fraîcheur : aucun record daté de moins de ${freshDays} jours.`);
}

// ---- write ------------------------------------------------------------------

const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, JSON.stringify(corpus, null, 1), 'utf8');
console.log(`\nÉcrit : ${absOut}`);

// Maintain the app-facing manifest (static/corpus/index.json) so the browser
// import card (corpusStore) sees fresh counts/dates without a rebuild step.
const manifestPath = resolve(dirname(absOut), 'index.json');
interface ManifestEntry {
    file: string;
    league: string;
    records: number;
    from: string | null;
    to: string | null;
    pulledAt: string | null;
    /** Chantier G : violations Bo relevées au pull (checkedAt = generatedAt du pull). */
    integrity?: { violations: BoViolation[]; checkedAt: string };
    /** Chantier G : quarantaine fraîcheur — records datés de moins de withinDays jours. */
    freshness?: { withinDays: number; count: number };
}
let manifest: { attribution: string; files: ManifestEntry[] } = {
    attribution: LEAGUEPEDIA_ATTRIBUTION,
    files: []
};
try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch {
    // first corpus in this directory — start a fresh manifest
}
const fileName = absOut.split(/[\\/]/).pop()!;
const dates = corpus.map((r) => r.date ?? '').filter(Boolean).sort();
const entry: ManifestEntry = {
    file: fileName,
    league: fileName.split('-')[0],
    records: corpus.length,
    from: dates[0]?.slice(0, 10) ?? null,
    to: dates[dates.length - 1]?.slice(0, 10) ?? null,
    pulledAt: corpus[0]?.provenance.fetchedAt ?? null,
    integrity: { violations, checkedAt: generatedAt },
    freshness: { withinDays: freshDays, count: freshCount }
};
manifest.files = [...manifest.files.filter((f) => f.file !== fileName), entry].sort((a, b) =>
    a.file.localeCompare(b.file)
);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1), 'utf8');
console.log(`Manifeste mis à jour : ${manifestPath}`);
console.log(LEAGUEPEDIA_ATTRIBUTION);
