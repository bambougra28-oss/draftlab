# M1 Validation — Cross-check report

DraftLab's analyzer was cross-checked against an independent Python
reimplementation of DraftGap's algorithm. 10 reference drafts from
`crosscheck.test.ts`, all evaluated at `riskLevel: medium` (priorGames =
1000).

- Patch dataset: `bucket.draftgap.com/datasets/v5/current-patch.json`
  (version `16.9.1`, date `2026-04-30T13:48:03.983Z`)
- Full dataset: `bucket.draftgap.com/datasets/v5/30-days.json`
  (date `2026-04-30T13:48:21.365Z`)

## Results

| #  | Draft                                                                       | Expected | Actual  | Delta   | Status |
| -- | --------------------------------------------------------------------------- | -------- | ------- | ------- | ------ |
| 1  | K'Sante/Kindred/Ahri/Kalista/Bard vs Rumble/Wukong/Galio/Lucian/Bard        | 59.29%   | 59.29%  | 0.00pp  | PASS   |
| 2  | Mirror Aatrox/Lee Sin/Azir/Jinx/Lulu (sanity)                               | 50.00%   | 50.00%  | 0.00pp  | PASS   |
| 3  | Nasus/Yi/Kassadin/Vayne/Soraka vs Renekton/Lee Sin/Pantheon/Draven/Leona    | 45.78%   | 45.78%  | 0.00pp  | PASS   |
| 4  | Malphite/J4/Galio/Kai’Sa/Leona vs Jayce/Nidalee/Zoe/Ezreal/Janna            | 47.12%   | 47.12%  | 0.00pp  | PASS   |
| 5  | Camille/Rengar/Ahri/Caitlyn/Bard vs Ornn/Sejuani/Orianna/Sivir/Braum        | 59.89%   | 59.89%  | 0.00pp  | PASS   |
| 6  | Aatrox/Vi/Yasuo/Jinx/Nautilus vs Gnar/Graves/Syndra/Kai’Sa/Thresh           | 46.89%   | 46.89%  | 0.00pp  | PASS   |
| 7  | Jayce/Nidalee/Xerath/Varus/Lux vs Camille/Hecarim/Akali/Kai’Sa/Rakan        | 35.21%   | 35.21%  | 0.00pp  | PASS   |
| 8  | Ornn/Sejuani/Galio/Sivir/Braum vs Fiora/Kha’Zix/Zed/Samira/Pyke             | 52.40%   | 52.40%  | 0.00pp  | PASS   |
| 9  | Gragas/Elise/Syndra/Ezreal/Lux vs Renekton/Lee Sin/Talon/Lucian/Pyke        | 44.95%   | 44.95%  | 0.00pp  | PASS   |
| 10 | Aatrox/Lee Sin/Yasuo/Kai’Sa/Lulu vs Singed/Ivern/Heimerdinger/Twitch/Bard   | 31.50%   | 31.50%  | 0.00pp  | PASS   |

## Summary

- **Overall: PASS** — 10 PASS, 0 WARN, 0 FAIL, max delta 0.00pp.
- Bands: `PASS` < 0.5pp, `WARN` < 2.0pp, `FAIL` ≥ 2.0pp.

## Investigation — bug found and fixed

The cross-check did **not** pass on the first run. The initial result was
**5 PASS / 0 WARN / 5 FAIL** with deltas up to **5.82pp**, which is well
beyond the 2.0pp FAIL threshold. The pattern:

| #  | Expected | Initial actual | Delta    | After fix |
| -- | -------- | -------------- | -------- | --------- |
| 1  | 59.29%   | 57.60%         | 1.69pp   | 0.00pp    |
| 2  | 50.00%   | 50.00%         | 0.00pp   | 0.00pp    |
| 3  | 45.78%   | 46.71%         | 0.93pp   | 0.00pp    |
| 4  | 47.12%   | 51.32%         | **4.20pp** | 0.00pp    |
| 5  | 59.89%   | 58.67%         | 1.22pp   | 0.00pp    |
| 6  | 46.89%   | 47.09%         | 0.20pp   | 0.00pp    |
| 7  | 35.21%   | 32.43%         | **2.78pp** | 0.00pp    |
| 8  | 52.40%   | 57.39%         | **4.99pp** | 0.00pp    |
| 9  | 44.95%   | 50.77%         | **5.82pp** | 0.00pp    |
| 10 | 31.50%   | 36.05%         | **4.55pp** | 0.00pp    |

