/**
 * M5.3 — Pool Tier Classifier.
 *
 * Sorts a player's champion-pool entries into four readiness tiers from their
 * recency-derated game count. Games played within a 60-day grace window count
 * at full weight; older games decay (so a champion not touched in months drops
 * a tier even if historically heavily played).
 *
 * NOTE: thresholds + decay are a behaviour-faithful reconstruction (the detailed
 * M5.3 spec was lost) — see docs/STEP_UP.md to re-tune.
 */
export type PoolTier = 'strongest' | 'match-ready' | 'scrim-ready' | 'learning';

export interface PoolEntryInput {
    games: number;
    /** Days since the champion was last played; older games are derated. */
    daysSinceLastPlayed?: number;
}

const RECENCY_GRACE_DAYS = 60;

/** Tier thresholds on effective (recency-derated) games, highest first. */
const THRESHOLDS: readonly { tier: PoolTier; min: number }[] = [
    { tier: 'strongest', min: 20 },
    { tier: 'match-ready', min: 10 },
    { tier: 'scrim-ready', min: 3 },
    { tier: 'learning', min: 0 }
];

/** Recency-derated game count: full weight within the grace window, decaying after. */
export function effectiveGames(games: number, daysSinceLastPlayed = 0): number {
    if (daysSinceLastPlayed <= RECENCY_GRACE_DAYS) return games;
    return games * (RECENCY_GRACE_DAYS / daysSinceLastPlayed);
}

export function classifyPoolTier(entry: PoolEntryInput): PoolTier {
    const eff = effectiveGames(entry.games, entry.daysSinceLastPlayed ?? 0);
    for (const { tier, min } of THRESHOLDS) {
        if (eff >= min) return tier;
    }
    return 'learning';
}
