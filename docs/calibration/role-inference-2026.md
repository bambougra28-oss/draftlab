# Validation — inférence des rôles adverses (I2 + priors corpus)

> Généré : 2026-06-10T21:47:19.472Z · règle pré-enregistrée dans `scripts/backtest/roleInference.ts`
> (walk-forward par patch, priors ligue, top-hypothèse jointe vs argmax indépendant vs 20 % aléatoire).

## k = 3 picks révélés

| Tranche | n champions | Accuracy | Wilson 95 % |
|---|---|---|---|
| TOUS — top-hypothèse jointe | 14604 | 95.0 % | [94.7 ; 95.4] % |
| TOUS — argmax indépendant (baseline) | 14604 | 94.4 % | [94.0 ; 94.8] % |
| TOUS — assignation aléatoire (baseline) | — | 20.0 % | — |
| lck-2026.json — top-hypothèse | 1716 | 97.6 % | [96.7 ; 98.2] % |
| lec-2026.json — top-hypothèse | 1368 | 94.3 % | [92.9 ; 95.4] % |
| lfl-2026.json — top-hypothèse | 1074 | 94.0 % | [92.5 ; 95.3] % |
| lpl-2026.json — top-hypothèse | 2208 | 96.8 % | [96.0 ; 97.5] % |
| lec-2025.json — top-hypothèse | 1758 | 92.2 % | [90.9 ; 93.4] % |
| lfl-2025.json — top-hypothèse | 1836 | 90.4 % | [89.0 ; 91.7] % |
| lpl-2025.json — top-hypothèse | 4644 | 96.6 % | [96.0 ; 97.1] % |

## k = 5 picks révélés

| Tranche | n champions | Accuracy | Wilson 95 % |
|---|---|---|---|
| TOUS — top-hypothèse jointe | 24340 | 93.4 % | [93.0 ; 93.7] % |
| TOUS — argmax indépendant (baseline) | 24340 | 92.8 % | [92.5 ; 93.2] % |
| TOUS — assignation aléatoire (baseline) | — | 20.0 % | — |
| lck-2026.json — top-hypothèse | 2860 | 95.1 % | [94.2 ; 95.8] % |
| lec-2026.json — top-hypothèse | 2280 | 87.9 % | [86.5 ; 89.2] % |
| lfl-2026.json — top-hypothèse | 1790 | 89.4 % | [87.9 ; 90.7] % |
| lpl-2026.json — top-hypothèse | 3680 | 94.4 % | [93.6 ; 95.1] % |
| lec-2025.json — top-hypothèse | 2930 | 90.2 % | [89.1 ; 91.3] % |
| lfl-2025.json — top-hypothèse | 3060 | 91.9 % | [90.8 ; 92.8] % |
| lpl-2025.json — top-hypothèse | 7740 | 96.5 % | [96.1 ; 96.9] % |

Couverture : games sans fold (premier patch / patch illisible) ignorées : 227.

> La top-hypothèse doit battre l'argmax indépendant pour justifier l'énumération
> jointe (sinon la contrainte d'injectivité n'apporte rien) — et les deux doivent
> écraser le 20 % aléatoire pour que la lecture des rôles soit montrable.
