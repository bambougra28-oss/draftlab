/**
 * rolePriors (corpus tallies + cascade) and readEnemyRoles (I2 marginals,
 * mismatch flag, ambiguity) — hand-computed joints on two-pick comps.
 */
import { describe, it, expect } from 'vitest';
import { fitRolePriors, layerRolePriors, rolePriorsOf } from '$lib/aggregates/rolePriors';
import { readEnemyRoles, ROLE_MISMATCH_MIN_P, type RoleEntryDraft } from '$lib/intel/liveDraft';
import { Role } from '$lib/types';
import type { DraftRecord, DraftSide } from '$lib/data/types';

function game(gameId: string, picks: { key: string; side: DraftSide; role: Role }[]): DraftRecord {
    return {
        gameId,
        blueTeam: 'A',
        redTeam: 'B',
        winner: 'blue',
        firstPickSide: 'blue',
        orderConfidence: 'assumed-blue-first',
        actions: picks.map((p, i) => ({
            seq: 7 + i,
            type: 'pick' as const,
            phase: 'pick1' as const,
            side: p.side,
            championKey: p.key,
            championName: p.key,
            role: p.role
        })),
        warnings: [],
        provenance: { source: 'test', fetchedAt: 'now' }
    };
}

describe('fitRolePriors / cascade', () => {
    it('tallies champion×role pick counts over both sides', () => {
        const fit = fitRolePriors([
            game('g1', [
                { key: '13', side: 'blue', role: Role.Middle },
                { key: '13', side: 'red', role: Role.Top }
            ]),
            game('g2', [{ key: '13', side: 'blue', role: Role.Middle }])
        ]);
        expect(fit.picks).toBe(3);
        expect(fit.byChampion.get('13')).toEqual({ [Role.Middle]: 2, [Role.Top]: 1 });
        expect(rolePriorsOf(fit)('999')).toEqual({});
    });

    it('layerRolePriors: the team layer wins outright when it knows the champion', () => {
        const team = fitRolePriors([game('t', [{ key: '13', side: 'blue', role: Role.Top }])]);
        const league = fitRolePriors([
            game('l1', [{ key: '13', side: 'blue', role: Role.Middle }]),
            game('l2', [{ key: '412', side: 'blue', role: Role.Support }])
        ]);
        const layered = layerRolePriors(team, league);
        expect(layered('13')).toEqual({ [Role.Top]: 1 }); // team read, not league's mid
        expect(layered('412')).toEqual({ [Role.Support]: 1 }); // league fallback
        expect(layered('999')).toEqual({});
    });
});

const entryWith = (enemyPicks: (string | null)[]): RoleEntryDraft => ({
    allyPicks: [null, null, null, null, null],
    enemyPicks,
    allyBans: [null, null, null, null, null],
    enemyBans: [null, null, null, null, null],
    allySide: 'blue'
});

describe('readEnemyRoles', () => {
    // 13: 90 % mid / 10 % top ; 412: support only.
    const priors = (key: string) =>
        key === '13'
            ? { [Role.Middle]: 9, [Role.Top]: 1 }
            : key === '412'
              ? { [Role.Support]: 10 }
              : {};

    it('flags a confident disagreement with the entered slot', () => {
        // 13 entered TOP (index 0), 412 entered SUPPORT (index 4).
        // Joint hypotheses: (13 mid, 412 sup) 0.9 ; (13 top, 412 sup) 0.1.
        const report = readEnemyRoles(entryWith(['13', null, null, null, '412']), priors);
        const read13 = report.reads.find((r) => r.championKey === '13')!;
        expect(read13.topRole).toBe(Role.Middle);
        expect(read13.pTopRole).toBeCloseTo(0.9, 10);
        expect(read13.enteredRole).toBe(Role.Top);
        expect(read13.mismatch).toBe(true);
        const read412 = report.reads.find((r) => r.championKey === '412')!;
        expect(read412.mismatch).toBe(false);
        expect(read412.pTopRole).toBeCloseTo(1, 10);
        // H(0.9, 0.1) ≈ 0.469 bits.
        expect(report.ambiguityBits).toBeCloseTo(0.469, 3);
        expect(report.experimental).toBe(true);
    });

    it('no mismatch below the confidence floor, and the floor is pinned', () => {
        expect(ROLE_MISMATCH_MIN_P).toBe(0.6);
        // 55/45 mid-top: top role mid at 0.55 < 0.6 → silent even if entered top.
        const soft = (key: string) => (key === '13' ? { [Role.Middle]: 55, [Role.Top]: 45 } : {});
        const report = readEnemyRoles(entryWith(['13', null, null, null, null]), soft);
        expect(report.reads[0].pTopRole).toBeCloseTo(0.55, 10);
        expect(report.reads[0].mismatch).toBe(false);
    });

    it('an unknown champion gets a uniform fallback instead of killing the enumeration', () => {
        const report = readEnemyRoles(entryWith(['999', null, null, null, null]), () => ({}));
        expect(report.reads[0].pTopRole).toBeCloseTo(0.2, 10);
        expect(report.reads[0].mismatch).toBe(false);
        expect(report.ambiguityBits).toBeCloseTo(Math.log2(5), 10);
    });

    it('an empty enemy comp reads as fully known (0 bits, no reads)', () => {
        const report = readEnemyRoles(entryWith([null, null, null, null, null]), priors);
        expect(report.reads).toEqual([]);
        expect(report.ambiguityBits).toBe(0);
    });
});
