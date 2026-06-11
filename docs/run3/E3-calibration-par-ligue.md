# Chantier E3 — Calibration Platt PAR LIGUE × position de séquence — Design run #3

> PROPOSÉ (2026-06-11) — à geler post-revue ; aucun paramètre ne bougera après le commit de gel.

> Objectif : reprendre l'enjeu du chantier E (rendre honnêtes les % affichés —
> WinrateBar « Win % estimé (draft) », `winAfter` du coach) avec des cartes
> (a,b) PAR LIGUE. La règle v1 (poolée, `docs/run2/E-calibration.md`) est
> CONSOMMÉE : verdict tout-ROUGE d'un cheveu
> (`docs/calibration/win-calibration-2026.md` — ΔBrier penche négatif sur les
> trois positions, les IC effleurent 0 : fullDraft Δ = −0,00204
> [−0,00437 ; 0,00038]). Sa propre §5 déclare « des (a) par ligue = candidat
> run #3, jamais une retouche de ce run » — c'est CE run. Les lignes par corpus
> DESCRIPTIVES du rapport v1 motivent le pari sans le prouver : fullDraft
> calibré/brut = 0,2449/0,2504 (lck-2026), 0,2466/0,2551 (lfl-2025)… mais
> 0,2481/0,2463 (lpl-2026, calibré PIRE) — l'hétérogénéité des ligues est
> visible, une carte unique la moyenne. Et le run #2 a publié « side-only LCK
> 2026 +8,4 pp significatif ; lec/lfl/lpl ≈ pile-ou-face » : un (a) par ligue
> est exactement l'objet qui peut capter ça.
>
> Doctrine inchangée : ARCHITECTURE_V2 §6.8 (Platt 2 paramètres, jamais
> isotonique), DA-V2-6 (config injectable), DA-V2-11 (badge sans métrique),
> DA-V2-12 (composants séparés). Patron de script : `postdiction.ts` via le
> runner v1 `scripts/backtest/winCalibration.ts` (qui reste INTACT — règle
> consommée, artefact historique).
>
> État audité (2026-06-11) : toute l'infra v1 EXISTE et est correcte —
> `src/lib/estimators/platt.ts` (gelé), `src/lib/backtest/sequencePositions.ts`
> (ancres + éligibilité), `src/lib/estimators/winCalibration.ts`
> (`positionOf`, `calibrateAllyWin` espace bleu, passthrough),
> `data/calibration/winCalibration.json` (v1, tout `validated:false` ⇒
> passthrough partout), badge WinrateBar/CoachPanel branché. Ce qui manque :
> la dimension LIGUE (type v2, runner par ligue, threading `leagueIdA`/
> `leagueIdB` vérifié dans `src/routes/+page.svelte`).

---

## 0. Décisions tranchées (avec alternatives écartées)

Le brief architecte laissait des choix ouverts (« à challenger si tu vois
mieux ») ; les voici TRANCHÉS, gelés avec la règle.

| # | Décision | Justification — et ce qui est écarté |
|---|---|---|
| D1 | **Timeline PAR LIGUE** (= l'union des 2 fichiers {ligue}-2025 + {ligue}-2026, ordonnée `groupByPatch`), pas par FICHIER, pas poolée | L'unité de la carte est la ligue : le fit d'un fold lck-2026 doit s'entraîner sur lck-2025 + les patchs lck-2026 antérieurs. Une timeline par fichier couperait l'historique de chaque ligue en deux (les fits 2026 perdraient 555 games lck-2025 — exactement la puissance qu'on vient chercher) ; une timeline poolée re-mesurerait la v1. Lecture assumée du brief : « par corpus (8 fichiers) » = les 8 fichiers consommés, groupés par ligue. |
| D2 | **minTrainSize = 50 PAR LIGUE** (re-posé, comme demandé) | Même échelle que la v1 ; vérifié sur les timelines mesurées avant gel : premiers folds à train = 74 (lck), 84 (lec), 58 (lfl), 88 (lpl) — un fit Platt 2 paramètres + ridge 1e-6 y est stable. Monter à 100 sacrifierait 1-2 folds par ligue sans bénéfice démontré ; descendre exposerait des fits dégénérés. |
| D3 | **Repli ligue-sans-carte = PASSTHROUGH** (% brut, badge « Non calibré ») — JAMAIS la carte poolée | La carte poolée n'a AUCUN verdict vert derrière elle (v1 ROUGE, règle consommée) : l'appliquer violerait « l'UI n'applique JAMAIS une position non validée ». Et les ligues sans carte (lcs, cblol, lcp, internationaux — toutes offertes par `LEAGUE_REGISTRY`) sont ABSENTES du corpus : même un poolé vert ne dirait rien d'elles (claim hors distribution). Le passthrough est le traitement v1 des configurations hors claim (contexte actif) — cohérent. |
| D4 | **La carte appliquée = la ligue du CAMP AFFICHÉ** : barre globale → `leagueIdA` ; coach → la ligue du camp conseillé (`coach.side === allySide ? leagueIdA : leagueIdB`) | Vérifié dans `+page.svelte` : la page connaît `leagueIdA` ET `leagueIdB`, et en simulation le coach conseille le camp au trait — qui peut être le camp B (ligne 1190 : `coachSide`). Utiliser `leagueIdA` partout appliquerait la carte LFL à un conseil donné au camp LCK. Raffinement déclaré du brief. |
| D5 | **Aucun bras poolé à pouvoir de verdict dans LE run E3** — le mode poolé du runner v2 ne sert QUE la porte de validité (réplication v1 à 5 décimales) | Un 13ᵉ verdict poolé sur 8 corpus serait une re-tentative déguisée de la règle v1 consommée, et réintroduirait l'hétérogénéité que la v1 a documentée (risque #10). Le full-fit poolé 8 corpus est écrit dans l'artefact en PROVENANCE seulement, `validated:false` forcé. |
| D6 | **Mêmes snapshots DraftGap que la run #2** (`data/datasets/SNAPSHOT.md`), avec ASSERTION de hash dans le runner (abort si ≠) | Exigé par le brief (« datasets gelés inchangés ») et par la porte de validité : reproduire la v1 à 5 décimales n'a de sens qu'à dataset identique. La v1 imprimait les hashes ; la v2 les VÉRIFIE — re-télécharger ne redonne pas ces fichiers (le CDN évolue). |
| D7 | **Nouveau script `scripts/backtest/winCalibrationByLeague.ts`** — le runner v1 n'est pas modifié | L'en-tête du runner v1 est une règle gelée consommée : la muter détruirait l'artefact historique. Le v2 réassemble les mêmes modules gelés (`walkforward`, `metrics`, `platt`, `sequencePositions`). |

