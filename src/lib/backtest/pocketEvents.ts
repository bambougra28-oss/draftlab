/**
 * Chantier F — Définitions STRUCTURELLES des événements pocket (gate F1) et
 * hors-rôle (gate F2) — docs/run2/F-pocket-picks.md §3.1 « ÉVÉNEMENT POCKET /
 * GAME SCORÉE » et §3.2 « ÉVÉNEMENTS / MÉTRIQUE PRIMAIRE », règles GELÉES.
 *
 * Contrats gelés (aucune issue lue — l'issue n'entre que dans la métrique des
 * runners, jamais dans une définition d'événement) :
 *
 *  F1 — ÉVÉNEMENT POCKET : pick résolu (champion c, rôle r, équipe T) tel que
 *    (P1) picks de c par T dans le train = 0 ;
 *    (P2) picks de c dans le train ligue toutes équipes ≤ 2 (tous rôles) ;
 *    (P3) c n'est pas sorti après le 2025-01-01 — la liste DDragon figée au
 *         gel est un PARAMÈTRE injecté (`newChampionKeys`), JAMAIS une
 *         constante codée ici.
 *    CLASSE CONTRASTE « nouveauté banale » : (P1) ∧ picks ligue ≥ 20 ∧ (P3).
 *    Seuils 0 / ≤ 2 / ≥ 20 GELÉS (constantes exportées ci-dessous).
 *
 *  F2 — CLASSE A « hors-rôle établi » : pick résolu (c, r) d'un side
 *    rôle-complet tel que compte fold de (c, r) = 0 ET compte fold de c tous
 *    rôles ≥ 5 (le piège Nasus générique). CLASSE B « hors-corpus » : compte
 *    fold de c = 0 (le chemin fallback uniforme). Un FLEX légitime (le rôle
 *    joué ET au moins un autre rôle ≥ 1 au fold) n'est JAMAIS un événement —
 *    théorème des définitions, testé.
 *
 *  GAME (F1) : une game n'est scorée pour une classe que si EXACTEMENT UN
 *    side porte ≥ 1 événement de la classe (`oneSideOf`) ; pour la classe
 *    contraste : exactement un side nouveauté ET zéro événement pocket dans
 *    la game (`noveltyGameVerdictOf`).
 *
 *  VOISINS (F2, correction de re-revue) : voisin d'un événement = champion du
 *    side qui n'est PAS lui-même un événement de la classe — dans un side à
 *    double événement chaque événement a 3 voisins (pas 4) : les scores
 *    mutuels, tautologiques à 0 % par théorème, sont exclus MÉCANIQUEMENT (le
 *    0 du théorème n'entre ainsi dans aucun critère).
 *
 * Module pur : zéro I/O, zéro horloge, aucune lecture de vainqueur.
 */
import type { DraftRecord, DraftSide } from '$lib/data/types';
import type { Role } from '$lib/types';

// ---- seuils gelés (docs/run2/F-pocket-picks.md §3.1/§3.2) --------------------

/** P1 — picks de c par T dans le train : exactement 0. */
export const POCKET_TEAM_TRAIN_MAX = 0;
/** P2 — picks de c dans le train ligue (toutes équipes, tous rôles) : ≤ 2. */
export const POCKET_LEAGUE_TRAIN_MAX = 2;
/** Classe contraste « nouveauté banale » — picks ligue train : ≥ 20. */
export const NOVELTY_LEAGUE_TRAIN_MIN = 20;
/** F2 classe A — compte fold de c tous rôles : ≥ 5 (champion établi). */
export const ESTABLISHED_FOLD_MIN = 5;

// ---- F1 : événement pocket / classe contraste --------------------------------

/** Comptes de train nécessaires aux prédicats F1 (structurels, fold only). */
export interface PocketTrainCounts {
    /** Picks résolus de c par l'équipe T dans le train (tous rôles). */
    teamTrainPicks: number;
    /** Picks résolus de c dans le train ligue, toutes équipes, tous rôles. */
    leagueTrainPicks: number;
}

/**
 * Événement pocket : P1 ∧ P2 ∧ P3. `newChampionKeys` = liste DDragon figée
 * des champions sortis après le 2025-01-01 (paramètre injecté, publié au gel).
 */
