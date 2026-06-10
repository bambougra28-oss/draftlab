/**
 * I1 — Enemy range model ("Range Drafting", ARCHITECTURE_V2 §6 bis I1).
 *
 * Poker solvers replaced "what hand does he have?" with "what is his range?".
 * Transfer: for one upcoming enemy slot, maintain a probability distribution
 * over champions, combining log-linearly (research §A1/A3 prior art):
 *
 *   score(c) = w_t·ln(p̃_tendency)            // R4 Dirichlet tendencies
 *            + w_p·ln(w̃_pool)                 // depth/tier of the probable role holder
 *            + w_m·ln(w̃_meta)                 // patch presence
 *            + w_s·coherence                   // fit with their partial comp (M4.2 view)
 *            + w_n·ln(negDecay^passCount)      // NEGATIVE information (restricted choice)
 *   p(c)     = exp(score(c)) / Σ exp(score)
 *
 * Smoothing: every logged factor is floored at config ε so a missing signal
 * yields a large-but-finite penalty, never −∞; an ABSENT input (no pools, no
 * meta map, no partial comp) contributes the NEUTRAL factor 1 (ln 1 = 0) —
 * no data must never skew the range. The negative term is the novel piece
 * (capped ranges / bridge's restricted choice; Richards & Amir IJCAI 2007
 * condition on moves NOT made): each comparable pass-over multiplies the
 * champion's unnormalized odds by `negativeDecayPerPass`.
 *
 * DA-V2-12: `components` carries the five WEIGHTED term values separately —
 * their sum is the log-score (exp-renormalizing the sums reproduces p), so
 * every probability is auditable term by term. Evidence stays in raw counts
 * (coaches read counts, never logits). `closeGroup` implements the solver UX
 * convention: white for close calls, color only for clear preferences.
 *
 * Weights/thresholds live in `rangeModelConfig.ts` (DA-V2-6) and are
 * calibrated by the R4 harness (log loss of the next real pick, porte G2).
 */
import type { DraftAction, DraftRecord, DraftSide } from '$lib/data/types';
import type { PresenceEntry } from '$lib/aggregates/presence';
import type { ProPlayer } from '$lib/pro/types';
import { banRotationOf, rotationOf } from '$lib/aggregates/rotations';
import { predict, slotGroupOf, type SlotGroup, type TendencyTable } from '$lib/aggregates/tendency';
import { classifyGamePlan } from '$lib/strategic/gamePlanClassifier';
import { classifyPoolTier } from '$lib/strategic/poolTierClassifier';
import { DEFAULT_RANGE_MODEL_CONFIG, type RangeModelConfig } from '$lib/strategic/rangeModelConfig';
import { loadDefaultTags } from '$lib/tags';
import type { ChampionTagsFile } from '$lib/tags/types';

/**
 * One unit of negative information: the team had `championKey` available at
 * an earlier comparable slot (`atSlotGroup`) where their tendencies wanted
 * it, and did not take it — `count` times.
 */
export interface PassedOverEvent {
    championKey: string;
    atSlotGroup: SlotGroup;
    count: number;
}

export interface RangeQuery {
    /** Tendency table of the ENEMY team (their point of view). */
    table: TendencyTable;
    /** The upcoming enemy slot being read. */
    slotGroup: SlotGroup;
    side: DraftSide;
    /** Enemy roster — weights each candidate by its deepest holder's tier. */
    pools?: ProPlayer[];
    /** Patch presence map (computePresence) — the meta weight. */
    meta?: Map<string, PresenceEntry>;
    /** Their picks so far — plan coherence via classifyGamePlan (read-only). */
    partialEnemyComp?: string[];
    /** Tag base for the coherence read (defaults to the bundled tags). */
    tagsFile?: ChampionTagsFile;
    /** Unavailable champions: current picks/bans + Fearless-consumed. */
    exclude: Set<string>;
    /** Negative-information events (collectPassedOver, or hand-fed). */
    passedOver?: PassedOverEvent[];
    config?: RangeModelConfig;
}

/**
 * The five WEIGHTED term values (DA-V2-12 — displayed separately, never
 * collapsed). Their sum is the candidate's log-score: p ∝ exp(Σ components).
 */
export interface RangeComponents {
    /** w_t·ln(max(p_tendency, ε)). */
    tendency: number;
    /** w_p·ln(max(poolWeight, ε)); exactly 0 when no pools were given. */
    pool: number;
    /** w_m·ln(max(presence, ε)); exactly 0 when no meta map was given. */
    meta: number;
    /** w_s·coherence (linear term); 0 when no readable partial comp. */
    coherence: number;
    /** w_n·passCount·ln(negativeDecayPerPass); 0 when never passed over. */
    negative: number;
}

/** Raw tendency counts behind the entry — what the UI shows as evidence. */
export interface RangeEvidence {
    rawCount: number;
    total: number;
}

export interface RangeEntry {
    championKey: string;
    /** Posterior probability; Σp = 1 over the returned range. */
    p: number;
    components: RangeComponents;
    evidence: RangeEvidence;
    /** True when p ≥ closeGroupFactor·p(top) — render white, not colored. */
    closeGroup: boolean;
}

