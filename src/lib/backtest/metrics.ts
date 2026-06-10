/**
 * R3/R9 — Backtest metrics: the scoring vocabulary of the validation harness
 * (DA-V2-9; ARCHITECTURE_V2 §6.4, §8 R3/R9; methodology report §6).
 *
 * Doctrine: at the 55-58% draft-only accuracy ceiling, calibration IS the
 * product — so the primary metrics are log loss, Brier and reliability bins,
 * never accuracy alone. Nothing is claimed without an interval: Wilson 95%
 * for rates, bootstrap percentile CIs for metric deltas vs a baseline.
 * `banHitAtK` / `pickInRangeAtK` are the Summit Gate retrieval scores
 * (ban-hit@5, pick-in-range@8).
 *
 * Everything is pure. The bootstrap takes an INJECTED rng (project rule:
 * randomness is always a parameter) — `mulberry32(seed)` is provided so every
 * published CI is reproducible from its seed.
 */

/** One scored prediction: forecast probability + observed outcome. */
export interface PredictionPair {
    /** Predicted probability of the modelled outcome, in [0, 1]. */
    p: number;
    /** Whether the outcome actually happened. */
    won: boolean;
}

/** A two-sided interval (Wilson bound, bootstrap CI, …). */
export interface Interval {
    lo: number;
    hi: number;
}

/**
 * Clamp predictions away from hard 0/1 before taking logs. A model emitting
 * exactly 0 or 1 is a bug, but the harness degrades to a huge-yet-finite
 * penalty (−ln 1e-15 ≈ 34.5) instead of poisoning the mean with Infinity.
 */
const LOG_EPS = 1e-15;

const clampProb = (p: number): number => Math.min(1 - LOG_EPS, Math.max(LOG_EPS, p));

/** Mean negative log-likelihood. Lower is better; 0.5/0.5 scores ln 2 ≈ 0.6931. */
export function logLoss(pairs: PredictionPair[]): number {
    if (pairs.length === 0) return NaN;
    let sum = 0;
    for (const { p, won } of pairs) {
        const q = clampProb(p);
        sum += won ? -Math.log(q) : -Math.log(1 - q);
    }
    return sum / pairs.length;
}

/** Mean squared error of the probability. Lower is better; 0.5/0.5 scores 0.25. */
export function brier(pairs: PredictionPair[]): number {
    if (pairs.length === 0) return NaN;
    let sum = 0;
    for (const { p, won } of pairs) {
        const error = p - (won ? 1 : 0);
        sum += error * error;
    }
    return sum / pairs.length;
}

/**
 * Share of correct hard calls at the 0.5 threshold. A prediction of exactly
 * 0.5 earns half a point, so the mandatory p=0.5 baseline scores exactly 0.5
 * regardless of the corpus win rate (a coin flip is right half the time).
 */
export function accuracy(pairs: PredictionPair[]): number {
    if (pairs.length === 0) return NaN;
    let credit = 0;
    for (const { p, won } of pairs) {
        if (p === 0.5) credit += 0.5;
        else if (p > 0.5 === won) credit += 1;
    }
    return credit / pairs.length;
}

/** Conventional 95% two-sided normal quantile. */
const Z95 = 1.96;

/**
 * Wilson score interval at 95% for a binomial rate. Behaves at small n and
 * extreme rates where the naive ±1.96·SE interval collapses or escapes [0, 1].
 * n = 0 returns the no-information interval [0, 1].
 */
export function wilson95(successes: number, n: number): Interval {
    if (n === 0) return { lo: 0, hi: 1 };
    const z2 = Z95 * Z95;
    const phat = successes / n;
    const denom = 1 + z2 / n;
    const center = phat + z2 / (2 * n);
    const margin = Z95 * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n));
    return { lo: (center - margin) / denom, hi: (center + margin) / denom };
}

/** One cell of a reliability diagram (forecast bucket vs observed frequency). */
export interface ReliabilityBin {
    /** Inclusive lower edge of the probability bucket. */
    lo: number;
    /** Exclusive upper edge (inclusive for the last bin, so p = 1 lands there). */
    hi: number;
    /** Number of predictions in the bucket. */
    n: number;
    /** Mean forecast probability in the bucket (NaN when empty). */
    meanP: number;
    /** Observed win rate in the bucket (NaN when empty). */
    actualRate: number;
    /** meanP − actualRate: positive = overconfident forecasts (NaN when empty). */
    gap: number;
}

/**
 * Equal-width reliability bins over [0, 1]. All `bins` cells are returned —
 * including empty ones (n = 0, NaN stats) — so diagrams across patches keep a
 * fixed shape and are comparable cell by cell.
 */
