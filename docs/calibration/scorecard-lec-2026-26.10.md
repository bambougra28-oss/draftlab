# Scorecard corpus — Summit Gate (R9) — Patch 26.10

> Généré le 2026-06-10T19:33:01.965Z par le harnais de backtest (walk-forward par patch, IC bootstrap 95 %).

| Métrique | Valeur | Baseline | Δ (IC 95 %) | Verdict |
|---|---:|---:|---:|---|
| log loss — issue de partie (side-only vs p=0,5) | 0.708 | 0.6931 | +0.0148 [-0.0048, +0.0371] | à égalité (non significatif) |
| Brier — issue de partie (side-only vs p=0,5) | 0.2572 | 0.25 | +0.0072 [-0.003, +0.0174] | à égalité (non significatif) |
| accuracy — issue de partie (side-only vs p=0,5) | 0.4912 | 0.5 | -0.0088 [-0.0789, +0.0526] | à égalité (non significatif) |
| pick-in-range@8 — tendances (vs fréquence brute) | 0.3522 | 0.2895 | +0.0627 [+0.0425, +0.0834] | bat la baseline |
| ban-hit@5 — bans du train (vs présence) | 2.5877 | 2.4079 | +0.1798 [+0.0921, +0.2719] | bat la baseline |
| ban-hit@5 par side — banEV complet (vs présence) | 0.989 | 1.2039 | -0.2149 [-0.2982, -0.1382] | sous la baseline |
| ban-hit@2 phase 2 — contre-compo (vs présence) | 0.0811 | 0.0329 | +0.0482 [+0.0197, +0.0768] | bat la baseline |

## Notes

- Corpus : 246 records, 246 avec patch exploitable (0 écartés sans patch plaçable), 8 patchs.
- Issue de partie : 228 prédictions sur 7 folds (246 games avec vainqueur) ; side-only = winrate blue du train.
- pick-in-range@8 : 2280 picks scorés sur 7 folds ; range = table de tendances de l’équipe (prior ligue = train complet), champions déjà révélés exclus ; équipe inconnue du train ⇒ miss honnête.
- ban-hit@5 : 228 games scorées (≥ 1 ban résolu) sur 7 folds ; valeur = bans retrouvés en moyenne par game (0..5).
- ban-hit@5 par side (banEV) : 456 événements (game × side bannissant) sur 7 folds ; cible = les 5 bans de CE side ; modèle = banEV (P de sortie via ranges de tendances de l'équipe adverse × dégât de remplacement + dommage structurel sur ses paires minées) sur les 30 candidats les plus présents du train ; pools joueurs non disponibles dans ce corpus (terme neutre).
- ban-hit@2 phase 2 (contre-compo) : 456 événements (game × side avec ≥ 1 ban de phase 2) ; régime composition (draft science §E) : menace = cellules de counter par traits fittées sur le train (tagPairs), cible = les 2 bans de phase 2 de CE side.
- Reproductibilité : seed 42, 1000 resamples bootstrap, ordre des IC fixe (log loss, Brier, accuracy, pick, ban, banEV-side, banEV-phase2).
- side-only est lui-même une baseline (verdict M3.5) : il borne ce que tout modèle de draft doit dépasser avant de revendiquer un signal.

## Légende

- **bat la baseline** : l'IC bootstrap 95 % du delta exclut zéro en faveur du modèle.
- **à égalité (non significatif)** : l'IC traverse zéro — aucune différence défendable à cette taille d'échantillon.
- **sous la baseline** : l'IC exclut zéro en défaveur du modèle.
- Honnêteté : cibles fixées après première mesure — aucune cible chiffrée n'est inventée avant d'avoir les baselines (R9).
