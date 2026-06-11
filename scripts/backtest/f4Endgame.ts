/**
 * F4 — ENDGAME SOLVER : delta apparié, jamais gate isolée (run #2, chantier F,
 * bras du runner A — implémenté au chantier W2).
 *
 * RÈGLE PRÉ-ENREGISTRÉE — recopiée VERBATIM de `docs/run2/F-pocket-picks.md`
 * §3.4 (gelé post-revue adversariale + re-revue de conformité, 2026-06-11).
 * UNE règle, UN run : aucun paramètre ne bouge après lecture du moindre
 * résultat.
 *
 * ### 3.4 F4 — endgame solver : delta apparié, jamais gate isolée
 *
 * > Méthodologie de la gate A restreinte aux games de gameNumber ≥ 4 (comptes
 * > mesurés : 125 G4 + 49 G5 = 174 games, ~125 clusters de série), bras
 * > supplémentaire « exhaustif » vs le bras depth-2 de A sur les MÊMES tours :
 * > delta de TD apparié par game, IC bootstrap clusterisé par série
 * > (`clusterBootstrapDeltaCI`, 1000, seed 42). **MDE DÉCLARÉ ≈ ±8 pp — très
 * > au-dessus de l'effet attendu (~2 pp) : l'issue « non concluant » est
 * > ASSUMÉE d'avance** et publiée telle quelle ; VERT (lo > 0) débloquerait le
 * > claim « recherche profonde validée » ; tout autre résultat ⇒ F-d ship
 * > Expérimental (DA-V2-11) sur la seule garantie d'ingénierie (espace ≤ 10⁶,
 * > < 2 s), SAUF hi < 0 (exhaustif PIRE) ⇒ F-d non branché, enquête
 * > (évaluateur bruité sur-exploité par la profondeur). Aucun pooling
 * > post-hoc, aucune tranche supplémentaire.
 *
 * --- FIN DE LA RÈGLE GELÉE ---
 *
 * Implémentation (précisions d'ingénierie — AUCUN paramètre nouveau, tout est
 * hérité de la règle A gelée et des bornes F-d gelées) :
 *
 *  - « Méthodologie de la gate A » = le harnais EXTRAIT du runner A
 *    (`src/lib/backtest/coachGateHarness.ts`, chantier W2 étape 1 — équivalence
 *    byte-identique prouvée sur fixture) : mêmes folds walk-forward par patch
 *    PAR CORPUS (train = le corpus ENTIER, jamais restreint), même détecteur
 *    Fearless data-driven, même univers − lockouts, mêmes C_t shippés
 *    (présence-top-15 → 6 → racine 4), même éligibilité et même scoring
 *    (`scoreGameForGate`, percentiles à ½, crédit 1/½/0). La restriction
 *    `series.gameNumber ≥ 4` ne filtre que les games SCORÉES (une game sans
 *    série n'est jamais une endgame).
 *  - Bras depth-2 = `engine.modelDeps` du harnais (navigate racine-forcée,
 *    depth 2, topK 4, memo partagé par tour) — le bras de A à l'identique.
 *  - Bras exhaustif = `searchFearlessEndgame` (`$lib/strategic/fearlessEndgame`,
 *    bornes F-d gelées : surpriseK = 8 de la config commitée, espace exact
 *    Π|C_s| calculé AVANT toute recherche, bascule ssi ≤ 1e6) en racine forcée
 *    par seq : au slot racine du tour ⇒ [candidat], aux slots plus profonds ⇒
 *    la liste shippée du tour ; range adverse = `enemyDistributionOf` du même
 *    ctx que A — les DEUX bras voient exactement les mêmes injections, seule
 *    la recherche change. Memo endgame par tour, partagé entre les racines
 *    forcées du même tour. `spaceSize > 1e6` ⇒ le bras retombe sur la valeur
 *    depth-2 pour CE tour (contribution au delta structurellement nulle),
 *    tour compté « retombée depth-2 » dans la couverture.
 *  - Delta apparié par game = crédit_exhaustif − crédit_depth-2 sur les MÊMES
 *    tours (contrat de `scoreGameForGate` : les tours scorés ne dépendent pas
 *    de valueOf) ; IC `clusterBootstrapDeltaCI` (cluster = `series.matchId`
 *    préfixé du chemin du corpus), 1000 resamples, mulberry32, seed 42.
 *  - Timing (cible F-d < 2 s par décision) : mesuré sur les décisions
 *    basculées et publié sur STDERR au run — hors markdown pour préserver la
 *    byte-stabilité du rapport.
 *  - `--audit-only` : comptes STRUCTURELS seulement (records, restriction,
 *    éligibilité, tours, détecteur) — aucun TD, aucun delta, aucune valeur ;
 *    valueOf constant, aucune recherche lancée, aucun rapport écrit.
 *
 * Run :
 *   node --experimental-transform-types --no-warnings scripts/backtest/f4Endgame.ts \
 *     static/corpus/lck-2026.json [...] data/corpus/lpl-2025.json \
 *     --dataset data/datasets/current-patch.json --full-dataset data/datasets/30-days.json \
 *     [--seed 42] [--generated-at ISO] [--out docs/calibration/f4-endgame-2026.md] [--audit-only]
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

type CoachGateModule = typeof import('../../src/lib/backtest/coachGate');
type HarnessModule = typeof import('../../src/lib/backtest/coachGateHarness');
type LiveDraftModule = typeof import('../../src/lib/intel/liveDraft');
type NavigatorModule = typeof import('../../src/lib/strategic/draftNavigator');
type EndgameModule = typeof import('../../src/lib/strategic/fearlessEndgame');
type MetricsModule = typeof import('../../src/lib/backtest/metrics');
type ClusterModule = typeof import('../../src/lib/backtest/clusterBootstrap');
type WalkforwardModule = typeof import('../../src/lib/backtest/walkforward');
type TagsModule = typeof import('../../src/lib/tags');

type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type Dataset = import('../../src/lib/types').Dataset;
type NavigatorMemoEntry = import('../../src/lib/strategic/draftNavigator').NavigatorMemoEntry;
type ScoreGameDeps = import('../../src/lib/backtest/coachGate').ScoreGameDeps;
type PairedObservation = import('../../src/lib/backtest/clusterBootstrap').PairedObservation;

const { scoreGameForGate, eligibilitySkipOf } = (await import(
    `${libRootHref}/backtest/coachGate.ts`
)) as CoachGateModule;
const { buildFearlessDetector, makeFoldProvider, makeCoachTurnEngine } = (await import(
    `${libRootHref}/backtest/coachGateHarness.ts`
)) as HarnessModule;
const { enemyDistributionOf } = (await import(`${libRootHref}/intel/liveDraft.ts`)) as LiveDraftModule;
const { makeAnalyzeDraftEvaluator } = (await import(
    `${libRootHref}/strategic/draftNavigator.ts`
)) as NavigatorModule;
const { searchFearlessEndgame, ENDGAME_SPACE_MAX } = (await import(
    `${libRootHref}/strategic/fearlessEndgame.ts`
)) as EndgameModule;
const { wilson95, mulberry32 } = (await import(`${libRootHref}/backtest/metrics.ts`)) as MetricsModule;
const { clusterBootstrapDeltaCI } = (await import(
    `${libRootHref}/backtest/clusterBootstrap.ts`
)) as ClusterModule;
const { parsePatch } = (await import(`${libRootHref}/backtest/walkforward.ts`)) as WalkforwardModule;
const { loadDefaultTags } = (await import(`${libRootHref}/tags/index.ts`)) as TagsModule;

// ---- argv -------------------------------------------------------------------

const inputs: string[] = [];
let datasetPath: string | undefined;
let fullDatasetPath: string | undefined;
let outPath = 'docs/calibration/f4-endgame-2026.md';
let seed = 42;
let generatedAt = new Date().toISOString();
let auditOnly = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dataset') datasetPath = argv[++i];
    else if (arg === '--full-dataset') fullDatasetPath = argv[++i];
    else if (arg === '--out') outPath = argv[++i];
    else if (arg === '--seed') seed = Number(argv[++i]);
    else if (arg === '--generated-at') generatedAt = argv[++i];
    else if (arg === '--audit-only') auditOnly = true;
    else inputs.push(arg);
}
if (inputs.length === 0 || datasetPath === undefined || fullDatasetPath === undefined || Number.isNaN(seed)) {
    console.error(
        'Usage: node --experimental-transform-types --no-warnings scripts/backtest/f4Endgame.ts ' +
            '<corpus.json> [...] --dataset current-patch.json --full-dataset 30-days.json ' +
            '[--seed 42] [--generated-at ISO] [--out md] [--audit-only]'
    );
    process.exit(1);
}

// ---- datasets gelés (sha256 + date publiés) ----------------------------------

interface FrozenDataset {
    path: string;
    sha256: string;
    data: Dataset;
}

function loadDataset(path: string): FrozenDataset {
    const bytes = readFileSync(resolve(repoRoot, path));
    const sha256 = createHash('sha256').update(bytes).digest('hex').toUpperCase();
    return { path, sha256, data: JSON.parse(bytes.toString('utf8')) as Dataset };
}

const frozenDataset = loadDataset(datasetPath);
const frozenFullDataset = loadDataset(fullDatasetPath);
const evaluate = makeAnalyzeDraftEvaluator(
    { dataset: frozenDataset.data, fullDataset: frozenFullDataset.data },
    { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 }
);

const tagsFile = loadDefaultTags();
const tagsKeys = Object.keys(tagsFile.champions);

// ---- corpus -----------------------------------------------------------------

const corpora = inputs.map((input) => ({
    input,
    records: JSON.parse(readFileSync(resolve(repoRoot, input), 'utf8')) as DraftRecord[]
}));

// ---- scoring par corpus -------------------------------------------------------

interface GameResult {
    corpus: string;
    cluster: string;
    creditDepth2: number;
    creditExhaustive: number;
}

interface F4Coverage {
    input: string;
    records: number;
    /** Sans série ou gameNumber < 4 — hors restriction F4. */
    notEndgame: number;
    noWinner: number;
    unresolved: number;
    noFold: number;
    sideCoverage: number;
    eligible: number;
    scored: number;
    scoredTurns: number;
    templateMismatch: number;
    fewComparators: number;
    anomalies: number;
    /** Tours basculés exhaustif (spaceSize ≤ 1e6). */
    searchedTurns: number;
    /** Tours retombés depth-2 (spaceSize > 1e6) — delta nul par construction. */
    fallbackTurns: number;
    /** Plus grand espace exact effectivement basculé (déterministe). */
    maxSpaceSearched: number;
    detectorReused: number;
    detectorExamined: number;
    lockoutsOn: boolean;
    seconds: number;
}

