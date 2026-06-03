# M4.1.1 — Polish Pass (2026-05-02)

Sourced human review of the 155 `confidence: medium` + 3 `confidence: low`
tags from the M4.1.1 batch. All decisions arbitrated by Alain in the
autonomous-sprint brief; web-search-sourced corrections applied verbatim.

## Outcome

| | Pre-polish | Post-polish |
|---|---|---|
| `taggedBy: user` | 15 | **172** |
| `taggedBy: claude` | 157 | 0 |
| `confidence: high` | 14 | 14 (unchanged) |
| `confidence: medium` | 155 | 155 |
| `confidence: low` | 3 | 3 |
| `hyperCarry: true` count | 16 | **15** (Sion → false) |
| `engageTool: hard-aoe` count | 45 | **40** (4 demoted, 1 unchanged) |

The 6 champions Alain proposed promoting to `high` (Aatrox, Janna, Fiora,
Lulu, LeeSin, Vayne) were already in the existing 14-champion `high` set —
no double-promotion needed. Total `high` stays at 14.

`confidence: medium` is preserved on all bulk-promoted champions as a
"re-audit if M4.2 underperforms on this champ" signal, per the brief.

## Corrections applied (Bucket A — Recents/post-cutoff)

| Champ | Field | Old → New | Source |
|---|---|---|---|
| Mel | `disengageTools` | `[]` → `["peel"]` | W Rebuttal = 1s barrier reflecting projectiles (LoL Wiki + Mobalytics + Wild Rift guide) |
| Yunara | `damageType` / `secondaryDamageType` | `AP/AD` → `AD/AP` | Pro build 2025-2026 = Lethal Tempo + Kraken Slayer (AD-on-hit dominant); magic damage via on-hit passive + crit empower |
| Zaahen | notes | refreshed | W Dreaded Return multi-target hard-aoe confirmed (LoL Wiki + Esports.net counters guide) |
| Heimerdinger | `engageTool` | `hard-aoe` → `soft-single` | E grenade stun is single-target (135 stun radius vs 250 dmg radius); R upgrade multi-stun is conditional |
| Briar | `engageTool` | `soft-single` → `none` | R global frenzy = self-buff + dash to random hit, not coordinated team-engage |
| Milio | `disengageTools` | confirmed includes `peel` | (no change needed) |
| Renata | `disengageTools` / `engageTool` | confirmed `peel` + `none` | (no change needed) |

Bucket A "maintain" champions (Aurora, Ambessa, Smolder, Naafiri, Hwei,
Bel'Veth, Zeri, Nilah): no tag changes; promoted to `taggedBy: user`.

## Corrections applied (Bucket B — Form-changing kits)

| Champ | Field | Old → New | Source |
|---|---|---|---|
| Shyvana | `engageTool` | `hard-aoe` → `soft-single` | R dragon-form leap reliable stun is on impact target (single); AoE is collateral damage, not multi-target lock |

Bucket B "maintain" champions (Karma, Elise, Nidalee, Kayn, Gnar, Kled,
Samira, Pyke): no tag changes.

## Corrections applied (Bucket C — Hard-aoe re-challenged)

| Champ | Field | Old → New | Rationale |
|---|---|---|---|
| Vex | `engageTool` + remove `engage` hint | `hard-aoe` → `soft-single` | R Shadow Surge = single-target hunt-down with dash to target (refunds on takedown) |
| Lillia | `engageTool` | `hard-aoe` → `soft-single` | R global sleep requires Q wake to trigger burst — deferred conditional engage, not AoE lock |
| Sett | `engageTool` + remove `engage` hint | `hard-aoe` → `soft-single` | R Show Stopper grab is single-target; AoE on slam is damage only |

Bucket C "maintain" (Sona — R line stun multi-lock acceptable; Urgot — E
AoE knockflip multi-target genuine).

## Corrections applied (Bucket D — Notes ambiguës)

| Champ | Field | Old → New | Rationale |
|---|---|---|---|
| Akali | `damageType` + remove `secondaryDamageType` | `AP/AD` → pure `AP` | AD passive on AA is procs-only, not build-defining in pro. Q + R = AP scaling core |

Bucket D "maintain": Varus, Kai'Sa, Bard.

## HyperCarry list correction

| Champ | Field | Old → New | Rationale |
|---|---|---|---|
| Sion | `hyperCarry` | `true` → `false` | Late-game tank scaling, but functional role is frontline initiator, not 1v9 carry. HyperCarry list goes from 16 → 15 |

## Tests / verification

```
pnpm test          → 236 passed / 10 skipped (live-data tests)
pnpm typecheck     → 447 files / 0 errors / 0 warnings
pnpm lint          → clean
pnpm coverage:tags → 172 / 172 (100%)
```

No tests required updating — the gamePlanClassifier and riskMarkerDetector
smoke tests continue to pass against the corrected tags. The M4.2 Game
Plan classifier may shift a few archetype distributions slightly (Vex,
Lillia, Sett, Shyvana, Heimerdinger no longer contribute hard-aoe weight)
but no smoke test changed primary archetype.

## Files modified

```
data/championTags.json                          (13 patches + 157 promotions)
docs/M4_1_1.md                                  (counter update)
docs/M4_1_1_POLISH.md                           (this file, new)
scripts/polish-tags.mjs                         (one-shot polish script, kept for trace)
```
