/**
 * Chantier D (run #2) — tests de `$lib/strategic/planTracker` (§2.3 gelé).
 *
 * Arbre construit À LA MAIN (indépendant du compile) sur le template
 * blue-first, ourSide = blue : seq 1/3/5 = nos bans, seq 2/4/6 = les leurs.
 *
 *   racine  ourLine [seq1 ban Z (repli Z2)]  enemySeq 2
 *     ├─ a (p 0,5) → A  ourLine [seq3 ban Y]  enemySeq 4
 *     │    └─ d (p 0,6) → AD  ourLine [seq5 ban X]  enemySeq 6, branches []   (ligne mince)
 *     └─ b (p 0,3) → B  ourLine [seq3 ban W]  enemySeq 4
 *          └─ e (p 0,9) → BE  ourLine [seq5 ban V]  enemySeq null            (horizon)
 */
import { describe, it, expect } from 'vitest';
import { trackPlan } from '$lib/strategic/planTracker';
import {
    PLAN_TREE_DEFAULTS,
    type PlanBranch,
    type PlannedAction,
    type PlanTree,
    type PlanTreeNode
} from '$lib/strategic/planTree';
import { DRAFT_TEMPLATE } from '$lib/data/draftRecord';
import type { DraftAction } from '$lib/data/types';

const pa = (seq: number, championKey: string, fallback?: string): PlannedAction => ({
    seq,
    type: 'ban',
    championKey,
    ...(fallback !== undefined ? { fallback } : {})
});

const node = (
    ourLine: PlannedAction[],
    enemySeq: number | null,
    branches: PlanBranch[],
    pathMass: number
): PlanTreeNode => ({ ourLine, enemySeq, branches, pathMass });

const br = (championKey: string, p: number, child: PlanTreeNode): PlanBranch => ({
    championKey,
    p,
    rawCount: 0,
    total: 0,
    child
});

const AD = node([pa(5, 'X')], 6, [], 0.3);
const BE = node([pa(5, 'V')], null, [], 0.27);
const A = node([pa(3, 'Y')], 4, [br('d', 0.6, AD)], 0.5);
const B = node([pa(3, 'W')], 4, [br('e', 0.9, BE)], 0.3);
const root = node([pa(1, 'Z', 'Z2')], 2, [br('a', 0.5, A), br('b', 0.3, B)], 1);

const tree: PlanTree = {
    planId: 'p1',
    opponent: 'KOI',
    ourSide: 'blue',
    builtAt: 0,
    modelProvenance: { records: 12, latestPatch: '26.10' },
    config: PLAN_TREE_DEFAULTS,
    excludedKeys: [],
    root,
    nodeCount: 5
};

/** Action réelle sur le template blue-first. */
function act(seq: number, championKey: string): DraftAction {
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
}

/** Complète une draft jusqu'au seq 20 avec des clés de bruit uniques. */
function fillToEnd(prefix: DraftAction[]): DraftAction[] {
    const used = new Set(prefix.map((a) => a.seq));
    const out = [...prefix];
    for (const slot of DRAFT_TEMPLATE) {
        if (used.has(slot.seq)) continue;
        out.push(act(slot.seq, `fill${slot.seq}`));
    }
    return out;
}

describe('trackPlan — on-script', () => {
    it('not-started : aucune action, racine vivante, première réponse préparée', () => {
        const state = trackPlan(tree, [], 'blue');
        expect(state.status).toBe('not-started');
        expect(state.enemyMatched).toBe(0);
        expect(state.node).toBe(root);
        expect(state.nextPrepared).toEqual(pa(1, 'Z', 'Z2'));
        expect(state.expectedBranches.map((b) => b.championKey)).toEqual(['a', 'b']);
        expect(state.branchesAuthoritative).toBe(true);
        expect(state.headlineFr).toContain('Script prêt');
    });

    it('notre action = primaire → on-script, ligne consommée, branches racine attendues', () => {
        const state = trackPlan(tree, [act(1, 'Z')], 'blue');
        expect(state.status).toBe('on-script');
        expect(state.nextPrepared).toBeNull(); // à eux de jouer
        expect(state.expectedBranches.map((b) => b.championKey)).toEqual(['a', 'b']);
        expect(state.headlineFr).toContain('Dans le script');
    });

    it('le FALLBACK compte comme match (repli préparé)', () => {
        const state = trackPlan(tree, [act(1, 'Z2')], 'blue');
        expect(state.status).toBe('on-script');
    });

    it('descente complète : Z, a, Y, d → nœud AD, 2 actions adverses matchées', () => {
        const state = trackPlan(tree, [act(1, 'Z'), act(2, 'a'), act(3, 'Y'), act(4, 'd')], 'blue');
        expect(state.status).toBe('on-script');
        expect(state.enemyMatched).toBe(2);
        expect(state.node).toBe(AD);
        expect(state.nextPrepared).toEqual(pa(5, 'X')); // notre réponse préparée
        expect(state.headlineFr).toContain('(2 sur 2');
    });
});

