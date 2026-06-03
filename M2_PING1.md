# M2 — Ping 1: data layer report

Status: **ready for review**.

## What landed

- `src/routes/api/golgg/+server.ts` — same-origin proxy (Cloudflare Pages
  Function in prod). Hardening: HTTPS-only, host allowlist (`gol.gg`
  exact match), rejects URL credentials, refuses 3xx redirects manually,
  per-IP rate limit 1 req/s with 429 + Retry-After, GET-only with explicit
  405 on POST/PUT/DELETE/PATCH, custom UA, no caller-cookie forwarding,
  passes raw HTML through with `text/html`.
- `src/lib/pro/types.ts` — `ProTeam`, `ProPlayer`, `ChampionPoolEntry`,
  `RecentDraft`, `DraftPick`, `DraftBan`, `TeamSideStats`, `LEAGUES`
  registry. Pro-prefixed to avoid clashing with M1's `Team` (which is
  the draft-slot map).
- `src/lib/pro/championLookup.ts` — dual index (display name + slug)
  with apostrophe and whitespace normalization. `lookupChampion` falls
  back name → slug for cases where gol.gg renders the slug form
  (`Kaisa`, `Khazix`) inside player pool tables.
- `src/lib/pro/golgg.ts` — pure parsers (`parseRoster`, `parseSideStats`,
  `parsePlayerPool`, `parseTeamList`, `parseRecentDrafts`) plus async
  fetchers (`fetchTeamList`, `fetchTeam`, `fetchPlayerPool`) wrapping
  a swappable `Transport` and a 24h `localStorage` cache keyed by URL.
  Internal 1 s rate-limit between transport calls so a fan-out scrape
  never bursts gol.gg.

## Tests

```
pnpm test → 76 passed / 1 skipped (live test, env-gated)
pnpm typecheck → 0 errors / 414 files
pnpm lint → clean
pnpm build → adapter-cloudflare build green
```

New test files this milestone:

- `tests/championLookup.test.ts` — 18 tests. The 12 documented edge cases
  (7 apostrophes, 5 spaces) all map name ↔ slug to the same key. Plus
  Wukong/MonkeyKing alias, curly-quote variant, normalize helpers.
- `tests/golgg.parser.test.ts` — 13 tests. Covers ZYB roster, side stats
  from JS-embedded `WRData`, LFL team list (10 teams returned), Manaty's
  champion pool with mapped keys + record extraction, recent drafts with
  game IDs and side detection.
- `tests/golgg.cache.test.ts` — 2 tests with a Map-backed `localStorage`
  stub: cache hit on second call (transport invoked exactly once),
  expired entries (>24 h) bypass the cache.
- `tests/golgg.live.test.ts` — env-gated (`DRAFTLAB_LIVE=1`), hits real
  gol.gg via `directTransport` for the Ping 1 acceptance smoke.

## Live ZYB pull (acceptance)

`DRAFTLAB_LIVE=1 pnpm test golgg.live` → **6.2 s**, **0 warnings**.

| Field | Value |
| --- | --- |
| Team ID | 2924 |
| Name | ZYB Esport |
| League | lfl |
| Tournament | LFL 2026 Spring Split |
| Side stats | Blue 2W/2L · Red 1W/3L |
| Total record | 3W–5L |
| Players | 5 |
| Recent drafts | 8 |
| Warnings | 0 |

### Roster + top picks (this split)

| Role | Player | gol.gg id | Pool size | Top picks |
| --- | --- | --- | --- | --- |
| TOP | Wao | 4981 | 5 | Rumble (3), Jax (2), Ornn (1) |
| JG | Manaty | 2048 | 4 | Xin Zhao (4), Zaahen (2), Jax (1) |
| MID | Nisqy | 873 | 6 | Ahri (2), Ryze (2), Anivia (1) |
| BOT | Jezu | 2678 | 6 | Caitlyn (2), Kalista (2), Corki (1) |
| SUP | Riippp | 6710 | 4 | Nautilus (4), Neeko (2), Rell (1) |

### Champion mapping warnings

None on this split.

The `lookupChampion` fallback (name → slug) caught one initial case:
gol.gg renders `Kaisa` (slug) instead of `Kai'Sa` (display) in player
pool rows for some champions. With the fallback the warning list is
empty for the entire ZYB scrape. Future LFL teams may surface other
slug-form display names; the same fallback path will rescue them.

The full Team JSON dump (5 players × pools, 8 drafts × 5 picks + 5 bans,
side stats) is committed at `M2_PING1_ZYB.json` for inspection.

## Architectural notes

1. **Two transports**, one cache. `proxyTransport` (browser default)
   routes through `/api/golgg`; `directTransport` (node, server-side
   tests) hits gol.gg unmediated. The cache layer wraps either, so cache
   hits are transport-agnostic.
2. **Rate limit lives in two places** by design. Server (per-IP, in
   memory inside the Pages Function isolate) prevents abuse from random
   callers; client (process-wide between transport calls) keeps a
   single user's fan-out polite. Both are 1 s.
3. **Best-effort parsing**. `fetchTeam` never throws on a sub-failure.
   If team-stats succeeds but team-draft 404s, the returned `ProTeam`
   has `incomplete: true` and the warning is in `warnings[]`. UI can
   surface "drafts unavailable" without losing the rest of the data.
4. **`incomplete` is undefined when nothing failed** (rather than
   `false`) — the field's presence is the signal that something needs
   attention, lets the JSON stay clean.

## What I would not commit autonomously

Everything matched the spec: nothing requires a structural call before
Ping 2.

## Ready for Ping 2 ?

Next: `playerContext` parameter on `analyzeDraft`, comfort Bayesian blend
(section 4.3), side-preference offset (section 4.4), no-regression
against the 10 cross-check drafts. Awaiting your go.
