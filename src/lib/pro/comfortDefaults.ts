/**
 * M2 — single source of truth for pool-size → comfort defaults.
 *
 * ≥5 games on a champion → Comfort, 1–4 → Cheese, 0 → Unavailable.
 * (Thresholds flagged for re-tuning at calibration — see docs/STEP_UP.md.)
 */
import type { ComfortMode } from '$lib/types';

export const POOL_COMFORT_THRESHOLDS = { comfort: 5, cheese: 1 } as const;

export function comfortModeFromGames(games: number): ComfortMode {
    if (games >= POOL_COMFORT_THRESHOLDS.comfort) return 'comfort';
    if (games >= POOL_COMFORT_THRESHOLDS.cheese) return 'cheese';
    return 'unavailable';
}
