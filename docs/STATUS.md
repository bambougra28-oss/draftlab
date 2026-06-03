# DraftLab — Status

Updated: 2026-05-01

## State

**M4 prototype fonctionnel** — strategic layer (Game Plan + Power Curves +
Risk Markers) shipping with a demonstrable browser-side prototype at
`/prototype`.

## Coverage

- Champion tags: **172 / 172 (100%)**
- Calibration confidence: 15 user-validated, 154 confidence:medium awaiting
  review, 3 confidence:low (post-cutoff, web-verified).

## Tests

- 236 passing / 10 skipped (live-data tests bypassed without local sample)
- Typecheck clean, lint clean.

## Modules shipped

| Milestone | Module | File |
|---|---|---|
| M1 | DraftGap engine clone | `src/lib/engine/` |
| M2 | Pool scrap + Bayesian comfort | `src/lib/pro/` |
| M3.5 | Walk-forward calibration | (corpus + analyzer) |
| **M4.1** | Champion tagging foundation | `src/lib/tags/` |
| **M4.1.1** | Full champion tag coverage | `data/championTags.json` |
| **M4.2** | Game Plan Classifier | `src/lib/strategic/gamePlanClassifier.ts` |
| **M4.3** | Power Curve Visualizer | `src/lib/strategic/powerCurveCalculator.ts` + `src/lib/components/PowerCurveVisualizer.svelte` |
| **M4.4** | Risk Markers | `src/lib/strategic/riskMarkerDetector.ts` |
| **M4** | Prototype route | `src/routes/prototype/+page.svelte` |

## How to run

```bash
pnpm dev
# → http://localhost:5173/             ← M2 draft analyzer
# → http://localhost:5173/prototype    ← M4 strategic prototype
```

## Roadmap (next)

- **Polish M4.1.1**: review 154 confidence:medium tags (~1-2h pass).
- **M5.1**: Adversary Plan Detector (pick-by-pick read using M4.2 classifier).
- **M5.2**: Pool Tier Classifier (4 tiers: Strongest/Match Ready/Scrim Ready/Learning).
- **M5.3**: Pocket Pick Risk Assessor.
- **M5.4**: Suggestions de picks contextualisées par game plan adverse.

Per `draftlab-frameworks-research.md` §5.

## Unresolved

See `docs/unresolved.md`. Two transverse decisions and three champion tags
flagged for human review.
