/**
 * Chantier E — Sequence-position bucketing for the win-probability calibration
 * (run #2; doctrine ARCHITECTURE_V2 §6.8, research 2026-06_methodologie_draft §6).
 *
 * The calibration rule measures the shipped evaluator at three frozen anchors
 * of the tournament draft: after the first ban phase (seq ≤ 6, zero picks),
 * after the first three picks (seq ≤ 9: one pick for the first-pick side, two
 * for the other), and at the locked full draft (seq ≤ 20: five picks each).
 * The seq bounds come from `DRAFT_TEMPLATE` (src/lib/data/draftRecord.ts).
 *
 * `roleTeamsAt` generalizes the `compOf` of scripts/backtest/postdiction.ts to
 * prefixes: REAL corpus roles only, never a guess — a prefix containing a pick
 * with an unresolved key, a missing role or a side-duplicated role makes the
 * record unscorable (undefined). Bans never enter the teams (the evaluator
 * does not read them). Pure module: no I/O, no clock.
 */
import type { Role, Team } from '$lib/types';
import type { DraftRecord } from '$lib/data/types';
import { parsePatch } from './walkforward';

/** The three frozen calibration anchors (seq bounds of DRAFT_TEMPLATE). */
export const CALIBRATION_POSITIONS = [
    { id: 'afterBans', maxSeq: 6 },
    { id: 'after3Picks', maxSeq: 9 },
    { id: 'fullDraft', maxSeq: 20 }
] as const;

export type CalibrationPositionId = (typeof CALIBRATION_POSITIONS)[number]['id'];

export interface PositionTeams {
    blue: Team;
    red: Team;
}

/**
 * Role-keyed teams of the seq ≤ maxSeq prefix (REAL corpus roles).
 * undefined when a pick of the prefix has an empty key, no role, or a role
 * already taken on its side — the record is then not scorable (never guessed).
 */
export function roleTeamsAt(record: DraftRecord, maxSeq: number): PositionTeams | undefined {
    const blue: Team = new Map<Role, string>();
    const red: Team = new Map<Role, string>();
    for (const action of record.actions) {
        if (action.type !== 'pick' || action.seq > maxSeq) continue;
        if (action.championKey === '' || action.role === undefined) return undefined;
        const team = action.side === 'blue' ? blue : red;
        if (team.has(action.role)) return undefined;
        team.set(action.role, action.championKey);
    }
    return { blue, red };
}

/**
 * Frozen eligibility (ONE set, shared by the three positions): (a) winner
 * defined, (b) ten role-complete picks — resolved key + role present + no
 * side-duplicated role, the compOf rule of postdiction G1 —, (c) parsable
 * patch. Discarded records are counted in the run notes, never recovered.
 */
export function isCalibrationEligible(record: DraftRecord): boolean {
    if (record.winner === undefined) return false;
    const teams = roleTeamsAt(record, 20);
    if (teams === undefined || teams.blue.size !== 5 || teams.red.size !== 5) return false;
    return record.patch !== undefined && parsePatch(record.patch) !== undefined;
}
