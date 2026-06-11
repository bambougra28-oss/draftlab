/*
F1 — PREMIUM DU POCKET PICK (chantier F, run #2). Règle pré-enregistrée, à geler
verbatim dans l'en-tête de scripts/backtest/pocketPremium.ts AVANT tout run.
UNE règle, UN run ; tout rouge est gelé ; toute nouvelle piste = NOUVEL en-tête daté.

PRÉCONDITION (bloquante) : corpora re-pullés post-forensics (les snapshots du
2026-06-10 portent les erreurs de la finale LEC 2026 — vérifié : G5 après série
3-1, Nasus attribué à KC) ; validateur d'intégrité Bo passé ; amendement
d'architecte re-figeant les audits de la run #2 sur l'état re-pullé ; sha256 des
7 fichiers publiés dans le rapport.

CORPUS : static/corpus/{lck,lec,lfl,lpl}-2026.json +
data/corpus/{lec,lfl,lpl}-2025.json (re-pullés). lck-2025 s'il arrive = run de
RÉPLICATION séparé, jamais fusionné.

TEST F0 (bloquant PAR SÉRIE, publié par tournoi) : reconstruction par
(corpus, series.matchId) via reconstructSeries (module C). Série exclue et
comptée si : maxWins ≥ 4 ; ou une équipe atteint 3 victoires avant une game
suivante ; ou gameNumber dupliqué/troué ; ou équipes ≠ exactement 2. Les
séquences « 2-0 puis G3 » sont GARDÉES et listées (Bo3 format-fixe possible).
Exclusion TEST 0 héritée de C : tournois non Fearless-confirmés (attendu :
LFL 2025 Promotion) exclus du stratum gameNumber mais gardés en pooled (la
définition d'événement ne dépend pas du mode).

WALK-FORWARD PAR PATCH, PAR CORPUS (patron postdiction/C) : pour une game de
patch k, train = records du même corpus de patch plaçable strictement antérieur
(parsePatch/comparePatches) ; premier patch ou patch non plaçable ⇒ game non
scorée, comptée.

ÉVÉNEMENT POCKET (structurel — AUCUNE issue lue dans la définition) : pick
résolu (champion c, rôle r, équipe T) tel que (P1) picks de c par T dans le
train = 0 ; ET (P2) picks de c dans le train ligue toutes équipes ≤ 2 (tous
rôles confondus) ; ET (P3) c n'est pas sorti après le 2025-01-01 (liste DDragon
figée au gel, publiée — neutralise les nouveaux champions). CLASSE CONTRASTE
« nouveauté banale » : (P1) ET picks ligue train ≥ 20 ET (P3). Seuils
0 / ≤ 2 / ≥ 20 GELÉS ici.

GAME SCORÉE : vainqueur connu, 10 picks résolus avec rôles, fold non vide,
série non exclue F0, et EXACTEMENT UN side porte ≥ 1 événement de la classe
considérée (les games à événements des deux côtés sont exclues, comptées —
attendu d'audit : ~323 pour la classe pocket) ; pour la classe contraste :
exactement un side nouveauté ET zéro événement pocket dans la game.

MÉTRIQUE : WR_pocket = part des games pocket gagnées par le side pocket ;
WR_nouveauté = idem classe contraste ; premium = WR_pocket − WR_nouveauté.

BASELINES (obligatoires, pré-enregistrées) : B0 — hasard 0,5 (symétrie
within-game ; side-only ≈ pile-ou-face validé scorecards). B1 (baseline
ACTIVE) — WR_nouveauté : même fraîcheur « jamais montré par l'équipe », sans
rareté de ligue — neutralise « jouer du neuf » et une partie de la sélection
« les équipes qui osent sont des équipes qui préparent ».

CRITÈRES DE VERDICT (gelés) : Critère 1 : Wilson 95 % lo de WR_pocket > 0,5
(pooled 7 corpus). Critère 2 : IC bootstrap 95 % du premium, resampling par
CLUSTER de série ((corpus, matchId) ; game sans série = son propre cluster),
statistique WR_pocket − WR_nouveauté RECALCULÉE par resample (patron S2 du
chantier C), 1000 resamples, mulberry32(seed 42), flux unique en ordre fixe
(critère 2 puis S1) ; lo > 0. VERT = 1 ET 2 (claim : « le pick hors-radar rare
porte un premium au-delà de la simple nouveauté — corrélation, pas
causalité »). ORANGE = 1 seul (« le side qui ose gagne plus, mais pas plus que
pour toute nouveauté »). ROUGE = critère 1 non atteint. Aucun retuning : la
règle est consommée.

PUISSANCE DÉCLARÉE (comptes structurels pris le 2026-06-11 AVANT gel, AUCUN WR
calculé) : ~679 games pocket one-side attendues (lck26 77, lec26 76, lfl26 56,
lpl26 102, lec25 103, lfl25 98, lpl25 167 ; ~531 clusters), ~617 en G1-3, ~62
en G4-5 ; ~1 908 picks-événements. Au seuil n≈679, le critère 1 exige
WR ≳ 53,8 % (MDE ≈ +3,8 pp) ; un effet réel plus petit sera publié non
significatif — c'est le contrat. La tranche G4-5 (n≈62, ±12 pp) ne peut porter
AUCUN verdict.

SECONDAIRES (descriptives, AUCUN pouvoir de verdict) : S1 — premium par bin
gameNumber {1-3, 4-5} (l'hypothèse directionnelle d'origine « la valeur du
pocket monte avec le numéro de game », lue à titre descriptif seulement). S2 —
WR_pocket par corpus + liste exhaustive des événements (champion, rôle, équipe,
gameId) en annexe — le cas G2-Nasus doit y figurer (test de cohérence du
re-pull). S3 — distribution des événements par rôle et par index de pick du
side (1..5). S4 — part des picks pocket également hors-rôle (croisement F2).
COUVERTURE : exclusions par cause et par corpus (F0, fold, both-sides, picks
irrésolus).

FUITES / FISHING : définitions d'événements 100 % train (walk-forward strict)
et structurelles — l'issue n'entre que dans la métrique ; biais de sélection
NON neutralisable DÉCLARÉ (les équipes sortent le pocket quand les conditions
s'y prêtent) ⇒ langage corrélationnel obligatoire dans le rapport ET l'UI ; mix
de strates différent entre classes pocket/nouveauté déclaré (S1 publie les
bins) ; ~12 événements répétés (même équipe, même champion) sur 146 hors-rôle :
le cluster par série absorbe l'essentiel, le reste est déclaré ; UNE primaire,
deux critères, secondaires étiquetées d'avance ; --audit-only n'imprime jamais
un WR ; le commit de l'en-tête précède le run.

RUN : node --experimental-transform-types --no-warnings
scripts/backtest/pocketPremium.ts static/corpus/lck-2026.json
static/corpus/lec-2026.json static/corpus/lfl-2026.json
static/corpus/lpl-2026.json data/corpus/lec-2025.json data/corpus/lfl-2025.json
data/corpus/lpl-2025.json [--seed 42] [--audit-only] [--generated-at ISO]
[--out docs/calibration/pocket-premium-f1.md]

--- FIN DE LA RÈGLE GELÉE (recopiée VERBATIM de docs/run2/F-pocket-picks.md §3.1) ---

Note d'implémentation (hors règle) : la « liste DDragon figée au gel » (P3)
est lue dans data/pocket/new-champions-since-2025.json
({ frozenAt, source, championKeys[] }) — fichier à committer PAR L'ARCHITECTE
au gel, sha256 et contenu publiés dans le rapport. Fichier absent ⇒ le script
S'ARRÊTE (les runs sont de toute façon BLOQUÉS par les préconditions §0).
LES RUNS RÉELS SONT ARCHITECTE-ONLY.
*/
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

