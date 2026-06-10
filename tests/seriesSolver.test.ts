import { describe, expect, it } from 'vitest';
import { mulberry32 } from '$lib/backtest/metrics';
import type { ChampionPoolEntry } from '$lib/pro/types';
import {
    afterGame,
    denialValue,
    gameWinEstimate,
    maxGames,
    mustWinAnalysis,
    poolIntegrity,
    retentionValue,
    seriesValue,
    winsNeeded,
    type SeriesState,
    type SeriesValueMemo
} from '$lib/strategic/seriesSolver';
import { DEFAULT_SERIES_SOLVER_CONFIG, type SeriesSolverConfig } from '$lib/strategic/seriesSolverConfig';
import { Role, ROLES } from '$lib/types';

/*
 * Shared arithmetic for every hand computation below.
 * Posteriors (shrinkWinrate, priorMean .5, priorN 10):
 *   5/10  → (5+5)/(10+10)  = .50      8/10 → (8+5)/(10+10) = .65
 *   2/10  → (2+5)/(10+10)  = .35
 * Pool quality = mean over the 5 roles of the best remaining posterior
 * (empty role → .25); p = clamp(.5 + qualityWeight·ΔQ + depthWeight·ΔD).
 * Test config zeroes depthWeight and the FS edges unless a case sets them,
 * so the hand numbers stay one-variable.
 */
function testConfig(
    over: {
        sideEdge?: number;
        pickEdge?: number;
        qualityWeight?: number;
        depthWeight?: number;
        puntNetThreshold?: number;
    } = {}
): SeriesSolverConfig {
    return {
        gameWin: {
            priorMean: 0.5,
            priorN: 10,
            qualityWeight: over.qualityWeight ?? 1,
            depthWeight: over.depthWeight ?? 0,
            depthCap: 3,
            emptyRoleQuality: 0.25,
            pMin: 0.05,
            pMax: 0.95
        },
        firstSelection: { sideEdge: over.sideEdge ?? 0, pickEdge: over.pickEdge ?? 0 },
        integrity: { samples: 500, minPoolPerRole: 2, defaultSeed: 1 },
        mustWin: { puntNetThreshold: over.puntNetThreshold ?? 0.01, assetsPerRole: 1 }
    };
}

const entry = (championKey: string, wins: number, games: number): ChampionPoolEntry => ({
    championKey,
    wins,
    games
});

type Pools = Partial<Record<Role, ChampionPoolEntry[]>>;

/** One 5/10 champion per role (posterior exactly .5), keys `${prefix}${role}`. */
function evenPools(prefix: string): Pools {
    const pools: Pools = {};
    for (const role of ROLES) pools[role] = [entry(`${prefix}${role}`, 5, 10)];
    return pools;
}

function stateOf(over: Partial<SeriesState> = {}): SeriesState {
    return {
        gameNumber: 1,
        format: 'bo3',
        score: { ally: 0, enemy: 0 },
        mode: 'fearless',
        poolsBySide: { ally: evenPools('a'), enemy: evenPools('e') },
        consumed: new Set<string>(),
        ...over
    };
}

describe('format helpers & config', () => {
    it('winsNeeded / maxGames follow the format', () => {
        expect(winsNeeded('bo3')).toBe(2);
        expect(winsNeeded('bo5')).toBe(3);
        expect(maxGames('bo3')).toBe(3);
        expect(maxGames('bo5')).toBe(5);
    });

    it('default config is coherent (DA-V2-6 sanity)', () => {
        const cfg = DEFAULT_SERIES_SOLVER_CONFIG;
        expect(cfg.gameWin.priorN).toBe(10);
        expect(cfg.gameWin.pMin).toBeLessThan(cfg.gameWin.pMax);
        expect(cfg.integrity.samples).toBe(500);
        expect(cfg.firstSelection.sideEdge).toBeGreaterThanOrEqual(cfg.firstSelection.pickEdge);
    });
});

