/**
 * Coach en direct — turns the Draft page's role-keyed entry into a navigator
 * state and produces ranked, EXPLAINED recommendations for the next action.
 *
 * The page stores picks per role and bans per index (no true global order);
 * the state is rebuilt on the blue-first template like /review does — an
 * approximation that is explicitly labelled in the UI. The navigator then
 * explores depth-limited expectimax lines (our nodes = max, enemy nodes =
 * expectation over the tendency-derived distribution) and each candidate is
 * enriched with plain-French reasons: the M5.5 pick axes (plan alignment,
 * gap-fill, counter, redundancy) for picks, the banEV components for bans,
 * and the expected continuation line. The audience is NOT a professional
 * coach — every output here must be readable without draft jargon.
 *
 * Pure module: datasets/evaluator/tendency table/pools are injected; no
 * fetch, no storage, no system clock.
 */
import { banRotationOf, rotationOf } from '$lib/aggregates/rotations';
import { predict, type TendencyTable } from '$lib/aggregates/tendency';
import { buildDraftActions, DRAFT_TEMPLATE } from '$lib/data/draftRecord';
import type { DraftAction, DraftSide } from '$lib/data/types';
import { counterThreat, pairPrior, type TagPairFit } from '$lib/estimators/tagPairs';
import { ambiguityBits, roleAssignmentHypotheses, type RolePriors } from '$lib/strategic/fogReveal';
import { classifyGamePlan } from '$lib/strategic/gamePlanClassifier';
import {
    navigate,
    nextSlotOf,
    type DraftEvaluator,
    type DraftState,
    type NavigatorSlot
} from '$lib/strategic/draftNavigator';
import { suggestPicks } from '$lib/strategic/pickSuggester';
import { classifyPoolTier } from '$lib/strategic/poolTierClassifier';
import { loadDefaultTags } from '$lib/tags';
import type { ChampionTag, ChampionTagsFile } from '$lib/tags/types';
import type { ProPlayer } from '$lib/pro/types';
import { ROLES, type Dataset, type Role } from '$lib/types';

export interface RoleEntryDraft {
    /** Role-indexed champion keys (0=Top … 4=Support), null = empty slot. */
    allyPicks: (string | null)[];
    enemyPicks: (string | null)[];
    allyBans: (string | null)[];
    enemyBans: (string | null)[];
    allySide: DraftSide;
    /** Fearless lockouts and any other unavailable champions. */
    excludedKeys?: string[];
}

/**
 * Rebuild a navigator DraftState from role-keyed entry. Order approximation:
 * each side's known picks/bans fill that side's template slots in role order
 * (the real pick order is unknown in manual entry — documented in the UI).
 */
export function draftStateFromRoleEntry(entry: RoleEntryDraft, tagsFile: ChampionTagsFile = loadDefaultTags()): DraftState {
    const compact = (slots: (string | null)[]): string[] =>
        slots.filter((key): key is string => key !== null && key !== '');
    // Role-keyed entry COMMITS the role by construction (the user typed the
    // champion at that role index) — carried on the actions so the role
    // coverage filter (filterByOpenRoles) can read our own committed roles.
    const columnsOf = (picks: (string | null)[], bans: (string | null)[]): { picks: string[]; roles: Role[]; bans: string[] } => {
        const pickKeys: string[] = [];
        const roles: Role[] = [];
        picks.forEach((key, index) => {
            if (key !== null && key !== '') {
                pickKeys.push(key);
                roles.push(index as Role);
            }
        });
        return { picks: pickKeys, roles, bans: compact(bans) };
    };
    const allyColumns = columnsOf(entry.allyPicks, entry.allyBans);
    const enemyColumns = columnsOf(entry.enemyPicks, entry.enemyBans);
    const blue = entry.allySide === 'blue' ? allyColumns : enemyColumns;
    const red = entry.allySide === 'blue' ? enemyColumns : allyColumns;

    const { actions } = buildDraftActions({
        blue,
        red,
        firstPickSide: 'blue',
        resolveKey: (key) => key // entry already stores resolved champion keys
    });

    const used = new Set<string>(actions.map((a) => a.championKey));
    for (const key of entry.excludedKeys ?? []) used.add(key);
    const available = new Set<string>(Object.keys(tagsFile.champions).filter((key) => !used.has(key)));

    return { actions, firstPickSide: 'blue', available };
}