type PocketEventsModule = typeof import('../../src/lib/backtest/pocketEvents');
type SeriesReplayModule = typeof import('../../src/lib/backtest/seriesReplay');
type MetricsModule = typeof import('../../src/lib/backtest/metrics');
type WalkforwardModule = typeof import('../../src/lib/backtest/walkforward');
type RolePriorsModule = typeof import('../../src/lib/aggregates/rolePriors');
type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type DraftSide = import('../../src/lib/data/types').DraftSide;
type ReconstructedSeries = import('../../src/lib/backtest/seriesReplay').ReconstructedSeries;
type TournamentFearlessRow = import('../../src/lib/backtest/seriesReplay').TournamentFearlessRow;
type PocketTrainTallies = import('../../src/lib/backtest/pocketEvents').PocketTrainTallies;
type ResolvedSidePick = import('../../src/lib/backtest/pocketEvents').ResolvedSidePick;
type Role = import('../../src/lib/types').Role;

const {
    isPocketEvent,
    isNoveltyContrastEvent,
    tallyPocketTrain,
    pocketCountsOf,
    roleCompleteSidePicks,
    oneSideOf,
    noveltyGameVerdictOf,
    foldCountsOf,
    isClassAEvent,
    isClassBEvent
} = (await import(`${libRootHref}/backtest/pocketEvents.ts`)) as PocketEventsModule;
const { reconstructSeries, tournamentFearlessTable } = (await import(
    `${libRootHref}/backtest/seriesReplay.ts`
)) as SeriesReplayModule;
const { wilson95, mulberry32 } = (await import(`${libRootHref}/backtest/metrics.ts`)) as MetricsModule;
const { comparePatches, parsePatch } = (await import(
    `${libRootHref}/backtest/walkforward.ts`
)) as WalkforwardModule;
const { fitRolePriors } = (await import(`${libRootHref}/aggregates/rolePriors.ts`)) as RolePriorsModule;

// ---- argv -------------------------------------------------------------------

const inputs: string[] = [];
let outPath = 'docs/calibration/pocket-premium-f1.md';
let generatedAt = new Date().toISOString();
let auditOnly = false;
let seed = 42;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') outPath = argv[++i];
    else if (argv[i] === '--generated-at') generatedAt = argv[++i];
    else if (argv[i] === '--audit-only') auditOnly = true;
    else if (argv[i] === '--seed') seed = Number(argv[++i]);
    else inputs.push(argv[i]);
}
if (inputs.length === 0 || Number.isNaN(seed)) {
    console.error(
        'Usage: node --experimental-transform-types --no-warnings scripts/backtest/pocketPremium.ts ' +
            '<corpus.json> [...] [--seed 42] [--audit-only] [--generated-at ISO] [--out md]'
    );
    process.exit(1);
}

// ---- liste DDragon figée (P3) — paramètre publié, jamais une constante codée ----

interface NewChampionsFile {
    frozenAt: string;
    source?: string;
    championKeys: string[];
}

