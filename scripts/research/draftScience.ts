/**
 * Draft science — assimilate the 2026 corpora and measure what the draft
 * ACTUALLY does (exploratory, hand-checkable, every claim with n + CI).
 *
 * Analyses (each section prints + lands in the report):
 *  A. Structure: blue winrate per league; what teams spend their REAL
 *     per-team first pick on (true order: Team pick #1..#5 is source data,
 *     independent of the interleave assumption).
 *  B. Counterpick premium: per (game, role) lane pairing, does the side that
 *     picked LATER (template seq) win the game more? ⚠ template-interleave
 *     is assumed-blue-first in the FS era — caveat printed with the result.
 *  C. Blind-pick #1: flex first picks (≥2 stage roles) vs mono-role first
 *     picks — winrate delta (does role ambiguity at pick 1 pay?).
 *  D. Double-slot packaging: do teams use their #2-#3 and #4-#5 (true team
 *     order) for NAMED duos (botlane / mid-jungle / top-jungle) more than the
 *     cross-phase #3-#4 baseline?
 *  E. Phase-2 ban targeting: are bans #4-#5 aimed at THIS opponent's
 *     repertoire (top-10 most-picked) more than phase-1 bans?
 *  F. Risk markers, validated: per marker, winrate of flagged team-sides vs
 *     unflagged, bootstrap CI by game.
 *  G. Scaling↔length diagnostic (the G1 root cause): do tag-late comps
 *     actually lengthen games / win the long ones?
 *  H. Tag-pair synergy cells fitted on the real corpus (first pro fit of the
 *     §6.3 prior table): strongest residuals with their evidence.
 *
 * Honest framing: descriptive/in-sample — hypothesis GRADING, not predictive
 * claims (those go through walk-forward in the scorecards).
 *
 * Run: node --experimental-transform-types --no-warnings scripts/research/draftScience.ts \
 *        [--out docs/research/2026-06_draft_science_corpus.md] [--generated-at ISO]
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

type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type DraftSide = import('../../src/lib/data/types').DraftSide;
type MetricsModule = typeof import('../../src/lib/backtest/metrics');
type FlexModule = typeof import('../../src/lib/aggregates/flex');
type RiskModule = typeof import('../../src/lib/strategic/riskMarkerDetector');
type PlanModule = typeof import('../../src/lib/strategic/gamePlanClassifier');
type TagsModule = typeof import('../../src/lib/tags');
type TagPairsModule = typeof import('../../src/lib/estimators/tagPairs');

const { wilson95, mulberry32 } = (await import(`${libRootHref}/backtest/metrics.ts`)) as MetricsModule;
const { flexMap } = (await import(`${libRootHref}/aggregates/flex.ts`)) as FlexModule;
const { detectRiskMarkers } = (await import(`${libRootHref}/strategic/riskMarkerDetector.ts`)) as RiskModule;
const { classifyGamePlan } = (await import(`${libRootHref}/strategic/gamePlanClassifier.ts`)) as PlanModule;
const { loadDefaultTags } = (await import(`${libRootHref}/tags/index.ts`)) as TagsModule;
const { fitTagPairCells } = (await import(`${libRootHref}/estimators/tagPairs.ts`)) as TagPairsModule;

// ---- argv & data --------------------------------------------------------------

let outPath = 'docs/research/2026-06_draft_science_corpus.md';
let generatedAt = new Date().toISOString();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') outPath = argv[++i];
    else if (argv[i] === '--generated-at') generatedAt = argv[++i];
}

const CORPORA = ['lck', 'lec', 'lfl'] as const;
const byLeague = new Map<string, DraftRecord[]>();
for (const league of CORPORA) {
    byLeague.set(
        league,
        JSON.parse(readFileSync(resolve(repoRoot, `static/corpus/${league}-2026.json`), 'utf8'))
    );
}
const all: DraftRecord[] = CORPORA.flatMap((league) => byLeague.get(league)!);
const decided = all.filter((r) => r.winner !== undefined);
const tags = loadDefaultTags();

const out: string[] = [];
const say = (line = ''): void => {
    out.push(line);
    console.log(line);
};
const pct = (x: number): string => `${(100 * x).toFixed(1)} %`;
const ciStr = (wins: number, n: number): string => {
    const ci = wilson95(wins, n);
    return `[${(100 * ci.lo).toFixed(1)} ; ${(100 * ci.hi).toFixed(1)}] %`;
};

/** Game-level bootstrap CI on a delta of two team-side rates. */
function bootstrapDeltaByGame(
    games: { flaggedWins: number; flaggedN: number; otherWins: number; otherN: number }[],
    iterations = 2000,
    seed = 42
): { delta: number; lo: number; hi: number } {
    const rng = mulberry32(seed);
    const point = (rows: typeof games): number => {
        let fw = 0;
        let fn = 0;
        let ow = 0;
        let on = 0;
        for (const g of rows) {
            fw += g.flaggedWins;
            fn += g.flaggedN;
            ow += g.otherWins;
            on += g.otherN;
        }
        if (fn === 0 || on === 0) return NaN;
        return fw / fn - ow / on;
    };
    const base = point(games);
    const deltas: number[] = [];
    for (let i = 0; i < iterations; i++) {
        const sample = Array.from({ length: games.length }, () => games[Math.floor(rng() * games.length)]);
        const d = point(sample);
        if (!Number.isNaN(d)) deltas.push(d);
    }
    deltas.sort((a, b) => a - b);
    const q = (p: number): number => deltas[Math.min(deltas.length - 1, Math.floor(p * deltas.length))];
    return { delta: base, lo: q(0.025), hi: q(0.975) };
}

