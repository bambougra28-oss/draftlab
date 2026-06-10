# DraftLab — Status

Updated: 2026-06-10 (fin du build complet)

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

- vitest : **764 passed / 5 skipped** (56 fichiers)
- svelte-check : **458 fichiers, 0 erreur, 0 warning**
- eslint : clean · vite build : **exit 0** (adapter Cloudflare)
- Note machine : `adapter.emulate` désactivé sur win32 (workerd#4668) — CI Linux non affectée.

## Ce qui reste — gated sur DONNÉES LIVE, pas sur du code

| # | Item | Débloqué par |
|---|---|---|
| 1 | Validation live Leaguepedia + premier corpus 2026 ordonné | **Bot password** (compte wiki → `Special:BotPasswords` → env `DRAFTLAB_LP_USER/PASS`) |
| 2 | Courses du harnais : portes G1-G6, scorecards R9 (`pnpm backtest -- corpus.json`), recalibrage des configs (tous les poids sont data-driven) | le corpus du #1 |
| 3 | Concordance inter-sources ≥95 % (acceptation R1) | #1 + gol.gg résidentiel (`DRAFTLAB_LIVE=1`) |
| 4 | Smoke navigateur réel (clic-through S1) | `pnpm dev` (fonctionne depuis le fix) |
| 5 | **Push GitHub (A1)** — il n'existe TOUJOURS aucun backup externe | `winget install GitHub.cli` → `gh auth login` → `gh repo create draftlab --private --source=. --push` + `git push --tags` |
| 6 | Annotation game-plan ~100 drafts (scoring M4.2/M5.1) | session Alain ~2h, formulaire à préparer |

## Step-ups en attente de sign-off

#9 (seuils pool tier 20/10/3 vs 14/5/1 d'origine) · #11 (promouvoir
`firstSelection` dans `SeriesGame`) · #12 (mapping ligue→région dans le
registre). #3/#10 appliqués en R1.

## Documentation

`docs/ARCHITECTURE_V2.md` (plan directeur V2.1) · `docs/USER_GUIDE.md` (guide
coach, reconstruit) · `docs/calibration/README.md` (protocole de validation) ·
`docs/research/` (4 rapports sources) · `journal.txt` (historique complet).
