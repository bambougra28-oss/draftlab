/**
 * Chantiers E / E3 — Product-side application of the Platt win calibration
 * (run #2 pooled, run #3 PER LEAGUE; doctrine §6.8, DA-V2-6 injectable
 * config, DA-V2-11 badge).
 *
 * The v1 measurement (scripts/backtest/winCalibration.ts, rule CONSUMED) fit
 * one pooled (a, b) per sequence position; the v2 measurement
 * (scripts/backtest/winCalibrationByLeague.ts, chantier E3) fits one card
 * PER LEAGUE (lck/lec/lfl/lpl) × position, all in BLUE space (p_raw =
 * P(blue win) of analyzeDraft with blue as ally). This module owns the
 * product-side mappings:
 *
 *  - `positionOf` — the frozen partition by locked picks: 0 → afterBans;
 *    1..6 → after3Picks; 7..10 → fullDraft. As soon as any pick information
 *    exists, the afterBans map (degenerate side-only) no longer applies.
 *    No interpolation between anchors — declared application approximation.
 *
 *  - `leagueCardOf` — the UNIQUE card resolution (UI badges and estimator,
 *    never two fallback semantics). v1 config → the pooled card, leagueId
 *    IGNORED (backward compatibility). v2 config → the league's card, or
 *    null (passthrough) for a league without a card — NEVER the pooled v2
 *    `positions` field, which is provenance only (validated:false forced by
 *    construction: no pooled verdict exists in run E3; fallback FROZEN, D3).
 *
 *  - `calibrateAllyWin` — the mandatory BLUE-space round trip. `a` captures
 *    the blue-side bias, so applying (a, b) directly to a red-perspective
 *    probability would INVERT the side bonus (σ(a + b·logit(1−p)) ≠
 *    1 − σ(a + b·logit(p)) whenever a ≠ 0) — all the more visible in v2,
 *    where the per-league `a` grows (LCK side bias). A position whose params
 *    are absent or not validated passes the raw value through (badge stays
 *    « Non calibré »). b > 0 (enforced by `validated` at the final fit)
 *    makes the map strictly increasing in p_raw, so the RANKING of
 *    candidates evaluated at the same position is invariant.
 *
 * Pure module: the bundled `data/calibration/winCalibration.json` (v1 until
 * THE E3 run overwrites it in version 2 — same import mechanism as
 * data/championTags.json) is plain data; the clock (`generatedAt`) is
 * injected by the script.
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

/** v2 — the measured card of one league. */
export interface LeagueCalibration {
    /** Eligible games of the league's final fit (badge « Calibré sur N games (LCK) »). */
    nGames: number;
    fittedThroughPatch?: string;
    positions: Record<CalibrationPosition, PositionParams | null>;
}

export interface WinCalibrationConfig {
    version: 1 | 2;
    /** Injected by the script — never a clock read here. */
    generatedAt: string;
    corpora: string[];
    /** v1: eligible games of the pooled final fit; v2: total eligible (descriptive). */
    nGames: number;
    fittedThroughPatch?: string;
    dataset?: { version: string; date: string; sha256Current?: string; sha256Full?: string };
    /** Bootstrap seed of the run that produced the file (provenance). */
    seed?: number;
    /** v1: the applied pooled card; v2: pooled full-fit PROVENANCE, validated:false forced. */
    positions: Record<CalibrationPosition, PositionParams | null>;
    /** v2 only. Keys = measured LEAGUE_REGISTRY ids (lck, lec, lfl, lpl). */
    leagues?: Record<string, LeagueCalibration>;
}

/** v2 — resolved card (the UNIQUE object consumed by calibrateAllyWin AND the UI badges). */
export interface ResolvedCalibrationCard {
    nGames: number;
    fittedThroughPatch?: string;
    positions: Record<CalibrationPosition, PositionParams | null>;
}

/**
 * UNIQUE card resolution (no duplication of the fallback semantics):
 *   config null                      → null (passthrough)
 *   version 1                        → { nGames: config.nGames, fittedThroughPatch:
 *                                        config.fittedThroughPatch, positions:
 *                                        config.positions } (v1 semantics, leagueId IGNORED)
 *   version 2, leagueId with a card  → config.leagues[leagueId] (the LEAGUE's nGames
 *                                      and fittedThroughPatch)
 *   version 2, otherwise             → null (passthrough — FROZEN fallback, never
 *                                      config.positions)
 */
export function leagueCardOf(
    config: WinCalibrationConfig | null,
    leagueId?: string
): ResolvedCalibrationCard | null {
    if (config === null) return null;
    if (config.version === 1) {
        return {
            nGames: config.nGames,
            fittedThroughPatch: config.fittedThroughPatch,
            positions: config.positions
        };
    }
    if (leagueId === undefined) return null;
    return config.leagues?.[leagueId] ?? null;
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
 * The card comes from `leagueCardOf(config, leagueId)` — the UNIQUE
 * resolution: a v1 config keeps the v1 semantics (leagueId ignored), a v2
 * config resolves the league's card or falls back to passthrough.
 * Non-validated position, league without a card or null config ⇒ passthrough
 * { pAlly: pAllyRaw, calibrated: false }. `nGames` of the result = the
 * RESOLVED card's (so the league's, in v2).
 */
export function calibrateAllyWin(
    pAllyRaw: number,
    allySide: DraftSide,
    picksLocked: number,
    config: WinCalibrationConfig | null = defaultWinCalibrationConfig(),
    leagueId?: string
): CalibratedWin {
    const position = positionOf(picksLocked);
    const card = leagueCardOf(config, leagueId);
    if (card === null) return { pAlly: pAllyRaw, calibrated: false, position };
    const params = card.positions[position];
    if (params === null || params === undefined || !params.validated) {
        return { pAlly: pAllyRaw, calibrated: false, position };
    }
    const pBlue = allySide === 'blue' ? pAllyRaw : 1 - pAllyRaw;
    const pBlueCal = plattApply({ a: params.a, b: params.b }, pBlue);
    const pAlly = allySide === 'blue' ? pBlueCal : 1 - pBlueCal;
    return { pAlly, calibrated: true, position, nGames: card.nGames };
}
