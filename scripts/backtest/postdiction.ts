/**
 * G1 — Win-condition postdiction against real game lengths (gate of §8 R3).
 *
 * PRE-REGISTERED RULE (fixed before looking at results; no post-hoc knobs):
 * for every corpus game with a winner, a game length and ten role-complete
 * picks, run `analyzeWinConditions(blueComp, redComp)` (tags only) and keep
 * the statements with `falsifiableVia: 'gameLength'` and direction
 * 'early' | 'late' — each asserts which time window favors BLUE. The
 * postdiction: if blue won, the game should sit in blue's preferred bucket
 * (early ⇒ strictly below the median length of the scored set, late ⇒
 * strictly above); if red won, the opposite bucket. Median computed on the
 * scored games of the SAME corpus; games exactly at the median are excluded.
 * Published: hit rate vs the 0.5 chance baseline with a Wilson 95% interval,
 * pooled and per direction. A statement family that cannot beat chance here
 * goes back to the config bench (DA-V2-6), it does not ship as a claim.
 *
 * PRO-CURVE TRACK (pre-registered 2026-06-10, before any result was read):
 * same eligibility, same median, same hit rule — the statements are simply
 * regenerated with `analyzeWinConditions(blue, red, { dataset })` where the
 * dataset is `fitProPowerCurves` (defaults 12/50, set before scoring) fitted
 * WALK-FORWARD on the SAME corpus: for a game on patch k, training = records
 * of patches strictly before k (leak-proof; first-patch games and games
 * without a patch fall back to tags-only statements by construction). This
 * measures STEP_UP #15 end to end: do observed pro power curves give the
 * scaling axis a falsifiable game-length signal that tags alone do not?
 *
 * Run: node --experimental-transform-types --no-warnings scripts/backtest/postdiction.ts \
 *        static/corpus/lck-2026.json static/corpus/lfl-2026.json static/corpus/lec-2026.json \
 *        [--generated-at ISO] [--out docs/calibration/postdiction-2026.md]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { basename, dirname, resolve } from 'node:path';
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

type WinConditionsModule = typeof import('../../src/lib/strategic/winConditionGraph');
type MetricsModule = typeof import('../../src/lib/backtest/metrics');
type WalkforwardModule = typeof import('../../src/lib/backtest/walkforward');
type ProCurvesModule = typeof import('../../src/lib/estimators/proPowerCurves');
type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type Dataset = import('../../src/lib/types').Dataset;

const { analyzeWinConditions } = (await import(
    `${libRootHref}/strategic/winConditionGraph.ts`
)) as WinConditionsModule;
const { wilson95 } = (await import(`${libRootHref}/backtest/metrics.ts`)) as MetricsModule;
const { comparePatches, parsePatch } = (await import(
    `${libRootHref}/backtest/walkforward.ts`
)) as WalkforwardModule;
const { fitProPowerCurves } = (await import(
    `${libRootHref}/estimators/proPowerCurves.ts`
)) as ProCurvesModule;

// ---- argv -------------------------------------------------------------------

const inputs: string[] = [];
let outPath = 'docs/calibration/postdiction-2026.md';
let generatedAt = new Date().toISOString();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') outPath = argv[++i];
    else if (argv[i] === '--generated-at') generatedAt = argv[++i];
    else inputs.push(argv[i]);
}
if (inputs.length === 0) {
    console.error('Usage: node scripts/backtest/postdiction.ts <corpus.json> [...] [--out md] [--generated-at ISO]');
    process.exit(1);
}

// ---- scoring ----------------------------------------------------------------

type Track = 'tags' | 'curves';

interface ScoredStatement {
    corpus: string;
    track: Track;
    direction: 'early' | 'late';
    hit: boolean;
}

interface CorpusStats {
    corpus: string;
    records: number;
    eligible: number;
    withStatement: number;
    medianSeconds: number;
    scored: ScoredStatement[];
    /** Curves track: games whose scaling axis actually consumed a curve. */
    curveActive: number;
}

