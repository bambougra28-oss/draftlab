import { describe, it, expect } from 'vitest';
import {
    calibrateAllyWin,
    defaultWinCalibrationConfig,
    positionOf,
    type WinCalibrationConfig
} from '$lib/estimators/winCalibration';
import { plattApply } from '$lib/estimators/platt';

/** A config whose after3Picks and fullDraft are validated at (a=0.2, b=0.7). */
const validated = (): WinCalibrationConfig => ({
    version: 1,
    generatedAt: '2026-06-11T00:00:00.000Z',
    corpora: ['synthétique'],
    nGames: 123,
    positions: {
        afterBans: null,
        after3Picks: { a: 0.2, b: 0.7, nTrain: 123, validated: true },
        fullDraft: { a: 0.2, b: 0.7, nTrain: 123, validated: true }
    }
});

describe('winCalibration — positionOf (frozen partition)', () => {
    it('routes the locked-pick counts to their anchors at the bounds', () => {
        expect(positionOf(0)).toBe('afterBans');
        expect(positionOf(1)).toBe('after3Picks');
        expect(positionOf(6)).toBe('after3Picks');
        expect(positionOf(7)).toBe('fullDraft');
        expect(positionOf(10)).toBe('fullDraft');
    });
});

describe('winCalibration — calibrateAllyWin', () => {
    it('round-trips through BLUE space for a red ally (hand value)', () => {
        // (a=0.2, b=0.7), ally red, pAllyRaw = 0.6 ⇒ pBlue = 0.4,
        // logit(0.4) = ln(2/3) ≈ −0.405465, 0.2 + 0.7·logit = −0.083826,
        // σ(−0.083826) ≈ 0.479056 ⇒ pAlly = 1 − 0.479056 ≈ 0.520944.
        const out = calibrateAllyWin(0.6, 'red', 10, validated());
        expect(out.pAlly).toBeCloseTo(0.520944, 6);
        expect(out.calibrated).toBe(true);
        expect(out.position).toBe('fullDraft');
        expect(out.nGames).toBe(123);
        // Naive ally-space application would give σ(0.2 + 0.7·logit(0.6))
        // = σ(0.483826) ≈ 0.618651 — the side bias INVERTED. Guard the gap.
        expect(out.pAlly).not.toBeCloseTo(plattApply({ a: 0.2, b: 0.7 }, 0.6), 2);
    });

    it('is plattApply directly for a blue ally (identity of the round trip)', () => {
        const out = calibrateAllyWin(0.6, 'blue', 10, validated());
        expect(out.pAlly).toBeCloseTo(plattApply({ a: 0.2, b: 0.7 }, 0.6), 12);
        // Hand value: σ(0.2 + 0.7·ln(1.5)) = σ(0.483826) ≈ 0.618651.
        expect(out.pAlly).toBeCloseTo(0.618651, 6);
    });

    it('routes picksLocked = 3 to the after3Picks params', () => {
        const out = calibrateAllyWin(0.6, 'blue', 3, validated());
        expect(out.position).toBe('after3Picks');
        expect(out.calibrated).toBe(true);
    });

    it('passes through on a null config', () => {
        const out = calibrateAllyWin(0.6, 'red', 10, null);
        expect(out).toEqual({ pAlly: 0.6, calibrated: false, position: 'fullDraft' });
    });

    it('passes through on the SHIPPED default config (run E rouge: validated:false everywhere)', () => {
        // The committed artifact is whatever the LAST run wrote (rule: always
        // written, never hand-edited). Run E (2026-06-11) shipped real fits
        // with validated:false on all three positions — the UI must never
        // apply them. The contract pinned here: no position is applicable,
        // so the default config passes raw values through.
        const positions = defaultWinCalibrationConfig().positions;
        for (const position of Object.values(positions)) {
            if (position !== null) expect(position.validated).toBe(false);
        }
        const out = calibrateAllyWin(0.55, 'blue', 8);
        expect(out.pAlly).toBe(0.55);
        expect(out.calibrated).toBe(false);
        expect(out.nGames).toBeUndefined();
    });

    it('passes through on validated:false params (red verdict ships, never applies)', () => {
        const config = validated();
        config.positions.fullDraft = { a: 0.2, b: 0.7, nTrain: 123, validated: false };
        const out = calibrateAllyWin(0.6, 'blue', 10, config);
        expect(out.pAlly).toBe(0.6);
        expect(out.calibrated).toBe(false);
    });

    it('preserves the ranking of raw values when b > 0 (both sides)', () => {
        const config = validated();
        const blue = [0.3, 0.5, 0.7].map((p) => calibrateAllyWin(p, 'blue', 10, config).pAlly);
        expect(blue[0]).toBeLessThan(blue[1]);
        expect(blue[1]).toBeLessThan(blue[2]);
        const red = [0.3, 0.5, 0.7].map((p) => calibrateAllyWin(p, 'red', 10, config).pAlly);
        expect(red[0]).toBeLessThan(red[1]);
        expect(red[1]).toBeLessThan(red[2]);
    });
});
