/**
 * Exponential time decay of {wins, games} tallies across patches
 * (doctrine §6.1, research 2026-06_methodologie_draft §1.5).
 *
 * Standard practice: weight each game by λ^Δpatch (λ ≈ 0.7–0.9 per patch)
 * before shrinkage, on both wins and games. The decayed game count IS the
 * effective sample size (Σ λ^age · games) — it is what sample-size badges
 * and priorN comparisons must use, so it is returned as an explicit field
 * rather than leaving call sites to guess which `games` they hold.
 *
 * `patchAge` converts LoL patch labels ('26.05' = year 26, 5th patch) into
 * the integer age `decayStats` expects, handling the year rollover
 * (25.24 → 26.01 is one patch) under the ~24-patches-per-year calendar.
 */

/** One dated tally; `age` is in decay units (patches, weeks…), 0 = current. */
export interface DecayedEntry {
    wins: number;
    games: number;
    age: number;
}

export interface DecayedStats {
    /** λ-weighted wins: Σ wins_i · λ^age_i. */
    wins: number;
    /** λ-weighted games: Σ games_i · λ^age_i. */
    games: number;
    /** Effective sample size — equals the decayed `games` (research §1.5). */
    effectiveSample: number;
}

/**
 * Apply exponential decay λ^age to each entry and sum. λ must be in (0, 1]
 * (1 = no decay). Negative ages (entry "fresher than now") are clamped to 0 —
 * decay must never amplify a sample.
 */
export function decayStats(entries: DecayedEntry[], lambda: number): DecayedStats {
    if (!(lambda > 0 && lambda <= 1)) {
        throw new RangeError(`decayStats: lambda must be in (0, 1] (got ${lambda})`);
    }
    let wins = 0;
    let games = 0;
    for (const entry of entries) {
        const weight = Math.pow(lambda, Math.max(0, entry.age));
        wins += entry.wins * weight;
        games += entry.games * weight;
    }
    return { wins, games, effectiveSample: games };
}

/**
 * Approximate patch cadence since the 2025 calendar switch: ~24 patches per
 * year, labelled YY.01 … YY.24. The constant is the year-rollover stride for
 * `patchAge` — a one-step approximation documented in research §1.5.
 */
export const PATCHES_PER_YEAR = 24;

interface ParsedPatch {
    year: number;
    minor: number;
}

/** Parse 'YY.MM' (tolerating hotfix suffixes like '26.05b'); undefined if malformed. */
function parsePatch(raw: string): ParsedPatch | undefined {
    const match = /^\s*(\d+)\.(\d+)/.exec(raw);
    if (match === null) return undefined;
    return { year: Number(match[1]), minor: Number(match[2]) };
}

/**
 * Age of `patch` relative to `currentPatch`, in patch steps:
 * (Δyear · PATCHES_PER_YEAR) + Δminor, clamped at 0 (a patch newer than the
 * current one gets age 0, never a negative age that would amplify it).
 * Returns undefined when either label cannot be parsed — the caller decides
 * the policy for undated samples (drop, or worst-case age).
 *
 * Examples: patchAge('26.03', '26.05') = 2; patchAge('25.24', '26.01') = 1.
 */
export function patchAge(patch: string, currentPatch: string): number | undefined {
    const from = parsePatch(patch);
    const to = parsePatch(currentPatch);
    if (from === undefined || to === undefined) return undefined;
    const delta = (to.year - from.year) * PATCHES_PER_YEAR + (to.minor - from.minor);
    return Math.max(0, delta);
}
