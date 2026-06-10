import { describe, it, expect } from 'vitest';
import {
    collectPassedOver,
    predictEnemyRange,
    surpriseOf,
    type PassedOverEvent,
    type RangeQuery
} from '$lib/strategic/rangeModel';
import { DEFAULT_RANGE_MODEL_CONFIG, type RangeModelConfig } from '$lib/strategic/rangeModelConfig';
import { buildTendencyTable } from '$lib/aggregates/tendency';
import type { DraftAction, DraftPhase, DraftRecord, DraftSide } from '$lib/data/types';
import type { ProPlayer } from '$lib/pro/types';
import type { PresenceEntry } from '$lib/aggregates/presence';
import type { ChampionTag, ChampionTagsFile } from '$lib/tags/types';
import { Role } from '$lib/types';

// ---- local DraftRecord factory (same shape as tendency.test.ts) -------------

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

function game(gameId: string, teams: { blue: string; red: string }, actions: DraftAction[]): DraftRecord {
    return {
        gameId,
        blueTeam: teams.blue,
        redTeam: teams.red,
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-10T00:00:00Z' }
    };
}

/**
 * Enemy corpus for team EN, undated (recency weight 1) and with NO league
 * corpus (effective α = 0) so every tendency p is an exact count ratio:
 *  (B1-B3, blue): bans x,x,x,y           → p(x) = 0.75, p(y) = 0.25
 *  (P1, blue):    picks a,a,b,c          → p(a) = 0.5, p(b) = p(c) = 0.25
 *  (P2-3, red):   picks (a,b),(a,b),(c,d) → p(a) = p(b) = 1/3, p(c) = p(d) = 1/6
 */
const EN_BLUE = { blue: 'EN', red: 'OP' };
const EN_RED = { blue: 'OP', red: 'EN' };
const records: DraftRecord[] = [
    game('r1', EN_BLUE, [ban(1, 'blue', 'x'), pick(7, 'blue', 'a')]),
    game('r2', EN_BLUE, [ban(1, 'blue', 'x'), pick(7, 'blue', 'a')]),
    game('r3', EN_BLUE, [ban(1, 'blue', 'x'), pick(7, 'blue', 'b')]),
    game('r4', EN_BLUE, [ban(1, 'blue', 'y'), pick(7, 'blue', 'c')]),
    game('r5', EN_RED, [pick(8, 'red', 'a'), pick(9, 'red', 'b')]),
    game('r6', EN_RED, [pick(8, 'red', 'a'), pick(9, 'red', 'b')]),
    game('r7', EN_RED, [pick(8, 'red', 'c'), pick(9, 'red', 'd')])
];
const table = buildTendencyTable(records, [], { now: '2026-06-10T00:00:00Z', team: 'EN' });

/** All-ones weights: mass(c) = p_t · w_pool · w_meta · e^coh · decay^passes. */
const CFG: RangeModelConfig = {
    ...DEFAULT_RANGE_MODEL_CONFIG,
    weights: { tendency: 1, pool: 1, meta: 1, coherence: 1, negative: 1 }
};

function query(overrides: Partial<RangeQuery> = {}): RangeQuery {
    return { table, slotGroup: 'P1', side: 'blue', exclude: new Set<string>(), config: CFG, ...overrides };
}

// ---- tag fixtures for the coherence term ------------------------------------
// Vote-table audit (gamePlanClassifier D4, hand-traced):
//  ENGAGE tag (ranged-short, hard-aoe, AD, medium mobility, mid scaling):
//    engage +3 (hard-aoe) and nothing else → distribution = {engage: 1}.
//  SIEGE tag (ranged-long, none, AD, medium, mid):
//    siege +2 (ranged-long) +1 (no engage) = 3; protect +0.5 (none & ranged-long)
//    → {siege: 6/7, protect: 1/7}, engage share = 0.
//  PICK tag (melee, soft-single, AD, high mobility, early):
//    pick 2+1 = 3; engage 1+0.5 = 1.5; split +1 (high mobility melee).
function tag(id: string, partial: Pick<ChampionTag, 'range' | 'engageTool' | 'mobility' | 'scalingWindow'>): ChampionTag {
    return {
        id,
        name: id,
        damageType: 'AD',
        disengageTools: [],
        hyperCarry: false,
        confidence: 'high',
        taggedBy: 'user',
        ...partial
    };
}
const ENGAGE_TAG = { range: 'ranged-short', engageTool: 'hard-aoe', mobility: 'medium', scalingWindow: 'mid' } as const;
const SIEGE_TAG = { range: 'ranged-long', engageTool: 'none', mobility: 'medium', scalingWindow: 'mid' } as const;
const PICK_TAG = { range: 'melee', engageTool: 'soft-single', mobility: 'high', scalingWindow: 'early' } as const;
const TAGS: ChampionTagsFile = {
    version: 'test',
    schemaVersion: 1,
    patchTagged: '26.11',
    lastUpdated: '2026-06-10',
    champions: {
        a: tag('a', ENGAGE_TAG),
        b: tag('b', SIEGE_TAG),
        e1: tag('e1', ENGAGE_TAG),
        s1: tag('s1', SIEGE_TAG),
        p1: tag('p1', PICK_TAG)
        // 'c' deliberately untagged → coherence must stay 0 for it.
    }
};

