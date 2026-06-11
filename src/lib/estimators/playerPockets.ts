/**
 * Chantier F — extension PAR JOUEUR de F-a (directive Alain 2026-06-11 ;
 * docs/run2/F-pocket-picks.md §5 : « l'attribution par joueur raffine F-a de
 * l'équipe au joueur »).
 *
 * L'attribution joueur des corpus (`DraftAction.playerId` — nom de page
 * Leaguepedia, ex. « Canyon ») permet deux lectures :
 *  1. PROPOSER — le réservoir carrière de chaque joueur de NOTRE équipe : les
 *     mains montrées quelque part en corpus (autre équipe, autre ligue — un
 *     joueur transfère ses mains avec lui) que le modèle public de son équipe
 *     ACTUELLE n'attend pas (bits hauts) ;
 *  2. ANTICIPER — la même lecture sur le lineup ADVERSE, plus les DÉCALAGES
 *     de rôle déjà montrés (matériau des tromperies de role-map — cas
 *     fondateur G2-Nasus jungle).
 *
 * LIMITE HONNÊTE (à afficher par toute UI consommatrice) : un pocket jamais
 * montré dans AUCUNE game corpus reste invisible — on anticipe les
 * RÉPÉTITIONS de pocket et les DÉCALAGES de rôle, jamais l'inédit absolu.
 * Gate F1 ROUGE : outil de LECTURE/ANTICIPATION, aucun claim de valeur
 * (DA-V2-11) ; aucune prétention de connaître un pool privé.
 *
 * Conventions de comptage (héritées du chantier C, `seriesDemand`) :
 *  - seuls les picks RÉSOLUS (championKey ≠ '') portant `playerId` ET `role`
 *    entrent dans la carrière — l'index est par (champion, rôle), un pick
 *    sans rôle n'a pas de cellule (100 % des picks corpus portent un rôle) ;
 *  - `wins` n'est incrémenté que si `record.winner` est connu et égal au side
 *    du pick (vainqueur inconnu ⇒ game comptée, win non) ;
 *  - `teams` mémorise le nom BRUT d'équipe du side du pick à chaque game —
 *    toute comparaison inter-sources passe par `canonicalTeamName` ;
 *  - `currentLineup` lit la compo ACTUELLE du corpus seul (majorité sur les
 *    N games les plus récentes) — AUCUNE dépendance au roster gol.gg ; ici le
 *    champion peut être irrésolu : qui joue le rôle ne dépend pas de la
 *    résolution de la main.
 *
 * Module pur : zéro I/O, zéro horloge (les seules dates lues sont celles des
 * records injectés).
 */
import { canonicalTeamName } from '$lib/data/normalize';
import type { DraftRecord, DraftSide } from '$lib/data/types';
import type { PublicSelfModel } from '$lib/estimators/publicSelfModel';
import { ROLES, type Role } from '$lib/types';

/** Garde IEEE −0 (convention fogReveal/publicSelfModel) : P = 1 ⇒ bits = 0, jamais −0. */
const noNegZero = (value: number): number => (value === 0 ? 0 : value);

/** Tri date desc ; non daté APRÈS daté ; égalité ⇒ 0 (départage à l'appelant). */
function newerFirst(a: string | undefined, b: string | undefined): number {
    if (a === b) return 0;
    if (a === undefined) return 1;
    if (b === undefined) return -1;
    return a < b ? 1 : -1;
}

// ---- fitPlayerHistory ------------------------------------------------------------

/** Une main de carrière : (champion, rôle) agrégé sur toutes les games corpus du joueur. */
export interface PlayerChampionRoleCell {
    championKey: string;
    role: Role;
    games: number;
    /** Wins comptées seulement quand `record.winner` est connu (cf. en-tête). */
    wins: number;
    /** Date ISO de la game la plus récente où la main a été montrée. */
    lastDate?: string;
    /** Noms BRUTS d'équipe du side du pick (déduits par game) — display/diagnostic. */
    teams: Set<string>;
}

