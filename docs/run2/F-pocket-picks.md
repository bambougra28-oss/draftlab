# F — Pocket picks : maîtrise et au-delà (Fearless d'abord) — Design run #2, v2

> **Statut : RÉÉCRIT post-revue adversariale (2026-06-11) — candidate au gel.**
> La v1 (sketch théorique) a reçu un verdict À-RETRAVAILLER ; cette v2 intègre
> les 11 amendements et les deux règles complètes (F1, F2) de la revue. Une
> re-revue courte du document assemblé précède le gel, puis la règle de chaque
> gate est recopiée verbatim dans l'en-tête de son script AVANT tout run.
>
> Directive d'Alain (2026-06-11) : « Il faut que DraftLab maîtrise à la
> perfection, voire aille encore au-delà concernant cette notion très utile en
> Fearless. » Cas fondateur : **G2 Esports (Skewmond), finale LEC Spring 2026,
> game 5 à 2-2 — Nasus JUNGLE seq 17, premier Nasus jungle au plus haut niveau
> en 9 ans, sans mort, MVP, titre back-to-back. 1 seul Nasus sur les 1 219
> games 2026 des 4 ligues.**
>
> Correction du récit fondateur (revue, vérifié corpus) : dans le fold
> lec-2026, Nasus a 0 pick → notre inférence l'aurait traité par le **fallback
> uniforme** (classe B, pas « 95 % top confiant et faux ») et, les 4 voisins
> (Anivia/Alistar/Senna/Kled) étant lisibles, l'injectivité aurait pu le placer
> jungle PAR ÉLIMINATION. La vulnérabilité MESURABLE est ailleurs : la classe
> « hors-rôle établi » (Nasus générique — champion connu, déplacé), 146 cas
> dans les corpus, où le vrai rôle a un prior nul et la lecture des VOISINS
> peut se contaminer. C'est l'objet de F2.

---

## 0. Préconditions data (BLOQUANTES)

1. **Re-pull des corpora** : les snapshots du 2026-06-10 portent les erreurs
   de la finale LEC 2026 (G5 impossible après série 3-1, Nasus attribué à KC —
   vérifié au jour de la revue) et 34-49 séries 2026 à séquence Bo incohérente
   (0 en 2025). Aucune gate F ne lit un vainqueur ou une équipe avant re-pull.
2. **Validateur d'intégrité Bo dans pullCorpus, format-aware** (livré chantier
   G, `src/lib/data/boIntegrity.ts`) : violation DURE = maxWins ≥ 4, ou 3ᵉ
   victoire suivie d'une game, ou gameNumber dupliqué/troué ⇒ série
   quarantainée ; les séquences « 2-0 puis G3 » sont FLAGGÉES sans quarantaine
   (Bo3 format-fixe possibles — 32 cas 2026 relevés, à discriminer au diff).
3. **Quarantaine fraîcheur** : records < 7 jours re-pullés avant tout run de
   gate (`--fresh-days`, chantier G).
4. **Hashes sha256 des 7 fichiers corpus publiés** dans chaque rapport F.
5. **Amendement d'architecte requis AVANT tout run de la run #2** : re-figer
   les comptes d'audit gelés (C §1.0/§4-étape-4 : 836 séries, 46 re-picks,
   2 944 événements ; A : « 2 661 drafts ») sur l'état re-pullé — UN SEUL état
   de corpus pour toute la run, daté et committé.

**LES runs F1/F2 sont BLOQUÉS tant que (1), (2) et (5) ne sont pas dans
l'historique.**

## 1. La théorie — ce qu'est vraiment un pocket pick

Quatre mécanismes, tous reliés à des moteurs existants :

1. **Asymétrie de préparation.** Tout modèle adverse (le nôtre compris) est
   construit sur le VISIBLE. La **réserve de surprise** d'une équipe = l'écart
   entre ce qu'elle sait d'elle-même et ce que les données publiques disent
   d'elle. Quantifiable côté données publiques : `bits = −log₂(P_modèlePublic)`
   (l'alarme existe : `surpriseOf`, `src/lib/strategic/rangeModel.ts`,
   `surpriseAlarmBits = 5`, ε = 1e-3 ⇒ bits plafonnés ≈ 9,97).