/**
 * Navigator state from EXACT ordered actions (the sequence entry mode) —
 * no template approximation, no forfeited-ban sentinels: the coach sees the
 * true board, ban turns included. `firstPickSide` (First Selection 2026)
 * must match the convention the actions were mapped with: the navigator
 * derives the side of every FUTURE slot from it.
 */
export function draftStateFromActions(
    actions: DraftAction[],
    excludedKeys: string[] = [],
    tagsFile: ChampionTagsFile = loadDefaultTags(),
    firstPickSide: DraftSide = 'blue'
): DraftState {
    const used = new Set<string>(actions.map((a) => a.championKey));
    for (const key of excludedKeys) used.add(key);
    const available = new Set<string>(Object.keys(tagsFile.champions).filter((key) => !used.has(key)));
    return { actions: [...actions].sort((a, b) => a.seq - b.seq), firstPickSide, available };
}

export interface CoachReason {
    textFr: string;
}

export interface CoachCandidate {
    championKey: string;
    actionType: 'pick' | 'ban';
    /** Estimated win probability of OUR side after this action (0..1). */
    winAfter: number;
    /** Gap to the next-best candidate, in win-percentage points. */
    edgeVsNextPp: number;
    /** Expected continuation (champion keys, navigator principal line). */
    line: string[];
    /** Plain-French reasons — axes that actually fired, never invented. */
    reasonsFr: string[];
    components: { immediatePp: number; lookaheadPp: number };
    /**
     * Strongest historical tag-pair signal with an already-picked ally
     * (corpus cells, §6.3) — positive or negative; absent below the floor.
     */
    pairWith?: { championKey: string; championName: string; residualPp: number; evidence: number };
    /**
     * Ordered counter-cell read vs the revealed enemy comp (the signal the
     * phase-2 banEV validated ×2.6-7.3 OOS) — absent below the floor.
     */
    counterVs?: { threatPp: number; evidence: number };
}

export interface CoachAdvice {
    /** The slot to play now; null = draft complete. */
    turn: (NavigatorSlot & { isOurs: boolean; doubleSlot: boolean }) | null;
    /** Ranked candidates when it is OUR turn (empty on enemy turn). */
    candidates: CoachCandidate[];
    /** What the enemy most likely does now (their turn, or our lookahead). */
    enemyExpectation: { championKey: string; p: number }[];
    /** One-sentence FR header for the panel. */
    headlineFr: string;
    evaluatedNodes: number;
    experimental: true;
}

export interface CoachContext {
    ourSide: DraftSide;
    evaluate: DraftEvaluator;
    /** Opponent tendency table (corpus+golgg merged) — enemy distribution. */
    table?: TendencyTable;
    /** Our synced roster — candidate pool, strongest tiers first. */
    allyPlayers?: ProPlayer[];
    /** Fallback candidate ranking when no roster (e.g. league presence). */
    fallbackCandidates?: string[];
    tagsFile?: ChampionTagsFile;
    dataset?: Dataset;
    depth?: number;
    topK?: number;
    /** Our candidates considered at the root (and our tree nodes). */
    candidateCount?: number;
    /**
     * Fitted same-team tag-pair cells (corpus) — adds the pair axis to pick
     * reasons. Draft science 2026-06 §B: pros package duos at the double
     * slots (46 %/43 % vs 21 % baseline), so the pairing read matters most
     * exactly where the coach speaks.
     */
    pairFit?: TagPairFit;
    /**
     * Fitted ORDERED cross-team counter cells (corpus) — adds the
     * counter-the-revealed-comp axis to pick reasons. Same signal the
     * phase-2 banEV regime validated out of sample (3 beats + 1 tie).
     */
    counterFit?: TagPairFit;
    /**
     * Pick-phase coaching: ban slots are treated as forfeited (the analyzer
     * view has no ban entry) — the turn is the first unfilled PICK slot and
     * the lookahead skips ban nodes (empty providers → navigator skip).
     */
    picksOnly?: boolean;
    /**
     * Priors de rôle P(rôle | champion) — seam OPTIONNEL de la contrainte de
     * couverture de rôle de NOTRE compo (filterByOpenRoles). Absent ⇒ filtre
     * inactif (comportement historique). La page fournit les priors de la
     * ligue du camp conseillé.
     */
    rolePriors?: RolePriors;
    /** Plancher de viabilité du filtre de rôle (défaut DEFAULT_ROLE_COVERAGE_FLOOR). */
    roleCoverageFloor?: number;
}

