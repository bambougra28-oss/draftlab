import { describe, expect, it } from 'vitest';
import { DRAFT_TEMPLATE } from '$lib/data/draftRecord';
import type { DraftAction, DraftSide } from '$lib/data/types';
import {
    DEFAULT_NAVIGATOR_CONFIG,
    makeAnalyzeDraftEvaluator,
    navigate,
    nextSlotOf,
    type DraftState,
    type NavigatorContext,
    type NavigatorMemoEntry,
    type NavigatorSlot
} from '$lib/strategic/draftNavigator';
import { buildMockDataset } from '$lib/dataset/mock';
import { Role, ROLES, type AnalyzeDraftConfig, type Team } from '$lib/types';
import type { Dataset } from '$lib/types';

/*
 * Fixture geometry (template anchored on firstPickSide, draftRecord.ts):
 *   ban1  seq 1-6  : F S F S F S      pick1 seq 7-12 : F S S F F S
 *   ban2  seq 13-16: S F S F          pick2 seq 17-20: S F F S
 * With firstPickSide = blue : blue acts on seq 1,3,5,7,10,11,14,16,18,19 and
 * red on seq 2,4,6,8,9,12,13,15,17,20.
 */

/** Completed actions for every template slot with seq ≤ upToSeq. */
function actionsThrough(upToSeq: number, firstPickSide: DraftSide): DraftAction[] {
    const out: DraftAction[] = [];
    for (const slot of DRAFT_TEMPLATE) {
        if (slot.seq > upToSeq) break;
        const side: DraftSide = slot.first === (firstPickSide === 'blue') ? 'blue' : 'red';
        // Lowercase keys so they never collide with the C*/R*/S/Q/P/T test champions.
        const key = slot.type === 'ban' ? `x${slot.seq}` : `${side === 'blue' ? 'bb' : 'rr'}${slot.seq}`;
        out.push({ seq: slot.seq, type: slot.type, phase: slot.phase, side, championKey: key, championName: key });
    }
    return out;
}

function stateOf(upToSeq: number, firstPickSide: DraftSide, available: string[]): DraftState {
    return { actions: actionsThrough(upToSeq, firstPickSide), firstPickSide, available: new Set(available) };
}

describe('nextSlotOf', () => {
    it('opens on seq 1 (ban1) for the first-pick side', () => {
        const slot = nextSlotOf({ actions: [], firstPickSide: 'blue', available: new Set() });
        expect(slot).toEqual({ seq: 1, phase: 'ban1', type: 'ban', side: 'blue' });
    });

    it('anchors the template on firstPickSide red', () => {
        const slot = nextSlotOf({ actions: [], firstPickSide: 'red', available: new Set() });
        expect(slot).toEqual({ seq: 1, phase: 'ban1', type: 'ban', side: 'red' });
    });

    it('finds the next slot mid-draft (seq 19 after 18 actions, blue side)', () => {
        const slot = nextSlotOf(stateOf(18, 'blue', []));
        expect(slot).toEqual({ seq: 19, phase: 'pick2', type: 'pick', side: 'blue' });
    });

    it('returns null on a complete draft', () => {
        expect(nextSlotOf(stateOf(20, 'blue', []))).toBeNull();
    });

    it('never resurrects a skipped ban: progress follows the MAX seq', () => {
        // Remove the seq-13 ban (forfeited): the gap must not become "next".
        const actions = actionsThrough(18, 'blue').filter((a) => a.seq !== 13);
        const slot = nextSlotOf({ actions, firstPickSide: 'blue', available: new Set() });
        expect(slot?.seq).toBe(19);
    });
});

/*
 * Hand-built endgame tree (used by most expectimax tests).
 * State: firstPickSide blue, ourSide blue, actions complete through seq 18 —
 * remaining slots: seq 19 (pick, BLUE = ours) then seq 20 (pick, RED).
 * Our candidates C1/C2; enemy range R1 (p .6) / R2 (p .4).
 * Stub evaluator (5th picks decide):
 *   (C1,R1) .62   (C1,R2) .50   (C2,R1) .58   (C2,R2) .54
 *   4-pick immediates: (C1,—) .51   (C2,—) .49
 * Depth 2 expectations (enemy node = EXPECTATION, not minimax):
 *   value(C1) = .6·.62 + .4·.50 = .572
 *   value(C2) = .6·.58 + .4·.54 = .564     → C1 first, C2 second.
 * Node count: per candidate 1 enemy node + 2 leaves + 1 immediate = 4 → 8.
 */
const endgameTable: Record<string, number> = {
    'C1|R1': 0.62,
    'C1|R2': 0.5,
    'C2|R1': 0.58,
    'C2|R2': 0.54,
    'C1|-': 0.51,
    'C2|-': 0.49
};

