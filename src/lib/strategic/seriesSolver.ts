/**
 * I4 — Fearless Series Solver (ARCHITECTURE_V2 §6 bis I4; prior-art report
 * §A5-A6). The hard-Fearless Bo3/Bo5 is a resource war: this module makes the
 * budget explicit — series value V(σ), pool integrity, retention vs spending,
 * and the Benoît & Krishna denial price (sequential auctions with budget
 * constraints, REStud 2001: depleting the rival's future capacity pays
 * exactly when the asset's replacement cost is higher for THEM).
 *
 * Engines (every output decomposed into components — DA-V2-12):
 * 1. `poolIntegrity`     — Monte-Carlo fraction of complete 5-role distinct
 *    comps still sampleable from the non-consumed pools (the "who runs dry in
 *    G5" gauge), with per-role failure attribution. Rng is INJECTED
 *    (mulberry32) — deterministic by seed.
 * 2. `gameWinEstimate`   — documented heuristic: p = clamp(0.5 + quality edge
 *    + depth edge), quality = mean per-role best-remaining Beta posterior
 *    (EB shrinkage), depth = mean per-role capped pool-depth ratio. Fully
 *    replaceable by an injected `ctx.estimateGameWin` (e.g. a navigator +
 *    range-model pipeline).
 * 3. `seriesValue`       — V(σ) = p·V(σ⁺) + (1−p)·V(σ⁻), recursion over
 *    score/gameNumber. First Selection (2026 rule): THE LOSER of game N holds
 *    FS for game N+1; when the holder is known the side|pick choice is a
 *    max (ally holder) / min (enemy holder) over the two edge branches, and
 *    the recommendation is exposed. Future games are valued with FROZEN
 *    pools/consumed — only the explicit what-if operators below mutate them.
 * 4. `retentionValue`    — finite difference V(spend now) − V(save), exactly
 *    decomposed into {nowGain, futureLoss, net} (nowGain + futureLoss = net).
 * 5. `denialValue`       — Σ over future games of P(they would want it) ×
 *    P(game reached) × equity drop to their best same-role replacement
 *    (default drop derived from pool depth via shrinkWinrate; both functions
 *    injectable — the want model is the I1 range/tendency surface).
 * 6. `mustWinAnalysis`   — must-win flag + quantified spend-vs-save table +
 *    punt recommendation when saving clearly dominates a non-critical game.
 */
import { mulberry32 } from '$lib/backtest/metrics';
import { shrinkWinrate } from '$lib/estimators/posterior';
import type { ChampionPoolEntry } from '$lib/pro/types';
import { ROLES, type Role } from '$lib/types';
import { DEFAULT_SERIES_SOLVER_CONFIG, type SeriesSolverConfig } from '$lib/strategic/seriesSolverConfig';

// ---- state & context ----------------------------------------------------------

export type SeriesSolverFormat = 'bo3' | 'bo5';

/**
 * Team-anchored side. Blue/red (`DraftSide`) does not survive side swaps
 * across the games of a series, so series state is expressed in ally/enemy
 * space (same convention as the M7 storage layer).
 */
export type SeriesSide = 'ally' | 'enemy';

export interface SeriesScore {
    ally: number;
    enemy: number;
}

export interface SeriesState {
    /** 1-based number of the game ABOUT to be played. */
    gameNumber: number;
    format: SeriesSolverFormat;
    score: SeriesScore;
    mode: 'fearless';
    /** Per-role champion pools (gol.gg shapes) for both teams. */
    poolsBySide: {
        ally: Partial<Record<Role, ChampionPoolEntry[]>>;
        enemy: Partial<Record<Role, ChampionPoolEntry[]>>;
    };
    /** Champions burnt by EITHER side in earlier games (hard Fearless). */
    consumed: Set<string>;
    /** Who holds First Selection for the current game, when known. */
    firstSelectionHolder?: SeriesSide;
}

export interface SeriesContext {
    /** Injected per-game win estimator (replaces the pool heuristic). */
    estimateGameWin?: (state: SeriesState) => number;
    /** Denial: P(the enemy would want championKey at game g) — I1/R4 surface. */
    wantProbability?: (championKey: string, gameNumber: number) => number;
    /** Denial: equity drop to their role replacement (pool-depth default). */
    replacementDrop?: (championKey: string, side: SeriesSide) => number;
    config?: SeriesSolverConfig;
}

