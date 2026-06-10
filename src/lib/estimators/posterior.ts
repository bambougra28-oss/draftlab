/**
 * Universal empirical-Bayes shrinkage estimator (doctrine §6.1, DA-V2-5).
 *
 * Every count statistic DraftLab shows must be a Beta posterior, never a raw
 * frequency (research 2026-06_methodologie_draft §1.2). This module is the
 * single source for that arithmetic:
 *
 *   - `shrinkWinrate` — posterior Beta(wins + N0·μ, losses + N0·(1−μ)) for a
 *     {wins, games} sample shrunk toward prior mean μ with N0 pseudo-games;
 *   - `fitBetaPriorMoments` — method-of-moments prior fit on a population of
 *     samples (α+β = μ(1−μ)/σ² − 1, Robinson's empirical-Bayes recipe);
 *   - `betaCdf` / `betaQuantile` — regularized incomplete beta function
 *     I_x(a,b) by continued fraction (modified Lentz, the Numerical Recipes
 *     `betacf`/`betai` scheme) and its inverse by bisection. Quantiles drive
 *     the ci95 field and the posterior-quantile tiers of doctrine §6.9.
 *
 * Pure functions, no dependencies, no clock — fully deterministic.
 */

/** A Beta posterior over a winrate, ready for UI display (DA-V2-4). */
export interface BetaPosterior {
    /** Posterior alpha = wins + priorN·priorMean (pseudo-wins included). */
    alpha: number;
    /** Posterior beta = losses + priorN·(1 − priorMean). */
    beta: number;
    /** Posterior mean alpha / (alpha + beta) — the number to display. */
    mean: number;
    /** Observed real games (sample-size badge); pseudo-evidence is alpha+beta. */
    n: number;
    /** Central 95% credible interval [2.5% quantile, 97.5% quantile]. */
    ci95: [number, number];
}

/** Prior fitted on a population of samples, to feed `shrinkWinrate`. */
export interface BetaPriorFit {
    /** Prior mean μ (population mean of winrates), clamped to [0.01, 0.99]. */
    mean: number;
    /** Prior strength N0 = α+β in pseudo-games, clamped to [1, 1000]. */
    priorN: number;
}

// ---------------------------------------------------------------------------
// Regularized incomplete beta function I_x(a, b)
// ---------------------------------------------------------------------------

/** Continued-fraction convergence threshold (double precision). */
const CF_EPS = 1e-15;
/** Guard against division by ~0 inside Lentz's recurrence. */
const CF_FPMIN = 1e-300;
/** Iteration cap — Lentz converges in tens of steps for realistic (a, b). */
const CF_MAX_ITER = 500;

/**
 * Natural log of the Gamma function for x > 0.
 * Lanczos approximation (Numerical Recipes `gammln`, 6 coefficients),
 * |relative error| < 2e-10 — far below the test tolerances used downstream.
 */
function lnGamma(x: number): number {
    const cof = [
        76.18009172947146, -86.50532032941678, 24.01409824083091,
        -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
    ];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) {
        y += 1;
        ser += cof[j] / y;
    }
    // The leading Lanczos constant is exactly √(2π).
    return -tmp + Math.log((Math.sqrt(2 * Math.PI) * ser) / x);
}

/**
 * Continued fraction for I_x(a, b), evaluated by the modified Lentz method
 * (Numerical Recipes `betacf`). Only valid for x < (a+1)/(a+b+2); the caller
 * uses the symmetry I_x(a,b) = 1 − I_{1−x}(b,a) outside that region.
 */
function betaContinuedFraction(a: number, b: number, x: number): number {
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < CF_FPMIN) d = CF_FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= CF_MAX_ITER; m++) {
        const m2 = 2 * m;
        // Even step of the recurrence.
        let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < CF_FPMIN) d = CF_FPMIN;
        c = 1 + aa / c;
        if (Math.abs(c) < CF_FPMIN) c = CF_FPMIN;
        d = 1 / d;
        h *= d * c;
        // Odd step.
        aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < CF_FPMIN) d = CF_FPMIN;
        c = 1 + aa / c;
        if (Math.abs(c) < CF_FPMIN) c = CF_FPMIN;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < CF_EPS) break;
    }
    return h;
}

/**
 * CDF of Beta(alpha, beta) at x — the regularized incomplete beta I_x(α, β).
 * x outside [0, 1] saturates to 0/1 (CDF semantics, not an error).
 */
export function betaCdf(x: number, alpha: number, beta: number): number {
    if (!(alpha > 0) || !(beta > 0)) {
        throw new RangeError(`betaCdf: alpha and beta must be > 0 (got ${alpha}, ${beta})`);
    }
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const lnFront =
        lnGamma(alpha + beta) - lnGamma(alpha) - lnGamma(beta) +
        alpha * Math.log(x) + beta * Math.log(1 - x);
    const front = Math.exp(lnFront);
    // Use the continued fraction directly where it converges fast, the
    // symmetry transform elsewhere (standard `betai` dispatch).
    if (x < (alpha + 1) / (alpha + beta + 2)) {
        return (front * betaContinuedFraction(alpha, beta, x)) / alpha;
    }
    return 1 - (front * betaContinuedFraction(beta, alpha, 1 - x)) / beta;
}

/**
 * Quantile (inverse CDF) of Beta(alpha, beta) by bisection on `betaCdf`.
 * 100 halvings shrink the bracket below 1e-13 — exhaustively below any UI or
 * test tolerance; the CDF is strictly increasing on (0, 1) so bisection is
 * globally convergent with no seed heuristics.
 */
