/**
 * Chantier « génération automatique de la prépa » — tests de
 * `$lib/strategic/planGenerator` (+ le helper hasChallenges de planDrill).
 *
 * Tout est calculé À LA MAIN avec des seams jouets déterministes, sur le
 * template bleu-premier : ourSide = blue ⇒ nos bans aux seq 1,3,5,14,16 et
 * nos picks aux seq 7,10,11,18,19 ; l'adversaire (rouge) agit aux seq
 * 2,4,6,8,9,12,13,15,17,20.
 */
import { describe, it, expect } from 'vitest';
import {
    generatePrepPlan,
    SELF_PLAY_LABEL_FR,
    type GeneratedCandidate,
    type PrepGeneratorContext
} from '$lib/strategic/planGenerator';
import { compilePlanTree } from '$lib/strategic/planTree';
import { hasChallenges, startDrill } from '$lib/strategic/planDrill';
import type { EnemyDistributionEntry, NavigatorSlot } from '$lib/strategic/draftNavigator';
import type { RolePriors } from '$lib/strategic/fogReveal';
import type { DraftPlan } from '$lib/storage/draftPlans';
import { Role } from '$lib/types';

// ---- seams jouets --------------------------------------------------------------------

/** Pool jouet : nos candidats, leurs réponses, et des clés de réserve. */
const POOL = [
    'Z', 'Y', 'X', 'W', 'V',
    'P1', 'P2', 'P3', 'P4', 'P5',
    'F1', 'F2', 'F3', 'F4', 'F5',
    'e2', 'e4', 'e6', 'e8', 'e9', 'e12', 'e13', 'e15', 'e17', 'e20',
    'spare1', 'spare2'
];

/** Répondeur par seq — déterministe, ignore l'état (les tests le veulent). */
function replyBySeq(table: Record<number, GeneratedCandidate[]>) {
    return (_state: unknown, slot: NavigatorSlot): GeneratedCandidate[] => table[slot.seq] ?? [];
}

/** Distribution par seq — même convention que les tests de planTree. */
function distBySeq(table: Record<number, [string, number][]>) {
    return (_state: unknown, slot: NavigatorSlot): EnemyDistributionEntry[] =>
        (table[slot.seq] ?? []).map(([championKey, p]) => ({ championKey, p }));
}

/** Nos 10 tours côté bleu, candidats primaire + fallback. */
const OUR_REPLIES: Record<number, GeneratedCandidate[]> = {
    1: [{ championKey: 'Z' }],
    3: [{ championKey: 'Y' }],
    5: [{ championKey: 'X', reasonsFr: ['cible range B3'] }],
    14: [{ championKey: 'W' }],
    16: [{ championKey: 'V' }],
    7: [{ championKey: 'P1' }, { championKey: 'F1' }],
    10: [{ championKey: 'P2' }, { championKey: 'F2' }],
    11: [{ championKey: 'P3' }, { championKey: 'F3' }],
    18: [{ championKey: 'P4' }, { championKey: 'F4' }],
    19: [{ championKey: 'P5' }, { championKey: 'F5' }]
};

/** Leurs 10 tours : un argmax net à chaque slot (plus un 2ᵉ choix ignoré). */
const ENEMY_DIST: Record<number, [string, number][]> = {
    2: [['spare1', 0.4], ['e2', 0.6]],
    4: [['e4', 1]],
    6: [['e6', 1]],
    8: [['e8', 1]],
    9: [['e9', 1]],
    12: [['e12', 1]],
    13: [['e13', 1]],
    15: [['e15', 1]],
    17: [['e17', 1]],
    20: [['e20', 1]]
};

/** Priors jouets : P3 entre en collision avec P2 sur le mid (P2 passe avant). */
const PRIORS: RolePriors = (key) =>
    ((
        {
            P1: { [Role.Top]: 5 },
            P2: { [Role.Middle]: 9, [Role.Jungle]: 3 },
            P3: { [Role.Middle]: 7, [Role.Jungle]: 2 },
            P4: { [Role.Bottom]: 4 },
            P5: { [Role.Support]: 8 }
        }) as Record<string, Partial<Record<Role, number>>>
    )[key] ?? {};

function generate(overrides: Partial<PrepGeneratorContext> = {}) {
    return generatePrepPlan({
        ourSide: 'blue',
        ourReply: replyBySeq(OUR_REPLIES),
        enemyDistribution: distBySeq(ENEMY_DIST),
        rolePriors: PRIORS,
        pool: POOL,
        ...overrides
    });
}

// ---- la séquence nominale (20 slots) ---------------------------------------------------

