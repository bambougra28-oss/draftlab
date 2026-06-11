# Calibration Platt par position de séquence — chantier E, run #2

> Généré : 2026-06-11T11:59:29.196Z · seed 42 (mulberry32, 1000 resamples, IC appariés par game)
> Règle pré-enregistrée gelée dans l'en-tête de `scripts/backtest/winCalibration.ts` — un rouge se documente, ne se retune pas.

## Comment lire ce rapport (pour le drafteur)

Calibrer, c'est rendre le % affiché honnête : quand l'outil dit « 60 % », l'équipe devrait
gagner environ 60 % de ces games-là. La carte de Platt (deux paramètres a et b par position de
draft) redresse le % brut de l'évaluateur sans changer l'ordre des candidats (b > 0 exigé).
Le verdict, par position : VERT ssi l'IC bootstrap 95 % de ΔBrier = Brier(calibré) − Brier(brut)
est entièrement sous 0 — c'est-à-dire si le redressement améliore significativement l'erreur
quadratique des probabilités. Le Δ log loss est publié à titre descriptif (secondaire, déclaré
d'avance). Ce rapport ne prétend JAMAIS prédire le vainqueur — seulement rendre le % honnête.

## Datasets SoloQ (figés et hashés AVANT le run)

- current-patch : `data/datasets/current-patch.json` · version 16.12.1 · date 2026-06-10T15:27:33.873Z
  sha256 `aca91656af68dff5016152e947aafbcebfb3dfe320cc2781f8fdbe8983fb8869`
- 30-days : `data/datasets/30-days.json` · version 30 · date 2026-06-10T15:27:53.230Z
  sha256 `6933c7c2d107afd465e7d8f0c44765305ff8747a187ed54c4c1f73e87651a4b1`

## Couverture

| Corpus | Records | Éligibles | Écartés | Paires de test (par position) |
|---|---|---|---|---|
| lck-2026.json | 337 | 337 | 0 | 337 |
| lec-2026.json | 246 | 246 | 0 | 246 |
| lfl-2026.json | 191 | 191 | 0 | 191 |
| lpl-2026.json | 445 | 443 | 2 | 443 |
| lec-2025.json | 308 | 308 | 0 | 293 |
| lfl-2025.json | 317 | 317 | 0 | 283 |
| lpl-2025.json | 817 | 817 | 0 | 774 |
| **TOTAL** | 2661 | 2659 | 2 | 2567 |

> Écarté = sans vainqueur, sans patch parsable, ou sans 10 picks rôle-complets (règle compOf de
> postdiction G1) — un SEUL ensemble éligible, partagé par les trois positions.

- Timeline ordonnée des groupes de patch (éligibles) : 14.16 (11, train-only) → 25.S1.1 (81, train-only) → 25.S1.2 (99) → 25.S1.3 (55) → 25.04 (42) → 25.06 (77) → 25.07 (143) → 25.08 (136) → 25.09 (152) → 25.10 (71) → 25.11 (56) → 25.14 (123) → 25.15 (146) → 25.16 (117) → 25.17 (134) → 25.18 (11) → 26.01 (154) → 26.02 (182) → 26.03 (179) → 26.04 (24) → 26.06 (40) → 26.07 (167) → 26.08 (137) → 26.09 (151) → 26.10 (163) → 26.11 (8)
- Groupes train-only en tête (jamais scorés, sous minTrainSize = 50) : 14.16 (11), 25.S1.1 (81)
- Folds scorés : 24 — premier fold : patch 25.S1.2 (n = 99)

## Position afterBans — après la première phase de bans (seq ≤ 6, 0 pick verrouillé)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 2567 | 0,2488 | 0,6907 | 53,7 % |
| Non calibré (p_raw) | 2567 | 0,2500 | 0,6931 | 50,0 % |
| Pièce p = 0,5 | 2567 | 0,2500 | 0,6931 | 50,0 % |
| Side-only (descriptif, baseline M3.5) | 2567 | 0,2488 | 0,6907 | 53,7 % |

- **ΔBrier (critère du verdict)** : Δ = -0,00121 · IC 95 % apparié [-0,00273 ; 0,00032]
- Δ log loss (secondaire, descriptif) : Δ = -0,00241 · IC 95 % [-0,00577 ; 0,00081]
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00273 ; 0,00032]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data (shippé, jamais utilisé pour les métriques) : a = 0,157527, b = 1,000000, nTrain = 2659, validated = false (= verdict VERT ∧ b > 0).

