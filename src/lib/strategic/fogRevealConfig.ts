/**
 * I2 — Fog & Reveal CONFIG (data-driven, DA-V2-6).
 *
 * Every tunable of the information-game engine lives here, NOT in
 * `fogReveal.ts`: the G4 retrospective harness (correlation fog ×
 * counter-picks actually suffered, plausibility reads on tier-1 double-flex
 * drafts) can re-fit any number in this file without touching the engine.
 * Defaults are behaviour defaults, NOT calibrated values (DA-V2-11: the
 * engine ships behind an experimental badge until G4 validates them).
 *
 * Scale conventions: probabilities and equities are win-probability units
 * (0..1, UI displays ×100 in pp); ambiguity/entropy is in bits.
 */

export interface FogRevealConfig {
    /**
     * Hypotheses whose NORMALIZED probability falls below this floor are
     * dropped (then the survivors are renormalized): a 1-in-200 role-map is
     * noise to a coach and a wasted call to the injected best-response
     * evaluator. 0 = keep every consistent hypothesis.
     */
    minHypothesisP: number;
    /**
     * Hard cap on the number of hypotheses returned (kept by p descending,
     * survivors renormalized). Bounds the downstream evaluator work: each
     * hypothesis costs one best-response evaluation in prod. 120 = 5! — the
     * exhaustive worst case — so the default never trims.
     */
    maxHypotheses: number;
    /**
     * Bait verdict threshold: ev at or above this (win-probability units,
     * 0.01 = 1 pp) reads as a profitable bait — leaving the champion open
     * pays on average.
     */
    baitGoodEv: number;
    /**
     * Bait verdict threshold: ev at or below this reads as a trap AGAINST us
     * — leaving the champion open loses equity in expectation (ban or take).
     */
    baitTrapEv: number;
    /**
     * Option value retained when they do NOT take the open champion, used
     * when the bait context provides none. 0 = conservative: passing keeps
     * nothing measurable (the Aumann–Maschler option value of unrevealed
     * prep is a series-level quantity the I4 solver will inject).
     */
    defaultOptionValue: number;
}

export const DEFAULT_FOG_REVEAL_CONFIG: FogRevealConfig = {
    minHypothesisP: 0,
    maxHypotheses: 120,
    baitGoodEv: 0.01,
    baitTrapEv: -0.01,
    defaultOptionValue: 0
};
