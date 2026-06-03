# DraftLab — Recovery Handoff

_Last updated: 2026-06-03._

## What happened

`src/` and `tests/` were lost in a forced Windows reinstall — only configs,
docs and recovered data survived, and there was **no external backup**. The
code below was **reconstructed from the surviving specs** (README, the `M*`
milestone docs, `ATTRIBUTION.md`) plus the recovered `data/championTags.json`,
then re-verified. A git repo was re-initialised — **commit every milestone** so
this can't happen again.

## Current state — reconstructed & verified

`pnpm test` → **210 passed / 1 skipped (20 files)** · `pnpm typecheck` → **0
errors** · `pnpm lint` → clean.

| Layer | Modules | Status |
|---|---|---|
| M1 engine | `src/lib/engine/{ratings,bayesian,getStats,analyzer}.ts`, `src/lib/dataset/` | ✅ |
| M2 engine | `src/lib/pro/{championLookup,contextBuilder,comfortDefaults,types}.ts` + comfort/side blend in analyzer | ✅ |
| M4 | `src/lib/tags/`, `src/lib/strategic/{gamePlanClassifier,powerCurveCalculator,riskMarkerDetector}.ts` | ✅ |
| M5 | `src/lib/strategic/{inferRoles,adversaryPlanDetector,poolTierClassifier,pocketPickRiskAssessor,pickSuggester}.ts` | ✅ |
| M6 | `src/lib/strategic/banPrioritySuggester.ts`, `src/lib/storage/{idb,draftPlans}.ts` | ✅ |
| M7 | `src/lib/storage/series.ts` | ✅ |

The M1 engine reproduces DraftGap's public methodology (`ATTRIBUTION.md`); the
M2 comfort/side blend reproduces the **exact** closed-form numbers from
`M2_PING2.md`. M5–M7 internal heuristics are behaviour-faithful reconstructions
(their detailed specs did not survive) — see `docs/STEP_UP.md`.

## How to build & run

No Node/pnpm is on PATH on this machine. Two options:

1. **Install properly** (recommended for daily use):
   ```
   winget install OpenJS.NodeJS.LTS
   corepack enable pnpm
   ```
2. **Portable Node already set up** at
   `C:\Users\alain\.node-portable\node-v24.16.0-win-x64` — prepend that folder
   to `PATH` for a shell session.

Then, from the repo root:
```
pnpm install        # native builds approved via pnpm-workspace.yaml
pnpm exec svelte-kit sync   # generates .svelte-kit/ (tsconfig extends it)
pnpm test           # 210 passed / 1 skipped
pnpm typecheck      # 0 errors
pnpm lint           # clean
pnpm coverage:tags  # champion tag coverage (fetches Data Dragon for the universe)
```
`pnpm dev` / `pnpm build` become meaningful once the UI is rebuilt (below).

## Remaining work (resume here)

1. **M2 data layer** — `src/lib/pro/golgg.ts` (parsers `parseRoster`,
   `parseSideStats`, `parsePlayerPool`, `parseTeamList`, `parseRecentDrafts`,
   fetchers + 24 h cache) and `src/routes/api/golgg/+server.ts` (hardened
   same-origin proxy). ⚠️ **Lowest-fidelity piece**: the parsers depend on
   gol.gg's HTML and the original fixtures are gone — rebuild best-effort and
   validate against a live pull. `M2_PING1.md` lists the parse targets;
   `M2_PING1_ZYB.json` is a sample of the expected output shape.
2. **M3 calibration** — walk-forward over the recovered corpora
   (`M3_2_CORPUS.json`, …); see `M3_*.md` + `M2_CALIBRATION.md`.
3. **UI (Svelte 5)** — routes `/`, `/prototype`, `/plans(+[id])`,
   `/series(+[id])`, `/live`, `/help` + components (AppNav, ChampionPicker,
   ManualDraftPicker, PowerCurveVisualizer, PoolTierPanel,
   AdversaryPlanEvolution, ConsumptionTrackerPanel, …). The engine surface they
   plug into is stable and tested.
4. **Final build** — `pnpm build` (adapter-cloudflare).

## Conventions

- Faithful reconstruction by default; behaviour changes go through
  `docs/STEP_UP.md` for sign-off.
- The 1 skipped test (and the not-yet-rebuilt cross-check / sanity-live tests)
  are live-data tests needing the ~50 MB DraftGap dataset — they auto-skip
  without it, exactly as in the original.