export function isPocketEvent(
    championKey: string,
    counts: PocketTrainCounts,
    newChampionKeys: ReadonlySet<string>
): boolean {
    return (
        counts.teamTrainPicks === POCKET_TEAM_TRAIN_MAX &&
        counts.leagueTrainPicks <= POCKET_LEAGUE_TRAIN_MAX &&
        !newChampionKeys.has(championKey)
    );
}

/** Classe contraste « nouveauté banale » : P1 ∧ picks ligue ≥ 20 ∧ P3. */
export function isNoveltyContrastEvent(
    championKey: string,
    counts: PocketTrainCounts,
    newChampionKeys: ReadonlySet<string>
): boolean {
    return (
        counts.teamTrainPicks === POCKET_TEAM_TRAIN_MAX &&
        counts.leagueTrainPicks >= NOVELTY_LEAGUE_TRAIN_MIN &&
        !newChampionKeys.has(championKey)
    );
}

/** Tallies de train F1 : comptes bruts de picks résolus, équipe et ligue. */
export interface PocketTrainTallies {
    /** équipe → champion → picks résolus (tous rôles). */
    teamPicks: Map<string, Map<string, number>>;
    /** champion → picks résolus toutes équipes (tous rôles). */
    leaguePicks: Map<string, number>;
}

/** Équipe agissant côté `side` dans ce record. */
function actingTeam(record: DraftRecord, side: DraftSide): string {
    return side === 'blue' ? record.blueTeam : record.redTeam;
}

/**
 * Comptes P1/P2 sur un train : seuls les PICKS RÉSOLUS comptent (championKey
 * ≠ '') ; les bans ne comptent jamais ; tous rôles confondus (la rareté F1
 * est une rareté de champion, pas de couple champion×rôle).
 */
export function tallyPocketTrain(train: DraftRecord[]): PocketTrainTallies {
    const teamPicks = new Map<string, Map<string, number>>();
    const leaguePicks = new Map<string, number>();
    for (const record of train) {
        for (const action of record.actions) {
            if (action.type !== 'pick' || action.championKey === '') continue;
            const team = actingTeam(record, action.side);
            leaguePicks.set(action.championKey, (leaguePicks.get(action.championKey) ?? 0) + 1);
            let byChampion = teamPicks.get(team);
            if (byChampion === undefined) {
                byChampion = new Map<string, number>();
                teamPicks.set(team, byChampion);
            }
            byChampion.set(action.championKey, (byChampion.get(action.championKey) ?? 0) + 1);
        }
    }
    return { teamPicks, leaguePicks };
}

/** Comptes (équipe, ligue) d'un champion — équipe/champion inconnus ⇒ 0. */
export function pocketCountsOf(
    tallies: PocketTrainTallies,
    team: string,
    championKey: string
): PocketTrainCounts {
    return {
        teamTrainPicks: tallies.teamPicks.get(team)?.get(championKey) ?? 0,
        leagueTrainPicks: tallies.leaguePicks.get(championKey) ?? 0
    };
}

// ---- F2 : classes A / B sur les comptes fold ---------------------------------

/** Comptes fold d'un champion : par rôle + total tous rôles. */
export interface FoldRoleCounts {
    byRole: Partial<Record<Role, number>>;
    /** Σ des comptes par rôle (0 = champion hors-corpus, classe B). */
    total: number;
}

/**
 * Adapte l'entrée `byChampion` d'un `RolePriorsFit` (fitRolePriors du harnais
 * roleInference — poids = comptes bruts de picks) : champion absent ⇒ total 0.
 */
export function foldCountsOf(weights: Partial<Record<Role, number>> | undefined): FoldRoleCounts {
    if (weights === undefined) return { byRole: {}, total: 0 };
    let total = 0;
    for (const value of Object.values(weights)) total += value ?? 0;
    return { byRole: weights, total };
}

/** Classe A « hors-rôle établi » : compte fold de (c, r) = 0 ∧ total ≥ 5. */
export function isClassAEvent(counts: FoldRoleCounts, role: Role): boolean {
    return (counts.byRole[role] ?? 0) === 0 && counts.total >= ESTABLISHED_FOLD_MIN;
}

