/*
G3 — Rétention/consommation Fearless : postdiction de la demande série
(porte de §8 R5, périmètre sous amendement d'architecte — §1.3 ; le verdict
imprimé par le script et le rapport est « G3-demande VERTE » ou « G3-demande
ROUGE », JAMAIS « G3 VERTE » ; pré-enregistrée le 2026-06-11 AVANT tout run,
aucun bouton post-hoc ; une règle, un run — tout rouge est gelé, toute
nouvelle piste exigera un NOUVEL en-tête daté).

CORPUS. Les 8 fichiers canoniques s'ils existent au lancement :
static/corpus/{lck,lec,lfl,lpl}-2026.json + data/corpus/{lck,lec,lfl,lpl}-2025.json.
lck-2025.json absent ⇒ run sur 7, noté au rapport ; s'il arrive plus tard, un
run supplémentaire est publié comme RÉPLICATION DESCRIPTIVE sans rouvrir le
verdict du premier run.

RECONSTITUTION. Série = records d'un même (corpus, series.matchId), ordonnés
par series.gameNumber. Série invalide (gameNumber dupliqué, trou 1..L, équipes
≠ exactement 2) ⇒ exclue, comptée. Consommé avant la game g =
∪ picks résolus des games 1..g−1 des DEUX équipes (hard Fearless).

TEST 0 (empirique, bloquant PAR TOURNOI). Re-pick = champion pické dans une
game antérieure de la même série, re-pické ensuite par l'une OU l'autre équipe.
Un tournoi est « Fearless confirmé » ssi 0 re-pick sur l'ensemble de ses séries
multi-games. Seules les séries des tournois Fearless confirmés, elles-mêmes
sans re-pick interne, entrent au scoring. Le tableau par tournoi (séries,
picks ultérieurs, re-picks, re-bans d'un consommé) est publié en tête de
rapport. Attendu d'après l'audit de design : tout est confirmé sauf
« LFL 2025 Promotion » ; l'anomalie de re-ban LPL (Ambessa,
LPL/2025 Season/Split 1_Week 2_5_3) est signalée sans exclure son tournoi
(la règle d'exclusion porte sur les re-PICKS, définition de la consommation).

ÉVÉNEMENTS. Un événement = (série scorée S, game g ≥ 2 existante, équipe T).
La prédiction se place ENTRE les games (le moment « re-plan » du produit) :
état connu = consommé(S, g) seul ; les bans et picks de la game g ne sont
JAMAIS lus. Cible = les 5 picks résolus de T en game g (< 5 résolus ⇒
événement écarté, compté).

WALK-FORWARD PAR PATCH (du même corpus). Pour une game de patch k : train =
records du corpus de patch plaçable strictement antérieur à k
(parsePatch/comparePatches du harnais). Game sans patch plaçable ou de premier
patch ⇒ non scorée (comptée). Horloge injectée now = date du record de la
game g (100 % au corpus ; âge clampé ≥ 0).

MODÈLE M (demande par rôle, constantes gelées = défauts doctrine §6.5) :
  masse_T(c, r) = Σ_{picks de T, rôle r, train} 0,9^(âge_semaines)
                + 5 · P_ligue(c | r)
  P_ligue(c | r) = picks(c, r, train toutes équipes) / picks(·, r, train)
  Prédiction = 5 champions DISTINCTS, un par rôle : rôles traités par masse
  de tête décroissante — masse de tête = masse du meilleur candidat NON
  CONSOMMÉ du rôle, calculée UNE FOIS avant le greedy ; les retenus des rôles
  précédents ne réordonnent pas les rôles ; égalité de masses de tête : ordre
  canonique ROLES. Dans un rôle : argmax masse sur les candidats non consommés
  et non déjà retenus (égalités : compte brut équipe desc → compte ligue desc
  → clé asc) ; rôle sans candidat ⇒ emplacement vide (le hit reste divisé
  par 5 — pénalité honnête).
BASELINE B1 (présence équipe — la comparaison PRIMAIRE) : top-5 par compte
  BRUT de picks de T (tous rôles, train), consommés exclus ; égalités : compte
  ligue desc → clé asc. (Équipe inconnue du train ⇒ tous comptes nuls ⇒ B1
  dégénère au classement ligue : les deux surfaces émettent toujours 5,
  aucune asymétrie de « miss honnête ».)
BASELINE B0 (fréquence ligue, ligne DESCRIPTIVE, continuité harnais) : top-5
  par compte de picks du train entier, consommés exclus, clé asc en égalité.

MÉTRIQUE. hit@5(événement) = |prédits ∩ picks réels de T en game g| / 5.

CRITÈRE PRIMAIRE (LE verdict G3-demande) : IC bootstrap 95 % APPARIÉ du delta
pooled hit@5(M) − hit@5(B1), bootstrap CLUSTER PAR SÉRIE — l'unité primaire
est la SÉRIE, comme S2/S3 : chaque resample tire avec remise parmi les séries
scorées et conserve TOUS les événements appariés M/B1 de chaque série tirée ;
1000 resamples, mulberry32(seed 42), flux unique consommé en ordre fixe
(primaire → S2 → S3) ; calcul via clusterBootstrapDeltaCI du module
src/lib/backtest/clusterBootstrap.ts (cluster = la série (corpus, matchId) —
module architecte, rien n'est recodé dans le script). lo > 0 ⇒ G3-demande
VERTE. IC touchant 0 ⇒ non significatif (gate fermée). hi < 0 ⇒ sous la
baseline (gate fermée).
Publication : pooled, par corpus, tranches gameNumber g=2 / g=3 / g≥4
(descriptives — g≥4 est la lecture « gardés G4/G5 » de l'architecture),
ligne B0, couvertures et exclusions.

SECONDAIRE S2 (déni — CORRÉLATIONNEL, déclaré non causal, sans effet de gate).
Train S2 ancré au patch de G1 (records du corpus de patch plaçable strictement
antérieur à patch(G1)) ; G1 de premier patch ou sans patch plaçable ⇒ série
non scorée S2, comptée ; toute game 2..L sans vainqueur ⇒ série exclue S2,
comptée. Par série scorée et équipe T : overlap = |picks de T en G1 ∩ top-10
comptes bruts de picks de l'ADVERSAIRE dans le train| ∈ [0..5] ; issue =
victoires de T sur les games 2..L / (L−1). Spearman ρ à rangs moyens (spearman
du module clusterBootstrap.ts) sur les points (série × équipe) ; IC bootstrap
PAR SÉRIE (les 2 points d'une série se rééchantillonnent ensemble, ρ recalculé
par resample). Publication : ρ, IC, table descriptive par overlap {0, 1, ≥2}.
Confusions déclarées : force des équipes, chevauchement de méta. Aucun verdict.

SECONDAIRE S3 (ordre de rétention du solveur — critère propre, NE rouvre PAS
la primaire ; c'est l'OPÉRATIONNALISATION du critère « rétention G4/G5 » de
§8 R5, enjeu = le badge, pas la porte). Périmètre : séries scorées de longueur
≥ 3 ; équipe = la GAGNANTE de la série (seriesWinner : égalité de maxWins ou
game sans vainqueur ⇒ undefined ⇒ exclue, comptée) ; format inféré par maxWins
(2 ⇒ bo3, 3 ⇒ bo5, autre ⇒ exclue, comptée). Train S3 ancré au patch de G1
comme S2 (G1 de premier patch ou sans patch plaçable ⇒ série non scorée S3,
comptée) ; winner(G1) requis pour le score réel de σ2 — règle écrite pour les
corpus futurs. État σ2 : gameNumber 2, score réel après G1, mode fearless,
firstSelectionHolder undefined (champ absent du corpus, noté), consommé =
picks G1, pools par rôle reconstruits DU TRAIN de chaque équipe :
entry (championKey, games, wins) du couple (équipe, champion, rôle).
holdValue(c) = −retentionValue(c, σ2, ctx vide, memo).futureLoss
(seriesSolver, DEFAULT_SERIES_SOLVER_CONFIG gelée telle que commitée :
priorMean 0,5, priorN 10, qualityWeight 1, depthWeight 0,05, depthCap 3,
emptyRoleQuality 0,25, pMin 0,05, pMax 0,95 ; estimateGameWin par défaut).
Paires (e, l) : e ∈ picks de T en game 2, l ∈ picks de T en DERNIÈRE game,
les deux présents dans le pool train de T. AUC = moyenne de
1[holdValue(l) > holdValue(e)] (égalité ½). IC bootstrap par série
(clusterBootstrapDeltaCI, observations appariées à la constante ½ — IC publié
retraduit sur l'échelle AUC). CRITÈRE S3 : lo > 0,5 ⇒ l'ORDRE de rétention du
panneau dépense/garde sort du badge Expérimental ; sinon il y reste. Le temps
moyen par appel retentionValue est publié (critère R5 « < 200 ms par nœud » :
informatif ici, bloquant pour le branchement UI live).

Run : node --experimental-transform-types --no-warnings scripts/backtest/seriesRetention.ts \
        static/corpus/lck-2026.json static/corpus/lec-2026.json \
        static/corpus/lfl-2026.json static/corpus/lpl-2026.json \
        data/corpus/lec-2025.json data/corpus/lfl-2025.json data/corpus/lpl-2025.json \
        [data/corpus/lck-2025.json] [--audit-only] [--generated-at ISO] \
        [--out docs/calibration/seriesRetention-g3.md]
*/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { basename, dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
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

type SeriesReplayModule = typeof import('../../src/lib/backtest/seriesReplay');
type SeriesDemandModule = typeof import('../../src/lib/estimators/seriesDemand');
type ClusterBootstrapModule = typeof import('../../src/lib/backtest/clusterBootstrap');
type MetricsModule = typeof import('../../src/lib/backtest/metrics');
type WalkforwardModule = typeof import('../../src/lib/backtest/walkforward');
type SeriesSolverModule = typeof import('../../src/lib/strategic/seriesSolver');
type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type DraftSide = import('../../src/lib/data/types').DraftSide;
type ReconstructedSeries = import('../../src/lib/backtest/seriesReplay').ReconstructedSeries;
type SeriesAnomaly = import('../../src/lib/backtest/seriesReplay').SeriesAnomaly;
type TournamentFearlessRow = import('../../src/lib/backtest/seriesReplay').TournamentFearlessRow;
type DemandSurface = import('../../src/lib/estimators/seriesDemand').DemandSurface;
type PairedObservation = import('../../src/lib/backtest/clusterBootstrap').PairedObservation;
type SeriesState = import('../../src/lib/strategic/seriesSolver').SeriesState;
type SeriesValueMemo = import('../../src/lib/strategic/seriesSolver').SeriesValueMemo;
type ChampionPoolEntry = import('../../src/lib/pro/types').ChampionPoolEntry;
type Role = import('../../src/lib/types').Role;

const { reconstructSeries, consumedBeforeGame, tournamentFearlessTable, seriesWinner, inferFormat } =
    (await import(`${libRootHref}/backtest/seriesReplay.ts`)) as SeriesReplayModule;
const { fitTeamDemand, predictGamePicks, presenceTop5, leagueTop5 } = (await import(
    `${libRootHref}/estimators/seriesDemand.ts`
)) as SeriesDemandModule;
const { clusterBootstrapDeltaCI, spearman } = (await import(
    `${libRootHref}/backtest/clusterBootstrap.ts`
)) as ClusterBootstrapModule;
const { mulberry32 } = (await import(`${libRootHref}/backtest/metrics.ts`)) as MetricsModule;
const { comparePatches, parsePatch } = (await import(
    `${libRootHref}/backtest/walkforward.ts`
)) as WalkforwardModule;
const { retentionValue } = (await import(`${libRootHref}/strategic/seriesSolver.ts`)) as SeriesSolverModule;

// ---- argv -------------------------------------------------------------------

const inputs: string[] = [];
let outPath = 'docs/calibration/seriesRetention-g3.md';
let generatedAt = new Date().toISOString();
let auditOnly = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') outPath = argv[++i];
    else if (argv[i] === '--generated-at') generatedAt = argv[++i];
    else if (argv[i] === '--audit-only') auditOnly = true;
    else inputs.push(argv[i]);
}
if (inputs.length === 0) {
    console.error(
        'Usage: node --experimental-transform-types scripts/backtest/seriesRetention.ts <corpus.json> [...] ' +
            '[--audit-only] [--out md] [--generated-at ISO]'
    );
    process.exit(1);
}

