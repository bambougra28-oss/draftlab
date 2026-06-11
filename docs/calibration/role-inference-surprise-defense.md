# Validation — inférence des rôles adverses (I2 + priors corpus)

> Généré : 2026-06-11T19:20:01.045Z · règle pré-enregistrée dans `scripts/backtest/roleInference.ts`
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

---

## Mode `--surprise-defense` — non-régression F-c (chantier W1)

> GARDE F2 GELÉE — exigence : accuracy pooled k=3 (top-hypothèse, défense active)
> ≥ 94,5 %, sinon F-c reste débranché (docs/run2/F-pocket-picks.md §3.2 « GARDE DE
> BRANCHEMENT F-c » ; le système VERT pré-enregistré 95,0 % prime sur toute défense nouvelle).

Mécanisme gelé appliqué PENDANT le scoring, sans nouveau paramètre : déclencheur =
`surpriseOf(pick).bits ≥ surpriseAlarmBits = 5` (range model fitté sur le TRAIN du fold,
walk-forward strict) ET rôle-novelté structurelle (compte train équipe+ligue de
(champion, rôle le plus probable de la lecture courante) = 0, `shouldTriggerSurpriseDefense`) ;
effet = priors du champion DÉCLENCHEUR seul → uniforme (β = 1, `uniformizeTriggeredPriors`)
puis ré-énumération `roleAssignmentHypotheses`.

| k | Picks évalués | Alarmes (bits ≥ 5) | Déclencheurs | Lectures ré-énumérées | Non évalués |
|---|---|---|---|---|---|
| 3 | 17640 | 10423 | 367 | 308 | 0 |
| 5 | 29400 | 18651 | 887 | 702 | 0 |

### Déclencheurs (liste exhaustive)