export interface PlayerHistoryFit {
    /** playerId (page Leaguepedia) → `${championKey}|${role}` → cellule carrière. */
    byPlayer: Map<string, Map<string, PlayerChampionRoleCell>>;
}

const cellKeyOf = (championKey: string, role: Role): string => `${championKey}|${role}`;

/**
 * Carrière corpus PAR JOUEUR sur les records de TOUTES les ligues passées en
 * argument (carrière cross-ligues — le point : un joueur transfère ses mains).
 * Picks résolus uniquement, `playerId` et `role` requis (cf. en-tête).
 */
export function fitPlayerHistory(records: DraftRecord[]): PlayerHistoryFit {
    const byPlayer = new Map<string, Map<string, PlayerChampionRoleCell>>();
    for (const record of records) {
        for (const action of record.actions) {
            if (action.type !== 'pick' || action.championKey === '') continue;
            const playerId = action.playerId;
            const role = action.role;
            if (playerId === undefined || playerId === '' || role === undefined) continue;

            let cells = byPlayer.get(playerId);
            if (cells === undefined) {
                cells = new Map<string, PlayerChampionRoleCell>();
                byPlayer.set(playerId, cells);
            }
            const key = cellKeyOf(action.championKey, role);
            let cell = cells.get(key);
            if (cell === undefined) {
                cell = { championKey: action.championKey, role, games: 0, wins: 0, teams: new Set<string>() };
                cells.set(key, cell);
            }
            cell.games += 1;
            if (record.winner === action.side) cell.wins += 1;
            cell.teams.add(action.side === 'blue' ? record.blueTeam : record.redTeam);
            if (record.date !== undefined && (cell.lastDate === undefined || record.date > cell.lastDate)) {
                cell.lastDate = record.date;
            }
        }
    }
    return { byPlayer };
}

// ---- currentLineup ---------------------------------------------------------------

/**
 * Le joueur ACTUEL de chaque rôle d'une équipe, lu du corpus SEUL : par rôle,
 * le playerId majoritaire sur les `recentGames` games les plus récentes de
 * l'équipe (datées desc, non datées en dernier, gameId asc en égalité de date
 * — déterminisme). Picks sans rôle ou sans playerId ignorés. Égalité de
 * majorité ⇒ le joueur vu le plus RÉCEMMENT gagne (puis playerId asc, pur
 * départage). Rôle sans aucune attribution ⇒ absent de la Map.
 */
export function currentLineup(
    teamRecords: DraftRecord[],
    teamName: string,
    recentGames = 10
): Map<Role, string> {
    const canonical = canonicalTeamName(teamName);
    const sided: { record: DraftRecord; side: DraftSide }[] = [];
    for (const record of teamRecords) {
        if (canonicalTeamName(record.blueTeam) === canonical) sided.push({ record, side: 'blue' });
        else if (canonicalTeamName(record.redTeam) === canonical) sided.push({ record, side: 'red' });
    }
    sided.sort((a, b) => {
        const byDate = newerFirst(a.record.date, b.record.date);
        if (byDate !== 0) return byDate;
        return a.record.gameId < b.record.gameId ? -1 : a.record.gameId > b.record.gameId ? 1 : 0;
    });
    const recent = sided.slice(0, Math.max(0, recentGames));

    /** Par rôle : playerId → { count, firstIndex = apparition la plus récente }. */
    const tallies = new Map<Role, Map<string, { count: number; firstIndex: number }>>();
    recent.forEach(({ record, side }, index) => {
        for (const action of record.actions) {
            if (action.type !== 'pick' || action.side !== side) continue;
            const role = action.role;
            const playerId = action.playerId;
            if (role === undefined || playerId === undefined || playerId === '') continue;
            let roleTally = tallies.get(role);
            if (roleTally === undefined) {
                roleTally = new Map<string, { count: number; firstIndex: number }>();
                tallies.set(role, roleTally);
            }
            const tally = roleTally.get(playerId);
            if (tally === undefined) roleTally.set(playerId, { count: 1, firstIndex: index });
            else tally.count += 1;
        }
    });

    const lineup = new Map<Role, string>();
    for (const role of ROLES) {
        const roleTally = tallies.get(role);
        if (roleTally === undefined) continue;
        let best: { playerId: string; count: number; firstIndex: number } | undefined;
        for (const [playerId, tally] of roleTally) {
            if (
                best === undefined ||
                tally.count > best.count ||
                (tally.count === best.count && tally.firstIndex < best.firstIndex) ||
                (tally.count === best.count && tally.firstIndex === best.firstIndex && playerId < best.playerId)
            ) {
                best = { playerId, count: tally.count, firstIndex: tally.firstIndex };
            }
        }
        if (best !== undefined) lineup.set(role, best.playerId);
    }
    return lineup;
}