/** Games a team must win to take the series. */
export function winsNeeded(format: SeriesSolverFormat): number {
    return format === 'bo3' ? 2 : 3;
}

/** Maximum number of games the format can run. */
export function maxGames(format: SeriesSolverFormat): number {
    return format === 'bo3' ? 3 : 5;
}

/**
 * Series state after the current game: score and game number advance, and the
 * LOSER takes First Selection for the next game (2026 rule). Pools/consumed
 * are intentionally carried as-is (frozen-pool recursion — see header).
 */
export function afterGame(state: SeriesState, winner: SeriesSide): SeriesState {
    return {
        ...state,
        gameNumber: state.gameNumber + 1,
        score: {
            ally: state.score.ally + (winner === 'ally' ? 1 : 0),
            enemy: state.score.enemy + (winner === 'enemy' ? 1 : 0)
        },
        firstSelectionHolder: winner === 'ally' ? 'enemy' : 'ally'
    };
}

// ---- shared internals -----------------------------------------------------------

const fmtPp = (p: number): string => (p * 100).toFixed(1);

const clampP = (p: number, cfg: SeriesSolverConfig): number =>
    Math.min(cfg.gameWin.pMax, Math.max(cfg.gameWin.pMin, p));

/** EB-shrunk posterior mean of one pool entry (doctrine §6.1). */
function posteriorOf(entry: ChampionPoolEntry, cfg: SeriesSolverConfig): number {
    return shrinkWinrate(entry.wins, entry.games, cfg.gameWin.priorMean, cfg.gameWin.priorN).mean;
}

/** Non-consumed pool of one side for one role. */
function remainingOf(state: SeriesState, side: SeriesSide, role: Role): ChampionPoolEntry[] {
    return (state.poolsBySide[side][role] ?? []).filter((e) => !state.consumed.has(e.championKey));
}

function isTerminal(state: SeriesState): boolean {
    const need = winsNeeded(state.format);
    return state.score.ally >= need || state.score.enemy >= need;
}

// ---- 1. pool integrity (Monte-Carlo) ---------------------------------------------

export interface PoolIntegrityOptions {
    samples?: number;
    /** Uniform [0,1) source — inject mulberry32(seed) for reproducibility. */
    rng?: () => number;
    minPoolPerRole?: number;
    config?: SeriesSolverConfig;
}

export interface RoleIntegrityBreakdown {
    role: Role;
    /** Non-consumed champions left for this role. */
    remaining: number;
    /** Samples that failed AT this role (no distinct champion left to take). */
    failures: number;
    /** remaining < minPoolPerRole. */
    belowMinimum: boolean;
}

export interface PoolIntegrityResult {
    side: SeriesSide;
    /** Fraction of samples that assembled a full 5-role distinct comp. */
    integrity: number;
    samples: number;
    byRole: RoleIntegrityBreakdown[];
    /** Most failures, then smallest remaining pool (ROLES-order tie-break). */
    bottleneckRole: Role;
}

/**
 * Monte-Carlo share of complete comps still sampleable: each sample fills the
 * five roles with DISTINCT non-consumed champions, scarcest role first (so a
 * flex champion is not wasted on a deep role), choosing uniformly among the
 * not-yet-used champions of the role. A sample fails at the first role whose
 * options are exhausted — that attribution is the bottleneck breakdown.
 */
