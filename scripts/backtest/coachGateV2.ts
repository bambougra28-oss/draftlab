/**
 * Gate COACH v2 — candidats par POOLS JOUEURS RÉELS (run #3, chantier A3).
 *
 * RÈGLE PRÉ-ENREGISTRÉE — recopiée VERBATIM de `docs/run3/A3-coach-player-pools.md`
 * §1 (gelé post-revue adversariale 2026-06-11). UNE règle, UN run : aucun
 * paramètre ne bouge après lecture du moindre résultat.
 *
 * ## 1. Règle pré-enregistrée
 *
 * > Le bloc §1 est rédigé pour être recopié tel quel dans l'en-tête de
 * > `scripts/backtest/coachGateV2.ts` et committé AVANT tout run.
 *
 * ### 1.0 Héritage v1 (verbatim) et porte de validité
 *
 * **Hérité de la v1 sans AUCUN changement** — la v2 cite `docs/run2/A-coach-gate.md`
 * section par section au lieu de la réécrire ; en cas de doute, le texte v1 fait foi :
 *
 * - **§1.1 v1 — le coach mesuré** : même évaluateur
 *   `makeAnalyzeDraftEvaluator({ dataset, fullDataset }, { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 })`,
 *   mêmes snapshots DraftGap GELÉS du run #2 — `current-patch.json` sha256
 *   `ACA91656AF68DFF5016152E947AAFBCEBFB3DFE320CC2781F8FDBE8983FB8869`
 *   (2026-06-10T15:27:33.873Z) et `30-days.json` sha256
 *   `6933C7C2D107AFD465E7D8F0C44765305FF8747A187ED54C4C1F73E87651A4B1`
 *   (2026-06-10T15:27:53.230Z), re-hashés et publiés par le runner (tout écart
 *   de hash = arrêt) ; même `navigate` depth 2 / topK 4, `picksOnly: false`
 *   gelé, mêmes nœuds de ban, même distribution adverse
 *   (`enemyDistributionOf` importée, `buildTendencyTable` α = 5, λ = 0,9/semaine,
 *   `now_k` = plus ancienne date du patch testé, repli `--generated-at`).
 * - **§1.2 v1 — walk-forward et éligibilité** : walk-forward par patch PAR
 *   CORPUS, minTrainSize = 1, mêmes **7 corpus**
 *   (`static/corpus/{lck,lec,lfl,lpl}-2026.json` +
 *   `data/corpus/{lec,lfl,lpl}-2025.json`, 2 661 drafts, état UNIQUE amendé
 *   `docs/run2/AMENDEMENT-corpus-20260611.md`). `lck-2025.json` reste HORS run :
 *   (a) la porte de validité exige l'identité game à game avec le run v1 ;
 *   (b) il demeure le corpus de réplication étiqueté — même règle, rapport
 *   séparé, comme en v1. Mêmes lockouts Fearless data-driven (détecteur
 *   recalculé et publié ; mesure v1 : seul lfl-2025 → OFF), même éligibilité de
 *   game et de tour (template-mismatch, ≥ 2 comparateurs, ≥ 4 tours par side).
 * - **§1.3 v1 — métrique primaire** : re-ranking apparié vainqueur-perdant
 *   inchangé — ρ_t (égalités à ½, |C_t \ {réel}| ≥ 2), R(g, s), crédit 1/½/0,
 *   TD = Σ crédits / n, Wilson 95 %, poolé + par corpus. Le pick réel est évalué
 *   par la racine forcée, jamais comme signal.
 * - **§1.4 v1 — baselines** : B0 hasard 0,5 ; **B1 coach-présence (baseline
 *   ACTIVE)** — mêmes games, mêmes tours, **mêmes C_t** (donc les C_t v2),
 *   v remplacé par −rang dans l'ordre total (présence du train desc, clé asc ;
 *   absent du train = dernier) ; **B2 écho-dataset (contrôle descriptif)** —
 *   Σ_rôles wins / Σ_rôles games du snapshot gelé, 0 si absent, tie-break clé
 *   asc.
 * - **§1.5 v1 — critères de verdict** : recopiés verbatim au §1.5 ci-dessous.
 * - **§1.6 v1 — secondaires S1-S5** : inchangées (accord top-1 différentiel,
 *   regret, TD de B2, tranche équilibrée S4, TD sous bootstrap clusterisé S5),
 *   toujours AUCUN pouvoir de verdict.
 * - **Stats** : `wilson95`, `clusterBootstrapDeltaCI`
 *   (`src/lib/backtest/clusterBootstrap.ts`, cluster = `series.matchId` préfixé
 *   corpus, 1000 resamples, mulberry32, **seed 42**), crédits fractionnaires
 *   déclarés.
 * - **§3 v1 — fuites/fishing** : toutes les neutralisations v1 restent en
 *   vigueur ; le §3 ci-dessous ne traite que les canaux NOUVEAUX du bloc
 *   candidats.
 *
 * **Porte de validité (anti-bug, patron B §1.4) — préalable OBLIGATOIRE au run** :
 *
 * - Le runner v2 expose `--chain v1|v2` (obligatoire, pas de défaut). En
 *   `--chain v1`, il construit le ctx EXACT du runner v1 (ni `allyPlayers` ni
 *   `rolePriors` — le filtre de rôle reste inerte, comme au run v1) et émet le
 *   rapport au FORMAT v1.
 * - **Critère gelé** : `--chain v1 --seed 42 --generated-at
 *   2026-06-11T11:55:20.989Z` sur les 7 corpus et les snapshots sha-vérifiés
 *   régénère `docs/calibration/coach-gate-2026.md` **byte-identique** (diff
 *   vide) — ce qui implique a fortiori le TD publié 51,6 % reproduit à 4
 *   décimales, l'exigence minimale. Diff non vide ⇒ bug du runner v2 ou dérive
 *   d'environnement : corriger, re-passer la porte ; le run v2 ne démarre
 *   qu'après un diff vide.
 * - **Argv gelée (amendement A3)** : le replay `--chain v1` reprend la ligne de
 *   commande du run v1 VERBATIM — mêmes 7 chemins de corpus, MÊME ORDRE, même
 *   orthographe (les clusters sont préfixés par le chemin tel que tapé et
 *   l'ordre des observations conditionne les tirages bootstrap du critère 2 et
 *   de S5) : `static/corpus/lck-2026.json static/corpus/lec-2026.json
 *   static/corpus/lfl-2026.json static/corpus/lpl-2026.json
 *   data/corpus/lec-2025.json data/corpus/lfl-2025.json
 *   data/corpus/lpl-2025.json --dataset data/datasets/current-patch.json
 *   --full-dataset data/datasets/30-days.json --seed 42 --generated-at
 *   2026-06-11T11:55:20.989Z` (l'architecte vérifie cette ligne contre son
 *   historique du run v1 avant gel ; tout écart consigné ; à défaut l'ordre du
 *   rapport fait foi : lck-2026, lec-2026, lfl-2026, lpl-2026, lec-2025,
 *   lfl-2025, lpl-2025 — vérifié conforme aux tables publiées).
 * - Repli documenté : si le diff échoue pour une cause d'ENVIRONNEMENT prouvée
 *   et étrangère au runner (ex. dérive de corpus consignée par un amendement
 *   postérieur), l'architecte ré-exécute le script v1 CONSOMMÉ
 *   (`scripts/backtest/coachGate.ts` TEL QUE COMMITTÉ à `b9aa6d4` — post-W2 :
 *   il importe le harnais `src/lib/backtest/coachGateHarness.ts`, équivalence
 *   byte-prouvée par `tests/coachGateHarness.test.ts`) sur l'état courant ; sa
 *   sortie devient la référence v1 du run #3 (publiée en annexe du rapport v2)
 *   et `--chain v1` doit LA reproduire byte-identique.
 * - **Pré-requis de gel (amendement A1 — SATISFAIT)** : le chantier W2
 *   (extraction harnais) est COMMITTÉ à `b9aa6d4`, son test d'équivalence vert
 *   (`tests/coachGateHarness.test.ts` : le runner v1 re-rend byte-identique
 *   `tests/fixtures/coachgate/expected-report.md` sur la fixture synthétique) ;
 *   `scripts/backtest/coachGate.ts` AU COMMIT `b9aa6d4` est la référence unique
 *   du repli ci-dessus.
 * - Cette porte ne lit AUCUN résultat nouveau : tous les chiffres du replay
 *   sont déjà publiés. Le replay émet aussi `--credits-out` (crédits v1 par
 *   game) — l'entrée de la secondaire S6 (§1.6).
 *
 * ### 1.1 LA seule chose qui change : la chaîne de candidats C_t
 *
 * > Remplace intégralement le bloc « Candidats » de v1 §1.1 (présence-15 sans
 * > roster). Tout est lu du corpus seul, walk-forward ; la fonction shippée
 * > `rankOurCandidates` (`src/lib/intel/liveDraft.ts`) reste LA chaîne — on
 * > change ce qu'on lui INJECTE, jamais sa logique.
 *
 * **Fits par fold (patch k, corpus c) — `train_k` = records de patchs < k du
 * MÊME corpus, identique v1** :
 *
 * - `playerFit_k = fitPlayerHistory(train_k)`
 *   (`src/lib/estimators/playerPockets.ts`) : carrière par joueur — cellules
 *   (champion, rôle) {games, wins, lastDate} des picks résolus portant
 *   `playerId` ET `role` (100 % des picks corpus portent un rôle). **Carrière
 *   du même corpus uniquement** : la carrière cross-ligues de l'esprit
 *   `playerPockets` exigerait de fusionner les timelines de plusieurs fichiers
 *   — on changerait le walk-forward EN PLUS des candidats. Déviation déclarée
 *   (§3.1) ; conséquence assumée : un joueur transféré d'une autre ligue est
 *   « inconnu » → repli compté.
 * - `lineup_k(team) = currentLineup(train_k, teamName, 10)` (paresseux par
 *   équipe, clé `canonicalTeamName`) : le joueur ACTUEL de chaque rôle = le
 *   playerId majoritaire sur les 10 games de train les plus récentes de
 *   l'équipe (`recentGames = 10`, le défaut committé ; départages déterministes
 *   du module : récence puis playerId asc). **Train seulement — la game testée
 *   n'informe JAMAIS son propre lineup.** Rôle sans attribution ⇒ absent de la
 *   Map ; équipe absente du train ⇒ lineup vide.
 * - `leaguePriors_k = rolePriorsOf(fitRolePriors(train_k))`
 *   (`src/lib/aggregates/rolePriors.ts`) : priors de rôle P(rôle | champion) de
 *   la LIGUE — le choix shippé de la page (`+page.svelte` passe les priors de
 *   ligue au coach, pas de layering équipe), version gate : fittés sur
 *   `train_k` (walk-forward strict, plus exigeant que la page qui fitte la
 *   ligue entière — déclaré).
 * - `top15_k` = top-15 présence du train (tri présence desc, clé asc) —
 *   identique v1, conservé comme REPLI.
 *
 * **Au tour scoré t du side s** (game g, équipe `ourTeam` =
 * `record.blueTeam`/`redTeam` selon s, adversaire `enemyTeam`) :
 *
 * 1. `allyPlayers` = pour chaque rôle r ∈ ROLES (ordre canonique) tel que
 *    `lineup_k(ourTeam).get(r) = p` :
 *    `{ id: p, name: p, role: r, pool: championPoolOf(playerFit_k, p) }` —
 *    la forme `ProPlayer` shippée (`src/lib/pro/types.ts`).
 *    `championPoolOf` = les cellules carrière de p agrégées **PAR CHAMPION**
 *    (games et wins sommés sur les rôles ; tri clé asc, pur déterminisme —
 *    `rankOurCandidates` re-trie de toute façon) : la forme
 *    `ChampionPoolEntry {championKey, games, wins}` du roster shippé est par
 *    champion, pas par rôle ; la contrainte de rôle est portée par
 *    `filterByOpenRoles` au niveau champion, exactement comme en production
 *    (et un pocket off-role déjà montré — le cas fondateur Nasus — reste
 *    visible du pool, c'est voulu). Joueur sans cellule ⇒ pool `[]` ;
 *    `allyPlayers` possiblement vide (équipe/lineup inconnus) — toujours
 *    passé, vide inclus.
 * 2. `ctx_t = { ourSide: s, evaluate, table: tables_k(enemyTeam),
 *    allyPlayers, fallbackCandidates: top15_k, rolePriors: leaguePriors_k,
 *    depth: 2, topK: 4, candidateCount: 6 }` — le ctx v1 (ctx du moteur de tour :
 *    HEAD pré-W2 `scripts/backtest/coachGate.ts` l. 589-597 ; depuis `b9aa6d4`
 *    (W2) `src/lib/backtest/coachGateHarness.ts` l. 249-257,
 *    `makeCoachTurnEngine`) PLUS exactement deux injections : `allyPlayers` et
 *    `rolePriors`.
 *    `roleCoverageFloor` non passé ⇒ défaut committé
 *    `DEFAULT_ROLE_COVERAGE_FLOOR = 0.15`.
 * 3. `C_t = rankOurCandidates(ctx_t, S_t, 6).slice(0, 4)` — la fonction shippée
 *    importée telle quelle, JAMAIS répliquée. Sa sémantique committée fait
 *    TOUT, dans cet ordre : pools des joueurs aplatis et triés (tier
 *    `classifyPoolTier` — sans `daysSinceLastPlayed`, le champ n'existe pas sur
 *    `ChampionPoolEntry` : tiers par games bruts, fidèle au shippé — puis games
 *    desc, clé asc), dédoublonnage, filtre pris/disponible, **repli présence
 *    top-up** (`fallbackCandidates` poussés APRÈS les pools — un pool maigre
 *    est complété, jamais remplacé), **contrainte de rôle**
 *    `filterByOpenRoles` (tours de pick seulement — tous les tours scorés le
 *    sont ; rôles ouverts = 5 rôles moins les rôles committés des picks
 *    RÉSOLUS de s dans S_t ; champion inconnu des priors conservé ; garde-fou
 *    liste vidée ⇒ liste non filtrée), troncature à 6 — puis à 4 par la racine
 *    de `navigate`, comme en v1.
 * 4. Les états PROFONDS du lookahead reçoivent la liste racine (les 6) —
 *    identique v1. Évaluation en racine forcée, memo partagé par tour,
 *    identique v1.
 *
 * **Repli total gelé** : équipe inconnue du train, lineup vide, pools vides ou
 * intégralement indisponibles ⇒ la même chaîne dégénère d'elle-même en
 * présence-15 (la chaîne v1) **modulo le filtre de rôle**, qui reste actif —
 * c'est la sémantique shippée post-gate-A (le « v1 strict » sans filtre n'existe
 * plus dans le code de production). Aucun chemin spécial dans le runner : un
 * seul code, le repli est un cas limite compté, pas une branche.
 *
 * **Unité d'attribution déclarée** : le « bloc candidats » entier (pools
 * joueurs + priors de rôle injectés). La décomposition fine pools vs filtre de
 * rôle exigerait un troisième bras (`présence + filtre seul`, +0,67 M appels
 * évaluateur) — option examinée et NON retenue : un seul bras nouveau, moins de
 * surfaces de fishing ; si l'attribution fine devient nécessaire, ce sera une
 * nouvelle règle gelée.
 *
 * ### 1.2 Couverture pré-déclarée (publiée par corpus ET poolée, AUCUN pouvoir)
 *
 * Attendue à déclarer (rien n'est mesuré avant le run — aucun chiffre ici) :
 *
 * 1. **Part des tours scorés avec joueur connu du train** : ≥ 1 joueur du
 *    lineup walk-forward avec pool train non vide — LA stat d'application du
 *    levier ; part des games scorées à lineup complet (5/5), partiel (1-4),
 *    vide.
 * 2. **Taille moyenne du pool** au tour : champions distincts des pools du
 *    lineup (avant filtre disponibilité) ; et taille moyenne par joueur.
 * 3. **Pool-share de C_t** : part des candidats des C_t finaux (≤ 4) issus des
 *    pools vs du repli présence ; part des tours 100 % repli (sur ces tours,
 *    v2 ≡ v1 modulo filtre de rôle — la zone où le levier ne s'applique pas).
 * 4. **Sondes filtre de rôle** : part des tours où `filterByOpenRoles` a
 *    retranché ≥ 1 candidat ; part des tours garde-fou (liste vidée ⇒ non
 *    filtrée) ; sonde anti-inertie : le runner VÉRIFIE que chaque action de
 *    PICK résolue de S_t porte `role` (les bans n'en portent jamais —
 *    `DraftAction.role` est committé picks-only, `src/lib/data/types.ts` ;
 *    sinon le filtre serait silencieusement inerte) ; compteur dédié
 *    `pick-sans-role`, DISTINCT des `anomalies` v1 (qui restent byte-identiques
 *    en `--chain v1`) ; > 0 ⇒ run invalide.
 *    **Mécanique des sondes (fonctions exportées seulement — zéro appel
 *    évaluateur, zéro réplication)** : liste pré-filtre du tour =
 *    `rankOurCandidates({ ...ctx_t, rolePriors: undefined }, S_t,
 *    Number.POSITIVE_INFINITY)` (le `out` shippé complet, filtre inerte sans
 *    priors) ; `kept = filterByOpenRoles(préFiltre, S_t, s, leaguePriors_k,
 *    0.15)` ; « retranché » ssi 0 < |kept| < |préFiltre| ; « garde-fou » ssi
 *    |kept| = 0 ; « tour 100 % repli » ssi C_t ∩ {championKey des pools de
 *    `allyPlayers`} = ∅.
 * 5. **Part des picks réels ∈ C_t** — le diagnostic v1 (18,4 % poolé) : la
 *    stat que le levier doit faire bouger, publiée en regard de la valeur v1.
 * 6. Héritées v1 : games éligibles/scorées, tours écartés par cause (dont
 *    `template-mismatch` et `too-few-comparators` — leurs comptes PEUVENT
 *    bouger avec les nouveaux C_t, même règle d'écartement), distribution
 *    adverse active, détecteur Fearless, anomalies.
 *
 * Lecture pré-engagée (§5) : une couverture faible (joueur connu ou pool-share
 * bas) DILUE le delta v2−v1 — elle conditionne l'INTERPRÉTATION du verdict,
 * jamais le verdict lui-même (critères 1+2 seuls, sur toutes les games scorées,
 * aucune stratification de verdict).
 *
 * ### 1.3 Métrique primaire
 *
 * Identique v1 §1.3, verbatim — seuls les C_t changent (et donc les
 * comparateurs des ρ_t). Rien d'autre.
 *
 * ### 1.4 Baselines
 *
 * Identiques v1 §1.4, verbatim. Précision d'application : B1 et B2 rejouent
 * « mêmes games, mêmes tours, mêmes C_t » — donc les **C_t v2**. B1 reste « le
 * coach qui ne sait que suivre la méta » À CANDIDATS ÉGAUX : battre B1 = montrer
 * que l'ORDRE du coach vaut mieux que l'ordre de présence sur le même panier
 * (les champions de pool et du repli sortent tous du train : leur rang de
 * présence est toujours défini — le cas « absent du train » est VIDE en v2 par
 * construction ; pour mémoire, le runner v1 lui donnerait la valeur partagée
 * −|ordre de présence| : tous les absents à ÉGALITÉ, traitée à ½ par
 * `percentileAmong` — aucun départage clé asc n'existe en B1).
 *
 * ### 1.5 Critères de verdict (gelés — recopiés verbatim de v1 §1.5)
 *
 * - **Critère 1** : borne basse Wilson 95 % du TD poolé > 0,5. Limite
 *   pré-enregistrée : IC Wilson i.i.d. anticonservateur sous corrélation de
 *   série — lecture robuste publiée en S5.
 * - **Critère 2** : delta apparié TD_coach − TD_présence (B1), bootstrap par
 *   CLUSTER de série via `clusterBootstrapDeltaCI` (observations appariées par
 *   game, cluster = `series.matchId` préfixé corpus, 1000 resamples, mulberry32,
 *   **seed 42**) ; IC 95 % du delta strictement > 0.
 * - **VERT** = critère 1 ET critère 2 → gate produit franchie : badge
 *   Expérimental levé sur le panneau Coach, lignes scorecard R9.
 * - **ORANGE** = critère 1 seul → « le coach discrimine, mais pas mieux que le
 *   suivi de méta » : badge conservé, claim limité, levier suivant pré-identifié
 *   (§5).
 * - **ROUGE** = critère 1 non atteint → aucun claim de conseil ; enquête
 *   pré-cadrée (§5), la règle est consommée — pas de retuning.
 *
 * Puissance déclarée : n attendu ≈ 2 250-2 350 games (le n v1 fut 2 275 ; les
 * comptes d'écartement peuvent légèrement bouger avec les C_t v2) ; au seuil
 * n = 2 400, le critère 1 exige TD ≳ 52,0 % (MDE ≈ +2,0 pp). Honnêteté
 * supplémentaire v2 : les tours 100 % repli rapprochent v2 de v1 — l'effet
 * mesurable est dilué par (1 − pool-share) ; un effet réel petit ou une
 * couverture faible sortira « non significatif » et sera publié tel quel.
 *
 * ### 1.6 Secondaires descriptives (pré-enregistrées, AUCUN pouvoir de verdict)
 *
 * - **S1-S5** : identiques v1 §1.6, verbatim (S1 accord top-1 différentiel —
 *   l'« accord navigator » G5 ; S2 regret ; S3 TD de B2 ; S4 tranche
 *   équilibrée ; S5 TD poolé sous bootstrap clusterisé, seed 42). S1 et la part
 *   des picks réels ∈ C_t sont publiées EN REGARD des valeurs v1 (5,7 % ;
 *   18,4 %) — comparaison descriptive du levier.
 * - **S6 — delta apparié v2 − v1 (NOUVELLE, descriptive)** : crédit v2 − crédit
 *   v1 par game, sur l'INTERSECTION des games scorées par les deux chaînes
 *   (appariement par `${corpus}::${gameId}` — même convention de préfixe que
 *   les clusters, collision inter-fichiers exclue par construction ; crédits
 *   v1 = le `--credits-out` du replay de la porte de validité, passé au run v2
 *   via `--v1-credits`) ;
 *   `clusterBootstrapDeltaCI`, mêmes 1000 resamples, même seed 42. C'est
 *   l'attribution chiffrée du bloc candidats — descriptive : elle ne peut ni
 *   sauver un rouge ni invalider un vert.
 * - Couverture §1.2 publiée intégralement.
 *
 * --- FIN DE LA RÈGLE GELÉE ---
 *
 * Run :
 *   node --experimental-transform-types --no-warnings scripts/backtest/coachGateV2.ts \
 *     static/corpus/lck-2026.json [...] data/corpus/lpl-2025.json \
 *     --chain v1|v2 \
 *     --dataset data/datasets/current-patch.json --full-dataset data/datasets/30-days.json \
 *     [--seed 42] [--generated-at ISO] [--out docs/calibration/coach-gate-v2-2026.md] \
 *     [--credits-out data/tmp/coach-credits-<chain>.json] [--v1-credits <json>] [--smoke]
 *
 * `--smoke` : exécute UN corpus (le premier) et n'imprime QUE timing +
 * couverture (aucun taux) — le garde-fou anti-lecture-prématurée.
 * `--chain v1` : ctx v1 EXACT (ni allyPlayers ni rolePriors), writer v1
 * réutilisé à l'octet près — le replay de la porte de validité (§1.0).
 * `--credits-out` : crédits par game {corpus, gameId, cluster, credit,
 * creditB1, creditB2} — sortie mécanique, sans lecture (entrée de S6).
 * `--v1-credits` : crédits du replay v1 — déclenche la secondaire S6.
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
type PlayerChainModule = typeof import('../../src/lib/backtest/coachPlayerChain');
type NavigatorModule = typeof import('../../src/lib/strategic/draftNavigator');
type MetricsModule = typeof import('../../src/lib/backtest/metrics');
type ClusterModule = typeof import('../../src/lib/backtest/clusterBootstrap');
type WalkforwardModule = typeof import('../../src/lib/backtest/walkforward');
type TagsModule = typeof import('../../src/lib/tags');
type LiveDraftModule = typeof import('../../src/lib/intel/liveDraft');
type PlayerPocketsModule = typeof import('../../src/lib/estimators/playerPockets');
type RolePriorsModule = typeof import('../../src/lib/aggregates/rolePriors');
type NormalizeModule = typeof import('../../src/lib/data/normalize');

type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type DraftSide = import('../../src/lib/data/types').DraftSide;
type Dataset = import('../../src/lib/types').Dataset;
type Role = import('../../src/lib/types').Role;
type CoachTurnScore = import('../../src/lib/backtest/coachGate').CoachTurnScore;
type PairedObservation = import('../../src/lib/backtest/clusterBootstrap').PairedObservation;
type PlayerHistoryFit = import('../../src/lib/estimators/playerPockets').PlayerHistoryFit;
type RolePriors = import('../../src/lib/strategic/fogReveal').RolePriors;
type ProPlayer = import('../../src/lib/pro/types').ProPlayer;
type DraftState = import('../../src/lib/strategic/draftNavigator').DraftState;

const { scoreGameForGate, eligibilitySkipOf } = (await import(
    `${libRootHref}/backtest/coachGate.ts`
)) as CoachGateModule;
// Folds/deps : harnais extrait (chantier W2) + seam additif v2 (chantier A3) —
// sans `allyPlayersFor`/`rolePriors`, comportement v1 byte-identique.
const { buildFearlessDetector, makeFoldProvider, makeCoachTurnEngine } = (await import(
    `${libRootHref}/backtest/coachGateHarness.ts`
)) as HarnessModule;
const { lineupProPlayers } = (await import(
    `${libRootHref}/backtest/coachPlayerChain.ts`
)) as PlayerChainModule;
const { makeAnalyzeDraftEvaluator, nextSlotOf } = (await import(
    `${libRootHref}/strategic/draftNavigator.ts`
)) as NavigatorModule;
const { wilson95, mulberry32 } = (await import(`${libRootHref}/backtest/metrics.ts`)) as MetricsModule;
const { clusterBootstrapDeltaCI } = (await import(
    `${libRootHref}/backtest/clusterBootstrap.ts`
)) as ClusterModule;
const { parsePatch, comparePatches } = (await import(
    `${libRootHref}/backtest/walkforward.ts`
)) as WalkforwardModule;
const { loadDefaultTags } = (await import(`${libRootHref}/tags/index.ts`)) as TagsModule;
const { rankOurCandidates, filterByOpenRoles, DEFAULT_ROLE_COVERAGE_FLOOR } = (await import(
    `${libRootHref}/intel/liveDraft.ts`
)) as LiveDraftModule;
const { fitPlayerHistory, currentLineup } = (await import(
    `${libRootHref}/estimators/playerPockets.ts`
)) as PlayerPocketsModule;
const { fitRolePriors, rolePriorsOf } = (await import(
    `${libRootHref}/aggregates/rolePriors.ts`
)) as RolePriorsModule;
const { canonicalTeamName } = (await import(`${libRootHref}/data/normalize.ts`)) as NormalizeModule;

// ---- argv -------------------------------------------------------------------

const inputs: string[] = [];
let chain: 'v1' | 'v2' | undefined;
let datasetPath: string | undefined;
let fullDatasetPath: string | undefined;
let outPath = 'docs/calibration/coach-gate-v2-2026.md';
let creditsOutPath: string | undefined;
let v1CreditsPath: string | undefined;
let seed = 42;
let generatedAt = new Date().toISOString();
let smoke = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--chain') {
        const value = argv[++i];
        if (value === 'v1' || value === 'v2') chain = value;
    } else if (arg === '--dataset') datasetPath = argv[++i];
    else if (arg === '--full-dataset') fullDatasetPath = argv[++i];
    else if (arg === '--out') outPath = argv[++i];
    else if (arg === '--credits-out') creditsOutPath = argv[++i];
    else if (arg === '--v1-credits') v1CreditsPath = argv[++i];
    else if (arg === '--seed') seed = Number(argv[++i]);
    else if (arg === '--generated-at') generatedAt = argv[++i];
    else if (arg === '--smoke') smoke = true;
    else inputs.push(arg);
}
if (
    inputs.length === 0 ||
    chain === undefined ||
    datasetPath === undefined ||
    fullDatasetPath === undefined ||
    Number.isNaN(seed)
) {
    console.error(
        'Usage: node --experimental-transform-types --no-warnings scripts/backtest/coachGateV2.ts ' +
            '<corpus.json> [...] --chain v1|v2 --dataset current-patch.json --full-dataset 30-days.json ' +
            '[--seed 42] [--generated-at ISO] [--out md] [--credits-out json] [--v1-credits json] [--smoke] ' +
            '(--chain est OBLIGATOIRE, pas de défaut — règle §1.0)'
    );
    process.exit(1);
}

// ---- datasets gelés (sha256 + date publiés ; hash gelés §1.0 vérifiés) --------

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

// Hash GELÉS des snapshots du run #2 (§1.0) — « tout écart de hash = arrêt ».
// La vérification est attachée aux CHEMINS de l'argv gelée (les seuls que le
// run réel utilise) : les fixtures synthétiques des tests vivent ailleurs.
const FROZEN_SNAPSHOT_SHA256: Record<string, string> = {
    'data/datasets/current-patch.json': 'ACA91656AF68DFF5016152E947AAFBCEBFB3DFE320CC2781F8FDBE8983FB8869',
    'data/datasets/30-days.json': '6933C7C2D107AFD465E7D8F0C44765305FF8747A187ED54C4C1F73E87651A4B1'
};

const frozenDataset = loadDataset(datasetPath);
const frozenFullDataset = loadDataset(fullDatasetPath);
for (const frozen of [frozenDataset, frozenFullDataset]) {
    const expected = FROZEN_SNAPSHOT_SHA256[frozen.path.replace(/\\/g, '/')];
    if (expected !== undefined && frozen.sha256 !== expected) {
        console.error(
            `coach-gate-v2: écart de hash sur ${frozen.path} — attendu ${expected}, lu ${frozen.sha256}. ` +
                'Arrêt (règle §1.0 : tout écart de hash = arrêt).'
        );
        process.exit(1);
    }
}
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

// ---- folds v2 (chaîne candidats §1.1) : playerFit, lineups, priors de ligue ---
// Mêmes train_k que le harnais (records du MÊME corpus de patch strictement
// antérieur) — fits STRICTEMENT sur le train, patron v1.

interface CoachGateV2Fold {
    playerFit: PlayerHistoryFit;
    lineupFor: (team: string) => Map<Role, string>;
    leaguePriors: RolePriors;
}

function makeV2FoldProvider(records: DraftRecord[]): (patch: string) => CoachGateV2Fold | null {
    const byPatch = new Map<string, CoachGateV2Fold | null>();
    return (patch: string): CoachGateV2Fold | null => {
        const cached = byPatch.get(patch);
        if (cached !== undefined) return cached;
        const train = records.filter(
            (r) =>
                r.patch !== undefined && parsePatch(r.patch) !== undefined && comparePatches(r.patch, patch) < 0
        );
        if (train.length === 0) {
            byPatch.set(patch, null);
            return null;
        }
        const playerFit = fitPlayerHistory(train);
        const leaguePriors = rolePriorsOf(fitRolePriors(train));
        // Lineups paresseux par équipe, clé canonicalTeamName (§1.1).
        const lineups = new Map<string, Map<Role, string>>();
        const lineupFor = (team: string): Map<Role, string> => {
            const key = canonicalTeamName(team);
            let lineup = lineups.get(key);
            if (lineup === undefined) {
                lineup = currentLineup(train, team, 10);
                lineups.set(key, lineup);
            }
            return lineup;
        };
        const fold: CoachGateV2Fold = { playerFit, lineupFor, leaguePriors };
        byPatch.set(patch, fold);
        return fold;
    };
}

// ---- scoring par corpus -------------------------------------------------------

interface GameResult {
    corpus: string;
    gameId: string;
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
    // ---- couverture v2 (§1.2) — comptés en --chain v2 seulement ----
    /** Sonde anti-inertie : picks résolus de S_t SANS rôle (> 0 ⇒ run invalide). */
    pickSansRole: number;
    /** Tours scorés avec ≥ 1 joueur du lineup à pool train non vide. */
    knownPlayerTurns: number;
    /** Sides de games scorées (2 par game) par état de lineup walk-forward. */
    lineupFullSides: number;
    lineupPartialSides: number;
    lineupEmptySides: number;
    /** Σ par tour scoré : champions distincts des pools du lineup. */
    poolDistinctSum: number;
    /** Σ joueurs de lineup et Σ entrées de pool sur les tours scorés. */
    poolPlayerCount: number;
    poolEntriesSum: number;
    /** Pool-share : candidats des C_t finaux issus des pools / total. */
    ctPoolCandidates: number;
    ctTotalCandidates: number;
    /** Tours 100 % repli (C_t ∩ pools = ∅). */
    fullFallbackTurns: number;
    /** Sondes filtre de rôle (mécanique gelée §1.2-4). */
    roleFilterTrimmed: number;
    roleFilterGuard: number;
}

