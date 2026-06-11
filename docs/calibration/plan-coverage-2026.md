# Gate D — couverture des plans à branches (modèle équipe vs prior ligue)

> Généré : 2026-06-11T11:58:47.475Z · seed 42 · règle pré-enregistrée gelée dans
> `scripts/backtest/planCoverage.ts` (copie de `docs/run2/D-plans-branches.md` §1).

## Corpus évalués

- `static/corpus/lck-2026.json`
- `static/corpus/lec-2026.json`
- `static/corpus/lfl-2026.json`
- `static/corpus/lpl-2026.json`
- `data/corpus/lec-2025.json`
- `data/corpus/lfl-2025.json`
- `data/corpus/lpl-2025.json`

## Verdict (critère PRIMAIRE, §1.6)

- Unités éligibles (m ≥ 6) : 4868 sur 4868 (pool).
- Profondeur moyenne tenue à K = 4 (plafond 6) : modèle 0.725 vs baseline ligue 0.588.
- Δ = 0.1368 ; IC bootstrap 95 % apparié-clusterisé par game (mulberry32(42), 1000 resamples, 2434 clusters, 4868 unités) : [0.1111 ; 0.1619].

**VERDICT : VERT** — lo(IC) > 0. Le modèle équipe couvre strictement mieux que le prior ligue.

- Identité structurelle (publiée, K = 4) : moyenne(D) = Σ survive — modèle 0.725 = 0.725 ; baseline 0.588 = 0.588.
- Plancher descriptif (présence brute, jamais de verdict) : moyenne(D) = 0.561.

> Caveat ordre : couverture mesurée sous entrelacement supposé blue-first (ordre
> intra-équipe exact, alternance entre équipes conventionnelle) — biais PARTAGÉ par
> les deux bras (§3 risque 9), le delta n’est pas contaminé.

## Grille complète survive(K, P) — pool (§1.5)

### K = 1

| P | n | Bras A — modèle équipe (Wilson 95 %) | Bras B — prior ligue (Wilson 95 %) |
|---|---|---|---|
| 1 | 4868 | 19.4 % [18.3 ; 20.5] | 15.3 % [14.3 ; 16.3] |
| 2 | 4868 | 3.0 % [2.5 ; 3.5] | 1.6 % [1.3 ; 2.0] |
| 3 | 4868 | 0.2 % [0.1 ; 0.4] | 0.2 % [0.1 ; 0.4] |
| 4 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 5 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 6 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 7 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 8 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 9 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 10 | 4856 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |

### K = 2

| P | n | Bras A — modèle équipe (Wilson 95 %) | Bras B — prior ligue (Wilson 95 %) |
|---|---|---|---|
| 1 | 4868 | 32.2 % [30.9 ; 33.6] | 26.0 % [24.8 ; 27.3] |
| 2 | 4868 | 8.0 % [7.3 ; 8.8] | 5.5 % [4.9 ; 6.2] |
| 3 | 4868 | 1.6 % [1.3 ; 2.0] | 1.0 % [0.7 ; 1.3] |
| 4 | 4868 | 0.3 % [0.2 ; 0.5] | 0.1 % [0.0 ; 0.2] |
| 5 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 6 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 7 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 8 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 9 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 10 | 4856 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |

### K = 4

| P | n | Bras A — modèle équipe (Wilson 95 %) | Bras B — prior ligue (Wilson 95 %) |
|---|---|---|---|
| 1 | 4868 | 46.5 % [45.1 ; 47.9] | 40.1 % [38.8 ; 41.5] |
| 2 | 4868 | 18.0 % [17.0 ; 19.1] | 13.4 % [12.5 ; 14.4] |
| 3 | 4868 | 5.6 % [5.0 ; 6.2] | 3.7 % [3.2 ; 4.3] |
| 4 | 4868 | 1.8 % [1.5 ; 2.2] | 1.1 % [0.9 ; 1.5] |
| 5 | 4868 | 0.5 % [0.4 ; 0.8] | 0.4 % [0.3 ; 0.6] |
| 6 | 4868 | 0.1 % [0.1 ; 0.3] | 0.0 % [0.0 ; 0.1] |
| 7 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 8 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 9 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 10 | 4856 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |

