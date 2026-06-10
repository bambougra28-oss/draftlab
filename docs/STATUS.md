# DraftLab — Status

Updated: 2026-06-10 (science de la draft intégrée aux moteurs)

## State

**V2.1 « Sommet » — CONSTRUITE.** Les vagues A/B/C (13 agents orchestrés, 12
commits de jalons) ont livré tout le code de la roadmap R1→R8 : data backbone
multi-sources, scraper gol.gg (bug original corrigé), UI complète (8 routes,
21 composants), et les six moteurs inédits — ranges adverses avec information
négative (I1), fog & reveal (I2), win conditions bilatéral (I3), series solver
Fearless avec déni et First Selection (I4), revue annotée + prep pack
imprimable (I5), patch oracle (I6) — plus estimateurs bayésiens, agrégats/
tendances, harnais de backtest et runner de scorecards.

## Les 4 portes (vérifiées)

- vitest : **809 passed / 5 skipped** (57 fichiers)
- svelte-check : **465 fichiers, 0 erreur, 0 warning**
- eslint : clean · vite build : **exit 0** (adapter Cloudflare)
- Note machine : `adapter.emulate` désactivé sur win32 (workerd#4668) — CI Linux non affectée.

## Acceptation R1 — VALIDÉE SUR DONNÉES LIVE (2026-06-10)

- ✅ **Bot Leaguepedia opérationnel** (le piège email-non-confirmé a été vécu et documenté).
- ✅ **774 drafts 2026 tirés et normalisés** (`static/corpus/` : LCK 337, LFL 191, LEC 246), 100 % de résolution des champions, ordre + patch + gameNumber sur chaque record.
- ✅ **Concordance gol.gg ⇄ Leaguepedia : 95,2 % critique** (20/21 ; side, vainqueur, bans à 100 % — l'unique écart est un trou de données amont chez gol.gg, détecté par le parser à la capture).
- ✅ **Premier scorecard réel** (`docs/calibration/scorecard-lck-2026-26.11.md`, walk-forward 337 drafts) : le modèle de tendances **bat la baseline** en pick-in-range@8 (0,318 vs 0,271) ; side-only ≈ pile-ou-face sur LCK 2026.

## Science de la draft intégrée (2026-06-10, après-midi)

Le corpus a parlé (`docs/research/2026-06_draft_science_corpus.md`), les
moteurs ont bougé — trois branchements mesurés le jour même :

1. **banEV à deux régimes** (`$lib/strategic/banEv.ts`) : phase 1 =
   répertoire (priver de ce qu'ils veulent jouer), phase 2 = **contre-compo**
   (retirer le profil qui bat NOTRE compo révélée, menace `counterThreat`
   des cellules ordonnées de `tagPairs`, la tendance ne fait que pondérer la
   plausibilité, plancher 0,3).
2. **Axe paire dans le coach** (`$lib/intel/liveDraft.ts` + CoachPanel) :
   cellules de traits ajustées sur les 774 drafts (`fitTagPairCells`),
   raison FR + badge `pairWith` quand un candidat forme une paire éprouvée
   (plancher 1 pp), rappel « pensez la paire » à l'ouverture des doubles
   slots (8-9, 10-11, 18-19) où les pros posent 46 %/43 % de leurs duos.
3. **Axe scaling data-primaire** (STEP_UP #15, `winConditionGraph.ts`) : la
   courbe de puissance observée porte l'axe (tags amortis ×0,25 dessous) ;
   sans courbe, repli tags-seuls plafonné à confiance `low` (r ≈ 0,006 avec
   la durée réelle — le signal mort à l'origine du G1 hasard).
4. **Axe contre-compo au pick** (soir, `liveDraft.counterVs`) : les cellules
   ordonnées validées par le banEV phase 2 parlent aussi au moment du pick —
   « Profil qui contre leur compo révélée : +X pp », badge violet, plancher
   1 pp.
5. **Lecture des rôles adverses** (soir, I2 enfin branché) : priors de rôles
   corpus (cascade équipe → ligue, `aggregates/rolePriors`) →
   `roleAssignmentHypotheses` → alertes de désaccord (« 82 % mid chez eux —
   slotté top », plancher 0,6) + ambiguïté en bits. **Validé pré-enregistré**
   (`docs/calibration/role-inference-2026.md`, walk-forward, 7 corpus) :
   top-hypothèse **95,0 %** à 3 picks révélés [94,7 ; 95,4], 93,4 % à 5 —
   bat l'argmax indépendant, écrase le 20 % aléatoire.

## Verdicts du harnais (4 ligues, seed 42, 2026-06-10)

Corpus étendu le soir même : **LPL 2026 tiré (445 drafts, 100 % résolus,
durées et rôles complets)** → 1219 drafts au total.

| Piste | LCK 337 | LEC 246 | LFL 191 | LPL 445 | Enseignement |
|---|---|---|---|---|---|
| pick-in-range@8 (tendances) | **beats** 0,318/0,271 | **beats** 0,340/0,290 | **beats** 0,353/0,299 | **beats** 0,287/0,252 | premier claim mesuré, robuste sur 4 ligues |
| ban-hit@5 par side (banEV répertoire) | loses 0,94/1,30 | loses 1,11/1,20 | **beats** 1,26/1,07 | loses 1,04/1,25 | les ranges de pick ne voient pas la demande contrefactuelle des perma-bans → terme ban-history à ajouter |
| **ban-hit@2 phase 2 (contre-compo)** | **beats** 0,042/0,016 | **beats** 0,086/0,033 | ties 0,042/0,022 | **beats** 0,080/0,011 (×7,3) | **la nature deux-régimes des bans est validée** : 3 beats + 1 tie, jamais perdant |
| Postdiction G1 — piste tags | hasard 49,3 % [46,5 ; 52,1] (n=1226) | | | | confirmé sur 4 ligues : les tags ne portent pas le signal de durée |
| Postdiction G1 — piste **courbes pro** (walk-forward, priors 12/50 pré-enregistrés) | hasard 48,1 % [43,8 ; 52,5] (n=511) | | | | **rouge honnête** : les courbes EB-shrunk aplatissent l'axe (statements « late » 423→72) — gelée, pas de retuning |
| Postdiction G1 — piste **compo-niveau** (cellules paires de traits × durée, priorN 200, poids nL·nS/(nL+nS), pré-enregistrée) | **52,1 % [49,1 ; 55,1]** (n=1059) | | | | la PREMIÈRE piste qui penche : 4 ligues ≥ 51 %, deux directions cohérentes — mais IC touche 50 % ET la tranche haute-confiance fait 49,9 % (la magnitude ne prédit pas le hit). Verdict : non significatif. Suite propre : réplication à règle GELÉE sur les corpus 2025 (puissance n≈2400) |

Le Summit Gate fonctionne : chaque rouge est un problème d'optimisation bien
posé, et la découverte §E (bans phase 2 = contre-compo) est passée de
l'observation au moteur validé en une journée. Les courbes de puissance PRO
existent désormais comme module (`$lib/estimators/proPowerCurves`, Dataset
overlay compatible M4.3) — le mécanisme #15 est en place, le signal G1 reste
à trouver.

## Ce qui reste

| # | Item | Note |
|---|---|---|
| 1 | Terme de demande contrefactuelle (ban-history) dans I1/banEV **phase 1** → re-passer la piste répertoire | évolution moteur, cible : « beats » (la phase 2 est déjà verte) |
| 2 | G1 : réplication de la piste compo-niveau à règle GELÉE sur les corpus 2025 (LCK/LEC/LFL/LPL) — 52,1 % à n=1059 demande n≈2400 pour conclure | pull 2025 + re-run, AUCUN paramètre ne bouge ; si ça réplique → gate verte et branchement I3 |
| 3 | Portes G3/G4 (rejeu Bo5 rétention, étude fog) | scripts sur le harnais existant |
| 4 | Recalibrage des priors N₀ / poids ranges sur corpus | avec #1-#2 |
| 5 | Smoke navigateur réel (clic-through S1) | `pnpm dev` |
| 6 | Annotation game-plan ~100 drafts (scoring M4.2/M5.1) | session Alain ~2h |
| 7 | Secrets Cloudflare + `gh workflow enable deploy.yml` | quand Alain veut déployer |

## Step-ups en attente de sign-off

#9 (seuils pool tier 20/10/3 vs 14/5/1 d'origine) · #11 (promouvoir
`firstSelection` dans `SeriesGame`) · #12 (mapping ligue→région dans le
registre) · #13 (low-mobility-vs-pick inversé) · #14 (tag Malphite AD).
#3/#10 appliqués en R1 ; **#15 appliqué le 2026-06-10**.

## Documentation

`docs/ARCHITECTURE_V2.md` (plan directeur V2.1) · `docs/USER_GUIDE.md` (guide
coach, reconstruit) · `docs/calibration/README.md` (protocole de validation) ·
`docs/research/` (4 rapports sources) · `journal.txt` (historique complet).