---

## 1. Règle pré-enregistrée

Le bloc ci-dessous est rédigé pour être gelé TEL QUEL dans l'en-tête de
`scripts/backtest/winCalibrationByLeague.ts` avant tout run. UNE règle, UN
run, aucun paramètre modifié après lecture des résultats.

```
RÈGLE PRÉ-ENREGISTRÉE — Calibration Platt PAR LIGUE × position de séquence (chantier E3, run #3).
Gelée le 2026-06-11 AVANT toute exécution sur données réelles. Un rouge se documente, ne se retune pas.
La règle v1 (poolée, chantier E run #2) est CONSOMMÉE — ceci est une NOUVELLE règle, jamais une retouche.

CORPUS (8 fichiers, fixés — l'état UNIQUE amendé du 2026-06-11, docs/run2/AMENDEMENT-corpus-20260611.md),
appariés PAR LIGUE ; la ligue d'un fichier = le préfixe de son basename (^(lck|lec|lfl|lpl)-\d{4}\.json$,
asserté par le script, abort sinon) :
  lck : static/corpus/lck-2026.json + data/corpus/lck-2025.json
  lec : static/corpus/lec-2026.json + data/corpus/lec-2025.json
  lfl : static/corpus/lfl-2026.json + data/corpus/lfl-2025.json
  lpl : static/corpus/lpl-2026.json + data/corpus/lpl-2025.json
lck-2025 (555 drafts, 0 violation) entre par la voie déclarée v1 (« l'ajouter plus tard = NOUVEAU run,
jamais une fusion silencieuse ») — c'est CE run.

ÉLIGIBILITÉ : inchangée v1 (isCalibrationEligible, un SEUL ensemble PAR LIGUE, partagé par les trois
positions) : (a) winner défini, (b) 10 picks rôle-complets (règle compOf de postdiction G1), (c) patch
parsable. Tout record écarté est compté dans le rapport. Unicité des gameId assertée sur l'UNION des
8 corpus chargés (abort si collision).

PRÉDICTEUR BRUT : inchangé v1 AU CARACTÈRE PRÈS —
  p_raw(g, pos) = analyzeDraft(dataset, blue(g,pos), red(g,pos),
      { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 }, fullDataset).winrate
  Équipes = rôles RÉELS du corpus (roleTeamsAt), préfixes des TROIS ancres v1 inchangées :
      afterBans seq ≤ 6 (p_raw ≡ 0,5 par construction) · after3Picks seq ≤ 9 · fullDraft seq ≤ 20.
  Aucun playerContext, aucun sideContext. Cible : won = (winner === 'blue').
  p_raw ne dépend PAS de la ligue : cache unique par (game, position), partagé par tous les bras.

DATASETS : LES MÊMES snapshots gelés que la run #2 (data/datasets/current-patch.json + 30-days.json,
data/datasets/SNAPSHOT.md), JAMAIS re-tirés. Le script ABORT avant toute métrique si
  sha256(current-patch) ≠ aca91656af68dff5016152e947aafbcebfb3dfe320cc2781f8fdbe8983fb8869
  sha256(30-days)       ≠ 6933c7c2d107afd465e7d8f0c44765305ff8747a187ed54c4c1f73e87651a4b1
(hashes attendus = DÉFAUTS du script ; le smoke sur fixtures synthétiques les surcharge via
--expected-sha256-current/--expected-sha256-full — flags INTERDITS sur corpus réels : la porte de
validité et LE run ne les passent pas, c'est vérifiable dans la commande publiée du rapport).

PROTOCOLE : QUATRE timelines, une PAR LIGUE (= l'union des 2 fichiers de la ligue, ordonnée
groupByPatch/comparePatches), walkForward (src/lib/backtest/walkforward.ts) avec minTrainSize = 50
PAR LIGUE. Par ligue, par fold (= patch testé de la ligue) et PAR POSITION :
  (a,b) = plattFit(paires du train DE LA LIGUE)   // module gelé src/lib/estimators/platt.ts
  prédiction de test = plattApply((a,b), p_raw)
Quatre bras par (ligue × position) : CALIBRÉ σ(a+b·logit(p_raw)) · NON CALIBRÉ p_raw · PIÈCE p = 0,5 ·
side-only LIGUE (winrate blue du train de la ligue — descriptif, sans pouvoir de verdict ; c'est aussi
exactement ce en quoi dégénère Platt à afterBans). Assertion croisée ordre-patch vs chronologie PAR
LIGUE (min(date) monotone entre groupes consécutifs — couvre le placement lexical des 25.S1.x),
abort AVANT toute métrique sinon.

TIMELINES ATTENDUES (gelées — comptes ÉLIGIBLES mesurés avant gel sur l'état amendé ; « t » = groupe
train-only sous minTrainSize 50) :
  lck (892 él., 20 folds, 818 paires, 1er fold 25.S1.3) : 25.S1.1 (49 t) → 25.S1.2 (25 t) → 25.S1.3 (35)
    → 25.06 (24) → 25.07 (50) → 25.08 (47) → 25.09 (48) → 25.10 (53) → 25.11 (18) → 25.14 (46)
    → 25.15 (48) → 25.16 (51) → 25.17 (61) → 26.01 (51) → 26.02 (33) → 26.03 (41) → 26.06 (21)
    → 26.07 (45) → 26.08 (44) → 26.09 (45) → 26.10 (49) → 26.11 (8)
  lec (554 él., 17 folds, 470 paires, 1er fold 25.06) : 25.S1.1 (15 t) → 25.S1.2 (30 t) → 25.S1.3 (39 t)
    → 25.06 (17) → 25.07 (31) → 25.08 (31) → 25.09 (27) → 25.10 (33) → 25.15 (24) → 25.16 (23)
    → 25.17 (27) → 25.18 (11) → 26.01 (18) → 26.02 (36) → 26.03 (51) → 26.06 (19) → 26.07 (33)
    → 26.08 (29) → 26.09 (30) → 26.10 (30)
  lfl (508 él., 17 folds, 450 paires, 1er fold 25.S1.3) : 14.16 (11 t) → 25.S1.1 (23 t) → 25.S1.2 (24 t)
    → 25.S1.3 (16) → 25.07 (30) → 25.08 (29) → 25.09 (24) → 25.10 (23) → 25.14 (40) → 25.15 (41)
    → 25.16 (31) → 25.17 (37) → 26.01 (10) → 26.02 (30) → 26.03 (33) → 26.04 (24) → 26.07 (30)
    → 26.08 (15) → 26.09 (13) → 26.10 (24)
  lpl (1260 él. / 1262 records, 18 folds, 1172 paires, 1er fold 25.04) : 25.S1.1 (43 t) → 25.S1.2 (45 t)
    → 25.04 (42) → 25.06 (60) → 25.07 (82) → 25.08 (76) → 25.09 (101) → 25.10 (15) → 25.11 (56)
    → 25.14 (83) → 25.15 (81) → 25.16 (63) → 25.17 (70) → 26.01 (75) → 26.02 (83) → 26.03 (54)
    → 26.07 (59) → 26.08 (49) → 26.09 (63) → 26.10 (60)
  TOTAL : 3 214 éligibles / 3 216 records (2 écartés, lpl-2026) ; 2 910 paires de test par position.

MÉTRIQUES PUBLIÉES par (ligue × position), sur les paires de test poolées de la ligue : Brier, log loss,
accuracy des trois bras + side-only ; diagramme de fiabilité 10 bacs (n, meanP, taux observé avec
Wilson 95 % par bac, gap) pour CALIBRÉ et NON CALIBRÉ.

CRITÈRE DE VERDICT (12 cellules INDÉPENDANTES = 4 ligues × 3 positions, listées exhaustivement ICI,
toutes publiées) : ΔBrier = Brier(calibré) − Brier(non calibré) sur les paires de la ligue, IC
bootstrap 95 % APPARIÉ par game (1000 resamples). UN SEUL flux mulberry32(seed 42), ordre GELÉ des
24 IC : ligues lck → lec → lfl → lpl ; par ligue : afterBans Brier, afterBans logLoss, after3Picks
Brier, after3Picks logLoss, fullDraft Brier, fullDraft logLoss.
  VERT ssi ci95.hi < 0. Δ log loss : publié, secondaire, descriptif seulement.
MULTIPLICITÉ DÉCLARÉE : sous le nul global, ~0,3 faux vert attendu sur 12 cellules
(P(≥1 faux vert) ≈ 26 %) — aucun ajustement (chaque cellule porte une décision produit LOCALE et
réversible au re-run) ; le rapport publie les 12 verdicts ensemble et chaque claim cite SA cellule.
GARDE SUPPLÉMENTAIRE : validated(ligue, position) = (verdict VERT) ∧ (b > 0 au fit final DE LA LIGUE).

ATTENDUS DÉCLARÉS D'AVANCE :
- afterBans dégénère en side-only PAR LIGUE (p_raw ≡ 0,5 ⇒ b sans information, a = logit du taux blue
  du train de la ligue). Le run #2 a publié : side-only lec/lfl/lpl ≈ pile-ou-face ⇒ rouges probables,
  qui seraient des CONFIRMATIONS d'honnêteté (le 50 % post-bans y est déjà honnête) ; side-only LCK
  2026 +8,4 pp SIGNIFICATIF ⇒ l'effet attendu vaut ≈ −(q − 0,5)² (q = taux blue walk-forward lck) —
  un VERT lck/afterBans signifierait « en LCK, afficher ~q % après bans est plus honnête que 50 % » ;
  un ROUGE, que l'avantage blue ne tient pas sur 2025-2026 au niveau requis. LES DEUX lectures sont
  écrites ici, avant le run.
- PUISSANCE (déclarée d'avance, demi-largeur d'IC v1 × √(2567/n)) : MDE ΔBrier ≈ 0,0042 (lck, 818
  paires) · 0,0056 (lec, 470) · 0,0057 (lfl, 450) · 0,0035 (lpl, 1172). Un effet de la taille du
  pooled v1 (≈ 0,002) sortira ROUGE par construction dans chaque cellule : le pari pré-enregistré est
  un effet PAR LIGUE plus grand que la moyenne poolée (le (a) de side lck ; la dérive lfl vue dans les
  lignes descriptives v1). « Réel mais non détectable » se publie tel quel, sans re-découpage.

PARAMS SHIPPÉS : data/calibration/winCalibration.json passe en VERSION 2, TOUJOURS écrit à l'issue du
run, quel que soit le verdict :
  leagues.{lck,lec,lfl,lpl} = { nGames, fittedThroughPatch, positions: { a, b, nTrain, validated } × 3 }
  — fit full-data PAR LIGUE sur la totalité de ses éligibles (déclaré ici, jamais utilisé pour les
  métriques), validated = (VERT cellule) ∧ (b > 0) ;
  positions (le champ v1) = full-fit poolé des 8 corpus, PROVENANCE/COMPARAISON SEULEMENT,
  validated:false FORCÉ par construction (aucun verdict poolé n'existe dans ce run) ;
  + provenance (corpora, nGames total, dataset sha256/version/date, generatedAt injecté, seed).
L'UI n'applique JAMAIS une position validated:false.

REPLI TRANCHÉ ET GELÉ : ligue sans carte (lcs, cblol, lcp, internationaux, id inconnu, leagueId absent)
⇒ PASSTHROUGH (% brut, badge « Non calibré »). JAMAIS la carte poolée : elle n'a aucun verdict vert
derrière elle (v1 ROUGE consommé) et les ligues hors corpus sont hors claim par construction.
APPLICATION : la carte appliquée est celle de la LIGUE DU CAMP AFFICHÉ — barre globale : leagueIdA ;
coach : la ligue du camp conseillé (leagueIdA, ou leagueIdB quand la simulation fait conseiller le
camp B). Une config v1 chargée par l'estimateur v2 garde la sémantique v1 (rétro-compatibilité).

PORTE DE VALIDITÉ (bloquante, AVANT le run E3) : le runner v2 en mode --pooled, lancé sur les 7 corpus
v1 et les mêmes snapshots (seed 42), reproduit À 5 DÉCIMALES les six Δ et IC publiés dans
docs/calibration/win-calibration-2026.md (table d'acceptation au §2.6 du design ; contrôles
secondaires : Brier des bras à 4 décimales, fits finals à 6 décimales, n = 2567, 26 groupes, 24 folds).
Tout écart ⇒ bug du runner v2, AUCUN run E3 avant égalité. Le mode --pooled n'écrit JAMAIS l'artefact
params (abort si --params-out lui est passé).

LIMITE DOCUMENTÉE (reprise verbatim dans le rapport) : le snapshot SoloQ est
« d'aujourd'hui » et évalue des games 2025-2026 (fuite de features M3.x connue).
Elle contamine p_raw À L'IDENTIQUE dans les bras calibré et non calibré (comparaison
appariée interne valide) ; le claim autorisé porte sur la CARTE DE CALIBRATION,
jamais sur la force prédictive de l'évaluateur. Aucun « on prédit le vainqueur ».

TROIS APPROXIMATIONS D'APPLICATION (déclarées ici, reprises dans le rapport et l'aide produit) :
  (a) la calibration est mesurée aux trois ancres 0 / 3 / 10 picks verrouillés ; une position
      intermédiaire reçoit la carte de l'ancre que la partition positionOf lui assigne
      (0 → afterBans ; 1..6 → after3Picks ; 7..10 → fullDraft), jamais une interpolation ;
  (b) à l'application, le % du coach passe par des rôles INFÉRÉS et le mode séquence par l'argmax des
      rolePriors, alors que la mesure utilise les rôles RÉELS du corpus — l'écart d'attribution de
      rôles n'est pas couvert par le claim ;
  (c) les cartes sont mesurées sur des games INTRA-ligue (les deux équipes de la même ligue) ; une
      draft inter-ligues (leagueIdB ≠ leagueIdA) reçoit la carte de la ligue du camp affiché — l'écart
      n'est pas couvert par le claim.
```

