/**
 * I5 — Annotated draft review, "the chess engine of the draft"
 * (ARCHITECTURE_V2 §6 bis I5; prior-art §A4: Lichess / GTO Wizard grammar).
 *
 * Replays a real DraftRecord and grades each decision of the reviewed side
 * against an INJECTED oracle — in production the draft navigator, in tests a
 * lookup-table stub; the oracle is coupled by function type only, this module
 * imports no engine. Conventions of the genre, applied verbatim:
 *  - grades live in WIN-PROBABILITY space (pp), never raw eval;
 *  - wide thresholds ?!/?/?? (≈ −1/−2/−3 pp, configurable — the evaluator is
 *    a noisy oracle, so the bands are the honesty condition);
 *  - SUPPRESSION when choices are near-equal: gap < threshold ⇒ no grade, no
 *    "better was" — zero nag;
 *  - "better was X" only when the recoverable gain clears its own confidence
 *    threshold AND names a different champion than the one played;
 *  - informational notes are each GATED on their context being injected
 *    (ranges / consumed / fogContext) — never invented from nothing;
 *  - the leak report aggregates annotations across games, mechanically
 *    detectable patterns only, sorted by total cost.
 *
 * Bookkeeping notes:
 *  - evLossPp = max(0, best − chosen): an oracle that ranks the played move
 *    above its own best suggestion yields loss 0, never a negative bonus
 *    (Lichess convention — no praise marks from a noisy oracle).
 *  - suppressed entries keep their measured numbers and still count in
 *    `totalLossPp` (the components stay visible, DA-V2-12); only the nags are
 *    silenced.
 *  - the walk advances through BOTH sides' actions (states stay truthful) but
 *    only the reviewed side's resolved actions are annotated; run twice to
 *    review both teams.
 */
import { slotGroupOf } from '$lib/aggregates/tendency';
import type { DraftAction, DraftPhase, DraftRecord, DraftSide } from '$lib/data/types';
import type { DraftState, EnemyDistributionEntry, NavigatorSlot } from '$lib/strategic/draftNavigator';
import { DEFAULT_ANNOTATOR_CONFIG, type AnnotatorConfig } from '$lib/review/annotatorConfig';

export type AnnotationGrade = '' | '?!' | '?' | '??';

/** Machine-readable note markers — leak detection never parses FR prose. */
export type AnnotationNoteTag = 'out-of-range' | 'consumed-ban' | 'early-reveal';

/** The oracle's best available action at a state (navigator top-1 in prod). */
export interface BetterAlternative {
    championKey: string;
    /** Win probability (0-1) for the reviewed side after this action. */
    value: number;
}

/** I2 hook (R6) — coupled by function type, the fog engine is never imported. */
export interface FogContext {
    /**
     * Win-probability pp conceded to enemy counter-picks by revealing this
     * pick now; null = no read on this action.
     */
    revealCostPp: (state: DraftState, action: DraftAction) => number | null;
}

export interface AnnotatorContext {
    /** Side under review — only this side's actions are annotated. */
    side: DraftSide;
    /**
     * Injected oracle: win probability (0-1, reviewed side's perspective)
     * after playing `candidate` on `state`. In prod: the navigator's value.
     */
    valueOf: (state: DraftState, candidate: DraftAction) => number;
    /** Injected oracle: best available action for `side` at `state`. */
    bestAlternative: (state: DraftState, side: DraftSide) => BetterAlternative;
    /**
     * I1/R4 range model for the slot being annotated — enables the
     * out-of-range note on picks. Structurally accepts TendencyPrediction[]
     * and RangeEntry[].
     */
    ranges?: (state: DraftState, slot: NavigatorSlot) => EnemyDistributionEntry[];
    /** Fearless-consumed champions — enables the wasted-ban note. */
    consumed?: Set<string>;
    /** I2 fog hook — enables the early-reveal note on picks. */
    fogContext?: FogContext;
    /**
     * Champion pool at draft start (Fearless-consumed already removed). When
     * omitted it degrades to the keys seen in the record minus `consumed` —
     * enough for replay/table-stub use; oracle callers should inject the
     * real universe so alternative exploration sees the full pool.
     */
    availableAtStart?: Set<string>;
    config?: AnnotatorConfig;
}

