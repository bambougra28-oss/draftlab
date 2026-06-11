# Gate COACH — postdiction « conseil suivi » (run #2, chantier A)

> Généré : 2026-06-11T11:55:20.989Z · seed 42 · règle pré-enregistrée recopiée verbatim dans
> l'en-tête de `scripts/backtest/coachGate.ts` (gel : `docs/run2/A-coach-gate.md` §1 — UNE règle, UN run).
> Datasets DraftGap gelés : `current-patch.json` sha256 `ACA91656AF68DFF5016152E947AAFBCEBFB3DFE320CC2781F8FDBE8983FB8869` (date 2026-06-10T15:27:33.873Z) ·
> `30-days.json` sha256 `6933C7C2D107AFD465E7D8F0C44765305FF8747A187ED54C4C1F73E87651A4B1` (date 2026-06-10T15:27:53.230Z).

## La question mesurée (pourquoi cette gate)

Le panneau Coach classe des picks. Si ce classement contient du signal, les picks
réellement joués par les équipes GAGNANTES doivent ressortir au-dessus de ceux des
PERDANTES de la même game : chaque pick réel reçoit son percentile parmi les candidats
que le panneau shippé aurait classés au même état (ρ_t), chaque side sa moyenne, et la
game crédite le coach (1 / ½ / 0) selon que le side vainqueur obtient — ou non — le
meilleur percentile moyen. TD = part des games créditées ; hasard = 0,5. Corrélation,
pas causalité : personne ne rejoue les games.

## Verdict (critères gelés §1.5)

| Critère | Statistique | Valeur | IC 95 % | Exigence | Atteint |
|---|---|---|---|---|---|
| 1 | TD poolé (Wilson) | 51.6 % | [49.5 ; 53.7] % | borne basse > 50 % | NON |
| 2 | Δ TD coach − B1 (bootstrap clusterisé par série) | 0.92 pp | [-1.72 ; 3.64] pp | borne basse > 0 | NON |

**Couleur : ROUGE** — le TD poolé ne bat pas le hasard avec IC : aucun claim de conseil — enquête pré-cadrée §5, la règle est consommée (pas de retuning).

## Métrique primaire — taux de discrimination (TD)

| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 2275 | 51.6 % | [49.5 ; 53.7] % | non significatif |
| lck-2026.json | 248 | 51.8 % | [45.6 ; 58.0] % | non significatif |
| lec-2026.json | 216 | 52.3 % | [45.7 ; 58.9] % | non significatif |
| lfl-2026.json | 170 | 48.2 % | [40.8 ; 55.7] % | non significatif |
| lpl-2026.json | 331 | 55.3 % | [49.9 ; 60.6] % | non significatif |
| lec-2025.json | 268 | 50.4 % | [44.4 ; 56.3] % | non significatif |
| lfl-2025.json | 306 | 51.8 % | [46.2 ; 57.3] % | non significatif |
| lpl-2025.json | 736 | 50.8 % | [47.2 ; 54.4] % | non significatif |

## Baseline B1 — coach-présence (baseline ACTIVE)

B1 rejoue exactement les mêmes games, les mêmes tours et les mêmes C_t, mais classe
par rang de présence du train (« suivre la méta ») : si le coach ne fait pas mieux,
son verdict ne vaut pas plus qu'un tableau de présence.

| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 2275 | 50.7 % | [48.6 ; 52.7] % | non significatif |
| lck-2026.json | 248 | 48.6 % | [42.4 ; 54.8] % | non significatif |
| lec-2026.json | 216 | 49.3 % | [42.7 ; 55.9] % | non significatif |
| lfl-2026.json | 170 | 51.2 % | [43.7 ; 58.6] % | non significatif |
| lpl-2026.json | 331 | 52.1 % | [46.7 ; 57.4] % | non significatif |
| lec-2025.json | 268 | 48.3 % | [42.4 ; 54.3] % | non significatif |
| lfl-2025.json | 306 | 50.0 % | [44.4 ; 55.6] % | non significatif |
| lpl-2025.json | 736 | 52.2 % | [48.6 ; 55.8] % | non significatif |

