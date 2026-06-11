import { describe, expect, it } from 'vitest';
import {
    fitTeamDemand,
    leagueTop5,
    predictGamePicks,
    presenceTop5,
    wantProbabilityOf
} from '$lib/estimators/seriesDemand';
import type { DraftAction, DraftRecord, DraftSide } from '$lib/data/types';
import { Role } from '$lib/types';

/*
 * Tous les nombres attendus sont calculés À LA MAIN depuis la règle gelée
 * (docs/run2/C-fearless-g3.md §1.1) :
 *   masse_T(c, r) = Σ 0,9^âge_semaines + 5 · P_ligue(c | r)
 * avec les défauts doctrine §6.5 (α = 5, λ = 0,9, poids 1 si non daté,
 * âge clampé ≥ 0 — recencyWeight de $lib/aggregates/tendency.ts réutilisé).
 */

const NOW = '2026-06-10T00:00:00Z';

function pick(side: DraftSide, championKey: string, role: Role, seq: number): DraftAction {
    return { seq, type: 'pick', phase: 'pick1', side, championKey, championName: championKey, role };
}

function game(over: {
    gameId: string;
    date?: string;
    blue: string;
    red: string;
    actions: DraftAction[];
}): DraftRecord {
    const record: DraftRecord = {
        gameId: over.gameId,
        blueTeam: over.blue,
        redTeam: over.red,
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions: over.actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-11T00:00:00Z' }
    };
    if (over.date !== undefined) record.date = over.date;
    return record;
}

/*
 * Fixture A — 3 records datés, λ = 0,9, rôle Top uniquement.
 * Ligue Top (5 picks) : a×2, b×2, x×1 → P = 0,4 / 0,4 / 0,2.
 * Évidence T1 : a @ 0 sem (poids 1) + a @ 1 sem (0,9) ; b @ 2 sem (0,81).
 *   masse(a) = 1 + 0,9 + 5·0,4 = 3,9
 *   masse(b) = 0,81 + 5·0,4 = 2,81
 *   masse(x) = 0     + 5·0,2 = 1,0
 */
const fixtureA: DraftRecord[] = [
    game({
        gameId: 'A1', date: '2026-06-10T00:00:00Z', blue: 'T1', red: 'O1',
        actions: [pick('blue', 'a', Role.Top, 7), pick('red', 'x', Role.Top, 8)]
    }),
    game({
        gameId: 'A2', date: '2026-06-03T00:00:00Z', blue: 'T1', red: 'O2',
        actions: [pick('blue', 'a', Role.Top, 7), pick('red', 'b', Role.Top, 8)]
    }),
    game({
        gameId: 'A3', date: '2026-05-27T00:00:00Z', blue: 'T1', red: 'O3',
        actions: [pick('blue', 'b', Role.Top, 7)]
    })
];

describe('fitTeamDemand — masses au chiffre (0,9^âge + 5·prior)', () => {
    const surface = fitTeamDemand(fixtureA, { team: 'T1', now: NOW });

    it('masses gelées : 3,9 / 2,81 / 1,0 — triées masse desc', () => {
        const top = surface.byRole.get(Role.Top) ?? [];
        expect(top.map((e) => e.championKey)).toEqual(['a', 'b', 'x']);
        expect(top[0].mass).toBeCloseTo(3.9, 12);
        expect(top[1].mass).toBeCloseTo(2.81, 12);
        expect(top[2].mass).toBeCloseTo(1.0, 12);
    });

    it('teamRawCount, leaguePrior et comptes bruts exacts', () => {
        const top = surface.byRole.get(Role.Top) ?? [];
        expect(top.map((e) => e.teamRawCount)).toEqual([2, 1, 0]);
        expect(top.map((e) => e.leaguePrior)).toEqual([0.4, 0.4, 0.2]);
        expect(surface.teamCounts.get('a')).toBe(2);
        expect(surface.teamCounts.get('b')).toBe(1);
        expect(surface.teamCounts.has('x')).toBe(false);
        expect(surface.leagueCounts.get('a')).toBe(2);
        expect(surface.leagueCounts.get('b')).toBe(2);
        expect(surface.leagueCounts.get('x')).toBe(1);
    });

    it('un train vide produit une surface vide et des prédictions vides', () => {
        const empty = fitTeamDemand([], { team: 'T1', now: NOW });
        expect(empty.byRole.size).toBe(0);
        expect(predictGamePicks(empty, new Set())).toEqual([]);
        expect(presenceTop5(empty, new Set())).toEqual([]);
        expect(leagueTop5(empty, new Set())).toEqual([]);
        expect(wantProbabilityOf(empty, 'a', new Set())).toBe(0);
    });
});