### K = 6

| P | n | Bras A — modèle équipe (Wilson 95 %) | Bras B — prior ligue (Wilson 95 %) |
|---|---|---|---|
| 1 | 4868 | 55.7 % [54.3 ; 57.1] | 50.7 % [49.3 ; 52.1] |
| 2 | 4868 | 27.1 % [25.9 ; 28.4] | 21.5 % [20.4 ; 22.7] |
| 3 | 4868 | 10.7 % [9.9 ; 11.6] | 8.2 % [7.5 ; 9.0] |
| 4 | 4868 | 4.1 % [3.6 ; 4.7] | 3.1 % [2.7 ; 3.6] |
| 5 | 4868 | 1.6 % [1.2 ; 1.9] | 1.1 % [0.9 ; 1.5] |
| 6 | 4868 | 0.4 % [0.3 ; 0.6] | 0.2 % [0.1 ; 0.4] |
| 7 | 4868 | 0.1 % [0.1 ; 0.3] | 0.0 % [0.0 ; 0.1] |
| 8 | 4868 | 0.1 % [0.0 ; 0.2] | 0.0 % [0.0 ; 0.1] |
| 9 | 4868 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |
| 10 | 4856 | 0.0 % [0.0 ; 0.1] | 0.0 % [0.0 ; 0.1] |

### K = 8

| P | n | Bras A — modèle équipe (Wilson 95 %) | Bras B — prior ligue (Wilson 95 %) |
|---|---|---|---|
| 1 | 4868 | 62.4 % [61.1 ; 63.8] | 57.9 % [56.5 ; 59.2] |
| 2 | 4868 | 34.0 % [32.7 ; 35.3] | 29.6 % [28.4 ; 30.9] |
| 3 | 4868 | 15.6 % [14.6 ; 16.6] | 13.6 % [12.6 ; 14.5] |
| 4 | 4868 | 7.0 % [6.3 ; 7.8] | 6.3 % [5.6 ; 7.0] |
| 5 | 4868 | 2.8 % [2.3 ; 3.3] | 2.8 % [2.4 ; 3.3] |
| 6 | 4868 | 0.8 % [0.6 ; 1.1] | 0.7 % [0.5 ; 1.0] |
| 7 | 4868 | 0.3 % [0.2 ; 0.5] | 0.3 % [0.2 ; 0.5] |
| 8 | 4868 | 0.2 % [0.1 ; 0.3] | 0.1 % [0.0 ; 0.2] |
| 9 | 4868 | 0.1 % [0.0 ; 0.2] | 0.0 % [0.0 ; 0.1] |
| 10 | 4856 | 0.0 % [0.0 ; 0.2] | 0.0 % [0.0 ; 0.1] |

### Plancher descriptif — présence brute (colonne K = 4)

| P | n | Survie (Wilson 95 %) |
|---|---|---|
| 1 | 4868 | 39.5 % [38.2 ; 40.9] |
| 2 | 4868 | 12.2 % [11.3 ; 13.1] |
| 3 | 4868 | 3.5 % [3.0 ; 4.1] |
| 4 | 4868 | 0.7 % [0.5 ; 1.0] |
| 5 | 4868 | 0.1 % [0.1 ; 0.3] |
| 6 | 4868 | 0.0 % [0.0 ; 0.1] |
| 7 | 4868 | 0.0 % [0.0 ; 0.1] |
| 8 | 4868 | 0.0 % [0.0 ; 0.1] |
| 9 | 4868 | 0.0 % [0.0 ; 0.1] |
| 10 | 4856 | 0.0 % [0.0 ; 0.1] |