// ---- helpers ------------------------------------------------------------------

/** Équipe agissant côté `side` dans ce record. */
const actingTeam = (record: DraftRecord, side: DraftSide): string =>
    side === 'blue' ? record.blueTeam : record.redTeam;

/** Picks résolus de l'équipe T dans un record. */
function teamResolvedPicks(record: DraftRecord, team: string): string[] {
    const picks: string[] = [];
    for (const action of record.actions) {
        if (action.type !== 'pick' || action.championKey === '') continue;
        if (actingTeam(record, action.side) !== team) continue;
        picks.push(action.championKey);
    }
    return picks;
}

/** hit@5 = |prédits ∩ picks réels| / 5 (la division par 5 est gelée). */
function hitAt5(predicted: string[], actual: Set<string>): number {
    let hits = 0;
    for (const key of new Set(predicted)) if (actual.has(key)) hits += 1;
    return hits / 5;
}

const pct = (x: number): string => (Number.isFinite(x) ? `${(100 * x).toFixed(1)} %` : '—');
const pp = (x: number): string => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${(100 * x).toFixed(2)} pp` : '—');
const num = (x: number, digits = 3): string => (Number.isFinite(x) ? x.toFixed(digits) : '—');

/**
 * Quantile type-7 (interpolation linéaire) d'un tableau trié ascendant —
 * recopié À L'IDENTIQUE de la fonction privée de clusterBootstrap.ts pour le
 * percentile du ρ rééchantillonné (le module n'expose que l'IC de delta
 * moyen ; le ρ par resample est exigé par la règle, le quantile reste le même).
 */
function quantileSorted(sorted: number[], q: number): number {
    if (sorted.length === 0) return NaN;
    const h = (sorted.length - 1) * q;
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

const inc = (map: Map<string, number>, key: string, by = 1): void => {
    map.set(key, (map.get(key) ?? 0) + by);
};

// ---- par corpus : reconstitution, TEST 0, périmètre -----------------------------

interface CorpusContext {
    corpus: string;
    records: DraftRecord[];
    series: ReconstructedSeries[];
    anomalies: SeriesAnomaly[];
    testZero: TournamentFearlessRow[];
    excludedTournaments: string[];
    scoredSeries: ReconstructedSeries[];
    multiGameSeries: number;
    lengthCounts: Map<number, number>;
    laterPicks: number;
    repicks: number;
    rebans: { matchId: string; gameId: string; championKey: string }[];
    eventsBrut: number;
    eventsAfterTest0: number;
}

const corpora: CorpusContext[] = [];
for (const input of inputs) {
    const records = JSON.parse(readFileSync(resolve(repoRoot, input), 'utf8')) as DraftRecord[];
    const { series, anomalies } = reconstructSeries(records);
    const testZero = tournamentFearlessTable(series);
    const confirmed = new Set(testZero.filter((row) => row.fearlessConfirmed).map((row) => row.tournament));
    const scoredSeries = series.filter((s) => confirmed.has(s.tournament ?? '') && s.repickCount === 0);

    const lengthCounts = new Map<number, number>();
    let laterPicks = 0;
    let repicks = 0;
    const rebans: { matchId: string; gameId: string; championKey: string }[] = [];
    let eventsBrut = 0;
    for (const s of series) {
        inc(lengthCounts, s.games.length);
        repicks += s.repickCount;
        for (const reban of s.rebanOfConsumed) rebans.push({ matchId: s.matchId, ...reban });
        eventsBrut += 2 * Math.max(0, s.games.length - 1);
        for (const game of s.games) {
            const number = game.series?.gameNumber ?? 0;
            if (number < 2) continue;
            for (const action of game.actions) {
                if (action.type === 'pick' && action.championKey !== '') laterPicks += 1;
            }
        }
    }
    let eventsAfterTest0 = 0;
    for (const s of scoredSeries) eventsAfterTest0 += 2 * Math.max(0, s.games.length - 1);

    corpora.push({
        corpus: basename(input),
        records,
        series,
        anomalies,
        testZero,
        excludedTournaments: testZero.filter((row) => !row.fearlessConfirmed).map((row) => row.tournament),
        scoredSeries,
        multiGameSeries: series.filter((s) => s.games.length >= 2).length,
        lengthCounts,
        laterPicks,
        repicks,
        rebans,
        eventsBrut,
        eventsAfterTest0
    });
}

// ---- mode --audit-only : TEST 0 + comptes d'éligibilité, AUCUN scoring -----------

if (auditOnly) {
    const lines: string[] = [];
    lines.push('# Audit de périmètre (--audit-only) — AUCUN scoring, aucune métrique lue');
    lines.push('');
    lines.push('| Corpus | Records | Séries valides | Invalides | Multi-games | Longueurs | Picks games 2+ | Re-picks | Re-bans |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    let totalSeries = 0;
    let totalMulti = 0;
    let totalLater = 0;
    let totalRepicks = 0;
    let totalBrut = 0;
    let totalAfter = 0;
    for (const c of corpora) {
        const lengths = [...c.lengthCounts.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([len, count]) => `${len}:${count}`)
            .join(' ');
        lines.push(
            `| ${c.corpus} | ${c.records.length} | ${c.series.length} | ${c.anomalies.length} | ` +
                `${c.multiGameSeries} | ${lengths} | ${c.laterPicks} | ${c.repicks} | ${c.rebans.length} |`
        );
        totalSeries += c.series.length;
        totalMulti += c.multiGameSeries;
        totalLater += c.laterPicks;
        totalRepicks += c.repicks;
        totalBrut += c.eventsBrut;
        totalAfter += c.eventsAfterTest0;
    }
    lines.push(
        `| **Total** | — | **${totalSeries}** | — | **${totalMulti}** | — | **${totalLater}** | **${totalRepicks}** | — |`
    );
    lines.push('');
    lines.push('## TEST 0 par tournoi');
    lines.push('');
    lines.push('| Corpus | Tournoi | Séries multi-games | Picks ultérieurs | Re-picks | Re-bans | Fearless confirmé |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const c of corpora) {
        for (const row of c.testZero) {
            lines.push(
                `| ${c.corpus} | ${row.tournament || '(sans tournoi)'} | ${row.multiGameSeries} | ` +
                    `${row.laterPicks} | ${row.repicks} | ${row.rebans} | ${row.fearlessConfirmed ? 'OUI' : 'NON — exclu du scoring'} |`
            );
        }
    }
    lines.push('');
    lines.push(`Événements bruts (équipe × game g ≥ 2) : ${totalBrut} — après exclusion TEST 0 : ${totalAfter}.`);
    lines.push('');
    lines.push('## Anomalies (séries invalides, re-bans d’un consommé) par gameId');
    lines.push('');
    for (const c of corpora) {
        for (const anomaly of c.anomalies) {
            lines.push(`- ${c.corpus} · série ${anomaly.matchId} : ${anomaly.kind} (${anomaly.detail})`);
        }
        for (const reban of c.rebans) {
            lines.push(`- ${c.corpus} · re-ban d'un consommé : ${reban.championKey} (série ${reban.matchId}, game ${reban.gameId})`);
        }
    }
    lines.push('');
    lines.push('> Mode --audit-only : périmètre seulement — aucun hit@5, aucun ρ, aucune AUC calculés.');
    console.log(lines.join('\n'));
    process.exit(0);
}