export interface BetterWas {
    championKey: string;
    /** Recoverable gain (pp) — the evLossPp of the played action. */
    gainPp: number;
}

export interface ActionAnnotation {
    seq: number;
    actionType: 'pick' | 'ban';
    phase: DraftPhase;
    side: DraftSide;
    championKey: string;
    championName: string;
    /** Best achievable win probability at the state, in pp (0-100). */
    evBeforePp: number;
    /** Win probability after the played action, in pp (0-100). */
    evAfterPp: number;
    /** max(0, evBeforePp − evAfterPp) — clamped, never a negative bonus. */
    evLossPp: number;
    grade: AnnotationGrade;
    /** Present only above the confidence threshold, on a different champion. */
    betterWas?: BetterWas;
    /** True when best and chosen are near-equal — no nag is rendered. */
    suppressed: boolean;
    /** FR informational notes, each gated on its injected context. */
    notesFr: string[];
    /** Machine-readable mirrors of notesFr (1:1), for aggregation. */
    noteTags: AnnotationNoteTag[];
}

export interface TeamAnnotationSummary {
    side: DraftSide;
    /** Σ evLossPp over the annotated actions (suppressed included). */
    totalLossPp: number;
    /** Seq of the costliest decision; null when nothing was lost. */
    worstSeq: number | null;
}

export interface DraftAnnotation {
    /** Carried from the record — leak reports cite games by id. */
    gameId: string;
    actions: ActionAnnotation[];
    teamSummary: TeamAnnotationSummary;
}

// ---- internal: state walking --------------------------------------------------

/** Default champion universe: every key seen in the record, minus consumed. */
function defaultUniverse(record: DraftRecord, consumed: Set<string> | undefined): Set<string> {
    const universe = new Set<string>();
    for (const action of record.actions) {
        if (action.championKey !== '' && consumed?.has(action.championKey) !== true) {
            universe.add(action.championKey);
        }
    }
    return universe;
}

/** Immutable application of a record action onto the replay state. */
function applyAction(state: DraftState, action: DraftAction): DraftState {
    const available = new Set(state.available);
    if (action.championKey !== '') available.delete(action.championKey);
    return { actions: [...state.actions, action], firstPickSide: state.firstPickSide, available };
}

function gradeOf(evLossPp: number, config: AnnotatorConfig): AnnotationGrade {
    if (evLossPp >= config.gradesPp.blunder) return '??';
    if (evLossPp >= config.gradesPp.mistake) return '?';
    if (evLossPp >= config.gradesPp.inaccuracy) return '?!';
    return '';
}

interface Notes {
    notesFr: string[];
    noteTags: AnnotationNoteTag[];
}