export function poolIntegrity(
    state: SeriesState,
    side: SeriesSide,
    options: PoolIntegrityOptions = {}
): PoolIntegrityResult {
    const cfg = options.config ?? DEFAULT_SERIES_SOLVER_CONFIG;
    const samples = options.samples ?? cfg.integrity.samples;
    const rng = options.rng ?? mulberry32(cfg.integrity.defaultSeed);
    const minPoolPerRole = options.minPoolPerRole ?? cfg.integrity.minPoolPerRole;

    const pools = new Map<Role, string[]>(
        ROLES.map((role) => [role, remainingOf(state, side, role).map((e) => e.championKey)])
    );
    // Scarcest-first sampling order; stable on ROLES order for equal sizes.
    const order = [...ROLES].sort((a, b) => (pools.get(a) as string[]).length - (pools.get(b) as string[]).length);
    const failures = new Map<Role, number>(ROLES.map((role) => [role, 0]));

    let complete = 0;
    for (let s = 0; s < samples; s++) {
        const used = new Set<string>();
        let ok = true;
        for (const role of order) {
            const open = (pools.get(role) as string[]).filter((key) => !used.has(key));
            if (open.length === 0) {
                failures.set(role, (failures.get(role) as number) + 1);
                ok = false;
                break;
            }
            used.add(open[Math.floor(rng() * open.length)]);
        }
        if (ok) complete += 1;
    }

    const byRole: RoleIntegrityBreakdown[] = ROLES.map((role) => ({
        role,
        remaining: (pools.get(role) as string[]).length,
        failures: failures.get(role) as number,
        belowMinimum: (pools.get(role) as string[]).length < minPoolPerRole
    }));
    const bottleneck = [...byRole].sort(
        (a, b) => b.failures - a.failures || a.remaining - b.remaining
    )[0];

    return {
        side,
        integrity: samples > 0 ? complete / samples : 0,
        samples,
        byRole,
        bottleneckRole: bottleneck.role
    };
}

// ---- 2. game win estimate ---------------------------------------------------------

export interface GameWinComponent {
    /** FR explanation with the inputs inlined. */
    reason: string;
    value: number;
}

export interface GameWinEstimate {
    /** Ally win probability for the CURRENT game, clamped to [pMin, pMax]. */
    p: number;
    /** Components sum to the PRE-CLAMP probability (DA-V2-12). */
    components: GameWinComponent[];
}

/** Mean per-role best-remaining posterior (empty role → near-forfeit floor). */
function poolQuality(state: SeriesState, side: SeriesSide, cfg: SeriesSolverConfig): number {
    let total = 0;
    for (const role of ROLES) {
        const remaining = remainingOf(state, side, role);
        let best = cfg.gameWin.emptyRoleQuality;
        let first = true;
        for (const entry of remaining) {
            const mean = posteriorOf(entry, cfg);
            if (first || mean > best) best = mean;
            first = false;
        }
        total += best;
    }
    return total / ROLES.length;
}

/** Mean per-role capped depth ratio min(remaining, cap)/cap. */
function poolDepth(state: SeriesState, side: SeriesSide, cfg: SeriesSolverConfig): number {
    let total = 0;
    for (const role of ROLES) {
        total += Math.min(remainingOf(state, side, role).length, cfg.gameWin.depthCap) / cfg.gameWin.depthCap;
    }
    return total / ROLES.length;
}

/**
 * Documented heuristic for the current game's ally win probability:
 *
 *   p = clamp( 0.5
 *            + qualityWeight · (Q_ally − Q_enemy)     // best-remaining posteriors
 *            + depthWeight   · (D_ally − D_enemy) )   // capped pool-depth ratios
 *
 * An injected `ctx.estimateGameWin` replaces the whole heuristic (it is then
 * responsible for reacting to pools/consumed itself). The First Selection
 * edge is NOT applied here — `seriesValue` owns the side|pick branching.
 */
export function gameWinEstimate(state: SeriesState, ctx: SeriesContext = {}): GameWinEstimate {
    const cfg = ctx.config ?? DEFAULT_SERIES_SOLVER_CONFIG;
    if (ctx.estimateGameWin !== undefined) {
        const p = clampP(ctx.estimateGameWin(state), cfg);
        return { p, components: [{ reason: 'Estimateur de game injecté', value: p }] };
    }

    const qualityAlly = poolQuality(state, 'ally', cfg);
    const qualityEnemy = poolQuality(state, 'enemy', cfg);
    const depthAlly = poolDepth(state, 'ally', cfg);
    const depthEnemy = poolDepth(state, 'enemy', cfg);
    const qualityEdge = cfg.gameWin.qualityWeight * (qualityAlly - qualityEnemy);
    const depthEdge = cfg.gameWin.depthWeight * (depthAlly - depthEnemy);

    const components: GameWinComponent[] = [
        { reason: 'Base (terrain neutre)', value: 0.5 },
        {
            reason:
                `Qualité de pool (meilleur posterior restant par rôle) : allié ${fmtPp(qualityAlly)} % ` +
                `vs adverse ${fmtPp(qualityEnemy)} %`,
            value: qualityEdge
        },
        {
            reason:
                `Profondeur de pool restante (plafond ${cfg.gameWin.depthCap}/rôle) : allié ${fmtPp(depthAlly)} % ` +
                `vs adverse ${fmtPp(depthEnemy)} %`,
            value: depthEdge
        }
    ];
    return { p: clampP(0.5 + qualityEdge + depthEdge, cfg), components };
}

