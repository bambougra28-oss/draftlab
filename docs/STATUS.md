# DraftLab — Status

Updated: 2026-06-10

## State

**V2.1 « Sommet » — R0 fait, R1 cœur livré.** La logique M1-M7 reconstruite est
verte ; le plan directeur est `docs/ARCHITECTURE_V2.md` (roadmap R0-R9, six
moteurs inédits en §6 bis, prior-art vérifié) ; la colonne vertébrale de
données R1 (schéma `DraftRecord`, providers Leaguepedia/Oracle's Elixir,
snapshots datés, détecteur de divergence) est codée et testée.

## Tests

- vitest : **270 passed / 3 skipped** (28 fichiers)
- svelte-check : 0 erreur (353 fichiers) · eslint : clean
- Tag `recovery-complete` posé.

## Couches

| Couche | État |
|---|---|
| M1 moteur + M2 pro + M4-M7 stratégique/storage | ✅ reconstruits, verts |
| R1 data : `src/lib/data/` (DraftRecord, leaguepediaCargo, oraclesElixir, snapshots, divergence, leagues) + cache IndexedDB | ✅ codé + 60 tests |
| Fixtures gol.gg (9 pages S16, 2026-06-10) | ✅ capturées (`tests/fixtures/golgg/`) |
| Parsers golgg + proxy `/api/golgg` | ⬜ prochaine session (sur fixtures) |
| Validation live Leaguepedia + corpus 2026 ordonné | ⬜ requiert bot password (A-actions) |
| UI (routes + composants) | ⬜ R2 |
| Harnais de backtest + recalibrage | ⬜ R3 |

## Actions Alain (bloquantes ou à fort levier)

1. **A1 — push GitHub** (toujours AUCUN backup externe du repo) :
   `winget install GitHub.cli` → `gh auth login` → `gh repo create draftlab --private --source=. --push` (+ `git push --tags`).
2. **A2 fait par l'architecte** : copie de secours du dossier fondateur dans
   `C:\Users\alain\Documents\draftlab-backup\` — à doubler hors machine.
3. **Bot password Leaguepedia** (compte wiki gratuit → `Special:BotPasswords`) ;
   renseigner `DRAFTLAB_LP_USER` / `DRAFTLAB_LP_PASS` pour la validation live
   (`DRAFTLAB_LIVE=1 pnpm test leaguepedia.live`).
4. Valider STEP_UP #9 (seuils pool tier) — #10 et #3 sont appliqués en R1.

## Suivant

R1 fin (parsers golgg sur fixtures + validation live + concordance ≥95 %),
puis R2 (reconstruction UI — capture de référence à la racine) en parallèle
de R3 (harnais + Win-Condition Graph v1). Détail : `docs/ARCHITECTURE_V2.md` §8.