## Taux par action à K = 4 (descriptif — le complément = taux d'alarme UI)

| SlotGroup | n actions | Modèle (Wilson 95 %) | Baseline (Wilson 95 %) |
|---|---|---|---|
| B1-B3 | 14600 | 35.9 % [35.2 ; 36.7] | 31.2 % [30.4 ; 31.9] |
| B4-B5 | 9728 | 14.9 % [14.2 ; 15.6] | 15.5 % [14.8 ; 16.3] |
| P1 | 2434 | 33.4 % [31.6 ; 35.3] | 32.7 % [30.9 ; 34.6] |
| P2-3 | 4868 | 25.0 % [23.8 ; 26.3] | 24.6 % [23.4 ; 25.8] |
| P4-5 | 4868 | 15.6 % [14.6 ; 16.6] | 13.9 % [13.0 ; 14.9] |
| P6 | 2434 | 14.5 % [13.1 ; 15.9] | 14.5 % [13.2 ; 16.0] |
| P7 | 2434 | 15.1 % [13.8 ; 16.6] | 17.9 % [16.4 ; 19.5] |
| P8-9 | 4868 | 15.8 % [14.8 ; 16.8] | 17.5 % [16.5 ; 18.6] |
| P10 | 2434 | 15.1 % [13.7 ; 16.6] | 17.5 % [16.1 ; 19.1] |

## Tranches descriptives (jamais promues en verdict)

| Tranche | n unités | moyenne(D) modèle | moyenne(D) baseline |
|---|---|---|---|
| équipe ≥ 10 games au train | 4072 | 0.727 | 0.562 |
| équipe < 10 games au train | 796 | 0.714 | 0.725 |

## Par corpus

### lck-2026.json

- 337 records → 286 games scorées → 572 unités (572 primaires m ≥ 6).
- Écartés : 0 sans patch parsable, 0 avec action non résolue, 51 premier patch ; unités écartées sans train daté : 0 ; unités m < 6 : 0.
- Caches gelés : 224 tables équipe pour 572 demandes (clé patch×équipe×jour) ; 8 tables ligue pour 572 demandes (clé patch).
- Point d'usage (K = 4, m ≥ 6) : moyenne(D) modèle 0.951 vs baseline 0.864.

| P | n | Modèle K = 4 (Wilson 95 %) | Baseline K = 4 (Wilson 95 %) |
|---|---|---|---|
| 1 | 572 | 58.4 % [54.3 ; 62.4] | 57.9 % [53.8 ; 61.8] |
| 2 | 572 | 24.5 % [21.1 ; 28.2] | 21.3 % [18.2 ; 24.9] |
| 3 | 572 | 8.7 % [6.7 ; 11.3] | 5.4 % [3.8 ; 7.6] |
| 4 | 572 | 2.4 % [1.5 ; 4.1] | 1.4 % [0.7 ; 2.7] |
| 5 | 572 | 1.0 % [0.5 ; 2.3] | 0.3 % [0.1 ; 1.3] |
| 6 | 572 | 0.0 % [0.0 ; 0.7] | 0.0 % [0.0 ; 0.7] |
| 7 | 572 | 0.0 % [0.0 ; 0.7] | 0.0 % [0.0 ; 0.7] |
| 8 | 572 | 0.0 % [0.0 ; 0.7] | 0.0 % [0.0 ; 0.7] |
| 9 | 572 | 0.0 % [0.0 ; 0.7] | 0.0 % [0.0 ; 0.7] |
| 10 | 572 | 0.0 % [0.0 ; 0.7] | 0.0 % [0.0 ; 0.7] |

### lec-2026.json

