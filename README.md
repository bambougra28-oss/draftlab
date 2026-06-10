# DraftLab

Strategic draft constructor for external League of Legends coaches —
freelance / ERL / analyst. Public-data-only (gol.gg, Oracle's Elixir,
Data Dragon). Game plan classification, adversary plan reading, ban
priority hierarchy, Fearless first-class.

> **Status:** V2.1 « Sommet » built — full data backbone (Leaguepedia
> primary + gol.gg + Oracle's Elixir), complete UI (8 routes, 21
> components), and the six novel engines: adversary ranges with negative
> information, fog & reveal, bilateral win conditions, Fearless series
> solver with denial pricing & First Selection, chess-style annotated
> review + printable prep pack, patch oracle. **764 tests, 4 gates
> green.** Engine validation/calibration is gated on live data (bot
> password + corpus) — see `docs/STATUS.md`. Master plan:
> **`docs/ARCHITECTURE_V2.md`** · coach guide: `docs/USER_GUIDE.md`.

## Why DraftLab

DraftGap is excellent for SoloQ. Pro/ERL drafting needs more context that
DraftGap can't capture: which champions a specific player actually plays,
opponent scouting, side preferences across game 1–5 of a Bo5, fatigue, and
coordinated-play matchups (which look different from SoloQ).

The tagline:
> "DraftGap for SoloQ. DraftLab for coaches and pros."

## What's shipped (V1.0-beta)

- **M1** Elo engine — DraftGap-equivalent Bayesian analyzer
  (`src/lib/engine/`).
- **M2** Pool scrap + comfort tagging — gol.gg HTML parser + comfort/
  cheese/unavailable per-pick tags (`src/lib/pro/`).
- **M3.5** Walk-forward calibration — N=320 corpus across LFL/LCK/LEC/LPL.
- **M4.1** Champion tagging — 172/172 champions on 6-8 dimensions
  (`src/lib/tags/` + `data/championTags.json`).
- **M4.2** Game Plan Classifier — 5 archetypes (Siege/Split/Pick/Protect/Engage)
  via vote-based scoring (`src/lib/strategic/gamePlanClassifier.ts`).
- **M4.3** Power Curve Visualizer — early/mid/late dominance windows.
- **M4.4 + M6.4** Risk Markers — 12 markers (front-line, damage homog.,
  side disadvantage, pool overlap, pocket pick risk, etc.).
- **M5.1** Adversary Plan Detector — pick-by-pick lecture, convergence
  signal, FR adaptive recommendation.
- **M5.2** Manual draft picker + Data Dragon icons + scout layer wiring.
- **M5.3** Pool Tier Classifier — 4 tiers (Strongest / Match Ready /
  Scrim Ready / Learning) with recency derate.
- **M5.4** Pocket Pick Risk Assessor — 3 reasons (low confidence, low
  stage presence, recent buff).
- **M5.5** PickSuggester — multi-axis ranked recommendations.
- **M6.1** BanPrioritySuggester — 5-tier hierarchy + Fearless game-number
  weighting.
- **M6.2** Plan A/B/C builder — IndexedDB storage + `/plans` routes.
- **M7** Fearless first-class — Series state + consumption tracker +
  `/series` routes.
- **CI/CD**: `.github/workflows/ci.yml` (active) + `deploy.yml` (Cloudflare
  Pages, awaiting secrets — see `docs/BLOCKERS.md`).

## Routes

| Route | Purpose | Mode |
|---|---|---|
| `/` | Team scout + analyzer + win conditions + opponent intel (tendances, ranges, ban EV) + prep-pack export | Préparation |
| `/prototype` | Game Plan / Power Curves / Risk Markers / Adversary Plan / Win Conditions | Préparation |
| `/plans`, `/plans/[id]` | Plan A/B/C builder | Préparation |
| `/series`, `/series/[id]` | Bo3/Bo5 Fearless : consumption tracker + **War Room** (intégrité de pool, dépense-vs-rétention, First Selection) + feuille re-plan | Préparation / Inter-games |
| `/review` | Revue annotée type moteur d'échecs (grades ?!/?/??, leak report) | Post-match |
| `/live` | Match-day épuré view | Match |
| `/help` | Guide de navigation | — |

