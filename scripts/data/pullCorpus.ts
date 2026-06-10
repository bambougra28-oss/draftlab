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
 * Run: node --experimental-strip-types --no-warnings scripts/data/pullCorpus.ts \
 *        --like "LCK/2026%" [--like "LFL/2026%"] --out data/corpus/lck-2026.json
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
const { MwSession, fetchDraftRecords, LEAGUEPEDIA_ATTRIBUTION } = (await import(
    `${libRootHref}/data/providers/leaguepediaCargo.ts`
)) as CargoModule;

// ---- argv -------------------------------------------------------------------

const likes: string[] = [];
let outPath: string | undefined;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--like') likes.push(argv[++i]);
    else if (argv[i] === '--out') outPath = argv[++i];
}
if (likes.length === 0 || outPath === undefined) {
    console.error('Usage: pnpm corpus -- --like "LCK/2026%" [--like ...] --out data/corpus/<name>.json');
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

const all: DraftRecord[] = [];
for (const like of likes) {
    const safe = like.replace(/'/g, "\\'");
    let records: DraftRecord[] | undefined;
    for (let attempt = 1; attempt <= 5 && records === undefined; attempt++) {
        try {
            records = await fetchDraftRecords(
                { where: `SG.OverviewPage LIKE '${safe}'`, orderBy: 'SG.DateTime_UTC ASC' },
                { transport: session.transport, pageDelayMs: 2500 }
            );
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

// ---- write ------------------------------------------------------------------

const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, JSON.stringify(corpus, null, 1), 'utf8');
console.log(`\nÉcrit : ${absOut}`);
console.log(LEAGUEPEDIA_ATTRIBUTION);