describe('afterGame — First Selection goes to the loser (2026 rule)', () => {
    it('advances score/gameNumber and hands FS to the loser', () => {
        const state = stateOf();
        const won = afterGame(state, 'ally');
        expect(won.gameNumber).toBe(2);
        expect(won.score).toEqual({ ally: 1, enemy: 0 });
        expect(won.firstSelectionHolder).toBe('enemy');
        const lost = afterGame(state, 'enemy');
        expect(lost.score).toEqual({ ally: 0, enemy: 1 });
        expect(lost.firstSelectionHolder).toBe('ally');
        // Frozen-pool recursion: pools and consumed are carried as-is.
        expect(won.poolsBySide).toBe(state.poolsBySide);
        expect(won.consumed).toBe(state.consumed);
    });
});

describe('poolIntegrity — Monte-Carlo comp completeness', () => {
    /** n distinct champions per role, keys `${prefix}${role}-${j}`. */
    function deepPools(prefix: string, n: number): Pools {
        const pools: Pools = {};
        for (const role of ROLES) {
            pools[role] = Array.from({ length: n }, (_, j) => entry(`${prefix}${role}-${j}`, 5, 10));
        }
        return pools;
    }

    it('full disjoint pools sample complete comps every time', () => {
        const state = stateOf({ poolsBySide: { ally: deepPools('a', 2), enemy: deepPools('e', 2) } });
        const result = poolIntegrity(state, 'ally', { rng: mulberry32(7), config: testConfig() });
        expect(result.integrity).toBe(1);
        expect(result.samples).toBe(500);
        for (const role of result.byRole) {
            expect(role.failures).toBe(0);
            expect(role.remaining).toBe(2);
            expect(role.belowMinimum).toBe(false); // 2 < 2 is false
        }
    });

    it('a fully consumed role zeroes integrity and names the bottleneck', () => {
        const state = stateOf({
            poolsBySide: { ally: deepPools('a', 1), enemy: deepPools('e', 1) },
            consumed: new Set([`a${Role.Top}-0`])
        });
        const result = poolIntegrity(state, 'ally', { rng: mulberry32(7), config: testConfig() });
        expect(result.integrity).toBe(0);
        expect(result.bottleneckRole).toBe(Role.Top);
        const top = result.byRole.find((r) => r.role === Role.Top);
        expect(top?.failures).toBe(500);
        expect(top?.remaining).toBe(0);
    });

    /*
     * Flex-overlap pools: Top [A,B] · Jungle [B,C] · Middle [C,A] · Bot [D] ·
     * Sup [E]. Scarcest-first order: Bot, Sup (forced), then Top, Jungle,
     * Middle. The only failing path is Top=A then Jungle=C (Middle's {C,A}
     * both used) → P(fail) = .5 × .5 = .25, so integrity ≈ .75 (σ ≈ .019 at
     * 500 samples) and EVERY failure is attributed to Middle.
     */
    const flexPools = (): Pools => ({
        [Role.Top]: [entry('A', 5, 10), entry('B', 5, 10)],
        [Role.Jungle]: [entry('B', 5, 10), entry('C', 5, 10)],
        [Role.Middle]: [entry('C', 5, 10), entry('A', 5, 10)],
        [Role.Bottom]: [entry('D', 5, 10)],
        [Role.Support]: [entry('E', 5, 10)]
    });

    it('overlapping flex pools land near the theoretical .75', () => {
        const state = stateOf({ poolsBySide: { ally: flexPools(), enemy: evenPools('e') } });
        const result = poolIntegrity(state, 'ally', { rng: mulberry32(42), config: testConfig() });
        expect(Math.abs(result.integrity - 0.75)).toBeLessThan(0.07);
        expect(result.bottleneckRole).toBe(Role.Middle);
        const middle = result.byRole.find((r) => r.role === Role.Middle);
        // Failures and successes partition the samples exactly.
        expect(result.integrity + (middle?.failures ?? 0) / result.samples).toBe(1);
    });

    it('is deterministic for a given seed', () => {
        const state = stateOf({ poolsBySide: { ally: flexPools(), enemy: evenPools('e') } });
        const a = poolIntegrity(state, 'ally', { rng: mulberry32(42), config: testConfig() });
        const b = poolIntegrity(state, 'ally', { rng: mulberry32(42), config: testConfig() });
        expect(a.integrity).toBe(b.integrity);
        expect(a.byRole).toEqual(b.byRole);
    });

    it('flags roles under minPoolPerRole', () => {
        const state = stateOf({ poolsBySide: { ally: flexPools(), enemy: evenPools('e') } });
        const result = poolIntegrity(state, 'ally', { rng: mulberry32(1), minPoolPerRole: 2, config: testConfig() });
        const flagged = result.byRole.filter((r) => r.belowMinimum).map((r) => r.role);
        expect(flagged).toEqual([Role.Bottom, Role.Support]);
    });

    it('honours the samples option and the default deterministic rng', () => {
        const state = stateOf({ poolsBySide: { ally: flexPools(), enemy: evenPools('e') } });
        const small = poolIntegrity(state, 'ally', { samples: 50, rng: mulberry32(9), config: testConfig() });
        expect(small.samples).toBe(50);
        // No rng injected → seeded default → reproducible across calls.
        const a = poolIntegrity(state, 'ally', { config: testConfig() });
        const b = poolIntegrity(state, 'ally', { config: testConfig() });
        expect(a.integrity).toBe(b.integrity);
    });
});

