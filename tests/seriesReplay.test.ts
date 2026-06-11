import { describe, expect, it } from 'vitest';
import {
    consumedBeforeGame,
    inferFormat,
    reconstructSeries,
    seriesWinner,
    tournamentFearlessTable,
    type ReconstructedSeries
} from '$lib/backtest/seriesReplay';
import type { DraftAction, DraftRecord, DraftSide } from '$lib/data/types';

/*
 * Mini-corpus synthétique calculé à la main (spec docs/run2/C-fearless-g3.md
 * §2.5). Aucune donnée réelle : chaque compte attendu est dérivé de la règle
 * gelée §1.1 (RECONSTITUTION + TEST 0), jamais d'une exécution.
 */

function pick(side: DraftSide, championKey: string, seq: number): DraftAction {
    return { seq, type: 'pick', phase: 'pick1', side, championKey, championName: championKey };
}

function ban(side: DraftSide, championKey: string, seq: number): DraftAction {
    return { seq, type: 'ban', phase: 'ban1', side, championKey, championName: championKey };
}

function game(over: {
    gameId: string;
    matchId: string;
    gameNumber: number;
    tournament?: string;
    blue: string;
    red: string;
    winner?: DraftSide;
    actions: DraftAction[];
}): DraftRecord {
    const record: DraftRecord = {
        gameId: over.gameId,
        blueTeam: over.blue,
        redTeam: over.red,
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        series: { matchId: over.matchId, gameNumber: over.gameNumber },
        actions: over.actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-11T00:00:00Z' }
    };
    if (over.tournament !== undefined) record.tournament = over.tournament;
    if (over.winner !== undefined) record.winner = over.winner;
    return record;
}

function byId(series: ReconstructedSeries[], matchId: string): ReconstructedSeries {
    const found = series.find((s) => s.matchId === matchId);
    if (found === undefined) throw new Error(`série ${matchId} absente`);
    return found;
}

/*
 * Groupe A — séries du tableau TEST 0 :
 *  S1 (T-A, Alpha/Beta, 3 games propres, Alpha 2-1) : consommation à la main.
 *  S2 (T-B, Gamma/Delta, 2 games, 1 re-pick de x par Delta, 1-1).
 *  S6 (T-A, Hotel/India, 2 games, re-ban du consommé h1 en G2, Hotel 2-0).
 *  S10 (T-A, mono-game — ne compte pas en multi-games).
 */
const groupA: DraftRecord[] = [
    // S1
    game({
        gameId: 'S1G1', matchId: 'S1', gameNumber: 1, tournament: 'T-A', blue: 'Alpha', red: 'Beta',
        winner: 'blue',
        actions: [pick('blue', 'a1', 7), pick('blue', 'a2', 10), pick('red', 'b1', 8), pick('red', 'b2', 9)]
    }),
    game({
        gameId: 'S1G2', matchId: 'S1', gameNumber: 2, tournament: 'T-A', blue: 'Beta', red: 'Alpha',
        winner: 'blue',
        actions: [pick('blue', 'b3', 7), pick('red', 'a3', 8)]
    }),
    game({
        gameId: 'S1G3', matchId: 'S1', gameNumber: 3, tournament: 'T-A', blue: 'Alpha', red: 'Beta',
        winner: 'blue',
        actions: [pick('blue', 'a4', 7), pick('red', 'b4', 8)]
    }),
    // S2 — re-pick de x (pické G1 par Gamma, re-pické G2 par Delta) + un pick non résolu ('').
    game({
        gameId: 'S2G1', matchId: 'S2', gameNumber: 1, tournament: 'T-B', blue: 'Gamma', red: 'Delta',
        winner: 'blue',
        actions: [pick('blue', 'g1', 7), pick('blue', 'x', 10), pick('red', 'd1', 8)]
    }),
    game({
        gameId: 'S2G2', matchId: 'S2', gameNumber: 2, tournament: 'T-B', blue: 'Delta', red: 'Gamma',
        winner: 'blue',
        actions: [pick('blue', 'x', 7), pick('blue', 'd2', 10), pick('red', 'g2', 8), pick('red', '', 9)]
    }),
    // S6 — re-ban d'un consommé (h1) ; le ban z9 (non consommé) ne compte pas.
    game({
        gameId: 'S6G1', matchId: 'S6', gameNumber: 1, tournament: 'T-A', blue: 'Hotel', red: 'India',
        winner: 'blue',
        actions: [pick('blue', 'h1', 7), pick('red', 'i1', 8)]
    }),
    game({
        gameId: 'S6G2', matchId: 'S6', gameNumber: 2, tournament: 'T-A', blue: 'India', red: 'Hotel',
        winner: 'red',
        actions: [ban('blue', 'h1', 1), ban('red', 'z9', 2), pick('blue', 'i2', 7), pick('red', 'h2', 8)]
    }),
    // S10 — mono-game.
    game({
        gameId: 'S10G1', matchId: 'S10', gameNumber: 1, tournament: 'T-A', blue: 'Kappa', red: 'Lambda',
        winner: 'blue',
        actions: [pick('blue', 'k1', 7)]
    })
];