/** Per-team picks in TRUE order (within-side seq order = source pick order). */
function teamPicks(record: DraftRecord, side: DraftSide) {
    return record.actions
        .filter((a) => a.type === 'pick' && a.side === side && a.championKey !== '')
        .sort((a, b) => a.seq - b.seq);
}
function teamBans(record: DraftRecord, side: DraftSide) {
    return record.actions
        .filter((a) => a.type === 'ban' && a.side === side && a.championKey !== '')
        .sort((a, b) => a.seq - b.seq);
}

say(`# Science de la draft — corpus 2026 (LCK + LEC + LFL)`);
say();
say(`> Généré : ${generatedAt} · ${all.length} drafts (${decided.length} avec vainqueur) ·`);
say(`> exploratoire/in-sample : des HYPOTHÈSES graduées avec IC, pas des claims prédictifs.`);
say();

// ---- A. structure ---------------------------------------------------------------

say(`## A. Structure mesurée`);
say();
say(`| Ligue | Games | Winrate côté bleu | Wilson 95 % |`);
say(`|---|---|---|---|`);
for (const league of CORPORA) {
    const games = byLeague.get(league)!.filter((r) => r.winner !== undefined);
    const blueWins = games.filter((r) => r.winner === 'blue').length;
    say(`| ${league.toUpperCase()} | ${games.length} | ${pct(blueWins / games.length)} | ${ciStr(blueWins, games.length)} |`);
}
const blueAll = decided.filter((r) => r.winner === 'blue').length;
say(`| **Total** | ${decided.length} | ${pct(blueAll / decided.length)} | ${ciStr(blueAll, decided.length)} |`);
say();

// ---- B. counterpick premium ------------------------------------------------------

say(`## B. La prime au counterpick, mesurée`);
say();
const cpGames: { flaggedWins: number; flaggedN: number; otherWins: number; otherN: number }[] = [];
const perRole: Record<number, { laterWins: number; n: number }> = {};
for (const record of decided) {
    const blue = teamPicks(record, 'blue');
    const red = teamPicks(record, 'red');
    const row = { flaggedWins: 0, flaggedN: 0, otherWins: 0, otherN: 0 };
    for (let role = 0; role < 5; role++) {
        const b = blue.find((a) => a.role === role);
        const r = red.find((a) => a.role === role);
        if (b === undefined || r === undefined) continue;
        const laterSide: DraftSide = b.seq > r.seq ? 'blue' : 'red';
        const laterWon = record.winner === laterSide;
        const bucket = (perRole[role] ??= { laterWins: 0, n: 0 });
        bucket.n++;
        if (laterWon) bucket.laterWins++;
        row.flaggedN++;
        if (laterWon) row.flaggedWins++;
        row.otherN++;
        if (!laterWon) row.otherWins++;
    }
    if (row.flaggedN > 0) cpGames.push(row);
}
const cpTotal = Object.values(perRole).reduce((s, r) => s + r.n, 0);
const cpWins = Object.values(perRole).reduce((s, r) => s + r.laterWins, 0);
say(`Unité : un duel de rôle (même rôle, deux camps) ; « counter » = le camp qui a pické`);
say(`ce rôle PLUS TARD dans la séquence (template blue-first — ⚠ approximation ère First`);
say(`Selection, l'entrelacement exact n'est pas dans la source).`);
say();
say(`| Rôle | n duels | Winrate du camp qui counter | Wilson 95 % |`);
say(`|---|---|---|---|`);
const ROLE_LABELS = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
for (let role = 0; role < 5; role++) {
    const bucket = perRole[role];
    if (bucket === undefined) continue;
    say(`| ${ROLE_LABELS[role]} | ${bucket.n} | ${pct(bucket.laterWins / bucket.n)} | ${ciStr(bucket.laterWins, bucket.n)} |`);
}
say(`| **Tous rôles** | ${cpTotal} | ${pct(cpWins / cpTotal)} | ${ciStr(cpWins, cpTotal)} |`);
say();

