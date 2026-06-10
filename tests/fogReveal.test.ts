import { describe, it, expect } from 'vitest';
import {
    ambiguityBits,
    baitLedger,
    fogValue,
    revelationCost,
    roleAssignmentHypotheses,
    type BaitContext,
    type FogEvalContext,
    type Hypothesis,
    type RolePriors
} from '$lib/strategic/fogReveal';
import { DEFAULT_FOG_REVEAL_CONFIG, type FogRevealConfig } from '$lib/strategic/fogRevealConfig';
import { Role } from '$lib/types';

// ---- fixtures ----------------------------------------------------------------

function priorsOf(table: Record<string, Partial<Record<Role, number>>>): RolePriors {
    return (championKey) => table[championKey] ?? {};
}

function hyp(p: number, entries: Array<[Role, string]>): Hypothesis {
    return { assignment: new Map(entries), p };
}

function cfg(overrides: Partial<FogRevealConfig>): FogRevealConfig {
    return { ...DEFAULT_FOG_REVEAL_CONFIG, ...overrides };
}

/**
 * The §6 bis worked example: a flexes top 0.6 / mid 0.4, b flexes top 0.5 /
 * mid 0.5. Injective assignments and their weights:
 *   (a Top, b Mid): 0.6·0.5 = 0.30      (a Mid, b Top): 0.4·0.5 = 0.20
 * total 0.50 → normalized p = 0.6 / 0.4.
 */
const FLEX_PRIORS = priorsOf({
    a: { [Role.Top]: 0.6, [Role.Middle]: 0.4 },
    b: { [Role.Top]: 0.5, [Role.Middle]: 0.5 }
});

/** BR stub for the worked example: 0.52 when a is top, 0.48 when a is mid. */
const brOfWorkedExample = (assignment: Map<Role, string>): number =>
    assignment.get(Role.Top) === 'a' ? 0.52 : 0.48;

interface CountingCtx extends FogEvalContext {
    uncertainCalls: () => number;
}

/** Eval context with a call counter on the uncertainty evaluator. */
function evalCtx(br: (assignment: Map<Role, string>) => number, uncertain: number): CountingCtx {
    let calls = 0;
    return {
        enemyBestResponse: br,
        enemyBestResponseUnderUncertainty: () => {
            calls += 1;
            return uncertain;
        },
        uncertainCalls: () => calls
    };
}

// ---- roleAssignmentHypotheses -------------------------------------------------

