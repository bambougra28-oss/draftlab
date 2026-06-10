# DraftLab — Guide utilisateur (coach / analyste)

> Constructeur stratégique de drafts pour staffs externes (coach freelance,
> analyste, ERL) sur données publiques. **Local-first** : vos plans, séries et
> tags restent dans votre navigateur (IndexedDB / localStorage) — aucun
> compte, aucun cloud, rien ne quitte votre machine.
>
> Honnêteté d'abord (à lire avant tout) : la draft pèse **≈ 7,5 % de l'issue
> d'un match pro**. DraftLab informe des décisions marginales — il ne gagne
> pas des matchs, il évite d'en perdre sur des détails préparables. Tout
> chiffre affiché dit d'où il vient ; tout moteur non validé porte un badge
> « Expérimental » ou « Non calibré ».

## Sommaire

1. [Démarrage](#démarrage)
2. [Les vues](#les-vues)
3. [La semaine type : lundi → vendredi → jour de match](#la-semaine-type)
4. [La sync gol.gg](#la-sync-golgg)
5. [Le confort (tags joueurs)](#le-confort)
6. [Fearless et First Selection](#fearless-et-first-selection)
7. [Les moteurs d'analyse et leur statut](#les-moteurs-danalyse-et-leur-statut)
8. [Backtest et scorecards](#backtest-et-scorecards)
9. [Limites honnêtes](#limites-honnêtes)

## Démarrage

```bash
pnpm install
pnpm dev          # serveur local sur :5173
```

Au premier chargement, l'application télécharge ~50 Mo de dataset de
winrates (CDN public DraftGap), puis le met en cache 24 h. Les icônes de
champions viennent de Data Dragon (Riot), avec un repli hors-ligne en
initiales. Aucune configuration n'est requise pour commencer : ouvrez `/`,
choisissez une ligue, synchronisez deux équipes.

## Les vues

| Route | Nom | Mode | Ce qu'on y fait |
|---|---|---|---|
| `/` | Draft | Prep | Scout d'équipes (gol.gg) + analyseur bayésien : slots par rôle, contexte joueur (pool, confort), side, win % estimé, pool tiers. |
| `/prototype` | Stratégie | Prep | Lecture stratégique d'une draft : plans de jeu (5 archétypes), power curves early/mid/late, marqueurs de risque, lecture adverse pick par pick. |
| `/plans`, `/plans/[id]` | Plans | Prep | Constructeur de plans A/B/C : 5 bans + 5 picks (principal + fallback + justification), liés aux games d'une série. |
| `/series`, `/series/[id]` | Séries | Prep | Séries Bo1/Bo3/Bo5 : saisie game par game, First Selection (règle 2026), suivi de consommation Fearless, application des plans. |
| `/live` | Live | Match | Vue jour de match épurée, en lecture seule : score, game en cours, picks/bans, champions verrouillés. À ouvrir sur un second écran. |
| `/help` | Aide | — | Guide rapide intégré : routes, workflow, légende des badges, sources de données. |
| `/review` | Revue | Prep | Revue annotée façon moteur d'échecs : chaque décision d'une game (série sauvegardée ou draft d'exemple) graduée en points de win % (?! / ? / ??), « mieux était X », rapport de fuites. Badge « Expérimental ». |
| `/api/golgg` | (technique) | — | Proxy same-origin vers gol.gg utilisé par la sync : HTTPS uniquement, hôte `gol.gg` strict, 1 requête/s, GET seul. Vous ne l'appelez jamais à la main. |

## La semaine type

Le workflow ci-dessous suppose un match le samedi ; décalez selon votre
calendrier. Chaque étape est cliquable de bout en bout dans l'UI actuelle.

### Lundi — scout

1. Sur `/`, choisissez la ligue, synchronisez **votre équipe (A)** puis
   **l'adversaire (B)**. La première sync prend quelques secondes par équipe
   (scraping poli à 1 req/s — voir [La sync gol.gg](#la-sync-golgg)).
2. Activez « Appliquer le contexte équipe » : les pools joueurs, les sides et
   les drafts récentes alimentent désormais l'analyseur.
3. Vérifiez les tags de confort pré-remplis sur les slots alliés et corrigez
   au clic ce que vous savez mieux que les données (voir [Le confort](#le-confort)).

### Mardi — tendances et premières hypothèses

1. Rejouez les drafts récentes de l'adversaire depuis la barre latérale de
   `/` (un clic remplit les slots et le side).
2. Notez ce qui revient : le **panneau de tendances** de `/` montre, par
   rotation (P1, P2-3, B1-B3…) et par side, ce que l'équipe joue — avec les
   comptes bruts du type « 4 des 6 dernières », jamais des probabilités
   opaques — et le **panneau de ranges** la distribution du prochain pick
   adverse, composantes séparées (tendance / pool / méta / cohérence /
   information négative).
3. Esquissez 2-3 compositions candidates pour vous.

### Mercredi — stratégie

1. Passez vos compositions candidates sur `/prototype` : plan de jeu
   (Siege/Split/Pick/Protect/Engage), fenêtre de puissance, marqueurs de
   risque (front line, homogénéité de dégâts, désavantage de side…).
2. Confrontez votre plan au leur : la lecture adverse pick par pick montre
   comment leur plan converge pendant une draft.
3. Le **panneau de win conditions** (sur `/` et `/prototype`) montre les
   8 axes de conflit en barres signées, la collision de plans (la « vue
   27 secondes » : récit + déclencheurs observables) et des énoncés
   falsifiables — statut « Expérimental » tant que sa porte de validation
   n'est pas passée : lisez-le comme une checklist d'hypothèses à vérifier
   en VOD, pas comme une vérité.

### Jeudi — plans A/B/C et bans

1. Sur `/plans`, créez vos plans (nommage libre : « Plan A vs KC »,
   « Anti-Engage G3 »…) : 5 bans, 5 picks principaux + fallbacks,
   justification par pick.
2. Cochez les games visés (G1…G5) pour les retrouver dans l'éditeur de série.
3. Hiérarchisez vos bans : la suggestion de bans croise présence adverse,
   menace sur votre plan et pondération Fearless par numéro de game.

### Vendredi — série, Fearless, impression

1. Sur `/series`, créez la série (Bo3/Bo5, mode Fearless, noms des équipes).
2. Renseignez la **First Selection de chaque game** dès que vous la
   connaissez (voir [Fearless et First Selection](#fearless-et-first-selection)).
3. Appliquez vos plans aux games correspondants.
4. Sur `/series/[id]`, le **war room** projette l'intégrité des pools des
   deux équipes et la table « dépenser vs garder » (maintenant / option
   future / net / déni — composantes séparées, déni « non chiffré » quand le
   modèle manque).
5. Exportez/imprimez votre prep pack depuis la barre d'export de `/`
   (markdown A4 : plans, pages de bans, grilles de pool, tendances, ranges,
   win conditions) — les staffs n'ont pas d'appareils sur scène, le papier
   est l'artefact final.

### Jour de match

1. Ouvrez `/live` sur un second écran : score, game en cours, picks/bans,
   compteur de champions verrouillés — lecture seule, zéro distraction.
2. Entre les games (la fenêtre critique de 45-90 s en Fearless) : saisissez
   le résultat et les picks dans l'éditeur de série — le tracker de
   consommation verrouille automatiquement les champions consommés dans tous
   les sélecteurs — puis relisez le war room (intégrité projetée, dépenser vs
   garder) et téléchargez la **feuille de re-plan** (une page) depuis la
   barre d'export de la série.

### Lendemain — revue

Sur `/review`, choisissez la game (série sauvegardée ou draft d'exemple) et
le side à noter : chaque décision est graduée façon moteur d'échecs
(« R3 Azir ?! −1,8 pp — meilleure était Rell »), les choix quasi équivalents
ne sont pas harcelés (pas de note, chiffres conservés), et le rapport de
fuites agrège les motifs récurrents à travers les games. Règle maison :
tournez-la d'abord sur **vos propres drafts** — vos fuites intéressent
l'adversaire autant que les siennes vous intéressent. Badge « Expérimental » :
l'oracle est le navigator non calibré, lisez les pp comme des ordres de
grandeur.

## La sync gol.gg

- La sync passe par le proxy local `/api/golgg` : scraping **poli**
  (1 requête par seconde, cache 24 h), uniquement vers `gol.gg` en HTTPS.
  Une équipe = rosters, pools par joueur, répartition de sides, drafts
  récentes — comptez quelques secondes, c'est normal.
- « Données partielles » signale qu'un sous-fetch a échoué : l'application
  affiche ce qu'elle a et le dit — elle ne masque jamais un trou de données.
- gol.gg bloque les IP de datacenters : la sync fonctionne depuis votre
  machine (`pnpm dev` / `pnpm preview`), pas depuis un déploiement cloud.
- Les badges de provenance (source, saison, taille d'échantillon) suivent
  chaque chiffre scrappé. Un pool sur 3 games n'a pas le poids d'un pool sur
  40 — le badge vous le rappelle.

## Le confort

Les **tags de confort** qualifient la relation d'un joueur à un champion sur
les slots alliés :

| Tag | Défaut (pool gol.gg) | Effet |
|---|---|---|
| Comfort | ≥ 5 games | Le prior bayésien du moteur est renforcé. |
| Cheese | 1–4 games | Signal « surprise possible, fiabilité non prouvée ». |
| Indispo | 0 game | Le champion est traité comme hors-pool pour ce joueur. |

- Les défauts sont pré-remplis depuis le pool scrappé, puis **modifiables au
  clic** — vous savez des scrims ce que les données publiques ignorent.
- Vos corrections sont persistées localement et survivent aux re-syncs.
- Les tags ne pèsent sur le win % estimé que si « Appliquer le contexte
  équipe » est actif ; sans contexte, le moteur retombe sur le signal SoloQ
  pur.

## Fearless et First Selection

**Fearless** : un champion **pické** (par l'une ou l'autre équipe) est
verrouillé pour le reste de la série ; les bans, eux, se rejouent à chaque
game. DraftLab suit la règle automatiquement : tracker de consommation par
side, sélecteurs grisés, compteur sur `/live`. En Bo5 Fearless, 50 champions
picks sont consommés sur la série — la profondeur de pool devient une
ressource à budgéter, pas un acquis.

**First Selection (règle 2026)** : l'équipe qui détient la FS choisit *soit*
son side, *soit* le first pick — **side bleu ≠ first pick** désormais.
Renseignez la FS par game dans l'éditeur de série : l'ordre des actions et
les lectures par rotation en dépendent. Les sources qui n'exposent pas
l'ordre réel sont marquées (`assumed-blue-first`) et recoupées quand c'est
possible.

Pour l'arbitrage série (dépenser un champion maintenant vs le garder pour la
game 5, prix du déni hard-fearless, stratégie de must-win), voir le solveur
de série dans la table des moteurs ci-dessous.

## Les moteurs d'analyse et leur statut

Règle produit (DA-V2-11) : **un moteur sans métrique de validation ne ship
pas en silence** — tout affichage issu d'un moteur non calibré porte un badge
« Expérimental » ou « Non calibré » jusqu'à sa porte de validation (G1…G6).
Règle d'affichage (DA-V2-12) : les valuations multi-composantes sont montrées
**en composantes séparées**, jamais fusionnées en un score unique — c'est le
coach qui arbitre.

| Moteur | Ce qu'il donne | Statut honnête |
|---|---|---|
| Analyseur bayésien (M1/M2) | Win % estimé d'une draft, contexte joueur/side | **Calibré M3.5** (walk-forward N=320) — avec son verdict : voir [Limites honnêtes](#limites-honnêtes). |
| Plans de jeu, pool tiers, marqueurs de risque, lecture adverse | Les panneaux de `/` et `/prototype` | Reconstruits, **non calibrés** — recalibrage au harnais (porte G1). |
| Tendances et rotations | « 4 des 6 dernières » par slot/side, profils de rotation — panneau sur `/` | Livré et testé ; **non calibré** (porte G2). Les comptes bruts affichés sont, eux, des faits. |
| Range model (I1) | Distribution du prochain pick adverse (tendance × pool × méta × cohérence × information négative), alarme de surprise — panneau sur `/` | Livré ; **non calibré** (porte G2) ; composantes affichées séparément, candidats trop proches rendus neutres. |
| Ban EV | Espérance de valeur d'un ban (probabilité de pick × dommage structurel) | Livré côté lib ; **non calibré** (porte G2). |
| Win-Condition Graph (I3) | 8 axes de conflit, collision de plans (« vue 27 s »), énoncés falsifiables — panneaux sur `/` et `/prototype` | Livré ; **expérimental / non calibré** (postdiction au harnais à venir). |
| War room série (I4 : solveur + navigator) | Intégrité de pool projetée, valeur de série + arbitrage First Selection, dépenser vs garder, prix du déni, must-win — panneau sur `/series/[id]` | Livré ; **expérimental** (porte G3). |
| Fog & reveal (I2) | Hypothèses d'assignation de rôles, valeur de brouillard, coût de révélation, registre de baits | Livré côté lib ; **expérimental** (porte G4) — chaque sortie porte le flag. |
| Revue annotée (I5) | Notes ?!/?/?? en points de win %, « mieux était X », rapport de fuites — route `/review` | Livré ; **expérimental** (porte G5 : l'oracle est le navigator non calibré). |
| Patch Oracle (I6) | Courbes de réponse aux buffs estimées sur l'historique, watchlist du patch, consigne d'inflation d'incertitude des priors | Livré côté lib ; **expérimental** (porte G6). La saisie des changements de patch est structurée (champion/type/ampleur) — le parsing automatique des patch notes Riot est un travail futur. |
| Exports (prep pack, re-plan, CSV) | Markdown A4 imprimable, feuille de re-plan entre les games, CSV tendances/pools — barres d'export sur `/` et `/series/[id]` | Livré ; imprime le badge « non calibré » sur les sections concernées. |

Les moteurs « livré côté lib » (ban EV, fog & reveal, patch oracle) sont déjà
testés (suite Vitest complète) ; leur exposition UI suit la roadmap R4-R8.

## Backtest et scorecards

La crédibilité de l'outil se mesure, publiquement :

```bash
pnpm backtest -- mon-corpus.json --seed 42 --patch 26.10
```

produit `docs/calibration/scorecard-<patch>.md` : chaque métrique
(pick-in-range@8, ban-hit@5, log loss/Brier de l'issue de partie) y est
publiée **à côté de sa baseline naïve** avec l'IC bootstrap du delta —
walk-forward par patch, jamais d'entraînement sur le futur. Protocole
complet : `docs/calibration/README.md`. Les cibles chiffrées sont fixées
*après* la première mesure, pas inventées avant.

## Limites honnêtes

- **La draft pèse ≈ 7,5 % de l'issue d'un match.** L'outil aide à ne pas
  perdre bêtement des points de pourcentage préparables ; il ne remplace ni
  les scrims, ni la forme du jour, ni l'exécution.
- **Le verdict M3.5 (side-only)** : sur corpus pro, le simple side (blue/red)
  est une baseline redoutable — les features de draft SoloQ n'ont battu le
  side seul qu'à la marge. Conséquence produit : le win % estimé est un
  **garde-fou contre les grosses erreurs**, pas un oracle. Toute affirmation
  de progrès doit battre side-only au scorecard, IC à l'appui.
- **Les matchups coordonnés pro divergent du SoloQ** : duos botlane,
  prio jungle/mid, plans à 5 — le dataset SoloQ ne les voit pas. Le contexte
  équipe (pools, confort, tendances) existe précisément pour combler une
  partie de cet écart.
- **Échantillons faibles partout** : 8-20 games par équipe et par patch, pas
  des milliers. D'où les comptes bruts affichés (« 4 des 6 dernières »), les
  intervalles, et les badges d'échantillon. Méfiez-vous de toute lecture qui
  ne survivrait pas à un « sur combien de games ? ».
- **Sources fragiles** : gol.gg peut bloquer ou changer son HTML ; les
  données publiques arrivent avec du retard et des trous. L'application
  préfère afficher « Données partielles » que des chiffres inventés.
- **Moteurs non calibrés** : tant qu'une porte de validation (G1…G6) n'est
  pas passée, le badge reste, et les sorties se lisent comme des hypothèses
  structurées à vérifier — c'est déjà beaucoup, ce n'est pas une prédiction.
