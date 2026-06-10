/**
 * Draft Navigator — probabilistic expectimax over the in-progress draft
 * (ARCHITECTURE_V2 §6 points 6-7; the per-game engine the I4 Series Solver
 * plugs into).
 *
 * Walks the remaining DRAFT_TEMPLATE slots from a partial draft state. OUR
 * slots are MAX nodes over injected candidates (top-k pools/tiers); enemy
 * slots are EXPECTATION nodes over an injected probability distribution (the
 * I1 range model / R4 tendencies — coupled by FUNCTION TYPE only, never
 * imported), truncated to top-k and renormalized: the opponent is modelled by
 * its forecast distribution, NOT as a paranoid minimax player (doctrine §6.6).
 * Leaves (depth exhausted or draft complete) are scored by the injected
 * evaluator, from OUR side's perspective.
 *
 * Design notes:
 * - `depth` counts ACTIONS (plies), the root candidate's own action included;
 *   degenerate slots (no candidate / empty distribution, like a forfeited
 *   ban) are skipped — they advance the template without consuming depth. A
 *   skip appends a sentinel action (championKey '') so injected callbacks
 *   reading `nextSlotOf(state)` stay consistent with the search frontier.
 * - the principal variation at expectation nodes follows the MOST PROBABLE
 *   enemy action — a representative line, since an expectation has no single
 *   best reply. Line entries are 'type:championKey' strings.
 * - DA-V2-12: every root candidate exposes {immediateValue, lookaheadDelta}
 *   whose sum IS `value`, so the coach sees what the lookahead added.
 * - the optional memo is an injected transposition table; keys cover
 *   (progress, picks per side, removed champions, remaining depth) so
 *   transposed ban orders fold together. No clock, no randomness: the search
 *   is fully deterministic given its injected functions.
 */
import { DRAFT_TEMPLATE, picksOf } from '$lib/data/draftRecord';
import type { DraftAction, DraftPhase, DraftSide } from '$lib/data/types';
import { analyzeDraft } from '$lib/engine/analyzer';
import { inferRoles } from '$lib/strategic/inferRoles';
import type { AnalyzeDraftConfig, Dataset, Team } from '$lib/types';

export interface NavigatorConfig {
    /** Lookahead depth in plies (actions), the root candidate's included. */
    depth: number;
    /** Max branches kept at every node (our candidates AND the enemy range). */
    topK: number;
}

/** Default navigator tuning (DA-V2-6 — overridable via ctx.depth / ctx.topK). */
export const DEFAULT_NAVIGATOR_CONFIG: NavigatorConfig = { depth: 3, topK: 8 };

/** A draft being played: completed actions + first-pick side + champion pool. */
export interface DraftState {
    /** Completed actions, ascending `seq` (template slots; gaps = skipped bans). */
    actions: DraftAction[];
    /** Which side acts on the `first` template slots (DRAFT_TEMPLATE anchor). */
    firstPickSide: DraftSide;
    /** Champions still pickable/bannable (Fearless-consumed already removed). */
    available: Set<string>;
}

/** The next template slot to act, with its side resolved. */
export interface NavigatorSlot {
    seq: number;
    phase: DraftPhase;
    type: 'pick' | 'ban';
    side: DraftSide;
}

export interface EnemyDistributionEntry {
    championKey: string;
    /** Probability mass — re-normalized after availability filtering + top-k. */
    p: number;
}

export interface NavigatorValueComponents {
    /** Evaluator value right after the candidate action (no lookahead). */
    immediateValue: number;
    /** value − immediateValue: what the expectimax lookahead added. */
    lookaheadDelta: number;
}

export interface NavigatorCandidate {
    championKey: string;
    /** 'pick' or 'ban' — the type of the slot this candidate fills. */
    actionType: 'pick' | 'ban';
    /** Expectimax value (our win probability under the injected evaluator). */
    value: number;
    /** Principal variation from this action on, 'type:championKey' per ply. */
    line: string[];
    /** Sums to `value` (DA-V2-12 — no fused hidden score). */
    components: NavigatorValueComponents;
    /** Renormalized probability mass when the root is an ENEMY slot. */
    p?: number;
}