// ---- pool fixtures -----------------------------------------------------------
// classifyPoolTier (no recency): 25 games → strongest (w 1), 12 → match-ready
// (w 0.7), 5 → scrim-ready (w 0.4); 'b' in no pool → unseen (w 0.05).
const POOLS: ProPlayer[] = [
    {
        id: 'pl1',
        name: 'Joueur 1',
        role: Role.Jungle,
        pool: [
            { championKey: 'a', games: 25, wins: 15 },
            { championKey: 'c', games: 12, wins: 6 }
        ]
    }
];

function presence(championKey: string, value: number): PresenceEntry {
    return { championKey, picks: 0, bans: 0, games: 0, presence: value, pickRate: 0, banRate: 0, wins: 0 };
}

describe('predictEnemyRange — tendency backbone', () => {
    it('with no optional signal, p IS the smoothed tendency posterior (defaults)', () => {
        // Absent pools/meta/comp/passes contribute neutral factors, so with
        // any weights: p = [0.5, 0.25, 0.25] (the P1 count ratios), Σp = 1.
        const range = predictEnemyRange(query({ config: DEFAULT_RANGE_MODEL_CONFIG }));
        expect(range.map((e) => e.championKey)).toEqual(['a', 'b', 'c']);
        expect(range[0].p).toBeCloseTo(0.5, 12);
        expect(range[1].p).toBeCloseTo(0.25, 12);
        expect(range[2].p).toBeCloseTo(0.25, 12);
        expect(range.reduce((s, e) => s + e.p, 0)).toBeCloseTo(1, 12);
        // Component audit: tendency = 1·ln(0.5) = −0.6931471806; the four
        // missing signals are EXACTLY 0 (neutral, not ε-floored).
        expect(range[0].components.tendency).toBeCloseTo(-0.6931471806, 9);
        expect(range[1].components.tendency).toBeCloseTo(-1.3862943611, 9);
        expect(range[0].components.pool).toBe(0);
        expect(range[0].components.meta).toBe(0);
        expect(range[0].components.coherence).toBe(0);
        expect(range[0].components.negative).toBe(0);
        // Evidence = raw predict counts: a picked 2 of 4 P1 observations.
        expect(range[0].evidence).toEqual({ rawCount: 2, total: 4 });
    });

    it('excluded champions disappear and the range renormalizes', () => {
        // predict drops a then renormalizes: b = c = 0.25/0.5 = 0.5.
        const range = predictEnemyRange(query({ exclude: new Set(['a']) }));
        expect(range.map((e) => e.championKey)).toEqual(['b', 'c']);
        expect(range[0].p).toBeCloseTo(0.5, 12);
        expect(range[1].p).toBeCloseTo(0.5, 12);
    });

    it('returns [] when the tendency table never saw the context', () => {
        expect(predictEnemyRange(query({ slotGroup: 'P6' }))).toEqual([]);
    });

    it('w_t = 0 neutralizes the backbone: uniform over the candidates', () => {
        // All scores are 0 → p = 1/3 each; ties resolved by raw count desc
        // (a has 2) then key asc (b before c).
        const config = { ...CFG, weights: { ...CFG.weights, tendency: 0 } };
        const range = predictEnemyRange(query({ config }));
        expect(range.map((e) => e.championKey)).toEqual(['a', 'b', 'c']);
        for (const entry of range) expect(entry.p).toBeCloseTo(1 / 3, 12);
    });
});

