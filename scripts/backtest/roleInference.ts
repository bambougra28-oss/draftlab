/**
 * Validation — enemy role inference (I2 hypotheses over corpus role priors).
 *
 * PRE-REGISTERED RULE (fixed 2026-06-10 before any result was read): for
 * every corpus game and side whose five picks are role-complete, fit the
 * LEAGUE role priors walk-forward (records of patches strictly before the
 * game's patch, same corpus; first-patch and no-patch games are skipped),
 * build the I2 hypothesis distribution over the side's first k picks (by
 * seq) for k ∈ {3, 5}, take the TOP hypothesis, and score the fraction of
 * those k champions placed on their actual role. Unknown champions take the
 * uniform fallback of the live feature (readEnemyRoles doctrine). Published
 * vs two baselines on the same games:
 *   - random injective assignment (expected accuracy 1/5);
 *   - independent per-champion argmax of the same priors (no injectivity —
 *     the naive read the joint enumeration must beat).
 * The LIVE feature layers team priors over league priors; this validation
 * measures the league backbone (the dominant fallback path) — stated here
 * so nobody mistakes it for a per-team accuracy claim.
 *
 * Run: node --experimental-transform-types --no-warnings scripts/backtest/roleInference.ts \
 *        static/corpus/lck-2026.json [...] [--out docs/calibration/role-inference-2026.md]
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

type FogModule = typeof import('../../src/lib/strategic/fogReveal');
type RolePriorsModule = typeof import('../../src/lib/aggregates/rolePriors');
type WalkforwardModule = typeof import('../../src/lib/backtest/walkforward');
type MetricsModule = typeof import('../../src/lib/backtest/metrics');
type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type Role = import('../../src/lib/types').Role;

const { roleAssignmentHypotheses } = (await import(`${libRootHref}/strategic/fogReveal.ts`)) as FogModule;
const { fitRolePriors, rolePriorsOf } = (await import(`${libRootHref}/aggregates/rolePriors.ts`)) as RolePriorsModule;
const { comparePatches, parsePatch } = (await import(`${libRootHref}/backtest/walkforward.ts`)) as WalkforwardModule;
const { wilson95 } = (await import(`${libRootHref}/backtest/metrics.ts`)) as MetricsModule;

// ---- argv -------------------------------------------------------------------

const inputs: string[] = [];
let outPath = 'docs/calibration/role-inference-2026.md';
let generatedAt = new Date().toISOString();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') outPath = argv[++i];
    else if (argv[i] === '--generated-at') generatedAt = argv[++i];
    else inputs.push(argv[i]);
}
if (inputs.length === 0) {
    console.error('Usage: node scripts/backtest/roleInference.ts <corpus.json> [...] [--out md]');
    process.exit(1);
}

// ---- scoring ----------------------------------------------------------------

type Track = 'top-hypothesis' | 'argmax-indep';

interface Tally {
    hits: number;
    n: number;
}

const tallies = new Map<string, Tally>(); // `${corpus}|${track}|k${k}`
const bump = (corpus: string, track: Track, k: number, hit: boolean): void => {
    const key = `${corpus}|${track}|k${k}`;
    const tally = tallies.get(key) ?? { hits: 0, n: 0 };
    tally.n++;
    if (hit) tally.hits++;
    tallies.set(key, tally);
};

const UNIFORM: Partial<Record<Role, number>> = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 };

let skippedNoFold = 0;
for (const input of inputs) {
    const records = JSON.parse(readFileSync(resolve(repoRoot, input), 'utf8')) as DraftRecord[];
    const priorsByPatch = new Map<string, ReturnType<RolePriorsModule['fitRolePriors']>>();
    const foldFor = (patch: string | undefined) => {
        if (patch === undefined || parsePatch(patch) === undefined) return undefined;
        let fold = priorsByPatch.get(patch);
        if (fold === undefined) {
            fold = fitRolePriors(
                records.filter(
                    (r) =>
                        r.patch !== undefined &&
                        parsePatch(r.patch) !== undefined &&
                        comparePatches(r.patch, patch) < 0
                )
            );
            priorsByPatch.set(patch, fold);
        }
        return fold;
    };

    for (const record of records) {
        const fold = foldFor(record.patch);
        if (fold === undefined || fold.picks === 0) {
            skippedNoFold++;
            continue;
        }
        const leaguePriors = rolePriorsOf(fold);
        const safePriors = (championKey: string): Partial<Record<Role, number>> => {
            const weights = leaguePriors(championKey);
            for (const value of Object.values(weights)) if ((value ?? 0) > 0) return weights;
            return UNIFORM;
        };

        for (const side of ['blue', 'red'] as const) {
            const picks = record.actions
                .filter((a) => a.type === 'pick' && a.side === side && a.championKey !== '' && a.role !== undefined)
                .sort((a, b) => a.seq - b.seq);
            if (picks.length !== 5) continue;

            for (const k of [3, 5]) {
                const revealed = picks.slice(0, k);
                const keys = revealed.map((p) => p.championKey);
                const hypotheses = roleAssignmentHypotheses(keys, safePriors);
                const top = hypotheses[0];
                const predicted = new Map<string, Role>();
                if (top !== undefined) {
                    for (const [role, key] of top.assignment) predicted.set(key, role);
                }
                for (const pick of revealed) {
                    bump(input, 'top-hypothesis', k, predicted.get(pick.championKey) === pick.role);
                    // Independent argmax baseline (no injectivity constraint).
                    const weights = safePriors(pick.championKey);
                    let best: Role | undefined;
                    let bestWeight = 0;
                    for (const role of [0, 1, 2, 3, 4] as Role[]) {
                        const weight = weights[role] ?? 0;
                        if (weight > bestWeight) {
                            bestWeight = weight;
                            best = role;
                        }
                    }
                    bump(input, 'argmax-indep', k, best === pick.role);
                }
            }
        }
    }
}

// ---- report -----------------------------------------------------------------

function line(label: string, tally: Tally | undefined): string {
    if (tally === undefined || tally.n === 0) return `| ${label} | 0 | — | — |`;
    const rate = tally.hits / tally.n;
    const ci = wilson95(tally.hits, tally.n);
    return `| ${label} | ${tally.n} | ${(100 * rate).toFixed(1)} % | [${(100 * ci.lo).toFixed(1)} ; ${(100 * ci.hi).toFixed(1)}] % |`;
}

function pooled(track: Track, k: number): Tally {
    const total: Tally = { hits: 0, n: 0 };
    for (const input of inputs) {
        const tally = tallies.get(`${input}|${track}|k${k}`);
        if (tally) {
            total.hits += tally.hits;
            total.n += tally.n;
        }
    }
    return total;
}

const rows: string[] = [
    '# Validation — inférence des rôles adverses (I2 + priors corpus)',
    '',
    `> Généré : ${generatedAt} · règle pré-enregistrée dans \`scripts/backtest/roleInference.ts\``,
    '> (walk-forward par patch, priors ligue, top-hypothèse jointe vs argmax indépendant vs 20 % aléatoire).',
    ''
];
for (const k of [3, 5]) {
    rows.push(`## k = ${k} picks révélés`, '', '| Tranche | n champions | Accuracy | Wilson 95 % |', '|---|---|---|---|');
    rows.push(line(`TOUS — top-hypothèse jointe`, pooled('top-hypothesis', k)));
    rows.push(line(`TOUS — argmax indépendant (baseline)`, pooled('argmax-indep', k)));
    rows.push(`| TOUS — assignation aléatoire (baseline) | — | 20.0 % | — |`);
    for (const input of inputs) {
        rows.push(line(`${basename(input)} — top-hypothèse`, tallies.get(`${input}|top-hypothesis|k${k}`)));
    }
    rows.push('');
}
rows.push(
    `Couverture : games sans fold (premier patch / patch illisible) ignorées : ${skippedNoFold}.`,
    '',
    '> La top-hypothèse doit battre l\'argmax indépendant pour justifier l\'énumération',
    '> jointe (sinon la contrainte d\'injectivité n\'apporte rien) — et les deux doivent',
    '> écraser le 20 % aléatoire pour que la lecture des rôles soit montrable.'
);

const markdown = rows.join('\n') + '\n';
const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, markdown, 'utf8');
console.log(markdown);
console.log(`Écrit : ${absOut}`);
