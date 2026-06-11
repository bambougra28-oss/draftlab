import { describe, it, expect } from 'vitest';
import { banEV, DEFAULT_BAN_EV_CONFIG, type BanEvContext } from '$lib/strategic/banEv';
import type { RangeEntry } from '$lib/strategic/rangeModel';
import type { CombinationAsset } from '$lib/aggregates/combinations';
import type { SlotGroup } from '$lib/aggregates/tendency';

/** Minimal valid RangeEntry — banEV only reads championKey and p. */
function entry(championKey: string, p: number): RangeEntry {
    return {
        championKey,
        p,
        components: { tendency: 0, pool: 0, meta: 0, coherence: 0, negative: 0 },
        evidence: { rawCount: 0, total: 0 },
        closeGroup: false
    };
}

/**
 * Injected I1 ranges for the two upcoming enemy slots:
 *   P7:   c 0.4, d 0.35, e 0.25
 *   P8-9: c 0.3, e 0.3, f 0.4
 * → takeProbability: c 0.7, d 0.35, e 0.55, f 0.4, others 0.
 */
const RANGES = new Map<SlotGroup, RangeEntry[]>([
    ['P7', [entry('c', 0.4), entry('d', 0.35), entry('e', 0.25)]],
    ['P8-9', [entry('f', 0.4), entry('c', 0.3), entry('e', 0.3)]]
]);

function ctx(overrides: Partial<BanEvContext> = {}): BanEvContext {
    return {
        upcomingSlotGroups: ['P7', 'P8-9'],
        rangeFor: (slotGroup) => RANGES.get(slotGroup) ?? [],
        ...overrides
    };
}

/**
 * Enemy prepared pairs: total asset weight = 5 + 3 + 4 = 12 games.
 * structural(c) = (5+3)/12 = 2/3 ; structural(d) = (5+4)/12 = 0.75 ; f → 0.
 */
const ASSETS: CombinationAsset[] = [
    { championKeys: ['c', 'd'], kind: 'botlane', games: 5, wins: 3 },
    { championKeys: ['c', 'e'], kind: 'midjungle', games: 3, wins: 2 },
    { championKeys: ['d', 'e'], kind: 'other', games: 4, wins: 1 }
];

