import { describe, expect, it } from 'vitest';
import {
    DEFAULT_SERIES_KNAPSACK_CONFIG,
    makeSeriesAwareEvaluator,
    poolValue,
    seriesEdge,
    seriesTermOf,
    type SeriesKnapsackConfig
} from '$lib/strategic/seriesKnapsack';
import type { SeriesState } from '$lib/strategic/seriesSolver';
import type { ChampionPoolEntry } from '$lib/pro/types';
import { Role, ROLES } from '$lib/types';

/*
 * Arithmétique partagée des calculs à la main (shrinkWinrate, priorMean 0,5,
 * priorN 10) :
 *   8/10 → (8+5)/20 = 0,65    6/10 → (6+5)/20 = 0,55
 *   5/10 → 0,50               2/10 → (2+5)/20 = 0,35    0/0 → 5/10 = 0,50
 * poolValue par rôle = Σ_{i≤topN} ω^(i−1)·posterior_i (desc), ω = 0,5 :
 * poids 1, 0,5, 0,25. Rôle sans entrée restante ⇒ 0 (Σ gelée, pas de plancher).
 */

const entry = (championKey: string, wins: number, games: number): ChampionPoolEntry => ({
    championKey,
    wins,
    games
});

type Pools = Partial<Record<Role, ChampionPoolEntry[]>>;

/** Un champion 5/10 (posterior 0,5) par rôle, clés `${prefix}${role}`. */
function evenPools(prefix: string): Pools {
    const pools: Pools = {};
    for (const role of ROLES) pools[role] = [entry(`${prefix}${role}`, 5, 10)];
    return pools;
}

function stateOf(over: Partial<SeriesState> = {}): SeriesState {
    return {
        gameNumber: 1,
        format: 'bo3',
        score: { ally: 0, enemy: 0 },
        mode: 'fearless',
        poolsBySide: { ally: evenPools('a'), enemy: evenPools('e') },
        consumed: new Set<string>(),
        ...over
    };
}

describe('DEFAULT_SERIES_KNAPSACK_CONFIG — constantes gelées', () => {
    it('topN 3, ω 0,5, γ 0,5, shrinkage 0,5/10, emptyRoleQuality 0,25', () => {
        expect(DEFAULT_SERIES_KNAPSACK_CONFIG).toEqual({
            topN: 3,
            omega: 0.5,
            gamma: 0.5,
            priorMean: 0.5,
            priorN: 10,
            emptyRoleQuality: 0.25
        });
    });
});

describe('poolValue — S_side(σ) à la main', () => {
    it('posteriors EB exacts et Σ ω^(i−1)·posterior : Top 0,9875, total 2,9875', () => {
        const ally = evenPools('a');
        ally[Role.Top] = [entry('A', 8, 10), entry('B', 5, 10), entry('C', 2, 10)];
        const state = stateOf({ poolsBySide: { ally, enemy: evenPools('e') } });
        const breakdown = poolValue(state, 'ally');
        // Top : 1·0,65 + 0,5·0,5 + 0,25·0,35 = 0,9875 ; 4 rôles à 0,5.
        const top = breakdown.byRole.find((r) => r.role === Role.Top);
        expect(top?.value).toBeCloseTo(0.9875, 12);
        expect(top?.entries).toEqual([
            { championKey: 'A', posterior: 0.65, weight: 1 },
            { championKey: 'B', posterior: 0.5, weight: 0.5 },
            { championKey: 'C', posterior: 0.35, weight: 0.25 }
        ]);
        expect(breakdown.total).toBeCloseTo(2.9875, 12);
        expect(breakdown.side).toBe('ally');
        expect(breakdown.byRole).toHaveLength(5);
    });

    it('tronque à topN (le 4e comfort ne compte pas)', () => {
        const ally = evenPools('a');
        ally[Role.Top] = [entry('A', 8, 10), entry('D', 6, 10), entry('B', 5, 10), entry('C', 2, 10)];
        const state = stateOf({ poolsBySide: { ally, enemy: evenPools('e') } });
        const top = poolValue(state, 'ally').byRole.find((r) => r.role === Role.Top);
        // 1·0,65 + 0,5·0,55 + 0,25·0,5 = 1,05 — C (0,35) hors topN.
        expect(top?.value).toBeCloseTo(1.05, 12);
        expect(top?.entries).toHaveLength(3);
        expect(top?.entries.map((e) => e.championKey)).toEqual(['A', 'D', 'B']);
    });

    it('les consommés sortent du pool avant le tri', () => {
        const ally = evenPools('a');
        ally[Role.Top] = [entry('A', 8, 10), entry('D', 6, 10), entry('B', 5, 10), entry('C', 2, 10)];
        const state = stateOf({ poolsBySide: { ally, enemy: evenPools('e') }, consumed: new Set(['A']) });
        const top = poolValue(state, 'ally').byRole.find((r) => r.role === Role.Top);
        // 1·0,55 + 0,5·0,5 + 0,25·0,35 = 0,8875.
        expect(top?.value).toBeCloseTo(0.8875, 12);
    });

    it('rôle sans entrée restante ⇒ 0 (Σ gelée), entrée 0/0 ⇒ posterior 0,5', () => {
        const ally = evenPools('a');
        delete ally[Role.Top];
        ally[Role.Jungle] = [entry('N', 0, 0)];
        const state = stateOf({ poolsBySide: { ally, enemy: evenPools('e') } });
        const breakdown = poolValue(state, 'ally');
        const top = breakdown.byRole.find((r) => r.role === Role.Top);
        expect(top?.value).toBe(0);
        expect(top?.entries).toEqual([]);
        const jungle = breakdown.byRole.find((r) => r.role === Role.Jungle);
        expect(jungle?.value).toBeCloseTo(0.5, 12);
        expect(breakdown.total).toBeCloseTo(0 + 4 * 0.5, 12);
    });
});

