# Chantier C — Fearless & gate G3 (valeur série) — Design run #2

> GELÉ post-revue adversariale (2026-06-11) — règle définitive, aucun paramètre ne bouge après ce commit.

> Rédigé le 2026-06-11 (run d'architecture #2, chantier C). Références :
> `ARCHITECTURE_V2.md` §6 bis I4 + §8 R5 (porte G3), `docs/calibration/README.md`
> (protocole), `scripts/backtest/postdiction.ts` (patron canonique),
> `src/lib/backtest/clusterBootstrap.ts` (statistiques clusterisées — module
> architecte, testé), `docs/research/2026-06_methodologie_draft.md` §4.1-4.2
> (JueWuDraft), `src/lib/strategic/seriesSolver.ts`, `src/lib/storage/series.ts`,
> `src/lib/strategic/draftNavigator.ts`. Contexte produit : Alain joue en
> Bo1/Bo3/Bo5, avec et sans Fearless — la valeur série est une cible de
> premier rang, pas un luxe d'analyste.
>
> Statut : **design gelé — aucun fichier source modifié par ce chantier** (le
> module statistique `clusterBootstrap.ts` consommé par la règle est fourni et
> commité par l'architecte). La règle du §1 est gelée TELLE QUELLE et sera
> recopiée verbatim dans l'en-tête du script avant tout run.

---

## 1. Règle pré-enregistrée

### 1.0 Audit data (mesuré le 2026-06-11, avant toute conception de métrique)

L'audit a été conduit sur les 7 corpus présents (2 661 drafts ; LCK 2025
toujours absent — la règle n'en dépend pas). Faits établis :

| Corpus | Records | Séries (matchId) | Multi-games | Longueurs 2/3/4/5 | Picks games 2+ | **Re-picks (either side)** |
|---|---|---|---|---|---|---|
| LCK 2026 | 337 | 132 | 132 | 77/43/6/6 | 2 050 | **0** |
| LEC 2026 | 246 | 133 | 67 | 31/30/2/4 | 1 130 | **0** |
| LFL 2026 | 191 | 141 | 23 | 7/8/5/3 | 500 | **0** |
| LPL 2026 | 445 | 162 | 162 | 70/72/11/9 | 2 830 | **0** |
| LEC 2025 | 308 | 143 | 97 | 50/30/13/4 | 1 650 | **0** |
| LFL 2025 | 317 | 159 | 88 | 36/40/6/6 | 1 580 | **46 (2,91 %)** |
| LPL 2025 | 817 | 319 | 267 | 103/114/33/17 | 4 980 | **0** |
| **Total** | **2 661** | **1 189** | **836** | 374/337/76/49 | **14 720** | 46 |

- `series.matchId` + `gameNumber` : **100 % présents**, 0 doublon de
  gameNumber, 0 trou (max = longueur), 0 série aux noms d'équipe incohérents.
  Rôles sur picks : **100 %**. Dates : **100 %**. `series.mode` : **0 %**
  (l'inférence empirique est la seule vérité de mode). `firstSelection` :
  **0 %** (le solveur rejouera sans branche FS — documenté).
- **Le test Fearless empirique tranche** : les 46 re-picks de LFL 2025 sont
  TOUS concentrés dans « LFL 2025 Promotion » (3 séries, 46/80 = 57,5 % des
  picks ultérieurs re-pickés — l'étalon du régime standard). Partout ailleurs :
  **0 re-pick sur 14 640 picks de games 2+** → le hard Fearless (champions
  pickés par l'un OU l'autre camp retirés aux DEUX) est un fait mesuré sur
  toutes les ligues 2025-2026 du corpus, pas une hypothèse. Les re-bans d'un
  champion déjà consommé confirment : 20 en LFL Promotion (normal en standard),
  **1 anomalie isolée** ailleurs (`LPL/2025 Season/Split 1_Week 2_5_3`,
  Ambessa ban seq 2 — vraisemblable erreur de saisie amont, à signaler, sans
  effet sur la consommation par picks).
- Couverture du pool d'équipe (walk-forward) : **70,3 %** des picks de games
  2+ figurent dans le pool train de l'équipe (68,1 % même rôle) → ~30 % de
  picks « nouveaux » : toute surface doit inclure un prior ligue, et le
  plafond structurel du hit@5 est partagé modèle/baseline. Mesure
  outcome-adjacente (recall du pool train) prise avant gel — aucun hit@5, ρ ou
  AUC calculé — déclarée telle quelle aux Notes du rapport (§2.4).
- Puissance : **2 944 événements bruts (équipe × game g ≥ 2)** — 2 928 après
  exclusion TEST 0 : LFL Promotion = 3 séries, 16 événements ; ~125 séries
  atteignent la G4 (lecture « rétention G4/G5 ») ; ~460 séries de longueur ≥ 3
  pour l'ordre de rétention.
- Bo2 réels en 2026 (séries 1-1 : LCK 21, LEC 12, LPL 23) : la métrique de
  consommation est agnostique au format ; l'inférence de format ne sert qu'à S3.

### 1.1 La règle (texte à geler verbatim dans l'en-tête de `scripts/backtest/seriesRetention.ts`)

```
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
```

### 1.2 Ce que la règle revendique (et ne revendique pas)

- La PRIMAIRE valide la **surface de demande série** — l'ingrédient porteur du
  solveur I4 : c'est elle qui prix le déni (`wantProbability`, aujourd'hui
  non injectée → « déni non chiffré » dans `mustWinAnalysis`) et qui pondère
  le sac-à-dos du terme moteur (§2.3). Claim si G3-demande VERTE : « la
  demande Fearless par rôle prédit la consommation réelle mieux que la
  présence ».
- Elle ne revendique PAS que le terme composite `evaluate + γ·S` gagne des
  games : la composite reste badgée Expérimental (DA-V2-11) avec composants
  affichés séparément (DA-V2-12) tant qu'une gate de composite (type
  « conseil suivi » série) n'existe pas.
- S2 est une mesure d'observation honnête (premier traitement public du déni
  hard-Fearless — first-mover), pas une preuve causale.
- S3 teste si l'ordre de rétention du solveur EXISTANT correspond au
  comportement des gagnants — c'est l'opérationnalisation du critère
  « rétention G4/G5 » de §8 R5, à enjeu badge (pas la porte) ; un rouge serait
  une découverte (« les pros brûlent tôt »), pas un bug.

### 1.3 Amendement de gouvernance requis (architecte)

La primaire ci-dessus décide une porte que le document gouvernant définit
encore, à la lettre, par la seule corrélation de rétention : tant que
l'amendement n'est pas commité, ce chantier ne peut PAS prétendre imprimer
« G3 VERTE » — d'où le verdict nommé « G3-demande VERTE/ROUGE » partout
(script, rapport). Lignes précises à amender AVANT le run — l'architecte
committera l'amendement lui-même :

- `docs/ARCHITECTURE_V2.md`, §8 « Roadmap R0 → R9 » (ligne 545) → « R5 —
  Series Solver Fearless » (ligne 585) → **ligne 589**, l'acceptation :
  « **Acceptation (porte G3)** : rejeu de Bo5 fearless 2025-2026 réels —
  corrélation positive documentée entre nos valeurs de rétention et les
  champions effectivement gardés G4/G5 par les vainqueurs ; la jauge
  d'intégrité identifie l'équipe qui « craque » mieux que le hasard ;
  < 200 ms par évaluation de nœud. » À réécrire pour que la porte soit
  décidée par la primaire pré-enregistrée ici (G3-demande : hit@5 M vs B1,
  IC bootstrap cluster par série), que la corrélation de rétention soit
  explicitement portée par S3 (enjeu : badge du panneau dépense/garde), que
  la jauge d'intégrité (non construite à ce jour) soit datée ou sortie du
  critère de porte, et que « < 200 ms par évaluation de nœud » soit
  requalifié critère de branchement UI live (publié informatif au run).
- `docs/calibration/README.md`, section « Métriques actuelles et extensions
  prévues », **lignes 84-88** — la mention « corrélation de rétention
  Fearless (G3) », ligne 86 : à amender pour que l'extension G3 nomme la
  métrique de porte réelle (hit@5 de demande série M vs présence B1) et
  renvoie la corrélation de rétention au secondaire S3.

LE run (étape 5 du plan §4) est BLOQUÉ tant que cet amendement n'est pas dans
l'historique.

---

## 2. Design technique

Trois modules `$lib` purs (zéro I/O, zéro horloge — seams injectables),
un script de gate, trois fichiers de tests calculés à la main. Les IC
bootstrap clusterisés et le Spearman à rangs moyens sont CONSOMMÉS depuis le
module pur existant `src/lib/backtest/clusterBootstrap.ts`
(`clusterBootstrapDeltaCI`, `spearman` — fourni par l'architecte, testé dans
`tests/clusterBootstrap.test.ts`) : rien de statistique n'est codé dans le
script. Aucune modification d'un module existant n'est requise pour le run.

### 2.1 `src/lib/backtest/seriesReplay.ts` (nouveau, pur)

Reconstitution des séries réelles + test empirique de mode. Réutilisable par
les gates futures et par l'UI (import d'une série réelle).