// ---- 3. series value V(σ) ---------------------------------------------------------

export interface FirstSelectionAdvice {
    holder: SeriesSide;
    /** Branch the holder should take (their best; our worst if enemy holds). */
    recommended: 'side' | 'pick';
    /** V(σ) if the holder takes its preferred side / first pick. */
    valueSide: number;
    valuePick: number;
}

export interface SeriesValueComponents {
    /** p effectively used for the current game (after the chosen FS edge). */
    pUsed: number;
    /** V(σ⁺): series value after winning the current game. */
    winBranchValue: number;
    /** V(σ⁻): series value after losing it. */
    loseBranchValue: number;
}

export interface SeriesValueResult {
    /** P(ally wins the series) from this state. */
    value: number;
    terminal: boolean;
    /** Current game's estimate (null on terminal states). */
    game: GameWinEstimate | null;
    /** Side|pick arbitrage when the current FS holder is known. */
    firstSelection: FirstSelectionAdvice | null;
    components: SeriesValueComponents | null;
}

/**
 * Memo keyed on (format, game, score, FS holder, consumed). Share one map
 * only across states with identical `poolsBySide` (the what-if operators
 * below respect this: they only vary `consumed`, which is in the key).
 */
export type SeriesValueMemo = Map<string, SeriesValueResult>;

function seriesMemoKey(state: SeriesState): string {
    return (
        `${state.format}|g${state.gameNumber}|s${state.score.ally}-${state.score.enemy}` +
        `|fs:${state.firstSelectionHolder ?? '-'}|c:${[...state.consumed].sort().join(',')}`
    );
}

/**
 * V(σ) = p·V(σ⁺) + (1−p)·V(σ⁻), expectations over the per-game estimate.
 * When the current FS holder is known, the side|pick choice is encoded as a
 * max over the two edge branches for an ally holder (min for an enemy holder
 * — they pick what hurts us most) and the recommendation is exposed. Ties
 * recommend 'side' (the historically stronger edge). Both branches hand FS
 * to the loser (2026 rule) via `afterGame`.
 */
export function seriesValue(state: SeriesState, ctx: SeriesContext = {}, memo?: SeriesValueMemo): SeriesValueResult {
    const cfg = ctx.config ?? DEFAULT_SERIES_SOLVER_CONFIG;
    const need = winsNeeded(state.format);
    if (state.score.ally >= need) {
        return { value: 1, terminal: true, game: null, firstSelection: null, components: null };
    }
    if (state.score.enemy >= need) {
        return { value: 0, terminal: true, game: null, firstSelection: null, components: null };
    }
    const key = seriesMemoKey(state);
    const cached = memo?.get(key);
    if (cached !== undefined) return cached;

    const game = gameWinEstimate(state, ctx);
    const winBranchValue = seriesValue(afterGame(state, 'ally'), ctx, memo).value;
    const loseBranchValue = seriesValue(afterGame(state, 'enemy'), ctx, memo).value;
    const branch = (p: number): number => p * winBranchValue + (1 - p) * loseBranchValue;

    let value: number;
    let pUsed: number;
    let firstSelection: FirstSelectionAdvice | null = null;
    const holder = state.firstSelectionHolder;
    if (holder !== undefined) {
        const sign = holder === 'ally' ? 1 : -1;
        const pSide = clampP(game.p + sign * cfg.firstSelection.sideEdge, cfg);
        const pPick = clampP(game.p + sign * cfg.firstSelection.pickEdge, cfg);
        const valueSide = branch(pSide);
        const valuePick = branch(pPick);
        // Strict comparison: a tie keeps 'side'.
        const pickIsBetterForHolder = holder === 'ally' ? valuePick > valueSide : valuePick < valueSide;
        const recommended: 'side' | 'pick' = pickIsBetterForHolder ? 'pick' : 'side';
        value = recommended === 'pick' ? valuePick : valueSide;
        pUsed = recommended === 'pick' ? pPick : pSide;
        firstSelection = { holder, recommended, valueSide, valuePick };
    } else {
        pUsed = game.p;
        value = branch(pUsed);
    }

    const result: SeriesValueResult = {
        value,
        terminal: false,
        game,
        firstSelection,
        components: { pUsed, winBranchValue, loseBranchValue }
    };
    memo?.set(key, result);
    return result;
}