describe('gameWinEstimate — documented pool heuristic', () => {
    it('symmetric pools give exactly .5 and components sum to p', () => {
        const result = gameWinEstimate(stateOf(), { config: testConfig() });
        expect(result.p).toBe(0.5);
        const sum = result.components.reduce((s, c) => s + c.value, 0);
        expect(sum).toBeCloseTo(result.p, 12);
    });

    it('quality edge: one 8/10 Top star moves p to .53', () => {
        // Q_ally = (.65 + 4×.5)/5 = .53 ; Q_enemy = .5 → p = .5 + .03.
        const ally = evenPools('a');
        ally[Role.Top] = [entry('X', 8, 10), entry('Y', 5, 10)];
        const result = gameWinEstimate(stateOf({ poolsBySide: { ally, enemy: evenPools('e') } }), {
            config: testConfig()
        });
        expect(result.p).toBeCloseTo(0.53, 10);
        expect(result.components[1].value).toBeCloseTo(0.03, 10);
    });

    it('an empty enemy role costs them the near-forfeit floor (.25)', () => {
        // Q_enemy = (.25 + 4×.5)/5 = .45 → p = .5 + (.5 − .45) = .55.
        const enemy = evenPools('e');
        delete enemy[Role.Top];
        const result = gameWinEstimate(stateOf({ poolsBySide: { ally: evenPools('a'), enemy } }), {
            config: testConfig()
        });
        expect(result.p).toBeCloseTo(0.55, 10);
    });

    it('depth edge: D_ally 1 vs D_enemy 13/15 at depthWeight .1', () => {
        // All winrates 5/10 → quality cancels. Ally 3 champs/role → D = 1;
        // enemy Top has 1 champ → D = (1/3 + 4)/5 = 13/15;
        // p = .5 + .1 × (1 − 13/15) = .5 + .1 × 2/15.
        const allyPools: Pools = {};
        const enemyPools: Pools = {};
        for (const role of ROLES) {
            allyPools[role] = [0, 1, 2].map((j) => entry(`a${role}-${j}`, 5, 10));
            enemyPools[role] =
                role === Role.Top ? [entry('e-top', 5, 10)] : [0, 1, 2].map((j) => entry(`e${role}-${j}`, 5, 10));
        }
        const result = gameWinEstimate(stateOf({ poolsBySide: { ally: allyPools, enemy: enemyPools } }), {
            config: testConfig({ depthWeight: 0.1 })
        });
        expect(result.p).toBeCloseTo(0.5 + 0.1 * (2 / 15), 12);
    });

    it('clamps to pMax while components keep the raw sum', () => {
        // Q .65 vs .35, weight 10 → raw p = .5 + 3 = 3.5 → clamp .95.
        const ally: Pools = {};
        const enemy: Pools = {};
        for (const role of ROLES) {
            ally[role] = [entry(`a${role}`, 8, 10)];
            enemy[role] = [entry(`e${role}`, 2, 10)];
        }
        const result = gameWinEstimate(stateOf({ poolsBySide: { ally, enemy } }), {
            config: testConfig({ qualityWeight: 10 })
        });
        expect(result.p).toBe(0.95);
        expect(result.components.reduce((s, c) => s + c.value, 0)).toBeCloseTo(3.5, 10);
    });

    it('an injected estimator replaces the heuristic (still clamped)', () => {
        const cfg = testConfig();
        const injected = gameWinEstimate(stateOf(), { estimateGameWin: () => 0.62, config: cfg });
        expect(injected.p).toBe(0.62);
        expect(injected.components).toEqual([{ reason: 'Estimateur de game injecté', value: 0.62 }]);
        expect(gameWinEstimate(stateOf(), { estimateGameWin: () => 2, config: cfg }).p).toBe(0.95);
    });

    it('consumed champions leave the quality computation', () => {
        // Ally Top star consumed → best Top is Y (.5) → back to p = .5.
        const ally = evenPools('a');
        ally[Role.Top] = [entry('X', 8, 10), entry('Y', 5, 10)];
        const state = stateOf({ poolsBySide: { ally, enemy: evenPools('e') }, consumed: new Set(['X']) });
        expect(gameWinEstimate(state, { config: testConfig() }).p).toBe(0.5);
    });
});