/** Transposition-table entry (value + principal variation). */
export interface NavigatorMemoEntry {
    value: number;
    line: string[];
}

export interface NavigatorContext {
    ourSide: DraftSide;
    /** Injected candidate generator for OUR slots (top-k pools/tiers). */
    ourCandidates: (state: DraftState) => string[];
    /**
     * Injected range model for ENEMY slots (I1/R4) — interface only, the
     * module is never imported here (decoupling by function type).
     */
    enemyDistribution: (state: DraftState, slot: NavigatorSlot) => EnemyDistributionEntry[];
    /** Leaf evaluator: OUR win probability for ally vs enemy picked keys. */
    evaluate: (allyKeys: string[], enemyKeys: string[]) => number;
    depth?: number;
    topK?: number;
    /** Optional shared transposition table across navigate() calls. */
    memo?: Map<string, NavigatorMemoEntry>;
}

export interface NavigatorResult {
    /** Best value first on OUR slots; most probable first on enemy slots. */
    candidates: NavigatorCandidate[];
    /** Nodes explored: every expanded node, leaf and root immediate eval. */
    evaluatedNodes: number;
    /** The slot the candidates fill; null when the draft is complete. */
    nextSlot: NavigatorSlot | null;
}

// ---- internal: state walking ------------------------------------------------

const enemyOf = (side: DraftSide): DraftSide => (side === 'blue' ? 'red' : 'blue');

/**
 * Next template slot from a seq floor. The reference point is the MAX seq
 * (not the first missing one) so pre-existing gaps — skipped/forfeited bans —
 * never resurrect an already-passed slot.
 */
function slotFrom(state: DraftState, seqFloor: number): NavigatorSlot | null {
    let lastSeq = seqFloor - 1;
    for (const action of state.actions) {
        if (action.seq > lastSeq) lastSeq = action.seq;
    }
    const slot = DRAFT_TEMPLATE.find((s) => s.seq > lastSeq);
    if (slot === undefined) return null;
    const firstIsBlue = state.firstPickSide === 'blue';
    return {
        seq: slot.seq,
        phase: slot.phase,
        type: slot.type,
        side: slot.first === firstIsBlue ? 'blue' : 'red'
    };
}

/** Next slot to act on a state (template order, skipped bans folded). */
export function nextSlotOf(state: DraftState): NavigatorSlot | null {
    return slotFrom(state, 1);
}

/** Immutable application of one action: appended + removed from the pool. */
function applyAction(state: DraftState, slot: NavigatorSlot, championKey: string): DraftState {
    const available = new Set(state.available);
    available.delete(championKey);
    const action: DraftAction = {
        seq: slot.seq,
        type: slot.type,
        phase: slot.phase,
        side: slot.side,
        championKey,
        // Keys are all the navigator knows mid-search; the name mirrors them.
        championName: championKey
    };
    return { actions: [...state.actions, action], firstPickSide: state.firstPickSide, available };
}

/**
 * Transposition key: progress (max seq), remaining depth, picks per side and
 * removed champions — order-insensitive within each group, so transposed
 * ban/pick orders reaching the same position share one entry.
 */
function memoKey(state: DraftState, seqFloor: number, depth: number): string {
    let lastSeq = seqFloor - 1;
    const bluePicks: string[] = [];
    const redPicks: string[] = [];
    const bans: string[] = [];
    for (const action of state.actions) {
        if (action.seq > lastSeq) lastSeq = action.seq;
        if (action.type === 'pick') (action.side === 'blue' ? bluePicks : redPicks).push(action.championKey);
        else bans.push(action.championKey);
    }
    return (
        `${lastSeq}|d${depth}` +
        `|b:${bluePicks.sort().join(',')}|r:${redPicks.sort().join(',')}|x:${bans.sort().join(',')}`
    );
}