/** Role-ordered comp [Top..Support] from a side's picks; undefined if incomplete. */
function compOf(record: DraftRecord, side: 'blue' | 'red'): string[] | undefined {
    const byRole = new Map<number, string>();
    for (const action of record.actions) {
        if (action.type !== 'pick' || action.side !== side) continue;
        if (action.championKey === '' || action.role === undefined) return undefined;
        if (byRole.has(action.role)) return undefined;
        byRole.set(action.role, action.championKey);
    }
    if (byRole.size !== 5) return undefined;
    return [0, 1, 2, 3, 4].map((role) => byRole.get(role)!);
}

const allStats: CorpusStats[] = [];

for (const input of inputs) {
    const records = JSON.parse(readFileSync(resolve(repoRoot, input), 'utf8')) as DraftRecord[];
    interface Eligible {
        record: DraftRecord;
        blue: string[];
        red: string[];
    }
    const eligible: Eligible[] = [];
    for (const record of records) {
        if (record.winner === undefined || record.gameLengthSeconds === undefined) continue;
        const blue = compOf(record, 'blue');
        const red = compOf(record, 'red');
        if (blue === undefined || red === undefined) continue;
        eligible.push({ record, blue, red });
    }

    const lengths = eligible.map((e) => e.record.gameLengthSeconds!).sort((a, b) => a - b);
    const medianSeconds =
        lengths.length % 2 === 1
            ? lengths[(lengths.length - 1) / 2]
            : (lengths[lengths.length / 2 - 1] + lengths[lengths.length / 2]) / 2;

    // Walk-forward pro-curve folds: one dataset per distinct scored patch,
    // fitted on the SAME corpus's records of strictly earlier patches.
    const foldByPatch = new Map<string, Dataset>();
    const foldFor = (patch: string | undefined): Dataset => {
        if (patch === undefined || parsePatch(patch) === undefined) {
            return { version: 'pro-corpus', date: 'walk-forward', championData: {} };
        }
        let fold = foldByPatch.get(patch);
        if (fold === undefined) {
            const training = records.filter(
                (r) =>
                    r.patch !== undefined &&
                    parsePatch(r.patch) !== undefined &&
                    comparePatches(r.patch, patch) < 0
            );
            fold = fitProPowerCurves(training);
            foldByPatch.set(patch, fold);
        }
        return fold;
    };

    const gameLengthStatements = (report: ReturnType<typeof analyzeWinConditions>) =>
        report.statements.filter(
            (s): s is (typeof report.statements)[number] & { direction: 'early' | 'late' } =>
                s.falsifiableVia === 'gameLength' && (s.direction === 'early' || s.direction === 'late')
        );

    const scored: ScoredStatement[] = [];
    let withStatement = 0;
    let curveActive = 0;
    for (const { record, blue, red } of eligible) {
        const length = record.gameLengthSeconds!;
        if (length === medianSeconds) continue; // pre-registered: median ties excluded
        const isShort = length < medianSeconds;
        const score = (track: Track, statements: ReturnType<typeof gameLengthStatements>): void => {
            for (const statement of statements) {
                // Blue's preferred bucket; red winning flips the expectation.
                const blueWantsShort = statement.direction === 'early';
                const expectShort = record.winner === 'blue' ? blueWantsShort : !blueWantsShort;
                scored.push({ corpus: input, track, direction: statement.direction, hit: expectShort === isShort });
            }
        };

        const tagReport = analyzeWinConditions(blue, red);
        const tagStatements = gameLengthStatements(tagReport);
        if (tagStatements.length > 0) withStatement++;
        score('tags', tagStatements);

        const curveReport = analyzeWinConditions(blue, red, { dataset: foldFor(record.patch) });
        const scalingAxis = curveReport.axes.find((a) => a.id === 'scaling-differential');
        if (scalingAxis !== undefined && scalingAxis.components.length === 3) curveActive++;
        score('curves', gameLengthStatements(curveReport));
    }

    allStats.push({
        corpus: input,
        records: records.length,
        eligible: eligible.length,
        withStatement,
        medianSeconds,
        scored,
        curveActive
    });
}

