/**
 * I5 — Annotated-review tunables (ARCHITECTURE_V2 §6 bis I5; prior-art §A4).
 *
 * Conventions imported from the genre references (Lichess computer analysis,
 * GTO Wizard Hand History Analyzer): decisions are graded in WIN-PROBABILITY
 * space — percentage points of win chance, never raw eval — with deliberately
 * WIDE bands (?! / ? / ?? at ≈ −1 / −2 / −3 pp): our evaluator is a noisy
 * oracle, not a Stockfish, so confidence bands are the honesty condition.
 * Near-equal choices produce NO nag at all, and "better was X" only appears
 * above its own confidence threshold.
 *
 * Every threshold below is a behaviour default to be calibrated by the R9
 * harness (DA-V2-6: tunables live in an injectable exported config, never
 * hardcoded in the logic).
 */

/** Grade thresholds on the EV loss, in win-probability percentage points. */
export interface AnnotatorGradeThresholdsPp {
    /** Loss at or above this is at least an inaccuracy '?!'. */
    inaccuracy: number;
    /** Loss at or above this is at least a mistake '?'. */
    mistake: number;
    /** Loss at or above this is a blunder '??'. */
    blunder: number;
}

export interface AnnotatorConfig {
    /** Lichess-style wide bands (≈ −1/−2/−3 pp), R9-calibratable. */
    gradesPp: AnnotatorGradeThresholdsPp;
    /**
     * Below this best-vs-chosen gap (pp) the choices are near-equal: the
     * annotation is suppressed — no grade, no "better was" (informational
     * notes still show; they report facts, not EV nags).
     */
    suppressionGapPp: number;
    /** "Better was X" appears only when the recoverable gain clears this (pp). */
    betterWasMinGainPp: number;
    /** Top-k window when checking a pick against the injected range model. */
    rangeTopK: number;
    /** Minimum injected reveal cost (pp) before the early-reveal note fires. */
    earlyRevealMinPp: number;
}

export const DEFAULT_ANNOTATOR_CONFIG: AnnotatorConfig = {
    gradesPp: { inaccuracy: 1, mistake: 2, blunder: 3 },
    suppressionGapPp: 1,
    betterWasMinGainPp: 1,
    rangeTopK: 8,
    earlyRevealMinPp: 0.5
};
