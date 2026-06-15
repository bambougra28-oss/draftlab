# Gate ÉVALUATEUR — re-pondération des composantes différentielles — Design run #4 (chantier R4)

> BROUILLON RÉVISÉ — revue adversariale passée (3 relecteurs : statistique,
> fidélité-code, anti-fishing). Amendements R1-R12 appliqués ci-dessous. En
> attente de gel. Tant que ce bandeau « BROUILLON » est présent, la règle n'est
> PAS gelée et aucun run n'a eu lieu. Une fois gelé : règle définitive, aucun
> paramètre ne bouge après le commit.

> **Amendements appliqués post-revue (2026-06-15) :**
> - **R1 (bloquant — porte de validité)** : `--chain e3` reproduit le mode LIGUE
>   PAR DÉFAUT de `winCalibrationByLeague.ts` (PAS le mode `--pooled`, qui émet
>   un autre rapport, `docs/run3/E3-validite-poolee.md`) ; cible explicite via
>   `--out` (le défaut du script diffère du nom `…by-league.md`).
> - **R2 (bloquant — porte de validité)** : le replay E3 consomme le flux
>   `mulberry32(42)` dans l'ordre EXACT du code source — 24 IC primaires PUIS
>   12 IC clusterisés (`winCalibrationByLeague.ts:979-1021`) ; toute omission
>   casse le byte-identique ET fait dériver tout tirage R4 ultérieur.
> - **R3 (bloquant — ancre)** : `logisticFit` reprend `platt.ts` AU CARACTÈRE
>   PRÈS (ridge `1e-6` sur TOUTE la diagonale, intercept COMPRIS ; init
>   identité `β₀=0, βⱼ=1` ; `STEP_TOL=1e-10` ; garde `det ≤ 0 ⇒ break` ;
>   budget 50 ; `EPS_P=1e-6`) — l'égalité §2.3-4 avec `plattFit` est alors
>   exacte par construction sur une feature.
> - **R4 (bloquant — comparateur)** : le verdict VERT exige DEUX IC unilatéraux
>   sous 0 — (i) R4 < non calibré ET (ii) R4 < Platt E3 ; (ii) isole le degré de
>   liberté re-pondération que la paire de bootstrap, aveugle à l'optimisme
>   d'estimation de β, ne borne pas seule.
> - **R5 (bloquant — unité de verdict)** : le POOLÉ-2-cellules est un ÉCART
>   DÉLIBÉRÉ et figé vs E3 (qui verdictait par cellule, poolé `validated:false`
>   forcé) ; per-league rendu DESCRIPTIF SANS POUVOIR des deux côtés ; garde
>   anti-mélange ajoutée.
> - **R6 (bloquant — garde de signe)** : la garde de signe ne touche JAMAIS la
>   couleur ; `validated` est un drapeau de SHIP distinct.
> - **R7 (bloquant — falsifiabilité)** : la lecture ROUGE est un résultat NÉGATIF
>   de plein droit sur la méthode R4 ; « le mur, ce sont les entrées » devient
>   une hypothèse non testée renvoyée au futur, jamais une conclusion de R4.
> - **R8** : standardisation — seuil `σⱼ ≤ 1e-9 ⇒ colonne EXCLUE` (un seul
>   mécanisme, jamais un zéro-remplissage).
> - **R9** : afterBans exclu du verdict comme dégénérescence STRUCTURELLE —
>   sans feature (x₁=x₂=x₃=0, colonnes exclues), R4 n'a RIEN à re-pondérer et
>   dégénère en intercept-only = side-only. ΔBrier(R4−non calibré) y mesure
>   side-only vs pièce (l'effet E3 déjà connu), publié DESCRIPTIF, hors verdict
>   (corrigé en implémentation : ce n'est PAS « ΔBrier ≡ 0 » — le non-calibré
>   vaut 0,5, R4 vaut le base-rate du train).
> - **R10** : multiplicité — borne `1−(1−0,025)² ≈ 4,9 %` déclarée (pas l'égalité
>   « 2×2,5 % », qui supposerait l'indépendance, fausse), recalculée sous le
>   critère à deux IC.
> - **R11** : `logisticFit(rows, { ridge: 1e-6, maxIter: 50 })` — littéraux
>   EXPLICITES, assertés et imprimés au rapport.
> - **R12** : `--chain e3` n'écrit AUCUN artefact params (verrou) ; `--smoke` est
>   un ajout R4 (absent du patron E3) ; imports `DraftRecord` depuis
>   `src/lib/data/types`.

> **Pourquoi cette gate, et pourquoi maintenant.** Run #3 a disculpé la chaîne
> de candidats du coach et désigné l'ÉVALUATEUR. Les trois lectures pré-écrites
> du §5 ROUGE de A3 (`docs/run3/A3-coach-player-pools.md`) convergent sur les
> chiffres publiés (`docs/calibration/coach-gate-v2-2026.md`) :
> 1. **couverture forte** — joueur connu 98,5 %, pool-share C_t 97,6 %, 100 %
>    repli 1,6 % : le levier candidats a réellement tourné ;
> 2. **S6 ≈ 0 à couverture forte** — Δ v2−v1 = −0,33 pp [−2,60 ; +1,76] : « la
>    chaîne de candidats est DISCULPÉE — le suspect n°1 redevient l'évaluateur » ;
> 3. **picks réels ∈ C_t 18,4 → 29,5 %, S1 5,7 → 8,9 %, TD 51,6 → 51,7 %** : on a
>    montré au coach les VRAIS candidats et le taux de discrimination n'a pas
>    bougé — « le classement n'extrait pas de signal des bons paniers, même
>    conclusion évaluateur ».
> Et E3 (`docs/calibration/win-calibration-by-league.md`) a montré que **Platt
> ne sauve rien** : 0/12 cellules, tous les ΔBrier chevauchent 0. Or Platt ne
> peut que RE-ÉCHELONNER la sortie scalaire — `σ(a + b·logit(p_raw))` — il ne
> peut PAS re-pondérer les composantes de l'évaluateur les unes par rapport aux
> autres. C'est précisément le degré de liberté que les données de run #3
> désignent : non pas re-mettre à l'échelle la somme, mais **re-pondérer les
> composantes différentielles**.

> **Le fait de structure qui définit la gate** (vérifié dans le code, jamais
> supposé — `src/lib/engine/analyzer.ts`) : `analyzeDraft` n'est PAS une
> régression logistique sur un vecteur de features. C'est un modèle Elo additif
> à **poids unitaires FIGÉS** et lien Elo FIGÉ :
> `totalRating = (χ_ally − χ_enemy) + (δ_ally − δ_enemy) + μ + sideOffset` puis
> `winrate = ratingToWinrate(totalRating) = 1 / (1 + 10^(−totalRating/400))`
> (`analyzer.ts:272-287` ; `ratings.ts:10-12`). Les trois composantes — somme
> des ratings champions par side, somme des deltas de duo par side, somme des
> deltas de matchup (déjà ally-vs-enemy) — entrent toutes avec le coefficient
> **1**, et le lien a une pente FIGÉE de `ln 10 / 400`. Personne n'a jamais
> ajusté ces poids ni cette pente sur des issues pro. **C'est l'hypothèse non
> testée que cette gate met à l'épreuve.**

> **Principe directeur (patron B §1.4 : « une seule chose change = attribution
> propre »).** La gate reprend VERBATIM de E3 : l'éligibilité
> (`isCalibrationEligible`, un SEUL ensemble PAR LIGUE partagé par les trois
> positions), les 8 corpus dans le MÊME état amendé, les snapshots SoloQ gelés
> sha-vérifiés, les quatre timelines walk-forward PAR LIGUE, les trois ancres de
> séquence, le bootstrap, les seeds. La **seule** chose qui change est le BRAS
> prédictif : là où E3 ajuste deux paramètres `(a, b)` sur le scalaire `p_raw`,
> R4 ajuste **quatre coefficients** `(β₀, β₁, β₂, β₃)` sur les TROIS composantes
> différentielles brutes de l'évaluateur. Une **porte de validité** (§1.0) exige
> que le runner, ramené au bras Platt de E3, reproduise
> `docs/calibration/win-calibration-by-league.md` **byte-identique** AVANT que la
> moindre métrique R4 soit lue.

---

## 1. Règle pré-enregistrée

> Le bloc §1 est rédigé pour être recopié tel quel dans l'en-tête de
> `scripts/backtest/evaluatorReweight.ts` et committé AVANT tout run.

### 1.0 Héritage E3 (verbatim) et porte de validité

**Hérité de E3 (`scripts/backtest/winCalibrationByLeague.ts`) sans AUCUN
changement** — R4 cite la règle E3 au lieu de la réécrire ; en cas de doute, le
texte E3 fait foi :

- **Corpus (8 fichiers, fixés — état UNIQUE amendé `docs/run2/AMENDEMENT-corpus-20260611.md`)**,
  appariés PAR LIGUE, ligue = préfixe du basename (`^(lck|lec|lfl|lpl)-\d{4}\.json$`,
  asserté, abort sinon) :
  `lck` = `static/corpus/lck-2026.json` + `data/corpus/lck-2025.json` ·
  `lec` = `static/corpus/lec-2026.json` + `data/corpus/lec-2025.json` ·
  `lfl` = `static/corpus/lfl-2026.json` + `data/corpus/lfl-2025.json` ·
  `lpl` = `static/corpus/lpl-2026.json` + `data/corpus/lpl-2025.json`.
  Unicité des `gameId` assertée sur l'UNION des 8 corpus (abort si collision).
  **Argv gelée (R1/R2 — vérifiée par la porte de validité)** : l'ORDRE des 8
  fichiers est celui du run E3 publié — **tous les 2026 PUIS tous les 2025**
  (l'ordre conditionne les sommes flottantes des fits poolés ET la consommation
  du rng) : `static/corpus/lck-2026.json static/corpus/lec-2026.json
  static/corpus/lfl-2026.json static/corpus/lpl-2026.json
  data/corpus/lck-2025.json data/corpus/lec-2025.json data/corpus/lfl-2025.json
  data/corpus/lpl-2025.json`. **Porte de validité PASSÉE le 2026-06-15** :
  `--chain e3` régénère `win-calibration-by-league.md` byte-identique
  (44 699 octets, 0 octet divergent) ; smoke R4 confirme la couverture
  818/470/450/1172 = 2 910 paires/position.
- **Éligibilité (`isCalibrationEligible`, `src/lib/backtest/sequencePositions.ts:59-64`)** :
  (a) `winner` défini, (b) 10 picks rôle-complets (règle `compOf` de
  postdiction G1 — clé résolue + rôle présent + aucun rôle dupliqué par side,
  `roleTeamsAt(record, 20)` 5/5), (c) patch parsable. UN SEUL ensemble PAR
  LIGUE, partagé par les trois positions. Tout record écarté compté au rapport.
- **Datasets SoloQ gelés (JAMAIS re-tirés)** : `data/datasets/current-patch.json`
  + `data/datasets/30-days.json`. Le runner ABORT avant toute métrique si
  `sha256(current-patch) ≠ aca91656af68dff5016152e947aafbcebfb3dfe320cc2781f8fdbe8983fb8869`
  ou `sha256(30-days) ≠ 6933c7c2d107afd465e7d8f0c44765305ff8747a187ed54c4c1f73e87651a4b1`.
  Hashes attendus = défauts du script ; surcharge `--expected-sha256-*`
  INTERDITE sur corpus réels (auditable dans la commande publiée ET dans la
  ligne « override de hash : aucun » du rapport).
- **Prédicteur brut, inchangé E3 AU CARACTÈRE PRÈS** : à chaque (game, position),
  `r = analyzeDraft(dataset, blue(g,pos), red(g,pos), { ignoreChampionWinrates:
  false, riskLevel: 'medium', minGames: 0 }, fullDataset)` ;
  `p_raw = r.winrate`. Équipes = rôles RÉELS (`roleTeamsAt`), trois ancres
  inchangées : `afterBans` seq ≤ 6 (p_raw ≡ 0,5 par construction), `after3Picks`
  seq ≤ 9, `fullDraft` seq ≤ 20. Aucun `playerContext`, aucun `sideContext`.
  Cible `won = (winner === 'blue')`. `p_raw` et `r` ne dépendent PAS de la
  ligue : cache unique par (game, position), partagé par tous les bras.
- **Protocole walk-forward, inchangé E3** : QUATRE timelines, une PAR LIGUE
  (= union des 2 fichiers, ordonnée `groupByPatch`/`comparePatches`),
  `walkForward` (`src/lib/backtest/walkforward.ts`) avec `minTrainSize = 50`
  PAR LIGUE. Assertion croisée ordre-patch vs chronologie PAR LIGUE
  (min(date) monotone entre groupes consécutifs), abort AVANT toute métrique
  sinon.
- **Timelines gelées, IDENTIQUES E3** — l'éligibilité, le corpus et les
  snapshots étant byte-identiques à E3, les ensembles éligibles, les folds et
  les comptes de paires de test sont LES MÊMES (cités verbatim de
  `docs/calibration/win-calibration-by-league.md`, vérifiés par la porte de
  validité §1.0) :
  `lck` 892 él., 20 folds, **818 paires/position** (1er fold 25.S1.3) ·
  `lec` 554 él., 17 folds, **470 paires/position** (1er fold 25.06) ·
  `lfl` 508 él., 17 folds, **450 paires/position** (1er fold 25.S1.3) ·
  `lpl` 1260 él. / 1262 records, 18 folds, **1172 paires/position** (1er fold 25.04).
  TOTAL **2 910 paires de test par position**, 3 214 éligibles / 3 216 records
  (2 écartés, lpl-2026). Tout écart de ces comptes au run = arrêt et enquête
  (dérive d'environnement), jamais un re-tuning.
- **Stats (modules gelés)** : `brier`/`logLoss`/`wilson95`/`reliabilityBins`
  (`src/lib/backtest/metrics.ts`), `bootstrapDeltaCI` apparié
  (`metrics.ts:219-250`), `clusterBootstrapDeltaCI`
  (`src/lib/backtest/clusterBootstrap.ts`, cluster = `series.matchId`, une game
  sans série = son propre cluster), `mulberry32` (`metrics.ts:166-175`),
  **seed 42**.

**Porte de validité (anti-bug, patron B §1.4) — préalable OBLIGATOIRE au run** :

- Le runner expose `--chain e3|r4` (obligatoire, pas de défaut). En `--chain e3`,
  il N'AJOUTE PAS le bras re-pondéré : il reproduit le **mode LIGUE PAR DÉFAUT**
  de `winCalibrationByLeague.ts` **(R1 — PAS le mode `--pooled`, qui réplique la
  règle v1 vers `docs/run3/E3-validite-poolee.md`, un AUTRE rapport)** : quatre
  timelines par ligue, douze cellules, les quatre bras E3 (calibré Platt, non
  calibré, pièce, side-only ligue), l'artefact params v2, et le rapport au
  format ligne-à-ligne de `winCalibrationByLeague.ts:1079-1269`.
- **R2 — ordre du flux RNG (load-bearing)** : `--chain e3` consomme le flux
  `mulberry32(42)` dans l'ordre EXACT du code source — d'abord les **24 IC
  primaires** (ligues lck→lec→lfl→lpl ; par ligue afterBans Brier, afterBans
  logLoss, after3Picks Brier/logLoss, fullDraft Brier/logLoss), PUIS les **12 IC
  clusterisés par série** dans le même ordre de cellules
  (`clusterBootstrapDeltaCI`, cluster = `series.matchId`, une game sans série =
  son propre cluster) — `winCalibrationByLeague.ts:979-1021`. Toute omission ou
  ré-ordonnancement casse le byte-identique ET fait dériver tout tirage R4
  ultérieur.
- **R12 — verrou d'artefact** : `--chain e3` n'écrit AUCUN artefact params
  (`data/calibration/winCalibration.json`) — abort si `--params-out` lui est
  passé ; la porte ne touche jamais l'artefact shippé.
- **Critère gelé** : `--chain e3 --seed 42 --generated-at
  2026-06-11T19:23:25.422Z --out data/tmp/e3-replay.md` (R1 — `--out` EXPLICITE :
  le défaut du script en mode ligne est `…win-calibration-par-ligue-2026.md`,
  pas `…by-league.md`) sur les 8 corpus et les snapshots sha-vérifiés régénère un
  fichier **byte-identique** à `docs/calibration/win-calibration-by-league.md`
  (diff vide). Diff non vide ⇒ bug du runner R4 ou dérive d'environnement :
  corriger, re-passer la porte ; le run R4 ne démarre qu'après diff vide.
- Repli documenté (cas d'ENVIRONNEMENT prouvé, étranger au runner) : ré-exécuter
  le script E3 CONSOMMÉ (`scripts/backtest/winCalibrationByLeague.ts` TEL QUE
  COMMITTÉ) sur l'état courant ; sa sortie devient la référence E3 du run #4
  (publiée en annexe) et `--chain e3` doit LA reproduire byte-identique.
- Cette porte ne lit AUCUN résultat nouveau : tous les chiffres du replay sont
  déjà publiés (E3).

### 1.1 LA seule chose qui change : le bras prédictif re-pondéré

> Remplace le SEUL bras « calibré Platt » de E3 par un bras « évaluateur
> re-pondéré ». Tous les autres bras (non calibré, pièce, side-only) restent
> E3 verbatim — ce sont les baselines.

**Les trois features différentielles (lues de `DraftResult`, AUCUNE modif de
`analyzer.ts`)** — à chaque (game, position) scorée, depuis le `r` du
prédicteur brut déjà calculé (cache E3) :

- `x₁ = r.allyChampionRating.totalRating − r.enemyChampionRating.totalRating`
  (différentiel des ratings champions solo, blue − red) ;
- `x₂ = r.allyDuoRating.totalRating − r.enemyDuoRating.totalRating`
  (différentiel des deltas de synergie de duo) ;
- `x₃ = r.matchupRating.totalRating`
  (différentiel de matchup — DÉJÀ ally-vs-enemy, ajouté une seule fois dans le
  modèle, `analyzer.ts:275`).

Par construction `x₁ + x₂ + x₃ = r.totalRating − sideOffset` et
`sideOffset = 0` dans ce protocole (aucun `sideContext`) ⇒
`x₁ + x₂ + x₃ = r.totalRating` et donc
`p_raw = σ(c·(x₁ + x₂ + x₃))` avec `c = ln 10 / 400 ≈ 0,0057565` (le lien Elo).
**Le modèle shippé est exactement le cas particulier `β₀ = 0, β₁ = β₂ = β₃ = c`.**
R4 relâche ces quatre nombres et les ajuste sur les issues, walk-forward.

**Le bras re-pondéré (R4) — par ligue, par fold, par position** :

1. Sur les paires de TRAIN de la ligue (patchs < k de la ligue), former les
   lignes `{x = [x₁, x₂, x₃], y = won ? 1 : 0}`.
2. **Standardisation gelée — R8 (conditionnement, ne change pas l'optimum des
   prédictions)** : `standardizeFit(rows)` calcule `μⱼ, σⱼ` (écart-type de
   population, diviseur n) sur le TRAIN seul. **Neutralisation PAR SEUIL, un
   seul mécanisme** : `σⱼ ≤ 1e-9 ⇒ colonne j EXCLUE de la matrice de design
   (retirée, jamais mise à 0)` — le βⱼ correspondant est ABSENT du fit et la
   prédiction l'ignore. Le seuil 1e-9 (et non σ=0 exact) borne l'explosion d'une
   colonne quasi-constante. À `afterBans`, `x₁ = x₂ = x₃ = 0` pour TOUTES les
   games ⇒ les 3 colonnes exclues ⇒ design = intercept seul ⇒ `logisticFit`
   renvoie `β₀ = logit(taux de 1 du train)`, `p_fit ≡ σ(β₀)` = base-rate =
   side-only ligue (dégénérescence STRUCTURELLE, §1.3-R9 / §1.5).
3. `β = logisticFit(lignes standardisées, { ridge: 1e-6, maxIter: 50 })` —
   module gelé `src/lib/estimators/logisticFit.ts`. **R3/R11 — reprend
   `platt.ts` AU CARACTÈRE PRÈS** (pas « la même hygiène » en gros) : IRLS/Newton
   sur la log-vraisemblance ; ridge `λ = 1e-6` ajouté à TOUTE la diagonale du
   Hessien **intercept COMPRIS** (`platt.ts:75,77`) ; **init = identité du cas
   Platt : `β₀ = 0`, `βⱼ = 1` sur chaque feature retenue** (PAS init tout-à-0,
   qui casserait l'ancre §2.3-4 sur folds quasi-séparables) ; early-stop
   `STEP_TOL = 1e-10` ; garde `det ≤ 0 ⇒ break` ; budget 50 = régularisation
   implicite sur données séparables ; `EPS_P = 1e-6`. Les littéraux `ridge=1e-6,
   maxIter=50, eps=1e-6` sont passés EXPLICITEMENT (jamais les défauts du
   module), assertés en tête du runner et imprimés au rapport ; tout écart =
   abort avant métrique.
4. Prédiction de test : `p_fit = σ(β₀ + Σ_{j retenues} βⱼ·(xⱼ_test − μⱼ)/σⱼ)`
   (mêmes `μⱼ, σⱼ` de train ; aucune division par une colonne exclue — elle n'a
   ni βⱼ ni terme). `p_fit` clampé à `[1e-6 ; 1−1e-6]` comme E3 avant
   Brier/logLoss.

**Repli total gelé** : train de fold sans feature exploitable (toutes colonnes
exclues, i.e. afterBans, ou train dégénéré) ⇒ intercept-only = base-rate, jamais
une branche spéciale — un seul code, cas limite compté.

### 1.2 Couverture pré-déclarée (publiée, AUCUN pouvoir)

Rien n'est mesuré avant le run. À déclarer/publier :
- Paires de test par (ligue × position) — DOIVENT égaler les comptes gelés
  §1.0 (sinon arrêt).
- Distribution des trois features sur le train poolé (moyenne, écart-type,
  min/max) par position — descriptif, publié après le run.
- Coefficients finaux `β` du fit full-data PAR LIGUE (shippés si VERT, jamais
  utilisés pour les métriques) ; signe de chaque `βⱼ` (un `βⱼ < 0` = la
  composante j prédit À L'ENVERS sur cette ligue — lecture honnête publiée).
- Nombre de folds à colonne neutralisée par (ligue × position).

### 1.3 Métrique primaire et unité de verdict

- **Métrique** : `ΔBrier = Brier(re-pondéré R4) − Brier(non calibré = modèle
  shippé)`, sur les paires de test. IC bootstrap 95 % **APPARIÉ par game**
  (1000 resamples, `bootstrapDeltaCI`, observations `model = (p_fit − y)²`,
  `baseline = (p_raw − y)²`).
- **Unité de verdict primaire = POOLÉE sur les 4 ligues, 2 cellules** (les deux
  ancres non dégénérées) : `after3Picks` et `fullDraft`. Les prédictions de test
  R4 sont hors-échantillon pour LEUR ligue (β ajusté sur le train de la ligue) ;
  chaque game apparaît une seule fois avec un seul couple `(p_fit, p_raw)`, les
  ligues sont disjointes (corpus partitionné par préfixe) — le bootstrap apparié
  poolé ne fuit ni ne double-compte (vérifié `metrics.ts:231-239`).
- **R5 — écart DÉLIBÉRÉ et figé vs E3.** E3 a verdicté PAR CELLULE (12 cellules)
  et a FORCÉ le poolé `validated:false` (« aucun verdict poolé n'existe dans ce
  run », `win-calibration-by-league.md` artefact, l. 707-708). R4 RENVERSE ce
  choix et prend le POOLÉ-4-ligues comme unité primaire — non par commodité mais
  pour une raison structurelle pré-enregistrée : R4 ajuste 4 coefficients sur un
  signal de 2ᵉ ordre, la puissance per-league est insuffisante (demi-largeur IC
  ≈ 0,003-0,006, §1.4), seul le poolé (n = 2 910) a la puissance déclarée.
  **Conséquence figée, irrévocable au commit** : le per-league (8 cellules,
  §1.6) est DESCRIPTIF SANS POUVOIR des DEUX côtés — une cellule per-league
  VERTE ne crée aucun claim et ne peut ni sauver ni nuancer la couleur poolée ;
  symétriquement le poolé ne masque pas le per-league (les 8 ΔBrier publiés
  bruts). Aucun rebasculement per-league à la lecture.
- **Garde anti-mélange (gelée, gate le CLAIM, pas la couleur)** : une cellule
  poolée VERTE dont ≥ 1 ligue affiche un ΔBrier(R4 − non calibré) per-league de
  signe OPPOSÉ (point estimé > 0) publie verbatim : « le vert poolé est porté
  par un sous-ensemble de ligues ; la re-pondération NUIT dans ≥ 1 ligue — claim
  restreint aux ligues à Δ < 0, jamais généralisé ». Lue APRÈS la couleur, sans
  la changer.
- **R9 — `afterBans` exclu du verdict (dégénérescence STRUCTURELLE, écart
  pré-déclaré vs E3 qui le verdictait)** : à afterBans, `x₁=x₂=x₃=0` pour toutes
  les games (identité `analyzer.ts:272-278`) ⇒ les 3 colonnes sont exclues ⇒ le
  bras R4 n'a **aucune feature à re-pondérer** et dégénère en intercept-only =
  **side-only** (= base-rate du train). Il ne teste donc RIEN sur la
  re-pondération → hors verdict. NB (corrigé en implémentation) : R4 n'y est PAS
  égal au non-calibré — le non-calibré vaut `p_raw ≡ 0,5`, R4 vaut le base-rate ;
  `ΔBrier(R4−non calibré)` à afterBans = l'effet **side-only vs pièce** déjà
  connu de E3/run #2, publié DESCRIPTIF (point, sans IC ni verdict).
- **Ordre GELÉ des IC (un seul flux `mulberry32(seed 42)`)** : (primaires)
  poolé `after3Picks` ΔBrier(R4−non calibré) → poolé `fullDraft` ΔBrier(R4−non
  calibré) → poolé `after3Picks` ΔBrier(R4−Platt) → poolé `fullDraft`
  ΔBrier(R4−Platt) [les deux IC co-décisifs, R4/§1.4] ; puis (secondaires, même
  flux, après) IC clusterisés (2 cellules) puis per-league et autres dans
  l'ordre du §1.6.

### 1.4 Baselines / bras (les 3 autres = E3 verbatim) et critères de verdict

Quatre bras par (ligue × position), trois INCHANGÉS E3 :
- **R4 re-pondéré** `σ(β₀ + Σ βⱼ·zⱼ)` — le bras nouveau (§1.1) ;
- **Non calibré** `p_raw` — **LE comparateur du verdict** : le modèle Elo shippé
  à poids unitaires ;
- **Pièce** `0,5` ;
- **Side-only ligue** — winrate blue du train de la ligue (descriptif).

**Critères (gelés)** — pour CHACUNE des 2 cellules primaires :

- **R4 — Critère V à DEUX IC unilatéraux co-décisifs** : la cellule est VERTE ssi
  les DEUX IC appariés (1000 resamples, même flux) sont entièrement sous 0 :
  - (i) `ci95.hi(ΔBrier R4 − non calibré) < 0` — R4 bat le modèle shippé
    (poids unitaires figés) ;
  - (ii) `ci95.hi(ΔBrier R4 − Platt E3) < 0` — R4 bat le simple ré-échelonnement
    scalaire.
  Raison de (ii) : R4 a 4 paramètres, Platt 2 (intercept + échelle) ; (i) seul
  peut être gagné par les 2 dof communs à Platt SANS que la re-pondération
  relative (les 2 dof propres à R4) n'apporte rien — la paire de bootstrap est
  aveugle à l'optimisme d'estimation de β, (ii) est le SEUL contrôle nested qui
  le borne par un modèle de même famille re-fit au même protocole.
- **VERT** = (i) ∧ (ii) [∧ gardes anti-mélange/signe pour le libellé/ship].
  **VERT FAIBLE** (publié tel quel, PAS un ship, PAS un claim de re-pondération)
  = (i) seul, (ii) chevauche 0 : « gain compatible avec un simple
  ré-échelonnement Platt ; la re-pondération relative N'EST PAS démontrée ».
  **ROUGE** = (i) non atteint. Pas d'orange : la question est binaire.
- **R6 — Garde de signe = drapeau de SHIP, JAMAIS la couleur** :
  `validated(position) = VERT ∧ (β₁, β₂, β₃ du fit full-data poolé tous de même
  signe que c > 0)`. La couleur VERT/ROUGE est statuée par le SEUL critère V
  ci-dessus, point ; `validated` est un drapeau de SHIP distinct, sans pouvoir
  sur la couleur ni sur le claim de calibration. Une cellule peut être
  `VERT ∧ ¬validated` (re-pondération mieux calibrée mais une composante pèse à
  l'envers, βⱼ < 0) — publiée telle quelle : « gain de calibration réel, ship
  bloqué : composante j anti-prédictive ». Le signe est lu UNE fois sur le fit
  full-data poolé, après les IC, et n'entre dans aucun IC. Aucune relecture
  post-hoc ne requalifie une couleur via la garde.

Puissance déclarée : n = 2 910 paires/position. ΔBrier est un effet de
calibration de second ordre (E3 a mesuré des |Δ| ≲ 0,002 avec des IC de
demi-largeur ≈ 0,003-0,006 par ligue) ; poolé sur 2 910 paires la demi-largeur
attendue tombe à ≈ 0,002-0,003. Un gain de re-pondération réel mais petit
(< 0,002 de Brier) pourrait sortir NON significatif et sera publié tel quel.
**R10 — multiplicité** : sous le nul et le critère V à DEUX IC unilatéraux
requis (test intersection-union — exiger deux IC sous 0 ne PEUT pas augmenter le
taux), le faux-vert PAR CELLULE est ≤ 2,5 %. Famille de 2 cellules fortement
corrélées (fullDraft ⊇ after3Picks, mêmes games) : P(≥ 1 faux vert) **bornée
par** `1 − (1−0,025)² ≈ 4,9 %`, sur-estimée (la corrélation positive la réduit) —
jamais l'égalité « 2 × 2,5 % » (qui supposerait l'indépendance, fausse ici).
Aucun ajustement formel (décision produit locale, réversible au re-run).

### 1.5 Attendus déclarés d'avance (les DEUX lectures, écrites avant le run)

- **afterBans dégénère** : features nulles ⇒ R4 intercept-only = side-only
  (base-rate), aucune re-pondération à tester ⇒ hors verdict. Descriptif
  uniquement (R4 ≈ side-only ; `ΔBrier(R4−non calibré)` = side-only vs pièce,
  effet E3 connu) — AUCUNE information sur l'hypothèse testée.
- **Si VERT** (R4 bat le modèle shippé ET le ré-échelonnement Platt) :
  l'évaluateur PORTE du signal de win que ses poids unitaires figés gaspillent —
  la re-pondération le récupère. Voir §5.
- **R7 — Si ROUGE** : re-pondérées optimalement PAR LIGUE en walk-forward, les
  trois composantes ne calibrent pas mieux que le modèle shippé. **CE run établit
  UN SEUL fait, NÉGATIF de plein droit sur la méthode R4 : la re-pondération
  linéaire des trois sous-totaux n'aide pas — R4 est sans levier sur cet
  évaluateur.** Ce n'est pas une victoire déguisée. L'attribution « le mur, ce
  sont les ENTRÉES (transfert SoloQ→pro) plutôt que les POIDS » est une
  HYPOTHÈSE que ce run ne teste PAS (il ne fait varier QUE les poids) : citée
  comme piste §5, jamais comme conclusion de R4. Aucune phrase du rapport ne
  présentera un ROUGE comme « informatif sur où va l'euro » au-delà de ce fait
  négatif strict.

### 1.6 Secondaires descriptives (pré-enregistrées, AUCUN pouvoir de verdict)

- **Δ log loss** (R4 − non calibré), poolé, par cellule — publié.
- **IC clusterisé par série** du ΔBrier primaire R4−non calibré
  (`clusterBootstrapDeltaCI`, cluster `series.matchId`), poolé, 2 cellules — la
  lecture robuste à la corrélation intra-série, sur le MÊME flux seed 42, après
  les 4 IC primaires (§1.3). Une cellule VERTE dont l'IC clusterisé recouvre 0
  le cite verbatim.
- **Per-league × position** : ΔBrier(R4 − non calibré) pour les 8 cellules
  (4 ligues × {after3Picks, fullDraft}) — DESCRIPTIF SANS POUVOIR (R5), publié
  brut, comparé aux 12 rouges E3 ; alimente la garde anti-mélange (§1.3).
- **ΔBrier(R4 − side-only)** poolé — borne « le re-pondéré bat-il le pur biais
  de side ».
- *(L'IC ΔBrier(R4 − Platt E3) n'est PAS un secondaire : R4 l'a promu en IC
  primaire CO-DÉCISIF, §1.3/§1.4.)*
- **Diagrammes de fiabilité 10 bacs** (n, meanP, taux observé + Wilson 95 %,
  gap) pour R4 et non calibré, poolé par position.

---

## 2. Design technique

### 2.1 Fichiers

| Fichier | Statut | Rôle |
|---|---|---|
| `src/lib/estimators/logisticFit.ts` | **nouveau** (pur) | `logisticFit(rows, opts)` — IRLS/Newton multi-feature, ridge L2, init 0, budget 50 ; renvoie `{ beta: number[] }` (β₀ intercept + un par feature). Même hygiène que `platt.ts` (clamp, ridge, early-stop). ZÉRO I/O. |
| `src/lib/backtest/evaluatorFeatures.ts` | **nouveau** (pur) | `evaluatorFeaturesAt(record, maxSeq, datasets) → { x1, x2, x3 } | undefined` — `roleTeamsAt` + `analyzeDraft`, lit les sous-totaux de `DraftResult` ; `standardizeFit(rows)`/`standardizeApply` (μ, σ de train, colonnes σ=0 neutralisées). ZÉRO I/O. |
| `src/lib/engine/analyzer.ts` | **existant, INTANGIBLE** | `analyzeDraft` et `DraftResult` lus tels quels — JAMAIS modifiés (les sous-totaux sont déjà exposés : `allyChampionRating.totalRating`, etc.). |
| `src/lib/backtest/sequencePositions.ts` | **existant, inchangé** | `roleTeamsAt`, `isCalibrationEligible`, `CALIBRATION_POSITIONS`. |
| `src/lib/estimators/platt.ts` | **existant, inchangé** | bras Platt du `--chain e3` (porte de validité). |
| `src/lib/backtest/{walkforward,metrics,clusterBootstrap}.ts` | **existant, inchangé** | folds, bootstrap, Wilson, Brier/logLoss. |
| `scripts/backtest/winCalibrationByLeague.ts` | **consommé, INTANGIBLE** | référence E3 de la porte de validité = le blob committé, jamais modifié. |
| `tests/logisticFit.test.ts` | **nouveau** | tests à la main (§2.3). |
| `tests/evaluatorFeatures.test.ts` | **nouveau** | tests à la main (§2.3). |
| `scripts/backtest/evaluatorReweight.ts` | **nouveau** | runner : seam `--chain e3|r4`, règle §1 en en-tête, writer E3 préservé à l'octet pour `--chain e3`, writer R4 (+ bras re-pondéré + secondaires §1.6). |
| `docs/calibration/evaluator-reweight-2026.md` | **généré** | le rapport R4. |

UNE seule classe de nouveauté côté `src/lib` : deux helpers PURS
(`logisticFit`, `evaluatorFeatures`). `analyzer.ts` n'est pas touché — la gate
LIT l'évaluateur, elle ne le réécrit pas (le ship d'un évaluateur re-pondéré,
si VERT, est un chantier produit SÉPARÉ, §5).

### 2.2 Lib pure — signatures

```ts
// logisticFit.ts  — reprend platt.ts AU CARACTÈRE PRÈS (R3)
export interface LogisticRow { x: number[]; y: 0 | 1; }
export interface LogisticFit { beta: number[]; } // [β0, β1, ...]
/** IRLS/Newton sur la log-vraisemblance ; ridge λ sur TOUTE la diagonale
 *  (intercept compris, comme platt.ts:75,77) ; init identité β₀=0, βⱼ=1 ;
 *  STEP_TOL=1e-10 ; det≤0 ⇒ break ; budget maxIter. opts littéraux EXPLICITES
 *  passés par le runner (R11), jamais les défauts. */
export function logisticFit(rows: LogisticRow[], opts: { ridge: number; maxIter: number }): LogisticFit;
export function logisticPredict(fit: LogisticFit, x: number[]): number; // σ(β0 + Σ βj xj)

// evaluatorFeatures.ts  — DraftRecord depuis src/lib/data/types, Dataset/Team depuis $lib/types (R12)
export interface EvalFeatures { x1: number; x2: number; x3: number; }
export function evaluatorFeaturesAt(record: DraftRecord, maxSeq: number, ds: { dataset: Dataset; fullDataset: Dataset }): EvalFeatures | undefined;
export interface Standardizer { mu: number[]; sd: number[]; kept: boolean[]; } // sd[j] ≤ 1e-9 ⇒ kept[j]=false, colonne EXCLUE (R8)
export function standardizeFit(rows: number[][]): Standardizer;
export function standardizeApply(s: Standardizer, x: number[]): number[]; // ne renvoie que les colonnes retenues
```

### 2.3 Tests (calculés à la main)

`logisticFit` : (1) données parfaitement séparées par x₁ ⇒ β₁ > 0, prédictions
montent avec x₁ ; (2) colonne exclue par `standardizeFit` (σ ≤ 1e-9) absente du
design ⇒ pas de NaN, pas de βⱼ fantôme ; (3) cas dégénéré toutes-colonnes-exclues
⇒ intercept-only = base-rate (log-odds du taux de 1) ; (4) **ANCRE R4↔E3 EXACTE**
(load-bearing) : sur une seule feature `z = logit(p)`, `logisticFit([{x:[z],y}],
{ridge:1e-6,maxIter:50}).beta` égale `[plattFit(pairs).a, plattFit(pairs).b]` à
**1e-12** — exact par construction car init identité (β₀=0, β₁=1) = init Platt
(a=0, b=1), ridge sur toute la diagonale, STEP_TOL, det-break, budget identiques
⇒ itérés bit-à-bit identiques ; testé sur ≥ 3 jeux dont UN quasi-séparable
(b reste capé) et UN à `z` constant (b=1, intercept = logit du taux) ;
(5) déterminisme bit-à-bit (même entrée → même β).

`evaluatorFeatures` : (1) `x₁+x₂+x₃ = analyzeDraft(...).totalRating` sur un état
synthétique (sideOffset=0) ; (2) `afterBans` (0 pick) ⇒ x₁=x₂=x₃=0 ;
(3) anti-fuite : les features d'une game ne dépendent que de son propre draft +
des snapshots gelés, jamais du train (le walk-forward n'agit QUE sur β) ;
(4) `roleTeamsAt` undefined ⇒ feature undefined (record écarté, pas deviné).

`standardize` : moyenne/écart-type de train exacts ; σ=0 ⇒ colonne à 0 ;
`standardizeApply` sur test utilise les μ,σ de train.

Gate locale : `node node_modules/vitest/vitest.mjs run tests/logisticFit.test.ts
tests/evaluatorFeatures.test.ts` vert (parc complet en fin de chantier).

### 2.4 Runner — `scripts/backtest/evaluatorReweight.ts`

CLI (copie du patron E3 + seam `--chain`) :

```
node --experimental-transform-types --no-warnings scripts/backtest/evaluatorReweight.ts \
  --chain e3|r4 \
  [--seed 42] [--generated-at ISO] [--out docs/calibration/evaluator-reweight-2026.md] \
  [--smoke] [--expected-sha256-current X --expected-sha256-full Y  # smoke fixtures only]
```

Structure (copie E3, deltas en gras) :
1. Charge 8 corpus (assert ligue/unicité gameId), sha-vérifie les snapshots
   (abort sinon ; « override de hash : aucun »).
2. Par ligue : timeline `groupByPatch`, assert chronologie monotone, `walkForward`
   `minTrainSize = 50`.
3. Par (ligue, fold, position) : cache `r = analyzeDraft(...)` partagé ;
   **en `--chain r4`, extrait `[x₁,x₂,x₃]`, `standardizeFit` sur train,
   `logisticFit`, `p_fit` sur test** ; bras non calibré/pièce/side-only E3.
   **En `--chain e3`, le bras calibré = `plattFit`/`plattApply` E3 exact** (la
   porte de validité).
4. Agrège : paires de test poolées (R4) + per-league ; `brier`/`logLoss`/
   `reliabilityBins` ; **IC primaires `bootstrapDeltaCI` puis secondaires
   `clusterBootstrapDeltaCI` sur le flux seed 42 dans l'ordre gelé §1.3/§1.6**.
5. Writer : **`--chain e3` réutilise le writer E3 à l'octet** (porte de
   validité) ; `--chain r4` = nouveau writer (verdict 2 cellules + couverture
   §1.2 + secondaires §1.6). Byte-stable à seed/`--generated-at`.
6. `--smoke` **(ajout R4, absent du patron E3, R12)** : un mini-corpus
   synthétique, timing + couverture, AUCUN taux.

### 2.5 Coût

`analyzeDraft` est appelé une fois par (game éligible × 3 positions) = ~9 700
appels, négligeable (E3 le faisait déjà). `logisticFit` = ~20 itérations IRLS
sur ≤ ~1 200 lignes × 4 colonnes par fold, trivial. Total ≈ coût E3 × 2 (replay
de validité + run R4). Mono-thread, quelques minutes.

---

## 3. Fuites et risques de fishing (canaux NOUVEAUX ; le §3 E3 reste en vigueur)

| Canal | Risque | Neutralisation |
|---|---|---|
| **Ajustement de β sur le test** | β verrait l'issue qu'il prédit | `walkForward` strict : β ajusté sur les patchs < k de la LIGUE seuls ; la game testée n'entre jamais dans son propre fit (test §2.3-3) — exactement la discipline E3, β remplace (a,b). |
| **Standardisation fuyante** | μ,σ calculés sur train+test | μ,σ de TRAIN seuls, appliqués au test (test `standardize`) — comme tout pré-traitement walk-forward. |
| **Anachronisme du dataset** | features issues du snapshot patch-courant sur games passées | INCHANGÉ E3/coach : population SoloQ disjointe du corpus pro, bruit symétrique entre les deux sides d'une game (la cible est `won=blue`, le biais n'est pas lié au side) ; un écho « méta future » reste possible — borné par le fait que R4 ne peut pas faire MIEUX que ce que les features portent, et le bras side-only/pièce encadrent. La gate teste les POIDS, pas la fraîcheur des entrées. **R7** : un ROUGE n'inculpe RIEN d'autre que la re-pondération linéaire testée ici ; il n'« inculpe les entrées » qu'au titre d'une hypothèse non testée renvoyée à un run futur (§5). |
| **Optimisme d'estimation de β (R4)** | 4 params ajustés vs 0 param figé : la paire de bootstrap est aveugle à l'optimisme hors-échantillon de β, du même ordre que l'effet visé (< 0,002) | Critère V à DEUX IC (§1.4) : (ii) `R4 − Platt` co-décisif borne l'optimisme par un modèle de MÊME famille (Platt, re-fit au même protocole walk-forward) — un VERT exige de battre le ré-échelonnement, pas seulement le modèle figé. |
| **Multiplicité** | 2 cellules à pouvoir + nombreuses lectures sans pouvoir | 2 cellules primaires exhaustives ; sous le critère à 2 IC, faux-vert/cellule ≤ 2,5 %, P(≥1) bornée par ≈ 4,9 % (R10), jamais « 2×2,5 % ». Les 8 per-league, les gardes (signe, anti-mélange), vs side-only, IC clusterisés sont SANS pouvoir (§1.3 R5, §1.4 R6) — aucune n'entre dans le budget d'erreur de verdict ; publiées brutes pour la dispersion. |
| **Choix du comparateur** | comparer à la pièce gonflerait un faux vert | Le verdict est vs **non calibré = modèle shippé** (i, le plus dur) ET vs **Platt** (ii, co-décisif) ; side-only/pièce descriptifs seulement. Choix figé avant le run, irrévocable. |
| **Corrélation de série** | IC apparié par game anticonservateur | déclaré ; lecture robuste = IC clusterisé secondaire (§1.6), même seed. |

**Anti-fishing** : UNE règle, UN run — features (les 3 sous-totaux de
`DraftResult`, AUCUNE features dérivée ajoutée), standardisation, `λ=1e-6`,
budget 50, `minTrainSize=50`, seed 42, 2 cellules, comparateur = modèle shippé,
tout gelé ici, en-tête = §1 verbatim, commit avant run. Porte de validité avant
tout (rien de nouveau révélé). Smoke aveugle. Échec structurel assumé (effet
< MDE) publié tel quel.

---

## 4. Plan d'implémentation pas-à-pas

Chaque étape committable isolément ; rien ne lit une métrique avant l'étape 6.
Les RUNS sont l'ARCHITECTE seul — interdits aux agents.

1. **Lib pure** `logisticFit.ts` + `evaluatorFeatures.ts` + tests §2.3 (dont
   l'ancre §2.3-4 : `logisticFit` reproduit `plattFit` sur une feature). Gate :
   tests ciblés verts.
2. **Runner** `evaluatorReweight.ts` : copie du patron E3, seam `--chain`,
   writer E3 préservé à l'octet, writer R4. Test : `--smoke --chain r4` sur
   mini-corpus (couverture + zéro métrique, rendu byte-stable).
3. **Gel** : recopier §1 (post-revue) dans l'en-tête, commit « gate évaluateur
   re-pondéré : règle pré-enregistrée » AVANT tout run réel.
4. **Porte de validité (architecte)** : sha vérifiés ; `--chain e3 --seed 42
   --generated-at 2026-06-11T19:23:25.422Z --out data/tmp/e3-replay.md` ; diff
   byte-identique vs `docs/calibration/win-calibration-by-league.md` exigé
   (repli §1.0 sinon). Aucun chiffre nouveau lu.
5. **Smoke aveugle (architecte)** : `--chain r4 --smoke`.
6. **LE run (architecte)** : `--chain r4 --seed 42 --out
   docs/calibration/evaluator-reweight-2026.md`. Publier tel quel.
7. **Suites du verdict (§5)** : STATUS + scorecard + UI/chantier de ship selon
   la couleur — commit séparé.

---

## 5. Ce que le verdict change

### Si VERT (critère V à 2 IC : R4 bat le modèle shippé ET Platt, ≥ 1 cellule, gardes satisfaites)

- **Claim** (nombres du rapport, rien d'autre) : « Sur N drafts pro 2025-2026
  rejouées en walk-forward, re-pondérer les trois composantes différentielles de
  l'évaluateur (au lieu des poids unitaires figés) améliore la calibration du %
  affiché de X de Brier [IC apparié], y compris vs le simple ré-échelonnement
  Platt (Y, IC co-décisif). » Corrélation, calibration — pas une prédiction de
  vainqueur. (Si VERT FAIBLE — (ii) chevauche 0 — le mot « re-pondérer » tombe :
  claim « évaluateur recalibré », pas de ship.)
- **Chantier de ship SÉPARÉ** : introduire les poids ajustés dans l'évaluateur
  (config de référence DA-V2-6) — re-passe TOUTES les gates aval (calibration,
  navigator). `analyzer.ts` reste intangible jusqu'à ce chantier gelé à part.
- **Rouvre la ligne COACH** : le verdict fondateur n°3 (évaluateur suspect) est
  levé en partie — re-tenter la gate A-coach avec l'évaluateur re-pondéré
  devient le candidat run #5 n°1 (NOUVELLE règle).

### Si ROUGE (R4 ne bat pas le modèle shippé)

- **Verdict terminal pour l'évaluateur SoloQ** : ce ne sont pas les poids. Même
  optimalement combinées, les features SoloQ→pro ne portent pas le signal de win
  pro. Aucun re-tuning de cette règle.
- **Redirige (NOUVELLE règle, projet de DONNÉES, pas un run de re-tune)** : la
  seule voie restante est de changer les ENTRÉES — features ancrées sur des
  issues PRO (drafts pro elles-mêmes, pas SoloQ), p. ex. winrates pro
  champion/rôle walk-forward, ou un modèle entraîné sur le corpus pro. C'est un
  chantier de sourcing/modélisation, chiffré et gelé à part.
- Le rapport est publié tel quel : un ROUGE à features documentées dit OÙ le
  prochain euro va — vers les données, pas vers l'arithmétique.

> **Clôture de scope (R7/NH2)** : RIEN du §5 ne s'exécute dans le commit du run
> R4 (étape 6 du §4). Les suites — ship d'un évaluateur re-pondéré, re-run de la
> gate coach, projet de features pro — sont chacune une NOUVELLE règle gelée,
> chantier séparé, commit séparé (étape 7). Aucun retuning ne bave dans R4.

---

*Rédigé le 2026-06-15 (chantier R4, design run #4). Données d'appui lues avant
rédaction — code committé, jamais supposé : `analyzeDraft`/`DraftResult`
(`src/lib/engine/analyzer.ts:249-289` — modèle Elo additif à poids 1 figés,
lien `ratingToWinrate` pente `ln10/400`, sous-totaux exposés) ;
`isCalibrationEligible`/`roleTeamsAt`/`CALIBRATION_POSITIONS`
(`sequencePositions.ts`) ; `plattFit` (`platt.ts` — Newton/log loss, l'ancre du
test §2.3-4) ; `walkForward`/`groupByPatch` (`walkforward.ts`) ;
`bootstrapDeltaCI`/`clusterBootstrapDeltaCI`/`brier`/`logLoss`/`wilson95`
(`metrics.ts`, `clusterBootstrap.ts`) ; règle E3 et timelines
(`scripts/backtest/winCalibrationByLeague.ts`,
`docs/calibration/win-calibration-by-league.md` : 2 910 paires/position, 12
rouges, ΔBrier ICs chevauchant 0).*
