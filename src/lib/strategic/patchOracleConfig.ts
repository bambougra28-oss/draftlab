/**
 * I6 — Patch Oracle CONFIG (data-driven, DA-V2-6).
 *
 * Every tunable of the patch oracle lives here, NOT in `patchOracle.ts`: the
 * G6 backtest (walk-forward of the response curves over past patches, watchlist
 * hit rate vs base rate) re-fits any number in this file without touching the
 * engine. Defaults are behaviour defaults, NOT calibrated values (DA-V2-11:
 * the engine ships behind an experimental badge until porte G6 validates it).
 *
 * Scale conventions: presence deltas are percentage points (pp); prior
 * inflation speaks the estimators' language (N0 pseudo-games, $lib/estimators
 * doctrine N0 ≈ 10-50 for pro signals).
 */
import type { PocketPickRisk } from '$lib/strategic/pocketPickRiskAssessor';
import type { PatchChangeMagnitude } from '$lib/strategic/patchOracle';

/**
 * Uncertainty-inflation directive for the priors of a changed champion —
 * a CONSIGNE consumed by the estimators layer ($lib/estimators), not applied
 * here: divide the champion's prior strength N0 by `factor` and cap the
 * effective N0 at `targetN` pseudo-games until post-patch evidence
 * accumulates. The oracle only publishes the directive (§6 bis I6 point a:
 * state-space uncertainty inflation); wiring it into the cascade is the
 * estimators' future work, documented in `patchOracle.ts`.
 */
export interface PriorInflationDirective {
    /** Divisor on the prior strength N0 (>1 = weaker prior = wider posterior). */
    factor: number;
    /** Ceiling on the effective N0 after inflation, in pseudo-games. */
    targetN: number;
}

export interface PatchOracleConfig {
    /**
     * How many patches AFTER a change the response is measured on (offset
     * 1 = first patch played with the change). §6 bis I6: « la presence pro
     * monte en moyenne de Z pp sous 2 patchs » — hence 2.
     */
    horizonPatches: number;
    /**
     * Curve points built on fewer (change × offset) samples than this are
     * flagged `lowConfidence` — the wilson95 interval is published either
     * way, the flag is the UI's "thin evidence" signal.
     */
    minSamplesPerPoint: number;
    /**
     * Magnitude ordering weight: watchlist ties (equal |expected delta|)
     * break on the bigger magnitude first; also the deterministic curve
     * ordering inside a kind.
     */
    magnitudeRank: Record<PatchChangeMagnitude, number>;
    /** Prior-inflation directive per magnitude (see PriorInflationDirective). */
    inflationByMagnitude: Record<PatchChangeMagnitude, PriorInflationDirective>;
    /**
     * Curve offset published as the briefing's expected delta (1 = the next
     * patch to be played — what the coach preps for).
     */
    briefingOffset: number;
    /**
     * Minimum assessed pocket-pick risk (M5.4 assessor) for the pocket
     * signal to surface as a watchlist reason. Below the gate the signal is
     * silent — the oracle never invents a soloq read from thin air.
     */
    pocketRiskMinimum: PocketPickRisk;
}

export const DEFAULT_PATCH_ORACLE_CONFIG: PatchOracleConfig = {
    horizonPatches: 2,
    minSamplesPerPoint: 5,
    magnitudeRank: { minor: 1, moderate: 2, major: 3 },
    // Bigger change ⇒ weaker prior: a major rework can invalidate a whole
    // season of evidence (N0 capped at 5 ≈ "almost start over"), a minor
    // number tweak only loosens it. Uncalibrated defaults (porte G6).
    inflationByMagnitude: {
        minor: { factor: 1.5, targetN: 30 },
        moderate: { factor: 2.5, targetN: 15 },
        major: { factor: 4, targetN: 5 }
    },
    briefingOffset: 1,
    pocketRiskMinimum: 'medium'
};
