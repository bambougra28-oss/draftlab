/**
 * Chantier F (F-d) — fearlessEndgame : bornes gelées, espace AVANT recherche,
 * bascule ≤ 1e6, expectimax exhaustif via navigate (rien recodé).
 *
 * Nombre de tests DÉRIVÉ À LA MAIN :
 *  - mini-arbre 2×2 calculé à la main (0,54 / ligne pick:X→pick:P) ... 1 test
 *  - coïncidence PAR CONSTRUCTION avec le depth-2 shippé (2 slots
 *    restants ⇒ exhaustif ≡ navigate depth 2) ........................ 1 test
 *  - espace 8⁴ = 4096 ≤ 1e6 → bascule ................................ 1 test
 *  - espace 8⁸ ≈ 1,7·10⁷ > 1e6 → PAS de bascule, évaluateur JAMAIS
 *    appelé (espace calculé avant toute recherche) ................... 1 test
 *  - memo réduit les nœuds (spy sur l'évaluateur, 2ᵉ run < 1ᵉʳ) ...... 1 test
 *  - horloge INJECTÉE : elapsedMs = 250 exact (stub 100 → 350) ....... 1 test
 *  - |C_s| : filtre disponibilité + troncature surpriseK (défaut 8
 *    commité ; config injectée surpriseK = 2) ........................ 1 test
 *  - racine adverse : valeur = espérance 0,75·0,6 + 0,25·0,4 = 0,55 .. 1 test
 *  TOTAL ............................................................. 8 tests
 *
 * Arithmétique du mini-arbre 2×2 (slots restants 19 = nous, 20 = eux) :
 *   e(X,P)=0,7  e(X,Q)=0,3  e(Y,P)=0,45  e(Y,Q)=0,65 ; range {P:0,6, Q:0,4}
 *   v(X) = 0,6·0,7 + 0,4·0,3 = 0,54 ; v(Y) = 0,6·0,45 + 0,4·0,65 = 0,53
 *   ⇒ max = X (0,54), ligne principale = pick:X puis pick:P (plus probable).
 */
import { describe, expect, it } from 'vitest';
import {
    ENDGAME_SPACE_MAX,
    searchFearlessEndgame,
    type FearlessEndgameContext
} from '$lib/strategic/fearlessEndgame';
import { DRAFT_TEMPLATE } from '$lib/data/draftRecord';
import { navigate, type DraftState, type NavigatorMemoEntry } from '$lib/strategic/draftNavigator';
import { DEFAULT_RANGE_MODEL_CONFIG } from '$lib/strategic/rangeModelConfig';
import type { DraftAction } from '$lib/data/types';

// ---- état : template rempli jusqu'à un seq donné ---------------------------------

function stateThrough(lastSeq: number, available: string[]): DraftState {
    const actions: DraftAction[] = DRAFT_TEMPLATE.filter((slot) => slot.seq <= lastSeq).map((slot) => ({
        seq: slot.seq,
        type: slot.type,
        phase: slot.phase,
        side: slot.first ? 'blue' : 'red', // firstPickSide blue
        championKey: `s${slot.seq}`,
        championName: `s${slot.seq}`
    }));
    return { actions, firstPickSide: 'blue', available: new Set(available) };
}

// ---- mini-arbre 2×2 ----------------------------------------------------------------

const MINI_TABLE: Record<string, number> = { 'X|P': 0.7, 'X|Q': 0.3, 'Y|P': 0.45, 'Y|Q': 0.65 };

const miniEvaluate = (ally: string[], enemy: string[]): number => {
    const a = ally.includes('X') ? 'X' : ally.includes('Y') ? 'Y' : '?';
    const e = enemy.includes('P') ? 'P' : enemy.includes('Q') ? 'Q' : '?';
    return MINI_TABLE[`${a}|${e}`] ?? 0.5;
};

function miniCtx(over: Partial<FearlessEndgameContext> = {}): FearlessEndgameContext {
    return {
        ourSide: 'blue',
        ourCandidatesForSlot: () => ['X', 'Y'],
        enemyRangeForSlot: () => [
            { championKey: 'P', p: 0.6 },
            { championKey: 'Q', p: 0.4 }
        ],
        evaluate: miniEvaluate,
        ...over
    };
}

const miniState = (): DraftState => stateThrough(18, ['X', 'Y', 'P', 'Q']);

// ---- contexte 8 candidats par slot ---------------------------------------------------

const OURS_8 = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8'];
const ENEMY_8 = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'];

function eightCtx(evaluate: FearlessEndgameContext['evaluate']): FearlessEndgameContext {
    return {
        ourSide: 'blue',
        ourCandidatesForSlot: () => OURS_8,
        enemyRangeForSlot: () => ENEMY_8.map((championKey) => ({ championKey, p: 0.125 })),
        evaluate
    };
}