describe('banEV — expected damage against the field', () => {
    it('sums take probability over the upcoming slots and applies the default drop', () => {
        // ev = tp · defaultDrop (1.5 pp, no assets):
        //   c: 0.7·1.5 = 1.05 ; f: 0.4·1.5 = 0.6 ; d: 0.35·1.5 = 0.525 ; z: 0.
        const result = banEV(['c', 'd', 'f', 'z'], ctx());
        expect(result.map((e) => e.championKey)).toEqual(['c', 'f', 'd', 'z']);
        expect(result[0].ev).toBeCloseTo(1.05, 12);
        expect(result[1].ev).toBeCloseTo(0.6, 12);
        expect(result[2].ev).toBeCloseTo(0.525, 12);
        expect(result[3].ev).toBe(0);
        expect(result[0].components.takeProbability).toBeCloseTo(0.7, 12);
        expect(result[0].components.damage).toBe(1.5);
        expect(result[0].components.structural).toBe(0);
    });

    it('uses the injected replacement-drop curve when provided', () => {
        // c drops 3 pp, others 1 pp: c 0.7·3 = 2.1 ; f 0.4 ; d 0.35.
        const result = banEV(['c', 'd', 'f'], ctx({ replacementDrop: (key) => (key === 'c' ? 3 : 1) }));
        expect(result.map((e) => e.championKey)).toEqual(['c', 'f', 'd']);
        expect(result[0].ev).toBeCloseTo(2.1, 12);
        expect(result[0].components.damage).toBe(3);
        expect(result[1].components.damage).toBe(1);
    });

    it('adds normalized structural damage (share of prepared-pair weight)', () => {
        // structural: c 8/12, d 9/12, f 0 ; structuralPp default 1 →
        //   ev_c = 0.7·(1.5 + 2/3)  = 0.7·2.1666667 = 1.5166666667
        //   ev_d = 0.35·(1.5 + 0.75) = 0.35·2.25     = 0.7875
        //   ev_f = 0.4·1.5                            = 0.6
        const result = banEV(['c', 'd', 'f'], ctx({ structuralAssets: ASSETS }));
        expect(result.map((e) => e.championKey)).toEqual(['c', 'd', 'f']);
        expect(result[0].ev).toBeCloseTo(1.5166666667, 9);
        expect(result[1].ev).toBeCloseTo(0.7875, 12);
        expect(result[2].ev).toBeCloseTo(0.6, 12);
        expect(result[0].components.structural).toBeCloseTo(0.6666666667, 9);
        expect(result[1].components.structural).toBeCloseTo(0.75, 12);
        expect(result[2].components.structural).toBe(0);
    });

    it('config drives the structural pp value (DA-V2-6)', () => {
        // structuralPp 2 → ev_c = 0.7·(1.5 + 2·2/3) = 0.7·2.8333333 = 1.9833333333.
        const config = { ...DEFAULT_BAN_EV_CONFIG, structuralPp: 2 };
        const result = banEV(['c'], ctx({ structuralAssets: ASSETS, config }));
        expect(result[0].ev).toBeCloseTo(1.9833333333, 9);
    });

    it('a Fearless-consumed champion is worth exactly 0, with a dedicated rationale', () => {
        // c would top the list (ev 1.05) but is consumed → forced to 0 and
        // sorted last; its components are zeroed (a would-be value for an
        // impossible pick would mislead).
        const result = banEV(['c', 'd'], ctx({ fearlessConsumed: new Set(['c']) }));
        expect(result.map((e) => e.championKey)).toEqual(['d', 'c']);
        expect(result[1].ev).toBe(0);
        expect(result[1].components).toEqual({
            takeProbability: 0,
            banAttraction: 0,
            damage: 0,
            structural: 0,
            threat: 0
        });
        expect(result[1].rationaleFr).toEqual(['Déjà consommé en Fearless — un ban serait gaspillé']);
    });

    it('explains each component in coach French', () => {
        // tp 0.7 → « 70 % cumulés » ; default drop 1.5 pp ; c touches 2 assets
        // backed by 8 games.
        const result = banEV(['c'], ctx({ structuralAssets: ASSETS }));
        expect(result[0].rationaleFr).toEqual([
            'Sortie attendue : 70 % cumulés sur les slots à venir',
            'Si pris : −1.5 pp vers leur remplaçant',
            'Détruit 2 combinaison(s) préparée(s) (poids 8 games)'
        ]);
    });

    it('a candidate outside every range reads « aucune sortie attendue »', () => {
        const result = banEV(['z'], ctx({ structuralAssets: ASSETS }));
        expect(result[0].ev).toBe(0);
        expect(result[0].rationaleFr).toEqual(['Aucune sortie attendue sur les slots à venir']);
    });

    it('evaluates duplicated candidates once', () => {
        const result = banEV(['c', 'c'], ctx());
        expect(result).toHaveLength(1);
    });

    it('calls the injected range provider exactly once per upcoming slot', () => {
        let calls = 0;
        const counting = ctx({
            rangeFor: (slotGroup) => {
                calls += 1;
                return RANGES.get(slotGroup) ?? [];
            }
        });
        banEV(['c', 'd', 'f'], counting);
        expect(calls).toBe(2);
    });

    it('breaks ev ties by take probability, then by champion key', () => {
        // g: 0.5·1 = 0.5 and h: 0.25·2 = 0.5 (exact binary fractions) →
        // equal ev, g first on tp 0.5 > 0.25.
        const tieRanges = new Map<SlotGroup, RangeEntry[]>([['P7', [entry('g', 0.5), entry('h', 0.25)]]]);
        const tie = banEV(['h', 'g'], {
            upcomingSlotGroups: ['P7'],
            rangeFor: (slotGroup) => tieRanges.get(slotGroup) ?? [],
            replacementDrop: (key) => (key === 'h' ? 2 : 1)
        });
        expect(tie.map((e) => e.championKey)).toEqual(['g', 'h']);
        expect(tie[0].ev).toBe(0.5);
        expect(tie[1].ev).toBe(0.5);
        // Full tie (both absent from every range) → key ascending.
        const zeros = banEV(['z2', 'z1'], ctx());
        expect(zeros.map((e) => e.championKey)).toEqual(['z1', 'z2']);
    });

    it('with no upcoming slot every ban is worth 0 (nothing left to deny)', () => {
        const result = banEV(['c', 'd'], ctx({ upcomingSlotGroups: [] }));
        expect(result.map((e) => e.ev)).toEqual([0, 0]);
        expect(result.map((e) => e.championKey)).toEqual(['c', 'd']);
    });
});

