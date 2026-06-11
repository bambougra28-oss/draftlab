/**
 * G — Tests d'intégrité Bo (leçon Nasus). RÈGLE DE LA RUN : chaque nombre
 * attendu ci-dessous est calculé À LA MAIN depuis la spec gelée (jamais copié
 * d'une exécution) — les dérivations sont en commentaire au-dessus de chaque
 * cas. Fixtures 100 % synthétiques.
 */
import { describe, it, expect } from 'vitest';
import {
    validateBoIntegrity,
    countFreshRecords,
    isStructuralBoViolation,
    STRUCTURAL_BO_VIOLATION_KINDS
} from '$lib/data/boIntegrity';
import type { DraftRecord } from '$lib/data/types';

function game(opts: {
    matchId?: string;
    n?: number;
    blue: string;
    red: string;
    winner?: 'blue' | 'red';
    id?: string;
    date?: string;
    noSeries?: boolean;
}): DraftRecord {
    return {
        gameId: opts.id ?? `${opts.matchId}_${opts.n}`,
        blueTeam: opts.blue,
        redTeam: opts.red,
        winner: opts.winner,
        date: opts.date,
        series: opts.noSeries
            ? undefined
            : { gameNumber: opts.n ?? 1, matchId: opts.matchId },
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions: [],
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-11T00:00:00Z' }
    };
}