// ---- 4. retention value (spend now vs save) ----------------------------------------

export interface RetentionValueResult {
    championKey: string;
    /** V(σ) when the champion is spent on the current game. */
    valueSpend: number;
    /** V(σ) when it is deliberately withheld for later games. */
    valueSave: number;
    /** (p_spend − p_save) · (V⁺ − V⁻): equity bought in the current game. */
    nowGain: number;
    /** Future-branch value change from consuming it (usually ≤ 0). */
    futureLoss: number;
    /** valueSpend − valueSave ≡ nowGain + futureLoss. */
    net: number;
}

/** State with one champion withheld from one side's pools (current game only). */
function withholdFromPools(state: SeriesState, side: SeriesSide, championKey: string): SeriesState {
    const filtered: Partial<Record<Role, ChampionPoolEntry[]>> = {};
    for (const role of ROLES) {
        const entries = state.poolsBySide[side][role];
        if (entries !== undefined) filtered[role] = entries.filter((e) => e.championKey !== championKey);
    }
    const poolsBySide =
        side === 'ally'
            ? { ally: filtered, enemy: state.poolsBySide.enemy }
            : { ally: state.poolsBySide.ally, enemy: filtered };
    return { ...state, poolsBySide };
}

/**
 * Finite difference of an ALLY champion: spend it on the current game
 * (current p keeps it, future branches see it consumed for everyone — hard
 * Fearless) versus save it (current p computed with it withheld from OUR
 * pool, future branches keep it). Exact decomposition:
 *
 *   nowGain    = (p_spend − p_save) · (V⁺₊ − V⁻₊)
 *   futureLoss = p_save·(V⁺₊ − V⁺₀) + (1 − p_save)·(V⁻₊ − V⁻₀)
 *   net        = nowGain + futureLoss = valueSpend − valueSave
 *
 * where ₊ marks branches with the champion consumed and ₀ without. The FS
 * edge of the current game shifts p_spend and p_save equally, so it is left
 * out of the local difference (branch values still encode FS handovers).
 */
export function retentionValue(
    championKey: string,
    state: SeriesState,
    ctx: SeriesContext = {},
    memo?: SeriesValueMemo
): RetentionValueResult {
    if (isTerminal(state)) {
        const v = seriesValue(state, ctx, memo).value;
        return { championKey, valueSpend: v, valueSave: v, nowGain: 0, futureLoss: 0, net: 0 };
    }

    const pSpend = gameWinEstimate(state, ctx).p;
    const pSave = gameWinEstimate(withholdFromPools(state, 'ally', championKey), ctx).p;

    const consumedPlus = new Set(state.consumed);
    consumedPlus.add(championKey);
    const spentState: SeriesState = { ...state, consumed: consumedPlus };

    const winPlus = seriesValue(afterGame(spentState, 'ally'), ctx, memo).value;
    const losePlus = seriesValue(afterGame(spentState, 'enemy'), ctx, memo).value;
    const winKept = seriesValue(afterGame(state, 'ally'), ctx, memo).value;
    const loseKept = seriesValue(afterGame(state, 'enemy'), ctx, memo).value;

    const valueSpend = pSpend * winPlus + (1 - pSpend) * losePlus;
    const valueSave = pSave * winKept + (1 - pSave) * loseKept;
    const nowGain = (pSpend - pSave) * (winPlus - losePlus);
    const futureLoss = pSave * (winPlus - winKept) + (1 - pSave) * (losePlus - loseKept);

    return { championKey, valueSpend, valueSave, nowGain, futureLoss, net: valueSpend - valueSave };
}

// ---- 5. denial value (Benoît-Krishna price) -----------------------------------------

