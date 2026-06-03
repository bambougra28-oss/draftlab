# M2 — Ping 3: Team Context UI overlay

Status: **ready for browser smoke-test on your end**.

## What landed

### New components
- `src/components/TeamContextPanel.svelte` — league dropdown (LFL only,
  LCK/LPL/LEC disabled with "M2.5" hint), tournament slug select, Team A
  / Team B selectors populated from gol.gg's tournament list, per-team
  Sync button with "Synced 3h ago · refresh" relative-time label,
  "Apply team context" master toggle.
- `src/components/SidePicker.svelte` — Blue/Red toggle for the ally
  team. Shows both teams' side win-rates inline so the choice is
  informed.
- `src/components/RecentDraftsSidebar.svelte` — last 6 drafts of each
  synced team, side icon (🟦/🟥) + W/L + opponent + 5-pick summary.
  Click loads that draft into the picker (ally team A's drafts go into
  ally slots; team B's into enemy slots — also flips `allySide` from
  the draft when loading from team A).

### Extended components
- `src/components/ChampionPicker.svelte` — picker now accepts an
  optional `poolEntries` prop. Per your UX point #1: pool champions
  appear at the top under a "Player pool" header with a green
  background tint and a `4g · 75%` games/WR badge; the rest of the
  champion catalogue remains right below under "Other champions",
  fully selectable. **No filter, no toggle** — exploration of out-of-pool
  picks stays one click away. Champions present in the pool also get
  a small grey games-count next to their name when they appear in the
  "Other" section, so a coach scrolling past sees the signal in both
  places.
- `src/components/ChampionSlot.svelte` — when context is on, the slot
  header shows the assigned player's name under the role label. Once a
  champion is picked, a subtitle shows either `4g · 75% WR` (in pool)
  or "outside pool" in amber.

### Wiring
- `src/routes/+page.svelte` integrates everything:
  - State: `contextActive`, `leagueId`, `tournamentSlug`, `teamList`,
    `teamA/B`, `teamAId/teamBId`, fetching flags, `allySide`.
  - `playerContext` and `sideContext` are `$derived` — they collapse
    to `undefined` when the master toggle is off, so the M1 path runs
    unchanged.
  - `fetchTeam` is called on Sync; `fetchTeamList` on demand from the
    panel button (lazy — first paint stays fast).
- `src/lib/pro/contextBuilder.ts` — `buildPlayerContext`,
  `buildSideContext`, `relativeTimeLabel`, `poolForRole`. 9 unit tests
  in `tests/contextBuilder.test.ts` cover override-vs-default,
  thin-pool cheese default, outside-pool unavailable, side-record
  stripping.
- `src/lib/pro/comfortDefaults.ts` — central `POOL_COMFORT_THRESHOLDS`
  constant with `// TODO: tune at Ping 4 calibration` marker. Per your
  UX point #2: thresholds 5 (comfort) and 1 (cheese) are defined in
  exactly one place; ChampionSlot and contextBuilder both read from
  this module.

## Smoke tests run

`pnpm dev` was started locally on `http://localhost:5173/`. The
following verified via `curl` — full UX click-through requires your
browser:

| Probe | Result |
| --- | --- |
| `GET /` | 200 |
| `GET /api/golgg` (no `url` param) | 400 — "missing url param" |
| `GET /api/golgg?url=https://evil.example/` | 400 — host not allowed |
| `GET /api/golgg?url=https://user@gol.gg/` | 400 — credentials in url |
| `GET /api/golgg?url=http://gol.gg/` | 400 — protocol must be https |
| `POST /api/golgg?url=...` | 405 — GET only |
| `GET /api/golgg?url=<ZYB url>` (1st) | 200, 583 KB, "ZYB Esport" present |
| `GET /api/golgg?url=<ZYB url>` (immediate 2nd) | 429, `Retry-After: 1` |
| Same after `sleep 1.5` | 200 |

So: hardening from your message holds end-to-end (allowlist, GET-only,
rate-limit triggers and clears), and a real gol.gg fetch round-trips
through the endpoint in ~1 s.

## What I cannot verify from this environment

There is no browser available, so I cannot:
- visually confirm the picker layout (highlighted pool vs. rest);
- click through the team-sync flow;
- verify "load draft from sidebar" puts the right champions in the
  right slots without overlap.

What I can confirm by static + smoke testing:

```
pnpm test       → 120 passed / 1 skipped (live golgg)
pnpm typecheck  → 422 files, 0 errors
pnpm lint       → clean
pnpm build      → adapter-cloudflare green
```

…and the page returns HTTP 200 with no client-side JS errors visible
in the served HTML.

## What to look for when you click through

A few things worth eyeballing:

1. **Pool first**: in the picker dropdown, the pool entries should
   appear at the top with a green background and a `Xg · WR%` badge.
   Below a separator labeled "Other champions" comes the full
   alphabetical list. Both groups search-filter together when you
   type.
2. **Slot subtitles**: when context is on and a champion is picked,
   the slot should say something like `Manaty / Xin Zhao · 4g · 25%
   WR`. If you pick a champion the assigned player has never played,
   the second line goes amber and reads "outside pool".
3. **Comfort defaults**: the comfort tag should pre-fill from pool
   size (≥5g → green Comfort, 1–4g → amber Cheese, 0g →
   red Unavailable). Toggle still works manually and persists in
   localStorage.
4. **Apply team context**: switching the master toggle should
   measurably shift the global winrate when both teams are synced and
   pickers are populated. With the toggle off, the engine call
   collapses to the M1 path (same value as without context).
5. **Side picker**: clicking Blue / Red should change the displayed
   side stats and shift the global winrate by a few points.
6. **Recent drafts → load**: clicking a draft from team A's column
   should drop those 5 picks into the ally slots (clearing prior
   ally picks) and flip `allySide` to that draft's recorded side.

## Open question

Loading a draft from team A's recent-drafts list overwrites ally
slots; loading from team B overwrites enemy. There's no "load both
sides of this game" affordance because gol.gg's `team-draft` page
only gives me the side I'm scoping to (the opposing 10 icons are
*also* there in the row but we'd need an additional pass to attribute
them to the *enemy* team's actual `playerId`s without a roster lookup).
For Ping 3 I kept it scoped — flag if you want the symmetric
"load full draft" wired in here vs. at Ping 4 calibration.

## Ready for Ping 4 ?

Engine + UI both stable. Calibration pass is mostly orchestration:
load ~40 LFL Spring 2026 drafts, run `analyzeDraft` on each pre-game
state, compare predicted winner to actual, sweep `defaultPriorGames`
∈ {500, 1000, 2000} and `sidePriorGames` ∈ {25, 50, 100}, write
`M2_CALIBRATION.md`. Awaiting your go.