```ts
export interface ReconstructedSeries {
    matchId: string;
    tournament?: string;
    league?: string;
    /** Games triées par series.gameNumber (1..L vérifié sans trou ni doublon). */
    games: DraftRecord[];
    /** Exactement deux noms d'équipe sur toute la série. */
    teams: [string, string];
    /** Champion pické plus tôt dans la série re-pické ensuite (l'un OU l'autre camp). */
    repickCount: number;
    /** Ban d'un champion déjà consommé (anomalie sous hard Fearless), gameIds joints. */
    rebanOfConsumed: { gameId: string; championKey: string }[];
}
export interface SeriesAnomaly {
    matchId: string;
    kind: 'duplicate-game-number' | 'gap' | 'teams';
    detail: string;
}
export function reconstructSeries(records: DraftRecord[]): {
    series: ReconstructedSeries[];
    anomalies: SeriesAnomaly[];
};
/** ∪ picks résolus des games de gameNumber < g (les deux camps). */
export function consumedBeforeGame(series: ReconstructedSeries, gameNumber: number): Set<string>;
export interface TournamentFearlessRow {
    tournament: string;
    multiGameSeries: number;
    laterPicks: number;
    repicks: number;
    rebans: number;
    /** repicks === 0 (la règle TEST 0). */
    fearlessConfirmed: boolean;
}
export function tournamentFearlessTable(series: ReconstructedSeries[]): TournamentFearlessRow[];
/**
 * Équipe STRICTEMENT au maxWins quand chaque game a un vainqueur ; undefined
 * sinon. Contrat explicite : égalité de maxWins ⇒ undefined (Bo2 1-1 et
 * série 2-2 abandonnée : exclues).
 */
export function seriesWinner(series: ReconstructedSeries): string | undefined;
/** maxWins 2 ⇒ 'bo3', 3 ⇒ 'bo5', autre ⇒ undefined (série S3-inéligible). */
export function inferFormat(series: ReconstructedSeries): 'bo3' | 'bo5' | undefined;
```