// ---- scoring : événements primaires + points S2 + paires S3 ----------------------
// Tout est COLLECTÉ d'abord ; les trois bootstraps consomment ensuite UN flux
// mulberry32(42) en ordre fixe : primaire → S2 → S3 (règle §1.1).

interface ScoredEvent {
    corpus: string;
    cluster: string;
    gameNumber: number;
    hitM: number;
    hitB1: number;
    hitB0: number;
}

interface S2Point {
    cluster: string;
    overlap: number;
    issue: number;
}

const events: ScoredEvent[] = [];
const discardedByCause = new Map<string, number>();
const discardedByCorpus = new Map<string, Map<string, number>>();

const s2Points: S2Point[] = [];
const s2Exclusions = new Map<string, number>();
let s2SeriesScored = 0;

const s3Observations: PairedObservation[] = [];
const s3Exclusions = new Map<string, number>();
let s3SeriesWithPairs = 0;
let s3PairCount = 0;
let s3EligibleE = 0;
let s3EligibleL = 0;
let retentionCalls = 0;
let retentionMs = 0;

for (const c of corpora) {
    const discarded = new Map<string, number>();
    discardedByCorpus.set(c.corpus, discarded);

    // Folds walk-forward du corpus : train = records de patch plaçable < k.
    const trainByPatch = new Map<string, DraftRecord[]>();
    const trainFor = (patch: string): DraftRecord[] => {
        let train = trainByPatch.get(patch);
        if (train === undefined) {
            train = c.records.filter(
                (r) =>
                    r.patch !== undefined &&
                    parsePatch(r.patch) !== undefined &&
                    comparePatches(r.patch, patch) < 0
            );
            trainByPatch.set(patch, train);
        }
        return train;
    };
    const surfaceCache = new Map<string, DemandSurface>();
    const surfaceFor = (patch: string, team: string, now: string): DemandSurface => {
        const key = `${patch}|${now}|${team}`;
        let surface = surfaceCache.get(key);
        if (surface === undefined) {
            surface = fitTeamDemand(trainFor(patch), { team, now });
            surfaceCache.set(key, surface);
        }
        return surface;
    };

    // ---- événements primaires --------------------------------------------------
    for (const series of c.scoredSeries) {
        const cluster = `${c.corpus}|${series.matchId}`;
        for (const game of series.games) {
            const g = game.series?.gameNumber ?? 0;
            if (g < 2) continue;
            for (const team of series.teams) {
                // Walk-forward : patch plaçable + train non vide (premier patch).
                if (game.patch === undefined || parsePatch(game.patch) === undefined) {
                    inc(discarded, 'patch non plaçable');
                    inc(discardedByCause, 'patch non plaçable');
                    continue;
                }
                const train = trainFor(game.patch);
                if (train.length === 0) {
                    inc(discarded, 'premier patch (train vide)');
                    inc(discardedByCause, 'premier patch (train vide)');
                    continue;
                }
                // Horloge injectée = date du record de la game (100 % au corpus).
                if (game.date === undefined) {
                    inc(discarded, 'date manquante');
                    inc(discardedByCause, 'date manquante');
                    continue;
                }
                // Cible = les 5 picks résolus de T en game g.
                const target = teamResolvedPicks(game, team);
                if (target.length !== 5) {
                    inc(discarded, 'cible ≠ 5 picks résolus');
                    inc(discardedByCause, 'cible ≠ 5 picks résolus');
                    continue;
                }
                const consumed = consumedBeforeGame(series, g);
                const surface = surfaceFor(game.patch, team, game.date);
                const actual = new Set(target);
                events.push({
                    corpus: c.corpus,
                    cluster,
                    gameNumber: g,
                    hitM: hitAt5(predictGamePicks(surface, consumed), actual),
                    hitB1: hitAt5(presenceTop5(surface, consumed), actual),
                    hitB0: hitAt5(leagueTop5(surface, consumed), actual)
                });
            }
        }
    }

    // ---- S2 : déni précoce -------------------------------------------------------
    const top10Cache = new Map<string, string[]>();
    const top10For = (patch: string, opponent: string): string[] => {
        const key = `${patch}|${opponent}`;
        let top = top10Cache.get(key);
        if (top === undefined) {
            const counts = new Map<string, number>();
            for (const record of trainFor(patch)) {
                for (const pick of teamResolvedPicks(record, opponent)) inc(counts, pick);
            }
            // Tie-break déclaré (la règle fixe « top-10 comptes bruts » sans
            // départage) : compte desc → clé asc — déterministe, publié aux Notes.
            top = [...counts.entries()]
                .sort((a, b) => (a[1] !== b[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1))
                .slice(0, 10)
                .map(([championKey]) => championKey);
            top10Cache.set(key, top);
        }
        return top;
    };

    for (const series of c.scoredSeries) {
        const cluster = `${c.corpus}|${series.matchId}`;
        const L = series.games.length;
        if (L < 2) {
            inc(s2Exclusions, 'série mono-game (L−1 = 0)');
            continue;
        }
        const g1 = series.games[0];
        if (g1.patch === undefined || parsePatch(g1.patch) === undefined) {
            inc(s2Exclusions, 'patch de G1 non plaçable');
            continue;
        }
        const train = trainFor(g1.patch);
        if (train.length === 0) {
            inc(s2Exclusions, 'G1 de premier patch (train vide)');
            continue;
        }
        const laterGames = series.games.slice(1);
        if (laterGames.some((game) => game.winner === undefined)) {
            inc(s2Exclusions, 'game 2..L sans vainqueur');
            continue;
        }
        s2SeriesScored += 1;
        for (const team of series.teams) {
            const opponent = team === series.teams[0] ? series.teams[1] : series.teams[0];
            const top10 = new Set(top10For(g1.patch, opponent));
            const g1Picks = new Set(teamResolvedPicks(g1, team));
            let overlap = 0;
            for (const key of g1Picks) if (top10.has(key)) overlap += 1;
            let wins = 0;
            for (const game of laterGames) {
                if (game.winner !== undefined && actingTeam(game, game.winner) === team) wins += 1;
            }
            s2Points.push({ cluster, overlap, issue: wins / (L - 1) });
        }
    }

    // ---- S3 : ordre de rétention du solveur ---------------------------------------
    const poolsCache = new Map<string, Partial<Record<Role, ChampionPoolEntry[]>>>();
    const poolsFor = (patch: string, team: string): Partial<Record<Role, ChampionPoolEntry[]>> => {
        const key = `${patch}|${team}`;
        let pools = poolsCache.get(key);
        if (pools === undefined) {
            // entry (championKey, games, wins) du couple (équipe, champion, rôle) ;
            // une game de train sans vainqueur compte games+1, wins+0.
            const byRole = new Map<Role, Map<string, { games: number; wins: number }>>();
            for (const record of trainFor(patch)) {
                for (const action of record.actions) {
                    if (action.type !== 'pick' || action.championKey === '' || action.role === undefined) continue;
                    if (actingTeam(record, action.side) !== team) continue;
                    let roleMap = byRole.get(action.role);
                    if (roleMap === undefined) {
                        roleMap = new Map<string, { games: number; wins: number }>();
                        byRole.set(action.role, roleMap);
                    }
                    const cell = roleMap.get(action.championKey) ?? { games: 0, wins: 0 };
                    cell.games += 1;
                    if (record.winner === action.side) cell.wins += 1;
                    roleMap.set(action.championKey, cell);
                }
            }
            pools = {};
            for (const [role, roleMap] of byRole) {
                pools[role] = [...roleMap.entries()].map(([championKey, cell]) => ({
                    championKey,
                    games: cell.games,
                    wins: cell.wins
                }));
            }
            poolsCache.set(key, pools);
        }
        return pools;
    };

    for (const series of c.scoredSeries) {
        const cluster = `${c.corpus}|${series.matchId}`;
        const L = series.games.length;
        if (L < 3) {
            inc(s3Exclusions, 'longueur < 3 (hors périmètre)');
            continue;
        }
        const winner = seriesWinner(series);
        if (winner === undefined) {
            inc(s3Exclusions, 'vainqueur de série indéterminé');
            continue;
        }
        const format = inferFormat(series);
        if (format === undefined) {
            inc(s3Exclusions, 'format non inféré (maxWins ∉ {2, 3})');
            continue;
        }
        const g1 = series.games[0];
        if (g1.patch === undefined || parsePatch(g1.patch) === undefined) {
            inc(s3Exclusions, 'patch de G1 non plaçable');
            continue;
        }
        const train = trainFor(g1.patch);
        if (train.length === 0) {
            inc(s3Exclusions, 'G1 de premier patch (train vide)');
            continue;
        }
        if (g1.winner === undefined) {
            // Inatteignable quand seriesWinner est défini — garde défensive.
            inc(s3Exclusions, 'G1 sans vainqueur');
            continue;
        }
        const enemy = winner === series.teams[0] ? series.teams[1] : series.teams[0];
        const wonG1 = actingTeam(g1, g1.winner) === winner;
        const sigma2: SeriesState = {
            gameNumber: 2,
            format,
            score: wonG1 ? { ally: 1, enemy: 0 } : { ally: 0, enemy: 1 },
            mode: 'fearless',
            poolsBySide: { ally: poolsFor(g1.patch, winner), enemy: poolsFor(g1.patch, enemy) },
            consumed: consumedBeforeGame(series, 2)
            // firstSelectionHolder : undefined (champ absent du corpus, noté au rapport).
        };
        const trainPool = new Set<string>();
        for (const entries of Object.values(sigma2.poolsBySide.ally)) {
            for (const entry of entries ?? []) trainPool.add(entry.championKey);
        }
        const earlyPicks = [...new Set(teamResolvedPicks(series.games[1], winner))].filter((key) =>
            trainPool.has(key)
        );
        const latePicks = [...new Set(teamResolvedPicks(series.games[L - 1], winner))].filter((key) =>
            trainPool.has(key)
        );
        s3EligibleE += earlyPicks.length;
        s3EligibleL += latePicks.length;
        if (earlyPicks.length === 0 || latePicks.length === 0) {
            inc(s3Exclusions, 'aucune paire éligible (picks hors pool train)');
            continue;
        }
        const memo: SeriesValueMemo = new Map();
        const holdCache = new Map<string, number>();
        const holdValue = (championKey: string): number => {
            let value = holdCache.get(championKey);
            if (value === undefined) {
                const start = performance.now();
                const retention = retentionValue(championKey, sigma2, {}, memo);
                retentionMs += performance.now() - start;
                retentionCalls += 1;
                value = -retention.futureLoss;
                holdCache.set(championKey, value);
            }
            return value;
        };
        s3SeriesWithPairs += 1;
        for (const early of earlyPicks) {
            for (const late of latePicks) {
                const hl = holdValue(late);
                const he = holdValue(early);
                const score = hl > he ? 1 : hl < he ? 0 : 0.5;
                s3Observations.push({ cluster, model: score, baseline: 0.5 });
                s3PairCount += 1;
            }
        }
    }
}

// ---- statistiques : UN flux mulberry32(42), ordre primaire → S2 → S3 -------------

const rng = mulberry32(42);

// 1. PRIMAIRE — IC bootstrap cluster par série du delta hit@5(M) − hit@5(B1).
const primaryObservations: PairedObservation[] = events.map((e) => ({
    cluster: e.cluster,
    model: e.hitM,
    baseline: e.hitB1
}));
const primary = clusterBootstrapDeltaCI(primaryObservations, { iterations: 1000, rng });
const primaryGreen = primary.ci95.lo > 0;
const verdict = primaryGreen ? 'G3-demande VERTE' : 'G3-demande ROUGE';
const verdictReason = primaryGreen
    ? 'lo > 0 : la demande par rôle bat la présence avec IC cluster par série'
    : primary.ci95.hi < 0
      ? 'hi < 0 : sous la baseline (gate fermée)'
      : 'IC touchant 0 : non significatif (gate fermée)';

// 2. S2 — ρ de Spearman + IC bootstrap par série (ρ recalculé par resample).
const s2Rho = spearman(
    s2Points.map((p) => p.overlap),
    s2Points.map((p) => p.issue)
);
const s2Clusters = new Map<string, S2Point[]>();
for (const point of s2Points) {
    const bucket = s2Clusters.get(point.cluster) ?? [];
    bucket.push(point);
    s2Clusters.set(point.cluster, bucket);
}
const s2ClusterList = [...s2Clusters.values()];
const s2Rhos: number[] = [];
if (s2ClusterList.length > 0) {
    for (let i = 0; i < 1000; i++) {
        const xs: number[] = [];
        const ys: number[] = [];
        for (let k = 0; k < s2ClusterList.length; k++) {
            const drawn = s2ClusterList[Math.floor(rng() * s2ClusterList.length)];
            for (const point of drawn) {
                xs.push(point.overlap);
                ys.push(point.issue);
            }
        }
        const rho = spearman(xs, ys);
        if (!Number.isNaN(rho)) s2Rhos.push(rho);
    }
    s2Rhos.sort((a, b) => a - b);
}
const s2Ci = { lo: quantileSorted(s2Rhos, 0.025), hi: quantileSorted(s2Rhos, 0.975) };

// 3. S3 — AUC vs ½ par clusterBootstrapDeltaCI (constante ½), retraduit AUC.
const s3 = clusterBootstrapDeltaCI(s3Observations, { iterations: 1000, rng });
const s3Auc = 0.5 + s3.delta;
const s3AucCi = { lo: 0.5 + s3.ci95.lo, hi: 0.5 + s3.ci95.hi };
const s3Green = s3AucCi.lo > 0.5;
const meanRetentionMs = retentionCalls > 0 ? retentionMs / retentionCalls : NaN;

// ---- rendu markdown ---------------------------------------------------------------

const lines: string[] = [];
lines.push('# Gate G3-demande — postdiction de la demande série Fearless');
lines.push('');
lines.push(`> Généré : ${generatedAt} · règle pré-enregistrée VERBATIM en tête de \`scripts/backtest/seriesRetention.ts\``);
lines.push('> (design gelé docs/run2/C-fearless-g3.md §1.1). Une règle, un run — tout rouge est gelé.');
lines.push(`> Corpus en entrée : ${inputs.map((i) => basename(i)).join(', ')}.`);
if (!inputs.some((i) => basename(i).includes('lck-2025'))) {
    lines.push('> lck-2025.json absent ⇒ run sur les corpus fournis ; s’il arrive plus tard : réplication descriptive, verdict inchangé.');
}
lines.push('');

// TEST 0.
lines.push('## TEST 0 — Fearless empirique, bloquant par tournoi');
lines.push('');
lines.push('| Corpus | Tournoi | Séries multi-games | Picks ultérieurs | Re-picks | Re-bans d’un consommé | Verdict |');
lines.push('|---|---|---|---|---|---|---|');
for (const c of corpora) {
    for (const row of c.testZero) {
        lines.push(
            `| ${c.corpus} | ${row.tournament || '(sans tournoi)'} | ${row.multiGameSeries} | ${row.laterPicks} | ` +
                `${row.repicks} | ${row.rebans} | ${row.fearlessConfirmed ? 'Fearless confirmé' : 'NON confirmé — exclu du scoring'} |`
        );
    }
}
lines.push('');

// Primaire.
const meanOf = (xs: number[]): number => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length);
const sliceRow = (label: string, slice: ScoredEvent[], ci?: { lo: number; hi: number }): string => {
    const clusters = new Set(slice.map((e) => e.cluster)).size;
    const hitM = meanOf(slice.map((e) => e.hitM));
    const hitB1 = meanOf(slice.map((e) => e.hitB1));
    const ciText = ci === undefined ? '—' : `[${pp(ci.lo)} ; ${pp(ci.hi)}]`;
    return `| ${label} | ${slice.length} | ${clusters} | ${pct(hitM)} | ${pct(hitB1)} | ${pp(hitM - hitB1)} | ${ciText} |`;
};
lines.push('## Primaire — hit@5 : demande par rôle (M) vs présence équipe (B1)');
lines.push('');
lines.push('| Tranche | Événements | Séries | hit@5 M | hit@5 B1 | Δ (M − B1) | IC 95 % cluster par série |');
lines.push('|---|---|---|---|---|---|---|');
lines.push(sliceRow('POOLED (le verdict)', events, primary.ci95));
for (const c of corpora) {
    lines.push(sliceRow(c.corpus, events.filter((e) => e.corpus === c.corpus)));
}
lines.push(sliceRow('g = 2', events.filter((e) => e.gameNumber === 2)));
lines.push(sliceRow('g = 3', events.filter((e) => e.gameNumber === 3)));
lines.push(sliceRow('g ≥ 4 (lecture « gardés G4/G5 »)', events.filter((e) => e.gameNumber >= 4)));
lines.push('');
lines.push(`Ligne B0 (fréquence ligue, descriptive) : hit@5 B0 pooled = ${pct(meanOf(events.map((e) => e.hitB0)))} ` +
    `(M = ${pct(meanOf(events.map((e) => e.hitM)))}, B1 = ${pct(meanOf(events.map((e) => e.hitB1)))}).`);
