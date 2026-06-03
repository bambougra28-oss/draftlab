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

## Robustness tweaks already applied (no behaviour change)

- `getStats` / `analyzeChampion` guard missing champions with empty tallies
  instead of throwing (DraftGap assumed the champion always exists on the
  current patch). Rating math is unchanged.
- Duo/matchup cosmetic `wins` fields are guarded against `0/0` → `NaN`
  (the rating deltas that feed `totalRating` are identical to DraftGap).
- `vitest.config.ts` resolves the `$lib` alias so unit tests run without the
  SvelteKit plugin (test-only; no app impact).