### 2.2 `src/lib/estimators/seriesDemand.ts` (nouveau, pur)

La surface de demande gelée du §1.1 — ET l'adaptateur `wantProbability` que
`seriesSolver.denialValue` exige en injection (jamais deviné, contrat du
module). La décroissance temporelle RÉUTILISE `recencyWeight` de
`$lib/aggregates/tendency.ts` (même clamp âge ≥ 0, poids 1 si non daté) —
zéro réimplémentation de la pondération. Modèle et baselines partagent le
même objet ajusté : aucune asymétrie d'accès aux données.

```ts
export interface SeriesDemandOptions {
    team: string;
    /** Horloge injectée (date de la game à prédire) pour la décroissance λ. */
    now: string;
    /** Défaut 5 — identique à $lib/aggregates/tendency.ts (doctrine §6.5). */
    alpha?: number;
    /** Défaut 0,9/semaine — identique à $lib/aggregates/tendency.ts. */
    lambdaPerWeek?: number;
}
export interface DemandEntry {
    championKey: string;
    role: Role;
    /** λ-pondéré via recencyWeight + α·P_ligue — la masse de la règle gelée. */
    mass: number;
    teamRawCount: number;
    leaguePrior: number;
}
export interface DemandSurface {
    /** Entrées par rôle, triées masse desc (tie-breaks gelés §1.1). */
    byRole: Map<Role, DemandEntry[]>;
    /** Comptes bruts équipe tous rôles (B1) et ligue (B0/tie-breaks). */
    teamCounts: Map<string, number>;
    leagueCounts: Map<string, number>;
}
export function fitTeamDemand(train: DraftRecord[], options: SeriesDemandOptions): DemandSurface;
/** Modèle M : 5 champions distincts, un par rôle (greedy gelé §1.1). */
export function predictGamePicks(surface: DemandSurface, consumed: Set<string>): string[];
/** Baseline B1 : top-5 présence équipe (égalités : ligue desc → clé asc). */
export function presenceTop5(surface: DemandSurface, consumed: Set<string>): string[];
/** Baseline B0 : top-5 fréquence ligue (clé asc en égalité). */
export function leagueTop5(surface: DemandSurface, consumed: Set<string>): string[];
/**
 * Adaptateur I4 (SeriesContext.wantProbability) : masse de c renormalisée
 * sur les candidats non consommés de son rôle, max sur les rôles où c
 * apparaît. v1 délibérément indépendante de gameNumber (la gate la mesure
 * poolée + tranchée par g) ; 0 si c est consommé ou inconnu.
 */
export function wantProbabilityOf(
    surface: DemandSurface,
    championKey: string,
    consumed: Set<string>
): number;
```

