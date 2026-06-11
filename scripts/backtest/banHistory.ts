/**
 * Chantier B — banEV phase 1 : le terme de demande ban-history (run pré-enregistré).
 *
 * RÈGLE PRÉ-ENREGISTRÉE — recopiée VERBATIM de `docs/run2/B-ban-history.md` §1,
 * gelée AVANT tout run sur données réelles. UNE règle, UN run, aucun re-tuning
 * après lecture.
 *
 * ## 1. Règle pré-enregistrée
 *
 * > Texte à geler tel quel dans l'en-tête de `scripts/backtest/banHistory.ts` AVANT tout
 * > run sur données réelles. UNE règle, UN run, aucun re-tuning après lecture.
 *
 * ### 1.1 L'estimateur de demande (fit, walk-forward par fold)
 *
 * Pour un fold scorant le patch k, le corpus de fit est `uniqueRecords` du train
 * d'événements : les records ayant ≥ 1 ban résolu sur au moins un side, parmi les patchs
 * du MÊME corpus strictement antérieurs à k — la même assiette que celle sur laquelle la
 * piste 4 fitte déjà tables et présence.
 *
 * - `games_T` = nombre de records du fit où l'équipe T apparaît (blueTeam ou redTeam).
 *   Zéro informatif : un record où T joue et où SEUL T a banni entre dans le fit (il porte
 *   l'événement du side de T) et compte bien comme zéro subi pour T ; un record sans aucun
 *   ban résolu, d'aucun side, ne porte aucun événement et reste hors du fit.
 * - `suffered_T(c)` = nombre de records du fit où T joue ET où le side OPPOSÉ à T a une
 *   action `ban` résolue sur c (au plus 1 par game, dédupliqué défensivement).
 * - Moyenne ligue (prior de shrinkage, lissage add-half) :
 *   `μ_c = (bannedGames(c) + 0,5) / (2·N + 1)`
 *   où `bannedGames(c)` = nombre de games du fit où c est banni (l'un ou l'autre side)
 *   et N = nombre de records du fit. (Chaque ban est subi par exactement une équipe ;
 *   les unités équipe-game sont au nombre de 2·N — μ_c est le taux de ban subi par une
 *   équipe quelconque.)
 * - Taux de demande révélée, posterior Beta en forme fermée (shrinkage EB, **priorN = 10**) :
 *   `banAttraction(c | T) = (suffered_T(c) + 10·μ_c) / (games_T + 10)`
 *   Équipe absente du fit ⇒ `banAttraction = μ_c` (repli prior ligue, cascade DA-V2-4).
 *   Fit vide (0 record) ⇒ 0.
 *
 * priorN = 10 : borne basse de la bande doctrine N₀ ≈ 10-50 (ARCHITECTURE_V2 §6.2),
 * choisie AVANT le run parce que les équipes n'ont que ~5-40 games par fold — à 50, un
 * perma-ban réel (8 subis sur 10 games) serait écrasé sous le prior et le terme ne
 * pourrait rien discriminer ; à 10 il poste ≈ 0,5+ tout en laissant μ_c absorber les bans
 * météo génériques.
 *
 * ### 1.2 La formule de demande dans banEV (régime répertoire uniquement)
 *
 * ```
 * attraction = banAttraction(c | équipe adverse)        // 0 si aucun provider injecté
 * demande    = max(takeProbability(c), γ · attraction)   // γ = banAttractionGamma = 1,0
 * ev(c)      = demande · (damage(c) + structuralPp · structural(c))
 * ```
 *
 * **Le max(), pas l'additif — tranché.** Les deux canaux estiment la MÊME quantité latente
 * (« P(ils le prendraient s'il était disponible) ») sous deux régimes d'observation
 * mutuellement exclusifs : les picks l'observent quand les bans ne censurent pas, les bans
 * subis l'observent quand ils censurent. Le max() prend la meilleure évidence disponible et
 * **ne double-compte jamais** un champion à la fois pické et banni. L'additif, lui,
 * additionnerait picks + bans — c'est la définition de la présence : le modèle convergerait
 * vers sa propre baseline (copie bruitée ⇒ au mieux égalité), et sur-coterait les champions
 * à demande déjà visible. Le max() répare uniquement les cas censurés et laisse intactes
 * les suggestions portées par les tendances (le vert LFL n'est pas dégradé par construction
 * de candidat : aucune demande individuelle ne baisse).
 *
 * **γ = 1,0 — fixé avant tout run.** Les deux termes vivent dans la même unité (sorties
 * attendues par game) : takeProbability somme des probabilités de pick par groupe de slots ;
 * attraction est P(un adversaire dépense un ban sur c dans une game contre T). Un
 * adversaire rationnel ne brûle un de ses 5 bans que si la sortie attendue le justifie —
 * le taux de ban subi est un minorant raisonnable de la probabilité de sortie
 * contrefactuelle, d'où l'échange 1:1. C'est le choix sans paramètre libre ; l'amortissement
 * fin est déjà fait par le shrinkage (priorN), pas par γ.
 *
 * Tout le reste du régime répertoire est inchangé : damage, structural, plancher
 * composition, Fearless-consumed ⇒ 0.
 *
 * ### 1.3 La piste de re-validation (identique byte-à-byte à la piste 4 du runner)
 *
 * Pour chaque corpus, séparément :
 *
 * - Événements = (game, side bannissant) avec ≥ 1 ban résolu, toutes phases confondues ;
 *   cible = les 5 bans de CE side ; folds walk-forward par patch (`groupByPatch`,
 *   train = patchs strictement antérieurs du même corpus).
 * - Modèle NOUVEAU = `banEV` régime répertoire sur les **30 candidats les plus présents du
 *   train**, `upcomingSlotGroups` = tous les groupes de picks du side adverse
 *   (blue : P1, P4-5, P8-9 ; red : P2-3, P6, P7, P10), ranges =
 *   `predictEnemyRange(table de tendances de l'équipe adverse fit sur le train,
 *   meta = présence du train, exclude = ∅)`, `structuralAssets` =
 *   `mineCombinations(records adverses du train, minGames 2)`,
 *   `replacementDrop(c) = 1,5 · (1 + 4·banRate_train(c))` — tout identique à la piste 4 —
 *   PLUS le provider `banAttraction(c) = banAttractionRate(fit du train, équipe adverse, c)`.
 * - Modèle ANCIEN (ancre d'attribution, tenu à la réplication §1.4) = exactement le même
 *   sans le provider.
 * - Baseline (inchangée, celle du rouge mesuré) = top-5 présence du train.
 * - Horloge gelée par ligue : map d'en-tête `PUBLISHED_GENERATED_AT` (pas de flag) = les
 *   « Généré le » exacts des quatre scorecards publiés — lck `2026-06-10T19:33:00.590Z` ·
 *   lec `2026-06-10T19:33:01.965Z` · lfl `2026-06-10T19:33:03.024Z` ·
 *   lpl `2026-06-10T21:02:11.514Z`. Chaque corpus est runné avec le timestamp de SA ligue
 *   comme `now` de TOUTES ses tables de tendances (les corpus 2025 descriptifs réutilisent
 *   celui de leur ligue).
 * - Score = `banHitAtK(top 5, bans du side, 5) / 5` ; valeur publiée = hits moyens/game.
 * - Bootstrap apparié, 1000 resamples, **mulberry32(seed 42)** : UN flux unique, consommé
 *   dans l'ordre argv complet — d'abord les 4 corpus 2026, puis les 3 corpus 2025
 *   descriptifs ; pour chaque corpus, 2 IC dans l'ordre (nouveau − baseline) puis
 *   (nouveau − ancien). Cet ordre de consommation du flux fait partie de la règle gelée.
 *
 * ### 1.4 Porte de validité du run (anti-bug, pas anti-résultat)
 *
 * Le run n'est VALIDE que si, pour chacun des quatre corpus 2026, la **baseline** ET le
 * **modèle ANCIEN** recalculés par le script reproduisent à 4 décimales la paire publiée
 * du scorecard — baseline : LCK 1,3007 · LEC 1,2039 · LFL 1,067 · LPL 1,2459 ; ancien :
 * LCK 0,9388 · LEC 1,1096 · LFL 1,2598 · LPL 1,0408. Comparaison gelée, écrite dans
 * l'en-tête du script : `round(valeur recalculée, 4) === constante publiée`, la table
 * `PUBLISHED` encodant les valeurs telles que strippées par le renderer des scorecards
 * (au plus 4 décimales, zéros finaux retirés — ex. baseline LFL `1.067` = 1,0670). La
 * baseline ne dépend d'aucune horloge ; l'ancien est runné avec le timestamp publié de
 * SON corpus (`PUBLISHED_GENERATED_AT`, §1.3) — toute divergence de l'une ou de l'autre
 * est un bug de réplication de piste. Un run invalide s'arrête là : la correction
 * mécanique est autorisée UNIQUEMENT pour retrouver ces valeurs gelées, jamais jugée sur
 * la ligne du nouveau modèle.
 *
 * ### 1.5 Critère de verdict (gelé, sur les QUATRE corpus 2026 uniquement)
 *
 * Par ligue, verdict standard du protocole : « bat la baseline » ssi l'IC 95 % du
 * Δ (nouveau − baseline) exclut 0 en faveur du modèle ; « sous la baseline » ssi il
 * l'exclut en défaveur ; « à égalité » sinon.
 *
 * - **VERT** : ≥ 3 ligues « bat la baseline » ET 0 ligue « sous la baseline »
 *   → claim phase 1 validé, branchement runner + UI (§5).
 * - **JAUNE** : 0 ligue « sous la baseline », mais < 3 « bat »
 *   → le rouge est éteint, pas de claim ; badge Expérimental conservé.
 * - **ROUGE** : ≥ 1 ligue « sous la baseline »
 *   → le terme de demande ne suffit pas ; la piste répertoire est retirée du ranking
 *   par défaut (§5), pas re-tunée.
 *
 * ### 1.6 Secondaires descriptifs (ne peuvent PAS changer le verdict)
 *
 * 1. Δ (nouveau − ancien) par ligue avec IC — l'attribution du changement.
 * 2. Part des suggestions top-5 où le plancher lie (γ·attraction > takeProbability) —
 *    l'usage réel du canal, par ligue.
 * 3. Réplication descriptive sur `data/corpus/{lec,lfl,lpl}-2025.json` (mêmes règles,
 *    mêmes constantes). **LCK 2025 absent — explicitement non attendu.**
 *
 * Constantes gelées, récapitulatif : priorN = 10 · γ = 1,0 · candidats = top-30 présence ·
 * K = 5 · seed = 42 · 1000 resamples · now = PUBLISHED_GENERATED_AT (4 timestamps publiés,
 * un par ligue, §1.3) · lissage μ add-half · verdict sur 2026 seulement. Aucun de ces
 * nombres n'est retouché après lecture des résultats : un échec ferme CETTE règle ; toute
 * suite est une NOUVELLE règle pré-enregistrée.
 *
 * --- fin de la règle gelée ---
 *
 * Run : node --experimental-transform-types --no-warnings scripts/backtest/banHistory.ts \
 *         static/corpus/lck-2026.json static/corpus/lec-2026.json \
 *         static/corpus/lfl-2026.json static/corpus/lpl-2026.json \
 *         data/corpus/lec-2025.json data/corpus/lfl-2025.json data/corpus/lpl-2025.json \
 *         [--seed 42] [--out docs/calibration/ban-history-2026.md]
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

type MetricsModule = typeof import('../../src/lib/backtest/metrics');
type WalkforwardModule = typeof import('../../src/lib/backtest/walkforward');
type TendencyModule = typeof import('../../src/lib/aggregates/tendency');
type PresenceModule = typeof import('../../src/lib/aggregates/presence');
type CombinationsModule = typeof import('../../src/lib/aggregates/combinations');
type BanEvModule = typeof import('../../src/lib/strategic/banEv');
type RangeModelModule = typeof import('../../src/lib/strategic/rangeModel');
type BanAttractionModule = typeof import('../../src/lib/estimators/banAttraction');
type PredictionPair = import('../../src/lib/backtest/metrics').PredictionPair;
type BootstrapDelta = import('../../src/lib/backtest/metrics').BootstrapDelta;
type TendencyTable = import('../../src/lib/aggregates/tendency').TendencyTable;
type PresenceEntry = import('../../src/lib/aggregates/presence').PresenceEntry;
type CombinationAsset = import('../../src/lib/aggregates/combinations').CombinationAsset;
type BanAttractionFit = import('../../src/lib/estimators/banAttraction').BanAttractionFit;
type PickRotation = import('../../src/lib/aggregates/rotations').PickRotation;
type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type DraftSide = import('../../src/lib/data/types').DraftSide;

const { banHitAtK, bootstrapDeltaCI, mulberry32 } = (await import(
    `${libRootHref}/backtest/metrics.ts`
)) as MetricsModule;
const { parsePatch, walkForward } = (await import(
    `${libRootHref}/backtest/walkforward.ts`
)) as WalkforwardModule;
const { buildTendencyTable } = (await import(`${libRootHref}/aggregates/tendency.ts`)) as TendencyModule;
const { computePresence } = (await import(`${libRootHref}/aggregates/presence.ts`)) as PresenceModule;
const { mineCombinations } = (await import(`${libRootHref}/aggregates/combinations.ts`)) as CombinationsModule;
const { banEV, DEFAULT_BAN_EV_CONFIG } = (await import(`${libRootHref}/strategic/banEv.ts`)) as BanEvModule;
const { predictEnemyRange } = (await import(`${libRootHref}/strategic/rangeModel.ts`)) as RangeModelModule;
const { fitBanAttraction, banAttractionRate } = (await import(
    `${libRootHref}/estimators/banAttraction.ts`
)) as BanAttractionModule;

// ---- constantes gelées (§1.3, §1.4) -----------------------------------------

/** « Généré le » exacts des quatre scorecards publiés — l'horloge de CHAQUE ligue. */
const PUBLISHED_GENERATED_AT: Record<string, string> = {
    lck: '2026-06-10T19:33:00.590Z',
    lec: '2026-06-10T19:33:01.965Z',
    lfl: '2026-06-10T19:33:03.024Z',
    lpl: '2026-06-10T21:02:11.514Z'
};