/** Pool weight resolver: the champion's deepest enemy holder decides. */
function buildPoolWeightOf(
    pools: ProPlayer[] | undefined,
    config: RangeModelConfig
): (championKey: string) => number {
    // No roster given → neutral factor 1 for everyone (ln 1 = 0).
    if (pools === undefined) return () => 1;

    // "Probable role holder" = the player with the deepest comfort on the
    // champion: take the max tier weight across the roster. Pool entries
    // carry no recency, so classifyPoolTier sees games at full weight
    // (dated pools are the snapshot layer's future refinement).
    const best = new Map<string, number>();
    for (const player of pools) {
        for (const entry of player.pool) {
            const weight = config.poolTierWeights[classifyPoolTier({ games: entry.games })];
            const previous = best.get(entry.championKey);
            if (previous === undefined || weight > previous) best.set(entry.championKey, weight);
        }
    }
    return (championKey) => best.get(championKey) ?? config.poolUnseenWeight;
}

/**
 * Coherence resolver: how well a candidate fits the dominant archetype of
 * their partial comp (M4.2 read, used strictly read-only). Returns 0 — the
 * neutral linear term — when there is no readable plan (empty comp, no
 * recognized tag) or when the candidate itself is untagged; an ambiguous
 * plan read attenuates the signal by `coherenceAmbiguousFactor`.
 */
function buildCoherenceOf(
    partialEnemyComp: string[] | undefined,
    tagsFile: ChampionTagsFile | undefined,
    config: RangeModelConfig
): (championKey: string) => number {
    if (partialEnemyComp === undefined || partialEnemyComp.length === 0) return () => 0;
    const tags = tagsFile ?? loadDefaultTags();
    if (!partialEnemyComp.some((key) => tags.champions[key] !== undefined)) return () => 0;

    const base = classifyGamePlan(partialEnemyComp, tags);
    const factor = base.ambiguous ? config.coherenceAmbiguousFactor : 1;
    return (championKey) => {
        if (tags.champions[championKey] === undefined) return 0;
        return classifyGamePlan([championKey], tags).distribution[base.primary] * factor;
    };
}

/** Total pass-over count per champion (events accumulate). */
function countPasses(events: PassedOverEvent[] | undefined): Map<string, number> {
    const counts = new Map<string, number>();
    for (const event of events ?? []) {
        counts.set(event.championKey, (counts.get(event.championKey) ?? 0) + event.count);
    }
    return counts;
}

/**
 * Range over ONE upcoming enemy slot: log-linear combination of tendencies,
 * pool depth, meta presence, plan coherence and negative information, then
 * exp-renormalized (Σp = 1). Sorted by p desc, then raw count desc, then
 * champion key asc (the tendency module's deterministic order). Returns []
 * when the tendency table has nothing for the context.
 */
export function predictEnemyRange(input: RangeQuery): RangeEntry[] {
    const config = input.config ?? DEFAULT_RANGE_MODEL_CONFIG;
    const { weights, epsilon } = config;

    const predictions = predict(input.table, {
        slotGroup: input.slotGroup,
        side: input.side,
        exclude: input.exclude
    });
    if (predictions.length === 0) return [];

    const poolWeightOf = buildPoolWeightOf(input.pools, config);
    const coherenceOf = buildCoherenceOf(input.partialEnemyComp, input.tagsFile, config);
    const passCounts = countPasses(input.passedOver);
    const lnDecay = Math.log(config.negativeDecayPerPass);
    const metaWeightOf = (championKey: string): number => {
        if (input.meta === undefined) return 1; // no meta map → neutral
        return input.meta.get(championKey)?.presence ?? 0; // absent → ε floor below
    };

    const scored = predictions.map((prediction) => {
        const passCount = passCounts.get(prediction.championKey) ?? 0;
        const components: RangeComponents = {
            tendency: weights.tendency * Math.log(Math.max(prediction.p, epsilon)),
            pool: weights.pool * Math.log(Math.max(poolWeightOf(prediction.championKey), epsilon)),
            meta: weights.meta * Math.log(Math.max(metaWeightOf(prediction.championKey), epsilon)),
            coherence: weights.coherence * coherenceOf(prediction.championKey),
            // Guard the never-passed case to an exact 0 (0·ln(decay) is −0).
            negative: passCount === 0 ? 0 : weights.negative * passCount * lnDecay
        };
        const score =
            components.tendency + components.pool + components.meta + components.coherence + components.negative;
        return { prediction, components, score };
    });

    // Softmax over the log-scores, max-shifted for numerical stability (the
    // shift cancels in the ratio and does not change p).
    const maxScore = Math.max(...scored.map((s) => s.score));
    let totalMass = 0;
    const masses = scored.map((s) => {
        const mass = Math.exp(s.score - maxScore);
        totalMass += mass;
        return mass;
    });

    const entries = scored.map(
        (s, i): RangeEntry => ({
            championKey: s.prediction.championKey,
            p: masses[i] / totalMass,
            components: s.components,
            evidence: { rawCount: s.prediction.rawCount, total: s.prediction.total },
            closeGroup: false
        })
    );

    entries.sort((a, b) => {
        if (a.p !== b.p) return b.p - a.p;
        if (a.evidence.rawCount !== b.evidence.rawCount) return b.evidence.rawCount - a.evidence.rawCount;
        return a.championKey < b.championKey ? -1 : 1;
    });

    const closeThreshold = config.closeGroupFactor * entries[0].p;
    for (const entry of entries) entry.closeGroup = entry.p >= closeThreshold;

    return entries;
}