describe('generatePrepPlan — self-play nominal côté bleu', () => {
    const ourSeqs: number[] = [];
    const enemySeqs: number[] = [];
    const prep = generate({
        ourReply: (state, slot) => {
            ourSeqs.push(slot.seq);
            return replyBySeq(OUR_REPLIES)(state, slot);
        },
        enemyDistribution: (state, slot) => {
            enemySeqs.push(slot.seq);
            return distBySeq(ENEMY_DIST)(state, slot);
        }
    });

    it('déroule les 20 slots : nos tours et les leurs aux bons seq, dans l’ordre', () => {
        expect(ourSeqs).toEqual([1, 3, 5, 7, 10, 11, 14, 16, 18, 19]);
        expect(enemySeqs).toEqual([2, 4, 6, 8, 9, 12, 13, 15, 17, 20]);
    });

    it('5 bans remplis dans l’ordre de nos slots de ban', () => {
        expect(prep.bans.map((b) => b.championKey)).toEqual(['Z', 'Y', 'X', 'W', 'V']);
        expect(prep.holes).toBe(0);
        expect(prep.enemySkips).toBe(0);
    });

    it('5 picks primaire + fallback, mappés aux rôles par les priors (collision P3 → jungle)', () => {
        expect(prep.picks.map((p) => p.role)).toEqual([
            Role.Top,
            Role.Jungle,
            Role.Middle,
            Role.Bottom,
            Role.Support
        ]);
        // P2 (joué avant P3) garde le mid ; P3 prend son 2ᵉ rôle le plus probable.
        expect(prep.picks.map((p) => [p.primary, p.fallback])).toEqual([
            ['P1', 'F1'],
            ['P3', 'F3'],
            ['P2', 'F2'],
            ['P4', 'F4'],
            ['P5', 'F5']
        ]);
    });

    it('raisons : exposée reprise telle quelle, sinon générée avec la sortie adverse suivante', () => {
        // seq 5 : reasonsFr exposées par le répondeur.
        expect(prep.bans[2].rationaleFr).toBe('cible range B3');
        // seq 1 : raison générée — le coup adverse suivant du self-play est e2 (argmax du seq 2).
        expect(prep.bans[0].rationaleFr).toBe(`${SELF_PLAY_LABEL_FR} — sortie attendue adverse : e2.`);
        // seq 19 (P5, support) : leur seq 20 suit → e20.
        expect(prep.picks[4].rationaleFr).toBe(`${SELF_PLAY_LABEL_FR} — sortie attendue adverse : e20.`);
        // seq 10-11 (P2, P3) : tous deux en attente jusqu'au seq 12 adverse → e12.
        expect(prep.picks[2].rationaleFr).toBe(`${SELF_PLAY_LABEL_FR} — sortie attendue adverse : e12.`);
        expect(prep.picks[1].rationaleFr).toBe(`${SELF_PLAY_LABEL_FR} — sortie attendue adverse : e12.`);
    });

    it('nameOf injecté : la raison générée porte le nom affichable, pas la clé', () => {
        const named = generate({ nameOf: (key) => `Champion-${key}` });
        expect(named.bans[0].rationaleFr).toBe(
            `${SELF_PLAY_LABEL_FR} — sortie attendue adverse : Champion-e2.`
        );
    });
});

// ---- trous explicites (seams muets) ----------------------------------------------------

describe('generatePrepPlan — trous explicites, jamais inventés', () => {
    it('répondeur muet à un ban → bans[i] null + holes compté', () => {
        const replies = { ...OUR_REPLIES, 14: [] };
        const prep = generate({ ourReply: replyBySeq(replies) });
        expect(prep.bans.map((b) => b.championKey)).toEqual(['Z', 'Y', 'X', null, 'V']);
        expect(prep.bans[3].rationaleFr).toBeNull();
        expect(prep.holes).toBe(1);
    });

    it('répondeur muet à un pick → le rôle reste null + holes compté', () => {
        const replies = { ...OUR_REPLIES, 18: [] };
        const prep = generate({ ourReply: replyBySeq(replies) });
        // P4 (Bottom) manque : la ligne du rôle reste un trou.
        expect(prep.picks[3]).toEqual({ role: Role.Bottom, primary: null, fallback: null, rationaleFr: null });
        expect(prep.holes).toBe(1);
    });

    it('distribution adverse vide → leur slot sauté (enemySkips), la séquence continue', () => {
        const dist = { ...ENEMY_DIST };
        delete dist[4];
        const ourSeqs: number[] = [];
        const prep = generate({
            enemyDistribution: distBySeq(dist),
            ourReply: (state, slot) => {
                ourSeqs.push(slot.seq);
                return replyBySeq(OUR_REPLIES)(state, slot);
            }
        });
        expect(prep.enemySkips).toBe(1);
        expect(ourSeqs).toEqual([1, 3, 5, 7, 10, 11, 14, 16, 18, 19]); // rien ne déraille
        expect(prep.bans.map((b) => b.championKey)).toEqual(['Z', 'Y', 'X', 'W', 'V']);
    });

    it('tous les seams muets → 10 trous, plan entièrement null', () => {
        const prep = generate({ ourReply: () => [], enemyDistribution: () => [] });
        expect(prep.holes).toBe(10);
        expect(prep.enemySkips).toBe(10);
        expect(prep.bans.every((b) => b.championKey === null)).toBe(true);
        expect(prep.picks.every((p) => p.primary === null && p.fallback === null)).toBe(true);
    });
});

