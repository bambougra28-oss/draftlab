/**
 * M2 — Pro-context data layer types.
 *
 * Pro-prefixed where needed to avoid clashing with M1's `Team` (the draft-slot
 * role→champion map). These model what we scrape from gol.gg.
 */
import type { Role } from '$lib/types';

export interface ChampionPoolEntry {
    championKey: string;
    games: number;
    wins: number;
}

export interface ProPlayer {
    /** gol.gg player id. */
    id: string;
    name: string;
    role: Role;
    pool: ChampionPoolEntry[];
}

export interface DraftPick {
    championKey: string;
    role?: Role;
}

export interface DraftBan {
    championKey: string;
}

export interface RecentDraft {
    gameId: string;
    side: 'blue' | 'red';
    result?: 'W' | 'L';
    opponent?: string;
    picks: DraftPick[];
    bans: DraftBan[];
    /** Populated from the tournament match list when available (M3.1). */
    playedAt?: string;
}

export interface SideRecord {
    wins: number;
    games: number;
}

export interface TeamSideStats {
    blue: SideRecord;
    red: SideRecord;
}

export interface ProTeam {
    id: string;
    name: string;
    league: string;
    tournament?: string;
    players: ProPlayer[];
    sideStats: TeamSideStats;
    recentDrafts: RecentDraft[];
    /** Present (and `true`) only when some sub-fetch failed — its presence is the signal. */
    incomplete?: true;
    warnings: string[];
}

export interface LeagueInfo {
    id: string;
    label: string;
    /** LCK/LPL/LEC adapters are M2.5 — disabled in the UI for now. */
    enabled: boolean;
}

export const LEAGUES: readonly LeagueInfo[] = [
    { id: 'lfl', label: 'LFL', enabled: true },
    { id: 'lck', label: 'LCK', enabled: false },
    { id: 'lpl', label: 'LPL', enabled: false },
    { id: 'lec', label: 'LEC', enabled: false }
];
