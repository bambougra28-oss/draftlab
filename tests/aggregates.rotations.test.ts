import { describe, it, expect } from 'vitest';
import {
    BAN_ROTATIONS,
    PICK_ROTATIONS,
    banRotationOf,
    banRotationProfile,
    rotationOf,
    rotationProfile
} from '$lib/aggregates/rotations';
import type { DraftAction, DraftPhase, DraftRecord, DraftSide } from '$lib/data/types';

/** Local DraftRecord factory — only the fields rotation profiling reads. */
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

function game(gameId: string, actions: DraftAction[]): DraftRecord {
    return {
        gameId,
        blueTeam: 'BLU',
        redTeam: 'RED',
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-10T00:00:00Z' }
    };
}

describe('rotationOf / banRotationOf — slot mapping', () => {
    it('maps every pick seq to its rotation', () => {
        expect(rotationOf(7)).toBe('P1');
        expect(rotationOf(8)).toBe('P2-3');
        expect(rotationOf(9)).toBe('P2-3');
        expect(rotationOf(10)).toBe('P4-5');
        expect(rotationOf(11)).toBe('P4-5');
        expect(rotationOf(12)).toBe('P6');
        expect(rotationOf(17)).toBe('P7');
        expect(rotationOf(18)).toBe('P8-9');
        expect(rotationOf(19)).toBe('P8-9');
        expect(rotationOf(20)).toBe('P10');
    });

    it('returns undefined for ban slots and out-of-range seq', () => {
        for (const seq of [0, 1, 6, 13, 16, 21]) expect(rotationOf(seq)).toBeUndefined();
    });

    it('maps ban seqs to phases, undefined elsewhere', () => {
        for (const seq of [1, 2, 3, 4, 5, 6]) expect(banRotationOf(seq)).toBe('B1-B3');
        for (const seq of [13, 14, 15, 16]) expect(banRotationOf(seq)).toBe('B4-B5');
        for (const seq of [0, 7, 12, 17, 20, 21]) expect(banRotationOf(seq)).toBeUndefined();
    });

    it('exposes rotations in draft order', () => {
        expect(PICK_ROTATIONS).toEqual(['P1', 'P2-3', 'P4-5', 'P6', 'P7', 'P8-9', 'P10']);
        expect(BAN_ROTATIONS).toEqual(['B1-B3', 'B4-B5']);
    });
});

/**
 * Corpus: x picked at seq 7, 8, 9, 10, 17 (one per game) + banned once at 14;
 * y picked once at seq 20; z banned at 1, 5, 13 and picked once at 12.
 */
const corpus: DraftRecord[] = [
    game('g1', [pick(7, 'blue', 'x'), pick(20, 'red', 'y'), ban(1, 'blue', 'z')]),
    game('g2', [pick(8, 'red', 'x'), ban(5, 'blue', 'z')]),
    game('g3', [pick(9, 'red', 'x'), ban(13, 'red', 'z')]),
    game('g4', [pick(10, 'blue', 'x'), pick(12, 'red', 'z')]),
    game('g5', [pick(17, 'red', 'x')]),
    game('g6', [ban(14, 'red', 'x')])
];

describe('rotationProfile', () => {
    it('x: distribution over P1/P2-3/P4-5/P7, firstRotationRate 3/5', () => {
        // Picks: seq7→P1 (1), seq8+9→P2-3 (2), seq10→P4-5 (1), seq17→P7 (1) → total 5.
        // Opening rotation (seq 7-9) = P1 + P2-3 = 1 + 2 = 3 → rate 3/5 = 0.6.
        const profile = rotationProfile(corpus, 'x');
        expect(profile.total).toBe(5);
        expect(profile.byRotation.get('P1')).toBe(1);
        expect(profile.byRotation.get('P2-3')).toBe(2);
        expect(profile.byRotation.get('P4-5')).toBe(1);
        expect(profile.byRotation.get('P7')).toBe(1);
        expect(profile.byRotation.has('P10')).toBe(false);
        expect(profile.firstRotationRate).toBeCloseTo(0.6, 12);
    });

    it('ignores bans of the same champion (x banned in g6)', () => {
        // If the seq-14 ban leaked in, total would be 6.
        expect(rotationProfile(corpus, 'x').total).toBe(5);
    });

    it('y: a pure last-pick champion has firstRotationRate 0', () => {
        const profile = rotationProfile(corpus, 'y');
        expect(profile.total).toBe(1);
        expect(profile.byRotation.get('P10')).toBe(1);
        expect(profile.firstRotationRate).toBe(0);
    });

    it('unknown champion → empty profile with rate 0', () => {
        const profile = rotationProfile(corpus, 'nope');
        expect(profile.total).toBe(0);
        expect(profile.byRotation.size).toBe(0);
        expect(profile.firstRotationRate).toBe(0);
    });
});

describe('banRotationProfile', () => {
    it('z: 2 phase-1 bans + 1 phase-2 ban → firstPhaseRate 2/3', () => {
        // Bans: seq1+5 → B1-B3 (2), seq13 → B4-B5 (1) → total 3, rate 2/3.
        const profile = banRotationProfile(corpus, 'z');
        expect(profile.total).toBe(3);
        expect(profile.byRotation.get('B1-B3')).toBe(2);
        expect(profile.byRotation.get('B4-B5')).toBe(1);
        expect(profile.firstPhaseRate).toBeCloseTo(2 / 3, 12);
    });

    it('ignores picks of the same champion (z picked in g4)', () => {
        // If the seq-12 pick leaked in, total would be 4.
        expect(banRotationProfile(corpus, 'z').total).toBe(3);
    });

    it('x: single phase-2 ban → firstPhaseRate 0', () => {
        const profile = banRotationProfile(corpus, 'x');
        expect(profile.total).toBe(1);
        expect(profile.byRotation.get('B4-B5')).toBe(1);
        expect(profile.firstPhaseRate).toBe(0);
    });
});