export function reliabilityBins(pairs: PredictionPair[], bins = 10): ReliabilityBin[] {
    const count = new Array<number>(bins).fill(0);
    const sumP = new Array<number>(bins).fill(0);
    const sumWon = new Array<number>(bins).fill(0);

    for (const { p, won } of pairs) {
        const idx = Math.min(bins - 1, Math.max(0, Math.floor(p * bins)));
        count[idx] += 1;
        sumP[idx] += p;
        if (won) sumWon[idx] += 1;
    }

    return count.map((n, i) => {
        const meanP = n > 0 ? sumP[i] / n : NaN;
        const actualRate = n > 0 ? sumWon[i] / n : NaN;
        return { lo: i / bins, hi: (i + 1) / bins, n, meanP, actualRate, gap: meanP - actualRate };
    });
}

/**
 * Summit Gate ban-hit@k: how many of the top-k suggested bans were actually
 * banned (either team, order-insensitive). Duplicate suggestions are counted
 * once so the score stays in [0, k] and cannot be gamed by repetition.
 */
export function banHitAtK(suggestedKeys: string[], actualBans: string[], k: number): number {
    const actual = new Set(actualBans);
    const seen = new Set<string>();
    let hits = 0;
    for (const key of suggestedKeys.slice(0, Math.max(0, k))) {
        if (seen.has(key)) continue;
        seen.add(key);
        if (actual.has(key)) hits += 1;
    }
    return hits;
}

/**
 * Summit Gate pick-in-range@k: was the actual pick inside the top-k of the
 * (probability-ordered) predicted range? `rangeKeys` must already be sorted
 * by descending predicted probability.
 */
export function pickInRangeAtK(rangeKeys: string[], actualPick: string, k: number): boolean {
    return rangeKeys.slice(0, Math.max(0, k)).includes(actualPick);
}

/**
 * mulberry32 — the standard tiny seedable PRNG (public-domain bit mixer by
 * Tommy Ettinger). Returns a uniform [0, 1) generator fully determined by its
 * 32-bit seed: the reproducibility backbone of every published bootstrap CI.
 */
export function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export interface BootstrapOptions {
    /** Number of bootstrap resamples (default 1000). */
    iterations?: number;
    /** Uniform [0, 1) source — REQUIRED and injectable, e.g. mulberry32(seed). */
    rng: () => number;
}

export interface BootstrapDelta {
    /** metric(pairsA) − metric(pairsB) on the full samples. */
    delta: number;
    /** Percentile (2.5%, 97.5%) interval of the resampled deltas. */
    ci95: Interval;
}

/** Draw one bootstrap resample (with replacement, same size). */
function resample(pairs: PredictionPair[], rng: () => number): PredictionPair[] {
    const out: PredictionPair[] = [];
    for (let i = 0; i < pairs.length; i++) {
        out.push(pairs[Math.floor(rng() * pairs.length)]);
    }
    return out;
}

/** Type-7 (linear interpolation) quantile of an ascending-sorted array. */
function quantileSorted(sorted: number[], q: number): number {
    if (sorted.length === 0) return NaN;
    const h = (sorted.length - 1) * q;
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

/**
 * Bootstrap CI of a metric difference between two prediction sets — the
 * mandatory honesty layer before claiming any "improvement" (methodology §6:
 * a season is only ~300-900 predictions, deltas live inside the noise).
 *
 * When A and B have the same length they are treated as PAIRED (the usual
 * model-vs-baseline case on one shared test set): each iteration resamples
 * game indices once and applies them to both sides, which cancels shared
 * game-level variance. Different lengths fall back to independent resampling.
 */
export function bootstrapDeltaCI(
    pairsA: PredictionPair[],
    pairsB: PredictionPair[],
    metric: (pairs: PredictionPair[]) => number,
    options: BootstrapOptions
): BootstrapDelta {
    const iterations = Math.max(1, options.iterations ?? 1000);
    const rng = options.rng;
    const paired = pairsA.length === pairsB.length;
    const deltas: number[] = [];

    for (let i = 0; i < iterations; i++) {
        if (paired) {
            const a: PredictionPair[] = [];
            const b: PredictionPair[] = [];
            for (let j = 0; j < pairsA.length; j++) {
                const idx = Math.floor(rng() * pairsA.length);
                a.push(pairsA[idx]);
                b.push(pairsB[idx]);
            }
            deltas.push(metric(a) - metric(b));
        } else {
            deltas.push(metric(resample(pairsA, rng)) - metric(resample(pairsB, rng)));
        }
    }

    deltas.sort((x, y) => x - y);
    return {
        delta: metric(pairsA) - metric(pairsB),
        ci95: { lo: quantileSorted(deltas, 0.025), hi: quantileSorted(deltas, 0.975) }
    };
}
