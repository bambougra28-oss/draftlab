# Postdiction G1 — win conditions vs durée réelle des games

> Généré : 2026-06-10T21:05:33.530Z · règles pré-enregistrées dans `scripts/backtest/postdiction.ts`
> (statements `gameLength` early/late du graphe I3, médiane par corpus, baseline 50 %).

## Piste 1 — tags seuls (règle originale)

| Tranche | n statements | Taux de réussite | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 1226 | 49.3 % | [46.5 ; 52.1] % | non significatif |
| — direction early | 803 | 49.2 % | [45.7 ; 52.6] % | non significatif |
| — direction late | 423 | 49.4 % | [44.7 ; 54.2] % | non significatif |
| lck-2026.json | 360 | 48.1 % | [42.9 ; 53.2] % | non significatif |
| lec-2026.json | 227 | 47.1 % | [40.7 ; 53.6] % | non significatif |
| lfl-2026.json | 172 | 51.7 % | [44.3 ; 59.1] % | non significatif |
| lpl-2026.json | 467 | 50.3 % | [45.8 ; 54.8] % | non significatif |

## Piste 2 — courbes de puissance PRO, walk-forward par patch (STEP_UP #15)

> Mêmes éligibilité, médiane et règle de hit ; statements régénérés avec
> `fitProPowerCurves` (priors 12/50 fixés avant scoring) entraîné sur les
> patchs strictement antérieurs du même corpus. Premier patch et patchs
> absents ⇒ repli tags (mesure du SYSTÈME, pas du sous-ensemble facile).

| Tranche | n statements | Taux de réussite | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 511 | 48.1 % | [43.8 ; 52.5] % | non significatif |
| — direction early | 439 | 48.7 % | [44.1 ; 53.4] % | non significatif |
| — direction late | 72 | 44.4 % | [33.5 ; 55.9] % | non significatif |
| lck-2026.json | 174 | 47.1 % | [39.9 ; 54.5] % | non significatif |
| lec-2026.json | 69 | 42.0 % | [31.1 ; 53.8] % | non significatif |
| lfl-2026.json | 50 | 62.0 % | [48.2 ; 74.1] % | non significatif |
| lpl-2026.json | 218 | 47.7 % | [41.2 ; 54.3] % | non significatif |

## Couverture

- lck-2026.json : 337 records → 337 éligibles (vainqueur + durée + 10 picks rôle-complets) → 266 avec ≥ 1 statement gameLength (tags) → 360 statements scorés piste 1, 174 piste 2 (285 games avec courbe active) ; médiane 31.1 min.
- lec-2026.json : 246 records → 246 éligibles (vainqueur + durée + 10 picks rôle-complets) → 195 avec ≥ 1 statement gameLength (tags) → 227 statements scorés piste 1, 69 piste 2 (228 games avec courbe active) ; médiane 33.0 min.
- lfl-2026.json : 191 records → 191 éligibles (vainqueur + durée + 10 picks rôle-complets) → 148 avec ≥ 1 statement gameLength (tags) → 172 statements scorés piste 1, 50 piste 2 (178 games avec courbe active) ; médiane 32.2 min.
- lpl-2026.json : 445 records → 445 éligibles (vainqueur + durée + 10 picks rôle-complets) → 355 avec ≥ 1 statement gameLength (tags) → 467 statements scorés piste 1, 218 piste 2 (368 games avec courbe active) ; médiane 32.4 min.

> Lecture honnête : un taux ≈ 50 % signifie que la famille de statements ne porte
> pas (encore) de signal falsifiable — retour au banc de calibration (DA-V2-6),
> pas de claim produit. La porte G1 exige de battre le hasard avec IC.
