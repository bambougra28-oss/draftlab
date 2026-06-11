# Plans à branches — Design run #2

> GELÉ post-revue adversariale (2026-06-11) — règle définitive, aucun paramètre ne bouge après ce commit.

> Chantier D de la run #2 (ETAT_DES_LIEUX §F.4, manque produit §D.2) : transformer
> les Plans A/B/C statiques (`storage/draftPlans.ts`, 5 bans + 5 picks
> primary/fallback) en **arbres préparés contre UN adversaire** — nœuds = nos tours,
> branches = les K réponses adverses les plus probables — avec **détection de
> déviation en live** dans le mode séquence exact. C'est l'« arbre de répertoire
> conditionnel » de la roadmap (ARCHITECTURE_V2 §8 R6), l'analogue du répertoire
> d'ouvertures aux échecs (recherche méthodo §7 : les outils d'échecs ont gagné en
> mettant **l'évidence — games, comptes, dates — à un clic** de chaque
> recommandation).
>
> Doctrine appliquée : DA-V2-11 (pas de ship sans métrique — ici la **couverture**),
> DA-V2-12 (composantes séparées), DA-V2-6 (tunables en config injectable),
> walk-forward par patch strict, modules $lib purs, baselines pré-enregistrées,
> UNE règle / UN run.

---

## 1. Règle pré-enregistrée

> Texte destiné à être gelé TEL QUEL dans l'en-tête de
> `scripts/backtest/planCoverage.ts` AVANT tout run sur données réelles.
> Patron : `scripts/backtest/postdiction.ts` (en-tête = règle, hooks node, $lib).

### 1.1 La question