/** Les quatre corpus primaires 2026 — le verdict §1.5 ne porte que sur eux. */
const PRIMARY = ['lck-2026.json', 'lec-2026.json', 'lfl-2026.json', 'lpl-2026.json'];

/**
 * Paires publiées des quatre scorecards, telles que strippées par le renderer
 * (au plus 4 décimales, zéros finaux retirés — ex. baseline LFL `1.067` =
 * 1,0670). Porte §1.4 : `round(valeur recalculée, 4) === constante publiée`
 * pour la baseline ET le modèle ANCIEN de chacun, sinon RUN INVALIDE.
 */
const PUBLISHED: Record<string, { ancien: number; baseline: number }> = {
    // AMENDEMENT DATÉ 2026-06-11 (docs/run2/AMENDEMENT-corpus-20260611.md) :
    // scorecards régénérés sur l'état de corpus corrigé (réalignement PB→sides),
    // timestamps épinglés aux publiés — la DONNÉE change, pas la règle. Les
    // baselines (side-agnostiques) sont inchangées ; lfl (0 swap) inchangé.
    // Anciennes valeurs du 2026-06-10 : lck 0.9388 · lec 1.1096 · lpl 1.0408.
    'lck-2026.json': { ancien: 0.8811, baseline: 1.3007 },
    'lec-2026.json': { ancien: 0.989, baseline: 1.2039 },
    'lfl-2026.json': { ancien: 1.2598, baseline: 1.067 },
    'lpl-2026.json': { ancien: 0.9144, baseline: 1.2459 }
};

