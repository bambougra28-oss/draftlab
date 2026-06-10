/**
 * Role priors from the corpus — the data source of the I2 role-assignment
 * hypotheses (`roleAssignmentHypotheses` takes a `RolePriors` function and
 * never imports an aggregate; this module is the standard provider).
 *
 * The weight of (champion, role) is its raw pick count in the fitted
 * records. Layering is the call-site's choice: fit once on the opponent's
 * games and once on the league, then `layerRolePriors(team, league)` reads
 * the team first and falls back to the league for champions the team never
 * showed — the chess-prep cascade (player → league) in role space.
 */
import type { DraftRecord } from '$lib/data/types';
import type { RolePriors } from '$lib/strategic/fogReveal';
import type { Role } from '$lib/types';

export interface RolePriorsFit {
    byChampion: Map<string, Partial<Record<Role, number>>>;
    /** Picks tallied (evidence badge). */
    picks: number;
}

/** Tally champion×role pick counts over both sides of the records. */
export function fitRolePriors(records: DraftRecord[]): RolePriorsFit {
    const byChampion = new Map<string, Partial<Record<Role, number>>>();
    let picks = 0;
    for (const record of records) {
        for (const action of record.actions) {
            if (action.type !== 'pick' || action.championKey === '' || action.role === undefined) continue;
            picks++;
            const weights = byChampion.get(action.championKey) ?? {};
            weights[action.role] = (weights[action.role] ?? 0) + 1;
            byChampion.set(action.championKey, weights);
        }
    }
    return { byChampion, picks };
}

/** RolePriors view of a fit (champions never seen → {}). */
export function rolePriorsOf(fit: RolePriorsFit): RolePriors {
    return (championKey) => fit.byChampion.get(championKey) ?? {};
}

/**
 * Team-first cascade: the team's own role usage when it exists, else the
 * league's. (Mixing both would let a 300-game league prior drown a 5-game
 * team read — the team layer is the signal here, see opponent-intel
 * doctrine.)
 */
export function layerRolePriors(team: RolePriorsFit, league: RolePriorsFit): RolePriors {
    return (championKey) => {
        const own = team.byChampion.get(championKey);
        if (own !== undefined) return own;
        return league.byChampion.get(championKey) ?? {};
    };
}
