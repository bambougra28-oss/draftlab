/**
 * Chantier « entraînement de prépa » — tests de `$lib/strategic/planDrill`.
 *
 * Mini-arbre construit À LA MAIN (fixture), jamais via compilePlanTree : les
 * lignes, défis et verdicts attendus sont main-calculés. Seqs réels du
 * template blue-first (le type des révélations adverses vient du template) :
 * seq 1 = notre ban, seq 2 = leur ban, etc.
 *
 *           root  ourLine [B1: Z]            enemySeq 2
 *           ├─ a (p 0,6 · 4/6) → A  ourLine [B2: Y, repli Y2]   enemySeq 4
 *           │   ├─ d (p 0,7 · 3/6) → AD  ourLine [B3: X]  (feuille, horizon)
 *           │   └─ e (p 0,3 · 1/6) → AE  ourLine []        (feuille, rien à répondre)
 *           └─ b (p 0,4 · 2/6) → B   ourLine [B2: W]       (feuille, ligne mince)
 *
 * Énumération DFS complète (identités stables) :
 *   ligne 0 = [0,0] (a→d) : défis Z, Y, X
 *   ligne 1 = [0,1] (a→e) : défis Z, Y   (révélation e en fin de ligne : droppée)
 *   ligne 2 = [1]   (b)   : défis Z, W
 */
import { describe, it, expect } from 'vitest';
import {
    answer,
    currentChallenge,
    drillSummary,
    startDrill,
    type DrillState
} from '$lib/strategic/planDrill';
import { mulberry32 } from '$lib/backtest/metrics';
import type { PlanTree, PlanTreeNode } from '$lib/strategic/planTree';

const leaf = (ourLine: PlanTreeNode['ourLine'], pathMass: number): PlanTreeNode => ({
    ourLine,
    enemySeq: null,
    branches: [],
    pathMass
});

const nodeAD = leaf([{ seq: 5, type: 'ban', championKey: 'X' }], 0.42);
const nodeAE = leaf([], 0.18);
const nodeB = leaf([{ seq: 3, type: 'ban', championKey: 'W' }], 0.4);

const nodeA: PlanTreeNode = {
    ourLine: [{ seq: 3, type: 'ban', championKey: 'Y', fallback: 'Y2', reasonsFr: ['anti-flex mid'] }],
    enemySeq: 4,
    branches: [
        { championKey: 'd', p: 0.7, rawCount: 3, total: 6, child: nodeAD },
        { championKey: 'e', p: 0.3, rawCount: 1, total: 6, child: nodeAE }
    ],
    pathMass: 0.6
};

const tree: PlanTree = {
    planId: 'p1',
    opponent: 'KOI',
    ourSide: 'blue',
    builtAt: 1000,
    modelProvenance: { records: 12 },
    config: { branchK: 2, enemyDepth: 2, minPathMass: 0, maxNodes: 2000, replyMassFloor: 0.05 },
    excludedKeys: [],
    root: {
        ourLine: [{ seq: 1, type: 'ban', championKey: 'Z', reasonsFr: ['cible B1'] }],
        enemySeq: 2,
        branches: [
            { championKey: 'a', p: 0.6, rawCount: 4, total: 6, child: nodeA },
            { championKey: 'b', p: 0.4, rawCount: 2, total: 6, child: nodeB }
        ],
        pathMass: 1
    },
    nodeCount: 5
};

/** Répond la suite donnée, retourne l'état final. */
function play(state: DrillState, keys: string[]): DrillState {
    let s = state;
    for (const key of keys) s = answer(s, key).state;
    return s;
}

