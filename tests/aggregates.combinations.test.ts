import { describe, it, expect } from 'vitest';
import { mineCombinations, pairKind, structuralDamage } from '$lib/aggregates/combinations';
import type { DraftAction, DraftPhase, DraftRecord, DraftSide } from '$lib/data/types';
import { Role } from '$lib/types';

/** Local DraftRecord factory — only the fields combination mining reads. */
function phaseOf(seq: number): DraftPhase {
    if (seq <= 6) return 'ban1';
    if (seq <= 12) return 'pick1';
    if (seq <= 16) return 'ban2';
    return 'pick2';
}

function pick(seq: number, side: DraftSide, championKey: string, role?: Role): DraftAction {
    const action: DraftAction = {
        seq,
        type: 'pick',
        phase: phaseOf(seq),
        side,
        championKey,
        championName: championKey
    };
    if (role !== undefined) action.role = role;
    return action;
}

function game(gameId: string, actions: DraftAction[], extras: Partial<DraftRecord> = {}): DraftRecord {
    return {
        gameId,
        blueTeam: 'BLU',
        redTeam: 'RED',
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-10T00:00:00Z' },
        ...extras
    };
}

/** Full blue side (template slots 7/10/11/18/19) with a varying top laner. */
function blueSide(top: string): DraftAction[] {
    return [
        pick(7, 'blue', top, Role.Top),
        pick(10, 'blue', 'maokai', Role.Jungle),
        pick(11, 'blue', 'viktor', Role.Middle),
        pick(18, 'blue', 'lucian', Role.Bottom),
        pick(19, 'blue', 'nami', Role.Support)
    ];
}

/** Full red side (template slots 8/9/12/17/20). */
function redSide(keys: [string, string, string, string, string]): DraftAction[] {
    return [
        pick(8, 'red', keys[0], Role.Top),
        pick(9, 'red', keys[1], Role.Jungle),
        pick(12, 'red', keys[2], Role.Middle),
        pick(17, 'red', keys[3], Role.Bottom),
        pick(20, 'red', keys[4], Role.Support)
    ];
}

/**
 * Corpus: blue keeps maokai/viktor/lucian/nami over g1-g3 (top rotates),
 * red repeats its five only in g1-g2. Winners: blue, blue, red.
 *  → the 6 pairs among blue's fixed four hit 3 games / 2 wins;
 *  → red pairs hit 2 games / 0 wins (red lost g1+g2);
 *  → pairs involving a blue top hit 1 game.
 */
const redA: [string, string, string, string, string] = ['jayce', 'sejuani', 'azir', 'jinx', 'leona'];
const redB: [string, string, string, string, string] = ['aatrox', 'vi', 'orianna', 'ezreal', 'alistar'];
const corpus: DraftRecord[] = [
    game('g1', [...blueSide('sion'), ...redSide(redA)], { winner: 'blue' }),
    game('g2', [...blueSide('rumble'), ...redSide(redA)], { winner: 'blue' }),
    game('g3', [...blueSide('ksante'), ...redSide(redB)], { winner: 'red' })
];

describe('pairKind', () => {
    it('derives botlane / midjungle / topside regardless of order', () => {
        expect(pairKind(Role.Bottom, Role.Support)).toBe('botlane');
        expect(pairKind(Role.Support, Role.Bottom)).toBe('botlane');
        expect(pairKind(Role.Jungle, Role.Middle)).toBe('midjungle');
        expect(pairKind(Role.Middle, Role.Jungle)).toBe('midjungle');
        expect(pairKind(Role.Top, Role.Jungle)).toBe('topside');
        expect(pairKind(Role.Jungle, Role.Top)).toBe('topside');
    });

    it('falls back to other for non-named or unknown role pairs', () => {
        expect(pairKind(Role.Top, Role.Support)).toBe('other');
        expect(pairKind(Role.Top, Role.Middle)).toBe('other');
        expect(pairKind(Role.Bottom, undefined)).toBe('other');
        expect(pairKind(undefined, undefined)).toBe('other');
    });
});