export function betaQuantile(p: number, alpha: number, beta: number): number {
    if (!(alpha > 0) || !(beta > 0)) {
        throw new RangeError(`betaQuantile: alpha and beta must be > 0 (got ${alpha}, ${beta})`);
    }
    if (!(p >= 0 && p <= 1)) {
        throw new RangeError(`betaQuantile: p must be in [0, 1] (got ${p})`);
    }
    if (p === 0) return 0;
    if (p === 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 100 && hi - lo > 1e-13; i++) {
        const mid = (lo + hi) / 2;
        if (betaCdf(mid, alpha, beta) < p) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Shrinkage
// ---------------------------------------------------------------------------

/**
 * Shrink an observed {wins, games} sample toward `priorMean` with `priorN`
 * pseudo-games of trust. Posterior: Beta(wins + N0·μ, losses + N0·(1−μ)).
 * `priorMean` must lie strictly inside (0, 1) so the posterior stays proper
 * even on an empty sample (`fitBetaPriorMoments` guarantees this by clamping).
 */
export function shrinkWinrate(
    wins: number,
    games: number,
    priorMean: number,
    priorN: number
): BetaPosterior {
    if (!(wins >= 0) || !(games >= 0) || wins > games) {
        throw new RangeError(`shrinkWinrate: need 0 <= wins <= games (got ${wins}/${games})`);
    }
    if (!(priorN > 0)) {
        throw new RangeError(`shrinkWinrate: priorN must be > 0 (got ${priorN})`);
    }
    if (!(priorMean > 0 && priorMean < 1)) {
        throw new RangeError(`shrinkWinrate: priorMean must be in (0, 1) (got ${priorMean})`);
    }
    const alpha = wins + priorN * priorMean;
    const beta = games - wins + priorN * (1 - priorMean);
    return {
        alpha,
        beta,
        mean: alpha / (alpha + beta),
        n: games,
        ci95: [betaQuantile(0.025, alpha, beta), betaQuantile(0.975, alpha, beta)]
    };
}

// ---------------------------------------------------------------------------
// Method-of-moments prior fit
// ---------------------------------------------------------------------------

/**
 * Fallback prior strength when the moments cannot be fitted: 20 pseudo-games,
 * inside both doctrine bands (N0 ≈ 10–50 for pro signals, ARCHITECTURE_V2
 * §6.2; "~10–30" in research §1.3).
 */
export const FALLBACK_PRIOR_N = 20;
/** priorN clamp floor — over-dispersed populations get minimal pooling. */
const MIN_PRIOR_N = 1;
/** priorN clamp ceiling — beyond this, shrinkage is total at our sample sizes. */
const MAX_PRIOR_N = 1000;
/** Fitted mean clamp keeping the prior a proper (non-degenerate) Beta. */
const MEAN_CLAMP = 0.01;
/** Variance below this is numerically zero (identical winrates). */
const ZERO_VARIANCE = 1e-9;

/**
 * Fit a Beta prior on a population of {wins, games} samples by method of
 * moments: with μ and σ² the unweighted mean and (n−1)-denominator variance
 * of per-sample winrates, α+β = μ(1−μ)/σ² − 1 and the prior mean is μ
 * (research §1.2). Caller should pass reasonably stabilized samples — raw
 * winrates of 1-game samples inflate σ² with binomial noise.
 *
 * Documented guard rails:
 *   - samples with games = 0 are ignored (winrate undefined);
 *   - fewer than 3 usable samples → fallback {pooled mean, FALLBACK_PRIOR_N}
 *     (pooled = total wins / total games; 0.5 when there are no games at all);
 *   - σ² ≈ 0 (all winrates identical) → α+β diverges → priorN = MAX_PRIOR_N;
 *   - σ² ≥ μ(1−μ) (over-dispersed beyond what any Beta explains) → the
 *     formula gives α+β ≤ 0 → priorN = MIN_PRIOR_N;
 *   - the returned mean is clamped to [0.01, 0.99] so it always composes with
 *     `shrinkWinrate` (degenerate all-win/all-loss populations included).
 */
export function fitBetaPriorMoments(samples: { wins: number; games: number }[]): BetaPriorFit {
    const usable = samples.filter((s) => s.games > 0);
    const clampMean = (m: number): number => Math.min(1 - MEAN_CLAMP, Math.max(MEAN_CLAMP, m));

    if (usable.length < 3) {
        let wins = 0;
        let games = 0;
        for (const s of usable) {
            wins += s.wins;
            games += s.games;
        }
        const pooled = games > 0 ? wins / games : 0.5;
        return { mean: clampMean(pooled), priorN: FALLBACK_PRIOR_N };
    }

    const rates = usable.map((s) => s.wins / s.games);
    const mu = rates.reduce((acc, r) => acc + r, 0) / rates.length;
    const variance =
        rates.reduce((acc, r) => acc + (r - mu) * (r - mu), 0) / (rates.length - 1);
    const mean = clampMean(mu);

    if (variance < ZERO_VARIANCE) {
        return { mean, priorN: MAX_PRIOR_N };
    }
    const priorN = (mean * (1 - mean)) / variance - 1;
    return { mean, priorN: Math.min(MAX_PRIOR_N, Math.max(MIN_PRIOR_N, priorN)) };
}
