# F — Pocket picks : maîtrise et au-delà (Fearless d'abord)

> Directive d'Alain (2026-06-11, pendant la pause) : « Il faut que DraftLab
> maîtrise à la perfection, voire aille encore au-delà concernant cette
> notion très utile en Fearless. » Cas fondateur vérifié au corpus :
> **KC, finale LEC Spring 2026, game 5 — Nasus jungle seq 17, victoire.
> 1 seul Nasus sur les 1 219 games 2026 des 4 ligues.**
>
> Statut : DESIGN (la revue adversariale et le gel suivront à la reprise,
> même protocole que A-E). Priorité de reprise : haute, juste derrière la
> gate coach (A) — C en est le substrat.

## 1. La théorie — ce qu'est vraiment un pocket pick

Quatre mécanismes, tous reliés à des moteurs existants :

1. **Asymétrie de préparation.** Tout modèle adverse (le nôtre compris) est
   construit sur le VISIBLE. Le pocket est un (joueur, champion) à confort
   réel élevé et probabilité publique ≈ 0. La **réserve de surprise** d'une
   équipe = l'écart entre ce qu'elle sait d'elle-même et ce que les données
   publiques disent d'elle. Quantifiable : `bits = −log₂(P_modèlePublic(pick))`.
2. **Valeur de réserve Fearless.** En Bo5 hard-Fearless, la game 5 démarre
   avec ~50 champions morts. La valeur relative d'un pocket MONTE avec le
   numéro de game : (a) le modèle adverse de notre inventaire se croit
   complet — le pocket le casse ; (b) leur pool de RÉPONSES est épuisé — les
   counters du pick fragile-early ne sont plus disponibles. KC a dépensé son
   Nasus exactement au maximum de sa courbe de valeur.
3. **Tromperie de role-map.** Le pocket hors-rôle (Nasus JUNGLE) trompe
   l'inférence de rôles — la nôtre (95 % de précision) aurait lu « top » avec
   confiance. Les réponses adverses visent la mauvaise géométrie (Poppy
   anti-dash contre un juggernaut sans dash).
4. **Surprise × cohérence.** Sans le fit, c'est un coin flip cheese. Avec
   (Anivia setup + Alistar peel + **Senna double-scaling infini** + Kled
   strong-side autonome), c'est une finale. Le fit est VÉRIFIABLE par nos
   cellules (pairPrior, counterThreat) et le winConditionGraph.

## 2. La maîtrise — quatre moteurs

### F-a. `publicSelfModel` — notre propre modèle retourné sur nous
Appliquer NOTRE pipeline de tendances à NOUS-MÊMES (nos games visibles) :
ce que l'adversaire préparé voit. Le **réservoir de surprises** = pool réel
(confort déclaré/joué en interne) − modèle public. Sortie : par joueur/rôle,
les champions à surprise ≥ seuil de bits, triés par confort.

### F-b. `pocketAdvisor` — le conseiller offensif
Candidats = réservoir (F-a) ∩ `counterThreat > 0` vs leurs tendances ∩
`pairPrior` cohérent avec notre noyau ∩ viable au patch. Chaque candidat
sort avec sa **checklist d'activation** en français (« exige : un peel
support OU un setup mid ; un top autonome ; leur jungle early déjà
consommée ») — générée depuis les tags, jamais inventée. En série :
recommandation **GARDER / DÉPENSER** prix par la valeur de série (terme γ du
chantier C) + le **coût de révélation** (I2 `revelationCost`/`baitLedger`,
construits, jamais branchés — c'est ICI qu'ils se branchent).
**Économie d'apprentissage (spécifique Alain)** : classement final pondéré
par le coût de pratique — les pockets ADJACENTS à son pool (mêmes traits de
tags que ses mains) coûtent moins cher à apprendre ; l'outil le dit.

### F-c. `surpriseDefense` — le correctif du trou Nasus
Quand un pick adverse sort à haute surprise (l'alarme en bits de
`rangeModel` existe) : (1) **dégrader la confiance des priors de rôle sur CE
champion** (l'inférence repasse vers l'uniforme — fini le « 95 % top »
confiant et faux) ; (2) re-lire la compo adverse sous les hypothèses de rôle
élargies ; (3) avertir en français : « pick préparé — leur prep est profonde,
attendez un plan dédié autour de lui ». Estimation du **dark pool** adverse :
champions viables au patch − leur pool montré, pondérés par rôle.

### F-d. `fearlessEndgame` — L'AU-DELÀ : le solveur de fin de série
L'analogie des tablebases d'échecs, jamais publiée pour la draft : en G4/G5,
~50 champions morts + pools lisibles ⇒ l'espace de draft devient PETIT.
Quand ≤ N candidats plausibles restent par rôle, le navigator bascule de
l'heuristique profondeur 2 vers une **recherche exhaustive profonde** de la
fin de draft (l'espace le permet précisément quand l'enjeu est maximal —
la must-win). Personne ne fait ça. C'est le first-mover du hard-Fearless
poussé un cran plus loin que JueWuDraft.

## 3. Les gates pré-enregistrables (doctrine : aucun moteur sans métrique)

- **F1 — le premium du pocket, mesuré.** Sur les 2 661+ drafts, walk-forward :
  picks à masse de tendance ≈ 0 (modèle public de l'équipe) — ΔWR vs picks
  appariés, stratifié par numéro de game (1-3 vs 4-5) et Fearless on/off,
  IC bootstrap clusterisé par série. Hypothèse pré-enregistrée :
  premium(G4-5 Fearless) > premium(G1-3). Biais de sélection DÉCLARÉ (les
  équipes sortent le pocket quand les conditions s'y prêtent — corrélationnel,
  jamais causal).
- **F2 — la surprise casse les priors de rôle.** Sur les picks à haute
  surprise du corpus : précision de l'inférence de rôles (prédiction
  pré-enregistrée : très en dessous des 95 % globaux) → justifie F-c par la
  mesure. Exécutable dès maintenant sur le corpus.
- **F3 — la politique de révélation** : « les équipes qui retiennent leurs
  comforts/pockets pour les must-win gagnent-elles plus ces must-win ? » —
  PROLONGE S2/S3 du chantier C (même harnais, pas de doublon).
- **F4 — l'endgame solver** : sur les états G5 du corpus, la recherche
  profonde classe-t-elle les picks des vainqueurs mieux que la profondeur 2 ?
  (méthodologie de la gate A restreinte au sous-ensemble G5.)

## 4. UI (français, apprenant)

Panneau « **Tes pockets** » : le réservoir avec bits de surprise + checklist
d'activation + GARDER/DÉPENSER en série ; côté adverse, le dark pool et
l'alerte pick-préparé. Le cas KC-Nasus sert de test unitaire ET d'exemple
pédagogique dans « Comment lire ? ».

## 5. Dépendances et ordre

Après C (le terme de série est le substrat du GARDER/DÉPENSER) ; consomme
`clusterBootstrap` (fait), I2 (`revelationCost`/`baitLedger`, à brancher),
F2 exécutable immédiatement. L'attribution par joueur (`enrichPlayers`, en
attente du throttle Leaguepedia) raffine F-a de l'équipe au joueur — utile
mais non bloquant.
