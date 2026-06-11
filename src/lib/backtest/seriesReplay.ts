/**
 * Chantier C — Reconstitution des séries réelles + test empirique de mode
 * (docs/run2/C-fearless-g3.md §2.1 ; règle gelée §1.1 « RECONSTITUTION » et
 * « TEST 0 »). Réutilisable par les gates futures et par l'UI (import d'une
 * série réelle).
 *
 * Contrats gelés :
 *  - Série = records d'un même `series.matchId`, ordonnés par
 *    `series.gameNumber` (le script appelle ce module corpus par corpus —
 *    la clé (corpus, matchId) vit chez l'appelant). Les records sans
 *    `series.matchId` ne forment pas de série et sont ignorés ici.
 *  - Série invalide (gameNumber dupliqué, trou 1..L, équipes ≠ exactement 2)
 *    ⇒ exclue et comptée via une anomalie — une seule, à la première règle
 *    violée dans cet ordre.
 *  - Consommé avant la game g = ∪ picks RÉSOLUS (championKey ≠ '') des games
 *    de gameNumber < g, des DEUX camps (hard Fearless).
 *  - Re-pick = champion pické dans une game antérieure de la même série,
 *    re-pické ensuite par l'une OU l'autre équipe. TEST 0 : un tournoi est
 *    « Fearless confirmé » ssi 0 re-pick sur ses séries multi-games.
 *  - Re-ban d'un consommé = anomalie sous hard Fearless, signalée par gameId
 *    SANS exclure le tournoi (la règle d'exclusion porte sur les re-PICKS).
 *
 * Module pur : zéro I/O, zéro horloge.
 */
import type { DraftRecord } from '$lib/data/types';

export interface ReconstructedSeries {
    matchId: string;
    tournament?: string;
    league?: string;
    /** Games triées par series.gameNumber (1..L vérifié sans trou ni doublon). */
    games: DraftRecord[];
    /** Exactement deux noms d'équipe sur toute la série. */
    teams: [string, string];
    /** Champion pické plus tôt dans la série re-pické ensuite (l'un OU l'autre camp). */
    repickCount: number;
    /** Ban d'un champion déjà consommé (anomalie sous hard Fearless), gameIds joints. */
    rebanOfConsumed: { gameId: string; championKey: string }[];
}

export interface SeriesAnomaly {
    matchId: string;
    kind: 'duplicate-game-number' | 'gap' | 'teams';
    detail: string;
}

/** Picks résolus d'un record (les deux camps), clés champion. */
function resolvedPicksOf(record: DraftRecord): string[] {
    const picks: string[] = [];
    for (const action of record.actions) {
        if (action.type === 'pick' && action.championKey !== '') picks.push(action.championKey);
    }
    return picks;
}

/**
 * Regroupe les records par `series.matchId`, valide chaque série (doublon de
 * gameNumber, trou 1..L, exactement 2 équipes — dans cet ordre) et compte
 * re-picks et re-bans d'un consommé en marchant les games dans l'ordre.
 * Les séries gardent l'ordre de première apparition de leur matchId.
 */
export function reconstructSeries(records: DraftRecord[]): {
    series: ReconstructedSeries[];
    anomalies: SeriesAnomaly[];
} {
    const byMatch = new Map<string, DraftRecord[]>();
    for (const record of records) {
        const matchId = record.series?.matchId;
        if (matchId === undefined) continue;
        const bucket = byMatch.get(matchId);
        if (bucket) bucket.push(record);
        else byMatch.set(matchId, [record]);
    }

    const series: ReconstructedSeries[] = [];
    const anomalies: SeriesAnomaly[] = [];

    for (const [matchId, games] of byMatch) {
        const sorted = [...games].sort(
            (a, b) => (a.series?.gameNumber ?? 0) - (b.series?.gameNumber ?? 0)
        );
        const numbers = sorted.map((g) => g.series?.gameNumber ?? 0);

        // 1. gameNumber dupliqué.
        const seen = new Set<number>();
        const duplicate = numbers.find((n) => {
            if (seen.has(n)) return true;
            seen.add(n);
            return false;
        });
        if (duplicate !== undefined) {
            anomalies.push({
                matchId,
                kind: 'duplicate-game-number',
                detail: `gameNumber ${duplicate} dupliqué (numéros : ${numbers.join(', ')})`
            });
            continue;
        }

        // 2. trou 1..L (max = longueur, tous les numéros présents).
        const isContiguous = numbers.every((n, i) => n === i + 1);
        if (!isContiguous) {
            anomalies.push({
                matchId,
                kind: 'gap',
                detail: `gameNumbers ${numbers.join(', ')} ≠ 1..${numbers.length}`
            });
            continue;
        }

        // 3. exactement 2 noms d'équipe sur toute la série (ordre de première apparition).
        const teamNames: string[] = [];
        for (const game of sorted) {
            for (const name of [game.blueTeam, game.redTeam]) {
                if (!teamNames.includes(name)) teamNames.push(name);
            }
        }
        if (teamNames.length !== 2) {
            anomalies.push({
                matchId,
                kind: 'teams',
                detail: `${teamNames.length} équipes sur la série : ${teamNames.join(', ')}`
            });
            continue;
        }

        // Re-picks et re-bans d'un consommé, en marchant les games dans l'ordre.
        let repickCount = 0;
        const rebanOfConsumed: { gameId: string; championKey: string }[] = [];
        const consumed = new Set<string>();
        for (const game of sorted) {
            for (const action of game.actions) {
                if (action.championKey === '') continue;
                if (action.type === 'ban' && consumed.has(action.championKey)) {
                    rebanOfConsumed.push({ gameId: game.gameId, championKey: action.championKey });
                }
                if (action.type === 'pick' && consumed.has(action.championKey)) {
                    repickCount += 1;
                }
            }
            for (const key of resolvedPicksOf(game)) consumed.add(key);
        }

        const first = sorted[0];
        const entry: ReconstructedSeries = {
            matchId,
            games: sorted,
            teams: [teamNames[0], teamNames[1]],
            repickCount,
            rebanOfConsumed
        };
        if (first.tournament !== undefined) entry.tournament = first.tournament;
        if (first.league !== undefined) entry.league = first.league;
        series.push(entry);
    }

    return { series, anomalies };
}

