# M3.3 — Subs Handling + Walk-Forward Calibration

Generated: 2026-05-06T21:46:45.757Z
Corpus fetched: 2026-05-01T14:57:28.634Z

## Corpus

- Total drafts: **N = 245**
- LFL: 40
- LCK: 125
- LEC: 80
- Date range (chronological): 2026-01-14T00:00:00.000Z → 2026-04-26T00:00:00.000Z
- Train (70%): 171 drafts (2026-01-14T00:00:00.000Z → 2026-04-09T00:00:00.000Z)
- Test  (30%): 74 drafts (2026-04-10T00:00:00.000Z → 2026-04-26T00:00:00.000Z)

## Phase 1 — Subs handling impact

Comparison: predicted blue-side winrate WITHOUT the M3.3 sub guard vs. WITH it, on every corpus draft (M3 full mode).

| Metric | Value |
| --- | ---: |
| Drafts shifted ≥ 1pp | 0 / 245 (0.0%) |
| Drafts shifted ≥ 5pp | 0 / 245 (0.0%) |
| Mean abs shift | 0.00pp |
| Max abs shift | 0.02pp |

Interpretation: a meaningful number of ≥5pp shifts means the pre-fix M3 was using stale pool data from sub games; a small number means the implicit "no pool entry → unavailable" path of M3.1/M3.2 was already covering the case in most games (sub picks were truly off-meta and not present in any roster pool).

## Phase 2 — Baselines on TEST set

(All M3 paths use the M3.3 sub guard.)

| Strategy | Log loss | Accuracy |
| --- | ---: | ---: |
| 50/50 constant | 0.6931 | 54.1% |
| Side-only | 0.6073 | 73.0% |
| M1 strict (no playerContext / no sideContext) | 0.7118 | 52.7% |

## Phase 3 — Grid search (3×3×3) on TRAIN log loss

| Rank | dpg | spg | cheese | Train LL | Train Acc |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 500 | 25 | 0.7 | 0.6572 | 60.8% |
| 2 | 500 | 25 | 0.5 | 0.6574 | 60.8% |
| 3 | 500 | 25 | 0.3 | 0.6576 | 60.8% |
| 4 | 1000 | 25 | 0.7 | 0.6576 | 60.8% |
| 5 | 1000 | 25 | 0.5 | 0.6577 | 60.8% **← chosen** |
| 6 | 1000 | 25 | 0.3 | 0.6579 | 60.8% |
| 7 | 2000 | 25 | 0.7 | 0.6579 | 60.8% |
| 8 | 2000 | 25 | 0.5 | 0.6579 | 60.8% |
| 9 | 2000 | 25 | 0.3 | 0.6580 | 60.8% |
| 10 | 500 | 50 | 0.7 | 0.6744 | 60.8% |
| 11 | 500 | 50 | 0.5 | 0.6746 | 60.8% |
| 12 | 500 | 50 | 0.3 | 0.6749 | 60.8% |
| 13 | 1000 | 50 | 0.7 | 0.6749 | 60.8% |
| 14 | 1000 | 50 | 0.5 | 0.6750 | 60.8% |
| 15 | 1000 | 50 | 0.3 | 0.6751 | 60.8% |
| 16 | 2000 | 50 | 0.7 | 0.6751 | 60.8% |
| 17 | 2000 | 50 | 0.5 | 0.6752 | 60.8% |
| 18 | 2000 | 50 | 0.3 | 0.6752 | 60.8% |
| 19 | 500 | 100 | 0.7 | 0.6871 | 57.9% |
| 20 | 500 | 100 | 0.5 | 0.6874 | 57.9% |
| 21 | 500 | 100 | 0.3 | 0.6876 | 57.9% |
| 22 | 1000 | 100 | 0.7 | 0.6876 | 57.9% |
| 23 | 1000 | 100 | 0.5 | 0.6877 | 57.9% |
| 24 | 1000 | 100 | 0.3 | 0.6879 | 57.9% |
| 25 | 2000 | 100 | 0.7 | 0.6879 | 57.9% |
| 26 | 2000 | 100 | 0.5 | 0.6879 | 57.9% |
| 27 | 2000 | 100 | 0.3 | 0.6880 | 57.9% |