Δ apparié TD coach − TD B1 : 0.92 pp, IC 95 % bootstrap clusterisé [-1.72 ; 3.64] pp (1086 clusters, 2275 games, 1000 resamples, seed 42).

## Secondaires descriptives (pré-enregistrées, AUCUN pouvoir de verdict)

### S1 — accord top-1 (le pick réel est-il l'argmax de C_t ?)

| Tranche | n tours | Accord | Wilson 95 % |
|---|---|---|---|
| Tours des vainqueurs | 11352 | 5.5 % | [5.1 ; 5.9] % |
| Tours des perdants | 11351 | 5.9 % | [5.5 ; 6.4] % |
| TOUS les tours (l'« accord navigator » du scorecard G5) | 22703 | 5.7 % | [5.4 ; 6.0] % |

Delta vainqueurs − perdants : -0.39 pp.

### S2 — regret moyen v(argmax C_t) − v(réel) (échelle évaluateur NON calibrée)

Vainqueurs : 1.26 pp · Perdants : 1.42 pp — descriptif uniquement.

### S3 — TD du contrôle B2 (écho-dataset, anachronique par construction)

B2 classe par winrate global du snapshot CURRENT-PATCH (Σ_rôles wins / Σ_rôles games,
tie-break clé asc) : il borne la part du verdict attribuable à l'écho « méta future »
du dataset — s'il discrimine seul, la lecture du verdict doit le citer.

| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 2275 | 50.7 % | [48.7 ; 52.8] % | non significatif |
| lck-2026.json | 248 | 53.6 % | [47.4 ; 59.7] % | non significatif |
| lec-2026.json | 216 | 54.6 % | [48.0 ; 61.1] % | non significatif |
| lfl-2026.json | 170 | 50.6 % | [43.1 ; 58.0] % | non significatif |
| lpl-2026.json | 331 | 50.2 % | [44.8 ; 55.5] % | non significatif |
| lec-2025.json | 268 | 52.2 % | [46.3 ; 58.1] % | non significatif |
| lfl-2025.json | 306 | 47.7 % | [42.2 ; 53.3] % | non significatif |
| lpl-2025.json | 736 | 49.7 % | [46.1 ; 53.3] % | non significatif |

### S4 — tranche équilibrée (chaque équipe ≥ 5 games de train, |ΔWR| ≤ 0,10)

| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| Games équilibrées | 855 | 51.2 % | [47.8 ; 54.5] % | non significatif |

### S5 — TD poolé sous IC bootstrap clusterisé par série

TD 51.6 % · IC 95 % [49.5 ; 53.7] % (1086 clusters, 1000 resamples, seed 42) — la lecture robuste à la corrélation intra-série, à comparer au Wilson du critère 1.

## Couverture

- lck-2026.json : 337 records → 286 éligibles (0 sans vainqueur, 0 avec picks non résolus, 51 sans fold) → 248 scorées (38 écartées side-coverage) · 2468 tours scorés (écartés : 0 template-mismatch, 251 too-few-comparators) · distribution adverse active 1235/2468 tours · pick réel déjà dans C_t 491/2468 · anomalies 0.
- lec-2026.json : 246 records → 228 éligibles (0 sans vainqueur, 0 avec picks non résolus, 18 sans fold) → 216 scorées (12 écartées side-coverage) · 2153 tours scorés (écartés : 0 template-mismatch, 74 too-few-comparators) · distribution adverse active 1078/2153 tours · pick réel déjà dans C_t 497/2153 · anomalies 0.
- lfl-2026.json : 191 records → 179 éligibles (0 sans vainqueur, 0 avec picks non résolus, 12 sans fold) → 170 scorées (9 écartées side-coverage) · 1700 tours scorés (écartés : 0 template-mismatch, 55 too-few-comparators) · distribution adverse active 850/1700 tours · pick réel déjà dans C_t 356/1700 · anomalies 0.
- lpl-2026.json : 445 records → 368 éligibles (0 sans vainqueur, 0 avec picks non résolus, 77 sans fold) → 331 scorées (37 écartées side-coverage) · 3303 tours scorés (écartés : 0 template-mismatch, 209 too-few-comparators) · distribution adverse active 1653/3303 tours · pick réel déjà dans C_t 625/3303 · anomalies 0.
- lec-2025.json : 308 records → 293 éligibles (0 sans vainqueur, 0 avec picks non résolus, 15 sans fold) → 268 scorées (25 écartées side-coverage) · 2672 tours scorés (écartés : 2 template-mismatch, 160 too-few-comparators) · distribution adverse active 1335/2672 tours · pick réel déjà dans C_t 520/2672 · anomalies 0.
- lfl-2025.json : 317 records → 306 éligibles (0 sans vainqueur, 0 avec picks non résolus, 11 sans fold) → 306 scorées (0 écartées side-coverage) · 3059 tours scorés (écartés : 1 template-mismatch, 0 too-few-comparators) · distribution adverse active 1529/3059 tours · pick réel déjà dans C_t 472/3059 · anomalies 0.
- lpl-2025.json : 817 records → 774 éligibles (0 sans vainqueur, 0 avec picks non résolus, 43 sans fold) → 736 scorées (38 écartées side-coverage) · 7348 tours scorés (écartés : 0 template-mismatch, 262 too-few-comparators) · distribution adverse active 3675/7348 tours · pick réel déjà dans C_t 1210/7348 · anomalies 0.

Détecteur Fearless (picks réutilisés entre games d'une même série / picks examinés) :

- lck-2026.json : 0/2050 → lockouts ON
- lec-2026.json : 0/1130 → lockouts ON
- lfl-2026.json : 0/500 → lockouts ON
- lpl-2026.json : 0/2830 → lockouts ON
- lec-2025.json : 0/1650 → lockouts ON
- lfl-2025.json : 46/1580 → lockouts OFF
- lpl-2025.json : 0/4980 → lockouts ON

## Notes honnêtes

- **Anachronisme du dataset** : l'évaluateur SoloQ est au patch COURANT sur des games
  passées — population disjointe (aucune issue du corpus pro ne fuit), bruit symétrique
  entre les deux sides d'une même game, mais un écho « méta future » reste possible :
  S3 (B2) le borne noir sur blanc. Inéliminable sans snapshots SoloQ datés (DA-V2-3).
- **Ordre `assumed-blue-first`** : l'entrelacement des seqs est une hypothèse de
  construction pour les corpus per-team (ère First Selection) ; il déforme S_t
  identiquement pour les deux sides d'une game (exact pour les corpus 2025).
- **Corrélation de série** : l'IC Wilson (i.i.d.) du critère 1 est anticonservateur —
  la lecture robuste est S5 (bootstrap par cluster de série, même seed).
- **Crédits fractionnaires** : `wilson95(Σcrédits, n)` traite les ½ comme des succès
  partiels — les égalités flottantes exactes sont quasi impossibles, approximation déclarée.
- **Clusters** : `series.matchId` préfixé par le chemin du corpus (une série vit dans un
  seul fichier ; le préfixe interdit toute fusion accidentelle d'ids entre corpus) ;
  une game sans série est son propre cluster.
- **« Distribution adverse active »** : sonde déterministe = le premier nœud du lookahead
  après le pick réel est un nœud adverse à distribution non vide (tours dont le slot
  suivant est allié : structurellement inactifs).
- **`now_k`** : ancre temporelle = plus ancienne date du patch testé dans le même corpus
  (repli `--generated-at`) — leak-free et fidèle au jour de match.
- **WR train (S4)** : seuls les records de train à vainqueur connu comptent (un match
  sans issue n'est pas une évidence de force).
- **Puissance** : n scoré = 2275 ; au seuil n = 2 400, le critère 1 exige TD ≳ 52,0 %
  (MDE ≈ +2,0 pp). Si n < ~1 900, la gate peut être structurellement non concluante —
  publiée telle quelle, aucun re-découpage.
- Seed 42 · `--generated-at` 2026-06-11T11:55:20.989Z · rapport byte-stable à seed/horodatage fixés.