describe('predictEnemyRange — pool term', () => {
    it('weights candidates by the probable holder tier (hand-computed)', () => {
        // Masses (all-ones config): a: 0.5·1 = 0.5 ; c: 0.25·0.7 = 0.175 ;
        // b unseen: 0.25·0.05 = 0.0125. Total 0.6875.
        //   p_a = 0.5/0.6875   = 8/11  = 0.7272727273
        //   p_c = 0.175/0.6875 = 14/55 = 0.2545454545
        //   p_b = 0.0125/0.6875 = 1/55 = 0.0181818182
        const range = predictEnemyRange(query({ pools: POOLS }));
        expect(range.map((e) => e.championKey)).toEqual(['a', 'c', 'b']);
        expect(range[0].p).toBeCloseTo(0.7272727273, 9);
        expect(range[1].p).toBeCloseTo(0.2545454545, 9);
        expect(range[2].p).toBeCloseTo(0.0181818182, 9);
        // Pool components: 1·ln(1) = 0 ; 1·ln(0.7) = −0.3566749439 ;
        // 1·ln(0.05) = −2.9957322736.
        expect(range[0].components.pool).toBe(0);
        expect(range[1].components.pool).toBeCloseTo(-0.3566749439, 9);
        expect(range[2].components.pool).toBeCloseTo(-2.9957322736, 9);
    });

    it('the DEEPEST holder across the roster decides (max, not sum)', () => {
        // A second player with a@5 games (scrim-ready, 0.4) must not dilute
        // player 1's strongest (1) — output identical to the single-player case.
        const twoPlayers: ProPlayer[] = [
            ...POOLS,
            { id: 'pl2', name: 'Joueur 2', role: Role.Middle, pool: [{ championKey: 'a', games: 5, wins: 2 }] }
        ];
        expect(predictEnemyRange(query({ pools: twoPlayers }))).toEqual(
            predictEnemyRange(query({ pools: POOLS }))
        );
    });

    it('w_p = 0 neutralizes the pool term', () => {
        const config = { ...CFG, weights: { ...CFG.weights, pool: 0 } };
        const neutral = predictEnemyRange(query({ pools: POOLS, config }));
        expect(neutral.map((e) => e.p)).toEqual(predictEnemyRange(query({ config })).map((e) => e.p));
    });

    it('absent pools mean a neutral factor, never a penalty', () => {
        const range = predictEnemyRange(query());
        expect(range.map((e) => e.p)).toEqual([0.5, 0.25, 0.25].map((p) => expect.closeTo(p, 12)));
    });
});

describe('predictEnemyRange — meta term', () => {
    it('weights by patch presence, ε-flooring champions absent from the map', () => {
        // Masses: a: 0.5·0.8 = 0.4 ; b: 0.25·0.4 = 0.1 ; c absent → ε = 0.001:
        // 0.25·0.001 = 0.00025. Total 0.50025 → exact fractions /2001:
        //   p_a = 1600/2001 = 0.7996001999
        //   p_b =  400/2001 = 0.1999000500
        //   p_c =    1/2001 = 0.0004997501
        const meta = new Map<string, PresenceEntry>([
            ['a', presence('a', 0.8)],
            ['b', presence('b', 0.4)]
        ]);
        const range = predictEnemyRange(query({ meta }));
        expect(range.map((e) => e.championKey)).toEqual(['a', 'b', 'c']);
        expect(range[0].p).toBeCloseTo(0.7996001999, 9);
        expect(range[1].p).toBeCloseTo(0.19990005, 9);
        expect(range[2].p).toBeCloseTo(0.0004997501, 9);
        // Meta components: ln(0.8) = −0.2231435513 ; ln(0.001) = −6.907755279.
        expect(range[0].components.meta).toBeCloseTo(-0.2231435513, 9);
        expect(range[2].components.meta).toBeCloseTo(-6.907755279, 8);
    });

    it('w_m = 0 neutralizes the meta term', () => {
        const meta = new Map<string, PresenceEntry>([['a', presence('a', 0.8)]]);
        const config = { ...CFG, weights: { ...CFG.weights, meta: 0 } };
        const neutral = predictEnemyRange(query({ meta, config }));
        expect(neutral.map((e) => e.p)).toEqual(predictEnemyRange(query({ config })).map((e) => e.p));
    });
});

