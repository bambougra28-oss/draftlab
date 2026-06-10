/**
 * I4 — Series Solver CONFIG (data-driven, DA-V2-6).
 *
 * Every tunable weight, threshold and edge of the Fearless series solver
 * lives here, NOT in `seriesSolver.ts`: the R9 calibration harness (rejeu of
 * real 2025-2026 fearless Bo5s) can re-fit any number in this file without
 * touching the engine. All probability-like values are expressed in win
 * probability units (0..1); UI surfaces display them ×100 in pp.
 *
 * Scale conventions:
 * - `gameWin` edges feed `p = clamp(0.5 + qualityEdge + depthEdge)`; quality
 *   is a mean of per-role Beta-posterior winrates (doctrine §6.1, pro prior
 *   strength N0 ≈ 10-50 — never the 1000-game soloq priors);
 * - `firstSelection` edges are the 2026-rule branch bonuses the FS holder
 *   buys by choosing its preferred side OR first pick — calibration targets,
 *   not truths (side > pick reflects the historical stage side bias).
 */

export interface SeriesGameWinConfig {
    /** Prior mean for pool-entry winrate shrinkage (EB, doctrine §6.1). */
    priorMean: number;
    /** Prior strength N0 in pseudo-games — pro scale (10-50), not soloq 1000. */
    priorN: number;
    /** Win-probability points per unit of best-remaining quality edge. */
    qualityWeight: number;
    /** Win-probability points per unit of remaining pool-depth edge. */
    depthWeight: number;
    /** Champions per role at which extra depth stops paying (ratio cap). */
    depthCap: number;
    /** Quality assigned to a role with NO remaining champion (near-forfeit). */
    emptyRoleQuality: number;
    /** Per-game win-probability clamp (a draft is never a coin with one face). */
    pMin: number;
    pMax: number;
}

export interface FirstSelectionConfig {
    /** Edge bought by the FS holder choosing its preferred SIDE. */
    sideEdge: number;
    /** Edge bought by the FS holder choosing FIRST PICK. */
    pickEdge: number;
}

export interface PoolIntegrityConfig {
    /** Monte-Carlo samples (deterministic given the injected rng). */
    samples: number;
    /** A role with fewer remaining champions than this is flagged. */
    minPoolPerRole: number;
    /** Seed of the default mulberry32 rng (callers should inject their own). */
    defaultSeed: number;
}

export interface MustWinConfig {
    /**
     * Punt advice threshold: when the MEAN retention net of our top assets is
     * below −threshold (saving clearly beats spending) and the game is not a
     * must-win, the analysis recommends preserving the pool.
     */
    puntNetThreshold: number;
    /** Top assets per role examined in the spend-vs-save table. */
    assetsPerRole: number;
}

export interface SeriesSolverConfig {
    gameWin: SeriesGameWinConfig;
    firstSelection: FirstSelectionConfig;
    integrity: PoolIntegrityConfig;
    mustWin: MustWinConfig;
}

export const DEFAULT_SERIES_SOLVER_CONFIG: SeriesSolverConfig = {
    gameWin: {
        priorMean: 0.5,
        priorN: 10,
        qualityWeight: 1,
        depthWeight: 0.05,
        depthCap: 3,
        emptyRoleQuality: 0.25,
        pMin: 0.05,
        pMax: 0.95
    },
    firstSelection: { sideEdge: 0.025, pickEdge: 0.015 },
    integrity: { samples: 500, minPoolPerRole: 2, defaultSeed: 1 },
    mustWin: { puntNetThreshold: 0.01, assetsPerRole: 1 }
};