const NEW_CHAMPIONS_PATH = 'data/pocket/new-champions-since-2025.json';
const newChampionsAbs = resolve(repoRoot, NEW_CHAMPIONS_PATH);
if (!existsSync(newChampionsAbs)) {
    console.error(
        `ERREUR — liste DDragon figée absente : ${NEW_CHAMPIONS_PATH}\n` +
            'P3 exige la liste des champions sortis après le 2025-01-01, FIGÉE AU GEL et publiée.\n' +
            "L'architecte doit committer ce fichier ({ frozenAt, source, championKeys[] }) avant tout run\n" +
            '(les runs F1 sont de toute façon BLOQUÉS par les préconditions §0 de docs/run2/F-pocket-picks.md).'
    );
    process.exit(1);
}
const newChampionsBytes = readFileSync(newChampionsAbs);
const newChampionsFile = JSON.parse(newChampionsBytes.toString('utf8')) as NewChampionsFile;
if (!Array.isArray(newChampionsFile.championKeys)) {
    console.error(`ERREUR — ${NEW_CHAMPIONS_PATH} : champ championKeys manquant ou invalide.`);
    process.exit(1);
}
const newChampionKeys = new Set(newChampionsFile.championKeys);
const newChampionsSha = createHash('sha256').update(newChampionsBytes).digest('hex').toUpperCase();

// ---- helpers -----------------------------------------------------------------

