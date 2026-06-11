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
 * MODE OPTIONNEL `--surprise-defense` (chantier W1 — non-régression F-c) :
 * GARDE F2 GELÉE — exigence k=3 pooled ≥ 94,5 % sinon F-c reste débranché
 * (docs/run2/F-pocket-picks.md §3.2 « GARDE DE BRANCHEMENT F-c », règle
 * gelée ; le système VERT pré-enregistré 95,0 % prime sur toute défense
 * nouvelle). Le flag applique EXACTEMENT le mécanisme gelé PENDANT le
 * scoring, sans nouveau paramètre :
 *  - DÉCLENCHEUR : `surpriseOf(pick).bits ≥ surpriseAlarmBits = 5`
 *    (rangeModelConfig commitée ; ε = 1e-3 ⇒ bits ≤ ~9,97), bits lus sur
 *    `predictEnemyRange` avec la table de tendances de l'équipe du side,
 *    `buildTendencyTable(train, train, { team, now: now_k })` fittée sur le
 *    TRAIN du fold (walk-forward strict — même filtre de patchs que
 *    fitRolePriors ; now_k = plus ancienne date du patch testé, patron
 *    coachGate ; pools/meta/cohérence absents ⇒ facteurs neutres, doctrine
 *    rangeModel ; exclude = champions déjà sortis avant le seq du pick)
 *    ET rôle-novelté structurelle : compte train équipe+ligue de
 *    (champion, rôle le plus probable de la lecture courante — marginal des
 *    hypothèses de base, égalité ⇒ rôle d'indice le plus bas) = 0, via
 *    `shouldTriggerSurpriseDefense` (module gelé surpriseDefense.ts).
 *  - EFFET : priors du champion DÉCLENCHEUR seul → uniforme (β = 1,
 *    `uniformizeTriggeredPriors`) puis RÉ-ÉNUMÉRATION
 *    `roleAssignmentHypotheses` ; les deux pistes (top-hypothèse, argmax)
 *    lisent les mêmes priors défendus — un seul objet de priors, patron du
 *    harnais. Pick hors-template ou fold de défense absent : jamais évalué,
 *    jamais déclenché, compté.
 * SANS le flag, le harnais est INCHANGÉ — sortie byte-identique, vérifiée
 * par diff sur fixture (tests/roleInference.surpriseDefense.test.ts).
 *
 * Run: node --experimental-transform-types --no-warnings scripts/backtest/roleInference.ts \
 *        static/corpus/lck-2026.json [...] [--surprise-defense] [--out docs/calibration/role-inference-2026.md]
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
type TendencyModule = typeof import('../../src/lib/aggregates/tendency');
type RangeModelModule = typeof import('../../src/lib/strategic/rangeModel');
type SurpriseDefenseModule = typeof import('../../src/lib/intel/surpriseDefense');
type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type Role = import('../../src/lib/types').Role;
type RolePriors = import('../../src/lib/strategic/fogReveal').RolePriors;
type Hypothesis = import('../../src/lib/strategic/fogReveal').Hypothesis;
type TendencyTable = import('../../src/lib/aggregates/tendency').TendencyTable;

const { roleAssignmentHypotheses } = (await import(`${libRootHref}/strategic/fogReveal.ts`)) as FogModule;
const { fitRolePriors, rolePriorsOf } = (await import(`${libRootHref}/aggregates/rolePriors.ts`)) as RolePriorsModule;
const { comparePatches, parsePatch } = (await import(`${libRootHref}/backtest/walkforward.ts`)) as WalkforwardModule;
const { wilson95 } = (await import(`${libRootHref}/backtest/metrics.ts`)) as MetricsModule;
// Mode --surprise-defense (W1) : range model + mécanisme F-c gelé, RÉUTILISÉS.
const { buildTendencyTable, slotGroupOf } = (await import(`${libRootHref}/aggregates/tendency.ts`)) as TendencyModule;
const { predictEnemyRange, surpriseOf } = (await import(`${libRootHref}/strategic/rangeModel.ts`)) as RangeModelModule;
const { shouldTriggerSurpriseDefense, uniformizeTriggeredPriors } = (await import(
    `${libRootHref}/intel/surpriseDefense.ts`
)) as SurpriseDefenseModule;

// ---- argv -------------------------------------------------------------------

const inputs: string[] = [];
let outPath = 'docs/calibration/role-inference-2026.md';
let generatedAt = new Date().toISOString();
let surpriseDefense = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') outPath = argv[++i];
    else if (argv[i] === '--generated-at') generatedAt = argv[++i];
    else if (argv[i] === '--surprise-defense') surpriseDefense = true;
    else inputs.push(argv[i]);
}
if (inputs.length === 0) {
    console.error('Usage: node scripts/backtest/roleInference.ts <corpus.json> [...] [--surprise-defense] [--out md]');
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

// ---- mode --surprise-defense : état (inerte sans le flag) ---------------------

interface DefenseStat {
    evaluated: number;
    alarms: number;
    triggers: number;
    reEnumerated: number;
    notEvaluated: number;
}

interface TriggerRow {
    corpus: string;
    gameId: string;
    side: 'blue' | 'red';
    k: number;
    championName: string;
    bits: number;
    role: Role;
}

const defenseStats = new Map<number, DefenseStat>([
    [3, { evaluated: 0, alarms: 0, triggers: 0, reEnumerated: 0, notEvaluated: 0 }],
    [5, { evaluated: 0, alarms: 0, triggers: 0, reEnumerated: 0, notEvaluated: 0 }]
]);
const triggerRows: TriggerRow[] = [];
const ROLE_FR = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];