function endgameEvaluate(allyKeys: string[], enemyKeys: string[]): number {
    const c = allyKeys.find((k) => k.startsWith('C')) ?? '-';
    const r = enemyKeys.find((k) => k.startsWith('R')) ?? '-';
    return endgameTable[`${c}|${r}`] ?? 0.5;
}

function endgameCtx(over: Partial<NavigatorContext> = {}): NavigatorContext {
    return {
        ourSide: 'blue',
        ourCandidates: () => ['C1', 'C2'],
        enemyDistribution: () => [
            { championKey: 'R1', p: 0.6 },
            { championKey: 'R2', p: 0.4 }
        ],
        evaluate: endgameEvaluate,
        depth: 2,
        ...over
    };
}

const endgameState = (): DraftState => stateOf(18, 'blue', ['C1', 'C2', 'R1', 'R2']);

describe('navigate — expectimax on our slots', () => {
    it('ranks candidates by expectation over the enemy range (hand tree)', () => {
        const result = navigate(endgameState(), endgameCtx());
        expect(result.nextSlot?.seq).toBe(19);
        expect(result.candidates.map((c) => c.championKey)).toEqual(['C1', 'C2']);
        expect(result.candidates[0].value).toBeCloseTo(0.572, 10);
        expect(result.candidates[1].value).toBeCloseTo(0.564, 10);
        expect(result.candidates[0].actionType).toBe('pick');
    });

    it('our node is a MAX: best value bounds every candidate', () => {
        const result = navigate(endgameState(), endgameCtx());
        for (const c of result.candidates) expect(result.candidates[0].value).toBeGreaterThanOrEqual(c.value);
    });

    it('principal variation follows the most probable enemy reply', () => {
        const result = navigate(endgameState(), endgameCtx());
        expect(result.candidates[0].line).toEqual(['pick:C1', 'pick:R1']);
        expect(result.candidates[1].line).toEqual(['pick:C2', 'pick:R1']);
    });

    it('components sum to the value (DA-V2-12): immediate + lookahead delta', () => {
        const result = navigate(endgameState(), endgameCtx());
        const c1 = result.candidates[0];
        // immediate = eval(C1 vs 4 enemy picks) = .51; delta = .572 − .51 = .062
        expect(c1.components.immediateValue).toBeCloseTo(0.51, 10);
        expect(c1.components.lookaheadDelta).toBeCloseTo(0.062, 10);
        expect(c1.components.immediateValue + c1.components.lookaheadDelta).toBeCloseTo(c1.value, 10);
    });

    it('counts explored nodes: 2 × (1 enemy node + 2 leaves + 1 immediate) = 8', () => {
        const result = navigate(endgameState(), endgameCtx());
        expect(result.evaluatedNodes).toBe(8);
    });

    it('filters unavailable enemy entries and renormalizes the rest', () => {
        // Range .7 on an unavailable ghost + .2/.1 on R1/R2 → kept mass .3 →
        // p(R1) = 2/3, p(R2) = 1/3 → value(C1) = 2/3·.62 + 1/3·.50 = .58.
        const ctx = endgameCtx({
            enemyDistribution: () => [
                { championKey: 'ghost', p: 0.7 },
                { championKey: 'R1', p: 0.2 },
                { championKey: 'R2', p: 0.1 }
            ]
        });
        const result = navigate(endgameState(), ctx);
        expect(result.candidates[0].championKey).toBe('C1');
        expect(result.candidates[0].value).toBeCloseTo(0.58, 10);
    });

    it('truncates both sides to topK and renormalizes the enemy range', () => {
        // topK 1: our candidates → [C1] only; enemy range → R1 alone (p .6
        // renormalized to 1) → value(C1) = .62.
        const result = navigate(endgameState(), endgameCtx({ topK: 1 }));
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].championKey).toBe('C1');
        expect(result.candidates[0].value).toBeCloseTo(0.62, 10);
    });

    it('drops our unavailable candidates before exploring', () => {
        const state = stateOf(18, 'blue', ['C2', 'R1', 'R2']); // C1 not available
        const result = navigate(state, endgameCtx());
        expect(result.candidates.map((c) => c.championKey)).toEqual(['C2']);
    });

    it('depth 1 = no lookahead: value equals the immediate evaluation', () => {
        const result = navigate(endgameState(), endgameCtx({ depth: 1 }));
        // Leaf right after our action: value(C1) = .51, value(C2) = .49.
        expect(result.candidates[0].value).toBeCloseTo(0.51, 10);
        expect(result.candidates[0].components.lookaheadDelta).toBeCloseTo(0, 10);
    });

    it('depth beyond the end of the draft stops at seq 20 (same values)', () => {
        const result = navigate(endgameState(), endgameCtx({ depth: 10 }));
        expect(result.candidates[0].value).toBeCloseTo(0.572, 10);
    });

    it('returns an empty candidate list when the generator has nothing', () => {
        const result = navigate(endgameState(), endgameCtx({ ourCandidates: () => [] }));
        expect(result.candidates).toEqual([]);
        expect(result.nextSlot?.seq).toBe(19);
    });

    it('returns no candidates on a complete draft', () => {
        const result = navigate(stateOf(20, 'blue', []), endgameCtx());
        expect(result.nextSlot).toBeNull();
        expect(result.candidates).toEqual([]);
    });
});

