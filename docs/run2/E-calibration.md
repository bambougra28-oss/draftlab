# Chantier E — Calibration Platt par position de séquence — Design run #2

> GELÉ post-revue adversariale (2026-06-11) — règle définitive, aucun paramètre ne bouge après ce commit.

> Objectif : rendre honnêtes les % affichés (WinrateBar « Win % estimé (draft) »,
> `winAfter` du coach). Doctrine : ARCHITECTURE_V2 §6.8 (Platt 2 paramètres, par
> fenêtre de patch, jamais isotonique), recherche `2026-06_methodologie_draft.md`
> §6 ((a,b) séparés pour « après bans », « après 3 picks », « draft complète »),
> DA-V2-6 (config injectable), DA-V2-11 (pas de ship sans métrique, badge sinon),
> DA-V2-12 (composants séparés). Patron de script : `scripts/backtest/postdiction.ts`.
>
> État audité (2026-06-11) : `src/lib/estimators/platt.ts` EXISTE et est correct —
> fit Newton sur le log loss, clamp 1e-6, 50 itérations, ridge 1e-6, init (0,1) ;
> `tests/estimators.platt.test.ts` le couvre avec des valeurs dérivées à la main
> (identité, b = 0,5 exact, biais pur dans a, données séparables, baisse du log
> loss). Ce qui manque : le bucketing par position, le branchement walk-forward,
> l'artefact de config, l'intégration UI. Le module numérique ne change PAS.

---

## 1. Règle pré-enregistrée

Le bloc ci-dessous est rédigé pour être gelé TEL QUEL dans l'en-tête de
`scripts/backtest/winCalibration.ts` avant tout run. UNE règle, UN run, aucun
paramètre modifié après lecture des résultats.