/** ∪ picks résolus des games de gameNumber < g (les deux camps). */
export function consumedBeforeGame(series: ReconstructedSeries, gameNumber: number): Set<string> {
    const consumed = new Set<string>();
    for (const game of series.games) {
        const number = game.series?.gameNumber;
        if (number === undefined || number >= gameNumber) continue;
        for (const key of resolvedPicksOf(game)) consumed.add(key);
    }
    return consumed;
}

export interface TournamentFearlessRow {
    tournament: string;
    multiGameSeries: number;
    laterPicks: number;
    repicks: number;
    rebans: number;
    /** repicks === 0 (la règle TEST 0). */
    fearlessConfirmed: boolean;
}

/**
 * Tableau TEST 0 par tournoi (séries multi-games, picks résolus des games 2+,
 * re-picks, re-bans d'un consommé). Les séries sans tournoi sont regroupées
 * sous '' ; lignes triées par tournoi croissant.
 */
export function tournamentFearlessTable(series: ReconstructedSeries[]): TournamentFearlessRow[] {
    const rows = new Map<string, TournamentFearlessRow>();
    for (const entry of series) {
        const tournament = entry.tournament ?? '';
        let row = rows.get(tournament);
        if (row === undefined) {
            row = {
                tournament,
                multiGameSeries: 0,
                laterPicks: 0,
                repicks: 0,
                rebans: 0,
                fearlessConfirmed: true
            };
            rows.set(tournament, row);
        }
        if (entry.games.length >= 2) row.multiGameSeries += 1;
        for (const game of entry.games) {
            const number = game.series?.gameNumber;
            if (number === undefined || number < 2) continue;
            row.laterPicks += resolvedPicksOf(game).length;
        }
        row.repicks += entry.repickCount;
        row.rebans += entry.rebanOfConsumed.length;
    }
    const out = [...rows.values()];
    for (const row of out) row.fearlessConfirmed = row.repicks === 0;
    return out.sort((a, b) => (a.tournament < b.tournament ? -1 : a.tournament > b.tournament ? 1 : 0));
}

/** Équipe agissant côté `side` dans ce record. */
function teamOnSide(record: DraftRecord, side: 'blue' | 'red'): string {
    return side === 'blue' ? record.blueTeam : record.redTeam;
}

/**
 * Équipe STRICTEMENT au maxWins quand chaque game a un vainqueur ; undefined
 * sinon. Contrat explicite : égalité de maxWins ⇒ undefined (Bo2 1-1 et
 * série 2-2 abandonnée : exclues).
 */
export function seriesWinner(series: ReconstructedSeries): string | undefined {
    const wins = new Map<string, number>([
        [series.teams[0], 0],
        [series.teams[1], 0]
    ]);
    for (const game of series.games) {
        if (game.winner === undefined) return undefined;
        const team = teamOnSide(game, game.winner);
        wins.set(team, (wins.get(team) ?? 0) + 1);
    }
    const [a, b] = series.teams;
    const winsA = wins.get(a) ?? 0;
    const winsB = wins.get(b) ?? 0;
    if (winsA === winsB) return undefined;
    return winsA > winsB ? a : b;
}

/**
 * maxWins 2 ⇒ 'bo3', 3 ⇒ 'bo5', autre ⇒ undefined (série S3-inéligible).
 * maxWins = max de victoires d'une équipe sur les games ayant un vainqueur ;
 * l'exclusion des séries ambiguës (1-1, 2-2 abandonnée, game sans vainqueur)
 * est portée par `seriesWinner`, pas par l'inférence de format.
 */
export function inferFormat(series: ReconstructedSeries): 'bo3' | 'bo5' | undefined {
    const wins = new Map<string, number>();
    for (const game of series.games) {
        if (game.winner === undefined) continue;
        const team = teamOnSide(game, game.winner);
        wins.set(team, (wins.get(team) ?? 0) + 1);
    }
    let maxWins = 0;
    for (const count of wins.values()) maxWins = Math.max(maxWins, count);
    if (maxWins === 2) return 'bo3';
    if (maxWins === 3) return 'bo5';
    return undefined;
}
