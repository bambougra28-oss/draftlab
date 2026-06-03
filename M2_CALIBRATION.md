# M2 — Empirical Calibration (LFL 2026 Spring Split)

Generated: 2026-05-06T21:46:44.492Z
Corpus fetched: 2026-05-01T13:24:55.939Z
Sample size: **N = 34 games**

## Methodological caveats (read first)

- **N = 34.** Not statistically significant. With 27 grid combinations against ~34 samples, any "winner" of the grid is at non-trivial risk of overfit. Treat the recommended params as a default, not a discovery.
- **Temporal leakage (light).** The player pool used for each draft is the *current* pool at scrape time, not the pool as it stood at the moment of the draft. A champion picked in week 1 contributes 1 game to the player's pool that the analyzer then "knows about" when predicting week 1. Effect: the analyzer is mildly more confident than it would be if the data were strictly causal. Not corrected here — flagged for transparency.
- **Dropped games.** Role attribution for each pick uses the player whose tournament-wide pool contains that champion. Games where attribution is ambiguous (substitute player, fresh pick not yet in any pool) are dropped. See dropped-games count below.
- **All baselines must be beaten.** If the best grid point does not beat the M1 baseline (or even 50/50), recommended params fall back to *least-harmful*: highest priors and lowest cheese trust, so the M2 blend has minimal influence over the M1 numbers.

## Corpus build

- Tournament: `LFL 2026 Spring Split`
- Teams scraped: 10
- Games kept: 34
- Games dropped: 6
- Average picks attributed by pool match: **6.9 / 10** per game (69% pool, 31% dataset-fallback for substitutes / off-meta picks)

| Drop reason | Count |
| --- | ---: |
| role attribution failed entirely | 6 |

## Baselines (mandatory bar M2 must clear)

| Strategy | Log loss | Accuracy |
| --- | ---: | ---: |
| 50/50 (constant 0.5) | 0.6931 | 52.9% |
| Side preference only (no champion analysis) | 0.6287 | 67.6% |
| M1 strict (no playerContext, no sideContext) | 0.6056 | 70.6% |
| M2 default params (1000 / 50 / 0.5) | 0.5437 | 79.4% |

Lower log loss is better. log(2) ≈ 0.693 is the 50/50 reference.

## Grid search (3 × 3 × 3 = 27 combos)

Sorted by log loss ascending. Recommended row marked.

| Rank | defaultPriorGames | sidePriorGames | cheeseAtt | Log loss | Accuracy |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 500 | 25 | 0.7 | 0.5431 (best) | 79.4% **← recommended** |
| 2 | 500 | 25 | 0.5 | 0.5434 | 79.4% |
| 3 | 1000 | 25 | 0.7 | 0.5435 | 79.4% |
| 4 | 500 | 25 | 0.3 | 0.5436 | 79.4% |
| 5 | 1000 | 25 | 0.5 | 0.5437 | 79.4% |
| 6 | 2000 | 25 | 0.7 | 0.5437 | 79.4% |
| 7 | 1000 | 25 | 0.3 | 0.5438 | 79.4% |
| 8 | 2000 | 25 | 0.5 | 0.5438 | 79.4% |
| 9 | 2000 | 25 | 0.3 | 0.5439 | 79.4% |
| 10 | 500 | 50 | 0.7 | 0.5699 | 79.4% |
| 11 | 500 | 50 | 0.5 | 0.5701 | 79.4% |
| 12 | 1000 | 50 | 0.7 | 0.5703 | 79.4% |
| 13 | 500 | 50 | 0.3 | 0.5704 | 79.4% |
| 14 | 1000 | 50 | 0.5 | 0.5704 | 79.4% |
| 15 | 2000 | 50 | 0.7 | 0.5705 | 79.4% |
| 16 | 1000 | 50 | 0.3 | 0.5706 | 79.4% |
| 17 | 2000 | 50 | 0.5 | 0.5706 | 79.4% |
| 18 | 2000 | 50 | 0.3 | 0.5707 | 79.4% |
| 19 | 500 | 100 | 0.7 | 0.5861 | 76.5% |
| 20 | 500 | 100 | 0.5 | 0.5863 | 76.5% |
| 21 | 1000 | 100 | 0.7 | 0.5865 | 76.5% |
| 22 | 500 | 100 | 0.3 | 0.5866 | 76.5% |
| 23 | 1000 | 100 | 0.5 | 0.5866 | 76.5% |
| 24 | 2000 | 100 | 0.7 | 0.5867 | 76.5% |
| 25 | 1000 | 100 | 0.3 | 0.5868 | 76.5% |
| 26 | 2000 | 100 | 0.5 | 0.5868 | 76.5% |
| 27 | 2000 | 100 | 0.3 | 0.5869 | 76.5% |

## Verdict

- M2 best-grid log loss vs **50/50**: 0.5431 vs 0.6931 → beats baseline
- M2 best-grid log loss vs **side-only**: 0.5431 vs 0.6287 → beats baseline
- M2 best-grid log loss vs **M1 strict**: 0.5431 vs 0.6056 → beats baseline

**M2 with grid-best params nominally clears all three baselines (best log loss `0.5431` at `dpg=500|spg=25|cheese=0.7`)** — but the corpus is too small (N=34) and/or the M1 baseline is degenerate (forced role attribution noise), so the win is not robust. **Recommended params remain the M1 defaults (`defaultPriorGames=1000`, `sidePriorGames=50`, `cheeseAttenuationFactor=0.5`)**, the values DraftGap calibrated for solo queue. Out-of-sample testing on a larger corpus is needed before adopting the grid winner.

## What would actually validate M2

- N ≥ 200 drafts (cross-split / multi-region) before any of these grid points should be trusted.
- Walk-forward evaluation (training pool from games before draft date) to remove the temporal leak.
- Out-of-sample test set (e.g., LFL Summer or LCK split held out) before promoting any tuning.