/*
 * Fixture B — LE cas qui distingue les deux lectures de l'ordre des rôles.
 * Records non datés (poids 1). Rôles : Top, Jungle, Middle.
 * Ligue : Top {f×1} → P(f|Top)=1 ; Jungle {f×3, g×3, y2×3} → P=1/3 chacun ;
 * Middle {g×2, z2×2} → P=1/2 chacun.
 * Évidence T : f@Top 1, f@Jng 3, g@Jng 2, y2@Jng 1, g@Mid 2.
 *   masse(f,Top) = 1 + 5      = 6
 *   masse(f,Jng) = 3 + 5/3    ≈ 4,6667
 *   masse(g,Jng) = 2 + 5/3    ≈ 3,6667
 *   masse(y2,Jng)= 1 + 5/3    ≈ 2,6667
 *   masse(g,Mid) = 2 + 5/2    = 4,5
 *   masse(z2,Mid)= 0 + 5/2    = 2,5
 * Têtes AVANT greedy : Top 6 > Jungle 4,6667 > Mid 4,5 → ordre Top, Jng, Mid.
 *  - Lecture gelée (têtes figées) : Top→f ; Jng (f retenu)→g ; Mid (g retenu)→z2.
 *  - Lecture réordonnée (têtes recalculées après chaque retenue) : après f,
 *    tête Jng tombe à 3,6667 < tête Mid 4,5 → Mid→g puis Jng→y2 : ['f','g','y2'].
 * Le test verrouille la PREMIÈRE : ['f','g','z2'].
 */
const fixtureB: DraftRecord[] = [
    game({
        gameId: 'B1', blue: 'T', red: 'O1',
        actions: [
            pick('blue', 'f', Role.Jungle, 7), pick('blue', 'g', Role.Middle, 10),
            pick('red', 'y2', Role.Jungle, 8), pick('red', 'z2', Role.Middle, 9)
        ]
    }),
    game({
        gameId: 'B2', blue: 'T', red: 'O2',
        actions: [
            pick('blue', 'f', Role.Jungle, 7), pick('blue', 'g', Role.Middle, 10),
            pick('red', 'y2', Role.Jungle, 8), pick('red', 'z2', Role.Middle, 9)
        ]
    }),
    game({
        gameId: 'B3', blue: 'T', red: 'O3',
        actions: [pick('blue', 'f', Role.Jungle, 7), pick('red', 'g', Role.Jungle, 8)]
    }),
    game({
        gameId: 'B4', blue: 'T', red: 'O4',
        actions: [pick('blue', 'f', Role.Top, 7), pick('blue', 'g', Role.Jungle, 10)]
    }),
    game({ gameId: 'B5', blue: 'T', red: 'O5', actions: [pick('blue', 'g', Role.Jungle, 7)] }),
    game({ gameId: 'B6', blue: 'T', red: 'O6', actions: [pick('blue', 'y2', Role.Jungle, 7)] })
];

