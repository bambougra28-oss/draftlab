# Postdiction G1 — win conditions vs durée réelle des games

> Généré : 2026-06-10T21:18:05.990Z · règles pré-enregistrées dans `scripts/backtest/postdiction.ts`
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

## Piste 3 — affinité de durée COMPO-NIVEAU (interactions de paires de traits)

> Hypothèse pré-enregistrée après les pistes 1-2 au hasard : le signal de
> durée vit dans les INTERACTIONS de la compo. Cellules `fitCompDurationCells`
> (paires de traits, split long/court sur la médiane du TRAIN, priorN 200,
> poids nL·nS/(nL+nS) — tout fixé avant scoring), walk-forward par patch ;
> un statement par game = signe de l'écart d'affinité (bleu − rouge).
> Premier patch / patch absent / écart nul ⇒ non scoré (mesure du modèle).

| Tranche | n statements | Taux de réussite | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 1059 | 52.1 % | [49.1 ; 55.1] % | non significatif |
| — direction early | 535 | 51.2 % | [47.0 ; 55.4] % | non significatif |
| — direction late | 524 | 53.1 % | [48.8 ; 57.3] % | non significatif |
| lck-2026.json | 285 | 53.0 % | [47.2 ; 58.7] % | non significatif |
| lec-2026.json | 228 | 53.1 % | [46.6 ; 59.4] % | non significatif |
| lfl-2026.json | 178 | 51.1 % | [43.8 ; 58.4] % | non significatif |
| lpl-2026.json | 368 | 51.4 % | [46.3 ; 56.4] % | non significatif |

### Tranche haute-confiance (|écart| strictement au-dessus de la médiane par corpus)

| Tranche | n statements | Taux de réussite | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus (haute confiance) | 529 | 49.9 % | [45.7 ; 54.2] % | non significatif |
| — direction early | 269 | 47.6 % | [41.7 ; 53.5] % | non significatif |
| — direction late | 260 | 52.3 % | [46.2 ; 58.3] % | non significatif |
| lck-2026.json (haute confiance) | 142 | 48.6 % | [40.5 ; 56.7] % | non significatif |
| lec-2026.json (haute confiance) | 114 | 49.1 % | [40.1 ; 58.2] % | non significatif |
| lfl-2026.json (haute confiance) | 89 | 49.4 % | [39.3 ; 59.6] % | non significatif |
| lpl-2026.json (haute confiance) | 184 | 51.6 % | [44.5 ; 58.7] % | non significatif |

## Couverture

- lck-2026.json : 337 records → 337 éligibles (vainqueur + durée + 10 picks rôle-complets) → 266 avec ≥ 1 statement gameLength (tags) → 360 statements scorés piste 1, 174 piste 2 (285 games avec courbe active), 285 piste 3 ; médiane 31.1 min.
- lec-2026.json : 246 records → 246 éligibles (vainqueur + durée + 10 picks rôle-complets) → 195 avec ≥ 1 statement gameLength (tags) → 227 statements scorés piste 1, 69 piste 2 (228 games avec courbe active), 228 piste 3 ; médiane 33.0 min.
- lfl-2026.json : 191 records → 191 éligibles (vainqueur + durée + 10 picks rôle-complets) → 148 avec ≥ 1 statement gameLength (tags) → 172 statements scorés piste 1, 50 piste 2 (178 games avec courbe active), 178 piste 3 ; médiane 32.2 min.
- lpl-2026.json : 445 records → 445 éligibles (vainqueur + durée + 10 picks rôle-complets) → 355 avec ≥ 1 statement gameLength (tags) → 467 statements scorés piste 1, 218 piste 2 (368 games avec courbe active), 368 piste 3 ; médiane 32.4 min.

> Lecture honnête : un taux ≈ 50 % signifie que la famille de statements ne porte
> pas (encore) de signal falsifiable — retour au banc de calibration (DA-V2-6),
> pas de claim produit. La porte G1 exige de battre le hasard avec IC.
