# Gate COACH v2 — candidats par POOLS JOUEURS RÉELS — Design run #3 (chantier A3)

> DESIGN soumis à revue adversariale — gel au commit qui suit la revue. Après
> gel : UNE règle, UN run, aucun paramètre ne bouge après lecture du moindre
> résultat.

> La v1 (`docs/run2/A-coach-gate.md`, gelée 2026-06-11) est **CONSOMMÉE** —
> verdict ROUGE publié tel quel (`docs/calibration/coach-gate-2026.md`) :
> TD poolé 51,6 % [49,5 ; 53,7], Δ vs B1 +0,92 pp [−1,72 ; +3,64] ns. Les
> diagnostics du rapport pointent la chaîne de candidats comme suspect n°1 :
> **accord top-1 5,7 %** (S1) et **18,4 % seulement des picks réels dans C_t**
> (4 171/22 703 tours poolés, 15-23 % selon corpus) — le coach v1 classait
> presque toujours des candidats que les équipes n'envisageaient même pas
> (présence de ligue, sans contrainte de rôle ni de joueur). C'est aussi le
> levier pré-identifié au §5-ORANGE de la v1 (« pools joueurs réels ») et
> l'item n°3 de la file post-run (`docs/STATUS.md`).
>
> **Principe directeur (patron B §1.4 : « une seule chose change = attribution
> propre »)** : la v2 reprend la v1 VERBATIM — évaluateur, recherche
> (depth 2 / topK 4 / `picksOnly: false`), walk-forward, éligibilité, métrique
> TD/crédits, baselines B1 présence + B2 écho, critères 1+2, secondaires
> S1-S5, lockouts Fearless, seed 42, les 7 mêmes corpus — et ne réécrit que
> **le bloc CANDIDATS** (§1.1) : candidats = pool du JOUEUR au slot, lus du
> corpus seul (`fitPlayerHistory`/`currentLineup`, walk-forward), repli gelé
> présence-15, contrainte de rôle (`filterByOpenRoles`, floor 0,15 committé).
> Une **porte de validité** anti-bug (§1.0) exige que le runner v2, ramené aux
> candidats v1, reproduise le rapport publié à l'identique AVANT le run.

---

## 1. Règle pré-enregistrée

> Le bloc §1 est rédigé pour être recopié tel quel dans l'en-tête de
> `scripts/backtest/coachGateV2.ts` et committé AVANT tout run.

### 1.0 Héritage v1 (verbatim) et porte de validité

**Hérité de la v1 sans AUCUN changement** — la v2 cite `docs/run2/A-coach-gate.md`
section par section au lieu de la réécrire ; en cas de doute, le texte v1 fait foi :

- **§1.1 v1 — le coach mesuré** : même évaluateur
  `makeAnalyzeDraftEvaluator({ dataset, fullDataset }, { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 })`,
  mêmes snapshots DraftGap GELÉS du run #2 — `current-patch.json` sha256
  `ACA91656AF68DFF5016152E947AAFBCEBFB3DFE320CC2781F8FDBE8983FB8869`
  (2026-06-10T15:27:33.873Z) et `30-days.json` sha256
  `6933C7C2D107AFD465E7D8F0C44765305FF8747A187ED54C4C1F73E87651A4B1`
  (2026-06-10T15:27:53.230Z), re-hashés et publiés par le runner (tout écart
  de hash = arrêt) ; même `navigate` depth 2 / topK 4, `picksOnly: false`
  gelé, mêmes nœuds de ban, même distribution adverse
  (`enemyDistributionOf` importée, `buildTendencyTable` α = 5, λ = 0,9/semaine,
  `now_k` = plus ancienne date du patch testé, repli `--generated-at`).
- **§1.2 v1 — walk-forward et éligibilité** : walk-forward par patch PAR
  CORPUS, minTrainSize = 1, mêmes **7 corpus**
  (`static/corpus/{lck,lec,lfl,lpl}-2026.json` +
  `data/corpus/{lec,lfl,lpl}-2025.json`, 2 661 drafts, état UNIQUE amendé
  `docs/run2/AMENDEMENT-corpus-20260611.md`). `lck-2025.json` reste HORS run :
  (a) la porte de validité exige l'identité game à game avec le run v1 ;
  (b) il demeure le corpus de réplication étiqueté — même règle, rapport
  séparé, comme en v1. Mêmes lockouts Fearless data-driven (détecteur
  recalculé et publié ; mesure v1 : seul lfl-2025 → OFF), même éligibilité de
  game et de tour (template-mismatch, ≥ 2 comparateurs, ≥ 4 tours par side).
- **§1.3 v1 — métrique primaire** : re-ranking apparié vainqueur-perdant
  inchangé — ρ_t (égalités à ½, |C_t \ {réel}| ≥ 2), R(g, s), crédit 1/½/0,
  TD = Σ crédits / n, Wilson 95 %, poolé + par corpus. Le pick réel est évalué
  par la racine forcée, jamais comme signal.