describe('navigate — enemy root slot', () => {
    it('exposes their truncated range, most probable first, valued for us', () => {
        // ourSide red → seq 19 (blue) is an ENEMY slot. Their range C1/C2 is
        // the root; each branch then sees OUR forced reply at seq 20.
        const ctx: NavigatorContext = {
            ourSide: 'red',
            ourCandidates: () => ['R1'],
            enemyDistribution: () => [
                { championKey: 'C1', p: 0.75 },
                { championKey: 'C2', p: 0.25 }
            ],
            // From red's perspective ally = R*, enemy = C*: reuse the table
            // through a flip (our value = 1 − blue value).
            evaluate: (ally, enemy) => 1 - endgameEvaluate(enemy, ally),
            depth: 2
        };
        const result = navigate(stateOf(18, 'blue', ['C1', 'C2', 'R1']), ctx);
        expect(result.candidates.map((c) => c.championKey)).toEqual(['C1', 'C2']);
        expect(result.candidates[0].p).toBeCloseTo(0.75, 10);
        // After C1 our only reply is R1 → leaf = 1 − .62 = .38.
        expect(result.candidates[0].value).toBeCloseTo(0.38, 10);
        expect(result.candidates[1].value).toBeCloseTo(1 - 0.58, 10);
    });
});

/*
 * Ban tree (denial through the range, hand-computed).
 * firstPickSide blue, ourSide RED. Actions complete through seq 14 →
 * remaining: 15 (ban, red = OURS), 16 (ban, blue), 17 (pick, red), 18 (pick,
 * blue), … Champions: S/T our ban candidates, W their forecast ban, P our
 * forced pick, S/Q their pick range (S is their power pick!).
 * Evaluator: enemy comp containing S → .40, containing Q → .55, else .5.
 * Depth 4 (plies 15-18):
 *   ban S → their pick range loses S → Q forced  → value .55
 *   ban T → .5·.40 + .5·.55                      → value .475
 * Node count: ban-S branch 1+1+1+1(leaf)+1(immediate) = 5; ban-T has two
 * leaves → 6; total 11.
 */
function banTreeCtx(banDistribution: { championKey: string; p: number }[], depth: number): NavigatorContext {
    return {
        ourSide: 'red',
        ourCandidates: (state) => (nextSlotOf(state)?.type === 'ban' ? ['S', 'T'] : ['P']),
        enemyDistribution: (_state, slot: NavigatorSlot) =>
            slot.type === 'ban'
                ? banDistribution
                : [
                      { championKey: 'S', p: 0.5 },
                      { championKey: 'Q', p: 0.5 }
                  ],
        evaluate: (_ally, enemy) => (enemy.includes('S') ? 0.4 : enemy.includes('Q') ? 0.55 : 0.5),
        depth
    };
}

const banTreeState = (): DraftState => stateOf(14, 'blue', ['S', 'T', 'W', 'P', 'Q']);

describe('navigate — bans deny the enemy range', () => {
    it('values a ban by what it removes from their future picks', () => {
        const result = navigate(banTreeState(), banTreeCtx([{ championKey: 'W', p: 1 }], 4));
        expect(result.nextSlot).toEqual({ seq: 15, phase: 'ban2', type: 'ban', side: 'red' });
        expect(result.candidates[0].championKey).toBe('S');
        expect(result.candidates[0].actionType).toBe('ban');
        expect(result.candidates[0].value).toBeCloseTo(0.55, 10);
        expect(result.candidates[1].value).toBeCloseTo(0.475, 10);
        expect(result.evaluatedNodes).toBe(11);
    });

    it('builds the full principal variation across bans and picks', () => {
        const result = navigate(banTreeState(), banTreeCtx([{ championKey: 'W', p: 1 }], 4));
        expect(result.candidates[0].line).toEqual(['ban:S', 'ban:W', 'pick:P', 'pick:Q']);
        // Equal masses .5/.5: the representative line keeps the first entry.
        expect(result.candidates[1].line).toEqual(['ban:T', 'ban:W', 'pick:P', 'pick:S']);
    });

    it('skips a slot with an empty range without burning depth', () => {
        // Their ban range is empty (forecast skip) → plies are 15, 17, 18:
        // depth 3 reaches the same leaves as depth 4 above.
        const result = navigate(banTreeState(), banTreeCtx([], 3));
        expect(result.candidates[0].value).toBeCloseTo(0.55, 10);
        expect(result.candidates[1].value).toBeCloseTo(0.475, 10);
    });
});