/** Informational notes — each one strictly gated on its injected context. */
function buildNotes(state: DraftState, action: DraftAction, ctx: AnnotatorContext, config: AnnotatorConfig): Notes {
    const notesFr: string[] = [];
    const noteTags: AnnotationNoteTag[] = [];

    // Out-of-range pick (gated on ctx.ranges; picks only — the I1 surprise read).
    if (ctx.ranges !== undefined && action.type === 'pick') {
        const slot: NavigatorSlot = { seq: action.seq, phase: action.phase, type: action.type, side: action.side };
        const entries = ctx.ranges(state, slot);
        if (entries.length > 0) {
            const topK = [...entries].sort((a, b) => b.p - a.p).slice(0, config.rangeTopK);
            if (!topK.some((e) => e.championKey === action.championKey)) {
                notesFr.push(
                    `Pick hors de la range top-${config.rangeTopK} modélisée pour ce slot — ` +
                        'tendance cassée ou préparation spécifique.'
                );
                noteTags.push('out-of-range');
            }
        }
    }

    // Wasted Fearless ban (gated on ctx.consumed; bans only).
    if (ctx.consumed !== undefined && action.type === 'ban' && ctx.consumed.has(action.championKey)) {
        notesFr.push(
            `Ban gaspillé : ${action.championName} est déjà consommé cette série (Fearless) — ` +
                'il ne pouvait plus être joué.'
        );
        noteTags.push('consumed-ban');
    }

    // Early reveal (gated on ctx.fogContext; picks only — the I2 read).
    if (ctx.fogContext !== undefined && action.type === 'pick') {
        const cost = ctx.fogContext.revealCostPp(state, action);
        if (cost !== null && cost >= config.earlyRevealMinPp) {
            notesFr.push(
                `Révélation précoce : ~${cost.toFixed(1)} pp concédés aux counter-picks ` +
                    "selon le modèle d'information."
            );
            noteTags.push('early-reveal');
        }
    }

    return { notesFr, noteTags };
}

function annotateAction(
    state: DraftState,
    action: DraftAction,
    ctx: AnnotatorContext,
    config: AnnotatorConfig
): ActionAnnotation {
    const best = ctx.bestAlternative(state, ctx.side);
    const evBeforePp = best.value * 100;
    const evAfterPp = ctx.valueOf(state, action) * 100;
    const evLossPp = Math.max(0, evBeforePp - evAfterPp);
    const suppressed = evLossPp < config.suppressionGapPp;
    const { notesFr, noteTags } = buildNotes(state, action, ctx, config);

    const annotation: ActionAnnotation = {
        seq: action.seq,
        actionType: action.type,
        phase: action.phase,
        side: action.side,
        championKey: action.championKey,
        championName: action.championName,
        evBeforePp,
        evAfterPp,
        evLossPp,
        grade: suppressed ? '' : gradeOf(evLossPp, config),
        suppressed,
        notesFr,
        noteTags
    };
    if (!suppressed && best.championKey !== action.championKey && evLossPp >= config.betterWasMinGainPp) {
        annotation.betterWas = { championKey: best.championKey, gainPp: evLossPp };
    }
    return annotation;
}

// ---- public API -----------------------------------------------------------------

/**
 * Replay `record` and annotate every resolved action of `ctx.side`: EV loss
 * vs the oracle's best line in win-probability pp, wide-band grade,
 * suppression of near-equal choices, gated informational notes, and a team
 * summary (total loss + costliest seq).
 */
export function annotateDraft(record: DraftRecord, ctx: AnnotatorContext): DraftAnnotation {
    const config = ctx.config ?? DEFAULT_ANNOTATOR_CONFIG;
    let state: DraftState = {
        actions: [],
        firstPickSide: record.firstPickSide,
        available: new Set(ctx.availableAtStart ?? defaultUniverse(record, ctx.consumed))
    };

    const annotated: ActionAnnotation[] = [];
    const ordered = [...record.actions].sort((a, b) => a.seq - b.seq);
    for (const action of ordered) {
        // Unresolved keys ('') are skipped but still advance the state.
        if (action.side === ctx.side && action.championKey !== '') {
            annotated.push(annotateAction(state, action, ctx, config));
        }
        state = applyAction(state, action);
    }

    let totalLossPp = 0;
    let worstSeq: number | null = null;
    let worstLoss = 0;
    for (const annotation of annotated) {
        totalLossPp += annotation.evLossPp;
        if (annotation.evLossPp > worstLoss) {
            worstLoss = annotation.evLossPp;
            worstSeq = annotation.seq;
        }
    }

    return {
        gameId: record.gameId,
        actions: annotated,
        teamSummary: { side: ctx.side, totalLossPp, worstSeq }
    };
}

// ---- leak report ------------------------------------------------------------------