export interface SurpriseReport {
    /** Summit Gate pick-in-range@k: actual pick inside the top-k (k = surpriseK). */
    inRange: boolean;
    /** 1-based rank in the range; range.length + 1 when absent entirely. */
    rank: number;
    /** Self-information −log2(p), p floored at ε (absent → −log2 ε). */
    bits: number;
    /** Live re-read signal: bits ≥ surpriseAlarmBits ("tendance cassée"). */
    alarm: boolean;
}

/** How surprising an actual pick was, given the range we held for the slot. */
export function surpriseOf(
    actualKey: string,
    range: RangeEntry[],
    config: RangeModelConfig = DEFAULT_RANGE_MODEL_CONFIG
): SurpriseReport {
    const index = range.findIndex((entry) => entry.championKey === actualKey);
    const found = index >= 0;
    const rank = found ? index + 1 : range.length + 1;
    const p = found ? range[index].p : 0;
    const bits = -Math.log2(Math.max(p, config.epsilon));
    return { inRange: found && rank <= config.surpriseK, rank, bits, alarm: bits >= config.surpriseAlarmBits };
}

/**
 * Highest template seq of each slot group (derived from the rotation maps,
 * not retyped): an observed action with seq beyond it proves the group is
 * over for both sides.
 */
const GROUP_MAX_SEQ: ReadonlyMap<SlotGroup, number> = (() => {
    const map = new Map<SlotGroup, number>();
    for (let seq = 1; seq <= 20; seq++) {
        const group = rotationOf(seq) ?? banRotationOf(seq);
        if (group !== undefined) map.set(group, seq); // ascending seq → last write = max
    }
    return map;
})();

/**
 * Derive PassedOverEvents from a draft in progress: for every slot group the
 * enemy side has acted in AND the draft has moved past, a champion whose
 * tendency p (predicted as of the group's start, unavailable champions
 * excluded) reaches `passedOverMinP` and that remained untaken through the
 * enemy's last action of the group was passed over — one event per
 * (champion, group). Champions taken during the group (by either side) are
 * neither available nor passed. Accepts a full DraftRecord or the raw
 * in-progress action list; unresolved actions (championKey '') are ignored.
 * Events are deterministic: groups in template order, then tendency p desc.
 */
export function collectPassedOver(
    source: DraftRecord | DraftAction[],
    table: TendencyTable,
    side: DraftSide,
    config: RangeModelConfig = DEFAULT_RANGE_MODEL_CONFIG
): PassedOverEvent[] {
    const actions = (Array.isArray(source) ? source : source.actions)
        .filter((action) => action.championKey !== '')
        .sort((a, b) => a.seq - b.seq);
    if (actions.length === 0) return [];
    const maxObservedSeq = actions[actions.length - 1].seq;

    // Enemy actions bucketed by slot group (insertion keeps seq order).
    const groups = new Map<SlotGroup, DraftAction[]>();
    for (const action of actions) {
        if (action.side !== side) continue;
        const group = slotGroupOf(action);
        if (group === undefined) continue;
        const bucket = groups.get(group);
        if (bucket === undefined) groups.set(group, [action]);
        else bucket.push(action);
    }

    const events: PassedOverEvent[] = [];
    const ordered = [...groups.entries()].sort(
        (a, b) => (GROUP_MAX_SEQ.get(a[0]) ?? 0) - (GROUP_MAX_SEQ.get(b[0]) ?? 0)
    );
    for (const [group, groupActions] of ordered) {
        // Only conclude once the draft moved past the group: mid-group, the
        // enemy can still take the champion (no premature negative signal).
        if (maxObservedSeq <= (GROUP_MAX_SEQ.get(group) ?? 0)) continue;

        const firstSeq = groupActions[0].seq;
        const lastSeq = groupActions[groupActions.length - 1].seq;
        const takenBefore = new Set<string>(); // gone before the group: never an option there
        const takenThrough = new Set<string>(); // gone by the enemy's last action of the group
        for (const action of actions) {
            if (action.seq < firstSeq) takenBefore.add(action.championKey);
            if (action.seq <= lastSeq) takenThrough.add(action.championKey);
        }

        for (const prediction of predict(table, { slotGroup: group, side, exclude: takenBefore })) {
            if (prediction.p < config.passedOverMinP) continue; // not a priority — silence uninformative
            if (takenThrough.has(prediction.championKey)) continue; // taken during the group
            events.push({ championKey: prediction.championKey, atSlotGroup: group, count: 1 });
        }
    }
    return events;
}