describe('roleAssignmentHypotheses', () => {
    it('empty comp → one certain empty hypothesis (nothing to read, 0 bits)', () => {
        const hypotheses = roleAssignmentHypotheses([], FLEX_PRIORS);
        expect(hypotheses).toHaveLength(1);
        expect(hypotheses[0].p).toBe(1);
        expect(hypotheses[0].assignment.size).toBe(0);
        expect(ambiguityBits(hypotheses)).toBe(0);
    });

    it('one one-role pick → a single certain hypothesis', () => {
        const hypotheses = roleAssignmentHypotheses(['k'], priorsOf({ k: { [Role.Top]: 1 } }));
        expect(hypotheses).toHaveLength(1);
        expect(hypotheses[0].p).toBe(1);
        expect(hypotheses[0].assignment.get(Role.Top)).toBe('k');
    });

    it('one flex pick 0.7/0.3 → two hypotheses, normalized, p descending', () => {
        // Weights 0.7 (Top) and 0.3 (Middle) already sum to 1 → p unchanged.
        const hypotheses = roleAssignmentHypotheses(
            ['k'],
            priorsOf({ k: { [Role.Top]: 0.7, [Role.Middle]: 0.3 } })
        );
        expect(hypotheses).toHaveLength(2);
        expect(hypotheses[0].assignment.get(Role.Top)).toBe('k');
        expect(hypotheses[0].p).toBeCloseTo(0.7, 12);
        expect(hypotheses[1].assignment.get(Role.Middle)).toBe('k');
        expect(hypotheses[1].p).toBeCloseTo(0.3, 12);
        expect(hypotheses[0].p + hypotheses[1].p).toBeCloseTo(1, 12);
    });

    it('a pick with a null prior (no playable role) → no hypothesis at all', () => {
        expect(roleAssignmentHypotheses(['k'], priorsOf({}))).toEqual([]);
        expect(roleAssignmentHypotheses(['a', 'k'], FLEX_PRIORS)).toEqual([]); // k unknown kills every map
    });

    it('non-positive and non-finite prior weights are not playable', () => {
        // Only Middle (0.5) survives the filter → single certain hypothesis.
        const hypotheses = roleAssignmentHypotheses(
            ['k'],
            priorsOf({
                k: { [Role.Top]: 0, [Role.Jungle]: -1, [Role.Middle]: 0.5, [Role.Bottom]: NaN, [Role.Support]: Infinity }
            })
        );
        expect(hypotheses).toHaveLength(1);
        expect(hypotheses[0].p).toBe(1);
        expect(hypotheses[0].assignment.get(Role.Middle)).toBe('k');
    });

    it('the §6 bis worked example: two flex picks → hypotheses 0.6/0.4', () => {
        // Hand audit (fixture comment): weights 0.30 / 0.20, total 0.50.
        const hypotheses = roleAssignmentHypotheses(['a', 'b'], FLEX_PRIORS);
        expect(hypotheses).toHaveLength(2);
        expect(hypotheses[0].p).toBeCloseTo(0.6, 12);
        expect(hypotheses[0].assignment.get(Role.Top)).toBe('a');
        expect(hypotheses[0].assignment.get(Role.Middle)).toBe('b');
        expect(hypotheses[1].p).toBeCloseTo(0.4, 12);
        expect(hypotheses[1].assignment.get(Role.Top)).toBe('b');
        expect(hypotheses[1].assignment.get(Role.Middle)).toBe('a');
    });

    it('two picks competing for the only shared role → [] (no injective map)', () => {
        const topOnly = priorsOf({ a: { [Role.Top]: 1 }, b: { [Role.Top]: 0.9 } });
        expect(roleAssignmentHypotheses(['a', 'b'], topOnly)).toEqual([]);
    });

    it('a forced chain normalizes its single surviving weight to p = 1', () => {
        // a must Top; b's Top branch dies → Jungle (0.2); c's Jungle branch
        // dies → Middle (0.5). Single leaf, raw weight 1·0.2·0.5 = 0.1 → p 1.
        const hypotheses = roleAssignmentHypotheses(
            ['a', 'b', 'c'],
            priorsOf({
                a: { [Role.Top]: 1 },
                b: { [Role.Top]: 0.8, [Role.Jungle]: 0.2 },
                c: { [Role.Jungle]: 0.5, [Role.Middle]: 0.5 }
            })
        );
        expect(hypotheses).toHaveLength(1);
        expect(hypotheses[0].p).toBe(1);
        expect(hypotheses[0].assignment.get(Role.Top)).toBe('a');
        expect(hypotheses[0].assignment.get(Role.Jungle)).toBe('b');
        expect(hypotheses[0].assignment.get(Role.Middle)).toBe('c');
    });

    it('five 5-role flexes → the full 5! = 120 maps, uniform, deterministic order', () => {
        const uniform: Partial<Record<Role, number>> = {
            [Role.Top]: 0.2,
            [Role.Jungle]: 0.2,
            [Role.Middle]: 0.2,
            [Role.Bottom]: 0.2,
            [Role.Support]: 0.2
        };
        const picks = ['a', 'b', 'c', 'd', 'e'];
        const hypotheses = roleAssignmentHypotheses(picks, () => uniform);
        expect(hypotheses).toHaveLength(120);
        expect(hypotheses[0].p).toBeCloseTo(1 / 120, 12);
        expect(hypotheses.reduce((s, h) => s + h.p, 0)).toBeCloseTo(1, 9);
        // All p equal → canonical assignment order decides: the first map is
        // the identity '0:a|1:b|2:c|3:d|4:e', the last reverses to
        // '0:e|1:d|2:c|3:b|4:a' (lexicographic max).
        expect([...hypotheses[0].assignment.entries()].sort((x, y) => x[0] - y[0])).toEqual([
            [Role.Top, 'a'],
            [Role.Jungle, 'b'],
            [Role.Middle, 'c'],
            [Role.Bottom, 'd'],
            [Role.Support, 'e']
        ]);
        expect([...hypotheses[119].assignment.entries()].sort((x, y) => x[0] - y[0])).toEqual([
            [Role.Top, 'e'],
            [Role.Jungle, 'd'],
            [Role.Middle, 'c'],
            [Role.Bottom, 'b'],
            [Role.Support, 'a']
        ]);
    });

    it('maxHypotheses caps the tail and renormalizes the survivors', () => {
        // p = [0.5 Top, 0.25 Jungle, 0.25 Middle] (Jungle before Middle: equal
        // p → canonical '1:k' < '2:k'). Cap 2 keeps 0.5 + 0.25 = 0.75 →
        // renormalized 0.5/0.75 = 2/3 and 0.25/0.75 = 1/3.
        const priors = priorsOf({ k: { [Role.Top]: 0.5, [Role.Jungle]: 0.25, [Role.Middle]: 0.25 } });
        const hypotheses = roleAssignmentHypotheses(['k'], priors, cfg({ maxHypotheses: 2 }));
        expect(hypotheses).toHaveLength(2);
        expect(hypotheses[0].assignment.get(Role.Top)).toBe('k');
        expect(hypotheses[0].p).toBeCloseTo(2 / 3, 12);
        expect(hypotheses[1].assignment.get(Role.Jungle)).toBe('k');
        expect(hypotheses[1].p).toBeCloseTo(1 / 3, 12);
    });

    it('minHypothesisP floors out noise maps and renormalizes', () => {
        // Same distribution; floor 0.3 drops both 0.25 maps → single map at
        // p = 0.5/0.5 = 1.
        const priors = priorsOf({ k: { [Role.Top]: 0.5, [Role.Jungle]: 0.25, [Role.Middle]: 0.25 } });
        const hypotheses = roleAssignmentHypotheses(['k'], priors, cfg({ minHypothesisP: 0.3 }));
        expect(hypotheses).toHaveLength(1);
        expect(hypotheses[0].p).toBe(1);
        expect(hypotheses[0].assignment.get(Role.Top)).toBe('k');
    });
});