describe('predictEnemyRange — coherence term (plan fit, M4.2 read-only)', () => {
    it('boosts candidates matching their dominant archetype by e^(w_s·coh)', () => {
        // Their comp ['e1'] reads pure engage (share 1, not ambiguous).
        // Coherence: a (engage tag) = 1 ; b (siege tag, engage share 0) = 0 ;
        // c untagged = 0. Masses: 0.5e, 0.25, 0.25 →
        //   p_a = 0.5e/(0.5e + 0.5) = e/(e+1) = 0.7310585786
        //   p_b = p_c = (1 − p_a)/2  = 0.1344707107
        const range = predictEnemyRange(query({ partialEnemyComp: ['e1'], tagsFile: TAGS }));
        expect(range.map((e) => e.championKey)).toEqual(['a', 'b', 'c']);
        expect(range[0].p).toBeCloseTo(0.7310585786, 9);
        expect(range[1].p).toBeCloseTo(0.1344707107, 9);
        expect(range[2].p).toBeCloseTo(0.1344707107, 9);
        expect(range[0].components.coherence).toBe(1);
        expect(range[1].components.coherence).toBe(0);
        expect(range[2].components.coherence).toBe(0);
    });

    it('an ambiguous plan read attenuates coherence by the config factor', () => {
        // ['e1','s1','p1'] votes: siege 3, split 1, pick 3, protect 0.5,
        // engage 3+1.5 = 4.5 ; total 12 → primary engage at 0.375 < 0.40 →
        // ambiguous → coherence(a) = 1 × 0.5 (default ambiguous factor).
        const range = predictEnemyRange(query({ partialEnemyComp: ['e1', 's1', 'p1'], tagsFile: TAGS }));
        const a = range.find((e) => e.championKey === 'a');
        const b = range.find((e) => e.championKey === 'b');
        expect(a?.components.coherence).toBe(0.5);
        expect(b?.components.coherence).toBe(0);
        expect(a !== undefined && b !== undefined && a.p > b.p).toBe(true);
    });

    it('an unreadable comp (no recognized tag) leaves coherence neutral', () => {
        const range = predictEnemyRange(query({ partialEnemyComp: ['zz'], tagsFile: TAGS }));
        for (const entry of range) expect(entry.components.coherence).toBe(0);
        expect(range.map((e) => e.p)).toEqual([0.5, 0.25, 0.25].map((p) => expect.closeTo(p, 12)));
    });

    it('w_s = 0 neutralizes the coherence term', () => {
        const config = { ...CFG, weights: { ...CFG.weights, coherence: 0 } };
        const neutral = predictEnemyRange(query({ partialEnemyComp: ['e1'], tagsFile: TAGS, config }));
        expect(neutral.map((e) => e.p)).toEqual(predictEnemyRange(query({ config })).map((e) => e.p));
    });
});

describe('predictEnemyRange — negative information (restricted choice)', () => {
    const passedTwice: PassedOverEvent[] = [
        { championKey: 'a', atSlotGroup: 'B1-B3', count: 1 },
        { championKey: 'a', atSlotGroup: 'P1', count: 1 }
    ];

    it('each pass multiplies the odds by the decay: two passes flip the leader', () => {
        // decay 0.6, two passes on a → 0.6² = 0.36.
        // Masses: a 0.5·0.36 = 0.18 ; b = c = 0.25. Total 0.68 →
        //   p_b = p_c = 25/68 = 0.3676470588 ; p_a = 18/68 = 9/34 = 0.2647058824.
        const range = predictEnemyRange(query({ passedOver: passedTwice }));
        expect(range.map((e) => e.championKey)).toEqual(['b', 'c', 'a']);
        expect(range[0].p).toBeCloseTo(0.3676470588, 9);
        expect(range[2].p).toBeCloseTo(0.2647058824, 9);
        // Negative component: 1·2·ln(0.6) = −1.0216512475.
        expect(range[2].components.negative).toBeCloseTo(-1.0216512475, 9);
        expect(range[0].components.negative).toBe(0);
    });

    it('event counts accumulate: one count-2 event ≡ two count-1 events', () => {
        const merged: PassedOverEvent[] = [{ championKey: 'a', atSlotGroup: 'B1-B3', count: 2 }];
        expect(predictEnemyRange(query({ passedOver: merged }))).toEqual(
            predictEnemyRange(query({ passedOver: passedTwice }))
        );
    });

    it('w_n = 0 neutralizes the negative term', () => {
        const config = { ...CFG, weights: { ...CFG.weights, negative: 0 } };
        const neutral = predictEnemyRange(query({ passedOver: passedTwice, config }));
        expect(neutral.map((e) => e.p)).toEqual(predictEnemyRange(query({ config })).map((e) => e.p));
    });
});

