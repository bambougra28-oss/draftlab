/**
 * R1 acceptance — cross-source concordance check (gol.gg vs Leaguepedia).
 *
 * Pulls one team live from gol.gg (residential network only — gol.gg drops
 * datacenter ranges), bridges its recent drafts to DraftRecords, pairs them
 * with the Leaguepedia corpus by (team, day, game number) — gol.gg renders
 * opponents as short tags, so the pairing keys on the SCOUTED team only —
 * and compares what both sources claim about the same game.
 *
 * gol.gg team-draft rows are one-sided (only the scouted team's actions),
 * so pick/ban/order comparisons run on that side alone; winner and side
 * color compare globally. Anything else would be a false divergence.
 *
 * Run: node --experimental-transform-types --no-warnings scripts/data/concordance.ts \
 *        --team 2924 --league lfl --corpus data/corpus/lfl-2026.json --name "ZYB Esport"
 */
import { readFileSync } from 'node:fs';
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

type GolggModule = typeof import('../../src/lib/pro/golgg');
type BridgeModule = typeof import('../../src/lib/pro/golggBridge');
type NormalizeModule = typeof import('../../src/lib/data/normalize');
type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type DraftSide = import('../../src/lib/data/types').DraftSide;

const { fetchTeam, directTransport } = (await import(`${libRootHref}/pro/golgg.ts`)) as GolggModule;
const { recentDraftsToDraftRecords } = (await import(`${libRootHref}/pro/golggBridge.ts`)) as BridgeModule;
const { canonicalTeamName, isoDay } = (await import(`${libRootHref}/data/normalize.ts`)) as NormalizeModule;

// ---- argv -------------------------------------------------------------------

let teamId = '2924';
let league = 'lfl';
let corpusPath = 'data/corpus/lfl-2026.json';
let teamName = 'ZYB Esport';
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--team') teamId = argv[++i];
    else if (argv[i] === '--league') league = argv[++i];
    else if (argv[i] === '--corpus') corpusPath = argv[++i];
    else if (argv[i] === '--name') teamName = argv[++i];
}

// ---- load both sides --------------------------------------------------------

const corpus = JSON.parse(readFileSync(resolve(repoRoot, corpusPath), 'utf8')) as DraftRecord[];
const canonical = canonicalTeamName(teamName);
const lpRecords = corpus.filter(
    (r) => canonicalTeamName(r.blueTeam) === canonical || canonicalTeamName(r.redTeam) === canonical
);
console.log(`Leaguepedia : ${lpRecords.length} drafts de ${teamName} dans ${corpusPath}`);

console.log(`gol.gg : fetchTeam(${teamId}) en direct…`);
const team = await fetchTeam(teamId, { transport: directTransport, league });
const golggRecords = recentDraftsToDraftRecords(team, { fetchedAt: new Date().toISOString() });
console.log(`gol.gg : ${golggRecords.length} drafts (team "${team.name}", incomplete=${team.incomplete === true})`);

// ---- pairing on (day, scouted side set) --------------------------------------

const sideOfTeam = (r: DraftRecord): DraftSide | undefined =>
    canonicalTeamName(r.blueTeam) === canonical
        ? 'blue'
        : canonicalTeamName(r.redTeam) === canonical
          ? 'red'
          : undefined;

const picksOfSide = (r: DraftRecord, side: DraftSide): string =>
    r.actions
        .filter((a) => a.type === 'pick' && a.side === side)
        .map((a) => a.championKey || a.championName.toLowerCase())
        .sort()
        .join(',');

const bansOfSide = (r: DraftRecord, side: DraftSide): string =>
    r.actions
        .filter((a) => a.type === 'ban' && a.side === side)
        .map((a) => a.championKey || a.championName.toLowerCase())
        .sort()
        .join(',');

interface PairReport {
    day: string;
    lpGameId: string;
    golggGameId: string;
    sideAgrees: boolean;
    winnerAgrees: boolean;
    picksAgree: boolean;
    bansAgree: boolean;
    detail?: string;
}