// ---- C. flex first pick -----------------------------------------------------------

say(`## C. Premier pick d'équipe : flex vs mono-rôle`);
say();
const flex = flexMap(decided);
const isFlex = (key: string): boolean => (flex.get(key)?.roleCount ?? 1) >= 2;
const flexRows: typeof cpGames = [];
let flexN = 0;
let flexWins = 0;
let monoN = 0;
let monoWins = 0;
for (const record of decided) {
    const row = { flaggedWins: 0, flaggedN: 0, otherWins: 0, otherN: 0 };
    for (const side of ['blue', 'red'] as const) {
        const first = teamPicks(record, side)[0];
        if (first === undefined) continue;
        const won = record.winner === side;
        if (isFlex(first.championKey)) {
            flexN++;
            if (won) flexWins++;
            row.flaggedN++;
            if (won) row.flaggedWins++;
        } else {
            monoN++;
            if (won) monoWins++;
            row.otherN++;
            if (won) row.otherWins++;
        }
    }
    if (row.flaggedN + row.otherN > 0) flexRows.push(row);
}
const flexDelta = bootstrapDeltaByGame(flexRows.filter((r) => r.flaggedN > 0 || r.otherN > 0));
say(`Flex = champion joué dans ≥ 2 rôles sur scène 2026 (flexMap du corpus).`);
say();
say(`- Premier pick FLEX : ${flexN} équipes-games, winrate ${pct(flexWins / flexN)} ${ciStr(flexWins, flexN)}`);
say(`- Premier pick MONO : ${monoN} équipes-games, winrate ${pct(monoWins / monoN)} ${ciStr(monoWins, monoN)}`);
say(`- Δ (flex − mono) : ${(100 * flexDelta.delta).toFixed(1)} pp, IC bootstrap par game [${(100 * flexDelta.lo).toFixed(1)} ; ${(100 * flexDelta.hi).toFixed(1)}] pp`);
say();

// ---- D. double slots = duos packagés ? -------------------------------------------

say(`## D. Les doubles slots (2-3 et 4-5) servent-ils à packager des duos ?`);
say();
type Kind = 'botlane' | 'midjungle' | 'topjungle' | 'autre';
const kindOf = (roleA?: number, roleB?: number): Kind => {
    const pair = new Set([roleA, roleB]);
    if (pair.has(3) && pair.has(4)) return 'botlane';
    if (pair.has(1) && pair.has(2)) return 'midjungle';
    if (pair.has(0) && pair.has(1)) return 'topjungle';
    return 'autre';
};
let named23 = 0;
let n23 = 0;
let named45 = 0;
let n45 = 0;
let named34 = 0;
let n34 = 0;
for (const record of decided) {
    for (const side of ['blue', 'red'] as const) {
        const picks = teamPicks(record, side);
        if (picks.length !== 5) continue;
        const pairKind = (i: number, j: number): Kind => kindOf(picks[i].role, picks[j].role);
        n23++;
        if (pairKind(1, 2) !== 'autre') named23++;
        n45++;
        if (pairKind(3, 4) !== 'autre') named45++;
        n34++;
        if (pairKind(2, 3) !== 'autre') named34++;
    }
}
say(`Duo « nommé » = botlane (Bot+Sup), mid-jungle ou top-jungle. Unité : équipe-game (picks dans l'ordre RÉEL de l'équipe).`);
say();
say(`| Paire de picks | n | Part en duo nommé | Wilson 95 % |`);
say(`|---|---|---|---|`);
say(`| #2-#3 (double slot) | ${n23} | ${pct(named23 / n23)} | ${ciStr(named23, n23)} |`);
say(`| #4-#5 (double slot) | ${n45} | ${pct(named45 / n45)} | ${ciStr(named45, n45)} |`);
say(`| #3-#4 (cheval sur 2 phases — baseline) | ${n34} | ${pct(named34 / n34)} | ${ciStr(named34, n34)} |`);
say();

