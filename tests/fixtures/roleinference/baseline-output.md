# Validation — inférence des rôles adverses (I2 + priors corpus)

> Généré : 2026-06-11T00:00:00.000Z · règle pré-enregistrée dans `scripts/backtest/roleInference.ts`
> (walk-forward par patch, priors ligue, top-hypothèse jointe vs argmax indépendant vs 20 % aléatoire).

## k = 3 picks révélés

| Tranche | n champions | Accuracy | Wilson 95 % |
|---|---|---|---|
| TOUS — top-hypothèse jointe | 6 | 100.0 % | [61.0 ; 100.0] % |
| TOUS — argmax indépendant (baseline) | 6 | 100.0 % | [61.0 ; 100.0] % |
| TOUS — assignation aléatoire (baseline) | — | 20.0 % | — |
| synthetic.json — top-hypothèse | 6 | 100.0 % | [61.0 ; 100.0] % |

## k = 5 picks révélés

| Tranche | n champions | Accuracy | Wilson 95 % |
|---|---|---|---|
| TOUS — top-hypothèse jointe | 10 | 100.0 % | [72.2 ; 100.0] % |
| TOUS — argmax indépendant (baseline) | 10 | 90.0 % | [59.6 ; 98.2] % |
| TOUS — assignation aléatoire (baseline) | — | 20.0 % | — |
| synthetic.json — top-hypothèse | 10 | 100.0 % | [72.2 ; 100.0] % |

Couverture : games sans fold (premier patch / patch illisible) ignorées : 4.

> La top-hypothèse doit battre l'argmax indépendant pour justifier l'énumération
> jointe (sinon la contrainte d'injectivité n'apporte rien) — et les deux doivent
> écraser le 20 % aléatoire pour que la lecture des rôles soit montrable.