const inc = (map: Map<string, number>, key: string, by = 1): void => {
    map.set(key, (map.get(key) ?? 0) + by);
};
const pct = (x: number): string => (Number.isFinite(x) ? `${(100 * x).toFixed(1)} %` : '—');
const pp = (x: number): string => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${(100 * x).toFixed(2)} pp` : '—');

/** Quantile type-7 (patron metrics.ts/clusterBootstrap.ts) — recopié à l'identique. */
function quantileSorted(sorted: number[], q: number): number {
    if (sorted.length === 0) return NaN;
    const h = (sorted.length - 1) * q;
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

const actingTeam = (record: DraftRecord, side: DraftSide): string =>
    side === 'blue' ? record.blueTeam : record.redTeam;

// ---- structures de scoring -----------------------------------------------------

type GameClass = 'pocket' | 'novelty';

interface EventRow {
    corpus: string;
    gameId: string;
    team: string;
    championKey: string;
    championName: string;
    role: Role;
    /** Index du pick dans le side (1..5, ordre seq). */
    pickIndex: number;
    /** Croisement F2 (S4) : rôle joué inédit au train ((c, r) = 0). */
    roleNovel: boolean;
    /** Croisement F2 (S4) : classe B (fold c = 0) / classe A (théorème : impossible). */
    classB: boolean;
    classA: boolean;
}

interface ScoredGame {
    corpus: string;
    cluster: string;
    gameId: string;
    gameClass: GameClass;
    /** Le side qui porte les événements de la classe. */
    side: DraftSide;
    win: boolean;
    /** gameNumber si connu (stratum) ; undefined = pooled only. */
    gameNumber?: number;
    /** true ssi tournoi Fearless-confirmé (TEST 0) — stratum gameNumber. */
    stratumEligible: boolean;
}

interface F0Exclusion {
    matchId: string;
    tournament: string;
    cause: string;
}

interface CorpusAudit {
    corpus: string;
    sha256: string;
    records: number;
    validSeries: number;
    f0Exclusions: F0Exclusion[];
    flagged20G3: { matchId: string; tournament: string }[];
    testZero: TournamentFearlessRow[];
    discarded: Map<string, number>;
    pocketGames: number;
    pocketBothSides: number;
    noveltyGames: number;
    noveltyBothSides: number;
    noveltyPocketPresent: number;
    pocketEventPicks: number;
}

const audits: CorpusAudit[] = [];
const scoredGames: ScoredGame[] = [];
const eventRows: EventRow[] = [];

// ---- boucle corpus ---------------------------------------------------------------

for (const input of inputs) {
    const bytes = readFileSync(resolve(repoRoot, input));
    const sha256 = createHash('sha256').update(bytes).digest('hex').toUpperCase();
    const records = JSON.parse(bytes.toString('utf8')) as DraftRecord[];
    const corpus = basename(input);

    // TEST F0 — par série, via reconstructSeries (module C).
    const { series, anomalies } = reconstructSeries(records);
    const f0Exclusions: F0Exclusion[] = [];
    const excludedMatchIds = new Set<string>();
    const anomalyCauseFr: Record<string, string> = {
        'duplicate-game-number': 'gameNumber dupliqué',
        gap: 'gameNumber troué',
        teams: 'équipes ≠ exactement 2'
    };
    const tournamentOfMatch = new Map<string, string>();
    for (const s of series) tournamentOfMatch.set(s.matchId, s.tournament ?? '');
    for (const anomaly of anomalies) {
        excludedMatchIds.add(anomaly.matchId);
        f0Exclusions.push({
            matchId: anomaly.matchId,
            tournament: tournamentOfMatch.get(anomaly.matchId) ?? '',
            cause: anomalyCauseFr[anomaly.kind] ?? anomaly.kind
        });
    }
    const flagged20G3: { matchId: string; tournament: string }[] = [];
    const checkF0 = (s: ReconstructedSeries): void => {
        const wins = new Map<string, number>();
        let maxWins = 0;
        let thirdWinFollowed = false;
        s.games.forEach((game, index) => {
            if (game.winner === undefined) return;
            const team = actingTeam(game, game.winner);
            const count = (wins.get(team) ?? 0) + 1;
            wins.set(team, count);
            maxWins = Math.max(maxWins, count);
            if (count >= 3 && index < s.games.length - 1) thirdWinFollowed = true;
        });
        if (maxWins >= 4) {
            excludedMatchIds.add(s.matchId);
            f0Exclusions.push({ matchId: s.matchId, tournament: s.tournament ?? '', cause: 'maxWins ≥ 4' });
            return;
        }
        if (thirdWinFollowed) {
            excludedMatchIds.add(s.matchId);
            f0Exclusions.push({
                matchId: s.matchId,
                tournament: s.tournament ?? '',
                cause: '3ᵉ victoire suivie d’une game'
            });
            return;
        }
        // « 2-0 puis G3 » : GARDÉE et listée (Bo3 format-fixe possible).
        if (s.games.length >= 3) {
            const [g1, g2] = s.games;
            if (
                g1.winner !== undefined &&
                g2.winner !== undefined &&
                actingTeam(g1, g1.winner) === actingTeam(g2, g2.winner)
            ) {
                flagged20G3.push({ matchId: s.matchId, tournament: s.tournament ?? '' });
            }
        }
    };
    for (const s of series) checkF0(s);

    // TEST 0 hérité de C : tournois Fearless-confirmés (stratum gameNumber).
    const testZero = tournamentFearlessTable(series);
    const confirmedTournaments = new Set(
        testZero.filter((row) => row.fearlessConfirmed).map((row) => row.tournament)
    );

    // Walk-forward par patch (patron postdiction/C) : train + tallies + fold rôles.
    const trainByPatch = new Map<string, DraftRecord[]>();
    const trainFor = (patch: string): DraftRecord[] => {
        let train = trainByPatch.get(patch);
        if (train === undefined) {
            train = records.filter(
                (r) =>
                    r.patch !== undefined && parsePatch(r.patch) !== undefined && comparePatches(r.patch, patch) < 0
            );
            trainByPatch.set(patch, train);
        }
        return train;
    };
    const talliesByPatch = new Map<string, PocketTrainTallies>();
    const talliesFor = (patch: string): PocketTrainTallies => {
        let tallies = talliesByPatch.get(patch);
        if (tallies === undefined) {
            tallies = tallyPocketTrain(trainFor(patch));
            talliesByPatch.set(patch, tallies);
        }
        return tallies;
    };
    const rolePriorsByPatch = new Map<string, ReturnType<typeof fitRolePriors>>();
    const rolePriorsFor = (patch: string): ReturnType<typeof fitRolePriors> => {
        let fit = rolePriorsByPatch.get(patch);
        if (fit === undefined) {
            fit = fitRolePriors(trainFor(patch));
            rolePriorsByPatch.set(patch, fit);
        }
        return fit;
    };

    const discarded = new Map<string, number>();
    let pocketGames = 0;
    let pocketBothSides = 0;
    let noveltyGames = 0;
    let noveltyBothSides = 0;
    let noveltyPocketPresent = 0;
    let pocketEventPicks = 0;

    for (const record of records) {
        const matchId = record.series?.matchId;
        // 1. Série non exclue F0.
        if (matchId !== undefined && excludedMatchIds.has(matchId)) {
            inc(discarded, 'série exclue F0');
            continue;
        }
        // 2. Walk-forward : patch plaçable + fold non vide.
        if (record.patch === undefined || parsePatch(record.patch) === undefined) {
            inc(discarded, 'patch non plaçable');
            continue;
        }
        const train = trainFor(record.patch);
        if (train.length === 0) {
            inc(discarded, 'premier patch (fold vide)');
            continue;
        }
        // 3. Vainqueur connu.
        if (record.winner === undefined) {
            inc(discarded, 'vainqueur inconnu');
            continue;
        }
        // 4. 10 picks résolus avec rôles.
        const bluePicks = roleCompleteSidePicks(record, 'blue');
        const redPicks = roleCompleteSidePicks(record, 'red');
        if (bluePicks === undefined || redPicks === undefined) {
            inc(discarded, 'picks irrésolus (10 avec rôles exigés)');
            continue;
        }

        const tallies = talliesFor(record.patch);
        const foldRoles = rolePriorsFor(record.patch);
        const sideEvents = (side: DraftSide, picks: ResolvedSidePick[]) => {
            const team = actingTeam(record, side);
            const pocket: (ResolvedSidePick & { pickIndex: number })[] = [];
            let novelty = false;
            picks.forEach((pick, index) => {
                const counts = pocketCountsOf(tallies, team, pick.championKey);
                if (isPocketEvent(pick.championKey, counts, newChampionKeys)) {
                    pocket.push({ ...pick, pickIndex: index + 1 });
                }
                if (isNoveltyContrastEvent(pick.championKey, counts, newChampionKeys)) novelty = true;
            });
            return { team, pocket, novelty };
        };
        const blue = sideEvents('blue', bluePicks);
        const red = sideEvents('red', redPicks);

        const cluster = matchId !== undefined ? `${corpus}|${matchId}` : `${corpus}|game:${record.gameId}`;
        const gameNumber = record.series?.gameNumber;
        const stratumEligible =
            gameNumber !== undefined && confirmedTournaments.has(record.tournament ?? '');

        // Classe pocket : exactement un side avec ≥ 1 événement.
        const pocketVerdict = oneSideOf(blue.pocket.length > 0, red.pocket.length > 0);
        if (pocketVerdict.kind === 'both-sides') {
            pocketBothSides += 1;
            inc(discarded, 'both-sides (pocket)');
        } else if (pocketVerdict.kind === 'one-side') {
            pocketGames += 1;
            const sideRead = pocketVerdict.side === 'blue' ? blue : red;
            scoredGames.push({
                corpus,
                cluster,
                gameId: record.gameId,
                gameClass: 'pocket',
                side: pocketVerdict.side,
                win: record.winner === pocketVerdict.side,
                ...(gameNumber !== undefined ? { gameNumber } : {}),
                stratumEligible
            });
            for (const event of sideRead.pocket) {
                pocketEventPicks += 1;
                const foldCounts = foldCountsOf(foldRoles.byChampion.get(event.championKey));
                const name =
                    record.actions.find((a) => a.championKey === event.championKey && a.type === 'pick')
                        ?.championName ?? event.championKey;
                eventRows.push({
                    corpus,
                    gameId: record.gameId,
                    team: sideRead.team,
                    championKey: event.championKey,
                    championName: name,
                    role: event.role,
                    pickIndex: event.pickIndex,
                    roleNovel: (foldCounts.byRole[event.role] ?? 0) === 0,
                    classB: isClassBEvent(foldCounts),
                    classA: isClassAEvent(foldCounts, event.role)
                });
            }
        }

        // Classe contraste : exactement un side nouveauté ET zéro pocket dans la game.
        const noveltyVerdict = noveltyGameVerdictOf(
            blue.novelty,
            red.novelty,
            blue.pocket.length > 0,
            red.pocket.length > 0
        );
        if (noveltyVerdict.kind === 'pocket-present') {
            if (blue.novelty || red.novelty) {
                noveltyPocketPresent += 1;
                inc(discarded, 'nouveauté : pocket présent dans la game');
            }
        } else if (noveltyVerdict.kind === 'both-sides') {
            noveltyBothSides += 1;
            inc(discarded, 'both-sides (nouveauté)');
        } else if (noveltyVerdict.kind === 'one-side') {
            noveltyGames += 1;
            scoredGames.push({
                corpus,
                cluster,
                gameId: record.gameId,
                gameClass: 'novelty',
                side: noveltyVerdict.side,
                win: record.winner === noveltyVerdict.side,
                ...(gameNumber !== undefined ? { gameNumber } : {}),
                stratumEligible
            });
        }
    }

    audits.push({
        corpus,
        sha256,
        records: records.length,
        validSeries: series.length,
        f0Exclusions,
        flagged20G3,
        testZero,
        discarded,
        pocketGames,
        pocketBothSides,
        noveltyGames,
        noveltyBothSides,
        noveltyPocketPresent,
        pocketEventPicks
    });
}

// ---- mode --audit-only : comptes structurels SEULEMENT, AUCUN WR -------------------

if (auditOnly) {
    const lines: string[] = [];
    lines.push('# Audit F1 (--audit-only) — comptes structurels seulement, AUCUN WR imprimé');
    lines.push('');
    lines.push(`> Généré : ${generatedAt} · liste DDragon figée : ${NEW_CHAMPIONS_PATH} (sha256 ${newChampionsSha})`);
    lines.push(`> ${newChampionKeys.size} champions post-2025-01-01 : ${[...newChampionKeys].sort().join(', ') || '(aucun)'}`);
    lines.push('');
    lines.push('| Corpus | sha256 (8) | Records | Séries valides | Exclues F0 | « 2-0 puis G3 » | Games pocket one-side | Both-sides pocket | Games nouveauté | Both-sides nouveauté | Nouveauté excl. (pocket présent) | Picks-événements pocket |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const a of audits) {
        lines.push(
            `| ${a.corpus} | ${a.sha256.slice(0, 8)} | ${a.records} | ${a.validSeries} | ${a.f0Exclusions.length} | ` +
                `${a.flagged20G3.length} | ${a.pocketGames} | ${a.pocketBothSides} | ${a.noveltyGames} | ` +
                `${a.noveltyBothSides} | ${a.noveltyPocketPresent} | ${a.pocketEventPicks} |`
        );
    }
    const pocketAll = scoredGames.filter((g) => g.gameClass === 'pocket');
    const noveltyAll = scoredGames.filter((g) => g.gameClass === 'novelty');
    const clustersOf = (games: ScoredGame[]): number => new Set(games.map((g) => g.cluster)).size;
    lines.push('');
    lines.push(
        `Pooled : ${pocketAll.length} games pocket (${clustersOf(pocketAll)} clusters), ` +
            `${noveltyAll.length} games nouveauté (${clustersOf(noveltyAll)} clusters), ` +
            `${eventRows.length} picks-événements pocket.`
    );
    const inBin = (g: ScoredGame, lo: number, hi: number): boolean =>
        g.stratumEligible && g.gameNumber !== undefined && g.gameNumber >= lo && g.gameNumber <= hi;
    lines.push(
        `Stratum gameNumber (tournois Fearless-confirmés) : pocket G1-3 ${pocketAll.filter((g) => inBin(g, 1, 3)).length}, ` +
            `pocket G4-5 ${pocketAll.filter((g) => inBin(g, 4, 5)).length} ; nouveauté G1-3 ${noveltyAll.filter((g) => inBin(g, 1, 3)).length}, ` +
            `G4-5 ${noveltyAll.filter((g) => inBin(g, 4, 5)).length}.`
    );
    lines.push('');
    lines.push('## TEST F0 — exclusions par série (publié par tournoi)');
    lines.push('');
    for (const a of audits) {
        for (const ex of a.f0Exclusions) {
            lines.push(`- ${a.corpus} · ${ex.tournament || '(sans tournoi)'} · série ${ex.matchId} : ${ex.cause}`);
        }
        for (const flag of a.flagged20G3) {
            lines.push(
                `- ${a.corpus} · ${flag.tournament || '(sans tournoi)'} · série ${flag.matchId} : « 2-0 puis G3 » — GARDÉE, listée`
            );
        }
    }
    lines.push('');
    lines.push('## TEST 0 par tournoi (stratum gameNumber)');
    lines.push('');
    lines.push('| Corpus | Tournoi | Séries multi-games | Re-picks | Fearless confirmé |');
    lines.push('|---|---|---|---|---|');
    for (const a of audits) {
        for (const row of a.testZero) {
            lines.push(
                `| ${a.corpus} | ${row.tournament || '(sans tournoi)'} | ${row.multiGameSeries} | ${row.repicks} | ` +
                    `${row.fearlessConfirmed ? 'OUI' : 'NON — exclu du stratum, gardé en pooled'} |`
            );
        }
    }
    lines.push('');
    lines.push('## Écarts par cause et par corpus');
    lines.push('');
    for (const a of audits) {
        const causes =
            a.discarded.size === 0
                ? 'aucun écarté'
                : [...a.discarded.entries()].map(([cause, n]) => `${cause} : ${n}`).join(' · ');
        lines.push(`- ${a.corpus} : ${causes}.`);
    }
    lines.push('');
    lines.push('> Mode --audit-only : AUCUN WR, AUCUN premium, AUCUN IC calculés ni imprimés.');
    console.log(lines.join('\n'));
    process.exit(0);
}

// ---- statistiques : flux mulberry32(seed) UNIQUE, ordre critère 2 puis S1 -----------

const rng = mulberry32(seed);

const pocketAll = scoredGames.filter((g) => g.gameClass === 'pocket');
const noveltyAll = scoredGames.filter((g) => g.gameClass === 'novelty');
const winsOf = (games: ScoredGame[]): number => games.filter((g) => g.win).length;

const wrPocket = pocketAll.length > 0 ? winsOf(pocketAll) / pocketAll.length : NaN;
const wrNovelty = noveltyAll.length > 0 ? winsOf(noveltyAll) / noveltyAll.length : NaN;
const premium = wrPocket - wrNovelty;
const wilsonPocket = wilson95(winsOf(pocketAll), pocketAll.length);
const criterion1 = wilsonPocket.lo > 0.5;

/**
 * IC bootstrap du premium : resampling par CLUSTER de série, statistique
 * WR_pocket − WR_nouveauté RECALCULÉE par resample (patron S2 du chantier C) ;
 * resample sans game pocket OU sans game nouveauté ⇒ statistique non définie,
 * resample écarté (déclaré aux Notes, patron du ρ S2).
 */
function premiumBootstrap(games: ScoredGame[]): { lo: number; hi: number; kept: number } {
    const byCluster = new Map<string, ScoredGame[]>();
    for (const game of games) {
        const bucket = byCluster.get(game.cluster) ?? [];
        bucket.push(game);
        byCluster.set(game.cluster, bucket);
    }
    const clusters = [...byCluster.values()];
    const premiums: number[] = [];
    if (clusters.length > 0) {
        for (let i = 0; i < 1000; i++) {
            let pocketWins = 0;
            let pocketGames = 0;
            let noveltyWins = 0;
            let noveltyGames = 0;
            for (let c = 0; c < clusters.length; c++) {
                const drawn = clusters[Math.floor(rng() * clusters.length)];
                for (const game of drawn) {
                    if (game.gameClass === 'pocket') {
                        pocketGames += 1;
                        if (game.win) pocketWins += 1;
                    } else {
                        noveltyGames += 1;
                        if (game.win) noveltyWins += 1;
                    }
                }
            }
            if (pocketGames === 0 || noveltyGames === 0) continue;
            premiums.push(pocketWins / pocketGames - noveltyWins / noveltyGames);
        }
        premiums.sort((a, b) => a - b);
    }
    return { lo: quantileSorted(premiums, 0.025), hi: quantileSorted(premiums, 0.975), kept: premiums.length };
}

// 1. Critère 2 (pooled, le verdict).
const primaryCi = premiumBootstrap(scoredGames);
const criterion2 = primaryCi.lo > 0;

// 2. S1 — premium par bin gameNumber {1-3, 4-5} (stratum TEST 0), même flux.
interface BinStat {
    label: string;
    pocketN: number;
    noveltyN: number;
    wrPocket: number;
    wrNovelty: number;
    premium: number;
    ci: { lo: number; hi: number; kept: number };
}
const binStats: BinStat[] = [];
for (const [label, lo, hi] of [
    ['G1-3', 1, 3],
    ['G4-5', 4, 5]
] as const) {
    const games = scoredGames.filter(
        (g) => g.stratumEligible && g.gameNumber !== undefined && g.gameNumber >= lo && g.gameNumber <= hi
    );
    const pocket = games.filter((g) => g.gameClass === 'pocket');
    const novelty = games.filter((g) => g.gameClass === 'novelty');
    binStats.push({
        label,
        pocketN: pocket.length,
        noveltyN: novelty.length,
        wrPocket: pocket.length > 0 ? winsOf(pocket) / pocket.length : NaN,
        wrNovelty: novelty.length > 0 ? winsOf(novelty) / novelty.length : NaN,
        premium:
            pocket.length > 0 && novelty.length > 0
                ? winsOf(pocket) / pocket.length - winsOf(novelty) / novelty.length
                : NaN,
        ci: premiumBootstrap(games)
    });
}

const verdict = criterion1 && criterion2 ? 'F1 VERTE' : criterion1 ? 'F1 ORANGE' : 'F1 ROUGE';
const verdictReason =
    criterion1 && criterion2
        ? 'critères 1 ET 2 atteints — « le pick hors-radar rare porte un premium au-delà de la simple nouveauté — corrélation, pas causalité »'
        : criterion1
          ? 'critère 1 seul — « le side qui ose gagne plus, mais pas plus que pour toute nouveauté »'
          : 'critère 1 non atteint — aucun claim ; la règle est consommée, aucun retuning';

// ---- rapport markdown -----------------------------------------------------------

const lines: string[] = [];
lines.push('# Gate F1 — premium du pocket pick (chantier F, run #2)');
lines.push('');
lines.push(`> Généré : ${generatedAt} · seed ${seed} · règle pré-enregistrée VERBATIM en tête de \`scripts/backtest/pocketPremium.ts\``);
lines.push('> (design gelé docs/run2/F-pocket-picks.md §3.1). Une règle, un run — tout rouge est gelé.');
lines.push(`> Corpus : ${inputs.map((i) => basename(i)).join(', ')}.`);
lines.push('');
lines.push('## Préconditions publiées');
lines.push('');
lines.push('| Fichier | sha256 |');
lines.push('|---|---|');
for (const a of audits) lines.push(`| ${a.corpus} | ${a.sha256} |`);
lines.push(`| ${NEW_CHAMPIONS_PATH} (liste DDragon figée P3) | ${newChampionsSha} |`);
lines.push('');
lines.push(
    `Liste DDragon figée (${newChampionsFile.frozenAt}) — ${newChampionKeys.size} champions post-2025-01-01 : ` +
        `${[...newChampionKeys].sort().join(', ') || '(aucun)'}.`
);
lines.push('');

