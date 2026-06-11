# Calibration Platt PAR LIGUE × position de séquence — chantier E3, run #3

> Généré : 2026-06-11T19:23:25.422Z · seed 42 (mulberry32 — UN flux : 24 IC primaires appariés par game,
> puis IC clusterisés secondaires par série · 1000 resamples chacun)
> Règle pré-enregistrée gelée dans l'en-tête de `scripts/backtest/winCalibrationByLeague.ts` — un rouge se documente, ne se retune pas.

## Comment lire ce rapport (pour le drafteur)

Calibrer, c'est rendre le % affiché honnête : quand l'outil dit « 60 % », l'équipe devrait
gagner environ 60 % de ces games-là. La nouveauté E3 : une carte de Platt (a, b) PAR LIGUE
(lck/lec/lfl/lpl) × position de draft — une carte unique moyennait l'hétérogénéité des ligues
(le side LCK, la dérive LFL). Le verdict, par CELLULE (ligue × position) : VERT ssi l'IC
bootstrap 95 % de ΔBrier = Brier(calibré) − Brier(brut) est entièrement sous 0. Le Δ log loss
est publié à titre descriptif (secondaire, déclaré d'avance), l'IC clusterisé par série aussi
(limite déclarée, sans pouvoir de verdict). Une ligue sans carte validée garde le % brut et le
badge « Non calibré ». Ce rapport ne prétend JAMAIS prédire le vainqueur — seulement rendre le
% honnête, ligue par ligue.

## Datasets SoloQ (figés, hashés et VÉRIFIÉS avant le run)

- current-patch : `data/datasets/current-patch.json` · version 16.12.1 · date 2026-06-10T15:27:33.873Z
  sha256 `aca91656af68dff5016152e947aafbcebfb3dfe320cc2781f8fdbe8983fb8869`
- 30-days : `data/datasets/30-days.json` · version 30 · date 2026-06-10T15:27:53.230Z
  sha256 `6933c7c2d107afd465e7d8f0c44765305ff8747a187ed54c4c1f73e87651a4b1`
- Override de hash : aucun (défauts gelés de la règle, snapshots run #2 vérifiés)

## Couverture

| Corpus | Ligue | Records | Éligibles | Écartés | Paires de test (par position) |
|---|---|---|---|---|---|
| lck-2026.json | lck | 337 | 337 | 0 | 337 |
| lec-2026.json | lec | 246 | 246 | 0 | 246 |
| lfl-2026.json | lfl | 191 | 191 | 0 | 191 |
| lpl-2026.json | lpl | 445 | 443 | 2 | 443 |
| lck-2025.json | lck | 555 | 555 | 0 | 481 |
| lec-2025.json | lec | 308 | 308 | 0 | 224 |
| lfl-2025.json | lfl | 317 | 317 | 0 | 259 |
| lpl-2025.json | lpl | 817 | 817 | 0 | 729 |
| **TOTAL** | — | 3216 | 3214 | 2 | 2910 |

> Écarté = sans vainqueur, sans patch parsable, ou sans 10 picks rôle-complets (règle compOf de
> postdiction G1) — un SEUL ensemble éligible PAR LIGUE, partagé par les trois positions.

## Ligue lck

- Corpus : lck-2026.json + lck-2025.json — 892 éligibles.
- Timeline ordonnée des groupes de patch (éligibles) : 25.S1.1 (49, train-only) → 25.S1.2 (25, train-only) → 25.S1.3 (35) → 25.06 (24) → 25.07 (50) → 25.08 (47) → 25.09 (48) → 25.10 (53) → 25.11 (18) → 25.14 (46) → 25.15 (48) → 25.16 (51) → 25.17 (61) → 26.01 (51) → 26.02 (33) → 26.03 (41) → 26.06 (21) → 26.07 (45) → 26.08 (44) → 26.09 (45) → 26.10 (49) → 26.11 (8)
- Groupes train-only en tête (jamais scorés, sous minTrainSize = 50) : 25.S1.1 (49), 25.S1.2 (25)
- Folds scorés : 20 — premier fold : patch 25.S1.3 (n = 35)

### lck · afterBans — après la première phase de bans (seq ≤ 6, 0 pick verrouillé)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 818 | 0,2506 | 0,6945 | 52,7 % |
| Non calibré (p_raw) | 818 | 0,2500 | 0,6931 | 50,0 % |
| Pièce p = 0,5 | 818 | 0,2500 | 0,6931 | 50,0 % |
| Side-only ligue (descriptif, baseline M3.5) | 818 | 0,2506 | 0,6945 | 52,7 % |

- **ΔBrier (critère du verdict)** : Δ = 0,00065 · IC 95 % apparié [-0,00259 ; 0,00386]
- Δ log loss (secondaire, descriptif) : Δ = 0,00134 · IC 95 % [-0,00509 ; 0,00795]
- IC clusterisé par série (SECONDAIRE, sans pouvoir de verdict — limite déclarée §1) : Δ = 0,00065 · IC 95 % [-0,00275 ; 0,00455] (311 clusters / 818 games)
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00259 ; 0,00386]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data DE LA LIGUE (shippé, jamais utilisé pour les métriques) : a = 0,134733, b = 1,000000, nTrain = 892, validated = false (= verdict VERT ∧ b > 0).

```
ATTENDU DÉCLARÉ D'AVANCE : afterBans dégénère en side-only PAR LIGUE (p_raw ≡ 0,5 ⇒ b sans
information, a = logit du taux blue du train de la ligue). Le run #2 a publié : side-only
lec/lfl/lpl ≈ pile-ou-face ⇒ rouges probables, qui seraient des CONFIRMATIONS d'honnêteté
(le 50 % post-bans y est déjà honnête) ; side-only LCK 2026 : accuracy +8,4 pp SIGNIFICATIVE
([+2,8 ; +14,0], scorecard lck-2026-26.11) MAIS, sur l'échelle MÊME du verdict E3, ΔBrier
side-only vs pièce = −0,0045 [−0,0101 ; +0,0012] (n = 286, NON significatif, même scorecard).
L'effet attendu vaut ≈ −(q − 0,5)² (q = taux blue walk-forward lck) ; au point estimé 2026
(≈ −0,0045) et au MDE afterBans-lck (≈ 0,0027), la détection est attendue BORDERLINE —
un VERT lck/afterBans signifierait « en LCK, afficher ~q % après bans est plus honnête que 50 % » ;
un ROUGE, que l'avantage blue ne tient pas sur 2025-2026 au niveau requis. LES DEUX lectures sont
écrites dans la règle, avant le run.
```

#### Fiabilité (10 bacs) — lck · afterBans · bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 0 | — | — | — | — |
| [0,5 ; 0,6) | 759 | 53,3 % | 52,4 % | [48,9 ; 56,0] % | 0,9 pp |
| [0,6 ; 0,7) | 59 | 61,1 % | 55,9 % | [43,3 ; 67,8] % | 5,1 pp |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

#### Fiabilité (10 bacs) — lck · afterBans · bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 0 | — | — | — | — |
| [0,5 ; 0,6) | 818 | 50,0 % | 52,7 % | [49,3 ; 56,1] % | -2,7 pp |
| [0,6 ; 0,7) | 0 | — | — | — | — |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

### lck · after3Picks — après les trois premiers picks (seq ≤ 9)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 818 | 0,2522 | 0,6979 | 52,1 % |
| Non calibré (p_raw) | 818 | 0,2511 | 0,6955 | 51,0 % |
| Pièce p = 0,5 | 818 | 0,2500 | 0,6931 | 50,0 % |
| Side-only ligue (descriptif, baseline M3.5) | 818 | 0,2506 | 0,6945 | 52,7 % |

- **ΔBrier (critère du verdict)** : Δ = 0,00109 · IC 95 % apparié [-0,00257 ; 0,00507]
- Δ log loss (secondaire, descriptif) : Δ = 0,00248 · IC 95 % [-0,00508 ; 0,01082]
- IC clusterisé par série (SECONDAIRE, sans pouvoir de verdict — limite déclarée §1) : Δ = 0,00109 · IC 95 % [-0,00279 ; 0,00543] (311 clusters / 818 games)
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00257 ; 0,00507]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data DE LA LIGUE (shippé, jamais utilisé pour les métriques) : a = 0,135591, b = -0,046840, nTrain = 892, validated = false (= verdict VERT ∧ b > 0).

