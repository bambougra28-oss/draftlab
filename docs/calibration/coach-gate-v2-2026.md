# Gate COACH v2 — candidats par pools joueurs réels (run #3, chantier A3)

> Généré : 2026-06-11T19:22:39.562Z · seed 42 · `--chain v2` · règle pré-enregistrée recopiée verbatim dans
> l'en-tête de `scripts/backtest/coachGateV2.ts` (gel : `docs/run3/A3-coach-player-pools.md` §1 — UNE règle, UN run).
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
| 1 | TD poolé (Wilson) | 51.7 % | [49.7 ; 53.7] % | borne basse > 50 % | NON |
| 2 | Δ TD coach − B1 (bootstrap clusterisé par série) | 2.46 pp | [-0.46 ; 5.38] pp | borne basse > 0 | NON |

**Couleur : ROUGE** — le TD poolé ne bat pas le hasard avec IC : aucun claim de conseil — enquête pré-cadrée §5, la règle est consommée (pas de retuning).

## Métrique primaire — taux de discrimination (TD)

| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 2419 | 51.7 % | [49.7 ; 53.7] % | non significatif |
| lck-2026.json | 283 | 51.6 % | [45.8 ; 57.4] % | non significatif |
| lec-2026.json | 228 | 50.9 % | [44.4 ; 57.3] % | non significatif |
| lfl-2026.json | 177 | 47.5 % | [40.2 ; 54.8] % | non significatif |
| lpl-2026.json | 366 | 50.0 % | [44.9 ; 55.1] % | non significatif |
| lec-2025.json | 291 | 56.0 % | [50.3 ; 61.6] % | bat le hasard |
| lfl-2025.json | 306 | 48.7 % | [43.1 ; 54.3] % | non significatif |
| lpl-2025.json | 768 | 53.3 % | [49.8 ; 56.8] % | non significatif |

## Baseline B1 — coach-présence (baseline ACTIVE)

B1 rejoue exactement les mêmes games, les mêmes tours et les mêmes C_t, mais classe
par rang de présence du train (« suivre la méta ») : si le coach ne fait pas mieux,
son verdict ne vaut pas plus qu'un tableau de présence.

| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 2419 | 49.2 % | [47.2 ; 51.2] % | non significatif |
| lck-2026.json | 283 | 44.2 % | [38.5 ; 50.0] % | sous le hasard |
| lec-2026.json | 228 | 50.4 % | [44.0 ; 56.9] % | non significatif |
| lfl-2026.json | 177 | 42.4 % | [35.3 ; 49.7] % | sous le hasard |
| lpl-2026.json | 366 | 50.5 % | [45.4 ; 55.6] % | non significatif |
| lec-2025.json | 291 | 53.1 % | [47.4 ; 58.7] % | non significatif |
| lfl-2025.json | 306 | 49.0 % | [43.5 ; 54.6] % | non significatif |
| lpl-2025.json | 768 | 50.3 % | [46.8 ; 53.9] % | non significatif |

Δ apparié TD coach − TD B1 : 2.46 pp, IC 95 % bootstrap clusterisé [-0.46 ; 5.38] pp (1084 clusters, 2419 games, 1000 resamples, seed 42).

## Secondaires descriptives (pré-enregistrées, AUCUN pouvoir de verdict)

### S1 — accord top-1 (le pick réel est-il l'argmax de C_t ?)