describe('seriesEdge — S_ally − S_enemy', () => {
    it('édge à la main : 2,9875 − 2,5 = 0,4875', () => {
        const ally = evenPools('a');
        ally[Role.Top] = [entry('A', 8, 10), entry('B', 5, 10), entry('C', 2, 10)];
        const state = stateOf({ poolsBySide: { ally, enemy: evenPools('e') } });
        expect(seriesEdge(state)).toBeCloseTo(0.4875, 12);
    });

    it('pools symétriques ⇒ édge nul', () => {
        expect(seriesEdge(stateOf())).toBeCloseTo(0, 12);
    });
});

/*
 * Fixtures du terme :
 *  - symétrique : X (8/10) au Top des DEUX pools, le reste 5/10 partout.
 *    S_side(σ) = (0,65 + 0,5·0,5) + 4·0,5 = 2,9 des deux côtés.
 *    Consommer X : Top → 0,5 → S = 2,5. selfCost = −0,4 ; denialGain = +0,4 ;
 *    deltaEdge = 0.
 *  - asymétrique : X uniquement chez NOUS → selfCost −0,4, denialGain 0,
 *    deltaEdge −0,4, γ·Δ = −0,2.
 */
function symmetricState(): SeriesState {
    const ally = evenPools('a');
    ally[Role.Top] = [entry('X', 8, 10), entry('Y', 5, 10)];
    const enemy = evenPools('e');
    enemy[Role.Top] = [entry('X', 8, 10), entry('W', 5, 10)];
    return stateOf({ poolsBySide: { ally, enemy } });
}

function asymmetricState(): SeriesState {
    const ally = evenPools('a');
    ally[Role.Top] = [entry('X', 8, 10), entry('Y', 5, 10)];
    return stateOf({ poolsBySide: { ally, enemy: evenPools('e') } });
}