### 2.3 `src/lib/strategic/seriesKnapsack.ts` (nouveau, pur) — le terme moteur

Le terme JueWuDraft adapté hard-Fearless (méthodologie §4.2) :
`evaluate'(game) = evaluate(game) + γ·[S(σ après la ligne) − S(σ)]`, où S est
l'heuristique sac-à-dos sur les comforts restants par rôle, **déni compris
structurellement** : consommer un champion ampute les DEUX pools, donc S
encaisse à la fois notre coût d'option et le déni infligé — c'est le critère
Benoît-Krishna (le déni paie quand le coût de remplacement est plus élevé
pour EUX) rendu mécanique par la soustraction des deux pools.

```ts
export interface SeriesKnapsackConfig {
    /** Profondeur de comfort par rôle (défaut 3). */
    topN: number;
    /** Décroissance du i-ème comfort, poids ω^(i−1) (défaut 0,5). */
    omega: number;
    /** Poids γ du terme série dans evaluate' (défaut 0,5 — injectable, DA-V2-6). */
    gamma: number;
    /** Shrinkage EB aligné sur gameWin du solveur (0,5 / 10 / 0,25). */
    priorMean: number;
    priorN: number;
    emptyRoleQuality: number;
}
export const DEFAULT_SERIES_KNAPSACK_CONFIG: SeriesKnapsackConfig;

export interface RolePoolValue {
    role: Role;
    value: number;
    entries: { championKey: string; posterior: number; weight: number }[];
}
export interface PoolValueBreakdown {
    side: SeriesSide;
    total: number;
    byRole: RolePoolValue[];
}
/** S_side(σ) = Σ_rôles Σ_{i≤topN} ω^(i−1)·posterior_i (EB, non consommés, desc). */
export function poolValue(
    state: SeriesState,
    side: SeriesSide,
    config?: SeriesKnapsackConfig
): PoolValueBreakdown;
/** S(σ) = S_ally(σ) − S_enemy(σ). */
export function seriesEdge(state: SeriesState, config?: SeriesKnapsackConfig): number;

export interface SeriesTermComponents {
    championKey: string;
    /** ΔS_ally ≤ 0 : l'option future que NOUS brûlons en le consommant. */
    selfCost: number;
    /** −ΔS_enemy ≥ 0 : l'option que nous LEUR retirons (hard Fearless). */
    denialGain: number;
    /** selfCost + denialGain. */
    deltaEdge: number;
    /** γ·deltaEdge — LE composant affiché à côté de l'équité (DA-V2-12). */
    gammaWeighted: number;
}
/** Décomposition du terme série pour UN candidat consommé depuis σ. */
export function seriesTermOf(
    championKey: string,
    state: SeriesState,
    config?: SeriesKnapsackConfig
): SeriesTermComponents;

/**
 * Évaluateur de feuille du navigator en mode série :
 *   evaluate'(ally, enemy) = base(ally, enemy)
 *                          + γ·[seriesEdge(σ ∪ picks de la ligne) − seriesEdge(σ)]
 * Les clés reçues sont des PICKS uniquement (realPicks du navigator) — les
 * bans ne consomment pas en Fearless et n'entrent jamais dans σ.
 */
export function makeSeriesAwareEvaluator(
    base: DraftEvaluator,
    state: SeriesState,
    config?: SeriesKnapsackConfig
): DraftEvaluator;
```