Un arbre de prep contre une équipe T (branches = top-K du modèle de tendances de T
à chaque tour adverse) couvre-t-il les drafts réelles de T **mieux qu'un arbre
construit sur la ligue seule (sans modèle d'équipe)** ? La métrique est la
**couverture** : la part des séquences adverses réelles qui restent dans l'arbre,
publiée **en courbe** sur (K, P) — jamais un point isolé.

### 1.2 Données, unités, éligibilité

- **Corpus** : les fichiers passés en argv au lancement — au jour du design, les
  7 disponibles : `static/corpus/{lck,lec,lfl,lpl}-2026.json` +
  `data/corpus/{lec,lfl,lpl}-2025.json` (LCK 2025 absent — on n'en dépend pas).
  La liste exacte est imprimée dans le rapport. Tout corpus ajouté APRÈS le run
  (ex. lck-2025) = run de **réplication séparé**, même règle, fichier distinct.
- **Unité d'évaluation** : u = (game g, côté s) avec s ∈ {blue, red} traité comme
  « l'adversaire qu'on prépare ». Chaque game éligible donne 2 unités ; les 2
  unités d'une même game sont **clusterisées ensemble** dans le bootstrap.
- **Éligibilité de g** : patch présent et parsable (`parsePatch`), toutes les
  actions résolues (aucun `championKey === ''`), et au moins un patch
  strictement antérieur dans le même corpus (le premier patch n'est jamais
  scoré). Records écartés comptés dans les notes du rapport, jamais devinés.

### 1.3 Walk-forward et les deux bras

Pour une game g de patch k dans le corpus C :

- `Train(g)` = records de C de patch **strictement antérieur** à k
  (`comparePatches(r.patch, k) < 0`) — jamais k, jamais après, jamais g.
- `now(g)` = le **jour UTC** de `g.date` si défini, sinon le jour UTC de la
  date max de `Train(g)` ; si **aucun** record de `Train(g)` n'est daté,
  l'unité est **écartée et comptée dans les notes** du rapport — 0 cas sur
  les corpus actuels (les 2 661 records des 7 fichiers sont tous datés :
  même le fallback « date max » n'y sert jamais). Le staff connaît le jour du
  match au moment de la prep — aucune info de la game n'entre dans le modèle
  par ce biais ; la granularité jour fait que les games d'une même journée
  partagent la même table (cache, §2.5).
- **Bras A — modèle ÉQUIPE** (l'arbre revendiqué) :
  `buildTendencyTable(Train(g), Train(g), { alpha: 5, lambdaPerWeek: 0.9, now: now(g), team: T })`
  où T = `g.blueTeam` si s = blue, `g.redTeam` sinon (chaîne telle quelle —
  cohérente intra-corpus Leaguepedia, pas de fuzzy matching).
- **Bras B — baseline LIGUE (sans modèle d'équipe)** :
  `buildTendencyTable([], Train(g), { alpha: 5, lambdaPerWeek: 0.9, now: now(g) })`
  → les prédictions se réduisent au prior ligue conditionnel P_ligue(c | slotGroup, side),
  renormalisé après exclusions. C'est la version FORTE de « présence ligue »
  (conditionnelle au slot) — choisie exprès : battre une présence brute
  slot-agnostique serait trop facile.
- **Baseline secondaire (descriptive, jamais de verdict)** — gelée elle
  aussi : top-K par **présence brute pick+ban** de `Train(g)` — comptes
  d'**actions** (chaque pick et chaque ban résolu compte 1),
  **slot-agnostique et side-agnostique** (un seul classement, tous slots et
  sides confondus, recalculé par game sur son `Train(g)`) ; l'exclusion `E_i`
  (§1.4) est appliquée par **filtrage** de la liste classée **avant la
  troncature au K** ; **aucune renormalisation** (des comptes, jamais des
  probabilités). Ex æquo : compte desc, puis clé asc — déterministe.
- α = 5 et λ = 0,9 sont les défauts shippés de `aggregates/tendency.ts` — gelés,
  aucun réglage pour ce run.
- **Caches du harnais (gelés)** : tables du bras A mémoïsées par
  **(corpus, patch, équipe, now(g))** — la table équipe dépend de `now(g)`
  via λ, jamais de réutilisation entre jours ; tables du bras B par
  **(corpus, patch)** — licite car le prior ligue n'est **pas décoté**
  (`aggregates/tendency.ts` : « deliberately NOT recency-weighted », aucun λ
  sur le prior), la table baseline est donc indépendante de `now(g)`.

### 1.4 Scoring d'une unité

Soit a₁…a_m les actions de g du côté s, triées par `seq` (m ≤ 10 ; les bans
sautés sont absents par construction). Pour i = 1…m :

- `E_i` = ensemble des `championKey` des actions de g (les DEUX côtés) de
  `seq < seq(a_i)` — exactement l'information publique au moment réel de l'action ;
- `pred_i` = `predict(table, { slotGroup: slotGroupOf(a_i), side: s, exclude: E_i })`
  (tri déterministe du module : p desc, rawCount desc, clé asc) ;
- `hit_i(K)` = `a_i.championKey` ∈ les K premiers de `pred_i`
  (`pred_i` vide ⇒ miss honnête, convention du runner existant) ;
- **survie** : `survive_u(K, P) = ∧_{i=1..P} hit_i(K)`, définie ssi m ≥ P ;
- **profondeur tenue** : `D_u(K) = max{ d ≤ 6 : ∧_{i≤d} hit_i(K) }` (0 si
  hit₁ est faux). Les unités avec m < 6 sont exclues du critère primaire et
  comptées (m < 6 exige ≥ 4 bans sautés — quasi inexistant).

Identité structurelle (publiée dans le rapport) :
**moyenne(D) = Σ_{P=1..6} taux de survive(K, P)** — le critère primaire est
l'aire sous la courbe de survie, pas une cellule.

### 1.5 Publication — la courbe, pas un point

- **Grille complète** : taux de survive(K, P) pour K ∈ {1, 2, 4, 6, 8} ×
  P ∈ {1…10}, bras A et bras B côte à côte, **Wilson 95 %** par cellule, sur le
  pool des corpus. Par corpus : la colonne K = 4 (P = 1…10) + le point d'usage.
- **Taux par action** (descriptif) : hit rate à K = 4 par slotGroup
  (B1-B3, B4-B5, P1, P2-3, P4-5, P6, P7, P8-9, P10) — le complément est le taux
  d'alarme que l'UI affichera.
- **Tranches descriptives** (jamais promues en verdict) : unités dont l'équipe a
  ≥ 10 games au train vs < 10 (informera le badge de confiance UI).
- **Profondeur tenue** : moyenne(D) à K = 4 par bras, pool + par corpus.

### 1.6 Critère de verdict (UN run, UN critère)

> **PRIMAIRE** : sur le pool des corpus listés, unités éligibles (m ≥ 6) ;
> Δ = moyenne(D_modèle) − moyenne(D_baseline) à K = 4 (plafond 6) ;
> IC bootstrap 95 % **apparié par unité et clusterisé par game** (les 2 unités
> d'une game tirées ensemble), `mulberry32(seed 42)`, 1000 resamples.
> **VERT ssi lo(IC) > 0.** Rien d'autre ne rend la gate verte : aucune cellule
> de la grille, aucune tranche, aucun corpus isolé ne peut être promu si le
> primaire échoue. Pas de second essai, pas de retuning après lecture.

Le choix (K = 4, plafond P = 6) est un choix **produit** gelé avant le run :
K = 4 branches = ce qu'un panneau et une page A4 de répertoire affichent
lisiblement (convention prep échecs) ; P = 6 = la phase 1 adverse complète
(3 bans + 3 picks), l'horizon réaliste d'une prep — la phase 2 est réactive
par nature et appartient au coach live. Aucune cible chiffrée de couverture
n'est inventée avant la mesure (règle R9) : le verdict porte uniquement sur
le **delta vs baseline**.

Ce run valide le **squelette de l'arbre** (les branches adverses et l'alarme
de déviation — qui en est le complément exact). Il ne dit RIEN de la qualité
de NOS réponses dans l'arbre : ça, c'est la gate coach (cible #1 de la run #2,
chantier séparé). Les deux claims ne se mélangent pas.

### 1.7 Commande du run

```bash
node --experimental-transform-types --no-warnings scripts/backtest/planCoverage.ts \
  static/corpus/lck-2026.json static/corpus/lec-2026.json \
  static/corpus/lfl-2026.json static/corpus/lpl-2026.json \
  data/corpus/lec-2025.json data/corpus/lfl-2025.json data/corpus/lpl-2025.json \
  --seed 42 --out docs/calibration/plan-coverage-2026.md
```

---

## 2. Design technique

### 2.1 Vue d'ensemble

```
PREP (mode Prep, /plans/[id])                LIVE (page draft, mode séquence)
─────────────────────────────                ────────────────────────────────
DraftPlan (intentions humaines)              toDraftActions(draftSeq)   ← exact
        │ compilePlanTree                            │
        ▼                                            ▼
PlanTree (arbre compilé contre T)  ──────►  trackPlan(tree, actions)
   branches = predict(table T)                       │
   réponses = navigate / plan                        ▼
        │ savePlanTree                       PlanTrackState
        ▼                                      on-script → réponse préparée
IndexedDB 'planTrees' (v3)                     their-deviation → coach live + re-greffe
```

Tout le calcul vit dans des modules $lib **purs** (distribution, horloge,
évaluateur injectés) ; la page et le storage font l'I/O.

### 2.2 `src/lib/strategic/planTree.ts` (nouveau, pur)

```ts
/** Tunables DA-V2-6 — injectables, jamais enfouis. */
export interface PlanTreeConfig {
    /** Branches adverses conservées par nœud (le K validé par la gate). */
    branchK: number;          // défaut 4
    /** Horizon en ACTIONS ADVERSES (P de la gate). */
    enemyDepth: number;       // défaut 6
    /** Masse de chemin minimale pour étendre un nœud (Π des p des branches). */
    minPathMass: number;      // défaut 0.02
    /** Budget total de nœuds — expansion par priorité de masse (frontière max d'abord). */
    maxNodes: number;         // défaut 2000
    /** Au-dessus : réponse via navigate ; en dessous : mapping statique du plan. */
    replyMassFloor: number;   // défaut 0.05
}
export const PLAN_TREE_DEFAULTS: PlanTreeConfig;

export interface PlannedAction {
    seq: number;
    type: 'pick' | 'ban';
    championKey: string;
    /** Repli si le primaire est indisponible sur cette ligne. */
    fallback?: string;
    /** Raisons FR figées à la compilation (axes du navigator/plan). */
    reasonsFr?: string[];
}

export interface PlanBranch {
    championKey: string;
    /** Masse du modèle à la compilation (tri + affichage). */
    p: number;
    /** Évidence brute figée — « 4 des 6 dernières » (evidenceString). */
    rawCount: number;
    total: number;
    /** L'évidence à un clic (méthodo §7) : jusqu'à 3 games d'exemple. */
    exampleGameIds?: string[];
    child: PlanTreeNode;
}

export interface PlanTreeNode {
    /** NOS actions préparées depuis la branche parente jusqu'au tour adverse (0..2). */
    ourLine: PlannedAction[];
    /** seq template du tour adverse de ce nœud ; null = horizon atteint. */
    enemySeq: number | null;
    /** Triées p desc ; vide si nœud non étendu (masse/budget) — « ligne mince ». */
    branches: PlanBranch[];
    /** Produit des p depuis la racine (1 à la racine). */
    pathMass: number;
}

export interface PlanTree {
    planId: string;
    /** Nom de l'équipe adverse modélisée. */
    opponent: string;
    ourSide: DraftSide;
    /** Horloge injectée à la compile. */
    builtAt: number;
    /** Provenance du modèle : nb de records, patch max, ligue (DA-V2-4). */
    modelProvenance: { records: number; latestPatch?: string; league?: string };
    config: PlanTreeConfig;
    /** Lockouts Fearless / exclusions au moment de la compile. */
    excludedKeys: string[];
    root: PlanTreeNode;
    nodeCount: number;
}

export interface CompileContext {
    ourSide: DraftSide;
    plan: DraftPlan;
    /** MÊME seam que le navigator (couplage par type de fonction, jamais d'import). */
    enemyDistribution: (state: DraftState, slot: NavigatorSlot) => EnemyDistributionEntry[];
    /** Évidence brute par candidat (rawCount/total/gameIds) — depuis l'intel. */
    evidenceOf?: (championKey: string, slot: NavigatorSlot) => { rawCount: number; total: number; exampleGameIds?: string[] };
    /** Notre réponse sur une ligne : navigate (masse haute) ou plan statique (masse basse). */
    ourReply: (state: DraftState, slot: NavigatorSlot) => PlannedAction | null;
    excludedKeys?: string[];
    config?: Partial<PlanTreeConfig>;
    /** Horloge injectée. */
    now: number;
}

export function compilePlanTree(ctx: CompileContext): PlanTree;
```

Algorithme de `compilePlanTree` :

1. État racine : `DraftState` vide (exclusions = `excludedKeys`),
   `firstPickSide: 'blue'` (convention du board) ; `ourLine` racine = nos
   actions template jusqu'au premier tour adverse (via `nextSlotOf` +
   `ourReply`, chaque action appliquée immutablement).
2. **Expansion par priorité de masse** : une frontière (max-heap par
   `pathMass`) ; on dépile le nœud de masse max, on appelle
   `enemyDistribution` sur son état (exclusions du chemin appliquées —
   c'est `predict` derrière, donc top-K propre), on garde `branchK`
   branches, on déroule `ourLine` de chaque enfant jusqu'au tour adverse
   suivant, on empile les enfants dont `pathMass ≥ minPathMass` et dont la
   profondeur adverse < `enemyDepth`. Arrêt quand la frontière est vide ou
   `nodeCount ≥ maxNodes`.
3. Les réponses `ourReply` coûteuses (navigate) ne sont calculées que si
   `pathMass ≥ replyMassFloor` ; en dessous, mapping statique du plan
   (premier primaire du rôle encore ouvert disponible sur la ligne) — le
   pattern « ligne principale épaisse, sidelines minces » du répertoire
   d'échecs. Coût : le squelette (predict seul) est en millisecondes ;
   navigate (depth 2, topK 5) sur les ~10-30 nœuds au-dessus du plancher
   reste sous la seconde — compile interactive.

Important : la **gate (§1) ne dépend pas de ce module** — elle appelle
`predict` directement. `compilePlanTree` est le produit ; si la gate est
verte, le produit utilise exactement le même modèle au même K.

### 2.3 `src/lib/strategic/planTracker.ts` (nouveau, pur)

```ts
export type PlanTrackStatus =
    | 'not-started'      // aucune action saisie
    | 'on-script'        // tout matche, l'arbre est vivant
    | 'our-deviation'    // NOUS avons quitté notre ligne (suivi continue, averti)
    | 'their-deviation'  // pick/ban adverse hors des K branches → coach reprend
    | 'beyond-prep'      // horizon de l'arbre atteint sans casse (normal en phase 2)
    | 'complete';        // draft finie

export interface PlanTrackState {
    status: PlanTrackStatus;
    /** Actions adverses matchées depuis la racine. */
    enemyMatched: number;
    /** Nœud courant (null après déviation adverse ou horizon). */
    node: PlanTreeNode | null;
    /** Notre prochaine action préparée si on-script. */
    nextPrepared: PlannedAction | null;
    /** Branches attendues au tour adverse courant (affichage, p + évidence). */
    expectedBranches: PlanBranch[];
    /**
     * false dès le PREMIER our-deviation, et pour tout le reste de la draft :
     * l'arbre a été compilé le long de NOTRE ligne — quittée, les branches
     * restent indicatives mais ne sont plus garanties par la gate.
     */
    branchesAuthoritative: boolean;
    /** L'action qui a cassé le script. */
    breakingAction?: { seq: number; championKey: string; byUs: boolean };
    /** Phrase d'état FR pour le bandeau. */
    headlineFr: string;
}

export function trackPlan(tree: PlanTree, actions: DraftAction[], ourSide: DraftSide): PlanTrackState;
```

Sémantique de `trackPlan` (rejouée à chaque changement du board, pur et
sans état) :

- parcours des `actions` triées par seq ; action ADVERSE → match contre les
  branches du nœud courant **après filtrage des branches devenues
  indisponibles** (champion consommé entre-temps — l'arbre est statique, le
  board est la vérité) : match → descente ; non-match → `their-deviation`
  avec `breakingAction` (le p modèle du pick réel, s'il était dans la
  distribution compilée, est affiché — « hors des 4 branches, p modèle 3 % »).
  Si elle survient APRÈS un our-deviation (`branchesAuthoritative === false`),
  la bannière ne s'habille **JAMAIS** des chiffres de couverture mesurés par
  la gate : la gate a mesuré le modèle conditionné au préfixe réel, pas un
  arbre dont nous avons quitté la ligne — wording neutre « hors des branches
  affichées » ;
- action À NOUS ≠ `ourLine` (ni primaire ni fallback) → `our-deviation`,
  **persistant** : le statut ne redevient jamais `on-script`, même si la
  suite re-matche (il ne peut qu'évoluer vers their-deviation / beyond-prep /
  complete), et `branchesAuthoritative` passe à `false` pour le reste de la
  draft. Le suivi des branches adverses CONTINUE (notre écart n'invalide pas
  leur tendance ; les branches périmées sont filtrées par disponibilité),
  mais les `expectedBranches` s'affichent comme **indicatives, non
  garanties** — l'arbre avait été compilé le long de NOTRE ligne. L'UI
  propose « Recompiler le script d'ici » **dès ce moment** ;
- nœud sans branches (ligne mince / horizon) → `beyond-prep`.

La proposition après déviation n'est PAS un nouveau moteur : le CoachPanel
(`recommendNext`) tourne déjà en continu sur l'état réel — la bannière fait
le **handover explicite** (« le coach en direct reprend la main ») + un
bouton « Recompiler le script d'ici » qui relance `compilePlanTree` depuis
l'état courant (horizon = actions adverses restantes, budget réduit —
< 2 s, c'est le « re-plan local via navigate » du besoin). Le bouton apparaît
dès `our-deviation`, sans attendre que LEUR action casse : recompiler depuis
l'état réel est la seule façon de rendre les branches à nouveau garanties.

### 2.4 Persistance — rétro-compatible

- `src/lib/storage/idb.ts` : `DB_VERSION = 3`, `STORES` + `'planTrees'`.
  L'upgrade path n'ajoute QUE des stores (invariant documenté du module) —
  les plans/séries/préférences existants survivent tels quels.
- `src/lib/storage/planTrees.ts` (nouveau) :

```ts
export interface StoredPlanTree extends PlanTree { id: string; } // id = planId
export async function savePlanTree(tree: PlanTree): Promise<StoredPlanTree>;
export function getPlanTree(planId: string): Promise<StoredPlanTree | undefined>;
export function deletePlanTree(planId: string): Promise<undefined>;
```

- `DraftPlan` lui-même n'est **pas modifié** (rétro-compat parfaite, pas de
  migration) : l'arbre est un artefact séparé keyé par `planId`, chargé
  paresseusement (la liste /plans ne paie jamais le poids des arbres ;
  ~0,2-1 Mo par arbre compilé selon le budget). Supprimer un plan supprime
  son arbre (cascade dans la page).

### 2.5 Harnais de validation

- `src/lib/backtest/planCoverage.ts` (nouveau, pur, testé) — toute la logique
  de §1 : `enemyActionsOf(record, side)`, `unitHits(record, side, table, K)`,
  `surviveGrid(units, Ks, Ps)`, `heldDepth(hits, cap)`,
  `clusterPairedBootstrap(unitsA, unitsB, byGame, metric, { rng, iterations })`,
  et `makeTableCache(records)` — les tables mémoïsées aux clés gelées de
  §1.3, dans la lib pour être testables sans le script. Le script ne contient
  AUCUNE logique de scoring ni de cache (pattern runCorpus).
- `scripts/backtest/planCoverage.ts` (nouveau) — en-tête = règle §1 gelée,
  hooks node + résolution `$lib` (copie du patron `postdiction.ts`), argv =
  corpus + `--seed` + `--generated-at` + `--out`, écrit
  `docs/calibration/plan-coverage-2026.md`. Caches de tables (§1.3) :
  - **bras A** : clé **(corpus, patch, équipe, now(g))** — la table équipe
    dépend de `now(g)` via λ, jamais de réutilisation entre jours ; `now(g)`
    étant au jour, les games d'une même journée partagent leur entrée
    (mesuré sur les 7 corpus : ≈ 3 000 réutilisations pour ≈ 5 300 unités,
    Bo3/Bo5 et blocs de journée — le cache reste rentable) ;
  - **bras B** : clé **(corpus, patch)** — justification gelée dans
    l'en-tête : le prior ligue n'est **pas décoté** (aucun λ sur le prior,
    documenté dans `aggregates/tendency.ts`), la table baseline est donc
    indépendante de `now(g)`.

### 2.6 UI (français, apprenant) — la lecture de l'arbre en mode séquence

Nouveau composant `src/lib/components/PlanTreePanel.svelte`, monté sur la
page draft (`src/routes/+page.svelte`) uniquement en `entryMode === 'sequence'`
(l'ancrage live : l'ordre exact est connu, `toDraftActions(draftSeq)` alimente
`trackPlan` en `$derived`). Lecture verticale, trois blocs :

1. **La ligne de vie** : « Script de prep — Plan A contre KOI » + chips des
   actions adverses vues (vertes = matchées), statut en clair :
   « Dans le script (3 sur 3) » / « Ils ont dévié » / « Vous avez quitté votre
   ligne » / « Fin de la prep — le coach continue ».
2. **Maintenant** : à notre tour → « Votre réponse préparée : Vi — *garde
   l'engage et la paire avec Rell* » (+ fallback) ; au tour adverse →
   « Attendu chez eux : 1. Rell 31 % · *4 des 6 dernières* · voir les games ·
   2. … » — l'évidence à un clic (gameIds d'exemple), comptes bruts jamais
   logits, blanc pour les choix proches (convention solver). Après un
   our-deviation (`branchesAuthoritative === false`), le titre devient
   « Attendu chez eux (indicatif — vous avez quitté le script) » et le bloc
   ne cite plus aucun chiffre de la gate.
3. **Déviation** (bannière ambre) : « Sorti du script à leur 4ᵉ action :
   K'Sante n'était dans aucune des 4 branches préparées. Le coach en direct
   reprend la main ci-dessous. [Recompiler le script d'ici] ». Variante
   our-deviation, proposée **dès que nous quittons la ligne** : « Vous avez
   quitté votre ligne — les branches adverses restent affichées à titre
   indicatif. [Recompiler le script d'ici] ». Une their-deviation survenant
   APRÈS un our-deviation garde le wording neutre « hors des branches
   affichées » et ne cite jamais les chiffres de couverture mesurés (§2.3).

Deux nombres, **jamais confondus**, dans le panneau comme côté prep :
**la couverture du MODÈLE** (mesurée par la gate, K = 4, lue dans la courbe
publiée) — la seule autorisée à se formuler « le script tient en moyenne
X actions adverses » — et **la masse couverte par CET arbre, par profondeur
adverse** (Σ `pathMass` des nœuds étendus à chaque profondeur), propriété du
compile (budget `maxNodes`, plancher `minPathMass`) qui ne se déguise jamais
en tenue moyenne.

Pédagogie (panneau « Comment lire ? ») : « Un script qui casse n'est pas une
prep ratée — sur les drafts pro mesurées, une part des drafts sort aussi du
script à cette profondeur [chiffre de la courbe publiée]. L'arbre sert à
répondre vite tant qu'il tient, et à voir le MOMENT où il faut réfléchir à
neuf. » Partout où un chiffre de couverture est affiché — ce panneau, le
badge, le sélecteur K, la bannière —, il est accompagné de la ligne de
caveat : « mesuré sous entrelacement supposé blue-first (ordre intra-équipe
exact, alternance entre équipes conventionnelle — §3, risque 9) ». Badge
selon verdict (§5) ; provenance affichée (« modèle : 14 games KOI,
patch ≤ 26.10 », DA-V2-4).

Côté prep : `/plans/[id]` gagne « Compiler contre [adversaire synchronisé] »
(l'intel de la page draft fournit `table`/évidence via `buildOpponentIntel` ;
sans adversaire synchronisé ni corpus, le bouton est désactivé avec
explication). L'export prep pack (`src/lib/exports/prepPack.ts`) gagne une
section « répertoire » imprimable : lignes de masse ≥ `replyMassFloor`,
cible 2 pages A4 (critère R6).

### 2.7 Hors périmètre v1 (dette explicite)

- **SoloQ** : les bans y sont des exclusions simultanées, pas des actions
  ordonnées — l'arbre v1 est `format: 'pro'` seulement (le panneau se masque
  en soloq, avec une ligne d'explication).
- **Fearless multi-game** : l'arbre se compile par game avec `excludedKeys`
  de la série (le seam existe déjà) ; la valeur de rétention I4 dans les
  réponses préparées attend la gate G3.
- **Branches via le range model I1 complet** (pool/méta/info négative) :
  swap possible derrière la MÊME gate rejouée — jamais de swap silencieux.

---

## 3. Analyse des fuites (leakage) et des risques de fishing

| # | Risque | Neutralisation dans le design |
|---|---|---|
| 1 | **Fuite temporelle** (la honte M3.x) | Walk-forward par patch strict : `Train(g)` = patchs < k du même corpus ; le premier patch n'est jamais scoré ; patch absent/illisible ⇒ unité écartée et comptée. La game scorée n'est jamais dans son propre train (le patch k entier est exclu — plus strict que nécessaire, assumé). |
| 2 | **Fuite par la récence** (λ) | `now(g)` = jour de la game (connu du staff en prep réelle) ; il ne pondère QUE des records de patchs antérieurs. Fallback : jour de la date max du train si la game n'est pas datée ; aucun record du train daté ⇒ unité écartée et comptée (0 cas sur les corpus actuels). |
| 3 | **Fuite par les exclusions** | `E_i` ne contient que le préfixe `seq < seq(a_i)` de la game — l'information publique au moment réel de l'action. Aucun lookahead, pas d'exclusion « parce qu'on sait la suite ». |
| 4 | **Cherry-picking d'un point (K, P)** | La grille complète {1,2,4,6,8} × {1…10} est publiée pour les DEUX bras ; le verdict est l'**aire sous la courbe** (moyenne de D ≡ Σ survive(K=4, P≤6)) — un agrégat de toute la courbe utile, au point d'usage produit gelé et motivé AVANT le run. Aucune cellule, tranche ou ligue ne peut être promue a posteriori. |
| 5 | **Tuning déguisé** | α = 5, λ = 0,9 (défauts shippés), tri de `predict`, règle d'exclusion, fallback `now` : tout est gelé dans l'en-tête. Toute variante (autre K par défaut, modèle I1, fenêtres) = NOUVEAU run pré-enregistré, documenté comme tel. |
| 6 | **Pseudo-réplication** (2 unités/game) | Les unités (g, blue) et (g, rouge) partagent la game : bootstrap **clusterisé par game** (les 2 unités voyagent ensemble dans chaque resample) — sans ça l'IC serait anti-conservateur. Les Wilson par cellule restent descriptifs ; le verdict porte sur le bootstrap clusterisé. |
| 7 | **Baseline trop faible** (victoire facile) | La baseline primaire est la version FORTE du « sans modèle d'équipe » : prior ligue **conditionnel au (slotGroup, side)**, même α/λ, mêmes exclusions, même code path (`buildTendencyTable([], train)`). La présence brute slot-agnostique n'est publiée qu'en plancher descriptif. Le delta mesure exactement « que vaut modéliser CETTE équipe ». |
| 8 | **Couverture jointe qui s'effondre** (≈ rᴾ) | Avec des hit rates par action ~0,2-0,4, survive(P=6) sera très bas pour les deux bras — c'est attendu et HONNÊTE (le rapport le dira tel quel). Le critère primaire est la profondeur moyenne tenue (continue, 0-6), qui garde de la puissance là où une cellule profonde n'en aurait aucune. n ≈ 4 800-5 000 unités ⇒ des deltas de ~0,1 action sont détectables. |
| 9 | **Ordre `assumed-blue-first`** | L'entrelacement du corpus est supposé blue-first (l'ordre intra-équipe, lui, est exact). Biais PARTAGÉ par les deux bras (mêmes cellules slotGroup) ⇒ le delta n'est pas contaminé ; les niveaux absolus peuvent l'être marginalement pour les games First Selection — noté dans le rapport, et la ligne de caveat accompagne le chiffre de couverture partout où l'UI l'affiche (§2.6). |
| 10 | **Confusion des claims** | Ce run ne valide QUE le squelette adverse (branches + alarme). La qualité de NOS réponses (navigate) = gate coach, chantier séparé. L'UI ne dira jamais « plan validé » sur la foi de cette gate — elle dira « couverture adverse mesurée ». |
| 11 | **Métrique ≠ produit** | Le produit (compile par masse, budget maxNodes) PRUNE ; la métrique non. Réconciliation : au K et à l'horizon validés, le compile n'élague jamais en dessous de K branches sur les nœuds atteints — `minPathMass`/`maxNodes` ne touchent que l'EXTENSION en profondeur, et le tracker en live re-filtre par disponibilité exactement comme la métrique (exclusions du préfixe réel). L'alarme live = le complément exact de hit_i(K). Après un our-deviation cette équivalence n'est plus garantie — d'où `branchesAuthoritative` et l'interdiction d'habiller la déviation des chiffres mesurés (§2.3). |
| 12 | **L'adversaire joue contre le modèle** (méta-niveau, §9.7d V2) | Hors scope d'une postdiction ; limite produit documentée dans le panneau (« une équipe qui se sait lue peut casser ses habitudes ») — première défense : l'alarme elle-même. |

---

## 4. Plan d'implémentation pas-à-pas

Chaque étape laisse `pnpm test` vert et `svelte-check` à 0 erreur. Les étapes
1-3 (la gate) précèdent tout le produit — DA-V2-11 dans l'ordre du travail.

1. **Lib de scoring pure** — `src/lib/backtest/planCoverage.ts` +
   `tests/planCoverage.test.ts` : mini-corpus synthétique main-calculé
   (2 patchs, 3 équipes, bans sautés inclus) vérifiant : premier patch non
   scoré, exclusions de préfixe, hit/survive/heldDepth, l'identité
   moyenne(D) = Σ survive, le bootstrap clusterisé déterministe
   (`mulberry32(1)` rejoué), unité m < 6 exclue et comptée, et le cache de
   tables : deux games même (patch, équipe) à des dates (jours) différentes
   ⇒ tables du bras A **différentes** (la clé inclut `now(g)`).
2. **Script pré-enregistré** — `scripts/backtest/planCoverage.ts` : en-tête =
   §1 gelé mot pour mot, hooks node/$lib du patron `postdiction.ts`, caches
   de tables de §1.3/§2.5 — (corpus, patch, équipe, now(g)) côté modèle,
   (corpus, patch) côté baseline. Dry-run UNIQUEMENT sur fixtures
   synthétiques (tests) pour valider le pipeline — pas de lecture de
   résultats réels avant le run officiel.
3. **LE run** (une commande, §1.7, 7 corpus listés) →
   `docs/calibration/plan-coverage-2026.md` publié + verdict consigné dans
   `STATUS.md`. À partir d'ici le verdict est connu et plus rien ne se règle.
4. **Moteur d'arbre** — `src/lib/strategic/planTree.ts`
   (+ `tests/planTree.test.ts`) : distribution injectée déterministe →
   structure attendue à K=2/E=2 calculée à la main ; budget par masse ;
   exclusions le long des lignes (un champion consommé en amont ne
   réapparaît jamais en aval) ; `replyMassFloor` (navigate appelé seulement
   au-dessus — compté via un spy injecté).
5. **Tracker** — `src/lib/strategic/planTracker.ts`
   (+ `tests/planTracker.test.ts`) : scénarios on-script complet,
   their-deviation (avec p modèle du pick réel), our-deviation puis suite
   re-matchée (statut persistant, `branchesAuthoritative` reste `false`),
   their-deviation APRÈS our-deviation (wording neutre, aucun chiffre de
   gate), branche périmée filtrée, beyond-prep, draft complète.
6. **Storage** — `idb.ts` v3 + `src/lib/storage/planTrees.ts`
   (+ `tests/planTrees.storage.test.ts` sous fake-indexeddb) : upgrade v2→v3
   préserve un plan existant écrit en v2 ; save/get/delete par planId ;
   cascade de suppression testée au niveau page (étape 7).
7. **UI livraison** — `PlanTreePanel.svelte` + intégration page draft
   (mode séquence : sélection du plan compilé, `trackPlan` en `$derived` de
   `toDraftActions`, bannière déviation + handover coach + « Recompiler
   d'ici ») ; `/plans/[id]` : bouton compile contre l'adversaire synchronisé,
   résumé d'arbre (nœuds, masse couverte par CET arbre par profondeur
   adverse — Σ pathMass des nœuds étendus, jamais formulée en « tenue
   moyenne » —, provenance), suppression en cascade. Textes FR apprenant +
   « Comment lire ? » + badge selon verdict.
8. **Prep pack imprimable** (optionnel, dernier) — section répertoire dans
   `src/lib/exports/prepPack.ts` : lignes ≥ `replyMassFloor`, cible 2 pages A4.

Estimation : étapes 1-3 ≈ 1 session ; 4-6 ≈ 1-1,5 session ; 7-8 ≈ 1-1,5 session.

---

## 5. Ce que le verdict change

### Si VERT (lo(IC) > 0 au critère primaire)

- **Le claim ship** : « arbre préparé contre CET adversaire » sans badge
  Expérimental sur les branches et l'alarme ; le panneau affiche les DEUX
  nombres de §2.6, jamais confondus : la **couverture du MODÈLE** mesurée par
  la gate (K = 4) — la seule formulée « à 4 branches, le script tient en
  moyenne X actions adverses, contre Y pour un arbre ligue », toujours
  flanquée du caveat blue-first — et la **masse couverte par CET arbre** par
  profondeur adverse (Σ pathMass des nœuds étendus). La couverture publiée
  DEVIENT le texte pédagogique de la déviation (« sortir du script arrive
  dans Z % des drafts pro : c'est une information, pas un échec ») — réservé
  aux déviations à branches garanties (`branchesAuthoritative`, §2.3).
- Les défauts `PLAN_TREE_DEFAULTS` (K = 4, E = 6) sont gelés sur le point
  validé ; le sélecteur K de l'UI (2/4/6/8) affiche la couverture mesurée de
  chaque option depuis la courbe publiée — jamais un chiffre inventé,
  toujours avec la ligne de caveat (§2.6).
- Suites dans l'ordre : (a) brancher l'évidence par joueur dès
  `enrichPlayers` (ranges par joueur dans les branches) ; (b) tenter le swap
  squelette → range model I1 complet derrière la MÊME règle rejouée (run de
  réplication séparé) ; (c) la section répertoire du prep pack passe au rang
  de livrable R6 (2 pages A4).

### Si ROUGE (IC touche ou croise 0, ou en défaveur)

- **Le claim adverse-spécifique meurt, pas la feature** : l'arbre se replie
  honnêtement en « répertoire de ligue » (les branches = le bras baseline,
  qui reste un objet de prep utile), badge **Expérimental** (DA-V2-11) sur
  tout libellé « contre cet adversaire », et le wording de l'alarme devient
  « hors des réponses fréquentes de la ligue » — l'alarme reste un fait
  d'écart au préparé, elle ne prétend plus lire l'équipe.
- **Pas de retuning post-lecture** : ni K, ni α/λ, ni le modèle ne bougent
  sur la foi de ce rapport. Les pistes de relance sont des RUNS NOUVEAUX
  pré-enregistrés, nourris par les tranches descriptives publiées : si la
  tranche ≥ 10 games d'équipe penche nettement, la relance naturelle est
  « gate conditionnelle à l'évidence » (l'arbre équipe ne se compile qu'avec
  assez de games — sinon répertoire de ligue) ; si les bans portent et pas
  les picks, la relance rejoint le chantier ban-history (#1 de STATUS).
- Le rapport rouge est versionné dans `docs/calibration/` comme les autres :
  un rouge bien posé est un résultat (la preuve banEV phase 1 → phase 2 l'a
  montré en une journée).

— Design rédigé le 2026-06-11 (run #2, chantier D). Aucun fichier source
modifié ; la règle de §1 doit être collée telle quelle dans l'en-tête de
`scripts/backtest/planCoverage.ts` avant tout run.
