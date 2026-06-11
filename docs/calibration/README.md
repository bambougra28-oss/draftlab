# Calibration — protocole de backtest et scorecards (R3/R9)

> Ce dossier contient les scorecards versionnés par corpus et patch
> (`scorecard-<corpus>-<patch>.md`) produits par le harnais de backtest. C'est la
> définition opérationnelle du « Summit Gate » (ARCHITECTURE_V2 §8 R9, S7) :
> le jour où le scorecard rejoue les drafts tier-1 mieux que toute baseline
> publique, on y est — et on peut le prouver.

## Le protocole en quatre règles

1. **Walk-forward par patch** (DA-V2-9). Un modèle scoré sur le patch *k* est
   entraîné sur les patchs **strictement antérieurs** à *k*, jamais sur *k*
   ni après (la leçon de fuite temporelle M3.x). Les patchs sont ordonnés
   numériquement (`26.2 < 26.10`) ; un record sans patch plaçable est écarté
   et compté dans les notes — jamais deviné. Implémentation :
   `src/lib/backtest/walkforward.ts` (`groupByPatch`, `walkForward`).

2. **Baselines obligatoires.** Aucune métrique ne se publie seule : chaque
   ligne du scorecard affiche sa baseline naïve à côté de la valeur.
   Baselines actuelles :
   - issue de partie : `p = 0,5` (la pièce) et **side-only** (winrate blue du
     train — le verdict M3.5 : le side seul porte déjà du signal, tout modèle
     de draft doit le dépasser avant de revendiquer quoi que ce soit) ;
   - `pick-in-range@8` : top-8 par **fréquence brute** des picks du train ;
   - `ban-hit@5` : top-5 par **présence** globale du train (le modèle classe
     par totaux de bans, `banRotationProfile`).

3. **Bootstrap seedé.** Tout delta modèle − baseline porte un IC bootstrap
   95 % (1000 resamples, apparié sur le jeu de test partagé, PRNG mulberry32
   injecté). Une saison ≈ 300-900 prédictions : les deltas vivent dans le
   bruit, l'intervalle est la condition d'honnêteté. Le seed est publié dans
   les notes — chaque IC se rejoue à l'identique.

4. **Cibles fixées après première mesure** (R9). Aucune cible chiffrée n'est
   inventée avant d'avoir les baselines mesurées. Après la première mesure,
   chaque patch doit tenir le niveau ou expliquer pourquoi. La légende de
   chaque scorecard porte cette règle.

## Lancer le runner

```bash
pnpm backtest -- <records.json> [--seed N] [--generated-at ISO] [--patch X]
```

- `<records.json>` : un tableau JSON de `DraftRecord` normalisés
  (`src/lib/data/types.ts`) — l'export d'un snapshot, d'une sync Leaguepedia
  ou d'un corpus reconstruit.
- `--seed` (défaut 1) : seed du bootstrap — à publier avec le scorecard.
- `--generated-at` (défaut : maintenant) : horodatage injecté ; le runner est
  le seul endroit autorisé à lire l'horloge, la lib est pure.
- `--patch` (défaut : dernier patch du corpus) : libellé de la carte et
  suffixe du fichier `scorecard-<corpus>-<patch>.md` (le préfixe corpus vient
  du nom du fichier de records — deux ligues finissant sur le même patch ne
  s'écrasent pas).

Le script (`scripts/backtest/runCorpus.ts`) ne contient aucune logique de
scoring : tout vit dans la lib pure `src/lib/backtest/corpusRunner.ts`,
testée sous Vitest (`tests/corpusRunner.test.ts`, métriques vérifiées à la
main sur un corpus synthétique de 3 patchs).

## Format d'un scorecard

```
# Scorecard corpus — Summit Gate (R9) — Patch <patch>
> Généré le <ISO> par le harnais de backtest (walk-forward par patch, IC bootstrap 95 %).
| Métrique | Valeur | Baseline | Δ (IC 95 %) | Verdict |
...
## Notes      ← tailles d'échantillon, folds, records écartés, seed
## Légende    ← bat la baseline / à égalité / sous la baseline + règle R9
```

Verdicts : **bat la baseline** seulement quand l'IC du delta exclut zéro en
faveur du modèle ; un IC qui touche zéro est publié « à égalité (non
significatif) » — pas de victoire au point près.

## Métriques actuelles et extensions prévues

| Piste | Métrique | Modèle | Baseline |
|---|---|---|---|
| Issue de partie | log loss, Brier, accuracy | side-only (winrate blue du train) | p = 0,5 |
| Prochain pick | pick-in-range@8 | table de tendances de l'équipe (prior ligue = train), champions révélés exclus | fréquence brute top-8 |
| Bans | ban-hit@5 (hits moyens/game) | totaux de bans du train | présence du train top-5 |

Extensions prévues par la roadmap (mêmes règles, mêmes gardes) : postdiction
des win conditions (porte G1), log loss du prochain pick et ranges I1 (porte
G2), demande par rôle Fearless (porte G3-demande, amendée 2026-06-11 ;
rétention = S3 à enjeu badge ; jauge d'intégrité reportée en G3b), rétrospective
fog × counters (G4), accord navigator stratifié (G5), courbes de réponse du
Patch Oracle et hit rate de watchlist (G6).

## Limites connues du runner actuel

- Le modèle de tendances prédit `[]` pour une équipe absente du train : c'est
  compté comme un miss honnête (pas de prior inventé).
- Les 5 bans suggérés sont à l'échelle de la game (pas par phase B1-B3/B4-B5)
  et n'excluent rien — le best-response `banEV` n'est pas encore branché ici.
- La consommation Fearless n'est pas simulée dans les exclusions du
  pick-in-range (les champions révélés dans la draft courante le sont).