const allGames: GameResult[] = [];
const allCoverage: F4Coverage[] = [];
const elapsedSearched: number[] = [];

for (const { input, records } of corpora) {
    const startedAt = Date.now();
    const detector = buildFearlessDetector(records);
    const foldFor = makeFoldProvider(records, generatedAt);

    const coverage: F4Coverage = {
        input,
        records: records.length,
        notEndgame: 0,
        noWinner: 0,
        unresolved: 0,
        noFold: 0,
        sideCoverage: 0,
        eligible: 0,
        scored: 0,
        scoredTurns: 0,
        templateMismatch: 0,
        fewComparators: 0,
        anomalies: 0,
        searchedTurns: 0,
        fallbackTurns: 0,
        maxSpaceSearched: 0,
        detectorReused: detector.reused,
        detectorExamined: detector.examined,
        lockoutsOn: detector.lockoutsOn,
        seconds: 0
    };

    for (const record of records) {
        // Restriction F4 d'abord (structurelle) : series.gameNumber >= 4.
        const matchId = record.series?.matchId;
        const gameNumber = record.series?.gameNumber;
        if (matchId === undefined || gameNumber === undefined || gameNumber < 4) {
            coverage.notEndgame += 1;
            continue;
        }
        // Puis l'éligibilité de A, dans l'ordre de sa règle.
        const skip = eligibilitySkipOf(record);
        if (skip === 'no-winner') {
            coverage.noWinner += 1;
            continue;
        }
        if (skip === 'unresolved-picks') {
            coverage.unresolved += 1;
            continue;
        }
        if (record.patch === undefined || parsePatch(record.patch) === undefined) {
            coverage.noFold += 1;
            continue;
        }
        const fold = foldFor(record.patch);
        if (fold === null) {
            coverage.noFold += 1;
            continue;
        }
        coverage.eligible += 1;

        const engine = makeCoachTurnEngine(record, {
            fold,
            locked: detector.lockedFor(record),
            tagsKeys,
            evaluate
        });

        const tally = (result: ReturnType<typeof scoreGameForGate>): boolean => {
            for (const turn of result.discarded) {
                if (turn.reason === 'template-mismatch') coverage.templateMismatch += 1;
                else coverage.fewComparators += 1;
            }
            coverage.anomalies += result.anomalies;
            if ('skipped' in result) {
                if (result.skipped === 'side-coverage') coverage.sideCoverage += 1;
                return false;
            }
            coverage.scored += 1;
            coverage.scoredTurns += result.score.turns.length;
            return true;
        };

        // --audit-only : mêmes tours (le contrat scoreGameForGate ne dépend
        // pas de valueOf), valueOf constant — aucune recherche, aucun taux.
        if (auditOnly) {
            tally(
                scoreGameForGate(record, {
                    availableOf: engine.availableOf,
                    candidatesOf: engine.candidatesOf,
                    valueOf: () => 0
                })
            );
            continue;
        }

        // Bras depth-2 — le bras de A à l'identique.
        const depth2Result = scoreGameForGate(record, engine.modelDeps);
        if (!tally(depth2Result) || 'skipped' in depth2Result) continue;

        // Bras exhaustif — mêmes tours, mêmes C_t, valueOf endgame F-d.
        const endgameMemoBySeq = new Map<number, Map<string, NavigatorMemoEntry>>();
        const tourDecision = new Map<number, { searched: boolean; spaceSize: number }>();
        const exhaustiveDeps: ScoreGameDeps = {
            availableOf: engine.availableOf,
            candidatesOf: engine.candidatesOf,
            valueOf: (state, slot, championKey) => {
                const entry = engine.turnEntryOf(state, slot);
                let memo = endgameMemoBySeq.get(slot.seq);
                if (memo === undefined) {
                    memo = new Map();
                    endgameMemoBySeq.set(slot.seq, memo);
                }
                const result = searchFearlessEndgame(state, {
                    ourSide: slot.side,
                    // Racine forcée par seq : le slot racine du tour ne
                    // propose QUE le candidat évalué ; plus profond, la
                    // liste shippée du tour (les mêmes injections que A).
                    ourCandidatesForSlot: (_s, sl) =>
                        sl.seq === slot.seq ? [championKey] : entry.shipped6,
                    enemyRangeForSlot: (s, sl) => enemyDistributionOf(entry.ctx, s, sl),
                    evaluate,
                    memo
                });
                tourDecision.set(slot.seq, { searched: result.searched, spaceSize: result.spaceSize });
                if (!result.searched) {
                    // spaceSize > 1e6 : retombée depth-2 pour CE tour
                    // (memo du tour déjà chaud — valeur identique au bras A).
                    return engine.modelDeps.valueOf(state, slot, championKey);
                }
                elapsedSearched.push(result.elapsedMs);
                return result.value;
            }
        };
        const exhaustiveResult = scoreGameForGate(record, exhaustiveDeps);
        if ('skipped' in exhaustiveResult) {
            // Impossible par construction (mêmes tours quel que soit valueOf).
            throw new Error(`f4: bras exhaustif désynchronisé sur ${record.gameId}`);
        }
        for (const decision of tourDecision.values()) {
            if (decision.searched) {
                coverage.searchedTurns += 1;
                if (decision.spaceSize > coverage.maxSpaceSearched) {
                    coverage.maxSpaceSearched = decision.spaceSize;
                }
            } else {
                coverage.fallbackTurns += 1;
            }
        }

        allGames.push({
            corpus: input,
            cluster: `${input}::${matchId}`,
            creditDepth2: depth2Result.score.credit,
            creditExhaustive: exhaustiveResult.score.credit
        });
    }

    coverage.seconds = (Date.now() - startedAt) / 1000;
    allCoverage.push(coverage);
    if (!auditOnly) {
        console.error(
            `[f4] ${input} : ${coverage.scored} games scorées en ${coverage.seconds.toFixed(1)} s`
        );
    }
}