The mirror draft (#2) was exact and the smaller, meta-comp drafts were
within 0.5–2.0pp; the big divergences clustered on drafts containing
**off-meta picks** (Heimerdinger mid, Twitch ADC, Singed top in #10; Talon
mid in #9; Samira ADC in #8). That pointed at small-sample champion stats,
which led to the actual cause.

### Root cause: M1 used one dataset; DraftGap uses two

Reading `apps/frontend/src/contexts/DatasetContext.tsx` in the DraftGap
source revealed that DraftGap fetches **two** datasets in parallel:

1. **`current-patch.json`** (~350 kB) — solo champion stats on the active
   patch only. Sparse. Matchup and synergy maps are stripped (empty `{}`
   on every champion-role).
2. **`30-days.json`** (~50 MB) — a broader 30-day sample. This is the only
   source of pair-level data (matchups & synergies).

DraftGap's `analyzeDraft(dataset, fullDataset, ...)` then uses each
dataset for a specific job:

- **Solo champion sample**: `dataset` (current-patch). The "what is this
  champion doing right now" signal.
- **Champion prior target**: `fullDataset` (30-days). The "what is this
  champion's longer-term baseline" signal — used as the Bayesian prior to
  pull the patch sample toward when patch data is thin.
- **Duos and matchups**: `fullDataset` only. (current-patch has none.)

The original M1 spec described `analyzeDraft(team, enemy, dataset, config)`
— a single-dataset signature. My initial implementation faithfully matched
that. The cross-check exposed that the simplification has a measurable
cost: the prior target winrate becomes the same as the sample winrate
(self-prior), so smoothing degenerates and on-patch wobble is not damped
toward longer-term reality. For meta picks this is harmless because the
patch sample has thousands of games; for off-meta picks the patch sample
is small and noisy, and self-priors keep that noise instead of correcting
it.

### Fix applied

`src/lib/engine/analyzer.ts` was upgraded to DraftGap's two-dataset
signature with backward compatibility:

```ts
analyzeDraft(
    dataset: Dataset,         // current-patch sample
    team: Team,
    enemy: Team,
    config: AnalyzeDraftConfig,
    fullDataset: Dataset = dataset  // 30-day prior + pair data; defaults to `dataset`
): DraftResult
```

When `fullDataset` is omitted, the analyzer behaves exactly as the
single-dataset version did, so the unit fixtures in `analyzer.test.ts`
continue to pass without modification.

`src/lib/dataset/fetch.ts` was extended:

- `FULL_DATASET_URL` (was `DEFAULT_DATASET_URL`) for `30-days.json`.
- `PATCH_DATASET_URL` for `current-patch.json`.
- `fetchDatasetPair()` returns both in parallel.

`src/routes/+page.svelte` (the UI) now calls `fetchDatasetPair()` and
passes both datasets to `analyzeDraft`, so the live winrate matches
DraftGap.com numerically.

`tests/sanity-live.test.ts` was updated to use both datasets so its
assertion stays consistent with the cross-check.

## Verification

```
pnpm test          # 43/43 pass (10 cross-check, 33 unit/integration)
pnpm typecheck     # 0 errors on 305 files
pnpm lint          # clean
pnpm build         # adapter-cloudflare build green
```

The cross-check has been kept as `tests/crosscheck.test.ts` and runs in
every test invocation when both local sample files are present
(`C:/Users/alain/draftlab-dataset-sample.json` and
`C:/Users/alain/draftlab-current-patch-sample.json`). It auto-skips in
CI, where the 50 MB dataset is not available.
