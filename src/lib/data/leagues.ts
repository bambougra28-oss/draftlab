/**
 * R1 / STEP_UP #10 — Config-driven league registry (2026 landscape).
 *
 * The format mutates yearly (LTA dissolved; LCS and CBLOL returned as separate
 * leagues in 2026), so league knowledge lives in data, not code. Each entry
 * carries the hints providers need: the Leaguepedia OverviewPage prefix and
 * the gol.gg display name fragment.
 */
export type LeagueTier = 'tier1' | 'erl' | 'international';

export interface LeagueDefinition {
    id: string;
    label: string;
    tier: LeagueTier;
    /** Leaguepedia OverviewPage prefix, e.g. "LCK/2026". `{year}` is replaced. */
    leaguepediaPrefix?: string;
    /** Substring gol.gg uses in tournament names, e.g. "LCK 2026". */
    golggNameHint?: string;
    enabled: boolean;
}

export const LEAGUE_REGISTRY: readonly LeagueDefinition[] = [
    { id: 'lck', label: 'LCK', tier: 'tier1', leaguepediaPrefix: 'LCK/{year}', golggNameHint: 'LCK {year}', enabled: true },
    { id: 'lpl', label: 'LPL', tier: 'tier1', leaguepediaPrefix: 'LPL/{year}', golggNameHint: 'LPL {year}', enabled: true },
    { id: 'lec', label: 'LEC', tier: 'tier1', leaguepediaPrefix: 'LEC/{year}', golggNameHint: 'LEC {year}', enabled: true },
    { id: 'lcs', label: 'LCS', tier: 'tier1', leaguepediaPrefix: 'LCS/{year}', golggNameHint: 'LCS {year}', enabled: true },
    { id: 'cblol', label: 'CBLOL', tier: 'tier1', leaguepediaPrefix: 'CBLOL/{year}', golggNameHint: 'CBLOL {year}', enabled: true },
    { id: 'lcp', label: 'LCP', tier: 'tier1', leaguepediaPrefix: 'LCP/{year}', golggNameHint: 'LCP {year}', enabled: true },
    { id: 'lfl', label: 'LFL', tier: 'erl', leaguepediaPrefix: 'LFL/{year}', golggNameHint: 'LFL {year}', enabled: true },
    { id: 'first-stand', label: 'First Stand', tier: 'international', leaguepediaPrefix: 'First Stand/{year}', golggNameHint: 'First Stand {year}', enabled: true },
    { id: 'msi', label: 'MSI', tier: 'international', leaguepediaPrefix: 'MSI/{year}', golggNameHint: 'MSI {year}', enabled: true },
    { id: 'worlds', label: 'Worlds', tier: 'international', leaguepediaPrefix: 'Worlds/{year}', golggNameHint: 'Worlds {year}', enabled: true }
] as const;

export function leagueById(id: string): LeagueDefinition | undefined {
    return LEAGUE_REGISTRY.find((l) => l.id === id);
}

/** Resolve the Leaguepedia OverviewPage prefix for a league and year. */
export function leaguepediaPrefix(id: string, year: number): string | undefined {
    return leagueById(id)?.leaguepediaPrefix?.replace('{year}', String(year));
}