/** §1.1 — shrinkage EB pré-enregistré du fit banAttraction. */
const BAN_ATTRACTION_PRIOR_N = 10;
/** §1.3 — candidats banEV = top-30 présence du train (identique piste 4). */
const BAN_EV_CANDIDATES = 30;
/** §1.3 — les 5 bans du side ; valeur publiée = hits moyens/game. */
const BAN_HIT_K = 5;
/** §1.3 — resamples du bootstrap apparié. */
const BOOTSTRAP_ITERATIONS = 1000;
/** §1.3 — seed du flux mulberry32 unique. */
const DEFAULT_SEED = 42;

/** Template blue-first de la piste 4 (limite FS documentée, gardée pour comparabilité). */
const PICK_GROUPS_BY_SIDE: Record<DraftSide, PickRotation[]> = {
    blue: ['P1', 'P4-5', 'P8-9'],
    red: ['P2-3', 'P6', 'P7', 'P10']
};

// ---- argv --------------------------------------------------------------------

const inputs: string[] = [];
let outPath = 'docs/calibration/ban-history-2026.md';
let seed = DEFAULT_SEED;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') outPath = argv[++i];
    else if (argv[i] === '--seed') seed = Number(argv[++i]);
    else inputs.push(argv[i]);
}
if (inputs.length === 0 || Number.isNaN(seed)) {
    console.error(
        'Usage : node --experimental-transform-types --no-warnings scripts/backtest/banHistory.ts <corpus.json> [...] [--seed 42] [--out md]'
    );
    process.exit(1);
}