describe('reconstructSeries — reconstitution et consommation', () => {
    const { series, anomalies } = reconstructSeries(groupA);

    it('reconstruit les séries valides sans anomalie', () => {
        expect(series.map((s) => s.matchId).sort()).toEqual(['S1', 'S10', 'S2', 'S6']);
        expect(anomalies).toEqual([]);
    });

    it('série propre : games triées, équipes, zéro re-pick/re-ban', () => {
        const s1 = byId(series, 'S1');
        expect(s1.games.map((g) => g.gameId)).toEqual(['S1G1', 'S1G2', 'S1G3']);
        expect(s1.teams).toEqual(['Alpha', 'Beta']);
        expect(s1.tournament).toBe('T-A');
        expect(s1.repickCount).toBe(0);
        expect(s1.rebanOfConsumed).toEqual([]);
    });

    it('consommation vérifiée à la main : ∪ picks résolus des DEUX camps, games < g', () => {
        const s1 = byId(series, 'S1');
        expect(consumedBeforeGame(s1, 1)).toEqual(new Set());
        expect(consumedBeforeGame(s1, 2)).toEqual(new Set(['a1', 'a2', 'b1', 'b2']));
        expect(consumedBeforeGame(s1, 3)).toEqual(new Set(['a1', 'a2', 'b1', 'b2', 'b3', 'a3']));
        expect(consumedBeforeGame(s1, 4)).toEqual(
            new Set(['a1', 'a2', 'b1', 'b2', 'b3', 'a3', 'a4', 'b4'])
        );
    });

    it('repickCount exact : x pické G1 (Gamma) puis re-pické G2 (Delta) = 1', () => {
        const s2 = byId(series, 'S2');
        expect(s2.repickCount).toBe(1);
        // Le pick non résolu ('') de S2G2 n'entre ni en consommation ni en re-pick.
        expect(consumedBeforeGame(s2, 3)).toEqual(new Set(['g1', 'x', 'd1', 'd2', 'g2']));
    });

    it('re-ban d’un consommé détecté avec gameId, ban d’un non-consommé ignoré', () => {
        const s6 = byId(series, 'S6');
        expect(s6.rebanOfConsumed).toEqual([{ gameId: 'S6G2', championKey: 'h1' }]);
        expect(s6.repickCount).toBe(0);
    });

    it('un record sans series.matchId ne forme pas de série', () => {
        const orphan: DraftRecord = {
            gameId: 'orphan',
            blueTeam: 'A',
            redTeam: 'B',
            firstPickSide: 'blue',
            orderConfidence: 'exact',
            actions: [],
            warnings: [],
            provenance: { source: 'test', fetchedAt: '2026-06-11T00:00:00Z' }
        };
        const result = reconstructSeries([...groupA, orphan]);
        expect(result.series).toHaveLength(4);
        expect(result.anomalies).toEqual([]);
    });
});

