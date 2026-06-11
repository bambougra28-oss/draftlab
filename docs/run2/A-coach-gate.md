# Gate COACH — postdiction « conseil suivi » — Design run #2

> GELÉ post-revue adversariale (2026-06-11) — règle définitive, aucun paramètre ne bouge après ce commit.

> Chantier A de la run #2 (`ETAT_DES_LIEUX.md` §F.1) : LA gate produit manquante.
> Elle réalise, par anticipation, la métrique d'acceptation de la porte G5
> (« taux d'accord navigator/équipes gagnantes stratifié publié »,
> `ARCHITECTURE_V2.md` §8 R7) et lève — ou maintient — le badge Expérimental du
> coach (DA-V2-11). Patron canonique suivi : `scripts/backtest/postdiction.ts`
> (règle gelée en en-tête, hooks node, `$lib` pur, walk-forward par corpus).
>
> La question produit : « si une équipe avait suivi le top-1 du coach,
> gagnait-elle plus ? ». La causalité est inaccessible (on ne rejoue pas les
> games) ; la forme falsifiable choisie : **le coach classe-t-il les picks
> réellement joués par les équipes GAGNANTES au-dessus de ceux des PERDANTES,
> dans la même game, au-delà de ce qu'un simple suivi de méta obtiendrait ?**
> Plafond honnête assumé (`docs/research/2026-06_methodologie_draft.md` §3.1) :
> la compo seule vaut ~55-58 % d'accuracy — l'effet attendu est petit, le
> design est dimensionné pour le détecter ou le déclarer indétectable.

---

## 1. Règle pré-enregistrée

> Le bloc ci-dessous est rédigé pour être recopié tel quel dans l'en-tête de
> `scripts/backtest/coachGate.ts` et committé AVANT tout run. UNE règle, UN
> run : aucun paramètre ne bouge après lecture du moindre résultat.

### 1.1 Le coach mesuré (configuration shippée, figée)

Le « coach » de cette gate est exactement la chaîne de production du panneau
Coach (`src/routes/+page.svelte` → `recommendNext` → `navigate`), en mode
fallback (aucun roster synchronisé — les pools joueurs historiques n'existent
pas dans le corpus, attribution `enrichPlayers` en attente) :

