# Scorecard corpus — Summit Gate (R9) — Patch 26.10

> Généré le 2026-06-10T21:02:11.514Z par le harnais de backtest (walk-forward par patch, IC bootstrap 95 %).

| Métrique | Valeur | Baseline | Δ (IC 95 %) | Verdict |
|---|---:|---:|---:|---|
| log loss — issue de partie (side-only vs p=0,5) | 0.6948 | 0.6931 | +0.0016 [-0.0025, +0.0059] | à égalité (non significatif) |
| Brier — issue de partie (side-only vs p=0,5) | 0.2508 | 0.25 | +0.0008 [-0.0009, +0.0027] | à égalité (non significatif) |
| accuracy — issue de partie (side-only vs p=0,5) | 0.5041 | 0.5 | +0.0041 [-0.0422, +0.0503] | à égalité (non significatif) |
| pick-in-range@8 — tendances (vs fréquence brute) | 0.287 | 0.2516 | +0.0353 [+0.0182, +0.0514] | bat la baseline |
| ban-hit@5 — bans du train (vs présence) | 2.3043 | 2.4918 | -0.1875 [-0.231, -0.1386] | sous la baseline |
| ban-hit@5 par side — banEV complet (vs présence) | 1.0408 | 1.2459 | -0.2052 [-0.2663, -0.1495] | sous la baseline |
| ban-hit@2 phase 2 — contre-compo (vs présence) | 0.0802 | 0.0109 | +0.0693 [+0.0503, +0.0897] | bat la baseline |

## Notes

- Corpus : 445 records, 443 avec patch exploitable (2 écartés sans patch plaçable), 7 patchs.
- Issue de partie : 368 prédictions sur 6 folds (443 games avec vainqueur) ; side-only = winrate blue du train.
- pick-in-range@8 : 3680 picks scorés sur 6 folds ; range = table de tendances de l’équipe (prior ligue = train complet), champions déjà révélés exclus ; équipe inconnue du train ⇒ miss honnête.
- ban-hit@5 : 368 games scorées (≥ 1 ban résolu) sur 6 folds ; valeur = bans retrouvés en moyenne par game (0..5).
- ban-hit@5 par side (banEV) : 736 événements (game × side bannissant) sur 6 folds ; cible = les 5 bans de CE side ; modèle = banEV (P de sortie via ranges de tendances de l'équipe adverse × dégât de remplacement + dommage structurel sur ses paires minées) sur les 30 candidats les plus présents du train ; pools joueurs non disponibles dans ce corpus (terme neutre).
- ban-hit@2 phase 2 (contre-compo) : 736 événements (game × side avec ≥ 1 ban de phase 2) ; régime composition (draft science §E) : menace = cellules de counter par traits fittées sur le train (tagPairs), cible = les 2 bans de phase 2 de CE side.
- Reproductibilité : seed 42, 1000 resamples bootstrap, ordre des IC fixe (log loss, Brier, accuracy, pick, ban, banEV-side, banEV-phase2).
- side-only est lui-même une baseline (verdict M3.5) : il borne ce que tout modèle de draft doit dépasser avant de revendiquer un signal.

## Légende

- **bat la baseline** : l'IC bootstrap 95 % du delta exclut zéro en faveur du modèle.
- **à égalité (non significatif)** : l'IC traverse zéro — aucune différence défendable à cette taille d'échantillon.
- **sous la baseline** : l'IC exclut zéro en défaveur du modèle.
- Honnêteté : cibles fixées après première mesure — aucune cible chiffrée n'est inventée avant d'avoir les baselines (R9).