const allGames: GameResult[] = [];
const allCoverage: CorpusCoverage[] = [];

for (const { input, records } of corpora) {
    const startedAt = Date.now();

    // -- détecteur Fearless + folds paresseux par patch : harnais extrait
    //    (src/lib/backtest/coachGateHarness.ts, chantier W2 — à l'identique).
    const detector = buildFearlessDetector(records);
    const foldFor = makeFoldProvider(records, generatedAt);
    const v2FoldFor = makeV2FoldProvider(records);

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
        detectorReused: detector.reused,
        detectorExamined: detector.examined,
        lockoutsOn: detector.lockoutsOn,
        evaluatedNodes: 0,
        seconds: 0,
        pickSansRole: 0,
        knownPlayerTurns: 0,
        lineupFullSides: 0,
        lineupPartialSides: 0,
        lineupEmptySides: 0,
        poolDistinctSum: 0,
        poolPlayerCount: 0,
        poolEntriesSum: 0,
        ctPoolCandidates: 0,
        ctTotalCandidates: 0,
        fullFallbackTurns: 0,
        roleFilterTrimmed: 0,
        roleFilterGuard: 0
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

        // -- chaîne selon --chain (§1.1) : v1 = ctx v1 EXACT (aucune injection) ;
        //    v2 = + allyPlayers (lineupProPlayers, toujours passé, vide inclus)
        //    et + rolePriors de ligue — les DEUX seules injections.
        const v2fold = chain === 'v2' ? v2FoldFor(record.patch) : null;
        if (chain === 'v2' && v2fold === null) {
            // Impossible : même définition de train que foldFor (non null ici).
            throw new Error(`coach-gate-v2: fold v2 absent sur ${record.gameId}`);
        }
        const allyPlayersBySide = new Map<DraftSide, ProPlayer[]>();
        const allyPlayersOf = (side: DraftSide): ProPlayer[] => {
            let players = allyPlayersBySide.get(side);
            if (players === undefined) {
                const team = side === 'blue' ? record.blueTeam : record.redTeam;
                players = lineupProPlayers(v2fold!.playerFit, v2fold!.lineupFor(team));
                allyPlayersBySide.set(side, players);
            }
            return players;
        };

        // Univers − lockouts, caches par tour, deps modèle (navigate
        // racine-forcée) : moteur du harnais, à l'identique du code v1 —
        // seam additif v2 injecté en --chain v2 seulement.
        const engine = makeCoachTurnEngine(record, {
            fold,
            locked: detector.lockedFor(record),
            tagsKeys,
            evaluate,
            ...(chain === 'v2' ? { allyPlayersFor: allyPlayersOf, rolePriors: v2fold!.leaguePriors } : {})
        });

        const modelResult = scoreGameForGate(record, engine.modelDeps);
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
            availableOf: engine.availableOf,
            candidatesOf: engine.candidatesOf,
            valueOf: (_state, _slot, championKey) =>
                fold.presenceValue.get(championKey) ?? -fold.presenceOrder.length
        });
        const b2Result = scoreGameForGate(record, {
            availableOf: engine.availableOf,
            candidatesOf: engine.candidatesOf,
            valueOf: (_state, _slot, championKey) => echoValueOf(championKey)
        });
        if ('skipped' in b1Result || 'skipped' in b2Result) {
            // Impossible par construction (mêmes tours quel que soit valueOf).
            throw new Error(`coach-gate-v2: baseline désynchronisée sur ${record.gameId}`);
        }

        // Couverture par tour scoré : distribution adverse active (premier nœud
        // du lookahead après le pick réel) + pick réel déjà dans C_t.
        for (const turn of modelResult.score.turns) {
            coverage.scoredTurns += 1;
            const realKey = engine.realPickKeyAt(turn.seq);
            const ct = engine.ctOf(turn.seq);
            if (realKey !== undefined && ct !== undefined && ct.includes(realKey)) {
                coverage.realInCt += 1;
            }
            if (engine.adverseActiveAt(turn.seq, turn.side)) coverage.adverseActive += 1;
        }
        coverage.evaluatedNodes += engine.evaluatedNodes;

        // ---- couverture v2 (§1.2) : sondes mécaniques, AUCUN appel évaluateur ----
        if (chain === 'v2') {
            // Sides de games scorées par état de lineup (2 sides par game).
            for (const side of ['blue', 'red'] as const) {
                const team = side === 'blue' ? record.blueTeam : record.redTeam;
                const size = v2fold!.lineupFor(team).size;
                if (size === 5) coverage.lineupFullSides += 1;
                else if (size > 0) coverage.lineupPartialSides += 1;
                else coverage.lineupEmptySides += 1;
            }

            const resolvedActions = record.actions
                .filter((a) => a.championKey !== '')
                .sort((a, b) => a.seq - b.seq);
            // Sonde anti-inertie (§1.2-4) : l'union des S_t des tours scorés =
            // picks résolus de seq < max(seq scoré) — chacun doit porter `role`.
            const maxScoredSeq = Math.max(...modelResult.score.turns.map((t) => t.seq));
            for (const action of resolvedActions) {
                if (action.type === 'pick' && action.seq < maxScoredSeq && action.role === undefined) {
                    coverage.pickSansRole += 1;
                }
            }

            for (const turn of modelResult.score.turns) {
                const allyPlayers = allyPlayersOf(turn.side);
                const poolKeys = new Set<string>(
                    allyPlayers.flatMap((p) => p.pool.map((entry) => entry.championKey))
                );
                if (allyPlayers.some((p) => p.pool.length > 0)) coverage.knownPlayerTurns += 1;
                coverage.poolDistinctSum += poolKeys.size;
                coverage.poolPlayerCount += allyPlayers.length;
                coverage.poolEntriesSum += allyPlayers.reduce((acc, p) => acc + p.pool.length, 0);

                const ct = engine.ctOf(turn.seq) ?? [];
                let fromPools = 0;
                for (const key of ct) if (poolKeys.has(key)) fromPools += 1;
                coverage.ctPoolCandidates += fromPools;
                coverage.ctTotalCandidates += ct.length;
                if (fromPools === 0) coverage.fullFallbackTurns += 1;

                // Sondes filtre de rôle (mécanique gelée §1.2-4) : S_t rebâti
                // comme la lib (révélés soustraits, pick réel ré-ajouté), ctx_t
                // = le cache EXACT du tour (turnEntryOf, déjà construit).
                const prior = resolvedActions.filter((a) => a.seq < turn.seq);
                const revealed = new Set<string>(prior.map((a) => a.championKey));
                const available = new Set<string>(engine.availableOf(revealed));
                for (const key of revealed) available.delete(key);
                const realKey = engine.realPickKeyAt(turn.seq);
                if (realKey !== undefined) available.add(realKey);
                const state: DraftState = {
                    actions: prior,
                    firstPickSide: record.firstPickSide,
                    available
                };
                const slot = nextSlotOf(state);
                if (slot === null) continue; // jamais sur un tour scoré
                const entry = engine.turnEntryOf(state, slot);
                const preFilter = rankOurCandidates(
                    { ...entry.ctx, rolePriors: undefined },
                    state,
                    Number.POSITIVE_INFINITY
                );
                const kept = filterByOpenRoles(
                    preFilter,
                    state,
                    turn.side,
                    v2fold!.leaguePriors,
                    DEFAULT_ROLE_COVERAGE_FLOOR
                );
                if (kept.length === 0) coverage.roleFilterGuard += 1;
                else if (kept.length < preFilter.length) coverage.roleFilterTrimmed += 1;
            }
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
            gameId: record.gameId,
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
            `[coach-gate-v2] ${input} : ${coverage.scored} games scorées en ${coverage.seconds.toFixed(1)} s`
        );
    }
}