describe('seriesValue — V(σ) recursion', () => {
    it('terminal states are 1 (series won) / 0 (series lost)', () => {
        const won = seriesValue(stateOf({ score: { ally: 2, enemy: 0 }, gameNumber: 3 }), { config: testConfig() });
        expect(won).toEqual({ value: 1, terminal: true, game: null, firstSelection: null, components: null });
        const lost = seriesValue(stateOf({ score: { ally: 0, enemy: 2 }, gameNumber: 3 }), { config: testConfig() });
        expect(lost.value).toBe(0);
        expect(lost.terminal).toBe(true);
    });

    it('bo3 at constant p=.6: V = .648 (hand recursion)', () => {
        // V(1-1) = .6 ; V(1-0) = .6 + .4×.6 = .84 ; V(0-1) = .6×.6 = .36 ;
        // V(0-0) = .6×.84 + .4×.36 = .648.
        const result = seriesValue(stateOf(), { estimateGameWin: () => 0.6, config: testConfig() });
        expect(result.value).toBeCloseTo(0.648, 12);
        expect(result.terminal).toBe(false);
        expect(result.firstSelection).toBeNull(); // no holder known at game 1
        expect(result.game?.p).toBe(0.6);
        expect(result.components?.pUsed).toBe(0.6);
        expect(result.components?.winBranchValue).toBeCloseTo(0.84, 12);
        expect(result.components?.loseBranchValue).toBeCloseTo(0.36, 12);
    });

    it('bo5 at p=.5 is exactly .5 (symmetry invariant)', () => {
        const result = seriesValue(stateOf({ format: 'bo5' }), { estimateGameWin: () => 0.5, config: testConfig() });
        expect(result.value).toBeCloseTo(0.5, 12);
    });

    /*
     * FS hand case (p .5 everywhere, sideEdge .1, pickEdge 0, bo3):
     *   V(1-1, ally holds)  = max(.6, .5)·1 = .6      (side branch)
     *   V(1-1, enemy holds) = min(.4, .5)   = .4
     *   V(1-0, enemy holds) : side .4 + .6×.6 = .76 ; pick .5 + .5×.6 = .8
     *                         → enemy takes SIDE (.76 hurts us most)
     *   V(0-1, ally holds)  : side .6×.4 = .24 ; pick .5×.4 = .2 → SIDE .24
     *   V(0-0, ally holds)  : side .6×.76 + .4×.24 = .552 ; pick .5 → SIDE.
     */
    const fsCtx = () => ({ estimateGameWin: () => 0.5, config: testConfig({ sideEdge: 0.1, pickEdge: 0 }) });

    it('ally FS holder maximizes over side|pick and exposes the advice', () => {
        const result = seriesValue(stateOf({ firstSelectionHolder: 'ally' }), fsCtx());
        expect(result.value).toBeCloseTo(0.552, 12);
        expect(result.firstSelection).not.toBeNull();
        expect(result.firstSelection?.recommended).toBe('side');
        expect(result.firstSelection?.valueSide).toBeCloseTo(0.552, 12);
        expect(result.firstSelection?.valuePick).toBeCloseTo(0.5, 12);
        expect(result.components?.pUsed).toBeCloseTo(0.6, 12);
        expect(result.components?.winBranchValue).toBeCloseTo(0.76, 12);
        expect(result.components?.loseBranchValue).toBeCloseTo(0.24, 12);
    });

    it('enemy FS holder minimizes our value (their best branch)', () => {
        const result = seriesValue(
            stateOf({ score: { ally: 1, enemy: 1 }, gameNumber: 3, firstSelectionHolder: 'enemy' }),
            fsCtx()
        );
        expect(result.value).toBeCloseTo(0.4, 12);
        expect(result.firstSelection?.recommended).toBe('side');
        expect(result.firstSelection?.valueSide).toBeCloseTo(0.4, 12);
        expect(result.firstSelection?.valuePick).toBeCloseTo(0.5, 12);
    });

    it('the loser-FS handover is encoded in the branches (V(1-0, enemy FS) = .76)', () => {
        const result = seriesValue(
            stateOf({ score: { ally: 1, enemy: 0 }, gameNumber: 2, firstSelectionHolder: 'enemy' }),
            fsCtx()
        );
        expect(result.value).toBeCloseTo(0.76, 12);
    });

    it('a tie between side and pick recommends side', () => {
        const result = seriesValue(stateOf({ firstSelectionHolder: 'ally' }), {
            estimateGameWin: () => 0.6,
            config: testConfig() // both edges 0 → branches tie
        });
        expect(result.firstSelection?.recommended).toBe('side');
        expect(result.value).toBeCloseTo(0.648, 12);
    });

    it('the injected memo short-circuits recomputation', () => {
        let calls = 0;
        const ctx = {
            estimateGameWin: () => {
                calls += 1;
                return 0.5;
            },
            config: testConfig()
        };
        const memo: SeriesValueMemo = new Map();
        const first = seriesValue(stateOf({ format: 'bo5' }), ctx, memo);
        const callsAfterFirst = calls;
        expect(callsAfterFirst).toBeGreaterThan(0);
        const second = seriesValue(stateOf({ format: 'bo5' }), ctx, memo);
        expect(calls).toBe(callsAfterFirst); // pure memo hit
        expect(second.value).toBe(first.value);
    });
});