```
RÈGLE PRÉ-ENREGISTRÉE — Calibration Platt par position de séquence (chantier E, run #2).
Gelée le 2026-06-11 AVANT toute exécution sur données réelles. Un rouge se documente, ne se retune pas.

CORPUS (7 fichiers, fixés — LCK 2025 indisponible, exclu par construction ; l'ajouter
plus tard = NOUVEAU run de réplication, jamais une fusion silencieuse) :
  static/corpus/lck-2026.json · lec-2026.json · lfl-2026.json · lpl-2026.json
  data/corpus/lec-2025.json · lfl-2025.json · lpl-2025.json

ÉLIGIBILITÉ (un SEUL ensemble, partagé par les trois positions) : un record est
éligible ssi (a) winner défini, (b) 10 picks rôle-complets — clé résolue + rôle
présent + pas de rôle dupliqué par side, même règle compOf que postdiction G1 —,
(c) patch parsable (parsePatch). Tout record écarté est compté dans les notes.

PRÉDICTEUR BRUT (la chose calibrée = le pipeline shippé, config du coach) :
  p_raw(g, pos) = analyzeDraft(dataset, blue(g,pos), red(g,pos),
      { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 },
      fullDataset).winrate          // = P(victoire BLEUE), aucune autre option
  - Équipes = rôles RÉELS du corpus (Map rôle→champion), préfixe par seq :
      afterBans    : actions seq ≤ 6   (0 pick par side — p_raw ≡ 0,5 par construction)
      after3Picks  : actions seq ≤ 9   (1 pick premier side, 2 picks second side)
      fullDraft    : actions seq ≤ 20  (5 + 5)
  - Aucun playerContext, aucun sideContext (config « plain » du coach, +page.svelte).
  - Datasets : snapshot DraftGap CDN (current-patch.json + 30-days.json) tiré et
    HASHÉ (sha256 publiés dans le rapport) AVANT le run ; jamais re-tiré ensuite.
  Cible : won = (winner === 'blue').

PROTOCOLE : timeline POOLÉE des 7 corpus (les patchs 25.x précèdent tous les 26.x),
groupByPatch / walkForward (src/lib/backtest/walkforward.ts), minTrainSize = 50
records. Par fold (= patch testé) et PAR POSITION :
  (a,b) = plattFit(paires du train)   // module gelé src/lib/estimators/platt.ts
  prédiction de test = plattApply((a,b), p_raw)
Trois bras par position : CALIBRÉ σ(a+b·logit(p_raw)) · NON CALIBRÉ p_raw ·
PIÈCE p = 0,5. Quatrième bras DESCRIPTIF (contexte, sans pouvoir de verdict) :
side-only = winrate blue du train (baseline M3.5 du protocole).

TIMELINE ATTENDUE (gelée — ordre groupByPatch/comparePatches des 7 corpus, 26 groupes) :
  14.16 → 25.S1.1 → 25.S1.2 → 25.S1.3 → 25.04 → 25.06 → 25.07 → 25.08 → 25.09
  → 25.10 → 25.11 → 25.14 → 25.15 → 25.16 → 25.17 → 25.18 → 26.01 → 26.02 → 26.03
  → 26.04 → 26.06 → 26.07 → 26.08 → 26.09 → 26.10 → 26.11
  Note de parsing : '25.S1.x' parse {25,0} (le « S » interrompt le minor) et
  s'ordonne par le fallback lexical de comparePatches — placement correct ICI par
  construction des données, vérifié par l'assertion croisée ordre-patch vs
  chronologie du script (abort avant toute métrique sinon). Note de couverture :
  le groupe 14.16 (11 records, tous lfl-2025) ouvre la timeline en train-only
  sous minTrainSize = 50.

MÉTRIQUES PUBLIÉES par position, sur les paires de test poolées : Brier, log loss,
accuracy des trois bras ; diagramme de fiabilité 10 bacs (n, meanP, taux observé
avec Wilson 95 % par bac, gap) pour CALIBRÉ et NON CALIBRÉ.

CRITÈRE DE VERDICT (primaire, indépendant par position) :
  ΔBrier = Brier(calibré) − Brier(non calibré), IC bootstrap 95 % APPARIÉ par game
  (1000 resamples, mulberry32(seed 42), ordre des IC fixe : afterBans Brier,
  afterBans logLoss, after3Picks Brier, after3Picks logLoss, fullDraft Brier,
  fullDraft logLoss).
  VERT ssi ci95.hi < 0 (le Brier calibré est significativement meilleur).
  Δ log loss : publié, secondaire, descriptif seulement.
GARDE SUPPLÉMENTAIRE : une position n'est validée que si, AU FIT FINAL, b > 0
(une calibration qui inverse l'ordre violerait le contrat « ne touche pas au tri »).

ATTENDU DÉCLARÉ D'AVANCE : à afterBans, p_raw ≡ 0,5 (l'évaluateur ne voit ni les
bans ni le side) ⇒ la calibration y dégénère en side-only (b sans information,
a = logit du taux blue du train). Le verdict 2026 « side-only ≈ pile-ou-face »
rend un ROUGE probable sur cette position ; ce rouge serait une CONFIRMATION
d'honnêteté (le 50 % affiché après bans est déjà honnête), pas un échec.

PARAMS SHIPPÉS : l'artefact data/calibration/winCalibration.json est TOUJOURS
écrit à l'issue du run, quel que soit le verdict — un fit par position sur la
TOTALITÉ des paires éligibles des 7 corpus (full-fit standard, déclaré ici, jamais
utilisé pour les métriques) : { a, b, nTrain, validated } par position +
provenance (corpora, nGames, fittedThroughPatch, sha256 des datasets, generatedAt,
seed). « Shippé/appliqué par l'UI » = validated:true par position, avec
validated = (verdict VERT) ∧ (b_final > 0) ; un verdict tout-rouge produit donc
un JSON tout validated:false. L'UI n'applique JAMAIS une position validated:false.

LIMITE DOCUMENTÉE (reprise verbatim dans le rapport) : le snapshot SoloQ est
« d'aujourd'hui » et évalue des games 2025-2026 (fuite de features M3.x connue).
Elle contamine p_raw À L'IDENTIQUE dans les bras calibré et non calibré (comparaison
appariée interne valide) ; le claim autorisé porte sur la CARTE DE CALIBRATION,
jamais sur la force prédictive de l'évaluateur. Aucun « on prédit le vainqueur ».

DEUX APPROXIMATIONS D'APPLICATION (déclarées ici, reprises dans le rapport et
l'aide produit) :
  (a) la calibration est mesurée aux trois ancres 0 / 3 / 10 picks verrouillés ;
      une position intermédiaire reçoit la carte de l'ancre que la partition
      positionOf lui assigne (0 → afterBans ; 1..6 → after3Picks ; 7..10 →
      fullDraft), jamais une interpolation ;
  (b) à l'application, le % du coach passe par des rôles INFÉRÉS et le mode
      séquence par l'argmax des rolePriors, alors que la mesure utilise les
      rôles RÉELS du corpus — l'écart d'attribution de rôles n'est pas couvert
      par le claim.
```