describe('navigate — memoization', () => {
    it('reuses the injected memo across calls (same values, fewer nodes)', () => {
        const memo = new Map<string, NavigatorMemoEntry>();
        const first = navigate(endgameState(), endgameCtx({ memo }));
        const second = navigate(endgameState(), endgameCtx({ memo }));
        expect(first.evaluatedNodes).toBe(8);
        // Second run: both subtrees hit the memo — only the 2 immediate
        // evaluations are explored anew.
        expect(second.evaluatedNodes).toBe(2);
        expect(second.candidates).toEqual(first.candidates);
    });
});

describe('navigate — performance envelope', () => {
    it('depth 3 / topK 8 with a stub evaluator stays under 200 ms', () => {
        // State through seq 12 → next plies are bans 13/14/15. The candidate
        // generator draws on a 16-champion pool, so every node keeps a full
        // top-8 fan-out even after earlier bans; no memo → exactly
        // 8 × (1 immediate + 1 + 8 × (1 + 8)) = 8 × 74 = 592 nodes.
        const ourKeys = Array.from({ length: 16 }, (_, i) => `o${i}`);
        const theirKeys = Array.from({ length: 16 }, (_, i) => `t${i}`);
        const ctx: NavigatorContext = {
            ourSide: 'red',
            ourCandidates: (state) => ourKeys.filter((k) => state.available.has(k)),
            enemyDistribution: () => theirKeys.map((championKey, i) => ({ championKey, p: (i + 1) / 136 })),
            evaluate: (ally, enemy) => 0.5 + (ally.length - enemy.length) * 0.001,
            depth: 3,
            topK: 8
        };
        const state = stateOf(12, 'blue', [...ourKeys, ...theirKeys]);
        const started = performance.now();
        const result = navigate(state, ctx);
        const elapsed = performance.now() - started;
        expect(result.evaluatedNodes).toBe(592);
        expect(elapsed).toBeLessThan(200);
    });

    it('exports the default config (depth 3, topK 8)', () => {
        expect(DEFAULT_NAVIGATOR_CONFIG).toEqual({ depth: 3, topK: 8 });
    });
});

describe('makeAnalyzeDraftEvaluator — analyzeDraft adapter', () => {
    // Champions with role-concentrated games so inferRoles is unambiguous:
    // ally side stronger (60/55 %) than enemy side (40/45 %).
    const dataset: Dataset = buildMockDataset([
        { key: '1', roles: { [Role.Top]: { wins: 60, games: 100 } } },
        { key: '2', roles: { [Role.Jungle]: { wins: 55, games: 100 } } },
        { key: '6', roles: { [Role.Top]: { wins: 40, games: 100 } } },
        { key: '7', roles: { [Role.Jungle]: { wins: 45, games: 100 } } }
    ]);
    const config: AnalyzeDraftConfig = { ignoreChampionWinrates: false, riskLevel: 'very-high', minGames: 0 };

    it('returns a win probability favouring the stronger comp', () => {
        const evaluate = makeAnalyzeDraftEvaluator({ dataset }, config);
        const value = evaluate(['1', '2'], ['6', '7']);
        expect(value).toBeGreaterThan(0.5);
        expect(value).toBeLessThan(1);
    });

    it('is antisymmetric around 0.5 when the comps are swapped', () => {
        const evaluate = makeAnalyzeDraftEvaluator({ dataset }, config);
        const ab = evaluate(['1', '2'], ['6', '7']);
        const ba = evaluate(['6', '7'], ['1', '2']);
        expect(ab + ba).toBeCloseTo(1, 6);
    });

    it('defaults fullDataset to dataset (same value either way)', () => {
        const a = makeAnalyzeDraftEvaluator({ dataset }, config)(['1'], ['6']);
        const b = makeAnalyzeDraftEvaluator({ dataset, fullDataset: dataset }, config)(['1'], ['6']);
        expect(a).toBe(b);
    });

    it('uses the injected role inferrer (one call per side)', () => {
        let calls = 0;
        const fixedRoles = (picks: string[]): Team => {
            calls += 1;
            return new Map(picks.map((key, i) => [ROLES[i], key]));
        };
        const evaluate = makeAnalyzeDraftEvaluator({ dataset }, config, fixedRoles);
        const value = evaluate(['1', '2'], ['6', '7']);
        expect(calls).toBe(2);
        expect(value).toBeGreaterThan(0.5);
    });
});
