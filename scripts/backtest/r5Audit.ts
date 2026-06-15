/**
 * Run #5 — DATA-FIRST AUDIT (exploratory, NOT a pre-registered gate).
 *
 * Question: at the pro level (Oracle's Elixir 2026), how well does DRAFT CONTENT
 * predict who wins? We measure the AUC of each candidate feature against the
 * binary outcome (blue win), to decide whether a win-probability gate is worth
 * pre-registering — before freezing anything.
 *
 * Data: data/oracle/2026_oe.csv (Oracle's Elixir, local, gitignored, not
 * redistributable — attribution: oracleselixir.com). Parsed by the existing
 * provider `parseOraclesElixirCsv` → DraftRecords → the standard gate machinery
 * (isCalibrationEligible, roleTeamsAt). SoloQ features from the frozen run #2
 * snapshots (current-patch + 30-days). Tags-based features (archetypes) are
 * patch-independent (no anachronism).
 *
 *   node --experimental-transform-types --no-warnings scripts/backtest/r5Audit.ts
 */
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const L = pathToFileURL(resolve(repoRoot, 'src', 'lib')).href;
registerHooks({
    resolve(s, c, n) {
        const lib = s.startsWith('$lib/');
        const b = lib ? `${L}/${s.slice(5)}` : s;
        const cd = lib
            ? [`${b}.ts`, `${b}/index.ts`]
            : b.startsWith('./') || b.startsWith('../')
              ? [b, `${b}.ts`, `${b}/index.ts`]
              : [b];
        let e;
        for (const x of cd) {
            try {
                return n(x, c);
            } catch (y) {
                e = y;
            }
        }
        throw e;
    },
    load(u, c, n) {
        if (u.endsWith('.json'))
            return { format: 'json', source: readFileSync(fileURLToPath(u), 'utf8'), shortCircuit: true };
        return n(u, c);
    }
});

const { parseOraclesElixirCsv } = (await import(`${L}/data/providers/oraclesElixir.ts`)) as typeof import('../../src/lib/data/providers/oraclesElixir');
const { isCalibrationEligible, roleTeamsAt } = (await import(`${L}/backtest/sequencePositions.ts`)) as typeof import('../../src/lib/backtest/sequencePositions');
const { classifyGamePlan } = (await import(`${L}/strategic/gamePlanClassifier.ts`)) as typeof import('../../src/lib/strategic/gamePlanClassifier');
const { analyzeDraft } = (await import(`${L}/engine/analyzer.ts`)) as typeof import('../../src/lib/engine/analyzer');

type Dataset = import('../../src/lib/types').Dataset;
type AnalyzeDraftConfig = import('../../src/lib/types').AnalyzeDraftConfig;

const current = JSON.parse(readFileSync(resolve(repoRoot, 'data/datasets/current-patch.json'), 'utf8')) as Dataset;
const full = JSON.parse(readFileSync(resolve(repoRoot, 'data/datasets/30-days.json'), 'utf8')) as Dataset;
const CFG: AnalyzeDraftConfig = { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 };
const ARCH = ['siege', 'split', 'pick', 'protect', 'engage'] as const;
const TIER1 = new Set(['LCK', 'LPL', 'LEC', 'LCS', 'EWC']);

/** AUC of feature f predicting binary y (Mann–Whitney, tie-aware). */
function auc(f: number[], y: number[]): number {
    const idx = f.map((_, i) => i).sort((a, b) => f[a] - f[b]);
    let sp = 0,
        i = 0;
    const n = f.length;
    while (i < n) {
        let j = i;
        while (j < n && f[idx[j]] === f[idx[i]]) j++;
        const a = (i + j - 1) / 2 + 1;
        for (let k = i; k < j; k++) if (y[idx[k]] === 1) sp += a;
        i = j;
    }
    const n1 = y.reduce((s, v) => s + v, 0),
        n0 = n - n1;
    if (!n1 || !n0) return 0.5;
    return (sp - (n1 * (n1 + 1)) / 2) / (n1 * n0);
}

const csv = readFileSync(resolve(repoRoot, 'data/oracle/2026_oe.csv'), 'utf8');
const { records } = parseOraclesElixirCsv(csv, '2026-06-16T00:00:00Z');

interface Row {
    league: string;
    won: number;
    p: number;
    ch: number;
    mu: number;
    duo: number;
    arch: Record<string, number>;
    bp: string;
    rp: string;
}
const rows: Row[] = [];
for (const r of records) {
    if (!isCalibrationEligible(r)) continue;
    const t = roleTeamsAt(r, 20)!;
    const bk = [...t.blue.values()],
        rk = [...t.red.values()];
    const dr = analyzeDraft(current, t.blue, t.red, CFG, full);
    const gb = classifyGamePlan(bk).distribution,
        gr = classifyGamePlan(rk).distribution;
    const arch: Record<string, number> = {};
    for (const a of ARCH) arch[a] = gb[a] - gr[a];
    rows.push({
        league: r.league ?? '?',
        won: r.winner === 'blue' ? 1 : 0,
        p: dr.winrate,
        ch: dr.allyChampionRating.totalRating - dr.enemyChampionRating.totalRating,
        mu: dr.matchupRating.totalRating,
        duo: dr.allyDuoRating.totalRating - dr.enemyDuoRating.totalRating,
        arch,
        bp: classifyGamePlan(bk).primary,
        rp: classifyGamePlan(rk).primary
    });
}

function report(label: string, set: Row[]): void {
    const y = set.map((r) => r.won);
    const bw = (100 * y.reduce((s, v) => s + v, 0)) / set.length;
    console.log(`\n== ${label} ==  n=${set.length}  blue WR=${bw.toFixed(1)}%`);
    console.log(`  SoloQ winrate        AUC ${auc(set.map((r) => r.p), y).toFixed(4)}`);
    console.log(`  SoloQ champion-diff  AUC ${auc(set.map((r) => r.ch), y).toFixed(4)}`);
    console.log(`  SoloQ matchup-diff   AUC ${auc(set.map((r) => r.mu), y).toFixed(4)}`);
    console.log(`  SoloQ duo-diff       AUC ${auc(set.map((r) => r.duo), y).toFixed(4)}`);
    for (const a of ARCH) console.log(`  archetype Δ ${a.padEnd(8)} AUC ${auc(set.map((r) => r.arch[a]), y).toFixed(4)}`);
    // archetype primary matchup matrix, in-sample (optimistic ceiling).
    const cell = new Map<string, { w: number; n: number }>();
    for (const r of set) {
        const k = `${r.bp}>${r.rp}`;
        const c = cell.get(k) ?? { w: 0, n: 0 };
        c.w += r.won;
        c.n++;
        cell.set(k, c);
    }
    const implied = set.map((r) => {
        const c = cell.get(`${r.bp}>${r.rp}`)!;
        return c.w / c.n;
    });
    console.log(`  archetype matchup matrix (in-sample ceiling) AUC ${auc(implied, y).toFixed(4)}`);
}

report('ALL leagues 2026', rows);
report('TIER-1 (LCK/LPL/LEC/LCS/EWC)', rows.filter((r) => TIER1.has(r.league)));
