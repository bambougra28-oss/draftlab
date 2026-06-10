# DraftLab — Step-ups (improvement backlog)

Opportunities spotted while reconstructing the project. The reconstruction is
**faithful by default**; nothing here is applied without Alain's go-ahead.
Many were already flagged by the project itself (`docs/unresolved.md`,
`BACKLOG.md`) — recovered here so they aren't lost again.

| # | Step-up | Origin | Risk | Status |
|---|---------|--------|------|--------|
| 1 | **`statsByTime` 5 → 7 buckets.** DraftGap now seeds 7 time buckets; M4.3 assumed 5 (25/30/35/40). Verify the live feed and, if 7, remap + expose a finer early window. | observed in DraftGap source | low (data-shape) | to verify |
| 2 | **Re-tune `PRIOR_GAMES_BY_RISK` for pro context.** Inherited from DraftGap SoloQ; pro samples are 100–1000× smaller and coordinated. | BACKLOG.md | medium (changes numbers) | proposed |
| 3 | **Dataset cache → IndexedDB.** 30-day feed (~50 MB) blows the localStorage quota; today writes fail silently. | BACKLOG.md | low | proposed |
| 4 | **Feed comfort/cheese/unavailable into the engine.** Tags are stored but unused in M1 winrate math (likely a per-champion rating offset). | BACKLOG.md | medium | proposed |
| 5 | **Re-enable the Split "self-escape" rule (M4.2).** Add a `selfEscape` flag so Ezreal/Vlad/Tristana-type champions score Split correctly. | unresolved.md | low | proposed |
| 6 | **`removeRankBias` on the live dataset.** DraftGap normalises global WR to 50% on load; confirm whether DraftLab must apply it for DraftGap.com parity. | DraftGap source | low (live-only) | to verify |
| 7 | **Review the 3 `confidence:low` tags** (Mel 800, Yunara 804, Zaahen 904) and promote 154 `confidence:medium` after human review. | unresolved.md / STATUS.md | none | human pass |
| 8 | **Game-stats page parsing (M2/M3)** for ground-truth role attribution (~31% LFL picks fall back to dataset primary role). | BACKLOG.md | medium | proposed |
| 9 | **Pool tier thresholds 20/10/3 → 14/5/1.** The reconstructed `poolTierClassifier` uses ≥20/≥10/≥3 effective games, but the surviving research dossier (§2.2, iTero "diminishing returns after 14 stage games") and the journal ("iTero thresholds") indicate the original used **14/5/1**. Realign or, better, recalibrate empirically in the V2 validation harness. Downstream: ban-priority weights consume the tier. | draftlab-frameworks-research.md §2.2 vs `src/lib/strategic/poolTierClassifier.ts` | medium (changes tiers) | proposed (2026-06-10) |
| 10 | **Enable LCK/LPL/LEC in `LEAGUES`.** The registry ships LFL-only (`enabled: false` elsewhere, "M2.5" marker), yet M3.5 already scraped LCK/LEC/LPL corpora. V2 makes multi-league first-class — enable once the rebuilt data layer passes per-league smoke tests. | `src/lib/pro/types.ts` | low | **applied in R1** (config-driven registry) |
| 11 | **Promote `firstSelection` into `SeriesGame`.** The /series UI persists First Selection (holder + side\|pick choice) as a structural extension field on `SeriesGame` — IndexedDB carries it, but the type doesn't declare it. Promote the field into `src/lib/storage/series.ts` with a test. | wave A routes report | low | proposed (2026-06-10) |
| 12 | **Move the gol.gg league→region mapping into `LEAGUE_REGISTRY`.** The `/` route hardcodes `REGION_BY_LEAGUE` (lfl→FR, lck→KR, lpl→CN, lec→EUW, lcs→NA, cblol→BR — codes verified against the teams-list fixture); the registry should own it (DA-V2-6). | wave A routes report | low | proposed (2026-06-10) |
| 13 | **Revise `low-mobility-vs-pick` — empirically INVERTED.** On the 774-draft 2026 corpus, flagged teams WIN +10.1 pp [1.6 ; 18.5] (n=130): facing a tag-classified Pick comp with a low-mobility comp is favorable in 2026 (pick comps live on mistakes pros don't make). Contextualize or invert; full study in `docs/research/2026-06_draft_science_corpus.md` §F. | draft science 2026-06 | medium (changes a marker) | proposed (2026-06-10) |
| 14 | **Malphite (54) tagged `damageType: AD` — almost certainly wrong** (his damage is overwhelmingly magic). Flag for the confidence:medium review pass; flipping it shifts winConditionGraph test fixtures — review with the suite open. | tagPairs test session | low (one tag) | proposed (2026-06-10) |
| 15 | **Win-condition scaling axis: replace the tag signal with time data.** r = 0.006 between tag-late counts and real 2026 game length (and the "later" side wins SHORT games 56.7 %) — `scalingWindow` does not track pro tempo, which is the root cause of the G1 chance result. Axis 5 should consume statsByTime / corpus duration profiles as primary, tag as fallback. | draft science 2026-06 §G | medium (axis rework) | proposed (2026-06-10) |

## Robustness tweaks already applied (no behaviour change)

- `getStats` / `analyzeChampion` guard missing champions with empty tallies
  instead of throwing (DraftGap assumed the champion always exists on the
  current patch). Rating math is unchanged.
- Duo/matchup cosmetic `wins` fields are guarded against `0/0` → `NaN`
  (the rating deltas that feed `totalRating` are identical to DraftGap).
- `vitest.config.ts` resolves the `$lib` alias so unit tests run without the
  SvelteKit plugin (test-only; no app impact).