// ---- piste 4 recopiée (corpusRunner.ts, construction identique) ---------------

/** One scorable (game, banning side) — the §1.3 event. */
interface SideBanEvent {
    patch?: string;
    record: DraftRecord;
    side: DraftSide;
    bans: string[];
}

/** Team acting on `side` in this record. */
function actingTeam(record: DraftRecord, side: DraftSide): string {
    return side === 'blue' ? record.blueTeam : record.redTeam;
}

/** Unique records behind a list of scoring events, input order preserved. */
function uniqueRecords(events: { record: DraftRecord }[]): DraftRecord[] {
    const seen = new Set<DraftRecord>();
    const records: DraftRecord[] = [];
    for (const { record } of events) {
        if (seen.has(record)) continue;
        seen.add(record);
        records.push(record);
    }
    return records;
}

/** Baseline ranking: overall presence desc, key asc (le rouge mesuré). */
function rankByPresence(records: DraftRecord[]): string[] {
    const presence = computePresence(records);
    return [...presence.entries()]
        .sort((a, b) => {
            if (a[1].presence !== b[1].presence) return b[1].presence - a[1].presence;
            return a[0] < b[0] ? -1 : 1;
        })
        .map(([key]) => key);
}

const teamRecordsOf = (records: DraftRecord[], team: string): DraftRecord[] =>
    records.filter((r) => r.blueTeam === team || r.redTeam === team);