## Setup

Requires Node ≥ 22.13 (24 LTS recommended) and pnpm 11 (pinned via
`packageManager`, resolved by corepack).

```bash
pnpm install
pnpm dev          # local dev server on :5173
pnpm test         # ~330 unit tests / 10 skipped (live data)
pnpm typecheck
pnpm lint
pnpm coverage:tags   # 172/172 champion tags
pnpm build        # produces .svelte-kit/cloudflare for adapter-cloudflare
```

First dev session downloads ~50 MB of dataset from `bucket.draftgap.com`,
then caches it in `localStorage` 24h. User plans + series live in
IndexedDB (no auth, no cloud sync — DV4).

## Documentation

- `docs/USER_GUIDE.md` — coach-facing how-to (workflow Lundi-Vendredi).
- `docs/FAQ.md` — 10 common questions.
- `docs/ARCHITECTURE_V1.md` — master plan M5.2 → V1.0.
- `docs/DECISIONS_V1.md` — DV1-DV9 product decisions.
- `docs/DECISIONS_ARCHITECTURE.md` — DA1-DA10 technical.
- `docs/BLOCKERS.md` — outstanding human action items.
- `docs/M5_1.md`, `docs/M4_*.md` — milestone deep-dives.
- `draftlab-frameworks-research.md` — the original research synthesis.

## Data sources

M1 consumes the public DraftGap CDN feed. M2 will swap in our own pipeline
(lolalytics scrape + Leaguepedia/GRID for pro games) so we're not dependent
on a single upstream — see `BACKLOG.md`. Credits and methodology origins are
listed in `ATTRIBUTION.md`.

## CI activation

The workflows in `.github/workflows/` are **dormant until this repo is
pushed to a GitHub remote**. To activate:

```bash
gh repo create draftlab --private --source=. --push
```

The CI workflow runs immediately. The deploy workflow needs three secrets
configured before it can succeed (Settings → Secrets and variables →
Actions):

| Secret / variable           | Where to get it                                 |
| --------------------------- | ----------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`      | Cloudflare dashboard → My Profile → API Tokens. |
|                             | Use the "Edit Cloudflare Workers" template.     |
| `CLOUDFLARE_ACCOUNT_ID`     | Cloudflare dashboard → right sidebar.           |
| `CLOUDFLARE_PROJECT_NAME`   | Variable, not secret. Defaults to `draftlab`.   |
|                             | Create the Pages project once in the dashboard. |

The first deploy must be triggered manually (`workflow_dispatch`) or by a
push to `main` after the secrets are in place.

## Project layout

```
draftlab/
├── src/
│   ├── lib/
│   │   ├── engine/        # ratings, bayesian, analyzer
│   │   ├── dataset/       # fetch + cache, mock builder for tests
│   │   ├── types/         # Role enum, Dataset, RiskLevel, ...
│   │   ├── comfort.ts     # localStorage-backed champion pool tags
│   │   └── ...
│   ├── components/        # Svelte 5 UI components
│   ├── routes/            # +page.svelte / +page.ts (SSR off, client-only)
│   ├── app.html           # Tailwind-injected shell
│   ├── app.css            # @import 'tailwindcss';
│   └── app.d.ts
├── tests/                 # Vitest, hand-computed expected values
│   ├── ratings.test.ts
│   ├── bayesian.test.ts
│   ├── analyzer.test.ts
│   ├── dataset.test.ts
│   └── sanity-live.test.ts  # auto-skipped in CI (needs local dataset file)
├── .github/workflows/     # ci.yml, deploy.yml
├── ATTRIBUTION.md
├── BACKLOG.md
├── LICENSE                # MIT
└── README.md
```

## Credits

DraftLab is heavily inspired by [DraftGap](https://github.com/vigovlugt/draftgap)
by Vigo Vlugt. The Elo rating methodology and the dataset format are based
on their open-source work. We thank them for the foundation. DraftLab adds
a pro-context layer (planned in M2–M4) for use cases beyond SoloQ. See
`ATTRIBUTION.md` for line-by-line origins.

## License

MIT — see `LICENSE`. We can release under MIT without ambiguity because no
DraftGap source is vendored: the engine was reimplemented in TypeScript
from the methodology described above.