/*
 * Retention fixture: ally Top [X 8/10, Y 5/10], every other role one 5/10
 * champion on both sides; bo3 0-0; depth/FS weights zeroed.
 *   p(spend X)  = .53 (X counted)        p(save X) = .50 (X withheld)
 *   Branches with X consumed   : p .5  → V⁺₊ = .75    V⁻₊ = .25
 *   Branches with X kept       : p .53 → V⁺₀ = .53×1.47 = .7791
 *                                        V⁻₀ = .53² = .2809
 *   valueSpend = .53×.75 + .47×.25  = .515
 *   valueSave  = .50×.7791 + .50×.2809 = .530
 *   nowGain    = (.53−.50)×(.75−.25) = .015
 *   futureLoss = .5×(.75−.7791) + .5×(.25−.2809) = −.03
 *   net        = −.015  → keep X.
 */
function retentionState(over: Partial<SeriesState> = {}): SeriesState {
    const ally = evenPools('a');
    ally[Role.Top] = [entry('X', 8, 10), entry('Y', 5, 10)];
    return stateOf({ poolsBySide: { ally, enemy: evenPools('e') }, ...over });
}

describe('retentionValue — spend now vs save', () => {
    it('matches the hand finite difference on the Top star', () => {
        const result = retentionValue('X', retentionState(), { config: testConfig() });
        expect(result.valueSpend).toBeCloseTo(0.515, 9);
        expect(result.valueSave).toBeCloseTo(0.53, 9);
        expect(result.nowGain).toBeCloseTo(0.015, 9);
        expect(result.futureLoss).toBeCloseTo(-0.03, 9);
        expect(result.net).toBeCloseTo(-0.015, 9);
    });

    it('decomposition is exact: net = nowGain + futureLoss', () => {
        const result = retentionValue('X', retentionState(), { config: testConfig() });
        expect(result.nowGain + result.futureLoss).toBeCloseTo(result.net, 12);
    });

    it('in the decider there is no future: spending is pure nowGain', () => {
        // At 1-1 both branches are terminal (V⁺ = 1, V⁻ = 0) whatever is
        // consumed → futureLoss = 0 and net = (.53 − .50)×1 = .03.
        const state = retentionState({ score: { ally: 1, enemy: 1 }, gameNumber: 3 });
        const result = retentionValue('X', state, { config: testConfig() });
        expect(result.futureLoss).toBeCloseTo(0, 12);
        expect(result.nowGain).toBeCloseTo(0.03, 9);
        expect(result.net).toBeCloseTo(0.03, 9);
    });

    it('returns a zero difference on terminal states', () => {
        const result = retentionValue('X', retentionState({ score: { ally: 2, enemy: 0 } }), { config: testConfig() });
        expect(result.net).toBe(0);
        expect(result.valueSpend).toBe(result.valueSave);
    });
});