Constantes annexes gelées avec la règle : sortie rapport
`docs/calibration/win-calibration-2026.md` ; bornes des positions
afterBans/after3Picks/fullDraft = seq 6/9/20 du `DRAFT_TEMPLATE`
(`src/lib/data/draftRecord.ts:39-60`) ; clamp/itérations/ridge = ceux du module
`platt.ts` existant, non modifiables ; `reliabilityBins(pairs, 10)` de
`src/lib/backtest/metrics.ts`.

### Baselines

| Bras | Définition | Rôle |
|---|---|---|
| Non calibré | `p_raw` tel quel | comparateur du verdict (ΔBrier) |
| p = 0,5 | constante | plancher d'honnêteté (Brier 0,25, log loss ln 2) |
| side-only | winrate blue du train, walk-forward | contexte M3.5, descriptif — c'est aussi exactement ce en quoi dégénère Platt à afterBans |

---

## 2. Design technique

### 2.1 Vue d'ensemble

```
scripts/data/pullDataset.ts          (nouveau, I/O)  → data/datasets/*.json + sha256
scripts/backtest/winCalibration.ts   (nouveau, I/O)  → rapport + params JSON
src/lib/backtest/sequencePositions.ts (nouveau, PUR) → préfixes + éligibilité
src/lib/estimators/platt.ts          (EXISTANT, gelé)
src/lib/estimators/winCalibration.ts (nouveau, PUR)  → application produit (a,b)
data/calibration/winCalibration.json (nouveau, config DA-V2-6, placeholder puis généré)
UI : +page.svelte (WinrateBar), CoachPanel.svelte, help/+page.svelte
```

### 2.2 `src/lib/backtest/sequencePositions.ts` (pur, testé à la main)

```ts
export const CALIBRATION_POSITIONS = [
    { id: 'afterBans',   maxSeq: 6 },
    { id: 'after3Picks', maxSeq: 9 },
    { id: 'fullDraft',   maxSeq: 20 }
] as const;
export type CalibrationPositionId = (typeof CALIBRATION_POSITIONS)[number]['id'];

export interface PositionTeams { blue: Team; red: Team; }

/**
 * Équipes rôle-clé du préfixe seq ≤ maxSeq (rôles RÉELS du corpus).
 * undefined si un pick du préfixe a une clé vide, pas de rôle, ou un rôle
 * dupliqué côté side — le record n'est alors pas scorable (jamais deviné).
 */
export function roleTeamsAt(record: DraftRecord, maxSeq: number): PositionTeams | undefined;

/** Éligibilité gelée : winner + 10 picks rôle-complets + patch parsable. */
export function isCalibrationEligible(record: DraftRecord): boolean;
```

`roleTeamsAt(record, 20)` reproduit le `compOf` de `postdiction.ts` (même
sémantique d'exclusion) ; les préfixes en sont la généralisation par `seq`.
Les bans n'entrent jamais dans les équipes (l'évaluateur ne les lit pas).

### 2.3 `src/lib/estimators/winCalibration.ts` (pur) + config JSON

