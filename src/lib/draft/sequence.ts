/**
 * Draft séquentielle — the exact formats Alain actually plays (2026):
 *
 * - 'pro'   : the 20-slot tournament template (ban1 ×6, pick1 ×6, ban2 ×4,
 *             pick2 ×4) in true order — bans are ordered ACTIONS the coach
 *             reads (phase-2 ban semantics differ from phase 1).
 * - 'soloq' : ranked draft — TEN SIMULTANEOUS bans (one per player, the
 *             same champion MAY be banned by both teams), then the same
 *             ten-pick snake (B R R B B R R B B R) with no mid-draft ban
 *             phase. Bans are NOT ordered actions here: they are
 *             pre-draft EXCLUSIONS (`bannedKeys`), exactly like Fearless
 *             lockouts — which is also how the coach must consume them.
 *
 * FLEX picks (role uncommitted at lock, assignable later) work in both.
 *
 * Invariants:
 * - GAP-FREE walk prefix: champions are placed at the cursor of the
 *   format's WALK ORDER, edited in place, or undone from the tail.
 * - 'pro': a champion appears at most once on the whole board.
 *   'soloq': a champion may sit in BOTH teams' bans (client rule), never
 *   twice in the same team's bans, and never in both a ban and a pick.
 * - At most one committed role per side (committing a teammate's role
 *   flips that teammate back to flex).
 *
 * Slot ids: pro slots use the template seq 1..20. SoloQ pick slots REUSE
 * the template pick seqs (7..12, 17..20 — the snake is identical) so the
 * engine projection is direct; soloq ban slots live at 101..110 and are
 * never emitted as DraftActions.
 *
 * Pure module: no storage, no clock; the flex resolver is injected.
 */
import { DRAFT_TEMPLATE } from '$lib/data/draftRecord';
import type { DraftAction, DraftSide } from '$lib/data/types';
import { ROLES, type Role } from '$lib/types';

export type DraftFormat = 'pro' | 'soloq';

export interface SequenceEntry {
    seq: number;
    championKey: string;
    /** Pick role; undefined = flex (bans never carry a role). */
    role?: Role;
}

export interface DraftSequence {
    /** Placed actions keyed by slot id (template seq / soloq ban id). */
    entries: ReadonlyMap<number, SequenceEntry>;
}

export interface SequenceSlot {
    seq: number;
    type: 'ban' | 'pick';
    phase: 'ban1' | 'pick1' | 'ban2' | 'pick2';
    /** Blue-first template (the era assumption used across the app). */
    side: DraftSide;
}

/** The 20 tournament slots in draft order, side resolved blue-first. */
export const SEQUENCE_SLOTS: readonly SequenceSlot[] = DRAFT_TEMPLATE.map((slot) => ({
    seq: slot.seq,
    type: slot.type,
    phase: slot.phase,
    side: slot.first ? 'blue' : 'red'
}));

/** SoloQ ban slot ids (101-105 blue, 106-110 red) — entry order only. */
export const SOLOQ_BAN_BASE = 100;

/** SoloQ walk: 10 simultaneous bans (blue block, red block), then the snake. */
export const SOLOQ_SLOTS: readonly SequenceSlot[] = [
    ...Array.from({ length: 5 }, (_, i): SequenceSlot => ({
        seq: SOLOQ_BAN_BASE + 1 + i,
        type: 'ban',
        phase: 'ban1',
        side: 'blue'
    })),
    ...Array.from({ length: 5 }, (_, i): SequenceSlot => ({
        seq: SOLOQ_BAN_BASE + 6 + i,
        type: 'ban',
        phase: 'ban1',
        side: 'red'
    })),
    ...SEQUENCE_SLOTS.filter((slot) => slot.type === 'pick')
];

/** The format's slots in WALK order (cursor order = array order). */
export function slotsFor(format: DraftFormat): readonly SequenceSlot[] {
    return format === 'soloq' ? SOLOQ_SLOTS : SEQUENCE_SLOTS;
}

export function slotOf(seq: number, format: DraftFormat = 'pro'): SequenceSlot | undefined {
    return slotsFor(format).find((slot) => slot.seq === seq);
}

export function emptySequence(): DraftSequence {
    return { entries: new Map() };
}

/** First unfilled slot id in walk order, or null when the draft is complete. */
export function nextOpenSeq(sequence: DraftSequence, format: DraftFormat = 'pro'): number | null {
    for (const slot of slotsFor(format)) {
        if (!sequence.entries.has(slot.seq)) return slot.seq;
    }
    return null;
}

/** Last filled slot id in walk order (the undo target), or null when empty. */
export function lastFilledSeq(sequence: DraftSequence, format: DraftFormat = 'pro'): number | null {
    let last: number | null = null;
    for (const slot of slotsFor(format)) {
        if (sequence.entries.has(slot.seq)) last = slot.seq;
    }
    return last;
}

/** Every champion on the board (bans included) — picker exclusion set. */
export function usedKeys(sequence: DraftSequence): Set<string> {
    return new Set([...sequence.entries.values()].map((entry) => entry.championKey));
}