describe('seriesTermOf — décomposition coût propre + déni', () => {
    it('X dans les deux pools : selfCost −0,4, denialGain +0,4, deltaEdge 0', () => {
        const term = seriesTermOf('X', symmetricState());
        expect(term.selfCost).toBeCloseTo(-0.4, 12);
        expect(term.denialGain).toBeCloseTo(0.4, 12);
        expect(term.deltaEdge).toBeCloseTo(0, 12);
        expect(term.gammaWeighted).toBeCloseTo(0, 12);
    });

    it('additivité exacte : selfCost + denialGain === deltaEdge (DA-V2-12)', () => {
        const term = seriesTermOf('X', symmetricState());
        expect(term.selfCost + term.denialGain).toBe(term.deltaEdge);
    });

    it('deltaEdge = seriesEdge(σ ∪ {c}) − seriesEdge(σ)', () => {
        const state = asymmetricState();
        const term = seriesTermOf('X', state);
        const after = { ...state, consumed: new Set([...state.consumed, 'X']) };
        expect(term.deltaEdge).toBeCloseTo(seriesEdge(after) - seriesEdge(state), 12);
    });

    it('champion seulement chez nous : déni nul, coût propre plein', () => {
        const term = seriesTermOf('X', asymmetricState());
        expect(term.selfCost).toBeCloseTo(-0.4, 12);
        expect(term.denialGain).toBeCloseTo(0, 12);
        expect(term.deltaEdge).toBeCloseTo(-0.4, 12);
        expect(term.gammaWeighted).toBeCloseTo(-0.2, 12); // γ = 0,5
    });

    it('candidat absent des deux pools ⇒ terme nul ; déjà consommé ⇒ terme nul', () => {
        const absent = seriesTermOf('nulle-part', symmetricState());
        expect(absent).toEqual({
            championKey: 'nulle-part',
            selfCost: 0,
            denialGain: 0,
            deltaEdge: 0,
            gammaWeighted: 0
        });
        const state = symmetricState();
        state.consumed.add('X');
        const consumed = seriesTermOf('X', state);
        expect(consumed.deltaEdge).toBe(0);
        expect(consumed.selfCost).toBe(0);
        expect(consumed.denialGain).toBe(0);
    });

    it('γ injectable pondère le composant affiché', () => {
        const config: SeriesKnapsackConfig = { ...DEFAULT_SERIES_KNAPSACK_CONFIG, gamma: 0.25 };
        const term = seriesTermOf('X', asymmetricState(), config);
        expect(term.gammaWeighted).toBeCloseTo(-0.1, 12);
    });

    it('ne mute jamais σ', () => {
        const state = symmetricState();
        seriesTermOf('X', state);
        expect(state.consumed.has('X')).toBe(false);
    });
});

describe('makeSeriesAwareEvaluator — evaluate + γ·ΔS', () => {
    /** Base déterministe sensible aux arguments (vérifie le passage des clés). */
    const base = (allyKeys: string[], enemyKeys: string[]): number =>
        0.6 + 0.01 * allyKeys.length - 0.02 * enemyKeys.length;

    it('= base + γ·[seriesEdge(σ ∪ picks ligne) − seriesEdge(σ)] exactement', () => {
        const evaluate = makeSeriesAwareEvaluator(base, asymmetricState());
        // Ligne [X] alliée : Δ = −0,4 → 0,61 + 0,5·(−0,4) = 0,41.
        expect(evaluate(['X'], [])).toBeCloseTo(0.41, 12);
    });

    it('les picks ADVERSES consomment aussi (hard Fearless ampute les deux pools)', () => {
        const evaluate = makeSeriesAwareEvaluator(base, asymmetricState());
        // X picked par l'ennemi : il sort AUSSI de notre pool → même Δ = −0,4.
        // base([], ['X']) = 0,58 → 0,58 − 0,2 = 0,38.
        expect(evaluate([], ['X'])).toBeCloseTo(0.38, 12);
    });

    it('aucune clé (bans non transmis) ⇒ exactement base : un ban ne consomme rien', () => {
        const evaluate = makeSeriesAwareEvaluator(base, symmetricState());
        // Le navigator ne transmet que realPicks : les bans n'entrent jamais
        // dans σ. Sans pick, ΔS = 0 et l'évaluateur rend la base telle quelle.
        expect(evaluate([], [])).toBe(base([], []));
    });

    it('clés hors pools ⇒ terme nul, base inchangée', () => {
        const evaluate = makeSeriesAwareEvaluator(base, symmetricState());
        expect(evaluate(['hors-pool'], ['autre'])).toBeCloseTo(base(['hors-pool'], ['autre']), 12);
    });

    it('γ injectable et σ jamais muté entre les appels', () => {
        const state = asymmetricState();
        const config: SeriesKnapsackConfig = { ...DEFAULT_SERIES_KNAPSACK_CONFIG, gamma: 0.25 };
        const evaluate = makeSeriesAwareEvaluator(base, state, config);
        // 0,61 + 0,25·(−0,4) = 0,51.
        expect(evaluate(['X'], [])).toBeCloseTo(0.51, 12);
        expect(state.consumed.size).toBe(0); // pas de mutation
        // Appels répétés : même résultat (pureté).
        expect(evaluate(['X'], [])).toBeCloseTo(0.51, 12);
    });

    it('le terme se compose avec les consommés déjà dans σ', () => {
        // X déjà consommé dans σ : la ligne [X] n'ajoute rien → ΔS = 0.
        const state = asymmetricState();
        state.consumed.add('X');
        const evaluate = makeSeriesAwareEvaluator(base, state);
        expect(evaluate(['X'], [])).toBeCloseTo(base(['X'], []), 12);
    });
});