// ---- playerReservoir / roleDeceptions ---------------------------------------------

/**
 * Masse publique ACTUELLE d'un (champion, rôle) — P renormalisée du modèle
 * public de l'équipe du joueur (sémantique `fitPublicSelfModel`), TOUJOURS
 * injectée, jamais devinée ici. 0 = hors candidats du rôle.
 */
export type PublicMassFn = (championKey: string, role: Role) => number;

export interface PlayerReservoirOptions {
    /** Games carrière minimum pour qu'une main entre au réservoir (défaut 1). */
    minGames?: number;
    /** Plafond de bits : bits = −log₂(max(P, 2^−maxBitsCap)) (défaut 10). */
    maxBitsCap?: number;
}

export interface PlayerPocketEntry {
    championKey: string;
    role: Role;
    games: number;
    wins: number;
    lastDate?: string;
    /** Équipes sous lesquelles la main a été montrée (noms bruts, triés asc). */
    teams: string[];
    /**
     * −log₂(max(P, 2^−maxBitsCap)) vs modèle public injecté. Convention : les
     * entrées de `roleDeceptions` portent 0 (aucune masse injectée là — le
     * flag `offRole` est l'information, jamais un score).
     */
    bits: number;
    /** Rôle MINORITAIRE d'une main multi-rôle (sortie de `roleDeceptions`). */
    offRole?: boolean;
}

/** Adaptateur : modèle public F-a → PublicMassFn (index O(1), construit une fois). */
export function publicMassOf(model: Pick<PublicSelfModel, 'byRole'>): PublicMassFn {
    const index = new Map<Role, Map<string, number>>();
    for (const [role, entries] of model.byRole) {
        const sub = new Map<string, number>();
        for (const entry of entries) sub.set(entry.championKey, entry.p);
        index.set(role, sub);
    }
    return (championKey, role) => index.get(role)?.get(championKey) ?? 0;
}

/** Tri du réservoir : bits desc → games desc → lastDate desc → clé asc → rôle asc. */
function compareEntries(a: PlayerPocketEntry, b: PlayerPocketEntry): number {
    if (a.bits !== b.bits) return b.bits - a.bits;
    if (a.games !== b.games) return b.games - a.games;
    const byDate = newerFirst(a.lastDate, b.lastDate);
    if (byDate !== 0) return byDate;
    if (a.championKey !== b.championKey) return a.championKey < b.championKey ? -1 : 1;
    return a.role - b.role;
}

function entryOf(cell: PlayerChampionRoleCell, bits: number, offRole: boolean): PlayerPocketEntry {
    return {
        championKey: cell.championKey,
        role: cell.role,
        games: cell.games,
        wins: cell.wins,
        ...(cell.lastDate !== undefined ? { lastDate: cell.lastDate } : {}),
        teams: [...cell.teams].sort(),
        bits,
        ...(offRole ? { offRole: true } : {})
    };
}

/**
 * Le réservoir d'un joueur : TOUTE sa carrière corpus (même autre équipe ou
 * autre ligue — c'est le point) classée par surprise vs la masse publique
 * ACTUELLE de SON équipe (fonction injectée). bits = −log₂(max(P, 2^−cap)) ;
 * P = 0 (main jamais vue dans le rôle chez l'équipe courante / la ligue
 * courante) sature au plafond. Joueur inconnu du corpus ⇒ [].
 */