const SIDE_FR: Record<DraftSide, string> = { blue: 'bleu', red: 'rouge' };

// ---- enemy role read (I2 hypotheses over the entered enemy picks) -----------

/** Confidence floor before the data is allowed to contradict the user's slot. */
export const ROLE_MISMATCH_MIN_P = 0.6;

export interface EnemyRoleRead {
    championKey: string;
    /** Slot the user entered the pick in (0=Top … 4=Support). */
    enteredRole: Role;
    /** Most likely role per the corpus priors; null when nothing places it. */
    topRole: Role | null;
    pTopRole: number;
    /** The data confidently disagrees with the entered slot. */
    mismatch: boolean;
}

export interface EnemyRoleReport {
    reads: EnemyRoleRead[];
    /** Shannon bits left over the enemy role map (0 = fully readable). */
    ambiguityBits: number;
    experimental: true;
}

/**
 * Read the enemy's probable role map from their entered picks: the I2
 * hypothesis distribution (`roleAssignmentHypotheses`) marginalized per
 * champion. Champions absent from the priors get a uniform fallback so one
 * unknown pick cannot kill the whole enumeration. The mismatch flag is the
 * actionable bit: « vous l'avez slotté top, mais il joue 82 % mid chez eux ».
 */
export function readEnemyRoles(entry: RoleEntryDraft, rolePriors: RolePriors): EnemyRoleReport {
    const picks: { championKey: string; enteredRole: Role }[] = [];
    entry.enemyPicks.forEach((key, index) => {
        if (key !== null && key !== '') picks.push({ championKey: key, enteredRole: index as Role });
    });
    const safePriors: RolePriors = (championKey) => {
        const weights = rolePriors(championKey);
        for (const role of ROLES) if ((weights[role] ?? 0) > 0) return weights;
        return { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 };
    };
    const hypotheses = roleAssignmentHypotheses(
        picks.map((p) => p.championKey),
        safePriors
    );
    const reads: EnemyRoleRead[] = picks.map(({ championKey, enteredRole }) => {
        const marginal = new Map<Role, number>();
        for (const hypothesis of hypotheses) {
            for (const [role, key] of hypothesis.assignment) {
                if (key === championKey) marginal.set(role, (marginal.get(role) ?? 0) + hypothesis.p);
            }
        }
        let topRole: Role | null = null;
        let pTopRole = 0;
        for (const role of ROLES) {
            const p = marginal.get(role) ?? 0;
            if (p > pTopRole) {
                pTopRole = p;
                topRole = role;
            }
        }
        return {
            championKey,
            enteredRole,
            topRole,
            pTopRole,
            mismatch: topRole !== null && topRole !== enteredRole && pTopRole >= ROLE_MISMATCH_MIN_P
        };
    });
    return { reads, ambiguityBits: ambiguityBits(hypotheses), experimental: true };
}

/**
 * Template seqs that OPEN a back-to-back double pick (8-9, 10-11, 18-19) —
 * structural, valid for either first-pick side. The §B finding lives here:
 * the second pick of the double is safe from interception, so the pair
 * should be THOUGHT at the first one.
 */
export const DOUBLE_SLOT_FIRST_SEQS: ReadonlySet<number> = new Set([8, 10, 18]);

/** Minimum |residual| (win-rate points, 0..1 scale) before the pair axis speaks. */
export const PAIR_REASON_FLOOR = 0.01;

