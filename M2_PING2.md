# M2 — Ping 2: algorithms wired into the engine

Status: **ready for review**.

## Signature decision

`playerContext`, `sideContext`, `proParams` are **fields on `AnalyzeDraftConfig`**,
not extra positional args. This avoids inserting anything between `enemy`
and `config` (your point #4) and keeps every M1 call site working
verbatim — they just don't set the new fields.

```ts
interface AnalyzeDraftConfig {
    riskLevel: RiskLevel;
    ignoreChampionWinrates: boolean;
    playerContext?: PlayerContext;
    sideContext?: SideContext;
    proParams?: ProAnalysisParams;
}
```

## Comfort Bayesian blend (spec §4.3)

`blendedPriorWinrate(baseline, ctx, params)` exported from
`src/lib/engine/analyzer.ts`. Plugged into `analyzeChampions` as the
prior-target winrate for each role. Closed-form numbers from the spec
all reproduced exactly:

| Case (baseline 0.51) | Spec target | DraftLab |
| --- | --- | --- |
| comfort 1g 100% WR | ≈ 0.5105 | 511 / 1001 = **0.510489** |
| comfort 50g 60% WR | ≈ 0.5143 | 540 / 1050 = **0.514285** |
| comfort 200g 60% WR | 0.525 | 630 / 1200 = **0.525000** |
| cheese 200g 60% WR | ≈ 0.518 | 570 / 1100 = **0.518181** |
| unavailable / no games / null | baseline | **0.510000** |
| 'none' tag | identical to 'comfort' | confirmed equal at 12 decimals |

Defaults: `defaultPriorGames = 1000`, `cheeseAttenuationFactor = 0.5`.
Both overridable via `config.proParams` for Ping 4 calibration.

## Side preference offset (spec §4.4)

`teamSideOffset(record, side, params)` exported. Smooths the team's
side WR toward 0.5 with a 50-game prior, then takes the Elo difference
vs the same baseline. `analyzeDraft` adds `(allyOffset - enemyOffset)`
to `totalRating` before converting to a global winrate.

Sample-size note (your point #1, deferred to Ping 4 calibration doc):
with `sidePriorGames = 50` and ZYB-like 8-game samples per side, the
prior dominates: 7/8 = 87.5% raw collapses to ~55.2% smoothed → ~5.2pp
winrate lift. With LFL Spring 2026 still being mid-split, most teams
will look near-neutral on side. That's the intended behavior of the
prior — over-claiming would be the bigger sin. Tunable via
`proParams.sidePriorGames`.

## No-regression triple (your point #3)

`tests/crosscheck.test.ts` now runs **20 cases** instead of 10:

- The original 10 (no pro context) — still **PASS, max 0.00pp**.
- 10 new (`playerContext` present with all slots set to
  `{ playerStats: null, comfortMode: 'none' }` + explicit
  `sideContext: undefined`) — also **0.00pp** vs the M1 reference for
  every draft.

Both forms of "no signal" collapse to the M1 path mathematically:
`blendedPriorWinrate` short-circuits to the dataset baseline when
`playerStats` is null, and `computeSideOffset` returns 0 when the
context is absent.

## Test inventory

```
pnpm test → 111 passed / 1 skipped (live golgg, env-gated)
```

| File | Tests | Purpose |
| --- | ---: | --- |
| `tests/comfort.test.ts` | 15 | Closed-form blend + integration through analyzeDraft |
| `tests/side.test.ts` | 10 | Closed-form offset + integration through analyzeDraft |
| `tests/crosscheck.test.ts` | 20 | M1 reference + M2 no-regression with empty context |
| (existing M1 suite) | 66 | Untouched, all green |

`pnpm typecheck` 0 errors / 416 files. `pnpm lint` clean. `pnpm build`
green (adapter-cloudflare).

## Ready for Ping 3 ?

Next: UI Team Context overlay (spec §4.5) — league/team selectors,
`Sync` action, picker constraint to player pool when active, comfort
toggle defaults from pool size, recent drafts sidebar, side picker.
Engine surface is stable so the UI can plug into it without churning
analyzer.ts further. Awaiting your go.