- 246 records → 228 games scorées → 456 unités (456 primaires m ≥ 6).
- Écartés : 0 sans patch parsable, 0 avec action non résolue, 18 premier patch ; unités écartées sans train daté : 0 ; unités m < 6 : 0.
- Caches gelés : 230 tables équipe pour 456 demandes (clé patch×équipe×jour) ; 7 tables ligue pour 456 demandes (clé patch).
- Point d'usage (K = 4, m ≥ 6) : moyenne(D) modèle 0.711 vs baseline 0.673.

| P | n | Modèle K = 4 (Wilson 95 %) | Baseline K = 4 (Wilson 95 %) |
|---|---|---|---|
| 1 | 456 | 43.6 % [39.2 ; 48.2] | 45.8 % [41.3 ; 50.4] |
| 2 | 456 | 18.4 % [15.1 ; 22.2] | 15.6 % [12.5 ; 19.2] |
| 3 | 456 | 6.1 % [4.3 ; 8.7] | 4.4 % [2.9 ; 6.7] |
| 4 | 456 | 2.2 % [1.2 ; 4.0] | 0.9 % [0.3 ; 2.2] |
| 5 | 456 | 0.7 % [0.2 ; 1.9] | 0.7 % [0.2 ; 1.9] |
| 6 | 456 | 0.0 % [0.0 ; 0.8] | 0.0 % [0.0 ; 0.8] |
| 7 | 456 | 0.0 % [0.0 ; 0.8] | 0.0 % [0.0 ; 0.8] |
| 8 | 456 | 0.0 % [0.0 ; 0.8] | 0.0 % [0.0 ; 0.8] |
| 9 | 456 | 0.0 % [0.0 ; 0.8] | 0.0 % [0.0 ; 0.8] |
| 10 | 455 | 0.0 % [0.0 ; 0.8] | 0.0 % [0.0 ; 0.8] |

### lfl-2026.json

- 191 records → 179 games scorées → 358 unités (358 primaires m ≥ 6).
- Écartés : 0 sans patch parsable, 0 avec action non résolue, 12 premier patch ; unités écartées sans train daté : 0 ; unités m < 6 : 0.
- Caches gelés : 273 tables équipe pour 358 demandes (clé patch×équipe×jour) ; 8 tables ligue pour 358 demandes (clé patch).
- Point d'usage (K = 4, m ≥ 6) : moyenne(D) modèle 0.729 vs baseline 0.623.

| P | n | Modèle K = 4 (Wilson 95 %) | Baseline K = 4 (Wilson 95 %) |
|---|---|---|---|
| 1 | 358 | 48.0 % [42.9 ; 53.2] | 43.6 % [38.5 ; 48.8] |
| 2 | 358 | 15.4 % [12.0 ; 19.5] | 11.2 % [8.3 ; 14.9] |
| 3 | 358 | 4.7 % [3.0 ; 7.5] | 4.2 % [2.6 ; 6.8] |
| 4 | 358 | 2.5 % [1.3 ; 4.7] | 2.2 % [1.1 ; 4.3] |
| 5 | 358 | 1.7 % [0.8 ; 3.6] | 0.8 % [0.3 ; 2.4] |
| 6 | 358 | 0.6 % [0.2 ; 2.0] | 0.3 % [0.0 ; 1.6] |
| 7 | 358 | 0.0 % [0.0 ; 1.1] | 0.0 % [0.0 ; 1.1] |
| 8 | 358 | 0.0 % [0.0 ; 1.1] | 0.0 % [0.0 ; 1.1] |
| 9 | 358 | 0.0 % [0.0 ; 1.1] | 0.0 % [0.0 ; 1.1] |
| 10 | 357 | 0.0 % [-0.0 ; 1.1] | 0.0 % [-0.0 ; 1.1] |

### lpl-2026.json

- 445 records → 368 games scorées → 736 unités (736 primaires m ≥ 6).
- Écartés : 2 sans patch parsable, 0 avec action non résolue, 75 premier patch ; unités écartées sans train daté : 0 ; unités m < 6 : 0.
- Caches gelés : 262 tables équipe pour 736 demandes (clé patch×équipe×jour) ; 6 tables ligue pour 736 demandes (clé patch).
- Point d'usage (K = 4, m ≥ 6) : moyenne(D) modèle 0.855 vs baseline 0.789.