describe('predictGamePicks — greedy gelé (têtes figées avant le greedy)', () => {
    const surface = fitTeamDemand(fixtureB, { team: 'T', now: NOW });

    it('masses de la fixture vérifiées au chiffre', () => {
        const topF = (surface.byRole.get(Role.Top) ?? [])[0];
        expect(topF.championKey).toBe('f');
        expect(topF.mass).toBeCloseTo(6, 12);
        const jungle = surface.byRole.get(Role.Jungle) ?? [];
        expect(jungle.map((e) => e.championKey)).toEqual(['f', 'g', 'y2']);
        expect(jungle[0].mass).toBeCloseTo(3 + 5 / 3, 12);
        expect(jungle[1].mass).toBeCloseTo(2 + 5 / 3, 12);
        expect(jungle[2].mass).toBeCloseTo(1 + 5 / 3, 12);
        const middle = surface.byRole.get(Role.Middle) ?? [];
        expect(middle.map((e) => e.championKey)).toEqual(['g', 'z2']);
        expect(middle[0].mass).toBeCloseTo(4.5, 12);
        expect(middle[1].mass).toBeCloseTo(2.5, 12);
    });

    it('verrouille la lecture gelée : les retenus ne réordonnent pas les rôles', () => {
        const picks = predictGamePicks(surface, new Set());
        // Lecture gelée → ['f','g','z2'] ; lecture réordonnée → ['f','g','y2'].
        expect(picks).toEqual(['f', 'g', 'z2']);
        expect(picks).not.toContain('y2');
    });

    it('distinctness inter-rôles : f (flex Top/Jungle) ne sort qu’une fois', () => {
        const picks = predictGamePicks(surface, new Set());
        expect(new Set(picks).size).toBe(picks.length);
        expect(picks.filter((key) => key === 'f')).toHaveLength(1);
    });

    it('les têtes excluent les consommés ; rôle vidé ⇒ emplacement vide', () => {
        // f consommé : Top n'a plus de candidat (emplacement vide) ; têtes
        // restantes Mid 4,5 > Jng 3,6667 → Mid→g puis Jng→y2.
        const picks = predictGamePicks(surface, new Set(['f']));
        expect(picks).toEqual(['g', 'y2']);
    });
});

/*
 * Fixture C — égalité de masses de tête ⇒ ordre canonique ROLES.
 * Non daté. Bottom {h (T)×1, b2×1} et Support {h (T)×1, s2×1} : P = 1/2
 * partout → tête Bottom = tête Support = 1 + 2,5 = 3,5 (h flex des deux).
 * Canonique : Bottom avant Support → Bottom→h, Support→s2.
 * (Ordre inverse ⇒ ['h','b2'].)
 */
const fixtureC: DraftRecord[] = [
    game({
        gameId: 'C1', blue: 'T', red: 'O1',
        actions: [pick('blue', 'h', Role.Bottom, 7), pick('red', 'b2', Role.Bottom, 8)]
    }),
    game({
        gameId: 'C2', blue: 'T', red: 'O2',
        actions: [pick('blue', 'h', Role.Support, 7), pick('red', 's2', Role.Support, 8)]
    })
];

describe('predictGamePicks — égalité de têtes ⇒ ordre canonique ROLES', () => {
    it('Bottom passe avant Support à têtes égales', () => {
        const surface = fitTeamDemand(fixtureC, { team: 'T', now: NOW });
        expect(predictGamePicks(surface, new Set())).toEqual(['h', 's2']);
    });
});

/*
 * Fixture D — tie-breaks dans un rôle : équipe desc → ligue desc → clé asc.
 * Middle (5 picks ligue) : m1 (T)×1, m2×2, zz×2 → P = 0,2 / 0,4 / 0,4.
 *   masse(m1) = 1 + 1 = 2 ; masse(m2) = 0 + 2 = 2 ; masse(zz) = 0 + 2 = 2.
 * Trois masses égales : m1 gagne au compte brut équipe (1 > 0) ; m2 et zz à
 * égalité parfaite (équipe 0, ligue globale 2) ⇒ clé asc : m2 < zz.
 */
const fixtureD: DraftRecord[] = [
    game({
        gameId: 'D1', blue: 'T', red: 'O1',
        actions: [pick('blue', 'm1', Role.Middle, 7), pick('red', 'zz', Role.Middle, 8)]
    }),
    game({
        gameId: 'D2', blue: 'O2', red: 'O3',
        actions: [pick('blue', 'm2', Role.Middle, 7), pick('red', 'zz', Role.Middle, 8)]
    }),
    game({ gameId: 'D3', blue: 'O4', red: 'O5', actions: [pick('blue', 'm2', Role.Middle, 7)] })
];