describe('validateBoIntegrity — séries saines (aucune violation)', () => {
    it('Bo5 sain 3-1 avec alternance de sides : la série s\'arrête au clinch', () => {
        // X gagne G1 (blue), G3 (blue), G4 (red) ; Y gagne G2 (blue).
        // Tally final : X=3, Y=1 → maxWins=3 unique → Bo5, clinch à G4 = dernière
        // game, vainqueur de la dernière = X = leader → 0 violation.
        const records = [
            game({ matchId: 'm-sain', n: 1, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-sain', n: 2, blue: 'Y', red: 'X', winner: 'blue' }),
            game({ matchId: 'm-sain', n: 3, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-sain', n: 4, blue: 'Y', red: 'X', winner: 'red' })
        ];
        expect(validateBoIntegrity(records)).toEqual([]);
    });

    it('Bo3 2-0 sain (indistinguable d\'un Bo2 2-0 : clinch à la dernière game)', () => {
        // X=2, Y=0 → maxWins=2 unique → Bo3 inféré, clinch à G2 = dernière → 0.
        const records = [
            game({ matchId: 'm-20', n: 1, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-20', n: 2, blue: 'Y', red: 'X', winner: 'red' })
        ];
        expect(validateBoIntegrity(records)).toEqual([]);
    });

    it('Bo5 3-2 sain : le decider est la dernière game et le leader la gagne', () => {
        // X,Y,X,Y,X → X=3, Y=2 → clinch à G5 = dernière → 0 violation.
        const records = [
            game({ matchId: 'm-32', n: 1, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-32', n: 2, blue: 'X', red: 'Y', winner: 'red' }),
            game({ matchId: 'm-32', n: 3, blue: 'Y', red: 'X', winner: 'red' }),
            game({ matchId: 'm-32', n: 4, blue: 'Y', red: 'X', winner: 'blue' }),
            game({ matchId: 'm-32', n: 5, blue: 'X', red: 'Y', winner: 'blue' })
        ];
        expect(validateBoIntegrity(records)).toEqual([]);
    });

    it('Bo2 1-1 sain (légitime en LCK/LEC/LPL 2026) : maxWins=1 → aucune conclusion', () => {
        // X=1, Y=1 → maxWins=1 ∉ {2,3} → format non inférable → 0 violation.
        const records = [
            game({ matchId: 'm-bo2', n: 1, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-bo2', n: 2, blue: 'Y', red: 'X', winner: 'blue' })
        ];
        expect(validateBoIntegrity(records)).toEqual([]);
    });

    it('Bo1 : une seule game, rien à conclure', () => {
        const records = [game({ matchId: 'm-bo1', n: 1, blue: 'X', red: 'Y', winner: 'red' })];
        expect(validateBoIntegrity(records)).toEqual([]);
    });

    it('série 2-2 abandonnée : DEUX équipes au maxWins → prudence, aucune conclusion', () => {
        // X,Y,X,Y → X=2 et Y=2 → détenteur du maxWins non unique → la cible du
        // format « décidé » n'est jamais atteinte → 0 violation clinch/decider.
        const records = [
            game({ matchId: 'm-22', n: 1, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-22', n: 2, blue: 'X', red: 'Y', winner: 'red' }),
            game({ matchId: 'm-22', n: 3, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-22', n: 4, blue: 'X', red: 'Y', winner: 'red' })
        ];
        expect(validateBoIntegrity(records)).toEqual([]);
    });

    it('série 4-1 : maxWins=4 ∉ {2,3} → format non inférable, aucune conclusion (borne gelée)', () => {
        // X,X,Y,X,X → X=4 → hors {2,3} : la règle gelée ne conclut pas (prudence :
        // on ne devine pas un format au-delà de bo3/bo5). 0 violation.
        const records = [
            game({ matchId: 'm-41', n: 1, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-41', n: 2, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-41', n: 3, blue: 'X', red: 'Y', winner: 'red' }),
            game({ matchId: 'm-41', n: 4, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-41', n: 5, blue: 'X', red: 'Y', winner: 'blue' })
        ];
        expect(validateBoIntegrity(records)).toEqual([]);
    });
});

describe('validateBoIntegrity — le cas Nasus (finale LEC, pull du 10 juin 2026)', () => {
    // Forme exacte du corpus corrompu : X gagne G1, G2, G4 ; Y gagne G3 — la
    // série est pliée 3-1 après G4 — PUIS une G5 existe, gagnée par Y.
    // Tally final : X=3, Y=2 → maxWins=3 unique → Bo5, cible 3 atteinte à G4.
    const nasus = [
        game({ matchId: 'nasus', n: 1, blue: 'X', red: 'Y', winner: 'blue' }),
        game({ matchId: 'nasus', n: 2, blue: 'Y', red: 'X', winner: 'red' }),
        game({ matchId: 'nasus', n: 3, blue: 'X', red: 'Y', winner: 'red' }),
        game({ matchId: 'nasus', n: 4, blue: 'Y', red: 'X', winner: 'red' }),
        game({ matchId: 'nasus', n: 5, blue: 'X', red: 'Y', winner: 'red' })
    ];

    it('G5 jouée après le clinch 3-1 → game-after-clinch sur G5', () => {
        const violations = validateBoIntegrity(nasus);
        const afterClinch = violations.filter((v) => v.kind === 'game-after-clinch');
        // Une seule game après le clinch (G5) → exactement 1 violation de ce kind.
        expect(afterClinch).toHaveLength(1);
        expect(afterClinch[0]).toMatchObject({
            matchId: 'nasus',
            gameId: 'nasus_5',
            kind: 'game-after-clinch'
        });
        expect(afterClinch[0].detailFr).toContain('Bo5');
        expect(afterClinch[0].detailFr).toContain('pliée');
    });

    it('variante : vainqueur de la dernière game ≠ équipe au maxWins → decider-winner-mismatch', () => {
        // Dernière game = G5, vainqueur Y ≠ X (équipe au maxWins=3).
        const violations = validateBoIntegrity(nasus);
        const decider = violations.filter((v) => v.kind === 'decider-winner-mismatch');
        expect(decider).toHaveLength(1);
        expect(decider[0]).toMatchObject({
            matchId: 'nasus',
            gameId: 'nasus_5',
            kind: 'decider-winner-mismatch'
        });
        expect(decider[0].detailFr).toContain('structurellement impossible');
    });

    it('au total : exactement 2 violations, toutes deux sur la G5', () => {
        const violations = validateBoIntegrity(nasus);
        expect(violations).toHaveLength(2);
        expect(violations.map((v) => v.gameId)).toEqual(['nasus_5', 'nasus_5']);
        expect(violations.map((v) => v.kind).sort()).toEqual([
            'decider-winner-mismatch',
            'game-after-clinch'
        ]);
    });

    it('contre-variante 4-1 : G5 gagnée par le leader → maxWins=4, silence (règle gelée)', () => {
        // Même série mais G5 gagnée par X : X=4 → hors {2,3} → 0 violation.
        const variant = [...nasus.slice(0, 4), game({ matchId: 'nasus', n: 5, blue: 'X', red: 'Y', winner: 'blue' })];
        expect(validateBoIntegrity(variant)).toEqual([]);
    });
});

describe('validateBoIntegrity — violations de séquence', () => {
    it('gap : numéros 1,2,4 → une violation gap sur la game 4, et AUCUNE conclusion clinch', () => {
        // Distincts [1,2,4] ≠ [1,2,3] → gap (manquant : 3), porté par la game n°4.
        // Garde-fou : sans lui, X=2 unique → bo3 inféré, clinch à G2, la game 4
        // serait flaggée after-clinch + decider (Y ≠ X). La séquence trouée n'est
        // pas fiable → exactement 1 violation, de kind 'gap'.
        const records = [
            game({ matchId: 'm-gap', n: 1, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-gap', n: 2, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-gap', n: 4, blue: 'X', red: 'Y', winner: 'red' })
        ];
        const violations = validateBoIntegrity(records);
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
            matchId: 'm-gap',
            gameId: 'm-gap_4',
            kind: 'gap'
        });
        expect(violations[0].detailFr).toContain('manquants : 3');
    });

    it('doublon : numéros 1,2,2 → duplicate-game-number sur le second porteur, sans cascade', () => {
        // Le numéro 2 est porté par dup_2a (premier vu) puis dup_2b → 1 violation
        // sur dup_2b. Distincts {1,2} contigus → pas de gap. Garde-fou : pas de
        // conclusion clinch/decider sur une séquence dupliquée → total = 1.
        const records = [
            game({ matchId: 'm-dup', n: 1, blue: 'X', red: 'Y', winner: 'blue', id: 'dup_1' }),
            game({ matchId: 'm-dup', n: 2, blue: 'X', red: 'Y', winner: 'blue', id: 'dup_2a' }),
            game({ matchId: 'm-dup', n: 2, blue: 'Y', red: 'X', winner: 'blue', id: 'dup_2b' })
        ];
        const violations = validateBoIntegrity(records);
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
            matchId: 'm-dup',
            gameId: 'dup_2b',
            kind: 'duplicate-game-number'
        });
        expect(violations[0].detailFr).toContain('dup_2a');
    });

    it('teams-changed : une 3e équipe apparaît en G2 → violation sur la G2', () => {
        // Union après G1 = {X,Y} ; G2 ajoute Z → 3 équipes → 1 violation sur G2.
        const records = [
            game({ matchId: 'm-3t', n: 1, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-3t', n: 2, blue: 'X', red: 'Z', winner: 'blue' })
        ];
        const violations = validateBoIntegrity(records);
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
            matchId: 'm-3t',
            gameId: 'm-3t_2',
            kind: 'teams-changed'
        });
    });

    it('teams-changed dégénéré : la même équipe sur les deux sides', () => {
        const records = [game({ matchId: 'm-1t', n: 1, blue: 'X', red: 'X', winner: 'blue' })];
        const violations = validateBoIntegrity(records);
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
            matchId: 'm-1t',
            gameId: 'm-1t_1',
            kind: 'teams-changed'
        });
    });

    it('winner-unknown : descriptif, et bloque toute conclusion clinch/decider', () => {
        // G2 sans vainqueur → 1 violation winner-unknown sur G2, et comme les
        // tallies sont incomplets, aucune autre conclusion → total = 1.
        const records = [
            game({ matchId: 'm-wu', n: 1, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-wu', n: 2, blue: 'Y', red: 'X' })
        ];
        const violations = validateBoIntegrity(records);
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
            matchId: 'm-wu',
            gameId: 'm-wu_2',
            kind: 'winner-unknown'
        });
    });
});

describe('validateBoIntegrity — groupement et périmètre', () => {
    it('séries entrelacées + records hors série : seules les violations du cas Nasus sortent', () => {
        // Entrelace le cas Nasus (2 violations attendues, cf. ci-dessus) avec un
        // Bo2 1-1 sain (0), un record sans `series` (ignoré) et un record avec
        // `series` sans matchId (ignoré) → total = 2, toutes sur 'nasus'.
        const records = [
            game({ matchId: 'nasus', n: 1, blue: 'X', red: 'Y', winner: 'blue' }),
            game({ matchId: 'm-bo2', n: 1, blue: 'A', red: 'B', winner: 'blue' }),
            game({ matchId: 'nasus', n: 2, blue: 'Y', red: 'X', winner: 'red' }),
            game({ matchId: 'm-bo2', n: 2, blue: 'B', red: 'A', winner: 'blue' }),
            game({ matchId: 'nasus', n: 3, blue: 'X', red: 'Y', winner: 'red' }),
            game({ matchId: 'nasus', n: 4, blue: 'Y', red: 'X', winner: 'red' }),
            game({ matchId: 'nasus', n: 5, blue: 'X', red: 'Y', winner: 'red' }),
            game({ blue: 'C', red: 'D', winner: 'blue', id: 'solo-1', noSeries: true }),
            game({ n: 1, blue: 'E', red: 'F', winner: 'red', id: 'solo-2' })
        ];
        const violations = validateBoIntegrity(records);
        expect(violations).toHaveLength(2);
        expect(violations.every((v) => v.matchId === 'nasus')).toBe(true);
    });

    it('corpus vide → aucune violation', () => {
        expect(validateBoIntegrity([])).toEqual([]);
    });
});

describe('kinds structurels vs descriptifs', () => {
    it('les 5 kinds structurels font échouer un gate, winner-unknown non', () => {
        expect([...STRUCTURAL_BO_VIOLATION_KINDS].sort()).toEqual([
            'decider-winner-mismatch',
            'duplicate-game-number',
            'game-after-clinch',
            'gap',
            'teams-changed'
        ]);
        expect(isStructuralBoViolation('game-after-clinch')).toBe(true);
        expect(isStructuralBoViolation('winner-unknown')).toBe(false);
    });
});

describe('countFreshRecords — doctrine de quarantaine fraîcheur', () => {
    // now = 2026-06-11T00:00:00Z ; withinDays=3 → seuil strict 259 200 000 ms.
    const now = Date.parse('2026-06-11T00:00:00Z');
    const records = [
        // âge 86 400 000 ms < seuil → frais
        game({ matchId: 'f', n: 1, blue: 'X', red: 'Y', winner: 'blue', date: '2026-06-10T00:00:00Z', id: 'f1' }),
        // âge 259 199 000 ms < seuil → frais
        game({ matchId: 'f', n: 2, blue: 'X', red: 'Y', winner: 'blue', date: '2026-06-08T00:00:01Z', id: 'f2' }),
        // âge exactement 259 200 000 ms : « moins de 3 jours » est STRICT → pas frais
        game({ matchId: 'f', n: 3, blue: 'X', red: 'Y', winner: 'blue', date: '2026-06-08T00:00:00Z', id: 'f3' }),
        // vieux → pas frais
        game({ matchId: 'f', n: 4, blue: 'X', red: 'Y', winner: 'blue', date: '2026-06-01T00:00:00Z', id: 'f4' }),
        // sans date → pas compté
        game({ matchId: 'f', n: 5, blue: 'X', red: 'Y', winner: 'blue', id: 'f5' }),
        // date FUTURE (âge négatif) → suspecte, comptée côté quarantaine
        game({ matchId: 'f', n: 6, blue: 'X', red: 'Y', winner: 'blue', date: '2026-06-12T00:00:00Z', id: 'f6' }),
        // date illisible → pas comptée
        game({ matchId: 'f', n: 7, blue: 'X', red: 'Y', winner: 'blue', date: 'n/a', id: 'f7' })
    ];

    it('compte 3 records frais à 3 jours (borne stricte, futur inclus, sans-date exclu)', () => {
        // f1 + f2 + f6 = 3 (calcul à la main ci-dessus).
        expect(countFreshRecords(records, 3, now)).toBe(3);
    });

    it('à 0 jour, seules les dates futures restent suspectes', () => {
        // Seuil 0 : seul f6 (âge négatif) satisfait now − date < 0 → 1.
        expect(countFreshRecords(records, 0, now)).toBe(1);
    });

    it('corpus vide → 0', () => {
        expect(countFreshRecords([], 3, now)).toBe(0);
    });
});
