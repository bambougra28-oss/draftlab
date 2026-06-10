# Postdiction G1 — win conditions vs durée réelle des games

> Généré : 2026-06-10T16:00:00Z · règle pré-enregistrée dans `scripts/backtest/postdiction.ts`
> (statements `gameLength` early/late du graphe I3, médiane par corpus, baseline 50 %).

| Tranche | n statements | Taux de réussite | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 759 | 48.6 % | [45.1 ; 52.2] % | non significatif |
| — direction early | 486 | 48.6 % | [44.1 ; 53.0] % | non significatif |
| — direction late | 273 | 48.7 % | [42.8 ; 54.6] % | non significatif |
| lck-2026.json | 360 | 48.1 % | [42.9 ; 53.2] % | non significatif |
| lfl-2026.json | 172 | 51.7 % | [44.3 ; 59.1] % | non significatif |
| lec-2026.json | 227 | 47.1 % | [40.7 ; 53.6] % | non significatif |

## Couverture

- lck-2026.json : 337 records → 337 éligibles (vainqueur + durée + 10 picks rôle-complets) → 266 avec ≥ 1 statement gameLength → 360 statements scorés ; médiane 31.1 min.
- lfl-2026.json : 191 records → 191 éligibles (vainqueur + durée + 10 picks rôle-complets) → 148 avec ≥ 1 statement gameLength → 172 statements scorés ; médiane 32.2 min.
- lec-2026.json : 246 records → 246 éligibles (vainqueur + durée + 10 picks rôle-complets) → 195 avec ≥ 1 statement gameLength → 227 statements scorés ; médiane 33.0 min.

> Lecture honnête : un taux ≈ 50 % signifie que la famille de statements ne porte
> pas (encore) de signal falsifiable — retour au banc de calibration (DA-V2-6),
> pas de claim produit. La porte G1 exige de battre le hasard avec IC.
