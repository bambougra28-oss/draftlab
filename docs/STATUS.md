# DraftLab — Status

Updated: 2026-06-15 (run #4 JOUÉE — gate évaluateur ROUGE : re-pondérer n'aide pas, le mur est les ENTRÉES)

## ⚡ RUN #4 — RÉSULTAT (2026-06-15) — branche `run4`

Périmètre tranché par Alain : attaquer l'**ÉVALUATEUR** (le seul levier que
run #3 désigne — S6≈0 à couverture forte disculpe la chaîne de candidats). Gate
R4 = re-pondérer les 3 composantes différentielles de `analyzeDraft`
(régression logistique ajustée) vs le modèle Elo à poids unitaires figés + Platt.

| Cellule poolée | ΔBrier(R4−non cal.) | ΔBrier(R4−Platt) | Verdict |
|---|---|---|---|
| after3Picks | +0,0026 [−0,0002 ; +0,0053] | +0,0018 [−0,0004 ; +0,0038] | **ROUGE** |
| fullDraft | +0,0017 [−0,0013 ; +0,0048] | +0,0020 [+0,0002 ; +0,0039] | **ROUGE** |

**ROUGE franc** : re-pondérer les composantes de l'évaluateur n'améliore PAS la
calibration — ΔBrier légèrement POSITIF (R4 marginalement pire), aucun IC sous 0.
β convergés minuscules (0,03-0,14) ; **AUC(somme→win) ≈ 0,546** (à peine au-dessus
du hasard). Triangulation décisive avec E3 (le ré-échelonnement Platt n'aidait
pas non plus, 0/12) et la gate coach (TD 51,7 %) : **le mur n'est PAS les poids,
c'est les ENTRÉES** (transfert SoloQ→pro). Le prochain euro va aux features
ancrées pro (projet de DONNÉES), pas à l'arithmétique de l'évaluateur (§5 ROUGE).

Parcours (tout committé, branche `run4`) : design gelé + revue 3 agents (R1-R12) ·
libs+17 tests (ancre `logisticFit==plattFit` 1e-10) · runner copié d'E3 + seam
`--chain e3|r4`, **porte de validité `--chain e3` byte-identique** (44 699 o, 0
divergent). **Incident élucidé** : le run v1 a divergé (Newton NON amorti, β≈10⁸
sur features quasi-séparables) — artefact non concluant, consommé (`a83d5b4`) ;
**correctif R13 = Newton amorti** (recherche linéaire), AVEUGLE au résultat
(β identique pour ridge ∈ {1e-6,1,√n} car MLE fini, AUC 0,546), re-run sous la
MÊME règle. Le run ci-dessus est le valide.

File run #5 (candidat n°1) : **features ancrées PRO** pour l'évaluateur (winrates
pro champion/rôle walk-forward, ou modèle entraîné sur le corpus pro) — NOUVELLE
règle, chantier de sourcing/modélisation. Puis re-tenter la ligne coach dessus.

### ✅ PRÊT À DÉPLOYER (2026-06-15)

Run #4 mergé sur `main` (local, en avance sur origin). **4 portes vertes** :
vitest **1264 passed / 5 skipped** · svelte-check **530 fichiers, 0/0** · eslint
**0** (fix : `.cjs` ignorés + échappements) · **vite build exit 0**, sortie
`.svelte-kit/cloudflare/` complète (`_worker.js`, corpus bundlé). Posture
d'honnêteté intacte : aucune sur-promesse de prédiction (toutes les cellules
calibration `validated:false`, badges « Non calibré »/« Expérimental », seul
PlanTreePanel est vert). Scouting gol.gg dégrade proprement en prod (403 IP
datacenter → message actionnable). **Une seule action restante = la tienne**
(compte Cloudflare) : `docs/DEPLOY.md` (créer le projet Pages + 2 secrets repo +
`git push origin main`).




## ⚡ RUN #3 — RÉSULTAT (2026-06-11 soir)

Protocole run #2 reproduit (designs gelés post-revue, runs one-shot architecte).

