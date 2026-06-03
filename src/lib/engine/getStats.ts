/**
 * Dataset navigation helper.
 *
 * Resolves a {wins, games} tally for a champion-role, or for a champion-role's
 * matchup / synergy against another champion-role. Missing entries resolve to
 * an empty {0, 0} tally so callers never have to null-check the deep maps.
 */
import type { Dataset, Role, Stats } from '$lib/types';

export function getStats(dataset: Dataset, championKey: string, role: Role): Stats;
export function getStats(
    dataset: Dataset,
    championKey: string,
    role: Role,
    type: 'duo' | 'matchup',
    otherRole: Role,
    otherChampionKey: string
): Stats;
export function getStats(
    dataset: Dataset,
    championKey: string,
    role: Role,
    type?: 'duo' | 'matchup',
    otherRole?: Role,
    otherChampionKey?: string
): Stats {
    const roleData = dataset.championData[championKey]?.statsByRole[role];
    if (!roleData) return { wins: 0, games: 0 };

    if (!type) {
        return { wins: roleData.wins, games: roleData.games };
    }

    const map = type === 'matchup' ? roleData.matchup : roleData.synergy;
    return map[otherRole!]?.[otherChampionKey!] ?? { wins: 0, games: 0 };
}
