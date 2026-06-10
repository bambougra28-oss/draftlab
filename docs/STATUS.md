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

## Acceptation R1 — VALIDÉE SUR DONNÉES LIVE (2026-06-10)

- ✅ **Bot Leaguepedia opérationnel** (le piège email-non-confirmé a été vécu et documenté).
- ✅ **774 drafts 2026 tirés et normalisés** (`static/corpus/` : LCK 337, LFL 191, LEC 246), 100 % de résolution des champions, ordre + patch + gameNumber sur chaque record.
- ✅ **Concordance gol.gg ⇄ Leaguepedia : 95,2 % critique** (20/21 ; side, vainqueur, bans à 100 % — l'unique écart est un trou de données amont chez gol.gg, détecté par le parser à la capture).
- ✅ **Premier scorecard réel** (`docs/calibration/scorecard-26.11.md`, walk-forward 337 drafts) : le modèle de tendances **bat la baseline** en pick-in-range@8 (0,318 vs 0,271) ; ban-hit@5 à égalité avec la présence (le banEV complet n'est pas encore branché dans le runner) ; side-only ≈ pile-ou-face sur LCK 2026.

## Verdicts du harnais (scorecard 26.11 + postdiction, 2026-06-10)

| Piste | Verdict | Enseignement |
|---|---|---|
| pick-in-range@8 (tendances) | **bat la baseline** (0,318 vs 0,271, IC bootstrap) | premier claim mesuré de l'outil |
| ban-hit@5 par side (banEV complet) | **loses** (0,94 vs 1,30, 2 itérations pré-enregistrées) | trouvaille structurelle : les ranges de pick ne voient pas la demande contrefactuelle des perma-bans → terme de demande informé par l'historique de bans à ajouter au moteur I1/banEV |
| Postdiction G1 (statements gameLength d'I3) | **hasard** (48,6 % [45,1 ; 52,2], 759 statements / 774 games) | les poids d'axes posés à la main ne portent pas de signal de fenêtre → calibration des poids contre cette cible mesurable |

Deux rouges honnêtes et un vert : le Summit Gate fonctionne — chaque rouge est
désormais un problème d'optimisation bien posé avec sa métrique.

## Ce qui reste

| # | Item | Note |
|---|---|---|
| 1 | Terme de demande contrefactuelle (ban-history) dans I1/banEV → re-passer la piste banEV | évolution moteur, cible : « beats » |
| 2 | Calibrer `DEFAULT_WIN_CONDITION_CONFIG` contre la postdiction G1 | la cible existe (`pnpm` + `scripts/backtest/postdiction.ts`) |
| 3 | Portes G3/G4 (rejeu Bo5 rétention, étude fog) | scripts sur le harnais existant |
| 4 | Recalibrage des priors N₀ / poids ranges sur corpus | avec #1-#2 |
| 5 | Smoke navigateur réel (clic-through S1) | `pnpm dev` |
| 6 | Annotation game-plan ~100 drafts (scoring M4.2/M5.1) | session Alain ~2h |
| 7 | Secrets Cloudflare + `gh workflow enable deploy.yml` | quand Alain veut déployer |

## Step-ups en attente de sign-off

#9 (seuils pool tier 20/10/3 vs 14/5/1 d'origine) · #11 (promouvoir
`firstSelection` dans `SeriesGame`) · #12 (mapping ligue→région dans le
registre). #3/#10 appliqués en R1.

## Documentation

`docs/ARCHITECTURE_V2.md` (plan directeur V2.1) · `docs/USER_GUIDE.md` (guide
coach, reconstruit) · `docs/calibration/README.md` (protocole de validation) ·
`docs/research/` (4 rapports sources) · `journal.txt` (historique complet).
