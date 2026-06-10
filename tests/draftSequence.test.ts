/**
 * sequence.ts — the exact-format entry model: cursor placement, gap-free
 * prefix, flex picks, role-conflict swaps and the role-keyed projection.
 */
import { describe, it, expect } from 'vitest';
import {
    assignRole,
    emptySequence,
    lastFilledSeq,
    nextOpenSeq,
    placeChampion,
    removeLast,
    replaceAt,
    roleEntryView,
    SEQUENCE_SLOTS,
    toDraftActions,
    usedKeys
} from '$lib/draft/sequence';
import { Role } from '$lib/types';

describe('SEQUENCE_SLOTS', () => {
    it('mirrors the tournament template: 6 bans, 6 picks, 4 bans, 4 picks, blue first', () => {
        expect(SEQUENCE_SLOTS).toHaveLength(20);
        expect(SEQUENCE_SLOTS.map((s) => s.type).join('')).toBe(
            'ban'.repeat(6) + 'pick'.repeat(6) + 'ban'.repeat(4) + 'pick'.repeat(4)
        );
        expect(SEQUENCE_SLOTS[0]).toMatchObject({ seq: 1, side: 'blue', phase: 'ban1' });
        expect(SEQUENCE_SLOTS[12]).toMatchObject({ seq: 13, side: 'red', phase: 'ban2' });
        // Pick rotation B1 R1 R2 B2 B3 R3.
        expect(SEQUENCE_SLOTS.slice(6, 12).map((s) => s.side)).toEqual([
            'blue',
            'red',
            'red',
            'blue',
            'blue',
            'red'
        ]);
    });
});

describe('placement & undo', () => {
    it('places at the cursor and keeps the prefix gap-free', () => {
        let s = emptySequence();
        expect(nextOpenSeq(s)).toBe(1);
        s = placeChampion(s, '266'); // BB1
        s = placeChampion(s, '103'); // RB1
        expect(nextOpenSeq(s)).toBe(3);
        expect(lastFilledSeq(s)).toBe(2);
        expect([...usedKeys(s)].sort()).toEqual(['103', '266']);
    });

    it('refuses duplicates and placement past a complete draft', () => {
        let s = placeChampion(emptySequence(), '266');
        const same = placeChampion(s, '266');
        expect(same).toBe(s); // unchanged reference — refused
        for (let i = 0; i < 19; i++) s = placeChampion(s, String(1000 + i));
        expect(nextOpenSeq(s)).toBeNull();
        expect(placeChampion(s, '999')).toBe(s);
    });

    it('removeLast undoes the tail; replaceAt edits in place without a hole', () => {
        let s = placeChampion(placeChampion(emptySequence(), '266'), '103');
        s = removeLast(s);
        expect(lastFilledSeq(s)).toBe(1);
        s = replaceAt(s, 1, '54');
        expect(s.entries.get(1)?.championKey).toBe('54');
        // replaceAt refuses a champion used elsewhere.
        s = placeChampion(s, '103');
        expect(replaceAt(s, 1, '103')).toBe(s);
    });
});

/** Fill the 6 ban1 slots quickly with distinct filler keys. */
function afterBans(): ReturnType<typeof emptySequence> {
    let s = emptySequence();
    for (const key of ['b1', 'b2', 'b3', 'b4', 'b5', 'b6']) s = placeChampion(s, key);
    return s;
}