describe('startDrill — mode principale (la ligne de masse max)', () => {
    it('suit a (0,6) puis d (0,7) : défis Z, Y, X ; identité de ligne = index DFS 0', () => {
        const state = startDrill(tree, { mode: 'principale' });
        expect(state.lines).toHaveLength(1);
        expect(state.lines[0].branchPath).toEqual([0, 0]);
        expect(state.lines[0].sourceIndex).toBe(0);
        expect(state.lines[0].challenges.map((c) => c.expected.championKey)).toEqual(['Z', 'Y', 'X']);
        expect(state.done).toBe(false);
    });

    it('défi 1 = ouverture : aucune révélation adverse, chemin vide', () => {
        const state = startDrill(tree, { mode: 'principale' });
        const challenge = currentChallenge(state);
        expect(challenge).not.toBeNull();
        expect(challenge?.enemyMovesJustPlayed).toEqual([]);
        expect(challenge?.expected).toEqual({ seq: 1, type: 'ban', championKey: 'Z', reasonsFr: ['cible B1'] });
        expect(challenge?.seq).toBe(1);
        expect(challenge?.type).toBe('ban');
        expect(challenge?.pathSoFar).toEqual([]);
        expect(challenge?.lineIndex).toBe(0);
        expect(challenge?.lineCount).toBe(1);
    });

    it('défi 2 : la branche révélée porte p + évidence + seq/type du template', () => {
        const state = play(startDrill(tree, { mode: 'principale' }), ['Z']);
        const challenge = currentChallenge(state);
        expect(challenge?.enemyMovesJustPlayed).toEqual([
            { seq: 2, type: 'ban', championKey: 'a', p: 0.6, rawCount: 4, total: 6 }
        ]);
        expect(challenge?.expected.championKey).toBe('Y');
        // Le chemin joué contient notre Z (verdict primaire) ; la révélation « a »
        // reste dans enemyMovesJustPlayed (affichée « Ils jouent a ») et ne
        // rejoint le chemin qu'une fois le défi répondu.
        expect(challenge?.pathSoFar).toEqual([
            { by: 'nous', seq: 1, type: 'ban', championKey: 'Z', answeredKey: 'Z', verdict: 'primaire' }
        ]);
    });
});

describe('answer — verdicts primaire / fallback / faux', () => {
    it('primaire : la clé préparée exacte', () => {
        const result = answer(startDrill(tree, { mode: 'principale' }), 'Z');
        expect(result.correct).toBe('primaire');
        expect(result.expected.championKey).toBe('Z');
        expect(result.lineComplete).toBe(false);
        expect(result.done).toBe(false);
        expect(result.state.counts).toEqual({ primaire: 1, fallback: 0, faux: 0 });
    });

    it('fallback : le repli compte à part et ne crée PAS de raté', () => {
        const state = play(startDrill(tree, { mode: 'principale' }), ['Z']);
        const result = answer(state, 'Y2');
        expect(result.correct).toBe('fallback');
        expect(result.expected).toEqual({
            seq: 3,
            type: 'ban',
            championKey: 'Y',
            fallback: 'Y2',
            reasonsFr: ['anti-flex mid']
        });
        expect(result.state.counts).toEqual({ primaire: 1, fallback: 1, faux: 0 });
        expect(result.state.misses).toEqual([]);
    });

    it('faux : raté listé avec chemin adverse, ta réponse et la préparée', () => {
        const state = play(startDrill(tree, { mode: 'principale' }), ['Z', 'Y']);
        const result = answer(state, 'Q'); // attendu : X
        expect(result.correct).toBe('faux');
        expect(result.lineComplete).toBe(true); // dernier défi de la ligne
        expect(result.done).toBe(true); // une seule ligne en principale
        const miss = result.state.misses[0];
        expect(miss.lineIndex).toBe(0);
        expect(miss.enemyPath).toEqual(['a', 'd']);
        expect(miss.answered).toBe('Q');
        expect(miss.expected.championKey).toBe('X');
        expect(miss.seq).toBe(5);
        expect(miss.pathSteps.at(-1)).toEqual({
            by: 'nous',
            seq: 5,
            type: 'ban',
            championKey: 'X',
            answeredKey: 'Q',
            verdict: 'faux'
        });
        // L'état d'entrée n'est PAS muté (answer est pur).
        expect(state.counts).toEqual({ primaire: 2, fallback: 0, faux: 0 });
        expect(currentChallenge(result.state)).toBeNull();
    });

    it('session finie : answer jette, currentChallenge rend null', () => {
        const state = play(startDrill(tree, { mode: 'principale' }), ['Z', 'Y', 'X']);
        expect(state.done).toBe(true);
        expect(currentChallenge(state)).toBeNull();
        expect(() => answer(state, 'Z')).toThrow(/terminée/);
    });
});

