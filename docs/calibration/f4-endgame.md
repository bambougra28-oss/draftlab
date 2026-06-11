# F4 — endgame solver : delta apparié, jamais gate isolée (run #2, chantier F)

> Généré : 2026-06-11T19:20:40.501Z · seed 42 · règle pré-enregistrée recopiée verbatim dans
> l'en-tête de `scripts/backtest/f4Endgame.ts` (gel : `docs/run2/F-pocket-picks.md` §3.4 — UNE règle, UN run).
> Datasets DraftGap gelés : `current-patch.json` sha256 `ACA91656AF68DFF5016152E947AAFBCEBFB3DFE320CC2781F8FDBE8983FB8869` (date 2026-06-10T15:27:33.873Z) ·
> `30-days.json` sha256 `6933C7C2D107AFD465E7D8F0C44765305FF8747A187ED54C4C1F73E87651A4B1` (date 2026-06-10T15:27:53.230Z).

## La question mesurée (pourquoi ce bras)

F-d (le solveur exhaustif de fin de série Fearless) prétend-il MIEUX classer que le
depth-2 shippé du panneau Coach ? Méthodologie de la gate A restreinte aux games de
gameNumber ≥ 4 : les DEUX bras rejouent les MÊMES tours avec les MÊMES C_t et les
mêmes injections ; seul valueOf change (navigate depth 2 vs recherche exhaustive
bornée espace ≤ 1e6). Delta de TD apparié par game ; **MDE DÉCLARÉ ≈ ±8 pp — très
au-dessus de l'effet attendu (~2 pp) : l'issue « non concluant » est ASSUMÉE
d'avance** et publiée telle quelle. Jamais gate isolée : aucun vert d'un autre
chantier ne dépend de ce bras.

## Verdict (règle gelée §3.4)

| Statistique | Valeur | IC 95 % | Exigence VERT | Lecture |
|---|---|---|---|---|
| Δ TD exhaustif − depth-2 (bootstrap clusterisé par série) | 3.26 pp | [-3.01 ; 9.55] pp | borne basse > 0 | NON CONCLUANT |

**Issue : NON CONCLUANT** — l'issue ASSUMÉE d'avance (MDE ≈ ±8 pp ≫ effet attendu ~2 pp) — F-d ship Expérimental (DA-V2-11) sur la seule garantie d'ingénierie (espace ≤ 10⁶, < 2 s). Aucun pooling post-hoc, aucune tranche supplémentaire.

Δ apparié : 3.26 pp, IC 95 % bootstrap clusterisé [-3.01 ; 9.55] pp (72 clusters, 92 games, 1000 resamples, seed 42).

## TD par bras (descriptif, Wilson 95 % — le verdict ne lit que le delta)

| Bras | n games | TD | Wilson 95 % |
|---|---|---|---|
| depth-2 (le bras de A) | 92 | 48.9 % | [38.9 ; 59.0] % |
| exhaustif (F-d) | 92 | 52.2 % | [42.1 ; 62.1] % |

## Couverture

