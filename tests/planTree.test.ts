/**
 * Chantier D (run #2) — tests de `$lib/strategic/planTree` (+ la section
 * répertoire du prep pack qui en consomme l'arbre).
 *
 * Toutes les structures attendues sont calculées À LA MAIN depuis l'algorithme
 * gelé (§2.2) : distribution injectée déterministe, template blue-first
 * (seq 1 = notre ban si ourSide = blue, seq 2 = leur ban, etc.).
 */
import { describe, it, expect, vi } from 'vitest';
import {
    compilePlanTree,
    massByEnemyDepth,
    PLAN_TREE_DEFAULTS,
    type CompileContext,
    type PlanTree,
    type PlanTreeNode
} from '$lib/strategic/planTree';
import { renderPrepPackMarkdown } from '$lib/exports/prepPack';
import { DRAFT_TEMPLATE } from '$lib/data/draftRecord';
import type { DraftAction } from '$lib/data/types';
import type { EnemyDistributionEntry, NavigatorSlot } from '$lib/strategic/draftNavigator';
import type { DraftPlan } from '$lib/storage/draftPlans';
import { Role } from '$lib/types';

const plan: DraftPlan = {
    id: 'p1',
    name: 'Plan A',
    bans: [
        { championKey: 'Z', rationale: 'cible B1' },
        { championKey: 'Y' },
        { championKey: 'X' },
        { championKey: null },
        { championKey: null }
    ],
    picks: [
        { role: Role.Top, primary: 'T1', fallback: 'T2', rationale: 'top gap' },
        { role: Role.Jungle, primary: 'J1', fallback: null },
        { role: Role.Middle, primary: 'M1', fallback: null },
        { role: Role.Bottom, primary: 'B1', fallback: null },
        { role: Role.Support, primary: 'S1', fallback: null }
    ],
    createdAt: 0,
    updatedAt: 0
};

/** Distribution par seq — déterministe, ignore l'état (les tests le veulent). */
function distBySeq(table: Record<number, [string, number][]>) {
    return (_state: unknown, slot: NavigatorSlot): EnemyDistributionEntry[] =>
        (table[slot.seq] ?? []).map(([championKey, p]) => ({ championKey, p }));
}

function compile(overrides: Partial<CompileContext>): PlanTree {
    return compilePlanTree({
        ourSide: 'blue',
        plan,
        enemyDistribution: () => [],
        ourReply: () => null,
        now: 1000,
        opponent: 'KOI',
        modelProvenance: { records: 12, latestPatch: '26.10' },
        ...overrides
    });
}