#### Fiabilité (10 bacs) — lck · after3Picks · bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 1 | 35,7 % | 100,0 % | [20,7 ; 100,0] % | -64,3 pp |
| [0,4 ; 0,5) | 46 | 48,8 % | 54,3 % | [40,2 ; 67,8] % | -5,6 pp |
| [0,5 ; 0,6) | 735 | 53,5 % | 52,9 % | [49,3 ; 56,5] % | 0,6 pp |
| [0,6 ; 0,7) | 35 | 62,5 % | 45,7 % | [30,5 ; 61,8] % | 16,8 pp |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 1 | 82,8 % | 0,0 % | [0,0 ; 79,3] % | 82,8 pp |
| [0,9 ; 1,0] | 0 | — | — | — | — |

#### Fiabilité (10 bacs) — lck · after3Picks · bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 358 | 47,9 % | 52,0 % | [46,8 ; 57,1] % | -4,1 pp |
| [0,5 ; 0,6) | 460 | 52,5 % | 53,3 % | [48,7 ; 57,8] % | -0,8 pp |
| [0,6 ; 0,7) | 0 | — | — | — | — |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

### lck · fullDraft — draft complète verrouillée (seq ≤ 20, 5 + 5 picks)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 818 | 0,2512 | 0,6963 | 54,0 % |
| Non calibré (p_raw) | 818 | 0,2516 | 0,6966 | 51,5 % |
| Pièce p = 0,5 | 818 | 0,2500 | 0,6931 | 50,0 % |
| Side-only ligue (descriptif, baseline M3.5) | 818 | 0,2506 | 0,6945 | 52,7 % |

- **ΔBrier (critère du verdict)** : Δ = -0,00045 · IC 95 % apparié [-0,00521 ; 0,00404]
- Δ log loss (secondaire, descriptif) : Δ = -0,00034 · IC 95 % [-0,01051 ; 0,00995]
- IC clusterisé par série (SECONDAIRE, sans pouvoir de verdict — limite déclarée §1) : Δ = -0,00045 · IC 95 % [-0,00540 ; 0,00489] (311 clusters / 818 games)
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00521 ; 0,00404]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data DE LA LIGUE (shippé, jamais utilisé pour les métriques) : a = 0,134585, b = 0,386461, nTrain = 892, validated = false (= verdict VERT ∧ b > 0).

#### Fiabilité (10 bacs) — lck · fullDraft · bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 1 | 39,4 % | 0,0 % | [0,0 ; 79,3] % | 39,4 pp |
| [0,4 ; 0,5) | 138 | 48,2 % | 46,4 % | [38,3 ; 54,7] % | 1,9 pp |
| [0,5 ; 0,6) | 592 | 53,8 % | 54,2 % | [50,2 ; 58,2] % | -0,4 pp |
| [0,6 ; 0,7) | 78 | 63,8 % | 53,8 % | [42,9 ; 64,5] % | 9,9 pp |
| [0,7 ; 0,8) | 6 | 73,4 % | 66,7 % | [30,0 ; 90,3] % | 6,8 pp |
| [0,8 ; 0,9) | 3 | 83,1 % | 0,0 % | [0,0 ; 56,2] % | 83,1 pp |
| [0,9 ; 1,0] | 0 | — | — | — | — |