- lck-2026.json : 337 records → 319 hors restriction (sans série ou gameNumber < 4) → 18 éligibles (0 sans vainqueur, 0 avec picks non résolus, 0 sans fold) → 5 scorées (13 écartées side-coverage) · 50 tours scorés (écartés : 0 template-mismatch, 92 too-few-comparators) · bras exhaustif : 26 tours basculés, 24 retombées depth-2 (plus grand espace basculé 524288) · anomalies 0.
- lec-2026.json : 246 records → 236 hors restriction (sans série ou gameNumber < 4) → 10 éligibles (0 sans vainqueur, 0 avec picks non résolus, 0 sans fold) → 5 scorées (5 écartées side-coverage) · 48 tours scorés (écartés : 0 template-mismatch, 37 too-few-comparators) · bras exhaustif : 24 tours basculés, 24 retombées depth-2 (plus grand espace basculé 524288) · anomalies 0.
- lfl-2026.json : 191 records → 180 hors restriction (sans série ou gameNumber < 4) → 8 éligibles (0 sans vainqueur, 0 avec picks non résolus, 3 sans fold) → 3 scorées (5 écartées side-coverage) · 30 tours scorés (écartés : 0 template-mismatch, 39 too-few-comparators) · bras exhaustif : 14 tours basculés, 16 retombées depth-2 (plus grand espace basculé 331776) · anomalies 0.
- lpl-2026.json : 445 records → 416 hors restriction (sans série ou gameNumber < 4) → 29 éligibles (0 sans vainqueur, 0 avec picks non résolus, 0 sans fold) → 16 scorées (13 écartées side-coverage) · 160 tours scorés (écartés : 0 template-mismatch, 76 too-few-comparators) · bras exhaustif : 80 tours basculés, 80 retombées depth-2 (plus grand espace basculé 524288) · anomalies 0.
- lec-2025.json : 308 records → 287 hors restriction (sans série ou gameNumber < 4) → 21 éligibles (0 sans vainqueur, 0 avec picks non résolus, 0 sans fold) → 13 scorées (8 écartées side-coverage) · 126 tours scorés (écartés : 0 template-mismatch, 68 too-few-comparators) · bras exhaustif : 56 tours basculés, 70 retombées depth-2 (plus grand espace basculé 524288) · anomalies 0.
- lfl-2025.json : 317 records → 299 hors restriction (sans série ou gameNumber < 4) → 16 éligibles (0 sans vainqueur, 0 avec picks non résolus, 2 sans fold) → 16 scorées (0 écartées side-coverage) · 159 tours scorés (écartés : 1 template-mismatch, 0 too-few-comparators) · bras exhaustif : 63 tours basculés, 96 retombées depth-2 (plus grand espace basculé 384) · anomalies 0.
- lpl-2025.json : 817 records → 750 hors restriction (sans série ou gameNumber < 4) → 60 éligibles (0 sans vainqueur, 0 avec picks non résolus, 7 sans fold) → 34 scorées (26 écartées side-coverage) · 340 tours scorés (écartés : 0 template-mismatch, 185 too-few-comparators) · bras exhaustif : 162 tours basculés, 178 retombées depth-2 (plus grand espace basculé 524288) · anomalies 0.

Détecteur Fearless (picks réutilisés entre games d'une même série / picks examinés) :

- lck-2026.json : 0/2050 → lockouts ON
- lec-2026.json : 0/1130 → lockouts ON
- lfl-2026.json : 0/500 → lockouts ON
- lpl-2026.json : 0/2830 → lockouts ON
- lec-2025.json : 0/1650 → lockouts ON
- lfl-2025.json : 46/1580 → lockouts OFF
- lpl-2025.json : 0/4980 → lockouts ON

## Notes honnêtes

- **MDE ≈ ±8 pp, déclaré AVANT le run** : n attendu ~174 games (125 G4 + 49 G5,
  ~125 clusters) — très au-dessus de l'effet attendu (~2 pp). « Non concluant » est
  l'issue pré-assumée ; elle sera publiée telle quelle, sans pooling post-hoc ni
  tranche supplémentaire.
- **Appariement strict** : mêmes games, mêmes tours, mêmes C_t (contrat
  `scoreGameForGate` : les tours scorés ne dépendent pas de valueOf) — le delta ne
  mesure QUE le changement de recherche.
- **Retombées depth-2** : un tour dont l'espace exact dépasse 10⁶ garde la valeur
  depth-2 dans les DEUX bras — sa contribution au delta est structurellement nulle ;
  le compte par corpus est publié dans la Couverture. La bascule ne se déclenche
  naturellement qu'en toute fin de draft, là où l'enjeu Fearless est maximal.
- **Folds et lockouts de A, corpus ENTIER** : la restriction gameNumber ≥ 4 ne
  filtre que les games scorées — le train et le détecteur Fearless voient tout le
  corpus (les picks G1-G3 de la série nourrissent les lockouts de G4/G5).
- **Timing** : la cible F-d (< 2 s par décision basculée) est mesurée et publiée sur
  STDERR au run — hors markdown pour préserver la byte-stabilité du rapport.
- **Clusters** : `series.matchId` préfixé par le chemin du corpus ; la restriction
  garantit que chaque game scorée appartient à une série.
- Seed 42 · `--generated-at` 2026-06-11T19:20:40.501Z · rapport byte-stable à seed/horodatage fixés.