Intégration coach (post-verdict, hors run) — aucun changement de signature du
navigator : `navigate(draftState, { ...ctx, evaluate: makeSeriesAwareEvaluator(base, σ) })`
pour la recherche, et `seriesTermOf(candidat, σ)` au rendu racine pour
afficher « Série : −1,2 pp d'options brûlées / +0,8 pp de déni » en composant
séparé, badge Expérimental. Le builder `SeriesState` depuis le storage M7
(`Series.consumedAlly/Enemy` + pools issus de `fitTeamDemand` ou gol.gg) est
une pièce UI du plan §4, pas du run.

Pédagogie (drafteur apprenant, pas staff) : chaque composant a sa phrase FR —
« Garder pour la suite : Azir vaut encore +1,1 pp d'options sur les games
restantes » ; « Déni : le prendre maintenant le retire AUSSI à leur mid ».

### 2.4 `scripts/backtest/seriesRetention.ts` (nouveau script de gate)

Patron `postdiction.ts` : en-tête = règle §1.1 verbatim, hooks node
(`registerHooks` + résolution `$lib/` + load JSON), imports dynamiques typés,
argv `--out` / `--generated-at` / `--audit-only`, écriture du rapport
`docs/calibration/seriesRetention-g3.md` + echo console. Toute la logique
réutilisable vit dans les modules §2.1-2.3 testés sous Vitest ; le script ne
contient que l'orchestration de la règle (événements, folds par patch via
`comparePatches`/`parsePatch`, appariement, rendu markdown). Les statistiques
sont CONSOMMÉES, jamais recodées : IC cluster par série de la primaire et de
S3 via `clusterBootstrapDeltaCI`, ρ via `spearman` (recalculé sur chaque
resample de séries) — les deux de `$lib/backtest/clusterBootstrap` (module
architecte) — et `mulberry32` de `$lib/backtest/metrics` pour le flux seedé.
`--audit-only` imprime le TEST 0 et les comptes d'éligibilité SANS scorer
(vérification de périmètre sans lecture de résultats).

Structure du rapport : TEST 0 par tournoi → tableau primaire (pooled, par
corpus, tranches g=2/g=3/g≥4, ligne B0) + verdict imprimé « G3-demande
VERTE » / « G3-demande ROUGE » (jamais « G3 VERTE » — §1.3) → S2 (ρ, IC, table
par overlap) → S3 (AUC, IC, couverture des paires, temps moyen par
`retentionValue`) → Couverture/exclusions (événements écartés par cause,
séries invalides, anomalies citées par gameId) → Notes (seed 42,
1000 resamples, ordre des flux, rappel « une règle, un run », et la
déclaration : la couverture 70,3 %/68,1 % de l'audit §1.0 est une mesure
outcome-adjacente — le recall du pool train — prise avant gel, sans aucun
calcul de hit@5/ρ/AUC).

### 2.5 Tests (calculés à la main, dans `tests/`)

