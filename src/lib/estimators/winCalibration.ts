/**
 * Chantier E — Product-side application of the Platt win calibration
 * (run #2; doctrine §6.8, DA-V2-6 injectable config, DA-V2-11 badge).
 *
 * The measurement (scripts/backtest/winCalibration.ts) fits one (a, b) per
 * sequence position in BLUE space (p_raw = P(blue win) of analyzeDraft with
 * blue as ally). This module owns the two product-side mappings:
 *
 *  - `positionOf` — the frozen partition by locked picks: 0 → afterBans;
 *    1..6 → after3Picks; 7..10 → fullDraft. As soon as any pick information
 *    exists, the afterBans map (degenerate side-only) no longer applies.
 *    No interpolation between anchors — declared application approximation.
 *
 *  - `calibrateAllyWin` — the mandatory BLUE-space round trip. `a` captures
 *    the blue-side bias, so applying (a, b) directly to a red-perspective
 *    probability would INVERT the side bonus (σ(a + b·logit(1−p)) ≠
 *    1 − σ(a + b·logit(p)) whenever a ≠ 0). A position whose params are
 *    absent or not validated passes the raw value through (badge stays
 *    « Non calibré »). b > 0 (enforced by `validated` at the final fit)
 *    makes the map strictly increasing in p_raw, so the RANKING of
 *    candidates evaluated at the same position is invariant.
 *
 * Pure module: the bundled `data/calibration/winCalibration.json` (placeholder
 * until THE run overwrites it — same import mechanism as data/championTags.json)
 * is plain data; the clock (`generatedAt`) is injected by the script.
 */
import rawConfig from '../../../data/calibration/winCalibration.json';
import { plattApply } from './platt';
import type { DraftSide } from '$lib/data/types';

export type CalibrationPosition = 'afterBans' | 'after3Picks' | 'fullDraft';

/** One position's shipped fit. `validated` = (walk-forward GREEN) ∧ (b > 0). */
export interface PositionParams {
    a: number;
    b: number;
    nTrain: number;
    validated: boolean;
}

export interface WinCalibrationConfig {
    version: 1;
    /** Injected by the script — never a clock read here. */
    generatedAt: string;
    corpora: string[];
    /** Eligible games of the final fit (the « Calibré sur N games » badge). */
    nGames: number;
    fittedThroughPatch?: string;
    dataset?: { version: string; date: string; sha256Current?: string; sha256Full?: string };
    /** Bootstrap seed of the run that produced the file (provenance). */
    seed?: number;
    positions: Record<CalibrationPosition, PositionParams | null>;
}

/** The bundled config (placeholder, then overwritten by THE run — DA-V2-6). */
export function defaultWinCalibrationConfig(): WinCalibrationConfig {
    return rawConfig as unknown as WinCalibrationConfig;
}

/**
 * Frozen partition by locked picks: 0 → afterBans; 1..6 → after3Picks;
 * 7..10 → fullDraft (as soon as any pick information exists, the afterBans
 * map — degenerate side-only — no longer applies).
 */
export function positionOf(picksLocked: number): CalibrationPosition {
    if (picksLocked <= 0) return 'afterBans';
    if (picksLocked <= 6) return 'after3Picks';
    return 'fullDraft';
}

export interface CalibratedWin {
    /** The value to DISPLAY (ally perspective). */
    pAlly: number;
    /** true iff params are present AND validated for the position. */
    calibrated: boolean;
    position: CalibrationPosition;
    /** For the « Calibré sur N games » badge (present iff calibrated). */
    nGames?: number;
}

/**
 * Apply the position's calibration in BLUE space (`a` is blue-anchored):
 *   pBlue    = allySide === 'blue' ? pAllyRaw : 1 − pAllyRaw
 *   pBlueCal = plattApply({a, b}, pBlue)            // σ(a + b·logit(pBlue))
 *   pAlly    = allySide === 'blue' ? pBlueCal : 1 − pBlueCal
 * Non-validated position or null config ⇒ passthrough
 * { pAlly: pAllyRaw, calibrated: false }.
 */
export function calibrateAllyWin(
    pAllyRaw: number,
    allySide: DraftSide,
    picksLocked: number,
    config: WinCalibrationConfig | null = defaultWinCalibrationConfig()
): CalibratedWin {
    const position = positionOf(picksLocked);
    if (config === null) return { pAlly: pAllyRaw, calibrated: false, position };
    const params = config.positions[position];
    if (params === null || params === undefined || !params.validated) {
        return { pAlly: pAllyRaw, calibrated: false, position };
    }
    const pBlue = allySide === 'blue' ? pAllyRaw : 1 - pAllyRaw;
    const pBlueCal = plattApply({ a: params.a, b: params.b }, pBlue);
    const pAlly = allySide === 'blue' ? pBlueCal : 1 - pBlueCal;
    return { pAlly, calibrated: true, position, nGames: config.nGames };
}