// ---- audit aveugle : comptes structurels, AUCUN taux ---------------------------

if (auditOnly) {
    for (const c of allCoverage) {
        console.log(`[audit] corpus ${c.input}`);
        console.log(
            `[audit] détecteur Fearless : ${c.detectorReused} pick(s) réutilisé(s) / ` +
                `${c.detectorExamined} examiné(s) → lockouts ${c.lockoutsOn ? 'ON' : 'OFF'}`
        );
        console.log(
            `[audit] records ${c.records} · hors restriction (sans série ou gameNumber < 4) ${c.notEndgame} · ` +
                `skips : no-winner ${c.noWinner} · unresolved-picks ${c.unresolved} · ` +
                `no-fold ${c.noFold} · side-coverage ${c.sideCoverage}`
        );
        console.log(
            `[audit] games G4-5 éligibles ${c.eligible} · scorées ${c.scored} · tours scorés ${c.scoredTurns}`
        );
        console.log(
            `[audit] tours écartés : template-mismatch ${c.templateMismatch} · ` +
                `too-few-comparators ${c.fewComparators} · anomalies ${c.anomalies}`
        );
        console.log(`[audit] durée ${c.seconds.toFixed(1)} s`);
    }
    process.exit(0);
}

// ---- agrégation (wilson95 descriptif + bootstrap clusterisé, seed publié) ------