/*
 * Denial fixture: enemy Top [Z 8/10, W 5/10] → default replacement drop =
 * .65 − .50 = .15. Injected estimate p = .5 → reach(g2) = 1 and reach(g3) =
 * P(1-1 after two games) = 2×.5×.5 = .5 (bo3 from 0-0).
 * With want ≡ .5 :  total = .5×1×.15 + .5×.5×.15 = .075 + .0375 = .1125.
 */
function denialState(over: Partial<SeriesState> = {}): SeriesState {
    const enemy = evenPools('e');
    enemy[Role.Top] = [entry('Z', 8, 10), entry('W', 5, 10)];
    return stateOf({ poolsBySide: { ally: evenPools('a'), enemy }, ...over });
}

describe('denialValue — Benoît-Krishna price', () => {
    const baseCtx = () => ({
        estimateGameWin: () => 0.5,
        wantProbability: () => 0.5,
        config: testConfig()
    });

    it('sums want × reach × drop over future games (hand case .1125)', () => {
        const result = denialValue('Z', denialState(), baseCtx());
        expect(result.total).toBeCloseTo(0.1125, 9);
        expect(result.perGame).toHaveLength(2);
        expect(result.perGame[0]).toMatchObject({ gameNumber: 2, wantProbability: 0.5 });
        expect(result.perGame[0].reachProbability).toBeCloseTo(1, 12);
        expect(result.perGame[0].replacementDrop).toBeCloseTo(0.15, 9);
        expect(result.perGame[0].contribution).toBeCloseTo(0.075, 9);
        expect(result.perGame[1].reachProbability).toBeCloseTo(0.5, 12);
        expect(result.perGame[1].contribution).toBeCloseTo(0.0375, 9);
    });

    it('uses the injected replacementDrop when provided', () => {
        const result = denialValue('Z', denialState(), { ...baseCtx(), replacementDrop: () => 0.2 });
        // .5×1×.2 + .5×.5×.2 = .15
        expect(result.total).toBeCloseTo(0.15, 9);
    });

    it('want probabilities are per-game (only g2 wants it here)', () => {
        const result = denialValue('Z', denialState(), {
            ...baseCtx(),
            wantProbability: (_key, gameNumber) => (gameNumber === 2 ? 1 : 0)
        });
        expect(result.total).toBeCloseTo(0.15, 9); // 1×1×.15 + 0
    });

    it('denying an already-consumed champion is worthless', () => {
        const result = denialValue('Z', denialState({ consumed: new Set(['Z']) }), baseCtx());
        expect(result.total).toBe(0);
    });

    it('a champion absent from their pools has zero drop', () => {
        const result = denialValue('a0', denialState(), baseCtx()); // ally-only key
        expect(result.total).toBe(0);
    });

    it('reach accounts for the series possibly ending (bo5 at 1-2)', () => {
        // Game 4 about to be played: g5 is reached only if ally wins g4
        // (enemy win = 3rd → over) → reach(g5) = .5 → total = .5×.5×.15.
        const state = denialState({ format: 'bo5', score: { ally: 1, enemy: 2 }, gameNumber: 4 });
        const result = denialValue('Z', state, baseCtx());
        expect(result.perGame).toHaveLength(1);
        expect(result.perGame[0].gameNumber).toBe(5);
        expect(result.perGame[0].reachProbability).toBeCloseTo(0.5, 12);
        expect(result.total).toBeCloseTo(0.0375, 9);
    });

    it('requires an injected want model', () => {
        expect(() => denialValue('Z', denialState(), { config: testConfig() })).toThrow(RangeError);
    });
});