describe('compilePlanTree — structure K = 2 / E = 2 main-calculée', () => {
    const tree = compile({
        enemyDistribution: distBySeq({
            2: [
                ['a', 0.5],
                ['b', 0.3],
                ['c', 0.2]
            ],
            4: [
                ['d', 0.6],
                ['e', 0.4]
            ]
        }),
        evidenceOf: (championKey) => ({ rawCount: 4, total: 6, exampleGameIds: [`g-${championKey}`] }),
        config: { branchK: 2, enemyDepth: 2, minPathMass: 0, maxNodes: 2000, replyMassFloor: 2 }
    });

    it('racine : notre B1 statique (Z + rationale), tour adverse seq 2, masse 1', () => {
        expect(tree.root.ourLine).toEqual([{ seq: 1, type: 'ban', championKey: 'Z', reasonsFr: ['cible B1'] }]);
        expect(tree.root.enemySeq).toBe(2);
        expect(tree.root.pathMass).toBe(1);
        expect(tree.planId).toBe('p1');
        expect(tree.opponent).toBe('KOI');
        expect(tree.ourSide).toBe('blue');
        expect(tree.builtAt).toBe(1000);
        expect(tree.modelProvenance).toEqual({ records: 12, latestPatch: '26.10' });
    });

    it('branches racine : top-2 par masse, évidence figée, enfants déroulés', () => {
        expect(tree.root.branches.map((b) => b.championKey)).toEqual(['a', 'b']);
        expect(tree.root.branches.map((b) => b.p)).toEqual([0.5, 0.3]);
        expect(tree.root.branches[0].rawCount).toBe(4);
        expect(tree.root.branches[0].total).toBe(6);
        expect(tree.root.branches[0].exampleGameIds).toEqual(['g-a']);
        const childA = tree.root.branches[0].child;
        // Notre seq 3 : ban statique suivant (Z consommé) → Y.
        expect(childA.ourLine).toEqual([{ seq: 3, type: 'ban', championKey: 'Y' }]);
        expect(childA.enemySeq).toBe(4);
        expect(childA.pathMass).toBeCloseTo(0.5, 12);
    });

    it('profondeur 2 = horizon : enemySeq null, branches vides, ourLine déroulée quand même', () => {
        const childA = tree.root.branches[0].child;
        expect(childA.branches.map((b) => b.championKey)).toEqual(['d', 'e']);
        const grandAD = childA.branches[0].child;
        // Réponse à leur seq 4 incluse : notre seq 5 = ban X (Z, Y consommés).
        expect(grandAD.ourLine).toEqual([{ seq: 5, type: 'ban', championKey: 'X' }]);
        expect(grandAD.enemySeq).toBeNull(); // horizon E = 2
        expect(grandAD.branches).toEqual([]);
        expect(grandAD.pathMass).toBeCloseTo(0.3, 12); // 0,5 × 0,6
    });

    it('nodeCount main-compté : 1 racine + 2 enfants + 2×2 petits-enfants = 7', () => {
        expect(tree.nodeCount).toBe(7);
    });

    it('config gelée par défaut : K = 4, E = 6, masse 0,02, budget 2000, plancher 0,05', () => {
        expect(PLAN_TREE_DEFAULTS).toEqual({
            branchK: 4,
            enemyDepth: 6,
            minPathMass: 0.02,
            maxNodes: 2000,
            replyMassFloor: 0.05
        });
    });
});

describe('compilePlanTree — replyMassFloor (navigate seulement au-dessus, spy compté)', () => {
    it('ourReply appelé UNIQUEMENT sur les nœuds de masse ≥ plancher ; statique en dessous', () => {
        const spy = vi.fn((_state: unknown, slot: NavigatorSlot) => ({
            seq: slot.seq,
            type: slot.type,
            championKey: `N${slot.seq}`,
            reasonsFr: ['nav']
        }));
        const tree = compile({
            enemyDistribution: distBySeq({
                2: [
                    ['a', 0.5],
                    ['b', 0.3]
                ],
                4: [
                    ['d', 0.6],
                    ['e', 0.4]
                ]
            }),
            ourReply: spy,
            config: { branchK: 2, enemyDepth: 2, minPathMass: 0, maxNodes: 2000, replyMassFloor: 0.25 }
        });
        // Masses : racine 1 ≥ 0,25 (seq 1) ; enfants 0,5 et 0,3 ≥ 0,25 (seq 3) ;
        // petits-enfants a·d = 0,5×0,6 = 0,30 ≥ 0,25 (seq 5, navigate) ;
        // a·e 0,20 / b·d 0,18 / b·e 0,12 < 0,25 → mapping statique.
        expect(spy).toHaveBeenCalledTimes(4);
        expect(spy.mock.calls.map(([, slot]) => slot.seq)).toEqual([1, 3, 3, 5]);
        expect(tree.root.ourLine[0].championKey).toBe('N1');
        expect(tree.root.branches[0].child.ourLine[0].championKey).toBe('N3');
        const grandAD = tree.root.branches[0].child.branches[0].child;
        expect(grandAD.ourLine[0].championKey).toBe('N5'); // 0,30 ≥ plancher → navigate
        // Sidelines minces : réponse STATIQUE du plan (premier ban disponible = Z).
        const grandAE = tree.root.branches[0].child.branches[1].child;
        expect(grandAE.ourLine[0].championKey).toBe('Z'); // 0,20 < plancher → statique
    });
});