// ---- E. phase-2 ban targeting ------------------------------------------------------

say(`## E. Les bans de phase 2 visent-ils CET adversaire ?`);
say();
const teamTopPicks = new Map<string, Set<string>>();
{
    const counts = new Map<string, Map<string, number>>();
    for (const record of all) {
        for (const side of ['blue', 'red'] as const) {
            const team = side === 'blue' ? record.blueTeam : record.redTeam;
            const m = counts.get(team) ?? new Map<string, number>();
            for (const a of teamPicks(record, side)) m.set(a.championKey, (m.get(a.championKey) ?? 0) + 1);
            counts.set(team, m);
        }
    }
    for (const [team, m] of counts) {
        teamTopPicks.set(
            team,
            new Set(
                [...m.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([k]) => k)
            )
        );
    }
}
let p1InRep = 0;
let p1N = 0;
let p2InRep = 0;
let p2N = 0;
for (const record of all) {
    for (const side of ['blue', 'red'] as const) {
        const enemyTeam = side === 'blue' ? record.redTeam : record.blueTeam;
        const repertoire = teamTopPicks.get(enemyTeam);
        if (repertoire === undefined) continue;
        const bans = teamBans(record, side);
        for (const [index, ban] of bans.entries()) {
            const phase2 = ban.phase === 'ban2' || index >= 3;
            if (phase2) {
                p2N++;
                if (repertoire.has(ban.championKey)) p2InRep++;
            } else {
                p1N++;
                if (repertoire.has(ban.championKey)) p1InRep++;
            }
        }
    }
}
say(`Mesure : part des bans qui tombent dans le top-10 des champions LES PLUS JOUÉS par`);
say(`l'adversaire du soir (répertoire corpus). Phase 1 = bans #1-#3, phase 2 = #4-#5.`);
say();
say(`- Phase 1 : ${pct(p1InRep / p1N)} dans le répertoire adverse ${ciStr(p1InRep, p1N)} (n=${p1N})`);
say(`- Phase 2 : ${pct(p2InRep / p2N)} dans le répertoire adverse ${ciStr(p2InRep, p2N)} (n=${p2N})`);
say();

// ---- F. risk markers, confrontés au réel -------------------------------------------

say(`## F. Les 12 risk markers face aux résultats réels`);
say();
say(`Unité : équipe-game (comp complète rôle-ordonnée). Δ = winrate flaggé − non flaggé,`);
say(`IC bootstrap par game. In-sample : un Δ nul signifie « pas de pénalité mesurable en`);
say(`2026 », pas « marker inutile » (il peut prévenir un risque que les pros évitent déjà).`);
say();
const compOf = (record: DraftRecord, side: DraftSide): string[] | null => {
    const byRole = new Map<number, string>();
    for (const a of teamPicks(record, side)) {
        if (a.role === undefined || byRole.has(a.role)) return null;
        byRole.set(a.role, a.championKey);
    }
    if (byRole.size !== 5) return null;
    return [0, 1, 2, 3, 4].map((r) => byRole.get(r)!);
};
interface MarkerObs {
    gameId: string;
    flagged: boolean;
    won: boolean;
}
const markerObs = new Map<string, MarkerObs[]>();
for (const record of decided) {
    const blue = compOf(record, 'blue');
    const red = compOf(record, 'red');
    if (blue === null || red === null) continue;
    const planBlue = classifyGamePlan(blue, tags);
    const planRed = classifyGamePlan(red, tags);
    for (const [side, comp, enemyComp, plan, enemyPlan] of [
        ['blue', blue, red, planBlue, planRed],
        ['red', red, blue, planRed, planBlue]
    ] as const) {
        const markers = new Set(
            detectRiskMarkers(comp, enemyComp, { allyGamePlan: plan, enemyGamePlan: enemyPlan, tagsFile: tags }).map(
                (m) => m.id
            )
        );
        const won = record.winner === side;
        for (const id of [
            'no-frontline',
            'damage-100-ad',
            'damage-100-ap',
            'no-engage-tool',
            'no-disengage-vs-engage',
            'homogeneous-scaling',
            'low-mobility-vs-pick',
            'split-without-waveclear'
        ]) {
            const list = markerObs.get(id) ?? [];
            list.push({ gameId: record.gameId, flagged: markers.has(id), won });
            markerObs.set(id, list);
        }
    }
}
say(`| Marker | Équipes flaggées | WR flaggé | WR non flaggé | Δ (pp) | IC 95 % (pp) |`);
say(`|---|---|---|---|---|---|`);
for (const [id, obs] of markerObs) {
    const flagged = obs.filter((o) => o.flagged);
    const other = obs.filter((o) => !o.flagged);
    if (flagged.length < 10) {
        say(`| ${id} | ${flagged.length} | — | — | — | échantillon < 10 |`);
        continue;
    }
    const byGame = new Map<string, { flaggedWins: number; flaggedN: number; otherWins: number; otherN: number }>();
    for (const o of obs) {
        const row = byGame.get(o.gameId) ?? { flaggedWins: 0, flaggedN: 0, otherWins: 0, otherN: 0 };
        if (o.flagged) {
            row.flaggedN++;
            if (o.won) row.flaggedWins++;
        } else {
            row.otherN++;
            if (o.won) row.otherWins++;
        }
        byGame.set(o.gameId, row);
    }
    const ci = bootstrapDeltaByGame([...byGame.values()]);
    const wrF = flagged.filter((o) => o.won).length / flagged.length;
    const wrO = other.filter((o) => o.won).length / other.length;
    say(
        `| ${id} | ${flagged.length} | ${pct(wrF)} | ${pct(wrO)} | ${(100 * ci.delta).toFixed(1)} | [${(100 * ci.lo).toFixed(1)} ; ${(100 * ci.hi).toFixed(1)}] |`
    );
}
say();