// TEST F0 + TEST 0.
lines.push('## TEST F0 — intégrité par série (publié par tournoi)');
lines.push('');
let anyF0 = false;
for (const a of audits) {
    for (const ex of a.f0Exclusions) {
        anyF0 = true;
        lines.push(`- ${a.corpus} · ${ex.tournament || '(sans tournoi)'} · série ${ex.matchId} : EXCLUE (${ex.cause})`);
    }
    for (const flag of a.flagged20G3) {
        anyF0 = true;
        lines.push(
            `- ${a.corpus} · ${flag.tournament || '(sans tournoi)'} · série ${flag.matchId} : « 2-0 puis G3 » — GARDÉE, listée (Bo3 format-fixe possible)`
        );
    }
}
if (!anyF0) lines.push('- Aucune exclusion F0, aucune séquence « 2-0 puis G3 ».');
lines.push('');
lines.push('## TEST 0 (hérité de C) — stratum gameNumber');
lines.push('');
lines.push('| Corpus | Tournoi | Séries multi-games | Re-picks | Verdict |');
lines.push('|---|---|---|---|---|');
for (const a of audits) {
    for (const row of a.testZero) {
        lines.push(
            `| ${a.corpus} | ${row.tournament || '(sans tournoi)'} | ${row.multiGameSeries} | ${row.repicks} | ` +
                `${row.fearlessConfirmed ? 'Fearless confirmé' : 'NON confirmé — exclu du stratum gameNumber, GARDÉ en pooled'} |`
        );
    }
}
lines.push('');

