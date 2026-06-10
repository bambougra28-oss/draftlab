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

## Verdicts du harnais (3 ligues, seed 42, 2026-06-10)

| Piste | LCK 337 | LEC 246 | LFL 191 | Enseignement |
|---|---|---|---|---|
| pick-in-range@8 (tendances) | **beats** 0,318/0,271 | **beats** 0,340/0,290 | **beats** 0,353/0,299 | premier claim mesuré, robuste sur 3 ligues |
| ban-hit@5 par side (banEV répertoire) | loses 0,94/1,30 | loses 1,11/1,20 | **beats** 1,26/1,07 | les ranges de pick ne voient pas la demande contrefactuelle des perma-bans → terme ban-history à ajouter |
| **ban-hit@2 phase 2 (contre-compo)** | **beats** 0,042/0,016 | **beats** 0,086/0,033 | ties 0,042/0,022 | **la nature deux-régimes des bans est validée** : ×2,6-2,7 sur LCK/LEC, jamais perdant |
| Postdiction G1 (statements gameLength) | hasard 48,6 % | — | — | racine traitée par #15 (axe scaling data-primaire) → re-passer la postdiction |

Le Summit Gate fonctionne : chaque rouge est un problème d'optimisation bien
posé, et la découverte §E (bans phase 2 = contre-compo) est passée de
l'observation au moteur validé en une journée.

## Ce qui reste

| # | Item | Note |
|---|---|---|
| 1 | Terme de demande contrefactuelle (ban-history) dans I1/banEV **phase 1** → re-passer la piste répertoire | évolution moteur, cible : « beats » (la phase 2 est déjà verte) |
| 2 | Re-passer la postdiction G1 maintenant que l'axe scaling est data-primaire (#15 appliqué) | `scripts/backtest/postdiction.ts` — cible : sortir du hasard |
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