Constantes annexes gelées avec la règle : sortie rapport
`docs/calibration/win-calibration-par-ligue-2026.md` ; rapport de validité
`docs/run3/E3-validite-poolee.md` ; bornes des positions = `CALIBRATION_POSITIONS`
de `src/lib/backtest/sequencePositions.ts` (inchangé) ; clamp/itérations/ridge =
module `platt.ts` existant, non modifiable ; `reliabilityBins(pairs, 10)` de
`src/lib/backtest/metrics.ts` ; `bootstrapDeltaCI` apparié de `metrics.ts`
(1000 itérations, rng injecté).

### Baselines

| Bras | Définition | Rôle |
|---|---|---|
| Non calibré | `p_raw` tel quel | comparateur du verdict (ΔBrier), par cellule |
| p = 0,5 | constante | plancher d'honnêteté (Brier 0,25, log loss ln 2) |
| side-only ligue | winrate blue du train DE LA LIGUE, walk-forward | contexte M3.5, descriptif — et exactement ce en quoi dégénère Platt à afterBans ; en LCK c'est LE signal que la carte par ligue vient chercher |

---

## 2. Design technique

### 2.1 Vue d'ensemble

```
scripts/backtest/winCalibrationByLeague.ts (NOUVEAU, I/O) → rapport + params JSON v2 (+ mode --pooled)
scripts/backtest/winCalibration.ts          (existant, CONSOMMÉ — non modifié)
src/lib/backtest/sequencePositions.ts       (existant, INCHANGÉ)
src/lib/estimators/platt.ts                 (existant, GELÉ)
src/lib/estimators/winCalibration.ts        (MODIFIÉ, pur) → type v2 + leaguePositionsOf + leagueId
data/calibration/winCalibration.json        (existant v1 tout validated:false ; ÉCRASÉ en v2 par LE run)
UI : +page.svelte (threading leagueIdA/coachLeagueId), CoachPanel.svelte (prop leagueId),
     WinrateBar (libellés — affichage pur inchangé), help/+page.svelte
```