// gol.gg one match per (day, pick-set) — pair greedily by day, disambiguate
// by the scouted side's pick set (handles Bo3 game 1/2 on the same day).
const lpByDay = new Map<string, DraftRecord[]>();
for (const record of lpRecords) {
    const day = isoDay(record.date) ?? '?';
    const bucket = lpByDay.get(day);
    if (bucket) bucket.push(record);
    else lpByDay.set(day, [record]);
}

const reports: PairReport[] = [];
let unmatchedGolgg = 0;
for (const golggRecord of golggRecords) {
    const day = isoDay(golggRecord.date) ?? '?';
    const candidates = lpByDay.get(day) ?? [];
    const golggSide = sideOfTeam(golggRecord);
    if (golggSide === undefined || candidates.length === 0) {
        unmatchedGolgg++;
        continue;
    }
    const golggPicks = picksOfSide(golggRecord, golggSide);
    let match: DraftRecord | undefined;
    for (const candidate of candidates) {
        const lpSide = sideOfTeam(candidate);
        if (lpSide === undefined) continue;
        if (picksOfSide(candidate, lpSide) === golggPicks) {
            match = candidate;
            break;
        }
    }
    // Fall back to "only candidate that day" so pick mismatches are REPORTED
    // rather than silently unmatched.
    if (match === undefined && candidates.length === 1) match = candidates[0];
    if (match === undefined) {
        unmatchedGolgg++;
        continue;
    }
    candidates.splice(candidates.indexOf(match), 1);

    const lpSide = sideOfTeam(match)!;
    const winnerGolgg = golggRecord.winner === golggSide ? 'win' : golggRecord.winner === undefined ? '?' : 'loss';
    const winnerLp = match.winner === lpSide ? 'win' : match.winner === undefined ? '?' : 'loss';
    const report: PairReport = {
        day,
        lpGameId: match.gameId,
        golggGameId: golggRecord.gameId,
        sideAgrees: golggSide === lpSide,
        winnerAgrees: winnerGolgg === winnerLp,
        picksAgree: picksOfSide(match, lpSide) === golggPicks,
        bansAgree: bansOfSide(match, lpSide) === bansOfSide(golggRecord, golggSide)
    };
    if (!report.picksAgree || !report.sideAgrees || !report.winnerAgrees) {
        report.detail = `lp[${lpSide} ${match.winner ?? '?'}] picks=${picksOfSide(match, lpSide)} vs golgg[${golggSide} ${golggRecord.winner ?? '?'}] picks=${golggPicks}`;
    }
    reports.push(report);
}

// ---- verdict ------------------------------------------------------------------

const n = reports.length;
const count = (f: (r: PairReport) => boolean) => reports.filter(f).length;
const pct = (x: number) => (n === 0 ? '—' : `${((100 * x) / n).toFixed(1)} %`);

console.log(`\nAppariement : ${n} games appariées, ${unmatchedGolgg} gol.gg non appariées (hors fenêtre corpus, etc.)`);
console.log(`  Side (bleu/rouge)   : ${count((r) => r.sideAgrees)}/${n} (${pct(count((r) => r.sideAgrees))})`);
console.log(`  Vainqueur           : ${count((r) => r.winnerAgrees)}/${n} (${pct(count((r) => r.winnerAgrees))})`);
console.log(`  Picks (side scouté) : ${count((r) => r.picksAgree)}/${n} (${pct(count((r) => r.picksAgree))})`);
console.log(`  Bans (side scouté)  : ${count((r) => r.bansAgree)}/${n} (${pct(count((r) => r.bansAgree))})`);

const critical = count((r) => r.sideAgrees && r.winnerAgrees && r.picksAgree);
console.log(`\nConcordance critique (side + vainqueur + picks) : ${critical}/${n} (${pct(critical)})`);
for (const report of reports.filter((r) => r.detail !== undefined)) {
    console.log(`  DIVERGENCE ${report.day} ${report.golggGameId} ⇄ ${report.lpGameId}\n    ${report.detail}`);
}