| Corpus | gameId | Side | k | Champion | bits | Rôle lu (r*) |
|---|---|---|---|---|---|---|
| lck-2026.json | LCK/2026 Season/Cup_Week 3_1_3 | red | 5 | Zeri | 9.97 | Bot |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_1_4 | blue | 3 | Yorick | 9.97 | Bot |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_1_4 | blue | 5 | Yorick | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_1_5 | red | 5 | Tristana | 9.97 | Bot |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_2_4 | red | 5 | Lillia | 9.97 | Mid |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_3_3 | blue | 3 | Jinx | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_3_3 | blue | 5 | Jinx | 9.97 | Bot |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_3_3 | red | 3 | Blitzcrank | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_3_3 | red | 5 | Blitzcrank | 9.97 | Support |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_3_4 | red | 5 | Tahm Kench | 9.97 | Support |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_3_5 | red | 5 | Shen | 9.97 | Support |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_3_5 | red | 5 | Olaf | 9.97 | Support |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_4_3 | red | 5 | Yorick | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_5_3 | blue | 3 | Ornn | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Cup_Week 3_5_3 | blue | 5 | Ornn | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Cup_Play-In Round 2_1_1 | blue | 5 | Ornn | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 1_1_5 | blue | 5 | Rammus | 9.97 | Mid |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 1_1_5 | blue | 5 | Smolder | 9.97 | Mid |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 1_1_5 | red | 5 | Zac | 9.97 | Jungle |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 1_2_4 | red | 3 | Naafiri | 9.97 | Jungle |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 1_2_4 | red | 5 | Naafiri | 9.97 | Jungle |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 2_1_1 | blue | 5 | Yuumi | 9.97 | Support |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 2_1_3 | blue | 5 | Malzahar | 9.97 | Mid |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 1_3_4 | red | 5 | Naafiri | 9.97 | Jungle |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 2_3_4 | blue | 5 | Naafiri | 9.97 | Jungle |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 4_1_3 | blue | 3 | Mel | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 4_1_3 | blue | 5 | Mel | 9.97 | Mid |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 4_1_4 | blue | 3 | Nidalee | 9.97 | Jungle |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 4_1_4 | blue | 5 | Nidalee | 9.97 | Jungle |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 3_1_1 | red | 5 | Yuumi | 9.97 | Support |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 3_1_3 | blue | 5 | Kha'Zix | 9.97 | Jungle |
| lck-2026.json | LCK/2026 Season/Cup_Playoffs Round 4_2_1 | blue | 5 | Yuumi | 9.97 | Support |
| lck-2026.json | LCK/2026 Season/Cup_Finals_1_3 | blue | 5 | Annie | 9.97 | Mid |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 1_2_2 | blue | 5 | Vayne | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 1_7_2 | red | 5 | Vayne | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 1_10_1 | red | 5 | Senna | 9.97 | Bot |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 1_10_2 | blue | 5 | Skarner | 9.97 | Jungle |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 2_6_2 | red | 3 | Hwei | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 2_6_2 | red | 5 | Hwei | 9.97 | Mid |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 3_2_2 | blue | 5 | Hwei | 9.97 | Mid |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 3_6_2 | red | 5 | Lux | 9.97 | Support |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 3_10_1 | blue | 5 | Camille | 9.97 | Support |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 4_7_2 | blue | 5 | Morgana | 9.97 | Support |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 4_8_1 | blue | 5 | Illaoi | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 4_9_1 | blue | 5 | Aurelion Sol | 9.97 | Mid |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 5_1_2 | blue | 5 | Kog'Maw | 9.97 | Bot |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 7_5_1 | red | 5 | Zyra | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 7_5_1 | red | 5 | Irelia | 9.97 | Top |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 7_9_3 | red | 3 | Draven | 9.97 | Jungle |
| lck-2026.json | LCK/2026 Season/Rounds 1-2_Week 7_9_3 | red | 5 | Draven | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_1_1 | blue | 3 | Yone | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_1_1 | blue | 3 | Sejuani | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_1_1 | blue | 5 | Yone | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_1_1 | blue | 5 | Sejuani | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_3_1 | blue | 5 | Thresh | 9.97 | Support |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_3_1 | red | 5 | Kalista | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_3_1 | red | 5 | Renata Glasc | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_5_1 | blue | 3 | Jinx | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_5_1 | blue | 3 | Ekko | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_5_1 | blue | 5 | Jinx | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_5_1 | blue | 5 | Ekko | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_5_1 | red | 5 | Leona | 9.97 | Support |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_6_1 | blue | 5 | Thresh | 9.97 | Support |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_7_1 | blue | 5 | Zoe | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_7_1 | red | 5 | Swain | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_8_1 | blue | 5 | Cho'Gath | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_11_1 | red | 3 | Nocturne | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_11_1 | red | 5 | Nocturne | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_12_1 | blue | 3 | Galio | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_12_1 | blue | 5 | Galio | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_12_1 | blue | 5 | Lee Sin | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_13_1 | blue | 3 | Yone | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_13_1 | blue | 5 | Yone | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_14_1 | blue | 5 | Lucian | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_14_1 | blue | 5 | Nidalee | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_14_1 | red | 5 | Gragas | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_15_1 | blue | 5 | Gwen | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_16_1 | red | 5 | Gwen | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_17_1 | blue | 5 | Poppy | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_17_1 | red | 5 | Leona | 9.97 | Support |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_18_1 | blue | 5 | Trundle | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 2_18_1 | red | 5 | Elise | 9.97 | Support |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_2_1 | red | 5 | Pyke | 9.97 | Support |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_3_1 | red | 3 | Skarner | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_3_1 | red | 5 | Skarner | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_3_1 | red | 5 | Rek'Sai | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_6_1 | blue | 3 | Poppy | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_6_1 | blue | 5 | Poppy | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_10_1 | blue | 5 | Elise | 9.97 | Support |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_13_1 | blue | 3 | Galio | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_13_1 | blue | 5 | Galio | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_13_1 | red | 5 | Poppy | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_14_1 | blue | 3 | Yone | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_14_1 | blue | 5 | Yone | 9.97 | Support |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_14_1 | blue | 5 | Taric | 9.97 | Support |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_16_1 | red | 3 | Yone | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_16_1 | red | 5 | Yone | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_18_1 | blue | 5 | Galio | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 3_18_1 | red | 5 | Nocturne | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 4_1_1 | red | 5 | Jax | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 4_3_1 | blue | 3 | Ornn | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 4_3_1 | blue | 5 | Ornn | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 4_7_1 | blue | 5 | Sylas | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Season_Week 4_11_1 | red | 5 | LeBlanc | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 1_1_2 | blue | 5 | Jax | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 1_1_2 | red | 3 | Ahri | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 1_1_2 | red | 5 | Ahri | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 1_2_2 | blue | 3 | Ornn | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 1_2_2 | blue | 5 | Ornn | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 1_2_2 | red | 5 | Ahri | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 1_3_2 | red | 5 | Miss Fortune | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 1_4_1 | red | 5 | Ornn | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_1_1 | blue | 5 | Ornn | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_1_2 | red | 5 | Miss Fortune | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 1_5_3 | red | 5 | Naafiri | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 1_5_3 | red | 5 | Ahri | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_3_2 | red | 5 | Ashe | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_3_2 | red | 5 | Seraphine | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_3_3 | blue | 3 | Ornn | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_3_3 | blue | 5 | Ornn | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_3_3 | red | 5 | Ahri | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_4_2 | blue | 3 | Yasuo | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_4_2 | blue | 5 | Yasuo | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_4_3 | blue | 3 | Seraphine | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_4_3 | blue | 5 | Seraphine | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_4_3 | blue | 5 | Twisted Fate | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_4_3 | red | 3 | Ahri | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_4_3 | red | 5 | Ahri | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 2_4_3 | red | 5 | Zeri | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 4_1_2 | blue | 5 | Ashe | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 4_1_2 | red | 3 | Ornn | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 4_1_2 | red | 5 | Ornn | 9.97 | Support |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 4_1_2 | red | 5 | Seraphine | 9.97 | Support |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 4_1_3 | blue | 5 | Ahri | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 3_1_1 | blue | 3 | Ornn | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 3_1_1 | blue | 5 | Ornn | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 3_1_1 | blue | 5 | Ashe | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 3_1_1 | blue | 5 | Seraphine | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 3_1_3 | red | 3 | Ahri | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 3_1_3 | red | 5 | Ahri | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 3_1_3 | red | 5 | Naafiri | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 4_2_2 | red | 3 | Ashe | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 4_2_2 | red | 3 | Seraphine | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 4_2_2 | red | 5 | Ashe | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 4_2_2 | red | 5 | Seraphine | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 4_2_3 | red | 3 | Syndra | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 4_2_4 | blue | 3 | Ahri | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 4_2_4 | blue | 5 | Ahri | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Round 4_2_5 | blue | 3 | Milio | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_1 | blue | 5 | Shen | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_2 | blue | 3 | Ashe | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_2 | blue | 3 | Seraphine | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_2 | blue | 5 | Ashe | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_2 | blue | 5 | Seraphine | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_2 | blue | 5 | Yasuo | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_2 | red | 3 | Naafiri | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_2 | red | 5 | Naafiri | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_3 | blue | 3 | Ornn | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_3 | blue | 3 | Sylas | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_3 | blue | 5 | Ornn | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_3 | blue | 5 | Sylas | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_3 | red | 3 | Ahri | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_3 | red | 5 | Ahri | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Versus Playoffs_Finals_1_4 | blue | 5 | Syndra | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 1_1_2 | blue | 5 | Annie | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 1_2_3 | blue | 5 | Annie | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 1_4_3 | blue | 5 | Zed | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 1_4_3 | red | 3 | Mel | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 1_4_3 | red | 5 | Mel | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 1_5_2 | blue | 3 | Lissandra | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 1_5_2 | blue | 5 | Lissandra | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 1_6_3 | blue | 3 | Janna | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 1_7_2 | red | 5 | Hwei | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 2_2_2 | blue | 5 | Olaf | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 2_6_3 | blue | 5 | Tristana | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 3_2_2 | blue | 5 | Ziggs | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 3_2_3 | blue | 5 | Olaf | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 3_3_1 | blue | 3 | Irelia | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 3_3_1 | blue | 5 | Irelia | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 3_4_3 | blue | 5 | Camille | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 3_5_1 | blue | 5 | Ziggs | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 3_7_2 | blue | 5 | Vayne | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 4_3_1 | blue | 5 | Quinn | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 4_6_2 | blue | 3 | Amumu | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 4_6_2 | blue | 5 | Amumu | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 4_6_2 | blue | 5 | Diana | 9.97 | Mid |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 5_4_2 | blue | 5 | Viego | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 5_5_1 | red | 5 | Darius | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 5_6_1 | red | 5 | Soraka | 9.97 | Support |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 6_2_1 | blue | 5 | Shyvana | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 6_2_3 | red | 3 | Kog'Maw | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 6_2_3 | red | 5 | Kog'Maw | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 6_3_1 | blue | 5 | Yuumi | 9.97 | Support |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 6_6_2 | blue | 5 | Shyvana | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 7_4_1 | red | 5 | Shyvana | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Spring Season_Week 7_5_3 | blue | 5 | Brand | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Spring Playoffs_Round 3_1_5 | red | 3 | Senna | 9.97 | Top |
| lec-2026.json | LEC/2026 Season/Spring Playoffs_Round 3_1_5 | red | 5 | Senna | 9.97 | Bot |
| lec-2026.json | LEC/2026 Season/Spring Playoffs_Finals_1_5 | blue | 3 | Senna | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Spring Playoffs_Finals_1_5 | blue | 5 | Senna | 9.97 | Jungle |
| lec-2026.json | LEC/2026 Season/Spring Playoffs_Finals_1_5 | blue | 5 | Nasus | 9.97 | Jungle |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 1_1_1 | red | 5 | Cho'Gath | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 1_2_1 | blue | 5 | Rek'Sai | 9.97 | Jungle |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 1_2_1 | red | 5 | Lux | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 1_3_1 | red | 5 | Darius | 9.97 | Jungle |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 1_4_1 | blue | 3 | Dr. Mundo | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 1_4_1 | blue | 5 | Dr. Mundo | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 1_4_1 | blue | 5 | Yorick | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 1_5_1 | blue | 5 | Zaahen | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 2_1_1 | blue | 3 | Malphite | 9.97 | Jungle |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 2_1_1 | blue | 5 | Malphite | 9.97 | Jungle |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 2_2_1 | red | 5 | Tristana | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 2_4_1 | red | 5 | Caitlyn | 9.97 | Jungle |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 2_4_1 | red | 5 | Mordekaiser | 9.97 | Jungle |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 3_5_1 | blue | 5 | Thresh | 9.97 | Support |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 4_2_1 | red | 5 | Gragas | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 4_3_1 | blue | 5 | Lulu | 9.97 | Support |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 4_5_1 | blue | 5 | Ahri | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 5_1_1 | red | 5 | Vayne | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 5_3_1 | blue | 3 | Ahri | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 5_3_1 | blue | 5 | Ahri | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 5_3_1 | red | 5 | Sylas | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Invitational_Day 5_5_1 | blue | 5 | Anivia | 9.97 | Jungle |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_1_1 | red | 5 | Milio | 9.97 | Support |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_2_1 | blue | 3 | Cassiopeia | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_2_1 | blue | 5 | Cassiopeia | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_3_1 | blue | 3 | Xayah | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_3_1 | blue | 5 | Xayah | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_3_1 | red | 3 | Ahri | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_3_1 | red | 5 | Ahri | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_5_1 | blue | 3 | Yone | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_5_1 | blue | 5 | Yone | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_10_1 | red | 5 | Camille | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_11_1 | red | 3 | Yone | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_11_1 | red | 5 | Yone | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_11_1 | red | 5 | Sylas | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_12_1 | red | 3 | Zoe | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_12_1 | red | 5 | Zoe | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 1_13_1 | red | 5 | Ahri | 9.97 | Jungle |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 2_7_1 | red | 5 | Nami | 9.97 | Support |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 2_14_1 | red | 5 | Nami | 9.97 | Support |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 2_16_1 | red | 3 | Kindred | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 2_16_1 | red | 5 | Kindred | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 2_19_1 | blue | 5 | Aphelios | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 3_5_1 | blue | 3 | Riven | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 3_5_1 | blue | 5 | Riven | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 3_6_1 | red | 3 | Nami | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 3_6_1 | red | 5 | Nami | 9.97 | Support |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 3_8_1 | blue | 3 | Lee Sin | 9.97 | Jungle |
| lfl-2026.json | LFL/2026 Season/Invitational_Week 3_8_1 | blue | 5 | Lee Sin | 9.97 | Jungle |
| lfl-2026.json | LFL/2026 Season/Invitational_Tiebreakers_3_1 | red | 5 | Nami | 9.97 | Support |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 1_1_3 | red | 5 | Rengar | 9.97 | Jungle |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 1_2_3 | red | 5 | Fiora | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 1_2_4 | blue | 5 | Karthus | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 1_2_4 | red | 5 | Singed | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 1_2_5 | red | 3 | Mel | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 2_1_4 | red | 3 | Mel | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 2_1_4 | red | 5 | Mel | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 3_1_2 | blue | 3 | Ashe | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 3_1_2 | blue | 3 | Seraphine | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 3_1_2 | blue | 5 | Ashe | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 3_1_2 | blue | 5 | Seraphine | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 3_1_2 | red | 3 | LeBlanc | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 3_1_2 | red | 5 | LeBlanc | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 3_1_5 | blue | 5 | Aurelion Sol | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 3_1_5 | red | 3 | Mel | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 3_1_5 | red | 5 | Mel | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Round 3_1_5 | red | 5 | Olaf | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Finals_1_1 | blue | 3 | Ashe | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Finals_1_1 | blue | 3 | Seraphine | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Invitational_Finals_1_1 | blue | 5 | Ashe | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Invitational_Finals_1_1 | blue | 5 | Seraphine | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Invitational_Finals_1_1 | blue | 5 | Mel | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Spring Split_Week 1_10_1 | blue | 5 | Twisted Fate | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Spring Split_Week 1_15_1 | blue | 5 | Malzahar | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Spring Split_Week 2_8_1 | blue | 5 | Elise | 9.97 | Support |
| lfl-2026.json | LFL/2026 Season/Spring Split_Week 2_12_1 | blue | 5 | Lissandra | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Spring Split_Week 3_1_1 | red | 5 | Taric | 9.97 | Support |
| lfl-2026.json | LFL/2026 Season/Spring Split_Week 4_5_1 | red | 5 | Zilean | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Spring Playoffs_Round 1_6_2 | red | 3 | Samira | 9.97 | Mid |
| lfl-2026.json | LFL/2026 Season/Spring Playoffs_Round 1_6_2 | red | 5 | Samira | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Spring Playoffs_Round 3_1_3 | red | 3 | Volibear | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Spring Playoffs_Round 3_1_3 | red | 5 | Volibear | 9.97 | Top |
| lfl-2026.json | LFL/2026 Season/Spring Playoffs_Round 4_2_3 | blue | 5 | Nilah | 9.97 | Bot |
| lfl-2026.json | LFL/2026 Season/Spring Playoffs_Finals_1_3 | red | 5 | Irelia | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 3_3_1 | red | 5 | Ekko | 9.97 | Mid |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 3_4_2 | red | 5 | Aatrox | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 3_5_3 | blue | 5 | Swain | 9.97 | Mid |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 3_8_2 | red | 5 | Tristana | 9.97 | Bot |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 3_9_1 | blue | 5 | Yasuo | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 3_9_1 | red | 3 | Sejuani | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 3_10_3 | red | 5 | Elise | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 3_13_3 | blue | 5 | Swain | 9.97 | Mid |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 3_13_3 | red | 5 | Naafiri | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 3_15_3 | blue | 5 | Hwei | 9.97 | Mid |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 3_16_2 | red | 5 | Aatrox | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 4_1_3 | red | 3 | Pyke | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 4_1_3 | red | 5 | Pyke | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 4_2_2 | red | 5 | Aatrox | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 4_3_2 | blue | 5 | Naafiri | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 4_4_3 | blue | 5 | Twisted Fate | 9.97 | Mid |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 4_6_3 | blue | 5 | Naafiri | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 4_6_3 | blue | 5 | Sejuani | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 4_10_2 | blue | 5 | Aatrox | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 4_10_3 | blue | 5 | Sejuani | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1_Week 4_10_3 | red | 5 | Kindred | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_1 | blue | 3 | Skarner | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_1 | blue | 5 | Skarner | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_4 | blue | 5 | Twisted Fate | 9.97 | Mid |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_4 | red | 5 | Elise | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_5 | blue | 5 | Yuumi | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_5 | red | 3 | Vladimir | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_5 | red | 5 | Vladimir | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_5 | red | 5 | Smolder | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_2_4 | red | 5 | Diana | 9.97 | Mid |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 2_1_3 | red | 5 | Naafiri | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 2_2_4 | blue | 5 | Nidalee | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 2_2_4 | red | 5 | Zac | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 3_1_3 | red | 3 | Lee Sin | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 3_1_3 | red | 5 | Lee Sin | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 3_1_3 | red | 5 | Rammus | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 3_2_4 | blue | 5 | Kha'Zix | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Play-In Round 3_2_4 | red | 5 | Aatrox | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 1_1_2 | blue | 5 | Gangplank | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 1_1_3 | red | 5 | Maokai | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 1_1_5 | blue | 3 | Xayah | 9.97 | Mid |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 1_1_5 | blue | 5 | Xayah | 9.97 | Bot |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 2_1_2 | red | 5 | Maokai | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 1_5_2 | blue | 5 | Xayah | 9.97 | Bot |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 1_6_3 | blue | 5 | Lissandra | 9.97 | Mid |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 2_3_3 | red | 5 | Gangplank | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 2_4_4 | blue | 5 | Annie | 9.97 | Mid |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 2_4_4 | red | 3 | Xayah | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 2_4_4 | red | 5 | Xayah | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 2_4_4 | red | 5 | Maokai | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 4_1_3 | red | 5 | Olaf | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 3_1_3 | blue | 5 | Camille | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 3_1_4 | red | 5 | Warwick | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Round 4_2_2 | blue | 5 | Maokai | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Finals_1_3 | red | 5 | Kog'Maw | 9.97 | Bot |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Finals_1_4 | red | 3 | Xayah | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 1 Playoffs_Finals_1_4 | red | 5 | Xayah | 9.97 | Bot |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 2_1_2 | blue | 5 | Milio | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 2_3_1 | red | 5 | Milio | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 2_5_2 | red | 5 | Milio | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 2_8_2 | blue | 5 | Vayne | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 2_9_3 | red | 3 | Milio | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 2_9_3 | red | 5 | Milio | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 3_4_1 | blue | 5 | Vayne | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 3_5_1 | red | 5 | Milio | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 3_6_2 | blue | 3 | Milio | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 3_6_2 | blue | 5 | Milio | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 3_8_1 | blue | 5 | Milio | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 3_9_1 | blue | 5 | Xerath | 9.97 | Mid |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 3_10_2 | blue | 3 | Milio | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 3_10_2 | blue | 5 | Milio | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 3_10_2 | blue | 5 | Vayne | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 4_6_2 | blue | 5 | Tryndamere | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 5_8_2 | red | 3 | Lux | 9.97 | Top |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 5_8_2 | red | 5 | Lux | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 6_7_2 | blue | 5 | Shyvana | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 2_Week 7_1_2 | blue | 5 | Shyvana | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 2 Playoffs_Round 1_1_4 | blue | 5 | Fiora | 9.97 | Jungle |
| lpl-2026.json | LPL/2026 Season/Split 2 Playoffs_Round 1_3_2 | red | 5 | Fizz | 9.97 | Mid |
| lpl-2026.json | LPL/2026 Season/Split 2 Playoffs_Round 2_1_4 | blue | 5 | Morgana | 9.97 | Support |
| lpl-2026.json | LPL/2026 Season/Split 2 Playoffs_Round 1_6_2 | red | 5 | Zyra | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Week 3_1_1 | red | 5 | Twisted Fate | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Week 3_1_3 | red | 5 | Syndra | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Week 3_2_1 | red | 5 | Camille | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Week 3_2_2 | red | 5 | Anivia | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Week 3_3_3 | red | 5 | Udyr | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Week 3_3_3 | red | 5 | Thresh | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Week 3_4_2 | blue | 5 | Tryndamere | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Week 3_4_3 | red | 3 | Camille | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Week 3_4_3 | red | 5 | Camille | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Week 3_4_3 | red | 5 | LeBlanc | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Week 3_5_2 | red | 5 | Camille | 9.97 | Support |
| lck-2025.json | LCK/2025 Season/Cup_Week 3_5_2 | red | 5 | Shen | 9.97 | Support |
| lck-2025.json | LCK/2025 Season/Cup_Play-In Round 1_1_2 | red | 5 | Camille | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Play-In Round 1_2_2 | red | 3 | Camille | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Play-In Round 1_2_2 | red | 3 | Shen | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Play-In Round 1_2_2 | red | 5 | Camille | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Play-In Round 1_2_2 | red | 5 | Shen | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Play-In Round 2_1_2 | blue | 3 | Anivia | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Play-In Round 2_1_2 | blue | 5 | Anivia | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Play-In Round 2_1_2 | red | 5 | Pyke | 9.97 | Support |
| lck-2025.json | LCK/2025 Season/Cup_Play-In Round 3_1_4 | blue | 3 | Camille | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Play-In Round 3_1_4 | blue | 5 | Camille | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Cup_Play-In Round 3_1_4 | blue | 5 | Senna | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Cup_Play-In Round 3_1_4 | red | 5 | Aphelios | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 1_2_3 | red | 3 | Mel | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 1_2_3 | red | 5 | Mel | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 1_2_3 | red | 5 | Irelia | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 1_2_4 | red | 3 | Aatrox | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 1_2_4 | red | 5 | Aatrox | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 1_2_4 | red | 5 | Diana | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 1_2_5 | blue | 5 | Amumu | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 1_2_5 | blue | 5 | Olaf | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 1_2_5 | red | 3 | Draven | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 1_2_5 | red | 3 | Soraka | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 2_1_3 | blue | 5 | Sivir | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 2_1_3 | blue | 5 | Kennen | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 2_1_3 | red | 5 | Aatrox | 9.97 | Support |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 2_2_3 | red | 3 | Mel | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 2_2_3 | red | 5 | Mel | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 2_2_4 | blue | 3 | Karthus | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 2_2_4 | red | 5 | Fiora | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 2_2_5 | blue | 5 | Aatrox | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 2_2_5 | red | 5 | Twitch | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 2_2_5 | red | 5 | Kennen | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 3_1_3 | red | 5 | Ryze | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 3_1_4 | blue | 3 | Aatrox | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 3_1_4 | blue | 5 | Aatrox | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 3_1_4 | red | 3 | Kennen | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 3_1_4 | red | 5 | Kennen | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 3_1_5 | blue | 5 | Mel | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 3_1_5 | blue | 5 | Kled | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 3_1_5 | red | 5 | Olaf | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 2_3_2 | blue | 5 | Mel | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 2_3_4 | red | 5 | Zac | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Cup_Playoffs Round 3_2_3 | blue | 5 | Ryze | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Finals_1_1 | red | 5 | Mordekaiser | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Finals_1_3 | blue | 5 | Aatrox | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Finals_1_3 | red | 5 | Vayne | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Finals_1_4 | blue | 3 | Karthus | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Finals_1_4 | blue | 5 | Karthus | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Cup_Finals_1_5 | blue | 5 | Gwen | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Cup_Finals_1_5 | red | 5 | Trundle | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Cup_Finals_1_5 | red | 5 | Aurelion Sol | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_1_1 | blue | 3 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_1_1 | blue | 5 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_3_2 | blue | 3 | Naafiri | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_3_2 | blue | 5 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_4_2 | red | 3 | Cho'Gath | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_4_2 | red | 5 | Cho'Gath | 9.97 | Support |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_4_3 | blue | 3 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_5_3 | red | 3 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_5_3 | red | 5 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_6_1 | blue | 3 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_6_1 | blue | 5 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_7_1 | red | 3 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_7_1 | red | 5 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_8_1 | red | 3 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_8_1 | red | 5 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_9_2 | red | 3 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_9_2 | red | 5 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_10_2 | blue | 3 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 1_10_2 | blue | 5 | Naafiri | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 2_5_3 | blue | 5 | Yorick | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 2_9_3 | blue | 5 | Vex | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 2_9_3 | red | 5 | Zed | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 3_4_2 | blue | 5 | Yorick | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 3_5_3 | blue | 3 | Yorick | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 3_5_3 | blue | 5 | Yorick | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 3_10_2 | red | 5 | Fiddlesticks | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 5_8_2 | blue | 5 | Milio | 9.97 | Support |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 6_1_1 | blue | 3 | Annie | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 6_1_1 | blue | 5 | Annie | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 6_3_1 | red | 3 | Annie | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 6_3_1 | red | 5 | Annie | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 6_9_3 | red | 5 | Annie | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 7_1_3 | blue | 3 | Annie | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 7_1_3 | blue | 5 | Annie | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 7_2_2 | red | 3 | Annie | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 7_2_2 | red | 5 | Annie | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 7_3_3 | red | 3 | Annie | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 7_3_3 | red | 5 | Annie | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 7_4_3 | blue | 5 | Talon | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 7_8_2 | red | 3 | Annie | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 7_8_2 | red | 5 | Annie | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 7_9_2 | red | 5 | Vladimir | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 9_10_2 | blue | 5 | Morgana | 9.97 | Support |
| lck-2025.json | LCK/2025 Season/Rounds 1-2_Week 9_10_3 | red | 5 | Nilah | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Road to MSI_Round 1_1_3 | red | 5 | Cassiopeia | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 10_8_1 | red | 5 | Malzahar | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 12_1_1 | red | 5 | Yunara | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 12_2_1 | red | 5 | Yunara | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 12_3_1 | red | 3 | Yunara | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 12_3_1 | red | 5 | Yunara | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 12_4_2 | blue | 3 | Yunara | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 12_4_2 | blue | 5 | Yunara | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 12_5_2 | blue | 3 | Yunara | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 12_5_2 | blue | 5 | Yunara | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 12_6_1 | red | 3 | Yunara | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 12_6_1 | red | 5 | Yunara | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 12_7_1 | blue | 3 | Yunara | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 12_7_1 | blue | 5 | Yunara | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 12_10_2 | red | 5 | Janna | 9.97 | Support |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 13_5_1 | blue | 3 | Yunara | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 13_5_1 | blue | 5 | Yunara | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 13_5_3 | red | 5 | Hecarim | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 13_9_1 | blue | 3 | Yunara | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Rounds 3-5_Week 13_9_1 | blue | 5 | Yunara | 9.97 | Bot |
| lck-2025.json | LCK/2025 Season/Season Playoffs_Round 1_1_2 | red | 3 | Qiyana | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Season Playoffs_Round 1_1_2 | red | 5 | Qiyana | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Season Playoffs_Round 2_1_4 | red | 5 | Qiyana | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Season Playoffs_Round 2_1_5 | red | 5 | Lissandra | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Season Playoffs_Round 2_2_3 | blue | 5 | Qiyana | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Season Playoffs_Round 1_3_1 | blue | 5 | Qiyana | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Season Playoffs_Round 1_3_2 | red | 5 | Veigar | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Season Playoffs_Round 2_3_4 | red | 5 | Rammus | 9.97 | Mid |
| lck-2025.json | LCK/2025 Season/Season Playoffs_Round 4_1_1 | blue | 5 | Rek'Sai | 9.97 | Top |
| lck-2025.json | LCK/2025 Season/Season Playoffs_Round 3_1_2 | red | 3 | Qiyana | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Season Playoffs_Round 3_1_2 | red | 5 | Qiyana | 9.97 | Jungle |
| lck-2025.json | LCK/2025 Season/Season Playoffs_Round 3_1_4 | blue | 5 | Rek'Sai | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 2_2_1 | red | 5 | Smolder | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 2_4_1 | blue | 5 | Jhin | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 2_4_1 | red | 5 | Brand | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 2_4_1 | red | 5 | Smolder | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 2_7_1 | blue | 5 | Elise | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 2_11_1 | blue | 5 | Nilah | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 2_12_1 | blue | 5 | Smolder | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 2_13_1 | blue | 5 | Nautilus | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 2_13_1 | red | 5 | Smolder | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 2_14_1 | blue | 5 | Gnar | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 2_15_1 | red | 5 | Nautilus | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_1_1 | blue | 5 | Ashe | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_2_1 | blue | 3 | Aurora | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_2_1 | blue | 5 | Aurora | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_3_1 | red | 5 | Cho'Gath | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_4_1 | blue | 3 | Lillia | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_4_1 | blue | 5 | Lillia | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_6_1 | red | 5 | Ornn | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_7_1 | red | 3 | Nocturne | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_8_1 | blue | 5 | Aurora | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_9_1 | blue | 3 | Smolder | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_9_1 | blue | 5 | Smolder | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_10_1 | blue | 5 | Ornn | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_10_1 | blue | 5 | Aurora | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_10_1 | red | 5 | Gwen | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_11_1 | red | 5 | Sion | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_12_1 | blue | 3 | Ziggs | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_12_1 | blue | 5 | Ziggs | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_12_1 | red | 5 | Sion | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_13_1 | red | 5 | Ornn | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_13_1 | red | 5 | Aurora | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_14_1 | blue | 5 | Cho'Gath | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_15_1 | blue | 3 | Diana | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_15_1 | blue | 5 | Diana | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_15_1 | blue | 5 | Ornn | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Season_Week 3_15_1 | red | 5 | Gnar | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_1_2 | blue | 5 | Yasuo | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_2_1 | blue | 3 | Pantheon | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_2_1 | blue | 5 | Pantheon | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_2_1 | blue | 5 | Warwick | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_2_1 | red | 5 | Neeko | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_2_2 | blue | 3 | Mel | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_2_2 | blue | 5 | Mel | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_2_2 | red | 3 | Lulu | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_2_2 | red | 3 | Sivir | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_2_2 | red | 5 | Lulu | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_2_2 | red | 5 | Sivir | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_3_1 | red | 3 | Viego | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_3_1 | red | 5 | Viego | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_3_2 | blue | 3 | Tristana | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_3_2 | blue | 5 | Tristana | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_3_2 | red | 5 | Karma | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_4_2 | blue | 5 | Sivir | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_1_1 | blue | 3 | Mel | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_1_1 | blue | 5 | Mel | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_1_1 | red | 3 | Pantheon | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_1_1 | red | 5 | Pantheon | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_1_1 | red | 5 | Swain | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_1_2 | red | 3 | Warwick | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_1_2 | red | 5 | Warwick | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_1_2 | red | 5 | Lulu | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_1_2 | red | 5 | Sivir | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_2_2 | blue | 3 | Xayah | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_2_2 | blue | 5 | Xayah | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_2_2 | blue | 5 | Karma | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_2_2 | blue | 5 | Lee Sin | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_5_2 | blue | 5 | Lulu | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_5_3 | blue | 5 | Sivir | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_5_3 | blue | 5 | Blitzcrank | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_5_3 | red | 3 | Mel | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_5_3 | red | 5 | Mel | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_6_1 | red | 5 | Pantheon | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_6_2 | blue | 5 | Tristana | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_6_2 | blue | 5 | Camille | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_6_2 | red | 5 | Syndra | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_6_3 | blue | 5 | Yuumi | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_6_3 | red | 3 | Lulu | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_6_3 | red | 3 | Sivir | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_6_3 | red | 5 | Lulu | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 1_6_3 | red | 5 | Sivir | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_3_1 | blue | 5 | Xayah | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_3_3 | blue | 3 | Pantheon | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_3_3 | blue | 5 | Pantheon | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_3_3 | red | 3 | Syndra | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_3_3 | red | 5 | Syndra | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_4_1 | blue | 5 | Vex | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 2_4_1 | red | 5 | Lee Sin | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_1_1 | blue | 5 | Lulu | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_1_1 | red | 5 | Blitzcrank | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_1_3 | red | 3 | Senna | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_1_3 | red | 3 | Yasuo | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_1_3 | red | 5 | Senna | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_1_3 | red | 5 | Yasuo | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_1_4 | blue | 3 | Viego | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_1_4 | blue | 3 | Ryze | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_1_4 | blue | 5 | Viego | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_1_4 | blue | 5 | Ryze | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_1_4 | red | 3 | Caitlyn | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_1_4 | red | 5 | Caitlyn | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_1_4 | red | 5 | Anivia | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 3_1_3 | blue | 5 | Jarvan IV | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 3_1_3 | red | 5 | Lee Sin | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 3_1_4 | blue | 3 | Karma | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 3_1_4 | blue | 5 | Karma | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 3_1_4 | blue | 5 | Syndra | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 3_1_4 | red | 3 | Sivir | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 3_1_4 | red | 3 | Lulu | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 3_1_4 | red | 3 | Amumu | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 3_1_4 | red | 5 | Sivir | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 3_1_4 | red | 5 | Lulu | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 3_1_4 | red | 5 | Amumu | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 3_1_4 | red | 5 | Ryze | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 3_1_4 | red | 5 | Camille | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_3 | blue | 3 | Pantheon | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_3 | blue | 5 | Pantheon | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_3 | blue | 5 | Zilean | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_3 | red | 3 | Xayah | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_3 | red | 5 | Xayah | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_3 | red | 5 | Aurelion Sol | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_4 | blue | 5 | Caitlyn | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_4 | red | 5 | Pyke | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_5 | blue | 3 | Lulu | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_5 | blue | 3 | Volibear | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_5 | blue | 5 | Lulu | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_5 | blue | 5 | Volibear | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_5 | blue | 5 | Camille | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_5 | red | 3 | Jarvan IV | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_5 | red | 5 | Jarvan IV | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Round 4_2_5 | red | 5 | Karma | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Finals_1_1 | red | 5 | Aatrox | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Finals_1_2 | blue | 5 | Tristana | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Finals_1_2 | blue | 5 | Blitzcrank | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Finals_1_3 | red | 3 | Caitlyn | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Finals_1_3 | red | 3 | Ryze | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Finals_1_3 | red | 3 | Pantheon | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Finals_1_3 | red | 5 | Caitlyn | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Finals_1_3 | red | 5 | Ryze | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Finals_1_3 | red | 5 | Pantheon | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Finals_1_3 | red | 5 | Thresh | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Winter Playoffs_Finals_1_3 | red | 5 | Urgot | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 1_3_2 | red | 5 | Sett | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 1_3_3 | red | 3 | Dr. Mundo | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 1_3_3 | red | 5 | Dr. Mundo | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 1_5_1 | red | 5 | Annie | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 1_6_2 | blue | 5 | Bard | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 1_7_1 | red | 3 | Naafiri | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 1_7_1 | red | 5 | Naafiri | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 2_2_1 | blue | 5 | Lucian | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 3_3_2 | red | 5 | Fiddlesticks | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 3_6_2 | red | 5 | Vladimir | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 4_2_3 | blue | 5 | Kog'Maw | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 5_1_1 | red | 5 | Malphite | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 6_1_2 | red | 5 | Shen | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 6_2_2 | red | 5 | Yorick | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 6_3_2 | red | 3 | Shen | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 6_3_2 | red | 5 | Shen | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 6_6_2 | red | 5 | Kennen | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 7_2_2 | red | 5 | Kennen | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 7_2_3 | red | 5 | Nami | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 7_4_2 | red | 5 | Shen | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Season_Week 7_6_1 | blue | 5 | Yorick | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Playoffs_Round 1_1_3 | blue | 3 | Taric | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Spring Playoffs_Round 1_1_3 | blue | 5 | Taric | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Spring Playoffs_Round 1_1_4 | red | 5 | Trundle | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Spring Playoffs_Round 1_2_5 | red | 3 | Zoe | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Spring Playoffs_Round 1_2_5 | red | 5 | Zoe | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Spring Playoffs_Round 3_1_3 | red | 5 | Trundle | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Spring Playoffs_Round 1_3_3 | red | 5 | Milio | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Spring Playoffs_Round 2_1_2 | red | 5 | Zoe | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Playoffs_Round 3_2_3 | red | 5 | Kassadin | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Spring Playoffs_Finals_1_4 | blue | 5 | Kassadin | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 1_1_1 | blue | 5 | Yunara | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 1_2_1 | blue | 3 | Yunara | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 1_2_1 | blue | 5 | Yunara | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 1_2_2 | blue | 3 | Aphelios | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 1_2_2 | blue | 5 | Aphelios | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 1_3_2 | red | 5 | Aphelios | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 1_4_2 | red | 5 | Aphelios | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 1_5_1 | red | 5 | Yunara | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 2_1_1 | red | 5 | Yunara | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 2_2_3 | red | 5 | Aphelios | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 2_3_1 | red | 3 | Aphelios | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 2_3_1 | red | 5 | Aphelios | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 2_3_2 | blue | 3 | Yunara | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 2_3_2 | blue | 5 | Yunara | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 2_4_1 | blue | 5 | Yunara | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 2_4_1 | red | 5 | Aphelios | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 3_4_1 | red | 3 | Kled | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 3_4_1 | red | 5 | Kled | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 3_4_2 | red | 5 | Rek'Sai | 9.97 | Top |
| lec-2025.json | LEC/2025 Season/Summer Season_Week 4_3_2 | red | 5 | Twisted Fate | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Summer Playoffs_Round 1_2_4 | blue | 5 | Twitch | 9.97 | Bot |
| lec-2025.json | LEC/2025 Season/Summer Playoffs_Round 1_2_4 | red | 5 | Qiyana | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Summer Playoffs_Round 1_3_1 | red | 5 | Morgana | 9.97 | Mid |
| lec-2025.json | LEC/2025 Season/Summer Playoffs_Round 1_3_3 | blue | 3 | Zed | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Summer Playoffs_Round 1_3_3 | blue | 5 | Zed | 9.97 | Jungle |
| lec-2025.json | LEC/2025 Season/Summer Playoffs_Round 1_3_4 | blue | 5 | Tahm Kench | 9.97 | Support |
| lec-2025.json | LEC/2025 Season/Summer Playoffs_Round 1_4_3 | red | 5 | Vayne | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_1_1 | blue | 3 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_1_1 | blue | 3 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_1_1 | blue | 5 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_1_1 | blue | 5 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_1_1 | blue | 5 | Orianna | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_1_1 | blue | 5 | Rakan | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_1_1 | red | 3 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_1_1 | red | 3 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_1_1 | red | 5 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_1_1 | red | 5 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_1_1 | red | 5 | Taliyah | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_2_1 | blue | 3 | Viktor | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_2_1 | blue | 5 | Viktor | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_2_1 | blue | 5 | Jinx | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_2_1 | blue | 5 | Rakan | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_2_1 | red | 3 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_2_1 | red | 5 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_2_1 | red | 5 | Xin Zhao | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_3_1 | blue | 3 | Caitlyn | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_3_1 | blue | 3 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_3_1 | blue | 5 | Caitlyn | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_3_1 | blue | 5 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_3_1 | blue | 5 | Orianna | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_3_1 | red | 3 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_3_1 | red | 3 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_3_1 | red | 3 | Neeko | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_3_1 | red | 5 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_3_1 | red | 5 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_3_1 | red | 5 | Neeko | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_3_1 | red | 5 | Xin Zhao | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_4_1 | blue | 3 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_4_1 | blue | 3 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_4_1 | blue | 5 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_4_1 | blue | 5 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_4_1 | blue | 5 | Alistar | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_4_1 | red | 3 | Varus | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_4_1 | red | 3 | Xin Zhao | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_4_1 | red | 5 | Varus | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_4_1 | red | 5 | Xin Zhao | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_4_1 | red | 5 | Hwei | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_5_1 | blue | 3 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_5_1 | blue | 3 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_5_1 | blue | 5 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_5_1 | blue | 5 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_5_1 | blue | 5 | Akali | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_5_1 | red | 3 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_5_1 | red | 3 | Annie | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_5_1 | red | 5 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_5_1 | red | 5 | Annie | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_5_1 | red | 5 | Nocturne | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_5_1 | red | 5 | Alistar | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_6_1 | blue | 3 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_6_1 | blue | 3 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_6_1 | blue | 5 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_6_1 | blue | 5 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_6_1 | red | 3 | Corki | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_6_1 | red | 3 | Ivern | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_6_1 | red | 5 | Corki | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_6_1 | red | 5 | Ivern | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_6_1 | red | 5 | Rakan | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_7_1 | blue | 3 | Varus | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_7_1 | blue | 3 | Renata Glasc | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_7_1 | blue | 5 | Varus | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_7_1 | blue | 5 | Renata Glasc | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_7_1 | blue | 5 | Gwen | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_7_1 | red | 5 | Xin Zhao | 9.97 | Support |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_8_1 | blue | 3 | Corki | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_8_1 | blue | 5 | Corki | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_8_1 | red | 3 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_8_1 | red | 3 | Varus | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_8_1 | red | 5 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_8_1 | red | 5 | Varus | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_8_1 | red | 5 | Rakan | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_9_1 | blue | 3 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_9_1 | blue | 3 | Orianna | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_9_1 | blue | 5 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_9_1 | blue | 5 | Orianna | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_9_1 | blue | 5 | Jinx | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_9_1 | red | 3 | Varus | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_9_1 | red | 3 | Wukong | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_9_1 | red | 5 | Varus | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_9_1 | red | 5 | Wukong | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_10_1 | blue | 3 | Viktor | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_10_1 | blue | 3 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_10_1 | blue | 5 | Viktor | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_10_1 | blue | 5 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_10_1 | blue | 5 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_10_1 | blue | 5 | Renata Glasc | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_10_1 | red | 3 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_10_1 | red | 3 | Xin Zhao | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_10_1 | red | 5 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_10_1 | red | 5 | Xin Zhao | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_10_1 | red | 5 | Gnar | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_10_1 | red | 5 | Neeko | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_11_1 | blue | 3 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_11_1 | blue | 3 | Renata Glasc | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_11_1 | blue | 5 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_11_1 | blue | 5 | Renata Glasc | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_11_1 | blue | 5 | Gnar | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_11_1 | red | 3 | Varus | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_12_1 | blue | 3 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_12_1 | blue | 3 | Wukong | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_12_1 | blue | 3 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_12_1 | blue | 5 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_12_1 | blue | 5 | Wukong | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_12_1 | blue | 5 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_12_1 | blue | 5 | Alistar | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_12_1 | blue | 5 | Orianna | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_12_1 | red | 3 | Varus | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_12_1 | red | 3 | Ivern | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_12_1 | red | 5 | Varus | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 1_12_1 | red | 5 | Ivern | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_1_1 | blue | 3 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_1_1 | blue | 3 | Xin Zhao | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_1_1 | blue | 3 | Viktor | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_1_1 | blue | 5 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_1_1 | blue | 5 | Xin Zhao | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_1_1 | blue | 5 | Viktor | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_1_1 | blue | 5 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_2_1 | blue | 3 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_2_1 | blue | 3 | Viktor | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_2_1 | blue | 5 | Kalista | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_2_1 | blue | 5 | Viktor | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_2_1 | blue | 5 | Renata Glasc | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_2_1 | red | 3 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_2_1 | red | 3 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_2_1 | red | 5 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_2_1 | red | 5 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_2_1 | red | 5 | Akali | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_2_1 | red | 5 | Neeko | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_3_1 | blue | 3 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_3_1 | blue | 3 | Gnar | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_3_1 | blue | 5 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_3_1 | blue | 5 | Gnar | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_3_1 | blue | 5 | Neeko | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_3_1 | red | 3 | Varus | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_3_1 | red | 5 | Varus | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_3_1 | red | 5 | Yasuo | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_4_1 | blue | 3 | Caitlyn | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_4_1 | blue | 5 | Caitlyn | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_4_1 | blue | 5 | Hwei | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_4_1 | red | 3 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_4_1 | red | 3 | Viktor | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_4_1 | red | 3 | Gnar | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_4_1 | red | 5 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_4_1 | red | 5 | Viktor | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_4_1 | red | 5 | Gnar | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_4_1 | red | 5 | Nocturne | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_4_1 | red | 5 | Bard | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_5_1 | blue | 3 | Varus | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_5_1 | blue | 5 | Varus | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_5_1 | blue | 5 | Sion | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_5_1 | red | 3 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_5_1 | red | 3 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_5_1 | red | 5 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_5_1 | red | 5 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_5_1 | red | 5 | Akali | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_5_1 | red | 5 | Alistar | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_6_1 | blue | 3 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_6_1 | blue | 3 | Amumu | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_6_1 | blue | 5 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_6_1 | blue | 5 | Amumu | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_6_1 | blue | 5 | Gnar | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_6_1 | red | 3 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_6_1 | red | 5 | Corki | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_6_1 | red | 5 | Malphite | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_7_1 | blue | 3 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_7_1 | blue | 3 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_7_1 | blue | 5 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_7_1 | blue | 5 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_7_1 | red | 3 | Wukong | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_7_1 | red | 3 | Senna | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_7_1 | red | 5 | Wukong | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_7_1 | red | 5 | Senna | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_7_1 | red | 5 | Irelia | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_7_1 | red | 5 | Yasuo | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_8_1 | blue | 3 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_8_1 | blue | 3 | Xin Zhao | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_8_1 | blue | 5 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_8_1 | blue | 5 | Xin Zhao | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_8_1 | blue | 5 | Jinx | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_8_1 | red | 3 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_8_1 | red | 5 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Week 2_8_1 | red | 5 | Xerath | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 | blue | 3 | Draven | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 | blue | 3 | Renata Glasc | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 | blue | 5 | Draven | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 | blue | 5 | Renata Glasc | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 | blue | 5 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 | blue | 5 | Taliyah | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 | red | 3 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 | red | 3 | Soraka | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 | red | 5 | Kalista | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 | red | 5 | Soraka | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 | red | 5 | Viktor | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 | blue | 3 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 | blue | 3 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 | blue | 5 | Jayce | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 | blue | 5 | Kalista | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 | blue | 5 | Braum | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 | blue | 5 | Akali | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 | red | 3 | Varus | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 | red | 3 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 | red | 3 | Wukong | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 | red | 5 | Varus | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 | red | 5 | Ambessa | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 | red | 5 | Wukong | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 | red | 5 | Vladimir | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_3_1 | blue | 3 | Corki | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_3_1 | blue | 5 | Corki | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_3_1 | red | 3 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_3_1 | red | 5 | Rumble | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Groups_Tiebreakers_3_1 | red | 5 | Alistar | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 1_1_1 | blue | 5 | Nilah | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 1_2_2 | blue | 3 | Galio | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 1_2_2 | blue | 5 | Galio | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 1_3_1 | blue | 5 | Sivir | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 1_3_3 | blue | 3 | Ashe | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 1_3_3 | blue | 5 | Ashe | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 1_3_3 | red | 3 | Gragas | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 1_3_3 | red | 5 | Gragas | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 1_3_3 | red | 5 | Ahri | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 1_4_2 | red | 3 | Xayah | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 1_4_2 | red | 5 | Xayah | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 1_4_3 | red | 5 | Ahri | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 2_1_1 | blue | 3 | Xayah | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 2_1_1 | blue | 5 | Xayah | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 2_1_1 | blue | 5 | Galio | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 2_2_2 | red | 5 | Vel'Koz | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 2_3_2 | red | 3 | Pantheon | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 2_3_2 | red | 5 | Pantheon | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 2_3_3 | blue | 3 | Ashe | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 2_3_3 | blue | 5 | Ashe | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 2_3_3 | blue | 5 | Galio | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 2_4_1 | blue | 5 | Xayah | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 3_1_3 | blue | 5 | Pantheon | 9.97 | Support |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 3_1_3 | red | 3 | Gragas | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 3_1_3 | red | 5 | Gragas | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 3_1_3 | red | 5 | Sivir | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 3_2_1 | red | 5 | Ahri | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 3_2_2 | blue | 5 | Cassiopeia | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 3_2_2 | red | 5 | Camille | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Swiss_Round 3_2_2 | red | 5 | Vayne | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Playoffs_Round 1_2_2 | blue | 3 | Lulu | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Playoffs_Round 1_2_2 | blue | 5 | Lulu | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Playoffs_Round 1_2_2 | blue | 5 | Mel | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Playoffs_Round 1_2_2 | blue | 5 | Volibear | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Playoffs_Round 1_2_3 | blue | 5 | Swain | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Playoffs_Round 1_2_5 | blue | 5 | Karma | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Playoffs_Round 1_2_5 | blue | 5 | Zac | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Playoffs_Round 1_2_5 | red | 5 | Pyke | 9.97 | Support |
| lfl-2025.json | LFL/2025 Season/Flash In Playoffs_Round 2_1_2 | red | 3 | Lulu | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Flash In Playoffs_Round 2_1_2 | red | 5 | Lulu | 9.97 | Support |
| lfl-2025.json | LFL/2025 Season/Flash In Playoffs_Round 2_1_4 | red | 5 | Nunu &amp; Willump | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Flash In Playoffs_Finals_1_3 | red | 3 | Lulu | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Spring Split_Week 1_2_1 | red | 5 | Shen | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Spring Split_Week 1_8_1 | blue | 5 | Elise | 9.97 | Support |
| lfl-2025.json | LFL/2025 Season/Spring Split_Week 2_4_1 | red | 5 | Gangplank | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Spring Split_Week 2_11_1 | red | 3 | Naafiri | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Spring Split_Week 2_11_1 | red | 5 | Naafiri | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Spring Split_Week 2_12_1 | red | 5 | Warwick | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Spring Split_Week 2_19_1 | red | 5 | Naafiri | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Spring Split_Week 3_6_1 | red | 5 | Ryze | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Spring Split_Week 3_11_1 | blue | 5 | Zoe | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Spring Split_Week 3_11_1 | red | 5 | Ryze | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Spring Split_Week 3_13_1 | blue | 5 | Fiddlesticks | 9.97 | Support |
| lfl-2025.json | LFL/2025 Season/Spring Swiss_Round 1_1_3 | red | 5 | Aurelion Sol | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Spring Swiss_Round 1_2_2 | blue | 5 | Aurelion Sol | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Spring Swiss_Round 1_2_2 | blue | 5 | Diana | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Spring Swiss_Round 1_4_1 | blue | 3 | Ryze | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Spring Swiss_Round 1_4_1 | blue | 5 | Ryze | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Spring Swiss_Round 2_1_1 | blue | 5 | Milio | 9.97 | Support |
| lfl-2025.json | LFL/2025 Season/Spring Swiss_Round 2_1_2 | blue | 5 | Sett | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Spring Swiss_Round 2_4_3 | blue | 5 | Yorick | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Last Chance Round 1_2_2 | blue | 5 | Kennen | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Last Chance Round 2_1_1 | blue | 5 | LeBlanc | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Last Chance Round 2_1_1 | red | 5 | Yuumi | 9.97 | Support |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Last Chance Round 2_1_3 | red | 5 | Milio | 9.97 | Support |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Round 1_1_5 | blue | 3 | Trundle | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Round 1_1_5 | red | 5 | Cho'Gath | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Round 1_2_3 | red | 3 | Lucian | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Round 1_2_3 | red | 5 | Lucian | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Round 2_1_3 | red | 3 | Lucian | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Round 2_1_3 | red | 5 | Lucian | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Round 2_2_3 | red | 5 | Riven | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Semifinals_1_2 | blue | 5 | Lucian | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Semifinals_1_3 | red | 5 | Rammus | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Semifinals_1_4 | blue | 5 | Tahm Kench | 9.97 | Support |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Finals_1_4 | blue | 3 | Trundle | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Finals_1_4 | blue | 5 | Trundle | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Spring Playoffs_Finals_1_5 | red | 5 | Kog'Maw | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 1_3_2 | red | 5 | Nami | 9.97 | Support |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 2_4_3 | red | 3 | Nami | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 2_4_3 | red | 5 | Nami | 9.97 | Support |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_1_1 | red | 3 | Yunara | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_1_1 | red | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_3_1 | red | 3 | Yunara | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_3_1 | red | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_4_1 | blue | 3 | Yunara | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_4_1 | blue | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_4_1 | red | 3 | Aphelios | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_4_1 | red | 5 | Aphelios | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_6_1 | red | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_5_2 | blue | 3 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_5_2 | blue | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_6_3 | blue | 5 | Aphelios | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_7_1 | red | 5 | Kayn | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_7_3 | red | 3 | Yunara | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 3_7_3 | red | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_1_1 | blue | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_2_2 | red | 3 | Yunara | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_2_2 | red | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_3_1 | red | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_4_2 | red | 3 | Yunara | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_4_2 | red | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_5_1 | blue | 3 | Aphelios | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_5_1 | blue | 5 | Aphelios | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_5_1 | red | 3 | Yunara | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_5_1 | red | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_6_1 | blue | 3 | Yunara | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_6_1 | blue | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_7_1 | blue | 3 | Aphelios | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_7_1 | blue | 5 | Aphelios | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_7_1 | red | 3 | Yunara | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_7_1 | red | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_8_2 | red | 3 | Yunara | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 4_8_2 | red | 5 | Yunara | 9.97 | Bot |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 5_7_2 | red | 5 | Kled | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 5_7_3 | red | 3 | Qiyana | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 5_7_3 | red | 5 | Qiyana | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Summer Split_Week 6_1_1 | red | 5 | Udyr | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Playoffs_Round 1_1_1 | blue | 5 | Morgana | 9.97 | Mid |
| lfl-2025.json | LFL/2025 Season/Summer Playoffs_Round 1_2_3 | red | 5 | Kayle | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Playoffs_Round 1_2_4 | blue | 5 | Thresh | 9.97 | Support |
| lfl-2025.json | LFL/2025 Season/Summer Playoffs_Round 1_2_5 | blue | 3 | Rek'Sai | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Playoffs_Round 1_2_5 | blue | 5 | Rek'Sai | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Summer Playoffs_Round 1_2_5 | red | 5 | Nidalee | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Summer Playoffs_Round 2_2_3 | red | 5 | Rek'Sai | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Playoffs_Round 2_2_3 | red | 5 | Fiora | 9.97 | Top |
| lfl-2025.json | LFL/2025 Season/Summer Playoffs_Semifinals_1_5 | red | 3 | Fiora | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Summer Playoffs_Semifinals_1_5 | red | 5 | Fiora | 9.97 | Jungle |
| lfl-2025.json | LFL/2025 Season/Summer Playoffs_Finals_1_3 | blue | 5 | Zed | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 3_5_2 | blue | 3 | Renata Glasc | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 3_5_2 | blue | 5 | Renata Glasc | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 3_5_2 | blue | 5 | Hwei | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 3_5_4 | blue | 3 | Urgot | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 3_5_4 | blue | 5 | Urgot | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 3_7_2 | blue | 3 | Renata Glasc | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 3_7_2 | blue | 5 | Renata Glasc | 9.97 | Support |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 3_7_4 | blue | 5 | Zac | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 3_7_4 | blue | 5 | Zeri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 4_1_2 | blue | 5 | Renata Glasc | 9.97 | Support |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 4_2_2 | blue | 5 | Hwei | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 4_2_4 | blue | 3 | Renata Glasc | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 4_2_4 | blue | 5 | Renata Glasc | 9.97 | Support |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 5_1_4 | blue | 3 | Zeri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 5_1_4 | blue | 5 | Zeri | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 5_2_3 | blue | 5 | Lux | 9.97 | Support |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 5_5_5 | red | 5 | Taric | 9.97 | Support |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 5_6_2 | blue | 5 | Zeri | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 5_7_1 | blue | 3 | Renata Glasc | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 5_7_1 | blue | 5 | Renata Glasc | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 5_7_1 | blue | 5 | Olaf | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 5_7_3 | blue | 5 | Draven | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 1_Week 5_7_3 | red | 5 | Hwei | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 1 Playoffs_Round 2_2_2 | blue | 3 | Skarner | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1 Playoffs_Round 2_2_2 | blue | 5 | Skarner | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1 Playoffs_Round 2_2_5 | blue | 5 | Shen | 9.97 | Support |
| lpl-2025.json | LPL/2025 Season/Split 1 Playoffs_Round 1_2_4 | red | 3 | Yuumi | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1 Playoffs_Round 1_2_4 | red | 5 | Yuumi | 9.97 | Support |
| lpl-2025.json | LPL/2025 Season/Split 1 Playoffs_Round 2_4_4 | blue | 3 | Yuumi | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 1 Playoffs_Round 2_4_4 | blue | 5 | Yuumi | 9.97 | Support |
| lpl-2025.json | LPL/2025 Season/Split 1 Playoffs_Round 4_1_4 | red | 5 | Shen | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1 Playoffs_Round 3_1_3 | red | 5 | Shyvana | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 1 Playoffs_Round 4_2_3 | red | 5 | Mel | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 2_2_1 | blue | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 2_3_1 | blue | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 2_3_1 | blue | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 2_5_1 | red | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 2_5_1 | red | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 2_6_1 | red | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 2_6_1 | red | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 3_2_1 | red | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 3_2_1 | red | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 3_3_1 | red | 3 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 3_3_1 | red | 5 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 3_3_1 | red | 5 | Gwen | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 3_4_1 | blue | 3 | Gwen | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 3_4_1 | blue | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 3_5_1 | red | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 3_5_1 | red | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 3_6_1 | blue | 3 | Gwen | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 3_6_1 | blue | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 4_1_1 | blue | 3 | Gwen | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 4_1_1 | blue | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 4_4_1 | blue | 3 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 4_4_1 | blue | 5 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 4_5_1 | blue | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 4_5_1 | blue | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 4_6_1 | red | 3 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 4_6_1 | red | 5 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 5_1_1 | blue | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 5_1_1 | blue | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 5_3_1 | blue | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 5_3_1 | blue | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 5_6_1 | blue | 3 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 5_6_1 | blue | 5 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_1_1 | blue | 3 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_1_1 | blue | 5 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_1_1 | red | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_1_1 | red | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_3_1 | red | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_3_1 | red | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_4_1 | blue | 3 | Gwen | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_4_1 | blue | 5 | Gwen | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_4_1 | red | 3 | Naafiri | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_4_1 | red | 5 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_5_1 | blue | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_5_1 | blue | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_5_1 | red | 3 | Naafiri | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_5_1 | red | 5 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_6_1 | red | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_6_1 | red | 3 | Naafiri | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_6_1 | red | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 6_6_1 | red | 5 | Naafiri | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 7_3_1 | red | 3 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 7_3_1 | red | 5 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 7_4_1 | blue | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 7_4_1 | blue | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Tiebreakers_2_1 | blue | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Tiebreakers_2_1 | blue | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 8_3_1 | blue | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 8_3_1 | blue | 5 | Gwen | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 8_4_1 | blue | 3 | Gwen | 9.97 | Support |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 8_4_1 | blue | 5 | Gwen | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 8_5_1 | blue | 3 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 8_5_1 | blue | 5 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 8_5_1 | red | 3 | Gwen | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 8_5_1 | red | 5 | Gwen | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 8_6_1 | blue | 3 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 8_6_1 | blue | 5 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Day 8_6_1 | red | 5 | Singed | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 1_1_1 | red | 3 | Gwen | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 1_1_1 | red | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 1_2_1 | blue | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 1_2_1 | blue | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 1_2_1 | red | 3 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 1_2_1 | red | 3 | Zed | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 1_2_1 | red | 5 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 1_2_1 | red | 5 | Zed | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 2_1_1 | blue | 3 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 2_1_1 | blue | 3 | Gwen | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 2_1_1 | blue | 5 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 2_1_1 | blue | 5 | Gwen | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 2_1_3 | red | 5 | Zed | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 1_3_1 | blue | 3 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 1_3_1 | blue | 5 | Naafiri | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 1_3_1 | red | 3 | Gwen | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 1_3_1 | red | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 2_2_1 | red | 3 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Placements_Round 2_2_1 | red | 5 | Gwen | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 1_4_2 | blue | 5 | Lissandra | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 2_4_2 | blue | 5 | Cho'Gath | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 2_8_2 | red | 5 | Yorick | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 2_9_1 | blue | 3 | Yorick | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 2_9_1 | blue | 5 | Yorick | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 2_12_3 | blue | 5 | Jarvan IV | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 2_12_3 | red | 3 | Yorick | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 2_12_3 | red | 5 | Yorick | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 2_13_2 | red | 5 | Yorick | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 2_16_2 | blue | 5 | Ivern | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 3_1_3 | red | 3 | Yorick | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 3_1_3 | red | 5 | Yorick | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 3_2_3 | blue | 5 | Kassadin | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 3_4_3 | red | 3 | Yorick | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 3_4_3 | red | 5 | Yorick | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 3_7_2 | blue | 5 | Yorick | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 3_8_2 | red | 3 | Yorick | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 3_8_2 | red | 5 | Yorick | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 3_9_2 | red | 3 | Yorick | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 3_9_2 | red | 5 | Yorick | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 3_10_1 | red | 3 | Yorick | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 3_10_1 | red | 5 | Yorick | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 3_14_3 | blue | 5 | Annie | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 4_3_2 | blue | 3 | Annie | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 4_3_2 | blue | 5 | Annie | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 5_9_3 | blue | 5 | Aurelion Sol | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 6_1_2 | red | 5 | Trundle | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 6_3_2 | blue | 5 | Trundle | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 6_8_2 | blue | 3 | Milio | 9.97 | Support |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 6_8_2 | blue | 5 | Milio | 9.97 | Support |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 6_9_3 | red | 5 | Trundle | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 6_10_2 | red | 3 | Trundle | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 6_10_2 | red | 5 | Trundle | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 6_13_2 | blue | 5 | Graves | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 7_1_2 | red | 5 | Nasus | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 7_3_3 | red | 5 | Kled | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 7_7_3 | red | 5 | Milio | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 7_11_2 | red | 5 | Trundle | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 7_13_2 | red | 5 | Talon | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 8_5_2 | blue | 5 | Nasus | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2_Week 8_7_1 | blue | 5 | Trundle | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Playoffs_Round 1_1_4 | blue | 5 | Diana | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2 Playoffs_Round 1_5_4 | red | 5 | Diana | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Playoffs_Round 2_4_4 | red | 3 | Tahm Kench | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 2 Playoffs_Round 2_4_4 | red | 5 | Tahm Kench | 9.97 | Support |
| lpl-2025.json | LPL/2025 Season/Split 2 Playoffs_Round 2_4_5 | red | 5 | Fiora | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 2 Playoffs_Round 4_1_3 | blue | 5 | Cassiopeia | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2 Playoffs_Round 4_2_3 | blue | 5 | Soraka | 9.97 | Support |
| lpl-2025.json | LPL/2025 Season/Split 2 Playoffs_Round 4_2_4 | red | 5 | Cassiopeia | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 2 Playoffs_Finals_1_4 | red | 5 | Cassiopeia | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 2_2_2 | red | 3 | Twisted Fate | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 2_2_2 | red | 5 | Twisted Fate | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 2_11_2 | blue | 5 | Ekko | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 3_11_3 | red | 3 | Twisted Fate | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 3_11_3 | red | 5 | Twisted Fate | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_1_2 | blue | 5 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_2_1 | blue | 5 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_3_1 | red | 5 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_4_1 | red | 5 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_5_1 | blue | 3 | Yunara | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_5_1 | blue | 5 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_7_1 | blue | 3 | Yunara | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_7_1 | blue | 5 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_9_1 | red | 3 | Yunara | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_9_1 | red | 5 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_11_1 | blue | 3 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_11_1 | blue | 5 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_13_2 | blue | 3 | Yunara | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 4_13_2 | blue | 5 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 5_6_3 | blue | 3 | Yunara | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 5_6_3 | blue | 5 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 5_10_1 | blue | 3 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 5_10_1 | blue | 5 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 5_11_1 | blue | 3 | Yunara | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 5_11_1 | blue | 5 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 6_2_2 | red | 3 | Yunara | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 6_2_2 | red | 5 | Yunara | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 7_4_3 | blue | 5 | Qiyana | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Split 3_Week 7_7_2 | blue | 5 | Qiyana | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Grand Finals_Round 1_1_4 | red | 5 | Morgana | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Grand Finals_Round 1_3_4 | red | 3 | Morgana | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Grand Finals_Round 1_3_4 | red | 5 | Morgana | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Grand Finals_Round 1_3_5 | red | 5 | Rek'Sai | 9.97 | Top |
| lpl-2025.json | LPL/2025 Season/Grand Finals_Round 2_2_4 | red | 3 | Morgana | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Grand Finals_Round 2_2_4 | red | 5 | Morgana | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Grand Finals_Round 2_2_4 | red | 5 | Vayne | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Grand Finals_Round 4_1_3 | blue | 5 | Morgana | 9.97 | Jungle |
| lpl-2025.json | LPL/2025 Season/Grand Finals_Round 4_2_4 | blue | 5 | Veigar | 9.97 | Mid |
| lpl-2025.json | LPL/2025 Season/Regional Finals_Round 1_1_3 | blue | 3 | Rek'Sai | 9.97 | Bot |
| lpl-2025.json | LPL/2025 Season/Regional Finals_Round 1_1_3 | blue | 5 | Rek'Sai | 9.97 | Top |

### Verdict de la garde gelée

- Accuracy pooled k=3 (top-hypothèse, défense active) : 95.3 % (n = 17640) — seuil gelé 94,5 % : **ATTEINT** — la non-régression tient (F-c brancheable, sous réserve F2 VERTE).
