import { describe, it, expect } from 'vitest';
import { computePresence, recordMatchesFilter } from '$lib/aggregates/presence';
import type { DraftAction, DraftPhase, DraftRecord, DraftSide } from '$lib/data/types';

/** Local DraftRecord factory — only the fields presence aggregation reads. */
function phaseOf(seq: number): DraftPhase {
    if (seq <= 6) return 'ban1';
    if (seq <= 12) return 'pick1';
    if (seq <= 16) return 'ban2';
    return 'pick2';
}

function pick(seq: number, side: DraftSide, championKey: string): DraftAction {
    return { seq, type: 'pick', phase: phaseOf(seq), side, championKey, championName: championKey };
}

function ban(seq: number, side: DraftSide, championKey: string): DraftAction {
    return { seq, type: 'ban', phase: phaseOf(seq), side, championKey, championName: championKey };
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

/**
 * Corpus (3 games):
 *  g1 16.10, 2026-06-01, winner blue, game 1: blue bans d, red bans c, blue picks a, red picks b
 *  g2 16.11, 2026-06-05, winner red,  game 2: blue bans c, blue picks b, red picks a
 *  g3 16.10, 2026-05-20, winner blue, game 1: blue picks a, red picks e, red "bans" '' (unresolved)
 */
const corpus: DraftRecord[] = [
    game('g1', [ban(1, 'blue', 'd'), ban(2, 'red', 'c'), pick(7, 'blue', 'a'), pick(8, 'red', 'b')], {
        date: '2026-06-01',
        patch: '16.10',
        winner: 'blue',
        series: { gameNumber: 1 }
    }),
    game('g2', [ban(1, 'blue', 'c'), pick(7, 'blue', 'b'), pick(8, 'red', 'a')], {
        date: '2026-06-05',
        patch: '16.11',
        winner: 'red',
        series: { gameNumber: 2 }
    }),
    game('g3', [pick(7, 'blue', 'a'), pick(8, 'red', 'e'), ban(13, 'red', '')], {
        date: '2026-05-20',
        patch: '16.10',
        winner: 'blue',
        series: { gameNumber: 1 }
    })
];

describe('computePresence — unfiltered corpus', () => {
    const presence = computePresence(corpus);

    it('a: picked 3/3, never banned, all 3 picking sides won', () => {
        // picks: g1 blue, g2 red, g3 blue → 3; wins: blue won g1+g3, red won g2 → 3.
        // presence = (3+0)/3 = 1; pickRate = 3/3 = 1; banRate = 0.
        expect(presence.get('a')).toEqual({
            championKey: 'a',
            picks: 3,
            bans: 0,
            games: 3,
            presence: 1,
            pickRate: 1,
            banRate: 0,
            wins: 3
        });
    });

    it('c: never picked, banned twice → presence 2/3 all from bans', () => {
        // bans: g1 red, g2 blue → 2; presence = 2/3; banRate = 2/3; wins = 0.
        const c = presence.get('c');
        expect(c?.picks).toBe(0);
        expect(c?.bans).toBe(2);
        expect(c?.presence).toBeCloseTo(2 / 3, 12);
        expect(c?.banRate).toBeCloseTo(2 / 3, 12);
        expect(c?.pickRate).toBe(0);
        expect(c?.wins).toBe(0);
    });

    it('b: picked twice but both picking sides lost → wins 0', () => {
        // picks: g1 red (blue won), g2 blue (red won) → 2 picks, 0 wins.
        const b = presence.get('b');
        expect(b?.picks).toBe(2);
        expect(b?.wins).toBe(0);
        expect(b?.presence).toBeCloseTo(2 / 3, 12);
    });

    it('skips unresolved actions (no empty-key entry)', () => {
        expect(presence.has('')).toBe(false);
    });
});

describe('computePresence — side filter (action point of view)', () => {
    const blue = computePresence(corpus, { side: 'blue' });

    it('a from blue POV: 2 picks (g1, g3), 2 wins; games stays 3', () => {
        // blue picked a in g1 and g3 only (g2 was a red pick); blue won both.
        const a = blue.get('a');
        expect(a?.picks).toBe(2);
        expect(a?.wins).toBe(2);
        expect(a?.games).toBe(3);
        expect(a?.pickRate).toBeCloseTo(2 / 3, 12);
    });

    it('red-only champions disappear from the blue POV', () => {
        // e was only ever picked by red (g3).
        expect(blue.has('e')).toBe(false);
        // d was a blue ban (g1) → present with 1 ban.
        expect(blue.get('d')?.bans).toBe(1);
    });
});

describe('computePresence — corpus filters', () => {
    it('patch filter shrinks the game denominator', () => {
        // patch 16.10 → g1 + g3 (2 games). b appears once (g1 red pick) → rate 1/2.
        const p = computePresence(corpus, { patch: '16.10' });
        expect(p.get('b')?.games).toBe(2);
        expect(p.get('b')?.picks).toBe(1);
        expect(p.get('b')?.presence).toBeCloseTo(1 / 2, 12);
        // a picked in both, both winners → 2 wins.
        expect(p.get('a')?.wins).toBe(2);
    });

    it('date window is inclusive on YYYY-MM-DD', () => {
        // fromDate 2026-06-01 keeps g1 (boundary) + g2, drops g3 (05-20).
        const from = computePresence(corpus, { fromDate: '2026-06-01' });
        expect(from.get('a')?.games).toBe(2);
        expect(from.get('a')?.picks).toBe(2);
        // toDate 2026-06-01 keeps g1 (boundary) + g3, drops g2 (06-05).
        const to = computePresence(corpus, { toDate: '2026-06-01' });
        expect(to.get('a')?.picks).toBe(2);
        expect(to.has('e')).toBe(true); // g3 kept
    });

    it('gameNumber filter conditions on series position (Fearless)', () => {
        // gameNumber 1 → g1 + g3 (2 games); a picked twice, both wins.
        const g1s = computePresence(corpus, { gameNumber: 1 });
        expect(g1s.get('a')).toMatchObject({ picks: 2, wins: 2, games: 2 });
        expect(g1s.has('e')).toBe(true);
    });

    it('records missing a filtered dimension are excluded, not guessed', () => {
        const undated = game('g4', [pick(7, 'blue', 'z')]); // no date, no series
        expect(recordMatchesFilter(undated)).toBe(true);
        expect(recordMatchesFilter(undated, { fromDate: '2026-01-01' })).toBe(false);
        expect(recordMatchesFilter(undated, { gameNumber: 1 })).toBe(false);
        // Unfiltered, the undated game still counts.
        const all = computePresence([...corpus, undated]);
        expect(all.get('z')?.games).toBe(4);
    });

    it('empty corpus yields an empty map', () => {
        expect(computePresence([]).size).toBe(0);
        expect(computePresence(corpus, { patch: 'nope' }).size).toBe(0);
    });
});
