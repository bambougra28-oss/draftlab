# Gate COACH — postdiction « conseil suivi » (run #2, chantier A)

> Généré : 2026-06-11T00:00:00.000Z · seed 42 · règle pré-enregistrée recopiée verbatim dans
> l'en-tête de `scripts/backtest/coachGate.ts` (gel : `docs/run2/A-coach-gate.md` §1 — UNE règle, UN run).
> Datasets DraftGap gelés : `dataset.json` sha256 `A7B4E89410994D9EB03C07652D62A266E53F44384F43D51A65213187F20FD8E5` (date 2026-06-11) ·
> `dataset.json` sha256 `A7B4E89410994D9EB03C07652D62A266E53F44384F43D51A65213187F20FD8E5` (date 2026-06-11).

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
| 1 | TD poolé (Wilson) | 50.0 % | [15.0 ; 85.0] % | borne basse > 50 % | NON |
| 2 | Δ TD coach − B1 (bootstrap clusterisé par série) | 0.00 pp | [-50.00 ; 50.00] pp | borne basse > 0 | NON |

**Couleur : ROUGE** — le TD poolé ne bat pas le hasard avec IC : aucun claim de conseil — enquête pré-cadrée §5, la règle est consommée (pas de retuning).

## Métrique primaire — taux de discrimination (TD)

| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 4 | 50.0 % | [15.0 ; 85.0] % | non significatif |
| corpus.json | 4 | 50.0 % | [15.0 ; 85.0] % | non significatif |

## Baseline B1 — coach-présence (baseline ACTIVE)

B1 rejoue exactement les mêmes games, les mêmes tours et les mêmes C_t, mais classe
par rang de présence du train (« suivre la méta ») : si le coach ne fait pas mieux,
son verdict ne vaut pas plus qu'un tableau de présence.

| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 4 | 50.0 % | [15.0 ; 85.0] % | non significatif |
| corpus.json | 4 | 50.0 % | [15.0 ; 85.0] % | non significatif |

Δ apparié TD coach − TD B1 : 0.00 pp, IC 95 % bootstrap clusterisé [-50.00 ; 50.00] pp (3 clusters, 4 games, 1000 resamples, seed 42).

## Secondaires descriptives (pré-enregistrées, AUCUN pouvoir de verdict)

### S1 — accord top-1 (le pick réel est-il l'argmax de C_t ?)

| Tranche | n tours | Accord | Wilson 95 % |
|---|---|---|---|
| Tours des vainqueurs | 20 | 0.0 % | [0.0 ; 16.1] % |
| Tours des perdants | 19 | 0.0 % | [0.0 ; 16.8] % |
| TOUS les tours (l'« accord navigator » du scorecard G5) | 39 | 0.0 % | [0.0 ; 9.0] % |

Delta vainqueurs − perdants : 0.00 pp.

### S2 — regret moyen v(argmax C_t) − v(réel) (échelle évaluateur NON calibrée)

Vainqueurs : 3.52 pp · Perdants : 4.21 pp — descriptif uniquement.

### S3 — TD du contrôle B2 (écho-dataset, anachronique par construction)

B2 classe par winrate global du snapshot CURRENT-PATCH (Σ_rôles wins / Σ_rôles games,
tie-break clé asc) : il borne la part du verdict attribuable à l'écho « méta future »
du dataset — s'il discrimine seul, la lecture du verdict doit le citer.

| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| TOUS corpus | 4 | 50.0 % | [15.0 ; 85.0] % | non significatif |
| corpus.json | 4 | 50.0 % | [15.0 ; 85.0] % | non significatif |

### S4 — tranche équilibrée (chaque équipe ≥ 5 games de train, |ΔWR| ≤ 0,10)

| Tranche | n games | TD | Wilson 95 % | Verdict vs hasard |
|---|---|---|---|---|
| Games équilibrées | 0 | — | — | — |

### S5 — TD poolé sous IC bootstrap clusterisé par série

TD 50.0 % · IC 95 % [0.0 ; 100.0] % (3 clusters, 1000 resamples, seed 42) — la lecture robuste à la corrélation intra-série, à comparer au Wilson du critère 1.

## Couverture

- corpus.json : 9 records → 4 éligibles (1 sans vainqueur, 1 avec picks non résolus, 3 sans fold) → 4 scorées (0 écartées side-coverage) · 39 tours scorés (écartés : 1 template-mismatch, 0 too-few-comparators) · distribution adverse active 19/39 tours · pick réel déjà dans C_t 0/39 · anomalies 0.

Détecteur Fearless (picks réutilisés entre games d'une même série / picks examinés) :

- corpus.json : 0/10 → lockouts ON

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
- **Puissance** : n scoré = 4 ; au seuil n = 2 400, le critère 1 exige TD ≳ 52,0 %
  (MDE ≈ +2,0 pp). Si n < ~1 900, la gate peut être structurellement non concluante —
  publiée telle quelle, aucun re-découpage.
- Seed 42 · `--generated-at` 2026-06-11T00:00:00.000Z · rapport byte-stable à seed/horodatage fixés.