/** Mean of pair.p over the pooled pairs (NaN when empty). */
const meanP = (pairs: PredictionPair[]): number => {
    if (pairs.length === 0) return NaN;
    let sum = 0;
    for (const pair of pairs) sum += pair.p;
    return sum / pairs.length;
};

/** Published metric: mean hits per game (0..5). */
const banMetric = (pairs: PredictionPair[]): number => BAN_HIT_K * meanP(pairs);

// ---- scoring -------------------------------------------------------------------

interface CorpusRun {
    input: string;
    base: string;
    /** Horloge gelée utilisée (PUBLISHED_GENERATED_AT de la ligue). */
    generatedAt: string;
    records: number;
    usable: number;
    n: number;
    folds: number;
    nouveau: number;
    ancien: number;
    baseline: number;
    /** IC 1 du corpus : (nouveau − baseline). */
    deltaBaseline?: BootstrapDelta;
    /** IC 2 du corpus : (nouveau − ancien) — attribution §1.6.1. */
    deltaAncien?: BootstrapDelta;
    /** §1.6.2 — suggestions top-5 du nouveau run où γ·attraction > takeProbability. */
    floorBound: number;
    /** Total des suggestions top-5 inspectées (nouveau run). */
    suggestions: number;
}

// UN flux unique (§1.3), consommé dans l'ordre argv : 2 IC par corpus.
const rng = mulberry32(seed);
const runs: CorpusRun[] = [];