const labelOf = (slot: NavigatorSlot, championKey: string): string => `${slot.type}:${championKey}`;

const realPicks = (state: DraftState, side: DraftSide): string[] =>
    picksOf(state.actions, side)
        .map((a) => a.championKey)
        .filter((key) => key !== ''); // skip sentinels never reach the evaluator

function leafValue(state: DraftState, ctx: NavigatorContext): number {
    return ctx.evaluate(realPicks(state, ctx.ourSide), realPicks(state, enemyOf(ctx.ourSide)));
}

/** Sentinel for a degenerate slot: advances `seq` without spending anything. */
function skipSlot(state: DraftState, slot: NavigatorSlot): DraftState {
    const action: DraftAction = {
        seq: slot.seq,
        type: slot.type,
        phase: slot.phase,
        side: slot.side,
        championKey: '',
        championName: ''
    };
    return { actions: [...state.actions, action], firstPickSide: state.firstPickSide, available: state.available };
}

/**
 * Availability-filter, truncate to top-k by mass, renormalize. An all-zero
 * truncated range degrades to uniform (a range model should not emit it,
 * but the search must stay total).
 */
function truncatedDistribution(
    entries: EnemyDistributionEntry[],
    available: Set<string>,
    topK: number
): EnemyDistributionEntry[] {
    const kept = entries
        .filter((e) => available.has(e.championKey))
        .sort((a, b) => b.p - a.p)
        .slice(0, topK);
    if (kept.length === 0) return [];
    const mass = kept.reduce((sum, e) => sum + e.p, 0);
    return kept.map((e) => ({ championKey: e.championKey, p: mass > 0 ? e.p / mass : 1 / kept.length }));
}

interface SearchCounters {
    nodes: number;
}

/** Expectimax recursion: max at our slots, expectation at enemy slots. */
function nodeValue(
    state: DraftState,
    seqFloor: number,
    depth: number,
    ctx: NavigatorContext,
    topK: number,
    counters: SearchCounters
): NavigatorMemoEntry {
    const slot = slotFrom(state, seqFloor);
    const isLeaf = slot === null || depth <= 0;
    const key = memoKey(state, seqFloor, isLeaf ? 0 : depth);
    const cached = ctx.memo?.get(key);
    if (cached !== undefined) return cached;
    counters.nodes += 1;

    let result: NavigatorMemoEntry;
    if (isLeaf || slot === null) {
        result = { value: leafValue(state, ctx), line: [] };
    } else if (slot.side === ctx.ourSide) {
        const candidates = ctx
            .ourCandidates(state)
            .filter((c) => state.available.has(c))
            .slice(0, topK);
        if (candidates.length === 0) {
            // Degenerate slot (nothing to play) — skip without burning a ply.
            result = nodeValue(skipSlot(state, slot), slot.seq + 1, depth, ctx, topK, counters);
        } else {
            let best: NavigatorMemoEntry = { value: -Infinity, line: [] };
            for (const championKey of candidates) {
                const child = nodeValue(applyAction(state, slot, championKey), slot.seq + 1, depth - 1, ctx, topK, counters);
                if (child.value > best.value) {
                    best = { value: child.value, line: [labelOf(slot, championKey), ...child.line] };
                }
            }
            result = best;
        }
    } else {
        const dist = truncatedDistribution(ctx.enemyDistribution(state, slot), state.available, topK);
        if (dist.length === 0) {
            // Empty range (e.g. a ban they are forecast to skip) — skip too.
            result = nodeValue(skipSlot(state, slot), slot.seq + 1, depth, ctx, topK, counters);
        } else {
            let expected = 0;
            let line: string[] = [];
            let topMass = -1;
            for (const { championKey, p } of dist) {
                const child = nodeValue(applyAction(state, slot, championKey), slot.seq + 1, depth - 1, ctx, topK, counters);
                expected += p * child.value;
                if (p > topMass) {
                    topMass = p;
                    line = [labelOf(slot, championKey), ...child.line];
                }
            }
            result = { value: expected, line };
        }
    }

    ctx.memo?.set(key, result);
    return result;
}

