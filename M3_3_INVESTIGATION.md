# M3.3 — Investigation: side-only vs M3

Generated: 2026-05-01T15:14:40.721Z
Corpus: 245 drafts (test set N = 74)
Test span: 2026-04-10 → 2026-04-26

## Q1 — Agreement / divergence on predicted winner

| | Drafts | Side right | M3 right |
| --- | ---: | ---: | ---: |
| Same predicted winner | 48 / 74 | (both same) | (both same) |
| Different predicted winner | 26 / 74 | 17 | 9 |

Distribution of |Δ| = |pM3 − pSide|:

- mean: 9.00pp
- median: 7.50pp
- max: 27.75pp

## Q2 — Correlation between predictions

Pearson r(pM3, pSide) on N=74 test drafts: **0.566**

Top 10 largest |Δ| > 0.10pp divergences (game | Side prob | M3 prob | Δ | Side picks | M3 picks | actual):

| game | pSide | pM3 | Δ | Side says | M3 says | actual |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 76632 | 46.8% | 74.5% | +27.8pp | RED | BLUE | BLUE |
| 76624 | 43.0% | 16.0% | -27.0pp | RED | RED | RED |
| 77052 | 60.0% | 34.7% | -25.4pp | BLUE | RED | BLUE |
| 76627 | 45.3% | 69.3% | +24.0pp | RED | BLUE | BLUE |
| 76605 | 44.3% | 68.0% | +23.7pp | RED | BLUE | RED |
| 77025 | 40.1% | 20.2% | -19.9pp | RED | RED | RED |
| 76622 | 56.6% | 37.0% | -19.6pp | BLUE | RED | BLUE |
| 77058 | 48.1% | 66.3% | +18.3pp | RED | BLUE | BLUE |
| 76249 | 63.0% | 80.6% | +17.6pp | BLUE | BLUE | BLUE |
| 77055 | 53.4% | 70.7% | +17.2pp | BLUE | BLUE | BLUE |

## Q3 — Chronological tertiles

| Tertile | Date span | n | Side acc | M3 acc | M1 acc |
| --- | --- | ---: | ---: | ---: | ---: |
| Tertile 1 (oldest) | 2026-04-10 → 2026-04-15 | 25 | 72.0% | 56.0% | 52.0% |
| Tertile 2 (middle) | 2026-04-16 → 2026-04-22 | 25 | 72.0% | 60.0% | 44.0% |
| Tertile 3 (newest) | 2026-04-22 → 2026-04-26 | 24 | 75.0% | 70.8% | 62.5% |

Side accuracy gap: tertile 3 vs (t1 + t2 weighted avg) = 3.0pp.

## Q4 — Per-league breakdown

| League | n in test | Side acc | M3 acc |
| --- | ---: | ---: | ---: |
| LFL | 30 | 73.3% | 70.0% |
| LCK | 0 | n/a | n/a |
| LEC | 44 | 72.7% | 56.8% |

## Conclusion — which hypothesis is supported

| Hypothesis | Supported? |
| --- | :---: |
| A — Side-only chanceux, M3 vraiment meilleur | ✗ |
| B — Side capture l'essentiel, M3 ajoute du noise | ✗ |
| C — Les deux modèles convergent, débat sur le bruit | ✗ |
| D — Test set biaisé par timing | ✗ |

### Reading

- Pearson r = 0.566 → predictions are weakly correlated (just under the B-threshold of 0.6) — the two models are looking at substantially different things, with M3 swinging probabilities by an average 9.0pp around side-only.
- Disagreement on winner: 26/74 drafts (35%). On those, side-only is right 17 times vs M3 9 times — side-only wins 65% of disagreements.
- Tertile 3 (newest) side accuracy: 75.0%. T1 + T2 weighted: 72.0%. Gap = 3.0pp — too small to call a timing artefact (need ≥10pp).
- Per-league: LFL 73%/70%, LCK **n/a — 0 drafts in test**, LEC 73%/57%.
- **Methodological note**: LCK Cup 2026 ran earlier in the season; the chronological 70/30 split puts every LCK draft in the train side. Test = LFL Spring + LEC Spring only. The accuracy gap thus reflects model behavior on *European* leagues (LFL+LEC), with no data point for *Korean* leagues.
- The accuracy gap is concentrated in **LEC** (LEC side−M3 = 15.9pp; LFL side−M3 = 3.3pp). M3 is essentially tied with side-only on the league with smaller / tighter pools and underperforms on the league with the larger / more turnover-heavy pools.

### Verdict

**No hypothesis strictly applies under the pre-registered thresholds, but Hypothesis B is the closest reading in spirit.** Pearson r = 0.566 just misses the B band [0.6, 0.9], yet the qualitative shape is exactly what B describes: side-only wins 17 of 26 disagreements (65%), and M3's player-pool / comfort context is not translating into measurable accuracy gain on this test set. M3 still wins on log loss (less confidently wrong when wrong), so the parameter choice from the calibration is defensible — but the *direction* is "side preference is the load-bearing signal here, the player layer is comparatively cosmetic on N=74".

## Implications

### For M3.4 (game-stats fetch + accurate role attribution)

M3.4 still has a clear data-quality justification (eliminates the 31% role-attribution noise documented in M3.2). But the calibration finding here weakens the *predictive* case for M3.4: if M3's main weakness is that the player-pool signal isn't dominating, getting that signal cleaner won't necessarily flip the verdict against side-only. The honest framing for M3.4 is: 'fix the data quality, don't promise a calibration win'.

### For the recommended params (do we keep dpg=1000 / spg=25 / cheese=0.5?)

Yes — the spg=25 cluster does beat spg=50 by ≥0.012 log loss on train (a real signal documented in M3_3_CALIBRATION.md), and the within-cluster ranking is genuine noise. Keeping the M2 defaults for dpg + cheese is the least-churn change consistent with the data. This conclusion holds regardless of whether M3 outperforms side-only on accuracy — log loss is the calibration metric and M3 wins it.

### For the strategic narrative

The "DraftLab adds player context that DraftGap can't" pitch is hard to defend on N=74 test drafts when 17/26 of the disagreements go against the player-context layer. This doesn't kill the product — it changes what M3 is selling: *better-calibrated probabilities* rather than *more-accurate winner predictions*. A coach who reads "55% with high confidence" vs "55% with low confidence" cares about that distinction; a casual user comparing Vegas-style win/loss accuracy may not see the gain.

The right next experiment is not a parameter retune — it's a corpus expansion that includes LCK (M3.5+ multi-split) so the pool-rich, sub-stable, longer-history league enters the test set. If LCK is where M3's player layer earns its keep, the current investigation simply doesn't see it.