describe('compilePlanTree — exclusions le long des lignes', () => {
    it('un champion consommé en amont (par nous OU par eux) ne réapparaît jamais en aval', () => {
        const tree = compile({
            enemyDistribution: distBySeq({
                // Z = notre ban racine → doit être filtré des branches seq 2.
                2: [
                    ['Z', 0.6],
                    ['a', 0.3],
                    ['b', 0.1]
                ],
                // a = branche amont sur la ligne a → filtré là-bas, gardé côté b.
                4: [
                    ['a', 0.7],
                    ['d', 0.3]
                ]
            }),
            config: { branchK: 2, enemyDepth: 2, minPathMass: 0, maxNodes: 2000, replyMassFloor: 2 }
        });
        expect(tree.root.branches.map((b) => b.championKey)).toEqual(['a', 'b']);
        const childA = tree.root.branches[0].child;
        const childB = tree.root.branches[1].child;
        expect(childA.branches.map((b) => b.championKey)).toEqual(['d']); // a consommé
        expect(childB.branches.map((b) => b.championKey)).toEqual(['a', 'd']); // a libre ici

        // Invariant récursif : aucune clé réutilisée sur un chemin racine→feuille.
        const assertNoReuse = (node: PlanTreeNode, consumed: Set<string>): void => {
            for (const action of node.ourLine) {
                expect(consumed.has(action.championKey)).toBe(false);
                consumed.add(action.championKey);
            }
            for (const branch of node.branches) {
                expect(consumed.has(branch.championKey)).toBe(false);
                assertNoReuse(branch.child, new Set([...consumed, branch.championKey]));
            }
        };
        assertNoReuse(tree.root, new Set());
    });

    it('excludedKeys (Fearless) excluent dès la racine et sont portés par l’arbre', () => {
        const tree = compile({
            excludedKeys: ['a', 'Z'],
            enemyDistribution: distBySeq({
                2: [
                    ['a', 0.6],
                    ['b', 0.4]
                ]
            }),
            config: { branchK: 2, enemyDepth: 1, minPathMass: 0, maxNodes: 2000, replyMassFloor: 2 }
        });
        expect(tree.excludedKeys).toEqual(['a', 'Z']);
        // a exclu des branches ; Z exclu de NOTRE mapping statique → ban Y.
        expect(tree.root.branches.map((b) => b.championKey)).toEqual(['b']);
        expect(tree.root.ourLine[0].championKey).toBe('Y');
    });
});

describe('compilePlanTree — budget et plancher de masse', () => {
    it('maxNodes coupe l’expansion par priorité de masse (frontière max d’abord)', () => {
        const tree = compile({
            enemyDistribution: distBySeq({
                2: [
                    ['a', 0.5],
                    ['b', 0.3]
                ],
                4: [
                    ['d', 0.6],
                    ['e', 0.4]
                ]
            }),
            config: { branchK: 2, enemyDepth: 3, minPathMass: 0, maxNodes: 4, replyMassFloor: 2 }
        });
        // 1 (racine) + 2 (a, b) + 1 (a→d, la masse max passe d'abord) = 4 → stop.
        expect(tree.nodeCount).toBe(4);
        expect(tree.root.branches[0].child.branches).toHaveLength(1); // coupé en plein vol
        expect(tree.root.branches[1].child.branches).toHaveLength(0); // jamais dépilé
        expect(tree.root.branches[1].child.enemySeq).toBe(4); // ligne mince ≠ horizon
    });

    it('minPathMass : les nœuds sous le plancher restent des lignes minces (enemySeq gardé)', () => {
        const tree = compile({
            enemyDistribution: distBySeq({
                2: [
                    ['a', 0.5],
                    ['b', 0.3],
                    ['c', 0.2]
                ],
                4: [
                    ['d', 0.6],
                    ['e', 0.4]
                ],
                6: [
                    ['f', 0.9],
                    ['g', 0.1]
                ]
            }),
            config: { branchK: 3, enemyDepth: 3, minPathMass: 0.2, maxNodes: 2000, replyMassFloor: 2 }
        });
        // Enfants : a 0,5 ; b 0,3 ; c 0,2 (≥ 0,2, égalité incluse) → tous étendus.
        // Petits-enfants ≥ 0,2 : a·d 0,3 et a·e 0,2 seulement → seuls étendus.
        const childB = tree.root.branches[1].child;
        expect(childB.branches.map((b) => b.child.pathMass)).toEqual([0.18, 0.12]);
        const bd = childB.branches[0].child;
        expect(bd.enemySeq).toBe(6); // mince (masse), PAS horizon
        expect(bd.branches).toEqual([]);
        const ad = tree.root.branches[0].child.branches[0].child;
        expect(ad.branches.map((b) => b.championKey)).toEqual(['f', 'g']); // étendu
        // Niveau 3 = horizon : enemySeq null.
        expect(ad.branches[0].child.enemySeq).toBeNull();
        // Masse couverte par CET arbre, par profondeur (Σ pathMass) :
        //   d1 : 0,5+0,3+0,2 = 1 ; d2 : (0,5+0,3+0,2)×(0,6+0,4) = 1 ;
        //   d3 : seuls ad (0,3) et ae (0,2) étendus → 0,5×(0,9+0,1) = 0,5.
        const mass = massByEnemyDepth(tree.root);
        expect(mass).toHaveLength(3);
        expect(mass[0]).toBeCloseTo(1, 12);
        expect(mass[1]).toBeCloseTo(1, 12);
        expect(mass[2]).toBeCloseTo(0.5, 12);
    });
});

