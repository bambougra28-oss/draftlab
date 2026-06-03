# DraftLab — Unresolved decisions

Items accumulated during the M4 autonomous sprint. Not blocking, but worth a
human pass before they harden into convention.

## M4.2 — `disengageTools: 'self'` rule mismatch

**Spec (D4 Split bucket)** : `disengageTools includes "self" mobility → +1 split`

**Reality** : the M4.1 schema dropped `'self'` from `DisengageTool` (replaced by
the broader `mobility` dimension). Champions with self-escape (Tristana R on
self, Vladimir W pool, Ezreal E) score on `mobility` but not on a self-disengage
flag.

**Resolution applied** : the rule is skipped. Split scoring still benefits
from the `range melee + AD + scalingWindow late` duelist bonus, and from
`mobility high + range melee`. Self-escape ranged champions (Ezreal, Vlad) are
pulled toward Split through their melee proxies — but our test corpus suggests
Split is dominated by melee duelists anyway, so the gap is acceptable.

**To revisit** : if Split classification proves under-tuned in M5+, consider
adding back a `selfEscape: boolean` flag on tags or expanding `disengageTools`
with `'self-escape'`.

## M4.3 — `statsByTime` bucket boundaries

**Spec (D7)** : 3 buckets `early` (0-15 min), `mid` (15-25 min), `late` (25+ min).

**Reality** : the DraftGap dataset's `statsByTime` array has 5 entries with
boundaries at 25/30/35/40 minutes (verified by inspecting the cached sample
2026-05-01). The 0-15 / 15-25 cut points the spec asked for don't exist.

**Resolution applied** : map dataset's 5 buckets to 3 visualizer buckets as:
- `early` = bucket 0 (<25 min)
- `mid` = buckets 1+2 (25-35 min, weighted average by games)
- `late` = buckets 3+4 (35+ min, weighted average by games)

Documented in `docs/M4_3.md`. The visualizer labels reflect the actual
boundaries, not the spec's labels.

**To revisit** : if a finer-grained 0-15 distinction is needed for early-game
analysis, we'd need to source a different dataset or compute it ourselves from
match logs.

## Champion tags — confidence:low entries needing human review

Three post-cutoff champions tagged via web-search with `confidence: low`:

- Mel (key 800) — Jan 2025 release
- Yunara (key 804) — Jul 2025 release
- Zaahen (key 904) — Nov 2025 release

These entries should be reviewed by a human familiar with current pro play
before being trusted in M4.2 classification for top-priority drafts.
