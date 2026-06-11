# Postdiction G1 — win conditions vs durée réelle des games

> Généré : 2026-06-11T12:00:24.775Z · règles pré-enregistrées dans `scripts/backtest/postdiction.ts`
> (statements `gameLength` early/late du graphe I3, médiane par corpus, baseline 50 %).

## Piste 1 — tags seuls (règle originale)

| Tranche | n statements | Taux de réussite | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 3059 | 50.9 % | [49.1 ; 52.6] % | non significatif |
| — direction early | 1869 | 52.5 % | [50.2 ; 54.7] % | bat le hasard |
| — direction late | 1190 | 48.3 % | [45.5 ; 51.2] % | non significatif |
| lck-2026.json | 360 | 50.8 % | [45.7 ; 56.0] % | non significatif |
| lec-2026.json | 227 | 47.6 % | [41.2 ; 54.1] % | non significatif |
| lfl-2026.json | 172 | 51.7 % | [44.3 ; 59.1] % | non significatif |
| lpl-2026.json | 467 | 52.9 % | [48.4 ; 57.4] % | non significatif |
| lck-2025.json | 530 | 53.6 % | [49.3 ; 57.8] % | non significatif |
| lec-2025.json | 258 | 51.9 % | [45.9 ; 58.0] % | non significatif |
| lfl-2025.json | 274 | 55.5 % | [49.6 ; 61.2] % | non significatif |
| lpl-2025.json | 771 | 46.6 % | [43.1 ; 50.1] % | non significatif |

## Piste 2 — courbes de puissance PRO, walk-forward par patch (STEP_UP #15)

> Mêmes éligibilité, médiane et règle de hit ; statements régénérés avec
> `fitProPowerCurves` (priors 12/50 fixés avant scoring) entraîné sur les
> patchs strictement antérieurs du même corpus. Premier patch et patchs
> absents ⇒ repli tags (mesure du SYSTÈME, pas du sous-ensemble facile).

| Tranche | n statements | Taux de réussite | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 1199 | 52.0 % | [49.2 ; 54.9] % | non significatif |
| — direction early | 959 | 53.0 % | [49.8 ; 56.1] % | non significatif |
| — direction late | 240 | 48.3 % | [42.1 ; 54.6] % | non significatif |
| lck-2026.json | 174 | 52.9 % | [45.5 ; 60.1] % | non significatif |
| lec-2026.json | 69 | 43.5 % | [32.4 ; 55.2] % | non significatif |
| lfl-2026.json | 50 | 62.0 % | [48.2 ; 74.1] % | non significatif |
| lpl-2026.json | 218 | 53.2 % | [46.6 ; 59.7] % | non significatif |
| lck-2025.json | 216 | 55.6 % | [48.9 ; 62.0] % | non significatif |
| lec-2025.json | 86 | 52.3 % | [41.9 ; 62.6] % | non significatif |
| lfl-2025.json | 79 | 50.6 % | [39.8 ; 61.4] % | non significatif |
| lpl-2025.json | 307 | 48.9 % | [43.3 ; 54.4] % | non significatif |

## Piste 3 — affinité de durée COMPO-NIVEAU (interactions de paires de traits)

> Hypothèse pré-enregistrée après les pistes 1-2 au hasard : le signal de
> durée vit dans les INTERACTIONS de la compo. Cellules `fitCompDurationCells`
> (paires de traits, split long/court sur la médiane du TRAIN, priorN 200,
> poids nL·nS/(nL+nS) — tout fixé avant scoring), walk-forward par patch ;
> un statement par game = signe de l'écart d'affinité (bleu − rouge).
> Premier patch / patch absent / écart nul ⇒ non scoré (mesure du modèle).

| Tranche | n statements | Taux de réussite | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 2934 | 50.1 % | [48.3 ; 51.9] % | non significatif |
| — direction early | 1459 | 51.7 % | [49.1 ; 54.2] % | non significatif |
| — direction late | 1475 | 48.5 % | [45.9 ; 51.0] % | non significatif |
| lck-2026.json | 285 | 53.0 % | [47.2 ; 58.7] % | non significatif |
| lec-2026.json | 228 | 53.1 % | [46.6 ; 59.4] % | non significatif |
| lfl-2026.json | 178 | 51.1 % | [43.8 ; 58.4] % | non significatif |
| lpl-2026.json | 368 | 51.4 % | [46.3 ; 56.4] % | non significatif |
| lck-2025.json | 505 | 49.9 % | [45.6 ; 54.2] % | non significatif |
| lec-2025.json | 293 | 51.2 % | [45.5 ; 56.9] % | non significatif |
| lfl-2025.json | 305 | 50.2 % | [44.6 ; 55.7] % | non significatif |
| lpl-2025.json | 772 | 46.9 % | [43.4 ; 50.4] % | non significatif |