lines.push('');
lines.push(`**Verdict : ${verdict}** — ${verdictReason}.`);
lines.push(`Delta pooled ${pp(primary.delta)}, IC 95 % [${pp(primary.ci95.lo)} ; ${pp(primary.ci95.hi)}], ` +
    `${primary.observations} événements appariés sur ${primary.clusters} séries.`);
lines.push('');

// S2.
lines.push('## S2 — déni précoce (corrélationnel, déclaré non causal, sans effet de gate)');
lines.push('');
lines.push(`- ρ de Spearman (rangs moyens) = ${num(s2Rho)} · IC bootstrap par série [${num(s2Ci.lo)} ; ${num(s2Ci.hi)}] ` +
    `(${s2Points.length} points équipe × série, ${s2SeriesScored} séries scorées S2, ρ recalculé sur chacun des 1000 resamples).`);
lines.push('- Confusions déclarées : force des équipes, chevauchement de méta. AUCUN verdict.');
lines.push('');
lines.push('| Overlap G1 ∩ top-10 adverse | Points | Issue moyenne (wins games 2..L / (L−1)) |');
lines.push('|---|---|---|');
const overlapBuckets: [string, (p: S2Point) => boolean][] = [
    ['0', (p) => p.overlap === 0],
    ['1', (p) => p.overlap === 1],
    ['≥ 2', (p) => p.overlap >= 2]
];
for (const [label, filter] of overlapBuckets) {
    const bucket = s2Points.filter(filter);
    lines.push(`| ${label} | ${bucket.length} | ${pct(meanOf(bucket.map((p) => p.issue)))} |`);
}
lines.push('');
if (s2Exclusions.size > 0) {
    lines.push('Exclusions S2 : ' + [...s2Exclusions.entries()].map(([cause, n]) => `${cause} : ${n}`).join(' · ') + '.');
    lines.push('');
}

