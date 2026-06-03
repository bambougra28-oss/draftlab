import { describe, it, expect } from 'vitest';
import { buildMockDataset } from '$lib/dataset/mock';
import { Role, type Stats } from '$lib/types';
import {
    calculatePowerCurve,
    calculateLanePowerCurves,
    dominantBucket,
    POWER_BUCKETS
} from '$lib/strategic/powerCurveCalculator';

const s = (wins: number, games: number): Stats => ({ wins, games });
const timeline = (e: Stats, m1: Stats, m2: Stats, l1: Stats, l2: Stats): Stats[] => [e, m1, m2, l1, l2];

describe('powerCurveCalculator', () => {
    // A @ Top: early 0.8 / mid 0.5 / late 0.25.  B @ Jungle: early 0.3 / mid 0.5 / late 0.7.
    const ds = buildMockDataset([
        { key: 'A', roles: { [Role.Top]: { wins: 0, games: 0, statsByTime: timeline(s(80, 100), s(5, 10), s(5, 10), s(2, 10), s(3, 10)) } } },
        { key: 'B', roles: { [Role.Jungle]: { wins: 0, games: 0, statsByTime: timeline(s(3, 10), s(5, 10), s(5, 10), s(7, 10), s(7, 10)) } } }
    ]);

    it('returns the three buckets in order', () => {
        expect(Object.keys(calculatePowerCurve(['A'], [], ds).ally)).toEqual(['early', 'mid', 'late']);
    });

    it('aggregates dataset indices 1+2 (mid) and 3+4 (late)', () => {
        const c = calculatePowerCurve(['A'], [], ds);
        expect(c.ally.early).toBeCloseTo(0.8); // 80/100
        expect(c.ally.mid).toBeCloseTo(0.5); // (5+5)/(10+10)
        expect(c.ally.late).toBeCloseTo(0.25); // (2+3)/(10+10)
    });

    it('uses an arithmetic (unweighted) mean across champions', () => {
        // A early 0.8 (100 games) + B early 0.3 (10 games) → 0.55, not games-weighted ~0.75
        expect(calculatePowerCurve(['A', 'B'], [], ds).ally.early).toBeCloseTo(0.55);
    });

    it('returns null for a bucket where the champion has no games', () => {
        const dz = buildMockDataset([
            { key: 'Z', roles: { [Role.Top]: { wins: 0, games: 0, statsByTime: timeline(s(0, 0), s(5, 10), s(5, 10), s(0, 0), s(0, 0)) } } }
        ]);
        const c = calculatePowerCurve(['Z'], [], dz);
        expect(c.ally.early).toBeNull();
        expect(c.ally.mid).toBeCloseTo(0.5);
        expect(c.ally.late).toBeNull();
    });

    it('excludes no-data champions from the team mean', () => {
        const mixed = buildMockDataset([
            { key: 'A', roles: { [Role.Top]: { wins: 0, games: 0, statsByTime: timeline(s(80, 100), s(5, 10), s(5, 10), s(2, 10), s(3, 10)) } } },
            { key: 'Z', roles: { [Role.Jungle]: { wins: 0, games: 0, statsByTime: timeline(s(0, 0), s(5, 10), s(5, 10), s(0, 0), s(0, 0)) } } }
        ]);
        expect(calculatePowerCurve(['A', 'Z'], [], mixed).ally.early).toBeCloseTo(0.8);
    });

    it('handles unknown champion keys gracefully', () => {
        expect(calculatePowerCurve(['999'], [], ds).ally.early).toBeNull();
        expect(calculatePowerCurve(['A', '999'], [], ds).ally.early).toBeCloseTo(0.8);
    });

    it('lane mode returns 5 lanes × 3 buckets = 15 points', () => {
        const lanes = calculateLanePowerCurves(['A', 'B', 'x', 'y', 'z'], [], ds);
        expect(lanes).toHaveLength(5);
        expect(lanes.flatMap((l) => POWER_BUCKETS.map((b) => l.ally[b]))).toHaveLength(15);
        expect(lanes[0].role).toBe(Role.Top);
        expect(lanes[0].ally.early).toBeCloseTo(0.8);
        expect(lanes[1].ally.early).toBeCloseTo(0.3);
    });

    it('dominantBucket finds the ally’s biggest edge (early-strong)', () => {
        const dd = buildMockDataset([
            { key: 'AllyTop', roles: { [Role.Top]: { wins: 0, games: 0, statsByTime: timeline(s(80, 100), s(5, 10), s(5, 10), s(2, 10), s(3, 10)) } } },
            { key: 'EnemyTop', roles: { [Role.Top]: { wins: 0, games: 0, statsByTime: timeline(s(40, 100), s(5, 10), s(5, 10), s(7, 10), s(7, 10)) } } }
        ]);
        expect(dominantBucket(calculatePowerCurve(['AllyTop'], ['EnemyTop'], dd))).toBe('early');
    });

    it('dominantBucket inverts when the comps swap (late-strong)', () => {
        const dd = buildMockDataset([
            { key: 'AllyTop', roles: { [Role.Top]: { wins: 0, games: 0, statsByTime: timeline(s(80, 100), s(5, 10), s(5, 10), s(2, 10), s(3, 10)) } } },
            { key: 'EnemyTop', roles: { [Role.Top]: { wins: 0, games: 0, statsByTime: timeline(s(40, 100), s(5, 10), s(5, 10), s(7, 10), s(7, 10)) } } }
        ]);
        expect(dominantBucket(calculatePowerCurve(['EnemyTop'], ['AllyTop'], dd))).toBe('late');
    });

    it('dominantBucket is null when the sides are not comparable', () => {
        expect(dominantBucket(calculatePowerCurve(['A'], [], ds))).toBeNull();
    });

    it.skip('live-data smoke (needs local dataset sample)', () => {
        // On the real feed, asserts ally/enemy curves stay within ~[0.30, 0.70].
    });
});