const unsignZero = (s: string): string => (/^-0(?:\.0+)?$/.test(s) ? s.slice(1) : s);
const pct = (x: number): string => unsignZero((100 * x).toFixed(1));
const pp = (x: number): string => unsignZero((100 * x).toFixed(2));
const sum = (xs: number[]): number => xs.reduce((acc, x) => acc + x, 0);

const n = allGames.length;
const obs: PairedObservation[] = allGames.map((g) => ({
    cluster: g.cluster,
    model: g.creditExhaustive,
    baseline: g.creditDepth2
}));
const delta = clusterBootstrapDeltaCI(obs, { iterations: 1000, rng: mulberry32(seed) });

type F4Color = 'VERT' | 'NON CONCLUANT' | 'EXHAUSTIF PIRE';
const color: F4Color =
    n > 0 && delta.ci95.lo > 0 ? 'VERT' : n > 0 && delta.ci95.hi < 0 ? 'EXHAUSTIF PIRE' : 'NON CONCLUANT';
const colorExplain: Record<F4Color, string> = {
    VERT: 'lo > 0 — le claim « recherche profonde validée » est débloqué (§3.4).',
    'NON CONCLUANT':
        "l'issue ASSUMÉE d'avance (MDE ≈ ±8 pp ≫ effet attendu ~2 pp) — F-d ship Expérimental " +
        "(DA-V2-11) sur la seule garantie d'ingénierie (espace ≤ 10⁶, < 2 s). Aucun pooling " +
        'post-hoc, aucune tranche supplémentaire.',
    'EXHAUSTIF PIRE':
        'hi < 0 — F-d non branché, enquête (évaluateur bruité sur-exploité par la profondeur).'
};