// S3.
lines.push('## S3 — ordre de rétention du solveur (enjeu : badge, pas la porte)');
lines.push('');
lines.push(`- AUC (holdValue(late) > holdValue(early), égalité ½) = ${num(s3Auc)} · IC 95 % par série ` +
    `[${num(s3AucCi.lo)} ; ${num(s3AucCi.hi)}] — ${s3PairCount} paires sur ${s3SeriesWithPairs} séries ` +
    `(${s3.clusters} clusters au bootstrap).`);
lines.push(`- Couverture des paires : ${s3EligibleE} picks early et ${s3EligibleL} picks late présents au pool train du vainqueur.`);
lines.push(`- **Critère S3 : ${s3Green ? 'lo > 0,5 — l’ORDRE de rétention sort du badge Expérimental' : 'lo ≤ 0,5 — le badge Expérimental reste'}.**`);
lines.push(`- Temps moyen par appel \`retentionValue\` : ${num(meanRetentionMs, 2)} ms ` +
    `(${retentionCalls} appels — informatif ici, bloquant pour le branchement UI live, critère R5 < 200 ms).`);
lines.push('- σ2 : score réel après G1, consommé = picks G1, pools du train ancré au patch de G1, firstSelectionHolder undefined (champ absent du corpus).');
lines.push('');
if (s3Exclusions.size > 0) {
    lines.push('Exclusions S3 : ' + [...s3Exclusions.entries()].map(([cause, n]) => `${cause} : ${n}`).join(' · ') + '.');
    lines.push('');
}