- **§1.4 v1 — baselines** : B0 hasard 0,5 ; **B1 coach-présence (baseline
  ACTIVE)** — mêmes games, mêmes tours, **mêmes C_t** (donc les C_t v2),
  v remplacé par −rang dans l'ordre total (présence du train desc, clé asc ;
  absent du train = dernier) ; **B2 écho-dataset (contrôle descriptif)** —
  Σ_rôles wins / Σ_rôles games du snapshot gelé, 0 si absent, tie-break clé
  asc.
- **§1.5 v1 — critères de verdict** : recopiés verbatim au §1.5 ci-dessous.
- **§1.6 v1 — secondaires S1-S5** : inchangées (accord top-1 différentiel,
  regret, TD de B2, tranche équilibrée S4, TD sous bootstrap clusterisé S5),
  toujours AUCUN pouvoir de verdict.
- **Stats** : `wilson95`, `clusterBootstrapDeltaCI`
  (`src/lib/backtest/clusterBootstrap.ts`, cluster = `series.matchId` préfixé
  corpus, 1000 resamples, mulberry32, **seed 42**), crédits fractionnaires
  déclarés.
- **§3 v1 — fuites/fishing** : toutes les neutralisations v1 restent en
  vigueur ; le §3 ci-dessous ne traite que les canaux NOUVEAUX du bloc
  candidats.

**Porte de validité (anti-bug, patron B §1.4) — préalable OBLIGATOIRE au run** :

- Le runner v2 expose `--chain v1|v2` (obligatoire, pas de défaut). En
  `--chain v1`, il construit le ctx EXACT du runner v1 (ni `allyPlayers` ni
  `rolePriors` — le filtre de rôle reste inerte, comme au run v1) et émet le
  rapport au FORMAT v1.
- **Critère gelé** : `--chain v1 --seed 42 --generated-at
  2026-06-11T11:55:20.989Z` sur les 7 corpus et les snapshots sha-vérifiés
  régénère `docs/calibration/coach-gate-2026.md` **byte-identique** (diff
  vide) — ce qui implique a fortiori le TD publié 51,6 % reproduit à 4
  décimales, l'exigence minimale. Diff non vide ⇒ bug du runner v2 ou dérive
  d'environnement : corriger, re-passer la porte ; le run v2 ne démarre
  qu'après un diff vide.
- Repli documenté : si le diff échoue pour une cause d'ENVIRONNEMENT prouvée
  et étrangère au runner (ex. dérive de corpus consignée par un amendement
  postérieur), l'architecte ré-exécute le script v1 CONSOMMÉ
  (`scripts/backtest/coachGate.ts`, inchangé) sur l'état courant ; sa sortie
  devient la référence v1 du run #3 (publiée en annexe du rapport v2) et
  `--chain v1` doit LA reproduire byte-identique.
- Cette porte ne lit AUCUN résultat nouveau : tous les chiffres du replay
  sont déjà publiés. Le replay émet aussi `--credits-out` (crédits v1 par
  game) — l'entrée de la secondaire S6 (§1.6).

### 1.1 LA seule chose qui change : la chaîne de candidats C_t

> Remplace intégralement le bloc « Candidats » de v1 §1.1 (présence-15 sans
> roster). Tout est lu du corpus seul, walk-forward ; la fonction shippée
> `rankOurCandidates` (`src/lib/intel/liveDraft.ts`) reste LA chaîne — on
> change ce qu'on lui INJECTE, jamais sa logique.

**Fits par fold (patch k, corpus c) — `train_k` = records de patchs < k du
MÊME corpus, identique v1** :

- `playerFit_k = fitPlayerHistory(train_k)`
  (`src/lib/estimators/playerPockets.ts`) : carrière par joueur — cellules
  (champion, rôle) {games, wins, lastDate} des picks résolus portant
  `playerId` ET `role` (100 % des picks corpus portent un rôle). **Carrière
  du même corpus uniquement** : la carrière cross-ligues de l'esprit
  `playerPockets` exigerait de fusionner les timelines de plusieurs fichiers
  — on changerait le walk-forward EN PLUS des candidats. Déviation déclarée
  (§3.1) ; conséquence assumée : un joueur transféré d'une autre ligue est
  « inconnu » → repli compté.
- `lineup_k(team) = currentLineup(train_k, teamName, 10)` (paresseux par
  équipe, clé `canonicalTeamName`) : le joueur ACTUEL de chaque rôle = le
  playerId majoritaire sur les 10 games de train les plus récentes de
  l'équipe (`recentGames = 10`, le défaut committé ; départages déterministes
  du module : récence puis playerId asc). **Train seulement — la game testée
  n'informe JAMAIS son propre lineup.** Rôle sans attribution ⇒ absent de la
  Map ; équipe absente du train ⇒ lineup vide.
