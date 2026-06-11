# Chantier B — banEV phase 1 : le terme de demande ban-history — Design run #2

> GELÉ post-revue adversariale (2026-06-11) — règle définitive, aucun paramètre ne bouge après ce commit.

> **AMENDEMENT DATÉ 2026-06-11 (avant le run, après re-pull)** — voir
> `docs/run2/AMENDEMENT-corpus-20260611.md` : l'état de corpus corrigé
> (réalignement PB→sides) change les valeurs du modèle ANCIEN des scorecards
> régénérés à timestamps épinglés — la DONNÉE change, pas la règle. Constantes
> `PUBLISHED` de la porte §1.4 amendées en conséquence : ancien lck
> 0,9388→**0,8811** · lec 1,1096→**0,9890** · lpl 1,0408→**0,9144** ·
> lfl inchangé (0 swap) ; les QUATRE baselines inchangées (side-agnostiques).
> Le rouge mesuré du §0 est même PLUS rouge sur données propres — la
> contamination croisée des tendances aidait le régime répertoire par
> accident. `PUBLISHED_GENERATED_AT` inchangé (timestamps épinglés).

> Statut : design pré-enregistré, AVANT toute implémentation et tout run.
> Références : `docs/STATUS.md` (verdict rouge mesuré), `docs/research/2026-06_draft_science_corpus.md` §E,
> `src/lib/strategic/banEv.ts`, `src/lib/backtest/corpusRunner.ts` (piste 4),
> `scripts/backtest/postdiction.ts` (patron canonique), `docs/calibration/README.md` (protocole).

## 0. Le problème, posé proprement

**Le rouge mesuré** (scorecards 2026-06-10, seed 42, walk-forward par patch, ban-hit@5 par side) :

| Ligue | banEV répertoire | Baseline présence | Δ (IC 95 %) | Verdict |
|---|---:|---:|---:|---|
| LCK (572 evts, 8 folds) | 0,9388 | 1,3007 | −0,3619 [−0,4354 ; −0,2885] | sous la baseline |
| LEC (456 evts, 7 folds) | 1,1096 | 1,2039 | −0,0943 [−0,1623 ; −0,0197] | sous la baseline |
| LPL (736 evts, 6 folds) | 1,0408 | 1,2459 | −0,2052 [−0,2663 ; −0,1495] | sous la baseline |
| LFL (358 evts, 8 folds) | 1,2598 | 1,0670 | +0,1927 [+0,1061 ; +0,2793] | bat la baseline |