describe('mode pondere — rng injecté, jamais Math.random', () => {
    it('sans rng : erreur explicite', () => {
        expect(() => startDrill(tree, { mode: 'pondere' })).toThrow(/rng/);
    });

    it('rng constant 0 → première branche partout (a puis d)', () => {
        const state = startDrill(tree, { mode: 'pondere', rng: () => 0 });
        expect(state.lines[0].branchPath).toEqual([0, 0]);
        expect(state.lines[0].sourceIndex).toBe(0);
    });

    it('rng constant 0,99 → dernière branche : b (0,99 > 0,6) — ligne DFS 2', () => {
        const state = startDrill(tree, { mode: 'pondere', rng: () => 0.99 });
        expect(state.lines[0].branchPath).toEqual([1]);
        expect(state.lines[0].sourceIndex).toBe(2);
        expect(state.lines[0].challenges.map((c) => c.expected.championKey)).toEqual(['Z', 'W']);
    });

    it('rng 0,7 à la racine → b (0,7 ≥ 0,6 cumulé de a)', () => {
        const state = startDrill(tree, { mode: 'pondere', rng: () => 0.7 });
        expect(state.lines[0].branchPath).toEqual([1]);
    });

    it('déterministe à seed fixé : deux sessions mulberry32(42) = la même ligne', () => {
        const a = startDrill(tree, { mode: 'pondere', rng: mulberry32(42) });
        const b = startDrill(tree, { mode: 'pondere', rng: mulberry32(42) });
        expect(a.lines[0].branchPath).toEqual(b.lines[0].branchPath);
    });
});

describe('mode exhaustif — toutes les lignes, une après l’autre, sans doublon', () => {
    it('énumère les 3 lignes DFS dans l’ordre, branche de masse max d’abord', () => {
        const state = startDrill(tree, { mode: 'exhaustif' });
        expect(state.lines.map((l) => l.branchPath)).toEqual([[0, 0], [0, 1], [1]]);
        expect(state.lines.map((l) => l.sourceIndex)).toEqual([0, 1, 2]);
        // Aucun doublon : identités de chemins toutes distinctes.
        const ids = state.lines.map((l) => l.branchPath.join('.'));
        expect(new Set(ids).size).toBe(ids.length);
        // La ligne a→e droppe la révélation finale (AE n'a rien à répondre).
        expect(state.lines[1].challenges.map((c) => c.expected.championKey)).toEqual(['Z', 'Y']);
        expect(state.lines[2].challenges.map((c) => c.expected.championKey)).toEqual(['Z', 'W']);
    });

    it('fin de ligne → résultat de ligne puis enchaîne la suivante (chemin remis à zéro)', () => {
        let state = startDrill(tree, { mode: 'exhaustif' });
        state = play(state, ['Z', 'Y']);
        const result = answer(state, 'X'); // dernier défi de la ligne 0
        expect(result.lineComplete).toBe(true);
        expect(result.done).toBe(false);
        expect(result.completedLineSteps?.map((s) => s.championKey)).toEqual(['Z', 'a', 'Y', 'd', 'X']);
        const next = currentChallenge(result.state);
        // Ligne suivante : l'ouverture est re-drillée (« encore et encore »).
        expect(next?.lineIndex).toBe(1);
        expect(next?.expected.championKey).toBe('Z');
        expect(next?.enemyMovesJustPlayed).toEqual([]);
        expect(next?.pathSoFar).toEqual([]);
    });

    it('session complète : 7 défis, linesPlayed 3, done', () => {
        const state = play(startDrill(tree, { mode: 'exhaustif' }), ['Z', 'Y', 'X', 'Z', 'Y', 'Z', 'W']);
        expect(state.done).toBe(true);
        expect(state.linesPlayed).toBe(3);
        expect(state.counts).toEqual({ primaire: 7, fallback: 0, faux: 0 });
        expect(state.misses).toEqual([]);
    });

    it('onlyLines = [2] : session restreinte à la ligne b (« rejouer les ratés »)', () => {
        const state = startDrill(tree, { mode: 'exhaustif', onlyLines: [2] });
        expect(state.lines).toHaveLength(1);
        expect(state.lines[0].sourceIndex).toBe(2);
        expect(state.lines[0].challenges.map((c) => c.expected.championKey)).toEqual(['Z', 'W']);
    });
});

