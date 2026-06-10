/**
 * I2 — Fog & Reveal: the information game (ARCHITECTURE_V2 §6 bis I2, NOVEL).
 *
 * Flex picks hide the role assignment of our partial comp; nobody quantifies
 * that. Here ambiguity becomes a measurable resource, in the Aumann–Maschler
 * revelation frame (repeated games with incomplete information — optimal
 * play trades exploiting private information against revealing it; research
 * §A3):
 *
 * - `roleAssignmentHypotheses` builds H(A), the role-map hypotheses the
 *   ENEMY can hold about our partial comp, weighted by injected role priors.
 *   This is determinization over role assignments (research §A2) with FULL
 *   support: ≤ 5! = 120 injective maps are enumerated exactly, so no
 *   sampling and therefore no RNG is needed — everything is deterministic.
 *   `inferRoles` (M5.2) is the greedy POINT estimate; this is the
 *   distribution it collapses.
 * - `ambiguityBits` is the Shannon entropy of H — the "ambiguïté restante :
 *   2,3 bits" UI read.
 * - `fogValue` prices that ambiguity (§6 bis formula):
 *       Φ(x) = E_h~P(·|A+x)[ BR(h) | assignment known ]
 *            − BR under uncertainty over P(·|A+x)
 *   what their best response loses by not knowing the role map. Both
 *   best-response equities come from INJECTED functions (the draftNavigator/
 *   evaluator in prod, hand stubs in tests) — coupled by function type only,
 *   like the navigator's doctrine. The cognitive-hierarchy depth cap (k≈1-2)
 *   lives inside the injected BR, not here.
 * - `revelationCost` is the price of committing a pick: entropy lost on H
 *   plus the equity their unlocked answers gain once x is on the board.
 * - `baitLedger` values leaving a champion open (§6 bis formula, verbatim):
 *       EV = P(take)·[our prepared answer − their equity] + P(pass)·option
 *
 * DA-V2-12: every output exposes its components separately — fog is a shown
 * difference of two shown equities, bait ev is the sum of two shown branches,
 * and revelation's two faces (bits vs equity) are incommensurable and NEVER
 * combined. DA-V2-11: every evaluative report carries `experimental: true`
 * until the G4 retrospective validation (fog × counter-picks suffered).
 * Tunables live in `fogRevealConfig.ts` (DA-V2-6).
 */
import { ROLES, type Role } from '$lib/types';
import { DEFAULT_FOG_REVEAL_CONFIG, type FogRevealConfig } from '$lib/strategic/fogRevealConfig';

/** One role-map hypothesis the enemy can hold about our partial comp. */
export interface Hypothesis {
    /** Role → champion key; roles not in the map are still unassigned. */
    assignment: Map<Role, string>;
    /** Normalized probability (Σp = 1 over the returned hypotheses). */
    p: number;
}

/**
 * Injected role priors: relative weight of each role for a champion (only
 * finite weights > 0 count as playable). The call-site chooses the source —
 * `flexMap` byRole counts, Dataset games per role, or coach priors — the
 * engine never imports an aggregate (function-type coupling only).
 */
export type RolePriors = (championKey: string) => Partial<Record<Role, number>>;

/** IEEE −0 guard so reports and tests never carry a negative zero. */
const noNegZero = (value: number): number => (value === 0 ? 0 : value);

/** Canonical text form of an assignment (ROLES order) — deterministic ties. */
function canonicalKey(assignment: Map<Role, string>): string {
    const parts: string[] = [];
    for (const role of ROLES) {
        const championKey = assignment.get(role);
        if (championKey !== undefined) parts.push(`${role}:${championKey}`);
    }
    return parts.join('|');
}

/**
 * Enumerate H(A): every injective role assignment of `partialPicks` whose
 * every (champion, role) pair has a positive prior, weighted by the product
 * of priors and normalized. Bounded by construction: ≤ 5!/(5−n)! ≤ 120
 * leaves for n ≤ 5 picks (more than 5 picks cannot all place — []). The
 * empty comp is fully known: one empty hypothesis with p = 1 (0 bits).
 * Sorted p descending, then canonical assignment ascending; config can floor
 * (`minHypothesisP`) and cap (`maxHypotheses`) the list, renormalizing
 * whenever something was dropped.
 */
