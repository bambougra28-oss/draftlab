/**
 * proPowerCurves: bucket mapping, two-level pseudo-count shrinkage and the
 * Dataset contract consumed by the M4.3 calculator — all hand-computed on a
 * synthetic corpus (3 decided long games, X tops blue and wins them all).
 */
import { describe, it, expect } from 'vitest';
import {
    bucketIndexOf,
    DEFAULT_PRO_CURVE_OPTIONS,
    fitProPowerCurves,
    PRO_CURVE_BUCKETS
} from '$lib/estimators/proPowerCurves';
import { calculatePowerCurve } from '$lib/strategic/powerCurveCalculator';
import { Role } from '$lib/types';
import type { DraftRecord, DraftSide } from '$lib/data/types';

interface PickSpec {
    key: string;
    side: DraftSide;
    role?: Role;
}

function game(gameId: string, picks: PickSpec[], winner?: DraftSide, gameLengthSeconds?: number): DraftRecord {
    return {
        gameId,
        blueTeam: 'A',
        redTeam: 'B',
        ...(winner !== undefined ? { winner } : {}),
        ...(gameLengthSeconds !== undefined ? { gameLengthSeconds } : {}),
        firstPickSide: 'blue',
        orderConfidence: 'assumed-blue-first',
        actions: picks.map((pick, i) => ({
            seq: 7 + i,
            type: 'pick' as const,
            phase: 'pick1' as const,
            side: pick.side,
            championKey: pick.key,
            championName: `${pick.key}-name`,
            ...(pick.role !== undefined ? { role: pick.role } : {})
        })),
        warnings: [],
        provenance: { source: 'test', fetchedAt: 'now' }
    };
}

describe('bucketIndexOf', () => {
    it('maps the 25/30/35/40 boundaries (boundary minute goes up)', () => {
        expect(bucketIndexOf(1499)).toBe(0); // 24.98 min
        expect(bucketIndexOf(1500)).toBe(1); // exactly 25
        expect(bucketIndexOf(1799)).toBe(1);
        expect(bucketIndexOf(1800)).toBe(2); // 30
        expect(bucketIndexOf(2100)).toBe(3); // 35
        expect(bucketIndexOf(2400)).toBe(4); // 40
        expect(bucketIndexOf(3600)).toBe(4); // open-ended
    });
});

// X (blue Top) wins 3 games of 36 min vs Y (red Top); Z has no role.
const corpus: DraftRecord[] = [
    game('g1', [{ key: 'X', side: 'blue', role: Role.Top }, { key: 'Y', side: 'red', role: Role.Top }, { key: 'Z', side: 'red' }], 'blue', 2160),
    game('g2', [{ key: 'X', side: 'blue', role: Role.Top }, { key: 'Y', side: 'red', role: Role.Top }], 'blue', 2160),
    game('g3', [{ key: 'X', side: 'blue', role: Role.Top }, { key: 'Y', side: 'red', role: Role.Top }], 'blue', 2160),
    // Ignored: no winner, then no duration.
    game('g4', [{ key: 'X', side: 'blue', role: Role.Top }], undefined, 2160),
    game('g5', [{ key: 'X', side: 'blue', role: Role.Top }], 'blue')
];

describe('fitProPowerCurves', () => {
    const dataset = fitProPowerCurves(corpus, { bucketPriorN: 4, overallPriorN: 3 });

    it('emits posterior means as pseudo-counts (winner side, bucket 3)', () => {
        // X overall = (3 + 0.5·3)/(3 + 3) = 0.75.
        // bucket3 = {wins: 3 + 0.75·4 = 6, games: 3 + 4 = 7} → 6/7.
        const x = dataset.championData['X'].statsByRole[Role.Top];
        expect(x.games).toBe(3); // raw counts kept for diagnostics
        expect(x.wins).toBe(3);
        expect(x.statsByTime).toHaveLength(PRO_CURVE_BUCKETS);
        expect(x.statsByTime[3].wins).toBeCloseTo(6, 10);
        expect(x.statsByTime[3].games).toBe(7);
    });

    it('an empty bucket reads as the champion×role overall posterior', () => {
        // bucket0 = {wins: 0.75·4 = 3, games: 4} → 0.75 exactly.
        const x = dataset.championData['X'].statsByRole[Role.Top];
        expect(x.statsByTime[0].wins / x.statsByTime[0].games).toBeCloseTo(0.75, 10);
    });

    it('the losing side mirrors it below 0.5', () => {
        // Y overall = (0 + 1.5)/6 = 0.25 ; bucket3 = (0 + 1)/7 = 1/7.
        const y = dataset.championData['Y'].statsByRole[Role.Top];
        expect(y.statsByTime[3].wins / y.statsByTime[3].games).toBeCloseTo(1 / 7, 10);
    });

    it('skips role-less picks, undecided and duration-less games', () => {
        expect(dataset.championData['Z']).toBeUndefined();
        // X saw exactly 3 games (g4 no winner, g5 no duration).
        expect(dataset.championData['X'].statsByRole[Role.Top].games).toBe(3);
    });

    it('untallied roles stay at zero games (the calculator reads them as null)', () => {
        const x = dataset.championData['X'].statsByRole[Role.Jungle];
        expect(x.statsByTime.every((s) => s.games === 0)).toBe(true);
    });

    it('labels the overlay and keeps clock-free defaults', () => {
        expect(dataset.version).toBe('pro-corpus');
        expect(dataset.date).toBe('walk-forward');
        expect(DEFAULT_PRO_CURVE_OPTIONS).toEqual({ bucketPriorN: 12, overallPriorN: 50 });
    });

    it('feeds calculatePowerCurve: late fold = pseudo-stats of buckets 3+4', () => {
        // X late = (6 + 3)/(7 + 4) = 9/11 ; Y late = (1 + 1)/11 = 2/11.
        const curve = calculatePowerCurve(['X'], ['Y'], dataset);
        expect(curve.ally.late).toBeCloseTo(9 / 11, 10);
        expect(curve.enemy.late).toBeCloseTo(2 / 11, 10);
        expect(curve.ally.early).toBeCloseTo(0.75, 10); // empty-bucket prior
    });
});