| Run | Verdict | Chiffre | Conséquence |
|---|---|---|---|
| **F-c non-régression** | **PASSÉE** | 95,3 % k=3 défense active (plancher 94,5) | **La défense anti-pocket se branche en live** |
| F4 endgame | non concluant (pré-assumé) | Δ +3,26 pp [−3,01 ; +9,55], n=92 | F-d ship Expérimental (garantie ingénierie) |
| **A3 coach v2 (pools joueurs)** | ROUGE | TD 51,7 % ; **Δ vs méta +2,46 pp [−0,46 ; +5,38]** (v1 : +0,92 [−1,72 ; +3,64]) | Porte de validité byte-passée ; le levier pools est RÉEL (×2,7 sur le delta), borne basse frôle 0 — leviers v3 : carrières cross-ligues (déclaré dans la règle), candidats plus larges |
| E3 calibration par ligue | ROUGE | 0 cellule validée (ICs chevauchent 0) | % bruts conservés, JSON tout validated:false |

File run #4 (candidats) : carrières cross-corpus dans les pools A3 · premium pocket conditionné au fit · demande Fearless par gameNumber · enquête LPL bans.

## ⚡ RUN #2 — RÉSULTAT (2026-06-11)

**L'événement central : la leçon Nasus menée au bout.** Le protocole « re-pull
avant tout run de gate » a découvert que **56 % des games 2026 (677/1219)
avaient le MAUVAIS vainqueur et les 20 actions inversées** — pas des erreurs
wiki : un bug de NOTRE provider (PB.Team1 = équipe du match, SG.Team1 = côté
bleu ; les deux divergent à l'ère First Selection). Prouvé sur la finale LEC,
corrigé par réalignement par noms, re-pull des 8 corpora (lck-2025 enfin
rentré : 555 drafts via Special:CargoExport — le chemin hors-throttle), 0
violation d'intégrité Bo, audit C reproduit AU CHIFFRE PRÈS. Détail :
`docs/run2/AMENDEMENT-corpus-20260611.md`. **Sans ce re-pull, on validait des
gates sur des données fausses et on branchait un faux signal G1 dans I3.**

### Verdicts des gates (règles gelées, UN run chacune, rapports publiés tels quels)

| Gate | Verdict | Chiffre | Conséquence appliquée |
|---|---|---|---|
| **A — coach « conseil suivi »** | ROUGE | TD 51,6 % [49,5 ; 53,7] ; Δ vs méta +0,92 pp ns | Copy « explorateur de lignes », badge conservé ; levier : candidats par pools joueurs réels (run #3) — accord top-1 5,7 %, ~20 % des picks réels dans C_t |
| **B — ban-history phase 1** | ROUGE (règle) | lec/lfl battent, lck égalité, **LPL −0,064** | Ranking répertoire retiré de l'UI ; module `banAttraction` conservé (I4/scouting) ; 2025 descriptif : 3/3 battent |
| **C — G3-demande Fearless** | ROUGE | +0,36 pp [−0,20 ; +0,87] | Déni non chiffré maintenu ; découvertes : S2 ρ≈−0,02 (déni précoce ⊥ issue de série), S3 AUC 0,503 (ordre de rétention = hasard) |
| **D — plans à branches** | **VERT** | **0,725 vs 0,588, Δ +0,137 [0,111 ; 0,162]** | **Le claim « arbre contre CET adversaire » ship** — couverture mesurée affichée, K=4/E=6 gelés |
| **E — calibration Platt** | ROUGE | ΔBrier −0,001/−0,002, IC effleurent 0 | % bruts conservés, JSON tout `validated:false` ; run #3 par ligue bien placé |
| **F1 — premium du pocket** | ROUGE | WR lo 43,6 % ; premium +4,3 pp ns | « Tes pockets » = outil de LECTURE badgé |
| **F2 — surprise casse les rôles** | **VERTE** | **Δ_contamination −82,5 pp [−87,7 ; −77,7]** | F-c justifié empiriquement — branchement derrière le re-run de non-régression (file post-run) |
| G1 — réplication durée (8 corpus) | fermée | compo-niveau 50,1 % (n=2934) | **Le 52,1 % de juin-10 était un artefact des données corrompues** — piste retirée |
| Rôles (re-mesure, 8 corpus) | confirmé | **95,3 % [95,0 ; 95,6]** k=3 | Le claim tient sur données propres |

### Claims qui SURVIVENT à la correction (scorecards régénérés, timestamps épinglés)

- **pick-in-range@8 bat la baseline 4/4 ligues** (0,29-0,35 vs 0,25-0,30) ✓
- **bans phase 2 contre-compo : 3 beats + 1 tie** ✓ (lck ×2,7, lec ×2,5, lpl ×7,2)
- **Inférence de rôles 95,3 %** ✓ (et F2 explique exactement QUAND elle casse)
- Nouveau : **side-only LCK 2026 +8,4 pp significatif** (l'avantage blue était
  masqué par les vainqueurs faux) ; lec/lfl/lpl ≈ pile-ou-face.

## Construit pendant la run (tout committé, 4 portes vertes)

Vague 2 (7 agents) + intégration : les 5 gates pré-enregistrées complètes
(libs pures + runners + ~280 tests à la main), outillage intégrité data
(validateur Bo format-aware dans pullCorpus, quarantaine fraîcheur,
validateCorpus/diffCorpus), provider : split-join + **Special:CargoExport**
(pulls hors bucket API) + réalignement PB→sides + patches flottants + entités
HTML. Produit : **arbre de prep compilé contre un adversaire** (compile côté
/plans, suivi de déviation live en mode séquence, recompile-en-séance,
section répertoire du prep pack), **calibration** (infra complète pilotée par
JSON, badge deux états), **panneau « Tes pockets »** (lecture de surprise en
bits, checklists depuis les tags, GARDER/DÉPENSER composants séparés),
moteurs F (publicSelfModel, pocketAdvisor, surpriseDefense débranché,
fearlessEndgame ≤10⁶ nœuds), storage v3 (planTrees). enrichPlayers réparé
(SP par GameId IN — l'attribution joueur tourne).

## Les 4 portes (vérifiées en fin de run)

- vitest : **~1124 passed / 5 skipped** · svelte-check : **513 fichiers, 0/0**
- eslint clean · vite build : exit 0 (adapter Cloudflare ; `adapter.emulate`
  toujours désactivé sur win32 — workerd#4668)

## File post-run (par priorité)

| # | Item | Note |
|---|---|---|
| 1 | **F-c : re-run de non-régression** (`roleInference` avec défense active, k=3 ≥ 94,5 %) puis branchement live | F2 verte l'exige avant tout branchement |
| 2 | **F4 : bras exhaustif vs depth-2 sur G4-5** | exige d'extraire les folds du harnais A (consommé) en lib réutilisable — refactor post-run ; issue pré-assumée « non concluant » |
| 3 | **Gate coach run #3** : candidats = pools joueurs réels (enrichPlayers ✓) + ranges I1 au root — NOUVELLE règle gelée | le levier identifié par le rouge de A |
| 4 | Calibration run #3 : cartes par ligue (+lck-2025) | E penchait du bon côté partout |
| 5 | Ban-history : enquête LPL (γ·μ, bans concentrés) — nouvelle règle si re-tenté | B §5 |
| 6 | Étude science-de-la-draft à re-passer sur données corrigées | les fits tagPairs/counter cells du produit sont re-fittés au chargement (corpus corrigé ⇒ déjà propres) ; le DOCUMENT de recherche reste daté |
| 7 | Annotation game-plan ~100 drafts (session Alain ~2 h) | vérité terrain M4.2/plans |
| 8 | Option produit « mon pool » (saisie manuelle) pour le réservoir personnel F-a | décision Alain, non bloquante |
| 9 | Demande de bot flag Leaguepedia (Discord) | débridage durable ; CargoExport suffit en attendant |
| 10 | Secrets Cloudflare + `gh workflow enable deploy.yml` | quand Alain veut déployer |

## Step-ups en attente de sign-off

#9 (seuils pool tier) · #11 (firstSelection dans SeriesGame) · #12 (mapping
ligue→région) · #13 (low-mobility inversé) · #14 (tag Malphite AD) ·
**nouveau #16 : étendre la formule Bo du validateur à maxWins ≥ 4** (9 séries
4-0/4-1/5-0 silencieuses sous {2,3} — épinglé par test).

## Documentation

`docs/ARCHITECTURE_V2.md` (V2.1) · `docs/run2/` (6 designs gelés + amendement
corpus) · `docs/calibration/` (8 rapports de gates + scorecards corrigés) ·
`docs/ETAT_DES_LIEUX.md` (document d'entrée de la run, historique) ·
`journal.txt`.
