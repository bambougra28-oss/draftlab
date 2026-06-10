import { describe, it, expect } from 'vitest';
import {
    buildDraftActions,
    bansOf,
    picksOf,
    inFirstSelectionEra,
    DRAFT_TEMPLATE
} from '$lib/data/draftRecord';
import type { TeamDraftColumns } from '$lib/data/types';
import { Role } from '$lib/types';

/** Identity-ish resolver so sequencing tests don't depend on the tag file. */
const resolveKey = (name: string) => `k:${name}`;

function columns(prefix: string, roles?: (Role | undefined)[]): TeamDraftColumns {
    return {
        bans: [1, 2, 3, 4, 5].map((i) => `${prefix}B${i}`),
        picks: [1, 2, 3, 4, 5].map((i) => `${prefix}P${i}`),
        roles
    };
}

describe('buildDraftActions — blue picks first (classic)', () => {
    const { actions, warnings } = buildDraftActions({
        blue: columns('b'),
        red: columns('r'),
        firstPickSide: 'blue',
        resolveKey
    });

    it('produces all 20 actions with no warnings', () => {
        expect(actions).toHaveLength(20);
        expect(warnings).toHaveLength(0);
    });

    it('interleaves ban phase 1 blue-first', () => {
        const names = actions.slice(0, 6).map((a) => `${a.seq}:${a.side}:${a.championName}`);
        expect(names).toEqual(['1:blue:bB1', '2:red:rB1', '3:blue:bB2', '4:red:rB2', '5:blue:bB3', '6:red:rB3']);
    });

    it('follows the B1 / R1 R2 / B2 B3 / R3 pick-phase-1 snake', () => {
        const names = actions.slice(6, 12).map((a) => `${a.seq}:${a.side}:${a.championName}`);
        expect(names).toEqual([
            '7:blue:bP1',
            '8:red:rP1',
            '9:red:rP2',
            '10:blue:bP2',
            '11:blue:bP3',
            '12:red:rP3'
        ]);
    });

    it('runs ban phase 2 red-first and the R4 / B4 B5 / R5 closer', () => {
        const tail = actions.slice(12).map((a) => `${a.seq}:${a.side}:${a.championName}`);
        expect(tail).toEqual([
            '13:red:rB4',
            '14:blue:bB4',
            '15:red:rB5',
            '16:blue:bB5',
            '17:red:rP4',
            '18:blue:bP4',
            '19:blue:bP5',
            '20:red:rP5'
        ]);
    });

    it('tags phases correctly', () => {
        expect(actions.find((a) => a.seq === 1)?.phase).toBe('ban1');
        expect(actions.find((a) => a.seq === 12)?.phase).toBe('pick1');
        expect(actions.find((a) => a.seq === 16)?.phase).toBe('ban2');
        expect(actions.find((a) => a.seq === 20)?.phase).toBe('pick2');
    });
});

describe('buildDraftActions — red picks first (First Selection)', () => {
    const { actions } = buildDraftActions({
        blue: columns('b'),
        red: columns('r'),
        firstPickSide: 'red',
        resolveKey
    });

    it('mirrors the template onto the red side', () => {
        expect(actions.find((a) => a.seq === 1)).toMatchObject({ side: 'red', championName: 'rB1' });
        expect(actions.find((a) => a.seq === 7)).toMatchObject({ side: 'red', championName: 'rP1' });
        expect(actions.find((a) => a.seq === 8)).toMatchObject({ side: 'blue', championName: 'bP1' });
        expect(actions.find((a) => a.seq === 13)).toMatchObject({ side: 'blue', championName: 'bB4' });
        expect(actions.find((a) => a.seq === 20)).toMatchObject({ side: 'blue', championName: 'bP5' });
    });

    it('keeps per-side selectors coherent', () => {
        expect(picksOf(actions, 'red').map((a) => a.championName)).toEqual(['rP1', 'rP2', 'rP3', 'rP4', 'rP5']);
        expect(bansOf(actions, 'blue').map((a) => a.championName)).toEqual(['bB1', 'bB2', 'bB3', 'bB4', 'bB5']);
    });
});

describe('buildDraftActions — degraded inputs', () => {
    it('skips forfeited bans silently (seq gap, no warning)', () => {
        const blue = columns('b');
        blue.bans[2] = 'Loss of Ban';
        const red = columns('r');
        red.bans[0] = 'None';
        const { actions, warnings } = buildDraftActions({ blue, red, firstPickSide: 'blue', resolveKey });
        expect(actions).toHaveLength(18);
        expect(actions.map((a) => a.seq)).not.toContain(5); // blue ban 3
        expect(actions.map((a) => a.seq)).not.toContain(2); // red ban 1
        expect(warnings).toHaveLength(0);
    });

    it('warns on a missing pick', () => {
        const blue = columns('b');
        blue.picks[4] = '';
        const { actions, warnings } = buildDraftActions({ blue, red: columns('r'), firstPickSide: 'blue', resolveKey });
        expect(actions).toHaveLength(19);
        expect(warnings.some((w) => w.includes('seq 19'))).toBe(true);
    });

    it('warns on an unresolved champion but keeps the action', () => {
        const blue = columns('b');
        const { actions, warnings } = buildDraftActions({
            blue,
            red: columns('r'),
            firstPickSide: 'blue',
            resolveKey: (name) => (name === 'bP1' ? undefined : `k:${name}`)
        });
        const seq7 = actions.find((a) => a.seq === 7);
        expect(seq7?.championKey).toBe('');
        expect(seq7?.championName).toBe('bP1');
        expect(warnings.some((w) => w.includes('unresolved champion "bP1"'))).toBe(true);
    });

    it('attaches roles and players to picks only', () => {
        const blue = columns('b', [Role.Top, Role.Jungle, Role.Middle, Role.Bottom, Role.Support]);
        blue.players = ['p1', 'p2', 'p3', 'p4', 'p5'];
        const { actions } = buildDraftActions({ blue, red: columns('r'), firstPickSide: 'blue', resolveKey });
        const bP1 = actions.find((a) => a.seq === 7);
        expect(bP1?.role).toBe(Role.Top);
        expect(bP1?.playerId).toBe('p1');
        const bB1 = actions.find((a) => a.seq === 1);
        expect(bB1?.role).toBeUndefined();
        expect(bB1?.playerId).toBeUndefined();
    });
});

describe('template invariants', () => {
    it('has 20 slots: 10 bans + 10 picks, balanced across sides', () => {
        expect(DRAFT_TEMPLATE).toHaveLength(20);
        expect(DRAFT_TEMPLATE.filter((s) => s.type === 'ban')).toHaveLength(10);
        expect(DRAFT_TEMPLATE.filter((s) => s.first)).toHaveLength(10);
        // Each team consumes exactly indices 0-4 for bans and picks.
        for (const first of [true, false]) {
            for (const type of ['ban', 'pick'] as const) {
                const idx = DRAFT_TEMPLATE.filter((s) => s.first === first && s.type === type).map(
                    (s) => s.teamIndex
                );
                expect([...idx].sort()).toEqual([0, 1, 2, 3, 4]);
            }
        }
    });
});

describe('inFirstSelectionEra', () => {
    it('flags 2026-01-14 and later, not before', () => {
        expect(inFirstSelectionEra('2026-01-14T08:00:00Z')).toBe(true);
        expect(inFirstSelectionEra('2026-06-01')).toBe(true);
        expect(inFirstSelectionEra('2026-01-13')).toBe(false);
        expect(inFirstSelectionEra('2025-11-02')).toBe(false);
        expect(inFirstSelectionEra(undefined)).toBe(false);
    });
});