/** SoloQ: the banned champions (both teams pooled) — coach exclusions. */
export function bannedKeys(sequence: DraftSequence, format: DraftFormat): Set<string> {
    const banned = new Set<string>();
    for (const slot of slotsFor(format)) {
        if (slot.type !== 'ban') continue;
        const entry = sequence.entries.get(slot.seq);
        if (entry !== undefined) banned.add(entry.championKey);
    }
    return banned;
}

/**
 * Format conflict rule for placing `championKey` on `target`:
 * 'pro' — any other slot holding the champion conflicts;
 * 'soloq' — ban×ban conflicts only on the SAME side (cross-team duplicate
 * bans are legal in the client); ban×pick always conflicts.
 */
function hasConflict(
    sequence: DraftSequence,
    target: SequenceSlot,
    championKey: string,
    format: DraftFormat
): boolean {
    for (const entry of sequence.entries.values()) {
        if (entry.championKey !== championKey || entry.seq === target.seq) continue;
        if (format === 'pro') return true;
        const other = slotOf(entry.seq, format);
        if (other === undefined) return true;
        if (other.type === 'pick' || target.type === 'pick') return true;
        if (other.side === target.side) return true; // same-team duplicate ban
    }
    return false;
}

/** Place a champion at the cursor (flex by default on picks). */
export function placeChampion(
    sequence: DraftSequence,
    championKey: string,
    role?: Role,
    format: DraftFormat = 'pro'
): DraftSequence {
    const seq = nextOpenSeq(sequence, format);
    if (seq === null) return sequence;
    return replaceAt(sequence, seq, championKey, role, format);
}

/** Replace (or fill) one slot in place — keeps the walk prefix contiguous. */
export function replaceAt(
    sequence: DraftSequence,
    seq: number,
    championKey: string,
    role?: Role,
    format: DraftFormat = 'pro'
): DraftSequence {
    const slot = slotOf(seq, format);
    if (slot === undefined || hasConflict(sequence, slot, championKey, format)) return sequence;
    const entries = new Map(sequence.entries);
    entries.set(seq, {
        seq,
        championKey,
        ...(slot.type === 'pick' && role !== undefined ? { role } : {})
    });
    return resolveRoleConflicts({ entries }, seq, format);
}

/** Undo the LAST action of the walk. */
export function removeLast(sequence: DraftSequence, format: DraftFormat = 'pro'): DraftSequence {
    const seq = lastFilledSeq(sequence, format);
    if (seq === null) return sequence;
    const entries = new Map(sequence.entries);
    entries.delete(seq);
    return { entries };
}

/**
 * Commit (or clear, with undefined) the role of a placed pick. Committing a
 * role held by a same-side teammate flips that teammate back to flex.
 */
export function assignRole(
    sequence: DraftSequence,
    seq: number,
    role: Role | undefined,
    format: DraftFormat = 'pro'
): DraftSequence {
    const entry = sequence.entries.get(seq);
    const slot = slotOf(seq, format);
    if (entry === undefined || slot === undefined || slot.type !== 'pick') return sequence;
    const entries = new Map(sequence.entries);
    entries.set(seq, { seq, championKey: entry.championKey, ...(role !== undefined ? { role } : {}) });
    return resolveRoleConflicts({ entries }, seq, format);
}

/** Same-side duplicate committed roles → the OTHER pick goes back to flex. */
function resolveRoleConflicts(
    sequence: { entries: Map<number, SequenceEntry> },
    changedSeq: number,
    format: DraftFormat
): DraftSequence {
    const changed = sequence.entries.get(changedSeq);
    const slot = slotOf(changedSeq, format);
    if (changed?.role === undefined || slot === undefined || slot.type !== 'pick') return sequence;
    for (const [seq, entry] of sequence.entries) {
        if (seq === changedSeq || entry.role !== changed.role) continue;
        const other = slotOf(seq, format);
        if (other?.type === 'pick' && other.side === slot.side) {
            sequence.entries.set(seq, { seq, championKey: entry.championKey });
        }
    }
    return sequence;
}

/**
 * Engine projection. 'pro': every slot becomes an exact DraftAction.
 * 'soloq': PICKS ONLY (the snake shares the template pick seqs); bans are
 * exclusions — read them via `bannedKeys` and feed `excludedKeys`.
 */
export function toDraftActions(sequence: DraftSequence, format: DraftFormat = 'pro'): DraftAction[] {
    const actions: DraftAction[] = [];
    for (const slot of slotsFor(format)) {
        if (format === 'soloq' && slot.type === 'ban') continue;
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
    return actions.sort((a, b) => a.seq - b.seq);
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
 */
export function roleEntryView(
    sequence: DraftSequence,
    allySide: DraftSide,
    resolveRole: (championKey: string, freeRoles: Role[], side: DraftSide) => Role = (_key, free) => free[0],
    format: DraftFormat = 'pro'
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
    for (const slot of slotsFor(format)) {
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