// ---- ambiguityBits -------------------------------------------------------------

describe('ambiguityBits', () => {
    it('two uniform hypotheses → exactly 1 bit', () => {
        // −2·(0.5·log2 0.5) = −2·(0.5·−1) = 1, exact in fp.
        const bits = ambiguityBits([hyp(0.5, [[Role.Top, 'a']]), hyp(0.5, [[Role.Middle, 'a']])]);
        expect(bits).toBe(1);
    });

    it('a single certain hypothesis → 0 bits, never −0', () => {
        // −(1·log2 1) = −0 in IEEE → the guard must return +0.
        const bits = ambiguityBits([hyp(1, [[Role.Top, 'a']])]);
        expect(Object.is(bits, 0)).toBe(true);
        expect(Object.is(bits, -0)).toBe(false);
    });

    it('no hypothesis → 0 bits', () => {
        expect(ambiguityBits([])).toBe(0);
    });

    it('0.6/0.4 → 0.970950594455 bits (hand-computed)', () => {
        // −0.6·log2(0.6) − 0.4·log2(0.4)
        //   = 0.6·0.7369655941662062 + 0.4·1.3219280948873623
        //   = 0.4421793564997237 + 0.5287712379549449 = 0.9709505944546686.
        const bits = ambiguityBits([hyp(0.6, [[Role.Top, 'a']]), hyp(0.4, [[Role.Middle, 'a']])]);
        expect(bits).toBeCloseTo(0.9709505944546686, 12);
    });

    it('four uniform hypotheses → exactly 2 bits', () => {
        // −4·(0.25·log2 0.25) = −4·(0.25·−2) = 2, exact in fp.
        const bits = ambiguityBits([
            hyp(0.25, [[Role.Top, 'a']]),
            hyp(0.25, [[Role.Jungle, 'a']]),
            hyp(0.25, [[Role.Middle, 'a']]),
            hyp(0.25, [[Role.Bottom, 'a']])
        ]);
        expect(bits).toBe(2);
    });
});

