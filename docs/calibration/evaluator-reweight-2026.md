# Gate ÉVALUATEUR — re-pondération des composantes différentielles (run #4, chantier R4)

> Généré : 2026-06-15T12:00:00.000Z · seed 42 · `--chain r4` · règle pré-enregistrée gelée :
> `docs/run4/R4-evaluator-reweight.md` §1 (commit 0aa2986, amendements R1-R12) — UNE règle, UN run.
> Datasets SoloQ gelés : current-patch sha256 `aca91656af68dff5016152e947aafbcebfb3dfe320cc2781f8fdbe8983fb8869` · 30-days sha256 `6933c7c2d107afd465e7d8f0c44765305ff8747a187ed54c4c1f73e87651a4b1`.
> logisticFit ridge=1e-6, maxIter=50, eps=1e-6 (littéraux assertés, R11). Override de hash : aucun (défauts gelés de la règle, snapshots run #2 vérifiés).

> **Provenance (R13 — correction de bug d'optimiseur, AVEUGLE au résultat).** Un
> premier run (R4 v1, optimiseur Newton NON amorti) a DIVERGÉ numériquement
> (β≈10⁸, Δlog loss≈11,8) — artefact, non concluant, consommé (historique git
> `a83d5b4`). Cause élucidée : Newton sans recherche linéaire explose sur des
> features Elo quasi-séparables. Correctif R13 : **Newton AMORTI** (recherche
> linéaire par halving) — garantie de CONVERGENCE standard, qui ne change pas
> l'objectif. **Preuve qu'il ne s'agit PAS d'un retuning** : la donnée n'étant
> pas séparable (AUC somme standardisée→win ≈ 0,546, MLE fini), le β convergé est
> IDENTIQUE pour ridge ∈ {1e-6, 1, √n} — le ridge gelé n'a aucune influence, seul
> l'amortissement change. Critères, features, comparateurs, seed : INCHANGÉS.
> CE rapport est le run VALIDE sous la même règle gelée (porte de validité
> `--chain e3` toujours byte-identique : le correctif ne touche que `logisticFit`,
> pas le chemin Platt). Anchor `logisticFit==plattFit` toujours vert (1e-10).

## La question mesurée

`analyzeDraft` est un modèle Elo additif à poids unitaires FIGÉS : winrate = σ((ln10/400)·(x₁+x₂+x₃)),
x₁=χ_ally−χ_enemy, x₂=δ_ally−δ_enemy, x₃=matchup. E3 (Platt) ne pouvait que ré-échelonner la somme
scalaire ; R4 RE-PONDÈRE les trois composantes (régression logistique ajustée walk-forward PAR LIGUE).
Si re-pondérer aide, R4 doit mieux calibrer le % que le modèle shippé (non calibré) ET que Platt.
Corrélation/calibration — jamais une prédiction de vainqueur.

## Verdict (critère V à DEUX IC co-décisifs, §1.4 — 2 cellules poolées)

| Cellule | n poolé | ΔBrier(R4−non cal.) | IC 95 % | ΔBrier(R4−Platt) | IC 95 % | Verdict |
|---|---|---|---|---|---|---|
| after3Picks | 2910 | 0,00262 | [-0,00016 ; 0,00534] | 0,00177 | [-0,00040 ; 0,00376] | ROUGE |
| fullDraft | 2910 | 0,00171 | [-0,00133 ; 0,00481] | 0,00197 | [0,00021 ; 0,00385] | ROUGE |

**VERT** = les DEUX IC entièrement sous 0 (R4 bat le modèle shippé ET le ré-échelonnement Platt).
**VERT FAIBLE** = seul ΔBrier(R4−non cal.) sous 0, ΔBrier(R4−Platt) chevauche 0 : gain compatible avec
un simple ré-échelonnement, la re-pondération relative N'EST PAS démontrée (pas de ship). **ROUGE** =
ΔBrier(R4−non cal.) ne reste pas sous 0.

- **after3Picks** : ROUGE.
- **fullDraft** : ROUGE.

## Couverture (paires de test poolées — doivent égaler les comptes gelés E3)

| Cellule | n poolé | lck | lec | lfl | lpl |
|---|---|---|---|---|---|
| afterBans | 2910 | 818 | 470 | 450 | 1172 |
| after3Picks | 2910 | 818 | 470 | 450 | 1172 |
| fullDraft | 2910 | 818 | 470 | 450 | 1172 |

## afterBans — DÉGÉNÉRESCENCE STRUCTURELLE (descriptif, hors verdict — R9)

À afterBans, x₁=x₂=x₃=0 (aucun pick) ⇒ les 3 colonnes sont exclues ⇒ R4 = intercept-only = side-only ;
il ne teste RIEN sur la re-pondération. Brier poolé (descriptif) :

- R4 (≈ side-only) : 0,25011 · side-only : 0,25011 · non calibré (p_raw≡0,5) : 0,25000 · pièce : 0,25000
- ΔBrier(R4 − non calibré) à afterBans = 0,00011 : c'est l'effet side-only vs pièce déjà connu de E3/run #2, PAS un test de re-pondération.

## Secondaires descriptives (AUCUN pouvoir de verdict, §1.6)

| Cellule | Δ log loss(R4−non cal.) | IC 95 % | IC clusterisé ΔBrier(R4−non cal.) | ΔBrier(R4−side-only) | IC 95 % |
|---|---|---|---|---|---|
| after3Picks | 0,00566 | [-0,00018 ; 0,01146] | [-0,00029 ; 0,00538] (1248 clusters) | 0,00225 | [-0,00025 ; 0,00451] |
| fullDraft | 0,00407 | [-0,00275 ; 0,01017] | [-0,00118 ; 0,00489] (1248 clusters) | 0,00106 | [-0,00143 ; 0,00343] |

### Per-league ΔBrier(R4 − non calibré) — DESCRIPTIF SANS POUVOIR (R5), 8 cellules

| Ligue | after3Picks | IC 95 % | fullDraft | IC 95 % |
|---|---|---|---|---|
| lck | 0,00255 | [-0,00192 ; 0,00667] | 0,00182 | [-0,00372 ; 0,00710] |
| lec | 0,00223 | [-0,00628 ; 0,01062] | 0,00532 | [-0,00560 ; 0,01516] |
| lfl | 0,00286 | [-0,00649 ; 0,01224] | 0,00024 | [-0,00821 ; 0,00901] |
| lpl | 0,00275 | [-0,00092 ; 0,00642] | 0,00075 | [-0,00356 ; 0,00500] |

### Fit full-data POOLÉ par position (shippé si VERT∧validated ; JAMAIS une métrique) + garde de signe (R6)

| Cellule | β₀ | β₁ (χ) | β₂ (δ) | β₃ (matchup) | colonnes retenues | tous βⱼ>0 | validated |
|---|---|---|---|---|---|---|---|
| after3Picks | 0,1375 | -0,0009 | 0,0426 | 0,1040 | 3/3 | false | false |
| fullDraft | 0,1384 | 0,0296 | 0,1377 | 0,1190 | 3/3 | true | false |

## Lecture pré-écrite (gelée avant le run, §1.5)

- **VERT** : l'évaluateur PORTE du signal de win que ses poids unitaires figés gaspillent — la
  re-pondération le récupère. Suites (chantiers SÉPARÉS, §5) : ship d'un évaluateur re-pondéré,
  re-run de la gate coach. Rien de cela ne s'exécute dans ce commit.
- **ROUGE** : re-pondérées optimalement par ligue en walk-forward, les trois composantes ne calibrent
  pas mieux que le modèle shippé. Résultat NÉGATIF de plein droit (la re-pondération linéaire n'aide
  pas). « Le mur, ce sont les entrées (SoloQ→pro) » est une HYPOTHÈSE non testée ici, renvoyée à un
  futur projet de features ancrées pro — jamais une conclusion de R4.

## Limite documentée (anachronisme SoloQ, verbatim E3)

```
LIMITE DOCUMENTÉE (reprise verbatim dans le rapport) : le snapshot SoloQ est
« d'aujourd'hui » et évalue des games 2025-2026 (fuite de features M3.x connue).
Elle contamine p_raw À L'IDENTIQUE dans les bras calibré et non calibré (comparaison
appariée interne valide) ; le claim autorisé porte sur la CARTE DE CALIBRATION,
jamais sur la force prédictive de l'évaluateur. Aucun « on prédit le vainqueur ».
```