describe('searchFearlessEndgame — bornes gelées', () => {
    it('mini-arbre 2×2 à la main : valeur 0,54, ligne pick:X → pick:P, espace 4', () => {
        const result = searchFearlessEndgame(miniState(), miniCtx());
        expect(result.searched).toBe(true);
        expect(result.spaceSize).toBe(4);
        expect(result.value).toBeCloseTo(0.54, 12);
        expect(result.bestLine).toEqual(['pick:X', 'pick:P']);
    });

    it('coïncidence PAR CONSTRUCTION : 2 slots restants ⇒ exhaustif ≡ navigate depth-2 shippé', () => {
        const state = miniState();
        const ctx = miniCtx();
        const exhaustive = searchFearlessEndgame(state, ctx);
        const shipped = navigate(state, {
            ourSide: 'blue',
            ourCandidates: () => ['X', 'Y'],
            enemyDistribution: () => [
                { championKey: 'P', p: 0.6 },
                { championKey: 'Q', p: 0.4 }
            ],
            evaluate: miniEvaluate,
            depth: 2,
            topK: DEFAULT_RANGE_MODEL_CONFIG.surpriseK
        });
        expect(exhaustive.value).toBeCloseTo(shipped.candidates[0].value, 12);
        expect(exhaustive.bestLine).toEqual(shipped.candidates[0].line);
    });

    it('4 derniers picks à 8 candidats : espace 8⁴ = 4096 ≤ 1e6 → bascule', () => {
        const state = stateThrough(16, [...OURS_8, ...ENEMY_8]);
        const result = searchFearlessEndgame(state, eightCtx(() => 0.5));
        expect(result.spaceSize).toBe(4096);
        expect(result.searched).toBe(true);
        expect(result.value).toBeCloseTo(0.5, 12);
        expect(ENDGAME_SPACE_MAX).toBe(1e6);
    });

    it('8 slots restants : 8⁸ = 16 777 216 > 1e6 → pas de bascule, évaluateur JAMAIS appelé', () => {
        let calls = 0;
        const state = stateThrough(12, [...OURS_8, ...ENEMY_8]);
        const result = searchFearlessEndgame(
            state,
            eightCtx(() => {
                calls += 1;
                return 0.5;
            })
        );
        expect(result.spaceSize).toBe(8 ** 8);
        expect(result.searched).toBe(false);
        expect(result.bestLine).toEqual([]);
        expect(Number.isNaN(result.value)).toBe(true);
        expect(calls).toBe(0); // l'espace est calculé AVANT toute recherche
    });

    it('memo par état : le 2ᵉ run sur le même memo appelle (spy) moins l’évaluateur', () => {
        let calls = 0;
        const spied = (): number => {
            calls += 1;
            return 0.5;
        };
        const memo = new Map<string, NavigatorMemoEntry>();
        const state = stateThrough(16, [...OURS_8, ...ENEMY_8]);
        const first = searchFearlessEndgame(state, { ...eightCtx(spied), memo });
        const callsFirst = calls;
        calls = 0;
        const second = searchFearlessEndgame(state, { ...eightCtx(spied), memo });
        expect(calls).toBeLessThan(callsFirst);
        expect(second.value).toBeCloseTo(first.value, 12);
        expect(callsFirst).toBeGreaterThan(0);
    });

    it('horloge INJECTÉE : stub 100 → 350 ⇒ elapsedMs = 250 exact', () => {
        const ticks = [100, 350];
        const result = searchFearlessEndgame(miniState(), miniCtx({ now: () => ticks.shift() ?? 350 }));
        expect(result.elapsedMs).toBe(250);
    });

    it('|C_s| : disponibilité filtrée puis troncature à surpriseK (8 commité ; injectable)', () => {
        // Seam à 10 candidats dont 1 indisponible ⇒ 9 disponibles → tronqués à 8.
        const ten = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9', 'indispo'];
        const state = stateThrough(18, [...ten.filter((k) => k !== 'indispo'), 'e1', 'e2']);
        const ctx: FearlessEndgameContext = {
            ourSide: 'blue',
            ourCandidatesForSlot: () => ten,
            enemyRangeForSlot: () => [
                { championKey: 'e1', p: 0.5 },
                { championKey: 'e2', p: 0.5 }
            ],
            evaluate: () => 0.5
        };
        expect(searchFearlessEndgame(state, ctx).spaceSize).toBe(8 * 2);
        const k2 = { ...DEFAULT_RANGE_MODEL_CONFIG, surpriseK: 2 };
        expect(searchFearlessEndgame(state, { ...ctx, config: k2 }).spaceSize).toBe(2 * 2);
    });

    it('racine adverse : valeur = espérance sur leur range (0,75·0,6 + 0,25·0,4 = 0,55)', () => {
        const state = stateThrough(19, ['P', 'Q']);
        const result = searchFearlessEndgame(state, {
            ourSide: 'blue',
            ourCandidatesForSlot: () => [],
            enemyRangeForSlot: () => [
                { championKey: 'P', p: 0.75 },
                { championKey: 'Q', p: 0.25 }
            ],
            evaluate: (_ally, enemy) => (enemy.includes('P') ? 0.6 : enemy.includes('Q') ? 0.4 : 0.5)
        });
        expect(result.searched).toBe(true);
        expect(result.spaceSize).toBe(2);
        expect(result.value).toBeCloseTo(0.55, 12);
        expect(result.bestLine).toEqual(['pick:P']);
    });
});