// Primaire.
const clustersOf = (games: ScoredGame[]): number => new Set(games.map((g) => g.cluster)).size;
lines.push('## Primaire — WR_pocket vs WR_nouveauté (B1 active) et premium');
lines.push('');
lines.push('| Classe | Games | Clusters | WR du side à événement | Wilson 95 % |');
lines.push('|---|---|---|---|---|');
lines.push(
    `| Pocket (P1∧P2∧P3) | ${pocketAll.length} | ${clustersOf(pocketAll)} | ${pct(wrPocket)} | ` +
        `[${pct(wilsonPocket.lo)} ; ${pct(wilsonPocket.hi)}] |`
);
const wilsonNovelty = wilson95(winsOf(noveltyAll), noveltyAll.length);
lines.push(
    `| Nouveauté banale (P1∧≥20∧P3) | ${noveltyAll.length} | ${clustersOf(noveltyAll)} | ${pct(wrNovelty)} | ` +
        `[${pct(wilsonNovelty.lo)} ; ${pct(wilsonNovelty.hi)}] |`
);
lines.push('');
lines.push(`- B0 (hasard) : 0,5 — symétrie within-game.`);
lines.push(
    `- **Premium = WR_pocket − WR_nouveauté = ${pp(premium)}**, IC bootstrap 95 % cluster par série ` +
        `[${pp(primaryCi.lo)} ; ${pp(primaryCi.hi)}] (${primaryCi.kept}/1000 resamples définis).`
);
lines.push(`- Critère 1 (Wilson lo > 0,5) : ${criterion1 ? 'ATTEINT' : 'NON ATTEINT'} (lo = ${pct(wilsonPocket.lo)}).`);
lines.push(`- Critère 2 (IC premium lo > 0) : ${criterion2 ? 'ATTEINT' : 'NON ATTEINT'} (lo = ${pp(primaryCi.lo)}).`);
lines.push('');
lines.push(`**Verdict : ${verdict}** — ${verdictReason}.`);
lines.push('');