/** Best pair signal of a candidate against the already-picked ally comp. */
function bestPairSignal(
    championKey: string,
    allyComp: string[],
    fit: TagPairFit,
    tagsFile: ChampionTagsFile
): CoachCandidate['pairWith'] {
    const candidateTag = tagsFile.champions[championKey];
    if (candidateTag === undefined || fit.pairObservations === 0) return undefined;
    let best: { championKey: string; residual: number; evidence: number } | undefined;
    for (const allyKey of allyComp) {
        const allyTag = tagsFile.champions[allyKey];
        if (allyTag === undefined) continue;
        const prior = pairPrior(candidateTag, allyTag, fit);
        if (prior.evidence === 0) continue;
        if (best === undefined || Math.abs(prior.residual) > Math.abs(best.residual)) {
            best = { championKey: allyKey, residual: prior.residual, evidence: prior.evidence };
        }
    }
    if (best === undefined || Math.abs(best.residual) < PAIR_REASON_FLOOR) return undefined;
    return {
        championKey: best.championKey,
        championName: tagsFile.champions[best.championKey]?.name ?? best.championKey,
        residualPp: best.residual * 100,
        evidence: best.evidence
    };
}

// ---- contrainte de couverture de rôle de NOTRE compo (post-gate-A) ----------

/**
 * Plancher de viabilité du filtre de rôle : part minimale de la masse
 * P(rôle | champion) qui doit tomber sur nos rôles encore OUVERTS pour
 * qu'un candidat reste proposé. Config exportée et injectable (DA-V2-6)
 * via `CoachContext.roleCoverageFloor`.
 */
export const DEFAULT_ROLE_COVERAGE_FLOOR = 0.15;

/** Confiance minimale avant d'écrire « pour votre X encore ouvert » (raison FR). */
export const OPEN_ROLE_REASON_MIN_P = 0.6;

/** Libellés FR des rôles pour la raison « encore ouvert » (audience apprenante). */
const OPEN_ROLE_REASON_FR: Record<Role, string> = {
    0: 'Pour votre top encore ouvert.',
    1: 'Pour votre jungle encore ouverte.',
    2: 'Pour votre mid encore ouvert.',
    3: 'Pour votre ADC encore ouvert.',
    4: 'Pour votre support encore ouvert.'
};

/**
 * Rôles encore OUVERTS d'un side : les 5 rôles moins ceux des picks de ce
 * side dont le rôle est COMMITTÉ (`action.role`). Un pick role-less (flex,
 * mode séquence) ne verrouille AUCUN rôle — c'est voulu : l'incertitude
 * reste entière tant que le rôle n'est pas engagé.
 */
export function openRolesOf(state: DraftState, side: DraftSide): Role[] {
    const committed = new Set<Role>();
    for (const action of state.actions) {
        if (action.type === 'pick' && action.side === side && action.championKey !== '' && action.role !== undefined) {
            committed.add(action.role);
        }
    }
    return ROLES.filter((role) => !committed.has(role));
}

/** Masse de probabilité de rôle d'un candidat sur les rôles ouverts; null = champion inconnu des priors. */
function openRoleViability(championKey: string, openRoles: readonly Role[], rolePriors: RolePriors): number | null {
    const weights = rolePriors(championKey);
    let total = 0;
    let openMass = 0;
    for (const role of ROLES) {
        const weight = weights[role] ?? 0;
        if (!Number.isFinite(weight) || weight <= 0) continue;
        total += weight;
        if (openRoles.includes(role)) openMass += weight;
    }
    return total === 0 ? null : openMass / total;
}

/**
 * Config évoluée POST-gate-A (2026-06-11, contrainte de rôle = suspect n°3
 * du rapport rouge) — la gate sera re-passée avec la config courante
 * (run #3) ; le badge Expérimental reste.
 *
 * Filtre de couverture de rôle de NOTRE compo : un candidat n'est proposé
 * que si une part suffisante (≥ floor) de sa masse P(rôle | champion) tombe
 * sur nos rôles encore OUVERTS. Champion inconnu des priors ⇒ CONSERVÉ
 * (uniforme, honnête : pas de data, pas d'exclusion). Garde-fou : si le
 * filtre vidait la liste, la liste NON filtrée est retournée — mieux vaut
 * des candidats discutables que zéro candidat.
 */
export function filterByOpenRoles(
    candidates: string[],
    state: DraftState,
    ourSide: DraftSide,
    rolePriors: RolePriors,
    floor: number = DEFAULT_ROLE_COVERAGE_FLOOR
): string[] {
    const open = openRolesOf(state, ourSide);
    if (open.length === ROLES.length) return candidates; // aucun rôle committé → rien à contraindre
    const kept = candidates.filter((championKey) => {
        const viability = openRoleViability(championKey, open, rolePriors);
        return viability === null || viability >= floor;
    });
    return kept.length > 0 ? kept : candidates;
}