describe('trackPlan — their-deviation', () => {
    it('pick adverse hors des K branches → casse, breakingAction, branches comparées exposées', () => {
        const state = trackPlan(tree, [act(1, 'Z'), act(2, 'q')], 'blue');
        expect(state.status).toBe('their-deviation');
        expect(state.breakingAction).toEqual({ seq: 2, championKey: 'q', byUs: false });
        expect(state.node).toBeNull();
        expect(state.enemyMatched).toBe(0);
        expect(state.expectedBranches.map((b) => b.championKey)).toEqual(['a', 'b']);
        expect(state.branchesAuthoritative).toBe(true);
        expect(state.headlineFr).toContain('1ʳᵉ action');
        expect(state.headlineFr).toContain('aucune des 2 branches');
        expect(state.headlineFr).toContain('coach en direct reprend la main');
    });

    it('branche périmée par exclusion (Fearless) : filtrée du match, p modèle cité', () => {
        const lockout: PlanTree = { ...tree, excludedKeys: ['a'] };
        const state = trackPlan(lockout, [act(1, 'Z'), act(2, 'a')], 'blue');
        // a est exclue → branches vivantes [b] → a ne matche pas → casse,
        // mais a figurait dans la distribution compilée : p modèle affiché.
        expect(state.status).toBe('their-deviation');
        expect(state.expectedBranches.map((b) => b.championKey)).toEqual(['b']);
        expect(state.headlineFr).toContain('aucune des 1 branche');
        expect(state.headlineFr).toContain('p modèle 50 %');
        expect(state.branchesAuthoritative).toBe(true);
    });
});

describe('trackPlan — our-deviation (persistant)', () => {
    it('notre action hors ligne → our-deviation, branches non garanties, suivi continue', () => {
        const state = trackPlan(tree, [act(1, 'Q'), act(2, 'a')], 'blue');
        expect(state.status).toBe('our-deviation');
        expect(state.breakingAction).toEqual({ seq: 1, championKey: 'Q', byUs: true });
        expect(state.branchesAuthoritative).toBe(false);
        // Le suivi des branches adverses CONTINUE : a matche, on descend.
        expect(state.enemyMatched).toBe(1);
        expect(state.node).toBe(A);
        expect(state.expectedBranches.map((b) => b.championKey)).toEqual(['d']);
        expect(state.nextPrepared).toBeNull(); // plus de « réponse préparée » garantie
        expect(state.headlineFr).toContain('quitté votre ligne');
        expect(state.headlineFr).toContain('indicatif');
    });

    it('JAMAIS de retour on-script : la suite re-matche, le statut reste our-deviation', () => {
        const state = trackPlan(tree, [act(1, 'Q'), act(2, 'a'), act(3, 'Y'), act(4, 'd')], 'blue');
        expect(state.status).toBe('our-deviation');
        expect(state.branchesAuthoritative).toBe(false);
        expect(state.enemyMatched).toBe(2);
        expect(state.node).toBe(AD);
    });

    it('notre déviation CONSOMME une branche : elle est filtrée par disponibilité', () => {
        // Nous jouons « a » nous-mêmes (déviation) : la branche a devient
        // injouable pour eux ; b reste vivante et matche.
        const state = trackPlan(tree, [act(1, 'a'), act(2, 'b')], 'blue');
        expect(state.status).toBe('our-deviation');
        expect(state.enemyMatched).toBe(1);
        expect(state.node).toBe(B);
        expect(state.expectedBranches.map((b) => b.championKey)).toEqual(['e']);
    });

    it('their-deviation APRÈS our-deviation : wording NEUTRE, jamais les chiffres de la gate', () => {
        const state = trackPlan(tree, [act(1, 'Q'), act(2, 'q')], 'blue');
        expect(state.status).toBe('their-deviation');
        expect(state.branchesAuthoritative).toBe(false);
        expect(state.breakingAction).toEqual({ seq: 2, championKey: 'q', byUs: false });
        expect(state.headlineFr).toContain('hors des branches affichées');
        // Ni décompte de branches « préparées », ni p modèle, ni % : neutre.
        expect(state.headlineFr).not.toContain('aucune des');
        expect(state.headlineFr).not.toContain('%');
        expect(state.headlineFr).not.toContain('couverture');
    });
});

describe('trackPlan — beyond-prep et complete', () => {
    const toAD = [act(1, 'Z'), act(2, 'a'), act(3, 'Y'), act(4, 'd'), act(5, 'X')];

    it('action adverse sur un nœud SANS branches (ligne mince) → beyond-prep', () => {
        const state = trackPlan(tree, [...toAD, act(6, 'n')], 'blue');
        expect(state.status).toBe('beyond-prep');
        expect(state.node).toBeNull();
        expect(state.enemyMatched).toBe(2); // les 2 matchs restent au compteur
        expect(state.expectedBranches).toEqual([]);
        expect(state.headlineFr).toContain('Fin de la prep');
        expect(state.headlineFr).toContain('sans casse');
        expect(state.branchesAuthoritative).toBe(true); // on n'a jamais quitté NOTRE ligne
    });

    it('horizon enemySeq null → beyond-prep aussi (chemin B)', () => {
        const state = trackPlan(
            tree,
            [act(1, 'Z'), act(2, 'b'), act(3, 'W'), act(4, 'e'), act(5, 'V'), act(6, 'n')],
            'blue'
        );
        expect(state.status).toBe('beyond-prep');
    });

    it('draft finie (seq 20 joué) → complete, même après un beyond-prep', () => {
        const state = trackPlan(tree, fillToEnd([...toAD, act(6, 'n')]), 'blue');
        expect(state.status).toBe('complete');
        expect(state.expectedBranches).toEqual([]);
        expect(state.nextPrepared).toBeNull();
        expect(state.headlineFr).toContain('Draft terminée');
    });

    it('complete garde la trace d’une casse antérieure (breakingAction, autorité)', () => {
        const state = trackPlan(tree, fillToEnd([act(1, 'Q'), act(2, 'q')]), 'blue');
        expect(state.status).toBe('complete');
        expect(state.breakingAction).toEqual({ seq: 2, championKey: 'q', byUs: false });
        expect(state.branchesAuthoritative).toBe(false);
    });

    it('pur et rejoué : deux appels identiques rendent des états identiques', () => {
        const actions = [act(1, 'Z'), act(2, 'a'), act(3, 'Y')];
        expect(trackPlan(tree, actions, 'blue')).toEqual(trackPlan(tree, actions, 'blue'));
    });
});