export function roleAssignmentHypotheses(
    partialPicks: string[],
    rolePriors: RolePriors,
    config: FogRevealConfig = DEFAULT_FOG_REVEAL_CONFIG
): Hypothesis[] {
    if (partialPicks.length === 0) return [{ assignment: new Map<Role, string>(), p: 1 }];

    // Playable roles per pick, in canonical ROLES order (deterministic walk).
    const options = partialPicks.map((championKey) => {
        const priors = rolePriors(championKey);
        const playable: Array<{ role: Role; weight: number }> = [];
        for (const role of ROLES) {
            const weight = priors[role];
            if (weight !== undefined && Number.isFinite(weight) && weight > 0) playable.push({ role, weight });
        }
        return playable;
    });
    // A pick with no playable role kills every assignment outright.
    if (options.some((list) => list.length === 0)) return [];

    const leaves: Array<{ assignment: Map<Role, string>; weight: number }> = [];
    const used = new Set<Role>();
    const stack: Array<[Role, string]> = [];
    const walk = (index: number, weight: number): void => {
        if (index === partialPicks.length) {
            leaves.push({ assignment: new Map(stack), weight });
            return;
        }
        for (const option of options[index]) {
            if (used.has(option.role)) continue;
            used.add(option.role);
            stack.push([option.role, partialPicks[index]]);
            walk(index + 1, weight * option.weight);
            stack.pop();
            used.delete(option.role);
        }
    };
    walk(0, 1);

    let total = 0;
    for (const leaf of leaves) total += leaf.weight;
    if (total <= 0) return []; // no injective assignment survives the priors

    const keyed = leaves.map((leaf) => ({
        hypothesis: { assignment: leaf.assignment, p: leaf.weight / total },
        key: canonicalKey(leaf.assignment)
    }));
    keyed.sort((a, b) => {
        if (a.hypothesis.p !== b.hypothesis.p) return b.hypothesis.p - a.hypothesis.p;
        return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });

    // Floor then cap (both eat the tail of the sorted list); renormalize only
    // when something was actually dropped, to keep the no-prune path pristine.
    const kept = keyed
        .filter((entry) => entry.hypothesis.p >= config.minHypothesisP)
        .slice(0, config.maxHypotheses)
        .map((entry) => entry.hypothesis);
    if (kept.length === keyed.length) return kept;

    let keptTotal = 0;
    for (const hypothesis of kept) keptTotal += hypothesis.p;
    return kept.map((hypothesis) => ({ assignment: hypothesis.assignment, p: hypothesis.p / keptTotal }));
}

/**
 * Shannon entropy of the hypothesis distribution, in bits — the measure of
 * how unreadable our comp still is (uniform 2 hypotheses = 1 bit). Assumes a
 * normalized distribution; non-positive p entries contribute nothing.
 */
export function ambiguityBits(hypotheses: Hypothesis[]): number {
    let bits = 0;
    for (const hypothesis of hypotheses) {
        if (hypothesis.p <= 0) continue;
        bits -= hypothesis.p * Math.log2(hypothesis.p);
    }
    return noNegZero(bits);
}

/**
 * The injected evaluation surface (prod: draftNavigator + analyzer over their
 * I1 range top-k; tests: hand stubs). Both equities are from THEIR side, in
 * win-probability units.
 */
export interface FogEvalContext {
    /** Equity of their best response when our role map is KNOWN to be `assignment`. */
    enemyBestResponse: (assignment: Map<Role, string>) => number;
    /**
     * Equity of their single best response against the whole hypothesis
     * DISTRIBUTION (they must commit one answer without knowing h): in prod
     * max over their candidates of Σ_h p(h)·equity — the determinized search.
     */
    enemyBestResponseUnderUncertainty: (hypotheses: Hypothesis[]) => number;
}