export interface LeakReportOptions {
    /** Minimum hits before a pattern becomes a leak (default 2). */
    minOccurrences?: number;
    /** Cost share concentrated in phase 2 that triggers that leak (default 0.5). */
    phase2ShareMin?: number;
}

export interface LeakEntry {
    patternFr: string;
    occurrences: number;
    totalCostPp: number;
    exampleGameIds: string[];
}

interface Hit {
    gameId: string;
    action: ActionAnnotation;
}

function leakOf(patternFr: string, hits: Hit[]): LeakEntry {
    return {
        patternFr,
        occurrences: hits.length,
        totalCostPp: hits.reduce((sum, h) => sum + h.action.evLossPp, 0),
        exampleGameIds: [...new Set(hits.map((h) => h.gameId))]
    };
}

/**
 * Aggregate annotated games (same team) into a leak report — mechanically
 * detectable patterns only, honest and simple:
 *  1. graded mistakes repeated on the same rotation (P1, P2-3, …, B1-B3…);
 *  2. wasted Fearless bans repeated on the same consumed champion;
 *  3. losses concentrated in draft phase 2 (ban2/pick2).
 * Sorted by total cost desc (the genre convention), then occurrences desc,
 * then patternFr asc for determinism.
 */
export function leakReport(annotations: DraftAnnotation[], options: LeakReportOptions = {}): LeakEntry[] {
    const minOccurrences = options.minOccurrences ?? 2;
    const phase2ShareMin = options.phase2ShareMin ?? 0.5;

    const graded: Hit[] = [];
    const consumedBans: Hit[] = [];
    for (const annotation of annotations) {
        for (const action of annotation.actions) {
            if (action.grade !== '') graded.push({ gameId: annotation.gameId, action });
            if (action.noteTags.includes('consumed-ban')) consumedBans.push({ gameId: annotation.gameId, action });
        }
    }

    const entries: LeakEntry[] = [];

    // 1. Repeated graded mistakes on the same rotation.
    const byRotation = new Map<string, Hit[]>();
    for (const hit of graded) {
        const group = slotGroupOf({ type: hit.action.actionType, seq: hit.action.seq });
        if (group === undefined) continue; // off-template seq — nothing to group on
        const hits = byRotation.get(group) ?? [];
        hits.push(hit);
        byRotation.set(group, hits);
    }
    for (const [group, hits] of byRotation) {
        if (hits.length < minOccurrences) continue;
        entries.push(leakOf(`Erreurs répétées en ${group}`, hits));
    }

    // 2. Repeated wasted bans on the same consumed champion.
    const byChampion = new Map<string, Hit[]>();
    for (const hit of consumedBans) {
        const hits = byChampion.get(hit.action.championKey) ?? [];
        hits.push(hit);
        byChampion.set(hit.action.championKey, hits);
    }
    for (const hits of byChampion.values()) {
        if (hits.length < minOccurrences) continue;
        entries.push(leakOf(`Bans gaspillés sur ${hits[0].action.championName} (déjà consommé en Fearless)`, hits));
    }

    // 3. Losses concentrated in draft phase 2.
    const phase2 = graded.filter((h) => h.action.phase === 'ban2' || h.action.phase === 'pick2');
    const totalCost = graded.reduce((sum, h) => sum + h.action.evLossPp, 0);
    if (phase2.length >= minOccurrences && totalCost > 0) {
        const share = phase2.reduce((sum, h) => sum + h.action.evLossPp, 0) / totalCost;
        if (share >= phase2ShareMin) {
            entries.push(leakOf(`Pertes concentrées en phase 2 (${Math.round(share * 100)} % du coût total)`, phase2));
        }
    }

    return entries.sort((a, b) => {
        if (a.totalCostPp !== b.totalCostPp) return b.totalCostPp - a.totalCostPp;
        if (a.occurrences !== b.occurrences) return b.occurrences - a.occurrences;
        return a.patternFr < b.patternFr ? -1 : 1;
    });
}
