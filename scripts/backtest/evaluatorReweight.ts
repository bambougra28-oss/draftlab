/**
 * Chantier E3 — Calibration Platt PAR LIGUE × position de séquence (run #3).
 *
 * RÈGLE PRÉ-ENREGISTRÉE — Calibration Platt PAR LIGUE × position de séquence (chantier E3, run #3).
 * Gelée le 2026-06-11 AVANT toute exécution sur données réelles. Un rouge se documente, ne se retune pas.
 * La règle v1 (poolée, chantier E run #2) est CONSOMMÉE — ceci est une NOUVELLE règle, jamais une retouche.
 *
 * CORPUS (8 fichiers, fixés — l'état UNIQUE amendé du 2026-06-11, docs/run2/AMENDEMENT-corpus-20260611.md),
 * appariés PAR LIGUE ; la ligue d'un fichier = le préfixe de son basename (^(lck|lec|lfl|lpl)-\d{4}\.json$,
 * asserté par le script, abort sinon) :
 *   lck : static/corpus/lck-2026.json + data/corpus/lck-2025.json
 *   lec : static/corpus/lec-2026.json + data/corpus/lec-2025.json
 *   lfl : static/corpus/lfl-2026.json + data/corpus/lfl-2025.json
 *   lpl : static/corpus/lpl-2026.json + data/corpus/lpl-2025.json
 * lck-2025 (555 drafts, 0 violation) entre par la voie déclarée v1 (« l'ajouter plus tard = NOUVEAU run,
 * jamais une fusion silencieuse ») — c'est CE run.
 *
 * ÉLIGIBILITÉ : inchangée v1 (isCalibrationEligible, un SEUL ensemble PAR LIGUE, partagé par les trois
 * positions) : (a) winner défini, (b) 10 picks rôle-complets (règle compOf de postdiction G1), (c) patch
 * parsable. Tout record écarté est compté dans le rapport. Unicité des gameId assertée sur l'UNION des
 * 8 corpus chargés (abort si collision).
 *
 * PRÉDICTEUR BRUT : inchangé v1 AU CARACTÈRE PRÈS —
 *   p_raw(g, pos) = analyzeDraft(dataset, blue(g,pos), red(g,pos),
 *       { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 }, fullDataset).winrate
 *   Équipes = rôles RÉELS du corpus (roleTeamsAt), préfixes des TROIS ancres v1 inchangées :
 *       afterBans seq ≤ 6 (p_raw ≡ 0,5 par construction) · after3Picks seq ≤ 9 · fullDraft seq ≤ 20.
 *   Aucun playerContext, aucun sideContext. Cible : won = (winner === 'blue').
 *   p_raw ne dépend PAS de la ligue : cache unique par (game, position), partagé par tous les bras.
 *
 * DATASETS : LES MÊMES snapshots gelés que la run #2 (data/datasets/current-patch.json + 30-days.json,
 * data/datasets/SNAPSHOT.md), JAMAIS re-tirés. Le script ABORT avant toute métrique si
 *   sha256(current-patch) ≠ aca91656af68dff5016152e947aafbcebfb3dfe320cc2781f8fdbe8983fb8869
 *   sha256(30-days)       ≠ 6933c7c2d107afd465e7d8f0c44765305ff8747a187ed54c4c1f73e87651a4b1
 * (hashes attendus = DÉFAUTS du script ; le smoke sur fixtures synthétiques les surcharge via
 * --expected-sha256-current/--expected-sha256-full — flags INTERDITS sur corpus réels : la porte de
 * validité et LE run ne les passent pas, c'est vérifiable dans la commande publiée du rapport).
 * Le rapport imprime explicitement « override de hash : aucun » (ou les valeurs surchargées) —
 * l'interdiction des flags sur corpus réels est ainsi auditable dans l'artefact lui-même, pas
 * seulement dans la commande publiée.
 *
 * PROTOCOLE : QUATRE timelines, une PAR LIGUE (= l'union des 2 fichiers de la ligue, ordonnée
 * groupByPatch/comparePatches), walkForward (src/lib/backtest/walkforward.ts) avec minTrainSize = 50
 * PAR LIGUE. Par ligue, par fold (= patch testé de la ligue) et PAR POSITION :
 *   (a,b) = plattFit(paires du train DE LA LIGUE)   // module gelé src/lib/estimators/platt.ts
 *   prédiction de test = plattApply((a,b), p_raw)
 * Quatre bras par (ligue × position) : CALIBRÉ σ(a+b·logit(p_raw)) · NON CALIBRÉ p_raw · PIÈCE p = 0,5 ·
 * side-only LIGUE (winrate blue du train de la ligue — descriptif, sans pouvoir de verdict ; c'est aussi
 * exactement ce en quoi dégénère Platt à afterBans). Assertion croisée ordre-patch vs chronologie PAR
 * LIGUE (min(date) monotone entre groupes consécutifs — couvre le placement lexical des 25.S1.x),
 * abort AVANT toute métrique sinon.
 *
 * TIMELINES ATTENDUES (gelées — comptes ÉLIGIBLES mesurés avant gel sur l'état amendé ; « t » = groupe
 * train-only sous minTrainSize 50) :
 *   lck (892 él., 20 folds, 818 paires, 1er fold 25.S1.3) : 25.S1.1 (49 t) → 25.S1.2 (25 t) → 25.S1.3 (35)
 *     → 25.06 (24) → 25.07 (50) → 25.08 (47) → 25.09 (48) → 25.10 (53) → 25.11 (18) → 25.14 (46)
 *     → 25.15 (48) → 25.16 (51) → 25.17 (61) → 26.01 (51) → 26.02 (33) → 26.03 (41) → 26.06 (21)
 *     → 26.07 (45) → 26.08 (44) → 26.09 (45) → 26.10 (49) → 26.11 (8)
 *   lec (554 él., 17 folds, 470 paires, 1er fold 25.06) : 25.S1.1 (15 t) → 25.S1.2 (30 t) → 25.S1.3 (39 t)
 *     → 25.06 (17) → 25.07 (31) → 25.08 (31) → 25.09 (27) → 25.10 (33) → 25.15 (24) → 25.16 (23)
 *     → 25.17 (27) → 25.18 (11) → 26.01 (18) → 26.02 (36) → 26.03 (51) → 26.06 (19) → 26.07 (33)
 *     → 26.08 (29) → 26.09 (30) → 26.10 (30)
 *   lfl (508 él., 17 folds, 450 paires, 1er fold 25.S1.3) : 14.16 (11 t) → 25.S1.1 (23 t) → 25.S1.2 (24 t)
 *     → 25.S1.3 (16) → 25.07 (30) → 25.08 (29) → 25.09 (24) → 25.10 (23) → 25.14 (40) → 25.15 (41)
 *     → 25.16 (31) → 25.17 (37) → 26.01 (10) → 26.02 (30) → 26.03 (33) → 26.04 (24) → 26.07 (30)
 *     → 26.08 (15) → 26.09 (13) → 26.10 (24)
 *   lpl (1260 él. / 1262 records, 18 folds, 1172 paires, 1er fold 25.04) : 25.S1.1 (43 t) → 25.S1.2 (45 t)
 *     → 25.04 (42) → 25.06 (60) → 25.07 (82) → 25.08 (76) → 25.09 (101) → 25.10 (15) → 25.11 (56)
 *     → 25.14 (83) → 25.15 (81) → 25.16 (63) → 25.17 (70) → 26.01 (75) → 26.02 (83) → 26.03 (54)
 *     → 26.07 (59) → 26.08 (49) → 26.09 (63) → 26.10 (60)
 *   TOTAL : 3 214 éligibles / 3 216 records (2 écartés, lpl-2026) ; 2 910 paires de test par position.
 *
 * MÉTRIQUES PUBLIÉES par (ligue × position), sur les paires de test poolées de la ligue : Brier, log loss,
 * accuracy des trois bras + side-only ; diagramme de fiabilité 10 bacs (n, meanP, taux observé avec
 * Wilson 95 % par bac, gap) pour CALIBRÉ et NON CALIBRÉ.
 *
 * CRITÈRE DE VERDICT (12 cellules INDÉPENDANTES = 4 ligues × 3 positions, listées exhaustivement ICI,
 * toutes publiées) : ΔBrier = Brier(calibré) − Brier(non calibré) sur les paires de la ligue, IC
 * bootstrap 95 % APPARIÉ par game (1000 resamples). UN SEUL flux mulberry32(seed 42), ordre GELÉ des
 * 24 IC : ligues lck → lec → lfl → lpl ; par ligue : afterBans Brier, afterBans logLoss, after3Picks
 * Brier, after3Picks logLoss, fullDraft Brier, fullDraft logLoss.
 *   VERT ssi ci95.hi < 0. Δ log loss : publié, secondaire, descriptif seulement.
 * MULTIPLICITÉ DÉCLARÉE : sous le nul global, ~0,3 faux vert attendu sur 12 cellules
 * (P(≥1 faux vert) ≈ 26 %) — aucun ajustement (chaque cellule porte une décision produit LOCALE et
 * réversible au re-run) ; le rapport publie les 12 verdicts ensemble et chaque claim cite SA cellule.
 * LIMITE DÉCLARÉE — corrélation intra-série : les games d'une même série (Bo3/Bo5, mêmes équipes) sont
 * corrélées ; le bootstrap apparié PAR GAME (convention v1, conservée pour la comparabilité et la porte
 * de validité) est anticonservateur sous cette corrélation — les ~0,3 faux verts attendus sont une
 * borne basse. SECONDAIRE PUBLIÉ, sans pouvoir de verdict : pour chacune des 12 cellules, IC 95 % du
 * même ΔBrier par clusterBootstrapDeltaCI (src/lib/backtest/clusterBootstrap.ts, cluster =
 * series.matchId, une game sans série = son propre cluster ; observations appariées
 * model = (p_cal − y)², baseline = (p_raw − y)² par game ; 1000 resamples), consommé sur le MÊME flux
 * mulberry32(seed 42) APRÈS les 24 IC primaires, dans l'ordre gelé des cellules (lck → lec → lfl → lpl
 * × afterBans → after3Picks → fullDraft). Toute cellule VERTE dont l'IC clusterisé recouvre 0 cite cet
 * écart verbatim dans son claim produit.
 * GARDE SUPPLÉMENTAIRE : validated(ligue, position) = (verdict VERT) ∧ (b > 0 au fit final DE LA LIGUE).
 *
 * ATTENDUS DÉCLARÉS D'AVANCE :
 * - afterBans dégénère en side-only PAR LIGUE (p_raw ≡ 0,5 ⇒ b sans information, a = logit du taux blue
 *   du train de la ligue). Le run #2 a publié : side-only lec/lfl/lpl ≈ pile-ou-face ⇒ rouges probables,
 *   qui seraient des CONFIRMATIONS d'honnêteté (le 50 % post-bans y est déjà honnête) ; side-only LCK
 *   2026 : accuracy +8,4 pp SIGNIFICATIVE ([+2,8 ; +14,0], scorecard lck-2026-26.11) MAIS, sur l'échelle
 *   MÊME du verdict E3, ΔBrier side-only vs pièce = −0,0045 [−0,0101 ; +0,0012] (n = 286, NON
 *   significatif, même scorecard). L'effet attendu vaut ≈ −(q − 0,5)² (q = taux blue walk-forward lck) ;
 *   au point estimé 2026 (≈ −0,0045) et au MDE afterBans-lck (≈ 0,0027, voir PUISSANCE), la détection
 *   est attendue BORDERLINE —
 *   un VERT lck/afterBans signifierait « en LCK, afficher ~q % après bans est plus honnête que 50 % » ;
 *   un ROUGE, que l'avantage blue ne tient pas sur 2025-2026 au niveau requis. LES DEUX lectures sont
 *   écrites ici, avant le run.
 * - PUISSANCE (déclarée d'avance, demi-largeur de l'IC v1 de la position FULLDRAFT (0,002375) × √(2567/n) ;
 *   pour les cellules afterBans, la base v1 afterBans (0,001525) donne des MDE ≈ ×0,64 (lck ≈ 0,0027) —
 *   base déclarée par position, jamais re-choisie après lecture) : MDE ΔBrier ≈ 0,0042 (lck, 818
 *   paires) · 0,0056 (lec, 470) · 0,0057 (lfl, 450) · 0,0035 (lpl, 1172). Un effet de la taille du
 *   pooled v1 (≈ 0,002) sortira ROUGE par construction dans chaque cellule : le pari pré-enregistré est
 *   un effet PAR LIGUE plus grand que la moyenne poolée (le (a) de side lck ; la dérive lfl vue dans les
 *   lignes descriptives v1). « Réel mais non détectable » se publie tel quel, sans re-découpage.
 *
 * PARAMS SHIPPÉS : data/calibration/winCalibration.json passe en VERSION 2, TOUJOURS écrit à l'issue du
 * run, quel que soit le verdict :
 *   leagues.{lck,lec,lfl,lpl} = { nGames, fittedThroughPatch, positions: { a, b, nTrain, validated } × 3 }
 *   — fit full-data PAR LIGUE sur la totalité de ses éligibles (déclaré ici, jamais utilisé pour les
 *   métriques), validated = (VERT cellule) ∧ (b > 0) ;
 *   positions (le champ v1) = full-fit poolé des 8 corpus, PROVENANCE/COMPARAISON SEULEMENT,
 *   validated:false FORCÉ par construction (aucun verdict poolé n'existe dans ce run) ;
 *   + provenance (corpora, nGames total, dataset sha256/version/date, generatedAt injecté, seed).
 * L'UI n'applique JAMAIS une position validated:false.
 *
 * REPLI TRANCHÉ ET GELÉ : ligue sans carte (lcs, cblol, lcp, internationaux, id inconnu, leagueId absent)
 * ⇒ PASSTHROUGH (% brut, badge « Non calibré »). JAMAIS la carte poolée : elle n'a aucun verdict vert
 * derrière elle (v1 ROUGE consommé) et les ligues hors corpus sont hors claim par construction.
 * APPLICATION : la carte appliquée est celle de la LIGUE DU CAMP AFFICHÉ — barre globale : leagueIdA ;
 * coach : la ligue du camp conseillé (leagueIdA, ou leagueIdB quand la simulation fait conseiller le
 * camp B). Résolution UNIQUE par leagueCardOf (carte résolue {nGames, fittedThroughPatch, positions}
 * de la ligue — UI et estimateur, jamais deux sémantiques de repli). Une config v1 chargée par
 * l'estimateur v2 garde la sémantique v1 (rétro-compatibilité).
 *
 * PORTE DE VALIDITÉ (bloquante, AVANT le run E3) : le runner v2 en mode --pooled, lancé sur les 7 corpus
 * v1 et les mêmes snapshots (seed 42), reproduit À 5 DÉCIMALES les six Δ et IC publiés dans
 * docs/calibration/win-calibration-2026.md (table d'acceptation au §2.6 du design ; contrôles
 * secondaires : Brier des bras à 4 décimales, fits finals à 6 décimales, n = 2567, 26 groupes, 24 folds).
 * Tout écart ⇒ bug du runner v2, AUCUN run E3 avant égalité. Le mode --pooled n'écrit JAMAIS l'artefact
 * params (abort si --params-out lui est passé). L'ORDRE des 7 fichiers de la commande --pooled est celui
 * de la commande v1 publiée et fait partie de la porte (l'ordre d'entrée fixe l'ordre des paires dans
 * les groupes, donc les sommes flottantes et la consommation du rng).
 *
 * LIMITE DOCUMENTÉE (reprise verbatim dans le rapport) : le snapshot SoloQ est
 * « d'aujourd'hui » et évalue des games 2025-2026 (fuite de features M3.x connue).
 * Elle contamine p_raw À L'IDENTIQUE dans les bras calibré et non calibré (comparaison
 * appariée interne valide) ; le claim autorisé porte sur la CARTE DE CALIBRATION,
 * jamais sur la force prédictive de l'évaluateur. Aucun « on prédit le vainqueur ».
 *
 * TROIS APPROXIMATIONS D'APPLICATION (déclarées ici, reprises dans le rapport et l'aide produit) :
 *   (a) la calibration est mesurée aux trois ancres 0 / 3 / 10 picks verrouillés ; une position
 *       intermédiaire reçoit la carte de l'ancre que la partition positionOf lui assigne
 *       (0 → afterBans ; 1..6 → after3Picks ; 7..10 → fullDraft), jamais une interpolation ;
 *   (b) à l'application, le % du coach passe par des rôles INFÉRÉS et le mode séquence par l'argmax des
 *       rolePriors, alors que la mesure utilise les rôles RÉELS du corpus — l'écart d'attribution de
 *       rôles n'est pas couvert par le claim ;
 *   (c) les cartes sont mesurées sur des games INTRA-ligue (les deux équipes de la même ligue) ; une
 *       draft inter-ligues (leagueIdB ≠ leagueIdA) reçoit la carte de la ligue du camp affiché — l'écart
 *       n'est pas couvert par le claim.
 *
 * Patron : scripts/backtest/postdiction.ts via le runner v1 scripts/backtest/winCalibration.ts
 * (INTACT — règle consommée, artefact historique). Aucune logique de scoring nouvelle ici :
 * walkforward.ts, metrics.ts, platt.ts, sequencePositions.ts et clusterBootstrap.ts suffisent —
 * le script ne fait qu'assembler.
 *
 * LE run (par ligue, 8 corpus) :
 *   node --experimental-transform-types --no-warnings scripts/backtest/winCalibrationByLeague.ts \
 *     static/corpus/lck-2026.json data/corpus/lck-2025.json \
 *     static/corpus/lec-2026.json data/corpus/lec-2025.json \
 *     static/corpus/lfl-2026.json data/corpus/lfl-2025.json \
 *     static/corpus/lpl-2026.json data/corpus/lpl-2025.json \
 *     --dataset data/datasets/current-patch.json --full-dataset data/datasets/30-days.json \
 *     [--seed 42] [--generated-at ISO] \
 *     [--out docs/calibration/win-calibration-par-ligue-2026.md] \
 *     [--params-out data/calibration/winCalibration.json]
 *
 * Porte de validité (mode poolé, 7 corpus v1, AUCUN params écrit — abort si --params-out) :
 *   node ... scripts/backtest/winCalibrationByLeague.ts --pooled \
 *     static/corpus/lck-2026.json static/corpus/lec-2026.json static/corpus/lfl-2026.json \
 *     static/corpus/lpl-2026.json data/corpus/lec-2025.json data/corpus/lfl-2025.json \
 *     data/corpus/lpl-2025.json \
 *     --dataset data/datasets/current-patch.json --full-dataset data/datasets/30-days.json \
 *     --out docs/run3/E3-validite-poolee.md
 */