export interface DenialGameComponent {
    gameNumber: number;
    /** P(the enemy would want the champion at this game) — injected. */
    wantProbability: number;
    /** P(the series actually reaches this game) under the current estimate. */
    reachProbability: number;
    /** Equity drop to their best remaining same-role replacement. */
    replacementDrop: number;
    /** want × reach × drop. */
    contribution: number;
}

export interface DenialValueResult {
    championKey: string;
    /** One entry per reachable future game (reach > 0). */
    perGame: DenialGameComponent[];
    /** Benoît-Krishna denial price: Σ want·reach·drop over future games. */
    total: number;
}

/**
 * P(game g is reached) for each future game, walking the score distribution
 * forward with a constant per-game p (the current estimate — a documented
 * simplification): mass on decided series drops out, the rest is the reach.
 */
function reachProbabilities(state: SeriesState, p: number): Map<number, number> {
    const need = winsNeeded(state.format);
    const reach = new Map<number, number>();
    let alive = new Map<string, { ally: number; enemy: number; prob: number }>([
        [`${state.score.ally}-${state.score.enemy}`, { ally: state.score.ally, enemy: state.score.enemy, prob: 1 }]
    ]);
    for (let g = state.gameNumber + 1; g <= maxGames(state.format); g++) {
        const next = new Map<string, { ally: number; enemy: number; prob: number }>();
        const push = (ally: number, enemy: number, prob: number): void => {
            if (ally >= need || enemy >= need || prob === 0) return; // series over
            const key = `${ally}-${enemy}`;
            const cell = next.get(key);
            if (cell === undefined) next.set(key, { ally, enemy, prob });
            else cell.prob += prob;
        };
        for (const cell of alive.values()) {
            push(cell.ally + 1, cell.enemy, cell.prob * p);
            push(cell.ally, cell.enemy + 1, cell.prob * (1 - p));
        }
        alive = next;
        let mass = 0;
        for (const cell of alive.values()) mass += cell.prob;
        reach.set(g, mass);
    }
    return reach;
}

/**
 * Default replacement drop, derived from the pool-depth curve: the champion's
 * shrunk posterior minus the best OTHER remaining champion of the same role
 * (floored at the near-forfeit quality when the role would empty out), maxed
 * over the roles where the side still fields the champion. A champion absent
 * from their remaining pools is worth nothing to deny (drop 0).
 */
function defaultReplacementDrop(
    state: SeriesState,
    championKey: string,
    side: SeriesSide,
    cfg: SeriesSolverConfig
): number {
    let best = 0;
    for (const role of ROLES) {
        const remaining = remainingOf(state, side, role);
        const target = remaining.find((e) => e.championKey === championKey);
        if (target === undefined) continue;
        let replacement = cfg.gameWin.emptyRoleQuality;
        for (const entry of remaining) {
            if (entry.championKey === championKey) continue;
            replacement = Math.max(replacement, posteriorOf(entry, cfg));
        }
        best = Math.max(best, Math.max(0, posteriorOf(target, cfg) - replacement));
    }
    return best;
}

/**
 * Hard-Fearless denial price of consuming a champion NOW (Benoît & Krishna):
 *
 *   denial(c) = Σ_{g futures} P(ils voudraient c en g) · P(g atteinte) · drop(c)
 *
 * `wantProbability` MUST be injected (range/tendency surface, never guessed
 * here). `replacementDrop` defaults to the pool-depth derivation above.
 */
export function denialValue(championKey: string, state: SeriesState, ctx: SeriesContext): DenialValueResult {
    if (ctx.wantProbability === undefined) {
        throw new RangeError('denialValue: ctx.wantProbability must be injected (range/tendency model)');
    }
    const cfg = ctx.config ?? DEFAULT_SERIES_SOLVER_CONFIG;
    const drop = ctx.replacementDrop?.(championKey, 'enemy') ?? defaultReplacementDrop(state, championKey, 'enemy', cfg);
    const reach = isTerminal(state) ? new Map<number, number>() : reachProbabilities(state, gameWinEstimate(state, ctx).p);

    const perGame: DenialGameComponent[] = [];
    let total = 0;
    for (const [gameNumber, reachProbability] of reach) {
        if (reachProbability <= 0) continue;
        const want = ctx.wantProbability(championKey, gameNumber);
        const contribution = want * reachProbability * drop;
        perGame.push({ gameNumber, wantProbability: want, reachProbability, replacementDrop: drop, contribution });
        total += contribution;
    }
    return { championKey, perGame, total };
}