```
ATTENDU DÉCLARÉ D'AVANCE : à afterBans, p_raw ≡ 0,5 (l'évaluateur ne voit ni les
bans ni le side) ⇒ la calibration y dégénère en side-only (b sans information,
a = logit du taux blue du train). Le verdict 2026 « side-only ≈ pile-ou-face »
rend un ROUGE probable sur cette position ; ce rouge serait une CONFIRMATION
d'honnêteté (le 50 % affiché après bans est déjà honnête), pas un échec.
```

### Fiabilité (10 bacs) — bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 196 | 48,7 % | 52,6 % | [45,6 ; 59,4] % | -3,8 pp |
| [0,5 ; 0,6) | 2371 | 54,2 % | 54,2 % | [52,2 ; 56,2] % | -0,1 pp |
| [0,6 ; 0,7) | 0 | — | — | — | — |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

### Fiabilité (10 bacs) — bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 0 | — | — | — | — |
| [0,5 ; 0,6) | 2567 | 50,0 % | 54,1 % | [52,2 ; 56,0] % | -4,1 pp |
| [0,6 ; 0,7) | 0 | — | — | — | — |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

## Position after3Picks — après les trois premiers picks (seq ≤ 9)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 2567 | 0,2487 | 0,6906 | 53,3 % |
| Non calibré (p_raw) | 2567 | 0,2494 | 0,6919 | 51,4 % |
| Pièce p = 0,5 | 2567 | 0,2500 | 0,6931 | 50,0 % |
| Side-only (descriptif, baseline M3.5) | 2567 | 0,2488 | 0,6907 | 53,7 % |

- **ΔBrier (critère du verdict)** : Δ = -0,00065 · IC 95 % apparié [-0,00222 ; 0,00084]
- Δ log loss (secondaire, descriptif) : Δ = -0,00130 · IC 95 % [-0,00434 ; 0,00199]
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00222 ; 0,00084]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data (shippé, jamais utilisé pour les métriques) : a = 0,146409, b = 0,675449, nTrain = 2659, validated = false (= verdict VERT ∧ b > 0).

### Fiabilité (10 bacs) — bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 231 | 48,4 % | 54,5 % | [48,1 ; 60,8] % | -6,1 pp |
| [0,5 ; 0,6) | 2303 | 54,2 % | 53,8 % | [51,8 ; 55,9] % | 0,3 pp |
| [0,6 ; 0,7) | 33 | 61,6 % | 69,7 % | [52,7 ; 82,6] % | -8,1 pp |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

### Fiabilité (10 bacs) — bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 2 | 39,1 % | 100,0 % | [34,2 ; 100,0] % | -60,9 pp |
| [0,4 ; 0,5) | 1096 | 47,8 % | 53,1 % | [50,1 ; 56,0] % | -5,3 pp |
| [0,5 ; 0,6) | 1468 | 52,4 % | 54,8 % | [52,2 ; 57,3] % | -2,4 pp |
| [0,6 ; 0,7) | 1 | 60,0 % | 100,0 % | [20,7 ; 100,0] % | -40,0 pp |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

## Position fullDraft — draft complète verrouillée (seq ≤ 20, 5 + 5 picks)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 2567 | 0,2471 | 0,6874 | 55,4 % |
| Non calibré (p_raw) | 2567 | 0,2492 | 0,6915 | 53,0 % |
| Pièce p = 0,5 | 2567 | 0,2500 | 0,6931 | 50,0 % |
| Side-only (descriptif, baseline M3.5) | 2567 | 0,2488 | 0,6907 | 53,7 % |

- **ΔBrier (critère du verdict)** : Δ = -0,00204 · IC 95 % apparié [-0,00437 ; 0,00038]
- Δ log loss (secondaire, descriptif) : Δ = -0,00413 · IC 95 % [-0,00870 ; 0,00094]
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00437 ; 0,00038]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data (shippé, jamais utilisé pour les métriques) : a = 0,159408, b = 0,549009, nTrain = 2659, validated = false (= verdict VERT ∧ b > 0).

### Fiabilité (10 bacs) — bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 1 | 39,6 % | 0,0 % | [0,0 ; 79,3] % | 39,6 pp |
| [0,4 ; 0,5) | 555 | 47,8 % | 47,2 % | [43,1 ; 51,4] % | 0,6 pp |
| [0,5 ; 0,6) | 1815 | 54,7 % | 55,6 % | [53,4 ; 57,9] % | -0,9 pp |
| [0,6 ; 0,7) | 196 | 61,8 % | 59,7 % | [52,7 ; 66,3] % | 2,1 pp |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