describe('drillSummary — le bilan exact, et la boucle « rejouer les ratés »', () => {
    it('main-calculé : 2 fautes sur 2 lignes distinctes, fallback compté à part', () => {
        // Ligne 0 : Z ok, Y2 (repli), X ok. Ligne 1 : Z ok, FAUTE (Q au lieu de Y).
        // Ligne 2 : FAUTE (Q2 au lieu de Z), W ok.
        const state = play(startDrill(tree, { mode: 'exhaustif' }), ['Z', 'Y2', 'X', 'Z', 'Q', 'Q2', 'W']);
        const summary = drillSummary(state);
        expect(summary.mode).toBe('exhaustif');
        expect(summary.lineCount).toBe(3);
        expect(summary.linesPlayed).toBe(3);
        expect(summary.done).toBe(true);
        expect(summary.counts).toEqual({ primaire: 4, fallback: 1, faux: 2 });
        expect(summary.misses).toHaveLength(2);
        expect(summary.misses[0]).toMatchObject({
            lineIndex: 1,
            enemyPath: ['a'],
            answered: 'Q',
            expected: { championKey: 'Y', fallback: 'Y2' }
        });
        expect(summary.misses[1]).toMatchObject({
            lineIndex: 2,
            enemyPath: [],
            answered: 'Q2',
            expected: { championKey: 'Z' }
        });
        expect(summary.failedLineIndexes).toEqual([1, 2]);
    });

    it('les failedLineIndexes re-drillent EXACTEMENT les lignes fautées', () => {
        const first = play(startDrill(tree, { mode: 'exhaustif' }), ['Z', 'Y', 'X', 'Z', 'Q', 'Z', 'W']);
        const failed = drillSummary(first).failedLineIndexes;
        expect(failed).toEqual([1]);
        const redo = startDrill(tree, { mode: 'exhaustif', onlyLines: failed });
        expect(redo.lines.map((l) => l.branchPath)).toEqual([[0, 1]]);
        const done = play(redo, ['Z', 'Y']);
        expect(drillSummary(done)).toMatchObject({
            linesPlayed: 1,
            counts: { primaire: 2, fallback: 0, faux: 0 },
            failedLineIndexes: []
        });
    });

    it('résumé en cours de session : compte partiel, done false', () => {
        const state = play(startDrill(tree, { mode: 'exhaustif' }), ['Z', 'Y2']);
        const summary = drillSummary(state);
        expect(summary.done).toBe(false);
        expect(summary.linesPlayed).toBe(0);
        expect(summary.counts).toEqual({ primaire: 1, fallback: 1, faux: 0 });
    });
});

describe('cas limites', () => {
    it('arbre sans aucun défi (aucune action à nous) : done dès le départ', () => {
        const empty: PlanTree = {
            ...tree,
            root: { ourLine: [], enemySeq: null, branches: [], pathMass: 1 }
        };
        const state = startDrill(empty, { mode: 'exhaustif' });
        expect(state.done).toBe(true);
        expect(currentChallenge(state)).toBeNull();
        expect(drillSummary(state)).toMatchObject({ lineCount: 0, linesPlayed: 0, done: true });
    });

    it('deux tours adverses adjacents : le défi porte LES DEUX révélations', () => {
        // root (nous seq 7) → leur seq 8 → nœud intermédiaire SANS action à nous
        // → leur seq 9 → nos seq 10. Pattern réel du template (pick1 blue).
        const inner: PlanTreeNode = {
            ourLine: [],
            enemySeq: 9,
            branches: [
                {
                    championKey: 'r2',
                    p: 1,
                    rawCount: 2,
                    total: 2,
                    child: leaf([{ seq: 10, type: 'pick', championKey: 'M1' }], 0.5)
                }
            ],
            pathMass: 0.5
        };
        const twoTurns: PlanTree = {
            ...tree,
            root: {
                ourLine: [{ seq: 7, type: 'pick', championKey: 'T1' }],
                enemySeq: 8,
                branches: [{ championKey: 'r1', p: 0.5, rawCount: 1, total: 2, child: inner }],
                pathMass: 1
            }
        };
        const state = play(startDrill(twoTurns, { mode: 'principale' }), ['T1']);
        const challenge = currentChallenge(state);
        expect(challenge?.enemyMovesJustPlayed.map((m) => `${m.seq}:${m.championKey}:${m.type}`)).toEqual([
            '8:r1:pick',
            '9:r2:pick'
        ]);
        expect(challenge?.expected.championKey).toBe('M1');
    });
});