// ---- 6. must-win analysis -----------------------------------------------------------

export interface SpendVsSaveEntry {
    championKey: string;
    role: Role;
    retention: RetentionValueResult;
    /** Null when no want model is injected (denial unpriceable, not zeroed). */
    denial: DenialValueResult | null;
    verdictFr: string;
}

export interface MustWinAnalysis {
    /** Losing the current game loses the series. */
    isMustWin: boolean;
    /** Enemy wins still needed to eliminate us / our wins to take the series. */
    gamesToElimination: number;
    gamesToVictory: number;
    /** Present only when sacrificing this game to save the pool is advised. */
    puntRecommendationFr?: string;
    /** Top ally asset per role, most spendable first (retention + denial). */
    spendVsSave: SpendVsSaveEntry[];
}

function verdictFor(isMustWin: boolean, retention: RetentionValueResult, denial: DenialValueResult | null): string {
    const denialPart = denial === null ? 'déni non chiffré' : `déni +${fmtPp(denial.total)} pp`;
    const numbers = `rétention nette ${retention.net >= 0 ? '+' : ''}${fmtPp(retention.net)} pp, ${denialPart}`;
    if (isMustWin) {
        return `Must-win : dépensez (${numbers}) — garder n'a de valeur que s'il reste des games à jouer.`;
    }
    const combined = retention.net + (denial?.total ?? 0);
    return combined >= 0
        ? `Dépensez maintenant : ${numbers}.`
        : `Gardez pour la suite : ${numbers}.`;
}

/**
 * Must-win flag + quantified spend-vs-save arbitrage on our best remaining
 * asset(s) per role. In a must-win every verdict forces spending (retention
 * is worthless without a next game). Otherwise each verdict cites retention
 * net and denial separately (DA-V2-12) and a punt recommendation appears
 * when the MEAN retention net is clearly negative (saving dominates).
 */
export function mustWinAnalysis(state: SeriesState, ctx: SeriesContext = {}, memo?: SeriesValueMemo): MustWinAnalysis {
    const cfg = ctx.config ?? DEFAULT_SERIES_SOLVER_CONFIG;
    const need = winsNeeded(state.format);
    const terminal = isTerminal(state);
    const gamesToElimination = Math.max(0, need - state.score.enemy);
    const gamesToVictory = Math.max(0, need - state.score.ally);
    const isMustWin = !terminal && gamesToElimination === 1;

    const spendVsSave: SpendVsSaveEntry[] = [];
    if (!terminal) {
        for (const role of ROLES) {
            const assets = remainingOf(state, 'ally', role)
                .map((entry) => ({ entry, mean: posteriorOf(entry, cfg) }))
                .sort((a, b) => b.mean - a.mean)
                .slice(0, cfg.mustWin.assetsPerRole);
            for (const { entry } of assets) {
                const retention = retentionValue(entry.championKey, state, ctx, memo);
                const denial = ctx.wantProbability !== undefined ? denialValue(entry.championKey, state, ctx) : null;
                spendVsSave.push({
                    championKey: entry.championKey,
                    role,
                    retention,
                    denial,
                    verdictFr: verdictFor(isMustWin, retention, denial)
                });
            }
        }
        spendVsSave.sort(
            (a, b) => b.retention.net + (b.denial?.total ?? 0) - (a.retention.net + (a.denial?.total ?? 0))
        );
    }

    const analysis: MustWinAnalysis = { isMustWin, gamesToElimination, gamesToVictory, spendVsSave };
    if (!terminal && !isMustWin && spendVsSave.length > 0) {
        const meanNet = spendVsSave.reduce((sum, e) => sum + e.retention.net, 0) / spendVsSave.length;
        if (meanNet < -cfg.mustWin.puntNetThreshold) {
            analysis.puntRecommendationFr =
                `Game sacrifiable : la rétention moyenne de vos meilleurs atouts est négative ` +
                `(${fmtPp(meanNet)} pp par atout) — préservez le pool pour les games décisives ` +
                `(score ${state.score.ally}-${state.score.enemy}, élimination dans ${gamesToElimination} défaites).`;
        }
    }
    return analysis;
}