#### Fiabilité (10 bacs) — lck · fullDraft · bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 78 | 36,8 % | 42,3 % | [32,0 ; 53,4] % | -5,5 pp |
| [0,4 ; 0,5) | 324 | 45,5 % | 53,4 % | [48,0 ; 58,8] % | -7,9 pp |
| [0,5 ; 0,6) | 335 | 54,4 % | 54,0 % | [48,7 ; 59,3] % | 0,4 pp |
| [0,6 ; 0,7) | 79 | 63,3 % | 54,4 % | [43,5 ; 65,0] % | 8,8 pp |
| [0,7 ; 0,8) | 2 | 71,1 % | 50,0 % | [9,5 ; 90,5] % | 21,1 pp |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

## Ligue lec

- Corpus : lec-2026.json + lec-2025.json — 554 éligibles.
- Timeline ordonnée des groupes de patch (éligibles) : 25.S1.1 (15, train-only) → 25.S1.2 (30, train-only) → 25.S1.3 (39, train-only) → 25.06 (17) → 25.07 (31) → 25.08 (31) → 25.09 (27) → 25.10 (33) → 25.15 (24) → 25.16 (23) → 25.17 (27) → 25.18 (11) → 26.01 (18) → 26.02 (36) → 26.03 (51) → 26.06 (19) → 26.07 (33) → 26.08 (29) → 26.09 (30) → 26.10 (30)
- Groupes train-only en tête (jamais scorés, sous minTrainSize = 50) : 25.S1.1 (15), 25.S1.2 (30), 25.S1.3 (39)
- Folds scorés : 17 — premier fold : patch 25.06 (n = 17)

### lec · afterBans — après la première phase de bans (seq ≤ 6, 0 pick verrouillé)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 470 | 0,2487 | 0,6906 | 54,7 % |
| Non calibré (p_raw) | 470 | 0,2500 | 0,6931 | 50,0 % |
| Pièce p = 0,5 | 470 | 0,2500 | 0,6931 | 50,0 % |
| Side-only ligue (descriptif, baseline M3.5) | 470 | 0,2487 | 0,6906 | 54,7 % |

- **ΔBrier (critère du verdict)** : Δ = -0,00129 · IC 95 % apparié [-0,00624 ; 0,00388]
- Δ log loss (secondaire, descriptif) : Δ = -0,00256 · IC 95 % [-0,01269 ; 0,00758]
- IC clusterisé par série (SECONDAIRE, sans pouvoir de verdict — limite déclarée §1) : Δ = -0,00129 · IC 95 % [-0,00594 ; 0,00336] (217 clusters / 470 games)
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00624 ; 0,00388]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data DE LA LIGUE (shippé, jamais utilisé pour les métriques) : a = 0,180998, b = 1,000000, nTrain = 554, validated = false (= verdict VERT ∧ b > 0).

```
ATTENDU DÉCLARÉ D'AVANCE : afterBans dégénère en side-only PAR LIGUE (p_raw ≡ 0,5 ⇒ b sans
information, a = logit du taux blue du train de la ligue). Le run #2 a publié : side-only
lec/lfl/lpl ≈ pile-ou-face ⇒ rouges probables, qui seraient des CONFIRMATIONS d'honnêteté
(le 50 % post-bans y est déjà honnête) ; side-only LCK 2026 : accuracy +8,4 pp SIGNIFICATIVE
([+2,8 ; +14,0], scorecard lck-2026-26.11) MAIS, sur l'échelle MÊME du verdict E3, ΔBrier
side-only vs pièce = −0,0045 [−0,0101 ; +0,0012] (n = 286, NON significatif, même scorecard).
L'effet attendu vaut ≈ −(q − 0,5)² (q = taux blue walk-forward lck) ; au point estimé 2026
(≈ −0,0045) et au MDE afterBans-lck (≈ 0,0027), la détection est attendue BORDERLINE —
un VERT lck/afterBans signifierait « en LCK, afficher ~q % après bans est plus honnête que 50 % » ;
un ROUGE, que l'avantage blue ne tient pas sur 2025-2026 au niveau requis. LES DEUX lectures sont
écrites dans la règle, avant le run.
```

#### Fiabilité (10 bacs) — lec · afterBans · bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 0 | — | — | — | — |
| [0,5 ; 0,6) | 470 | 55,3 % | 54,7 % | [50,2 ; 59,1] % | 0,7 pp |
| [0,6 ; 0,7) | 0 | — | — | — | — |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

#### Fiabilité (10 bacs) — lec · afterBans · bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 0 | — | — | — | — |
| [0,5 ; 0,6) | 470 | 50,0 % | 54,7 % | [50,2 ; 59,1] % | -4,7 pp |
| [0,6 ; 0,7) | 0 | — | — | — | — |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

### lec · after3Picks — après les trois premiers picks (seq ≤ 9)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 470 | 0,2494 | 0,6920 | 54,7 % |
| Non calibré (p_raw) | 470 | 0,2496 | 0,6923 | 51,5 % |
| Pièce p = 0,5 | 470 | 0,2500 | 0,6931 | 50,0 % |
| Side-only ligue (descriptif, baseline M3.5) | 470 | 0,2487 | 0,6906 | 54,7 % |

- **ΔBrier (critère du verdict)** : Δ = -0,00014 · IC 95 % apparié [-0,00631 ; 0,00567]
- Δ log loss (secondaire, descriptif) : Δ = -0,00026 · IC 95 % [-0,01216 ; 0,01158]
- IC clusterisé par série (SECONDAIRE, sans pouvoir de verdict — limite déclarée §1) : Δ = -0,00014 · IC 95 % [-0,00572 ; 0,00590] (217 clusters / 470 games)
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00631 ; 0,00567]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data DE LA LIGUE (shippé, jamais utilisé pour les métriques) : a = 0,176884, b = 0,282357, nTrain = 554, validated = false (= verdict VERT ∧ b > 0).

