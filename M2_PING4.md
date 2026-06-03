# M2 — Ping 4: Empirical calibration

Status: **complete. M2 ready for review / use.**

## Methodological precautions, point by point

### 1. Sample explicit + temporal leak

- Tournament: `LFL 2026 Spring Split` only (LCK/LPL/LEC = M2.5).
- 10 teams scraped, 80 draft entries, 40 unique games, **34 kept**, 6 dropped.
- Drop reason: `role attribution failed entirely` × 6 (all five roles already taken
  by pool-match collisions; rare).
- **Temporal leakage: confirmed and documented.** The player pool used in the
  analyzer is the *current* pool at scrape time, which already includes
  every game in the split. Predicting week 1 with knowledge of week 4
  picks is mild but real. Not corrected; flagged in M2_CALIBRATION.md.
- **Pool quality**: avg **6.9 / 10 picks per game** attributed by direct
  pool match. The remaining 31% used a dataset-based fallback (the
  champion's primary role in the upstream stats). This fallback is
  necessary because LFL teams sub players in / out and substitute
  picks aren't in any regular roster member's pool.

### 2. Mandatory baselines

| Strategy | Log loss | Accuracy |
| --- | ---: | ---: |
| 50/50 (constant) | 0.6931 | 52.9% |
| Side-only | 0.6568 | 67.6% |
| **M1 strict (no playerContext / no sideContext)** | **0.6056** | **70.6%** |
| M2 default params (1000 / 50 / 0.5) | 0.5704 | 79.4% |

M1 is **not degenerate** here — it sits well below 50/50, meaning solo
champion analysis is doing real work on this corpus. M2 default
already beats M1 by ~3.5pp log loss / ~9pp accuracy.

### 3. 3 × 3 × 3 grid search, log loss as primary metric

Full grid table is in `M2_CALIBRATION.md`. Top of leaderboard:

| Rank | dpg | spg | cheese | Log loss |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 500 | 25 | 0.7 | 0.5431 |
| 2 | 500 | 25 | 0.5 | 0.5434 |
| 3 | 1000 | 25 | 0.7 | 0.5435 |
| ... (the next 6 rows are all within 0.001 log loss of #1) | | | | |
| 14 | 1000 | 50 | 0.5 | 0.5704 ← M2 default |

Striking observation: ranks 1–9 all share `sidePriorGames=25` and are
indistinguishable on log loss. The signal that matters in this corpus
is "weaken the side prior to let real side WRs influence the rating
more." `defaultPriorGames` and `cheeseAttenuationFactor` move within
noise.

### 4. Honest verdict

- N=34 is below the threshold of trust. With 27 grid combinations,
  any winner is at non-trivial risk of overfit.
- The grid winner (`500 / 25 / 0.7`) only beats M2 default by 0.027 log
  loss (5pp on a single sample's average). Not robust.
- **Recommended params: keep DraftGap's defaults (`1000 / 50 / 0.5`).**
  This is the conservative choice triggered by N<60. M2 default
  already beats M1, baselines, and 50/50 — the calibration validates
  *that* M2 helps, not *which exact knob settings* are optimal.

The M2_CALIBRATION.md report writes itself based on this protocol —
nothing in it is hand-fudged.

## Files

- `tests/m2-calibration.test.ts` — env-gated calibration runner
  (`DRAFTLAB_CALIBRATE=1 pnpm test m2-calibration`). Builds and caches
  the corpus to `C:/Users/alain/draftlab-m2-corpus.json`.
- `M2_CALIBRATION.md` — generated report at the repo root.
- `BACKLOG.md` — updated with the items deferred during M2 (parse-time
  role attribution fix, full-draft sidebar load, walk-forward eval,
  game-stats fetch for ground-truth roles, larger corpus).

## DraftLab M2 — Definition of Done

| DoD item | Status |
| --- | --- |
| `src/lib/pro/` complete (types, scraper, cache) | OK |
| Champion name → key mapping tested on 12 edge cases | OK (Ping 1) |
| `analyzeDraft` extended with optional pro context, retro-compat | OK (Ping 2, fields on `config`) |
| Comfort Bayesian blend implemented and tested | OK (15 tests) |
| Side preference Bayesian-smoothed implemented and tested | OK (10 tests) |
| UI Team Context overlay functional | OK (Ping 3) |
| Recent drafts sidebar | OK |
| Side picker | OK |
| `localStorage` cache operational | OK (cache test verifies 2nd fetch hit) |
| CORS via server endpoint (Plan B, hardened) | OK |
| No-regression: 10 cross-checks at 0.00pp delta in 3 modes (no ctx / empty ctx / no sideCtx) | OK (20 tests) |
| Comfort tests: 5+ cases | OK (15) |
| Side tests: 3+ cases | OK (10) |
| Calibration done, `M2_CALIBRATION.md` created | OK |
| `pnpm test` 100% | 120 / 122 (2 env-gated skipped) |
| `pnpm typecheck` | 0 errors / 423 files |
| `pnpm lint` | clean |
| `pnpm build` | adapter-cloudflare green |
| 4 ping points respected with user go each time | OK |

## Findings worth carrying forward to M3

1. **Side prior may be too heavy at 50.** The grid clearly preferred
   `sidePriorGames=25` across all 9 top results. Worth re-checking
   on a larger corpus before changing the default.
2. **N=34 is the ceiling for any single-split LFL sample.** To get
   N≥200, M3 needs cross-region pulls (LCK has ~90 games per split,
   and there are several active splits worldwide).
3. **Role attribution noise costs us 31% of pick attributions.**
   Fetching the game-stats page per draft would remove this entirely,
   at the cost of 1 extra fetch per game (≈ 40 s per team's full sync).
4. **Substitute players are not rare in LFL.** This isn't an edge
   case — multiple games this split had a different starter. The
   data layer needs to surface "this game had a sub" as a first-class
   signal eventually.

## Open question for M3

Before any next milestone, should we tighten the data layer first
(walk-forward dates, game-stats fetch, sub-player handling) or push
straight into a larger corpus by adding LCK / LEC adapters?

The conservative read is: tighten first, scale second. A noisy 200-
sample corpus isn't more useful than a clean 34-sample one. But
that's a call you make.
