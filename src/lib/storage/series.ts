/**
 * M7 — Series state + Fearless consumption tracking.
 *
 * A Series holds the per-game draft state of a Bo1/Bo3/Bo5. In Fearless mode a
 * champion picked in an earlier game can't be picked again by either team, so
 * `consumedAlly` / `consumedEnemy` track each side's used picks and
 * `availableChampions` filters them out. Pure helpers (no IndexedDB) so the
 * logic is unit-testable; CRUD persists to the `series` store.
 */
import { idbDelete, idbGet, idbGetAll, idbPut } from './idb';

export type SeriesFormat = 'bo1' | 'bo3' | 'bo5';
export type SeriesMode = 'standard' | 'fearless';
export type GameWinner = 'ally' | 'enemy' | null;

export interface SeriesGame {
    gameNumber: number;
    allySide?: 'blue' | 'red';
    allyPicks: string[];
    enemyPicks: string[];
    allyBans: string[];
    enemyBans: string[];
    result: GameWinner;
    planId?: string;
}

export interface Series {
    id: string;
    name: string;
    format: SeriesFormat;
    mode: SeriesMode;
    allyTeam: string;
    enemyTeam: string;
    games: SeriesGame[];
    consumedAlly: string[];
    consumedEnemy: string[];
    createdAt: number;
    updatedAt: number;
}

export interface SeriesInput {
    name: string;
    format: SeriesFormat;
    mode: SeriesMode;
    allyTeam: string;
    enemyTeam: string;
}

const STORE = 'series' as const;

const uniq = (keys: string[]): string[] => [...new Set(keys.filter((k) => k !== ''))];

export function emptyGame(gameNumber: number): SeriesGame {
    return { gameNumber, allyPicks: [], enemyPicks: [], allyBans: [], enemyBans: [], result: null };
}

export function createSeries(input: SeriesInput): Series {
    const now = Date.now();
    return {
        id: crypto.randomUUID(),
        name: input.name,
        format: input.format,
        mode: input.mode,
        allyTeam: input.allyTeam,
        enemyTeam: input.enemyTeam,
        games: [],
        consumedAlly: [],
        consumedEnemy: [],
        createdAt: now,
        updatedAt: now
    };
}

/** Recompute each side's consumed (picked) champions across all games. */
export function recomputeConsumed(series: Series): Series {
    return {
        ...series,
        consumedAlly: uniq(series.games.flatMap((g) => g.allyPicks)),
        consumedEnemy: uniq(series.games.flatMap((g) => g.enemyPicks))
    };
}

/** Add or replace a game by its number, keeping games ordered, then recompute. */
export function upsertGame(series: Series, game: SeriesGame): Series {
    const games = series.games.filter((g) => g.gameNumber !== game.gameNumber);
    games.push(game);
    games.sort((a, b) => a.gameNumber - b.gameNumber);
    return recomputeConsumed({ ...series, games, updatedAt: Date.now() });
}

export function removeGame(series: Series, gameNumber: number): Series {
    const games = series.games.filter((g) => g.gameNumber !== gameNumber);
    return recomputeConsumed({ ...series, games, updatedAt: Date.now() });
}

export function consumedChampions(series: Series): { ally: string[]; enemy: string[]; all: string[] } {
    return {
        ally: series.consumedAlly,
        enemy: series.consumedEnemy,
        all: uniq([...series.consumedAlly, ...series.consumedEnemy])
    };
}

/**
 * Champion keys still pickable. In Fearless, everything used by either side is
 * locked out; in standard play nothing carries over between games.
 */
export function availableChampions(series: Series, allChampionKeys: string[]): string[] {
    if (series.mode !== 'fearless') return [...allChampionKeys];
    const locked = new Set([...series.consumedAlly, ...series.consumedEnemy]);
    return allChampionKeys.filter((key) => !locked.has(key));
}

// ---- persistence ----

export async function saveSeries(series: Series): Promise<Series> {
    const updated: Series = { ...series, updatedAt: Date.now() };
    await idbPut(STORE, updated);
    return updated;
}

export function getSeries(id: string): Promise<Series | undefined> {
    return idbGet<Series>(STORE, id);
}

export function listSeries(): Promise<Series[]> {
    return idbGetAll<Series>(STORE);
}

export function deleteSeries(id: string): Promise<undefined> {
    return idbDelete(STORE, id);
}