- `leaguePriors_k = rolePriorsOf(fitRolePriors(train_k))`
  (`src/lib/aggregates/rolePriors.ts`) : priors de rôle P(rôle | champion) de
  la LIGUE — le choix shippé de la page (`+page.svelte` passe les priors de
  ligue au coach, pas de layering équipe), version gate : fittés sur
  `train_k` (walk-forward strict, plus exigeant que la page qui fitte la
  ligue entière — déclaré).
- `top15_k` = top-15 présence du train (tri présence desc, clé asc) —
  identique v1, conservé comme REPLI.

**Au tour scoré t du side s** (game g, équipe `ourTeam` =
`record.blueTeam`/`redTeam` selon s, adversaire `enemyTeam`) :

1. `allyPlayers` = pour chaque rôle r ∈ ROLES (ordre canonique) tel que
   `lineup_k(ourTeam).get(r) = p` :
   `{ id: p, name: p, role: r, pool: championPoolOf(playerFit_k, p) }` —
   la forme `ProPlayer` shippée (`src/lib/pro/types.ts`).
   `championPoolOf` = les cellules carrière de p agrégées **PAR CHAMPION**
   (games et wins sommés sur les rôles ; tri clé asc, pur déterminisme —
   `rankOurCandidates` re-trie de toute façon) : la forme
   `ChampionPoolEntry {championKey, games, wins}` du roster shippé est par
   champion, pas par rôle ; la contrainte de rôle est portée par
   `filterByOpenRoles` au niveau champion, exactement comme en production
   (et un pocket off-role déjà montré — le cas fondateur Nasus — reste
   visible du pool, c'est voulu). Joueur sans cellule ⇒ pool `[]` ;
   `allyPlayers` possiblement vide (équipe/lineup inconnus) — toujours
   passé, vide inclus.
2. `ctx_t = { ourSide: s, evaluate, table: tables_k(enemyTeam),
   allyPlayers, fallbackCandidates: top15_k, rolePriors: leaguePriors_k,
   depth: 2, topK: 4, candidateCount: 6 }` — le ctx v1 (runner v1, l. 590-597)
   PLUS exactement deux injections : `allyPlayers` et `rolePriors`.
   `roleCoverageFloor` non passé ⇒ défaut committé
   `DEFAULT_ROLE_COVERAGE_FLOOR = 0.15`.
3. `C_t = rankOurCandidates(ctx_t, S_t, 6).slice(0, 4)` — la fonction shippée
   importée telle quelle, JAMAIS répliquée. Sa sémantique committée fait
   TOUT, dans cet ordre : pools des joueurs aplatis et triés (tier
   `classifyPoolTier` — sans `daysSinceLastPlayed`, le champ n'existe pas sur
   `ChampionPoolEntry` : tiers par games bruts, fidèle au shippé — puis games
   desc, clé asc), dédoublonnage, filtre pris/disponible, **repli présence
   top-up** (`fallbackCandidates` poussés APRÈS les pools — un pool maigre
   est complété, jamais remplacé), **contrainte de rôle**
   `filterByOpenRoles` (tours de pick seulement — tous les tours scorés le
   sont ; rôles ouverts = 5 rôles moins les rôles committés des picks
   RÉSOLUS de s dans S_t ; champion inconnu des priors conservé ; garde-fou
   liste vidée ⇒ liste non filtrée), troncature à 6 — puis à 4 par la racine
   de `navigate`, comme en v1.
4. Les états PROFONDS du lookahead reçoivent la liste racine (les 6) —
   identique v1. Évaluation en racine forcée, memo partagé par tour,
   identique v1.

**Repli total gelé** : équipe inconnue du train, lineup vide, pools vides ou
intégralement indisponibles ⇒ la même chaîne dégénère d'elle-même en
présence-15 (la chaîne v1) **modulo le filtre de rôle**, qui reste actif —
c'est la sémantique shippée post-gate-A (le « v1 strict » sans filtre n'existe
plus dans le code de production). Aucun chemin spécial dans le runner : un
seul code, le repli est un cas limite compté, pas une branche.

**Unité d'attribution déclarée** : le « bloc candidats » entier (pools
joueurs + priors de rôle injectés). La décomposition fine pools vs filtre de
rôle exigerait un troisième bras (`présence + filtre seul`, +0,67 M appels
évaluateur) — option examinée et NON retenue : un seul bras nouveau, moins de
surfaces de fishing ; si l'attribution fine devient nécessaire, ce sera une
nouvelle règle gelée.

### 1.2 Couverture pré-déclarée (publiée par corpus ET poolée, AUCUN pouvoir)

