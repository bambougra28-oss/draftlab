/**
 * Comp-level duration affinity — the G1 hypothesis after champion-level
 * curves measured at chance (postdiction 2026-06-10): if a game-length
 * signal exists, it lives in COMPOSITION INTERACTIONS, not in per-champion
 * sums. The unit is the same-team trait-pair cell of `tagPairs`, split by
 * game duration:
 *
 *   differential(cell) = P(win | cell active, LONG game)
 *                      − P(win | cell active, SHORT game)
 *
 * LONG/SHORT = above/below the median length of the FITTING records (games
 * exactly at the median are excluded, mirroring the postdiction rule). Each
 * half is EB-shrunk toward the cell's own pooled winrate, so the
 * differential carries pure timing signal: a cell that is simply strong
 * (wins both halves) reads ≈ 0.
 *
 * A comp's late affinity is the weighted mean of the differentials of every
 * cell its champion pairs activate. The weight is the differential's
 * information content, nL·nS/(nL+nS) (inverse-variance under equal
 * per-observation noise) — NOT total games, which would let huge flat cells
 * (ad+melee…) wash out the signal.
 *
 * Like every estimator here: pure, injectable tags, no clock, no I/O.
 */
import { shrinkWinrate } from './posterior';
import { cellKey, traitsOf } from './tagPairs';
import type { DraftRecord, DraftSide } from '$lib/data/types';
import type { ChampionTagsFile } from '$lib/tags/types';
import { loadDefaultTags } from '$lib/tags';

export interface DurationCell {
    key: string;
    longWins: number;
    longGames: number;
    shortWins: number;
    shortGames: number;
    /** Cell pooled winrate, add-half smoothed (the shrink target of both halves). */
    pooled: number;
    /** Shrunk P(win|long) − shrunk P(win|short). */
    differential: number;
    /** nL·nS/(nL+nS) — the differential's information weight. */
    weight: number;
}

export interface CompDurationFit {
    cells: Map<string, DurationCell>;
    /** Median length (seconds) of the fitting records — the long/short split. */
    medianSeconds: number;
    /** Pair observations pooled over both halves. */
    pairObservations: number;
    priorN: number;
}

export interface FitCompDurationOptions {
    tagsFile?: ChampionTagsFile;
    /** EB pseudo-games per duration half (pre-registered default: 200). */
    priorN?: number;
}

export const DEFAULT_COMP_DURATION_PRIOR_N = 200;

/**
 * Fit duration-split trait-pair cells on every decided record carrying a
 * duration. Pair/cell conventions mirror `fitTagPairCells` exactly (one
 * observation per cell per champion pair, both sides tallied).
 */
export function fitCompDurationCells(
    records: DraftRecord[],
    options: FitCompDurationOptions = {}
): CompDurationFit {
    const tagsFile = options.tagsFile ?? loadDefaultTags();
    const priorN = options.priorN ?? DEFAULT_COMP_DURATION_PRIOR_N;

    const usable = records.filter(
        (r): r is DraftRecord & { gameLengthSeconds: number } =>
            r.winner !== undefined && r.gameLengthSeconds !== undefined
    );
    const lengths = usable.map((r) => r.gameLengthSeconds).sort((a, b) => a - b);
    const medianSeconds =
        lengths.length === 0
            ? 0
            : lengths.length % 2 === 1
              ? lengths[(lengths.length - 1) / 2]
              : (lengths[lengths.length / 2 - 1] + lengths[lengths.length / 2]) / 2;

    const tally = new Map<string, { longWins: number; longGames: number; shortWins: number; shortGames: number }>();
    let pairObservations = 0;

    for (const record of usable) {
        if (record.gameLengthSeconds === medianSeconds) continue; // mirror the scoring rule
        const isLong = record.gameLengthSeconds > medianSeconds;
        for (const side of ['blue', 'red'] as const satisfies readonly DraftSide[]) {
            const picks = record.actions.filter(
                (a) => a.type === 'pick' && a.side === side && a.championKey !== ''
            );
            const won = record.winner === side;
            for (let i = 0; i < picks.length; i++) {
                for (let j = i + 1; j < picks.length; j++) {
                    const tagA = tagsFile.champions[picks[i].championKey];
                    const tagB = tagsFile.champions[picks[j].championKey];
                    if (tagA === undefined || tagB === undefined) continue;
                    pairObservations++;
                    const traitsA = traitsOf(tagA);
                    const traitsB = traitsOf(tagB);
                    const seen = new Set<string>();
                    for (const a of traitsA) {
                        for (const b of traitsB) {
                            const key = cellKey(a, b);
                            if (seen.has(key)) continue; // one observation per cell per pair
                            seen.add(key);
                            const cell =
                                tally.get(key) ?? { longWins: 0, longGames: 0, shortWins: 0, shortGames: 0 };
                            if (isLong) {
                                cell.longGames++;
                                if (won) cell.longWins++;
                            } else {
                                cell.shortGames++;
                                if (won) cell.shortWins++;
                            }
                            tally.set(key, cell);
                        }
                    }
                }
            }
        }
    }

    const cells = new Map<string, DurationCell>();
    for (const [key, t] of tally) {
        const totalGames = t.longGames + t.shortGames;
        // Add-half smoothing: a perfect 0/1 cell would be an invalid shrink
        // target (and a dishonest one — no profile truly never wins).
        const pooled = (t.longWins + t.shortWins + 0.5) / (totalGames + 1);
        const long = shrinkWinrate(t.longWins, t.longGames, pooled, priorN).mean;
        const short = shrinkWinrate(t.shortWins, t.shortGames, pooled, priorN).mean;
        const weight =
            t.longGames + t.shortGames === 0 ? 0 : (t.longGames * t.shortGames) / (t.longGames + t.shortGames);
        cells.set(key, {
            key,
            longWins: t.longWins,
            longGames: t.longGames,
            shortWins: t.shortWins,
            shortGames: t.shortGames,
            pooled,
            differential: long - short,
            weight
        });
    }

    return { cells, medianSeconds, pairObservations, priorN };
}

export interface CompAffinity {
    /** Information-weighted mean differential over the activated cells; >0 ⇒ long games favor this comp. */
    affinity: number;
    /** Distinct cell activations (cells × activating pairs). */
    activations: number;
    /** Σ of the information weights behind the affinity. */
    evidence: number;
}

/**
 * Late-game affinity of a comp: every champion pair activates its cells
 * (same dedup as the fit), each activation contributes the cell differential
 * at the cell's information weight.
 */
export function compLateAffinity(
    compKeys: string[],
    fit: CompDurationFit,
    tagsFile: ChampionTagsFile = loadDefaultTags()
): CompAffinity {
    let weighted = 0;
    let evidence = 0;
    let activations = 0;
    for (let i = 0; i < compKeys.length; i++) {
        for (let j = i + 1; j < compKeys.length; j++) {
            const tagA = tagsFile.champions[compKeys[i]];
            const tagB = tagsFile.champions[compKeys[j]];
            if (tagA === undefined || tagB === undefined) continue;
            const seen = new Set<string>();
            for (const a of traitsOf(tagA)) {
                for (const b of traitsOf(tagB)) {
                    const key = cellKey(a, b);
                    if (seen.has(key)) continue;
                    seen.add(key);
                    const cell = fit.cells.get(key);
                    if (cell === undefined || cell.weight === 0) continue;
                    activations++;
                    weighted += cell.differential * cell.weight;
                    evidence += cell.weight;
                }
            }
        }
    }
    return { affinity: evidence === 0 ? 0 : weighted / evidence, activations, evidence };
}