describe('reconstructSeries — anomalies (séries exclues, comptées)', () => {
    it('gameNumber troué (1,3) ⇒ anomalie gap, série exclue', () => {
        const records = [
            game({ gameId: 'S3G1', matchId: 'S3', gameNumber: 1, blue: 'A', red: 'B', actions: [] }),
            game({ gameId: 'S3G3', matchId: 'S3', gameNumber: 3, blue: 'A', red: 'B', actions: [] })
        ];
        const { series, anomalies } = reconstructSeries(records);
        expect(series).toEqual([]);
        expect(anomalies).toHaveLength(1);
        expect(anomalies[0]).toMatchObject({ matchId: 'S3', kind: 'gap' });
    });

    it('gameNumber dupliqué ⇒ anomalie duplicate-game-number', () => {
        const records = [
            game({ gameId: 'S4G1', matchId: 'S4', gameNumber: 1, blue: 'A', red: 'B', actions: [] }),
            game({ gameId: 'S4G1b', matchId: 'S4', gameNumber: 1, blue: 'A', red: 'B', actions: [] })
        ];
        const { series, anomalies } = reconstructSeries(records);
        expect(series).toEqual([]);
        expect(anomalies[0]).toMatchObject({ matchId: 'S4', kind: 'duplicate-game-number' });
    });

    it('trois noms d’équipe ⇒ anomalie teams', () => {
        const records = [
            game({ gameId: 'S5G1', matchId: 'S5', gameNumber: 1, blue: 'Alpha', red: 'Beta', actions: [] }),
            game({ gameId: 'S5G2', matchId: 'S5', gameNumber: 2, blue: 'Alpha', red: 'Echo', actions: [] })
        ];
        const { series, anomalies } = reconstructSeries(records);
        expect(series).toEqual([]);
        expect(anomalies[0]).toMatchObject({ matchId: 'S5', kind: 'teams' });
    });
});

describe('tournamentFearlessTable — TEST 0 par tournoi', () => {
    const { series } = reconstructSeries(groupA);
    const table = tournamentFearlessTable(series);

    it('compte multi-games, picks ultérieurs, re-picks, re-bans à la main', () => {
        // T-A : S1 (multi, 4 picks games 2+) + S6 (multi, 2 picks games 2+, 1 re-ban)
        //       + S10 (mono-game, ne compte pas en multi) → 2 / 6 / 0 / 1.
        // T-B : S2 → 1 multi / 3 picks résolus games 2+ (le '' ne compte pas) / 1 re-pick / 0.
        expect(table).toEqual([
            {
                tournament: 'T-A',
                multiGameSeries: 2,
                laterPicks: 6,
                repicks: 0,
                rebans: 1,
                fearlessConfirmed: true
            },
            {
                tournament: 'T-B',
                multiGameSeries: 1,
                laterPicks: 3,
                repicks: 1,
                rebans: 0,
                fearlessConfirmed: false
            }
        ]);
    });

    it('fearlessConfirmed ssi repicks === 0 (les re-bans ne disqualifient pas)', () => {
        const ta = table.find((row) => row.tournament === 'T-A');
        const tb = table.find((row) => row.tournament === 'T-B');
        expect(ta?.fearlessConfirmed).toBe(true); // 1 re-ban mais 0 re-pick
        expect(tb?.fearlessConfirmed).toBe(false); // 1 re-pick
    });
});

/*
 * Groupe B — vainqueur et format. Les victoires se comptent par ÉQUIPE (les
 * camps alternent), jamais par side.
 *  S7 (Juliet/Kilo) : 2-2 abandonnée ⇒ winner undefined.
 *  S8 (Lima/Mike)   : 3-1 ⇒ winner Lima, bo5.
 *  S9 (Nora/Oscar)  : G2 sans vainqueur ⇒ winner undefined.
 */
