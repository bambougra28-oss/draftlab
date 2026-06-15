# Gate ÉVALUATEUR — re-pondération des composantes différentielles (run #4, chantier R4)

> Généré : 2026-06-15T12:00:00.000Z · seed 42 · `--chain r4` · règle pré-enregistrée gelée :
> `docs/run4/R4-evaluator-reweight.md` §1 (commit 0aa2986, amendements R1-R12) — UNE règle, UN run.
> Datasets SoloQ gelés : current-patch sha256 `aca91656af68dff5016152e947aafbcebfb3dfe320cc2781f8fdbe8983fb8869` · 30-days sha256 `6933c7c2d107afd465e7d8f0c44765305ff8747a187ed54c4c1f73e87651a4b1`.
> logisticFit ridge=1e-6, maxIter=50, eps=1e-6 (littéraux assertés, R11). Override de hash : aucun (défauts gelés de la règle, snapshots run #2 vérifiés).

> ## ⚠ NON CONCLUANT — DÉFAUT D'OPTIMISEUR (divergence numérique), PAS un verdict d'hypothèse
>
> Le bras R4 a DIVERGÉ : le fit full-data poolé donne des coefficients
> `β₀ ≈ −1,16×10⁸`, `β₁..₃ ≈ 10⁷-10⁸` (cf. table « Fit full-data poolé ») et un
> `Δ log loss ≈ 11,8` — diagnostics non-équivoques d'une divergence de Newton,
> pas une calibration. Cause : `logisticFit` est un Newton NON AMORTI (calé sur
> `platt.ts`, sans recherche linéaire) ; sur les features Elo réelles
> (quasi-séparables), un pas déborde vers la saturation (q→0/1 ⇒ w→0 ⇒ Hessien
> ≈ ridge 1e-6), le pas suivant explose en ~10⁸. Le `ΔBrier ≈ +0,17` n'est que la
> conséquence de prédictions saturées à contresens.
>
> **Ce ROUGE est un ARTEFACT de l'optimiseur, PAS un test de l'hypothèse de
> re-pondération.** Le défaut était latent dans la règle gelée (ridge 1e-6 / pas
> de damping, hérité de `platt.ts`) ; ni les tests unitaires (données non
> séparables) ni la porte de validité (chemin E3/Platt seul) ne l'ont exercé.
> La règle R4 v1 est CONSOMMÉE et NON CONCLUANTE ; la lecture « ROUGE » §1.5
> ci-dessous NE S'APPLIQUE PAS (elle suppose un optimiseur convergent). Suite :
> R4 v2 = NOUVELLE règle gelée avec un optimiseur convergent déclaré (Newton
> amorti / régularisation adéquate), jamais un retuning silencieux de v1.
> Chiffres bruts conservés tels quels ci-dessous (publication honnête du défaut).

## La question mesurée

`analyzeDraft` est un modèle Elo additif à poids unitaires FIGÉS : winrate = σ((ln10/400)·(x₁+x₂+x₃)),
x₁=χ_ally−χ_enemy, x₂=δ_ally−δ_enemy, x₃=matchup. E3 (Platt) ne pouvait que ré-échelonner la somme
scalaire ; R4 RE-PONDÈRE les trois composantes (régression logistique ajustée walk-forward PAR LIGUE).
Si re-pondérer aide, R4 doit mieux calibrer le % que le modèle shippé (non calibré) ET que Platt.
Corrélation/calibration — jamais une prédiction de vainqueur.

## Verdict (critère V à DEUX IC co-décisifs, §1.4 — 2 cellules poolées)

| Cellule | n poolé | ΔBrier(R4−non cal.) | IC 95 % | ΔBrier(R4−Platt) | IC 95 % | Verdict |
|---|---|---|---|---|---|---|
| after3Picks | 2910 | 0,17381 | [0,15713 ; 0,19117] | 0,17295 | [0,15793 ; 0,18788] | ROUGE |
| fullDraft | 2910 | 0,16548 | [0,15096 ; 0,18114] | 0,16573 | [0,15064 ; 0,18124] | ROUGE |

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
| after3Picks | 11,83461 | [11,26054 ; 12,41332] | [0,15580 ; 0,19127] (1248 clusters) | 0,17344 | [0,15732 ; 0,18889] |
| fullDraft | 11,25475 | [10,61918 ; 11,85569] | [0,14885 ; 0,18236] (1248 clusters) | 0,16483 | [0,14965 ; 0,18051] |

### Per-league ΔBrier(R4 − non calibré) — DESCRIPTIF SANS POUVOIR (R5), 8 cellules

| Ligue | after3Picks | IC 95 % | fullDraft | IC 95 % |
|---|---|---|---|---|
| lck | 0,22120 | [0,18805 ; 0,25581] | 0,19334 | [0,16098 ; 0,22294] |
| lec | 0,22490 | [0,18212 ; 0,27104] | 0,21503 | [0,16894 ; 0,25668] |
| lfl | 0,08228 | [0,05107 ; 0,11464] | 0,19100 | [0,14761 ; 0,23451] |
| lpl | 0,15539 | [0,13128 ; 0,18008] | 0,11637 | [0,09470 ; 0,13706] |

### Fit full-data POOLÉ par position (shippé si VERT∧validated ; JAMAIS une métrique) + garde de signe (R6)

| Cellule | β₀ | β₁ (χ) | β₂ (δ) | β₃ (matchup) | colonnes retenues | tous βⱼ>0 | validated |
|---|---|---|---|---|---|---|---|
| after3Picks | -115968265,3781 | 12382865,1039 | 25747192,2197 | 51248165,5102 | 3/3 | true | false |
| fullDraft | -172070398,5043 | 91493532,4971 | 189810942,8937 | 196687502,3979 | 3/3 | true | false |

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
