/**
 * R4 — Presence aggregates over normalized draft records (ARCHITECTURE_V2
 * §5.3 fin, §6 point 5).
 *
 * Pro "presence" is the staple prep number: how often a champion shows up in
 * a draft at all (picked OR banned) over a corpus of games. All rates use the
 * *filtered game count* as denominator so entries stay comparable across
 * champions. Per §5.3 the four dimensions are independent: `side` is an
 * action-level point of view (an action belongs to the side that made it),
 * while patch / date window / game number narrow the game corpus itself.
 * Unresolved actions (`championKey === ''`) are skipped — aggregating under
 * the empty key would silently merge unrelated champions.
 */
import type { DraftRecord, DraftSide } from '$lib/data/types';

export interface PresenceFilter {
    /** Point of view: count only actions made by this side. */
    side?: DraftSide;
    /** Exact patch match (e.g. '16.11'). */
    patch?: string;
    /** Inclusive lower bound, compared on the YYYY-MM-DD prefix. */
    fromDate?: string;
    /** Inclusive upper bound, compared on the YYYY-MM-DD prefix. */
    toDate?: string;
    /** Game number within the series (Fearless conditioning, §5.3). */
    gameNumber?: number;
}

export interface PresenceEntry {
    championKey: string;
    picks: number;
    bans: number;
    /** Size of the filtered game corpus — identical on every entry. */
    games: number;
    /** (picks + bans) / games. */
    presence: number;
    /** picks / games. */
    pickRate: number;
    /** bans / games. */
    banRate: number;
    /** Games won by the picking side when this champion was picked. */
    wins: number;
}

/**
 * True when the record passes the game-level dimensions of the filter
 * (patch, date window, game number — NOT `side`, which is action-level).
 * Records missing a filtered field (no date, no series) are excluded when
 * that filter is set: we never guess a dimension.
 */
export function recordMatchesFilter(record: DraftRecord, filter: PresenceFilter = {}): boolean {
    if (filter.patch !== undefined && record.patch !== filter.patch) return false;
    if (filter.gameNumber !== undefined && record.series?.gameNumber !== filter.gameNumber) return false;
    if (filter.fromDate !== undefined || filter.toDate !== undefined) {
        if (record.date === undefined) return false;
        const day = record.date.slice(0, 10);
        if (filter.fromDate !== undefined && day < filter.fromDate.slice(0, 10)) return false;
        if (filter.toDate !== undefined && day > filter.toDate.slice(0, 10)) return false;
    }
    return true;
}

/** Per-champion presence/pick/ban rates over the filtered corpus. */
export function computePresence(
    records: DraftRecord[],
    filter: PresenceFilter = {}
): Map<string, PresenceEntry> {
    const filtered = records.filter((r) => recordMatchesFilter(r, filter));
    const games = filtered.length;
    const entries = new Map<string, PresenceEntry>();

    const entryOf = (championKey: string): PresenceEntry => {
        let entry = entries.get(championKey);
        if (entry === undefined) {
            entry = {
                championKey,
                picks: 0,
                bans: 0,
                games,
                presence: 0,
                pickRate: 0,
                banRate: 0,
                wins: 0
            };
            entries.set(championKey, entry);
        }
        return entry;
    };

    for (const record of filtered) {
        for (const action of record.actions) {
            if (action.championKey === '') continue;
            if (filter.side !== undefined && action.side !== filter.side) continue;

            const entry = entryOf(action.championKey);
            if (action.type === 'pick') {
                entry.picks += 1;
                if (record.winner === action.side) entry.wins += 1;
            } else {
                entry.bans += 1;
            }
        }
    }

    // games >= 1 whenever an entry exists (entries only come from filtered records).
    for (const entry of entries.values()) {
        entry.presence = (entry.picks + entry.bans) / games;
        entry.pickRate = entry.picks / games;
        entry.banRate = entry.bans / games;
    }

    return entries;
}
