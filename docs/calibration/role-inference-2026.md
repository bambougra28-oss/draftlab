# Validation — inférence des rôles adverses (I2 + priors corpus)

> Généré : 2026-06-11T12:01:30.578Z · règle pré-enregistrée dans `scripts/backtest/roleInference.ts`
> (walk-forward par patch, priors ligue, top-hypothèse jointe vs argmax indépendant vs 20 % aléatoire).

## k = 3 picks révélés

| Tranche | n champions | Accuracy | Wilson 95 % |
|---|---|---|---|
| TOUS — top-hypothèse jointe | 17640 | 95.3 % | [95.0 ; 95.6] % |
| TOUS — argmax indépendant (baseline) | 17640 | 94.5 % | [94.2 ; 94.9] % |
| TOUS — assignation aléatoire (baseline) | — | 20.0 % | — |
| lck-2026.json — top-hypothèse | 1716 | 97.6 % | [96.7 ; 98.2] % |
| lec-2026.json — top-hypothèse | 1368 | 94.3 % | [92.9 ; 95.4] % |
| lfl-2026.json — top-hypothèse | 1074 | 94.0 % | [92.5 ; 95.3] % |
| lpl-2026.json — top-hypothèse | 2208 | 96.8 % | [96.0 ; 97.5] % |
| lck-2025.json — top-hypothèse | 3036 | 96.8 % | [96.2 ; 97.4] % |
| lec-2025.json — top-hypothèse | 1758 | 92.2 % | [90.9 ; 93.4] % |
| lfl-2025.json — top-hypothèse | 1836 | 90.4 % | [89.0 ; 91.7] % |
| lpl-2025.json — top-hypothèse | 4644 | 96.6 % | [96.0 ; 97.1] % |

## k = 5 picks révélés

| Tranche | n champions | Accuracy | Wilson 95 % |
|---|---|---|---|
| TOUS — top-hypothèse jointe | 29400 | 93.9 % | [93.7 ; 94.2] % |
| TOUS — argmax indépendant (baseline) | 29400 | 93.0 % | [92.7 ; 93.3] % |
| TOUS — assignation aléatoire (baseline) | — | 20.0 % | — |
| lck-2026.json — top-hypothèse | 2860 | 95.1 % | [94.2 ; 95.8] % |
| lec-2026.json — top-hypothèse | 2280 | 87.9 % | [86.5 ; 89.2] % |
| lfl-2026.json — top-hypothèse | 1790 | 89.4 % | [87.9 ; 90.7] % |
| lpl-2026.json — top-hypothèse | 3680 | 94.4 % | [93.6 ; 95.1] % |
| lck-2025.json — top-hypothèse | 5060 | 96.6 % | [96.1 ; 97.1] % |
| lec-2025.json — top-hypothèse | 2930 | 90.2 % | [89.1 ; 91.3] % |
| lfl-2025.json — top-hypothèse | 3060 | 91.9 % | [90.8 ; 92.8] % |
| lpl-2025.json — top-hypothèse | 7740 | 96.5 % | [96.1 ; 96.9] % |

Couverture : games sans fold (premier patch / patch illisible) ignorées : 276.

> La top-hypothèse doit battre l'argmax indépendant pour justifier l'énumération
> jointe (sinon la contrainte d'injectivité n'apporte rien) — et les deux doivent
> écraser le 20 % aléatoire pour que la lecture des rôles soit montrable.