### 2.2 `src/lib/estimators/winCalibration.ts` — extension de type RÉTRO-COMPATIBLE

```ts
export type CalibrationPosition = 'afterBans' | 'after3Picks' | 'fullDraft';   // inchangé
export interface PositionParams { a: number; b: number; nTrain: number; validated: boolean; } // inchangé

/** v2 — la carte d'une ligue mesurée. */
export interface LeagueCalibration {
    nGames: number;                      // éligibles du fit final de la ligue (badge « Calibré sur N games (LCK) »)
    fittedThroughPatch?: string;
    positions: Record<CalibrationPosition, PositionParams | null>;
}

export interface WinCalibrationConfig {
    version: 1 | 2;
    generatedAt: string;
    corpora: string[];
    nGames: number;                      // v1 : fit final poolé ; v2 : total éligible (descriptif)
    fittedThroughPatch?: string;
    dataset?: { version: string; date: string; sha256Current?: string; sha256Full?: string };
    seed?: number;
    /** v1 : la carte poolée appliquée ; v2 : full-fit poolé PROVENANCE, validated:false forcé. */
    positions: Record<CalibrationPosition, PositionParams | null>;
    /** v2 seulement. Clés = ids de LEAGUE_REGISTRY mesurés (lck, lec, lfl, lpl). */
    leagues?: Record<string, LeagueCalibration>;
}

/**
 * Résolution UNIQUE des cartes (consommée par calibrateAllyWin ET par l'UI
 * pour les badges — aucune duplication de la sémantique de repli) :
 *   config null                      → null (passthrough)
 *   version 1                        → config.positions (sémantique v1, leagueId IGNORÉ)
 *   version 2, leagueId avec carte   → config.leagues[leagueId].positions
 *   version 2, sinon                 → null (passthrough — repli TRANCHÉ, jamais config.positions)
 */
export function leaguePositionsOf(
    config: WinCalibrationConfig | null,
    leagueId?: string
): Record<CalibrationPosition, PositionParams | null> | null;

export function calibrateAllyWin(
    pAllyRaw: number,
    allySide: DraftSide,
    picksLocked: number,
    config: WinCalibrationConfig | null = defaultWinCalibrationConfig(),
    leagueId?: string                    // 5e paramètre OPTIONNEL — tous les appels v1 compilent inchangés
): CalibratedWin;
```