| Tranche | n tours | Accord | Wilson 95 % |
|---|---|---|---|
| Tours des vainqueurs | 12001 | 9.3 % | [8.8 ; 9.8] % |
| Tours des perdants | 11987 | 8.4 % | [8.0 ; 9.0] % |
| TOUS les tours (l'« accord navigator » du scorecard G5) | 23988 | 8.9 % | [8.5 ; 9.2] % |

Delta vainqueurs − perdants : 0.82 pp.

### S2 — regret moyen v(argmax C_t) − v(réel) (échelle évaluateur NON calibrée)

Vainqueurs : 2.01 pp · Perdants : 2.13 pp — descriptif uniquement.

### S3 — TD du contrôle B2 (écho-dataset, anachronique par construction)

B2 classe par winrate global du snapshot CURRENT-PATCH (Σ_rôles wins / Σ_rôles games,
tie-break clé asc) : il borne la part du verdict attribuable à l'écho « méta future »
du dataset — s'il discrimine seul, la lecture du verdict doit le citer.

| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 2419 | 51.4 % | [49.4 ; 53.4] % | non significatif |
| lck-2026.json | 283 | 52.5 % | [46.7 ; 58.2] % | non significatif |
| lec-2026.json | 228 | 56.8 % | [50.3 ; 63.1] % | bat le hasard |
| lfl-2026.json | 177 | 52.0 % | [44.7 ; 59.2] % | non significatif |
| lpl-2026.json | 366 | 52.6 % | [47.5 ; 57.7] % | non significatif |
| lec-2025.json | 291 | 49.1 % | [43.4 ; 54.9] % | non significatif |
| lfl-2025.json | 306 | 45.6 % | [40.1 ; 51.2] % | non significatif |
| lpl-2025.json | 768 | 51.9 % | [48.4 ; 55.4] % | non significatif |

### S4 — tranche équilibrée (chaque équipe ≥ 5 games de train, |ΔWR| ≤ 0,10)

| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| Games équilibrées | 929 | 51.2 % | [48.0 ; 54.4] % | non significatif |

### S5 — TD poolé sous IC bootstrap clusterisé par série

TD 51.7 % · IC 95 % [49.7 ; 53.6] % (1084 clusters, 1000 resamples, seed 42) — la lecture robuste à la corrélation intra-série, à comparer au Wilson du critère 1.

### S6 — delta apparié v2 − v1 (descriptive, §1.6 — AUCUN pouvoir de verdict)

Crédit v2 − crédit v1 par game, sur l'INTERSECTION des games scorées par les deux
chaînes (appariement par `${corpus}::${gameId}` — même convention de préfixe que les
clusters ; crédits v1 = le `--credits-out` du replay de la porte de validité, passé
via `--v1-credits`). L'attribution chiffrée du bloc candidats — descriptive : elle ne
peut ni sauver un rouge ni invalider un vert.

Δ v2 − v1 : -0.33 pp · IC 95 % bootstrap clusterisé [-2.60 ; 1.76] pp (1083 clusters, 2268 games appariées sur 2419 scorées v2, 1000 resamples, seed 42).

## Couverture

- lck-2026.json : 337 records → 286 éligibles (0 sans vainqueur, 0 avec picks non résolus, 51 sans fold) → 283 scorées (3 écartées side-coverage) · 2810 tours scorés (écartés : 0 template-mismatch, 27 too-few-comparators) · distribution adverse active 1407/2810 tours · pick réel déjà dans C_t 814/2810 · anomalies 0.
- lec-2026.json : 246 records → 228 éligibles (0 sans vainqueur, 0 avec picks non résolus, 18 sans fold) → 228 scorées (0 écartées side-coverage) · 2242 tours scorés (écartés : 0 template-mismatch, 38 too-few-comparators) · distribution adverse active 1121/2242 tours · pick réel déjà dans C_t 652/2242 · anomalies 0.
- lfl-2026.json : 191 records → 179 éligibles (0 sans vainqueur, 0 avec picks non résolus, 12 sans fold) → 177 scorées (2 écartées side-coverage) · 1738 tours scorés (écartés : 0 template-mismatch, 37 too-few-comparators) · distribution adverse active 873/1738 tours · pick réel déjà dans C_t 474/1738 · anomalies 0.
- lpl-2026.json : 445 records → 368 éligibles (0 sans vainqueur, 0 avec picks non résolus, 77 sans fold) → 366 scorées (2 écartées side-coverage) · 3633 tours scorés (écartés : 0 template-mismatch, 32 too-few-comparators) · distribution adverse active 1818/3633 tours · pick réel déjà dans C_t 1087/3633 · anomalies 0.
- lec-2025.json : 308 records → 293 éligibles (0 sans vainqueur, 0 avec picks non résolus, 15 sans fold) → 291 scorées (2 écartées side-coverage) · 2874 tours scorés (écartés : 2 template-mismatch, 40 too-few-comparators) · distribution adverse active 1433/2874 tours · pick réel déjà dans C_t 898/2874 · anomalies 0.
- lfl-2025.json : 317 records → 306 éligibles (0 sans vainqueur, 0 avec picks non résolus, 11 sans fold) → 306 scorées (0 écartées side-coverage) · 3050 tours scorés (écartés : 1 template-mismatch, 9 too-few-comparators) · distribution adverse active 1526/3050 tours · pick réel déjà dans C_t 706/3050 · anomalies 0.
- lpl-2025.json : 817 records → 774 éligibles (0 sans vainqueur, 0 avec picks non résolus, 43 sans fold) → 768 scorées (6 écartées side-coverage) · 7641 tours scorés (écartés : 0 template-mismatch, 52 too-few-comparators) · distribution adverse active 3822/7641 tours · pick réel déjà dans C_t 2434/7641 · anomalies 0.

Détecteur Fearless (picks réutilisés entre games d'une même série / picks examinés) :

- lck-2026.json : 0/2050 → lockouts ON
- lec-2026.json : 0/1130 → lockouts ON
- lfl-2026.json : 0/500 → lockouts ON
- lpl-2026.json : 0/2830 → lockouts ON
- lec-2025.json : 0/1650 → lockouts ON
- lfl-2025.json : 46/1580 → lockouts OFF
- lpl-2025.json : 0/4980 → lockouts ON

## Couverture v2 — pools joueurs (§1.2, descriptive, AUCUN pouvoir)

- TOUS corpus : tours avec ≥ 1 joueur du lineup à pool train non vide 23634/23988 (98.5 %) · sides de games scorées (2 par game) : lineup 5/5 4765, partiel (1-4) 0, vide 73 · taille moyenne du pool au tour : 53.6 champions distincts (11.6 entrées par joueur) · pool-share de C_t : 92901/95147 (97.6 %) candidats issus des pools · tours 100 % repli 381/23988 (1.6 %) · filtre de rôle : retranché ≥ 1 candidat 19036/23988 (79.4 %), garde-fou (liste vidée) 0/23988 (0.0 %) · pick-sans-role 0.
- lck-2026.json : tours avec ≥ 1 joueur du lineup à pool train non vide 2784/2810 (99.1 %) · sides de games scorées (2 par game) : lineup 5/5 560, partiel (1-4) 0, vide 6 · taille moyenne du pool au tour : 57.5 champions distincts (12.2 entrées par joueur) · pool-share de C_t : 11038/11156 (98.9 %) candidats issus des pools · tours 100 % repli 26/2810 (0.9 %) · filtre de rôle : retranché ≥ 1 candidat 2223/2810 (79.1 %), garde-fou (liste vidée) 0/2810 (0.0 %) · pick-sans-role 0.
- lec-2026.json : tours avec ≥ 1 joueur du lineup à pool train non vide 2242/2242 (100.0 %) · sides de games scorées (2 par game) : lineup 5/5 456, partiel (1-4) 0, vide 0 · taille moyenne du pool au tour : 42.4 champions distincts (8.8 entrées par joueur) · pool-share de C_t : 8696/8834 (98.4 %) candidats issus des pools · tours 100 % repli 3/2242 (0.1 %) · filtre de rôle : retranché ≥ 1 candidat 1767/2242 (78.8 %), garde-fou (liste vidée) 0/2242 (0.0 %) · pick-sans-role 0.
- lfl-2026.json : tours avec ≥ 1 joueur du lineup à pool train non vide 1627/1738 (93.6 %) · sides de games scorées (2 par game) : lineup 5/5 331, partiel (1-4) 0, vide 23 · taille moyenne du pool au tour : 30.2 champions distincts (6.6 entrées par joueur) · pool-share de C_t : 5928/6789 (87.3 %) candidats issus des pools · tours 100 % repli 131/1738 (7.5 %) · filtre de rôle : retranché ≥ 1 candidat 1351/1738 (77.7 %), garde-fou (liste vidée) 0/1738 (0.0 %) · pick-sans-role 0.
- lpl-2026.json : tours avec ≥ 1 joueur du lineup à pool train non vide 3633/3633 (100.0 %) · sides de games scorées (2 par game) : lineup 5/5 732, partiel (1-4) 0, vide 0 · taille moyenne du pool au tour : 56.5 champions distincts (11.7 entrées par joueur) · pool-share de C_t : 14400/14440 (99.7 %) candidats issus des pools · tours 100 % repli 0/3633 (0.0 %) · filtre de rôle : retranché ≥ 1 candidat 2895/3633 (79.7 %), garde-fou (liste vidée) 0/3633 (0.0 %) · pick-sans-role 0.
- lec-2025.json : tours avec ≥ 1 joueur du lineup à pool train non vide 2865/2874 (99.7 %) · sides de games scorées (2 par game) : lineup 5/5 580, partiel (1-4) 0, vide 2 · taille moyenne du pool au tour : 50.7 champions distincts (10.8 entrées par joueur) · pool-share de C_t : 11201/11342 (98.8 %) candidats issus des pools · tours 100 % repli 12/2874 (0.4 %) · filtre de rôle : retranché ≥ 1 candidat 2277/2874 (79.2 %), garde-fou (liste vidée) 0/2874 (0.0 %) · pick-sans-role 0.
- lfl-2025.json : tours avec ≥ 1 joueur du lineup à pool train non vide 2842/3050 (93.2 %) · sides de games scorées (2 par game) : lineup 5/5 570, partiel (1-4) 0, vide 42 · taille moyenne du pool au tour : 46.8 champions distincts (10.5 entrées par joueur) · pool-share de C_t : 11265/12131 (92.9 %) candidats issus des pools · tours 100 % repli 208/3050 (6.8 %) · filtre de rôle : retranché ≥ 1 candidat 2433/3050 (79.8 %), garde-fou (liste vidée) 0/3050 (0.0 %) · pick-sans-role 0.
- lpl-2025.json : tours avec ≥ 1 joueur du lineup à pool train non vide 7641/7641 (100.0 %) · sides de games scorées (2 par game) : lineup 5/5 1536, partiel (1-4) 0, vide 0 · taille moyenne du pool au tour : 63.2 champions distincts (13.7 entrées par joueur) · pool-share de C_t : 30373/30455 (99.7 %) candidats issus des pools · tours 100 % repli 1/7641 (0.0 %) · filtre de rôle : retranché ≥ 1 candidat 6090/7641 (79.7 %), garde-fou (liste vidée) 0/7641 (0.0 %) · pick-sans-role 0.

Pick réel ∈ C_t poolé : 7065/23988 (29.5 %) — publié en regard du v1 (18,4 % poolé ; S1 v1 : 5,7 % — `docs/calibration/coach-gate-2026.md`).

Sonde anti-inertie (§1.2-4) : pick-sans-role total 0 — OK (0 exigé).

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
- **Puissance** : n scoré = 2419 ; au seuil n = 2 400, le critère 1 exige TD ≳ 52,0 %
  (MDE ≈ +2,0 pp). Si n < ~1 900, la gate peut être structurellement non concluante —
  publiée telle quelle, aucun re-découpage.
- Seed 42 · `--generated-at` 2026-06-11T19:22:39.562Z · rapport byte-stable à seed/horodatage fixés.