/**
 * Rôle le plus probable de la LECTURE COURANTE : marginal du champion sur les
 * hypothèses de BASE (Σ p par rôle assigné), égalité ⇒ rôle d'indice le plus
 * bas (strictement supérieur exigé — déterministe) ; lecture vide ⇒ null
 * (jamais déclenché, contrat shouldTriggerSurpriseDefense).
 */
const marginalTopRole = (hypotheses: Hypothesis[], championKey: string): Role | null => {
    const mass = new Map<Role, number>();
    for (const hypothesis of hypotheses) {
        for (const [role, key] of hypothesis.assignment) {
            if (key === championKey) mass.set(role, (mass.get(role) ?? 0) + hypothesis.p);
        }
    }
    let best: Role | null = null;
    let bestMass = 0;
    for (const role of [0, 1, 2, 3, 4] as Role[]) {
        const m = mass.get(role) ?? 0;
        if (m > bestMass) {
            bestMass = m;
            best = role;
        }
    }
    return best;
};

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

    // Mode --surprise-defense : range model du TRAIN du fold (walk-forward
    // strict — MÊME filtre de patchs que foldFor), tables de tendances par
    // équipe, now_k = plus ancienne date du patch testé (patron coachGate).
    interface DefenseFold {
        tableFor: (team: string) => TendencyTable;
    }
    const defenseFoldByPatch = new Map<string, DefenseFold | null>();
    const defenseFoldFor = (patch: string | undefined): DefenseFold | null => {
        if (patch === undefined || parsePatch(patch) === undefined) return null;
        let cached = defenseFoldByPatch.get(patch);
        if (cached === undefined) {
            const train = records.filter(
                (r) =>
                    r.patch !== undefined &&
                    parsePatch(r.patch) !== undefined &&
                    comparePatches(r.patch, patch) < 0
            );
            if (train.length === 0) {
                cached = null;
            } else {
                let nowK: string | undefined;
                for (const r of records) {
                    if (r.patch !== patch || r.date === undefined) continue;
                    if (nowK === undefined || r.date < nowK) nowK = r.date;
                }
                const now = nowK ?? generatedAt;
                const tables = new Map<string, TendencyTable>();
                cached = {
                    tableFor: (team: string): TendencyTable => {
                        let table = tables.get(team);
                        if (table === undefined) {
                            table = buildTendencyTable(train, train, { team, now });
                            tables.set(team, table);
                        }
                        return table;
                    }
                };
            }
            defenseFoldByPatch.set(patch, cached);
        }
        return cached;
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
                // Sans le flag : activePriors === safePriors, hypothèses de base —
                // chemin STRICTEMENT identique au harnais validé (byte-identique).
                let activePriors: RolePriors = safePriors;
                let hypotheses = roleAssignmentHypotheses(keys, activePriors);
                if (surpriseDefense) {
                    // Mécanisme F-c gelé (F-pocket-picks.md §3.2), appliqué PENDANT le scoring.
                    const defenseFold = defenseFoldFor(record.patch);
                    const stat = defenseStats.get(k) as DefenseStat;
                    const team = side === 'blue' ? record.blueTeam : record.redTeam;
                    const trainRoleCountOf = (championKey: string, role: Role): number =>
                        fold.byChampion.get(championKey)?.[role] ?? 0;
                    const triggered = new Set<string>();
                    for (const pick of revealed) {
                        const group = slotGroupOf(pick);
                        if (group === undefined || defenseFold === null) {
                            stat.notEvaluated++; // jamais déclenché, compté
                            continue;
                        }
                        stat.evaluated++;
                        // La range tenue pour le slot AVANT le pick : exclude =
                        // tout champion déjà sorti (picks/bans, seq strictement antérieur).
                        const exclude = new Set<string>();
                        for (const action of record.actions) {
                            if (action.championKey !== '' && action.seq < pick.seq) exclude.add(action.championKey);
                        }
                        const range = predictEnemyRange({
                            table: defenseFold.tableFor(team),
                            slotGroup: group,
                            side,
                            exclude
                        });
                        const { bits, alarm } = surpriseOf(pick.championKey, range);
                        if (alarm) stat.alarms++;
                        const mostProbableRole = marginalTopRole(hypotheses, pick.championKey);
                        if (
                            shouldTriggerSurpriseDefense(pick.championKey, { bits, mostProbableRole }, { trainRoleCountOf })
                        ) {
                            triggered.add(pick.championKey);
                            stat.triggers++;
                            triggerRows.push({
                                corpus: basename(input),
                                gameId: record.gameId,
                                side,
                                k,
                                championName: pick.championName,
                                bits,
                                role: mostProbableRole as Role
                            });
                        }
                    }
                    if (triggered.size > 0) {
                        // EFFET gelé : déclencheur SEUL → uniforme (β = 1), puis ré-énumération.
                        stat.reEnumerated++;
                        activePriors = uniformizeTriggeredPriors(activePriors, triggered);
                        hypotheses = roleAssignmentHypotheses(keys, activePriors);
                    }
                }
                const top = hypotheses[0];
                const predicted = new Map<string, Role>();
                if (top !== undefined) {
                    for (const [role, key] of top.assignment) predicted.set(key, role);
                }
                for (const pick of revealed) {
                    bump(input, 'top-hypothesis', k, predicted.get(pick.championKey) === pick.role);
                    // Independent argmax baseline (no injectivity constraint).
                    const weights = activePriors(pick.championKey);
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

if (surpriseDefense) {
    const guard = pooled('top-hypothesis', 3);
    const guardRate = guard.n > 0 ? guard.hits / guard.n : NaN;
    const guardMet = guardRate >= 0.945;
    rows.push(
        '',
        '---',
        '',
        '## Mode `--surprise-defense` — non-régression F-c (chantier W1)',
        '',
        '> GARDE F2 GELÉE — exigence : accuracy pooled k=3 (top-hypothèse, défense active)',
        '> ≥ 94,5 %, sinon F-c reste débranché (docs/run2/F-pocket-picks.md §3.2 « GARDE DE',
        '> BRANCHEMENT F-c » ; le système VERT pré-enregistré 95,0 % prime sur toute défense nouvelle).',
        '',
        'Mécanisme gelé appliqué PENDANT le scoring, sans nouveau paramètre : déclencheur =',
        '`surpriseOf(pick).bits ≥ surpriseAlarmBits = 5` (range model fitté sur le TRAIN du fold,',
        'walk-forward strict) ET rôle-novelté structurelle (compte train équipe+ligue de',
        '(champion, rôle le plus probable de la lecture courante) = 0, `shouldTriggerSurpriseDefense`) ;',
        'effet = priors du champion DÉCLENCHEUR seul → uniforme (β = 1, `uniformizeTriggeredPriors`)',
        'puis ré-énumération `roleAssignmentHypotheses`.',
        '',
        '| k | Picks évalués | Alarmes (bits ≥ 5) | Déclencheurs | Lectures ré-énumérées | Non évalués |',
        '|---|---|---|---|---|---|'
    );
    for (const k of [3, 5]) {
        const stat = defenseStats.get(k) as DefenseStat;
        rows.push(
            `| ${k} | ${stat.evaluated} | ${stat.alarms} | ${stat.triggers} | ${stat.reEnumerated} | ${stat.notEvaluated} |`
        );
    }
    rows.push('', '### Déclencheurs (liste exhaustive)', '');
    if (triggerRows.length === 0) {
        rows.push('Aucun déclencheur.');
    } else {
        rows.push('| Corpus | gameId | Side | k | Champion | bits | Rôle lu (r*) |', '|---|---|---|---|---|---|---|');
        for (const row of triggerRows) {
            rows.push(
                `| ${row.corpus} | ${row.gameId} | ${row.side} | ${row.k} | ${row.championName} | ` +
                    `${row.bits.toFixed(2)} | ${ROLE_FR[row.role] ?? row.role} |`
            );
        }
    }
    rows.push(
        '',
        '### Verdict de la garde gelée',
        '',
        `- Accuracy pooled k=3 (top-hypothèse, défense active) : ${(100 * guardRate).toFixed(1)} % (n = ${guard.n}) — ` +
            `seuil gelé 94,5 % : ${
                guardMet
                    ? '**ATTEINT** — la non-régression tient (F-c brancheable, sous réserve F2 VERTE)'
                    : '**NON ATTEINT** — F-c reste débranché, rouge à documenter'
            }.`
    );
}

const markdown = rows.join('\n') + '\n';
const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, markdown, 'utf8');
console.log(markdown);
console.log(`Écrit : ${absOut}`);