const tdRow = (label: string, credits: number): string => {
    if (n === 0) return `| ${label} | 0 | — | — |`;
    const ci = wilson95(credits, n);
    return `| ${label} | ${n} | ${pct(credits / n)} % | [${pct(ci.lo)} ; ${pct(ci.hi)}] % |`;
};

// Timing (cible F-d < 2 s par décision) : STDERR seulement — byte-stabilité.
if (elapsedSearched.length > 0) {
    const sorted = [...elapsedSearched].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const max = sorted[sorted.length - 1];
    console.error(
        `[f4] timing exhaustif : ${elapsedSearched.length} décision(s) basculée(s), ` +
            `médiane ${median.toFixed(1)} ms, max ${max.toFixed(1)} ms (cible F-d < 2 000 ms)`
    );
} else {
    console.error('[f4] timing exhaustif : aucune décision basculée.');
}

// ---- rapport markdown (byte-stable à seed/--generated-at fixés) ----------------

const rows: string[] = [
    '# F4 — endgame solver : delta apparié, jamais gate isolée (run #2, chantier F)',
    '',
    `> Généré : ${generatedAt} · seed ${seed} · règle pré-enregistrée recopiée verbatim dans`,
    "> l'en-tête de `scripts/backtest/f4Endgame.ts` (gel : `docs/run2/F-pocket-picks.md` §3.4 — UNE règle, UN run).",
    `> Datasets DraftGap gelés : \`${basename(frozenDataset.path)}\` sha256 \`${frozenDataset.sha256}\` (date ${frozenDataset.data.date}) ·`,
    `> \`${basename(frozenFullDataset.path)}\` sha256 \`${frozenFullDataset.sha256}\` (date ${frozenFullDataset.data.date}).`,
    '',
    '## La question mesurée (pourquoi ce bras)',
    '',
    'F-d (le solveur exhaustif de fin de série Fearless) prétend-il MIEUX classer que le',
    'depth-2 shippé du panneau Coach ? Méthodologie de la gate A restreinte aux games de',
    'gameNumber ≥ 4 : les DEUX bras rejouent les MÊMES tours avec les MÊMES C_t et les',
    'mêmes injections ; seul valueOf change (navigate depth 2 vs recherche exhaustive',
    `bornée espace ≤ ${ENDGAME_SPACE_MAX.toExponential(0).replace('e+', 'e')}). Delta de TD apparié par game ; **MDE DÉCLARÉ ≈ ±8 pp — très`,
    "au-dessus de l'effet attendu (~2 pp) : l'issue « non concluant » est ASSUMÉE",
    "d'avance** et publiée telle quelle. Jamais gate isolée : aucun vert d'un autre",
    'chantier ne dépend de ce bras.',
    '',
    '## Verdict (règle gelée §3.4)',
    '',
    '| Statistique | Valeur | IC 95 % | Exigence VERT | Lecture |',
    '|---|---|---|---|---|',
    n > 0
        ? `| Δ TD exhaustif − depth-2 (bootstrap clusterisé par série) | ${pp(delta.delta)} pp | [${pp(delta.ci95.lo)} ; ${pp(delta.ci95.hi)}] pp | borne basse > 0 | ${color} |`
        : '| Δ TD exhaustif − depth-2 (bootstrap clusterisé par série) | — | — | borne basse > 0 | NON CONCLUANT |',
    '',
    `**Issue : ${color}** — ${colorExplain[color]}`,
    '',
    n > 0
        ? `Δ apparié : ${pp(delta.delta)} pp, IC 95 % bootstrap clusterisé [${pp(delta.ci95.lo)} ; ${pp(delta.ci95.hi)}] pp (${delta.clusters} clusters, ${delta.observations} games, 1000 resamples, seed ${seed}).`
        : 'Δ apparié : — (aucune game scorée).',
    '',
    '## TD par bras (descriptif, Wilson 95 % — le verdict ne lit que le delta)',
    '',
    '| Bras | n games | TD | Wilson 95 % |',
    '|---|---|---|---|',
    tdRow('depth-2 (le bras de A)', sum(allGames.map((g) => g.creditDepth2))),
    tdRow('exhaustif (F-d)', sum(allGames.map((g) => g.creditExhaustive))),
    '',
    '## Couverture',
    ''
];