#### Fiabilité (10 bacs) — lec · after3Picks · bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 10 | 48,4 % | 50,0 % | [23,7 ; 76,3] % | -1,6 pp |
| [0,5 ; 0,6) | 457 | 55,5 % | 54,7 % | [50,1 ; 59,2] % | 0,8 pp |
| [0,6 ; 0,7) | 3 | 62,0 % | 66,7 % | [20,8 ; 93,9] % | -4,7 pp |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

#### Fiabilité (10 bacs) — lec · after3Picks · bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 1 | 39,0 % | 100,0 % | [20,7 ; 100,0] % | -61,0 pp |
| [0,4 ; 0,5) | 210 | 47,6 % | 53,3 % | [46,6 ; 60,0] % | -5,7 pp |
| [0,5 ; 0,6) | 259 | 52,5 % | 55,6 % | [49,5 ; 61,5] % | -3,1 pp |
| [0,6 ; 0,7) | 0 | — | — | — | — |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

### lec · fullDraft — draft complète verrouillée (seq ≤ 20, 5 + 5 picks)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 470 | 0,2462 | 0,6854 | 54,7 % |
| Non calibré (p_raw) | 470 | 0,2466 | 0,6862 | 55,3 % |
| Pièce p = 0,5 | 470 | 0,2500 | 0,6931 | 50,0 % |
| Side-only ligue (descriptif, baseline M3.5) | 470 | 0,2487 | 0,6906 | 54,7 % |

- **ΔBrier (critère du verdict)** : Δ = -0,00044 · IC 95 % apparié [-0,00652 ; 0,00560]
- Δ log loss (secondaire, descriptif) : Δ = -0,00083 · IC 95 % [-0,01402 ; 0,01178]
- IC clusterisé par série (SECONDAIRE, sans pouvoir de verdict — limite déclarée §1) : Δ = -0,00044 · IC 95 % [-0,00669 ; 0,00572] (217 clusters / 470 games)
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00652 ; 0,00560]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data DE LA LIGUE (shippé, jamais utilisé pour les métriques) : a = 0,188776, b = 0,703570, nTrain = 554, validated = false (= verdict VERT ∧ b > 0).

#### Fiabilité (10 bacs) — lec · fullDraft · bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 3 | 37,1 % | 0,0 % | [0,0 ; 56,2] % | 37,1 pp |
| [0,4 ; 0,5) | 65 | 46,7 % | 52,3 % | [40,4 ; 64,0] % | -5,6 pp |
| [0,5 ; 0,6) | 313 | 55,4 % | 55,0 % | [49,4 ; 60,4] % | 0,4 pp |
| [0,6 ; 0,7) | 87 | 62,7 % | 56,3 % | [45,9 ; 66,3] % | 6,4 pp |
| [0,7 ; 0,8) | 2 | 73,0 % | 100,0 % | [34,2 ; 100,0] % | -27,0 pp |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

#### Fiabilité (10 bacs) — lec · fullDraft · bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 3 | 27,8 % | 0,0 % | [0,0 ; 56,2] % | 27,8 pp |
| [0,3 ; 0,4) | 50 | 36,5 % | 46,0 % | [33,0 ; 59,6] % | -9,5 pp |
| [0,4 ; 0,5) | 172 | 45,5 % | 51,2 % | [43,7 ; 58,5] % | -5,7 pp |
| [0,5 ; 0,6) | 200 | 54,1 % | 60,0 % | [53,1 ; 66,5] % | -5,9 pp |
| [0,6 ; 0,7) | 42 | 62,9 % | 57,1 % | [42,2 ; 70,9] % | 5,7 pp |
| [0,7 ; 0,8) | 3 | 72,7 % | 66,7 % | [20,8 ; 93,9] % | 6,0 pp |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

## Ligue lfl

- Corpus : lfl-2026.json + lfl-2025.json — 508 éligibles.
- Timeline ordonnée des groupes de patch (éligibles) : 14.16 (11, train-only) → 25.S1.1 (23, train-only) → 25.S1.2 (24, train-only) → 25.S1.3 (16) → 25.07 (30) → 25.08 (29) → 25.09 (24) → 25.10 (23) → 25.14 (40) → 25.15 (41) → 25.16 (31) → 25.17 (37) → 26.01 (10) → 26.02 (30) → 26.03 (33) → 26.04 (24) → 26.07 (30) → 26.08 (15) → 26.09 (13) → 26.10 (24)
- Groupes train-only en tête (jamais scorés, sous minTrainSize = 50) : 14.16 (11), 25.S1.1 (23), 25.S1.2 (24)
- Folds scorés : 17 — premier fold : patch 25.S1.3 (n = 16)

### lfl · afterBans — après la première phase de bans (seq ≤ 6, 0 pick verrouillé)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 450 | 0,2481 | 0,6893 | 55,3 % |
| Non calibré (p_raw) | 450 | 0,2500 | 0,6931 | 50,0 % |
| Pièce p = 0,5 | 450 | 0,2500 | 0,6931 | 50,0 % |
| Side-only ligue (descriptif, baseline M3.5) | 450 | 0,2481 | 0,6893 | 55,3 % |

- **ΔBrier (critère du verdict)** : Δ = -0,00193 · IC 95 % apparié [-0,00846 ; 0,00443]
- Δ log loss (secondaire, descriptif) : Δ = -0,00383 · IC 95 % [-0,01605 ; 0,00871]
- IC clusterisé par série (SECONDAIRE, sans pouvoir de verdict — limite déclarée §1) : Δ = -0,00193 · IC 95 % [-0,00878 ; 0,00465] (264 clusters / 450 games)
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00846 ; 0,00443]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data DE LA LIGUE (shippé, jamais utilisé pour les métriques) : a = 0,205444, b = 1,000000, nTrain = 508, validated = false (= verdict VERT ∧ b > 0).