```ts
export type CalibrationPosition = 'afterBans' | 'after3Picks' | 'fullDraft';

export interface PositionParams { a: number; b: number; nTrain: number; validated: boolean; }

export interface WinCalibrationConfig {
    version: 1;
    generatedAt: string;                 // injecté par le script, jamais d'horloge ici
    corpora: string[];
    nGames: number;                      // games éligibles du fit final
    fittedThroughPatch?: string;
    dataset?: { version: string; date: string; sha256Current?: string; sha256Full?: string };
    positions: Record<CalibrationPosition, PositionParams | null>;
}

/**
 * Partition gelée par picks verrouillés : 0 → afterBans ; 1..6 → after3Picks ;
 * 7..10 → fullDraft (dès qu'une info de pick existe, la carte afterBans —
 * dégénérée en side-only — ne s'applique plus).
 */
export function positionOf(picksLocked: number): CalibrationPosition;

export interface CalibratedWin {
    pAlly: number;                       // la valeur à AFFICHER (perspective alliée)
    calibrated: boolean;                 // true ssi params présents ET validated
    position: CalibrationPosition;
    nGames?: number;                     // pour le badge « Calibré sur N games »
}

/**
 * Application en ESPACE BLEU (le `a` est ancré bleu) :
 *   pBlue = allySide === 'blue' ? pAllyRaw : 1 − pAllyRaw
 *   pBlueCal = plattApply({a, b}, pBlue)            // σ(a + b·logit(pBlue))
 *   pAlly = allySide === 'blue' ? pBlueCal : 1 − pBlueCal
 * Position non validée ou config nulle ⇒ passthrough { pAlly: pAllyRaw, calibrated: false }.
 * Monotonie : b > 0 ⇒ strictement croissante en p_raw ⇒ le TRI de candidats
 * évalués à la même position est INVARIANT (déclaré ; garde b > 0 au fit final).
 */
export function calibrateAllyWin(
    pAllyRaw: number,
    allySide: DraftSide,
    picksLocked: number,
    config?: WinCalibrationConfig | null   // défaut : data/calibration/winCalibration.json importé
): CalibratedWin;
```

`data/calibration/winCalibration.json` est commité dès l'implémentation en
PLACEHOLDER (`positions: { afterBans: null, after3Picks: null, fullDraft: null }`)
pour que le build et l'UI existent avant le run — tout reste « non calibré ».
Le script l'écrase après le run. Import statique relatif, même mécanisme que
`data/championTags.json` (`src/lib/tags/index.ts:7`).

Le piège neutralisé ici : `a` capture le biais bleu. Appliquer (a,b) directement
sur un `p_raw` perspective-rouge inverserait le bonus de side
(σ(a + b·logit(1−p)) ≠ 1 − σ(a + b·logit(p)) dès que a ≠ 0). D'où le
passage obligatoire en espace bleu, verrouillé par un test à la main.

### 2.4 `scripts/data/pullDataset.ts` (nouveau, I/O)

Tire `PATCH_DATASET_URL` et `FULL_DATASET_URL` (`src/lib/dataset/fetch.ts:14-15`)
en Node, écrit `data/datasets/current-patch-<date>.json` et
`data/datasets/30-days-<date>.json`, imprime taille + sha256 + `version`/`date`
du Dataset. `data/datasets/` entre dans `.gitignore` (~50 Mo) ; les hashes vivent
dans le rapport commité — la reproductibilité passe par le hash, pas par le blob.

### 2.5 `scripts/backtest/winCalibration.ts` (nouveau — patron postdiction.ts)

En-tête = règle du §1, telle quelle. Mêmes hooks node (`registerHooks`, résolution
`$lib/`, loader JSON), mêmes conventions argv :

```
node --experimental-transform-types --no-warnings scripts/backtest/winCalibration.ts \
  static/corpus/lck-2026.json static/corpus/lec-2026.json static/corpus/lfl-2026.json \
  static/corpus/lpl-2026.json data/corpus/lec-2025.json data/corpus/lfl-2025.json \
  data/corpus/lpl-2025.json \
  --dataset data/datasets/current-patch-<date>.json \
  --full-dataset data/datasets/30-days-<date>.json \
  [--seed 42] [--generated-at ISO] \
  [--out docs/calibration/win-calibration-2026.md] \
  [--params-out data/calibration/winCalibration.json]
```