/**
 * The information state around ONE candidate: the hypothesis distributions
 * on our comp as the enemy reads it, before and after the candidate joins.
 * `fogValue` conditions on `after` (the §6 bis formula reads P(·|A+x));
 * `before` rides along so one state serves the candidate's full card
 * (`revelationCost` consumes both sides).
 */
export interface FogState {
    before: Hypothesis[];
    after: Hypothesis[];
}

/** The fog formula's three displayed components (DA-V2-12). */
export interface FogComponents {
    /** E_h[BR(h)] — their best-response equity if they KNEW the role map. */
    knownEquity: number;
    /** Their best-response equity while the role map stays hidden. */
    uncertainEquity: number;
    /** Φ = knownEquity − uncertainEquity: what not knowing costs them. */
    fog: number;
}

export interface FogValueReport {
    championKey: string;
    components: FogComponents;
    /** Entropy of the after-state, in bits — "ambiguïté restante". */
    remainingAmbiguityBits: number;
    /** DA-V2-11: experimental until the G4 retrospective validation. */
    experimental: true;
}

/** E_h[BR(h.assignment)] over a (normalized) hypothesis distribution. */
function knownEquityOf(hypotheses: Hypothesis[], ctx: FogEvalContext): number {
    let equity = 0;
    for (const hypothesis of hypotheses) equity += hypothesis.p * ctx.enemyBestResponse(hypothesis.assignment);
    return equity;
}

/**
 * Best-response equity under uncertainty, with the degenerate cases solved
 * exactly: an empty set is unreadable (neutral 0 — an impossible comp, e.g.
 * a candidate whose roles are all taken) and a singleton hides nothing, so
 * BR-under-uncertainty IS the known BR (the injected uncertainty evaluator
 * is not even called — fog is zero by definition, never by stub luck).
 */
function uncertainEquityOf(hypotheses: Hypothesis[], ctx: FogEvalContext): number {
    if (hypotheses.length === 0) return 0;
    if (hypotheses.length === 1) return ctx.enemyBestResponse(hypotheses[0].assignment);
    return ctx.enemyBestResponseUnderUncertainty(hypotheses);
}

/**
 * Fog value of `candidateKey` (§6 bis): Φ = E_h~P(·|A+x)[BR(h known)] − BR
 * under uncertainty over the same distribution — the equity their best
 * response loses while our role map stays ambiguous. Φ ≥ 0 in theory
 * (Jensen); a noisy injected evaluator may produce small negatives, which
 * are reported as-is — the engine never massages its components (DA-V2-12).
 */
export function fogValue(candidateKey: string, state: FogState, ctx: FogEvalContext): FogValueReport {
    const knownEquity = knownEquityOf(state.after, ctx);
    const uncertainEquity = uncertainEquityOf(state.after, ctx);
    return {
        championKey: candidateKey,
        components: { knownEquity, uncertainEquity, fog: knownEquity - uncertainEquity },
        remainingAmbiguityBits: ambiguityBits(state.after),
        experimental: true
    };
}

export interface RevelationCostReport {
    championKey: string;
    /**
     * Information face: ambiguityBits(before) − ambiguityBits(after), in
     * bits. Positive = picking the candidate REVEALS (entropy lost);
     * negative = a flex pick that deepens the fog.
     */
    entropyLossBits: number;
    /**
     * Equity face: uncertain-BR(after) − uncertain-BR(before) — what their
     * best available answer gains once the candidate is on the board (the
     * counters it unlocks). Bundles the positional and informational change;
     * read NEXT TO `entropyLossBits` and to `fogValue` (bits and equity are
     * incommensurable and never summed — DA-V2-12).
     */
    unlockedCounterGain: number;
    /** DA-V2-11: experimental until the G4 retrospective validation. */
    experimental: true;
}

