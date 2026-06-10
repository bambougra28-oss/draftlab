/**
 * R3/R9 — Corpus scorecard runner (CLI composition root).
 *
 * Reads a JSON file of normalized DraftRecord[] (argv), calls the pure
 * library `src/lib/backtest/corpusRunner.ts` with the seed/timestamp from
 * argv, and writes the versioned card to `docs/calibration/scorecard-<patch>.md`.
 * All scoring logic lives in the library (tested under Vitest); this script
 * only owns I/O and the default clock/seed.
 *
 * Run: pnpm backtest -- <records.json> [--seed N] [--generated-at ISO] [--patch X]
 *   --seed          bootstrap seed (default 1) — CIs replay from it
 *   --generated-at  injected timestamp (default: now — the CLI is the only
 *                   place allowed to read the clock)
 *   --patch         card label + file suffix (default: last corpus patch)
 *
 * Runs under `node --experimental-transform-types` (the import graph reaches
 * the Role enum and TS class fields once the banEV/range engines are in).
 * Plain node cannot resolve the SvelteKit-only `$lib/...` alias used inside
 * src/lib, so a synchronous module hook (node:module `registerHooks`,
 * Node ≥ 22.15) rewrites `$lib/*`, retries extensionless/directory imports
 * and serves JSON modules — registered BEFORE the library is imported.
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
        // src/lib uses bundler-style specifiers: '$lib/x' aliases, extensionless
        // relative imports ('./metrics') and directory modules ('$lib/types' →
        // types/index.ts) — try each candidate in order.
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

// Imported AFTER the hook is live (a static import would resolve too early).
type CorpusRunnerModule = typeof import('../../src/lib/backtest/corpusRunner');
type DraftRecord = import('../../src/lib/data/types').DraftRecord;
const { runCorpusScorecard } = (await import(
    `${libRootHref}/backtest/corpusRunner.ts`
)) as CorpusRunnerModule;

// ---- argv ------------------------------------------------------------------

interface CliArgs {
    recordsPath: string;
    seed: number;
    generatedAt: string;
    patch?: string;
}

function parseArgs(argv: string[]): CliArgs | undefined {
    let recordsPath: string | undefined;
    let seed = 1;
    let generatedAt = new Date().toISOString();
    let patch: string | undefined;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--seed') seed = Number(argv[++i]);
        else if (arg === '--generated-at') generatedAt = argv[++i];
        else if (arg === '--patch') patch = argv[++i];
        else if (recordsPath === undefined) recordsPath = arg;
        else return undefined;
    }
    if (recordsPath === undefined || Number.isNaN(seed) || generatedAt === undefined) return undefined;
    const args: CliArgs = { recordsPath, seed, generatedAt };
    if (patch !== undefined) args.patch = patch;
    return args;
}

const args = parseArgs(process.argv.slice(2));
if (args === undefined) {
    console.error('Usage: pnpm backtest -- <records.json> [--seed N] [--generated-at ISO] [--patch X]');
    process.exit(1);
}

// ---- run --------------------------------------------------------------------

const parsed: unknown = JSON.parse(readFileSync(resolve(repoRoot, args.recordsPath), 'utf8'));
if (!Array.isArray(parsed)) {
    console.error(`${args.recordsPath}: expected a JSON array of DraftRecord`);
    process.exit(1);
}
const records = parsed as DraftRecord[];

const runnerOptions: Parameters<CorpusRunnerModule['runCorpusScorecard']>[1] = {
    seed: args.seed,
    generatedAt: args.generatedAt
};
if (args.patch !== undefined) runnerOptions.patch = args.patch;
const { markdown, results } = runCorpusScorecard(records, runnerOptions);

// Patch labels are file-name material — neutralize separators defensively.
const fileSafePatch = results.patch.replace(/[^A-Za-z0-9._-]/g, '_');
const outDir = resolve(repoRoot, 'docs', 'calibration');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `scorecard-${fileSafePatch}.md`);
writeFileSync(outPath, markdown, 'utf8');

console.log(`Scorecard patch ${results.patch} — seed ${results.seed}, ${results.usableRecords}/${results.records} records exploitables (${results.droppedNoPatch} sans patch).`);
console.log(`  issue de partie : n=${results.outcome.n}, pick-in-range@8 : n=${results.pickInRange.n}, ban-hit@5 : n=${results.banHit.n}`);
for (const entry of results.entries) {
    console.log(`  ${entry.metric}: ${entry.value.toFixed(4)} vs ${entry.baseline.toFixed(4)} (${entry.verdict})`);
}
console.log(`Écrit : ${outPath}`);
