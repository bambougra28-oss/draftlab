/**
 * Bayesian smoothing primitives for the M1 engine.
 *
 * A champion's observed {wins, games} sample is blended toward a prior winrate
 * using `priorGames` pseudo-games. With a thin sample the result sits near the
 * prior; as real games accumulate the sample dominates. This damps small-sample
 * noise — the core of M1's calibration (see ATTRIBUTION.md).
 */
import type { Stats } from '$lib/types';

/** Sum any number of {wins, games} tallies. */
export function addStats(...stats: Stats[]): Stats {
    let wins = 0;
    let games = 0;
    for (const s of stats) {
        wins += s.wins;
        games += s.games;
    }
    return { wins, games };
}

export function multiplyStats(s: Stats, factor: number): Stats {
    return { wins: s.wins * factor, games: s.games * factor };
}

export function divideStats(s: Stats, divisor: number): Stats {
    return { wins: s.wins / divisor, games: s.games / divisor };
}

/** Element-wise average of several tallies. */
export function averageStats(...stats: Stats[]): Stats {
    return divideStats(addStats(...stats), stats.length);
}

/**
 * Blend `sample` toward `priorWinrate` with `priorGames` pseudo-games.
 * Equivalent to a Beta-prior posterior mean expressed in the wins/games domain.
 */
export function withPrior(sample: Stats, priorGames: number, priorWinrate: number): Stats {
    return addStats(sample, { wins: priorGames * priorWinrate, games: priorGames });
}

/** Winrate of a tally, with a neutral 0.5 fallback for an empty sample. */
export function winrateOf(s: Stats): number {
    return s.games === 0 ? 0.5 : s.wins / s.games;
}