// ---- fogValue ------------------------------------------------------------------

describe('fogValue', () => {
    it('the §6 bis worked example: known 0.504, uncertain 0.49 → fog 0.014', () => {
        // knownEquity = 0.6·0.52 + 0.4·0.48 = 0.312 + 0.192 = 0.504;
        // uncertain (stub) = 0.49 → fog = 0.504 − 0.49 = 0.014.
        const after = [
            hyp(0.6, [[Role.Top, 'a'], [Role.Middle, 'b']]),
            hyp(0.4, [[Role.Top, 'b'], [Role.Middle, 'a']])
        ];
        const ctx = evalCtx(brOfWorkedExample, 0.49);
        const report = fogValue('b', { before: [hyp(1, [[Role.Top, 'a']])], after }, ctx);
        expect(report.championKey).toBe('b');
        expect(report.components.knownEquity).toBeCloseTo(0.504, 12);
        expect(report.components.uncertainEquity).toBe(0.49);
        expect(report.components.fog).toBeCloseTo(0.014, 12);
        expect(report.remainingAmbiguityBits).toBeCloseTo(0.9709505944546686, 12);
        expect(report.experimental).toBe(true);
    });

    it('end-to-end: hypotheses from the enumerator reproduce the worked example', () => {
        // roleAssignmentHypotheses(['a','b']) → 0.6/0.4 (audited above), so
        // the whole pipeline yields the same E = 0.504 and fog = 0.014.
        const before = roleAssignmentHypotheses(['a'], FLEX_PRIORS);
        const after = roleAssignmentHypotheses(['a', 'b'], FLEX_PRIORS);
        const report = fogValue('b', { before, after }, evalCtx(brOfWorkedExample, 0.49));
        expect(report.components.knownEquity).toBeCloseTo(0.504, 12);
        expect(report.components.fog).toBeCloseTo(0.014, 12);
    });

    it('a fully resolved state has fog EXACTLY 0 and skips the uncertainty evaluator', () => {
        // Singleton hypothesis: nothing is hidden → uncertain ≡ known by
        // definition; the injected uncertainty stub (0.99, deliberately
        // absurd) must not even be consulted.
        const after = roleAssignmentHypotheses(['solo'], priorsOf({ solo: { [Role.Top]: 1 } }));
        const ctx = evalCtx(() => 0.47, 0.99);
        const report = fogValue('solo', { before: after, after }, ctx);
        expect(report.components.knownEquity).toBe(0.47);
        expect(report.components.uncertainEquity).toBe(0.47);
        expect(report.components.fog).toBe(0);
        expect(report.remainingAmbiguityBits).toBe(0);
        expect(ctx.uncertainCalls()).toBe(0);
    });

    it('an impossible state (no hypothesis) zeroes every component', () => {
        const report = fogValue('x', { before: [], after: [] }, evalCtx(() => 0.5, 0.5));
        expect(report.components).toEqual({ knownEquity: 0, uncertainEquity: 0, fog: 0 });
        expect(report.remainingAmbiguityBits).toBe(0);
    });

    it('a noisy evaluator can yield a negative fog — reported as-is, never clamped', () => {
        // Theory says Φ ≥ 0 (Jensen); with injected approximations the engine
        // must still show what it measured (DA-V2-12): known = 0.5, uncertain
        // stub = 0.51 → fog = −0.01.
        const after = [
            hyp(0.5, [[Role.Top, 'a'], [Role.Middle, 'b']]),
            hyp(0.5, [[Role.Top, 'b'], [Role.Middle, 'a']])
        ];
        const report = fogValue('b', { before: [], after }, evalCtx(() => 0.5, 0.51));
        expect(report.components.fog).toBeCloseTo(-0.01, 12);
    });

    it('fog conditions on the after-state only (before does not change Φ)', () => {
        const after = [
            hyp(0.5, [[Role.Top, 'a'], [Role.Middle, 'b']]),
            hyp(0.5, [[Role.Top, 'b'], [Role.Middle, 'a']])
        ];
        const ctx = evalCtx(brOfWorkedExample, 0.49);
        const wide = fogValue('b', { before: after, after }, ctx);
        const narrow = fogValue('b', { before: [hyp(1, [[Role.Top, 'a']])], after }, ctx);
        expect(wide.components).toEqual(narrow.components);
    });
});