- `tests/seriesReplay.test.ts` — mini-corpus synthétique : 1 série Fearless
  propre (3 games, consommation vérifiée à la main), 1 série avec re-pick
  (repickCount exact, tournoi non confirmé), 1 série à gameNumber troué
  (anomalie `gap`), re-ban d'un consommé détecté, `inferFormat` (2-0 → bo3,
  3-1 → bo5, 1-1 → undefined), `seriesWinner` en égalité de maxWins ⇒
  undefined (Bo2 1-1 exclue, série 2-2 abandonnée exclue).
- `tests/seriesDemand.test.ts` — 3 records datés, λ=0,9 : masses vérifiées au
  chiffre (0,9^âge + 5·prior), tie-breaks du greedy (équipe → ligue → clé),
  un cas construit qui DISTINGUE les deux lectures de l'ordre des rôles
  (masses de tête calculées une fois avant le greedy vs réordonnancement
  après chaque retenue — le test verrouille la première), distinctness
  inter-rôles, B1 dégénérant au classement ligue pour une équipe inconnue,
  `wantProbabilityOf` renormalisée après consommation.
- `tests/seriesKnapsack.test.ts` — pools jouets : posteriors EB vérifiés
  (shrinkWinrate 0,5/10), poolValue = Σ ω^(i−1)·posterior à la main,
  `seriesTermOf` : selfCost + denialGain = deltaEdge exactement, candidat
  absent des deux pools ⇒ terme nul, `makeSeriesAwareEvaluator` :
  base + γ·ΔS exactement (additivité DA-V2-12), bans jamais consommés.

---

## 3. Analyse des fuites (leakage) et des risques de fishing

