# Backlog

Things that surfaced while building M1 but explicitly belong to a later
milestone. Do not pull these into M1 — the point of M1 is a working
DraftGap-equivalent base, not a feature-rich one.

## Surfaced during M2 / M3.1 (deferred to M3+)

- **Recent-drafts sidebar: load both sides at once.** Today, clicking a
  draft in the sidebar overwrites only one side (ally if from team A,
  enemy from team B). Loading the *full* draft would need to attribute
  the opposing 5 picks to the opponent's roster — only feasible after
  we cross-reference the two teams' team-draft pages or fetch the
  game-stats page. M3.
- ~~**`parseRecentDrafts` produces wrong roles in production.**~~
  **Fixed in M3.1.** Production parser now uses roster-pool attribution
  with dataset primary-role fallback (same algorithm formerly duplicated
  in the calibration runner). The calibration test now reads
  `team.recentDrafts[].picks` directly with no re-attribution.
- **Walk-forward calibration evaluation.** Temporal leak from M2 still
  uncorrected. The prerequisite (draft date parsing) **shipped in
  M3.1** — `RecentDraft.playedAt` is now populated from
  `parseTournamentMatchList`. Remaining work for M3.3: build the
  pool-as-of-date reconstruction so each draft's analysis uses only
  earlier games of that split.
- **Game-stats page parsing for accurate role attribution.** Even with
  the M3.1 attribution heuristic, ~31% of LFL Spring picks fall back
  to dataset primary-role (substitute games, off-meta picks). Fetching
  `https://gol.gg/game/stats/<id>/page-game/` per game would give
  ground-truth role-per-pick at the cost of +1 fetch per draft.
- **Larger calibration corpus (N ≥ 200).** LFL Spring 2026 alone
  yielded N=34 after attribution drops. Cross-split + cross-region
  expansion (LFL Summer, LCK splits) would let us actually trust grid
  results.
- **Calibrate `PRIOR_GAMES_BY_RISK` for pro context.** Currently
  inherited from DraftGap solo-queue calibration. Pro samples are
  smaller and coordinated; the right priors may differ.
- **Modeling substitute players.** LFL has multiple sub-games per
  split that the current "main roster + pool" model can't represent.
  A first cut would be to mark a draft's sub-affected role(s) as
  having no comfort signal (`comfortMode='unavailable'`) so the
  analyzer falls back to baseline rather than fabricating a player
  context.

## M2 candidates (pro-context layer)

- **Player champion pool integration**: feed `comfort` / `cheese` /
  `unavailable` tags into the analyzer (currently stored in localStorage but
  not used in M1 calculations). Likely a per-champion rating offset.
- **Scout layer**: per-opposing-player champion pool tags imported from
  Leaguepedia / GRID / hand-curation, with weight by recency.
- **Pro dataset**: replace the lolalytics-derived solo-queue feed with a
  pipeline keyed on tournament games (LEC/LCK/LCS/EU ERLs). M1 numbers are
  shaped by SoloQ behavior, which is a poor proxy for coordinated play.
- **Re-tune `PRIOR_GAMES_BY_RISK`**: the values are inherited from DraftGap
  and calibrated for SoloQ. Pro-context smoothing likely wants different
  priors because pro samples are 100–1000× smaller per matchup.

## Engine improvements

- **Champion icons in UI**: Data Dragon CDN (`ddragon.leagueoflegends.com`).
  Skipped in M1 because asset wiring is non-trivial vs. value.
- **Patch selector**: dataset is fixed to "30-days" in M1. M2 should let the
  user pick a patch range once we have multiple datasets.
- **Matchup table heat-mapping**: currently green/red bands at ±5 / ±15 Elo;
  could be a smooth gradient.
- **Suggestions / pick recommendations**: next-best champion given the
  current draft state. Explicitly out of scope for M1.
- **Bans**: not modeled in M1 (DraftGap includes a ban list). Add when bans
  matter analytically (i.e., when we have draft-history training data).

## Data pipeline (M2/M3)

- **Scrape lolalytics ourselves** instead of consuming bucket.draftgap.com,
  to remove a single point of failure and let us add fields they don't
  expose (e.g. champion select order).
- **Riot match-history ingestion** for pro games via Leaguepedia/GRID.
- **Damage profile** is in the dataset but unused; useful for compositional
  analysis (frontline/AP/AD balance).

## Testing

- **Visual snapshot of the matchup table** with @vitest/browser or Playwright
  — skipped in M1 because Vitest 2 + Cloudflare adapter is the priority.
- **Property test for the Elo round-trip on the full champion list** — a
  regression suite that runs nightly against the live dataset.
- **Cross-check vs DraftGap.com numbers**: the live sanity test asserts
  30%–70%, but the spec wants ±2pp vs DraftGap.com. Need a manual
  cross-check script that compares DraftLab's output for ~10 known drafts
  against DraftGap.com's UI (or against their core package run programmatically).

## Operational

- **Dataset cache hits localStorage quota** at ~50 MB. M2 should switch to
  IndexedDB or a Cloudflare Worker-side cache.
- **Deploy preview URLs for PRs**: Cloudflare Pages supports preview
  deployments per PR; not wired in `deploy.yml` yet.