// ---- revelationCost ------------------------------------------------------------

describe('revelationCost', () => {
    const TWO_UNIFORM: Hypothesis[] = [
        hyp(0.5, [[Role.Top, 'a'], [Role.Middle, 'b']]),
        hyp(0.5, [[Role.Top, 'b'], [Role.Middle, 'a']])
    ];

    it('a resolving pick loses 1 bit and unlocks their counters', () => {
        // before: 2 uniform maps = 1 bit; after: singleton = 0 bits → loss 1.
        // Gain = BR(after map, short-circuit) − BRu(before, stub):
        // 0.51 − 0.47 = 0.04. The uncertainty evaluator runs ONCE (before only).
        const after = [hyp(1, [[Role.Top, 'a'], [Role.Middle, 'b'], [Role.Bottom, 'x']])];
        const ctx = evalCtx((m) => (m.get(Role.Bottom) === 'x' ? 0.51 : 0.4), 0.47);
        const report = revelationCost('x', TWO_UNIFORM, after, ctx);
        expect(report.championKey).toBe('x');
        expect(report.entropyLossBits).toBe(1);
        expect(report.unlockedCounterGain).toBeCloseTo(0.04, 12);
        expect(ctx.uncertainCalls()).toBe(1);
        expect(report.experimental).toBe(true);
    });

    it('a flex pick can DEEPEN the fog: negative entropy loss', () => {
        // before: certain (0 bits); after: 2 uniform maps (1 bit) → loss −1.
        // Gain = BRu(after, stub 0.50) − BR(before map, 0.46) = 0.04.
        const before = [hyp(1, [[Role.Top, 'a']])];
        const ctx = evalCtx(() => 0.46, 0.5);
        const report = revelationCost('b', before, TWO_UNIFORM, ctx);
        expect(report.entropyLossBits).toBe(-1);
        expect(report.unlockedCounterGain).toBeCloseTo(0.04, 12);
    });

    it('singleton-to-singleton uses the known BR on both sides (no uncertainty call)', () => {
        const before = [hyp(1, [[Role.Top, 'a']])];
        const after = [hyp(1, [[Role.Top, 'a'], [Role.Bottom, 'b']])];
        const ctx = evalCtx((m) => (m.get(Role.Bottom) === 'b' ? 0.5 : 0.46), 0.99);
        const report = revelationCost('b', before, after, ctx);
        expect(report.entropyLossBits).toBe(0);
        expect(report.unlockedCounterGain).toBeCloseTo(0.04, 12);
        expect(ctx.uncertainCalls()).toBe(0);
    });

    it('an empty side is unreadable and contributes a neutral 0 equity', () => {
        const ctx = evalCtx(() => 0.5, 0.47);
        // after impossible: gain = 0 − BRu(before) = −0.47; loss = 1 − 0 = 1.
        const dead = revelationCost('x', TWO_UNIFORM, [], ctx);
        expect(dead.entropyLossBits).toBe(1);
        expect(dead.unlockedCounterGain).toBeCloseTo(-0.47, 12);
        // before impossible: gain = BR(after) − 0 = 0.5; loss = 0 − 0 = 0.
        const born = revelationCost('x', [], [hyp(1, [[Role.Top, 'a']])], ctx);
        expect(born.entropyLossBits).toBe(0);
        expect(born.unlockedCounterGain).toBe(0.5);
    });

    it('chained on the enumerator: a one-role teammate resolves the flex', () => {
        // before = H(['a']) = 0.6/0.4 → 0.9709505944546686 bits (audited
        // above). after = H(['a','b']) with b top-only: a's Top branch dies,
        // single map {Mid: a, Top: b} → 0 bits. Loss = 0.9709505944546686.
        // Gain = BR(after map: top is b → 0.53) − BRu(before, stub 0.49) = 0.04.
        const priors = priorsOf({ a: { [Role.Top]: 0.6, [Role.Middle]: 0.4 }, b: { [Role.Top]: 1 } });
        const before = roleAssignmentHypotheses(['a'], priors);
        const after = roleAssignmentHypotheses(['a', 'b'], priors);
        expect(after).toHaveLength(1);
        expect(after[0].assignment.get(Role.Middle)).toBe('a');
        const ctx = evalCtx((m) => (m.get(Role.Top) === 'b' ? 0.53 : 0.5), 0.49);
        const report = revelationCost('b', before, after, ctx);
        expect(report.entropyLossBits).toBeCloseTo(0.9709505944546686, 12);
        expect(report.unlockedCounterGain).toBeCloseTo(0.04, 12);
    });
});