Rétro-compatibilité, trois verrous :
- **signature** : `leagueId` est ajouté en 5ᵉ position (les deux call-sites
  existants — `+page.svelte:588`, `CoachPanel.svelte:70` — passent `config` en
  4ᵉ : aucun cassé) ;
- **données** : une config `version: 1` (dont l'actuelle, tout
  `validated:false`) garde exactement la sémantique v1 — les tests v1 de
  `tests/estimators.winCalibration.test.ts` restent VERBATIM et doivent rester
  verts (c'est la porte de rétro-compat) ;
- **espace bleu** : l'aller-retour `pBlue = ally==='blue' ? p : 1−p` est
  inchangé — il devient MÊME PLUS critique, car le `a` par ligue capture le
  biais blue de la ligue (le piège v1 σ(a + b·logit(1−p)) ≠ 1 − σ(a + b·logit(p))
  s'amplifie quand a grandit, cas LCK).

`positionOf`, `CalibratedWin`, `defaultWinCalibrationConfig` : inchangés
(`nGames` du `CalibratedWin` = celui de la CARTE résolue, donc de la ligue en
v2).

### 2.3 Runner — `scripts/backtest/winCalibrationByLeague.ts` (nouveau, patron postdiction/winCalibration)

En-tête = règle du §1, telle quelle. Mêmes hooks node, mêmes conventions argv :

```
# LE run (par ligue, 8 corpus) :
node --experimental-transform-types --no-warnings scripts/backtest/winCalibrationByLeague.ts \
  static/corpus/lck-2026.json data/corpus/lck-2025.json \
  static/corpus/lec-2026.json data/corpus/lec-2025.json \
  static/corpus/lfl-2026.json data/corpus/lfl-2025.json \
  static/corpus/lpl-2026.json data/corpus/lpl-2025.json \
  --dataset data/datasets/current-patch.json --full-dataset data/datasets/30-days.json \
  [--seed 42] [--generated-at ISO] \
  [--out docs/calibration/win-calibration-par-ligue-2026.md] \
  [--params-out data/calibration/winCalibration.json]

# Porte de validité (mode poolé, 7 corpus v1, AUCUN params écrit — abort si --params-out) :
node ... scripts/backtest/winCalibrationByLeague.ts --pooled \
  static/corpus/lck-2026.json static/corpus/lec-2026.json static/corpus/lfl-2026.json \
  static/corpus/lpl-2026.json data/corpus/lec-2025.json data/corpus/lfl-2025.json \
  data/corpus/lpl-2025.json \
  --dataset data/datasets/current-patch.json --full-dataset data/datasets/30-days.json \
  --out docs/run3/E3-validite-poolee.md
```

Déroulé interne (mode ligue) :
1. argv → fichiers ; ligue = préfixe du basename (regex gelée), abort si motif
   inconnu ; charge les datasets, **abort si sha256 ≠ hashes gelés** (§1).
2. Charge les 8 corpus, filtre `isCalibrationEligible`, compte les écartés PAR
   FICHIER ; assertion d'unicité des `gameId` sur l'union des 8 chargés.
3. Pré-calcule `p_raw` par (game, position) UNE fois — cache
   `Map<gameId, Record<CalibrationPositionId, number>>` partagé par toutes les
   ligues et tous les bras (~3 214 × 3 ≈ 9 650 appels `analyzeDraft`,
   quelques secondes — déterministe).
4. PAR LIGUE : `groupByPatch` sur ses éligibles ; assertion croisée
   ordre-patch vs chronologie (min(date) monotone — couvre les 25.S1.x) ;
   abort avant toute métrique sinon ; replay des folds (groupes train-only =
   préfixe sous minTrainSize 50) pour la couverture et les lignes par fichier.
5. PAR LIGUE × POSITION : les quatre bras `walkForward(eligibleLigue, …,
   minTrainSize: 50)` — calibré (`fit: plattFit(pairesDuTrain)`), non calibré,
   pièce, side-only ligue — sur les MÊMES items, paires alignées index à index
   (garde de plomberie : `aggregate.n` identique sur les 4 bras, abort sinon) ;
   le chemin apparié de `bootstrapDeltaCI` s'applique.
6. Les 24 IC bootstrap dans l'ordre GELÉ du §1, un seul flux `mulberry32(seed)`.
7. Fits finals full-data PAR LIGUE + full-fit poolé 8 corpus (provenance,
   `validated:false` forcé) → `--params-out` (artefact v2), TOUJOURS écrit,
   jamais réécrit à la main.
8. Rapport markdown : préambule drafteur, hashes datasets (vérifiés), table de
   couverture par fichier, puis PAR LIGUE : timeline ordonnée (train-only en
   tête), tables des 4 bras × 3 positions, Δ + IC + verdict par cellule,
   fiabilité 10 bacs (calibré et brut) par (ligue × position), bloc ATTENDUS
   afterBans recopié ; table récapitulative des 12 cellules
   (| ligue | position | ΔBrier | IC | verdict | a | b | validated |) ; note
   de multiplicité ; caveat M3.x et les trois approximations verbatim.

Mode `--pooled` (porte de validité) : ignore le groupement par ligue — UNE
timeline poolée des fichiers passés, minTrainSize 50, les 4 bras, SIX IC dans
l'ordre v1 exact (afterBans Brier, afterBans logLoss, after3Picks Brier,
after3Picks logLoss, fullDraft Brier, fullDraft logLoss) sur un flux
`mulberry32(seed)` neuf — la consommation du rng reproduit la v1 à
l'identique ; rapport au format v1 ; AUCUN params écrit (abort si
`--params-out`). Par construction (mêmes modules gelés, même éligibilité,
même cache p_raw, même ordre rng), la sortie doit égaler la v1 — la porte le
VÉRIFIE au lieu de le supposer.

