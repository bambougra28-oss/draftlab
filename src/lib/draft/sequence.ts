/**
 * Draft séquentielle — the EXACT tournament format as an entry model:
 * the 20 template slots (ban1 ×6, pick1 ×6, ban2 ×4, pick2 ×4) filled in
 * true order, with FLEX picks (role uncommitted at lock time, assignable
 * later) — the reality of a live draft, where the enemy's roles are
 * unknown until the loading screen and your own flex stays open on purpose.
 *
 * Invariants (enforced here, relied on by the coach):
 * - GAP-FREE prefix: champions are placed at the cursor (`nextOpenSeq`),
 *   edited in place, or undone from the tail — `nextSlotOf`-style readers
 *   never meet a hole.
 * - A champion appears at most once on the board.
 * - At most one committed role per side: committing a role that a teammate
 *   already holds flips that teammate back to flex (the swap a real team
 *   announces in chat).
 *
 * Pure module: no storage, no clock; the role resolver of `roleEntryView`
 * is injected (the page passes a rolePriors-based argmax).
 */
import { DRAFT_TEMPLATE } from '$lib/data/draftRecord';
import type { DraftAction, DraftSide } from '$lib/data/types';
import { ROLES, type Role } from '$lib/types';

export interface SequenceEntry {
    seq: number;
    championKey: string;
    /** Pick role; undefined = flex (bans never carry a role). */
    role?: Role;
}

export interface DraftSequence {
    /** Placed actions keyed by template seq (1..20). */
    entries: ReadonlyMap<number, SequenceEntry>;
}

export interface SequenceSlot {
    seq: number;
    type: 'ban' | 'pick';
    phase: 'ban1' | 'pick1' | 'ban2' | 'pick2';
    /** Blue-first template (the era assumption used across the app). */
    side: DraftSide;
}

/** The 20 slots in draft order, side resolved blue-first. */
export const SEQUENCE_SLOTS: readonly SequenceSlot[] = DRAFT_TEMPLATE.map((slot) => ({
    seq: slot.seq,
    type: slot.type,
    phase: slot.phase,
    side: slot.first ? 'blue' : 'red'
}));

const SLOT_BY_SEQ = new Map(SEQUENCE_SLOTS.map((slot) => [slot.seq, slot]));

export function slotOf(seq: number): SequenceSlot | undefined {
    return SLOT_BY_SEQ.get(seq);
}

export function emptySequence(): DraftSequence {
    return { entries: new Map() };
}

/** First unfilled template seq, or null when the draft is complete. */
export function nextOpenSeq(sequence: DraftSequence): number | null {
    for (const slot of SEQUENCE_SLOTS) {
        if (!sequence.entries.has(slot.seq)) return slot.seq;
    }
    return null;
}

/** Highest filled seq (the undo target), or null on an empty board. */
export function lastFilledSeq(sequence: DraftSequence): number | null {
    let last: number | null = null;
    for (const slot of SEQUENCE_SLOTS) {
        if (sequence.entries.has(slot.seq)) last = slot.seq;
    }
    return last;
}

export function usedKeys(sequence: DraftSequence): Set<string> {
    return new Set([...sequence.entries.values()].map((entry) => entry.championKey));
}

/**
 * Place a champion at the cursor (flex by default on picks). Refuses a
 * champion already on the board and a complete draft (returns the input).
 */
export function placeChampion(sequence: DraftSequence, championKey: string, role?: Role): DraftSequence {
    const seq = nextOpenSeq(sequence);
    if (seq === null || usedKeys(sequence).has(championKey)) return sequence;
    return replaceAt(sequence, seq, championKey, role);
}

/**
 * Replace (or fill) one slot in place — editing a past mistake keeps the
 * prefix contiguous. Refuses a champion already used on ANOTHER slot.
 */
export function replaceAt(sequence: DraftSequence, seq: number, championKey: string, role?: Role): DraftSequence {
    const slot = SLOT_BY_SEQ.get(seq);
    if (slot === undefined) return sequence;
    for (const entry of sequence.entries.values()) {
        if (entry.championKey === championKey && entry.seq !== seq) return sequence;
    }
    const entries = new Map(sequence.entries);
    entries.set(seq, {
        seq,
        championKey,
        ...(slot.type === 'pick' && role !== undefined ? { role } : {})
    });
    return resolveRoleConflicts({ entries }, seq);
}

/** Undo the LAST action (tail removal keeps the prefix gap-free). */
export function removeLast(sequence: DraftSequence): DraftSequence {
    const seq = lastFilledSeq(sequence);
    if (seq === null) return sequence;
    const entries = new Map(sequence.entries);
    entries.delete(seq);
    return { entries };
}