const groupB: DraftRecord[] = [
    game({ gameId: 'S7G1', matchId: 'S7', gameNumber: 1, blue: 'Juliet', red: 'Kilo', winner: 'blue', actions: [] }),
    game({ gameId: 'S7G2', matchId: 'S7', gameNumber: 2, blue: 'Kilo', red: 'Juliet', winner: 'blue', actions: [] }),
    game({ gameId: 'S7G3', matchId: 'S7', gameNumber: 3, blue: 'Juliet', red: 'Kilo', winner: 'blue', actions: [] }),
    game({ gameId: 'S7G4', matchId: 'S7', gameNumber: 4, blue: 'Juliet', red: 'Kilo', winner: 'red', actions: [] }),
    game({ gameId: 'S8G1', matchId: 'S8', gameNumber: 1, blue: 'Lima', red: 'Mike', winner: 'blue', actions: [] }),
    game({ gameId: 'S8G2', matchId: 'S8', gameNumber: 2, blue: 'Mike', red: 'Lima', winner: 'red', actions: [] }),
    game({ gameId: 'S8G3', matchId: 'S8', gameNumber: 3, blue: 'Mike', red: 'Lima', winner: 'blue', actions: [] }),
    game({ gameId: 'S8G4', matchId: 'S8', gameNumber: 4, blue: 'Lima', red: 'Mike', winner: 'blue', actions: [] }),
    game({ gameId: 'S9G1', matchId: 'S9', gameNumber: 1, blue: 'Nora', red: 'Oscar', winner: 'blue', actions: [] }),
    game({ gameId: 'S9G2', matchId: 'S9', gameNumber: 2, blue: 'Oscar', red: 'Nora', actions: [] })
];

describe('seriesWinner / inferFormat — contrats gelés', () => {
    const { series } = reconstructSeries([...groupA, ...groupB]);

    it('2-1 et 2-0 ⇒ vainqueur strict + bo3', () => {
        const s1 = byId(series, 'S1'); // Alpha 2-1 (G1 blue, G2 blue=Beta, G3 blue)
        expect(seriesWinner(s1)).toBe('Alpha');
        expect(inferFormat(s1)).toBe('bo3');
        const s6 = byId(series, 'S6'); // Hotel 2-0 (G1 blue, G2 red — camps alternés)
        expect(seriesWinner(s6)).toBe('Hotel');
        expect(inferFormat(s6)).toBe('bo3');
    });

    it('3-1 ⇒ bo5, vainqueur au compte par équipe malgré les swaps de side', () => {
        const s8 = byId(series, 'S8');
        expect(seriesWinner(s8)).toBe('Lima');
        expect(inferFormat(s8)).toBe('bo5');
    });

    it('Bo2 1-1 : égalité de maxWins ⇒ winner undefined, format undefined', () => {
        const s2 = byId(series, 'S2'); // Gamma 1 - Delta 1
        expect(seriesWinner(s2)).toBeUndefined();
        expect(inferFormat(s2)).toBeUndefined();
    });

    it('série 2-2 abandonnée : égalité ⇒ winner undefined (exclue de S3)', () => {
        const s7 = byId(series, 'S7'); // Juliet 2 - Kilo 2
        expect(seriesWinner(s7)).toBeUndefined();
        // Contrat littéral gelé : maxWins 2 ⇒ bo3 — l'exclusion des séries
        // ambiguës est portée par seriesWinner (undefined), pas par le format.
        expect(inferFormat(s7)).toBe('bo3');
    });

    it('une game sans vainqueur ⇒ winner undefined (maxWins 1 ⇒ format undefined)', () => {
        const s9 = byId(series, 'S9');
        expect(seriesWinner(s9)).toBeUndefined();
        expect(inferFormat(s9)).toBeUndefined();
    });

    it('mono-game 1-0 : maxWins 1 ⇒ format undefined, vainqueur défini', () => {
        const s10 = byId(series, 'S10');
        expect(seriesWinner(s10)).toBe('Kappa');
        expect(inferFormat(s10)).toBeUndefined();
    });
});