```
ATTENDU DÉCLARÉ D'AVANCE : afterBans dégénère en side-only PAR LIGUE (p_raw ≡ 0,5 ⇒ b sans
information, a = logit du taux blue du train de la ligue). Le run #2 a publié : side-only
lec/lfl/lpl ≈ pile-ou-face ⇒ rouges probables, qui seraient des CONFIRMATIONS d'honnêteté
(le 50 % post-bans y est déjà honnête) ; side-only LCK 2026 : accuracy +8,4 pp SIGNIFICATIVE
([+2,8 ; +14,0], scorecard lck-2026-26.11) MAIS, sur l'échelle MÊME du verdict E3, ΔBrier
side-only vs pièce = −0,0045 [−0,0101 ; +0,0012] (n = 286, NON significatif, même scorecard).
L'effet attendu vaut ≈ −(q − 0,5)² (q = taux blue walk-forward lck) ; au point estimé 2026
(≈ −0,0045) et au MDE afterBans-lck (≈ 0,0027), la détection est attendue BORDERLINE —
un VERT lck/afterBans signifierait « en LCK, afficher ~q % après bans est plus honnête que 50 % » ;
un ROUGE, que l'avantage blue ne tient pas sur 2025-2026 au niveau requis. LES DEUX lectures sont
écrites dans la règle, avant le run.
```

#### Fiabilité (10 bacs) — lfl · afterBans · bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 0 | — | — | — | — |
| [0,5 ; 0,6) | 450 | 57,0 % | 55,3 % | [50,7 ; 59,9] % | 1,6 pp |
| [0,6 ; 0,7) | 0 | — | — | — | — |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

#### Fiabilité (10 bacs) — lfl · afterBans · bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 0 | — | — | — | — |
| [0,5 ; 0,6) | 450 | 50,0 % | 55,3 % | [50,7 ; 59,9] % | -5,3 pp |
| [0,6 ; 0,7) | 0 | — | — | — | — |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

### lfl · after3Picks — après les trois premiers picks (seq ≤ 9)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 450 | 0,2494 | 0,6920 | 54,7 % |
| Non calibré (p_raw) | 450 | 0,2497 | 0,6926 | 51,3 % |
| Pièce p = 0,5 | 450 | 0,2500 | 0,6931 | 50,0 % |
| Side-only ligue (descriptif, baseline M3.5) | 450 | 0,2481 | 0,6893 | 55,3 % |

- **ΔBrier (critère du verdict)** : Δ = -0,00032 · IC 95 % apparié [-0,00677 ; 0,00602]
- Δ log loss (secondaire, descriptif) : Δ = -0,00063 · IC 95 % [-0,01480 ; 0,01263]
- IC clusterisé par série (SECONDAIRE, sans pouvoir de verdict — limite déclarée §1) : Δ = -0,00032 · IC 95 % [-0,00640 ; 0,00669] (264 clusters / 450 games)
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00677 ; 0,00602]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data DE LA LIGUE (shippé, jamais utilisé pour les métriques) : a = 0,201724, b = 0,271778, nTrain = 508, validated = false (= verdict VERT ∧ b > 0).

#### Fiabilité (10 bacs) — lfl · after3Picks · bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 5 | 48,7 % | 80,0 % | [37,6 ; 96,4] % | -31,3 pp |
| [0,5 ; 0,6) | 388 | 56,6 % | 54,9 % | [49,9 ; 59,8] % | 1,7 pp |
| [0,6 ; 0,7) | 57 | 61,9 % | 56,1 % | [43,3 ; 68,2] % | 5,7 pp |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

#### Fiabilité (10 bacs) — lfl · after3Picks · bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 192 | 47,7 % | 54,7 % | [47,6 ; 61,6] % | -7,0 pp |
| [0,5 ; 0,6) | 257 | 52,4 % | 55,6 % | [49,5 ; 61,6] % | -3,2 pp |
| [0,6 ; 0,7) | 1 | 60,0 % | 100,0 % | [20,7 ; 100,0] % | -40,0 pp |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

### lfl · fullDraft — draft complète verrouillée (seq ≤ 20, 5 + 5 picks)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 450 | 0,2491 | 0,6914 | 54,4 % |
| Non calibré (p_raw) | 450 | 0,2511 | 0,6955 | 51,1 % |
| Pièce p = 0,5 | 450 | 0,2500 | 0,6931 | 50,0 % |
| Side-only ligue (descriptif, baseline M3.5) | 450 | 0,2481 | 0,6893 | 55,3 % |

- **ΔBrier (critère du verdict)** : Δ = -0,00200 · IC 95 % apparié [-0,01086 ; 0,00689]
- Δ log loss (secondaire, descriptif) : Δ = -0,00411 · IC 95 % [-0,02190 ; 0,01311]
- IC clusterisé par série (SECONDAIRE, sans pouvoir de verdict — limite déclarée §1) : Δ = -0,00200 · IC 95 % [-0,01087 ; 0,00705] (264 clusters / 450 games)
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,01086 ; 0,00689]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data DE LA LIGUE (shippé, jamais utilisé pour les métriques) : a = 0,207467, b = 0,339881, nTrain = 508, validated = false (= verdict VERT ∧ b > 0).

#### Fiabilité (10 bacs) — lfl · fullDraft · bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 16 | 48,5 % | 62,5 % | [38,6 ; 81,5] % | -14,0 pp |
| [0,5 ; 0,6) | 355 | 56,5 % | 55,2 % | [50,0 ; 60,3] % | 1,3 pp |
| [0,6 ; 0,7) | 79 | 61,7 % | 54,4 % | [43,5 ; 65,0] % | 7,3 pp |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