describe('mineCombinations', () => {
    it('default minGames 3 keeps only blue\'s six recurring pairs', () => {
        // C(4,2) = 6 pairs among {maokai, viktor, lucian, nami}, 3 games each;
        // red pairs (2 games) and top-dependent pairs (1 game) are dropped.
        const assets = mineCombinations(corpus);
        expect(assets).toHaveLength(6);
        expect(assets.every((a) => a.games === 3 && a.wins === 2)).toBe(true);
    });

    it('botlane asset: lucian+nami, 3 games, 2 wins', () => {
        const assets = mineCombinations(corpus);
        const bot = assets.find((a) => a.kind === 'botlane');
        expect(bot).toEqual({ championKeys: ['lucian', 'nami'], kind: 'botlane', games: 3, wins: 2 });
    });

    it('midjungle asset: maokai+viktor (keys sorted ascending)', () => {
        const assets = mineCombinations(corpus);
        const mj = assets.find((a) => a.kind === 'midjungle');
        expect(mj).toEqual({ championKeys: ['maokai', 'viktor'], kind: 'midjungle', games: 3, wins: 2 });
        for (const asset of assets) {
            expect(asset.championKeys[0] < asset.championKeys[1]).toBe(true);
        }
    });

    it('minGames 2 surfaces red pairs with their 0 wins', () => {
        // Red repeated its five picks in g1+g2 and lost both → 2 games, 0 wins.
        const assets = mineCombinations(corpus, { minGames: 2 });
        // 6 blue pairs (3 games) + C(5,2) = 10 red pairs (2 games) = 16.
        expect(assets).toHaveLength(16);
        const topside = assets.find(
            (a) => a.championKeys[0] === 'jayce' && a.championKeys[1] === 'sejuani'
        );
        expect(topside).toEqual({ championKeys: ['jayce', 'sejuani'], kind: 'topside', games: 2, wins: 0 });
    });

    it('sorts by games descending (3-game assets before 2-game ones)', () => {
        const assets = mineCombinations(corpus, { minGames: 2 });
        expect(assets.slice(0, 6).every((a) => a.games === 3)).toBe(true);
        expect(assets.slice(6).every((a) => a.games === 2)).toBe(true);
    });

    it('skips unresolved picks and games without winner count 0 wins', () => {
        // One game, no winner: pairs exist but wins stay 0; '' never pairs.
        const lone = game('one', [
            pick(7, 'blue', '', Role.Top),
            pick(10, 'blue', 'a', Role.Jungle),
            pick(11, 'blue', 'b', Role.Middle)
        ]);
        const assets = mineCombinations([lone], { minGames: 1 });
        expect(assets).toEqual([{ championKeys: ['a', 'b'], kind: 'midjungle', games: 1, wins: 0 }]);
    });

    it('never pairs picks across sides', () => {
        // maokai (blue) + sejuani (red) share all 3 games but never a side.
        const assets = mineCombinations(corpus, { minGames: 1 });
        const cross = assets.find(
            (a) => a.championKeys.includes('maokai') && a.championKeys.includes('sejuani')
        );
        expect(cross).toBeUndefined();
    });
});

describe('structuralDamage', () => {
    const assets = mineCombinations(corpus); // the six 3-game blue assets

    it('maokai touches 3 of the six assets → weight 9', () => {
        // maokai+viktor, lucian+maokai, maokai+nami → 3 assets × 3 games = 9.
        const report = structuralDamage(assets, 'maokai');
        expect(report.assets).toHaveLength(3);
        expect(report.weight).toBe(9);
        expect(report.assets.every((a) => a.championKeys.includes('maokai'))).toBe(true);
    });

    it('untouched champion → no assets, weight 0', () => {
        const report = structuralDamage(assets, 'sion');
        expect(report.assets).toHaveLength(0);
        expect(report.weight).toBe(0);
    });
});