const totalPickSansRole = allCoverage.reduce((acc, c) => acc + c.pickSansRole, 0);

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
        if (chain === 'v2') {
            console.log(
                `[smoke] couverture v2 (comptes) : pick-sans-role ${c.pickSansRole} · ` +
                    `tours joueur connu ${c.knownPlayerTurns}/${c.scoredTurns} · ` +
                    `sides lineup 5/5 ${c.lineupFullSides} · partiel ${c.lineupPartialSides} · vide ${c.lineupEmptySides}`
            );
            console.log(
                `[smoke] pools (comptes) : candidats C_t issus des pools ${c.ctPoolCandidates}/${c.ctTotalCandidates} · ` +
                    `tours intégralement repli ${c.fullFallbackTurns} · Σ champions distincts ${c.poolDistinctSum} · ` +
                    `Σ entrées ${c.poolEntriesSum} sur Σ joueurs ${c.poolPlayerCount}`
            );
            console.log(
                `[smoke] filtre de rôle (comptes) : retranché ${c.roleFilterTrimmed} · garde-fou ${c.roleFilterGuard}`
            );
        }
        console.log(`[smoke] nœuds navigate évalués ${c.evaluatedNodes}`);
        console.log(`[smoke] durée ${c.seconds.toFixed(1)} s`);
    }
    if (chain === 'v2' && totalPickSansRole > 0) {
        console.error(`[smoke] RUN INVALIDE : pick-sans-role ${totalPickSansRole} > 0 (règle §1.2-4).`);
        process.exit(1);
    }
    process.exit(0);
}