### Tranche haute-confiance (|écart| strictement au-dessus de la médiane par corpus)

| Tranche | n statements | Taux de réussite | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus (haute confiance) | 1465 | 50.1 % | [47.5 ; 52.7] % | non significatif |
| — direction early | 717 | 50.1 % | [46.4 ; 53.7] % | non significatif |
| — direction late | 748 | 50.1 % | [46.6 ; 53.7] % | non significatif |
| lck-2026.json (haute confiance) | 142 | 48.6 % | [40.5 ; 56.7] % | non significatif |
| lec-2026.json (haute confiance) | 114 | 49.1 % | [40.1 ; 58.2] % | non significatif |
| lfl-2026.json (haute confiance) | 89 | 49.4 % | [39.3 ; 59.6] % | non significatif |
| lpl-2026.json (haute confiance) | 184 | 51.6 % | [44.5 ; 58.7] % | non significatif |
| lck-2025.json (haute confiance) | 252 | 50.0 % | [43.9 ; 56.1] % | non significatif |
| lec-2025.json (haute confiance) | 146 | 50.7 % | [42.7 ; 58.7] % | non significatif |
| lfl-2025.json (haute confiance) | 152 | 58.6 % | [50.6 ; 66.1] % | bat le hasard |
| lpl-2025.json (haute confiance) | 386 | 46.9 % | [42.0 ; 51.9] % | non significatif |

## Couverture

- lck-2026.json : 337 records → 337 éligibles (vainqueur + durée + 10 picks rôle-complets) → 266 avec ≥ 1 statement gameLength (tags) → 360 statements scorés piste 1, 174 piste 2 (285 games avec courbe active), 285 piste 3 ; médiane 31.1 min.
- lec-2026.json : 246 records → 246 éligibles (vainqueur + durée + 10 picks rôle-complets) → 195 avec ≥ 1 statement gameLength (tags) → 227 statements scorés piste 1, 69 piste 2 (228 games avec courbe active), 228 piste 3 ; médiane 33.0 min.
- lfl-2026.json : 191 records → 191 éligibles (vainqueur + durée + 10 picks rôle-complets) → 148 avec ≥ 1 statement gameLength (tags) → 172 statements scorés piste 1, 50 piste 2 (178 games avec courbe active), 178 piste 3 ; médiane 32.2 min.
- lpl-2026.json : 445 records → 445 éligibles (vainqueur + durée + 10 picks rôle-complets) → 355 avec ≥ 1 statement gameLength (tags) → 467 statements scorés piste 1, 218 piste 2 (368 games avec courbe active), 368 piste 3 ; médiane 32.4 min.
- lck-2025.json : 555 records → 555 éligibles (vainqueur + durée + 10 picks rôle-complets) → 418 avec ≥ 1 statement gameLength (tags) → 530 statements scorés piste 1, 216 piste 2 (505 games avec courbe active), 505 piste 3 ; médiane 31.1 min.
- lec-2025.json : 308 records → 308 éligibles (vainqueur + durée + 10 picks rôle-complets) → 211 avec ≥ 1 statement gameLength (tags) → 258 statements scorés piste 1, 86 piste 2 (291 games avec courbe active), 293 piste 3 ; médiane 32.6 min.
- lfl-2025.json : 317 records → 317 éligibles (vainqueur + durée + 10 picks rôle-complets) → 242 avec ≥ 1 statement gameLength (tags) → 274 statements scorés piste 1, 79 piste 2 (303 games avec courbe active), 305 piste 3 ; médiane 33.1 min.
- lpl-2025.json : 817 records → 817 éligibles (vainqueur + durée + 10 picks rôle-complets) → 627 avec ≥ 1 statement gameLength (tags) → 771 statements scorés piste 1, 307 piste 2 (772 games avec courbe active), 772 piste 3 ; médiane 31.4 min.

> Lecture honnête : un taux ≈ 50 % signifie que la famille de statements ne porte
> pas (encore) de signal falsifiable — retour au banc de calibration (DA-V2-6),
> pas de claim produit. La porte G1 exige de battre le hasard avec IC.
