/**
 * Chantier E — Calibration Platt par position de séquence (run #2).
 *
 * RÈGLE PRÉ-ENREGISTRÉE — Calibration Platt par position de séquence (chantier E, run #2).
 * Gelée le 2026-06-11 AVANT toute exécution sur données réelles. Un rouge se documente, ne se retune pas.
 *
 * CORPUS (7 fichiers, fixés — LCK 2025 indisponible, exclu par construction ; l'ajouter
 * plus tard = NOUVEAU run de réplication, jamais une fusion silencieuse) :
 *   static/corpus/lck-2026.json · lec-2026.json · lfl-2026.json · lpl-2026.json
 *   data/corpus/lec-2025.json · lfl-2025.json · lpl-2025.json
 *
 * ÉLIGIBILITÉ (un SEUL ensemble, partagé par les trois positions) : un record est
 * éligible ssi (a) winner défini, (b) 10 picks rôle-complets — clé résolue + rôle
 * présent + pas de rôle dupliqué par side, même règle compOf que postdiction G1 —,
 * (c) patch parsable (parsePatch). Tout record écarté est compté dans les notes.
 *
 * PRÉDICTEUR BRUT (la chose calibrée = le pipeline shippé, config du coach) :
 *   p_raw(g, pos) = analyzeDraft(dataset, blue(g,pos), red(g,pos),
 *       { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 },
 *       fullDataset).winrate          // = P(victoire BLEUE), aucune autre option
 *   - Équipes = rôles RÉELS du corpus (Map rôle→champion), préfixe par seq :
 *       afterBans    : actions seq ≤ 6   (0 pick par side — p_raw ≡ 0,5 par construction)
 *       after3Picks  : actions seq ≤ 9   (1 pick premier side, 2 picks second side)
 *       fullDraft    : actions seq ≤ 20  (5 + 5)
 *   - Aucun playerContext, aucun sideContext (config « plain » du coach, +page.svelte).
 *   - Datasets : snapshot DraftGap CDN (current-patch.json + 30-days.json) tiré et
 *     HASHÉ (sha256 publiés dans le rapport) AVANT le run ; jamais re-tiré ensuite.
 *   Cible : won = (winner === 'blue').
 *
 * PROTOCOLE : timeline POOLÉE des 7 corpus (les patchs 25.x précèdent tous les 26.x),
 * groupByPatch / walkForward (src/lib/backtest/walkforward.ts), minTrainSize = 50
 * records. Par fold (= patch testé) et PAR POSITION :
 *   (a,b) = plattFit(paires du train)   // module gelé src/lib/estimators/platt.ts
 *   prédiction de test = plattApply((a,b), p_raw)
 * Trois bras par position : CALIBRÉ σ(a+b·logit(p_raw)) · NON CALIBRÉ p_raw ·
 * PIÈCE p = 0,5. Quatrième bras DESCRIPTIF (contexte, sans pouvoir de verdict) :
 * side-only = winrate blue du train (baseline M3.5 du protocole).
 *
 * TIMELINE ATTENDUE (gelée — ordre groupByPatch/comparePatches des 7 corpus, 26 groupes) :
 *   14.16 → 25.S1.1 → 25.S1.2 → 25.S1.3 → 25.04 → 25.06 → 25.07 → 25.08 → 25.09
 *   → 25.10 → 25.11 → 25.14 → 25.15 → 25.16 → 25.17 → 25.18 → 26.01 → 26.02 → 26.03
 *   → 26.04 → 26.06 → 26.07 → 26.08 → 26.09 → 26.10 → 26.11
 *   Note de parsing : '25.S1.x' parse {25,0} (le « S » interrompt le minor) et
 *   s'ordonne par le fallback lexical de comparePatches — placement correct ICI par
 *   construction des données, vérifié par l'assertion croisée ordre-patch vs
 *   chronologie du script (abort avant toute métrique sinon). Note de couverture :
 *   le groupe 14.16 (11 records, tous lfl-2025) ouvre la timeline en train-only
 *   sous minTrainSize = 50.
 *
 * MÉTRIQUES PUBLIÉES par position, sur les paires de test poolées : Brier, log loss,
 * accuracy des trois bras ; diagramme de fiabilité 10 bacs (n, meanP, taux observé
 * avec Wilson 95 % par bac, gap) pour CALIBRÉ et NON CALIBRÉ.
 *
 * CRITÈRE DE VERDICT (primaire, indépendant par position) :
 *   ΔBrier = Brier(calibré) − Brier(non calibré), IC bootstrap 95 % APPARIÉ par game
 *   (1000 resamples, mulberry32(seed 42), ordre des IC fixe : afterBans Brier,
 *   afterBans logLoss, after3Picks Brier, after3Picks logLoss, fullDraft Brier,
 *   fullDraft logLoss).
 *   VERT ssi ci95.hi < 0 (le Brier calibré est significativement meilleur).
 *   Δ log loss : publié, secondaire, descriptif seulement.
 * GARDE SUPPLÉMENTAIRE : une position n'est validée que si, AU FIT FINAL, b > 0
 * (une calibration qui inverse l'ordre violerait le contrat « ne touche pas au tri »).
 *
 * ATTENDU DÉCLARÉ D'AVANCE : à afterBans, p_raw ≡ 0,5 (l'évaluateur ne voit ni les
 * bans ni le side) ⇒ la calibration y dégénère en side-only (b sans information,
 * a = logit du taux blue du train). Le verdict 2026 « side-only ≈ pile-ou-face »
 * rend un ROUGE probable sur cette position ; ce rouge serait une CONFIRMATION
 * d'honnêteté (le 50 % affiché après bans est déjà honnête), pas un échec.
 *
 * PARAMS SHIPPÉS : l'artefact data/calibration/winCalibration.json est TOUJOURS
 * écrit à l'issue du run, quel que soit le verdict — un fit par position sur la
 * TOTALITÉ des paires éligibles des 7 corpus (full-fit standard, déclaré ici, jamais
 * utilisé pour les métriques) : { a, b, nTrain, validated } par position +
 * provenance (corpora, nGames, fittedThroughPatch, sha256 des datasets, generatedAt,
 * seed). « Shippé/appliqué par l'UI » = validated:true par position, avec
 * validated = (verdict VERT) ∧ (b_final > 0) ; un verdict tout-rouge produit donc
 * un JSON tout validated:false. L'UI n'applique JAMAIS une position validated:false.
 *
 * LIMITE DOCUMENTÉE (reprise verbatim dans le rapport) : le snapshot SoloQ est
 * « d'aujourd'hui » et évalue des games 2025-2026 (fuite de features M3.x connue).
 * Elle contamine p_raw À L'IDENTIQUE dans les bras calibré et non calibré (comparaison
 * appariée interne valide) ; le claim autorisé porte sur la CARTE DE CALIBRATION,
 * jamais sur la force prédictive de l'évaluateur. Aucun « on prédit le vainqueur ».
 *
 * DEUX APPROXIMATIONS D'APPLICATION (déclarées ici, reprises dans le rapport et
 * l'aide produit) :
 *   (a) la calibration est mesurée aux trois ancres 0 / 3 / 10 picks verrouillés ;
 *       une position intermédiaire reçoit la carte de l'ancre que la partition
 *       positionOf lui assigne (0 → afterBans ; 1..6 → after3Picks ; 7..10 →
 *       fullDraft), jamais une interpolation ;
 *   (b) à l'application, le % du coach passe par des rôles INFÉRÉS et le mode
 *       séquence par l'argmax des rolePriors, alors que la mesure utilise les
 *       rôles RÉELS du corpus — l'écart d'attribution de rôles n'est pas couvert
 *       par le claim.
 *
 * Patron : scripts/backtest/postdiction.ts (hooks node, résolution $lib, argv).
 * Aucune logique de scoring nouvelle ici : walkforward.ts, metrics.ts, platt.ts
 * et sequencePositions.ts suffisent — le script ne fait qu'assembler.
 *
 * Run : node --experimental-transform-types --no-warnings scripts/backtest/winCalibration.ts \
 *         static/corpus/lck-2026.json static/corpus/lec-2026.json static/corpus/lfl-2026.json \
 *         static/corpus/lpl-2026.json data/corpus/lec-2025.json data/corpus/lfl-2025.json \
 *         data/corpus/lpl-2025.json \
 *         --dataset data/datasets/current-patch.json \
 *         --full-dataset data/datasets/30-days.json \
 *         [--seed 42] [--generated-at ISO] \
 *         [--out docs/calibration/win-calibration-2026.md] \
 *         [--params-out data/calibration/winCalibration.json]
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

type AnalyzerModule = typeof import('../../src/lib/engine/analyzer');
type MetricsModule = typeof import('../../src/lib/backtest/metrics');
type WalkforwardModule = typeof import('../../src/lib/backtest/walkforward');
type PlattModule = typeof import('../../src/lib/estimators/platt');
type SequencePositionsModule = typeof import('../../src/lib/backtest/sequencePositions');
type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type Dataset = import('../../src/lib/types').Dataset;
type AnalyzeDraftConfig = import('../../src/lib/types').AnalyzeDraftConfig;
type PredictionPair = import('../../src/lib/backtest/metrics').PredictionPair;
type BootstrapDelta = import('../../src/lib/backtest/metrics').BootstrapDelta;
type PlattParams = import('../../src/lib/estimators/platt').PlattParams;
type CalibrationPositionId = import('../../src/lib/backtest/sequencePositions').CalibrationPositionId;
type WalkForwardResult = import('../../src/lib/backtest/walkforward').WalkForwardResult;
type WalkForwardAggregate = import('../../src/lib/backtest/walkforward').WalkForwardAggregate;

const { analyzeDraft } = (await import(`${libRootHref}/engine/analyzer.ts`)) as AnalyzerModule;
const { bootstrapDeltaCI, brier, logLoss, mulberry32, reliabilityBins, wilson95 } = (await import(
    `${libRootHref}/backtest/metrics.ts`
)) as MetricsModule;
const { groupByPatch, walkForward } = (await import(
    `${libRootHref}/backtest/walkforward.ts`
)) as WalkforwardModule;
const { plattApply, plattFit } = (await import(`${libRootHref}/estimators/platt.ts`)) as PlattModule;
const { CALIBRATION_POSITIONS, isCalibrationEligible, roleTeamsAt } = (await import(
    `${libRootHref}/backtest/sequencePositions.ts`
)) as SequencePositionsModule;

// ---- argv -------------------------------------------------------------------

const inputs: string[] = [];
let datasetPath: string | null = null;
let fullDatasetPath: string | null = null;
let seed = 42;
let generatedAt = new Date().toISOString();
let outPath = 'docs/calibration/win-calibration-2026.md';
let paramsOutPath = 'data/calibration/winCalibration.json';
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dataset') datasetPath = argv[++i];
    else if (argv[i] === '--full-dataset') fullDatasetPath = argv[++i];
    else if (argv[i] === '--seed') seed = Number(argv[++i]);
    else if (argv[i] === '--generated-at') generatedAt = argv[++i];
    else if (argv[i] === '--out') outPath = argv[++i];
    else if (argv[i] === '--params-out') paramsOutPath = argv[++i];
    else inputs.push(argv[i]);
}
if (inputs.length === 0 || datasetPath === null || fullDatasetPath === null || !Number.isFinite(seed)) {
    console.error(
        'Usage: node --experimental-transform-types --no-warnings scripts/backtest/winCalibration.ts ' +
            '<corpus.json> [...] --dataset <current-patch.json> --full-dataset <30-days.json> ' +
            '[--seed 42] [--generated-at ISO] [--out md] [--params-out json]'
    );
    process.exit(1);
}

function abort(message: string): never {
    console.error(`ABORT — ${message}`);
    return process.exit(1);
}

// ---- datasets SoloQ : hashés AVANT toute métrique (règle gelée) ---------------

interface LoadedDataset {
    path: string;
    sha256: string;
    dataset: Dataset;
}

function loadDataset(path: string, label: string): LoadedDataset {
    const bytes = readFileSync(resolve(repoRoot, path));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    let dataset: Dataset;
    try {
        dataset = JSON.parse(bytes.toString('utf8')) as Dataset;
    } catch (error) {
        return abort(`le dataset ${label} (${path}) ne parse pas en JSON : ${String(error)}`);
    }
    if (Object.keys(dataset.championData ?? {}).length === 0) {
        return abort(`le dataset ${label} (${path}) ne ressemble pas à un Dataset : championData vide.`);
    }
    return { path, sha256, dataset };
}

const current = loadDataset(datasetPath, 'current-patch');
const full = loadDataset(fullDatasetPath, '30-days');

// ---- 1+2. corpus, éligibilité, unicité des gameId sur l'union ----------------

interface EligibleGame {
    patch?: string;
    record: DraftRecord;
    source: string;
}

interface CorpusCoverage {
    input: string;
    records: number;
    eligible: number;
    discarded: number;
}

const coverage: CorpusCoverage[] = [];
const eligible: EligibleGame[] = [];
// Unicité sur l'union des corpus CHARGÉS (pas seulement éligibles) : le cache
// p_raw est indexé par gameId, une collision silencieuse croiserait deux games.
const seenGameIds = new Map<string, string>();
for (const input of inputs) {
    const records = JSON.parse(readFileSync(resolve(repoRoot, input), 'utf8')) as DraftRecord[];
    let kept = 0;
    for (const record of records) {
        const firstSource = seenGameIds.get(record.gameId);
        if (firstSource !== undefined) {
            abort(
                `gameId dupliqué sur l'union des corpus : ${record.gameId} ` +
                    `(${firstSource} puis ${input}) — collision interdite avant toute métrique.`
            );
        }
        seenGameIds.set(record.gameId, input);
        if (!isCalibrationEligible(record)) continue;
        kept++;
        eligible.push({ patch: record.patch, record, source: input });
    }
    coverage.push({ input, records: records.length, eligible: kept, discarded: records.length - kept });
}
if (eligible.length === 0) abort('aucun record éligible — rien à calibrer.');

// ---- 2 (suite). pré-calcul p_raw par (game, position), UNE seule fois --------

const ANALYZE_CONFIG: AnalyzeDraftConfig = {
    ignoreChampionWinrates: false,
    riskLevel: 'medium',
    minGames: 0
};

const rawByGame = new Map<string, Record<CalibrationPositionId, number>>();
for (const game of eligible) {
    const entry = {} as Record<CalibrationPositionId, number>;
    for (const position of CALIBRATION_POSITIONS) {
        const teams = roleTeamsAt(game.record, position.maxSeq);
        if (teams === undefined) {
            abort(
                `préfixe non scorable sur un record éligible (${game.record.gameId}, seq ≤ ${position.maxSeq}) ` +
                    `— incohérence d'éligibilité (jamais attendu : un record éligible a tous ses préfixes valides).`
            );
        }
        entry[position.id] = analyzeDraft(
            current.dataset,
            teams.blue,
            teams.red,
            ANALYZE_CONFIG,
            full.dataset
        ).winrate;
    }
    rawByGame.set(game.record.gameId, entry);
}

const rawOf = (game: EligibleGame, position: CalibrationPositionId): number =>
    rawByGame.get(game.record.gameId)![position];

// ---- 3. assertion croisée ordre-patch vs chronologie (AVANT tout scoring) ----

const groups = groupByPatch(eligible);

function minDateOf(items: EligibleGame[]): string | undefined {
    let min: string | undefined;
    for (const item of items) {
        const date = item.record.date;
        if (date === undefined) continue;
        if (min === undefined || date < min) min = date;
    }
    return min;
}

{
    let previousPatch: string | null = null;
    let previousMin: string | undefined;
    for (const group of groups) {
        const min = minDateOf(group.items);
        if (min === undefined) {
            abort(
                `le groupe de patch ${group.patch} ne porte aucune date — ` +
                    `l'assertion ordre-patch vs chronologie est invérifiable.`
            );
        }
        if (previousPatch !== null && previousMin !== undefined && min < previousMin) {
            abort(
                `l'ordre des patchs contredit la chronologie : min(date) de ${group.patch} (${min}) ` +
                    `< min(date) de ${previousPatch} (${previousMin}).`
            );
        }
        previousPatch = group.patch;
        previousMin = min;
    }
}

// ---- replay de la structure des folds (timeline + lignes par corpus) ---------
// Reproduit exactement la règle de walkForward : un groupe est scoré ssi le
// train cumulé des groupes précédents atteint minTrainSize ; les groupes
// train-only sont donc un préfixe de la timeline.

const MIN_TRAIN_SIZE = 50;

interface GroupSummary {
    patch: string;
    n: number;
    scored: boolean;
}

const groupSummaries: GroupSummary[] = [];
const scoredGames: EligibleGame[] = [];
{
    let trainCount = 0;
    for (const group of groups) {
        const scored = trainCount >= MIN_TRAIN_SIZE;
        groupSummaries.push({ patch: group.patch, n: group.items.length, scored });
        if (scored) scoredGames.push(...group.items);
        trainCount += group.items.length;
    }
}
const scoredGroups = groupSummaries.filter((g) => g.scored);
const trainOnlyGroups = groupSummaries.filter((g) => !g.scored);

// ---- 4. les quatre bras walk-forward par position (MÊMES items appariés) -----

const isBlueWin = (game: EligibleGame): boolean => game.record.winner === 'blue';
const plattPairsOf = (games: EligibleGame[], position: CalibrationPositionId) =>
    games.map((game) => ({ p: rawOf(game, position), won: isBlueWin(game) }));

interface PositionArms {
    calibrated: WalkForwardResult;
    uncalibrated: WalkForwardResult;
    coin: WalkForwardResult;
    sideOnly: WalkForwardResult;
}

const armsByPosition = new Map<CalibrationPositionId, PositionArms>();
for (const position of CALIBRATION_POSITIONS) {
    const calibrated = walkForward<EligibleGame, PlattParams>(eligible, {
        fit: (train) => plattFit(plattPairsOf(train, position.id)),
        predict: (params, game) => plattApply(params, rawOf(game, position.id)),
        outcome: isBlueWin,
        minTrainSize: MIN_TRAIN_SIZE
    });
    const uncalibrated = walkForward<EligibleGame, null>(eligible, {
        fit: () => null,
        predict: (_, game) => rawOf(game, position.id),
        outcome: isBlueWin,
        minTrainSize: MIN_TRAIN_SIZE
    });
    const coin = walkForward<EligibleGame, null>(eligible, {
        fit: () => null,
        predict: () => 0.5,
        outcome: isBlueWin,
        minTrainSize: MIN_TRAIN_SIZE
    });
    const sideOnly = walkForward<EligibleGame, number>(eligible, {
        fit: (train) => train.filter(isBlueWin).length / train.length,
        predict: (blueRate) => blueRate,
        outcome: isBlueWin,
        minTrainSize: MIN_TRAIN_SIZE
    });
    // Garde de plomberie : l'alignement index à index des paires des quatre bras
    // est la condition du chemin apparié de bootstrapDeltaCI.
    for (const arm of [calibrated, uncalibrated, coin, sideOnly]) {
        if (arm.aggregate.n !== scoredGames.length) {
            abort('replay des folds incohérent avec walkForward — paires non alignées.');
        }
    }
    armsByPosition.set(position.id, { calibrated, uncalibrated, coin, sideOnly });
}

// ---- 5. six IC bootstrap dans l'ordre GELÉ, un seul flux mulberry32(seed) ----

const rng = mulberry32(seed);

interface PositionDeltas {
    brier: BootstrapDelta;
    logLoss: BootstrapDelta;
}

const deltasByPosition = new Map<CalibrationPositionId, PositionDeltas>();
for (const position of CALIBRATION_POSITIONS) {
    const arms = armsByPosition.get(position.id)!;
    const dBrier = bootstrapDeltaCI(arms.calibrated.aggregate.pairs, arms.uncalibrated.aggregate.pairs, brier, {
        iterations: 1000,
        rng
    });
    const dLogLoss = bootstrapDeltaCI(
        arms.calibrated.aggregate.pairs,
        arms.uncalibrated.aggregate.pairs,
        logLoss,
        { iterations: 1000, rng }
    );
    deltasByPosition.set(position.id, { brier: dBrier, logLoss: dLogLoss });
}

const isGreen = (position: CalibrationPositionId): boolean =>
    deltasByPosition.get(position)!.brier.ci95.hi < 0;

// ---- 7 (calcul). fit final full-data — déclaré, n'alimente AUCUNE métrique ---

interface FinalFit {
    a: number;
    b: number;
    nTrain: number;
    validated: boolean;
}

const finalFits = new Map<CalibrationPositionId, FinalFit>();
for (const position of CALIBRATION_POSITIONS) {
    const params = plattFit(plattPairsOf(eligible, position.id));
    finalFits.set(position.id, {
        a: params.a,
        b: params.b,
        nTrain: eligible.length,
        validated: isGreen(position.id) && params.b > 0
    });
}

// ---- 6. rapport markdown ------------------------------------------------------

const CAVEAT_M3X = [
    'LIMITE DOCUMENTÉE (reprise verbatim dans le rapport) : le snapshot SoloQ est',
    '« d\'aujourd\'hui » et évalue des games 2025-2026 (fuite de features M3.x connue).',
    'Elle contamine p_raw À L\'IDENTIQUE dans les bras calibré et non calibré (comparaison',
    'appariée interne valide) ; le claim autorisé porte sur la CARTE DE CALIBRATION,',
    'jamais sur la force prédictive de l\'évaluateur. Aucun « on prédit le vainqueur ».'
].join('\n');

const APPLICATION_APPROXIMATIONS = [
    'DEUX APPROXIMATIONS D\'APPLICATION (déclarées ici, reprises dans le rapport et',
    'l\'aide produit) :',
    '  (a) la calibration est mesurée aux trois ancres 0 / 3 / 10 picks verrouillés ;',
    '      une position intermédiaire reçoit la carte de l\'ancre que la partition',
    '      positionOf lui assigne (0 → afterBans ; 1..6 → after3Picks ; 7..10 →',
    '      fullDraft), jamais une interpolation ;',
    '  (b) à l\'application, le % du coach passe par des rôles INFÉRÉS et le mode',
    '      séquence par l\'argmax des rolePriors, alors que la mesure utilise les',
    '      rôles RÉELS du corpus — l\'écart d\'attribution de rôles n\'est pas couvert',
    '      par le claim.'
].join('\n');

const ATTENDU_AFTERBANS = [
    'ATTENDU DÉCLARÉ D\'AVANCE : à afterBans, p_raw ≡ 0,5 (l\'évaluateur ne voit ni les',
    'bans ni le side) ⇒ la calibration y dégénère en side-only (b sans information,',
    'a = logit du taux blue du train). Le verdict 2026 « side-only ≈ pile-ou-face »',
    'rend un ROUGE probable sur cette position ; ce rouge serait une CONFIRMATION',
    'd\'honnêteté (le 50 % affiché après bans est déjà honnête), pas un échec.'
].join('\n');

const fr = (value: number, digits: number): string =>
    Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '—';
const frPct = (value: number, digits = 1): string =>
    Number.isFinite(value) ? `${(100 * value).toFixed(digits).replace('.', ',')} %` : '—';
const frInterval = (lo: number, hi: number, digits: number): string =>
    Number.isFinite(lo) && Number.isFinite(hi) ? `[${fr(lo, digits)} ; ${fr(hi, digits)}]` : '[— ; —]';

const POSITION_TITLES: Record<CalibrationPositionId, string> = {
    afterBans: 'afterBans — après la première phase de bans (seq ≤ 6, 0 pick verrouillé)',
    after3Picks: 'after3Picks — après les trois premiers picks (seq ≤ 9)',
    fullDraft: 'fullDraft — draft complète verrouillée (seq ≤ 20, 5 + 5 picks)'
};

function armRow(label: string, aggregate: WalkForwardAggregate): string {
    return `| ${label} | ${aggregate.n} | ${fr(aggregate.brier, 4)} | ${fr(aggregate.logLoss, 4)} | ${frPct(aggregate.accuracy)} |`;
}

function reliabilityTable(pairs: PredictionPair[]): string[] {
    const rows = [
        '| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |',
        '|---|---|---|---|---|---|'
    ];
    for (const bin of reliabilityBins(pairs, 10)) {
        const range = `[${fr(bin.lo, 1)} ; ${fr(bin.hi, 1)}${bin.hi === 1 ? ']' : ')'}`;
        if (bin.n === 0) {
            rows.push(`| ${range} | 0 | — | — | — | — |`);
            continue;
        }
        const wilson = wilson95(Math.round(bin.actualRate * bin.n), bin.n);
        rows.push(
            `| ${range} | ${bin.n} | ${frPct(bin.meanP)} | ${frPct(bin.actualRate)} | ` +
                `${frInterval(100 * wilson.lo, 100 * wilson.hi, 1)} % | ${fr(100 * bin.gap, 1)} pp |`
        );
    }
    return rows;
}

function verdictLine(position: CalibrationPositionId): string {
    const arms = armsByPosition.get(position)!;
    const delta = deltasByPosition.get(position)!.brier;
    if (arms.calibrated.aggregate.n === 0) {
        return (
            'ROUGE — aucune paire de test (timeline entière sous minTrainSize = 50) : ' +
            'verdict impossible, position non validée.'
        );
    }
    return isGreen(position)
        ? 'VERT — l\'IC 95 % de ΔBrier est entièrement négatif : le % calibré est mesurablement plus honnête que le % brut.'
        : `ROUGE — l'IC 95 % de ΔBrier (${frInterval(delta.ci95.lo, delta.ci95.hi, 5)}) ne reste pas sous 0 : ` +
              'pas d\'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).';
}

const timelineLine = groupSummaries
    .map((g) => `${g.patch} (${g.n}${g.scored ? '' : ', train-only'})`)
    .join(' → ');

const indicesByCorpus = new Map<string, number[]>();
scoredGames.forEach((game, index) => {
    const list = indicesByCorpus.get(game.source);
    if (list) list.push(index);
    else indicesByCorpus.set(game.source, [index]);
});
const pairsAt = (pairs: PredictionPair[], indices: number[]): PredictionPair[] =>
    indices.map((i) => pairs[i]);

const rows: string[] = [
    '# Calibration Platt par position de séquence — chantier E, run #2',
    '',
    `> Généré : ${generatedAt} · seed ${seed} (mulberry32, 1000 resamples, IC appariés par game)`,
    '> Règle pré-enregistrée gelée dans l\'en-tête de `scripts/backtest/winCalibration.ts` — un rouge se documente, ne se retune pas.',
    '',
    '## Comment lire ce rapport (pour le drafteur)',
    '',
    'Calibrer, c\'est rendre le % affiché honnête : quand l\'outil dit « 60 % », l\'équipe devrait',
    'gagner environ 60 % de ces games-là. La carte de Platt (deux paramètres a et b par position de',
    'draft) redresse le % brut de l\'évaluateur sans changer l\'ordre des candidats (b > 0 exigé).',
    'Le verdict, par position : VERT ssi l\'IC bootstrap 95 % de ΔBrier = Brier(calibré) − Brier(brut)',
    'est entièrement sous 0 — c\'est-à-dire si le redressement améliore significativement l\'erreur',
    'quadratique des probabilités. Le Δ log loss est publié à titre descriptif (secondaire, déclaré',
    'd\'avance). Ce rapport ne prétend JAMAIS prédire le vainqueur — seulement rendre le % honnête.',
    '',
    '## Datasets SoloQ (figés et hashés AVANT le run)',
    '',
    `- current-patch : \`${current.path}\` · version ${current.dataset.version} · date ${current.dataset.date}`,
    `  sha256 \`${current.sha256}\``,
    `- 30-days : \`${full.path}\` · version ${full.dataset.version} · date ${full.dataset.date}`,
    `  sha256 \`${full.sha256}\``,
    '',
    '## Couverture',
    '',
    '| Corpus | Records | Éligibles | Écartés | Paires de test (par position) |',
    '|---|---|---|---|---|'
];

for (const c of coverage) {
    const nTest = indicesByCorpus.get(c.input)?.length ?? 0;
    rows.push(`| ${basename(c.input)} | ${c.records} | ${c.eligible} | ${c.discarded} | ${nTest} |`);
}
const totalRecords = coverage.reduce((sum, c) => sum + c.records, 0);
const totalDiscarded = coverage.reduce((sum, c) => sum + c.discarded, 0);
rows.push(
    `| **TOTAL** | ${totalRecords} | ${eligible.length} | ${totalDiscarded} | ${scoredGames.length} |`,
    '',
    '> Écarté = sans vainqueur, sans patch parsable, ou sans 10 picks rôle-complets (règle compOf de',
    '> postdiction G1) — un SEUL ensemble éligible, partagé par les trois positions.',
    '',
    `- Timeline ordonnée des groupes de patch (éligibles) : ${timelineLine}`,
    `- Groupes train-only en tête (jamais scorés, sous minTrainSize = ${MIN_TRAIN_SIZE}) : ` +
        (trainOnlyGroups.length > 0
            ? trainOnlyGroups.map((g) => `${g.patch} (${g.n})`).join(', ')
            : 'aucun'),
    `- Folds scorés : ${scoredGroups.length}` +
        (scoredGroups.length > 0
            ? ` — premier fold : patch ${scoredGroups[0].patch} (n = ${scoredGroups[0].n})`
            : ' — aucune paire de test (mini-corpus sous minTrainSize : smoke de plomberie uniquement)'),
    ''
);

for (const position of CALIBRATION_POSITIONS) {
    const arms = armsByPosition.get(position.id)!;
    const deltas = deltasByPosition.get(position.id)!;
    const fit = finalFits.get(position.id)!;
    rows.push(
        `## Position ${POSITION_TITLES[position.id]}`,
        '',
        '| Bras | n | Brier | Log loss | Accuracy |',
        '|---|---|---|---|---|',
        armRow('Calibré σ(a + b·logit(p_raw))', arms.calibrated.aggregate),
        armRow('Non calibré (p_raw)', arms.uncalibrated.aggregate),
        armRow('Pièce p = 0,5', arms.coin.aggregate),
        armRow('Side-only (descriptif, baseline M3.5)', arms.sideOnly.aggregate),
        '',
        `- **ΔBrier (critère du verdict)** : Δ = ${fr(deltas.brier.delta, 5)} · IC 95 % apparié ` +
            `${frInterval(deltas.brier.ci95.lo, deltas.brier.ci95.hi, 5)}`,
        `- Δ log loss (secondaire, descriptif) : Δ = ${fr(deltas.logLoss.delta, 5)} · IC 95 % ` +
            `${frInterval(deltas.logLoss.ci95.lo, deltas.logLoss.ci95.hi, 5)}`,
        `- **Verdict : ${verdictLine(position.id)}**`,
        `- Fit final full-data (shippé, jamais utilisé pour les métriques) : a = ${fr(fit.a, 6)}, ` +
            `b = ${fr(fit.b, 6)}, nTrain = ${fit.nTrain}, validated = ${fit.validated} ` +
            '(= verdict VERT ∧ b > 0).',
        ''
    );
    if (position.id === 'afterBans') {
        rows.push('```', ATTENDU_AFTERBANS, '```', '');
    }
    if (arms.calibrated.aggregate.n > 0) {
        rows.push(
            '### Fiabilité (10 bacs) — bras CALIBRÉ',
            '',
            ...reliabilityTable(arms.calibrated.aggregate.pairs),
            '',
            '### Fiabilité (10 bacs) — bras NON CALIBRÉ',
            '',
            ...reliabilityTable(arms.uncalibrated.aggregate.pairs),
            ''
        );
    } else {
        rows.push('_Aucune paire de test : pas de diagramme de fiabilité pour cette position._', '');
    }
}

rows.push(
    '## Lignes par corpus (descriptives — paires de test filtrées par fichier source)',
    '',
    '> Aucun pouvoir de verdict : le protocole est poolé (l\'artefact shippé est ligue-agnostique,',
    '> comme l\'affichage). Brier du bras calibré / non calibré sur les paires du corpus.',
    '',
    '| Corpus | n test | afterBans (cal / brut) | after3Picks (cal / brut) | fullDraft (cal / brut) |',
    '|---|---|---|---|---|'
);
for (const c of coverage) {
    const indices = indicesByCorpus.get(c.input) ?? [];
    const cells = CALIBRATION_POSITIONS.map((position) => {
        if (indices.length === 0) return '—';
        const arms = armsByPosition.get(position.id)!;
        const cal = brier(pairsAt(arms.calibrated.aggregate.pairs, indices));
        const raw = brier(pairsAt(arms.uncalibrated.aggregate.pairs, indices));
        return `${fr(cal, 4)} / ${fr(raw, 4)}`;
    });
    rows.push(`| ${basename(c.input)} | ${indices.length} | ${cells.join(' | ')} |`);
}

rows.push(
    '',
    '## Verdicts et artefact shippé',
    '',
    '| Position | Verdict ΔBrier | a (fit final) | b (fit final) | nTrain | validated |',
    '|---|---|---|---|---|---|'
);
for (const position of CALIBRATION_POSITIONS) {
    const fit = finalFits.get(position.id)!;
    const arms = armsByPosition.get(position.id)!;
    const verdict = arms.calibrated.aggregate.n === 0 ? 'ROUGE (0 paire)' : isGreen(position.id) ? 'VERT' : 'ROUGE';
    rows.push(
        `| ${position.id} | ${verdict} | ${fr(fit.a, 6)} | ${fr(fit.b, 6)} | ${fit.nTrain} | ${fit.validated} |`
    );
}
rows.push(
    '',
    `Artefact : \`${paramsOutPath}\` — TOUJOURS écrit, quel que soit le verdict ; l'UI n'applique`,
    'JAMAIS une position validated:false (badge « Non calibré » conservé, % brut affiché).',
    '',
    '## Limite documentée (verbatim, gelée dans la règle)',
    '',
    '```',
    CAVEAT_M3X,
    '```',
    '',
    '## Approximations d\'application (verbatim, gelées dans la règle)',
    '',
    '```',
    APPLICATION_APPROXIMATIONS,
    '```',
    ''
);

const markdown = rows.join('\n');
const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, markdown, 'utf8');

// ---- 7 (écriture). params TOUJOURS écrits, jamais réécrits à la main ----------

const paramsConfig = {
    version: 1,
    generatedAt,
    corpora: inputs,
    nGames: eligible.length,
    fittedThroughPatch: groups[groups.length - 1].patch,
    dataset: {
        version: current.dataset.version,
        date: current.dataset.date,
        sha256Current: current.sha256,
        sha256Full: full.sha256
    },
    seed,
    positions: {
        afterBans: finalFits.get('afterBans')!,
        after3Picks: finalFits.get('after3Picks')!,
        fullDraft: finalFits.get('fullDraft')!
    }
};
const absParamsOut = resolve(repoRoot, paramsOutPath);
mkdirSync(dirname(absParamsOut), { recursive: true });
writeFileSync(absParamsOut, JSON.stringify(paramsConfig, null, 4) + '\n', 'utf8');

console.log(markdown);
console.log(`Écrit : ${absOut}`);
console.log(`Écrit : ${absParamsOut}`);
