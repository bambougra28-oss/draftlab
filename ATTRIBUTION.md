# Attribution

DraftLab is built on top of public, well-documented prior art. This file
records the origin of every non-trivial piece of methodology in the project.

## Elo rating math

The four conversion functions in `src/lib/engine/ratings.ts`
(`ratingToWinrate`, `winrateToRating`, `getMatchupWinrate`, `getDuoWinrate`)
implement the standard Elo curve published by Arpad Elo (1960, public domain).
The exact form used here mirrors the one in DraftGap's
`packages/core/src/rating/ratings.ts` because both projects need to produce
matching numbers from the shared dataset.

## Draft analysis algorithm

The structure of `src/lib/engine/analyzer.ts` — three additive passes (solo
champions, pairwise duos as deltas vs an expected rating, ally-vs-enemy
matchups also as deltas) — is reproduced from DraftGap's
`packages/core/src/draft/analysis.ts`. The approach itself is not novel; what
DraftGap contributes is the specific recipe that turns lolalytics-derived
stats into a single calibrated winrate. We rebuilt it independently in
TypeScript so DraftLab does not vendor any DraftGap source.

Reference: <https://github.com/vigovlugt/draftgap>

## Bayesian prior values

`PRIOR_GAMES_BY_RISK` in `src/lib/types/index.ts` uses the exact values from
DraftGap's `packages/core/src/risk/risk-level.ts` (very-low: 3000, low: 2000,
medium: 1000, high: 500, very-high: 250). These values trade off small-sample
noise against signal; we keep DraftGap's calibration in M1 and plan to
re-tune empirically in M2 once we have a pro-context dataset.

## Dataset

For M1, the runtime fetches
<https://bucket.draftgap.com/datasets/v5/30-days.json>. This is DraftGap's
public CDN feed, derived from lolalytics. It is not redistributed in this
repo.

In M2, DraftLab will run its own data pipeline (see BACKLOG.md) so we are no
longer dependent on the upstream bucket.

## Champion role encoding

The `Role` enum (Top=0, Jungle=1, Middle=2, Bottom=3, Support=4) matches the
encoding used in DraftGap and the upstream dataset. This is convention rather
than invention: we reuse it so the dataset's integer keys can be consumed
directly.

## What is **not** derived

The UI, the SvelteKit project layout, the comfort/cheese/unavailable tagging
scheme, and the broader DraftLab roadmap (pro context, scout layer, fatigue,
side preferences) are original to this project.
