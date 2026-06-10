/**
 * Platt scaling — two-parameter probability calibration (doctrine §6.8,
 * research 2026-06_methodologie_draft §6).
 *
 * Model: p_cal = σ(a + b·logit(p_raw)). Two parameters fit on a few hundred
 * walk-forward predictions (isotonic needs thousands and overfits at our n).
 * The intended use is one (a, b) per draft phase ("après bans", "après 3
 * picks", "draft complète"), refit per patch window — this module only owns
 * the numeric fit; phase bucketing belongs to the backtest harness.
 *
 * Fit: Newton descent on the log loss. Gradient and Hessian of
 * L(a,b) = −Σ [y·ln q + (1−y)·ln(1−q)], q = σ(a + b·z), z = logit(p):
 *   ∂L/∂a = Σ (q−y)        H = [ Σ w     Σ w·z  ]   with w = q(1−q)
 *   ∂L/∂b = Σ (q−y)·z          [ Σ w·z   Σ w·z² ]
 * A tiny ridge on the Hessian diagonal keeps the step well-defined when b is
 * unidentifiable (all z equal, e.g. every p = 0.5) — it conditions the step
 * only, not the optimum, since convergence still drives the gradient to 0.
 */

/** Fitted calibration parameters: p_cal = σ(a + b·logit(p_raw)). */
export interface PlattParams {
    a: number;
    b: number;
}

/** One walk-forward prediction with its realized outcome. */
export interface PlattPair {
    /** Raw model probability in [0, 1] (clamped to (eps, 1−eps) internally). */
    p: number;
    won: boolean;
}

/** Probability clamp — keeps logit and log loss finite at p = 0 or 1. */
const EPS_P = 1e-6;
/** Newton iteration budget (~50 per spec; quadratic convergence needs <10). */
const MAX_ITER = 50;
/** Levenberg-style diagonal ridge guarding singular Hessians. */
const RIDGE = 1e-6;
/** Early stop once the Newton step is numerically immobile. */
const STEP_TOL = 1e-10;

const clampP = (p: number): number => Math.min(1 - EPS_P, Math.max(EPS_P, p));

const logit = (p: number): number => {
    const q = clampP(p);
    return Math.log(q / (1 - q));
};

/** Numerically stable logistic function. */
const sigmoid = (x: number): number => {
    if (x >= 0) return 1 / (1 + Math.exp(-x));
    const e = Math.exp(x);
    return e / (1 + e);
};

/**
 * Fit (a, b) by Newton descent on the log loss, from the identity init
 * (a = 0, b = 1). Perfectly calibrated data stays at the identity; b < 1
 * shrinks over-confident predictions toward 0.5; b > 1 stretches
 * under-confident ones; a absorbs a global bias. On separable data the
 * iteration budget acts as the implicit regularizer (params stay finite).
 */
export function plattFit(pairs: PlattPair[]): PlattParams {
    if (pairs.length === 0) {
        throw new RangeError('plattFit: pairs must be non-empty');
    }
    const z = pairs.map((pair) => logit(pair.p));
    const y = pairs.map((pair) => (pair.won ? 1 : 0));

    let a = 0;
    let b = 1;
    for (let iter = 0; iter < MAX_ITER; iter++) {
        let ga = 0;
        let gb = 0;
        let haa = RIDGE;
        let hab = 0;
        let hbb = RIDGE;
        for (let i = 0; i < z.length; i++) {
            const q = sigmoid(a + b * z[i]);
            const r = q - y[i];
            const w = q * (1 - q);
            ga += r;
            gb += r * z[i];
            haa += w;
            hab += w * z[i];
            hbb += w * z[i] * z[i];
        }
        const det = haa * hbb - hab * hab;
        if (!Number.isFinite(det) || det <= 0) break;
        // Newton step: [da, db] = H⁻¹ · g (closed-form 2×2 solve).
        const da = (hbb * ga - hab * gb) / det;
        const db = (haa * gb - hab * ga) / det;
        a -= da;
        b -= db;
        if (Math.abs(da) < STEP_TOL && Math.abs(db) < STEP_TOL) break;
    }
    return { a, b };
}

/** Apply fitted calibration: σ(a + b·logit(p)), with the same input clamp. */
export function plattApply(params: PlattParams, p: number): number {
    return sigmoid(params.a + params.b * logit(p));
}

/**
 * Mean negative log likelihood of predictions vs outcomes — the calibration
 * metric of the backtest harness (doctrine §6.4); lower is better.
 */
export function meanLogLoss(pairs: PlattPair[]): number {
    if (pairs.length === 0) {
        throw new RangeError('meanLogLoss: pairs must be non-empty');
    }
    let total = 0;
    for (const pair of pairs) {
        const q = clampP(pair.p);
        total += pair.won ? -Math.log(q) : -Math.log(1 - q);
    }
    return total / pairs.length;
}