Aucune logique de scoring nouvelle dans `src/lib` : `walkforward.ts`,
`metrics.ts`, `platt.ts`, `sequencePositions.ts` suffisent — le script ne fait
qu'assembler (patron postdiction explicitement permissif là-dessus).

### 2.4 Intégration produit (après le run, pilotée par le JSON v2)

- **`+page.svelte` / WinrateBar** : `calibratedWin` (ligne 586) passe
  `leagueIdA` en 5ᵉ argument — la barre globale est la perspective du camp A.
  Conditions inchangées : UNIQUEMENT quand `playerContext` et `sideContext`
  sont `undefined`. Libellés du badge (la WinrateBar reste affichage pur,
  elle reçoit valeur + libellé) : « Calibré sur N games (LCK, walk-forward) »
  si `calibrated` (N = `nGames` de la carte LIGUE) ; « Non calibré » sinon —
  y compris ligue sans carte (lcs, cblol, lcp, internationaux : repli
  passthrough TRANCHÉ).
- **CoachPanel / `winAfter`** : nouveau prop `leagueId` ; la page passe
  `coachLeagueId = coach.side === allySide ? leagueIdA : leagueIdB` (D4 — en
  simulation, le coach conseille le camp au trait). `winShown` ajoute
  `leagueId` à l'appel `calibrateAllyWin` ; `pctCalibrated` cesse de lire
  `calibration.positions` directement et passe par
  `leaguePositionsOf(calibration, leagueId)` (sinon il lirait le champ
  provenance v2, qui est tout `validated:false` — le helper est l'UNIQUE point
  de résolution). Tri du navigator et `liveDraft.ts` : toujours inchangés
  (calibration à l'affichage, b > 0 garantit l'ordre à position égale).
- **`help/+page.svelte`** : l'entrée Badges documente la dimension ligue —
  « le % est calibré PAR LIGUE (lck/lec/lfl/lpl mesurées) ; une ligue non
  mesurée affiche le % brut et “Non calibré” » — et les TROIS approximations
  d'application du §1 (ancres, rôles inférés, inter-ligues).
- Avant LE run, rien ne bouge visuellement : la config commitée est la v1
  tout `validated:false` ⇒ passthrough partout (le threading `leagueId` est
  inerte) — c'est l'état shippable de l'étape UI.

### 2.5 Tests (calculés à la main, `tests/`)

- `tests/estimators.winCalibration.test.ts` — ÉTENDU, les tests v1 restent
  VERBATIM (leur vert = la porte de rétro-compat) ; nouveaux cas :
  - `leaguePositionsOf` : config null → null ; v1 → `positions` (leagueId
    ignoré) ; v2 + ligue connue → la carte de la ligue ; v2 + ligue inconnue /
    `leagueId` absent → null ; v2 ne renvoie JAMAIS `config.positions` ;
  - `calibrateAllyWin` v2 : carte lck (a = 0,2, b = 0,7) validée, ally rouge,
    `pAllyRaw = 0,6` ⇒ `pAlly ≈ 0,520944` (la valeur à la main v1, inchangée —
    même carte, résolution par ligue) ; même config interrogée avec
    `leagueId: 'lcs'` ⇒ passthrough `calibrated:false` ;
  - v2 avec carte non validée ⇒ passthrough ; `nGames` du résultat = celui de
    la LIGUE, pas le total.
- `tests/fixtures/calibration/byLeague/` : mini-corpus synthétiques
  `lck-2025.json` + `lck-2026.json` + `lec-2026.json` (~12 games, 3 patchs,
  issues connues) + dataset jouet, pour le smoke de plomberie du runner.
  Mécanisme de hash (cohérent avec la règle §1) : les hashes attendus gelés
  sont les DÉFAUTS du script ; le smoke surcharge via
  `--expected-sha256-current/--expected-sha256-full` (hashes du dataset
  jouet), flags interdits sur corpus réels. Cas testés : couverture, abort
  basename inconnu, abort hash ≠ attendu (défauts gelés contre dataset
  jouet), abort gameId dupliqué — jamais d'exécution sur données réelles
  avant la porte de validité puis LE run (architecte).
- Smoke `--pooled` sur les mêmes fixtures : vérifie le format v1 du rapport et
  l'abort si `--params-out`.

### 2.6 Table d'acceptation de la porte de validité