for (const input of inputs) {
    const parsed: unknown = JSON.parse(readFileSync(resolve(repoRoot, input), 'utf8'));
    if (!Array.isArray(parsed)) {
        console.error(`${input} : tableau JSON de DraftRecord attendu`);
        process.exit(1);
    }
    const records = parsed as DraftRecord[];
    const usable = records.filter((r) => r.patch !== undefined && parsePatch(r.patch) !== undefined);

    const base = basename(input);
    const league = Object.keys(PUBLISHED_GENERATED_AT).find((key) => base.startsWith(`${key}-`));
    // Corpus hors des quatre ligues publiées (smoke synthétique uniquement) :
    // repli déterministe sur la première horloge gelée — la porte §1.4
    // stampera de toute façon INVALIDE, ces corpus ne sont jamais publiés.
    const generatedAt = league !== undefined ? PUBLISHED_GENERATED_AT[league] : PUBLISHED_GENERATED_AT.lck;

    // Événements §1.3 : (game, side bannissant) avec ≥ 1 ban résolu, toutes phases.
    const events: SideBanEvent[] = [];
    for (const record of usable) {
        for (const side of ['blue', 'red'] as const) {
            const bans = record.actions
                .filter((a) => a.type === 'ban' && a.side === side && a.championKey !== '')
                .map((a) => a.championKey);
            if (bans.length === 0) continue;
            events.push({ patch: record.patch, record, side, bans });
        }
    }

    interface BanEvModel {
        records: DraftRecord[];
        candidates: string[];
        presence: Map<string, PresenceEntry>;
        tables: Map<string, TendencyTable>;
        assets: Map<string, CombinationAsset[]>;
        /** Présent dans le modèle NOUVEAU uniquement (§1.3). */
        attraction?: BanAttractionFit;
    }

    /** Le diagnostic §1.6.2, collecté pendant la prédiction, hors PredictionPair. */
    const floorStats = { bound: 0, total: 0 };

    const runBanEv = (withAttraction: boolean) =>
        walkForward<SideBanEvent, BanEvModel>(events, {
            fit: (train) => {
                const trainRecords = uniqueRecords(train);
                const model: BanEvModel = {
                    records: trainRecords,
                    candidates: rankByPresence(trainRecords).slice(0, BAN_EV_CANDIDATES),
                    presence: computePresence(trainRecords),
                    tables: new Map(),
                    assets: new Map()
                };
                if (withAttraction) {
                    model.attraction = fitBanAttraction(trainRecords, { priorN: BAN_ATTRACTION_PRIOR_N });
                }
                return model;
            },
            predict: (model, event) => {
                const enemySide: DraftSide = event.side === 'blue' ? 'red' : 'blue';
                const enemyTeam = actingTeam(event.record, enemySide);
                let table = model.tables.get(enemyTeam);
                if (table === undefined) {
                    table = buildTendencyTable(model.records, model.records, {
                        now: generatedAt,
                        team: enemyTeam
                    });
                    model.tables.set(enemyTeam, table);
                }
                let assets = model.assets.get(enemyTeam);
                if (assets === undefined) {
                    assets = mineCombinations(teamRecordsOf(model.records, enemyTeam), { minGames: 2 });
                    model.assets.set(enemyTeam, assets);
                }
                const fit = model.attraction;
                const entries = banEV(model.candidates, {
                    upcomingSlotGroups: PICK_GROUPS_BY_SIDE[enemySide],
                    rangeFor: (slotGroup) =>
                        predictEnemyRange({
                            table: table!,
                            slotGroup,
                            side: enemySide,
                            meta: model.presence,
                            exclude: new Set<string>()
                        }),
                    structuralAssets: assets,
                    // Replacement damage carries the meta term (piste 4, hack
                    // banRate conservé tel quel — §3.4 du design : une seule
                    // chose change vs le rouge mesuré, le terme de demande).
                    replacementDrop: (key) => 1.5 * (1 + 4 * (model.presence.get(key)?.banRate ?? 0)),
                    ...(fit !== undefined
                        ? { banAttraction: (key: string) => banAttractionRate(fit, enemyTeam, key) }
                        : {})
                });
                if (withAttraction) {
                    for (const entry of entries.slice(0, BAN_HIT_K)) {
                        floorStats.total += 1;
                        if (
                            DEFAULT_BAN_EV_CONFIG.banAttractionGamma * entry.components.banAttraction >
                            entry.components.takeProbability
                        ) {
                            floorStats.bound += 1;
                        }
                    }
                }
                return (
                    banHitAtK(
                        entries.map((entry) => entry.championKey),
                        event.bans,
                        BAN_HIT_K
                    ) / BAN_HIT_K
                );
            },
            outcome: () => true
        });

    const nouveauRun = runBanEv(true);
    const ancienRun = runBanEv(false);
    const baselineRun = walkForward<SideBanEvent, string[]>(events, {
        fit: (train) => rankByPresence(uniqueRecords(train)),
        predict: (ranked, event) => banHitAtK(ranked, event.bans, BAN_HIT_K) / BAN_HIT_K,
        outcome: () => true
    });

    const run: CorpusRun = {
        input,
        base,
        generatedAt,
        records: records.length,
        usable: usable.length,
        n: nouveauRun.aggregate.n,
        folds: nouveauRun.folds.length,
        nouveau: banMetric(nouveauRun.aggregate.pairs),
        ancien: banMetric(ancienRun.aggregate.pairs),
        baseline: banMetric(baselineRun.aggregate.pairs),
        floorBound: floorStats.bound,
        suggestions: floorStats.total
    };
    // Ordre de consommation du flux (§1.3, gelé) : IC (nouveau − baseline)
    // PUIS IC (nouveau − ancien), corpus par corpus dans l'ordre argv.
    if (nouveauRun.aggregate.n > 0) {
        run.deltaBaseline = bootstrapDeltaCI(nouveauRun.aggregate.pairs, baselineRun.aggregate.pairs, banMetric, {
            iterations: BOOTSTRAP_ITERATIONS,
            rng
        });
        run.deltaAncien = bootstrapDeltaCI(nouveauRun.aggregate.pairs, ancienRun.aggregate.pairs, banMetric, {
            iterations: BOOTSTRAP_ITERATIONS,
            rng
        });
    }
    runs.push(run);
}

// ---- porte de validité §1.4 ----------------------------------------------------

/** Comparaison gelée : round(valeur recalculée, 4) === constante publiée. */
const round4 = (v: number): number => Math.round(v * 1e4) / 1e4;

/** French number: at most 4 decimals, trailing zeros stripped (renderer rule). */
const fmt = (n: number): string => {
    if (Number.isNaN(n)) return '—';
    if (Number.isInteger(n)) return String(n);
    const fixed = n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    return fixed === '-0' ? '0' : fixed;
};
const fmtSigned = (n: number): string => (n > 0 ? `+${fmt(n)}` : fmt(n));
const fmtCI = (d: BootstrapDelta | undefined): string =>
    d === undefined ? '—' : `${fmtSigned(d.delta)} [${fmtSigned(d.ci95.lo)} ; ${fmtSigned(d.ci95.hi)}]`;
const fmtPct = (x: number): string => (Number.isNaN(x) ? '—' : `${(100 * x).toFixed(1)} %`);

/** Verdict §1.5 sur l'IC du Δ (nouveau − baseline), métrique higher-is-better. */
const verdictFr = (d: BootstrapDelta | undefined): string =>
    d === undefined ? '—' : d.ci95.lo > 0 ? 'bat la baseline' : d.ci95.hi < 0 ? 'sous la baseline' : 'à égalité';