Attendue à déclarer (rien n'est mesuré avant le run — aucun chiffre ici) :

1. **Part des tours scorés avec joueur connu du train** : ≥ 1 joueur du
   lineup walk-forward avec pool train non vide — LA stat d'application du
   levier ; part des games scorées à lineup complet (5/5), partiel (1-4),
   vide.
2. **Taille moyenne du pool** au tour : champions distincts des pools du
   lineup (avant filtre disponibilité) ; et taille moyenne par joueur.
3. **Pool-share de C_t** : part des candidats des C_t finaux (≤ 4) issus des
   pools vs du repli présence ; part des tours 100 % repli (sur ces tours,
   v2 ≡ v1 modulo filtre de rôle — la zone où le levier ne s'applique pas).
4. **Sondes filtre de rôle** : part des tours où `filterByOpenRoles` a
   retranché ≥ 1 candidat ; part des tours garde-fou (liste vidée ⇒ non
   filtrée) ; sonde anti-inertie : le runner VÉRIFIE que les actions de S_t
   portent `role` (sinon le filtre serait silencieusement inerte — anomalie
   comptée, run invalide si > 0).
5. **Part des picks réels ∈ C_t** — le diagnostic v1 (18,4 % poolé) : la
   stat que le levier doit faire bouger, publiée en regard de la valeur v1.
6. Héritées v1 : games éligibles/scorées, tours écartés par cause (dont
   `template-mismatch` et `too-few-comparators` — leurs comptes PEUVENT
   bouger avec les nouveaux C_t, même règle d'écartement), distribution
   adverse active, détecteur Fearless, anomalies.

Lecture pré-engagée (§5) : une couverture faible (joueur connu ou pool-share
bas) DILUE le delta v2−v1 — elle conditionne l'INTERPRÉTATION du verdict,
jamais le verdict lui-même (critères 1+2 seuls, sur toutes les games scorées,
aucune stratification de verdict).

### 1.3 Métrique primaire

Identique v1 §1.3, verbatim — seuls les C_t changent (et donc les
comparateurs des ρ_t). Rien d'autre.

### 1.4 Baselines

Identiques v1 §1.4, verbatim. Précision d'application : B1 et B2 rejouent
« mêmes games, mêmes tours, mêmes C_t » — donc les **C_t v2**. B1 reste « le
coach qui ne sait que suivre la méta » À CANDIDATS ÉGAUX : battre B1 = montrer
que l'ORDRE du coach vaut mieux que l'ordre de présence sur le même panier
(les champions de pool sortent du train : leur rang de présence est défini ;
absent du top = présence 0, clé asc départage — la règle v1 couvre le cas).

### 1.5 Critères de verdict (gelés — recopiés verbatim de v1 §1.5)

- **Critère 1** : borne basse Wilson 95 % du TD poolé > 0,5. Limite
  pré-enregistrée : IC Wilson i.i.d. anticonservateur sous corrélation de
  série — lecture robuste publiée en S5.
- **Critère 2** : delta apparié TD_coach − TD_présence (B1), bootstrap par
  CLUSTER de série via `clusterBootstrapDeltaCI` (observations appariées par
  game, cluster = `series.matchId` préfixé corpus, 1000 resamples, mulberry32,
  **seed 42**) ; IC 95 % du delta strictement > 0.
- **VERT** = critère 1 ET critère 2 → gate produit franchie : badge
  Expérimental levé sur le panneau Coach, lignes scorecard R9.
- **ORANGE** = critère 1 seul → « le coach discrimine, mais pas mieux que le
  suivi de méta » : badge conservé, claim limité, levier suivant pré-identifié
  (§5).
- **ROUGE** = critère 1 non atteint → aucun claim de conseil ; enquête
  pré-cadrée (§5), la règle est consommée — pas de retuning.

Puissance déclarée : n attendu ≈ 2 250-2 350 games (le n v1 fut 2 275 ; les
comptes d'écartement peuvent légèrement bouger avec les C_t v2) ; au seuil
n = 2 400, le critère 1 exige TD ≳ 52,0 % (MDE ≈ +2,0 pp). Honnêteté
supplémentaire v2 : les tours 100 % repli rapprochent v2 de v1 — l'effet
mesurable est dilué par (1 − pool-share) ; un effet réel petit ou une
couverture faible sortira « non significatif » et sera publié tel quel.

### 1.6 Secondaires descriptives (pré-enregistrées, AUCUN pouvoir de verdict)

- **S1-S5** : identiques v1 §1.6, verbatim (S1 accord top-1 différentiel —
  l'« accord navigator » G5 ; S2 regret ; S3 TD de B2 ; S4 tranche
  équilibrée ; S5 TD poolé sous bootstrap clusterisé, seed 42). S1 et la part
  des picks réels ∈ C_t sont publiées EN REGARD des valeurs v1 (5,7 % ;
  18,4 %) — comparaison descriptive du levier.
- **S6 — delta apparié v2 − v1 (NOUVELLE, descriptive)** : crédit v2 − crédit
  v1 par game, sur l'INTERSECTION des games scorées par les deux chaînes
  (appariement par gameId ; crédits v1 = le `--credits-out` du replay de la
  porte de validité, passé au run v2 via `--v1-credits`) ;
  `clusterBootstrapDeltaCI`, mêmes 1000 resamples, même seed 42. C'est
  l'attribution chiffrée du bloc candidats — descriptive : elle ne peut ni
  sauver un rouge ni invalider un vert.
- Couverture §1.2 publiée intégralement.

---

## 2. Design technique

### 2.1 Fichiers

| Fichier | Statut | Rôle |
|---|---|---|
| `src/lib/backtest/coachPlayerChain.ts` | **nouveau** (pur) | `championPoolOf` (agrégat carrière → `ChampionPoolEntry[]` par champion), `lineupProPlayers` (lineup → `ProPlayer[]`) — zéro I/O, zéro logique de classement (elle reste dans `rankOurCandidates`) |
| `src/lib/backtest/coachGate.ts` | **existant, inchangé** | percentile/crédit/`scoreGameForGate` — seams `candidatesOf`/`valueOf` consommés tels quels |
| `src/lib/intel/liveDraft.ts` | **existant, inchangé** | `rankOurCandidates` (chaîne shippée, filtre de rôle inclus), `enemyDistributionOf` — déjà exportées (run #2) |
| `src/lib/estimators/playerPockets.ts` | **existant, inchangé** | `fitPlayerHistory`, `currentLineup` |
| `src/lib/aggregates/rolePriors.ts` | **existant, inchangé** | `fitRolePriors`, `rolePriorsOf` |
| `tests/coachPlayerChain.test.ts` | **nouveau** | tests à la main (§2.3) |
| `scripts/backtest/coachGateV2.ts` | **nouveau** | runner : copie du patron v1 + seam `--chain`, règle §1 en en-tête, folds enrichis (playerFit, lineups, priors), rapport |
| `scripts/backtest/coachGate.ts` | **consommé, INTANGIBLE** | l'artefact v1 — référence du repli de la porte de validité, jamais modifié |
| `docs/calibration/coach-gate-v2-2026.md` | **généré** | le rapport v2 (patron v1 + bloc couverture §1.2 + S6) |

Zéro modification de `src/lib` existant : le changement vit dans ce que le
runner INJECTE (deux helpers purs nouveaux + deux clés de ctx).

### 2.2 Lib pure — `src/lib/backtest/coachPlayerChain.ts`

```ts
/** Pool par CHAMPION d'un joueur : cellules carrière agrégées (Σ games,
 *  Σ wins sur les rôles), tri clé asc. Joueur inconnu ⇒ []. */
export function championPoolOf(fit: PlayerHistoryFit, playerId: string): ChampionPoolEntry[];

/** ProPlayer[] d'un lineup walk-forward (ordre ROLES ; rôle sans joueur
 *  absent ; id = name = playerId ; pool par championPoolOf). */
export function lineupProPlayers(fit: PlayerHistoryFit, lineup: Map<Role, string>): ProPlayer[];
```

Contrats testables à la main : un joueur à cellules `{X|top: 3 games}` et
`{X|jng: 2 games}` donne `{X, games: 5}` ; deux joueurs partageant un champion
produisent deux entrées (le dédoublonnage appartient à `rankOurCandidates`) ;
lineup `{top: A, mid: B}` → 2 ProPlayer dans l'ordre des rôles.

### 2.3 Tests (`tests/coachPlayerChain.test.ts` — calculés à la main)

1. Agrégation par champion (multi-rôles, wins compris), tri, joueur inconnu.
2. **Anti-fuite lineup** : un fit construit sur train SANS la game testée ne
   contient pas le joueur qui n'apparaît que dans la game testée (le test
   matérialise la discipline du runner).
3. **Équivalence chaîne shippée** (patron v1 étape 2, OBLIGATOIRE) : sur un
   état synthétique, ctx avec `allyPlayers`/`rolePriors` posés — la chaîne du
   runner (`rankOurCandidates` importée) reproduit exactement les
   `candidates[].championKey` de `recommendNext` avec le même ctx.
4. **Équivalence chain v1** : le ctx `--chain v1` (sans
   `allyPlayers`/`rolePriors`) reproduit le C_t v1 attendu sur le même état
   synthétique (filtre de rôle inerte vérifié).
5. **Filtre de rôle effectif** : un S_t synthétique à rôle committé (actions
   portant `role`) retranche le candidat mono-rôle fermé ; garde-fou liste
   vidée ⇒ liste non filtrée ; priors vides ⇒ candidat conservé.
6. Repli top-up : pools maigres complétés par `fallbackCandidates` dans
   l'ordre présence.

Gate locale : `node node_modules/vitest/vitest.mjs run
tests/coachPlayerChain.test.ts` vert (tests ciblés, parc complet à la fin du
chantier).

### 2.4 Runner — `scripts/backtest/coachGateV2.ts`

CLI (patron maison, copie v1 + 3 flags) :

```
node --experimental-transform-types --no-warnings scripts/backtest/coachGateV2.ts \
  static/corpus/lck-2026.json [...] data/corpus/lpl-2025.json \
  --chain v1|v2 \
  --dataset data/datasets/current-patch.json --full-dataset data/datasets/30-days.json \
  [--seed 42] [--generated-at ISO] [--out docs/calibration/coach-gate-v2-2026.md] \
  [--credits-out data/tmp/coach-credits-<chain>.json] [--v1-credits <json>] [--smoke]
```

Structure interne, par corpus (copie v1, deltas en gras) :

1. Détecteur Fearless — identique v1, publié.
2. Folds paresseux par patch k : `train_k`, `presenceRank_k`/`top15_k`,
   `tables_k`, `now_k`, `wrTrain_k` (identiques v1) ; **+ `playerFit_k`
   (`fitPlayerHistory(train_k)`), `lineup_k(team)` paresseux par équipe
   (`currentLineup(train_k, team, 10)`), `leaguePriors_k`
   (`rolePriorsOf(fitRolePriors(train_k))`)** — fits STRICTEMENT sur le
   train, patron v1.
3. Par game éligible, par seq de pick t : état S_t identique v1 (actions
   réelles résolues < t — **qui portent `role`/`playerId` du corpus ;
   vérification runtime sinon anomalie**) ; **ctx selon `--chain`** (v1 :
   le ctx v1 exact ; v2 : + `allyPlayers` via `lineupProPlayers`, +
   `rolePriors`, §1.1) ; `C_t = rankOurCandidates(ctx, S_t, 6).slice(0, 4)` ;
   racines forcées + memo partagé + `enemyDistributionOf` identiques v1.
4. Baselines B1/B2 : lookups identiques v1 sur les C_t du chain courant.
5. Agrégation : `wilson95`, critère 2 par `clusterBootstrapDeltaCI`
   (obs appariées, seed) ; S5 baseline nulle ; **S6 si `--v1-credits`**
   (intersection par gameId, même bootstrap) ; **bloc couverture §1.2** ;
   rapport markdown byte-stable à seed/`--generated-at` fixés. **En
   `--chain v1`, le writer v1 est réutilisé à l'octet près** (la porte de
   validité en dépend) ; le writer v2 = v1 + sections nouvelles.
6. `--smoke` : un corpus, timing + couverture uniquement, AUCUN taux —
   identique v1.
7. `--credits-out` : crédits par game `{gameId, cluster, credit, creditB1,
   creditB2}` — sortie mécanique, sans lecture.

### 2.5 Coût (ordre de grandeur)

- Inchangé par tour : ≤ 5 racines forcées × ~25 appels évaluateur ≈ 0,67 M
  appels `analyzeDraft` par bras — le chiffrage v1 (2-12 min mono-thread)
  tient ; les fits joueurs/lineups/priors sont des tallies O(corpus)
  négligeables, les baselines des lookups.
- Total architecte : replay validité (`--chain v1`) + run v2 ≈ 2 × le coût
  v1. Si > 60 min : paralléliser PAR CORPUS, jamais réduire depth/topK
  (règle v1 conservée).

---

## 3. Analyse des fuites et des risques de fishing (canaux NOUVEAUX seulement — §3 v1 reste en vigueur)

### 3.1 Fuites

| Canal | Risque | Neutralisation |
|---|---|---|
| **Lineup** | la game testée désigne son propre joueur au slot (le joueur du jour « devine » le pick) | `currentLineup(train_k, …)` — train STRICT (patchs < k, même corpus), la game testée n'entre jamais ; test anti-fuite dédié (§2.3-2) ; un changement de joueur AU patch k est vu en retard (lineup du train) — c'est le prix walk-forward, compté en couverture, jamais corrigé à la main |
| **Carrière joueur** | les picks de la game testée gonflent le pool du joueur | `fitPlayerHistory(train_k)` uniquement — le pick réel du tour t n'est jamais dans le pool qui le classe |
| **Carrière cross-corpus** | fusionner les fichiers pour la carrière cross-ligues mélangerait des timelines sans ordre commun (fuite potentielle 2026→2025 entre fichiers) | NON utilisée — déviation déclarée vs l'esprit cross-ligues de `playerPockets` (§1.1) : carrière du même corpus ; transferts ⇒ joueur inconnu ⇒ repli compté |
| **Priors de rôle** | priors fittés sur la ligue ENTIÈRE (le choix page) incluraient la game testée | `fitRolePriors(train_k)` — walk-forward strict, plus exigeant que la page ; déclaré |
| **Rôles des picks propres dans S_t** (`openRolesOf`) | l'attribution de rôle corpus est une vérité POST-game ; en flex, le rôle d'un pick déjà posé peut n'être figé que plus tard | approximation déclarée : l'équipe connaît son PLAN de rôles au moment t (le coach conseille cette équipe — information interne légitime) ; ne concerne que les picks de seq < t du PROPRE camp, jamais le pick réel du tour t ni le camp adverse ; identique pour les deux sides d'une game (l'appariement annule le biais de camp) |
| **Lockouts/now/tendances/dataset** | — | inchangés v1 (§3.1 v1) |

### 3.2 Auto-information du pick réel

Inchangée v1 §3.2 — et renforcée d'un cran : C_t vient désormais de
lineup + carrière TRAIN + état public S_t (+ rôles propres committés, cf.
table) ; le pick réel y est ajouté comme candidat évalué par le même chemin
(racine forcée), jamais comme signal. Memo partagé par tour uniquement,
identique v1.

### 3.3 Confusions (fausses lectures possibles)

- **Dilution par repli** : sur les tours 100 % repli (début de timeline,
  équipes nouvelles), v2 ≡ v1 modulo filtre de rôle — un delta v2−v1 faible
  peut signifier « levier peu appliqué » autant que « levier inopérant ». La
  couverture §1.2 et S6 séparent les deux LECTURES ; le verdict, lui, ne
  bouge pas (critères 1+2 sur tout).
- **Attribution pools vs filtre de rôle** : non séparée (un seul bras nouveau,
  §1.1) — toute phrase du rapport attribue au BLOC candidats, jamais aux
  pools seuls.
- **Force d'équipe, side, ordre assumé, calibration absente** : inchangées
  v1 §3.3 (B1 sur C_t égaux + S4 ; percentile par side ; notes).
- **Stand-ins / role-swaps jour de match** : le lineup walk-forward peut
  désigner le mauvais joueur — symétrique entre vainqueurs et perdants (rien
  ne lie l'erreur de lineup à l'issue dans la construction), top-up borne
  les dégâts, part « joueur connu » publiée.

### 3.4 Anti-fishing

- **UNE règle, UN run** : tout le bloc candidats est gelé ici —
  `recentGames = 10`, agrégation par champion (Σ rôles), aucun seuil
  `minGames` de pool (toute main de train compte), priors de LIGUE,
  `roleCoverageFloor` = défaut committé 0,15, repli top-up, `allyPlayers`
  toujours passé — plus tout l'héritage v1 (depth 2, topK 4, α/λ, `now_k`,
  seuils d'éligibilité, seed 42, crédit ½, clusters de série, 7 corpus).
  L'en-tête du runner reprend le §1 verbatim, le commit précède le run.
- **Porte de validité avant tout** : le replay `--chain v1` ne révèle que du
  déjà-publié ; aucun chiffre v2 n'existe avant le run final.
- **Un seul critère de verdict (1+2)** ; S1-S6 et la couverture étiquetées
  descriptives AVANT le run — aucune ne sauve un rouge ni n'invalide un vert.
- **Tranches pré-déclarées uniquement** : poolé, par corpus, S1-S6,
  couverture §1.2. Aucune découpe post-hoc (par patch, par équipe, par
  pool-share…) ne peut être promue dans le verdict.
- **Smoke aveugle** (`--smoke` : timing + couverture, zéro taux) inchangé.
- **Échec structurel assumé** : n < ~1 900 ou couverture « joueur connu »
  basse ⇒ gate possiblement non concluante — publiée telle quelle, pas de
  re-découpage.

---

## 4. Plan d'implémentation pas-à-pas

Chaque étape committable et testable isolément ; rien ne lit un résultat
métrique avant l'étape 6. Les RUNS (replay, smoke, run final) sont
l'ARCHITECTE seul — interdits aux agents, comme toute la run #3.

1. **Lib pure** `src/lib/backtest/coachPlayerChain.ts` +
   `tests/coachPlayerChain.test.ts` (§2.3, y compris les deux tests
   d'équivalence chaîne et l'anti-fuite lineup). Gate : tests ciblés verts.
2. **Runner** `scripts/backtest/coachGateV2.ts` : copie du patron v1, seam
   `--chain`, folds enrichis, `--credits-out`/`--v1-credits`, writer v1
   préservé à l'octet pour `--chain v1`, writer v2 (+couverture, +S6).
   Test : `--smoke --chain v2` sur un mini-corpus synthétique imprime
   couverture et zéro métrique ; rendu v2 byte-stable à seed/horodatage
   fixés sur le mini-corpus.
3. **Gel** : recopier la règle §1 (post-revue adversariale) dans l'en-tête du
   runner, commit « coach gate v2 : règle pré-enregistrée » AVANT tout run
   réel.
4. **Porte de validité (architecte)** : sha256 des snapshots vérifiés contre
   les hash gelés ; `--chain v1 --seed 42 --generated-at
   2026-06-11T11:55:20.989Z --out data/tmp/coach-gate-v1-replay.md
   --credits-out data/tmp/coach-credits-v1.json` ; diff byte-identique vs
   `docs/calibration/coach-gate-2026.md` exigé (repli documenté §1.0 sinon).
   Aucun chiffre nouveau lu.
5. **Smoke aveugle (architecte)** : `--chain v2 --smoke` (timing +
   couverture).
6. **LE run (architecte)** : 7 corpus, `--chain v2 --seed 42
   --v1-credits data/tmp/coach-credits-v1.json
   --out docs/calibration/coach-gate-v2-2026.md`. Publier le rapport tel
   quel.
7. **Suites du verdict** (§5) : STATUS + scorecard R9 + badge/copy UI selon
   la couleur — commit séparé du run.

---

## 5. Ce que le verdict change

### Si VERT (critères 1 ET 2)

- **Le claim produit central existe** — formulation pré-écrite (nombres du
  rapport, rien d'autre) : « Sur N drafts pro 2025-2026 rejouées en
  walk-forward, le coach nourri des pools joueurs réels classe le pick des
  vainqueurs au-dessus de celui des perdants dans X % des games [IC Wilson],
  et fait mieux que le simple suivi de méta (+Y pp, IC bootstrap clusterisé
  par série). Corrélation, pas causalité : personne ne rejoue les games. »
- **UI** : badge Expérimental du CoachPanel → « Mesuré — voir la gate »
  (lien `docs/calibration/coach-gate-v2-2026.md`) ; DA-V2-11 satisfaite.
- **Scorecard R9** : TD vs B1 + accord top-1 S1 (l'« accord navigator » G5),
  cibles fixées à la première mesure.
- **Config de référence gelée (DA-V2-6)** : la chaîne candidats v2
  (pools joueurs + priors de rôle + repli présence, depth 2 / topK 4)
  devient la référence validée — tout changement futur re-passe la gate.
  S6 et la couverture documentent l'attribution (descriptif).
- **Débloque** : pertinence mesurée pour I5 et le navigator des plans à
  branches ; argument de poids pour brancher les pools `enrichPlayers`
  par défaut sur la page.

### Si ORANGE (critère 1 seul)

- Claim limité publié honnêtement : « le coach discrimine — pas encore mieux
  que la méta, même armé des pools joueurs ». Badge conservé.
- Leviers suivants DÉJÀ identifiés, par ordre : (a) ranges I1 complets au
  root (l'autre moitié de l'item n°3 de la file post-run) ; (b) carrière
  cross-corpus en walk-forward GLOBAL par date (lever la déviation §1.1 —
  c'est un changement de walk-forward, donc une règle entièrement nouvelle) ;
  (c) recalibration de l'évaluateur (snapshots SoloQ datés DA-V2-3 /
  régression sur features différentielles, méthodologie §3.2). Chacun =
  NOUVELLE règle gelée ; aucun retuning de ce run.

### Si ROUGE (critère 1 non atteint)

- Aucun claim de conseil ; copy « explorateur de lignes » et badge conservés.
- Enquête pré-cadrée (sans toucher à la règle consommée) :
  1. **lire la COUVERTURE d'abord** : si « joueur connu » ou pool-share sont
     bas, le levier n'a pas été réellement testé — le candidat run #4 est la
     couverture elle-même (carrière cross-corpus datée, lineup plus long),
     pas un nouveau classement ;
  2. **lire S6** : si Δ v2−v1 ≈ 0 à couverture forte, la chaîne de candidats
     est DISCULPÉE — le suspect n°1 redevient l'évaluateur (transfert
     SoloQ→pro, verdict fondateur n°3) : recalibration des poids / DA-V2-3
     AVANT tout nouveau run de cette gate ;
  3. **lire S1 et la part des picks réels ∈ C_t vs v1** : si elles montent
     fort (le coach voit enfin les vrais candidats) mais TD stagne, le
     classement n'extrait pas de signal des bons paniers — même conclusion
     évaluateur.
- Dans tous les cas le rapport est publié tel quel — un rouge à couverture
  documentée vaut une carte : il dit OÙ le prochain euro d'effort va.

---

*Rédigé le 2026-06-11 (chantier A3, design run #3). Données d'appui lues
avant rédaction — code committé, jamais supposé :
`fitPlayerHistory`/`currentLineup` (`playerPockets.ts` : cellules
(champion, rôle), picks résolus à `playerId`+`role` requis ;
`recentGames = 10` défaut, départages déterministes) ;
`rankOurCandidates`/`filterByOpenRoles`/`enemyDistributionOf`
(`liveDraft.ts` : pools→tiers→games→clé, repli top-up, filtre de rôle aux
tours de pick, `DEFAULT_ROLE_COVERAGE_FLOOR = 0.15`, garde-fou liste vide) ;
`ProPlayer`/`ChampionPoolEntry` (`pro/types.ts` : pool par champion, sans
recence) ; `classifyPoolTier` (seuils 20/10/3, recence non fournie ⇒ games
bruts) ; `fitRolePriors`/`rolePriorsOf` (`aggregates/rolePriors.ts` ; la page
passe des priors de LIGUE au coach) ; runner v1 (`scripts/backtest/coachGate.ts`
l. 590-598 : ctx sans `allyPlayers` ni `rolePriors` ; S_t bâti sur les
`DraftAction` complets du corpus — `role`/`playerId` portés ; rapport
byte-stable à seed/`--generated-at` fixés) ; rapport v1
(`docs/calibration/coach-gate-2026.md` : TD 51,6 %, Δ +0,92 pp ns, S1 5,7 %,
picks réels ∈ C_t 18,4 % poolé, n = 2 275, hash des snapshots).*