// ============================================================================
// Chantier R4 (run #4) — Gate ÉVALUATEUR : re-pondération des composantes
// différentielles. RÈGLE PRÉ-ENREGISTRÉE intégrale et gelée :
// docs/run4/R4-evaluator-reweight.md (§1, commit 0aa2986, amendements R1-R12).
// Invariants opératoires (un rouge se documente, ne se retune pas) :
//   - Hérite de E3 (mode LIGUE de ce script-source) VERBATIM : corpus,
//     éligibilité, snapshots sha-gelés, timelines, ancres, p_raw. UNE seule
//     chose change : le bras prédictif.
//   - Features (lues de DraftResult ; analyzer.ts JAMAIS modifié) :
//     x₁ = χ_ally−χ_enemy, x₂ = δ_ally−δ_enemy, x₃ = matchup (déjà différentiel).
//     Le modèle shippé = β₀=0, β₁=β₂=β₃=ln10/400. R4 ajuste β par régression
//     logistique walk-forward PAR LIGUE (logisticFit, ridge 1e-6, maxIter 50,
//     init identité ; standardisation train, σ≤1e-9 ⇒ colonne EXCLUE).
//   - Bras : R4 re-pondéré · non-calibré (p_raw, LE comparateur) · Platt E3
//     (co-comparateur) · pièce · side-only. Verdict POOLÉ-4-ligues, 2 cellules
//     (after3Picks, fullDraft ; afterBans dégénère, ΔBrier≡0, hors verdict).
//   - Critère V : VERT ssi DEUX IC unilatéraux sous 0 — ΔBrier(R4−nonCal) ET
//     ΔBrier(R4−Platt). Flux mulberry32(42), ordre gelé §1.3.
//   - Porte de validité : --chain e3 régénère docs/calibration/
//     win-calibration-by-league.md byte-identique (mode LIGUE, 24 IC primaires
//     PUIS 12 clusterisés) AVANT toute métrique R4. --chain e3|r4 n'écrit
//     AUCUN artefact params (R12).
// ============================================================================
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
type ClusterBootstrapModule = typeof import('../../src/lib/backtest/clusterBootstrap');
type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type Dataset = import('../../src/lib/types').Dataset;
type AnalyzeDraftConfig = import('../../src/lib/types').AnalyzeDraftConfig;
type PredictionPair = import('../../src/lib/backtest/metrics').PredictionPair;
type BootstrapDelta = import('../../src/lib/backtest/metrics').BootstrapDelta;
type PlattParams = import('../../src/lib/estimators/platt').PlattParams;
type CalibrationPositionId = import('../../src/lib/backtest/sequencePositions').CalibrationPositionId;
type WalkForwardResult = import('../../src/lib/backtest/walkforward').WalkForwardResult;
type WalkForwardAggregate = import('../../src/lib/backtest/walkforward').WalkForwardAggregate;
type ClusterBootstrapDelta = import('../../src/lib/backtest/clusterBootstrap').ClusterBootstrapDelta;
type PairedObservation = import('../../src/lib/backtest/clusterBootstrap').PairedObservation;
// R4 — modules de re-pondération (sans effet sur le chemin --chain e3)
type EvaluatorFeaturesModule = typeof import('../../src/lib/backtest/evaluatorFeatures');
type LogisticFitModule = typeof import('../../src/lib/estimators/logisticFit');
type Standardizer = import('../../src/lib/backtest/evaluatorFeatures').Standardizer;
type LogisticFitResult = import('../../src/lib/estimators/logisticFit').LogisticFit;

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
const { clusterBootstrapDeltaCI } = (await import(
    `${libRootHref}/backtest/clusterBootstrap.ts`
)) as ClusterBootstrapModule;
const { evaluatorFeaturesAt, featuresTuple, standardizeFit, standardizeApply } = (await import(
    `${libRootHref}/backtest/evaluatorFeatures.ts`
)) as EvaluatorFeaturesModule;
const { logisticFit, logisticPredict } = (await import(
    `${libRootHref}/estimators/logisticFit.ts`
)) as LogisticFitModule;

