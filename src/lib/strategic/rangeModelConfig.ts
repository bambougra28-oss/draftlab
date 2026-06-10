/**
 * I1 — Range model CONFIG (data-driven, DA-V2-6).
 *
 * Every tunable of the enemy-range model lives here, NOT in the engine: the
 * log-linear weights w_t/w_p/w_m/w_s/w_n (ARCHITECTURE_V2 §6 bis I1), the
 * smoothing floor under logged factors, the restricted-choice decay applied
 * per pass-over, the "close group" display factor (the poker-solver "white
 * for close calls" convention) and the surprise-alarm thresholds. Defaults
 * are behaviour defaults, NOT calibrated values: the R4 harness re-fits them
 * against the log loss of the next real pick without touching
 * `rangeModel.ts` (porte G2).
 */
import type { PoolTier } from '$lib/strategic/poolTierClassifier';

/** Log-linear term weights: score(c) = Σ w·term (§6 bis I1 formula). */
export interface RangeModelWeights {
    /** w_t — on ln(smoothed tendency p): the backbone term. */
    tendency: number;
    /** w_p — on ln(pool weight of the probable role holder). */
    pool: number;
    /** w_m — on ln(patch presence). */
    meta: number;
    /** w_s — LINEAR on the plan-coherence score (the formula's only un-logged term). */
    coherence: number;
    /** w_n — on ln(negativeDecayPerPass^passCount): restricted-choice term. */
    negative: number;
}

export interface RangeModelConfig {
    weights: RangeModelWeights;
    /**
     * Floor under every logged factor — keeps ln() finite when a factor is 0
     * (champion absent from the meta map, unseen pool…) and is also the
     * probability floor of `surpriseOf` bits. ε = 1e-3 ≈ "once in a thousand
     * drafts": below the resolution of any corpus we will ever hold.
     */
    epsilon: number;
    /**
     * Restricted-choice odds decay per comparable pass-over (bridge's
     * restricted choice / poker's capped ranges, prior-art §A1/A3): with
     * w_n = 1, each time the team left the champion available at a slot where
     * their tendencies wanted it, its unnormalized odds are multiplied by
     * this factor. Uncalibrated default — the harness learns the real drop.
     */
    negativeDecayPerPass: number;
    /**
     * closeGroup ⇔ p ≥ factor·p(top): entries inside this band are "too close
     * to call" and the UI renders them white instead of colored (no false
     * precision between near-equal candidates).
     */
    closeGroupFactor: number;
    /**
     * Pool weight by readiness tier (M5.3) of the deepest enemy player on
     * the champion. Ratios matter, not absolutes (the softmax renormalizes):
     * strongest is the reference at 1.
     */
    poolTierWeights: Record<PoolTier, number>;
    /** Pool weight when NO enemy player has the champion in pool at all. */
    poolUnseenWeight: number;
    /**
     * Coherence attenuation when their partial comp reads ambiguous (M4.2
     * flag): an unclear plan is weak evidence of what fits it.
     */
    coherenceAmbiguousFactor: number;
    /**
     * Minimum tendency p for a pass-over to be informative
     * (`collectPassedOver`): passing on a champion the team plays 1 game in
     * 20 says nothing; passing on a real priority does.
     */
    passedOverMinP: number;
    /** k of the surprise inRange check — the Summit Gate pick-in-range@8. */
    surpriseK: number;
    /**
     * Alarm when the actual pick carried at least this many bits of
     * self-information (−log2 p). 5 bits ⇔ p < 1/32 ≈ 3%: the live signal to
     * re-read the draft (tendance cassée, §9 risk d).
     */
    surpriseAlarmBits: number;
}

export const DEFAULT_RANGE_MODEL_CONFIG: RangeModelConfig = {
    // Tendency is the backbone (w=1); pool/meta/coherence damped below 1
    // until the harness calibrates them; negative at 1 so the decay factor
    // reads directly as an odds multiplier.
    weights: { tendency: 1, pool: 0.5, meta: 0.3, coherence: 0.4, negative: 1 },
    epsilon: 1e-3,
    negativeDecayPerPass: 0.6,
    closeGroupFactor: 0.8,
    poolTierWeights: { strongest: 1, 'match-ready': 0.7, 'scrim-ready': 0.4, learning: 0.15 },
    poolUnseenWeight: 0.05,
    coherenceAmbiguousFactor: 0.5,
    passedOverMinP: 0.2,
    surpriseK: 8,
    surpriseAlarmBits: 5
};