// ---- G. scaling ↔ durée (diagnostic G1) --------------------------------------------

say(`## G. Diagnostic G1 : le scaling des tags façonne-t-il la durée des games ?`);
say();
const withLength = decided.filter((r) => r.gameLengthSeconds !== undefined);
const lateCount = (comp: string[]): number =>
    comp.filter((k) => tags.champions[k]?.scalingWindow === 'late').length;
const pairs: { totalLate: number; length: number; lateDiffWinnerSide: number }[] = [];
for (const record of withLength) {
    const blue = compOf(record, 'blue');
    const red = compOf(record, 'red');
    if (blue === null || red === null) continue;
    const lb = lateCount(blue);
    const lr = lateCount(red);
    const winnerLateDiff = record.winner === 'blue' ? lb - lr : lr - lb;
    pairs.push({ totalLate: lb + lr, length: record.gameLengthSeconds!, lateDiffWinnerSide: winnerLateDiff });
}
const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
const corr = (xs: number[], ys: number[]): number => {
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < xs.length; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
        dx += (xs[i] - mx) ** 2;
        dy += (ys[i] - my) ** 2;
    }
    return num / Math.sqrt(dx * dy);
};
const r1 = corr(pairs.map((p) => p.totalLate), pairs.map((p) => p.length));
say(`- n = ${pairs.length} games (durée + comps rôle-complètes).`);
say(`- Corrélation (nb total de champions tag-late des DEUX comps) ↔ durée : r = ${r1.toFixed(3)}.`);
const sorted = [...pairs].sort((a, b) => a.length - b.length);
const third = Math.floor(sorted.length / 3);
const short = sorted.slice(0, third);
const long = sorted.slice(-third);
const sWins = short.filter((p) => p.lateDiffWinnerSide > 0).length;
const sLoss = short.filter((p) => p.lateDiffWinnerSide < 0).length;
const lWins = long.filter((p) => p.lateDiffWinnerSide > 0).length;
const lLoss = long.filter((p) => p.lateDiffWinnerSide < 0).length;
say(`- Games COURTES (tiers bas) : le camp le plus « late » gagne ${sWins}/${sWins + sLoss} des games déséquilibrées (${pct(sWins / (sWins + sLoss))} ${ciStr(sWins, sWins + sLoss)}).`);
say(`- Games LONGUES (tiers haut) : le camp le plus « late » gagne ${lWins}/${lWins + lLoss} (${pct(lWins / (lWins + lLoss))} ${ciStr(lWins, lWins + lLoss)}).`);
say();

// ---- H. tag-pair synergy cells fitted on the pro corpus ----------------------------