/** Cost of committing `candidateKey`: entropy lost + answers unlocked (§6 bis). */
export function revelationCost(
    candidateKey: string,
    before: Hypothesis[],
    after: Hypothesis[],
    ctx: FogEvalContext
): RevelationCostReport {
    return {
        championKey: candidateKey,
        entropyLossBits: ambiguityBits(before) - ambiguityBits(after),
        unlockedCounterGain: uncertainEquityOf(after, ctx) - uncertainEquityOf(before, ctx),
        experimental: true
    };
}

export interface BaitContext {
    /**
     * P(they take the champion) from the I1 range model. Defensively clamped
     * to [0, 1]: a banEv-style Σ over several upcoming slots may exceed 1,
     * but the bait formula is a single take-it-or-not event.
     */
    takeProbability: (championKey: string) => number;
    /** Their equity if they take it. */
    theirEquityIfTaken: (championKey: string) => number;
    /** Our PREPARED answer's equity if they take it (the trap springs). */
    ourPreparedAnswerEquity: (championKey: string) => number;
    /** Option value retained when they pass (default from config). */
    optionValue?: number;
    config?: FogRevealConfig;
}

/** All bait inputs and both EV branches, displayed separately (DA-V2-12). */
export interface BaitComponents {
    takeProbability: number;
    ourAnswerEquity: number;
    theirEquity: number;
    optionValue: number;
    /** P·(ourAnswerEquity − theirEquity) — the "they bite" branch. */
    takenBranch: number;
    /** (1−P)·optionValue — the "they pass" branch. */
    keptBranch: number;
}

export interface BaitEntry {
    championKey: string;
    /** takenBranch + keptBranch — the §6 bis formula; a sort key, the components stay visible. */
    ev: number;
    components: BaitComponents;
    verdictFr: string;
    /** DA-V2-11: experimental until the G4 retrospective validation. */
    experimental: true;
}

const VERDICT_BAIT_FR = 'Appât rentable — à laisser ouvert';
const VERDICT_TRAP_FR = 'Piège — le laisser ouvert nous coûte (à bannir ou à prendre)';
const VERDICT_NEUTRAL_FR = 'Neutre — ni appât ni piège net';

/**
 * Bait ledger over the champions we could leave open (§6 bis, verbatim):
 *   EV(leave c open) = P(take)·[our prepared answer − their equity]
 *                    + (1−P)·option value retained.
 * Sorted ev descending (ties: takeProbability descending, then champion key
 * ascending); duplicated candidates are evaluated once.
 */
export function baitLedger(openChampions: string[], ctx: BaitContext): BaitEntry[] {
    const config = ctx.config ?? DEFAULT_FOG_REVEAL_CONFIG;
    const optionValue = ctx.optionValue ?? config.defaultOptionValue;

    const entries: BaitEntry[] = [];
    const seen = new Set<string>();
    for (const championKey of openChampions) {
        if (seen.has(championKey)) continue;
        seen.add(championKey);

        const takeProbability = Math.min(1, Math.max(0, ctx.takeProbability(championKey)));
        const ourAnswerEquity = ctx.ourPreparedAnswerEquity(championKey);
        const theirEquity = ctx.theirEquityIfTaken(championKey);
        const takenBranch = noNegZero(takeProbability * (ourAnswerEquity - theirEquity));
        const keptBranch = noNegZero((1 - takeProbability) * optionValue);
        const ev = noNegZero(takenBranch + keptBranch);

        const verdictFr =
            ev >= config.baitGoodEv ? VERDICT_BAIT_FR : ev <= config.baitTrapEv ? VERDICT_TRAP_FR : VERDICT_NEUTRAL_FR;

        entries.push({
            championKey,
            ev,
            components: { takeProbability, ourAnswerEquity, theirEquity, optionValue, takenBranch, keptBranch },
            verdictFr,
            experimental: true
        });
    }

    return entries.sort((a, b) => {
        if (a.ev !== b.ev) return b.ev - a.ev;
        if (a.components.takeProbability !== b.components.takeProbability) {
            return b.components.takeProbability - a.components.takeProbability;
        }
        return a.championKey < b.championKey ? -1 : 1;
    });
}
