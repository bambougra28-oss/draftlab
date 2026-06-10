/**
 * Pro power curves — champion×role win rate by game-duration bucket, fitted
 * on the DraftRecord corpus (`gameLengthSeconds`), emitted AS a `Dataset` so
 * the M4.3 power-curve calculator and the I3 scaling axis (data-primary,
 * STEP_UP #15) consume it unchanged.
 *
 * Why this exists: until now the only curve source was SoloQ `statsByTime`,
 * and pro tempo ≠ SoloQ tempo — the G1 postdiction needs curves fitted on
 * the population it scores. Bucket boundaries mirror the upstream dataset
 * (25/30/35/40 min) so the M4.3 fold early=[0] / mid=[1,2] / late=[3,4]
 * applies verbatim.
 *
 * EB doctrine (DA-V2-6): shrinkage is baked into the emitted `Stats` as
 * PSEUDO-COUNTS — `wins += prior·priorN`, `games += priorN` — so the
 * consumer's `wins/games` IS the posterior mean, no consumer change needed.
 * Two levels: bucket ← champion×role overall ← 0.5. A champion×role that was
 * SEEN gets pseudo-counts in all five buckets (an empty bucket then reads as
 * its overall level instead of dropping out of the team average); a
 * champion×role never seen stays at zero games and the calculator excludes
 * it (null), exactly like a SoloQ hole.
 */
import type { DraftRecord } from '$lib/data/types';
import { defaultChampionRoleData, Role, type ChampionData, type Dataset, type Stats } from '$lib/types';

/** Upstream bucket boundaries in minutes (5 buckets: <25, 25-30, 30-35, 35-40, 40+). */
export const PRO_CURVE_BUCKET_BOUNDARIES_MIN = [25, 30, 35, 40] as const;
export const PRO_CURVE_BUCKETS = 5;

export interface ProPowerCurveOptions {
    /** EB pseudo-games per duration bucket (prior = champion×role overall). */
    bucketPriorN?: number;
    /** EB pseudo-games on the champion×role overall (prior = 0.5). */
    overallPriorN?: number;
    /** Dataset.version label of the emitted overlay. */
    version?: string;
    /** Dataset.date label — injected, this module never reads a clock. */
    date?: string;
}

export const DEFAULT_PRO_CURVE_OPTIONS: Required<Pick<ProPowerCurveOptions, 'bucketPriorN' | 'overallPriorN'>> = {
    bucketPriorN: 12,
    overallPriorN: 50
};

/** Duration → dataset bucket index 0..4 (boundary minute belongs to the bucket above). */
export function bucketIndexOf(gameLengthSeconds: number): number {
    const minutes = gameLengthSeconds / 60;
    let index = 0;
    for (const boundary of PRO_CURVE_BUCKET_BOUNDARIES_MIN) {
        if (minutes >= boundary) index += 1;
        else break;
    }
    return index;
}

interface RoleTally {
    buckets: Stats[];
    name: string;
}

/**
 * Fit the curves on every decided record carrying a duration; picks need a
 * resolved champion AND a role (role-less picks are skipped, not guessed).
 */
export function fitProPowerCurves(records: DraftRecord[], options: ProPowerCurveOptions = {}): Dataset {
    const bucketPriorN = options.bucketPriorN ?? DEFAULT_PRO_CURVE_OPTIONS.bucketPriorN;
    const overallPriorN = options.overallPriorN ?? DEFAULT_PRO_CURVE_OPTIONS.overallPriorN;

    // championKey → role → raw bucket tallies.
    const tally = new Map<string, Map<Role, RoleTally>>();
    for (const record of records) {
        if (record.winner === undefined || record.gameLengthSeconds === undefined) continue;
        const bucket = bucketIndexOf(record.gameLengthSeconds);
        for (const action of record.actions) {
            if (action.type !== 'pick' || action.championKey === '' || action.role === undefined) continue;
            let byRole = tally.get(action.championKey);
            if (byRole === undefined) {
                byRole = new Map();
                tally.set(action.championKey, byRole);
            }
            let roleTally = byRole.get(action.role);
            if (roleTally === undefined) {
                roleTally = {
                    buckets: Array.from({ length: PRO_CURVE_BUCKETS }, () => ({ wins: 0, games: 0 })),
                    name: action.championName
                };
                byRole.set(action.role, roleTally);
            }
            roleTally.buckets[bucket].games += 1;
            if (action.side === record.winner) roleTally.buckets[bucket].wins += 1;
        }
    }

    const championData: Record<string, ChampionData> = {};
    for (const [championKey, byRole] of tally) {
        const data: ChampionData = {
            key: championKey,
            name: [...byRole.values()][0].name,
            statsByRole: {
                [Role.Top]: defaultChampionRoleData(),
                [Role.Jungle]: defaultChampionRoleData(),
                [Role.Middle]: defaultChampionRoleData(),
                [Role.Bottom]: defaultChampionRoleData(),
                [Role.Support]: defaultChampionRoleData()
            }
        };
        for (const [role, roleTally] of byRole) {
            let rawWins = 0;
            let rawGames = 0;
            for (const bucket of roleTally.buckets) {
                rawWins += bucket.wins;
                rawGames += bucket.games;
            }
            // Level 1: champion×role overall, shrunk toward 0.5.
            const overall = (rawWins + 0.5 * overallPriorN) / (rawGames + overallPriorN);
            const roleData = data.statsByRole[role];
            roleData.games = rawGames;
            roleData.wins = rawWins;
            // Level 2: each bucket carries its raw counts plus prior pseudo-counts.
            roleData.statsByTime = roleTally.buckets.map((bucket) => ({
                wins: bucket.wins + overall * bucketPriorN,
                games: bucket.games + bucketPriorN
            }));
        }
        championData[championKey] = data;
    }

    return {
        version: options.version ?? 'pro-corpus',
        date: options.date ?? 'walk-forward',
        championData
    };
}