describe('predictEnemyRange — closeGroup (white for close calls)', () => {
    it('flags entries within closeGroupFactor of the top', () => {
        // (P2-3, red): p = [1/3, 1/3, 1/6, 1/6]; threshold 0.8·(1/3) = 0.2667
        // → a and b are "too close to call", c and d are clear non-picks.
        const range = predictEnemyRange(query({ slotGroup: 'P2-3', side: 'red' }));
        expect(range.map((e) => e.championKey)).toEqual(['a', 'b', 'c', 'd']);
        expect(range.map((e) => e.closeGroup)).toEqual([true, true, false, false]);
        expect(range[0].p).toBeCloseTo(1 / 3, 12);
        expect(range[2].p).toBeCloseTo(1 / 6, 12);
    });
});

describe('predictEnemyRange — components audit (DA-V2-12)', () => {
    it('exp(Σ components), renormalized, reproduces p with every signal active', () => {
        const range = predictEnemyRange(
            query({
                pools: POOLS,
                meta: new Map([
                    ['a', presence('a', 0.8)],
                    ['b', presence('b', 0.4)]
                ]),
                partialEnemyComp: ['e1'],
                tagsFile: TAGS,
                passedOver: [{ championKey: 'a', atSlotGroup: 'B1-B3', count: 1 }]
            })
        );
        const masses = range.map((e) => {
            const c = e.components;
            return Math.exp(c.tendency + c.pool + c.meta + c.coherence + c.negative);
        });
        const total = masses.reduce((s, m) => s + m, 0);
        range.forEach((entry, i) => expect(masses[i] / total).toBeCloseTo(entry.p, 12));
        expect(range.reduce((s, e) => s + e.p, 0)).toBeCloseTo(1, 12);
        // Spot-check a's five terms: ln(0.5), ln(1), ln(0.8), 1, ln(0.6).
        const a = range.find((e) => e.championKey === 'a');
        expect(a?.components.tendency).toBeCloseTo(-0.6931471806, 9);
        expect(a?.components.pool).toBe(0);
        expect(a?.components.meta).toBeCloseTo(-0.2231435513, 9);
        expect(a?.components.coherence).toBe(1);
        expect(a?.components.negative).toBeCloseTo(-0.5108256238, 9);
    });
});

describe('surpriseOf', () => {
    const range = predictEnemyRange(query()); // [a 0.5, b 0.25, c 0.25]

    it('a top-of-range pick carries 1 bit and no alarm', () => {
        // bits = −log2(0.5) = 1 ; rank 1 ; in range (k = 8) ; 1 < 5 → no alarm.
        expect(surpriseOf('a', range, CFG)).toEqual({ inRange: true, rank: 1, bits: 1, alarm: false });
    });

    it('ranks follow the range order and bits its probability', () => {
        // c sorts 3rd (tie with b broken by key) ; bits = −log2(0.25) = 2.
        const report = surpriseOf('c', range, CFG);
        expect(report.rank).toBe(3);
        expect(report.bits).toBeCloseTo(2, 12);
        expect(report.inRange).toBe(true);
        expect(report.alarm).toBe(false);
    });

    it('an out-of-range pick is ε-floored and raises the alarm', () => {
        // Absent → rank = length+1 = 4, bits = −log2(0.001) = 9.9657842847 ≥ 5.
        const report = surpriseOf('z', range, CFG);
        expect(report.inRange).toBe(false);
        expect(report.rank).toBe(4);
        expect(report.bits).toBeCloseTo(9.9657842847, 9);
        expect(report.alarm).toBe(true);
    });

    it('respects the configured k and alarm threshold', () => {
        // k = 2: c is found at rank 3 → out of range despite being listed.
        expect(surpriseOf('c', range, { ...CFG, surpriseK: 2 }).inRange).toBe(false);
        // Threshold 2 bits: c carries exactly 2 → alarm (≥ comparison).
        expect(surpriseOf('c', range, { ...CFG, surpriseAlarmBits: 2 }).alarm).toBe(true);
    });
});