describe('flex & roles', () => {
    it('a pick lands FLEX by default; assignRole commits, undefined clears', () => {
        let s = placeChampion(afterBans(), '266'); // B1, flex
        expect(s.entries.get(7)?.role).toBeUndefined();
        s = assignRole(s, 7, Role.Top);
        expect(s.entries.get(7)?.role).toBe(Role.Top);
        s = assignRole(s, 7, undefined);
        expect(s.entries.get(7)?.role).toBeUndefined();
    });

    it('committing a teammate’s role flips that teammate back to flex (the swap)', () => {
        let s = placeChampion(afterBans(), '266'); // B1
        s = assignRole(s, 7, Role.Top);
        s = placeChampion(s, '103'); // R1 — enemy, same role allowed
        s = assignRole(s, 8, Role.Top);
        s = placeChampion(s, '54'); // R2
        s = assignRole(s, 9, Role.Top); // conflicts with R1 (same side red)
        expect(s.entries.get(9)?.role).toBe(Role.Top);
        expect(s.entries.get(8)?.role).toBeUndefined(); // flipped to flex
        expect(s.entries.get(7)?.role).toBe(Role.Top); // blue untouched
    });

    it('bans never carry a role', () => {
        const s = placeChampion(emptySequence(), '266', Role.Top);
        expect(s.entries.get(1)?.role).toBeUndefined();
        expect(assignRole(s, 1, Role.Top).entries.get(1)?.role).toBeUndefined();
    });
});

describe('projections', () => {
    it('toDraftActions emits exact seqs/phases/sides with roles on committed picks', () => {
        let s = placeChampion(emptySequence(), 'x1');
        s = placeChampion(s, 'x2');
        for (const key of ['x3', 'x4', 'x5', 'x6']) s = placeChampion(s, key);
        s = placeChampion(s, '266'); // seq 7, B1
        s = assignRole(s, 7, Role.Jungle);
        const actions = toDraftActions(s);
        expect(actions).toHaveLength(7);
        expect(actions[6]).toMatchObject({ seq: 7, type: 'pick', phase: 'pick1', side: 'blue', role: Role.Jungle });
        expect(actions[0]).toMatchObject({ seq: 1, type: 'ban', phase: 'ban1', side: 'blue' });
    });

    it('roleEntryView: committed roles claim slots, flex resolves via the injected resolver', () => {
        let s = afterBans();
        s = placeChampion(s, '266'); // B1 flex
        s = placeChampion(s, '103'); // R1 flex
        s = placeChampion(s, '54'); // R2
        s = assignRole(s, 9, Role.Middle); // 54 committed mid (red)
        const view = roleEntryView(s, 'blue', (key, free) =>
            key === '266' ? Role.Jungle : key === '103' ? Role.Support : free[0]
        );
        expect(view.allyPicks).toEqual([null, '266', null, null, null]); // jungle via resolver
        expect(view.enemyPicks).toEqual([null, null, '54', null, '103']); // mid committed + support resolved
        expect(view.allyBans).toEqual(['b1', 'b3', 'b5', null, null]); // blue bans seq 1,3,5
        expect(view.enemyBans).toEqual(['b2', 'b4', 'b6', null, null]);
        expect(view.flexSeqs.sort()).toEqual([7, 8]);
    });

    it('roleEntryView from the red point of view swaps the columns', () => {
        let s = afterBans();
        s = placeChampion(s, '266');
        s = assignRole(s, 7, Role.Top);
        const view = roleEntryView(s, 'red');
        expect(view.enemyPicks[Role.Top]).toBe('266');
        expect(view.allyPicks).toEqual([null, null, null, null, null]);
        expect(view.allyBans).toEqual(['b2', 'b4', 'b6', null, null]);
    });

    it('a resolver returning an occupied role falls back to a free one', () => {
        let s = afterBans();
        s = placeChampion(s, '266');
        s = assignRole(s, 7, Role.Top);
        s = placeChampion(s, '103'); // R1
        s = placeChampion(s, '54'); // R2
        s = placeChampion(s, '18'); // B2 flex
        const view = roleEntryView(s, 'blue', () => Role.Top); // always claims occupied Top
        // 18 must NOT evict 266: falls back to the first free role (Jungle).
        expect(view.allyPicks[Role.Top]).toBe('266');
        expect(view.allyPicks[Role.Jungle]).toBe('18');
    });
});