describe('compilePlanTree — mapping statique des picks', () => {
    it('premier PRIMAIRE du rôle encore ouvert disponible sur la ligne (T1 pris ⇒ J1)', () => {
        const tree = compile({
            enemyDistribution: distBySeq({
                2: [['T1', 1]], // ils prennent notre primaire Top
                4: [['d', 1]],
                6: [['e', 1]]
            }),
            config: { branchK: 1, enemyDepth: 3, minPathMass: 0, maxNodes: 2000, replyMassFloor: 2 }
        });
        // Chemin unique : nos bans Z, Y, X (seq 1/3/5) ; leur seq 6 → notre seq 7
        // = premier pick : Top ouvert mais T1 consommé → Jungle J1.
        const leaf = tree.root.branches[0].child.branches[0].child.branches[0].child;
        expect(leaf.ourLine).toEqual([
            { seq: 7, type: 'pick', championKey: 'J1' } // pas de fallback (null au plan)
        ]);
        expect(tree.nodeCount).toBe(4);
        expect(massByEnemyDepth(tree.root)).toEqual([1, 1, 1]);
    });

    it('le pick statique porte fallback + rationale quand le plan les fournit', () => {
        const tree = compile({
            enemyDistribution: distBySeq({
                2: [['q', 1]],
                4: [['r', 1]],
                6: [['s', 1]]
            }),
            config: { branchK: 1, enemyDepth: 3, minPathMass: 0, maxNodes: 2000, replyMassFloor: 2 }
        });
        const leaf = tree.root.branches[0].child.branches[0].child.branches[0].child;
        expect(leaf.ourLine).toEqual([
            { seq: 7, type: 'pick', championKey: 'T1', fallback: 'T2', reasonsFr: ['top gap'] }
        ]);
    });
});