#### Fiabilité (10 bacs) — lfl · fullDraft · bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 4 | 27,8 % | 25,0 % | [4,6 ; 69,9] % | 2,8 pp |
| [0,3 ; 0,4) | 53 | 36,7 % | 35,8 % | [24,3 ; 49,3] % | 0,9 pp |
| [0,4 ; 0,5) | 158 | 45,6 % | 61,4 % | [53,6 ; 68,6] % | -15,7 pp |
| [0,5 ; 0,6) | 181 | 54,0 % | 55,8 % | [48,5 ; 62,8] % | -1,8 pp |
| [0,6 ; 0,7) | 52 | 63,0 % | 57,7 % | [44,2 ; 70,1] % | 5,3 pp |
| [0,7 ; 0,8) | 2 | 71,0 % | 50,0 % | [9,5 ; 90,5] % | 21,0 pp |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

## Ligue lpl

- Corpus : lpl-2026.json + lpl-2025.json — 1260 éligibles.
- Timeline ordonnée des groupes de patch (éligibles) : 25.S1.1 (43, train-only) → 25.S1.2 (45, train-only) → 25.04 (42) → 25.06 (60) → 25.07 (82) → 25.08 (76) → 25.09 (101) → 25.10 (15) → 25.11 (56) → 25.14 (83) → 25.15 (81) → 25.16 (63) → 25.17 (70) → 26.01 (75) → 26.02 (83) → 26.03 (54) → 26.07 (59) → 26.08 (49) → 26.09 (63) → 26.10 (60)
- Groupes train-only en tête (jamais scorés, sous minTrainSize = 50) : 25.S1.1 (43), 25.S1.2 (45)
- Folds scorés : 18 — premier fold : patch 25.04 (n = 42)

### lpl · afterBans — après la première phase de bans (seq ≤ 6, 0 pick verrouillé)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 1172 | 0,2511 | 0,6953 | 51,1 % |
| Non calibré (p_raw) | 1172 | 0,2500 | 0,6931 | 50,0 % |
| Pièce p = 0,5 | 1172 | 0,2500 | 0,6931 | 50,0 % |
| Side-only ligue (descriptif, baseline M3.5) | 1172 | 0,2511 | 0,6953 | 51,1 % |

- **ΔBrier (critère du verdict)** : Δ = 0,00108 · IC 95 % apparié [-0,00090 ; 0,00286]
- Δ log loss (secondaire, descriptif) : Δ = 0,00219 · IC 95 % [-0,00152 ; 0,00583]
- IC clusterisé par série (SECONDAIRE, sans pouvoir de verdict — limite déclarée §1) : Δ = 0,00108 · IC 95 % [-0,00101 ; 0,00312] (456 clusters / 1172 games)
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00090 ; 0,00286]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data DE LA LIGUE (shippé, jamais utilisé pour les métriques) : a = 0,092129, b = 1,000000, nTrain = 1260, validated = false (= verdict VERT ∧ b > 0).

```
ATTENDU DÉCLARÉ D'AVANCE : afterBans dégénère en side-only PAR LIGUE (p_raw ≡ 0,5 ⇒ b sans
information, a = logit du taux blue du train de la ligue). Le run #2 a publié : side-only
lec/lfl/lpl ≈ pile-ou-face ⇒ rouges probables, qui seraient des CONFIRMATIONS d'honnêteté
(le 50 % post-bans y est déjà honnête) ; side-only LCK 2026 : accuracy +8,4 pp SIGNIFICATIVE
([+2,8 ; +14,0], scorecard lck-2026-26.11) MAIS, sur l'échelle MÊME du verdict E3, ΔBrier
side-only vs pièce = −0,0045 [−0,0101 ; +0,0012] (n = 286, NON significatif, même scorecard).
L'effet attendu vaut ≈ −(q − 0,5)² (q = taux blue walk-forward lck) ; au point estimé 2026
(≈ −0,0045) et au MDE afterBans-lck (≈ 0,0027), la détection est attendue BORDERLINE —
un VERT lck/afterBans signifierait « en LCK, afficher ~q % après bans est plus honnête que 50 % » ;
un ROUGE, que l'avantage blue ne tient pas sur 2025-2026 au niveau requis. LES DEUX lectures sont
écrites dans la règle, avant le run.
```

#### Fiabilité (10 bacs) — lpl · afterBans · bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 184 | 46,7 % | 56,5 % | [49,3 ; 63,5] % | -9,8 pp |
| [0,5 ; 0,6) | 988 | 52,9 % | 52,5 % | [49,4 ; 55,6] % | 0,4 pp |
| [0,6 ; 0,7) | 0 | — | — | — | — |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

#### Fiabilité (10 bacs) — lpl · afterBans · bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 0 | — | — | — | — |
| [0,4 ; 0,5) | 0 | — | — | — | — |
| [0,5 ; 0,6) | 1172 | 50,0 % | 53,2 % | [50,3 ; 56,0] % | -3,2 pp |
| [0,6 ; 0,7) | 0 | — | — | — | — |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

### lpl · after3Picks — après les trois premiers picks (seq ≤ 9)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 1172 | 0,2504 | 0,6939 | 52,0 % |
| Non calibré (p_raw) | 1172 | 0,2488 | 0,6908 | 50,4 % |
| Pièce p = 0,5 | 1172 | 0,2500 | 0,6931 | 50,0 % |
| Side-only ligue (descriptif, baseline M3.5) | 1172 | 0,2511 | 0,6953 | 51,1 % |

- **ΔBrier (critère du verdict)** : Δ = 0,00155 · IC 95 % apparié [-0,00035 ; 0,00341]
- Δ log loss (secondaire, descriptif) : Δ = 0,00311 · IC 95 % [-0,00067 ; 0,00688]
- IC clusterisé par série (SECONDAIRE, sans pouvoir de verdict — limite déclarée §1) : Δ = 0,00155 · IC 95 % [-0,00032 ; 0,00354] (456 clusters / 1172 games)
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00035 ; 0,00341]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data DE LA LIGUE (shippé, jamais utilisé pour les métriques) : a = 0,076915, b = 1,073228, nTrain = 1260, validated = false (= verdict VERT ∧ b > 0).