/**
 * Our candidate ranking: pool tiers first (strongest → learning), then fallback.
 * Exported for the coach gate runner (chantier A run #2): the gate replays the
 * SHIPPED candidate chain by importing this very function — never a replica.
 */
export function rankOurCandidates(ctx: CoachContext, state: DraftState, count: number): string[] {
    const taken = new Set(state.actions.map((a) => a.championKey));
    const out: string[] = [];
    const push = (key: string): void => {
        if (!taken.has(key) && state.available.has(key) && !out.includes(key)) out.push(key);
    };

    if (ctx.allyPlayers !== undefined) {
        const tierRank = { strongest: 0, 'match-ready': 1, 'scrim-ready': 2, learning: 3 } as const;
        const entries = ctx.allyPlayers
            .flatMap((player) => player.pool)
            .map((entry) => ({ key: entry.championKey, games: entry.games, tier: classifyPoolTier(entry) }))
            .sort((a, b) => tierRank[a.tier] - tierRank[b.tier] || b.games - a.games || (a.key < b.key ? -1 : 1));
        for (const entry of entries) push(entry.key);
    }
    for (const key of ctx.fallbackCandidates ?? []) push(key);

    // Contrainte de couverture de rôle (post-gate-A, suspect n°3) : APRÈS le
    // filtre de disponibilité (push), AVANT la troncature — chemins roster ET
    // fallback. Aux tours de PICK seulement : un ban vise l'adversaire, pas
    // la couverture de notre compo.
    if (ctx.rolePriors !== undefined && nextSlotOf(state)?.type === 'pick') {
        return filterByOpenRoles(
            out,
            state,
            ctx.ourSide,
            ctx.rolePriors,
            ctx.roleCoverageFloor ?? DEFAULT_ROLE_COVERAGE_FLOOR
        ).slice(0, count);
    }
    return out.slice(0, count);
}

/**
 * Enemy distribution for a slot from the tendency table (empty = skip).
 * Exported for the coach gate runner (chantier A run #2) — same import-the-
 * shipped-function rule as `rankOurCandidates`.
 */
export function enemyDistributionOf(
    ctx: CoachContext,
    state: DraftState,
    slot: NavigatorSlot
): { championKey: string; p: number }[] {
    if (ctx.table === undefined) return [];
    const slotGroup = slot.type === 'pick' ? rotationOf(slot.seq) : banRotationOf(slot.seq);
    if (slotGroup === undefined) return [];
    const exclude = new Set<string>(state.actions.map((a) => a.championKey));
    return predict(ctx.table, { slotGroup, side: slot.side, exclude })
        .filter((p) => state.available.has(p.championKey))
        .map((p) => ({ championKey: p.championKey, p: p.p }));
}

/** Role-ordered comp of one side from the state (gaps = ''). */
function compOf(state: DraftState, side: DraftSide): string[] {
    const picks = state.actions.filter((a) => a.type === 'pick' && a.side === side).map((a) => a.championKey);
    // Role attribution is unknown here — the comp is positional for the
    // tag-based readers (classifyGamePlan/suggestPicks tolerate that).
    return picks;
}

/**
 * Compute the coach advice for the current state. Cost is bounded by
 * depth/topK/candidateCount — the defaults stay interactive (<1 s with the
 * real evaluator) so the panel can refresh on every entry change.
 */