describe('compilePlanTree — recompile « d’ici » (initialActions)', () => {
    const played = (seq: number, championKey: string): DraftAction => {
        const slot = DRAFT_TEMPLATE.find((s) => s.seq === seq);
        if (slot === undefined) throw new Error(`seq ${seq} hors template`);
        return {
            seq,
            type: slot.type,
            phase: slot.phase,
            side: slot.first ? 'blue' : 'red',
            championKey,
            championName: championKey
        };
    };

    it('l’arbre redémarre au slot suivant, le préfixe joué est consommé, la profondeur repart à 0', () => {
        // Déviation vécue : notre seq 1 = Q (hors plan), leur seq 2 = q (hors branches).
        const tree = compile({
            initialActions: [played(1, 'Q'), played(2, 'q')],
            enemyDistribution: distBySeq({
                4: [
                    ['Q', 0.6], // consommé par le préfixe → filtré
                    ['d', 0.4]
                ]
            }),
            config: { branchK: 2, enemyDepth: 1, minPathMass: 0, maxNodes: 2000, replyMassFloor: 2 }
        });
        // Reprise : notre seq 3 (ban statique Z — le plan reste la source), leur seq 4.
        expect(tree.root.ourLine).toEqual([{ seq: 3, type: 'ban', championKey: 'Z', reasonsFr: ['cible B1'] }]);
        expect(tree.root.enemySeq).toBe(4);
        expect(tree.root.branches.map((b) => b.championKey)).toEqual(['d']); // Q filtré
        // enemyDepth 1 = UNE action adverse restante → enfants à l'horizon.
        expect(tree.root.branches[0].child.enemySeq).toBeNull();
    });

    it('nos picks passés revendiquent leur rôle (T1 joué ⇒ le statique propose J1, pas T1)', () => {
        const prefix = [
            played(1, 'Z'),
            played(2, 'e1'),
            played(3, 'Y'),
            played(4, 'e2'),
            played(5, 'X'),
            played(6, 'e3'),
            played(7, 'T1') // notre premier pick : rôle Top couvert
        ];
        const tree = compile({
            initialActions: prefix,
            enemyDistribution: distBySeq({
                8: [['r1', 1]],
                9: [['r2', 1]]
            }),
            config: { branchK: 1, enemyDepth: 2, minPathMass: 0, maxNodes: 2000, replyMassFloor: 2 }
        });
        // Reprise à seq 8 (red) : ourLine racine vide, branches r1 puis r2 ;
        // après leur seq 9, NOS seq 10-11 : Top déjà claimé → J1 puis M1.
        expect(tree.root.ourLine).toEqual([]);
        expect(tree.root.enemySeq).toBe(8);
        const leaf = tree.root.branches[0].child.branches[0].child;
        expect(leaf.ourLine.map((a) => a.championKey)).toEqual(['J1', 'M1']);
        expect(leaf.enemySeq).toBeNull(); // horizon : 2 actions adverses re-préparées
    });
});

describe('prep pack — section répertoire imprimable (lignes ≥ replyMassFloor)', () => {
    it('rend les lignes épaisses avec masse + évidence + réponse, élague sous le plancher', () => {
        const tree = compile({
            enemyDistribution: distBySeq({
                2: [
                    ['a', 0.6],
                    ['b', 0.04] // sous le plancher 0,05 → hors répertoire
                ],
                4: [['d', 0.5]]
            }),
            evidenceOf: () => ({ rawCount: 4, total: 6 }),
            config: { branchK: 2, enemyDepth: 2, minPathMass: 0, maxNodes: 2000, replyMassFloor: 0.05 }
        });
        const markdown = renderPrepPackMarkdown({
            header: { title: 'Prep', opponent: 'KOI', generatedAt: '2026-06-11' },
            planTree: tree
        });
        expect(markdown).toContain('## Répertoire — script contre KOI');
        expect(markdown).toContain('Ouverture préparée — nous : ban Z');
        expect(markdown).toContain('1. a 60 % (4 des 6 dernières) → nous : ban Y');
        // Le % affiché est la masse de la BRANCHE (p modèle) ; le pathMass
        // (0,6 × 0,5 = 0,30 ≥ 0,05) ne sert qu'au filtre d'inclusion.
        expect(markdown).toContain('1.1. d 50 %');
        expect(markdown).not.toContain(' b 4 %'); // élagué (masse 0,024 < 0,05)
        expect(markdown).toContain('Modèle : 12 games, patch ≤ 26.10');
        expect(markdown).toContain('pas une couverture mesurée');
    });

    it('sans arbre : aucune section répertoire (rien d’inventé)', () => {
        const markdown = renderPrepPackMarkdown({
            header: { title: 'Prep', opponent: 'KOI', generatedAt: '2026-06-11' }
        });
        expect(markdown).not.toContain('Répertoire');
    });
});
