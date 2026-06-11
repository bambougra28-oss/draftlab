/**
 * Gate COACH — postdiction « conseil suivi » (run #2, chantier A).
 *
 * RÈGLE PRÉ-ENREGISTRÉE — recopiée VERBATIM de `docs/run2/A-coach-gate.md` §1
 * (gelé post-revue adversariale 2026-06-11). UNE règle, UN run : aucun
 * paramètre ne bouge après lecture du moindre résultat.
 *
 * ## 1. Règle pré-enregistrée
 *
 * > Le bloc ci-dessous est rédigé pour être recopié tel quel dans l'en-tête de
 * > `scripts/backtest/coachGate.ts` et committé AVANT tout run. UNE règle, UN
 * > run : aucun paramètre ne bouge après lecture du moindre résultat.
 *
 * ### 1.1 Le coach mesuré (configuration shippée, figée)
 *
 * Le « coach » de cette gate est exactement la chaîne de production du panneau
 * Coach (`src/routes/+page.svelte` → `recommendNext` → `navigate`), en mode
 * fallback (aucun roster synchronisé — les pools joueurs historiques n'existent
 * pas dans le corpus, attribution `enrichPlayers` en attente) :
 *
 * - **Évaluateur** : `makeAnalyzeDraftEvaluator({ dataset, fullDataset },
 *   { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 })` —
 *   la config exacte de la page. `dataset`/`fullDataset` = snapshots gelés du
 *   CDN DraftGap (`current-patch.json`, `30-days.json`), tirés UNE fois avant le
 *   run, sha256 et date publiés dans le rapport. Pas de `sideContext` (aucun
 *   terme de side : l'évaluation est symétrique entre les deux camps).
 * - **Recherche** : `navigate` avec `depth: 2`, `topK: 4` — les valeurs passées
 *   par la page (le défaut `candidateCount: 6` de `recommendNext` est tronqué à
 *   `topK = 4` à la racine par `navigate` : le panneau shippé classe au plus 4
 *   candidats ; la gate mesure CE classement-là).
 * - **Mode pick-only : NON — `picksOnly: false` gelé** : la gate rejoue des
 *   records à ordre exact dont les bans réels sont dans S_t — le chemin
 *   séquence-tournoi de la page (`+page.svelte`, mode `sequence` hors SoloQ :
 *   état par `draftStateFromActions`, bans ordonnés inclus, `picksOnly: false`).
 *   Les nœuds de ban du lookahead sont des nœuds normaux — les nôtres : les 6
 *   candidats shippés re-filtrés par disponibilité ; les adverses : `predict`
 *   sur `banRotationOf`.
 * - **Candidats** (chaîne shippée `coachFallback` → `rankOurCandidates`,
 *   exportée de `liveDraft.ts` et importée telle quelle par le runner) :
 *   top-15 des champions par **présence du train** (tri : présence desc, clé
 *   asc — le tri exact de la page), filtrés par disponibilité à l'état courant,
 *   les 6 premiers retenus, tronqués à 4 par la racine de `navigate`.
 * - **Distribution adverse** (nœuds d'espérance) : `predict` sur la table de
 *   tendances de l'équipe ADVERSE réelle, `buildTendencyTable(train, train,
 *   { team: équipeAdverse, now: now_k })`, α = 5, λ = 0,9/semaine (défauts
 *   module), exclusions = champions révélés au nœud, filtrée par disponibilité —
 *   `enemyDistributionOf` de `liveDraft.ts` elle-même, exportée et importée
 *   telle quelle par le runner.
 *   `now_k` = la plus ancienne `date` des records du patch testé k dans le même
 *   corpus (repli : `--generated-at`) — l'ancre temporelle « jour de match »
 *   (déviation déclarée vs `corpusRunner` qui utilise `generatedAt` : avec un
 *   `now` à aujourd'hui, l'évidence d'équipe 2025 pèserait λ^50 ≈ 0,005 contre
 *   un prior α = 5 non décéléré — la table serait dénaturée).
 * - Les couches cosmétiques de `recommendNext` (raisons FR, `pairFit`,
 *   `counterFit`, headline) n'altèrent pas les VALEURS : la gate pilote
 *   `navigate` directement avec les mêmes injections.
 *
 * ### 1.2 Walk-forward et éligibilité
 *
 * - **Walk-forward par patch, PAR CORPUS** (chaque fichier = sa propre
 *   timeline, patron `postdiction.ts`) : pour une game au patch k, train = les
 *   records du MÊME corpus de patchs strictement antérieurs (`comparePatches`),
 *   minTrainSize = 1 (parité maison). Premier patch / patch non parseable ⇒
 *   game non scorée (comptée).
 * - **Corpus du run** : exactement 7, figés au commit de gel —
 *   `static/corpus/{lck,lec,lfl,lpl}-2026.json` +
 *   `data/corpus/{lec,lfl,lpl}-2025.json` (2 661 drafts). `lck-2025.json` ne
 *   rejoint pas ce run : il ira au run de réplication étiqueté — même règle,
 *   rapport séparé.
 * - **Lockouts Fearless (config data-driven fixée avant le run)** : détecteur
 *   déterministe par corpus = nombre de picks réutilisés entre games d'une même
 *   série (`series.matchId`, `gameNumber` croissant). Lockouts ACTIFS ssi
 *   détecteur = 0. Mesuré le 2026-06-11 (avant gel) : lck-2026 0/2050,
 *   lec-2026 0/1130, lfl-2026 0/500, lpl-2026 0/2830, lec-2025 0/1650,
 *   lpl-2025 0/4980 → ON ; **lfl-2025 46/1580 → OFF**. Quand ON : pour une game
 *   de `gameNumber` > 1, les picks des games antérieures de la série sont
 *   retirés de la disponibilité (picks seulement — hard Fearless ne verrouille
 *   pas les bans). Le détecteur est recalculé et publié par le script.
 * - **Game éligible** : vainqueur connu, 10 picks résolus (`championKey ≠ ''`)
 *   sur les seqs template (7-12, 17-20), patch plaçable, fold non vide.
 * - **Tour scoré** : seq de pick t dont l'action réelle est résolue ; l'état
 *   S_t = actions réelles résolues de seq < t (tri seq), `firstPickSide` du
 *   record ; le slot dérivé (`nextSlotOf`) doit coïncider (seq, type pick, side)
 *   avec l'action réelle, sinon tour écarté — cause `template-mismatch`
 *   (typiquement bans skippés), comptée par corpus ; comparateurs ≥ 2 requis
 *   (cf. 1.3). Disponibilité = univers (clés tags ∪ train ∪ game) − révélés −
 *   lockouts ; le pick réel est garanti disponible (il a été joué — toute
 *   collision avec un lockout est une anomalie comptée).
 * - **Game scorée** : chaque side a ≥ 4 de ses 5 tours scorés. Les bans ne sont
 *   PAS scorés (le conseil de ban est déjà couvert par les pistes banEV du
 *   scorecard ; cette gate mesure le conseil de PICK).
 *
 * ### 1.3 Métrique primaire — re-ranking apparié vainqueur-perdant
 *
 * Candidat (a) retenu comme primaire. Pour chaque tour scoré t du side s :
 *
 * 1. **C_t** = les candidats que le panneau shippé classerait à cet état
 *    (présence-top-15 du train → filtre disponibilité → 6 premiers → troncature
 *    racine à 4).
 * 2. **v(x)** pour x ∈ C_t ∪ {pick réel} : valeur expectimax de x, calculée par
 *    `navigate` en racine forcée (`ourCandidates` renvoie `[x]` à l'état racine,
 *    la liste shippée aux états plus profonds), depth 2, topK 4, memo partagé
 *    entre les appels du même tour. Le pick réel est évalué par exactement le
 *    même chemin que les candidats.
 * 3. **Percentile du pick réel** :
 *    `ρ_t = ( #{c ∈ C_t \ {réel} : v(réel) > v(c)} + 0,5 · #{c : v(réel) = v(c)} ) / |C_t \ {réel}|`,
 *    avec |C_t \ {réel}| ≥ 2 exigé (sinon tour écarté, compté).
 * 4. **Score de side** : R(g, s) = moyenne des ρ_t sur les tours scorés du side.
 * 5. **Crédit de game** : crédit(g) = 1 si R(g, vainqueur) > R(g, perdant) ;
 *    0,5 si égalité exacte ; 0 sinon.
 * 6. **TD (taux de discrimination)** = Σ crédits / n games scorées, publié avec
 *    **Wilson 95 %** (`wilson95(Σcrédits, n)` — crédits fractionnaires : les
 *    égalités flottantes exactes sont quasi impossibles, l'approximation est
 *    déclarée), poolé sur les corpus du run ET par corpus.
 *
 * ### 1.4 Baselines (obligatoires, pré-enregistrées)
 *
 * - **B0 — hasard 0,5** : par symétrie d'appariement, un classement sans
 *   information donne TD = 0,5.
 * - **B1 — coach-présence (baseline ACTIVE de la gate)** : protocole identique
 *   (mêmes games, mêmes tours, mêmes C_t), v remplacé par
 *   `v_présence(x) = −rang(x)` dans l'ordre total (présence du train desc, clé
 *   asc) ; un champion absent du train classe dernier. C'est « le coach qui ne
 *   sait que suivre la méta » : il neutralise l'explication « les vainqueurs
 *   jouent simplement les champions à la mode ».
 * - **B2 — écho-dataset (CONTRÔLE descriptif, sans pouvoir de gate)** :
 *   protocole identique, `v_écho(x)` = Σ_rôles wins / Σ_rôles games du champion
 *   x dans `current-patch.json` (le snapshot gelé — sommes sur ses
 *   `statsByRole`), 0 si le champion en est absent ; égalités départagées par
 *   tie-break déterministe (clé asc). B2 est volontairement anachronique seul :
 *   il borne la part du verdict attribuable à l'écho « méta future » du
 *   dataset (cf. §3.1).
 *
 * ### 1.5 Critères de verdict (gelés)
 *
 * - **Critère 1** : borne basse Wilson 95 % du TD poolé > 0,5. Limite
 *   pré-enregistrée (reprise dans les Notes du rapport) : les games d'une même
 *   série sont corrélées — l'IC Wilson, i.i.d., est anticonservateur ; le même
 *   TD est publié en secondaire (S5) avec IC bootstrap clusterisé par série.
 * - **Critère 2** : delta apparié TD_coach − TD_présence (B1), bootstrap par
 *   CLUSTER de série via `clusterBootstrapDeltaCI`
 *   (`src/lib/backtest/clusterBootstrap.ts`, module fourni par l'architecte,
 *   conventions `metrics.ts` : rng injecté, quantiles type 7, IC percentile
 *   2,5-97,5 %) : observations `PairedObservation` {cluster = `series.matchId`
 *   — une game sans série = son propre cluster —, model = crédit coach,
 *   baseline = crédit B1} appariées par game ; chaque itération resample les
 *   clusters et recolle les crédits appariés modèle/B1 des games tirées ;
 *   1000 resamples, mulberry32, **seed 42** ; IC 95 % du delta strictement > 0.
 * - **VERT** = critère 1 ET critère 2 → gate produit franchie : badge
 *   Expérimental levé sur le panneau Coach, ligne ajoutée au scorecard R9.
 * - **ORANGE** = critère 1 seul → « le coach discrimine, mais pas mieux que le
 *   suivi de méta » : badge conservé, claim limité, levier suivant pré-identifié
 *   (§5).
 * - **ROUGE** = critère 1 non atteint → aucun claim de conseil ; enquête
 *   pré-cadrée (§5), la règle est consommée — pas de retuning.
 *
 * Puissance déclarée : n attendu ≈ 2 300-2 450 games (2 661 − premiers patchs
 * − écartées) ; au seuil n = 2 400, le critère 1 exige TD ≳ 52,0 % (MDE ≈ +2,0
 * pp). Un effet réel plus petit sera publié « non significatif » — c'est le
 * contrat.
 *
 * ### 1.6 Secondaires descriptives (pré-enregistrées, AUCUN pouvoir de verdict)
 *
 * - **S1 — accord top-1 différentiel** (candidat b) : part des tours où le pick
 *   réel = argmax v sur C_t, séparée vainqueurs/perdants (Wilson chacun, delta
 *   affiché) ; le taux poolé est le « accord navigator » du scorecard G5.
 * - **S2 — regret** (candidat c) : moyenne de (v(argmax C_t) − v(réel)) × 100
 *   pp, vainqueurs vs perdants — descriptif uniquement (échelle d'évaluateur
 *   non calibrée, pas de Platt).
 * - **S3 — TD du contrôle B2** (écho-dataset), poolé + par corpus.
 * - **S4 — tranche équilibrée** (stratification par force, l'esprit I5) : games
 *   où chaque équipe a ≥ 5 games de train et |WR_train(blue) − WR_train(red)| ≤
 *   0,10 ; TD Wilson sur la tranche.
 * - **S5 — TD poolé sous IC bootstrap clusterisé** : la statistique du
 *   critère 1, IC percentile par resampling des clusters de série
 *   (`clusterBootstrapDeltaCI` à baseline nulle, mêmes 1000 itérations, même
 *   seed 42) — la lecture robuste à la corrélation intra-série, publiée à côté
 *   du Wilson.
 * - Couverture publiée : games éligibles/scorées, tours écartés par cause —
 *   dont `template-mismatch` (bans skippés), pré-déclarée dans le tableau de
 *   couverture avec son compte PAR CORPUS ; ces tours restent écartés —, part
 *   des tours avec distribution adverse active, part des picks réels déjà
 *   dans C_t, valeurs du détecteur Fearless, anomalies.
 *
 * --- FIN DE LA RÈGLE GELÉE ---
 *
 * Run :
 *   node --experimental-transform-types --no-warnings scripts/backtest/coachGate.ts \
 *     static/corpus/lck-2026.json [...] data/corpus/lpl-2025.json \
 *     --dataset data/datasets/current-patch.json --full-dataset data/datasets/30-days.json \
 *     [--seed 42] [--generated-at ISO] [--out docs/calibration/coach-gate-2026.md] [--smoke]
 *
 * `--smoke` : exécute UN corpus (le premier) et n'imprime QUE timing +
 * couverture (aucun taux) — le garde-fou anti-lecture-prématurée.
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
type LiveDraftModule = typeof import('../../src/lib/intel/liveDraft');
type NavigatorModule = typeof import('../../src/lib/strategic/draftNavigator');
type TendencyModule = typeof import('../../src/lib/aggregates/tendency');
type PresenceModule = typeof import('../../src/lib/aggregates/presence');
type MetricsModule = typeof import('../../src/lib/backtest/metrics');
type ClusterModule = typeof import('../../src/lib/backtest/clusterBootstrap');
type WalkforwardModule = typeof import('../../src/lib/backtest/walkforward');
type TagsModule = typeof import('../../src/lib/tags');

type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type DraftSide = import('../../src/lib/data/types').DraftSide;
type Dataset = import('../../src/lib/types').Dataset;
type DraftState = import('../../src/lib/strategic/draftNavigator').DraftState;
type NavigatorSlot = import('../../src/lib/strategic/draftNavigator').NavigatorSlot;
type NavigatorMemoEntry = import('../../src/lib/strategic/draftNavigator').NavigatorMemoEntry;
type TendencyTable = import('../../src/lib/aggregates/tendency').TendencyTable;
type CoachContext = import('../../src/lib/intel/liveDraft').CoachContext;
type CoachTurnScore = import('../../src/lib/backtest/coachGate').CoachTurnScore;
type ScoreGameDeps = import('../../src/lib/backtest/coachGate').ScoreGameDeps;
type PairedObservation = import('../../src/lib/backtest/clusterBootstrap').PairedObservation;

const { scoreGameForGate, eligibilitySkipOf } = (await import(
    `${libRootHref}/backtest/coachGate.ts`
)) as CoachGateModule;
const { rankOurCandidates, enemyDistributionOf } = (await import(
    `${libRootHref}/intel/liveDraft.ts`
)) as LiveDraftModule;
const { navigate, nextSlotOf, makeAnalyzeDraftEvaluator } = (await import(
    `${libRootHref}/strategic/draftNavigator.ts`
)) as NavigatorModule;
const { buildTendencyTable } = (await import(`${libRootHref}/aggregates/tendency.ts`)) as TendencyModule;
const { computePresence } = (await import(`${libRootHref}/aggregates/presence.ts`)) as PresenceModule;
const { wilson95, mulberry32 } = (await import(`${libRootHref}/backtest/metrics.ts`)) as MetricsModule;
const { clusterBootstrapDeltaCI } = (await import(
    `${libRootHref}/backtest/clusterBootstrap.ts`
)) as ClusterModule;
const { comparePatches, parsePatch } = (await import(
    `${libRootHref}/backtest/walkforward.ts`
)) as WalkforwardModule;
const { loadDefaultTags } = (await import(`${libRootHref}/tags/index.ts`)) as TagsModule;

// ---- argv -------------------------------------------------------------------

const inputs: string[] = [];
let datasetPath: string | undefined;
let fullDatasetPath: string | undefined;
let outPath = 'docs/calibration/coach-gate-2026.md';
let seed = 42;
let generatedAt = new Date().toISOString();
let smoke = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dataset') datasetPath = argv[++i];
    else if (arg === '--full-dataset') fullDatasetPath = argv[++i];
    else if (arg === '--out') outPath = argv[++i];
    else if (arg === '--seed') seed = Number(argv[++i]);
    else if (arg === '--generated-at') generatedAt = argv[++i];
    else if (arg === '--smoke') smoke = true;
    else inputs.push(arg);
}
if (inputs.length === 0 || datasetPath === undefined || fullDatasetPath === undefined || Number.isNaN(seed)) {
    console.error(
        'Usage: node --experimental-transform-types --no-warnings scripts/backtest/coachGate.ts ' +
            '<corpus.json> [...] --dataset current-patch.json --full-dataset 30-days.json ' +
            '[--seed 42] [--generated-at ISO] [--out md] [--smoke]'
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

const corpusInputs = smoke ? inputs.slice(0, 1) : inputs;
const corpora = corpusInputs.map((input) => ({
    input,
    records: JSON.parse(readFileSync(resolve(repoRoot, input), 'utf8')) as DraftRecord[]
}));

// ---- B2 : ordre écho-dataset (ratio desc, clé asc) — pur lookup global -------
// v_écho doit induire un ORDRE total (égalités départagées clé asc, §1.4) :
// on encode l'ordre par −index, strictement monotone avec (ratio desc, clé asc).

function echoRatioOf(dataset: Dataset, key: string): number {
    const champ = dataset.championData[key];
    if (champ === undefined) return 0;
    let wins = 0;
    let games = 0;
    for (const roleData of Object.values(champ.statsByRole)) {
        wins += roleData.wins;
        games += roleData.games;
    }
    return games > 0 ? wins / games : 0;
}

const echoKeys = new Set<string>([...tagsKeys, ...Object.keys(frozenDataset.data.championData)]);
for (const { records } of corpora) {
    for (const record of records) {
        for (const action of record.actions) {
            if (action.championKey !== '') echoKeys.add(action.championKey);
        }
    }
}
const echoOrder = [...echoKeys].sort((a, b) => {
    const ratioA = echoRatioOf(frozenDataset.data, a);
    const ratioB = echoRatioOf(frozenDataset.data, b);
    if (ratioA !== ratioB) return ratioB - ratioA;
    return a < b ? -1 : 1;
});
const echoValue = new Map<string, number>(echoOrder.map((key, index) => [key, -index]));
const echoValueOf = (key: string): number => echoValue.get(key) ?? -echoOrder.length;

// ---- scoring par corpus -------------------------------------------------------

interface GameResult {
    corpus: string;
    cluster: string;
    credit: number;
    creditB1: number;
    creditB2: number;
    balanced: boolean;
    turns: { side: DraftSide; winnerTurn: boolean; top1Agree: boolean; regret: number }[];
}

interface CorpusCoverage {
    input: string;
    records: number;
    noWinner: number;
    unresolved: number;
    noFold: number;
    sideCoverage: number;
    eligible: number;
    scored: number;
    scoredTurns: number;
    templateMismatch: number;
    fewComparators: number;
    adverseActive: number;
    realInCt: number;
    anomalies: number;
    detectorReused: number;
    detectorExamined: number;
    lockoutsOn: boolean;
    evaluatedNodes: number;
    seconds: number;
}

interface Fold {
    presenceOrder: string[];
    presenceValue: Map<string, number>;
    top15: string[];
    trainKeys: Set<string>;
    nowK: string;
    wrTrain: Map<string, { wins: number; games: number }>;
    tableFor: (team: string) => TendencyTable;
}

const allGames: GameResult[] = [];
const allCoverage: CorpusCoverage[] = [];

for (const { input, records } of corpora) {
    const startedAt = Date.now();

    // -- détecteur Fearless (réutilisations inter-games par série) --
    const seriesGames = new Map<string, DraftRecord[]>();
    for (const record of records) {
        const matchId = record.series?.matchId;
        if (matchId === undefined) continue;
        const bucket = seriesGames.get(matchId) ?? [];
        bucket.push(record);
        seriesGames.set(matchId, bucket);
    }
    for (const bucket of seriesGames.values()) {
        bucket.sort(
            (a, b) => a.series!.gameNumber - b.series!.gameNumber || (a.gameId < b.gameId ? -1 : 1)
        );
    }
    const resolvedPicksOf = (record: DraftRecord): string[] =>
        record.actions.filter((a) => a.type === 'pick' && a.championKey !== '').map((a) => a.championKey);
    let detectorReused = 0;
    let detectorExamined = 0;
    for (const bucket of seriesGames.values()) {
        const prior = new Set<string>();
        bucket.forEach((game, index) => {
            const picks = resolvedPicksOf(game);
            if (index > 0) {
                for (const key of picks) {
                    detectorExamined += 1;
                    if (prior.has(key)) detectorReused += 1;
                }
            }
            for (const key of picks) prior.add(key);
        });
    }
    const lockoutsOn = detectorReused === 0;
    const lockedFor = (record: DraftRecord): Set<string> => {
        const locked = new Set<string>();
        const matchId = record.series?.matchId;
        const gameNumber = record.series?.gameNumber;
        if (!lockoutsOn || matchId === undefined || gameNumber === undefined || gameNumber <= 1) {
            return locked;
        }
        for (const other of seriesGames.get(matchId) ?? []) {
            if (other.series!.gameNumber >= gameNumber) continue;
            for (const key of resolvedPicksOf(other)) locked.add(key);
        }
        return locked;
    };

    // -- folds paresseux par patch (présence, top-15, tables par équipe, now_k, WR train) --
    const foldByPatch = new Map<string, Fold | null>();
    const foldFor = (patch: string): Fold | null => {
        const cached = foldByPatch.get(patch);
        if (cached !== undefined) return cached;
        const train = records.filter(
            (r) =>
                r.patch !== undefined && parsePatch(r.patch) !== undefined && comparePatches(r.patch, patch) < 0
        );
        if (train.length === 0) {
            foldByPatch.set(patch, null);
            return null;
        }
        const presenceOrder = [...computePresence(train).entries()]
            .sort((a, b) => b[1].presence - a[1].presence || (a[0] < b[0] ? -1 : 1))
            .map(([key]) => key);
        const presenceValue = new Map<string, number>(presenceOrder.map((key, index) => [key, -index]));
        const top15 = presenceOrder.slice(0, 15);
        const trainKeys = new Set<string>();
        for (const r of train) {
            for (const a of r.actions) if (a.championKey !== '') trainKeys.add(a.championKey);
        }
        let nowK: string | undefined;
        for (const r of records) {
            if (r.patch !== patch || r.date === undefined) continue;
            if (nowK === undefined || r.date < nowK) nowK = r.date;
        }
        const wrTrain = new Map<string, { wins: number; games: number }>();
        const tally = (team: string, won: boolean): void => {
            const cell = wrTrain.get(team) ?? { wins: 0, games: 0 };
            cell.games += 1;
            if (won) cell.wins += 1;
            wrTrain.set(team, cell);
        };
        for (const r of train) {
            if (r.winner === undefined) continue;
            tally(r.blueTeam, r.winner === 'blue');
            tally(r.redTeam, r.winner === 'red');
        }
        const tables = new Map<string, TendencyTable>();
        const now = nowK ?? generatedAt;
        const tableFor = (team: string): TendencyTable => {
            let table = tables.get(team);
            if (table === undefined) {
                table = buildTendencyTable(train, train, { team, now });
                tables.set(team, table);
            }
            return table;
        };
        const fold: Fold = { presenceOrder, presenceValue, top15, trainKeys, nowK: now, wrTrain, tableFor };
        foldByPatch.set(patch, fold);
        return fold;
    };

    const coverage: CorpusCoverage = {
        input,
        records: records.length,
        noWinner: 0,
        unresolved: 0,
        noFold: 0,
        sideCoverage: 0,
        eligible: 0,
        scored: 0,
        scoredTurns: 0,
        templateMismatch: 0,
        fewComparators: 0,
        adverseActive: 0,
        realInCt: 0,
        anomalies: 0,
        detectorReused,
        detectorExamined,
        lockoutsOn,
        evaluatedNodes: 0,
        seconds: 0
    };

    for (const record of records) {
        // Éligibilité dans l'ordre de la règle : vainqueur, 10 picks, patch, fold.
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

        // Disponibilité : univers (clés tags ∪ train ∪ game) − lockouts ; les
        // révélés sont soustraits par la lib, le pick réel ré-ajouté par elle.
        const locked = lockedFor(record);
        const universe = new Set<string>(tagsKeys);
        for (const key of fold.trainKeys) universe.add(key);
        for (const action of record.actions) {
            if (action.championKey !== '') universe.add(action.championKey);
        }
        for (const key of locked) universe.delete(key);

        // Caches par tour : ctx (table adverse réelle), liste shippée, memo
        // navigate partagé entre les ≤ 5 racines forcées du même tour.
        interface TurnEntry {
            ctx: CoachContext;
            shipped6: string[];
            memo: Map<string, NavigatorMemoEntry>;
        }
        const turnEntries = new Map<number, TurnEntry>();
        const turnEntryOf = (state: DraftState, slot: NavigatorSlot): TurnEntry => {
            let entry = turnEntries.get(slot.seq);
            if (entry === undefined) {
                const enemyTeam = slot.side === 'blue' ? record.redTeam : record.blueTeam;
                const ctx: CoachContext = {
                    ourSide: slot.side,
                    evaluate,
                    table: fold.tableFor(enemyTeam),
                    fallbackCandidates: fold.top15,
                    depth: 2,
                    topK: 4,
                    candidateCount: 6
                };
                entry = { ctx, shipped6: rankOurCandidates(ctx, state, 6), memo: new Map() };
                turnEntries.set(slot.seq, entry);
            }
            return entry;
        };

        const availableOf = (): Set<string> => universe;
        const candidatesOf = (state: DraftState, slot: NavigatorSlot): string[] =>
            turnEntryOf(state, slot).shipped6.slice(0, 4);

        const modelDeps: ScoreGameDeps = {
            availableOf,
            candidatesOf,
            valueOf: (state, slot, championKey) => {
                const entry = turnEntryOf(state, slot);
                const result = navigate(state, {
                    ourSide: slot.side,
                    ourCandidates: (s) =>
                        s.actions.length === state.actions.length ? [championKey] : entry.shipped6,
                    enemyDistribution: (s, enemySlot) => enemyDistributionOf(entry.ctx, s, enemySlot),
                    evaluate,
                    depth: 2,
                    topK: 4,
                    memo: entry.memo
                });
                coverage.evaluatedNodes += result.evaluatedNodes;
                return result.candidates[0]?.value ?? Number.NaN;
            }
        };

        const modelResult = scoreGameForGate(record, modelDeps);
        for (const turn of modelResult.discarded) {
            if (turn.reason === 'template-mismatch') coverage.templateMismatch += 1;
            else coverage.fewComparators += 1;
        }
        coverage.anomalies += modelResult.anomalies;
        if ('skipped' in modelResult) {
            if (modelResult.skipped === 'side-coverage') coverage.sideCoverage += 1;
            continue;
        }
        coverage.scored += 1;

        // Baselines : mêmes games, mêmes tours, mêmes C_t — purs lookups.
        const b1Result = scoreGameForGate(record, {
            availableOf,
            candidatesOf,
            valueOf: (_state, _slot, championKey) =>
                fold.presenceValue.get(championKey) ?? -fold.presenceOrder.length
        });
        const b2Result = scoreGameForGate(record, {
            availableOf,
            candidatesOf,
            valueOf: (_state, _slot, championKey) => echoValueOf(championKey)
        });
        if ('skipped' in b1Result || 'skipped' in b2Result) {
            // Impossible par construction (mêmes tours quel que soit valueOf).
            throw new Error(`coach-gate: baseline désynchronisée sur ${record.gameId}`);
        }

        // Couverture par tour scoré : distribution adverse active (premier nœud
        // du lookahead après le pick réel) + pick réel déjà dans C_t.
        const resolvedActions = record.actions
            .filter((a) => a.championKey !== '')
            .sort((a, b) => a.seq - b.seq);
        const realKeyAt = new Map<number, string>();
        for (const action of resolvedActions) {
            if (action.type === 'pick' && !realKeyAt.has(action.seq)) {
                realKeyAt.set(action.seq, action.championKey);
            }
        }
        const adverseActiveAt = (seq: number, side: DraftSide): boolean => {
            const actions = resolvedActions.filter((a) => a.seq <= seq);
            const used = new Set<string>(actions.map((a) => a.championKey));
            const available = new Set<string>();
            for (const key of universe) {
                if (!used.has(key)) available.add(key);
            }
            const state: DraftState = { actions, firstPickSide: record.firstPickSide, available };
            const slot = nextSlotOf(state);
            if (slot === null || slot.side === side) return false;
            const entry = turnEntries.get(seq);
            if (entry === undefined) return false;
            return enemyDistributionOf(entry.ctx, state, slot).length > 0;
        };
        for (const turn of modelResult.score.turns) {
            coverage.scoredTurns += 1;
            const realKey = realKeyAt.get(turn.seq);
            const entry = turnEntries.get(turn.seq);
            if (realKey !== undefined && entry !== undefined && entry.shipped6.slice(0, 4).includes(realKey)) {
                coverage.realInCt += 1;
            }
            if (adverseActiveAt(turn.seq, turn.side)) coverage.adverseActive += 1;
        }

        // Tranche S4 : équipes à ≥ 5 games de train et écart de WR ≤ 0,10.
        const wrBlue = fold.wrTrain.get(record.blueTeam);
        const wrRed = fold.wrTrain.get(record.redTeam);
        const balanced =
            wrBlue !== undefined &&
            wrRed !== undefined &&
            wrBlue.games >= 5 &&
            wrRed.games >= 5 &&
            Math.abs(wrBlue.wins / wrBlue.games - wrRed.wins / wrRed.games) <= 0.1;

        const winner = record.winner!;
        allGames.push({
            corpus: input,
            cluster: `${input}::${record.series?.matchId ?? record.gameId}`,
            credit: modelResult.score.credit,
            creditB1: b1Result.score.credit,
            creditB2: b2Result.score.credit,
            balanced,
            turns: modelResult.score.turns.map((turn: CoachTurnScore) => ({
                side: turn.side,
                winnerTurn: turn.side === winner,
                top1Agree: turn.top1Agree,
                regret: turn.regret
            }))
        });
    }

    coverage.seconds = (Date.now() - startedAt) / 1000;
    allCoverage.push(coverage);
    if (!smoke) {
        console.error(
            `[coach-gate] ${input} : ${coverage.scored} games scorées en ${coverage.seconds.toFixed(1)} s`
        );
    }
}

// ---- smoke aveugle : timing + couverture, AUCUN taux --------------------------

if (smoke) {
    for (const c of allCoverage) {
        console.log(`[smoke] corpus ${c.input}`);
        console.log(
            `[smoke] détecteur Fearless : ${c.detectorReused} pick(s) réutilisé(s) / ` +
                `${c.detectorExamined} examiné(s) → lockouts ${c.lockoutsOn ? 'ON' : 'OFF'}`
        );
        console.log(
            `[smoke] records ${c.records} · skips : no-winner ${c.noWinner} · ` +
                `unresolved-picks ${c.unresolved} · no-fold ${c.noFold} · side-coverage ${c.sideCoverage}`
        );
        console.log(`[smoke] games éligibles ${c.eligible} · scorées ${c.scored} · tours scorés ${c.scoredTurns}`);
        console.log(
            `[smoke] tours écartés : template-mismatch ${c.templateMismatch} · ` +
                `too-few-comparators ${c.fewComparators} · anomalies ${c.anomalies}`
        );
        console.log(
            `[smoke] couverture (comptes) : distribution adverse active ${c.adverseActive} · ` +
                `pick réel déjà dans C_t ${c.realInCt}`
        );
        console.log(`[smoke] nœuds navigate évalués ${c.evaluatedNodes}`);
        console.log(`[smoke] durée ${c.seconds.toFixed(1)} s`);
    }
    process.exit(0);
}

// ---- agrégation (wilson95 + bootstrap clusterisé, seed publié) -----------------

// Affichage : normalise le « -0.0 » issu du bruit flottant de wilson95 à 0 succès.
const unsignZero = (s: string): string => (/^-0(?:\.0+)?$/.test(s) ? s.slice(1) : s);
const pct = (x: number): string => unsignZero((100 * x).toFixed(1));
const pp = (x: number): string => unsignZero((100 * x).toFixed(2));
const sum = (xs: number[]): number => xs.reduce((acc, x) => acc + x, 0);

const tdRow = (label: string, credits: number, n: number): string => {
    if (n === 0) return `| ${label} | 0 | — | — | — |`;
    const ci = wilson95(credits, n);
    const verdict = ci.lo > 0.5 ? 'bat le hasard' : ci.hi < 0.5 ? 'sous le hasard' : 'non significatif';
    return `| ${label} | ${n} | ${pct(credits / n)} % | [${pct(ci.lo)} ; ${pct(ci.hi)}] % | ${verdict} |`;
};
const tdTable = (creditOf: (g: GameResult) => number): string[] => {
    const rows = [
        '| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |',
        '|---|---|---|---|---|',
        tdRow('TOUS corpus', sum(allGames.map(creditOf)), allGames.length)
    ];
    for (const c of allCoverage) {
        const games = allGames.filter((g) => g.corpus === c.input);
        rows.push(tdRow(basename(c.input), sum(games.map(creditOf)), games.length));
    }
    return rows;
};

const n = allGames.length;
const pooledCredits = sum(allGames.map((g) => g.credit));
const pooledTd = n > 0 ? pooledCredits / n : Number.NaN;
const pooledCi = wilson95(pooledCredits, n);
const criterion1 = n > 0 && pooledCi.lo > 0.5;

const obsVsB1: PairedObservation[] = allGames.map((g) => ({
    cluster: g.cluster,
    model: g.credit,
    baseline: g.creditB1
}));
const crit2 = clusterBootstrapDeltaCI(obsVsB1, { iterations: 1000, rng: mulberry32(seed) });
const criterion2 = n > 0 && crit2.ci95.lo > 0;

const obsS5: PairedObservation[] = allGames.map((g) => ({
    cluster: g.cluster,
    model: g.credit,
    baseline: 0
}));
const s5 = clusterBootstrapDeltaCI(obsS5, { iterations: 1000, rng: mulberry32(seed) });

const color: 'VERT' | 'ORANGE' | 'ROUGE' =
    criterion1 && criterion2 ? 'VERT' : criterion1 ? 'ORANGE' : 'ROUGE';
const colorExplain: Record<'VERT' | 'ORANGE' | 'ROUGE', string> = {
    VERT: 'le coach classe les picks des vainqueurs au-dessus de ceux des perdants ET fait mieux que le simple suivi de méta — la gate produit est franchie (suites §5 : badge, scorecard R9, commit séparé).',
    ORANGE: 'le coach discrimine vainqueurs/perdants, mais pas mieux que le suivi de méta (B1) : il lit la méta sans la dépasser — badge Expérimental conservé, claim limité.',
    ROUGE: 'le TD poolé ne bat pas le hasard avec IC : aucun claim de conseil — enquête pré-cadrée §5, la règle est consommée (pas de retuning).'
};

// S1 — accord top-1 (tours, vainqueurs vs perdants).
const allTurns = allGames.flatMap((g) => g.turns);
const winnerTurns = allTurns.filter((t) => t.winnerTurn);
const loserTurns = allTurns.filter((t) => !t.winnerTurn);
const agreeRow = (label: string, turns: { top1Agree: boolean }[]): string => {
    if (turns.length === 0) return `| ${label} | 0 | — | — |`;
    const agree = turns.filter((t) => t.top1Agree).length;
    const ci = wilson95(agree, turns.length);
    return `| ${label} | ${turns.length} | ${pct(agree / turns.length)} % | [${pct(ci.lo)} ; ${pct(ci.hi)}] % |`;
};
const agreeRateOf = (turns: { top1Agree: boolean }[]): number =>
    turns.length === 0 ? Number.NaN : turns.filter((t) => t.top1Agree).length / turns.length;

// S2 — regret moyen (pp), vainqueurs vs perdants.
const meanRegret = (turns: { regret: number }[]): number =>
    turns.length === 0 ? Number.NaN : sum(turns.map((t) => t.regret)) / turns.length;

// S4 — tranche équilibrée.
const balancedGames = allGames.filter((g) => g.balanced);

// ---- rapport markdown (byte-stable à seed/--generated-at fixés) ----------------

const rows: string[] = [
    '# Gate COACH — postdiction « conseil suivi » (run #2, chantier A)',
    '',
    `> Généré : ${generatedAt} · seed ${seed} · règle pré-enregistrée recopiée verbatim dans`,
    '> l\'en-tête de `scripts/backtest/coachGate.ts` (gel : `docs/run2/A-coach-gate.md` §1 — UNE règle, UN run).',
    `> Datasets DraftGap gelés : \`${basename(frozenDataset.path)}\` sha256 \`${frozenDataset.sha256}\` (date ${frozenDataset.data.date}) ·`,
    `> \`${basename(frozenFullDataset.path)}\` sha256 \`${frozenFullDataset.sha256}\` (date ${frozenFullDataset.data.date}).`,
    '',
    '## La question mesurée (pourquoi cette gate)',
    '',
    'Le panneau Coach classe des picks. Si ce classement contient du signal, les picks',
    'réellement joués par les équipes GAGNANTES doivent ressortir au-dessus de ceux des',
    'PERDANTES de la même game : chaque pick réel reçoit son percentile parmi les candidats',
    'que le panneau shippé aurait classés au même état (ρ_t), chaque side sa moyenne, et la',
    'game crédite le coach (1 / ½ / 0) selon que le side vainqueur obtient — ou non — le',
    'meilleur percentile moyen. TD = part des games créditées ; hasard = 0,5. Corrélation,',
    'pas causalité : personne ne rejoue les games.',
    '',
    '## Verdict (critères gelés §1.5)',
    '',
    '| Critère | Statistique | Valeur | IC 95 % | Exigence | Atteint |',
    '|---|---|---|---|---|---|',
    n > 0
        ? `| 1 | TD poolé (Wilson) | ${pct(pooledTd)} % | [${pct(pooledCi.lo)} ; ${pct(pooledCi.hi)}] % | borne basse > 50 % | ${criterion1 ? 'OUI' : 'NON'} |`
        : '| 1 | TD poolé (Wilson) | — | — | borne basse > 50 % | NON |',
    n > 0
        ? `| 2 | Δ TD coach − B1 (bootstrap clusterisé par série) | ${pp(crit2.delta)} pp | [${pp(crit2.ci95.lo)} ; ${pp(crit2.ci95.hi)}] pp | borne basse > 0 | ${criterion2 ? 'OUI' : 'NON'} |`
        : '| 2 | Δ TD coach − B1 (bootstrap clusterisé par série) | — | — | borne basse > 0 | NON |',
    '',
    `**Couleur : ${color}** — ${colorExplain[color]}`,
    '',
    '## Métrique primaire — taux de discrimination (TD)',
    '',
    ...tdTable((g) => g.credit),
    '',
    '## Baseline B1 — coach-présence (baseline ACTIVE)',
    '',
    'B1 rejoue exactement les mêmes games, les mêmes tours et les mêmes C_t, mais classe',
    'par rang de présence du train (« suivre la méta ») : si le coach ne fait pas mieux,',
    'son verdict ne vaut pas plus qu\'un tableau de présence.',
    '',
    ...tdTable((g) => g.creditB1),
    '',
    `Δ apparié TD coach − TD B1 : ${n > 0 ? `${pp(crit2.delta)} pp, IC 95 % bootstrap clusterisé [${pp(crit2.ci95.lo)} ; ${pp(crit2.ci95.hi)}] pp (${crit2.clusters} clusters, ${crit2.observations} games, 1000 resamples, seed ${seed})` : '—'}.`,
    '',
    '## Secondaires descriptives (pré-enregistrées, AUCUN pouvoir de verdict)',
    '',
    '### S1 — accord top-1 (le pick réel est-il l\'argmax de C_t ?)',
    '',
    '| Tranche | n tours | Accord | Wilson 95 % |',
    '|---|---|---|---|',
    agreeRow('Tours des vainqueurs', winnerTurns),
    agreeRow('Tours des perdants', loserTurns),
    agreeRow('TOUS les tours (l\'« accord navigator » du scorecard G5)', allTurns),
    '',
    `Delta vainqueurs − perdants : ${winnerTurns.length > 0 && loserTurns.length > 0 ? `${pp(agreeRateOf(winnerTurns) - agreeRateOf(loserTurns))} pp` : '—'}.`,
    '',
    '### S2 — regret moyen v(argmax C_t) − v(réel) (échelle évaluateur NON calibrée)',
    '',
    `Vainqueurs : ${winnerTurns.length > 0 ? `${pp(meanRegret(winnerTurns))} pp` : '—'} · Perdants : ${loserTurns.length > 0 ? `${pp(meanRegret(loserTurns))} pp` : '—'} — descriptif uniquement.`,
    '',
    '### S3 — TD du contrôle B2 (écho-dataset, anachronique par construction)',
    '',
    'B2 classe par winrate global du snapshot CURRENT-PATCH (Σ_rôles wins / Σ_rôles games,',
    'tie-break clé asc) : il borne la part du verdict attribuable à l\'écho « méta future »',
    'du dataset — s\'il discrimine seul, la lecture du verdict doit le citer.',
    '',
    ...tdTable((g) => g.creditB2),
    '',
    '### S4 — tranche équilibrée (chaque équipe ≥ 5 games de train, |ΔWR| ≤ 0,10)',
    '',
    '| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |',
    '|---|---|---|---|---|',
    tdRow('Games équilibrées', sum(balancedGames.map((g) => g.credit)), balancedGames.length),
    '',
    '### S5 — TD poolé sous IC bootstrap clusterisé par série',
    '',
    n > 0
        ? `TD ${pct(s5.delta)} % · IC 95 % [${pct(s5.ci95.lo)} ; ${pct(s5.ci95.hi)}] % (${s5.clusters} clusters, 1000 resamples, seed ${seed}) — la lecture robuste à la corrélation intra-série, à comparer au Wilson du critère 1.`
        : 'TD — (aucune game scorée).',
    '',
    '## Couverture',
    ''
];

for (const c of allCoverage) {
    rows.push(
        `- ${basename(c.input)} : ${c.records} records → ${c.eligible} éligibles ` +
            `(${c.noWinner} sans vainqueur, ${c.unresolved} avec picks non résolus, ${c.noFold} sans fold) → ` +
            `${c.scored} scorées (${c.sideCoverage} écartées side-coverage) · ${c.scoredTurns} tours scorés ` +
            `(écartés : ${c.templateMismatch} template-mismatch, ${c.fewComparators} too-few-comparators) · ` +
            `distribution adverse active ${c.adverseActive}/${c.scoredTurns} tours · ` +
            `pick réel déjà dans C_t ${c.realInCt}/${c.scoredTurns} · anomalies ${c.anomalies}.`
    );
}
rows.push('', 'Détecteur Fearless (picks réutilisés entre games d\'une même série / picks examinés) :', '');
for (const c of allCoverage) {
    rows.push(
        `- ${basename(c.input)} : ${c.detectorReused}/${c.detectorExamined} → lockouts ${c.lockoutsOn ? 'ON' : 'OFF'}`
    );
}

rows.push(
    '',
    '## Notes honnêtes',
    '',
    '- **Anachronisme du dataset** : l\'évaluateur SoloQ est au patch COURANT sur des games',
    '  passées — population disjointe (aucune issue du corpus pro ne fuit), bruit symétrique',
    '  entre les deux sides d\'une même game, mais un écho « méta future » reste possible :',
    '  S3 (B2) le borne noir sur blanc. Inéliminable sans snapshots SoloQ datés (DA-V2-3).',
    '- **Ordre `assumed-blue-first`** : l\'entrelacement des seqs est une hypothèse de',
    '  construction pour les corpus per-team (ère First Selection) ; il déforme S_t',
    '  identiquement pour les deux sides d\'une game (exact pour les corpus 2025).',
    '- **Corrélation de série** : l\'IC Wilson (i.i.d.) du critère 1 est anticonservateur —',
    '  la lecture robuste est S5 (bootstrap par cluster de série, même seed).',
    '- **Crédits fractionnaires** : `wilson95(Σcrédits, n)` traite les ½ comme des succès',
    '  partiels — les égalités flottantes exactes sont quasi impossibles, approximation déclarée.',
    '- **Clusters** : `series.matchId` préfixé par le chemin du corpus (une série vit dans un',
    '  seul fichier ; le préfixe interdit toute fusion accidentelle d\'ids entre corpus) ;',
    '  une game sans série est son propre cluster.',
    '- **« Distribution adverse active »** : sonde déterministe = le premier nœud du lookahead',
    '  après le pick réel est un nœud adverse à distribution non vide (tours dont le slot',
    '  suivant est allié : structurellement inactifs).',
    '- **`now_k`** : ancre temporelle = plus ancienne date du patch testé dans le même corpus',
    '  (repli `--generated-at`) — leak-free et fidèle au jour de match.',
    '- **WR train (S4)** : seuls les records de train à vainqueur connu comptent (un match',
    '  sans issue n\'est pas une évidence de force).',
    `- **Puissance** : n scoré = ${n} ; au seuil n = 2 400, le critère 1 exige TD ≳ 52,0 %`,
    '  (MDE ≈ +2,0 pp). Si n < ~1 900, la gate peut être structurellement non concluante —',
    '  publiée telle quelle, aucun re-découpage.',
    `- Seed ${seed} · \`--generated-at\` ${generatedAt} · rapport byte-stable à seed/horodatage fixés.`,
    ''
);

const markdown = rows.join('\n');
const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, markdown, 'utf8');
console.log(markdown);
console.log(`Écrit : ${absOut}`);
