/**
 * R4 — Combination mining: recurring same-side champion pairs ("assets").
 *
 * A pair of champions picked together on the SAME side in the SAME game,
 * recurring over `minGames`+, is a prepared look — a structural asset of the
 * team. `kind` is derived from the roles the two picks were played in that
 * game (Bottom+Support → botlane, Middle+Jungle → midjungle, Top+Jungle →
 * topside, everything else — including missing roles — → other), so the same
 * champion pair played in two different role shapes yields two distinct
 * assets. `structuralDamage` answers the ban-side question: "if this champion
 * disappears, which prepared looks die, and how much evidence backs them?"
 */
import type { DraftAction, DraftRecord, DraftSide } from '$lib/data/types';
import { Role } from '$lib/types';

export type CombinationKind = 'botlane' | 'midjungle' | 'topside' | 'other';

export interface CombinationAsset {
    /** The pair, sorted ascending by champion key. */
    championKeys: [string, string];
    kind: CombinationKind;
    /** Games the pair appeared in together (same side). */
    games: number;
    /** Of those, games that side won. */
    wins: number;
}

export interface MineCombinationsOptions {
    /** Minimum recurrences for a pair to surface as an asset (default 3). */
    minGames?: number;
}

const SIDES: readonly DraftSide[] = ['blue', 'red'];

/** Role-pair → asset kind, order-insensitive. */
export function pairKind(roleA: Role | undefined, roleB: Role | undefined): CombinationKind {
    if (roleA === undefined || roleB === undefined) return 'other';
    const has = (role: Role): boolean => roleA === role || roleB === role;
    if (has(Role.Bottom) && has(Role.Support)) return 'botlane';
    if (has(Role.Middle) && has(Role.Jungle)) return 'midjungle';
    if (has(Role.Top) && has(Role.Jungle)) return 'topside';
    return 'other';
}

/**
 * Mine recurring same-side pick pairs. Every unordered pair of a side's picks
 * in a game contributes one observation, keyed on (sorted pair, kind); pairs
 * below `minGames` are dropped. Output is sorted by games desc, wins desc,
 * then pair key asc — deterministic for the UI and for tests.
 */
export function mineCombinations(
    records: DraftRecord[],
    options: MineCombinationsOptions = {}
): CombinationAsset[] {
    const minGames = options.minGames ?? 3;
    const buckets = new Map<string, CombinationAsset>();

    for (const record of records) {
        for (const side of SIDES) {
            const picks = record.actions.filter(
                (a): a is DraftAction => a.type === 'pick' && a.side === side && a.championKey !== ''
            );
            const won = record.winner === side;

            for (let i = 0; i < picks.length; i++) {
                for (let j = i + 1; j < picks.length; j++) {
                    const [a, b] =
                        picks[i].championKey <= picks[j].championKey
                            ? [picks[i], picks[j]]
                            : [picks[j], picks[i]];
                    const kind = pairKind(a.role, b.role);
                    const key = `${a.championKey}|${b.championKey}|${kind}`;

                    let asset = buckets.get(key);
                    if (asset === undefined) {
                        asset = { championKeys: [a.championKey, b.championKey], kind, games: 0, wins: 0 };
                        buckets.set(key, asset);
                    }
                    asset.games += 1;
                    if (won) asset.wins += 1;
                }
            }
        }
    }

    return Array.from(buckets.entries())
        .filter(([, asset]) => asset.games >= minGames)
        .sort(([keyA, a], [keyB, b]) => {
            if (a.games !== b.games) return b.games - a.games;
            if (a.wins !== b.wins) return b.wins - a.wins;
            return keyA < keyB ? -1 : 1;
        })
        .map(([, asset]) => asset);
}

export interface StructuralDamageReport {
    championKey: string;
    /** Assets that contain the champion. */
    assets: CombinationAsset[];
    /** Total games backing the touched assets (the weight of the damage). */
    weight: number;
}

/** Assets destroyed if `championKey` is removed (banned/consumed), with weight. */
export function structuralDamage(
    assets: CombinationAsset[],
    championKey: string
): StructuralDamageReport {
    const touched = assets.filter((asset) => asset.championKeys.includes(championKey));
    let weight = 0;
    for (const asset of touched) weight += asset.games;
    return { championKey, assets: touched, weight };
}
