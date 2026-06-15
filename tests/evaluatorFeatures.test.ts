import { describe, it, expect } from 'vitest';
import {
    evaluatorFeaturesAt,
    featuresTuple,
    standardizeFit,
    standardizeApply
} from '$lib/backtest/evaluatorFeatures';
import { analyzeDraft } from '$lib/engine/analyzer';
import { buildMockDataset, makeTeam } from '$lib/dataset/mock';
import { Role, type AnalyzeDraftConfig } from '$lib/types';
import type { DraftAction, DraftRecord, DraftSide } from '$lib/data/types';

const CONFIG: AnalyzeDraftConfig = { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 };

// Blue keys 101-105, red keys 201-205, one champion per role, varied winrates.
const dataset = buildMockDataset([
    { key: '101', roles: { [Role.Top]: { wins: 540, games: 1000 } } },
    { key: '102', roles: { [Role.Jungle]: { wins: 520, games: 1000 } } },
    { key: '103', roles: { [Role.Middle]: { wins: 500, games: 1000 } } },
    { key: '104', roles: { [Role.Bottom]: { wins: 510, games: 1000 } } },
    { key: '105', roles: { [Role.Support]: { wins: 495, games: 1000 } } },
    { key: '201', roles: { [Role.Top]: { wins: 480, games: 1000 } } },
    { key: '202', roles: { [Role.Jungle]: { wins: 470, games: 1000 } } },
    { key: '203', roles: { [Role.Middle]: { wins: 505, games: 1000 } } },
    { key: '204', roles: { [Role.Bottom]: { wins: 460, games: 1000 } } },
    { key: '205', roles: { [Role.Support]: { wins: 515, games: 1000 } } }
]);

const ban = (seq: number, side: DraftSide, key: string): DraftAction => ({
    seq,
    type: 'ban',
    phase: seq <= 6 ? 'ban1' : 'ban2',
    side,
    championKey: key,
    championName: `B${key}`
});
const pick = (seq: number, side: DraftSide, role: Role, key: string): DraftAction => ({
    seq,
    type: 'pick',
    phase: seq <= 12 ? 'pick1' : 'pick2',
    side,
    championKey: key,
    championName: `C${key}`,
    role
});
const fullActions = (): DraftAction[] => [
    ban(1, 'blue', '901'),
    ban(2, 'red', '902'),
    ban(3, 'blue', '903'),
    ban(4, 'red', '904'),
    ban(5, 'blue', '905'),
    ban(6, 'red', '906'),
    pick(7, 'blue', Role.Top, '101'),
    pick(8, 'red', Role.Top, '201'),
    pick(9, 'red', Role.Jungle, '202'),
    pick(10, 'blue', Role.Jungle, '102'),
    pick(11, 'blue', Role.Middle, '103'),
    pick(12, 'red', Role.Middle, '203'),
    ban(13, 'red', '907'),
    ban(14, 'blue', '908'),
    ban(15, 'red', '909'),
    ban(16, 'blue', '910'),
    pick(17, 'red', Role.Bottom, '204'),
    pick(18, 'blue', Role.Bottom, '104'),
    pick(19, 'blue', Role.Support, '105'),
    pick(20, 'red', Role.Support, '205')
];
const record = (overrides: Partial<DraftRecord> = {}): DraftRecord => ({
    gameId: 'SYN-1',
    blueTeam: 'Bleus',
    redTeam: 'Rouges',
    winner: 'blue',
    patch: '26.05',
    firstPickSide: 'blue',
    orderConfidence: 'exact',
    actions: fullActions(),
    warnings: [],
    provenance: { source: 'synthetic', fetchedAt: '2026-06-11T00:00:00Z' },
    ...overrides
});

const ds = { dataset, fullDataset: dataset };

describe('evaluatorFeatures — evaluatorFeaturesAt', () => {
    it('x₁+x₂+x₃ equals analyzeDraft.totalRating at fullDraft (sideOffset = 0)', () => {
        const f = evaluatorFeaturesAt(record(), 20, ds)!;
        const blue = makeTeam([
            [Role.Top, '101'],
            [Role.Jungle, '102'],
            [Role.Middle, '103'],
            [Role.Bottom, '104'],
            [Role.Support, '105']
        ]);
        const red = makeTeam([
            [Role.Top, '201'],
            [Role.Jungle, '202'],
            [Role.Middle, '203'],
            [Role.Bottom, '204'],
            [Role.Support, '205']
        ]);
        const r = analyzeDraft(dataset, blue, red, CONFIG, dataset);
        expect(f.x1 + f.x2 + f.x3).toBeCloseTo(r.totalRating, 10);
        // And the components match their sub-totals exactly.
        expect(f.x1).toBeCloseTo(r.allyChampionRating.totalRating - r.enemyChampionRating.totalRating, 10);
        expect(f.x2).toBeCloseTo(r.allyDuoRating.totalRating - r.enemyDuoRating.totalRating, 10);
        expect(f.x3).toBeCloseTo(r.matchupRating.totalRating, 10);
    });

    it('afterBans (seq ≤ 6, zero picks) → all three features are exactly 0', () => {
        const f = evaluatorFeaturesAt(record(), 6, ds)!;
        expect(f).toEqual({ x1: 0, x2: 0, x3: 0 });
    });

    it('is undefined when the prefix is not scorable (unresolved key)', () => {
        const actions = fullActions();
        actions[7] = pick(8, 'red', Role.Top, ''); // seq 8 unresolved
        expect(evaluatorFeaturesAt(record({ actions }), 8, ds)).toBeUndefined();
    });

    it('depends only on the draft + datasets, not on the winner (no outcome leak)', () => {
        const blueWin = evaluatorFeaturesAt(record({ winner: 'blue' }), 20, ds)!;
        const redWin = evaluatorFeaturesAt(record({ winner: 'red' }), 20, ds)!;
        expect(blueWin).toEqual(redWin);
    });
});

describe('evaluatorFeatures — standardize (amendment R8)', () => {
    it('computes population μ, σ on train and keeps varying columns', () => {
        const rows = [
            [1, 10, 5],
            [3, 10, 7],
            [5, 10, 9]
        ];
        const s = standardizeFit(rows);
        expect(s.mu).toEqual([3, 10, 7]); // means
        // population sd of {1,3,5} = sqrt(8/3); col1 constant → excluded.
        expect(s.sd[0]).toBeCloseTo(Math.sqrt(8 / 3), 12);
        expect(s.kept).toEqual([true, false, true]);
    });

    it('EXCLUDES a σ ≤ 1e-9 column (not zero-fill) — apply drops it', () => {
        const rows = [
            [2, 7],
            [4, 7],
            [6, 7]
        ];
        const s = standardizeFit(rows);
        expect(s.kept).toEqual([true, false]);
        // Only the kept column is returned, standardized with train μ,σ.
        const z = standardizeApply(s, [4, 7]);
        expect(z).toHaveLength(1);
        expect(z[0]).toBeCloseTo((4 - 4) / Math.sqrt(8 / 3), 12);
    });

    it('all-constant rows (afterBans) → no kept columns → intercept-only design', () => {
        const rows = [
            [0, 0, 0],
            [0, 0, 0]
        ];
        const s = standardizeFit(rows);
        expect(s.kept).toEqual([false, false, false]);
        expect(standardizeApply(s, [0, 0, 0])).toEqual([]);
    });

    it('featuresTuple preserves the [x1, x2, x3] column order', () => {
        expect(featuresTuple({ x1: 7, x2: 8, x3: 9 })).toEqual([7, 8, 9]);
    });
});