#### Fiabilité (10 bacs) — lpl · after3Picks · bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 14 | 38,4 % | 57,1 % | [32,6 ; 78,6] % | -18,7 pp |
| [0,4 ; 0,5) | 323 | 46,6 % | 51,7 % | [46,3 ; 57,1] % | -5,1 pp |
| [0,5 ; 0,6) | 800 | 53,8 % | 53,1 % | [49,7 ; 56,6] % | 0,7 pp |
| [0,6 ; 0,7) | 35 | 62,1 % | 65,7 % | [49,2 ; 79,2] % | -3,6 pp |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

#### Fiabilité (10 bacs) — lpl · after3Picks · bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 1 | 39,1 % | 100,0 % | [20,7 ; 100,0] % | -60,9 pp |
| [0,4 ; 0,5) | 507 | 47,8 % | 53,1 % | [48,7 ; 57,4] % | -5,2 pp |
| [0,5 ; 0,6) | 664 | 52,3 % | 53,2 % | [49,4 ; 56,9] % | -0,8 pp |
| [0,6 ; 0,7) | 0 | — | — | — | — |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

### lpl · fullDraft — draft complète verrouillée (seq ≤ 20, 5 + 5 picks)

| Bras | n | Brier | Log loss | Accuracy |
|---|---|---|---|---|
| Calibré σ(a + b·logit(p_raw)) | 1172 | 0,2491 | 0,6914 | 53,7 % |
| Non calibré (p_raw) | 1172 | 0,2485 | 0,6901 | 53,2 % |
| Pièce p = 0,5 | 1172 | 0,2500 | 0,6931 | 50,0 % |
| Side-only ligue (descriptif, baseline M3.5) | 1172 | 0,2511 | 0,6953 | 51,1 % |

- **ΔBrier (critère du verdict)** : Δ = 0,00062 · IC 95 % apparié [-0,00215 ; 0,00341]
- Δ log loss (secondaire, descriptif) : Δ = 0,00130 · IC 95 % [-0,00487 ; 0,00694]
- IC clusterisé par série (SECONDAIRE, sans pouvoir de verdict — limite déclarée §1) : Δ = 0,00062 · IC 95 % [-0,00231 ; 0,00358] (456 clusters / 1172 games)
- **Verdict : ROUGE — l'IC 95 % de ΔBrier ([-0,00215 ; 0,00341]) ne reste pas sous 0 : pas d'amélioration démontrée, le % brut reste affiché (badge « Non calibré » conservé).**
- Fit final full-data DE LA LIGUE (shippé, jamais utilisé pour les métriques) : a = 0,092718, b = 0,590421, nTrain = 1260, validated = false (= verdict VERT ∧ b > 0).

#### Fiabilité (10 bacs) — lpl · fullDraft · bras CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 0 | — | — | — | — |
| [0,2 ; 0,3) | 0 | — | — | — | — |
| [0,3 ; 0,4) | 30 | 38,4 % | 53,3 % | [36,1 ; 69,8] % | -14,9 pp |
| [0,4 ; 0,5) | 376 | 46,8 % | 48,9 % | [43,9 ; 54,0] % | -2,1 pp |
| [0,5 ; 0,6) | 709 | 54,2 % | 54,4 % | [50,8 ; 58,1] % | -0,2 pp |
| [0,6 ; 0,7) | 57 | 61,8 % | 64,9 % | [51,9 ; 76,0] % | -3,1 pp |
| [0,7 ; 0,8) | 0 | — | — | — | — |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

#### Fiabilité (10 bacs) — lpl · fullDraft · bras NON CALIBRÉ

| Bac | n | p moyen | Taux observé | Wilson 95 % | Écart (p − observé) |
|---|---|---|---|---|---|
| [0,0 ; 0,1) | 0 | — | — | — | — |
| [0,1 ; 0,2) | 1 | 19,3 % | 0,0 % | [0,0 ; 79,3] % | 19,3 pp |
| [0,2 ; 0,3) | 7 | 28,2 % | 42,9 % | [15,8 ; 75,0] % | -14,7 pp |
| [0,3 ; 0,4) | 140 | 36,7 % | 44,3 % | [36,3 ; 52,6] % | -7,5 pp |
| [0,4 ; 0,5) | 428 | 45,9 % | 52,1 % | [47,4 ; 56,8] % | -6,2 pp |
| [0,5 ; 0,6) | 471 | 54,6 % | 54,6 % | [50,0 ; 59,0] % | 0,0 pp |
| [0,6 ; 0,7) | 122 | 63,2 % | 62,3 % | [53,4 ; 70,4] % | 0,9 pp |
| [0,7 ; 0,8) | 3 | 72,5 % | 66,7 % | [20,8 ; 93,9] % | 5,8 pp |
| [0,8 ; 0,9) | 0 | — | — | — | — |
| [0,9 ; 1,0] | 0 | — | — | — | — |

## Récapitulatif des 12 cellules (toutes publiées ensemble)