**Le diagnostic acquis** : `takeProbability` est lu sur les ranges de **picks** (tables de
tendances de l'équipe adverse). Un champion **perma-banni contre une équipe n'apparaît
jamais dans ses picks** — son évidence de tendance est structurellement censurée par les
bans eux-mêmes. Donc takeProbability ≈ 0, donc EV(le bannir) ≈ 0, alors que c'est
précisément ce que les équipes bannissent. Le contournement actuel (le `replacementDrop`
gonflé par le banRate ligue dans la piste 4) met l'information au mauvais endroit : il
multiplie un dégât par une demande quasi nulle — le produit reste quasi nul.

**L'évidence directe de la demande contrefactuelle existe dans le corpus** : les bans
SUBIS par l'équipe. Si les adversaires de T1 dépensent un ban sur Kalista 8 games sur 10,
c'est la croyance révélée du marché que T1 la prendrait — exactement la quantité que les
picks ne peuvent pas montrer. Ce design ajoute ce canal au régime répertoire (phase 1)
de banEV, et re-passe LA MÊME piste ban-hit@5 par side, à règle gelée, en un run.

Le régime composition (phase 2) est **vert et n'est pas touché**.

---

## 1. Règle pré-enregistrée

> Texte à geler tel quel dans l'en-tête de `scripts/backtest/banHistory.ts` AVANT tout
> run sur données réelles. UNE règle, UN run, aucun re-tuning après lecture.

### 1.1 L'estimateur de demande (fit, walk-forward par fold)

Pour un fold scorant le patch k, le corpus de fit est `uniqueRecords` du train
d'événements : les records ayant ≥ 1 ban résolu sur au moins un side, parmi les patchs
du MÊME corpus strictement antérieurs à k — la même assiette que celle sur laquelle la
piste 4 fitte déjà tables et présence.

- `games_T` = nombre de records du fit où l'équipe T apparaît (blueTeam ou redTeam).
  Zéro informatif : un record où T joue et où SEUL T a banni entre dans le fit (il porte
  l'événement du side de T) et compte bien comme zéro subi pour T ; un record sans aucun
  ban résolu, d'aucun side, ne porte aucun événement et reste hors du fit.
- `suffered_T(c)` = nombre de records du fit où T joue ET où le side OPPOSÉ à T a une
  action `ban` résolue sur c (au plus 1 par game, dédupliqué défensivement).
- Moyenne ligue (prior de shrinkage, lissage add-half) :
  `μ_c = (bannedGames(c) + 0,5) / (2·N + 1)`
  où `bannedGames(c)` = nombre de games du fit où c est banni (l'un ou l'autre side)
  et N = nombre de records du fit. (Chaque ban est subi par exactement une équipe ;
  les unités équipe-game sont au nombre de 2·N — μ_c est le taux de ban subi par une
  équipe quelconque.)
- Taux de demande révélée, posterior Beta en forme fermée (shrinkage EB, **priorN = 10**) :
  `banAttraction(c | T) = (suffered_T(c) + 10·μ_c) / (games_T + 10)`
  Équipe absente du fit ⇒ `banAttraction = μ_c` (repli prior ligue, cascade DA-V2-4).
  Fit vide (0 record) ⇒ 0.

priorN = 10 : borne basse de la bande doctrine N₀ ≈ 10-50 (ARCHITECTURE_V2 §6.2),
choisie AVANT le run parce que les équipes n'ont que ~5-40 games par fold — à 50, un
perma-ban réel (8 subis sur 10 games) serait écrasé sous le prior et le terme ne
pourrait rien discriminer ; à 10 il poste ≈ 0,5+ tout en laissant μ_c absorber les bans
météo génériques.

### 1.2 La formule de demande dans banEV (régime répertoire uniquement)

```
attraction = banAttraction(c | équipe adverse)        // 0 si aucun provider injecté
demande    = max(takeProbability(c), γ · attraction)   // γ = banAttractionGamma = 1,0
ev(c)      = demande · (damage(c) + structuralPp · structural(c))
```

**Le max(), pas l'additif — tranché.** Les deux canaux estiment la MÊME quantité latente
(« P(ils le prendraient s'il était disponible) ») sous deux régimes d'observation
mutuellement exclusifs : les picks l'observent quand les bans ne censurent pas, les bans
subis l'observent quand ils censurent. Le max() prend la meilleure évidence disponible et
**ne double-compte jamais** un champion à la fois pické et banni. L'additif, lui,
additionnerait picks + bans — c'est la définition de la présence : le modèle convergerait
vers sa propre baseline (copie bruitée ⇒ au mieux égalité), et sur-coterait les champions
à demande déjà visible. Le max() répare uniquement les cas censurés et laisse intactes
les suggestions portées par les tendances (le vert LFL n'est pas dégradé par construction
de candidat : aucune demande individuelle ne baisse).

**γ = 1,0 — fixé avant tout run.** Les deux termes vivent dans la même unité (sorties
attendues par game) : takeProbability somme des probabilités de pick par groupe de slots ;
attraction est P(un adversaire dépense un ban sur c dans une game contre T). Un
adversaire rationnel ne brûle un de ses 5 bans que si la sortie attendue le justifie —
le taux de ban subi est un minorant raisonnable de la probabilité de sortie
contrefactuelle, d'où l'échange 1:1. C'est le choix sans paramètre libre ; l'amortissement
fin est déjà fait par le shrinkage (priorN), pas par γ.

Tout le reste du régime répertoire est inchangé : damage, structural, plancher
composition, Fearless-consumed ⇒ 0.

### 1.3 La piste de re-validation (identique byte-à-byte à la piste 4 du runner)

Pour chaque corpus, séparément :

- Événements = (game, side bannissant) avec ≥ 1 ban résolu, toutes phases confondues ;
  cible = les 5 bans de CE side ; folds walk-forward par patch (`groupByPatch`,
  train = patchs strictement antérieurs du même corpus).
- Modèle NOUVEAU = `banEV` régime répertoire sur les **30 candidats les plus présents du
  train**, `upcomingSlotGroups` = tous les groupes de picks du side adverse
  (blue : P1, P4-5, P8-9 ; red : P2-3, P6, P7, P10), ranges =
  `predictEnemyRange(table de tendances de l'équipe adverse fit sur le train,
  meta = présence du train, exclude = ∅)`, `structuralAssets` =
  `mineCombinations(records adverses du train, minGames 2)`,
  `replacementDrop(c) = 1,5 · (1 + 4·banRate_train(c))` — tout identique à la piste 4 —
  PLUS le provider `banAttraction(c) = banAttractionRate(fit du train, équipe adverse, c)`.
- Modèle ANCIEN (ancre d'attribution, tenu à la réplication §1.4) = exactement le même
  sans le provider.
- Baseline (inchangée, celle du rouge mesuré) = top-5 présence du train.
- Horloge gelée par ligue : map d'en-tête `PUBLISHED_GENERATED_AT` (pas de flag) = les
  « Généré le » exacts des quatre scorecards publiés — lck `2026-06-10T19:33:00.590Z` ·
  lec `2026-06-10T19:33:01.965Z` · lfl `2026-06-10T19:33:03.024Z` ·
  lpl `2026-06-10T21:02:11.514Z`. Chaque corpus est runné avec le timestamp de SA ligue
  comme `now` de TOUTES ses tables de tendances (les corpus 2025 descriptifs réutilisent
  celui de leur ligue).
- Score = `banHitAtK(top 5, bans du side, 5) / 5` ; valeur publiée = hits moyens/game.
- Bootstrap apparié, 1000 resamples, **mulberry32(seed 42)** : UN flux unique, consommé
  dans l'ordre argv complet — d'abord les 4 corpus 2026, puis les 3 corpus 2025
  descriptifs ; pour chaque corpus, 2 IC dans l'ordre (nouveau − baseline) puis
  (nouveau − ancien). Cet ordre de consommation du flux fait partie de la règle gelée.

### 1.4 Porte de validité du run (anti-bug, pas anti-résultat)

Le run n'est VALIDE que si, pour chacun des quatre corpus 2026, la **baseline** ET le
**modèle ANCIEN** recalculés par le script reproduisent à 4 décimales la paire publiée
du scorecard — baseline : LCK 1,3007 · LEC 1,2039 · LFL 1,067 · LPL 1,2459 ; ancien :
LCK 0,9388 · LEC 1,1096 · LFL 1,2598 · LPL 1,0408. Comparaison gelée, écrite dans
l'en-tête du script : `round(valeur recalculée, 4) === constante publiée`, la table
`PUBLISHED` encodant les valeurs telles que strippées par le renderer des scorecards
(au plus 4 décimales, zéros finaux retirés — ex. baseline LFL `1.067` = 1,0670). La
baseline ne dépend d'aucune horloge ; l'ancien est runné avec le timestamp publié de
SON corpus (`PUBLISHED_GENERATED_AT`, §1.3) — toute divergence de l'une ou de l'autre
est un bug de réplication de piste. Un run invalide s'arrête là : la correction
mécanique est autorisée UNIQUEMENT pour retrouver ces valeurs gelées, jamais jugée sur
la ligne du nouveau modèle.

### 1.5 Critère de verdict (gelé, sur les QUATRE corpus 2026 uniquement)

Par ligue, verdict standard du protocole : « bat la baseline » ssi l'IC 95 % du
Δ (nouveau − baseline) exclut 0 en faveur du modèle ; « sous la baseline » ssi il
l'exclut en défaveur ; « à égalité » sinon.

- **VERT** : ≥ 3 ligues « bat la baseline » ET 0 ligue « sous la baseline »
  → claim phase 1 validé, branchement runner + UI (§5).
- **JAUNE** : 0 ligue « sous la baseline », mais < 3 « bat »
  → le rouge est éteint, pas de claim ; badge Expérimental conservé.
- **ROUGE** : ≥ 1 ligue « sous la baseline »
  → le terme de demande ne suffit pas ; la piste répertoire est retirée du ranking
  par défaut (§5), pas re-tunée.

### 1.6 Secondaires descriptifs (ne peuvent PAS changer le verdict)

1. Δ (nouveau − ancien) par ligue avec IC — l'attribution du changement.
2. Part des suggestions top-5 où le plancher lie (γ·attraction > takeProbability) —
   l'usage réel du canal, par ligue.
3. Réplication descriptive sur `data/corpus/{lec,lfl,lpl}-2025.json` (mêmes règles,
   mêmes constantes). **LCK 2025 absent — explicitement non attendu.**

Constantes gelées, récapitulatif : priorN = 10 · γ = 1,0 · candidats = top-30 présence ·
K = 5 · seed = 42 · 1000 resamples · now = PUBLISHED_GENERATED_AT (4 timestamps publiés,
un par ligue, §1.3) · lissage μ add-half · verdict sur 2026 seulement. Aucun de ces
nombres n'est retouché après lecture des résultats : un échec ferme CETTE règle ; toute
suite est une NOUVELLE règle pré-enregistrée.

---

## 2. Design technique

### 2.1 Nouveau module pur : `src/lib/estimators/banAttraction.ts`

Patron : `compDurationAffinity.ts` / `tagPairs.ts` (fit data + fonctions pures, tags/
horloge/I-O : aucun). Le posterior est calculé en **forme fermée** (moyenne Beta) — pas
d'appel à `shrinkWinrate`, dont le calcul d'IC par `betaQuantile` (bisection ×100 par
quantile, deux quantiles par appel `shrinkWinrate`) serait gaspillé dans une boucle
30 candidats × ~600 événements × folds.

```ts
/** Évidence de demande contrefactuelle : les bans SUBIS par une équipe. */
export interface TeamSufferedBans {
    /** Records du fit où l'équipe apparaît (zéros informatifs inclus). */
    games: number;
    /** championKey → nombre de games où l'adversaire l'a banni (≤ 1 par game). */
    suffered: Map<string, number>;
}

export interface BanAttractionFit {
    byTeam: Map<string, TeamSufferedBans>;
    /** championKey → games (l'un ou l'autre side) où il fut banni. */
    bannedGames: Map<string, number>;
    /** Nombre total de records du fit. */
    games: number;
    priorN: number;
}

export const DEFAULT_BAN_ATTRACTION_PRIOR_N = 10;

export interface FitBanAttractionOptions {
    /** Pseudo-games EB vers la moyenne ligue (pré-enregistré : 10). */
    priorN?: number;
}

export function fitBanAttraction(
    records: DraftRecord[],
    options?: FitBanAttractionOptions
): BanAttractionFit;

/** Prior ligue : P(l'adversaire d'une équipe quelconque bannit c), add-half. */
export function leagueBanAttraction(fit: BanAttractionFit, championKey: string): number;
// = (bannedGames(c) + 0.5) / (2·games + 1)

/**
 * Taux de ban subi EB-shrunk de `team` pour `championKey` — la demande révélée.
 * Posterior Beta en forme fermée : (suffered + priorN·μ) / (games_T + priorN).
 * Équipe inconnue ⇒ μ (prior ligue) ; fit vide (games = 0) ⇒ 0.
 */
export function banAttractionRate(
    fit: BanAttractionFit,
    team: string,
    championKey: string
): number;
```

Détails d'implémentation contraints :
- `suffered` : pour chaque record, side de T = (T === blueTeam ? 'blue' : 'red') ; on
  compte les actions `type === 'ban'` du side opposé avec `championKey !== ''`,
  dédupliquées par (game, champion) via un Set local.
- Si une équipe joue contre elle-même (donnée corrompue blueTeam === redTeam), le record
  est compté côté blue uniquement (déterminisme) — cas théorique, noté en commentaire.
- Aucune dépendance à `presence.ts` : le fit lit les records directement (les deux
  comptages — bannedGames par game, suffered par équipe — n'existent pas dans
  `computePresence`, qui compte des actions, pas des games).

### 2.2 Modification : `src/lib/strategic/banEv.ts`

```ts
export interface BanEvConfig {
    defaultReplacementDropPp: number;
    structuralPp: number;
    /** γ — poids du plancher de demande révélée par les bans subis (régime répertoire). */
    banAttractionGamma: number;            // NOUVEAU — défaut 1
}

export const DEFAULT_BAN_EV_CONFIG: BanEvConfig = {
    defaultReplacementDropPp: 1.5,
    structuralPp: 1,
    banAttractionGamma: 1                  // pré-enregistré §1.2
};

export interface BanEvContext {
    // … champs existants inchangés …
    /**
     * Taux de ban subi EB-shrunk de l'équipe ADVERSE pour ce champion
     * (banAttractionRate du fit train). En régime répertoire, la demande
     * devient max(takeProbability, γ·banAttraction) — le canal qui répare la
     * censure des perma-bans (un champion toujours banni n'a pas de tendance
     * de pick) ; dans les deux régimes, components.banAttraction rapporte la
     * valeur brute. Absent ⇒ comportement byte-identique à l'existant.
     */
    banAttraction?: (championKey: string) => number;   // NOUVEAU
}

export interface BanEvComponents {
    takeProbability: number;
    /** Taux de ban subi (brut, non pondéré par γ), rapporté dans les DEUX régimes ; 0 sans provider. */
    banAttraction: number;                 // NOUVEAU — DA-V2-12, affiché séparément
    damage: number;
    structural: number;
    threat: number;
}
```

Lecture du provider commune aux deux régimes (le composant est rapporté — DA-V2-12),
branche répertoire = seul changement de calcul d'EV :

```ts
const attraction = ctx.banAttraction?.(championKey) ?? 0;   // les deux régimes
// branche répertoire uniquement :
const demand = Math.max(takeProbability, config.banAttractionGamma * attraction);
ev = demand * (damage + config.structuralPp * structural);
```

Rationale FR (branche répertoire) — règle d'affichage gelée :
- `Demande révélée par les bans subis : banni contre eux ~X % des games` (X = attraction
  arrondi en %) s'affiche EN PREMIÈRE position ssi `γ·attraction > takeProbability` ET
  `attraction > 0` (le plancher lie) ;
- `Si pris : −X pp vers leur remplaçant` s'affiche dès que `demand > 0` (une demande
  portée par le seul plancher a le même coût de sortie) ;
- `Aucune sortie attendue sur les slots à venir` s'affiche ssi `demand === 0` ;
- les autres lignes existantes (« Sortie attendue : X % cumulés… » si
  `takeProbability > 0`, ligne structurelle) sont inchangées.

Le retour anticipé Fearless-consumed zéroe aussi `banAttraction: 0` (mise à jour
mécanique de l'objet components, imposée par TS strict). `components.banAttraction` =
valeur brute du provider dans les DEUX régimes — le composant est rapporté, l'EV du
régime composition ne l'utilise pas (DA-V2-12 ; phase 2 verte, intouchée dans son
calcul). L'en-tête du module est mis à jour avec la formule à deux canaux et la
référence à ce design.

**Compatibilité** : sans provider, attraction = 0 ⇒ demand = takeProbability ⇒ EV
byte-identique. `opponentIntel.ts` et `corpusRunner.ts` (seuls appelants réels)
compilent inchangés ; `fogReveal.ts` et `liveDraft.ts` ne référencent banEV qu'en
commentaire — seuls les tests construisant des `BanEvComponents` attendus ajoutent le
champ.

### 2.3 Nouveau script pré-enregistré : `scripts/backtest/banHistory.ts`

Patron exact : `postdiction.ts` — en-tête = la règle §1 verbatim, `registerHooks`
identique (résolution `$lib/`, JSON), imports dynamiques typés, argv minimal.

```
Usage : node --experimental-transform-types --no-warnings scripts/backtest/banHistory.ts \
          static/corpus/lck-2026.json static/corpus/lec-2026.json \
          static/corpus/lfl-2026.json static/corpus/lpl-2026.json \
          data/corpus/lec-2025.json data/corpus/lfl-2025.json data/corpus/lpl-2025.json \
          [--seed 42] [--out docs/calibration/ban-history-2026.md]
```

Constantes d'en-tête (gelées) : `PUBLISHED_GENERATED_AT = { lck: '2026-06-10T19:33:00.590Z',
lec: '2026-06-10T19:33:01.965Z', lfl: '2026-06-10T19:33:03.024Z',
lpl: '2026-06-10T21:02:11.514Z' }` (en-têtes exacts des quatre scorecards publiés ; chaque
corpus est runné avec le timestamp de sa ligue, §1.3) ;
`PRIMARY = ['lck-2026.json','lec-2026.json','lfl-2026.json','lpl-2026.json']` ;
`PUBLISHED = { 'lck-2026.json': { ancien: 0.9388, baseline: 1.3007 }, 'lec-2026.json':
{ ancien: 1.1096, baseline: 1.2039 }, 'lfl-2026.json': { ancien: 1.2598, baseline: 1.067 },
'lpl-2026.json': { ancien: 1.0408, baseline: 1.2459 } }` — valeurs strippées du renderer ;
la porte §1.4 (`round(valeur recalculée, 4) === constante publiée`) est écrite dans
l'en-tête.

Par corpus : reconstruit les `SideBanEvent` et les trois runs `walkForward` (nouveau /
ancien / baseline) en copiant la construction de la piste 4 (`PICK_GROUPS_BY_SIDE`,
candidats top-30, tables mémoïsées par équipe, assets mémoïsés, replacementDrop) ; le
nouveau run ajoute `fit = fitBanAttraction(uniqueRecords(train), { priorN: 10 })` dans le
modèle du fold et le provider `(key) => banAttractionRate(fit, enemyTeam, key)` ; mesure
aussi, par événement du nouveau run, la part des 5 suggestions où le plancher lie
(diagnostic §1.6.2, collecté pendant la prédiction, hors PredictionPair).

Sortie markdown `docs/calibration/ban-history-2026.md` :
tableau primaire (ligue | n | folds | nouveau | ancien | publié | baseline | baseline
publiée | Δ vs baseline (IC) | verdict), stamp `RUN VALIDE/INVALIDE` (porte §1.4),
verdict global §1.5 en toutes lettres, tableau descriptif 2025, part du plancher par
ligue, notes (seed, resamples, ordre des IC, constantes).

### 2.4 Tests (calculés à la main, dans `tests/`)

**NOUVEAU `tests/estimators.banAttraction.test.ts`** — corpus synthétique 3 records
(équipes A/B/C, champion X banni par les adversaires de A dans g1 et g2, jamais dans
g3 = B vs C), priorN 10 :
- `μ_X = (2 + 0,5) / (6 + 1) = 2,5/7 ≈ 0,3571428571` ;
- `banAttractionRate(A, X) = (2 + 10·2,5/7) / (2 + 10) = 39/84 = 13/28 ≈ 0,4642857143` ;
- `banAttractionRate(B, X) = (25/7)/13 = 25/91 ≈ 0,2747252747` (3 games, 0 subi) ;
- équipe inconnue → μ_X ; champion jamais banni Y → μ_Y = 0,5/7, rate(A,Y) = 5/84 ;
- fit vide → 0 ; ban non résolu ('') ignoré ; déduplication par game vérifiée.

**MODIFIÉ `tests/banEv.test.ts`** :
- mise à jour mécanique : `banAttraction: 0` dans l'égalité de components du cas consumed ;
- plancher lie : d (takeP 0,35 via RANGES), provider 0,6, γ 1 → ev = 0,6·1,5 = 0,9 ;
- censure pure (takeP = 0, provider > 0) : z (hors de tous les ranges), provider 0,6 →
  ev = 0,9 ; « Demande révélée… » en première position, « Si pris : −1.5 pp… » présente
  (demand > 0), pas de « Aucune sortie attendue » ;
- plancher ne lie pas : c (takeP 0,7), provider 0,2 → ev inchangé 1,05 ; ordre c > d ;
- γ config : γ = 0,5, provider d 0,6 → max(0,35, 0,3) = 0,35 → ev 0,525 (DA-V2-6) ;
- sans provider : les nombres de régression existants passent inchangés ;
- composition + provider : `components.banAttraction` épinglé à la valeur brute du
  provider ; l'EV phase 2 n'en dépend pas ;
- rationale : la ligne « Demande révélée… » apparaît ssi le plancher lie.

### 2.5 Ce qui n'est PAS touché dans ce chantier

`rangeModel.ts` (le modèle de ranges prédit des PICKS — un champion banni ne sera
effectivement pas pické : sa probabilité de pick ≈ 0 est CORRECTE ; la demande
contrefactuelle est une autre quantité, qui vit dans le consommateur banEV),
`corpusRunner.ts` (branchement post-verdict seulement, §5), l'UI, le régime composition,
les scorecards publiés.

---

## 3. Analyse des fuites (leakage) et des risques de fishing

### 3.1 Fuite temporelle — neutralisée par construction

L'évidence (bans subis par l'équipe adverse) est fittée **par fold sur le train du même
corpus** (patchs strictement < k), exactement comme les tables de tendances et les
cellules de counter de la piste 5. Aucune action du patch testé ni d'après n'entre dans
le fit. Les records sans patch plaçable sont déjà écartés par `groupByPatch`.

### 3.2 « Prédire des bans avec des bans » — examiné, légitime

La cible est les 5 bans du side AGISSANT dans la game de test ; l'évidence est les bans
subis par l'équipe ADVERSE dans des games de patchs antérieurs. Aucune game n'est des
deux côtés de la frontière. Cas subtil : si l'équipe agissante A a déjà joué contre E
dans le train, ses propres bans passés contre E font partie de l'évidence — c'est du
scouting d'information strictement passée et publique (« tout le monde, nous compris,
bannit ça contre eux »), disponible au moment de la décision en prep réelle. Le canal
est donc aussi **opérationnellement** honnête : utilisable en live, pas seulement en
backtest.

### 3.3 Double-compte avec la baseline présence — LE risque structurel, analysé

La baseline classe par présence = (picks + bans)/games du train : **elle contient déjà
les bans**. Ajouter l'évidence de bans au modèle le rapproche du jeu d'information de la
baseline. Trois conséquences, toutes assumées par le design :

1. **Le pire cas réaliste est l'égalité, pas la fausse victoire.** Si le terme ne fait
   que répliquer la présence, le Δ apparié tend vers 0 → verdict « à égalité » (JAUNE).
   Le critère (IC excluant 0) ne récompense JAMAIS une copie de baseline.
2. **Ce qui peut battre la baseline est précisément ce qu'elle n'a pas** : le
   conditionnement. La baseline est globale ; le modèle est conditionnel à l'équipe
   (tendances par slot × side + bans subis PAR CETTE équipe, shrinkés vers la ligue).
   Un « beats » est attribuable à cette information-là — μ_c (la composante ligue du
   plancher) ne fait que recoller le niveau de la baseline, les déviations d'équipe
   font le dépassement.
3. **La baseline reste celle du rouge mesuré, inchangée et reproduite** (porte §1.4) —
   pas de baseline affaiblie sur mesure.

### 3.4 Double-compte interne demande × dégât — identifié, gelé, nettoyage différé

`replacementDrop = 1,5·(1+4·banRate_train)` injecte déjà du ban ligue dans le DÉGÂT
(c'était le contournement historique). Avec le plancher, un perma-ban ligue porte du
banRate dans les deux facteurs. Décision : **conserver replacementDrop tel quel dans ce
run.** (i) Attribution : une seule chose change vs le rouge mesuré — tout delta est
imputable au terme de demande ; en changer deux rendrait un rouge ininterprétable.
(ii) Les deux facteurs répondent à des questions différentes (P(sortie) vs coût de la
sortie) — le produit sur-PONDÈRE les perma-bans ligue mais ne compte pas deux fois la
même évidence dans le même facteur. (iii) L'effet est observable dans le diagnostic
descriptif (part du plancher). Le remplacement propre du hack (courbes de profondeur de
pool, upgrade I4) est explicitement une RÈGLE FUTURE distincte — pas un knob de celle-ci.

### 3.5 Anti-fishing — les garde-fous explicites

- **Une formule, un run** : le max() est tranché par argument de design (§1.2), pas en
  essayant max ET additif pour garder le meilleur. Aucune variante n'est exécutée.
- **γ = 1 et priorN = 10 fixés avant tout contact avec les données**, justifiés par
  dimension (γ) et doctrine + tailles de folds (priorN) — pas par lecture de résultats.
- **Pas de tranche opportuniste** : la seule stratification publiée est par ligue, l'unité
  de publication préexistante. Les secondaires (§1.6) sont déclarés AVANT le run et ne
  peuvent pas changer le verdict.
- **Seed 42, horloge gelée, ordre des IC gelé** : le run se rejoue byte-identique.
- **Toutes les ligues sont publiées** quel que soit le résultat, verdict 3 niveaux gelé.
- **La porte de validité (§1.4) borne la zone de débogage** : on a le droit de corriger
  un script qui ne reproduit pas les paires publiées — baseline ET modèle ancien (bug
  objectif) —, jamais de retoucher quoi que ce soit au vu de la ligne du nouveau modèle.
- **Le smoke pré-run est synthétique** (§4 étape 4) : le script n'est jamais exécuté sur
  un corpus réel avant le run enregistré.

### 3.6 Risques résiduels honnêtes (hors leakage)

- **Puissance** : les IC publiés ont des demi-largeurs ~0,07-0,09 hit/game ; un vrai
  gain < ~0,1 sera invisible → JAUNE probable dans ce cas. Assumé : JAUNE est un
  résultat utile (le rouge éteint), pas un échec de protocole.
- **LFL pourrait se dégrader** : le plancher ne baisse aucune demande individuelle mais
  réordonne le top-5 ; si les insertions ligue-génériques chassent des hits de tendance
  en LFL (ligue où les tendances suffisaient), le critère le détecte (« sous la
  baseline » ⇒ ROUGE global). C'est le test, pas un angle mort.
- **First Selection** : `PICK_GROUPS_BY_SIDE` suppose le template blue-first (limite déjà
  documentée de la piste 4, ère FS) — inchangé ici pour la comparabilité ; noté dans le
  rapport.

---

## 4. Plan d'implémentation pas-à-pas

Chaque étape laisse la suite verte (`pnpm test`, svelte-check, lint) et committe seule.

1. **Estimateur** : créer `src/lib/estimators/banAttraction.ts` (§2.1) +
   `tests/estimators.banAttraction.test.ts` (nombres §2.4 calculés à la main).
   Module pur, aucun consommateur — zéro changement de comportement.
   *Testable : vitest vert, nombres exacts 13/28, 25/91, 5/84.*

2. **Seam banEV** : modifier `src/lib/strategic/banEv.ts` (§2.2 — config γ, provider,
   composant `banAttraction`, max(), rationale) + mettre à jour/étendre
   `tests/banEv.test.ts` (§2.4). Sans provider, comportement byte-identique.
   *Testable : les 15 cas existants (11 répertoire + 4 composition) passent sans changer
   un nombre attendu ; seul le `toEqual` du cas consumed gagne `banAttraction: 0` ; les
   nouveaux cas plancher/censure pure/γ passent ; suite complète verte (les deux
   appelants réels compilent inchangés).*

3. **Script** : créer `scripts/backtest/banHistory.ts` (§2.3), en-tête = règle §1
   verbatim (gel), patron postdiction (hooks node, $lib, argv).
   *Testable : lint/type-check du script ; relecture que l'en-tête contient §1.1-§1.6
   à l'identique.*

4. **Smoke synthétique** : exécuter le script sur un mini-corpus JSON synthétique
   (3 patchs, 2 équipes, bans construits à la main — fixture jetable hors
   static/data/corpus) pour vérifier mécanique, porte de validité (qui doit stamper
   INVALIDE sur le synthétique) et rendu markdown. **Interdiction de le pointer sur un
   corpus réel à cette étape.**
   *Testable : le markdown synthétique se génère, le stamp INVALIDE apparaît.*

5. **LE run enregistré** (une commande, §2.3) : 4 corpus 2026 (primaire) + 3 corpus 2025
   (descriptif), seed 42, sortie `docs/calibration/ban-history-2026.md`.
   *Testable : stamp RUN VALIDE (baseline ET modèle ancien reproduits à 4 décimales) ;
   sinon, boucle bornée §1.4 (corriger la réplication, re-runner) en documentant chaque
   tentative.*

6. **Application du verdict** (§5) : mise à jour `docs/STATUS.md` (tableau des verdicts,
   item « Ce qui reste » #1) + branchements si VERT uniquement + commit final.

Estimation : étapes 1-4 ≈ une session ; étape 5 = minutes de calcul ; étape 6 dépend du
verdict.

---

## 5. Ce que le verdict change

### Si VERT (≥ 3 « bat », 0 « sous »)

1. **Brancher le canal dans la piste 4 du runner** (`corpusRunner.ts` : fit
   `banAttraction` par fold + provider dans le `banEV` du track 4) — le scorecard
   canonique porte désormais le terme ; régénérer les 4 scorecards 2026 (mêmes seeds) et
   mettre à jour la ligne « ban-hit@5 par side » de STATUS : le claim phase 1 passe de
   « rouge mesuré » à « beats ». La nature deux-régimes des bans est alors validée des
   DEUX côtés (phase 1 demande, phase 2 contre-compo).
2. **Brancher l'UI** : `opponentIntel.ts` (banPages B1-B3) fitte `banAttraction` sur les
   mêmes records que la table de tendances et injecte le provider ; la rationale
   « Demande révélée par les bans subis : banni contre eux ~X % des games » apparaît dans
   le panneau bans avec le composant affiché séparément (DA-V2-12). Le badge Expérimental
   des suggestions phase 1 tombe (DA-V2-11 satisfaite).
3. **Propager le diagnostic à I4** : le prix du déni Fearless lit « P(ils voudraient c) »
   sur les ranges I1 — même bug de censure des perma-bans. Le fit banAttraction devient
   l'ingrédient candidat du terme de déni ; c'est une règle G3 future, pas un branchement
   silencieux.
4. **Ouvrir la règle de nettoyage différée** (§3.4) : remplacer le hack banRate de
   `replacementDrop` par des courbes de remplacement par profondeur de pool — nouvelle
   règle pré-enregistrée, nouveau run.

### Si JAUNE (rouge éteint, pas de claim)

Le moteur cesse de nuire mais ne prouve pas de valeur : badge Expérimental conservé,
pas de branchement runner par défaut (la ligne scorecard resterait celle du régime
actuel), STATUS documente « à égalité — canal demande posé, gain sous le seuil de
puissance ». Relance naturelle quand la puissance augmente (corpus 2025 intégrés à la
piste canonique, ou LCK 2025 débloqué) — en re-déclarant la règle, pas en la modifiant.

### Si ROUGE (≥ 1 ligue encore « sous la baseline »)

1. L'hypothèse « la demande contrefactuelle répare le régime répertoire » est falsifiée
   en l'état : **le ranking banEV phase 1 est retiré de l'UI par défaut** — le panneau
   bans B1-B3 bascule sur l'affichage honnête (top présence + tendances + composants
   séparés, sans ev agrégée), le badge passe de « Expérimental » à « piste retirée »
   dans STATUS et le scorecard.
2. Le module `banAttraction` (pur, testé) reste dans `estimators/` — il a des usages
   indépendants (déni I4, fiche scouting « perma-bans subis » purement descriptive).
3. Les suspects suivants sont consignés pour d'éventuelles NOUVELLES règles (sans
   rouvrir celle-ci) : structure de la somme `takeProbability` par groupes de slots
   (masse 3-4 répartie inégalement), candidats top-30, hack banRate du dégât (§3.4),
   interaction γ·μ avec les ligues à bans très concentrés.
4. STATUS acte le second rouge avec ses chiffres — le Summit Gate fait son travail :
   deux échecs propres valent mieux qu'un moteur qui ment.
