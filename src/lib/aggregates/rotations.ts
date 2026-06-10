/**
 * R4 — Pick/ban rotation grouping and per-champion rotation profiles.
 *
 * Coaches reason in *rotations*, not raw sequence numbers. The global pick
 * order (template in $lib/data/draftRecord) bunches into P1 / P2-3 / P4-5 /
 * P6 (pick phase 1, seq 7-12) and P7 / P8-9 / P10 (pick phase 2, seq 17-20).
 * Seq 7-9 is the opening rotation of BOTH teams (the first-pick side's P1 and
 * the other side's P2-3), so `firstRotationRate` — the share of a champion's
 * picks made there — is the classic "first-rotation priority" signal. Bans
 * group by phase: B1-B3 (seq 1-6) and B4-B5 (seq 13-16). Names follow the
 * global order anchored on the first-pick side, NOT on blue (First Selection
 * era: blue ≠ first pick).
 */
import type { DraftRecord } from '$lib/data/types';

export type PickRotation = 'P1' | 'P2-3' | 'P4-5' | 'P6' | 'P7' | 'P8-9' | 'P10';
export type BanRotation = 'B1-B3' | 'B4-B5';

/** Pick rotations in draft order. */
export const PICK_ROTATIONS: readonly PickRotation[] = ['P1', 'P2-3', 'P4-5', 'P6', 'P7', 'P8-9', 'P10'];

/** Ban rotations in draft order (one per ban phase). */
export const BAN_ROTATIONS: readonly BanRotation[] = ['B1-B3', 'B4-B5'];

const PICK_ROTATION_BY_SEQ = new Map<number, PickRotation>([
    [7, 'P1'],
    [8, 'P2-3'],
    [9, 'P2-3'],
    [10, 'P4-5'],
    [11, 'P4-5'],
    [12, 'P6'],
    [17, 'P7'],
    [18, 'P8-9'],
    [19, 'P8-9'],
    [20, 'P10']
]);

/** Rotation of a pick slot; undefined for ban slots / out-of-range seq. */
export function rotationOf(seq: number): PickRotation | undefined {
    return PICK_ROTATION_BY_SEQ.get(seq);
}

/** Rotation of a ban slot; undefined for pick slots / out-of-range seq. */
export function banRotationOf(seq: number): BanRotation | undefined {
    if (seq >= 1 && seq <= 6) return 'B1-B3';
    if (seq >= 13 && seq <= 16) return 'B4-B5';
    return undefined;
}

export interface PickRotationProfile {
    championKey: string;
    /** Total picks of this champion across the records. */
    total: number;
    /** Pick counts per rotation (only rotations actually seen). */
    byRotation: Map<PickRotation, number>;
    /** Share of picks made in the opening rotation (seq 7-9: P1 or P2-3). */
    firstRotationRate: number;
}

export interface BanRotationProfile {
    championKey: string;
    /** Total bans of this champion across the records. */
    total: number;
    /** Ban counts per rotation (only rotations actually seen). */
    byRotation: Map<BanRotation, number>;
    /** Share of bans spent in ban phase 1 (B1-B3). */
    firstPhaseRate: number;
}

/** Where a champion gets PICKED: rotation distribution + first-rotation rate. */
export function rotationProfile(records: DraftRecord[], championKey: string): PickRotationProfile {
    const byRotation = new Map<PickRotation, number>();
    let total = 0;
    let first = 0;

    if (championKey !== '') {
        for (const record of records) {
            for (const action of record.actions) {
                if (action.type !== 'pick' || action.championKey !== championKey) continue;
                const rotation = rotationOf(action.seq);
                if (rotation === undefined) continue;
                byRotation.set(rotation, (byRotation.get(rotation) ?? 0) + 1);
                total += 1;
                if (rotation === 'P1' || rotation === 'P2-3') first += 1;
            }
        }
    }

    return { championKey, total, byRotation, firstRotationRate: total === 0 ? 0 : first / total };
}

/** Where a champion gets BANNED: phase distribution + phase-1 rate. */
export function banRotationProfile(records: DraftRecord[], championKey: string): BanRotationProfile {
    const byRotation = new Map<BanRotation, number>();
    let total = 0;
    let first = 0;

    if (championKey !== '') {
        for (const record of records) {
            for (const action of record.actions) {
                if (action.type !== 'ban' || action.championKey !== championKey) continue;
                const rotation = banRotationOf(action.seq);
                if (rotation === undefined) continue;
                byRotation.set(rotation, (byRotation.get(rotation) ?? 0) + 1);
                total += 1;
                if (rotation === 'B1-B3') first += 1;
            }
        }
    }

    return { championKey, total, byRotation, firstPhaseRate: total === 0 ? 0 : first / total };
}