| Ligue | Position | ΔBrier | IC 95 % apparié | IC clusterisé (secondaire, §1 LIMITE DÉCLARÉE) | Verdict | a | b | validated |
|---|---|---|---|---|---|---|---|---|
| lck | afterBans | 0,00065 | [-0,00259 ; 0,00386] | [-0,00275 ; 0,00455] | ROUGE | 0,134733 | 1,000000 | false |
| lck | after3Picks | 0,00109 | [-0,00257 ; 0,00507] | [-0,00279 ; 0,00543] | ROUGE | 0,135591 | -0,046840 | false |
| lck | fullDraft | -0,00045 | [-0,00521 ; 0,00404] | [-0,00540 ; 0,00489] | ROUGE | 0,134585 | 0,386461 | false |
| lec | afterBans | -0,00129 | [-0,00624 ; 0,00388] | [-0,00594 ; 0,00336] | ROUGE | 0,180998 | 1,000000 | false |
| lec | after3Picks | -0,00014 | [-0,00631 ; 0,00567] | [-0,00572 ; 0,00590] | ROUGE | 0,176884 | 0,282357 | false |
| lec | fullDraft | -0,00044 | [-0,00652 ; 0,00560] | [-0,00669 ; 0,00572] | ROUGE | 0,188776 | 0,703570 | false |
| lfl | afterBans | -0,00193 | [-0,00846 ; 0,00443] | [-0,00878 ; 0,00465] | ROUGE | 0,205444 | 1,000000 | false |
| lfl | after3Picks | -0,00032 | [-0,00677 ; 0,00602] | [-0,00640 ; 0,00669] | ROUGE | 0,201724 | 0,271778 | false |
| lfl | fullDraft | -0,00200 | [-0,01086 ; 0,00689] | [-0,01087 ; 0,00705] | ROUGE | 0,207467 | 0,339881 | false |
| lpl | afterBans | 0,00108 | [-0,00090 ; 0,00286] | [-0,00101 ; 0,00312] | ROUGE | 0,092129 | 1,000000 | false |
| lpl | after3Picks | 0,00155 | [-0,00035 ; 0,00341] | [-0,00032 ; 0,00354] | ROUGE | 0,076915 | 1,073228 | false |
| lpl | fullDraft | 0,00062 | [-0,00215 ; 0,00341] | [-0,00231 ; 0,00358] | ROUGE | 0,092718 | 0,590421 | false |

## Multiplicité et corrélation intra-série (verbatim, gelées dans la règle)

```
MULTIPLICITÉ DÉCLARÉE : sous le nul global, ~0,3 faux vert attendu sur 12 cellules
(P(≥1 faux vert) ≈ 26 %) — aucun ajustement (chaque cellule porte une décision produit LOCALE et
réversible au re-run) ; le rapport publie les 12 verdicts ensemble et chaque claim cite SA cellule.
LIMITE DÉCLARÉE — corrélation intra-série : les games d'une même série (Bo3/Bo5, mêmes équipes) sont
corrélées ; le bootstrap apparié PAR GAME (convention v1, conservée pour la comparabilité et la porte
de validité) est anticonservateur sous cette corrélation — les ~0,3 faux verts attendus sont une
borne basse. SECONDAIRE PUBLIÉ, sans pouvoir de verdict : pour chacune des 12 cellules, IC 95 % du
même ΔBrier par clusterBootstrapDeltaCI (cluster = series.matchId, une game sans série = son propre
cluster ; observations appariées model = (p_cal − y)², baseline = (p_raw − y)² par game ;
1000 resamples), consommé sur le MÊME flux mulberry32(seed 42) APRÈS les 24 IC primaires, dans
l'ordre gelé des cellules (lck → lec → lfl → lpl × afterBans → after3Picks → fullDraft). Toute
cellule VERTE dont l'IC clusterisé recouvre 0 cite cet écart verbatim dans son claim produit.
```

## Artefact shippé (version 2)

Artefact : `data/calibration/winCalibration.json` — TOUJOURS écrit, quel que soit le verdict ; l'UI n'applique
JAMAIS une position validated:false (badge « Non calibré » conservé, % brut affiché).
Le champ `positions` (full-fit poolé des corpus passés) est PROVENANCE/COMPARAISON SEULEMENT,
validated:false FORCÉ par construction — aucun verdict poolé n'existe dans ce run ; le repli
d'une ligue sans carte est le PASSTHROUGH, jamais la carte poolée (D3, gelé).

| Ligue | nGames | fittedThroughPatch | afterBans (a · b · validated) | after3Picks (a · b · validated) | fullDraft (a · b · validated) |
|---|---|---|---|---|---|
| lck | 892 | 26.11 | 0,134733 · 1,000000 · false | 0,135591 · -0,046840 · false | 0,134585 · 0,386461 · false |
| lec | 554 | 26.10 | 0,180998 · 1,000000 · false | 0,176884 · 0,282357 · false | 0,188776 · 0,703570 · false |
| lfl | 508 | 26.10 | 0,205444 · 1,000000 · false | 0,201724 · 0,271778 · false | 0,207467 · 0,339881 · false |
| lpl | 1260 | 26.10 | 0,092129 · 1,000000 · false | 0,076915 · 1,073228 · false | 0,092718 · 0,590421 · false |
| _poolé (provenance)_ | 3214 | 26.11 | 0,137115 · 1,000000 · false | 0,129753 · 0,482173 · false | 0,138763 · 0,516032 · false |

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
TROIS APPROXIMATIONS D'APPLICATION (déclarées ici, reprises dans le rapport et l'aide produit) :
  (a) la calibration est mesurée aux trois ancres 0 / 3 / 10 picks verrouillés ; une position
      intermédiaire reçoit la carte de l'ancre que la partition positionOf lui assigne
      (0 → afterBans ; 1..6 → after3Picks ; 7..10 → fullDraft), jamais une interpolation ;
  (b) à l'application, le % du coach passe par des rôles INFÉRÉS et le mode séquence par l'argmax des
      rolePriors, alors que la mesure utilise les rôles RÉELS du corpus — l'écart d'attribution de
      rôles n'est pas couvert par le claim ;
  (c) les cartes sont mesurées sur des games INTRA-ligue (les deux équipes de la même ligue) ; une
      draft inter-ligues (leagueIdB ≠ leagueIdA) reçoit la carte de la ligue du camp affiché — l'écart
      n'est pas couvert par le claim.
```