| P | n | Modèle K = 4 (Wilson 95 %) | Baseline K = 4 (Wilson 95 %) |
|---|---|---|---|
| 1 | 736 | 54.2 % [50.6 ; 57.8] | 50.1 % [46.5 ; 53.7] |
| 2 | 736 | 21.9 % [19.0 ; 25.0] | 19.8 % [17.1 ; 22.9] |
| 3 | 736 | 6.1 % [4.6 ; 8.1] | 5.7 % [4.2 ; 7.6] |
| 4 | 736 | 2.4 % [1.6 ; 3.8] | 2.3 % [1.4 ; 3.7] |
| 5 | 736 | 0.5 % [0.2 ; 1.4] | 1.0 % [0.5 ; 2.0] |
| 6 | 736 | 0.3 % [0.1 ; 1.0] | 0.0 % [-0.0 ; 0.5] |
| 7 | 736 | 0.0 % [-0.0 ; 0.5] | 0.0 % [-0.0 ; 0.5] |
| 8 | 736 | 0.0 % [-0.0 ; 0.5] | 0.0 % [-0.0 ; 0.5] |
| 9 | 736 | 0.0 % [-0.0 ; 0.5] | 0.0 % [-0.0 ; 0.5] |
| 10 | 735 | 0.0 % [-0.0 ; 0.5] | 0.0 % [-0.0 ; 0.5] |

### lec-2025.json

- 308 records → 293 games scorées → 586 unités (586 primaires m ≥ 6).
- Écartés : 0 sans patch parsable, 0 avec action non résolue, 15 premier patch ; unités écartées sans train daté : 0 ; unités m < 6 : 0.
- Caches gelés : 256 tables équipe pour 586 demandes (clé patch×équipe×jour) ; 11 tables ligue pour 586 demandes (clé patch).
- Point d'usage (K = 4, m ≥ 6) : moyenne(D) modèle 0.630 vs baseline 0.491.

| P | n | Modèle K = 4 (Wilson 95 %) | Baseline K = 4 (Wilson 95 %) |
|---|---|---|---|
| 1 | 586 | 42.3 % [38.4 ; 46.4] | 35.3 % [31.6 ; 39.3] |
| 2 | 586 | 15.0 % [12.4 ; 18.1] | 9.4 % [7.3 ; 12.0] |
| 3 | 586 | 3.6 % [2.4 ; 5.4] | 2.7 % [1.7 ; 4.4] |
| 4 | 586 | 1.5 % [0.8 ; 2.9] | 1.4 % [0.7 ; 2.7] |
| 5 | 586 | 0.5 % [0.2 ; 1.5] | 0.3 % [0.1 ; 1.2] |
| 6 | 586 | 0.0 % [0.0 ; 0.7] | 0.0 % [0.0 ; 0.7] |
| 7 | 586 | 0.0 % [0.0 ; 0.7] | 0.0 % [0.0 ; 0.7] |
| 8 | 586 | 0.0 % [0.0 ; 0.7] | 0.0 % [0.0 ; 0.7] |
| 9 | 586 | 0.0 % [0.0 ; 0.7] | 0.0 % [0.0 ; 0.7] |
| 10 | 582 | 0.0 % [0.0 ; 0.7] | 0.0 % [0.0 ; 0.7] |

### lfl-2025.json

- 317 records → 306 games scorées → 612 unités (612 primaires m ≥ 6).
- Écartés : 0 sans patch parsable, 0 avec action non résolue, 11 premier patch ; unités écartées sans train daté : 0 ; unités m < 6 : 0.
- Caches gelés : 306 tables équipe pour 612 demandes (clé patch×équipe×jour) ; 11 tables ligue pour 612 demandes (clé patch).
- Point d'usage (K = 4, m ≥ 6) : moyenne(D) modèle 0.678 vs baseline 0.472.

