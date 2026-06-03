/**
 * Shared domain types for DraftLab.
 *
 * The dataset shape mirrors DraftGap's public dataset format (see
 * ATTRIBUTION.md) so the analyzer can consume the upstream
 * `bucket.draftgap.com` feed unchanged.
 */

/** Champion role encoding — matches DraftGap and the upstream dataset keys. */
export enum Role {
    Top = 0,
    Jungle = 1,
    Middle = 2,
    Bottom = 3,
    Support = 4
}

/** All roles in canonical order. */
export const ROLES: readonly Role[] = [Role.Top, Role.Jungle, Role.Middle, Role.Bottom, Role.Support];

/** A win/games tally — the atom of every rating computation. */
export interface Stats {
    wins: number;
    games: number;
}

export interface ChampionDamageProfile {
    magic: number;
    physical: number;
    true: number;
}

/** Per-(champion, role) stats, including pairwise matchup/synergy maps. */
export interface ChampionRoleData {
    games: number;
    wins: number;
    /** matchup[enemyRole][enemyChampionKey] → stats vs that enemy. */
    matchup: Record<Role, Record<string, Stats>>;
    /** synergy[allyRole][allyChampionKey] → stats paired with that ally. */
    synergy: Record<Role, Record<string, Stats>>;
    damageProfile: ChampionDamageProfile;
    /**
     * Winrate-by-game-length buckets. The upstream feed observed during M1/M4
     * exposed 5 buckets (boundaries 25/30/35/40 min); the M4.3 power-curve
     * calculator maps them early=[0] / mid=[1,2] / late=[3,4].
     *
     * NOTE (step-up): DraftGap's current code seeds 7 buckets. If the live
     * feed switched to 7, the M4.3 mapping needs revisiting — see docs/STEP_UP.md.
     */
    statsByTime: Stats[];
}

export interface ChampionData {
    /** Numeric Data Dragon key, as a string (e.g. "157" = Yasuo). */
    key: string;
    name: string;
    statsByRole: Record<Role, ChampionRoleData>;
}

export interface Dataset {
    version: string;
    date: string;
    championData: Record<string, ChampionData>;
}

/** Risk levels, ordered from most to least sample trust. */
export const RISK_LEVELS = ['very-low', 'low', 'medium', 'high', 'very-high'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/**
 * Bayesian prior strength (pseudo-games) per risk level. Values inherited from
 * DraftGap's solo-queue calibration (ATTRIBUTION.md). Re-tuning for pro context
 * is a tracked step-up: pro samples are 100–1000× smaller and coordinated, so
 * the right priors likely differ (see docs/STEP_UP.md / BACKLOG.md).
 */
export const PRIOR_GAMES_BY_RISK: Record<RiskLevel, number> = {
    'very-low': 3000,
    low: 2000,
    medium: 1000,
    high: 500,
    'very-high': 250
};

/** A team is a map of role → champion key. */
export type Team = Map<Role, string>;

export interface AnalyzeDraftConfig {
    /** When true, skip the solo-champion pass (matchup/duo only). */
    ignoreChampionWinrates: boolean;
    riskLevel: RiskLevel;
    /** UI-side threshold: results below this game count are de-emphasised. */
    minGames: number;
}

/** Build an empty per-role data record (all five roles present). */
export function defaultChampionRoleData(): ChampionRoleData {
    const emptyByRole = (): Record<Role, Record<string, Stats>> => ({
        [Role.Top]: {},
        [Role.Jungle]: {},
        [Role.Middle]: {},
        [Role.Bottom]: {},
        [Role.Support]: {}
    });
    return {
        games: 0,
        wins: 0,
        matchup: emptyByRole(),
        synergy: emptyByRole(),
        damageProfile: { magic: 0, physical: 0, true: 0 },
        statsByTime: Array.from({ length: 5 }, () => ({ wins: 0, games: 0 }))
    };
}