describe('banEV — demand floor from suffered bans (B-ban-history §1.2)', () => {
    it('the floor binds: demand = γ·attraction when it beats the take probability', () => {
        // d: takeP 0.35 (RANGES), provider 0.6, γ 1 → demand 0.6 → ev = 0.6·1.5 = 0.9.
        const result = banEV(['d'], ctx({ banAttraction: () => 0.6 }));
        expect(result[0].ev).toBeCloseTo(0.9, 12);
        expect(result[0].components.takeProbability).toBeCloseTo(0.35, 12);
        expect(result[0].components.banAttraction).toBe(0.6);
    });

    it('pure censoring (takeP 0): the suffered-ban channel alone carries the ban', () => {
        // z sits outside every range — the perma-ban shape picks cannot see.
        // demand = max(0, 1·0.6) = 0.6 → ev = 0.6·1.5 = 0.9 ; the demand line
        // leads, the exit cost shows (demand > 0), no « Aucune sortie attendue ».
        const result = banEV(['z'], ctx({ banAttraction: () => 0.6 }));
        expect(result[0].ev).toBeCloseTo(0.9, 12);
        expect(result[0].components.takeProbability).toBe(0);
        expect(result[0].components.banAttraction).toBe(0.6);
        expect(result[0].rationaleFr).toEqual([
            'Demande révélée par les bans subis : banni contre eux ~60 % des games',
            'Si pris : −1.5 pp vers leur remplaçant'
        ]);
    });

    it('the floor does not bind: tendency demand wins, evs and order unchanged', () => {
        // Provider 0.2 for both: c max(0.7, 0.2) = 0.7 → 1.05 ; d max(0.35, 0.2)
        // = 0.35 → 0.525 ; order stays c > d.
        const result = banEV(['c', 'd'], ctx({ banAttraction: () => 0.2 }));
        expect(result.map((e) => e.championKey)).toEqual(['c', 'd']);
        expect(result[0].ev).toBeCloseTo(1.05, 12);
        expect(result[1].ev).toBeCloseTo(0.525, 12);
        expect(result[0].components.banAttraction).toBe(0.2);
    });

    it('γ scales the floor through the config (DA-V2-6)', () => {
        // γ 0.5, provider 0.6 on d → max(0.35, 0.3) = 0.35 → ev = 0.35·1.5 = 0.525.
        const config = { ...DEFAULT_BAN_EV_CONFIG, banAttractionGamma: 0.5 };
        const result = banEV(['d'], ctx({ banAttraction: () => 0.6, config }));
        expect(result[0].ev).toBeCloseTo(0.525, 12);
        // Reported raw, unweighted by γ.
        expect(result[0].components.banAttraction).toBe(0.6);
    });

    it('composition regime reports the raw provider value but its EV ignores it', () => {
        // Same numbers as the no-provider composition case: ev = 0.3·3 = 0.9.
        const result = banEV(
            ['z'],
            ctx({ regime: 'composition', threatPp: () => 3, banAttraction: () => 0.4 })
        );
        expect(result[0].ev).toBeCloseTo(0.9, 10);
        expect(result[0].components.banAttraction).toBe(0.4);
        expect(result[0].components.threat).toBe(3);
    });

    it('the « Demande révélée » line appears iff the floor binds, in first position', () => {
        const bound = banEV(['d'], ctx({ banAttraction: () => 0.6 }));
        expect(bound[0].rationaleFr).toEqual([
            'Demande révélée par les bans subis : banni contre eux ~60 % des games',
            'Sortie attendue : 35 % cumulés sur les slots à venir',
            'Si pris : −1.5 pp vers leur remplaçant'
        ]);
        // Floor not binding (0.2 < takeP 0.7): no demand line at all.
        const unbound = banEV(['c'], ctx({ banAttraction: () => 0.2 }));
        expect(unbound[0].rationaleFr).toEqual([
            'Sortie attendue : 70 % cumulés sur les slots à venir',
            'Si pris : −1.5 pp vers leur remplaçant'
        ]);
    });
});

describe('banEV — composition regime (phase 2, draft science §E)', () => {
    // threat-driven: 'z' is never in their tendencies (take 0) but
    // hard-counters our comp (+3 pp); 'c' is their comfort (take 0.7)
    // but neutral against our revealed comp.
    const compositionCtx = ctx({
        regime: 'composition',
        threatPp: (key: string) => (key === 'z' ? 3 : 0)
    });

    it('ranks the comp-counter above the comfort pick, components separated', () => {
        const result = banEV(['z', 'c'], compositionCtx);
        expect(result[0].championKey).toBe('z');
        // plausibility floor 0.3 (take = 0) → ev = 0.3 · 3 = 0.9.
        expect(result[0].ev).toBeCloseTo(0.9, 10);
        expect(result[0].components.threat).toBe(3);
        expect(result[0].components.damage).toBe(0);
        // 'c': threat 0 → ev 0 despite a 0.7 take probability.
        expect(result[1].championKey).toBe('c');
        expect(result[1].ev).toBe(0);
        expect(result[1].components.takeProbability).toBeCloseTo(0.7, 10);
    });

    it('plausibility scales with tendency: floor + (1−floor)·take', () => {
        const threatBoth = ctx({ regime: 'composition', threatPp: () => 2 });
        const result = banEV(['z', 'c'], threatBoth);
        // 'c' take 0.7 → (0.3 + 0.7·0.7) · 2 = 1.58 ; 'z' take 0 → 0.3·2 = 0.6.
        const c = result.find((e) => e.championKey === 'c')!;
        const z = result.find((e) => e.championKey === 'z')!;
        expect(c.ev).toBeCloseTo(1.58, 10);
        expect(z.ev).toBeCloseTo(0.6, 10);
        expect(result[0].championKey).toBe('c');
    });

    it('negative threat clamps to 0 (never reward banning what loses to us)', () => {
        const result = banEV(['z'], ctx({ regime: 'composition', threatPp: () => -5 }));
        expect(result[0].ev).toBe(0);
        expect(result[0].components.threat).toBe(-5);
        expect(result[0].rationaleFr.some((r) => r.includes('Aucune menace'))).toBe(true);
    });

    it('fearless-consumed still zeroes everything in composition regime', () => {
        const result = banEV(['z'], ctx({
            regime: 'composition',
            threatPp: () => 4,
            fearlessConsumed: new Set(['z'])
        }));
        expect(result[0].ev).toBe(0);
        expect(result[0].rationaleFr[0]).toContain('Fearless');
    });
});