| P | n | Modèle K = 4 (Wilson 95 %) | Baseline K = 4 (Wilson 95 %) |
|---|---|---|---|
| 1 | 612 | 43.5 % [39.6 ; 47.4] | 33.5 % [29.9 ; 37.3] |
| 2 | 612 | 16.8 % [14.1 ; 20.0] | 10.8 % [8.6 ; 13.5] |
| 3 | 612 | 5.7 % [4.1 ; 7.8] | 2.6 % [1.6 ; 4.2] |
| 4 | 612 | 1.1 % [0.6 ; 2.3] | 0.3 % [0.1 ; 1.2] |
| 5 | 612 | 0.5 % [0.2 ; 1.4] | 0.0 % [0.0 ; 0.6] |
| 6 | 612 | 0.2 % [0.0 ; 0.9] | 0.0 % [0.0 ; 0.6] |
| 7 | 612 | 0.0 % [0.0 ; 0.6] | 0.0 % [0.0 ; 0.6] |
| 8 | 612 | 0.0 % [0.0 ; 0.6] | 0.0 % [0.0 ; 0.6] |
| 9 | 612 | 0.0 % [0.0 ; 0.6] | 0.0 % [0.0 ; 0.6] |
| 10 | 611 | 0.0 % [0.0 ; 0.6] | 0.0 % [0.0 ; 0.6] |

### lpl-2025.json

- 817 records → 774 games scorées → 1548 unités (1548 primaires m ≥ 6).
- Écartés : 0 sans patch parsable, 0 avec action non résolue, 43 premier patch ; unités écartées sans train daté : 0 ; unités m < 6 : 0.
- Caches gelés : 543 tables équipe pour 1548 demandes (clé patch×équipe×jour) ; 12 tables ligue pour 1548 demandes (clé patch).
- Point d'usage (K = 4, m ≥ 6) : moyenne(D) modèle 0.638 vs baseline 0.441.

| P | n | Modèle K = 4 (Wilson 95 %) | Baseline K = 4 (Wilson 95 %) |
|---|---|---|---|
| 1 | 1548 | 41.6 % [39.2 ; 44.1] | 30.7 % [28.5 ; 33.1] |
| 2 | 1548 | 15.9 % [14.2 ; 17.8] | 9.9 % [8.6 ; 11.5] |
| 3 | 1548 | 4.8 % [3.9 ; 6.0] | 2.6 % [2.0 ; 3.6] |
| 4 | 1548 | 1.4 % [0.9 ; 2.1] | 0.5 % [0.3 ; 1.0] |
| 5 | 1548 | 0.1 % [0.0 ; 0.4] | 0.2 % [0.1 ; 0.6] |
| 6 | 1548 | 0.1 % [0.0 ; 0.4] | 0.0 % [0.0 ; 0.2] |
| 7 | 1548 | 0.0 % [0.0 ; 0.2] | 0.0 % [0.0 ; 0.2] |
| 8 | 1548 | 0.0 % [0.0 ; 0.2] | 0.0 % [0.0 ; 0.2] |
| 9 | 1548 | 0.0 % [0.0 ; 0.2] | 0.0 % [0.0 ; 0.2] |
| 10 | 1544 | 0.0 % [0.0 ; 0.2] | 0.0 % [0.0 ; 0.2] |

## Lecture honnête

> La survie jointe s'effondre mécaniquement avec P (≈ produit des taux par action)
> pour les DEUX bras — attendu et honnête (§3 risque 8). Le verdict est l'aire sous
> la courbe (moyenne de D) au point d'usage produit (K = 4, P ≤ 6), gelé avant le run.
> Ce run valide le squelette adverse (branches + alarme) — il ne dit RIEN de la
> qualité de NOS réponses (gate coach, chantier séparé).