// ---- argv -------------------------------------------------------------------

// Hashes gelés des snapshots de la run #2 (data/datasets/SNAPSHOT.md) — les
// DÉFAUTS du script ; surchargés UNIQUEMENT par le smoke synthétique.
const FROZEN_SHA256_CURRENT = 'aca91656af68dff5016152e947aafbcebfb3dfe320cc2781f8fdbe8983fb8869';
const FROZEN_SHA256_FULL = '6933c7c2d107afd465e7d8f0c44765305ff8747a187ed54c4c1f73e87651a4b1';

const inputs: string[] = [];
let pooled = false;
let chain: 'e3' | 'r4' | null = null;
let smoke = false;
let datasetPath: string | null = null;
let fullDatasetPath: string | null = null;
let seed = 42;
let generatedAt = new Date().toISOString();
let outPath: string | null = null;
let paramsOutPath: string | null = null;
let expectedSha256Current = FROZEN_SHA256_CURRENT;
let expectedSha256Full = FROZEN_SHA256_FULL;
let hashOverridden = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pooled') pooled = true;
    else if (argv[i] === '--chain') chain = argv[++i] as 'e3' | 'r4';
    else if (argv[i] === '--smoke') smoke = true;
    else if (argv[i] === '--dataset') datasetPath = argv[++i];
    else if (argv[i] === '--full-dataset') fullDatasetPath = argv[++i];
    else if (argv[i] === '--seed') seed = Number(argv[++i]);
    else if (argv[i] === '--generated-at') generatedAt = argv[++i];
    else if (argv[i] === '--out') outPath = argv[++i];
    else if (argv[i] === '--params-out') paramsOutPath = argv[++i];
    else if (argv[i] === '--expected-sha256-current') {
        expectedSha256Current = argv[++i];
        hashOverridden = true;
    } else if (argv[i] === '--expected-sha256-full') {
        expectedSha256Full = argv[++i];
        hashOverridden = true;
    } else inputs.push(argv[i]);
}
if (inputs.length === 0 || datasetPath === null || fullDatasetPath === null || !Number.isFinite(seed)) {
    console.error(
        'Usage: node --experimental-transform-types --no-warnings scripts/backtest/winCalibrationByLeague.ts ' +
            '[--pooled] <corpus.json> [...] --dataset <current-patch.json> --full-dataset <30-days.json> ' +
            '[--seed 42] [--generated-at ISO] [--out md] [--params-out json] ' +
            '[--expected-sha256-current hex] [--expected-sha256-full hex]'
    );
    process.exit(1);
}

function abort(message: string): never {
    console.error(`ABORT — ${message}`);
    return process.exit(1);
}

// Mode --pooled, DOUBLE verrou d'écriture des params : (1) aucun chemin par
// défaut (contrairement au runner v1 dont paramsOutPath vaut
// data/calibration/winCalibration.json par défaut — hériter ce comportement
// écrirait l'artefact silencieusement) ; (2) le flag --params-out fait abort.
if (pooled && paramsOutPath !== null) {
    abort('--params-out est interdit en mode --pooled (porte de validité : AUCUN params écrit).');
}
if (!pooled) {
    // R4 : --chain e3|r4 obligatoire, pas de défaut.
    if (chain !== 'e3' && chain !== 'r4') {
        abort('--chain e3|r4 est obligatoire (hors --pooled) : pas de défaut.');
    }
    // R12 : ni la porte de validité (--chain e3) ni R4 (--chain r4) n'écrivent
    // l'artefact params E3 (le ship d'un évaluateur re-pondéré est un chantier
    // séparé, §5). Un --params-out explicite fait abort.
    if (paramsOutPath !== null) {
        abort('--params-out est interdit (--chain e3 : porte de validité ; --chain r4 : ship séparé).');
    }
    // --chain e3 garde le chemin params par défaut POUR LE TEXTE du rapport
    // (byte-identité de la section « Artefact shippé »), mais l'écriture est
    // sautée. --chain r4 a son propre writer et n'y touche pas.
    if (chain === 'e3') paramsOutPath = 'data/calibration/winCalibration.json';
}
if (outPath === null) {
    outPath = pooled
        ? 'docs/run3/E3-validite-poolee.md'
        : chain === 'r4'
          ? 'docs/calibration/evaluator-reweight-2026.md'
          : 'docs/calibration/win-calibration-par-ligue-2026.md';
}

// ---- 1. appariement fichier → ligue (mode ligue seulement, regex gelée) ------

const LEAGUE_BASENAME = /^(lck|lec|lfl|lpl)-\d{4}\.json$/;
const LEAGUE_ORDER = ['lck', 'lec', 'lfl', 'lpl'] as const;
type LeagueId = (typeof LEAGUE_ORDER)[number];

const leagueOfInput = new Map<string, LeagueId>();
if (!pooled) {
    for (const input of inputs) {
        const match = LEAGUE_BASENAME.exec(basename(input));
        if (match === null) {
            abort(
                `basename de corpus inconnu : ${basename(input)} (${input}) — ` +
                    'la ligue d\'un fichier = le préfixe de son basename (^(lck|lec|lfl|lpl)-\\d{4}\\.json$).'
            );
        }
        leagueOfInput.set(input, match[1] as LeagueId);
    }
}

// ---- datasets SoloQ : hashés ET VÉRIFIÉS avant toute métrique (règle gelée) --

interface LoadedDataset {
    path: string;
    sha256: string;
    dataset: Dataset;
}

function loadDataset(path: string, label: string, expectedSha256: string): LoadedDataset {
    const bytes = readFileSync(resolve(repoRoot, path));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== expectedSha256) {
        return abort(
            `sha256(${label}) ≠ attendu — snapshot non conforme à la règle gelée.\n` +
                `  fichier : ${path}\n  mesuré  : ${sha256}\n  attendu : ${expectedSha256}`
        );
    }
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

const current = loadDataset(datasetPath, 'current-patch', expectedSha256Current);
const full = loadDataset(fullDatasetPath, '30-days', expectedSha256Full);

const hashOverrideLine = hashOverridden
    ? `Override de hash : --expected-sha256-current=${expectedSha256Current} · ` +
      `--expected-sha256-full=${expectedSha256Full} (fixtures synthétiques uniquement — ` +
      'flags INTERDITS sur corpus réels)'
    : 'Override de hash : aucun (défauts gelés de la règle, snapshots run #2 vérifiés)';

// ---- 2. corpus, éligibilité, unicité des gameId sur l'union ------------------

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

// ---- 3. pré-calcul p_raw par (game, position), UNE seule fois ----------------
// p_raw ne dépend PAS de la ligue : cache unique, partagé par tous les bras.

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

// ---- briques partagées (assertion chronologique, replay des folds, bras) -----

const MIN_TRAIN_SIZE = 50;

function minDateOf(items: EligibleGame[]): string | undefined {
    let min: string | undefined;
    for (const item of items) {
        const date = item.record.date;
        if (date === undefined) continue;
        if (min === undefined || date < min) min = date;
    }
    return min;
}

/** Assertion croisée ordre-patch vs chronologie — abort AVANT toute métrique. */
function assertChronology(groups: { patch: string; items: EligibleGame[] }[], scope: string): void {
    let previousPatch: string | null = null;
    let previousMin: string | undefined;
    for (const group of groups) {
        const min = minDateOf(group.items);
        if (min === undefined) {
            abort(
                `le groupe de patch ${group.patch} (${scope}) ne porte aucune date — ` +
                    `l'assertion ordre-patch vs chronologie est invérifiable.`
            );
        }
        if (previousPatch !== null && previousMin !== undefined && min < previousMin) {
            abort(
                `l'ordre des patchs contredit la chronologie (${scope}) : min(date) de ${group.patch} (${min}) ` +
                    `< min(date) de ${previousPatch} (${previousMin}).`
            );
        }
        previousPatch = group.patch;
        previousMin = min;
    }
}

