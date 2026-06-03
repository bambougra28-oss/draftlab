# M4 Prototype — `/prototype` route

Closed: 2026-05-01

## What it is

A SvelteKit page that integrates **M4.2 Game Plan Classifier** + **M4.3 Power
Curve Visualizer** + **M4.4 Risk Markers** in one demonstrable view.

## Run it

```bash
pnpm dev
# → open http://localhost:5173/prototype
```

The dataset (~50 MB) is fetched client-side from `bucket.draftgap.com` on first
load and cached in localStorage (24h TTL).

## UI structure

```
┌──────────────────────────────────────────────────────────┐
│ DraftLab Prototype — M4 Demo                             │
│ M4.2 Game Plan + M4.3 Power Curves + M4.4 Risk Markers   │
├──────────────────────────────────────────────────────────┤
│ [Sample Selector — dropdown of 5 illustrative drafts]    │
│ [context paragraph for the selected draft]               │
├──────────────────────────────────────────────────────────┤
│ ALLY (blue)                  │ ENEMY (red)               │
│ Top:  K'Sante                │ Top:  Maokai              │
│ Jg:   Sejuani                │ Jg:   Vi                  │
│ Mid:  Sylas                  │ Mid:  Galio               │
│ ADC:  Kai'Sa                 │ ADC:  Smolder             │
│ Sup:  Rell                   │ Sup:  Leona               │
├──────────────────────────────────────────────────────────┤
│ Game Plan          ALLY: engage (high)   ENEMY: engage   │
│ siege   ▓░░░░░░░░░░░    7%  │  siege   ▓░░░░░░░░░░░  8% │
│ split   ▓▓▓░░░░░░░░░   30%  │  split   ▓▓▓░░░░░░░░░ 28% │
│ pick    ▓▓░░░░░░░░░░   15%  │  pick    ░░░░░░░░░░░░  3% │
│ protect ░░░░░░░░░░░░    3%  │  protect ▓░░░░░░░░░░░  9% │
│ engage  ▓▓▓▓▓░░░░░░░   45%  │  engage  ▓▓▓▓▓▓░░░░░░ 52% │
├──────────────────────────────────────────────────────────┤
│ Power Curves [Team / Lanes toggle]                       │
│   <SVG line chart, ally=blue, enemy=red, 3 buckets>      │
│ Fenêtre de domination ally : mid                         │
├──────────────────────────────────────────────────────────┤
│ Risk Markers (3)                                         │
│ ⚠ no-disengage-vs-engage (critical)                      │
│   [rationale]                                            │
│ ! homogeneous-scaling (warning)                          │
│   [rationale]                                            │
│ ⓘ no-engage-tool (info)                                 │
│   [rationale]                                            │
└──────────────────────────────────────────────────────────┘
```

## Sample drafts

5 illustrative drafts in `data/sampleDrafts.json`. Plausible 2025-2026 pro
patterns (not exact historical drafts — see file header for caveat).

| ID | Theme | Expected primary archetypes |
|---|---|---|
| `engage-vs-engage` | Heavy 5v5 brawl | engage / engage |
| `pick-vs-protect` | Catch comp vs hyper carry | pick / protect |
| `siege-vs-split` | Long-range poke vs 1-3-1 | siege / split (or protect) |
| `mixed-engage-vs-protect` | Mid-game vs late carry | engage / mixed |
| `poke-vs-dive` | Poke + waveclear vs dive | protect/siege / engage |

End-to-end pipeline validated against all 5 — see `docs/M4_PROTOTYPE.md`
section *Smoke validation*.

## Smoke validation (sanity numbers)

Output of the end-to-end pipeline run on `data/sampleDrafts.json`:

```
Draft 1 (Heavy Engage 5v5 brawl)
  ally  engage 45%  split 30%  pick 15%  siege 7%  protect 3%
  enemy engage 52%  split 28%  protect 9%  siege 8%  pick 3%

Draft 2 (Pick stack vs Hyper Carry Protect)
  ally  pick 43%  split 21%  engage 17%  protect 12%  siege 7%
  enemy protect 34%  pick 22%  engage 20%  siege 14%  split 9%

Draft 3 (Long-range Siege vs Split-push)
  ally  siege 40%  pick 26%  protect 16%  engage 15%  split 3%
  enemy protect 25%  pick 22%  split 22%  engage 20%  siege 12%

Draft 4 (Mid-game brawl vs Late hyper carry)
  ally  engage 35%  split 22%  pick 22%  siege 15%  protect 6%
  enemy engage 30%  split 22%  protect 19%  pick 16%  siege 13%

Draft 5 (Poke + waveclear vs Hard dive)
  ally  protect 30%  engage 28%  siege 25%  pick 10%  split 7%
  enemy engage 42%  split 30%  pick 18%  protect 6%  siege 4%
```

Numbers align with the labeled themes in 4 / 5 cases. Draft 3 enemy was
labeled "Split" but classifies as "protect 25% / split 22%" — close call,
acceptable for prototype.

## Limits

- **No matchup data for some champions in real dataset** — `difficult-lane-matchup`
  fires only when both champs have ≥100 SoloQ games together. Some niche
  lane matchups won't trigger.
- **No champion icons** — names only. Icons require ddragon URL composition with
  patch version. Polish item.
- **No manual draft input** — sample selector only. Manual picker is M5+ scope.
- **Sample drafts are illustrative**, not exact historical references. The
  user is encouraged to load real drafts from `gol.gg` via the existing M2/M3
  scout pipeline (separate flow on `/`) once the manual picker is wired here.

## Files

- `data/sampleDrafts.json` — 5 sample drafts
- `src/routes/prototype/+page.ts` — `ssr=false, prerender=false`
- `src/routes/prototype/+page.svelte` — UI
- Reuses: `src/lib/strategic/{gamePlanClassifier,powerCurveCalculator,riskMarkerDetector}.ts`,
  `src/lib/components/PowerCurveVisualizer.svelte`,
  `src/lib/dataset/fetch.ts`, `src/lib/tags/index.ts`.

## Verification

- `pnpm typecheck` — 0 errors
- `pnpm lint` — clean
- `pnpm build` — succeeds (Cloudflare adapter)
- `pnpm dev` + `curl http://localhost:5173/prototype` — HTTP 200
