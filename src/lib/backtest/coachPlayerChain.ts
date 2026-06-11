/**
 * Gate COACH v2 (run #3, chantier A3) — helpers PURS de la chaîne de
 * candidats « pools joueurs réels » (docs/run3/A3-coach-player-pools.md §2.2).
 *
 * Pont entre les fits corpus walk-forward (`fitPlayerHistory`/`currentLineup`,
 * `src/lib/estimators/playerPockets.ts`) et la forme `ProPlayer` que la chaîne
 * shippée consomme (`rankOurCandidates`, `src/lib/intel/liveDraft.ts`) :
 *
 *  - `championPoolOf` : les cellules carrière (champion, rôle) d'un joueur
 *    agrégées PAR CHAMPION (Σ games, Σ wins sur les rôles ; tri clé asc, pur
 *    déterminisme — `rankOurCandidates` re-trie de toute façon) — la forme
 *    `ChampionPoolEntry` du roster shippé est par champion, pas par rôle ; la
 *    contrainte de rôle est portée par `filterByOpenRoles` au niveau champion,
 *    exactement comme en production (un pocket off-role déjà montré — le cas
 *    fondateur Nasus — reste visible du pool, c'est voulu) ;
 *  - `lineupProPlayers` : un lineup walk-forward → `ProPlayer[]` (ordre ROLES
 *    canonique ; rôle sans joueur absent ; id = name = playerId).
 *
 * Zéro I/O, zéro horloge, zéro logique de classement (elle reste dans
 * `rankOurCandidates`, importée telle quelle par le runner — jamais répliquée).
 */
import type { PlayerHistoryFit } from '$lib/estimators/playerPockets';
import type { ChampionPoolEntry, ProPlayer } from '$lib/pro/types';
import { ROLES, type Role } from '$lib/types';

/**
 * Pool par CHAMPION d'un joueur : cellules carrière agrégées (Σ games,
 * Σ wins sur les rôles), tri clé asc. Joueur inconnu ⇒ [].
 */
export function championPoolOf(fit: PlayerHistoryFit, playerId: string): ChampionPoolEntry[] {
    const cells = fit.byPlayer.get(playerId);
    if (cells === undefined) return [];
    const byChampion = new Map<string, { games: number; wins: number }>();
    for (const cell of cells.values()) {
        const agg = byChampion.get(cell.championKey) ?? { games: 0, wins: 0 };
        agg.games += cell.games;
        agg.wins += cell.wins;
        byChampion.set(cell.championKey, agg);
    }
    return [...byChampion.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([championKey, { games, wins }]) => ({ championKey, games, wins }));
}

/**
 * ProPlayer[] d'un lineup walk-forward (ordre ROLES ; rôle sans joueur
 * absent ; id = name = playerId ; pool par championPoolOf).
 */
export function lineupProPlayers(fit: PlayerHistoryFit, lineup: Map<Role, string>): ProPlayer[] {
    const out: ProPlayer[] = [];
    for (const role of ROLES) {
        const playerId = lineup.get(role);
        if (playerId === undefined) continue;
        out.push({ id: playerId, name: playerId, role, pool: championPoolOf(fit, playerId) });
    }
    return out;
}
