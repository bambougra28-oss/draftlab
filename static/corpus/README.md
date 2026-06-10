# Corpus de drafts pro (DraftRecord normalisés)

Tirés de l'API Cargo de **Leaguepedia** (lol.fandom.com) via
`scripts/data/pullCorpus.ts` (login bot requis — env `DRAFTLAB_LP_USER` /
`DRAFTLAB_LP_PASS`).

> **Attribution** : Data from Leaguepedia (lol.fandom.com), licence
> **CC BY-SA 3.0**. Toute redistribution de ces fichiers doit conserver
> cette mention.

| Fichier | Drafts | Couverture (au 2026-06-10) |
|---|---|---|
| `lck-2026.json` | 337 | LCK Cup, Rounds 1-2, Road to MSI — patchs 26.01→26.11 |
| `lfl-2026.json` | 191 | Invitational, Spring (+Playoffs), Promotion |
| `lec-2026.json` | 246 | Versus (+Playoffs), Spring (+Playoffs) |
| `lpl-2026.json` | 445 | Splits 1-2 (+Playoffs) — patchs 26.01→26.10 (2 records sans patch) |

Rafraîchir : `pnpm corpus -- --like "LCK/2026%" --out static/corpus/lck-2026.json`.
Scorecard : `pnpm backtest -- static/corpus/lck-2026.json --seed 42`.
Concordance gol.gg : `node --experimental-transform-types --no-warnings scripts/data/concordance.ts`
(réseau résidentiel uniquement — gol.gg bloque les IP datacenter).

Notes de qualité : chaque record 2026 porte le warning « first-selection era »
(l'ordre global est supposé blue-first tant que non recoupé — voir
`orderConfidence`) ; la résolution des noms de champions vers les clés Data
Dragon est à 100 % sur les quatre fichiers.