Top-5 log-loss spread: **0.0006** (within-cluster, dominantly noise).

Cluster means (averaged across dpg × cheese):
- sidePriorGames=25: log loss 0.6577 ← best cluster
- sidePriorGames=50: log loss 0.6749
- sidePriorGames=100: log loss 0.6877

Cluster gap (best vs 2nd-best spg): **0.0172** (≥0.01 = real signal, < 0.005 = noise).
Selection rule: best cluster is spg=25; within it dpg/cheese are noise, picked the M2-closest variant (rank 5 overall).

## Phase 4 — Walk-forward eval on TEST

Chosen params: `dpg=1000|spg=25|cheese=0.5` (train log loss 0.6577).

| Metric | Value |
| --- | ---: |
| Test log loss | 0.6270 |
| Test accuracy | 62.2% |
| Wilson 95% CI on accuracy | [50.8%, 72.4%] |
| Train→test gap | -0.0307 (positive = test worse than train, expected) |

### Calibration (10-bin, predicted vs actual)

| Bin | n | Mean predicted | Actual rate | Gap |
| --- | ---: | ---: | ---: | ---: |
| 0–10% | 0 | – | – | – |
| 10–20% | 2 | 17.7% | 0.0% | -17.7pp |
| 20–30% | 1 | 20.2% | 0.0% | -20.2pp |
| 30–40% | 5 | 33.0% | 40.0% | +7.0pp |
| 40–50% | 20 | 45.6% | 45.0% | -0.6pp |
| 50–60% | 17 | 55.6% | 52.9% | -2.6pp |
| 60–70% | 20 | 64.8% | 65.0% | +0.2pp |
| 70–80% | 8 | 74.6% | 75.0% | +0.4pp |
| 80–90% | 1 | 80.6% | 100.0% | +19.4pp |
| 90–100% | 0 | – | – | – |

Reading: a perfectly calibrated model has gap ≈ 0 in every bin. Negative gap in high-confidence bins = overconfident; positive in low = underconfident.

## Phase 5 — Verdict

- vs **50/50**: 0.6270 vs 0.6931 → ✓ beats baseline
- vs **side-only**: 0.6270 vs 0.6073 → ✗ does NOT beat baseline
- vs **M1 strict**: 0.6270 vs 0.7118 → ✓ beats baseline

**M3 does NOT clear all baselines on test.** Per the calibration protocol, recommended defaults stay at M2 / DraftGap-calibrated values: `defaultPriorGames=1000`, `sidePriorGames=50`, `cheeseAttenuationFactor=0.5`. The blend isn't producing a robust gain at this corpus size; a larger N (M3.5+ with more splits / regions) is the path forward.

## Limitations

- **Pool data leakage**: the player pools used to build playerContext are the *current* pools at scrape time, not pools as-of each draft's playedAt. Walk-forward cleanly separates the *prediction* but the *features* still see the future. Real walk-forward needs per-patch pool snapshots (BACKLOG → M3.5+).
- **N = 245** (test = 74). With 27 grid combos against ~171 train samples, "best by chance" is non-trivial. The top-5 stability check + M2-default tiebreak mitigates that, but a multi-region corpus would put more bones in the analysis.
- **Dataset is patch-frozen** at the snapshot we fetched (DraftGap "30-days"). Drafts played 6 weeks before the snapshot use champion stats from a future patch. M3.4 game-stats fetching could give patch-aware role attribution; patch-aware datasets are a separate item.
- **3 leagues mixed without regional weighting.** If LCK calibrates differently from LFL/LEC, we wouldn't see it here. Worth a per-league breakdown when N permits.
- **Meta drift between train and test.** ~6 weeks of training, ~2.5 weeks of test (rough proportion of LFL Spring split). A patch-shifting meta during the test window could artificially worsen test performance.