// S1.
lines.push('## S1 — premium par bin gameNumber {1-3, 4-5} (descriptif, stratum TEST 0)');
lines.push('');
lines.push('| Bin | Games pocket | Games nouveauté | WR_pocket | WR_nouveauté | Premium | IC 95 % cluster |');
lines.push('|---|---|---|---|---|---|---|');
for (const bin of binStats) {
    lines.push(
        `| ${bin.label} | ${bin.pocketN} | ${bin.noveltyN} | ${pct(bin.wrPocket)} | ${pct(bin.wrNovelty)} | ` +
            `${pp(bin.premium)} | [${pp(bin.ci.lo)} ; ${pp(bin.ci.hi)}] (${bin.ci.kept}/1000) |`
    );
}
lines.push('');
lines.push('> La tranche G4-5 ne peut porter AUCUN verdict (puissance déclarée ±12 pp).');
lines.push('');

// S2.
lines.push('## S2 — WR_pocket par corpus + annexe exhaustive des événements');
lines.push('');
lines.push('| Corpus | Games pocket | WR_pocket | Wilson 95 % | Games nouveauté | WR_nouveauté |');
lines.push('|---|---|---|---|---|---|');
for (const a of audits) {
    const pocket = pocketAll.filter((g) => g.corpus === a.corpus);
    const novelty = noveltyAll.filter((g) => g.corpus === a.corpus);
    const wr = pocket.length > 0 ? winsOf(pocket) / pocket.length : NaN;
    const ci = wilson95(winsOf(pocket), pocket.length);
    const wrN = novelty.length > 0 ? winsOf(novelty) / novelty.length : NaN;
    lines.push(
        `| ${a.corpus} | ${pocket.length} | ${pct(wr)} | [${pct(ci.lo)} ; ${pct(ci.hi)}] | ${novelty.length} | ${pct(wrN)} |`
    );
}
lines.push('');
const nasusRow = eventRows.find((row) => row.championName === 'Nasus' || row.championKey === '75');
lines.push(
    nasusRow !== undefined
        ? `Cohérence re-pull : le cas G2-Nasus FIGURE dans l'annexe (${nasusRow.team}, game ${nasusRow.gameId}).`
        : '⚠ Cohérence re-pull : le cas G2-Nasus NE FIGURE PAS dans l’annexe — à investiguer avant toute lecture.'
);
lines.push('');
lines.push('### Annexe — liste exhaustive des événements pocket (champion, rôle, équipe, gameId)');
lines.push('');
lines.push('| Corpus | Champion | Rôle | Équipe | gameId | Index de pick |');
lines.push('|---|---|---|---|---|---|');
const ROLE_FR = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
for (const row of eventRows) {
    lines.push(
        `| ${row.corpus} | ${row.championName} | ${ROLE_FR[row.role] ?? row.role} | ${row.team} | ${row.gameId} | ${row.pickIndex} |`
    );
}
lines.push('');