// ---- crédits par game (--credits-out) : sortie mécanique, sans lecture --------

interface CreditRow {
    corpus: string;
    gameId: string;
    cluster: string;
    credit: number;
    creditB1: number;
    creditB2: number;
}

if (creditsOutPath !== undefined) {
    const credits: CreditRow[] = allGames.map((g) => ({
        corpus: g.corpus,
        gameId: g.gameId,
        cluster: g.cluster,
        credit: g.credit,
        creditB1: g.creditB1,
        creditB2: g.creditB2
    }));
    const absCredits = resolve(repoRoot, creditsOutPath);
    mkdirSync(dirname(absCredits), { recursive: true });
    writeFileSync(absCredits, JSON.stringify(credits, null, 4) + '\n', 'utf8');
    console.error(`[coach-gate-v2] crédits (${credits.length} games) écrits : ${absCredits}`);
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

// ---- S6 (v2, descriptive) : delta apparié v2 − v1 sur l'intersection ----------

let s6: ReturnType<typeof clusterBootstrapDeltaCI> | null = null;
let s6Matched = 0;
if (v1CreditsPath !== undefined) {
    const v1Credits = JSON.parse(
        readFileSync(resolve(repoRoot, v1CreditsPath), 'utf8')
    ) as CreditRow[];
    const v1ByKey = new Map<string, CreditRow>(v1Credits.map((r) => [`${r.corpus}::${r.gameId}`, r]));
    const obsS6: PairedObservation[] = [];
    for (const g of allGames) {
        const v1Row = v1ByKey.get(`${g.corpus}::${g.gameId}`);
        if (v1Row === undefined) continue;
        obsS6.push({ cluster: g.cluster, model: g.credit, baseline: v1Row.credit });
    }
    s6Matched = obsS6.length;
    s6 = clusterBootstrapDeltaCI(obsS6, { iterations: 1000, rng: mulberry32(seed) });
}

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
// `--chain v1` : writer v1 réutilisé à l'OCTET près (porte de validité §1.0) —
// titre/en-tête v1 EXACTS, aucune section nouvelle.
// `--chain v2` : writer v1 + sections nouvelles (S6, couverture v2 §1.2).

const isV2 = chain === 'v2';

const rows: string[] = [
    ...(isV2
        ? [
              '# Gate COACH v2 — candidats par pools joueurs réels (run #3, chantier A3)',
              '',
              `> Généré : ${generatedAt} · seed ${seed} · \`--chain v2\` · règle pré-enregistrée recopiée verbatim dans`,
              '> l\'en-tête de `scripts/backtest/coachGateV2.ts` (gel : `docs/run3/A3-coach-player-pools.md` §1 — UNE règle, UN run).',
              `> Datasets DraftGap gelés : \`${basename(frozenDataset.path)}\` sha256 \`${frozenDataset.sha256}\` (date ${frozenDataset.data.date}) ·`,
              `> \`${basename(frozenFullDataset.path)}\` sha256 \`${frozenFullDataset.sha256}\` (date ${frozenFullDataset.data.date}).`
          ]
        : [
              '# Gate COACH — postdiction « conseil suivi » (run #2, chantier A)',
              '',
              `> Généré : ${generatedAt} · seed ${seed} · règle pré-enregistrée recopiée verbatim dans`,
              '> l\'en-tête de `scripts/backtest/coachGate.ts` (gel : `docs/run2/A-coach-gate.md` §1 — UNE règle, UN run).',
              `> Datasets DraftGap gelés : \`${basename(frozenDataset.path)}\` sha256 \`${frozenDataset.sha256}\` (date ${frozenDataset.data.date}) ·`,
              `> \`${basename(frozenFullDataset.path)}\` sha256 \`${frozenFullDataset.sha256}\` (date ${frozenFullDataset.data.date}).`
          ]),
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
        : 'TD — (aucune game scorée).'
];

if (isV2) {
    rows.push(
        '',
        '### S6 — delta apparié v2 − v1 (descriptive, §1.6 — AUCUN pouvoir de verdict)',
        '',
        'Crédit v2 − crédit v1 par game, sur l\'INTERSECTION des games scorées par les deux',
        'chaînes (appariement par `${corpus}::${gameId}` — même convention de préfixe que les',
        'clusters ; crédits v1 = le `--credits-out` du replay de la porte de validité, passé',
        'via `--v1-credits`). L\'attribution chiffrée du bloc candidats — descriptive : elle ne',
        'peut ni sauver un rouge ni invalider un vert.',
        '',
        v1CreditsPath === undefined
            ? 'Non calculée — `--v1-credits` absent (le run final le passe, plan §4-6).'
            : s6 !== null && s6Matched > 0
              ? `Δ v2 − v1 : ${pp(s6.delta)} pp · IC 95 % bootstrap clusterisé [${pp(s6.ci95.lo)} ; ${pp(s6.ci95.hi)}] pp (${s6.clusters} clusters, ${s6Matched} games appariées sur ${n} scorées v2, 1000 resamples, seed ${seed}).`
              : 'Intersection vide — aucune game appariée entre les deux chaînes.'
    );
}

rows.push('', '## Couverture', '');

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

if (isV2) {
    const ratio = (a: number, b: number): string => `${a}/${b}${b > 0 ? ` (${pct(a / b)} %)` : ''}`;
    const avg = (total: number, count: number): string => (count > 0 ? (total / count).toFixed(1) : '—');
    const v2CoverageLine = (label: string, c: Omit<CorpusCoverage, 'input'> | CorpusCoverage): string =>
        `- ${label} : tours avec ≥ 1 joueur du lineup à pool train non vide ${ratio(c.knownPlayerTurns, c.scoredTurns)} · ` +
        `sides de games scorées (2 par game) : lineup 5/5 ${c.lineupFullSides}, partiel (1-4) ${c.lineupPartialSides}, vide ${c.lineupEmptySides} · ` +
        `taille moyenne du pool au tour : ${avg(c.poolDistinctSum, c.scoredTurns)} champions distincts (${avg(c.poolEntriesSum, c.poolPlayerCount)} entrées par joueur) · ` +
        `pool-share de C_t : ${ratio(c.ctPoolCandidates, c.ctTotalCandidates)} candidats issus des pools · ` +
        `tours 100 % repli ${ratio(c.fullFallbackTurns, c.scoredTurns)} · ` +
        `filtre de rôle : retranché ≥ 1 candidat ${ratio(c.roleFilterTrimmed, c.scoredTurns)}, garde-fou (liste vidée) ${ratio(c.roleFilterGuard, c.scoredTurns)} · ` +
        `pick-sans-role ${c.pickSansRole}.`;

    const pooled = allCoverage.reduce(
        (acc, c) => ({
            ...acc,
            scoredTurns: acc.scoredTurns + c.scoredTurns,
            realInCt: acc.realInCt + c.realInCt,
            pickSansRole: acc.pickSansRole + c.pickSansRole,
            knownPlayerTurns: acc.knownPlayerTurns + c.knownPlayerTurns,
            lineupFullSides: acc.lineupFullSides + c.lineupFullSides,
            lineupPartialSides: acc.lineupPartialSides + c.lineupPartialSides,
            lineupEmptySides: acc.lineupEmptySides + c.lineupEmptySides,
            poolDistinctSum: acc.poolDistinctSum + c.poolDistinctSum,
            poolPlayerCount: acc.poolPlayerCount + c.poolPlayerCount,
            poolEntriesSum: acc.poolEntriesSum + c.poolEntriesSum,
            ctPoolCandidates: acc.ctPoolCandidates + c.ctPoolCandidates,
            ctTotalCandidates: acc.ctTotalCandidates + c.ctTotalCandidates,
            fullFallbackTurns: acc.fullFallbackTurns + c.fullFallbackTurns,
            roleFilterTrimmed: acc.roleFilterTrimmed + c.roleFilterTrimmed,
            roleFilterGuard: acc.roleFilterGuard + c.roleFilterGuard
        }),
        {
            ...allCoverage[0],
            scoredTurns: 0,
            realInCt: 0,
            pickSansRole: 0,
            knownPlayerTurns: 0,
            lineupFullSides: 0,
            lineupPartialSides: 0,
            lineupEmptySides: 0,
            poolDistinctSum: 0,
            poolPlayerCount: 0,
            poolEntriesSum: 0,
            ctPoolCandidates: 0,
            ctTotalCandidates: 0,
            fullFallbackTurns: 0,
            roleFilterTrimmed: 0,
            roleFilterGuard: 0
        }
    );

    rows.push('', '## Couverture v2 — pools joueurs (§1.2, descriptive, AUCUN pouvoir)', '');
    rows.push(v2CoverageLine('TOUS corpus', pooled));
    for (const c of allCoverage) rows.push(v2CoverageLine(basename(c.input), c));
    rows.push(
        '',
        `Pick réel ∈ C_t poolé : ${ratio(pooled.realInCt, pooled.scoredTurns)} — publié en regard du v1` +
            ' (18,4 % poolé ; S1 v1 : 5,7 % — `docs/calibration/coach-gate-2026.md`).',
        '',
        `Sonde anti-inertie (§1.2-4) : pick-sans-role total ${pooled.pickSansRole} — ` +
            `${pooled.pickSansRole === 0 ? 'OK (0 exigé).' : 'RUN INVALIDE (> 0).'}`
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

if (isV2 && totalPickSansRole > 0) {
    console.error(
        `coach-gate-v2: RUN INVALIDE — pick-sans-role total ${totalPickSansRole} > 0 (règle §1.2-4).`
    );
    process.exit(1);
}