Valeurs publiées de `docs/calibration/win-calibration-2026.md` (7 corpus,
seed 42, snapshots gelés) — le mode --pooled doit les reproduire À 5 DÉCIMALES
(Δ et bornes d'IC) :

| Position | ΔBrier | IC 95 % | Δ log loss (secondaire) | IC 95 % |
|---|---|---|---|---|
| afterBans | −0,00121 | [−0,00273 ; 0,00032] | −0,00241 | [−0,00577 ; 0,00081] |
| after3Picks | −0,00065 | [−0,00222 ; 0,00084] | −0,00130 | [−0,00434 ; 0,00199] |
| fullDraft | −0,00204 | [−0,00437 ; 0,00038] | −0,00413 | [−0,00870 ; 0,00094] |

Contrôles secondaires (mêmes seuils d'égalité que leur précision publiée) :
n = 2567 paires ; 26 groupes, 24 folds, premier fold 25.S1.2 (n = 99) ;
train-only : 14.16 (11), 25.S1.1 (81) ; Brier calibré/brut à 4 décimales par
position (0,2488/0,2500 · 0,2487/0,2494 · 0,2471/0,2492) ; fits finals à
6 décimales : afterBans a = 0,157527, b = 1,000000 · after3Picks a = 0,146409,
b = 0,675449 · fullDraft a = 0,159408, b = 0,549009 (nTrain 2659).

---

## 3. Analyse des fuites (leakage) et du fishing — et comment le design les neutralise

| # | Risque | Neutralisation |
|---|---|---|
| 1 | **Fuite temporelle outcome → (a,b)** | `walkForward`/`groupByPatch` PAR LIGUE : fit sur patchs strictement antérieurs DE LA LIGUE ; minTrainSize 50 par ligue ; assertion chronologique par ligue (25.S1.x couverts) ; records sans patch écartés et comptés. |
| 2 | **Fuite de features du dataset SoloQ** (M3.x) | Non éliminable, NEUTRE pour le verdict : les deux bras comparés consomment le MÊME p_raw (comparaison appariée interne). Snapshots IDENTIQUES à la run #2, vérifiés par hash (abort si ≠) — jamais re-tirés. Caveat verbatim dans la règle et le rapport. |
| 3 | **Fishing de cellules / multiplicité** (12 verdicts) | Les 12 cellules = produit cartésien de listes antérieures au chantier (4 ligues du corpus × 3 ancres v1) — aucune ne peut être ajoutée/retirée post-résultats ; TOUTES publiées ensemble ; multiplicité CHIFFRÉE d'avance (~0,3 faux vert attendu, P(≥1) ≈ 26 %) ; chaque claim produit cite sa cellule et son IC, jamais « au moins une ligue est verte ». |
| 4 | **Fishing de protocole** | Tout gelé : module platt inchangé, 10 bacs, seed 42, 1000 resamples, ordre des 24 IC fixe, minTrain 50, verdict = ΔBrier uniquement (log loss déclaré secondaire AVANT le run), liste des 8 fichiers et leur appariement ligue. |
| 5 | **Double-dip des fits finals** | Full-fits par ligue + full-fit poolé déclarés d'avance, n'alimentent AUCUNE métrique ; toutes les métriques publiées sont walk-forward (standard validate-procedure-then-fit-all). |
| 6 | **Gestion de surprise post-hoc sur afterBans** | Dégénérescence side-only PAR LIGUE déclarée, avec les DEUX lectures pré-écrites pour lck (vert = side honnête à afficher ; rouge = avantage non stable 2025-2026) et pour lec/lfl/lpl (rouge = confirmation d'honnêteté). Aucune narration à inventer. |
| 7 | **Asymétrie de side à l'application** | Aller-retour espace bleu inchangé dans `calibrateAllyWin` — et re-testé : le `a` par ligue est PLUS grand (cas lck), l'inversion serait plus visible, pas moins. |
| 8 | **Inversion du tri** (b ≤ 0) | `validated` exige b > 0 au fit final DE LA LIGUE ; tri du coach toujours sur valeurs brutes (calibration à l'affichage). |
| 9 | **Cherry-picking d'éligibilité** | Une seule règle `isCalibrationEligible` (inchangée v1), un seul ensemble par ligue partagé par les 3 positions, écartés comptés par fichier. |
| 10 | **Mauvaise carte à l'application** (fuite de ligue) | La ligue vient d'un état UI explicite (`leagueIdA`/`leagueIdB`, vérifiés dans `+page.svelte`) ; côté mesure, l'appariement fichier→ligue est asserté par regex sur le basename (abort sinon) ; résolution UNIQUE par `leaguePositionsOf` (UI et estimateur — pas deux sémantiques de repli). Cas inter-ligues = approximation (c) déclarée, hors claim. |
| 11 | **Fishing de repli** (« passer au poolé si les ligues sortent rouges ») | Le repli passthrough est TRANCHÉ et gelé dans la règle (D3) ; le full-fit poolé de l'artefact est `validated:false` FORCÉ par construction — le promouvoir exigerait une NOUVELLE règle gelée, pas une retouche. |
| 12 | **Contamination par la porte de validité** (un run sur données réelles AVANT le run E3) | Le mode --pooled ne peut produire que des nombres DÉJÀ publiés (v1) : il ne révèle rien de nouveau et ne peut informer aucun paramètre (la règle est gelée avant qu'il tourne) ; il n'écrit aucun params ; son rapport est publié (`docs/run3/E3-validite-poolee.md`). |
| 13 | **Petits trains Platt** (50 records, 2 paramètres) | Assumé : ridge 1e-6 + clamp du module gelé ; premiers folds bruités mais honnêtes (le walk-forward pèse par paires, micro-average) ; minTrain re-posé AVANT le run (D2) avec les tailles de premiers trains mesurées (74/84/58/88). |
| 14 | **Hétérogénéité INTRA-ligue** (2025 vs 2026, formats, First Selection) | Assumé et déclaré : la carte par ligue moyenne encore 2025-2026 ; le walk-forward refit à chaque fold (la carte de test suit la dérive avec un patch de retard) ; fenêtres de patch locales avec décroissance = candidat run ultérieur, jamais une retouche de ce run. |
| 15 | **Drift après le run** | Doctrine §6.8 : re-run du script à chaque refresh corpus ; `fittedThroughPatch` PAR LIGUE dans le JSON ; b qui s'effondre après un gros patch = signal documenté. |

---

## 4. Plan d'implémentation pas-à-pas

Ordre anti-fishing : TOUT le code (estimateur, runner, UI) se construit et se
teste AVANT tout run réel ; ensuite la porte de validité (architecte), puis LE
run (architecte) qui ne change que deux fichiers de données.

1. **Estimateur v2** : types union dans `src/lib/estimators/winCalibration.ts`
   (`leagues?`, `LeagueCalibration`), `leaguePositionsOf`, 5ᵉ paramètre
   `leagueId` de `calibrateAllyWin` ; tests v2 ajoutés, tests v1 INTACTS.
   Vert quand : valeurs à la main (0,520944 via carte lck ; passthrough lcs),
   tests v1 verbatim verts, `svelte-check` 0 erreur.
2. **Runner `scripts/backtest/winCalibrationByLeague.ts`** (en-tête = règle §1
   gelée, hooks du patron) + fixtures `tests/fixtures/calibration/byLeague/`.
   Vert quand : smoke complet sur les fixtures (mode ligue ET mode --pooled) →
   rapport + params v2 produits, aborts vérifiés (basename inconnu, hash
   dataset, --params-out en --pooled, gameId dupliqué) ; AUCUNE exécution sur
   corpus réel.
3. **Intégration UI** : `+page.svelte` (5ᵉ arg `leagueIdA` ; `coachLeagueId`
   vers CoachPanel), `CoachPanel.svelte` (prop `leagueId`,
   `pctCalibrated` via `leaguePositionsOf`), libellés badge avec ligue, aide.
   Vert quand : `pnpm test`, `svelte-check`, `pnpm build` verts ; smoke
   navigateur : badge « Non calibré » présent, % inchangés (config v1
   tout-false ⇒ passthrough — threading inerte).
4. **GEL** : commit de tout ; la règle de l'en-tête est désormais immuable.
5. **PORTE DE VALIDITÉ (architecte)** : mode --pooled sur les 7 corpus v1,
   snapshots gelés, seed 42 → `docs/run3/E3-validite-poolee.md` ; comparaison
   à la table d'acceptation (§2.6) à 5 décimales. Tout écart = bug
   du runner v2 : on répare, on re-gèle, on re-passe la porte — AUCUN run E3
   avant égalité. Le rapport de validité est commité tel quel.
6. **LE run (architecte)** : une commande, 8 corpus, seed 42 →
   `docs/calibration/win-calibration-par-ligue-2026.md` +
   `data/calibration/winCalibration.json` (v2). Commit des deux, SANS
   retouche. Vérifier au navigateur : les (ligue × position) vertes affichent
   « Calibré sur N games (LIGUE, walk-forward) » et les % bougent UNIQUEMENT
   sur ces configurations ; une ligue sans carte reste brute.
7. **Documentation du verdict** : ligne `docs/STATUS.md` (table des verdicts,
   item #4 de la file post-run consommé), `ETAT_DES_LIEUX.md` ligne
   calibration (→ §A si au moins une cellule produit verte), entrée d'aide.

Dépendances : aucune sur les autres chantiers run #3. Estimation : 1 session
de build (étapes 1-4) + porte de validité et run (minutes, architecte).

---

## 5. Ce que le verdict change

**Si VERT sur une cellule (ligue × position) — `fullDraft` des ligues jouées
par Alain (lfl, lec) est l'enjeu produit principal, lck/afterBans l'enjeu
scientifique :**
- Le badge « Calibré sur N games (LIGUE, walk-forward) » remplace « Non
  calibré » pour CETTE ligue et CETTE position (config plain uniquement) ;
  claim produit autorisé, par cellule : « en LIGUE, quand l'outil affiche
  X %, la fréquence observée tombe dans le bac correspondant » — vérifiable,
  modeste, JAMAIS « on prédit le vainqueur ».
- Cas particulier déclaré : un VERT lck/afterBans fait afficher ~q % (≠ 50 %)
  dès la fin des bans en LCK — c'est l'avantage de side mesuré rendu visible,
  la lecture est écrite dans la règle.
- `ETAT_DES_LIEUX` : la ligne calibration passe en §A avec sa mesure PAR
  LIGUE ; le harnais gagne des % calibrés par ligue pour les chantiers qui
  s'expriment en pp (gate coach run #3, I5).
- Maintenance actée : re-run du script à chaque refresh corpus ;
  `fittedThroughPatch` par ligue ; b qui s'effondre = drift quantifié.

**Si ROUGE sur une cellule :** aucun changement d'affichage pour cette
(ligue × position) — passthrough conservé. Le rapport publie la cellule telle
quelle (le Summit Gate vit de rouges honnêtes), avec son diagnostic descriptif
(fiabilité 10 bacs : sur-confiance ? raw collé à 0,5 ? n insuffisant — MDE
déclaré ?).

**Si TOUT-ROUGE :** le JSON v2 est quand même shippé (tout
`validated:false`) — l'UI ne change pas, l'infra par ligue (types v2, helper,
threading, runner) reste acquise. Suites légitimes = NOUVEAUX designs
pré-enregistrés (fenêtres de patch locales avec décroissance, calibration du
side-context, ligues à corpus élargi) — chacun sa règle gelée. Lecture
honnête pré-écrite : si même lck/afterBans (le signal le plus fort publié du
run #2) sort rouge, l'hypothèse « l'hétérogénéité des ligues est le levier de
la calibration » est affaiblie au niveau de puissance déclaré — ça se publie,
ça ne se re-découpe pas.

**Dans tous les cas :** chaque cellule porte son verdict indépendant dans le
JSON (`validated` par ligue × position) — l'UI suit mécaniquement, sans
interprétation ; les 12 verdicts sont publiés ensemble avec la note de
multiplicité.

---

*Rédigé le 2026-06-11 (chantier E3, run #3). Données d'appui mesurées avant
gel — COUVERTURE SEULEMENT, aucune métrique d'issue lue, aucun script de gate
exécuté : timelines et comptes éligibles par ligue recalculés sur l'état
amendé des 8 corpus (éligibilité v1 ré-implémentée en one-shot, winner testé
en présence seulement) ; config UI lue dans `src/routes/+page.svelte`
(`leagueIdA`/`leagueIdB`, `coachSide` de la simulation, call-sites
`calibrateAllyWin`) et `src/lib/data/leagues.ts` (10 ligues offertes, 4
mesurées) ; hashes datasets de `data/datasets/SNAPSHOT.md` ; chiffres v1
recopiés du rapport publié `docs/calibration/win-calibration-2026.md`. Les
attendus afterBans citent uniquement des chiffres DÉJÀ publiés du run #2
(STATUS : side-only lck 2026 +8,4 pp ; lec/lfl/lpl ≈ pile-ou-face).*