// ---- baitLedger ----------------------------------------------------------------

interface BaitFixture {
    p: number;
    our: number;
    their: number;
}

function baitCtx(table: Record<string, BaitFixture>, overrides: Partial<BaitContext> = {}): BaitContext {
    return {
        takeProbability: (k) => table[k]?.p ?? 0,
        theirEquityIfTaken: (k) => table[k]?.their ?? 0.5,
        ourPreparedAnswerEquity: (k) => table[k]?.our ?? 0.5,
        ...overrides
    };
}

describe('baitLedger', () => {
    it('the §6 bis formula, hand-computed: ev = P·(ours − theirs) + (1−P)·option', () => {
        // P 0.3, ours 0.55, theirs 0.52, option 0.01:
        //   takenBranch = 0.3·0.03 = 0.009 ; keptBranch = 0.7·0.01 = 0.007
        //   ev = 0.016 ≥ baitGoodEv 0.01 → bait verdict.
        const [entry] = baitLedger(['c'], baitCtx({ c: { p: 0.3, our: 0.55, their: 0.52 } }, { optionValue: 0.01 }));
        expect(entry.championKey).toBe('c');
        expect(entry.components.takenBranch).toBeCloseTo(0.009, 12);
        expect(entry.components.keptBranch).toBeCloseTo(0.007, 12);
        expect(entry.ev).toBeCloseTo(0.016, 12);
        expect(entry.components.takeProbability).toBe(0.3);
        expect(entry.components.ourAnswerEquity).toBe(0.55);
        expect(entry.components.theirEquity).toBe(0.52);
        expect(entry.components.optionValue).toBe(0.01);
        expect(entry.verdictFr).toBe('Appât rentable — à laisser ouvert');
        expect(entry.experimental).toBe(true);
    });

    it('without ctx.optionValue the config default (0) applies — and a losing bait reads as a trap', () => {
        // P 0.5, ours 0.50, theirs 0.56 → ev = 0.5·(−0.06) + 0.5·0 = −0.03
        // ≤ baitTrapEv −0.01 → trap verdict; keptBranch exactly 0.
        const [entry] = baitLedger(['t'], baitCtx({ t: { p: 0.5, our: 0.5, their: 0.56 } }));
        expect(entry.ev).toBeCloseTo(-0.03, 12);
        expect(Object.is(entry.components.keptBranch, 0)).toBe(true);
        expect(entry.verdictFr).toBe('Piège — le laisser ouvert nous coûte (à bannir ou à prendre)');
    });

    it('an ev between the thresholds reads neutral', () => {
        // P 0.2, ours 0.51, theirs 0.50 → ev = 0.2·0.01 = 0.002 ∈ (−0.01, 0.01).
        const [entry] = baitLedger(['n'], baitCtx({ n: { p: 0.2, our: 0.51, their: 0.5 } }));
        expect(entry.ev).toBeCloseTo(0.002, 12);
        expect(entry.verdictFr).toBe('Neutre — ni appât ni piège net');
    });

    it('verdict thresholds are injectable (DA-V2-6)', () => {
        // Same 0.002 ev; lowering baitGoodEv to 0.001 flips the verdict.
        const ctx = baitCtx({ n: { p: 0.2, our: 0.51, their: 0.5 } }, { config: cfg({ baitGoodEv: 0.001 }) });
        expect(baitLedger(['n'], ctx)[0].verdictFr).toBe('Appât rentable — à laisser ouvert');
    });

    it('take probability is clamped to [0, 1] (a banEv-style Σ may exceed 1)', () => {
        // over: P 1.4 → 1: ev = 1·(0.625−0.5) + 0·0.0625 = 0.125.
        // under: P −0.2 → 0: takenBranch = 0·(−0.2) = 0 (the −0 guard), ev =
        // option = 0.0625.
        const ctx = baitCtx(
            { over: { p: 1.4, our: 0.625, their: 0.5 }, under: { p: -0.2, our: 0.4, their: 0.6 } },
            { optionValue: 0.0625 }
        );
        const entries = baitLedger(['over', 'under'], ctx);
        const over = entries.find((e) => e.championKey === 'over')!;
        const under = entries.find((e) => e.championKey === 'under')!;
        expect(over.components.takeProbability).toBe(1);
        expect(over.ev).toBe(0.125);
        expect(Object.is(over.components.keptBranch, 0)).toBe(true);
        expect(under.components.takeProbability).toBe(0);
        expect(Object.is(under.components.takenBranch, -0)).toBe(false);
        expect(Object.is(under.components.takenBranch, 0)).toBe(true);
        expect(under.ev).toBe(0.0625);
    });

    it('sorts ev desc, then take probability desc, then key asc — and dedupes', () => {
        // Binary-exact fractions so the ties are EXACT:
        //   z: 1·(0.625−0.5)        = 0.125
        //   x: 0.5·(0.5625−0.5)     = 0.03125 (P 0.5)
        //   y: 0.25·(0.625−0.5)     = 0.03125 (P 0.25)
        //   a: 0.25·(0.625−0.5)     = 0.03125 (P 0.25 → ties y, 'a' < 'y')
        //   b: 0.0625·(1−0.5)       = 0.03125 (P 0.0625)
        // Order: z, then the 0.03125 group by P desc (x), key asc (a, y), b.
        const ctx = baitCtx({
            z: { p: 1, our: 0.625, their: 0.5 },
            x: { p: 0.5, our: 0.5625, their: 0.5 },
            y: { p: 0.25, our: 0.625, their: 0.5 },
            a: { p: 0.25, our: 0.625, their: 0.5 },
            b: { p: 0.0625, our: 1, their: 0.5 }
        });
        const entries = baitLedger(['y', 'x', 'x', 'b', 'a', 'z'], ctx);
        expect(entries.map((e) => e.championKey)).toEqual(['z', 'x', 'a', 'y', 'b']);
        expect(entries.map((e) => e.ev)).toEqual([0.125, 0.03125, 0.03125, 0.03125, 0.03125]);
        expect(baitLedger([], ctx)).toEqual([]);
    });

    it('audit (DA-V2-12): ev is exactly takenBranch + keptBranch on every entry', () => {
        const ctx = baitCtx(
            {
                c: { p: 0.3, our: 0.55, their: 0.52 },
                t: { p: 0.5, our: 0.5, their: 0.56 },
                n: { p: 0.2, our: 0.51, their: 0.5 }
            },
            { optionValue: 0.01 }
        );
        const entries = baitLedger(['c', 't', 'n'], ctx);
        expect(entries).toHaveLength(3);
        for (const entry of entries) {
            expect(entry.ev).toBe(entry.components.takenBranch + entry.components.keptBranch);
            expect(entry.experimental).toBe(true);
        }
    });
});

// ---- config --------------------------------------------------------------------

describe('DEFAULT_FOG_REVEAL_CONFIG', () => {
    it('documents the uncalibrated behaviour defaults (G4 re-fits them)', () => {
        expect(DEFAULT_FOG_REVEAL_CONFIG).toEqual({
            minHypothesisP: 0,
            maxHypotheses: 120,
            baitGoodEv: 0.01,
            baitTrapEv: -0.01,
            defaultOptionValue: 0
        });
    });
});