interface GroupSummary {
    patch: string;
    n: number;
    scored: boolean;
}

/**
 * Replay de la règle de walkForward : un groupe est scoré ssi le train cumulé
 * des groupes précédents atteint minTrainSize ; les groupes train-only sont
 * donc un préfixe de la timeline.
 */
function replayFolds(groups: { patch: string; items: EligibleGame[] }[]): {
    groupSummaries: GroupSummary[];
    scoredGames: EligibleGame[];
} {
    const groupSummaries: GroupSummary[] = [];
    const scoredGames: EligibleGame[] = [];
    let trainCount = 0;
    for (const group of groups) {
        const scored = trainCount >= MIN_TRAIN_SIZE;
        groupSummaries.push({ patch: group.patch, n: group.items.length, scored });
        if (scored) scoredGames.push(...group.items);
        trainCount += group.items.length;
    }
    return { groupSummaries, scoredGames };
}

const isBlueWin = (game: EligibleGame): boolean => game.record.winner === 'blue';
const plattPairsOf = (games: EligibleGame[], position: CalibrationPositionId) =>
    games.map((game) => ({ p: rawOf(game, position), won: isBlueWin(game) }));

interface PositionArms {
    calibrated: WalkForwardResult;
    uncalibrated: WalkForwardResult;
    coin: WalkForwardResult;
    sideOnly: WalkForwardResult;
}

/** Les quatre bras walk-forward d'une position, sur les MÊMES items appariés. */
function armsOf(items: EligibleGame[], position: CalibrationPositionId, nScored: number): PositionArms {
    const calibrated = walkForward<EligibleGame, PlattParams>(items, {
        fit: (train) => plattFit(plattPairsOf(train, position)),
        predict: (params, game) => plattApply(params, rawOf(game, position)),
        outcome: isBlueWin,
        minTrainSize: MIN_TRAIN_SIZE
    });
    const uncalibrated = walkForward<EligibleGame, null>(items, {
        fit: () => null,
        predict: (_, game) => rawOf(game, position),
        outcome: isBlueWin,
        minTrainSize: MIN_TRAIN_SIZE
    });
    const coin = walkForward<EligibleGame, null>(items, {
        fit: () => null,
        predict: () => 0.5,
        outcome: isBlueWin,
        minTrainSize: MIN_TRAIN_SIZE
    });
    const sideOnly = walkForward<EligibleGame, number>(items, {
        fit: (train) => train.filter(isBlueWin).length / train.length,
        predict: (blueRate) => blueRate,
        outcome: isBlueWin,
        minTrainSize: MIN_TRAIN_SIZE
    });
    // Garde de plomberie : l'alignement index à index des paires des quatre bras
    // est la condition du chemin apparié de bootstrapDeltaCI.
    for (const arm of [calibrated, uncalibrated, coin, sideOnly]) {
        if (arm.aggregate.n !== nScored) {
            abort('replay des folds incohérent avec walkForward — paires non alignées.');
        }
    }
    return { calibrated, uncalibrated, coin, sideOnly };
}

interface PositionDeltas {
    brier: BootstrapDelta;
    logLoss: BootstrapDelta;
}

interface FinalFit {
    a: number;
    b: number;
    nTrain: number;
    validated: boolean;
}

// ---- textes gelés repris verbatim dans les rapports ---------------------------

const CAVEAT_M3X = [
    'LIMITE DOCUMENTÉE (reprise verbatim dans le rapport) : le snapshot SoloQ est',
    '« d\'aujourd\'hui » et évalue des games 2025-2026 (fuite de features M3.x connue).',
    'Elle contamine p_raw À L\'IDENTIQUE dans les bras calibré et non calibré (comparaison',
    'appariée interne valide) ; le claim autorisé porte sur la CARTE DE CALIBRATION,',
    'jamais sur la force prédictive de l\'évaluateur. Aucun « on prédit le vainqueur ».'
].join('\n');

const APPLICATION_APPROXIMATIONS = [
    'TROIS APPROXIMATIONS D\'APPLICATION (déclarées ici, reprises dans le rapport et l\'aide produit) :',
    '  (a) la calibration est mesurée aux trois ancres 0 / 3 / 10 picks verrouillés ; une position',
    '      intermédiaire reçoit la carte de l\'ancre que la partition positionOf lui assigne',
    '      (0 → afterBans ; 1..6 → after3Picks ; 7..10 → fullDraft), jamais une interpolation ;',
    '  (b) à l\'application, le % du coach passe par des rôles INFÉRÉS et le mode séquence par l\'argmax des',
    '      rolePriors, alors que la mesure utilise les rôles RÉELS du corpus — l\'écart d\'attribution de',
    '      rôles n\'est pas couvert par le claim ;',
    '  (c) les cartes sont mesurées sur des games INTRA-ligue (les deux équipes de la même ligue) ; une',
    '      draft inter-ligues (leagueIdB ≠ leagueIdA) reçoit la carte de la ligue du camp affiché — l\'écart',
    '      n\'est pas couvert par le claim.'
].join('\n');

const ATTENDU_AFTERBANS_E3 = [
    'ATTENDU DÉCLARÉ D\'AVANCE : afterBans dégénère en side-only PAR LIGUE (p_raw ≡ 0,5 ⇒ b sans',
    'information, a = logit du taux blue du train de la ligue). Le run #2 a publié : side-only',
    'lec/lfl/lpl ≈ pile-ou-face ⇒ rouges probables, qui seraient des CONFIRMATIONS d\'honnêteté',
    '(le 50 % post-bans y est déjà honnête) ; side-only LCK 2026 : accuracy +8,4 pp SIGNIFICATIVE',
    '([+2,8 ; +14,0], scorecard lck-2026-26.11) MAIS, sur l\'échelle MÊME du verdict E3, ΔBrier',
    'side-only vs pièce = −0,0045 [−0,0101 ; +0,0012] (n = 286, NON significatif, même scorecard).',
    'L\'effet attendu vaut ≈ −(q − 0,5)² (q = taux blue walk-forward lck) ; au point estimé 2026',
    '(≈ −0,0045) et au MDE afterBans-lck (≈ 0,0027), la détection est attendue BORDERLINE —',
    'un VERT lck/afterBans signifierait « en LCK, afficher ~q % après bans est plus honnête que 50 % » ;',
    'un ROUGE, que l\'avantage blue ne tient pas sur 2025-2026 au niveau requis. LES DEUX lectures sont',
    'écrites dans la règle, avant le run.'
].join('\n');

const ATTENDU_AFTERBANS_V1 = [
    'ATTENDU DÉCLARÉ D\'AVANCE : à afterBans, p_raw ≡ 0,5 (l\'évaluateur ne voit ni les',
    'bans ni le side) ⇒ la calibration y dégénère en side-only (b sans information,',
    'a = logit du taux blue du train). Le verdict 2026 « side-only ≈ pile-ou-face »',
    'rend un ROUGE probable sur cette position ; ce rouge serait une CONFIRMATION',
    'd\'honnêteté (le 50 % affiché après bans est déjà honnête), pas un échec.'
].join('\n');

const NOTE_MULTIPLICITE = [
    'MULTIPLICITÉ DÉCLARÉE : sous le nul global, ~0,3 faux vert attendu sur 12 cellules',
    '(P(≥1 faux vert) ≈ 26 %) — aucun ajustement (chaque cellule porte une décision produit LOCALE et',
    'réversible au re-run) ; le rapport publie les 12 verdicts ensemble et chaque claim cite SA cellule.',
    'LIMITE DÉCLARÉE — corrélation intra-série : les games d\'une même série (Bo3/Bo5, mêmes équipes) sont',
    'corrélées ; le bootstrap apparié PAR GAME (convention v1, conservée pour la comparabilité et la porte',
    'de validité) est anticonservateur sous cette corrélation — les ~0,3 faux verts attendus sont une',
    'borne basse. SECONDAIRE PUBLIÉ, sans pouvoir de verdict : pour chacune des 12 cellules, IC 95 % du',
    'même ΔBrier par clusterBootstrapDeltaCI (cluster = series.matchId, une game sans série = son propre',
    'cluster ; observations appariées model = (p_cal − y)², baseline = (p_raw − y)² par game ;',
    '1000 resamples), consommé sur le MÊME flux mulberry32(seed 42) APRÈS les 24 IC primaires, dans',
    'l\'ordre gelé des cellules (lck → lec → lfl → lpl × afterBans → after3Picks → fullDraft). Toute',
    'cellule VERTE dont l\'IC clusterisé recouvre 0 cite cet écart verbatim dans son claim produit.'
].join('\n');

// ---- helpers de rendu ----------------------------------------------------------

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

const timelineLineOf = (groupSummaries: GroupSummary[]): string =>
    groupSummaries.map((g) => `${g.patch} (${g.n}${g.scored ? '' : ', train-only'})`).join(' → ');

// ================================================================================
// MODE --pooled — porte de validité : réplication v1 À L'IDENTIQUE (7 corpus v1),
// rapport au format v1, AUCUN params écrit.
// ================================================================================