/** Classe B « hors-corpus » : compte fold de c tous rôles = 0. */
export function isClassBEvent(counts: FoldRoleCounts): boolean {
    return counts.total === 0;
}

/**
 * FLEX légitime au rôle joué : le rôle joué a ≥ 1 pick au fold ET au moins un
 * AUTRE rôle a ≥ 1. Jamais un événement (ni A : (c, r) ≥ 1 ; ni B : total
 * ≥ 2 > 0) — c'est un théorème des définitions, vérifié par les tests.
 */
export function isLegitimateFlex(counts: FoldRoleCounts, role: Role): boolean {
    if ((counts.byRole[role] ?? 0) < 1) return false;
    for (const [key, value] of Object.entries(counts.byRole)) {
        if (Number(key) !== role && (value ?? 0) >= 1) return true;
    }
    return false;
}

// ---- sides rôle-complets ------------------------------------------------------

export interface ResolvedSidePick {
    championKey: string;
    role: Role;
    seq: number;
}

/**
 * Les 5 picks résolus AVEC rôle d'un side, triés par seq — patron EXACT du
 * harnais roleInference (« side rôle-complet ») ; undefined si le side n'a
 * pas exactement 5 picks résolus à rôle connu.
 */
export function roleCompleteSidePicks(
    record: DraftRecord,
    side: DraftSide
): ResolvedSidePick[] | undefined {
    const picks = record.actions
        .filter((a) => a.type === 'pick' && a.side === side && a.championKey !== '' && a.role !== undefined)
        .sort((a, b) => a.seq - b.seq)
        .map((a) => ({ championKey: a.championKey, role: a.role as Role, seq: a.seq }));
    return picks.length === 5 ? picks : undefined;
}

// ---- F1 : classification one-side / both-sides par game ------------------------

export type OneSideVerdict =
    | { kind: 'none' }
    | { kind: 'one-side'; side: DraftSide }
    | { kind: 'both-sides' };

/**
 * GAME SCORÉE (F1) : EXACTEMENT UN side porte ≥ 1 événement de la classe —
 * les games à événements des deux côtés sont exclues (comptées par l'appelant).
 */
export function oneSideOf(blueHasEvent: boolean, redHasEvent: boolean): OneSideVerdict {
    if (blueHasEvent && redHasEvent) return { kind: 'both-sides' };
    if (blueHasEvent) return { kind: 'one-side', side: 'blue' };
    if (redHasEvent) return { kind: 'one-side', side: 'red' };
    return { kind: 'none' };
}

export type NoveltyGameVerdict = OneSideVerdict | { kind: 'pocket-present' };

/**
 * Classe contraste par game : exactement un side nouveauté ET zéro événement
 * pocket dans la game (les DEUX camps). La présence pocket est testée en
 * premier (le conjoint « zéro pocket » de la règle) ; l'ordre des causes ne
 * change pas l'ensemble scoré, seulement la ventilation de couverture.
 */
export function noveltyGameVerdictOf(
    noveltyBlue: boolean,
    noveltyRed: boolean,
    pocketBlue: boolean,
    pocketRed: boolean
): NoveltyGameVerdict {
    if (pocketBlue || pocketRed) return { kind: 'pocket-present' };
    return oneSideOf(noveltyBlue, noveltyRed);
}

// ---- F2 : voisins d'événement (exclusion tautologique mécanique) ---------------

/**
 * Voisins par événement : pour chaque champion-événement présent dans le side,
 * voisins = champions du side qui ne sont PAS eux-mêmes des événements de la
 * classe. Side à double événement ⇒ 3 voisins chacun (pas 4) : les 2 scores
 * mutuels (tautologiques à 0 % par le théorème classe A) n'apparaissent
 * jamais — l'exclusion est structurelle, pas un post-filtre.
 */
export function eventNeighborsOf(
    sideChampions: readonly string[],
    eventChampions: ReadonlySet<string>
): Map<string, string[]> {
    const neighbors = sideChampions.filter((key) => !eventChampions.has(key));
    const out = new Map<string, string[]>();
    for (const key of sideChampions) {
        if (eventChampions.has(key)) out.set(key, [...neighbors]);
    }
    return out;
}