let gateOk = true;
const gateRows: string[] = [
    '| Corpus | Baseline recalculée | Baseline publiée | Ancien recalculé | Ancien publié | Reproduit |',
    '|---|---:|---:|---:|---:|---|'
];
for (const primaryBase of PRIMARY) {
    const published = PUBLISHED[primaryBase];
    const run = runs.find((r) => r.base === primaryBase);
    if (run === undefined || run.n === 0) {
        gateRows.push(
            `| ${primaryBase} | — | ${fmt(published.baseline)} | — | ${fmt(published.ancien)} | NON — corpus absent du run |`
        );
        gateOk = false;
        continue;
    }
    const baselineOk = round4(run.baseline) === published.baseline;
    const ancienOk = round4(run.ancien) === published.ancien;
    if (!baselineOk || !ancienOk) gateOk = false;
    gateRows.push(
        `| ${primaryBase} | ${fmt(round4(run.baseline))} | ${fmt(published.baseline)} ` +
            `| ${fmt(round4(run.ancien))} | ${fmt(published.ancien)} | ${baselineOk && ancienOk ? 'oui' : 'NON'} |`
    );
}

// ---- rapport -------------------------------------------------------------------

const primaryRuns = runs.filter((r) => PRIMARY.includes(r.base));
const descriptiveRuns = runs.filter((r) => !PRIMARY.includes(r.base));

const lines: string[] = [
    '# banEV phase 1 — terme de demande ban-history (run pré-enregistré)',
    '',
    '> Règle gelée : `docs/run2/B-ban-history.md` §1, recopiée verbatim dans',
    "> l'en-tête de `scripts/backtest/banHistory.ts`. UNE règle, UN run.",
    `> Reproductibilité : seed ${seed}, ${BOOTSTRAP_ITERATIONS} resamples, flux mulberry32 UNIQUE`,
    "> consommé dans l'ordre argv — par corpus : IC (nouveau − baseline) puis (nouveau − ancien).",
    '> Horloges gelées (« Généré le » publiés) : ' +
        `lck \`${PUBLISHED_GENERATED_AT.lck}\` · lec \`${PUBLISHED_GENERATED_AT.lec}\` · ` +
        `lfl \`${PUBLISHED_GENERATED_AT.lfl}\` · lpl \`${PUBLISHED_GENERATED_AT.lpl}\`.`,
    '',
    '## Porte de validité du run (§1.4)',
    '',
    gateOk
        ? '**RUN VALIDE** — baseline ET modèle ancien reproduits à 4 décimales sur les quatre corpus 2026.'
        : "**RUN INVALIDE** — la baseline et/ou le modèle ancien ne reproduisent pas les paires publiées : " +
          'bug de réplication de piste. Le run s’arrête là (§1.4) ; la correction mécanique est autorisée ' +
          'UNIQUEMENT pour retrouver les valeurs gelées, jamais jugée sur la ligne du nouveau modèle ' +
          '(qui n’est pas publiée ci-dessous).',
    '',
    ...gateRows
];