Déroulé interne :
1. Charge les 7 corpus, filtre `isCalibrationEligible`, compte les écartés.
2. Assertion d'unicité des `gameId` sur l'union des 7 corpus chargés — abort si
   doublon (le cache ci-dessous est indexé par `gameId`, une collision silencieuse
   croiserait deux games). Puis pré-calcule `p_raw` par (game, position) UNE
   fois — cache `Map<gameId, Record<CalibrationPositionId, number>>` (l'évaluateur
   est déterministe ; ~7 800 appels `analyzeDraft`, quelques secondes).
3. AVANT tout scoring, assertion croisée ordre-patch vs chronologie sur les
   groupes `groupByPatch` des éligibles : pour chaque paire de groupes
   consécutifs, min(date) du groupe suivant ≥ min(date) du groupe courant ;
   tout échec = abort AVANT toute métrique (c'est elle qui vérifie en
   particulier le placement lexical des 25.S1.x de la TIMELINE ATTENDUE du §1).
4. Par position : `walkForward(eligible, { fit: train → plattFit(pairesDe(train)),
   predict: (params, g) → plattApply(params, rawDe(g)), outcome: g → winner === 'blue',
   minTrainSize: 50 })` sur la timeline poolée ; bras non calibré
   (`fit: () → null, predict: (_, g) → rawDe(g)`), pièce (`predict: () → 0.5`) et
   side-only (`fit: train → taux blue`) sur les MÊMES items — paires alignées
   index à index, le chemin apparié de `bootstrapDeltaCI` s'applique.
5. Six IC bootstrap dans l'ordre gelé, un seul flux `mulberry32(seed)`.
6. Rapport markdown : tables par position (3 bras + side-only), deltas + IC +
   verdict, fiabilité 10 bacs (raw et calibré, Wilson par bac), couverture
   (records, éligibles, écartés, folds, timeline ordonnée des folds — groupes
   train-only en tête, dont 14.16 —, taille du premier fold), hashes datasets,
   seed, caveat M3.x verbatim. Lignes par corpus DESCRIPTIVES (paires de test
   filtrées par fichier source).
7. Fit final full-data par position → `--params-out`, TOUJOURS écrit (tout-rouge
   ⇒ trois positions `validated:false`) avec `validated = vert ∧ b > 0` ; jamais
   réécrit à la main.

Aucune logique de scoring nouvelle dans la lib backtest : `walkforward.ts`,
`metrics.ts`, `platt.ts` suffisent — le script ne fait qu'assembler (le patron
postdiction l'autorise explicitement, la pièce pure nouvelle étant §2.2/§2.3).

### 2.6 Intégration produit (après le run, pilotée par le JSON)

- **`+page.svelte` / WinrateBar** : la page calcule
  `calibrateAllyWin(result.winrate, allySide, picksLocked)` UNIQUEMENT quand
  `playerContext` et `sideContext` sont tous deux `undefined` (la config mesurée).
  `picksLocked` = picks non nuls des deux sides. La WinrateBar n'a AUJOURD'HUI
  aucun badge (affichage pur : valeur + libellé) ; l'étape 5 du plan AJOUTE le
  badge dans ses deux états : « Non calibré » (placeholder, position non validée)
  et « Calibré sur N games (7 corpus, walk-forward) » si `calibrated`. WinrateBar
  reste affichage pur : il reçoit la valeur finale + le libellé du badge.
  Contexte actif (side/comfort) ⇒ raw + badge « Non calibré » : cette
  configuration n'est PAS couverte par le claim (V1, limitation déclarée).