// ---- exclusions et anti-doublons -------------------------------------------------------

describe('generatePrepPlan — board et plan sans doublons', () => {
    it('un candidat déjà joué sur le board est sauté (le 2ᵉ devient primaire)', () => {
        // seq 3 propose Z (déjà banni par nous au seq 1) puis Y.
        const replies = { ...OUR_REPLIES, 3: [{ championKey: 'Z' }, { championKey: 'Y' }] };
        const prep = generate({ ourReply: replyBySeq(replies) });
        expect(prep.bans.map((b) => b.championKey)).toEqual(['Z', 'Y', 'X', 'W', 'V']);
        expect(prep.holes).toBe(0);
    });

    it('un fallback déjà réservé par le plan ne se répète pas (F1 pris au seq 7)', () => {
        // seq 10 propose F1 en tête : déjà fallback du plan → P2 primaire, F2 fallback.
        const replies = {
            ...OUR_REPLIES,
            10: [{ championKey: 'F1' }, { championKey: 'P2' }, { championKey: 'F2' }]
        };
        const prep = generate({ ourReply: replyBySeq(replies) });
        expect(prep.picks[2].primary).toBe('P2');
        expect(prep.picks[2].fallback).toBe('F2');
    });

    it('le doublon primaire/fallback du même tour est ignoré (dédoublonnage)', () => {
        const replies = {
            ...OUR_REPLIES,
            7: [{ championKey: 'P1' }, { championKey: 'P1' }, { championKey: 'F1' }]
        };
        const prep = generate({ ourReply: replyBySeq(replies) });
        expect(prep.picks[0].primary).toBe('P1');
        expect(prep.picks[0].fallback).toBe('F1');
    });

    it('excludedKeys (Fearless) retirées de NOS candidats : trou explicite', () => {
        const prep = generate({ excludedKeys: ['Z'] });
        // Z exclu → notre seq 1 retombe en trou (le répondeur jouet n'a qu'un candidat).
        expect(prep.bans[0].championKey).toBeNull();
        expect(prep.holes).toBe(1);
    });

    it('excludedKeys retirées de LEUR argmax : le seq 2 retombe sur spare1', () => {
        const prep = generate({ excludedKeys: ['e2'] });
        expect(prep.bans[0].rationaleFr).toBe(`${SELF_PLAY_LABEL_FR} — sortie attendue adverse : spare1.`);
    });

    it("l'argmax adverse respecte le board : une clé bannie ne réapparaît pas", () => {
        // seq 2 : Z (notre ban seq 1) en masse max — indisponible ⇒ e2.
        const dist = { ...ENEMY_DIST, 2: [['Z', 0.9], ['e2', 0.1]] as [string, number][] };
        const prep = generate({ enemyDistribution: distBySeq(dist) });
        expect(prep.bans[0].rationaleFr).toBe(`${SELF_PLAY_LABEL_FR} — sortie attendue adverse : e2.`);
    });
});

// ---- mapping de rôles ------------------------------------------------------------------

describe('generatePrepPlan — mapping de rôles', () => {
    it('champion inconnu des priors → uniforme honnête : premier rôle encore libre', () => {
        // P1 inconnu : priors qui ne connaissent que P2..P5.
        const priors: RolePriors = (key) => (key === 'P1' ? {} : PRIORS(key));
        const prep = generate({ rolePriors: priors });
        // P1 (1ᵉʳ pick) prend Top (premier rôle libre) ; le reste suit ses priors.
        expect(prep.picks[0].primary).toBe('P1');
        expect(prep.picks[2].primary).toBe('P2');
    });

    it('collisions en cascade : trois mids → mid, puis jungle, puis premier libre', () => {
        const priors: RolePriors = (key) =>
            ((
                {
                    P1: { [Role.Middle]: 9, [Role.Jungle]: 4 },
                    P2: { [Role.Middle]: 8, [Role.Jungle]: 5 },
                    P3: { [Role.Middle]: 7 },
                    P4: { [Role.Bottom]: 4 },
                    P5: { [Role.Support]: 8 }
                }) as Record<string, Partial<Record<Role, number>>>
            )[key] ?? {};
        const prep = generate({ rolePriors: priors });
        // Ordre de génération : P1 → mid ; P2 → jungle (2ᵉ rôle) ; P3 → top
        // (mid pris, aucun autre poids ⇒ premier rôle libre par index).
        expect(prep.picks[2].primary).toBe('P1');
        expect(prep.picks[1].primary).toBe('P2');
        expect(prep.picks[0].primary).toBe('P3');
        expect(prep.picks[3].primary).toBe('P4');
        expect(prep.picks[4].primary).toBe('P5');
    });
});

