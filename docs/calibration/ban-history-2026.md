# banEV phase 1 — terme de demande ban-history (run pré-enregistré)

> Règle gelée : `docs/run2/B-ban-history.md` §1, recopiée verbatim dans
> l'en-tête de `scripts/backtest/banHistory.ts`. UNE règle, UN run.
> Reproductibilité : seed 42, 1000 resamples, flux mulberry32 UNIQUE
> consommé dans l'ordre argv — par corpus : IC (nouveau − baseline) puis (nouveau − ancien).
> Horloges gelées (« Généré le » publiés) : lck `2026-06-10T19:33:00.590Z` · lec `2026-06-10T19:33:01.965Z` · lfl `2026-06-10T19:33:03.024Z` · lpl `2026-06-10T21:02:11.514Z`.

## Porte de validité du run (§1.4)

**RUN VALIDE** — baseline ET modèle ancien reproduits à 4 décimales sur les quatre corpus 2026.

| Corpus | Baseline recalculée | Baseline publiée | Ancien recalculé | Ancien publié | Reproduit |
|---|---:|---:|---:|---:|---|
| lck-2026.json | 1.3007 | 1.3007 | 0.8811 | 0.8811 | oui |
| lec-2026.json | 1.2039 | 1.2039 | 0.989 | 0.989 | oui |
| lfl-2026.json | 1.067 | 1.067 | 1.2598 | 1.2598 | oui |
| lpl-2026.json | 1.2459 | 1.2459 | 0.9144 | 0.9144 | oui |

## Primaire — les quatre corpus 2026 (piste §1.3, verdict §1.5)

| Ligue | n | folds | Nouveau | Ancien | Ancien publié | Baseline | Baseline publiée | Δ vs baseline (IC 95 %) | Verdict |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| lck-2026.json | 572 | 8 | 1.3479 | 0.8811 | 0.8811 | 1.3007 | 1.3007 | +0.0472 [-0.0017 ; +0.0962] | à égalité |
| lec-2026.json | 456 | 7 | 1.2982 | 0.989 | 0.989 | 1.2039 | 1.2039 | +0.0943 [+0.035 ; +0.1579] | bat la baseline |
| lfl-2026.json | 358 | 8 | 1.2123 | 1.2598 | 1.2598 | 1.067 | 1.067 | +0.1453 [+0.0698 ; +0.2207] | bat la baseline |
| lpl-2026.json | 736 | 6 | 1.1821 | 0.9144 | 0.9144 | 1.2459 | 1.2459 | -0.0639 [-0.1101 ; -0.019] | sous la baseline |

**Verdict global : ROUGE** — 1 ligue(s) « sous la baseline » : le terme de demande ne suffit pas ; la piste répertoire est retirée du ranking par défaut (§5), pas re-tunée.

## Secondaires descriptifs (§1.6 — ne peuvent PAS changer le verdict)

### Attribution du changement : Δ (nouveau − ancien)

| Ligue | Δ nouveau − ancien (IC 95 %) |
|---|---:|
| lck-2026.json | +0.4668 [+0.3794 ; +0.549] |
| lec-2026.json | +0.3092 [+0.2259 ; +0.4013] |
| lfl-2026.json | -0.0475 [-0.1369 ; +0.0364] |
| lpl-2026.json | +0.2677 [+0.1943 ; +0.3424] |

### Part des suggestions top-5 où le plancher lie (γ·attraction > takeProbability)

| Ligue | Part du plancher | Suggestions inspectées |
|---|---:|---:|
| lck-2026.json | 98.6 % | 2860 |
| lec-2026.json | 95.3 % | 2280 |
| lfl-2026.json | 91.9 % | 1790 |
| lpl-2026.json | 99.5 % | 3680 |
| lec-2025.json | 94.9 % | 2930 |
| lfl-2025.json | 93.4 % | 3060 |
| lpl-2025.json | 99.6 % | 7740 |

### Réplication descriptive 2025 (mêmes règles, mêmes constantes)

> **LCK 2025 absent — explicitement non attendu.** Ces lignes sont descriptives :
> le verdict §1.5 ne porte que sur les quatre corpus 2026.

| Ligue | n | folds | Nouveau | Ancien | Baseline | Δ vs baseline (IC 95 %) | Δ vs ancien (IC 95 %) | Verdict (descriptif) |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| lec-2025.json | 586 | 11 | 1.0973 | 0.8259 | 0.9147 | +0.1826 [+0.1229 ; +0.2407] | +0.2713 [+0.1877 ; +0.355] | bat la baseline |
| lfl-2025.json | 612 | 11 | 1.0948 | 0.9036 | 0.9853 | +0.1095 [+0.049 ; +0.1667] | +0.1912 [+0.116 ; +0.2533] | bat la baseline |
| lpl-2025.json | 1548 | 12 | 1.0594 | 0.8889 | 0.9121 | +0.1473 [+0.1124 ; +0.1822] | +0.1705 [+0.1234 ; +0.2145] | bat la baseline |

## Notes

- Constantes gelées : priorN = 10 · γ = 1 · candidats = top-30 présence · K = 5 · seed = 42 · 1000 resamples · lissage μ add-half · verdict sur 2026 seulement.
- Événements = (game, side bannissant) avec ≥ 1 ban résolu, toutes phases ; cible = les 5 bans de CE side ;
  folds walk-forward par patch (train = patchs strictement antérieurs du même corpus).
- Modèles : banEV régime répertoire — ranges `predictEnemyRange` (table de tendances de l’équipe adverse,
  meta = présence du train, exclude = ∅), assets `mineCombinations` (minGames 2),
  `replacementDrop = 1,5·(1 + 4·banRate_train)` — construction identique à la piste 4 du runner ;
  le NOUVEAU ajoute le provider `banAttractionRate(fit du train, équipe adverse, ·)` (priorN 10).
- La baseline (top-5 présence du train) ne dépend d’aucune horloge ; l’ancien et le nouveau sont runnés
  avec le timestamp publié de LEUR ligue (`PUBLISHED_GENERATED_AT`).
- La part du plancher (§1.6.2) est mesurée pendant la prédiction du nouveau run, hors PredictionPair.
- Limite connue, conservée pour comparabilité (§3.6) : `PICK_GROUPS_BY_SIDE` suppose le template
  blue-first (ère First Selection).
- Couverture : lck-2026.json 337 records (337 avec patch) → 572 événements · lec-2026.json 246 records (246 avec patch) → 456 événements · lfl-2026.json 191 records (191 avec patch) → 358 événements · lpl-2026.json 445 records (443 avec patch) → 736 événements · lec-2025.json 308 records (308 avec patch) → 586 événements · lfl-2025.json 317 records (317 avec patch) → 612 événements · lpl-2025.json 817 records (817 avec patch) → 1548 événements.
