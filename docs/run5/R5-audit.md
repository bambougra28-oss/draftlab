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

## Honnêteté — ce qui reste OUVERT (non conclu)

- **L'angle état-de-jeu n'est PAS encore testé proprement.** Un test rapide a
  cassé (le `calculatePowerCurve` a renvoyé NaN — plomberie/dataset à régler ;
  proxy de scaling trop grossier). Le SoloQ→gold@15 propre, lui, donnait AUC
  0,508 / r≈0 : l'évaluateur win-prob ne porte aucun signal d'état précoce
  (attendu — c'est un modèle de win-prob full-game, pas d'early-state).
- **Features non testées** : joueur/confort (pools A3, les playerid sont dans
  OE), flex/information, méta par patch. Probablement de 2ᵉ ordre, mais non
  écartées.
- L'angle état-de-jeu demande de **vraies features d'état** (régler la power
  curve, un axe scaling propre) — c'est un chantier, pas un hack.

## Le carrefour (décision produit)

1. **Réorienter run #5 vers la prédiction d'ÉTAT DE JEU** : le draft prédit-il
   gold@15 / objectifs / durée ? Si oui, c'est la fonction de valeur ancrée pro
   qu'on cherchait (et elle nourrit la prep, le levier validé). Demande de
   construire/valider les features d'état d'abord.
2. **Acter le plafond win/loss** : le draft→vainqueur est intrinsèquement faible
   en pro ; le produit de **prep validé** (arbres, role inference, surprise,
   ranges, bans contre-compo) EST le bon niveau, et on l'assume sans illusion
   d'oracle.

*Audit du 2026-06-16. Données lues avant toute conception, jamais supposées.*