// Couverture / exclusions / anomalies.
lines.push('## Couverture, exclusions, anomalies');
lines.push('');
for (const c of corpora) {
    const scored = events.filter((e) => e.corpus === c.corpus).length;
    const discarded = discardedByCorpus.get(c.corpus) ?? new Map<string, number>();
    const causes =
        discarded.size === 0
            ? 'aucun écarté'
            : [...discarded.entries()].map(([cause, n]) => `${cause} : ${n}`).join(' · ');
    lines.push(
        `- ${c.corpus} : ${c.records.length} records → ${c.series.length} séries valides ` +
            `(${c.anomalies.length} invalides), ${c.multiGameSeries} multi-games, ` +
            `${c.eventsBrut} événements bruts → ${c.eventsAfterTest0} après TEST 0 → ${scored} scorés (${causes}).` +
            (c.excludedTournaments.length > 0
                ? ` Tournois exclus par TEST 0 : ${c.excludedTournaments.map((t) => t || '(sans tournoi)').join(', ')}.`
                : '')
    );
}
const anomalyLines: string[] = [];
for (const c of corpora) {
    for (const anomaly of c.anomalies) {
        anomalyLines.push(`- ${c.corpus} · série ${anomaly.matchId} : ${anomaly.kind} (${anomaly.detail})`);
    }
    for (const reban of c.rebans) {
        anomalyLines.push(
            `- ${c.corpus} · re-ban d'un consommé : ${reban.championKey} (série ${reban.matchId}, game ${reban.gameId}) — signalé, tournoi NON exclu.`
        );
    }
}
if (anomalyLines.length > 0) {
    lines.push('');
    lines.push('Anomalies citées par gameId :');
    lines.push(...anomalyLines);
}
lines.push('');

