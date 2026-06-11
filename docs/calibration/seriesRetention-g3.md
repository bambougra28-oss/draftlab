# Gate G3-demande — postdiction de la demande série Fearless

> Généré : 2026-06-11T11:57:01.087Z · règle pré-enregistrée VERBATIM en tête de `scripts/backtest/seriesRetention.ts`
> (design gelé docs/run2/C-fearless-g3.md §1.1). Une règle, un run — tout rouge est gelé.
> Corpus en entrée : lck-2026.json, lec-2026.json, lfl-2026.json, lpl-2026.json, lec-2025.json, lfl-2025.json, lpl-2025.json.
> lck-2025.json absent ⇒ run sur les corpus fournis ; s’il arrive plus tard : réplication descriptive, verdict inchangé.

## TEST 0 — Fearless empirique, bloquant par tournoi

| Corpus | Tournoi | Séries multi-games | Picks ultérieurs | Re-picks | Re-bans d’un consommé | Verdict |
|---|---|---|---|---|---|---|
| lck-2026.json | LCK 2026 Road to MSI | 2 | 60 | 0 | 0 | Fearless confirmé |
| lck-2026.json | LCK 2026 Rounds 1-2 | 90 | 1140 | 0 | 0 | Fearless confirmé |
| lck-2026.json | LCK Cup 2026 | 40 | 850 | 0 | 0 | Fearless confirmé |
| lec-2026.json | LEC 2026 Spring | 45 | 660 | 0 | 0 | Fearless confirmé |
| lec-2026.json | LEC 2026 Spring Playoffs | 8 | 220 | 0 | 0 | Fearless confirmé |
| lec-2026.json | LEC 2026 Versus | 0 | 0 | 0 | 0 | Fearless confirmé |
| lec-2026.json | LEC 2026 Versus Playoffs | 14 | 250 | 0 | 0 | Fearless confirmé |
| lfl-2026.json | LFL 2026 Invitational | 6 | 180 | 0 | 0 | Fearless confirmé |
| lfl-2026.json | LFL 2026 Promotion | 3 | 90 | 0 | 0 | Fearless confirmé |
| lfl-2026.json | LFL 2026 Spring | 0 | 0 | 0 | 0 | Fearless confirmé |
| lfl-2026.json | LFL 2026 Spring Playoffs | 14 | 230 | 0 | 0 | Fearless confirmé |
| lpl-2026.json | LPL 2026 Split 1 | 55 | 820 | 0 | 0 | Fearless confirmé |
| lpl-2026.json | LPL 2026 Split 1 Playoffs | 20 | 570 | 0 | 0 | Fearless confirmé |
| lpl-2026.json | LPL 2026 Split 2 | 71 | 1000 | 0 | 0 | Fearless confirmé |
| lpl-2026.json | LPL 2026 Split 2 Playoffs | 16 | 440 | 0 | 0 | Fearless confirmé |
| lec-2025.json | LEC 2025 Spring | 45 | 600 | 0 | 0 | Fearless confirmé |
| lec-2025.json | LEC 2025 Spring Playoffs | 8 | 250 | 0 | 0 | Fearless confirmé |
| lec-2025.json | LEC 2025 Summer | 20 | 270 | 0 | 0 | Fearless confirmé |
| lec-2025.json | LEC 2025 Summer Playoffs | 10 | 280 | 0 | 0 | Fearless confirmé |
| lec-2025.json | LEC 2025 Winter | 0 | 0 | 0 | 0 | Fearless confirmé |
| lec-2025.json | LEC 2025 Winter Playoffs | 14 | 250 | 0 | 0 | Fearless confirmé |
| lfl-2025.json | LFL 2025 Flash In Groups | 0 | 0 | 0 | 0 | Fearless confirmé |
| lfl-2025.json | LFL 2025 Flash In Playoffs | 4 | 120 | 0 | 0 | Fearless confirmé |
| lfl-2025.json | LFL 2025 Flash In Swiss | 10 | 140 | 0 | 0 | Fearless confirmé |
| lfl-2025.json | LFL 2025 Promotion | 3 | 80 | 46 | 20 | NON confirmé — exclu du scoring |
| lfl-2025.json | LFL 2025 Spring | 0 | 0 | 0 | 0 | Fearless confirmé |
| lfl-2025.json | LFL 2025 Spring Playoffs | 10 | 220 | 0 | 0 | Fearless confirmé |
| lfl-2025.json | LFL 2025 Spring Swiss | 10 | 160 | 0 | 0 | Fearless confirmé |
| lfl-2025.json | LFL 2025 Summer | 45 | 670 | 0 | 0 | Fearless confirmé |
| lfl-2025.json | LFL 2025 Summer Playoffs | 6 | 190 | 0 | 0 | Fearless confirmé |
| lpl-2025.json | LPL 2025 Grand Finals | 18 | 550 | 0 | 0 | Fearless confirmé |
| lpl-2025.json | LPL 2025 Regional Finals | 3 | 90 | 0 | 0 | Fearless confirmé |
| lpl-2025.json | LPL 2025 Split 1 | 24 | 640 | 0 | 1 | Fearless confirmé |
| lpl-2025.json | LPL 2025 Split 1 Playoffs | 10 | 320 | 0 | 0 | Fearless confirmé |
| lpl-2025.json | LPL 2025 Split 2 | 105 | 1540 | 0 | 0 | Fearless confirmé |
| lpl-2025.json | LPL 2025 Split 2 Placements | 3 | 50 | 0 | 0 | Fearless confirmé |
| lpl-2025.json | LPL 2025 Split 2 Playoffs | 18 | 530 | 0 | 0 | Fearless confirmé |
| lpl-2025.json | LPL 2025 Split 3 | 86 | 1260 | 0 | 0 | Fearless confirmé |