/**
 * Commit (or clear, with undefined) the role of a placed pick. Committing a
 * role held by a same-side teammate flips that teammate back to flex.
 */
export function assignRole(sequence: DraftSequence, seq: number, role: Role | undefined): DraftSequence {
    const entry = sequence.entries.get(seq);
    const slot = SLOT_BY_SEQ.get(seq);
    if (entry === undefined || slot === undefined || slot.type !== 'pick') return sequence;
    const entries = new Map(sequence.entries);
    entries.set(seq, { seq, championKey: entry.championKey, ...(role !== undefined ? { role } : {}) });
    return resolveRoleConflicts({ entries }, seq);
}

/** Same-side duplicate committed roles → the OTHER pick goes back to flex. */
function resolveRoleConflicts(sequence: { entries: Map<number, SequenceEntry> }, changedSeq: number): DraftSequence {
    const changed = sequence.entries.get(changedSeq);
    const slot = SLOT_BY_SEQ.get(changedSeq);
    if (changed?.role === undefined || slot === undefined || slot.type !== 'pick') return sequence;
    for (const [seq, entry] of sequence.entries) {
        if (seq === changedSeq || entry.role !== changed.role) continue;
        const other = SLOT_BY_SEQ.get(seq);
        if (other?.type === 'pick' && other.side === slot.side) {
            sequence.entries.set(seq, { seq, championKey: entry.championKey });
        }
    }
    return sequence;
}

/** Exact DraftActions (the coach reads the TRUE order — no approximation). */
export function toDraftActions(sequence: DraftSequence): DraftAction[] {
    const actions: DraftAction[] = [];
    for (const slot of SEQUENCE_SLOTS) {
        const entry = sequence.entries.get(slot.seq);
        if (entry === undefined) continue;
        actions.push({
            seq: slot.seq,
            type: slot.type,
            phase: slot.phase,
            side: slot.side,
            championKey: entry.championKey,
            championName: entry.championKey,
            ...(slot.type === 'pick' && entry.role !== undefined ? { role: entry.role } : {})
        });
    }
    return actions;
}

export interface RoleEntryView {
    allyPicks: (string | null)[];
    enemyPicks: (string | null)[];
    allyBans: (string | null)[];
    enemyBans: (string | null)[];
    /** Seqs whose pick sits on an INFERRED slot (flex, not committed). */
    flexSeqs: number[];
}

/**
 * Project the sequence onto the analyzer's role-keyed arrays. Committed
 * roles claim their slot first; flex picks are placed by the injected
 * resolver among the side's free roles (default: first free, ROLES order).
 * Two flex picks resolving to one role cannot happen (the resolver only
 * sees still-free roles).
 */
export function roleEntryView(
    sequence: DraftSequence,
    allySide: DraftSide,
    resolveRole: (championKey: string, freeRoles: Role[], side: DraftSide) => Role = (_key, free) => free[0]
): RoleEntryView {
    const picksBySide: Record<DraftSide, (string | null)[]> = {
        blue: [null, null, null, null, null],
        red: [null, null, null, null, null]
    };
    const bansBySide: Record<DraftSide, (string | null)[]> = {
        blue: [null, null, null, null, null],
        red: [null, null, null, null, null]
    };
    const flexSeqs: number[] = [];

    const banCursor: Record<DraftSide, number> = { blue: 0, red: 0 };
    const flexQueue: { entry: SequenceEntry; side: DraftSide }[] = [];
    for (const slot of SEQUENCE_SLOTS) {
        const entry = sequence.entries.get(slot.seq);
        if (entry === undefined) continue;
        if (slot.type === 'ban') {
            bansBySide[slot.side][banCursor[slot.side]++] = entry.championKey;
        } else if (entry.role !== undefined) {
            picksBySide[slot.side][entry.role] = entry.championKey;
        } else {
            flexQueue.push({ entry, side: slot.side });
        }
    }
    for (const { entry, side } of flexQueue) {
        const free = ROLES.filter((role) => picksBySide[side][role] === null);
        if (free.length === 0) continue;
        const role = resolveRole(entry.championKey, free, side);
        picksBySide[side][free.includes(role) ? role : free[0]] = entry.championKey;
        flexSeqs.push(entry.seq);
    }

    const enemySide: DraftSide = allySide === 'blue' ? 'red' : 'blue';
    return {
        allyPicks: picksBySide[allySide],
        enemyPicks: picksBySide[enemySide],
        allyBans: bansBySide[allySide],
        enemyBans: bansBySide[enemySide],
        flexSeqs
    };
}