describe('mustWinAnalysis — spend/save arbitrage', () => {
    it('flags the must-win and forces spending verdicts (bo3 down 0-1)', () => {
        const analysis = mustWinAnalysis(retentionState({ score: { ally: 0, enemy: 1 }, gameNumber: 2 }), {
            config: testConfig()
        });
        expect(analysis.isMustWin).toBe(true);
        expect(analysis.gamesToElimination).toBe(1);
        expect(analysis.gamesToVictory).toBe(2);
        expect(analysis.puntRecommendationFr).toBeUndefined();
        expect(analysis.spendVsSave).toHaveLength(5); // best asset per role
        for (const entry_ of analysis.spendVsSave) expect(entry_.verdictFr).toMatch(/^Must-win/);
    });

    it('picks the best posterior per role as the asset', () => {
        const analysis = mustWinAnalysis(retentionState(), { config: testConfig() });
        const top = analysis.spendVsSave.find((e) => e.role === Role.Top);
        expect(top?.championKey).toBe('X'); // .65 beats Y's .50
    });

    /*
     * Punt case (bo3 0-0, retention fixture): every sole-champion asset has
     * net ≈ −.02506 (withholding it empties its role for one game: p_save
     * .48, consumed branches at p .48 → V⁺₊ .7296 / V⁻₊ .2304 vs kept .7791
     * / .2809) and X has net −.015 → mean ≈ −.0230 < −.01 → punt advised,
     * X first in the spend ranking.
     */
    it('recommends preserving the pool when saving clearly dominates', () => {
        const analysis = mustWinAnalysis(retentionState(), { config: testConfig() });
        expect(analysis.isMustWin).toBe(false);
        expect(analysis.puntRecommendationFr).toBeDefined();
        expect(analysis.puntRecommendationFr).toContain('Game sacrifiable');
        expect(analysis.spendVsSave[0].championKey).toBe('X');
        expect(analysis.spendVsSave[0].retention.net).toBeCloseTo(-0.015, 9);
        const jungle = analysis.spendVsSave.find((e) => e.role === Role.Jungle);
        expect(jungle?.retention.net).toBeCloseTo(-0.02506, 9);
        for (const entry_ of analysis.spendVsSave) {
            expect(entry_.denial).toBeNull(); // no want model injected
            expect(entry_.verdictFr).toContain('Gardez');
        }
    });

    it('spending verdicts in the decider (all nowGain, no punt)', () => {
        const analysis = mustWinAnalysis(retentionState({ score: { ally: 1, enemy: 1 }, gameNumber: 3 }), {
            config: testConfig()
        });
        expect(analysis.isMustWin).toBe(true); // 1-1: losing ends the series
        for (const entry_ of analysis.spendVsSave) expect(entry_.retention.net).toBeGreaterThan(0);
    });

    it('prices denial in the table when a want model is injected', () => {
        const ally = evenPools('a');
        ally[Role.Top] = [entry('X', 8, 10), entry('Y', 5, 10)];
        const enemy = evenPools('e');
        enemy[Role.Top] = [entry('X', 8, 10), entry('W', 5, 10)]; // they play X too
        const state = stateOf({ poolsBySide: { ally, enemy } });
        const analysis = mustWinAnalysis(state, {
            config: testConfig(),
            wantProbability: () => 0.5
        });
        const top = analysis.spendVsSave.find((e) => e.role === Role.Top);
        expect(top?.denial).not.toBeNull();
        expect(top?.denial?.total).toBeGreaterThan(0);
        expect(top?.verdictFr).toContain('déni');
    });

    it('terminal series produce an empty table', () => {
        const analysis = mustWinAnalysis(retentionState({ score: { ally: 2, enemy: 1 } }), { config: testConfig() });
        expect(analysis.isMustWin).toBe(false);
        expect(analysis.spendVsSave).toEqual([]);
    });
});
