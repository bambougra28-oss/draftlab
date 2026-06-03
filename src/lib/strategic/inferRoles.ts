/**
 * M5.2 — Role inference.
 *
 * Assigns each picked champion to one of the five roles using the dataset's
 * games-played-per-role as the affinity signal. Greedy "widest-gap-first": the
 * champion whose best remaining role most clearly out-plays its second-best
 * remaining role is locked in first, so unambiguous picks claim their lane
 * before contested ones — which then fall back to their next-best free role.
 */
import { ROLES, type Dataset, type Role } from '$lib/types';

export function inferRoles(picks: string[], dataset: Dataset): Map<Role, string> {
    const assignment = new Map<Role, string>();
    const remainingChamps = new Set(picks);
    const remainingRoles = new Set<Role>(ROLES);

    // Precompute games-per-role for each pick.
    const gamesByChamp = new Map<string, Record<Role, number>>();
    for (const key of picks) {
        const champ = dataset.championData[key];
        const games = {} as Record<Role, number>;
        for (const role of ROLES) games[role] = champ?.statsByRole[role]?.games ?? 0;
        gamesByChamp.set(key, games);
    }

    while (remainingChamps.size > 0 && remainingRoles.size > 0) {
        let bestChamp: string | null = null;
        let bestRole: Role | null = null;
        let bestGap = -Infinity;
        let bestTopGames = -Infinity;

        for (const key of remainingChamps) {
            const games = gamesByChamp.get(key)!;
            const sortedRoles = [...remainingRoles].sort((a, b) => games[b] - games[a]);
            const topRole = sortedRoles[0];
            const topGames = games[topRole];
            const secondGames = sortedRoles.length > 1 ? games[sortedRoles[1]] : 0;
            const gap = topGames - secondGames;

            // Widest gap wins; ties broken by raw games on the preferred role.
            if (gap > bestGap || (gap === bestGap && topGames > bestTopGames)) {
                bestGap = gap;
                bestTopGames = topGames;
                bestChamp = key;
                bestRole = topRole;
            }
        }

        if (bestChamp === null || bestRole === null) break;
        assignment.set(bestRole, bestChamp);
        remainingChamps.delete(bestChamp);
        remainingRoles.delete(bestRole);
    }

    return assignment;
}