// ---- public API ---------------------------------------------------------------

/**
 * Rank the actions available at the next slot of `state` by expectimax value.
 *
 * When the next slot is OURS the candidates are the injected generator's keys
 * (availability-filtered, top-k), best first. When it is the ENEMY's, the
 * candidates are their truncated renormalized range, most probable first,
 * each valued from OUR perspective — the war-room "what are we facing" view.
 */
export function navigate(state: DraftState, ctx: NavigatorContext): NavigatorResult {
    const depth = Math.max(1, Math.floor(ctx.depth ?? DEFAULT_NAVIGATOR_CONFIG.depth));
    const topK = Math.max(1, Math.floor(ctx.topK ?? DEFAULT_NAVIGATOR_CONFIG.topK));
    const counters: SearchCounters = { nodes: 0 };
    const slot = nextSlotOf(state);
    if (slot === null) return { candidates: [], evaluatedNodes: 0, nextSlot: null };

    const explore = (championKey: string, p?: number): NavigatorCandidate => {
        const after = applyAction(state, slot, championKey);
        const sub = nodeValue(after, slot.seq + 1, depth - 1, ctx, topK, counters);
        counters.nodes += 1; // the immediate evaluation is an explored node too
        const immediateValue = leafValue(after, ctx);
        const candidate: NavigatorCandidate = {
            championKey,
            actionType: slot.type,
            value: sub.value,
            line: [labelOf(slot, championKey), ...sub.line],
            components: { immediateValue, lookaheadDelta: sub.value - immediateValue }
        };
        if (p !== undefined) candidate.p = p;
        return candidate;
    };

    let candidates: NavigatorCandidate[];
    if (slot.side === ctx.ourSide) {
        candidates = ctx
            .ourCandidates(state)
            .filter((c) => state.available.has(c))
            .slice(0, topK)
            .map((key) => explore(key));
        candidates.sort((a, b) => b.value - a.value);
    } else {
        candidates = truncatedDistribution(ctx.enemyDistribution(state, slot), state.available, topK).map((e) =>
            explore(e.championKey, e.p)
        );
    }

    return { candidates, evaluatedNodes: counters.nodes, nextSlot: slot };
}

// ---- analyzeDraft adapter -------------------------------------------------------

export interface EvaluatorDatasetPair {
    /** Current-patch sample (analyzer's first argument). */
    dataset: Dataset;
    /** 30-day prior/pair dataset; defaults to `dataset` (M1 convention). */
    fullDataset?: Dataset;
}

export type DraftEvaluator = (allyKeys: string[], enemyKeys: string[]) => number;

/** Simple role attribution: champion keys → role→champion map. */
export type RoleInferrer = (picks: string[], dataset: Dataset) => Team;

/**
 * Wrap the M1 evaluator into the navigator's leaf signature. Roles are
 * attributed by the injected inferrer (defaults to the M5.2 widest-gap-first
 * `inferRoles`, fed with the richer 30-day dataset) and the returned value is
 * `analyzeDraft(...).winrate` — already a win probability in (0, 1).
 */
export function makeAnalyzeDraftEvaluator(
    datasetPair: EvaluatorDatasetPair,
    config: AnalyzeDraftConfig,
    inferRolesFn: RoleInferrer = inferRoles
): DraftEvaluator {
    const full = datasetPair.fullDataset ?? datasetPair.dataset;
    return (allyKeys, enemyKeys) => {
        const ally = inferRolesFn(allyKeys, full);
        const enemy = inferRolesFn(enemyKeys, full);
        return analyzeDraft(datasetPair.dataset, ally, enemy, config, full).winrate;
    };
}