describe('tie-breaks du greedy (équipe → ligue → clé)', () => {
    const surface = fitTeamDemand(fixtureD, { team: 'T', now: NOW });

    it('à masses égales, le compte brut équipe départage puis la clé', () => {
        const middle = surface.byRole.get(Role.Middle) ?? [];
        expect(middle.map((e) => e.mass)).toEqual([2, 2, 2]);
        expect(middle.map((e) => e.championKey)).toEqual(['m1', 'm2', 'zz']);
        expect(predictGamePicks(surface, new Set())).toEqual(['m1']);
    });

    it('le compte ligue du tie-break est GLOBAL (tous rôles), pas par rôle', () => {
        // Bottom : k2 et k1 à 1 pick chacun (P = 1/2, masses 2,5, équipe 0) ;
        // k2 a en plus 1 pick ligue au Support → ligue globale k2=2 > k1=1.
        // La clé asc dirait k1 d'abord — le compte ligue global doit primer.
        const fixtureE: DraftRecord[] = [
            game({
                gameId: 'E1', blue: 'O1', red: 'O2',
                actions: [pick('blue', 'k2', Role.Bottom, 7), pick('red', 'k1', Role.Bottom, 8)]
            }),
            game({ gameId: 'E2', blue: 'O3', red: 'O4', actions: [pick('blue', 'k2', Role.Support, 7)] })
        ];
        const surfaceE = fitTeamDemand(fixtureE, { team: 'T', now: NOW });
        const bottom = surfaceE.byRole.get(Role.Bottom) ?? [];
        expect(bottom.map((e) => e.mass)).toEqual([2.5, 2.5]);
        expect(bottom.map((e) => e.championKey)).toEqual(['k2', 'k1']);
    });
});

describe('presenceTop5 (B1) et leagueTop5 (B0)', () => {
    const surface = fitTeamDemand(fixtureB, { team: 'T', now: NOW });

    it('B1 : compte brut équipe desc, égalité ⇒ ligue desc → clé asc', () => {
        // Équipe T : f=4 (1 Top + 3 Jng), g=4 (2 Jng + 2 Mid), y2=1, z2=0.
        // Ligue globale : f=4, g=5, y2=3, z2=2 → g devant f à équipe égale.
        expect(presenceTop5(surface, new Set())).toEqual(['g', 'f', 'y2', 'z2']);
    });

    it('B1 : consommés exclus', () => {
        expect(presenceTop5(surface, new Set(['g']))).toEqual(['f', 'y2', 'z2']);
    });

    it('B1 dégénère au classement ligue pour une équipe inconnue du train', () => {
        const unknown = fitTeamDemand(fixtureB, { team: 'INCONNUE', now: NOW });
        expect(unknown.teamCounts.size).toBe(0);
        expect(presenceTop5(unknown, new Set())).toEqual(leagueTop5(unknown, new Set()));
        expect(presenceTop5(unknown, new Set())).toEqual(['g', 'f', 'y2', 'z2']);
    });

    it('B0 : compte du train entier desc, clé asc en égalité', () => {
        // Fixture A : a=2, b=2, x=1 → a avant b par clé asc.
        const surfaceA = fitTeamDemand(fixtureA, { team: 'T1', now: NOW });
        expect(leagueTop5(surfaceA, new Set())).toEqual(['a', 'b', 'x']);
        expect(leagueTop5(surfaceA, new Set(['a']))).toEqual(['b', 'x']);
    });
});

describe('wantProbabilityOf — masse renormalisée sur les non-consommés du rôle', () => {
    const surfaceA = fitTeamDemand(fixtureA, { team: 'T1', now: NOW });
    const surfaceB = fitTeamDemand(fixtureB, { team: 'T', now: NOW });

    it('sans consommation : masse / Σ masses du rôle', () => {
        // Top : 3,9 / (3,9 + 2,81 + 1,0) = 3,9 / 7,71.
        expect(wantProbabilityOf(surfaceA, 'a', new Set())).toBeCloseTo(3.9 / 7.71, 12);
    });

    it('renormalisée après consommation d’un candidat du rôle', () => {
        // b consommé : 3,9 / (3,9 + 1,0).
        expect(wantProbabilityOf(surfaceA, 'a', new Set(['b']))).toBeCloseTo(3.9 / 4.9, 12);
    });

    it('0 si consommé, 0 si inconnu', () => {
        expect(wantProbabilityOf(surfaceA, 'a', new Set(['a']))).toBe(0);
        expect(wantProbabilityOf(surfaceA, 'inconnu', new Set())).toBe(0);
    });

    it('max sur les rôles où le champion apparaît (flex)', () => {
        // f : Top 6/6 = 1 ; Jungle 4,6667/11 — max = 1.
        expect(wantProbabilityOf(surfaceB, 'f', new Set())).toBeCloseTo(1, 12);
        // g : Jungle 3,6667/11 ≈ 0,333 ; Middle 4,5/7 ≈ 0,643 — max = 4,5/7.
        expect(wantProbabilityOf(surfaceB, 'g', new Set())).toBeCloseTo(4.5 / 7, 12);
    });
});