// Notes.
lines.push('## Notes');
lines.push('');
lines.push('- Une règle, un run : tout rouge est gelé tel quel ; toute nouvelle piste exigera un NOUVEL en-tête daté.');
lines.push('- Seed 42, 1000 resamples, flux rng UNIQUE consommé en ordre fixe : primaire → S2 → S3 ; cluster = série (corpus, matchId).');
lines.push('- Statistiques consommées de `$lib/backtest/clusterBootstrap` (clusterBootstrapDeltaCI, spearman) et `$lib/backtest/metrics` (mulberry32) — rien de statistique recodé ici (seul le quantile type-7 privé du module est recopié à l’identique pour le percentile du ρ rééchantillonné).');
lines.push('- Tie-break du top-10 S2 (non fixé par la règle) déclaré : compte brut desc → clé asc.');
lines.push('- La couverture 70,3 % / 68,1 % de l’audit §1.0 est une mesure outcome-adjacente — le recall du pool train — prise avant gel, sans aucun calcul de hit@5, de ρ ni d’AUC.');
lines.push('- Le verdict imprimé est « G3-demande VERTE/ROUGE », jamais « G3 VERTE » (amendement de gouvernance §1.3, périmètre de porte).');
lines.push('');

const markdown = lines.join('\n') + '\n';
const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, markdown, 'utf8');
console.log(markdown);
console.log(`Écrit : ${absOut}`);
console.log(`Verdict : ${verdict}`);
