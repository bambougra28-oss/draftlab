# Scorecard corpus — Summit Gate (R9) — Patch 26.10

> Généré le 2026-06-10T21:02:11.514Z par le harnais de backtest (walk-forward par patch, IC bootstrap 95 %).

| Métrique | Valeur | Baseline | Δ (IC 95 %) | Verdict |
|---|---:|---:|---:|---|
| log loss — issue de partie (side-only vs p=0,5) | 0.6997 | 0.6931 | +0.0066 [+0.001, +0.0122] | sous la baseline |
| Brier — issue de partie (side-only vs p=0,5) | 0.2533 | 0.25 | +0.0033 [+0.0008, +0.0062] | sous la baseline |
| accuracy — issue de partie (side-only vs p=0,5) | 0.4511 | 0.5 | -0.0489 [-0.0978, +0.0027] | à égalité (non significatif) |
| pick-in-range@8 — tendances (vs fréquence brute) | 0.2927 | 0.2516 | +0.041 [+0.0245, +0.0576] | bat la baseline |
| ban-hit@5 — bans du train (vs présence) | 2.3043 | 2.4918 | -0.1875 [-0.231, -0.1386] | sous la baseline |
| ban-hit@5 par side — banEV complet (vs présence) | 0.9144 | 1.2459 | -0.3315 [-0.3995, -0.2622] | sous la baseline |
| ban-hit@2 phase 2 — contre-compo (vs présence) | 0.0788 | 0.0109 | +0.0679 [+0.0476, +0.0883] | bat la baseline |

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