if (gateOk) {
    lines.push(
        '',
        '## Primaire — les quatre corpus 2026 (piste §1.3, verdict §1.5)',
        '',
        '| Ligue | n | folds | Nouveau | Ancien | Ancien publié | Baseline | Baseline publiée | Δ vs baseline (IC 95 %) | Verdict |',
        '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|'
    );
    for (const run of primaryRuns) {
        const published = PUBLISHED[run.base];
        lines.push(
            `| ${run.base} | ${run.n} | ${run.folds} | ${fmt(run.nouveau)} | ${fmt(run.ancien)} ` +
                `| ${fmt(published.ancien)} | ${fmt(run.baseline)} | ${fmt(published.baseline)} ` +
                `| ${fmtCI(run.deltaBaseline)} | ${verdictFr(run.deltaBaseline)} |`
        );
    }

    const verdicts = primaryRuns.map((run) => verdictFr(run.deltaBaseline));
    const beats = verdicts.filter((v) => v === 'bat la baseline').length;
    const loses = verdicts.filter((v) => v === 'sous la baseline').length;
    const ties = verdicts.filter((v) => v === 'à égalité').length;
    const global = loses >= 1 ? 'ROUGE' : beats >= 3 ? 'VERT' : 'JAUNE';
    const globalText =
        global === 'VERT'
            ? `**Verdict global : VERT** — ${beats} ligue(s) « bat la baseline » et aucune « sous la baseline » : ` +
              'le claim phase 1 est validé → branchement runner + UI (§5 du design).'
            : global === 'ROUGE'
              ? `**Verdict global : ROUGE** — ${loses} ligue(s) « sous la baseline » : le terme de demande ne suffit ` +
                'pas ; la piste répertoire est retirée du ranking par défaut (§5), pas re-tunée.'
              : `**Verdict global : JAUNE** — aucune ligue « sous la baseline », mais seulement ${beats} « bat la ` +
                `baseline » (${ties} à égalité, < 3 « bat ») : le rouge est éteint, pas de claim ; badge Expérimental conservé.`;
    lines.push('', globalText);

    lines.push(
        '',
        '## Secondaires descriptifs (§1.6 — ne peuvent PAS changer le verdict)',
        '',
        '### Attribution du changement : Δ (nouveau − ancien)',
        '',
        '| Ligue | Δ nouveau − ancien (IC 95 %) |',
        '|---|---:|'
    );
    for (const run of primaryRuns) {
        lines.push(`| ${run.base} | ${fmtCI(run.deltaAncien)} |`);
    }

    lines.push(
        '',
        '### Part des suggestions top-5 où le plancher lie (γ·attraction > takeProbability)',
        '',
        '| Ligue | Part du plancher | Suggestions inspectées |',
        '|---|---:|---:|'
    );
    for (const run of runs) {
        lines.push(
            `| ${run.base} | ${run.suggestions > 0 ? fmtPct(run.floorBound / run.suggestions) : '—'} | ${run.suggestions} |`
        );
    }

    lines.push(
        '',
        '### Réplication descriptive 2025 (mêmes règles, mêmes constantes)',
        '',
        '> **LCK 2025 absent — explicitement non attendu.** Ces lignes sont descriptives :',
        '> le verdict §1.5 ne porte que sur les quatre corpus 2026.',
        ''
    );
    if (descriptiveRuns.length > 0) {
        lines.push(
            '| Ligue | n | folds | Nouveau | Ancien | Baseline | Δ vs baseline (IC 95 %) | Δ vs ancien (IC 95 %) | Verdict (descriptif) |',
            '|---|---:|---:|---:|---:|---:|---:|---:|---|'
        );
        for (const run of descriptiveRuns) {
            lines.push(
                `| ${run.base} | ${run.n} | ${run.folds} | ${fmt(run.nouveau)} | ${fmt(run.ancien)} ` +
                    `| ${fmt(run.baseline)} | ${fmtCI(run.deltaBaseline)} | ${fmtCI(run.deltaAncien)} ` +
                    `| ${verdictFr(run.deltaBaseline)} |`
            );
        }
    } else {
        lines.push('Aucun corpus descriptif fourni dans ce run.');
    }

    lines.push(
        '',
        '## Notes',
        '',
        `- Constantes gelées : priorN = ${BAN_ATTRACTION_PRIOR_N} · γ = ${DEFAULT_BAN_EV_CONFIG.banAttractionGamma} · ` +
            `candidats = top-${BAN_EV_CANDIDATES} présence · K = ${BAN_HIT_K} · seed = ${seed} · ` +
            `${BOOTSTRAP_ITERATIONS} resamples · lissage μ add-half · verdict sur 2026 seulement.`,
        '- Événements = (game, side bannissant) avec ≥ 1 ban résolu, toutes phases ; cible = les 5 bans de CE side ;',
        '  folds walk-forward par patch (train = patchs strictement antérieurs du même corpus).',
        '- Modèles : banEV régime répertoire — ranges `predictEnemyRange` (table de tendances de l’équipe adverse,',
        '  meta = présence du train, exclude = ∅), assets `mineCombinations` (minGames 2),',
        '  `replacementDrop = 1,5·(1 + 4·banRate_train)` — construction identique à la piste 4 du runner ;',
        '  le NOUVEAU ajoute le provider `banAttractionRate(fit du train, équipe adverse, ·)` (priorN 10).',
        '- La baseline (top-5 présence du train) ne dépend d’aucune horloge ; l’ancien et le nouveau sont runnés',
        '  avec le timestamp publié de LEUR ligue (`PUBLISHED_GENERATED_AT`).',
        '- La part du plancher (§1.6.2) est mesurée pendant la prédiction du nouveau run, hors PredictionPair.',
        '- Limite connue, conservée pour comparabilité (§3.6) : `PICK_GROUPS_BY_SIDE` suppose le template',
        '  blue-first (ère First Selection).',
        '- Couverture : ' +
            runs
                .map((run) => `${run.base} ${run.records} records (${run.usable} avec patch) → ${run.n} événements`)
                .join(' · ') +
            '.'
    );
} else {
    lines.push(
        '',
        '> Boucle bornée §1.4 : corriger la réplication de piste (baseline, modèle ancien), re-runner,',
        '> documenter chaque tentative. La ligne du nouveau modèle reste non publiée tant que la porte est rouge.'
    );
}

const markdown = lines.join('\n') + '\n';
const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, markdown, 'utf8');
console.log(markdown);
console.log(`Écrit : ${absOut}`);
console.log(`Porte §1.4 : ${gateOk ? 'RUN VALIDE' : 'RUN INVALIDE'}`);