// ---- side rouge ------------------------------------------------------------------------

describe('generatePrepPlan — côté rouge', () => {
    it('nos tours sont les slots rouges ; le dernier coup (seq 20) n’a plus de sortie adverse', () => {
        const replies: Record<number, GeneratedCandidate[]> = {
            2: [{ championKey: 'Z' }],
            4: [{ championKey: 'Y' }],
            6: [{ championKey: 'X' }],
            13: [{ championKey: 'W' }],
            15: [{ championKey: 'V' }],
            8: [{ championKey: 'P1' }, { championKey: 'F1' }],
            9: [{ championKey: 'P2' }, { championKey: 'F2' }],
            12: [{ championKey: 'P3' }, { championKey: 'F3' }],
            17: [{ championKey: 'P4' }, { championKey: 'F4' }],
            20: [{ championKey: 'P5' }, { championKey: 'F5' }]
        };
        const dist: Record<number, [string, number][]> = {
            1: [['e2', 1]],
            3: [['e4', 1]],
            5: [['e6', 1]],
            7: [['e8', 1]],
            10: [['e9', 1]],
            11: [['e12', 1]],
            14: [['e13', 1]],
            16: [['e15', 1]],
            18: [['e17', 1]],
            19: [['e20', 1]]
        };
        const ourSeqs: number[] = [];
        const prep = generate({
            ourSide: 'red',
            ourReply: (state, slot) => {
                ourSeqs.push(slot.seq);
                return replyBySeq(replies)(state, slot);
            },
            enemyDistribution: distBySeq(dist)
        });
        expect(ourSeqs).toEqual([2, 4, 6, 8, 9, 12, 13, 15, 17, 20]);
        expect(prep.bans.map((b) => b.championKey)).toEqual(['Z', 'Y', 'X', 'W', 'V']);
        // seq 20 : plus aucun coup adverse derrière → raison générée SANS sortie attendue.
        expect(prep.picks[4].rationaleFr).toBe(`${SELF_PLAY_LABEL_FR}.`);
    });
});

// ---- hasChallenges (planDrill) ---------------------------------------------------------

describe('hasChallenges — détection AVANT de démarrer le drill', () => {
    const emptyPlan: DraftPlan = {
        id: 'p-vide',
        name: 'Plan vide',
        bans: Array.from({ length: 5 }, () => ({ championKey: null })),
        picks: [
            { role: Role.Top, primary: null, fallback: null },
            { role: Role.Jungle, primary: null, fallback: null },
            { role: Role.Middle, primary: null, fallback: null },
            { role: Role.Bottom, primary: null, fallback: null },
            { role: Role.Support, primary: null, fallback: null }
        ],
        createdAt: 0,
        updatedAt: 0
    };

    it('plan vide + ourReply () => null (le cas d’Alain) → aucun défi, startDrill 0 ligne', () => {
        const tree = compilePlanTree({
            ourSide: 'blue',
            plan: emptyPlan,
            enemyDistribution: distBySeq({ 2: [['e2', 0.6], ['e2b', 0.4]] }),
            ourReply: () => null,
            now: 1000
        });
        expect(hasChallenges(tree)).toBe(false);
        const session = startDrill(tree, { mode: 'principale' });
        expect(session.done).toBe(true);
        expect(session.lines.length).toBe(0); // cohérence avec « 0 ligne jouée »
    });

    it('plan avec un primaire → au moins un défi', () => {
        const plan: DraftPlan = {
            ...emptyPlan,
            bans: [{ championKey: 'Z' }, ...emptyPlan.bans.slice(1)]
        };
        const tree = compilePlanTree({
            ourSide: 'blue',
            plan,
            enemyDistribution: () => [],
            ourReply: () => null,
            now: 1000
        });
        expect(hasChallenges(tree)).toBe(true);
    });
});