describe('collectPassedOver', () => {
    // Live draft, enemy EN on blue (their tendencies: ban x 75 %, pick a 50 %).
    // EN bans q,r,s (seq 1,3,5) — passing on x ; we ban y,m,n (seq 2,4,6).
    // EN first-picks b (seq 7) — passing on a ; we pick o (seq 8).
    const live: DraftAction[] = [
        ban(1, 'blue', 'q'),
        ban(2, 'red', 'y'),
        ban(3, 'blue', 'r'),
        ban(4, 'red', 'm'),
        ban(5, 'blue', 's'),
        ban(6, 'red', 'n'),
        pick(7, 'blue', 'b'),
        pick(8, 'red', 'o')
    ];
    const strict: RangeModelConfig = { ...DEFAULT_RANGE_MODEL_CONFIG, passedOverMinP: 0.3 };

    it('derives one event per (priority champion, completed group)', () => {
        // minP 0.3 → B1-B3 priorities: x (0.75) ; y (0.25) is sub-threshold
        // AND taken by us at seq 2. P1 priorities: a (0.5) passed, b taken,
        // c (0.25) sub-threshold.
        expect(collectPassedOver(live, table, 'blue', strict)).toEqual([
            { championKey: 'x', atSlotGroup: 'B1-B3', count: 1 },
            { championKey: 'a', atSlotGroup: 'P1', count: 1 }
        ]);
    });

    it('the default threshold (0.2) also surfaces the passed c (0.25)', () => {
        expect(collectPassedOver(live, table, 'blue')).toEqual([
            { championKey: 'x', atSlotGroup: 'B1-B3', count: 1 },
            { championKey: 'a', atSlotGroup: 'P1', count: 1 },
            { championKey: 'c', atSlotGroup: 'P1', count: 1 }
        ]);
    });

    it('never concludes mid-group: a still-open phase yields no events', () => {
        // Through seq 6 the draft has not moved PAST B1-B3 (max seq = 6):
        // the enemy could in principle still act in a later comparable slot.
        expect(collectPassedOver(live.slice(0, 6), table, 'blue', strict)).toEqual([]);
    });

    it('a champion unavailable before the group cannot be "passed over"', () => {
        // We ban a at seq 2 → at P1, predict excludes a and renormalizes:
        // b = c = 0.5 ; EN picks b → only c is passed (0.5 ≥ 0.3).
        const aBanned: DraftAction[] = [
            ban(1, 'blue', 'q'),
            ban(2, 'red', 'a'),
            ban(3, 'blue', 'r'),
            ban(4, 'red', 'm'),
            ban(5, 'blue', 's'),
            ban(6, 'red', 'n'),
            pick(7, 'blue', 'b'),
            pick(8, 'red', 'o')
        ];
        expect(collectPassedOver(aBanned, table, 'blue', strict)).toEqual([
            { championKey: 'x', atSlotGroup: 'B1-B3', count: 1 },
            { championKey: 'c', atSlotGroup: 'P1', count: 1 }
        ]);
    });

    it('accepts a DraftRecord as source (same result as the raw actions)', () => {
        const record = game('live', EN_BLUE, live);
        expect(collectPassedOver(record, table, 'blue', strict)).toEqual(
            collectPassedOver(live, table, 'blue', strict)
        );
    });

    it('feeds predictEnemyRange: the collected pass decays a multiplicatively', () => {
        // Events: x@B1-B3 (no P1 effect), a@P1. P1 range with b picked:
        // tendencies renormalize to a = 2/3, c = 1/3 ; a decayed ×0.6 →
        // masses 0.4 vs 1/3 → p_a = 6/11 = 0.5454545455, p_c = 5/11.
        const events = collectPassedOver(live, table, 'blue', strict);
        const range = predictEnemyRange(query({ exclude: new Set(['b']), passedOver: events }));
        expect(range.map((e) => e.championKey)).toEqual(['a', 'c']);
        expect(range[0].p).toBeCloseTo(0.5454545455, 9);
        expect(range[1].p).toBeCloseTo(0.4545454545, 9);
    });
});
