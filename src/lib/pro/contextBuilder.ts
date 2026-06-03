/**
 * M2 — build engine context from scraped pro-team data (Ping 3).
 *
 * `buildPlayerContext` turns a team's player pools + the current picks into the
 * per-role comfort signal the analyzer consumes; `buildSideContext` maps both
 * teams' side records into the side-offset input. Pure functions — no DOM, no
 * clock (the caller passes `now` to `relativeTimeLabel`).
 */
import type { ChampionPoolEntry, ProTeam } from './types';
import { comfortModeFromGames } from './comfortDefaults';
import { ROLES, type PlayerContext, type Role, type SideContext, type Team } from '$lib/types';

export function poolForRole(team: ProTeam, role: Role): ChampionPoolEntry[] {
    return team.players.find((p) => p.role === role)?.pool ?? [];
}

export function buildPlayerContext(team: ProTeam, picks: Team): PlayerContext {
    const context: PlayerContext = {};

    for (const role of ROLES) {
        const championKey = picks.get(role);
        if (championKey === undefined) continue;

        const entry = poolForRole(team, role).find((e) => e.championKey === championKey);
        if (!entry || entry.games === 0) {
            // Picked a champion the assigned player has no games on → outside pool.
            context[role] = { playerStats: entry ? { games: 0, winrate: 0 } : null, comfortMode: 'unavailable' };
        } else {
            context[role] = {
                playerStats: { games: entry.games, winrate: entry.wins / entry.games },
                comfortMode: comfortModeFromGames(entry.games)
            };
        }
    }

    return context;
}

export function buildSideContext(
    ally: ProTeam,
    enemy: ProTeam,
    allySide: 'blue' | 'red',
    enemySide: 'blue' | 'red'
): SideContext {
    return {
        ally: { record: { blue: ally.sideStats.blue, red: ally.sideStats.red }, side: allySide },
        enemy: { record: { blue: enemy.sideStats.blue, red: enemy.sideStats.red }, side: enemySide }
    };
}

/** Human "synced N ago" label. `now` is injected so the function stays pure. */
export function relativeTimeLabel(thenMs: number, nowMs: number): string {
    const minutes = Math.floor(Math.max(0, nowMs - thenMs) / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    return `il y a ${Math.floor(hours / 24)} j`;
}