## Primaire — hit@5 : demande par rôle (M) vs présence équipe (B1)

| Tranche | Événements | Séries | hit@5 M | hit@5 B1 | Δ (M − B1) | IC 95 % cluster par série |
|---|---|---|---|---|---|---|
| POOLED (le verdict) | 2694 | 767 | 17.5 % | 17.1 % | +0.36 pp | [-0.20 pp ; +0.87 pp] |
| lck-2026.json | 348 | 112 | 17.4 % | 17.1 % | +0.23 pp | — |
| lec-2026.json | 226 | 67 | 16.8 % | 16.6 % | +0.18 pp | — |
| lfl-2026.json | 82 | 20 | 13.9 % | 15.6 % | -1.71 pp | — |
| lpl-2026.json | 474 | 131 | 16.6 % | 16.2 % | +0.42 pp | — |
| lec-2025.json | 330 | 97 | 18.3 % | 17.7 % | +0.61 pp | — |
| lfl-2025.json | 300 | 85 | 18.5 % | 18.3 % | +0.20 pp | — |
| lpl-2025.json | 934 | 255 | 17.8 % | 17.2 % | +0.56 pp | — |
| g = 2 | 1534 | 767 | 17.5 % | 17.0 % | +0.52 pp | — |
| g = 3 | 836 | 418 | 17.7 % | 17.6 % | +0.10 pp | — |
| g ≥ 4 (lecture « gardés G4/G5 ») | 324 | 115 | 16.7 % | 16.5 % | +0.25 pp | — |

Ligne B0 (fréquence ligue, descriptive) : hit@5 B0 pooled = 17.5 % (M = 17.5 %, B1 = 17.1 %).

**Verdict : G3-demande ROUGE** — IC touchant 0 : non significatif (gate fermée).
Delta pooled +0.36 pp, IC 95 % [-0.20 pp ; +0.87 pp], 2694 événements appariés sur 767 séries.

## S2 — déni précoce (corrélationnel, déclaré non causal, sans effet de gate)

- ρ de Spearman (rangs moyens) = -0.020 · IC bootstrap par série [-0.070 ; 0.030] (1534 points équipe × série, 767 séries scorées S2, ρ recalculé sur chacun des 1000 resamples).
- Confusions déclarées : force des équipes, chevauchement de méta. AUCUN verdict.

| Overlap G1 ∩ top-10 adverse | Points | Issue moyenne (wins games 2..L / (L−1)) |
|---|---|---|
| 0 | 391 | 51.6 % |
| 1 | 620 | 49.4 % |
| ≥ 2 | 523 | 49.4 % |

Exclusions S2 : G1 de premier patch (train vide) : 65 · série mono-game (L−1 = 0) : 353 · patch de G1 non plaçable : 1.

## S3 — ordre de rétention du solveur (enjeu : badge, pas la porte)

- AUC (holdValue(late) > holdValue(early), égalité ½) = 0.503 · IC 95 % par série [0.487 ; 0.518] — 6425 paires sur 409 séries (409 clusters au bootstrap).
- Couverture des paires : 1679 picks early et 1527 picks late présents au pool train du vainqueur.
- **Critère S3 : lo ≤ 0,5 — le badge Expérimental reste.**
- Temps moyen par appel `retentionValue` : 19.33 ms (3188 appels — informatif ici, bloquant pour le branchement UI live, critère R5 < 200 ms).
- σ2 : score réel après G1, consommé = picks G1, pools du train ancré au patch de G1, firstSelectionHolder undefined (champ absent du corpus).

Exclusions S3 : G1 de premier patch (train vide) : 41 · longueur < 3 (hors périmètre) : 727 · format non inféré (maxWins ∉ {2, 3}) : 1 · aucune paire éligible (picks hors pool train) : 8.

## Couverture, exclusions, anomalies