- **CoachPanel / `winAfter`** : calibration à l'AFFICHAGE seulement. Le navigator
  et `liveDraft.ts` ne changent pas (le tri reste sur les valeurs brutes ; la
  monotonie déclarée garantit l'équivalence du tri à position égale). Le panel
  reçoit `calibration` + `picksLocked` ; chaque candidat affiche
  `calibrateAllyWin(winAfter, ourSide, picksLockedAprès)` où
  `picksLockedAprès = picksLocked + (actionType === 'pick' ? 1 : 0)` ;
  l'écart affiché entre candidats est recalculé sur les valeurs calibrées
  (arithmétique d'affichage, ordre inchangé). Approximation déclarée : la valeur
  expectimax mélange des feuilles un peu plus profondes que l'ancre — assumé,
  trois ancres mesurées seulement. Le bandeau « Expérimental — non calibré »
  (`CoachPanel.svelte:52`) devient « Expérimental — % calibrés sur N games »
  quand `fullDraft` ou `after3Picks` est validé (le moteur de RECOMMANDATION
  reste expérimental — seul le % change de statut, DA-V2-12 : composants séparés).
- **`help/+page.svelte`** : l'entrée « Badges » (`help/+page.svelte:193-198`)
  documente le nouveau badge et ce qu'il signifie exactement (« quand l'outil
  affiche X %, la fréquence observée sur corpus walk-forward tombe dans le bac
  correspondant — il ne prédit toujours pas le vainqueur »), ainsi que les deux
  approximations d'application déclarées au §1 : entre les ancres 0/3/10 picks,
  c'est la carte de l'ancre assignée par la partition `positionOf` qui
  s'applique ; et le % du coach passe par des rôles inférés (le mode séquence
  par l'argmax des rolePriors) là où la mesure utilise les rôles réels du corpus.

### 2.7 Tests (calculés à la main, `tests/`)

- `tests/sequencePositions.test.ts` : record synthétique 20 actions →
  `roleTeamsAt` à seq 6/9/20 (tailles 0+0, 1+2, 5+5) ; rejets : rôle manquant,
  rôle dupliqué, clé vide ; `isCalibrationEligible` sur les 4 cas (ok, sans
  winner, sans patch, picks incomplets).
- `tests/estimators.winCalibration.test.ts` :
  - `positionOf` aux bornes : 0→afterBans, 1 et 6→after3Picks, 7 et 10→fullDraft ;
  - symétrie espace bleu, valeur à la main : (a=0,2, b=0,7), ally rouge,
    `pAllyRaw = 0,6` ⇒ pBlue = 0,4, logit = ln(2/3) ≈ −0,405465,
    σ(0,2 − 0,283826) = σ(−0,083826) ≈ 0,479056 ⇒ `pAlly ≈ 0,520944` ;
    et l'identité ally-bleu ⇒ `plattApply` directement ;
  - passthrough : config nulle, position `null`, `validated:false` ⇒
    `pAlly === pAllyRaw`, `calibrated:false` ;
  - monotonie : b > 0 ⇒ ordre de 3 p_raw conservé après calibration.
- Smoke de plomberie du script sur un MINI-CORPUS SYNTHÉTIQUE
  (`tests/fixtures/calibration/synthetic.json`, ~12 games, 3 patchs, issues
  connues) — jamais sur données réelles avant LE run.

---

## 3. Analyse des fuites (leakage) et du fishing — et comment le design les neutralise

| # | Risque | Neutralisation |
|---|---|---|
| 1 | **Fuite temporelle outcome → (a,b)** (fitter la calibration sur des games qu'elle score) | `walkForward`/`groupByPatch` : fit sur patchs strictement antérieurs, 25.x < 26.x numérique, records sans patch écartés et comptés ; `minTrainSize` 50 ; le premier patch n'est jamais scoré. |
| 2 | **Fuite de features du dataset SoloQ** (snapshot 2026-06 évaluant des games 2025-2026) | Non éliminable (limitation M3.x documentée) mais NEUTRE pour le verdict : les deux bras comparés (calibré / non calibré) consomment le MÊME `p_raw`, la comparaison appariée est interne ; le claim porte sur la carte de calibration, le caveat est gelé dans la règle et recopié dans le rapport. Snapshot tiré et hashé AVANT le run, jamais rafraîchi après. |
| 3 | **Fishing de positions** (« ajouter des positions jusqu'à un vert ») | Les trois positions viennent de la recherche §6 (antérieure au chantier), listées exhaustivement dans la règle ; aucune position ne peut être ajoutée/retirée post-résultats. Verdicts par position INDÉPENDANTS et tous publiés. |
| 4 | **Fishing de protocole** (clamp, itérations, bins, seed, minTrain, métrique du verdict) | Tout est gelé : module `platt.ts` inchangé (ses tests à la main figent EPS/itérations/ridge), 10 bacs, seed 42, 1000 resamples, ordre des IC fixe, minTrain 50, verdict = ΔBrier uniquement (le log loss est déclaré secondaire AVANT le run — pas de « pick the significant one »). |
| 5 | **Double-dip du fit final** (shipper des params puis citer leurs résidus) | Le full-fit de déploiement est déclaré d'avance et n'alimente AUCUNE métrique ; toutes les métriques publiées sont walk-forward. Standard validate-procedure-then-fit-all. |
| 6 | **Gestion de surprise post-hoc sur afterBans** | Le comportement dégénéré (p_raw ≡ 0,5 ⇒ Platt ≡ side-only) et le rouge probable sont DÉCLARÉS dans la règle, avec leur lecture (« 50 % après bans est déjà honnête »). Aucune narration à inventer après coup. |
| 7 | **Asymétrie de side à l'application** (a ancré bleu appliqué en espace allié) | `calibrateAllyWin` impose l'aller-retour espace bleu ; test à la main §2.7. Sans ça, le badge « calibré » serait FAUX précisément pour les drafts side rouge. |
| 8 | **Inversion du tri** (b ≤ 0 pathologique rendrait la calibration non monotone croissante) | Garde gelée : `validated` exige b > 0 au fit final ; le tri du coach reste de toute façon sur les valeurs brutes (calibration à l'affichage), l'invariance à position égale est déclarée et testée. |
| 9 | **Cherry-picking d'éligibilité** (ensembles différents par position) | Un seul ensemble éligible pour les trois positions, règle compOf héritée de postdiction G1, écartés comptés. |
| 10 | **Hétérogénéité des ligues** (param unique sur 7 corpus) | Assumé et déclaré : l'artefact shippé est ligue-agnostique (l'UI ne connaît pas toujours la ligue), donc la validation l'est aussi (timeline poolée = exactement ce qui sera affiché). Des (a) par ligue = candidat run #3, jamais une retouche de ce run. |
| 11 | **Drift de patch après le run** (la calibration vieillit) | Doctrine §6.8 : refit par fenêtre de patch = re-run du script à chaque refresh corpus ; `fittedThroughPatch` + date dans le JSON et l'UI peut l'afficher ; la pente b qui s'effondre après un gros patch est un signal documenté (recherche §6, investissement #8). |

---

## 4. Plan d'implémentation pas-à-pas

Ordre anti-fishing : TOUT le code (lib, script, UI) se construit et se teste
AVANT le run réel ; le run ne change ensuite que deux fichiers de données.

1. **`src/lib/backtest/sequencePositions.ts` + `tests/sequencePositions.test.ts`.**
   Vert quand : tests à la main du §2.7 passent ; `pnpm test` global vert.
2. **`src/lib/estimators/winCalibration.ts` + placeholder
   `data/calibration/winCalibration.json` + `tests/estimators.winCalibration.test.ts`.**
   Vert quand : valeurs à la main (0,520944…), bornes de `positionOf`,
   passthroughs, monotonie ; `svelte-check` 0 erreur (l'import JSON build).
3. **`scripts/data/pullDataset.ts` + `.gitignore` (`data/datasets/`).**
   Vert quand : un pull réel écrit les deux fichiers, imprime sha256 +
   `version`/`date`, et le JSON parse en `Dataset` (champ `championData` non vide).
4. **`scripts/backtest/winCalibration.ts`** (en-tête = règle §1 gelée, hooks du
   patron postdiction). Vert quand : run complet sur le mini-corpus synthétique
   de `tests/fixtures/calibration/` → rapport + params produits, flags conformes
   à la règle ; AUCUNE exécution sur corpus réel.
5. **Intégration UI** (+page.svelte, CoachPanel, help) pilotée par le JSON —
   AJOUTE le badge de la WinrateBar (inexistant aujourd'hui) dans ses deux
   états : « Non calibré » (état placeholder) et « Calibré sur N games » si
   `validated` ; avec le placeholder, les % ne bougent pas. Vert quand :
   `pnpm test`, `svelte-check`, `pnpm build` verts ; smoke navigateur : badge
   présent (« Non calibré »), % inchangés.
6. **Gel** : commit de tout ; la règle de l'en-tête est désormais immuable.
   Puis pull du snapshot dataset (étape 3 exécutée pour de vrai, hashes notés).
7. **LE run** (une commande, 7 corpus, seed 42) →
   `docs/calibration/win-calibration-2026.md` + `data/calibration/winCalibration.json`.
   Commit des deux, SANS retouche. Vérifier au navigateur que les positions
   vertes affichent le badge « Calibré sur N games » et que les % bougent
   (légèrement) sur les positions validées uniquement.
8. **Documentation du verdict** : ligne dans `docs/STATUS.md` (table des
   verdicts), mise à jour de la ligne « Calibration des probabilités affichées »
   d'`ETAT_DES_LIEUX.md` §B (→ §A si vert), entrée d'aide.

Dépendances : aucune sur les autres chantiers de la run #2 ; n'attend PAS le
LCK 2025. Estimation : 1 session de build (étapes 1-6) + le run (minutes).

---

## 5. Ce que le verdict change

**Si VERT (par position — `fullDraft` est l'enjeu produit principal) :**
- Le badge « Calibré sur N games (7 corpus, walk-forward) » remplace « Non
  calibré » sur la WinrateBar (config plain) et sur les % du coach pour les
  positions vertes ; le claim produit autorisé est exactement celui de la règle :
  « quand l'outil affiche X %, la fréquence observée tombe dans le bac
  correspondant » — le cadrage LoLDraftAI validé par la recherche §6, vérifiable
  et modeste. JAMAIS « on prédit le vainqueur ».
- La ligne B d'ETAT_DES_LIEUX (« Calibration des probabilités affichées :
  aucune ») passe en A avec sa mesure ; le harnais gagne un bras « évaluateur
  calibré » réutilisable pour la cible #1 de la run (postdiction du coach :
  les deltas de conseil s'exprimeront en pp CALIBRÉS, donc comparables).
- I5 (revue annotée) hérite d'unités honnêtes : les seuils ?!/?/?? en espace de
  probabilité prennent un sens mesuré.
- Maintenance actée : re-run du script à chaque refresh de corpus / gros patch
  (refit par fenêtre — surveiller b qui s'effondre = drift quantifié gratuit).

**Si ROUGE sur `fullDraft` (et/ou `after3Picks`) :**
- Aucun changement d'affichage : badge « Non calibré » conservé, la valeur brute
  reste. Le rapport rouge est commité dans `docs/calibration/` (le Summit Gate
  vit de rouges honnêtes — précédent banEV phase 1) avec le diagnostic descriptif
  (fiabilité 10 bacs : où ça casse — sur-confiance globale ? drift par patch ?
  raw trop collé à 0,5 pour qu'une carte 2 paramètres aide ?).
- PAS de retuning de ce run. Suites légitimes = NOUVEAUX designs pré-enregistrés
  (run #3) : (a) par ligue, fenêtres de patch locales avec décroissance, ou
  calibration du side-context — chacun avec sa propre règle gelée.
- La valeur du chantier reste : l'infrastructure (positions, runner, config,
  badge data-driven) sert tel quel au prochain essai.

**Si ROUGE sur `afterBans` seulement :** scénario déclaré d'avance — confirme
que le 50 % post-bans est déjà honnête ; zéro changement produit, le doc le dit
avant le run.

**Dans tous les cas :** chaque position porte son verdict indépendant dans le
JSON (`validated` par position) — l'UI suit mécaniquement, sans interprétation.