// ---- report -----------------------------------------------------------------

function line(label: string, scored: ScoredStatement[]): string {
    const n = scored.length;
    if (n === 0) return `| ${label} | 0 | — | — | — |`;
    const hits = scored.filter((s) => s.hit).length;
    const rate = hits / n;
    const ci = wilson95(hits, n);
    const beats = ci.lo > 0.5 ? 'bat le hasard' : ci.hi < 0.5 ? 'sous le hasard' : 'non significatif';
    return `| ${label} | ${n} | ${(100 * rate).toFixed(1)} % | [${(100 * ci.lo).toFixed(1)} ; ${(100 * ci.hi).toFixed(1)}] % | ${beats} |`;
}

const trackRows = (track: Track): string[] => {
    const pooled = allStats.flatMap((s) => s.scored.filter((x) => x.track === track));
    const rows = [
        '| Tranche | n statements | Taux de réussite | Wilson 95 % | Verdict vs hasard |',
        '|---|---|---|---|---|',
        line('TOUS corpus', pooled),
        line('— direction early', pooled.filter((s) => s.direction === 'early')),
        line('— direction late', pooled.filter((s) => s.direction === 'late'))
    ];
    for (const stats of allStats) {
        rows.push(line(basename(stats.corpus), stats.scored.filter((x) => x.track === track)));
    }
    return rows;
};

const rows: string[] = [
    '# Postdiction G1 — win conditions vs durée réelle des games',
    '',
    `> Généré : ${generatedAt} · règles pré-enregistrées dans \`scripts/backtest/postdiction.ts\``,
    '> (statements `gameLength` early/late du graphe I3, médiane par corpus, baseline 50 %).',
    '',
    '## Piste 1 — tags seuls (règle originale)',
    '',
    ...trackRows('tags'),
    '',
    '## Piste 2 — courbes de puissance PRO, walk-forward par patch (STEP_UP #15)',
    '',
    '> Mêmes éligibilité, médiane et règle de hit ; statements régénérés avec',
    '> `fitProPowerCurves` (priors 12/50 fixés avant scoring) entraîné sur les',
    '> patchs strictement antérieurs du même corpus. Premier patch et patchs',
    '> absents ⇒ repli tags (mesure du SYSTÈME, pas du sous-ensemble facile).',
    '',
    ...trackRows('curves')
];
rows.push('', '## Couverture', '');
for (const stats of allStats) {
    const tagScored = stats.scored.filter((x) => x.track === 'tags').length;
    const curveScored = stats.scored.filter((x) => x.track === 'curves').length;
    rows.push(
        `- ${basename(stats.corpus)} : ${stats.records} records → ${stats.eligible} éligibles ` +
            `(vainqueur + durée + 10 picks rôle-complets) → ${stats.withStatement} avec ≥ 1 statement ` +
            `gameLength (tags) → ${tagScored} statements scorés piste 1, ${curveScored} piste 2 ` +
            `(${stats.curveActive} games avec courbe active) ; médiane ${(stats.medianSeconds / 60).toFixed(1)} min.`
    );
}
rows.push(
    '',
    '> Lecture honnête : un taux ≈ 50 % signifie que la famille de statements ne porte',
    '> pas (encore) de signal falsifiable — retour au banc de calibration (DA-V2-6),',
    '> pas de claim produit. La porte G1 exige de battre le hasard avec IC.'
);

const markdown = rows.join('\n') + '\n';
const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, markdown, 'utf8');
console.log(markdown);
console.log(`Écrit : ${absOut}`);
