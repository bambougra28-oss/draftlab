import { describe, it, expect } from 'vitest';
import { FLEX_ROLE_THRESHOLD, flexMap } from '$lib/aggregates/flex';
import type { DraftAction, DraftPhase, DraftRecord, DraftSide } from '$lib/data/types';
import { Role } from '$lib/types';

/** Local DraftRecord factory — only the fields the flex map reads. */
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

/**
 * Pick tallies built by the corpus below:
 *  f: Top×3, Middle×1 (+1 roleless, ignored)   g: Top×2, Middle×2
 *  h: Top, Jungle, Middle, Bottom (1 each)     i: Top×5
 *  j: Top×4, Jungle×1                          k: roleless only → absent
 * r1 also bans f — bans never feed the flex map.
 */
const corpus: DraftRecord[] = [
    game('r1', [
        ban(1, 'blue', 'f'),
        pick(7, 'blue', 'f', Role.Top),
        pick(8, 'red', 'g', Role.Top),
        pick(9, 'red', 'h', Role.Top),
        pick(10, 'blue', 'i', Role.Top),
        pick(11, 'blue', 'j', Role.Top)
    ]),
    game('r2', [
        pick(7, 'blue', 'f', Role.Top),
        pick(8, 'red', 'g', Role.Top),
        pick(9, 'red', 'h', Role.Jungle),
        pick(10, 'blue', 'i', Role.Top),
        pick(11, 'blue', 'j', Role.Top)
    ]),
    game('r3', [
        pick(7, 'blue', 'f', Role.Top),
        pick(8, 'red', 'g', Role.Middle),
        pick(9, 'red', 'h', Role.Middle),
        pick(10, 'blue', 'i', Role.Top),
        pick(11, 'blue', 'j', Role.Top)
    ]),
    game('r4', [
        pick(7, 'blue', 'f', Role.Middle),
        pick(8, 'red', 'g', Role.Middle),
        pick(9, 'red', 'h', Role.Bottom),
        pick(10, 'blue', 'i', Role.Top),
        pick(11, 'blue', 'j', Role.Jungle)
    ]),
    game('r5', [
        pick(7, 'blue', 'f'),
        pick(10, 'blue', 'i', Role.Top),
        pick(11, 'blue', 'j', Role.Top),
        pick(8, 'red', 'k')
    ])
];

describe('flexMap', () => {
    const map = flexMap(corpus);

    it('one-trick role: i played Top×5 → roleCount 1, entropy 0', () => {
        // Distribution {Top: 1.0} → H = -1·log2(1) = 0 bits.
        const i = map.get('i');
        expect(i?.byRole.get(Role.Top)).toBe(5);
        expect(i?.byRole.size).toBe(1);
        expect(i?.roleCount).toBe(1);
        expect(i?.flexScore).toBe(0);
    });

    it('50/50 two-role flex: g → entropy exactly 1 bit, roleCount 2', () => {
        // {Top: 2/4, Middle: 2/4} → H = -2·(0.5·log2 0.5) = 1 bit.
        const g = map.get('g');
        expect(g?.byRole.get(Role.Top)).toBe(2);
        expect(g?.byRole.get(Role.Middle)).toBe(2);
        expect(g?.roleCount).toBe(2);
        expect(g?.flexScore).toBeCloseTo(1, 12);
    });

    it('four-way 25% flex: h → entropy 2 bits, roleCount 4', () => {
        // {0.25×4} → H = -4·(0.25·log2 0.25) = -4·(0.25·-2) = 2 bits.
        const h = map.get('h');
        expect(h?.roleCount).toBe(4);
        expect(h?.flexScore).toBeCloseTo(2, 12);
    });

    it('75/25 split: f → entropy ≈ 0.811278 bits, roleCount 2', () => {
        // {Top: 3/4, Middle: 1/4}:
        // H = -(0.75·log2 0.75 + 0.25·log2 0.25)
        //   = 0.75·0.4150374993 + 0.25·2 = 0.3112781245 + 0.5 = 0.8112781245.
        const f = map.get('f');
        expect(f?.byRole.get(Role.Top)).toBe(3);
        expect(f?.byRole.get(Role.Middle)).toBe(1);
        expect(f?.roleCount).toBe(2);
        expect(f?.flexScore).toBeCloseTo(0.8112781245, 9);
    });

    it('exactly 20% of picks still counts as a role (inclusive threshold)', () => {
        // j = {Top: 4/5, Jungle: 1/5}; 1/5 = 0.2 = FLEX_ROLE_THRESHOLD → roleCount 2.
        // H = -(0.8·log2 0.8 + 0.2·log2 0.2)
        //   = 0.8·0.3219280949 + 0.2·2.3219280949 = 0.2575424759 + 0.4643856190
        //   = 0.7219280949.
        expect(FLEX_ROLE_THRESHOLD).toBe(0.2);
        const j = map.get('j');
        expect(j?.roleCount).toBe(2);
        expect(j?.flexScore).toBeCloseTo(0.7219280949, 9);
    });

    it('roleless picks are ignored; roleless-only champions are absent', () => {
        // f's r5 pick has no role → f still totals 4 role-tagged picks.
        const f = map.get('f');
        let total = 0;
        for (const count of f?.byRole.values() ?? []) total += count;
        expect(total).toBe(4);
        // k was only ever picked without role info → no entry.
        expect(map.has('k')).toBe(false);
    });

    it('bans never contribute (f banned in r1 yet Top stays at 3)', () => {
        expect(map.get('f')?.byRole.get(Role.Top)).toBe(3);
    });

    it('empty corpus yields an empty map', () => {
        expect(flexMap([]).size).toBe(0);
    });
});