- **Évaluateur** : `makeAnalyzeDraftEvaluator({ dataset, fullDataset },
  { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 })` —
  la config exacte de la page. `dataset`/`fullDataset` = snapshots gelés du
  CDN DraftGap (`current-patch.json`, `30-days.json`), tirés UNE fois avant le
  run, sha256 et date publiés dans le rapport. Pas de `sideContext` (aucun
  terme de side : l'évaluation est symétrique entre les deux camps).
- **Recherche** : `navigate` avec `depth: 2`, `topK: 4` — les valeurs passées
  par la page (le défaut `candidateCount: 6` de `recommendNext` est tronqué à
  `topK = 4` à la racine par `navigate` : le panneau shippé classe au plus 4
  candidats ; la gate mesure CE classement-là).
- **Mode pick-only : NON — `picksOnly: false` gelé** : la gate rejoue des
  records à ordre exact dont les bans réels sont dans S_t — le chemin
  séquence-tournoi de la page (`+page.svelte`, mode `sequence` hors SoloQ :
  état par `draftStateFromActions`, bans ordonnés inclus, `picksOnly: false`).
  Les nœuds de ban du lookahead sont des nœuds normaux — les nôtres : les 6
  candidats shippés re-filtrés par disponibilité ; les adverses : `predict`
  sur `banRotationOf`.
- **Candidats** (chaîne shippée `coachFallback` → `rankOurCandidates`,
  exportée de `liveDraft.ts` et importée telle quelle par le runner) :
  top-15 des champions par **présence du train** (tri : présence desc, clé
  asc — le tri exact de la page), filtrés par disponibilité à l'état courant,
  les 6 premiers retenus, tronqués à 4 par la racine de `navigate`.
- **Distribution adverse** (nœuds d'espérance) : `predict` sur la table de
  tendances de l'équipe ADVERSE réelle, `buildTendencyTable(train, train,
  { team: équipeAdverse, now: now_k })`, α = 5, λ = 0,9/semaine (défauts
  module), exclusions = champions révélés au nœud, filtrée par disponibilité —
  `enemyDistributionOf` de `liveDraft.ts` elle-même, exportée et importée
  telle quelle par le runner.
  `now_k` = la plus ancienne `date` des records du patch testé k dans le même
  corpus (repli : `--generated-at`) — l'ancre temporelle « jour de match »
  (déviation déclarée vs `corpusRunner` qui utilise `generatedAt` : avec un
  `now` à aujourd'hui, l'évidence d'équipe 2025 pèserait λ^50 ≈ 0,005 contre
  un prior α = 5 non décéléré — la table serait dénaturée).
- Les couches cosmétiques de `recommendNext` (raisons FR, `pairFit`,
  `counterFit`, headline) n'altèrent pas les VALEURS : la gate pilote
  `navigate` directement avec les mêmes injections.

### 1.2 Walk-forward et éligibilité

- **Walk-forward par patch, PAR CORPUS** (chaque fichier = sa propre
  timeline, patron `postdiction.ts`) : pour une game au patch k, train = les
  records du MÊME corpus de patchs strictement antérieurs (`comparePatches`),
  minTrainSize = 1 (parité maison). Premier patch / patch non parseable ⇒
  game non scorée (comptée).
- **Corpus du run** : exactement 7, figés au commit de gel —
  `static/corpus/{lck,lec,lfl,lpl}-2026.json` +
  `data/corpus/{lec,lfl,lpl}-2025.json` (2 661 drafts). `lck-2025.json` ne
  rejoint pas ce run : il ira au run de réplication étiqueté — même règle,
  rapport séparé.
- **Lockouts Fearless (config data-driven fixée avant le run)** : détecteur
  déterministe par corpus = nombre de picks réutilisés entre games d'une même
  série (`series.matchId`, `gameNumber` croissant). Lockouts ACTIFS ssi
  détecteur = 0. Mesuré le 2026-06-11 (avant gel) : lck-2026 0/2050,
  lec-2026 0/1130, lfl-2026 0/500, lpl-2026 0/2830, lec-2025 0/1650,
  lpl-2025 0/4980 → ON ; **lfl-2025 46/1580 → OFF**. Quand ON : pour une game
  de `gameNumber` > 1, les picks des games antérieures de la série sont
  retirés de la disponibilité (picks seulement — hard Fearless ne verrouille
  pas les bans). Le détecteur est recalculé et publié par le script.
- **Game éligible** : vainqueur connu, 10 picks résolus (`championKey ≠ ''`)
  sur les seqs template (7-12, 17-20), patch plaçable, fold non vide.
- **Tour scoré** : seq de pick t dont l'action réelle est résolue ; l'état
  S_t = actions réelles résolues de seq < t (tri seq), `firstPickSide` du
  record ; le slot dérivé (`nextSlotOf`) doit coïncider (seq, type pick, side)
  avec l'action réelle, sinon tour écarté — cause `template-mismatch`
  (typiquement bans skippés), comptée par corpus ; comparateurs ≥ 2 requis
  (cf. 1.3). Disponibilité = univers (clés tags ∪ train ∪ game) − révélés −
  lockouts ; le pick réel est garanti disponible (il a été joué — toute
  collision avec un lockout est une anomalie comptée).
- **Game scorée** : chaque side a ≥ 4 de ses 5 tours scorés. Les bans ne sont
  PAS scorés (le conseil de ban est déjà couvert par les pistes banEV du
  scorecard ; cette gate mesure le conseil de PICK).

### 1.3 Métrique primaire — re-ranking apparié vainqueur-perdant

Candidat (a) retenu comme primaire. Pour chaque tour scoré t du side s :

1. **C_t** = les candidats que le panneau shippé classerait à cet état
   (présence-top-15 du train → filtre disponibilité → 6 premiers → troncature
   racine à 4).
2. **v(x)** pour x ∈ C_t ∪ {pick réel} : valeur expectimax de x, calculée par
   `navigate` en racine forcée (`ourCandidates` renvoie `[x]` à l'état racine,
   la liste shippée aux états plus profonds), depth 2, topK 4, memo partagé
   entre les appels du même tour. Le pick réel est évalué par exactement le
   même chemin que les candidats.
3. **Percentile du pick réel** :
   `ρ_t = ( #{c ∈ C_t \ {réel} : v(réel) > v(c)} + 0,5 · #{c : v(réel) = v(c)} ) / |C_t \ {réel}|`,
   avec |C_t \ {réel}| ≥ 2 exigé (sinon tour écarté, compté).
4. **Score de side** : R(g, s) = moyenne des ρ_t sur les tours scorés du side.
5. **Crédit de game** : crédit(g) = 1 si R(g, vainqueur) > R(g, perdant) ;
   0,5 si égalité exacte ; 0 sinon.
6. **TD (taux de discrimination)** = Σ crédits / n games scorées, publié avec
   **Wilson 95 %** (`wilson95(Σcrédits, n)` — crédits fractionnaires : les
   égalités flottantes exactes sont quasi impossibles, l'approximation est
   déclarée), poolé sur les corpus du run ET par corpus.

### 1.4 Baselines (obligatoires, pré-enregistrées)

- **B0 — hasard 0,5** : par symétrie d'appariement, un classement sans
  information donne TD = 0,5.
- **B1 — coach-présence (baseline ACTIVE de la gate)** : protocole identique
  (mêmes games, mêmes tours, mêmes C_t), v remplacé par
  `v_présence(x) = −rang(x)` dans l'ordre total (présence du train desc, clé
  asc) ; un champion absent du train classe dernier. C'est « le coach qui ne
  sait que suivre la méta » : il neutralise l'explication « les vainqueurs
  jouent simplement les champions à la mode ».
- **B2 — écho-dataset (CONTRÔLE descriptif, sans pouvoir de gate)** :
  protocole identique, `v_écho(x)` = Σ_rôles wins / Σ_rôles games du champion
  x dans `current-patch.json` (le snapshot gelé — sommes sur ses
  `statsByRole`), 0 si le champion en est absent ; égalités départagées par
  tie-break déterministe (clé asc). B2 est volontairement anachronique seul :
  il borne la part du verdict attribuable à l'écho « méta future » du
  dataset (cf. §3.1).

### 1.5 Critères de verdict (gelés)

- **Critère 1** : borne basse Wilson 95 % du TD poolé > 0,5. Limite
  pré-enregistrée (reprise dans les Notes du rapport) : les games d'une même
  série sont corrélées — l'IC Wilson, i.i.d., est anticonservateur ; le même
  TD est publié en secondaire (S5) avec IC bootstrap clusterisé par série.
- **Critère 2** : delta apparié TD_coach − TD_présence (B1), bootstrap par
  CLUSTER de série via `clusterBootstrapDeltaCI`
  (`src/lib/backtest/clusterBootstrap.ts`, module fourni par l'architecte,
  conventions `metrics.ts` : rng injecté, quantiles type 7, IC percentile
  2,5-97,5 %) : observations `PairedObservation` {cluster = `series.matchId`
  — une game sans série = son propre cluster —, model = crédit coach,
  baseline = crédit B1} appariées par game ; chaque itération resample les
  clusters et recolle les crédits appariés modèle/B1 des games tirées ;
  1000 resamples, mulberry32, **seed 42** ; IC 95 % du delta strictement > 0.
- **VERT** = critère 1 ET critère 2 → gate produit franchie : badge
  Expérimental levé sur le panneau Coach, ligne ajoutée au scorecard R9.
- **ORANGE** = critère 1 seul → « le coach discrimine, mais pas mieux que le
  suivi de méta » : badge conservé, claim limité, levier suivant pré-identifié
  (§5).
- **ROUGE** = critère 1 non atteint → aucun claim de conseil ; enquête
  pré-cadrée (§5), la règle est consommée — pas de retuning.

Puissance déclarée : n attendu ≈ 2 300-2 450 games (2 661 − premiers patchs
− écartées) ; au seuil n = 2 400, le critère 1 exige TD ≳ 52,0 % (MDE ≈ +2,0
pp). Un effet réel plus petit sera publié « non significatif » — c'est le
contrat.

### 1.6 Secondaires descriptives (pré-enregistrées, AUCUN pouvoir de verdict)

- **S1 — accord top-1 différentiel** (candidat b) : part des tours où le pick
  réel = argmax v sur C_t, séparée vainqueurs/perdants (Wilson chacun, delta
  affiché) ; le taux poolé est le « accord navigator » du scorecard G5.
- **S2 — regret** (candidat c) : moyenne de (v(argmax C_t) − v(réel)) × 100
  pp, vainqueurs vs perdants — descriptif uniquement (échelle d'évaluateur
  non calibrée, pas de Platt).
- **S3 — TD du contrôle B2** (écho-dataset), poolé + par corpus.
- **S4 — tranche équilibrée** (stratification par force, l'esprit I5) : games
  où chaque équipe a ≥ 5 games de train et |WR_train(blue) − WR_train(red)| ≤
  0,10 ; TD Wilson sur la tranche.
- **S5 — TD poolé sous IC bootstrap clusterisé** : la statistique du
  critère 1, IC percentile par resampling des clusters de série
  (`clusterBootstrapDeltaCI` à baseline nulle, mêmes 1000 itérations, même
  seed 42) — la lecture robuste à la corrélation intra-série, publiée à côté
  du Wilson.
- Couverture publiée : games éligibles/scorées, tours écartés par cause —
  dont `template-mismatch` (bans skippés), pré-déclarée dans le tableau de
  couverture avec son compte PAR CORPUS ; ces tours restent écartés —, part
  des tours avec distribution adverse active, part des picks réels déjà
  dans C_t, valeurs du détecteur Fearless, anomalies.

---

## 2. Design technique

### 2.1 Fichiers

| Fichier | Statut | Rôle |
|---|---|---|
| `src/lib/backtest/coachGate.ts` | **nouveau** (pur) | percentile, crédit, agrégation par game, types — zéro I/O, évaluateur injecté |
| `src/lib/intel/liveDraft.ts` | **modifié** (2 exports) | `rankOurCandidates` et `enemyDistributionOf` passent `export` — fonctions pures, zéro logique modifiée — importées par le runner au lieu d'être répliquées |
| `src/lib/backtest/clusterBootstrap.ts` | **existant** (fourni par l'architecte) | `clusterBootstrapDeltaCI` — bootstrap apparié par cluster de série, conventions `metrics.ts` — consommé tel quel |
| `tests/coachGate.test.ts` | **nouveau** | tests calculés à la main (percentile avec égalités, crédit, agrégation, side ≥ 4 tours) + test d'équivalence chaîne runner ↔ `recommendNext` (roster absent) |
| `scripts/backtest/coachGate.ts` | **nouveau** | runner : règle gelée en en-tête, hooks node `$lib` (copie du patron `postdiction.ts`), chargement corpus + dataset, folds, rapport |
| `data/dataset/current-patch.json`, `data/dataset/30-days.json` | **nouveaux, non commités** (`data/dataset/` ajouté au `.gitignore`, motif voisin de `data/raw/`) | snapshots CDN gelés ; sha256 + date publiés |
| `docs/calibration/coach-gate-2026.md` | **généré** | le rapport (patron postdiction : tables Wilson, couverture, notes) |

Côté `src/lib` existant : seuls deux exports ajoutés (`rankOurCandidates`,
`enemyDistributionOf` dans `liveDraft.ts`), zéro logique modifiée. `navigate`,
`predict`, `buildTendencyTable`, `computePresence`,
`makeAnalyzeDraftEvaluator`, `wilson95`, `clusterBootstrapDeltaCI`,
`mulberry32`, `comparePatches`, `parsePatch` suffisent tels quels.

### 2.2 Lib pure — `src/lib/backtest/coachGate.ts`

```ts
/** Percentile de `value` parmi `comparators` (égalités à ½). [0,1]. */
export function percentileAmong(value: number, comparators: number[]): number;

/** 1 si winnerMean > loserMean, 0,5 si égalité exacte, 0 sinon. */
export function creditOf(winnerMean: number, loserMean: number): 0 | 0.5 | 1;

export interface CoachTurnScore {
    seq: number;
    side: DraftSide;
    /** ρ_t du pick réel. */
    percentile: number;
    /** Le pick réel est l'argmax de C_t (secondaire S1). */
    top1Agree: boolean;
    /** v(argmax C_t) − v(réel), en probabilité (secondaire S2). */
    regret: number;
    comparators: number;
}

export interface CoachGameScore {
    gameId: string;
    credit: 0 | 0.5 | 1;
    winnerMean: number;
    loserMean: number;
    turns: CoachTurnScore[];
}

export type SkipReason =
    | 'no-winner' | 'unresolved-picks' | 'no-fold' | 'template-mismatch'
    | 'too-few-comparators' | 'side-coverage';

/** Seam : valeur expectimax d'un candidat à un état (le script l'implémente
 *  par navigate en racine forcée ; les tests par une table à la main). */
export type CandidateValueFn = (
    state: DraftState,
    slot: NavigatorSlot,
    championKey: string
) => number;

export interface ScoreGameDeps {
    valueOf: CandidateValueFn;
    /** C_t : les candidats que le panneau shippé classerait à cet état (le
     *  script l'implémente par `rankOurCandidates` importé de `liveDraft.ts` ;
     *  les tests par une liste posée). */
    candidatesOf: (state: DraftState, slot: NavigatorSlot) => string[];
    /** Univers − lockouts Fearless de la game (révélés gérés en interne). */
    availableOf: (revealed: Set<string>) => Set<string>;
}

/** Scoring d'une game : tours → sides → crédit. Pure, déterministe. */
export function scoreGameForGate(
    record: DraftRecord,
    deps: ScoreGameDeps
): { score: CoachGameScore } | { skipped: SkipReason };
```

Le contrat testable à la main : `percentileAmong(0.52, [0.50, 0.52, 0.55])`
= (1 + 0,5)/3 = 0,5 ; `creditOf(0.61, 0.61)` = 0,5 ; une game synthétique à
2 candidats avec table de valeurs posée donne le crédit attendu.

### 2.3 Runner — `scripts/backtest/coachGate.ts`

CLI (patron maison) :

```
node --experimental-transform-types --no-warnings scripts/backtest/coachGate.ts \
  static/corpus/lck-2026.json [...] data/corpus/lpl-2025.json \
  --dataset data/dataset/current-patch.json --full-dataset data/dataset/30-days.json \
  [--seed 42] [--generated-at ISO] [--out docs/calibration/coach-gate-2026.md] [--smoke]
```

Structure interne, par corpus :

1. **Détecteur Fearless** : réutilisations inter-games par série → flag
   lockouts, publié.
2. **Folds paresseux par patch k** (Map, clés patch) :
   - `train_k` = records de patchs < k ;
   - `presenceRank_k` = ordre total (présence desc, clé asc) via
     `computePresence(train_k)` ; `top15_k` = ses 15 premiers ;
   - `tables_k : Map<team, TendencyTable>` (paresseuse par équipe, patron
     `corpusRunner`), `now_k` = min date des records du patch k ;
   - `wrTrain_k : Map<team, {wins, games}>` (tranche S4).
3. **Par game éligible, par seq de pick t** (ordre seq) :
   - état S_t (actions résolues < t, `firstPickSide` du record, disponibilité
     univers − révélés − lockouts ∪ {pick réel}) ;
   - `C_t = rankOurCandidates(ctx, S_t, 6).slice(0, 4)` — la fonction shippée
     importée de `liveDraft.ts` (`ctx` du tour : sans roster,
     `fallbackCandidates = top15_k`) ;
   - `memo = new Map()` partagé ; pour x ∈ C_t ∪ {réel} :
     `navigate(S_t, { ourSide: slot.side, ourCandidates: (s) =>
     s.actions.length === S_t.actions.length ? [x] : shipped6,
     enemyDistribution, evaluate, depth: 2, topK: 4, memo })` →
     `candidates[0].value` (la racine forcée n'explore que x) ;
     `enemyDistribution` = `enemyDistributionOf(ctx, s, enemySlot)` importée
     de `liveDraft.ts` (`ctx.table` = `tables_k(équipe adverse du record)` ;
     exclusions du nœud et filtre disponibilité gérés par la fonction
     shippée) ;
   - ρ_t, top1Agree, regret via la lib.
4. **Baselines** : mêmes (game, tours, C_t), scorers `v_présence` (rang dans
   `presenceRank_k`) et `v_écho` (Σ_rôles wins / Σ_rôles games dans
   `current-patch.json`, 0 si absent, tie-break clé asc) — purs lookups, pas
   de navigate.
5. **Agrégation** : crédits modèle/B1/B2 appariés par game →
   `wilson95` (TD poolé + par corpus) ; critère 2 :
   `clusterBootstrapDeltaCI(obs, { iterations: 1000, rng: mulberry32(seed) })`
   avec `obs` = {cluster = `series.matchId` (sinon l'id de la game), model =
   crédit, baseline = crédit B1} ; S5 = même appel à baseline nulle. Partout
   où les crédits transitent en pairs : meanP = métrique locale du runner
   (pairs) ⇒ Σ p / n (les crédits vivent dans p, won = true partout) — ne PAS
   utiliser `accuracy` de `metrics.ts`, qui seuillerait à 0,5 ; secondaires ;
   rapport markdown (tables « | Tranche | n | TD | Wilson 95 % | Verdict | »,
   section Couverture, Notes honnêtes, seed, sha256 datasets, valeurs du
   détecteur).
6. `--smoke` : exécute UN corpus et n'imprime QUE timing + couverture (aucun
   taux) — le garde-fou anti-lecture-prématurée.

### 2.4 Coût (ordre de grandeur, chiffré)

- Décisions : 2 661 games × 10 tours ≈ **26 610**.
- Par tour : ≤ 5 racines forcées (4 candidats ∪ réel) × (1 éval immédiate +
  ≤ 4 feuilles au ply 2) ≈ **25 appels évaluateur** → ≈ **0,67 M appels**
  `analyzeDraft` (+ 2 `inferRoles` chacun, gloutons, O(25) lookups).
- À 0,1-0,5 ms l'appel : **2-12 min** mono-thread, mémo partagé par tour en
  déduit ~20 %. Les baselines B1/B2 sont des lookups (négligeables).
- **Budget : la config shippée (depth 2, topK 4) tient sans réduction** — on
  pré-enregistre les paramètres du produit, pas un sous-régime. Si le smoke
  révèle > 60 min total : paralléliser PAR CORPUS (7 processus, même règle),
  jamais réduire depth/topK (ce serait mesurer un autre coach).

---

## 3. Analyse des fuites et des risques de fishing

### 3.1 Fuites temporelles

| Canal | Risque | Neutralisation |
|---|---|---|
| Tables de tendances adverses | la game testée informe sa propre distribution adverse | fit STRICT sur `train_k` (patchs < k, même corpus), par équipe — patron `corpusRunner` ; équipe absente du train ⇒ `predict` = [] ⇒ lookahead dégradé honnête (compté en couverture) |
| Candidats C_t | la présence inclurait la game testée | `computePresence(train_k)` uniquement |
| WR d'équipes (tranche S4) | idem | `train_k` uniquement |
| Évaluateur SoloQ au patch COURANT sur des games passées | **anachronisme assumé, PAS une fuite d'issues** : les winrates SoloQ ne contiennent aucune issue du corpus pro (population disjointe). Deux effets : (i) bruit — les champions re-équilibrés depuis sont mal valorisés pour les vieux patchs, ce qui dégrade le coach SYMÉTRIQUEMENT (même dataset pour les deux sides d'une game : l'appariement annule le biais de camp) et joue CONTRE le verdict ; (ii) **écho méta-future** — le dataset courant sur-valorise les champions devenus méta, que les vainqueurs (équipes fortes, faiseuses de méta) jouaient peut-être plus tôt : un faux positif partiel est possible par ce canal | (a) snapshot unique gelé, hashé, daté ; (b) **contrôle B2** : si l'écho seul discrimine, son TD le quantifie noir sur blanc et la lecture du verdict le cite ; (c) baseline ACTIVE B1 : le critère 2 exige de battre le suivi de méta walk-forward ; (d) limite déclarée en Notes : l'anachronisme n'est pas éliminable sans snapshots datés historiques (DA-V2-3, inexistants pour le SoloQ passé) |
| `now` des tables | `now` = aujourd'hui écraserait l'évidence d'équipe 2025 sous le prior α | `now_k` = début du patch testé (1.1), ancre ≤ toute game testée du patch, ≥ le train — leak-free et fidèle au jour de match |
| Tags 26.11 sur games 2025 | non utilisés par le chemin de VALEUR (seulement l'univers de clés) | sans objet pour le classement ; noté |

### 3.2 Auto-information du pick réel

- Le pick réel **n'informe jamais son propre classement** : C_t vient du
  train (présence) et de l'état public S_t ; le réel y est ajouté comme
  candidat évalué par le MÊME chemin (racine forcée), jamais comme signal.
- L'état S_t ne contient que les actions de seq < t : l'information
  légitimement disponible au moment de la décision, rien d'autre (pas les
  picks suivants, pas l'issue).
- La distribution adverse du lookahead est une PRÉVISION (tendances train) —
  si elle « devine » le vrai pick adverse suivant, c'est du mérite de modèle,
  pas une fuite.
- Le memo est partagé entre candidats d'un même tour uniquement (états
  enfants, indépendants de l'identité de la racine) — aucune contamination
  inter-tours ni inter-games.

### 3.3 Confusions (pas des fuites, mais des fausses lectures possibles)

- **Force d'équipe** : les vainqueurs sont plus forts ET piquent « mieux » au
  sens de n'importe quelle échelle sensée — un TD > 0,5 seul ne prouve pas le
  coach. Paré par : critère 2 (battre B1, qui capte « les forts jouent la
  méta ») + tranche S4 (matchs équilibrés) descriptive.
- **Side** : l'évaluateur n'a pas de terme de side (pas de `sideContext`) et
  chaque side est scoré à SES tours contre SES candidats — le percentile
  normalise l'asymétrie structurelle des rotations.
- **Ordre `assumed-blue-first`** : l'entrelacement des seqs est une hypothèse
  de construction (ère First Selection) — il déforme S_t identiquement pour
  les deux sides d'une game ; déclaré en Notes (et exact pour les corpus
  2025, pré-First Selection).
- **Calibration absente** : la métrique primaire est un RANG (invariante par
  transformation monotone de l'évaluateur) — aucun pp affiché en primaire ;
  le regret S2 (échelle-dépendant) est explicitement descriptif.

### 3.4 Anti-fishing

- **UNE règle, UN run** : tout est gelé ici — depth 2, topK 4,
  `picksOnly: false`, chaîne de candidats, α/λ, `now_k`, seuils d'éligibilité
  (≥ 2 comparateurs, ≥ 4 tours par side), seed 42, crédit ½ pour les
  égalités, cluster de série comme unité de resampling, lockouts par
  détecteur, liste des 7 corpus. L'en-tête du script reprend ce bloc verbatim
  et le commit précède le run.
- **Un seul critère de verdict** (1 + 2) : les secondaires S1-S5 sont
  étiquetées descriptives AVANT le run — aucune ne peut « sauver » un rouge ni
  invalider un vert.
- **Tranches pré-déclarées uniquement** : poolé, par corpus, S1-S5. Aucune
  découpe post-hoc (par patch, par équipe, par seq…) ne peut être promue dans
  le verdict ; si une exploration ultérieure veut creuser, c'est une nouvelle
  règle gelée.
- **Smoke aveugle** : `--smoke` n'imprime ni TD ni deltas — uniquement
  timing/couverture, pour valider le coût sans lire le résultat.
- **Échec structurel possible assumé** : si n final < ~1 900, le MDE dépasse
  +2,2 pp et la gate peut être structurellement non concluante — publié tel
  quel, pas de re-découpage pour « trouver » la significativité.

---

## 4. Plan d'implémentation pas-à-pas

Chaque étape est committable et testable isolément ; rien ne lit un résultat
métrique avant l'étape 8.

1. **Snapshot dataset** : tirer `current-patch.json` + `30-days.json` du CDN
   vers `data/dataset/`, ajouter `data/dataset/` au `.gitignore`, imprimer
   sha256 + date. Test : les deux JSON se chargent, `championData` non vide.
2. **Lib pure** `src/lib/backtest/coachGate.ts` (`percentileAmong`,
   `creditOf`, types, `scoreGameForGate` avec seams injectés) + exports
   `rankOurCandidates` / `enemyDistributionOf` dans
   `src/lib/intel/liveDraft.ts` (fonctions pures, export sans changement de
   comportement) + `tests/coachGate.test.ts` calculés à la main (cas :
   égalités de percentile, crédit ½, side à 3 tours ⇒ skip `side-coverage`,
   template mismatch) + test d'équivalence OBLIGATOIRE : sur un état
   synthétique avec roster absent, la chaîne du runner (imports + `navigate`)
   reproduit exactement les `candidates[].championKey` et `enemyExpectation`
   de `recommendNext`. Gate : `pnpm test` vert.
3. **Squelette runner** : hooks node (copie `postdiction.ts`), argv, chargement
   corpus, détecteur Fearless, folds paresseux (présence, top-15, tables par
   équipe, `now_k`, WR train). Test : `--smoke` sur `lfl-2026` imprime
   couvertures et zéro métrique.
4. **Chemin de valeur** : `valueOf` par `navigate` racine-forcée + memo
   partagé, `enemyDistribution` important `enemyDistributionOf`. Test
   unitaire (lib) : sur un mini-état synthétique à évaluateur jouet, la racine
   forcée renvoie la même valeur que `navigate` non forcé pour le même
   candidat classé premier.
5. **Baselines** B1 (rang de présence) et B2 (écho-dataset, formule
   Σ_rôles wins / Σ_rôles games gelée en 1.4) + secondaires
   S1/S2 + tranche S4. Test : sur le mini-corpus synthétique, B1 reproduit un
   crédit calculé à la main.
6. **Rapport** : tables Wilson (TOUS + par corpus + S1-S5), bootstrap
   clusterisé (delta vs B1 ; IC du TD pour S5 ; seed, ordre des IC fixes),
   Couverture (tours écartés par cause et par corpus, dont
   `template-mismatch`), Notes honnêtes (anachronisme dataset + écho, ordre
   assumé, corrélation de série — Wilson anticonservateur —, MDE, détecteur).
   Test : rendu sur le mini-corpus synthétique, byte-stable à
   seed/`--generated-at` fixés.
7. **Gel** : recopier la règle §1 dans l'en-tête du script — y compris la
   ligne « Mode pick-only : NON — `picksOnly: false` gelé » —, commit
   « coach gate : règle pré-enregistrée » AVANT le run.
8. **LE run** : 7 corpus, seed 42, `--out docs/calibration/coach-gate-2026.md` ;
   smoke timing préalable autorisé (aveugle). Publier le rapport tel quel.
9. **Suites du verdict** (§5) : STATUS + scorecard R9 + badge/copy UI selon la
   couleur — dans un commit séparé du run.

---

## 5. Ce que le verdict change

### Si VERT (critères 1 ET 2)

- **Le claim produit central existe enfin** — formulation pré-écrite (les
  nombres remplis depuis le rapport, rien d'autre) : « Sur N drafts pro
  2025-2026 rejouées en walk-forward, le coach classe le pick des vainqueurs
  au-dessus de celui des perdants dans X % des games [IC Wilson], et fait
  mieux que le simple suivi de méta (+Y pp, IC bootstrap clusterisé par
  série). Corrélation, pas causalité : personne ne rejoue les games. »
- **UI** : le badge Expérimental du CoachPanel devient « Mesuré — voir la
  gate » (lien provenance vers `docs/calibration/coach-gate-2026.md`) ;
  DA-V2-11 satisfaite.
- **Scorecard R9** : deux lignes ajoutées (TD vs B1 ; accord top-1 S1 = le
  « accord navigator » de G5) — la cible chiffrée des patchs suivants est
  fixée à la première mesure (règle R9).
- **Config de référence gelée** (DA-V2-6) : depth 2 / topK 4 / candidats
  présence-15→6→4 deviennent la référence validée — tout changement futur de
  ces paramètres ou de l'évaluateur RE-passe la gate avant de shipper.
- **Débloque** : I5 (revue annotée) peut citer une échelle dont la
  discrimination est mesurée ; le chantier « plans à branches » hérite d'un
  navigator crédité.

### Si ORANGE (critère 1 seul)

- Claim limité, publié honnêtement : « le coach lit la méta — il ne fait pas
  encore mieux qu'elle ». Badge conservé.
- Le levier suivant est DÉJÀ identifié et priorisé : remplacer la chaîne de
  candidats présence par (a) les pools joueurs réels (`enrichPlayers`, dès
  que le throttle Leaguepedia lâche) et (b) les ranges I1 complets au root —
  puis NOUVELLE règle gelée (run #3 du chantier). Aucun retuning de ce run.

### Si ROUGE (critère 1 non atteint)

- Le coach n'est pas montrable comme conseil : copy UI revue (« explorateur
  de lignes », pas « recommandation »), badge conservé, aucune ligne
  scorecard.
- Enquête pré-cadrée (sans toucher à la règle consommée) :
  1. lire B2 : si l'écho-dataset seul discrimine alors que le coach non,
     l'évaluateur anachronique brouille le classement → priorité aux
     snapshots SoloQ datés (DA-V2-3) avant tout nouveau run ;
  2. suspect n°1 documenté : le transfert SoloQ→pro de l'évaluateur (verdict
     fondateur n°3) → chantier recalibration des poids (régression logistique
     sur features différentielles, méthodologie §3.2, priors N₀ pro R4) ;
  3. suspect n°2 : candidats sans contrainte de rôle (le percentile compare
     le réel à des candidats parfois injouables) → variante candidats
     rôle-filtrés, en nouvelle règle.
- Dans tous les cas le rapport est publié tel quel — un rouge mesuré vaut
  mieux que le statu quo : c'était LA métrique absente de l'outil entier.

---

*Rédigé le 2026-06-11 (chantier A, run #2). Données d'appui mesurées avant
gel : config shippée lue dans `src/routes/+page.svelte` (depth 2, topK 4,
candidateCount 6, picksOnly false en séquence-tournoi, fallback présence-15) ;
détecteur Fearless 7 corpus (seul lfl-2025 ≠ 0) ; couverture corpus 2025 :
100 % patch/vainqueur/10-picks.*