for (const c of allCoverage) {
    rows.push(
        `- ${basename(c.input)} : ${c.records} records → ${c.notEndgame} hors restriction ` +
            `(sans série ou gameNumber < 4) → ${c.eligible} éligibles ` +
            `(${c.noWinner} sans vainqueur, ${c.unresolved} avec picks non résolus, ${c.noFold} sans fold) → ` +
            `${c.scored} scorées (${c.sideCoverage} écartées side-coverage) · ${c.scoredTurns} tours scorés ` +
            `(écartés : ${c.templateMismatch} template-mismatch, ${c.fewComparators} too-few-comparators) · ` +
            `bras exhaustif : ${c.searchedTurns} tours basculés, ${c.fallbackTurns} retombées depth-2 ` +
            `(plus grand espace basculé ${c.maxSpaceSearched}) · anomalies ${c.anomalies}.`
    );
}
rows.push('', "Détecteur Fearless (picks réutilisés entre games d'une même série / picks examinés) :", '');
for (const c of allCoverage) {
    rows.push(
        `- ${basename(c.input)} : ${c.detectorReused}/${c.detectorExamined} → lockouts ${c.lockoutsOn ? 'ON' : 'OFF'}`
    );
}

rows.push(
    '',
    '## Notes honnêtes',
    '',
    '- **MDE ≈ ±8 pp, déclaré AVANT le run** : n attendu ~174 games (125 G4 + 49 G5,',
    "  ~125 clusters) — très au-dessus de l'effet attendu (~2 pp). « Non concluant » est",
    "  l'issue pré-assumée ; elle sera publiée telle quelle, sans pooling post-hoc ni",
    '  tranche supplémentaire.',
    '- **Appariement strict** : mêmes games, mêmes tours, mêmes C_t (contrat',
    '  `scoreGameForGate` : les tours scorés ne dépendent pas de valueOf) — le delta ne',
    '  mesure QUE le changement de recherche.',
    '- **Retombées depth-2** : un tour dont l\'espace exact dépasse 10⁶ garde la valeur',
    '  depth-2 dans les DEUX bras — sa contribution au delta est structurellement nulle ;',
    '  le compte par corpus est publié dans la Couverture. La bascule ne se déclenche',
    "  naturellement qu'en toute fin de draft, là où l'enjeu Fearless est maximal.",
    '- **Folds et lockouts de A, corpus ENTIER** : la restriction gameNumber ≥ 4 ne',
    '  filtre que les games scorées — le train et le détecteur Fearless voient tout le',
    '  corpus (les picks G1-G3 de la série nourrissent les lockouts de G4/G5).',
    '- **Timing** : la cible F-d (< 2 s par décision basculée) est mesurée et publiée sur',
    '  STDERR au run — hors markdown pour préserver la byte-stabilité du rapport.',
    '- **Clusters** : `series.matchId` préfixé par le chemin du corpus ; la restriction',
    '  garantit que chaque game scorée appartient à une série.',
    `- Seed ${seed} · \`--generated-at\` ${generatedAt} · rapport byte-stable à seed/horodatage fixés.`,
    ''
);

const markdown = rows.join('\n');
const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, markdown, 'utf8');
console.log(markdown);
console.log(`Écrit : ${absOut}`);