- lck-2026.json : 337 records → 132 séries valides (0 invalides), 132 multi-games, 410 événements bruts → 410 après TEST 0 → 348 scorés (premier patch (train vide) : 62).
- lec-2026.json : 246 records → 133 séries valides (0 invalides), 67 multi-games, 226 événements bruts → 226 après TEST 0 → 226 scorés (aucun écarté).
- lfl-2026.json : 191 records → 141 séries valides (0 invalides), 23 multi-games, 100 événements bruts → 100 après TEST 0 → 82 scorés (premier patch (train vide) : 18).
- lpl-2026.json : 445 records → 162 séries valides (0 invalides), 162 multi-games, 566 événements bruts → 566 après TEST 0 → 474 scorés (premier patch (train vide) : 90 · patch non plaçable : 2).
- lec-2025.json : 308 records → 143 séries valides (0 invalides), 97 multi-games, 330 événements bruts → 330 après TEST 0 → 330 scorés (aucun écarté).
- lfl-2025.json : 317 records → 159 séries valides (0 invalides), 88 multi-games, 316 événements bruts → 300 après TEST 0 → 300 scorés (aucun écarté). Tournois exclus par TEST 0 : LFL 2025 Promotion.
- lpl-2025.json : 817 records → 319 séries valides (0 invalides), 267 multi-games, 996 événements bruts → 996 après TEST 0 → 934 scorés (premier patch (train vide) : 62).

Anomalies citées par gameId :
- lfl-2025.json · re-ban d'un consommé : 58 (série LFL/2025 Season/Promotion_Round 1_1, game LFL/2025 Season/Promotion_Round 1_1_2) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 893 (série LFL/2025 Season/Promotion_Round 1_1, game LFL/2025 Season/Promotion_Round 1_1_3) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 58 (série LFL/2025 Season/Promotion_Round 1_1, game LFL/2025 Season/Promotion_Round 1_1_3) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 21 (série LFL/2025 Season/Promotion_Round 1_2, game LFL/2025 Season/Promotion_Round 1_2_2) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 21 (série LFL/2025 Season/Promotion_Round 1_2, game LFL/2025 Season/Promotion_Round 1_2_3) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 57 (série LFL/2025 Season/Promotion_Round 1_2, game LFL/2025 Season/Promotion_Round 1_2_3) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 113 (série LFL/2025 Season/Promotion_Round 1_2, game LFL/2025 Season/Promotion_Round 1_2_3) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 58 (série LFL/2025 Season/Promotion_Round 1_2, game LFL/2025 Season/Promotion_Round 1_2_3) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 113 (série LFL/2025 Season/Promotion_Round 1_2, game LFL/2025 Season/Promotion_Round 1_2_4) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 57 (série LFL/2025 Season/Promotion_Round 1_2, game LFL/2025 Season/Promotion_Round 1_2_4) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 897 (série LFL/2025 Season/Promotion_Round 1_2, game LFL/2025 Season/Promotion_Round 1_2_4) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 89 (série LFL/2025 Season/Promotion_Round 1_2, game LFL/2025 Season/Promotion_Round 1_2_4) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 78 (série LFL/2025 Season/Promotion_Round 1_2, game LFL/2025 Season/Promotion_Round 1_2_4) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 777 (série LFL/2025 Season/Promotion_Round 2_1, game LFL/2025 Season/Promotion_Round 2_1_2) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 516 (série LFL/2025 Season/Promotion_Round 2_1, game LFL/2025 Season/Promotion_Round 2_1_2) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 234 (série LFL/2025 Season/Promotion_Round 2_1, game LFL/2025 Season/Promotion_Round 2_1_3) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 143 (série LFL/2025 Season/Promotion_Round 2_1, game LFL/2025 Season/Promotion_Round 2_1_3) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 63 (série LFL/2025 Season/Promotion_Round 2_1, game LFL/2025 Season/Promotion_Round 2_1_4) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 143 (série LFL/2025 Season/Promotion_Round 2_1, game LFL/2025 Season/Promotion_Round 2_1_4) — signalé, tournoi NON exclu.
- lfl-2025.json · re-ban d'un consommé : 234 (série LFL/2025 Season/Promotion_Round 2_1, game LFL/2025 Season/Promotion_Round 2_1_4) — signalé, tournoi NON exclu.
- lpl-2025.json · re-ban d'un consommé : 799 (série LPL/2025 Season/Split 1_Week 2_5, game LPL/2025 Season/Split 1_Week 2_5_3) — signalé, tournoi NON exclu.

## Notes

- Une règle, un run : tout rouge est gelé tel quel ; toute nouvelle piste exigera un NOUVEL en-tête daté.
- Seed 42, 1000 resamples, flux rng UNIQUE consommé en ordre fixe : primaire → S2 → S3 ; cluster = série (corpus, matchId).
- Statistiques consommées de `$lib/backtest/clusterBootstrap` (clusterBootstrapDeltaCI, spearman) et `$lib/backtest/metrics` (mulberry32) — rien de statistique recodé ici (seul le quantile type-7 privé du module est recopié à l’identique pour le percentile du ρ rééchantillonné).
- Tie-break du top-10 S2 (non fixé par la règle) déclaré : compte brut desc → clé asc.
- La couverture 70,3 % / 68,1 % de l’audit §1.0 est une mesure outcome-adjacente — le recall du pool train — prise avant gel, sans aucun calcul de hit@5, de ρ ni d’AUC.
- Le verdict imprimé est « G3-demande VERTE/ROUGE », jamais « G3 VERTE » (amendement de gouvernance §1.3, périmètre de porte).