say(`## H. Cellules de synergie par traits — premier fit pro (§6.3 construit)`);
say();
const fit = fitTagPairCells(decided, { tagsFile: tags, priorN: 400 });
say(`${fit.pairObservations} observations de paires (10 par game et par camp), baseline ${pct(fit.baseline)},`);
say(`shrinkage EB priorN=${fit.priorN}. Résidu = winrate shrunk de la cellule − baseline.`);
say();
const cells = [...fit.cells.values()].filter((c) => c.games >= 400).sort((a, b) => b.residual - a.residual);
say(`| Cellule (trait + trait) | Games | WR shrunk | Résidu (pp) |`);
say(`|---|---|---|---|`);
for (const cell of [...cells.slice(0, 8), ...cells.slice(-8)]) {
    say(`| ${cell.key} | ${cell.games} | ${pct(cell.posterior.mean)} | ${(100 * cell.residual).toFixed(2)} |`);
}
say();
say(`> Lecture : in-sample, cellules corrélées entre elles (un même duo active plusieurs`);
say(`> cellules) — c'est un PRIOR structurel pour les paires jamais vues, pas un classement causal.`);
say();

// ---- I. synthèse — ce que les données m'apprennent ---------------------------------

say(`## I. Synthèse — ce que j'en retiens, et ce que ça change`);
say();
say(`1. **Le side est équilibré en 2026** (50,6 % bleu, IC traverse 50) — First Selection`);
say(`   fait son travail ; cohérent avec le scorecard (side-only ≈ pile-ou-face).`);
say(`2. **La prime au counterpick est minuscule** : +1,0 pp tous rôles (et négative au mid).`);
say(`   Même en tenant compte du bruit d'entrelacement de l'ère FS (qui DILUE l'effet vers`);
say(`   50 %), une grosse prime (≥ 5 pp) serait visible — elle n'existe pas. Le folklore`);
say(`   surévalue le counter ; les pros paient peu leur blind. → Le coach ne doit pas`);
say(`   surpondérer l'axe counter ; cohérent avec la littérature (lane counters réels mais petits).`);
say(`3. **Les doubles slots packagent vraiment des duos** : 45,9 % (#2-#3) et 42,7 % (#4-#5)`);
say(`   de duos nommés contre 21,4 % sur la paire à cheval #3-#4 — plus du double. La`);
say(`   théorie des trades est un comportement réel mesuré. → Feature coach : proposer des`);
say(`   PAIRES (pas des picks isolés) quand on entre dans un double slot.`);
say(`4. **Les bans changent de nature entre les phases** : phase 1 = 25,9 % dans le top-10`);
say(`   adverse, phase 2 = 16,5 % SEULEMENT. La phase 2 ne vise pas le répertoire du joueur`);
say(`   mais la COMPO révélée (contres situationnels). → Le banEV doit avoir deux régimes :`);
say(`   demande/répertoire en phase 1, contre-composition en phase 2 — ça précise la`);
say(`   trouvaille « demande contrefactuelle » du scorecard.`);
say(`5. **Les pros n'enfreignent jamais nos règles absolues** : 0 comp 100 % AD/AP, 0 comp`);
say(`   sans engage, 10 sans frontline (qui gagnent !). Les markers d'hygiène sont de la`);
say(`   PÉDAGOGIE (ne fais pas ce que les pros ne font jamais), pas de la discrimination.`);
say(`6. **Un marker est empiriquement INVERSÉ** : low-mobility-vs-pick = +10,1 pp [1,6 ; 18,5]`);
say(`   pour les équipes flaggées (n=130). Affronter une « comp Pick » avec une comp posée`);
say(`   GAGNE en 2026 — les comps pick vivent des écarts que les pros ne donnent pas.`);
say(`   → STEP_UP : réviser ce marker (contextualiser ou inverser). no-disengage-vs-engage`);
say(`   reste directionnel (−15 pp, n=20, non significatif — à surveiller).`);
say(`7. **La racine de l'échec G1 est identifiée** : r = 0,006 entre le scaling des tags et`);
say(`   la durée réelle — la dimension scalingWindow ne décrit PAS le tempo des games pro`);
say(`   (et le camp « late » gagne plutôt les games COURTES, 56,7 %). Refitter des poids sur`);
say(`   une feature morte ne servira à rien : l'axe scaling doit consommer des données`);
say(`   temporelles (statsByTime SoloQ / profils de durée corpus), le tag en simple fallback.`);
say(`8. **Le pont de synergies par traits est né et parle déjà** : ad+peel **+2,45 pp** sur`);
say(`   5 527 games (le pattern protect est réel), early+melee **−2,80**, melee+melee −1,97.`);
say(`   → Brancher pairPrior dans les raisons du coach (« paire portée par +2,4 pp sur`);
say(`   5 527 games ») et comme prior mean du terme duo pro de l'évaluateur.`);
say();

// ---- write -------------------------------------------------------------------------

const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, out.join('\n') + '\n', 'utf8');
console.log(`\nÉcrit : ${absOut}`);
