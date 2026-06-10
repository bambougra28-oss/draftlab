/**
 * R1 — Cross-source normalization helpers.
 *
 * Champion names resolve through the M2 ChampionLookup (dual name/slug index);
 * role strings tolerate every rendering seen across Leaguepedia, Oracle's
 * Elixir and gol.gg. Team names get a loose canonical form for cross-source
 * matching (the divergence detector keys on it).
 */
import { Role } from '$lib/types';
import { defaultLookup } from '$lib/pro/championLookup';

/** Resolve a champion display name/slug to its Data Dragon key. */
export function resolveChampionKey(name: string): string | undefined {
    return defaultLookup().lookup(name);
}

const ROLE_STRINGS: Record<string, Role> = {
    top: Role.Top,
    toplane: Role.Top,
    jungle: Role.Jungle,
    jgl: Role.Jungle,
    jng: Role.Jungle,
    jun: Role.Jungle,
    mid: Role.Middle,
    middle: Role.Middle,
    midlane: Role.Middle,
    bot: Role.Bottom,
    bottom: Role.Bottom,
    adc: Role.Bottom,
    'ad carry': Role.Bottom,
    botlane: Role.Bottom,
    support: Role.Support,
    sup: Role.Support,
    supp: Role.Support
};

/** Parse a source role string into the Role enum; undefined when unknown. */
export function parseRoleString(value: string | undefined): Role | undefined {
    if (value === undefined) return undefined;
    return ROLE_STRINGS[value.trim().toLowerCase()];
}

/**
 * Loose canonical team name for cross-source matching: lowercase, strip
 * punctuation/whitespace ("Gen.G" / "GenG" / "gen g" → "geng").
 */
export function canonicalTeamName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Day component of an ISO datetime ("2026-04-22 08:15:00" → "2026-04-22"). */
export function isoDay(value: string | undefined): string | undefined {
    if (value === undefined) return undefined;
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : undefined;
}

/** "2026-04-22 08:15:00" (Cargo UTC) → "2026-04-22T08:15:00Z"; passthrough otherwise. */
export function cargoDateTimeToIso(value: string | undefined): string | undefined {
    if (value === undefined || value.trim() === '') return undefined;
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
    return m ? `${m[1]}T${m[2]}Z` : value.trim();
}