export function recommendNext(state: DraftState, ctx: CoachContext): CoachAdvice {
    const tagsFile = ctx.tagsFile ?? loadDefaultTags();
    if (ctx.picksOnly === true) {
        // Pick-phase coaching: the analyzer view has no ban entry. nextSlotOf
        // assumes a contiguous prefix, so forfeited-ban sentinels are added
        // only UP TO the first unfilled pick slot (the turn); ban slots met
        // later in the lookahead are skipped via empty providers below.
        const filled = new Set(state.actions.map((a) => a.seq));
        const sentinels: typeof state.actions = [];
        for (const s of DRAFT_TEMPLATE) {
            if (filled.has(s.seq)) continue;
            if (s.type === 'pick') break; // this is the turn — stop forfeiting
            sentinels.push({
                seq: s.seq,
                type: 'ban',
                phase: s.phase,
                side: s.first === (state.firstPickSide === 'blue') ? 'blue' : 'red',
                championKey: '',
                championName: ''
            });
        }
        state = {
            ...state,
            actions: [...state.actions, ...sentinels].sort((a, b) => a.seq - b.seq)
        };
    }
    const slot = nextSlotOf(state);
    if (slot === null) {
        return {
            turn: null,
            candidates: [],
            enemyExpectation: [],
            headlineFr: 'Draft complète — passez à la lecture stratégique ou à la revue.',
            evaluatedNodes: 0,
            experimental: true
        };
    }

    const isOurs = slot.side === ctx.ourSide;
    const doubleSlot = slot.type === 'pick' && DOUBLE_SLOT_FIRST_SEQS.has(slot.seq);
    const enemyNow = enemyDistributionOf(ctx, state, slot).slice(0, 5);

    if (!isOurs) {
        const top = enemyNow[0];
        const base =
            top !== undefined
                ? `Tour adverse (${slot.type === 'pick' ? 'pick' : 'ban'}, côté ${SIDE_FR[slot.side]}) — attendu en tête de range : ${Math.round(top.p * 100)} %.`
                : `Tour adverse (${slot.type === 'pick' ? 'pick' : 'ban'}, côté ${SIDE_FR[slot.side]}) — pas de tendance connue, surveillez la surprise.`;
        return {
            turn: { ...slot, isOurs, doubleSlot },
            candidates: [],
            enemyExpectation: enemyNow,
            headlineFr: doubleSlot
                ? `${base} Ils enchaînent deux picks : attendez-vous à une paire préparée.`
                : base,
            evaluatedNodes: 0,
            experimental: true
        };
    }

    const candidateCount = ctx.candidateCount ?? 6;
    const ourCandidates = rankOurCandidates(ctx, state, candidateCount);
    const picksOnly = ctx.picksOnly === true;
    const result = navigate(state, {
        ourSide: ctx.ourSide,
        // picksOnly lookahead: ban nodes met deeper in the tree yield no
        // options → the navigator skips them without burning depth.
        ourCandidates: (s) => {
            if (picksOnly) {
                const next = nextSlotOf(s);
                if (next !== null && next.type === 'ban') return [];
            }
            return ourCandidates;
        },
        enemyDistribution: (s, enemySlot) =>
            picksOnly && enemySlot.type === 'ban' ? [] : enemyDistributionOf(ctx, s, enemySlot),
        evaluate: ctx.evaluate,
        depth: ctx.depth ?? 2,
        topK: ctx.topK ?? 5
    });

    // Plain-French reasons: M5.5 axes for picks, take-probability for bans.
    const allyComp = compOf(state, ctx.ourSide);
    const enemySide: DraftSide = ctx.ourSide === 'blue' ? 'red' : 'blue';
    const enemyComp = compOf(state, enemySide);
    // classifyGamePlan tolerates an empty comp (uniform + ambiguous): the
    // gap-fill reasons (engage, frontline, damage mix) must fire from pick 1.
    const targetPlan = classifyGamePlan(allyComp, tagsFile).primary;
    // Nos rôles encore ouverts — alimente la raison FR « encore ouvert ».
    const ourOpenRoles = openRolesOf(state, ctx.ourSide);

    const candidates: CoachCandidate[] = result.candidates.map((candidate, index) => {
        const next = result.candidates[index + 1] ?? result.candidates[index];
        const reasonsFr: string[] = [];
        let pairWith: CoachCandidate['pairWith'];
        let counterVs: CoachCandidate['counterVs'];
        if (candidate.actionType === 'pick') {
            const [suggestion] = suggestPicks({
                allyComp,
                enemyComp,
                targetPlan,
                candidates: [candidate.championKey],
                ...(ctx.dataset !== undefined ? { dataset: ctx.dataset } : {}),
                tagsFile
            });
            if (suggestion !== undefined) reasonsFr.push(...suggestion.rationale);
            if (ctx.pairFit !== undefined) {
                pairWith = bestPairSignal(candidate.championKey, allyComp, ctx.pairFit, tagsFile);
                if (pairWith !== undefined) {
                    reasonsFr.push(
                        pairWith.residualPp > 0
                            ? `Paire de profils éprouvée avec ${pairWith.championName} : +${pairWith.residualPp.toFixed(1)} pp sur les duos pros de même profil.`
                            : `Profils qui cohabitent mal avec ${pairWith.championName} : ${pairWith.residualPp.toFixed(1)} pp sur les duos pros de même profil.`
                    );
                }
            }
            if (ctx.counterFit !== undefined && enemyComp.length > 0) {
                const candidateTag = tagsFile.champions[candidate.championKey];
                const enemyTags = enemyComp
                    .map((key) => tagsFile.champions[key])
                    .filter((tag): tag is ChampionTag => tag !== undefined);
                if (candidateTag !== undefined && enemyTags.length > 0) {
                    const report = counterThreat(candidateTag, enemyTags, ctx.counterFit);
                    if (report.evidence > 0 && Math.abs(report.threat) >= PAIR_REASON_FLOOR) {
                        const pp = report.threat * 100;
                        counterVs = { threatPp: pp, evidence: report.evidence };
                        reasonsFr.push(
                            pp > 0
                                ? `Profil qui contre leur compo révélée : +${pp.toFixed(1)} pp sur les face-à-face pros de même profil.`
                                : `Profil historiquement dominé par leur compo : ${pp.toFixed(1)} pp sur les face-à-face pros.`
                        );
                    }
                }
            }
        } else {
            const threat = enemyNow.find((e) => e.championKey === candidate.championKey);
            if (threat !== undefined) {
                reasonsFr.push(`Dans leur range immédiate (${Math.round(threat.p * 100)} % à ce slot).`);
            }
        }
        if (candidate.components.lookaheadDelta > 0.002) {
            reasonsFr.push('Garde de bonnes suites : la valeur vient aussi des coups suivants.');
        } else if (candidate.components.lookaheadDelta < -0.002) {
            reasonsFr.push('Attention à la suite : leur meilleure réponse reprend une partie du gain.');
        }
        // Raison « rôle encore ouvert » (informatif, JAMAIS un nouveau tri) :
        // le candidat n'a qu'UN rôle ouvert plausible (P(r|c) ≥ 0.6) et au
        // moins un de nos rôles est committé — sinon la phrase ne dit rien.
        if (candidate.actionType === 'pick' && ctx.rolePriors !== undefined && ourOpenRoles.length < ROLES.length) {
            const weights = ctx.rolePriors(candidate.championKey);
            let total = 0;
            for (const role of ROLES) {
                const weight = weights[role] ?? 0;
                if (Number.isFinite(weight) && weight > 0) total += weight;
            }
            const plausible = ourOpenRoles.filter(
                (role) => total > 0 && (weights[role] ?? 0) / total >= OPEN_ROLE_REASON_MIN_P
            );
            if (plausible.length === 1) reasonsFr.push(OPEN_ROLE_REASON_FR[plausible[0]]);
        }
        return {
            championKey: candidate.championKey,
            actionType: candidate.actionType,
            winAfter: candidate.value,
            edgeVsNextPp: Math.max(0, (candidate.value - next.value) * 100),
            line: candidate.line,
            reasonsFr,
            components: {
                immediatePp: candidate.components.immediateValue * 100,
                lookaheadPp: candidate.components.lookaheadDelta * 100
            },
            ...(pairWith !== undefined ? { pairWith } : {}),
            ...(counterVs !== undefined ? { counterVs } : {})
        };
    });

    const actionFr = slot.type === 'pick' ? 'pick' : 'ban';
    const headlineBase =
        candidates.length > 0
            ? `À vous de ${actionFr} (côté ${SIDE_FR[slot.side]}) — ${result.evaluatedNodes} positions explorées.`
            : `À vous de ${actionFr}, mais aucun candidat disponible — vérifiez pools et exclusions.`;
    return {
        turn: { ...slot, isOurs, doubleSlot },
        candidates,
        enemyExpectation: enemyNow,
        headlineFr:
            doubleSlot && candidates.length > 0
                ? `${headlineBase} Slot double : votre 2ᵉ pick suit immédiatement — pensez la paire dès maintenant.`
                : headlineBase,
        evaluatedNodes: result.evaluatedNodes,
        experimental: true
    };
}
