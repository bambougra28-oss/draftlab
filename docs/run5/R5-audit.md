# Run #5 — Audit data-first (Oracle's Elixir 2026) : le draft prédit-il le pro ?

> EXPLORATOIRE, PAS une gate gelée. C'est la lecture d'architecte AVANT de
> concevoir quoi que ce soit — la donnée doit décider de la run. Reproductible :
> `scripts/backtest/r5Audit.ts` (données locales gitignorées,
> `data/oracle/2026_oe.csv`, attribution oracleselixir.com).

## La donnée (acquise et validée)

Oracle's Elixir 2026, ingéré par le provider existant `parseOraclesElixirCsv` :
**5 857 games, 0 skipped, 98,8 % éligibles (5 789), 0 champion non résolu**,
11 patches (16.01→16.11, 08-01 → 15-06 2026), ~37 ligues. Qualité parfaite
(bien au-dessus du scrape Leaguepedia qui avait le bug d'inversion de run #2).
Les `DraftRecord` produits alimentent directement toute la machinerie de gate
(`isCalibrationEligible`, `roleTeamsAt`, l'analyseur).

## La question et la méthode

À quel point le **contenu du draft** prédit-il le vainqueur en pro ? On mesure
l'**AUC** de chaque feature candidate contre l'issue binaire (blue gagne), sur
toutes les ligues et sur le Tier-1 (LCK/LPL/LEC/LCS/EWC). AUC 0,5 = hasard.

## Résultats (AUC vs blue-win)

| Feature | ALL (n=5 789) | TIER-1 (n=1 385) |
|---|---|---|
| **SoloQ évaluateur (winrate)** | 0,5425 | 0,5390 |
| SoloQ champion-diff | 0,5164 | 0,5406 |
| SoloQ matchup-diff (counter) | 0,5299 | 0,5045 |
| SoloQ duo-diff (synergie) | 0,5280 | 0,5363 |
| archétype Δ siege/split/pick/protect/engage | 0,485 – 0,516 | 0,482 – 0,522 |
| **archétype matchup matrix (ceiling IN-SAMPLE)** | **0,5351** | **0,5385** |
| *(baseline)* **side blue (WR)** | **52,9 %** | **53,4 %** |

## Le constat (robuste)

**Au niveau pro, le contenu du draft ne prédit le vainqueur que marginalement —
plafond AUC ≈ 0,52-0,54 sur TOUTES les features essayées**, y compris la matrice
de matchup d'archétypes ajustée IN-SAMPLE (un plafond optimiste, qui sur-ajuste,
et reste à ~0,535). Le **side** (blue 52,9 %) pèse plus que n'importe quelle
feature de contenu de draft.

Ce n'est pas que les features sont mauvaises : c'est que **les pros draftent
bien et symétriquement** — l'avantage résiduel de draft au niveau win/loss est
petit, et l'exécution décide des games serrées. Un évaluateur de draft optimal
combinant ces features plafonnerait vers ~0,55 AUC (réel mais petit ; un bon
modèle sportif fait 0,6-0,7).

## Ce que ça implique pour run #5

Geler une gate « prédire le vainqueur depuis le draft » reviendrait à **dépenser
une pré-enregistration pour confirmer un plafond que l'audit révèle déjà**.
Honnête mais à faible valeur.

La vraie question devient : **le draft prédit-il l'ÉTAT DE JEU** (tempo, courbe
d'or, contrôle d'objectif, durée) — là où vit la valeur de prep *déjà validée*
(arbres de prep VERTS, power curves) — **mieux qu'il ne prédit le win/loss ?**

## L'état de jeu : testé aussi (features propres, tags `scalingWindow` 100 %)

| Cible | Predicteur (draft) | Signal |
|---|---|---|
| durée de game | scaling tilt (late−early champs) | **r = −0,003** (nul) |
| blue en avance @15 | edge early-game blue (tags) | AUC 0,536 |
| gold diff @15 | edge early-game blue | r = 0,092 (petit) |

**Le draft prédit l'état de jeu aussi faiblement que le win/loss** (~0,54 AUC,
r ≈ 0,09 ; la durée n'est PAS prédite — les pros ferment les games sur leads,
indépendamment du scaling). Les DEUX cibles ont un plafond bas.

Caveat honnête : un modèle multi-feature ajusté pourrait monter à ~0,55-0,57 ;
les features joueur/confort (les `playerid` sont dans OE) et flex/information ne
sont pas testées (probablement 2ᵉ ordre). Mais aucun signal ne suggère un
prédicteur fort (0,65+). Le plafond est réel.

## Conclusion de l'audit

**Sur la meilleure donnée mondiale, le contenu du draft explique très peu de
l'issue ET de l'état de jeu en pro (~0,54 AUC).** Ce n'est pas un échec de
méthode ni de data — c'est un fait : **au plus haut niveau, tout le monde drafte
bien, donc l'avantage de contenu de draft est petit ; la variance est dans
l'exécution.** La « prédiction du vainqueur depuis le draft » est un mirage —
les 5 runs l'ont prouvé rigoureusement, et l'OE 2026 le confirme à l'échelle.

**Où vit donc la valeur du draft au top niveau ?** Pas dans un score qui prédit
le gagnant, mais dans la **PRÉPARATION** : connaître l'adversaire, avoir des
plans à branches, gagner le jeu d'information (flex/contre-pick), dénier le
confort, éviter les pièges. C'est EXACTEMENT ce que DraftLab valide et ship déjà
(arbres de prep VERTS, défense anti-surprise, ranges, bans contre-compo,
inférence de rôles 95,3 %). **L'audit confirme que les forces validées de
DraftLab SONT la vraie valeur — et que l'oracle de win% était un mirage,
honnêtement écarté plutôt que bluffé.**

## Décision produit (carrefour, à Alain)

1. **Tenter quand même un modèle multi-feature pro** (joueur/flex inclus) pour
   gratter le plafond 0,54→~0,57, gate gelée — faible valeur attendue, mais
   chiffrable proprement.
2. **Acter le plafond** : assumer le produit de prep validé comme LE niveau ;
   réinvestir l'effort dans la prep (annoter, étendre les arbres, le war-room),
   pas dans un oracle qui n'existe pas. *(Recommandé par l'audit.)*

*Audit du 2026-06-16. Données lues avant toute conception, jamais supposées.*