| # | Risque | Neutralisation dans le design |
|---|---|---|
| F1 | **Fuite temporelle** (la leçon M3.x) : surfaces ajustées sur des données du futur | Walk-forward par patch STRICT du même corpus (train < k) pour TOUTES les surfaces (demande, baselines, pools S3, top-10 S2) ; premier patch et patch non plaçable non scorés, comptés ; `now` = date de la game (information disponible au moment re-plan), âge clampé ≥ 0 — aucune lecture d'horloge système |
| F2 | **Fuite intra-game** : prédire la game g en connaissant ses bans/picks | Le point de prédiction est ENTRE les games : l'état ne contient que les picks des games 1..g−1 ; les bans de la game g (qui retirent ~6-10 champions, parfois prédits) sont un bruit honnête PARTAGÉ par modèle et baselines — comparaison appariée |
| F3 | **Fuite intra-série dans S3** : pools reconstruits à partir des games de la série elle-même | Pools S3 = train (patchs < k) UNIQUEMENT — un champion joué en G4 n'entre jamais au pool PARCE QU'il a été joué en G4 |
| F4 | **Conditionnement au futur dans S3** (le set de candidats = champions joués plus tard) | Assumé et déclaré : c'est le DESIGN (contrôler la demande pour isoler l'ORDRE de rétention) ; les paires (early, late) sont équilibrées par construction, aucune optimisation n'est conduite sur ce set, le label (tôt/tard) est la seule inconnue prédite |
| F5 | **Fishing par les constantes** : α, λ, k du top-k, γ, config solveur | TOUT est gelé au §1.1 avant le run : α=5 et λ=0,9 sont les défauts COMMITÉS de `$lib/aggregates/tendency.ts`, réutilisés via `recencyWeight` (adoptés tels quels, zéro nouveau réglage), top-5/top-10 fixés, `DEFAULT_SERIES_SOLVER_CONFIG` citée valeur par valeur, seed 42, 1000 resamples ; γ et le knapsack ne participent à AUCUNE métrique du run (ils shippent Expérimental) — aucun paramètre du run n'a été choisi en regardant un hit-rate |
| F6 | **Fishing par multiplicité** : plusieurs tableaux, un seul doit « sortir » | UNE primaire (pooled M vs B1) décide du verdict G3-demande, point ; tranches/corpus/B0 = descriptifs sans verdict ; S2 = sans verdict par construction ; S3 a son critère PROPRE à enjeu borné (badge du panneau, pas la gate) et déclaré d'avance — pas de « deuxième chance » pour G3 |
| F7 | **Baseline affaiblie pour faire gagner le modèle** | B1 est la baseline FORTE (présence de l'équipe elle-même, pas la ligue) ; elle partage le même objet ajusté et les mêmes exclusions Fearless que M ; B0 (convention harnais) publiée en plus ; les deux surfaces émettent toujours 5 (pas d'asymétrie de miss) |
| F8 | **Circularité du mode** : supposer Fearless pour mesurer du Fearless | Le mode n'est jamais supposé : TEST 0 est DANS le script, par tournoi, à chaque exécution ; l'étalon standard existe (LFL Promotion : 57,5 % de re-picks) — un tournoi standard à 0 re-pick sur ≥ 100 picks ultérieurs est hors de toute vraisemblance à ce taux de base ; les re-bans d'un consommé sont publiés comme anomalies citées par gameId |
| F9 | **Lecture des résultats avant gel** | L'audit §1.0 n'a mesuré que des comptes structurels (séries, re-picks) et UNE mesure outcome-adjacente déclarée comme telle (couverture 70,3 %/68,1 % = recall du pool train, reprise aux Notes du rapport) — aucun hit@5, aucun ρ, aucune AUC n'a été calculé avant la rédaction de cette règle ; le commit de l'en-tête précède le run (plan §4) |
| F10 | **Corrélation vendue comme causalité (S2)** | Déclaration explicite dans la règle ET le rapport : confusions nommées (force des équipes, chevauchement de méta), aucun verdict, aucune flèche causale dans l'UI |
| F11 | **Dépendance intra-cluster** (les 10 picks d'une game, les 2 équipes d'une série, les games d'une même série) | L'unité de bootstrap est la SÉRIE pour les TROIS flux — primaire comprise : tirage avec remise parmi les séries scorées, tous les événements appariés M/B1 d'une série tirée restent ensemble (`clusterBootstrapDeltaCI`) ; l'appariement M/B1 reste par événement |
| F12 | **σ sous-spécifié en rejeu** : firstSelection absent du corpus, score réel mais pools gelés | Documenté dans la règle (holder undefined ⇒ pas de branche FS — le solveur le gère) ; la récursion à pools gelés est le contrat documenté du solveur ; ni l'un ni l'autre ne favorise une direction de l'AUC |

---

## 4. Plan d'implémentation pas-à-pas

Chaque étape laisse le dépôt vert (vitest + svelte-check + lint) et se commit
séparément.

1. **`src/lib/backtest/seriesReplay.ts` + `tests/seriesReplay.test.ts`.**
   Reconstitution, consommation, TEST 0, formats. Testable : les comptes du
   mini-corpus synthétique à la main.
2. **`src/lib/estimators/seriesDemand.ts` + `tests/seriesDemand.test.ts`.**
   Surface de demande + prédictions M/B1/B0 + `wantProbabilityOf`. Testable :
   masses au chiffre, tie-breaks, renormalisation.
3. **`src/lib/strategic/seriesKnapsack.ts` + `tests/seriesKnapsack.test.ts`.**
   S(σ), `seriesTermOf`, `makeSeriesAwareEvaluator`. Testable : additivité
   exacte des composants, terme nul hors pools, γ injectable.
4. **`scripts/backtest/seriesRetention.ts`** — en-tête = §1.1 VERBATIM, puis
   l'orchestration. Vérification SANS scoring : `--audit-only` doit reproduire
   le document §1.0 AU CHIFFRE PRÈS (mêmes 836 séries, mêmes 46 re-picks sur
   LFL Promotion, mêmes 2 944 événements bruts — 2 928 après exclusion
   TEST 0 —, même anomalie Ambessa). **Commit « règle gelée » avant tout run
   scoré.**
5. **LE run** (une commande, celle de l'en-tête) — préalable BLOQUANT :
   l'amendement de gouvernance du §1.3 est commité par l'architecte.
   Publication de `docs/calibration/seriesRetention-g3.md`, commit des
   résultats tels quels — verts ou rouges, aucun re-réglage.
6. **Post-verdict, conditionnel** (chacun son commit) :
   a. Primaire verte → injecter `wantProbabilityOf` dans `/series`
      (`denialValue`/`mustWinAnalysis` passent de « déni non chiffré » au déni
      mesuré ; la `wantProbability` injectée est construite par `fitTeamDemand`
      sur le train de l'équipe ADVERSE — le déni prix la demande d'en face) ;
      brancher `makeSeriesAwareEvaluator` + `seriesTermOf` dans le
      coach en mode série (composants séparés, badge Expérimental, phrases FR
      pédagogiques) ; corriger la limitation documentée du `corpusRunner`
      (exclusions Fearless dans pick-in-range) et re-passer les scorecards.
   b. S3 verte → le panneau dépense/garde de `/series` affiche « ordre de
      rétention validé (AUC, IC, n séries) » à la place du badge Expérimental.
   c. Mise à jour `docs/STATUS.md`, `docs/ETAT_DES_LIEUX.md` §B/§F,
      `docs/calibration/README.md` (ligne G3 dans les extensions mesurées).
7. **(Si LCK 2025 débarque ensuite)** : run supplémentaire en réplication
   descriptive, verdict du premier run inchangé (règle §1.1).

Estimation : étapes 1-5 = une session ; étape 6 = une demi-session.

---

## 5. Ce que le verdict change

### Si la PRIMAIRE est verte (G3-demande VERTE)

- **Le solveur I4 acquiert son ingrédient mesuré** : la demande par rôle
  devient l'injection officielle de `wantProbability` — le prix du déni et le
  must-win cessent d'être « non chiffrés » dans la war room, avec la mention
  de provenance (« demande estimée sur le train, hit@5 X vs Y, IC [a ; b] »).
- **Claim publiable au scorecard** (R9) : « la demande Fearless par rôle
  prédit la consommation réelle des games 2+ mieux que la présence » — la
  première métrique série du Summit Gate, et à notre connaissance le premier
  traitement public chiffré du hard-Fearless (first-mover documenté §6 bis I4).
- **Le terme moteur ship** en mode série du coach : `evaluate + γ·ΔS`,
  composants « équité game | terme série (coût propre + déni) » affichés
  séparément, γ injectable (défaut 0,5), badge **Expérimental** sur la
  composite (DA-V2-11 — sa gate à elle reste à pré-enregistrer, candidate :
  « conseil suivi » série du chantier coach).
- La tranche g≥4 (descriptive) alimente l'acceptation R5 (« rétention G4/G5 »)
  et calibrera les attentes de la future jauge d'intégrité.

### Si la PRIMAIRE est rouge (G3-demande ROUGE)

- La gate reste fermée : le déni reste « non chiffré », le panneau série garde
  son badge, AUCUN claim série au scorecard. Le rouge est commité tel quel.
- Le rouge est informatif et bien posé : si même la présence n'est pas battue
  par une demande structurée par rôle, les pistes suivantes sont connues et
  exigeront chacune un NOUVEL en-tête pré-enregistré — demande conditionnée
  par gameNumber, terme ban-history partagé avec le chantier banEV phase 1
  (la demande contrefactuelle des perma-bans), candidate set par JOUEUR après
  `enrichPlayers.ts`.
- Ce qui ne change PAS : les lockouts Fearless inline (M7/UI) — du
  bookkeeping factuel, pas un claim ; le solveur reste disponible comme outil
  Expérimental étiqueté.

### Secondaires

- **S3 verte** : l'ordre de rétention du solveur est validé sur ~460 séries
  réelles → badge retiré sur l'ORDRE (pas sur les magnitudes). **S3 rouge** :
  badge conservé ET découverte documentée dans la recherche (« les gagnants
  brûlent-ils tôt leurs comforts ? » — exactement le genre de fait que
  kkOma/Goldenglue décrivent « de tête » et que personne n'a mesuré).
- **S2** : publication recherche dans tous les cas (ρ + IC + table) — premier
  chiffre public sur la valeur du déni précoce, avec ses confusions déclarées.
- **TEST 0** devient un fait de corpus versionné : le format 2026 des ligues
  couvertes est hard Fearless MESURÉ (0 re-pick / 14 640), plus une hypothèse
  de lecture des règles — et le script le re-vérifie à chaque corpus futur.
