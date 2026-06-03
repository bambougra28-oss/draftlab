/**
 * M4.3 — Power Curve calculator.
 *
 * Aggregates a comp's winrate over three game-length buckets so the visualizer
 * can plot ally vs enemy power windows.
 *
 * Bucket mapping (D7, documented deviation — see docs/M4_3.md / unresolved.md):
 * the upstream dataset's `statsByTime` array uses 25/30/35/40-min boundaries, so
 * the 5 dataset buckets fold into 3 visualizer buckets:
 *   early = [0]      (<25 min)
 *   mid   = [1, 2]   (25–35 min, games-weighted)
 *   late  = [3, 4]   (35+ min, games-weighted)
 *
 * Per champion, a bucket winrate is `wins / games` over its dataset indices.
 * The team bucket winrate is the *arithmetic* mean across champions that have
 * data (D11) — intentionally unweighted, so one heavily-played champion can't
 * dominate the curve. Champions with no games in a bucket are excluded; if all
 * miss, the bucket is `null` (a gap the visualizer renders as a break).
 */
import { ROLES, type Dataset, type Role, type Stats } from '$lib/types';

export type PowerBucket = 'early' | 'mid' | 'late';
export const POWER_BUCKETS: readonly PowerBucket[] = ['early', 'mid', 'late'];

export type BucketCurve = Record<PowerBucket, number | null>;

export interface TeamPowerCurve {
    ally: BucketCurve;
    enemy: BucketCurve;
}

export interface LanePowerCurve {
    role: Role;
    ally: BucketCurve;
    enemy: BucketCurve;
}

const BUCKET_INDICES: Record<PowerBucket, number[]> = {
    early: [0],
    mid: [1, 2],
    late: [3, 4]
};

function combine(statsByTime: Stats[] | undefined, indices: number[]): Stats {
    let wins = 0;
    let games = 0;
    if (statsByTime) {
        for (const i of indices) {
            const entry = statsByTime[i];
            if (entry) {
                wins += entry.wins;
                games += entry.games;
            }
        }
    }
    return { wins, games };
}

/** Per-champion bucket winrate, or null if it has no games in that bucket. */
function championBucketWinrate(dataset: Dataset, key: string, role: Role, bucket: PowerBucket): number | null {
    const statsByTime = dataset.championData[key]?.statsByRole[role]?.statsByTime;
    const combined = combine(statsByTime, BUCKET_INDICES[bucket]);
    return combined.games === 0 ? null : combined.wins / combined.games;
}

/** Arithmetic mean of per-champion winrates that have data; null if none. */
function teamBucketWinrate(dataset: Dataset, keys: string[], bucket: PowerBucket): number | null {
    const present: number[] = [];
    keys.forEach((key, index) => {
        const wr = championBucketWinrate(dataset, key, index as Role, bucket);
        if (wr !== null) present.push(wr);
    });
    if (present.length === 0) return null;
    return present.reduce((sum, wr) => sum + wr, 0) / present.length;
}

function curveFor(dataset: Dataset, keys: string[]): BucketCurve {
    return {
        early: teamBucketWinrate(dataset, keys, 'early'),
        mid: teamBucketWinrate(dataset, keys, 'mid'),
        late: teamBucketWinrate(dataset, keys, 'late')
    };
}

/** Team-aggregate power curve for both sides (keys ordered by role: 0=Top…4=Support). */
export function calculatePowerCurve(allyKeys: string[], enemyKeys: string[], dataset: Dataset): TeamPowerCurve {
    return { ally: curveFor(dataset, allyKeys), enemy: curveFor(dataset, enemyKeys) };
}

/** Per-role mini curves (5 lanes × 3 buckets) for the granular visualizer mode. */
export function calculateLanePowerCurves(
    allyKeys: string[],
    enemyKeys: string[],
    dataset: Dataset
): LanePowerCurve[] {
    const laneCurve = (key: string | undefined, role: Role): BucketCurve => {
        if (key === undefined) return { early: null, mid: null, late: null };
        return {
            early: championBucketWinrate(dataset, key, role, 'early'),
            mid: championBucketWinrate(dataset, key, role, 'mid'),
            late: championBucketWinrate(dataset, key, role, 'late')
        };
    };
    return ROLES.map((role) => ({
        role,
        ally: laneCurve(allyKeys[role], role),
        enemy: laneCurve(enemyKeys[role], role)
    }));
}

/** The bucket where the ally's edge over the enemy is largest; null if none comparable. */
export function dominantBucket(curve: TeamPowerCurve): PowerBucket | null {
    let best: PowerBucket | null = null;
    let bestEdge = -Infinity;
    for (const bucket of POWER_BUCKETS) {
        const ally = curve.ally[bucket];
        const enemy = curve.enemy[bucket];
        if (ally === null || enemy === null) continue;
        const edge = ally - enemy;
        if (edge > bestEdge) {
            bestEdge = edge;
            best = bucket;
        }
    }
    return best;
}