### Fiabilité (10 bacs) — bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 1 | 19,3 % | 0,0 % | [0,0 ; 79,3] % | 19,3 pp |
| [0,2 ; 0,3) | 14 | 28,0 % | 28,6 % | [11,7 ; 54,6] % | -0,6 pp |
| [0,3 ; 0,4) | 287 | 36,7 % | 42,5 % | [36,9 ; 48,3] % | -5,8 pp |
| [0,4 ; 0,5) | 957 | 45,7 % | 54,1 % | [51,0 ; 57,3] % | -8,5 pp |
| [0,5 ; 0,6) | 1042 | 54,4 % | 56,6 % | [53,6 ; 59,6] % | -2,2 pp |
| [0,6 ; 0,7) | 256 | 63,1 % | 57,8 % | [51,7 ; 63,7] % | 5,3 pp |
| [0,7 ; 0,8) | 10 | 72,2 % | 70,0 % | [39,7 ; 89,2] % | 2,2 pp |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

## Lignes par corpus (descriptives — paires de test filtrées par fichier source)

> Aucun pouvoir de verdict : le protocole est poolé (l'artefact shippé est ligue-agnostique,
> comme l'affichage). Brier du bras calibré / non calibré sur les paires du corpus.

| Corpus | n test | afterBans (cal / brut) | after3Picks (cal / brut) | fullDraft (cal / brut) |
|---|---|---|---|---|
| lck-2026.json | 337 | 0,2459 / 0,2500 | 0,2459 / 0,2489 | 0,2449 / 0,2504 |
| lec-2026.json | 246 | 0,2502 / 0,2500 | 0,2497 / 0,2488 | 0,2475 / 0,2473 |
| lfl-2026.json | 191 | 0,2516 / 0,2500 | 0,2528 / 0,2523 | 0,2499 / 0,2490 |
| lpl-2026.json | 443 | 0,2514 / 0,2500 | 0,2512 / 0,2495 | 0,2481 / 0,2463 |
| lec-2025.json | 293 | 0,2477 / 0,2500 | 0,2487 / 0,2510 | 0,2459 / 0,2477 |
| lfl-2025.json | 283 | 0,2455 / 0,2500 | 0,2455 / 0,2485 | 0,2466 / 0,2551 |
| lpl-2025.json | 774 | 0,2491 / 0,2500 | 0,2484 / 0,2486 | 0,2474 / 0,2493 |

## Verdicts et artefact shippé

| Position | Verdict ΔBrier | a (fit final) | b (fit final) | nTrain | validated |
|---|---|---|---|---|---|
| afterBans | ROUGE | 0,157527 | 1,000000 | 2659 | false |
| after3Picks | ROUGE | 0,146409 | 0,675449 | 2659 | false |
| fullDraft | ROUGE | 0,159408 | 0,549009 | 2659 | false |

Artefact : `data/calibration/winCalibration.json` — TOUJOURS écrit, quel que soit le verdict ; l'UI n'applique
JAMAIS une position validated:false (badge « Non calibré » conservé, % brut affiché).

## Limite documentée (verbatim, gelée dans la règle)

```
LIMITE DOCUMENTÉE (reprise verbatim dans le rapport) : le snapshot SoloQ est
« d'aujourd'hui » et évalue des games 2025-2026 (fuite de features M3.x connue).
Elle contamine p_raw À L'IDENTIQUE dans les bras calibré et non calibré (comparaison
appariée interne valide) ; le claim autorisé porte sur la CARTE DE CALIBRATION,
jamais sur la force prédictive de l'évaluateur. Aucun « on prédit le vainqueur ».
```

## Approximations d'application (verbatim, gelées dans la règle)

```
DEUX APPROXIMATIONS D'APPLICATION (déclarées ici, reprises dans le rapport et
l'aide produit) :
  (a) la calibration est mesurée aux trois ancres 0 / 3 / 10 picks verrouillés ;
      une position intermédiaire reçoit la carte de l'ancre que la partition
      positionOf lui assigne (0 → afterBans ; 1..6 → after3Picks ; 7..10 →
      fullDraft), jamais une interpolation ;
  (b) à l'application, le % du coach passe par des rôles INFÉRÉS et le mode
      séquence par l'argmax des rolePriors, alors que la mesure utilise les
      rôles RÉELS du corpus — l'écart d'attribution de rôles n'est pas couvert
      par le claim.
```