// S3.
lines.push('## S3 — distribution des événements par rôle et par index de pick du side');
lines.push('');
const roleCounts = new Map<number, number>();
const indexCounts = new Map<number, number>();
for (const row of eventRows) {
    roleCounts.set(row.role, (roleCounts.get(row.role) ?? 0) + 1);
    indexCounts.set(row.pickIndex, (indexCounts.get(row.pickIndex) ?? 0) + 1);
}
lines.push(
    `- Par rôle : ${ROLE_FR.map((label, role) => `${label} ${roleCounts.get(role) ?? 0}`).join(' · ')}.`
);
lines.push(
    `- Par index de pick (1..5) : ${[1, 2, 3, 4, 5].map((i) => `${i}: ${indexCounts.get(i) ?? 0}`).join(' · ')}.`
);
lines.push('');

// S4.
const roleNovelCount = eventRows.filter((row) => row.roleNovel).length;
const classBCount = eventRows.filter((row) => row.classB).length;
const classACount = eventRows.filter((row) => row.classA).length;
lines.push('## S4 — croisement F2 : part des picks pocket également hors-rôle');
lines.push('');
lines.push(
    `- Rôle joué inédit au train ((c, r) = 0) : ${roleNovelCount}/${eventRows.length} ` +
        `(${pct(eventRows.length > 0 ? roleNovelCount / eventRows.length : NaN)}).`
);
lines.push(
    `- Également classe B (fold c = 0, hors-corpus) : ${classBCount}/${eventRows.length} ` +
        `(${pct(eventRows.length > 0 ? classBCount / eventRows.length : NaN)}).`
);
lines.push(
    `- Également classe A (hors-rôle ÉTABLI) : ${classACount} — théorème arithmétique : P2 (≤ 2 picks ligue) ` +
        `rend « tous rôles ≥ 5 » impossible ; tout compte ≠ 0 serait un bug de définition.`
);
lines.push('');

// Couverture.
lines.push('## Couverture — exclusions par cause et par corpus');
lines.push('');
for (const a of audits) {
    const causes =
        a.discarded.size === 0
            ? 'aucun écarté'
            : [...a.discarded.entries()].map(([cause, n]) => `${cause} : ${n}`).join(' · ');
    lines.push(
        `- ${a.corpus} : ${a.records} records, ${a.validSeries} séries valides, ${a.f0Exclusions.length} séries exclues F0 → ` +
            `${a.pocketGames} games pocket one-side (${a.pocketBothSides} both-sides), ` +
            `${a.noveltyGames} games nouveauté (${a.noveltyBothSides} both-sides, ${a.noveltyPocketPresent} pocket-présent), ` +
            `${a.pocketEventPicks} picks-événements. Causes : ${causes}.`
    );
}
lines.push('');

// Notes.
lines.push('## Notes');
lines.push('');
lines.push('- Corrélation, JAMAIS causalité : biais de sélection non neutralisable déclaré (les équipes sortent le pocket quand les conditions s’y prêtent).');
lines.push(`- Flux rng UNIQUE mulberry32(${seed}) consommé en ordre fixe : critère 2 → S1 (bin G1-3 → bin G4-5) ; 1000 resamples chacun ; cluster = série (corpus, matchId), game sans série = son propre cluster.`);
lines.push('- Statistique du critère 2 RECALCULÉE par resample (patron S2 du chantier C) ; resamples sans game d’une des deux classes écartés et comptés (colonne kept).');
lines.push('- Ordre des causes d’écartement (ventilation seulement) : série F0 → patch → fold vide → vainqueur → picks ; both-sides comptés par classe.');
lines.push('- Une règle, un run : tout rouge est gelé ; toute nouvelle piste = NOUVEL en-tête daté.');
lines.push('');

const markdown = lines.join('\n') + '\n';
const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, markdown, 'utf8');
console.log(markdown);
console.log(`Écrit : ${absOut}`);
console.log(`Verdict : ${verdict}`);
