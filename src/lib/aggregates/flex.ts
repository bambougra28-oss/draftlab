/**
 * R4 — Flex map: which roles a champion actually gets played in (§5.3 fin).
 *
 * `flexScore` is the Shannon entropy (in bits) of the champion's role
 * distribution: 0 for a one-role champion, 1 for a 50/50 two-role flex,
 * log2(5) ≈ 2.32 theoretical max. `roleCount` counts roles holding at least
 * 20% of the champion's role-tagged picks — a real rotation option, not a
 * one-off. Picks without role info carry no flex evidence and are ignored;
 * champions with zero role-tagged picks don't appear in the map at all.
 */
import type { DraftRecord } from '$lib/data/types';
import type { Role } from '$lib/types';

/** A role counts toward `roleCount` at >= 20% of the champion's picks. */
export const FLEX_ROLE_THRESHOLD = 0.2;

export interface FlexEntry {
    championKey: string;
    /** Pick counts per role (role-tagged picks only). */
    byRole: Map<Role, number>;
    /** Number of roles holding >= FLEX_ROLE_THRESHOLD of the picks. */
    roleCount: number;
    /** Shannon entropy of the role distribution, in bits. */
    flexScore: number;
}

/** Per-champion role distribution over every role-tagged pick in the corpus. */
export function flexMap(records: DraftRecord[]): Map<string, FlexEntry> {
    const byChampion = new Map<string, Map<Role, number>>();

    for (const record of records) {
        for (const action of record.actions) {
            if (action.type !== 'pick' || action.role === undefined || action.championKey === '') continue;
            let byRole = byChampion.get(action.championKey);
            if (byRole === undefined) {
                byRole = new Map<Role, number>();
                byChampion.set(action.championKey, byRole);
            }
            byRole.set(action.role, (byRole.get(action.role) ?? 0) + 1);
        }
    }

    const entries = new Map<string, FlexEntry>();
    for (const [championKey, byRole] of byChampion) {
        let total = 0;
        for (const count of byRole.values()) total += count;

        let roleCount = 0;
        let flexScore = 0;
        for (const count of byRole.values()) {
            const p = count / total; // count >= 1, so p > 0 and log2(p) is finite
            if (p >= FLEX_ROLE_THRESHOLD) roleCount += 1;
            flexScore -= p * Math.log2(p);
        }
        // -0 guard: a single-role distribution yields p = 1 → -1·log2(1) = -0.
        if (flexScore === 0) flexScore = 0;

        entries.set(championKey, { championKey, byRole, roleCount, flexScore });
    }

    return entries;
}