2. **Valeur de réserve Fearless.** En Bo5 hard-Fearless, la G5 démarre avec
   ~40-50 champions morts : (a) le modèle adverse de notre inventaire se croit
   complet — le pocket le casse ; (b) leur pool de RÉPONSES est épuisé. G2 a
   dépensé son Nasus exactement au maximum de sa courbe de valeur.
3. **Tromperie de role-map.** Le pocket hors-rôle trompe la lecture — pour un
   champion ÉTABLI déplacé (classe A), le vrai rôle a un prior nul : la vérité
   est exclue des hypothèses et la lecture des VOISINS peut se contaminer
   (mesuré par F2) ; pour un champion hors-corpus (classe B), le fallback
   uniforme + l'injectivité se défendent partiellement (mesuré par F2-S1).
4. **Surprise × cohérence.** Sans le fit, c'est un coin flip cheese. La compo
   G2 autour du Nasus (Anivia setup mur + waveclear, Alistar peel, Senna
   double-scaling, Kled strong-side) est CONSTRUITE pour lui — vérifiable par
   nos cellules (pairPrior, counterThreat) et le winConditionGraph.

   Discours pro confirmé : iTero (« teams have thrown entire series because
   they didn't respect a pocket pick ») ; guides Fearless (« hold a rare
   counter for a potential game 5 »). F-b formalise et CHIFFRE ce que les
   staffs font à l'instinct.

**Existant à articuler** : `pocketPickRiskAssessor` (M5.4, heuristique 3
raisons, seuil présence 5 %, consommé par la priorité de bans M6.1) reste le
signaleur DÉFENSIF heuristique ; F le dépasse en mesurant (F1) et en
défendant par mécanisme gelé (F-c). Après F1, son seuil 5 % est re-jugé
(STEP_UP déjà ouvert sur ses seuils reconstruits).

## 2. La maîtrise — quatre moteurs

### F-a. `publicSelfModel` — surprises vs modèle public

