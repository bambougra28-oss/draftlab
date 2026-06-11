# Scorecard corpus — Summit Gate (R9) — Patch 26.11

> Généré le 2026-06-10T19:33:00.590Z par le harnais de backtest (walk-forward par patch, IC bootstrap 95 %).

| Métrique | Valeur | Baseline | Δ (IC 95 %) | Verdict |
|---|---:|---:|---:|---|
| log loss — issue de partie (side-only vs p=0,5) | 0.6841 | 0.6931 | -0.0091 [-0.0205, +0.003] | à égalité (non significatif) |
| Brier — issue de partie (side-only vs p=0,5) | 0.2455 | 0.25 | -0.0045 [-0.0101, +0.0012] | à égalité (non significatif) |
| accuracy — issue de partie (side-only vs p=0,5) | 0.5839 | 0.5 | +0.0839 [+0.028, +0.1399] | bat la baseline |
| pick-in-range@8 — tendances (vs fréquence brute) | 0.314 | 0.2682 | +0.0458 [+0.0262, +0.0647] | bat la baseline |
| ban-hit@5 — bans du train (vs présence) | 2.6119 | 2.6014 | +0.0105 [-0.0629, +0.0734] | à égalité (non significatif) |
| ban-hit@5 par side — banEV complet (vs présence) | 0.8811 | 1.3007 | -0.4196 [-0.5035, -0.3391] | sous la baseline |
| ban-hit@2 phase 2 — contre-compo (vs présence) | 0.042 | 0.0157 | +0.0262 [+0.007, +0.0455] | bat la baseline |

## Notes

- Corpus : 337 records, 337 avec patch exploitable (0 écartés sans patch plaçable), 9 patchs.
- Issue de partie : 286 prédictions sur 8 folds (337 games avec vainqueur) ; side-only = winrate blue du train.
- pick-in-range@8 : 2860 picks scorés sur 8 folds ; range = table de tendances de l’équipe (prior ligue = train complet), champions déjà révélés exclus ; équipe inconnue du train ⇒ miss honnête.
- ban-hit@5 : 286 games scorées (≥ 1 ban résolu) sur 8 folds ; valeur = bans retrouvés en moyenne par game (0..5).
- ban-hit@5 par side (banEV) : 572 événements (game × side bannissant) sur 8 folds ; cible = les 5 bans de CE side ; modèle = banEV (P de sortie via ranges de tendances de l'équipe adverse × dégât de remplacement + dommage structurel sur ses paires minées) sur les 30 candidats les plus présents du train ; pools joueurs non disponibles dans ce corpus (terme neutre).
- ban-hit@2 phase 2 (contre-compo) : 572 événements (game × side avec ≥ 1 ban de phase 2) ; régime composition (draft science §E) : menace = cellules de counter par traits fittées sur le train (tagPairs), cible = les 2 bans de phase 2 de CE side.
- Reproductibilité : seed 42, 1000 resamples bootstrap, ordre des IC fixe (log loss, Brier, accuracy, pick, ban, banEV-side, banEV-phase2).
- side-only est lui-même une baseline (verdict M3.5) : il borne ce que tout modèle de draft doit dépasser avant de revendiquer un signal.

## Légende

- **bat la baseline** : l'IC bootstrap 95 % du delta exclut zéro en faveur du modèle.
- **à égalité (non significatif)** : l'IC traverse zéro — aucune différence défendable à cette taille d'échantillon.
- **sous la baseline** : l'IC exclut zéro en défaveur du modèle.
- Honnêteté : cibles fixées après première mesure — aucune cible chiffrée n'est inventée avant d'avoir les baselines (R9).
