/**
 * R1 — Cross-source divergence detector (DA-V2-2).
 *
 * Two providers describing the same game MUST agree; when they don't, the
 * mismatch is surfaced, never averaged away. Records are matched on a loose
 * game identity (canonical team pair + day + game number — source gameIds
 * never align across providers), then compared field by field.
 */
import type { DraftAction, DraftRecord } from './types';
import { canonicalTeamName, isoDay } from './normalize';

export type DivergenceSeverity = 'critical' | 'warning';

export interface Divergence {
    field: string;
    severity: DivergenceSeverity;
    a: string;
    b: string;
}

export interface MatchedPair {
    key: string;
    a: DraftRecord;
    b: DraftRecord;
    divergences: Divergence[];
}

export interface DivergenceReport {
    pairs: MatchedPair[];
    unmatchedA: DraftRecord[];
    unmatchedB: DraftRecord[];
    /** Matched pairs with zero critical divergences / matched pairs. */
    agreementRate: number;
    totalDivergences: number;
    byField: Record<string, number>;
}

/** Loose cross-source identity: sorted team pair + day + game number. */
export function recordMatchKey(record: DraftRecord): string {
    const teams = [canonicalTeamName(record.blueTeam), canonicalTeamName(record.redTeam)].sort();
    const day = isoDay(record.date) ?? 'unknown-date';
    const game = record.series?.gameNumber ?? 1;
    return `${teams[0]}|${teams[1]}|${day}|g${game}`;
}

const championOf = (a: DraftAction): string => a.championKey || a.championName.toLowerCase();

function sortedSet(actions: DraftAction[], side: 'blue' | 'red', type: 'pick' | 'ban'): string {
    return actions
        .filter((x) => x.side === side && x.type === type)
        .map(championOf)
        .sort()
        .join(',');
}

function orderedList(actions: DraftAction[], type: 'pick' | 'ban'): string {
    return [...actions]
        .filter((x) => x.type === type)
        .sort((x, y) => x.seq - y.seq)
        .map((x) => `${x.side[0]}:${championOf(x)}`)
        .join(' ');
}

/** Field-by-field comparison of two records describing the same game. */
export function compareDraftRecords(a: DraftRecord, b: DraftRecord): Divergence[] {
    const out: Divergence[] = [];
    const push = (field: string, severity: DivergenceSeverity, va: string, vb: string) => {
        if (va !== vb) out.push({ field, severity, a: va, b: vb });
    };

    push('winner', 'critical', a.winner ?? '?', b.winner ?? '?');
    push('patch', 'warning', a.patch ?? '?', b.patch ?? '?');

    // Sides could be swapped between sources — that IS a critical finding.
    push('blueTeam', 'critical', canonicalTeamName(a.blueTeam), canonicalTeamName(b.blueTeam));

    for (const side of ['blue', 'red'] as const) {
        push(`picks.${side}`, 'critical', sortedSet(a.actions, side, 'pick'), sortedSet(b.actions, side, 'pick'));
        push(`bans.${side}`, 'warning', sortedSet(a.actions, side, 'ban'), sortedSet(b.actions, side, 'ban'));
    }

    // Global order — only meaningful when at least one source claims exactness,
    // and the key cross-check for the First Selection era assumption.
    if (a.orderConfidence === 'exact' || b.orderConfidence === 'exact') {
        push('order.picks', 'critical', orderedList(a.actions, 'pick'), orderedList(b.actions, 'pick'));
        push('order.bans', 'warning', orderedList(a.actions, 'ban'), orderedList(b.actions, 'ban'));
    } else {
        push('order.picks', 'warning', orderedList(a.actions, 'pick'), orderedList(b.actions, 'pick'));
    }

    return out;
}

/** Match two record sets and produce the full divergence report. */
export function divergenceReport(setA: DraftRecord[], setB: DraftRecord[]): DivergenceReport {
    const indexB = new Map<string, DraftRecord[]>();
    for (const record of setB) {
        const key = recordMatchKey(record);
        const bucket = indexB.get(key);
        if (bucket) bucket.push(record);
        else indexB.set(key, [record]);
    }

    const pairs: MatchedPair[] = [];
    const unmatchedA: DraftRecord[] = [];

    for (const a of setA) {
        const key = recordMatchKey(a);
        const bucket = indexB.get(key);
        const b = bucket?.shift();
        if (!b) {
            unmatchedA.push(a);
            continue;
        }
        pairs.push({ key, a, b, divergences: compareDraftRecords(a, b) });
    }

    const unmatchedB = Array.from(indexB.values()).flat();
    const byField: Record<string, number> = {};
    let total = 0;
    let clean = 0;
    for (const pair of pairs) {
        if (!pair.divergences.some((d) => d.severity === 'critical')) clean++;
        for (const d of pair.divergences) {
            byField[d.field] = (byField[d.field] ?? 0) + 1;
            total++;
        }
    }

    return {
        pairs,
        unmatchedA,
        unmatchedB,
        agreementRate: pairs.length === 0 ? 1 : clean / pairs.length,
        totalDivergences: total,
        byField
    };
}
