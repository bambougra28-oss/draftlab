/**
 * R1 — DraftRecord builders: global action-sequence reconstruction.
 *
 * Sources expose picks/bans *per team in the order that team made them*
 * (Leaguepedia Team1Pick1..5, OE pick1..5). The global 1-20 sequence follows
 * the tournament draft template anchored on the FIRST-PICK side — historically
 * always blue, decoupled from side by the 2026 First Selection rule.
 *
 * Template (F = first-pick side, S = the other side):
 *   ban1  (seq 1-6)   : F S F S F S
 *   pick1 (seq 7-12)  : F S S F F S
 *   ban2  (seq 13-16) : S F S F
 *   pick2 (seq 17-20) : S F F S
 *
 * NOTE: whether the *ban* order also flips with First Selection is not yet
 * verified against 2026 stage data — the divergence detector (gol.gg game
 * pages expose true order) is the cross-check; until then records built from
 * per-team columns carry `orderConfidence: 'assumed-blue-first'` unless the
 * caller knows better.
 */
import type {
    DraftAction,
    DraftPhase,
    DraftSide,
    TeamDraftColumns
} from './types';

interface TemplateSlot {
    seq: number;
    phase: DraftPhase;
    type: 'pick' | 'ban';
    /** true = first-pick side acts, false = the other side. */
    first: boolean;
    /** Index into that team's per-team column (0-based). */
    teamIndex: number;
}

/** The 20-slot tournament draft template, anchored on the first-pick side. */
export const DRAFT_TEMPLATE: readonly TemplateSlot[] = [
    { seq: 1, phase: 'ban1', type: 'ban', first: true, teamIndex: 0 },
    { seq: 2, phase: 'ban1', type: 'ban', first: false, teamIndex: 0 },
    { seq: 3, phase: 'ban1', type: 'ban', first: true, teamIndex: 1 },
    { seq: 4, phase: 'ban1', type: 'ban', first: false, teamIndex: 1 },
    { seq: 5, phase: 'ban1', type: 'ban', first: true, teamIndex: 2 },
    { seq: 6, phase: 'ban1', type: 'ban', first: false, teamIndex: 2 },
    { seq: 7, phase: 'pick1', type: 'pick', first: true, teamIndex: 0 },
    { seq: 8, phase: 'pick1', type: 'pick', first: false, teamIndex: 0 },
    { seq: 9, phase: 'pick1', type: 'pick', first: false, teamIndex: 1 },
    { seq: 10, phase: 'pick1', type: 'pick', first: true, teamIndex: 1 },
    { seq: 11, phase: 'pick1', type: 'pick', first: true, teamIndex: 2 },
    { seq: 12, phase: 'pick1', type: 'pick', first: false, teamIndex: 2 },
    { seq: 13, phase: 'ban2', type: 'ban', first: false, teamIndex: 3 },
    { seq: 14, phase: 'ban2', type: 'ban', first: true, teamIndex: 3 },
    { seq: 15, phase: 'ban2', type: 'ban', first: false, teamIndex: 4 },
    { seq: 16, phase: 'ban2', type: 'ban', first: true, teamIndex: 4 },
    { seq: 17, phase: 'pick2', type: 'pick', first: false, teamIndex: 3 },
    { seq: 18, phase: 'pick2', type: 'pick', first: true, teamIndex: 3 },
    { seq: 19, phase: 'pick2', type: 'pick', first: true, teamIndex: 4 },
    { seq: 20, phase: 'pick2', type: 'pick', first: false, teamIndex: 4 }
];

export interface BuildActionsInput {
    blue: TeamDraftColumns;
    red: TeamDraftColumns;
    firstPickSide: DraftSide;
    /** Resolves a raw champion name to a Data Dragon key ('' if unknown). */
    resolveKey: (name: string) => string | undefined;
}

export interface BuildActionsResult {
    actions: DraftAction[];
    warnings: string[];
}

/** Cell values sources use for a skipped/forfeited ban or an empty slot. */
const BLANK_CELLS = new Set(['', 'none', 'loss of ban', 'n/a', '-']);
const isBlank = (v: string | undefined): boolean =>
    v === undefined || BLANK_CELLS.has(v.trim().toLowerCase());

/**
 * Interleave per-team draft columns into the global 1-20 action sequence.
 * Blank cells (missed/forfeited bans) are skipped — `seq` gaps mark them.
 */
export function buildDraftActions(input: BuildActionsInput): BuildActionsResult {
    const actions: DraftAction[] = [];
    const warnings: string[] = [];
    const firstIsBlue = input.firstPickSide === 'blue';

    for (const slot of DRAFT_TEMPLATE) {
        const side: DraftSide = slot.first === firstIsBlue ? 'blue' : 'red';
        const team = side === 'blue' ? input.blue : input.red;
        const raw = slot.type === 'ban' ? team.bans[slot.teamIndex] : team.picks[slot.teamIndex];

        if (isBlank(raw)) {
            if (slot.type === 'pick') {
                warnings.push(`missing ${side} pick at seq ${slot.seq}`);
            }
            continue; // skipped ban (legal) or absent pick (warned)
        }

        const name = (raw as string).trim();
        const key = input.resolveKey(name);
        if (key === undefined) {
            warnings.push(`unresolved champion "${name}" (${slot.type}, seq ${slot.seq})`);
        }

        const action: DraftAction = {
            seq: slot.seq,
            type: slot.type,
            phase: slot.phase,
            side,
            championKey: key ?? '',
            championName: name
        };
        if (slot.type === 'pick') {
            const role = team.roles?.[slot.teamIndex];
            if (role !== undefined) action.role = role;
            const player = team.players?.[slot.teamIndex];
            if (player !== undefined && player !== '') action.playerId = player;
        }
        actions.push(action);
    }

    return { actions, warnings };
}

/** Picks of one side in the order they were made (convenience selector). */
export function picksOf(actions: DraftAction[], side: DraftSide): DraftAction[] {
    return actions.filter((a) => a.type === 'pick' && a.side === side);
}

/** Bans of one side in the order they were made (convenience selector). */
export function bansOf(actions: DraftAction[], side: DraftSide): DraftAction[] {
    return actions.filter((a) => a.type === 'ban' && a.side === side);
}

/** First Selection era start: side and pick order decoupled league-wide. */
export const FIRST_SELECTION_ERA_START = '2026-01-14';

/** True when a game date falls in the First Selection era (order unverified). */
export function inFirstSelectionEra(isoDate: string | undefined): boolean {
    return isoDate !== undefined && isoDate.slice(0, 10) >= FIRST_SELECTION_ERA_START;
}