export function playerReservoir(
    fit: PlayerHistoryFit,
    playerId: string,
    publicMass: PublicMassFn,
    opts: PlayerReservoirOptions = {}
): PlayerPocketEntry[] {
    const minGames = opts.minGames ?? 1;
    const maxBitsCap = opts.maxBitsCap ?? 10;
    const floor = Math.pow(2, -maxBitsCap);
    const cells = fit.byPlayer.get(playerId);
    if (cells === undefined) return [];

    const entries: PlayerPocketEntry[] = [];
    for (const cell of cells.values()) {
        if (cell.games < minGames) continue;
        const p = publicMass(cell.championKey, cell.role);
        entries.push(entryOf(cell, noNegZero(-Math.log2(Math.max(p, floor))), false));
    }
    entries.sort(compareEntries);
    return entries;
}

/**
 * Les décalages de rôle déjà montrés : champions joués par le joueur dans
 * PLUSIEURS rôles en carrière corpus (≥ 1 game dans ≥ 2 rôles) — le matériau
 * des tromperies de role-map (cas Nasus jungle). Sortie = les cellules des
 * rôles MINORITAIRES (tout sauf le rôle majoritaire : games desc, puis
 * lastDate la plus récente, puis rôle canonique asc), flag `offRole`, bits 0
 * par convention (cf. PlayerPocketEntry). Tri : games desc → lastDate desc →
 * clé asc → rôle asc. Un champion mono-rôle n'est JAMAIS une tromperie.
 */
export function roleDeceptions(fit: PlayerHistoryFit, playerId: string): PlayerPocketEntry[] {
    const cells = fit.byPlayer.get(playerId);
    if (cells === undefined) return [];

    const byChampion = new Map<string, PlayerChampionRoleCell[]>();
    for (const cell of cells.values()) {
        const group = byChampion.get(cell.championKey);
        if (group === undefined) byChampion.set(cell.championKey, [cell]);
        else group.push(cell);
    }

    const out: PlayerPocketEntry[] = [];
    for (const group of byChampion.values()) {
        if (group.length < 2) continue; // mono-rôle : jamais une tromperie
        const ranked = [...group].sort((a, b) => {
            if (a.games !== b.games) return b.games - a.games;
            const byDate = newerFirst(a.lastDate, b.lastDate);
            if (byDate !== 0) return byDate;
            return a.role - b.role;
        });
        for (const cell of ranked.slice(1)) out.push(entryOf(cell, 0, true));
    }
    out.sort((a, b) => {
        if (a.games !== b.games) return b.games - a.games;
        const byDate = newerFirst(a.lastDate, b.lastDate);
        if (byDate !== 0) return byDate;
        if (a.championKey !== b.championKey) return a.championKey < b.championKey ? -1 : 1;
        return a.role - b.role;
    });
    return out;
}

// ---- anticipateEnemyPockets --------------------------------------------------------

/** Lecture par joueur : réservoir carrière + décalages de rôle montrés. */
export interface PlayerPocketRead {
    playerId: string;
    reservoir: PlayerPocketEntry[];
    deceptions: PlayerPocketEntry[];
}

/**
 * L'application DÉFENSIVE par joueur adverse : pour chaque rôle du lineup
 * (ordre canonique ROLES), le réservoir du joueur vs le modèle public de SON
 * équipe (masse injectée) et ses décalages de rôle. Lecture/anticipation
 * seulement — F1 ROUGE, aucun claim de valeur.
 */
export function anticipateEnemyPockets(
    fit: PlayerHistoryFit,
    lineup: Map<Role, string>,
    publicMass: PublicMassFn,
    opts: PlayerReservoirOptions = {}
): Map<Role, PlayerPocketRead> {
    const out = new Map<Role, PlayerPocketRead>();
    for (const role of ROLES) {
        const playerId = lineup.get(role);
        if (playerId === undefined) continue;
        out.set(role, {
            playerId,
            reservoir: playerReservoir(fit, playerId, publicMass, opts),
            deceptions: roleDeceptions(fit, playerId)
        });
    }
    return out;
}