Appliquer NOTRE pipeline de tendances à une équipe X (ses games corpus
visibles) donne le **MODÈLE PUBLIC** de X : ce que tout adversaire préparé
voit. Sortie V1 (seule revendiquée) : par équipe et par rôle, les champions du
jeu à surprise élevée en bits — `bits = −log₂(P_modèlePublic)`, P depuis la
surface de demande du chantier C (`fitTeamDemand`, α = 5, λ = 0,9, défauts
commités) — **SANS prétention de connaître le pool privé** : il n'existe
AUCUNE source interne (pas de scrims ; storage sans store de pool — vérifié
`idb.ts` ; `enrichPlayers` bloqué ; Alain n'a aucune game corpus). Le
« réservoir » affiché est donc **« ce qui serait une surprise »** (lecture),
pas « ce que l'équipe sait jouer » (claim interdit).

**OPTION PRODUIT (décision Alain, non bloquante)** : une saisie manuelle
« mon pool » (nouvelle UI + store IndexedDB additif) fournirait l'opérande
gauche pour SON réservoir personnel = pool saisi ∩ surprise ≥ seuil ; sans
cette saisie, le panneau « Tes pockets » reste en mode lecture-de-surprise.

### F-b. `pocketAdvisor` — le conseiller offensif

Candidats = surprises élevées (F-a) ∩ `counterThreat > 0` vs leurs tendances
∩ `pairPrior` cohérent avec notre noyau ∩ viable au patch. Chaque candidat
sort avec sa **checklist d'activation** en français, **générée depuis les
tags présents — chaque item cite sa dimension de tag source, jamais
inventée** (schéma réel `src/lib/tags/types.ts` : damageType, range,
engageTool, disengageTools{peel,knockback}, mobility, scalingWindow,
hyperCarry, gamePlanHints). Exemple dérivable : « exige : un peel allié
(disengageTools.peel) OU un knockback ; pas de saturation AD (≥ 2 AD déjà
pickés — damageType) ; en Fearless, leur jungle early (scalingWindow = early
au rôle jungle de la lecture courante) déjà consommée ». Les notions « setup
mur » et « top autonome » NE SONT PAS des tags : retirées des exemples ;
toute extension du schéma de tags serait un chantier déclaré (172 champions à
ré-étiqueter).

En série : recommandation **GARDER / DÉPENSER** = composants séparés
(DA-V2-12), chacun badgé Expérimental (DA-V2-11) :
- le prix de série `γ·ΔS` du chantier C (`seriesTermOf`,
  `src/lib/strategic/seriesKnapsack.ts` — livré en vague 2) ;
- le **coût de révélation** I2 : `revelationCost`/`baitLedger`
  (`src/lib/strategic/fogReveal.ts`) avec injections NOMMÉES :
  `FogEvalContext.enemyBestResponse`/`enemyBestResponseUnderUncertainty`
  (évaluateur navigator), `BaitContext.takeProbability` (ranges I1),
  `theirEquityIfTaken`/`ourPreparedAnswerEquity` (évaluateur),
  `optionValue` (I4 ; `defaultOptionValue = 0` commité tant que I4
  n'injecte pas).

**Économie d'apprentissage (spécifique Alain)** : classement final pondéré
par l'adjacence de tags aux champions de SON pool — opérationnel seulement si
la saisie « mon pool » existe (option F-a) ; sinon l'axe est masqué.

### F-c. `surpriseDefense` — le correctif du trou de lecture (gelé, conditionné F2)

**Ne se branche QUE si F2 est VERTE.** Mécanisme SANS nouveau paramètre :
- **Déclencheur (live)** : `surpriseOf(pick).bits ≥ surpriseAlarmBits = 5`
  (config commitée `rangeModelConfig.ts`) ET rôle-novelté structurelle
  (compte train équipe+ligue de (champion, rôle le plus probable de la
  lecture courante) = 0).
- **Mécanisme** : pour le champion déclencheur SEUL, les poids de rôle
  passent à l'UNIFORME (β = 1 — exactement le chemin fallback existant de
  `readEnemyRoles` pour les champions inconnus), puis ré-énumération des
  hypothèses ; les autres champions gardent leurs priors.
- **Garde de non-régression (gelée)** : après branchement, re-run de
  `scripts/backtest/roleInference.ts` — accuracy pooled k=3 **≥ 94,5 %**
  exigée (borne basse Wilson actuelle 94,7 % moins marge), sinon F-c est
  débranché et le rouge documenté : le système VERT pré-enregistré prime.
- Avertissement FR (« pick préparé — leur prep est profonde ») + estimation
  du **dark pool** adverse (champions viables au patch − leur pool montré,
  pondérés par rôle) restent de la LECTURE, sans claim.

### F-d. `fearlessEndgame` — L'AU-DELÀ : le solveur de fin de série

L'analogie des tablebases d'échecs, jamais publiée pour la draft. **Bornes
honnêtes GELÉES** : candidats par slot = top-8 de la range I1 (`surpriseK =
8`, config commitée) pour les slots adverses ∪ top-8 demande/présence pour
les nôtres, filtrés disponibilité ; **espace exact calculé AVANT toute
recherche** = Π_{slots restants} |C_s| ; bascule exhaustive **ssi espace ≤
10⁶ nœuds** (sinon depth-2 shippé inchangé) — aux 4 derniers picks à 8
candidats : 8⁴ ≈ 4 096 ✓ ; à 8 slots restants : 8⁸ ≈ 1,7·10⁷ ✗ (la bascule se
déclenche naturellement en toute fin de draft, là où l'enjeu est maximal) ;
memo par état (clé = révélés triés + seq) ; **cible déclarée < 2 s par
décision** sur la machine d'Alain, mesurée et publiée. Ship Expérimental
(DA-V2-11) dans tous les cas non-ROUGE de F4.

## 3. Les gates pré-enregistrées

> Indépendance anti-fishing (gelée) : **F1→panneau réservoir offensif ;
> F2→F-c (défense) ; F3→(rien : lecture de C) ; F4→bascule exhaustive F-d** —
> aucun vert ne peut shipper le moteur d'un autre. Deux runs distincts
> (F1, F2) ; F4 = bras du runner A ; F3 = zéro run.

### 3.1 F1 — le premium du pocket, mesuré

Règle complète pré-enregistrée, à geler verbatim dans l'en-tête de
`scripts/backtest/pocketPremium.ts` AVANT tout run :

```
F1 — PREMIUM DU POCKET PICK (chantier F, run #2). Règle pré-enregistrée, à geler
verbatim dans l'en-tête de scripts/backtest/pocketPremium.ts AVANT tout run.
UNE règle, UN run ; tout rouge est gelé ; toute nouvelle piste = NOUVEL en-tête daté.

PRÉCONDITION (bloquante) : corpora re-pullés post-forensics (les snapshots du
2026-06-10 portent les erreurs de la finale LEC 2026 — vérifié : G5 après série
3-1, Nasus attribué à KC) ; validateur d'intégrité Bo passé ; amendement
d'architecte re-figeant les audits de la run #2 sur l'état re-pullé ; sha256 des
7 fichiers publiés dans le rapport.

CORPUS : static/corpus/{lck,lec,lfl,lpl}-2026.json +
data/corpus/{lec,lfl,lpl}-2025.json (re-pullés). lck-2025 s'il arrive = run de
RÉPLICATION séparé, jamais fusionné.

TEST F0 (bloquant PAR SÉRIE, publié par tournoi) : reconstruction par
(corpus, series.matchId) via reconstructSeries (module C). Série exclue et
comptée si : maxWins ≥ 4 ; ou une équipe atteint 3 victoires avant une game
suivante ; ou gameNumber dupliqué/troué ; ou équipes ≠ exactement 2. Les
séquences « 2-0 puis G3 » sont GARDÉES et listées (Bo3 format-fixe possible).
Exclusion TEST 0 héritée de C : tournois non Fearless-confirmés (attendu :
LFL 2025 Promotion) exclus du stratum gameNumber mais gardés en pooled (la
définition d'événement ne dépend pas du mode).

WALK-FORWARD PAR PATCH, PAR CORPUS (patron postdiction/C) : pour une game de
patch k, train = records du même corpus de patch plaçable strictement antérieur
(parsePatch/comparePatches) ; premier patch ou patch non plaçable ⇒ game non
scorée, comptée.

ÉVÉNEMENT POCKET (structurel — AUCUNE issue lue dans la définition) : pick
résolu (champion c, rôle r, équipe T) tel que (P1) picks de c par T dans le
train = 0 ; ET (P2) picks de c dans le train ligue toutes équipes ≤ 2 (tous
rôles confondus) ; ET (P3) c n'est pas sorti après le 2025-01-01 (liste DDragon
figée au gel, publiée — neutralise les nouveaux champions). CLASSE CONTRASTE
« nouveauté banale » : (P1) ET picks ligue train ≥ 20 ET (P3). Seuils
0 / ≤ 2 / ≥ 20 GELÉS ici.

GAME SCORÉE : vainqueur connu, 10 picks résolus avec rôles, fold non vide,
série non exclue F0, et EXACTEMENT UN side porte ≥ 1 événement de la classe
considérée (les games à événements des deux côtés sont exclues, comptées —
attendu d'audit : ~323 pour la classe pocket) ; pour la classe contraste :
exactement un side nouveauté ET zéro événement pocket dans la game.

MÉTRIQUE : WR_pocket = part des games pocket gagnées par le side pocket ;
WR_nouveauté = idem classe contraste ; premium = WR_pocket − WR_nouveauté.

BASELINES (obligatoires, pré-enregistrées) : B0 — hasard 0,5 (symétrie
within-game ; side-only ≈ pile-ou-face validé scorecards). B1 (baseline
ACTIVE) — WR_nouveauté : même fraîcheur « jamais montré par l'équipe », sans
rareté de ligue — neutralise « jouer du neuf » et une partie de la sélection
« les équipes qui osent sont des équipes qui préparent ».

CRITÈRES DE VERDICT (gelés) : Critère 1 : Wilson 95 % lo de WR_pocket > 0,5
(pooled 7 corpus). Critère 2 : IC bootstrap 95 % du premium, resampling par
CLUSTER de série ((corpus, matchId) ; game sans série = son propre cluster),
statistique WR_pocket − WR_nouveauté RECALCULÉE par resample (patron S2 du
chantier C), 1000 resamples, mulberry32(seed 42), flux unique en ordre fixe
(critère 2 puis S1) ; lo > 0. VERT = 1 ET 2 (claim : « le pick hors-radar rare
porte un premium au-delà de la simple nouveauté — corrélation, pas
causalité »). ORANGE = 1 seul (« le side qui ose gagne plus, mais pas plus que
pour toute nouveauté »). ROUGE = critère 1 non atteint. Aucun retuning : la
règle est consommée.

PUISSANCE DÉCLARÉE (comptes structurels pris le 2026-06-11 AVANT gel, AUCUN WR
calculé) : ~679 games pocket one-side attendues (lck26 77, lec26 76, lfl26 56,
lpl26 102, lec25 103, lfl25 98, lpl25 167 ; ~531 clusters), ~617 en G1-3, ~62
en G4-5 ; ~1 908 picks-événements. Au seuil n≈679, le critère 1 exige
WR ≳ 53,8 % (MDE ≈ +3,8 pp) ; un effet réel plus petit sera publié non
significatif — c'est le contrat. La tranche G4-5 (n≈62, ±12 pp) ne peut porter
AUCUN verdict.

SECONDAIRES (descriptives, AUCUN pouvoir de verdict) : S1 — premium par bin
gameNumber {1-3, 4-5} (l'hypothèse directionnelle d'origine « la valeur du
pocket monte avec le numéro de game », lue à titre descriptif seulement). S2 —
WR_pocket par corpus + liste exhaustive des événements (champion, rôle, équipe,
gameId) en annexe — le cas G2-Nasus doit y figurer (test de cohérence du
re-pull). S3 — distribution des événements par rôle et par index de pick du
side (1..5). S4 — part des picks pocket également hors-rôle (croisement F2).
COUVERTURE : exclusions par cause et par corpus (F0, fold, both-sides, picks
irrésolus).

FUITES / FISHING : définitions d'événements 100 % train (walk-forward strict)
et structurelles — l'issue n'entre que dans la métrique ; biais de sélection
NON neutralisable DÉCLARÉ (les équipes sortent le pocket quand les conditions
s'y prêtent) ⇒ langage corrélationnel obligatoire dans le rapport ET l'UI ; mix
de strates différent entre classes pocket/nouveauté déclaré (S1 publie les
bins) ; ~12 événements répétés (même équipe, même champion) sur 146 hors-rôle :
le cluster par série absorbe l'essentiel, le reste est déclaré ; UNE primaire,
deux critères, secondaires étiquetées d'avance ; --audit-only n'imprime jamais
un WR ; le commit de l'en-tête précède le run.

RUN : node --experimental-transform-types --no-warnings
scripts/backtest/pocketPremium.ts static/corpus/lck-2026.json
static/corpus/lec-2026.json static/corpus/lfl-2026.json
static/corpus/lpl-2026.json data/corpus/lec-2025.json data/corpus/lfl-2025.json
data/corpus/lpl-2025.json [--seed 42] [--audit-only] [--generated-at ISO]
[--out docs/calibration/pocket-premium-f1.md]
```

### 3.2 F2 — la surprise casse la lecture des rôles

Règle complète pré-enregistrée, à geler verbatim dans l'en-tête de
`scripts/backtest/roleSurprise.ts` AVANT tout run :

```
F2 — LA SURPRISE CASSE LA LECTURE DES RÔLES (chantier F, run #2). Règle
pré-enregistrée, à geler verbatim dans l'en-tête de
scripts/backtest/roleSurprise.ts AVANT tout run. Restriction du harnais VALIDÉ
scripts/backtest/roleInference.ts (règle 2026-06-10 : priors ligue walk-forward
fitRolePriors, énumération jointe roleAssignmentHypotheses, fallback uniforme
pour champion inconnu, top-hypothèse, k ∈ {3,5}) — rien n'est recodé, le
scoring est importé.

PRÉCONDITION (bloquante) : identique à F1 (re-pull + validateur Bo + amendement
d'architecte ; hashes publiés).

CORPUS : les 7 fichiers canoniques (mêmes que F1).

ÉVÉNEMENTS (structurels, fold only — fold = fitRolePriors des records de patchs
strictement antérieurs, même corpus, patron du harnais) : CLASSE A « hors-rôle
établi » : pick résolu (c, r) d'un side rôle-complet tel que compte fold de
(c, r) = 0 ET compte fold de c tous rôles ≥ 5 — le piège Nasus générique (un
champion à identité de rôle établie, déplacé). CLASSE B « hors-corpus » :
compte fold de c = 0 — le chemin fallback uniforme (le cas G2-Nasus réel dans
lec-2026). Un FLEX légitime (les deux rôles ≥ 1 au fold) n'est JAMAIS un
événement. Side à événement = (game, side, k=5) contenant ≥ 1 événement de la
classe ; un side peut porter les deux classes (compté dans chacune, déclaré).

TAUTOLOGIE DÉCLARÉE ET NEUTRALISÉE : en classe A, l'accuracy sur le champion
surprise lui-même est 0 % PAR CONSTRUCTION (le vrai rôle a un prior fold nul ⇒
roleAssignmentHypotheses, qui exige weight > 0, exclut la vérité de H). Ce 0
est publié comme THÉORÈME (l'explication mécanique du trou) et n'entre dans
AUCUN critère.

MÉTRIQUE PRIMAIRE (l'empirique qui justifie F-c) : à k = 5, acc_contaminée =
accuracy de la top-hypothèse jointe sur les 4 AUTRES champions des sides
classe A ; acc_saine = accuracy top-hypothèse k=5 sur les sides sans AUCUN
événement (ni A ni B) des mêmes corpus ; Δ_contamination = acc_contaminée −
acc_saine.

CRITÈRE DE VERDICT (gelé) : IC bootstrap 95 % de Δ_contamination, resampling
par CLUSTER de série, statistique recalculée par resample (patron S2 du
chantier C), 1000 resamples, mulberry32(seed 42). hi < 0 ⇒ F2 VERTE (la
surprise contamine significativement la lecture des voisins par injectivité).
IC touchant 0 ⇒ ORANGE (non significatif). lo > 0 ⇒ ROUGE remarquable
(l'injectivité absorbe la surprise), publié tel quel. PRÉDICTION
PRÉ-ENREGISTRÉE : Δ < 0, ampleur ≥ 5 pp.

PUISSANCE DÉCLARÉE (comptes structurels pris le 2026-06-11 AVANT gel, AUCUNE
accuracy calculée sur ces tranches) : classe A ≈ 146 événements / 143 sides /
131 clusters de série (par gameNumber : 49/38/37/15/7 ; par index de pick du
side : 35/26/18/25/42) ⇒ ~584 scores de voisins — un effet ≥ 5 pp sur une base
~93,4 % (k=5 pooled validé) est détectable même avec l'inflation de cluster ;
classe B ≈ 818 événements / 642 sides. Baselines de contexte publiées :
accuracy pooled k=5 = 93,4 % [93,0;93,7] et k=3 = 95,0 % [94,7;95,4] (rapport
role-inference-2026.md, à RE-MESURER sur les corpora re-pullés — les chiffres
du rapport peuvent bouger marginalement, déclaré).

SECONDAIRES (descriptives, AUCUN pouvoir de verdict) : S1 — accuracy sur le
champion surprise en CLASSE B (uniforme + injectivité : il peut être bien placé
PAR ÉLIMINATION — exemple attendu : Nasus G5, 4 voisins lisibles ⇒ jungle en
reste) ; S2 — le théorème classe A (0 %) et sa pédagogie ; S3 —
Δ_contamination en classe B ; S4 — contamination à k = 3 restreinte aux
événements dans les 3 premiers picks du side (n attendu ≈ 79) ; S5 — table des
événements (champion, rôle réel, rôle prédit pour lui et ses voisins, équipe,
gameId). COUVERTURE : sides écartés par cause.

GARDE DE BRANCHEMENT F-c (gelée ici, conséquence exclusive de F2) : F-c ne se
branche QUE si F2 est VERTE. Mécanisme alors branché SANS nouveau paramètre :
pour le champion déclencheur SEUL, priors de rôle remplacés par l'uniforme
(β = 1 — le chemin classe B déjà testé du système), déclencheur live =
surpriseOf.bits ≥ surpriseAlarmBits = 5 (rangeModelConfig commitée ; ε = 1e-3
⇒ bits ≤ ~9,97) ET rôle-novelté structurelle (compte train équipe+ligue de
(c, rôle) = 0). Après branchement, RE-RUN OBLIGATOIRE de
scripts/backtest/roleInference.ts : non-régression exigée accuracy pooled
k=3 ≥ 94,5 %, sinon F-c débranché et le rouge documenté — le système VERT
pré-enregistré (95,0 %) prime sur toute défense nouvelle.

FUITES / FISHING : priors fold-only (walk-forward strict du harnais validé) ;
définitions structurelles, aucune issue lue ; confound déclaré : les sides à
événement diffèrent des sides sains (games plus tardives, métas plus
étranges) — non éliminable, ampleur attendue >> biais plausible ; UNE primaire,
secondaires étiquetées d'avance ; --audit-only n'imprime que des comptes ;
commit de l'en-tête avant le run.

RUN : node --experimental-transform-types --no-warnings
scripts/backtest/roleSurprise.ts static/corpus/lck-2026.json
static/corpus/lec-2026.json static/corpus/lfl-2026.json
static/corpus/lpl-2026.json data/corpus/lec-2025.json data/corpus/lfl-2025.json
data/corpus/lpl-2025.json [--seed 42] [--audit-only] [--generated-at ISO]
[--out docs/calibration/role-surprise-f2.md]
```

### 3.3 F3 — la politique de révélation : LECTURE de C, zéro run

F3 = lecture des S2/S3 publiés par le chantier C (`seriesRetention-g3.md`) —
AUCUN nouveau run, AUCUN nouveau verdict. Toute extension exigerait un nouvel
en-tête daté.

### 3.4 F4 — endgame solver : delta apparié, jamais gate isolée

Méthodologie de la gate A restreinte aux games de gameNumber ≥ 4 (comptes
mesurés : 125 G4 + 49 G5 = 174 games, ~125 clusters de série), bras
supplémentaire « exhaustif » vs le bras depth-2 de A sur les MÊMES tours :
delta de TD apparié par game, IC bootstrap clusterisé par série
(`clusterBootstrapDeltaCI`, 1000, seed 42). **MDE DÉCLARÉ ≈ ±8 pp — très
au-dessus de l'effet attendu (~2 pp) : l'issue « non concluant » est ASSUMÉE
d'avance** et publiée telle quelle ; VERT (lo > 0) débloquerait le claim
« recherche profonde validée » ; tout autre résultat ⇒ F-d ship Expérimental
(DA-V2-11) sur la seule garantie d'ingénierie (espace ≤ 10⁶, < 2 s), SAUF
hi < 0 (exhaustif PIRE) ⇒ F-d non branché, enquête (évaluateur bruité
sur-exploité par la profondeur). Aucun pooling post-hoc, aucune tranche
supplémentaire.

## 4. UI (français, apprenant)

Panneau « **Tes pockets** » : surprises en bits (étiquette **« surprise vs
données publiques »** — provenance modèle public ligue/équipe) + checklist
d'activation (tags cités) + GARDER/DÉPENSER en série (composants séparés) ;
côté adverse, le dark pool et l'alerte pick-préparé. **Badge Expérimental
(DA-V2-11) sur TOUT le panneau tant que F1 n'est pas VERTE, et sur l'alerte
pick-préparé tant que F2 n'est pas VERTE** ; composants toujours séparés
(DA-V2-12). Le cas **G2-Nasus (Skewmond)** sert de test unitaire (fixture
encodant les données CORRIGÉES : G2 = Nasus jungle, séquence KC-G2-KC-G2-G2 —
jamais le corpus tel-quel tant que le re-pull n'est pas fait) ET d'exemple
pédagogique dans « Comment lire ? ».

## 5. Dépendances et ordre

**Après C** : dépendance de CODE (`seriesKnapsack.ts` = étape 3 du plan C —
**livré en vague 2**, intégré) ET de VERDICT partiel : si G3-demande VERTE, le
GARDER/DÉPENSER affiche le prix γ·ΔS en composant séparé badgé Expérimental
(la composite n'est validée par AUCUNE métrique de C — C §1.2) avec
wantProbability mesurée ; **si G3-demande ROUGE, F-b ship SANS prix de série
chiffré** (composants revelationCost/baitLedger seuls, badgés) et le dit en
clair. F3 = lecture de C (§3.3). `revelationCost`/`baitLedger` exigent les
injections nommées en §2 F-b (`defaultOptionValue = 0` commité tant que I4
n'injecte pas). L'attribution par joueur (`enrichPlayers`) raffine F-a de
l'équipe au joueur — utile, non bloquant.

## 6. Plan pas-à-pas (chaque étape committable, repo vert)

1. **Préconditions §0** (BLOQUANT, commits séparés) : re-pull + validateur Bo
   + amendement architecte re-figeant les audits.
2. **Lib pure `src/lib/strategic/pocketEvents.ts`** : définitions
   structurelles F1/F2 (événement pocket P1-P3, classe contraste, classes
   A/B, one-side/both-sides) + tests à la main sur mini-corpus synthétique
   (seuils 0/≤2/≥20, flex jamais événement, déduplication).
3. **Runner `scripts/backtest/pocketPremium.ts`** : en-tête = règle F1
   verbatim, --audit-only sans WR, patron postdiction.
4. **Runner `scripts/backtest/roleSurprise.ts`** : en-tête = règle F2
   verbatim, restriction du harnais roleInference existant, --audit-only sans
   accuracy.
5. **Moteurs** : `publicSelfModel` (F-a, surface C retournée), `pocketAdvisor`
   (F-b, checklist depuis tags + injections I2 nommées + GARDER/DÉPENSER),
   `fearlessEndgame` (F-d, bornes §2, bascule navigator), UI « Tes pockets »
   (badges §4). F-c : code prêt mais DÉBRANCHÉ (garde F2).
6. **Commit « règles gelées » AVANT tout run.**
7. **LES runs** (architecte seul, un par gate, seed 42) : F1 puis F2 ;
   rapports publiés tels quels. F4 = bras du runner A sur G4-5 quand A est
   joué.
8. **Post-verdict conditionnel** : F-c (si F2 VERTE : branchement + re-run
   non-régression), panneau (si F1 VERTE : provenance chiffrée),
   STATUS/ETAT_DES_LIEUX/scorecard R9.

## 7. Ce que le verdict change

- **F1 VERT** ⇒ claim : « sur N games, le side qui sort un pick hors-radar
  gagne X % [IC], +Y pp vs nouveauté banale — corrélation, pas causalité » +
  ligne scorecard R9 ; panneau avec provenance chiffrée.
  **F1 ORANGE** ⇒ « jouer du neuf paie, le rare pas plus » publié, panneau
  sans claim de premium. **F1 ROUGE** ⇒ réservoir = outil de lecture badgé,
  aucun claim de valeur ; enquête pré-cadrée : (1) seuils trop larges (≤ 2
  capte du bruit de fin de pool) — nouvelle règle si re-tenté ; (2) le premium
  vit peut-être dans le FIT (surprise × cohérence) — chantier de mesure
  séparé, nouvel en-tête.
- **F2 VERTE** ⇒ F-c branché derrière la garde de non-régression ; l'alerte
  « pick préparé — lecture de rôles élargie » ship avec provenance (Δ, n,
  IC). **F2 ORANGE** ⇒ F-c reste débranché, l'alarme en bits existante reste
  le seul signal. **F2 ROUGE** ⇒ découverte publiée (« l'énumération jointe
  se défend déjà »), F-c abandonné et le récit corrigé.
- **F4** : VERT ⇒ « recherche profonde validée » ; non concluant (attendu) ⇒
  F-d ship Expérimental sur garantie d'ingénierie ; hi < 0 ⇒ F-d non branché.