if (pooled) {
    const groups = groupByPatch(eligible);
    assertChronology(groups, 'timeline poolée');
    const { groupSummaries, scoredGames } = replayFolds(groups);
    const scoredGroups = groupSummaries.filter((g) => g.scored);
    const trainOnlyGroups = groupSummaries.filter((g) => !g.scored);

    const armsByPosition = new Map<CalibrationPositionId, PositionArms>();
    for (const position of CALIBRATION_POSITIONS) {
        armsByPosition.set(position.id, armsOf(eligible, position.id, scoredGames.length));
    }

    // SIX IC dans l'ordre v1 exact, un flux mulberry32(seed) neuf — la
    // consommation du rng reproduit la v1 à l'identique.
    const rng = mulberry32(seed);
    const deltasByPosition = new Map<CalibrationPositionId, PositionDeltas>();
    for (const position of CALIBRATION_POSITIONS) {
        const arms = armsByPosition.get(position.id)!;
        const dBrier = bootstrapDeltaCI(
            arms.calibrated.aggregate.pairs,
            arms.uncalibrated.aggregate.pairs,
            brier,
            { iterations: 1000, rng }
        );
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

    const indicesByCorpus = new Map<string, number[]>();
    scoredGames.forEach((game, index) => {
        const list = indicesByCorpus.get(game.source);
        if (list) list.push(index);
        else indicesByCorpus.set(game.source, [index]);
    });
    const pairsAt = (pairs: PredictionPair[], indices: number[]): PredictionPair[] =>
        indices.map((i) => pairs[i]);

    const rows: string[] = [
        '# Calibration Platt par position de séquence — porte de validité E3 (runner v2, mode --pooled)',
        '',
        `> Généré : ${generatedAt} · seed ${seed} (mulberry32, 1000 resamples, IC appariés par game)`,
        '> Règle pré-enregistrée gelée dans l\'en-tête de `scripts/backtest/winCalibrationByLeague.ts` — mode --pooled :',
        '> réplication v1 (porte de validité, §2.6 du design E3), AUCUN pouvoir de verdict, AUCUN params écrit.',
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
        '## Datasets SoloQ (figés, hashés et VÉRIFIÉS avant le run)',
        '',
        `- current-patch : \`${current.path}\` · version ${current.dataset.version} · date ${current.dataset.date}`,
        `  sha256 \`${current.sha256}\``,
        `- 30-days : \`${full.path}\` · version ${full.dataset.version} · date ${full.dataset.date}`,
        `  sha256 \`${full.sha256}\``,
        `- ${hashOverrideLine}`,
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
        `- Timeline ordonnée des groupes de patch (éligibles) : ${timelineLineOf(groupSummaries)}`,
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
            `- Fit final full-data (contrôle secondaire de la porte, JAMAIS écrit) : a = ${fr(fit.a, 6)}, ` +
                `b = ${fr(fit.b, 6)}, nTrain = ${fit.nTrain}, validated = ${fit.validated} ` +
                '(= verdict VERT ∧ b > 0).',
            ''
        );
        if (position.id === 'afterBans') {
            rows.push('```', ATTENDU_AFTERBANS_V1, '```', '');
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
        '> Aucun pouvoir de verdict : le protocole est poolé (réplication v1).',
        '> Brier du bras calibré / non calibré sur les paires du corpus.',
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
        '## Verdicts (réplication v1 — aucun artefact params)',
        '',
        '| Position | Verdict ΔBrier | a (fit final) | b (fit final) | nTrain | validated |',
        '|---|---|---|---|---|---|'
    );
    for (const position of CALIBRATION_POSITIONS) {
        const fit = finalFits.get(position.id)!;
        const arms = armsByPosition.get(position.id)!;
        const verdict =
            arms.calibrated.aggregate.n === 0 ? 'ROUGE (0 paire)' : isGreen(position.id) ? 'VERT' : 'ROUGE';
        rows.push(
            `| ${position.id} | ${verdict} | ${fr(fit.a, 6)} | ${fr(fit.b, 6)} | ${fit.nTrain} | ${fit.validated} |`
        );
    }
    rows.push(
        '',
        'Aucun artefact params écrit (mode --pooled, porte de validité — double verrou : pas de chemin',
        'par défaut, abort si `--params-out`). Comparaison à 5 décimales contre la table d\'acceptation',
        'du §2.6 de `docs/run3/E3-calibration-par-ligue.md` (valeurs publiées de',
        '`docs/calibration/win-calibration-2026.md`).',
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
    console.log(markdown);
    console.log(`Écrit : ${absOut}`);
    process.exit(0);
}

// ================================================================================
// MODE LIGUE (LE run E3) — quatre timelines, 12 cellules, artefact params v2.
// ================================================================================

interface LeagueRun {
    league: LeagueId;
    inputs: string[];
    eligible: EligibleGame[];
    groupSummaries: GroupSummary[];
    scoredGames: EligibleGame[];
    fittedThroughPatch: string;
    arms: Map<CalibrationPositionId, PositionArms>;
    deltas: Map<CalibrationPositionId, PositionDeltas>;
    clusterDeltas: Map<CalibrationPositionId, ClusterBootstrapDelta>;
    finalFits: Map<CalibrationPositionId, FinalFit>;
}

const leaguesPresent = LEAGUE_ORDER.filter((league) =>
    inputs.some((input) => leagueOfInput.get(input) === league)
);

const leagueRuns: LeagueRun[] = [];
for (const league of leaguesPresent) {
    const leagueInputs = inputs.filter((input) => leagueOfInput.get(input) === league);
    const leagueEligible = eligible.filter((game) => leagueOfInput.get(game.source) === league);
    if (leagueEligible.length === 0) {
        abort(`aucun record éligible pour la ligue ${league} — timeline impossible.`);
    }
    // 4. timeline PAR LIGUE : groupByPatch + assertion chronologique + replay.
    const groups = groupByPatch(leagueEligible);
    assertChronology(groups, `ligue ${league}`);
    const { groupSummaries, scoredGames } = replayFolds(groups);

    // 5. les quatre bras PAR POSITION sur les MÊMES items appariés.
    const arms = new Map<CalibrationPositionId, PositionArms>();
    for (const position of CALIBRATION_POSITIONS) {
        arms.set(position.id, armsOf(leagueEligible, position.id, scoredGames.length));
    }

    leagueRuns.push({
        league,
        inputs: leagueInputs,
        eligible: leagueEligible,
        groupSummaries,
        scoredGames,
        fittedThroughPatch: groups[groups.length - 1].patch,
        arms,
        deltas: new Map(),
        clusterDeltas: new Map(),
        finalFits: new Map()
    });
}

// ============================================================================
// === --chain e3 — PORTE DE VALIDITÉ : mode LIGUE E3 VERBATIM (byte-identique)
// Tout ce bloc est le code E3 inchangé ; il ne s'exécute qu'en --chain e3 et
// reproduit docs/calibration/win-calibration-by-league.md à l'octet (R1/R2).
// ============================================================================
if (chain === 'e3') {
// ---- 6. les 24 IC bootstrap dans l'ordre GELÉ, UN SEUL flux mulberry32(seed) --
// Ordre : ligues lck → lec → lfl → lpl ; par ligue : afterBans Brier, afterBans
// logLoss, after3Picks Brier, after3Picks logLoss, fullDraft Brier, fullDraft
// logLoss.

const rng = mulberry32(seed);
for (const run of leagueRuns) {
    for (const position of CALIBRATION_POSITIONS) {
        const arms = run.arms.get(position.id)!;
        const dBrier = bootstrapDeltaCI(
            arms.calibrated.aggregate.pairs,
            arms.uncalibrated.aggregate.pairs,
            brier,
            { iterations: 1000, rng }
        );
        const dLogLoss = bootstrapDeltaCI(
            arms.calibrated.aggregate.pairs,
            arms.uncalibrated.aggregate.pairs,
            logLoss,
            { iterations: 1000, rng }
        );
        run.deltas.set(position.id, { brier: dBrier, logLoss: dLogLoss });
    }
}

// ---- 6 (suite). IC clusterisés SECONDAIRES (sans pouvoir de verdict), sur le
// MÊME flux rng APRÈS les 24 IC primaires, dans l'ordre gelé des cellules
// (lck → lec → lfl → lpl × afterBans → after3Picks → fullDraft).

for (const run of leagueRuns) {
    for (const position of CALIBRATION_POSITIONS) {
        const arms = run.arms.get(position.id)!;
        const observations: PairedObservation[] = run.scoredGames.map((game, index) => {
            const y = isBlueWin(game) ? 1 : 0;
            const pCal = arms.calibrated.aggregate.pairs[index].p;
            const pRaw = arms.uncalibrated.aggregate.pairs[index].p;
            return {
                cluster: game.record.series?.matchId ?? game.record.gameId,
                model: (pCal - y) * (pCal - y),
                baseline: (pRaw - y) * (pRaw - y)
            };
        });
        run.clusterDeltas.set(
            position.id,
            clusterBootstrapDeltaCI(observations, { iterations: 1000, rng })
        );
    }
}

const isGreenCell = (run: LeagueRun, position: CalibrationPositionId): boolean =>
    run.arms.get(position)!.calibrated.aggregate.n > 0 &&
    run.deltas.get(position)!.brier.ci95.hi < 0;

// ---- 7 (calcul). fits finals full-data PAR LIGUE + full-fit poolé (provenance) -

for (const run of leagueRuns) {
    for (const position of CALIBRATION_POSITIONS) {
        const params = plattFit(plattPairsOf(run.eligible, position.id));
        run.finalFits.set(position.id, {
            a: params.a,
            b: params.b,
            nTrain: run.eligible.length,
            validated: isGreenCell(run, position.id) && params.b > 0
        });
    }
}

// Full-fit poolé des corpus passés : PROVENANCE/COMPARAISON SEULEMENT,
// validated:false FORCÉ par construction (aucun verdict poolé dans ce run).
const pooledGroups = groupByPatch(eligible);
const pooledFits = new Map<CalibrationPositionId, FinalFit>();
for (const position of CALIBRATION_POSITIONS) {
    const params = plattFit(plattPairsOf(eligible, position.id));
    pooledFits.set(position.id, {
        a: params.a,
        b: params.b,
        nTrain: eligible.length,
        validated: false
    });
}

// ---- 8. rapport markdown -------------------------------------------------------

function cellVerdictLine(run: LeagueRun, position: CalibrationPositionId): string {
    const arms = run.arms.get(position)!;
    const delta = run.deltas.get(position)!.brier;
    if (arms.calibrated.aggregate.n === 0) {
        return (
            `ROUGE — aucune paire de test (timeline ${run.league} entière sous minTrainSize = ${MIN_TRAIN_SIZE}) : ` +
            'verdict impossible, cellule non validée.'
        );
    }
    return isGreenCell(run, position)
        ? 'VERT — l\'IC 95 % de ΔBrier est entièrement négatif : le % calibré est mesurablement plus honnête que le % brut pour cette ligue.'
        : `ROUGE — l'IC 95 % de ΔBrier (${frInterval(delta.ci95.lo, delta.ci95.hi, 5)}) ne reste pas sous 0 : ` +
              'pas d\'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).';
}

const cellVerdictWord = (run: LeagueRun, position: CalibrationPositionId): string =>
    run.arms.get(position)!.calibrated.aggregate.n === 0
        ? 'ROUGE (0 paire)'
        : isGreenCell(run, position)
          ? 'VERT'
          : 'ROUGE';

const rows: string[] = [
    '# Calibration Platt PAR LIGUE × position de séquence — chantier E3, run #3',
    '',
    `> Généré : ${generatedAt} · seed ${seed} (mulberry32 — UN flux : 24 IC primaires appariés par game,`,
    '> puis IC clusterisés secondaires par série · 1000 resamples chacun)',
    '> Règle pré-enregistrée gelée dans l\'en-tête de `scripts/backtest/winCalibrationByLeague.ts` — un rouge se documente, ne se retune pas.',
    '',
    '## Comment lire ce rapport (pour le drafteur)',
    '',
    'Calibrer, c\'est rendre le % affiché honnête : quand l\'outil dit « 60 % », l\'équipe devrait',
    'gagner environ 60 % de ces games-là. La nouveauté E3 : une carte de Platt (a, b) PAR LIGUE',
    '(lck/lec/lfl/lpl) × position de draft — une carte unique moyennait l\'hétérogénéité des ligues',
    '(le side LCK, la dérive LFL). Le verdict, par CELLULE (ligue × position) : VERT ssi l\'IC',
    'bootstrap 95 % de ΔBrier = Brier(calibré) − Brier(brut) est entièrement sous 0. Le Δ log loss',
    'est publié à titre descriptif (secondaire, déclaré d\'avance), l\'IC clusterisé par série aussi',
    '(limite déclarée, sans pouvoir de verdict). Une ligue sans carte validée garde le % brut et le',
    'badge « Non calibré ». Ce rapport ne prétend JAMAIS prédire le vainqueur — seulement rendre le',
    '% honnête, ligue par ligue.',
    '',
    '## Datasets SoloQ (figés, hashés et VÉRIFIÉS avant le run)',
    '',
    `- current-patch : \`${current.path}\` · version ${current.dataset.version} · date ${current.dataset.date}`,
    `  sha256 \`${current.sha256}\``,
    `- 30-days : \`${full.path}\` · version ${full.dataset.version} · date ${full.dataset.date}`,
    `  sha256 \`${full.sha256}\``,
    `- ${hashOverrideLine}`,
    '',
    '## Couverture',
    '',
    '| Corpus | Ligue | Records | Éligibles | Écartés | Paires de test (par position) |',
    '|---|---|---|---|---|---|'
];

const testCountBySource = new Map<string, number>();
for (const run of leagueRuns) {
    for (const game of run.scoredGames) {
        testCountBySource.set(game.source, (testCountBySource.get(game.source) ?? 0) + 1);
    }
}
for (const c of coverage) {
    rows.push(
        `| ${basename(c.input)} | ${leagueOfInput.get(c.input)} | ${c.records} | ${c.eligible} | ` +
            `${c.discarded} | ${testCountBySource.get(c.input) ?? 0} |`
    );
}
const totalRecords = coverage.reduce((sum, c) => sum + c.records, 0);
const totalDiscarded = coverage.reduce((sum, c) => sum + c.discarded, 0);
const totalScored = leagueRuns.reduce((sum, run) => sum + run.scoredGames.length, 0);
rows.push(
    `| **TOTAL** | — | ${totalRecords} | ${eligible.length} | ${totalDiscarded} | ${totalScored} |`,
    '',
    '> Écarté = sans vainqueur, sans patch parsable, ou sans 10 picks rôle-complets (règle compOf de',
    '> postdiction G1) — un SEUL ensemble éligible PAR LIGUE, partagé par les trois positions.',
    ''
);

for (const run of leagueRuns) {
    const scoredGroups = run.groupSummaries.filter((g) => g.scored);
    const trainOnlyGroups = run.groupSummaries.filter((g) => !g.scored);
    rows.push(
        `## Ligue ${run.league}`,
        '',
        `- Corpus : ${run.inputs.map((input) => basename(input)).join(' + ')} — ${run.eligible.length} éligibles.`,
        `- Timeline ordonnée des groupes de patch (éligibles) : ${timelineLineOf(run.groupSummaries)}`,
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
        const arms = run.arms.get(position.id)!;
        const deltas = run.deltas.get(position.id)!;
        const cluster = run.clusterDeltas.get(position.id)!;
        const fit = run.finalFits.get(position.id)!;
        rows.push(
            `### ${run.league} · ${POSITION_TITLES[position.id]}`,
            '',
            '| Bras | n | Brier | Log loss | Accuracy |',
            '|---|---|---|---|---|',
            armRow('Calibré σ(a + b·logit(p_raw))', arms.calibrated.aggregate),
            armRow('Non calibré (p_raw)', arms.uncalibrated.aggregate),
            armRow('Pièce p = 0,5', arms.coin.aggregate),
            armRow('Side-only ligue (descriptif, baseline M3.5)', arms.sideOnly.aggregate),
            '',
            `- **ΔBrier (critère du verdict)** : Δ = ${fr(deltas.brier.delta, 5)} · IC 95 % apparié ` +
                `${frInterval(deltas.brier.ci95.lo, deltas.brier.ci95.hi, 5)}`,
            `- Δ log loss (secondaire, descriptif) : Δ = ${fr(deltas.logLoss.delta, 5)} · IC 95 % ` +
                `${frInterval(deltas.logLoss.ci95.lo, deltas.logLoss.ci95.hi, 5)}`,
            `- IC clusterisé par série (SECONDAIRE, sans pouvoir de verdict — limite déclarée §1) : ` +
                `Δ = ${fr(cluster.delta, 5)} · IC 95 % ${frInterval(cluster.ci95.lo, cluster.ci95.hi, 5)} ` +
                `(${cluster.clusters} clusters / ${cluster.observations} games)`,
            `- **Verdict : ${cellVerdictLine(run, position.id)}**`,
            `- Fit final full-data DE LA LIGUE (shippé, jamais utilisé pour les métriques) : a = ${fr(fit.a, 6)}, ` +
                `b = ${fr(fit.b, 6)}, nTrain = ${fit.nTrain}, validated = ${fit.validated} ` +
                '(= verdict VERT ∧ b > 0).',
            ''
        );
        if (position.id === 'afterBans') {
            rows.push('```', ATTENDU_AFTERBANS_E3, '```', '');
        }
        if (arms.calibrated.aggregate.n > 0) {
            rows.push(
                `#### Fiabilité (10 bacs) — ${run.league} · ${position.id} · bras CALIBRÉ`,
                '',
                ...reliabilityTable(arms.calibrated.aggregate.pairs),
                '',
                `#### Fiabilité (10 bacs) — ${run.league} · ${position.id} · bras NON CALIBRÉ`,
                '',
                ...reliabilityTable(arms.uncalibrated.aggregate.pairs),
                ''
            );
        } else {
            rows.push('_Aucune paire de test : pas de diagramme de fiabilité pour cette cellule._', '');
        }
    }
}

rows.push(
    `## Récapitulatif des ${leagueRuns.length * CALIBRATION_POSITIONS.length} cellules (toutes publiées ensemble)`,
    '',
    '| Ligue | Position | ΔBrier | IC 95 % apparié | IC clusterisé (secondaire, §1 LIMITE DÉCLARÉE) | Verdict | a | b | validated |',
    '|---|---|---|---|---|---|---|---|---|'
);
for (const run of leagueRuns) {
    for (const position of CALIBRATION_POSITIONS) {
        const deltas = run.deltas.get(position.id)!;
        const cluster = run.clusterDeltas.get(position.id)!;
        const fit = run.finalFits.get(position.id)!;
        rows.push(
            `| ${run.league} | ${position.id} | ${fr(deltas.brier.delta, 5)} | ` +
                `${frInterval(deltas.brier.ci95.lo, deltas.brier.ci95.hi, 5)} | ` +
                `${frInterval(cluster.ci95.lo, cluster.ci95.hi, 5)} | ${cellVerdictWord(run, position.id)} | ` +
                `${fr(fit.a, 6)} | ${fr(fit.b, 6)} | ${fit.validated} |`
        );
    }
}

rows.push(
    '',
    '## Multiplicité et corrélation intra-série (verbatim, gelées dans la règle)',
    '',
    '```',
    NOTE_MULTIPLICITE,
    '```',
    '',
    '## Artefact shippé (version 2)',
    '',
    `Artefact : \`${paramsOutPath}\` — TOUJOURS écrit, quel que soit le verdict ; l'UI n'applique`,
    'JAMAIS une position validated:false (badge « Non calibré » conservé, % brut affiché).',
    'Le champ `positions` (full-fit poolé des corpus passés) est PROVENANCE/COMPARAISON SEULEMENT,',
    'validated:false FORCÉ par construction — aucun verdict poolé n\'existe dans ce run ; le repli',
    'd\'une ligue sans carte est le PASSTHROUGH, jamais la carte poolée (D3, gelé).',
    '',
    '| Ligue | nGames | fittedThroughPatch | afterBans (a · b · validated) | after3Picks (a · b · validated) | fullDraft (a · b · validated) |',
    '|---|---|---|---|---|---|'
);
for (const run of leagueRuns) {
    const cells = CALIBRATION_POSITIONS.map((position) => {
        const fit = run.finalFits.get(position.id)!;
        return `${fr(fit.a, 6)} · ${fr(fit.b, 6)} · ${fit.validated}`;
    });
    rows.push(
        `| ${run.league} | ${run.eligible.length} | ${run.fittedThroughPatch} | ${cells.join(' | ')} |`
    );
}
const pooledCells = CALIBRATION_POSITIONS.map((position) => {
    const fit = pooledFits.get(position.id)!;
    return `${fr(fit.a, 6)} · ${fr(fit.b, 6)} · ${fit.validated}`;
});
rows.push(
    `| _poolé (provenance)_ | ${eligible.length} | ${pooledGroups[pooledGroups.length - 1].patch} | ${pooledCells.join(' | ')} |`,
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

// R12 — --chain e3 (porte de validité) n'écrit PAS l'artefact params
// data/calibration/winCalibration.json : l'artefact shippé n'est jamais touché.
// Le texte de la section « Artefact shippé » du rapport reste byte-identique
// (il ne dépend que de paramsOutPath, des fits et des comptes, déjà calculés).
console.log(markdown);
console.log(`Écrit : ${absOut}`);

// ============================================================================
// === --chain r4 — LE bras évaluateur re-pondéré (régression logistique) ======
// ============================================================================
} else {
// --- features par (game, position) : lues de DraftResult (analyzer.ts intact),
// walk-forward-safe (ne dépendent que du draft + snapshots gelés).
const RISK_DS = { dataset: current.dataset, fullDataset: full.dataset };
const featByGame = new Map<string, Record<CalibrationPositionId, number[]>>();
for (const game of eligible) {
    const entry = {} as Record<CalibrationPositionId, number[]>;
    for (const position of CALIBRATION_POSITIONS) {
        const f = evaluatorFeaturesAt(game.record, position.maxSeq, RISK_DS);
        if (f === undefined) {
            abort(
                `features non scorables (${game.record.gameId}, seq ≤ ${position.maxSeq}) ` +
                    '— incohérence d\'éligibilité (jamais attendu).'
            );
        }
        entry[position.id] = featuresTuple(f);
    }
    featByGame.set(game.record.gameId, entry);
}
const featOf = (game: EligibleGame, position: CalibrationPositionId): number[] =>
    featByGame.get(game.record.gameId)![position];

// --- le bras re-pondéré, par ligue × position (MÊMES folds que les bras E3) :
// fit = standardize(train) + logisticFit(β) ; predict = σ(β·z). Init identité,
// ridge 1e-6, maxIter 50 — littéraux explicites (R11).
interface R4Model {
    std: Standardizer;
    fit: LogisticFitResult;
}
function r4ArmOf(items: EligibleGame[], position: CalibrationPositionId, nScored: number): WalkForwardResult {
    const arm = walkForward<EligibleGame, R4Model>(items, {
        fit: (train) => {
            const std = standardizeFit(train.map((g) => featOf(g, position)));
            const rows = train.map((g) => ({
                x: standardizeApply(std, featOf(g, position)),
                y: (isBlueWin(g) ? 1 : 0) as 0 | 1
            }));
            return { std, fit: logisticFit(rows, { ridge: 1e-6, maxIter: 50 }) };
        },
        predict: (model, game) =>
            logisticPredict(model.fit, standardizeApply(model.std, featOf(game, position))),
        outcome: isBlueWin,
        minTrainSize: MIN_TRAIN_SIZE
    });
    if (arm.aggregate.n !== nScored) {
        abort('bras R4 désaligné avec walkForward — paires non appariées.');
    }
    return arm;
}

const r4ByLeaguePos = new Map<string, WalkForwardResult>();
for (const run of leagueRuns) {
    for (const position of CALIBRATION_POSITIONS) {
        r4ByLeaguePos.set(
            `${run.league}:${position.id}`,
            r4ArmOf(run.eligible, position.id, run.scoredGames.length)
        );
    }
}

// --- smoke aveugle (R4, §4.5) : couverture + plomberie, AUCUN taux ni verdict.
// Les bras R4 sont construits (assertions d'appariement passées) ; on sort
// avant toute métrique pour préserver la pré-enregistration.
if (smoke) {
    const lines = ['SMOKE R4 — couverture + plomberie seulement, AUCUN taux ni verdict.'];
    for (const position of CALIBRATION_POSITIONS) {
        const counts = leagueRuns.map(
            (run) => `${run.league}=${r4ByLeaguePos.get(`${run.league}:${position.id}`)!.aggregate.n}`
        );
        const total = leagueRuns.reduce(
            (s, run) => s + r4ByLeaguePos.get(`${run.league}:${position.id}`)!.aggregate.n,
            0
        );
        lines.push(`  ${position.id} : total=${total} (${counts.join(', ')})`);
    }
    console.log(lines.join('\n'));
    process.exit(0);
}

// --- pooling des paires de test : ordre ligue lck→lec→lfl→lpl, puis scoredGames
// de chaque ligue (les bras partagent cet ordre ⇒ appariement index-à-index).
const r4Pairs = (position: CalibrationPositionId): PredictionPair[] =>
    leagueRuns.flatMap((run) => r4ByLeaguePos.get(`${run.league}:${position}`)!.aggregate.pairs);
const ncPairs = (position: CalibrationPositionId): PredictionPair[] =>
    leagueRuns.flatMap((run) => run.arms.get(position)!.uncalibrated.aggregate.pairs);
const plattPairs = (position: CalibrationPositionId): PredictionPair[] =>
    leagueRuns.flatMap((run) => run.arms.get(position)!.calibrated.aggregate.pairs);
const sidePairs = (position: CalibrationPositionId): PredictionPair[] =>
    leagueRuns.flatMap((run) => run.arms.get(position)!.sideOnly.aggregate.pairs);
const coinPairs = (position: CalibrationPositionId): PredictionPair[] =>
    leagueRuns.flatMap((run) => run.arms.get(position)!.coin.aggregate.pairs);
const scoredPooled = (): EligibleGame[] => leagueRuns.flatMap((run) => run.scoredGames);

const PRIMARY: CalibrationPositionId[] = ['after3Picks', 'fullDraft'];

// --- les IC sur UN flux mulberry32(seed), ordre GELÉ (§1.3/§1.6) :
//  (1) ΔBrier(R4−nonCal) after3Picks, fullDraft   [primaire i]
//  (2) ΔBrier(R4−Platt)  after3Picks, fullDraft   [primaire ii, co-décisif]
//  (3) Δ logLoss(R4−nonCal) after3Picks, fullDraft [secondaire]
//  (4) IC clusterisé ΔBrier(R4−nonCal) after3Picks, fullDraft [secondaire]
//  (5) per-league ΔBrier(R4−nonCal), ligue-major × {after3Picks, fullDraft}
//  (6) ΔBrier(R4−side-only) after3Picks, fullDraft [secondaire]
const rng = mulberry32(seed);
const brierVsNonCal = new Map<CalibrationPositionId, BootstrapDelta>();
for (const position of PRIMARY) {
    brierVsNonCal.set(position, bootstrapDeltaCI(r4Pairs(position), ncPairs(position), brier, { iterations: 1000, rng }));
}
const brierVsPlatt = new Map<CalibrationPositionId, BootstrapDelta>();
for (const position of PRIMARY) {
    brierVsPlatt.set(position, bootstrapDeltaCI(r4Pairs(position), plattPairs(position), brier, { iterations: 1000, rng }));
}
const logLossVsNonCal = new Map<CalibrationPositionId, BootstrapDelta>();
for (const position of PRIMARY) {
    logLossVsNonCal.set(position, bootstrapDeltaCI(r4Pairs(position), ncPairs(position), logLoss, { iterations: 1000, rng }));
}
const clusterVsNonCal = new Map<CalibrationPositionId, ClusterBootstrapDelta>();
for (const position of PRIMARY) {
    const rp = r4Pairs(position);
    const np = ncPairs(position);
    const scored = scoredPooled();
    const obs: PairedObservation[] = scored.map((game, index) => {
        const y = isBlueWin(game) ? 1 : 0;
        return {
            cluster: game.record.series?.matchId ?? game.record.gameId,
            model: (rp[index].p - y) * (rp[index].p - y),
            baseline: (np[index].p - y) * (np[index].p - y)
        };
    });
    clusterVsNonCal.set(position, clusterBootstrapDeltaCI(obs, { iterations: 1000, rng }));
}
const perLeagueVsNonCal = new Map<string, BootstrapDelta>();
for (const run of leagueRuns) {
    for (const position of PRIMARY) {
        const rp = r4ByLeaguePos.get(`${run.league}:${position}`)!.aggregate.pairs;
        const np = run.arms.get(position)!.uncalibrated.aggregate.pairs;
        perLeagueVsNonCal.set(`${run.league}:${position}`, bootstrapDeltaCI(rp, np, brier, { iterations: 1000, rng }));
    }
}
const brierVsSide = new Map<CalibrationPositionId, BootstrapDelta>();
for (const position of PRIMARY) {
    brierVsSide.set(position, bootstrapDeltaCI(r4Pairs(position), sidePairs(position), brier, { iterations: 1000, rng }));
}

// --- Critère V (R4) : VERT ssi les DEUX IC unilatéraux sont sous 0.
const isGreen = (position: CalibrationPositionId): boolean =>
    brierVsNonCal.get(position)!.ci95.hi < 0 && brierVsPlatt.get(position)!.ci95.hi < 0;
const isWeakGreen = (position: CalibrationPositionId): boolean =>
    brierVsNonCal.get(position)!.ci95.hi < 0 && brierVsPlatt.get(position)!.ci95.hi >= 0;

// --- Garde de signe (R6) : fit full-data POOLÉ par position (jamais une
// métrique), signes des βⱼ des colonnes retenues. validated = VERT ∧ tous βⱼ>0.
interface PooledFit {
    beta: number[];
    kept: boolean[];
    nTrain: number;
    allPositive: boolean;
    validated: boolean;
}
const pooledFitOf = (position: CalibrationPositionId): PooledFit => {
    const std = standardizeFit(eligible.map((g) => featOf(g, position)));
    const rows = eligible.map((g) => ({
        x: standardizeApply(std, featOf(g, position)),
        y: (isBlueWin(g) ? 1 : 0) as 0 | 1
    }));
    const fit = logisticFit(rows, { ridge: 1e-6, maxIter: 50 });
    const slopes = fit.beta.slice(1); // hors intercept
    const allPositive = slopes.length > 0 && slopes.every((b) => b > 0);
    return {
        beta: fit.beta,
        kept: std.kept,
        nTrain: eligible.length,
        allPositive,
        validated: isGreen(position) && allPositive
    };
};
const pooledFits = new Map<CalibrationPositionId, PooledFit>();
for (const position of PRIMARY) pooledFits.set(position, pooledFitOf(position));

// --- afterBans : descriptif (R4 ≡ side-only, aucune feature ⇒ hors verdict).
const brierOf = (pairs: PredictionPair[]): number => brier(pairs);
const ab = {
    r4: brierOf(r4Pairs('afterBans')),
    nonCal: brierOf(ncPairs('afterBans')),
    side: brierOf(sidePairs('afterBans')),
    coin: brierOf(coinPairs('afterBans'))
};

// --- garde anti-mélange (R5) : ≥ 1 ligue à ΔBrier(R4−nonCal) per-league > 0.
const mixedLeagues = (position: CalibrationPositionId): string[] =>
    leagueRuns
        .filter((run) => perLeagueVsNonCal.get(`${run.league}:${position}`)!.delta > 0)
        .map((run) => run.league);

// ---- rapport R4 ---------------------------------------------------------------
const verdictWord = (position: CalibrationPositionId): string =>
    isGreen(position) ? 'VERT' : isWeakGreen(position) ? 'VERT FAIBLE' : 'ROUGE';
const nPooled = (position: CalibrationPositionId): number => r4Pairs(position).length;

const rows: string[] = [
    '# Gate ÉVALUATEUR — re-pondération des composantes différentielles (run #4, chantier R4)',
    '',
    `> Généré : ${generatedAt} · seed ${seed} · \`--chain r4\` · règle pré-enregistrée gelée :`,
    '> `docs/run4/R4-evaluator-reweight.md` §1 (commit 0aa2986, amendements R1-R12) — UNE règle, UN run.',
    `> Datasets SoloQ gelés : current-patch sha256 \`${current.sha256}\` · 30-days sha256 \`${full.sha256}\`.`,
    `> logisticFit ridge=1e-6, maxIter=50, eps=1e-6 (littéraux assertés, R11). ${hashOverrideLine}.`,
    '',
    '## La question mesurée',
    '',
    '`analyzeDraft` est un modèle Elo additif à poids unitaires FIGÉS : winrate = σ((ln10/400)·(x₁+x₂+x₃)),',
    'x₁=χ_ally−χ_enemy, x₂=δ_ally−δ_enemy, x₃=matchup. E3 (Platt) ne pouvait que ré-échelonner la somme',
    'scalaire ; R4 RE-PONDÈRE les trois composantes (régression logistique ajustée walk-forward PAR LIGUE).',
    'Si re-pondérer aide, R4 doit mieux calibrer le % que le modèle shippé (non calibré) ET que Platt.',
    'Corrélation/calibration — jamais une prédiction de vainqueur.',
    '',
    '## Verdict (critère V à DEUX IC co-décisifs, §1.4 — 2 cellules poolées)',
    '',
    '| Cellule | n poolé | ΔBrier(R4−non cal.) | IC 95 % | ΔBrier(R4−Platt) | IC 95 % | Verdict |',
    '|---|---|---|---|---|---|---|'
];
for (const position of PRIMARY) {
    const a = brierVsNonCal.get(position)!;
    const b = brierVsPlatt.get(position)!;
    rows.push(
        `| ${position} | ${nPooled(position)} | ${fr(a.delta, 5)} | ${frInterval(a.ci95.lo, a.ci95.hi, 5)} | ` +
            `${fr(b.delta, 5)} | ${frInterval(b.ci95.lo, b.ci95.hi, 5)} | ${verdictWord(position)} |`
    );
}
rows.push(
    '',
    '**VERT** = les DEUX IC entièrement sous 0 (R4 bat le modèle shippé ET le ré-échelonnement Platt).',
    '**VERT FAIBLE** = seul ΔBrier(R4−non cal.) sous 0, ΔBrier(R4−Platt) chevauche 0 : gain compatible avec',
    'un simple ré-échelonnement, la re-pondération relative N\'EST PAS démontrée (pas de ship). **ROUGE** =',
    'ΔBrier(R4−non cal.) ne reste pas sous 0.',
    ''
);

// lecture pré-écrite par cellule
for (const position of PRIMARY) {
    const word = verdictWord(position);
    const mixed = mixedLeagues(position);
    const lines: string[] = [`- **${position}** : ${word}.`];
    if (word !== 'ROUGE' && mixed.length > 0) {
        lines.push(
            `  Garde anti-mélange (R5) : ΔBrier(R4−non cal.) per-league > 0 dans ${mixed.join(', ')} — ` +
                'le gain poolé est porté par un sous-ensemble de ligues ; claim restreint aux ligues à Δ < 0.'
        );
    }
    const pf = pooledFits.get(position)!;
    if (word === 'VERT' && !pf.allPositive) {
        lines.push(
            '  Garde de signe (R6) : VERT mais une composante pèse à l\'envers (βⱼ<0) — gain de calibration ' +
                'réel, SHIP BLOQUÉ (`validated=false`).'
        );
    }
    const cl = clusterVsNonCal.get(position)!;
    if (word !== 'ROUGE' && cl.ci95.hi >= 0) {
        lines.push(
            `  IC clusterisé par série (secondaire) recouvre 0 : ${frInterval(cl.ci95.lo, cl.ci95.hi, 5)} — ` +
                'robustesse intra-série non garantie (limite déclarée).'
        );
    }
    rows.push(...lines);
}

rows.push(
    '',
    '## Couverture (paires de test poolées — doivent égaler les comptes gelés E3)',
    '',
    '| Cellule | n poolé | lck | lec | lfl | lpl |',
    '|---|---|---|---|---|---|'
);
for (const position of CALIBRATION_POSITIONS) {
    const counts = leagueRuns.map((run) => r4ByLeaguePos.get(`${run.league}:${position.id}`)!.aggregate.n);
    const total = counts.reduce((s, n) => s + n, 0);
    rows.push(`| ${position.id} | ${total} | ${counts.join(' | ')} |`);
}

rows.push(
    '',
    '## afterBans — DÉGÉNÉRESCENCE STRUCTURELLE (descriptif, hors verdict — R9)',
    '',
    'À afterBans, x₁=x₂=x₃=0 (aucun pick) ⇒ les 3 colonnes sont exclues ⇒ R4 = intercept-only = side-only ;',
    'il ne teste RIEN sur la re-pondération. Brier poolé (descriptif) :',
    '',
    `- R4 (≈ side-only) : ${fr(ab.r4, 5)} · side-only : ${fr(ab.side, 5)} · non calibré (p_raw≡0,5) : ${fr(ab.nonCal, 5)} · pièce : ${fr(ab.coin, 5)}`,
    `- ΔBrier(R4 − non calibré) à afterBans = ${fr(ab.r4 - ab.nonCal, 5)} : c'est l'effet side-only vs pièce déjà connu de E3/run #2, PAS un test de re-pondération.`,
    '',
    '## Secondaires descriptives (AUCUN pouvoir de verdict, §1.6)',
    '',
    '| Cellule | Δ log loss(R4−non cal.) | IC 95 % | IC clusterisé ΔBrier(R4−non cal.) | ΔBrier(R4−side-only) | IC 95 % |',
    '|---|---|---|---|---|---|'
);
for (const position of PRIMARY) {
    const ll = logLossVsNonCal.get(position)!;
    const cl = clusterVsNonCal.get(position)!;
    const sd = brierVsSide.get(position)!;
    rows.push(
        `| ${position} | ${fr(ll.delta, 5)} | ${frInterval(ll.ci95.lo, ll.ci95.hi, 5)} | ` +
            `${frInterval(cl.ci95.lo, cl.ci95.hi, 5)} (${cl.clusters} clusters) | ` +
            `${fr(sd.delta, 5)} | ${frInterval(sd.ci95.lo, sd.ci95.hi, 5)} |`
    );
}

rows.push(
    '',
    '### Per-league ΔBrier(R4 − non calibré) — DESCRIPTIF SANS POUVOIR (R5), 8 cellules',
    '',
    '| Ligue | after3Picks | IC 95 % | fullDraft | IC 95 % |',
    '|---|---|---|---|---|'
);
for (const run of leagueRuns) {
    const a3 = perLeagueVsNonCal.get(`${run.league}:after3Picks`)!;
    const fd = perLeagueVsNonCal.get(`${run.league}:fullDraft`)!;
    rows.push(
        `| ${run.league} | ${fr(a3.delta, 5)} | ${frInterval(a3.ci95.lo, a3.ci95.hi, 5)} | ` +
            `${fr(fd.delta, 5)} | ${frInterval(fd.ci95.lo, fd.ci95.hi, 5)} |`
    );
}

rows.push(
    '',
    '### Fit full-data POOLÉ par position (shippé si VERT∧validated ; JAMAIS une métrique) + garde de signe (R6)',
    '',
    '| Cellule | β₀ | β₁ (χ) | β₂ (δ) | β₃ (matchup) | colonnes retenues | tous βⱼ>0 | validated |',
    '|---|---|---|---|---|---|---|---|'
);
for (const position of PRIMARY) {
    const pf = pooledFits.get(position)!;
    // β re-mappés sur [x1,x2,x3] selon kept (colonnes exclues = —).
    const slopeCells: string[] = [];
    let bi = 1;
    for (let j = 0; j < 3; j++) {
        slopeCells.push(pf.kept[j] ? fr(pf.beta[bi++], 4) : '—');
    }
    rows.push(
        `| ${position} | ${fr(pf.beta[0], 4)} | ${slopeCells.join(' | ')} | ` +
            `${pf.kept.filter(Boolean).length}/3 | ${pf.allPositive} | ${pf.validated} |`
    );
}

rows.push(
    '',
    '## Lecture pré-écrite (gelée avant le run, §1.5)',
    '',
    '- **VERT** : l\'évaluateur PORTE du signal de win que ses poids unitaires figés gaspillent — la',
    '  re-pondération le récupère. Suites (chantiers SÉPARÉS, §5) : ship d\'un évaluateur re-pondéré,',
    '  re-run de la gate coach. Rien de cela ne s\'exécute dans ce commit.',
    '- **ROUGE** : re-pondérées optimalement par ligue en walk-forward, les trois composantes ne calibrent',
    '  pas mieux que le modèle shippé. Résultat NÉGATIF de plein droit (la re-pondération linéaire n\'aide',
    '  pas). « Le mur, ce sont les entrées (SoloQ→pro) » est une HYPOTHÈSE non testée ici, renvoyée à un',
    '  futur projet de features ancrées pro — jamais une conclusion de R4.',
    '',
    '## Limite documentée (anachronisme SoloQ, verbatim E3)',
    '',
    '```',
    CAVEAT_M3X,
    '```',
    ''
);

const markdown = rows.join('\n');
const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, markdown, 'utf8');
console.log(markdown);
console.log(`Écrit : ${absOut}`);
}
