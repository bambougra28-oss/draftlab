/**
 * Chantier C — Le terme moteur série (docs/run2/C-fearless-g3.md §2.3) :
 * le terme JueWuDraft adapté hard-Fearless (méthodologie §4.2) :
 *
 *   evaluate'(game) = evaluate(game) + γ·[S(σ après la ligne) − S(σ)]
 *
 * où S est l'heuristique sac-à-dos sur les comforts restants par rôle,
 * déni compris STRUCTURELLEMENT : consommer un champion ampute les DEUX
 * pools, donc S encaisse à la fois notre coût d'option et le déni infligé —
 * c'est le critère Benoît-Krishna (le déni paie quand le coût de remplacement
 * est plus élevé pour EUX) rendu mécanique par la soustraction des deux pools.
 *
 * Formule gelée : S_side(σ) = Σ_rôles Σ_{i≤topN} ω^(i−1)·posterior_i, somme
 * sur les entrées restantes (non consommées) du rôle triées posterior desc —
 * un rôle sans entrée restante contribue 0 (aucune option restante = aucune
 * valeur d'option ; `emptyRoleQuality` reste dans la config par alignement
 * avec le trio gameWin du solveur, ce n'est pas un terme de la Σ gelée).
 *
 * γ et le sac-à-dos ne participent à AUCUNE métrique du run G3-demande : la
 * composite `evaluate + γ·S` ship badgée Expérimental (DA-V2-11), composants
 * affichés séparément (DA-V2-12). Pédagogie drafteur apprenant : chaque
 * composant a sa phrase FR côté UI — « Garder pour la suite : Azir vaut
 * encore +1,1 pp d'options sur les games restantes » ; « Déni : le prendre
 * maintenant le retire AUSSI à leur mid ».
 *
 * Module pur : zéro I/O, zéro horloge, σ jamais muté.
 */
import { shrinkWinrate } from '$lib/estimators/posterior';
import type { ChampionPoolEntry } from '$lib/pro/types';
import type { DraftEvaluator } from '$lib/strategic/draftNavigator';
import type { SeriesSide, SeriesState } from '$lib/strategic/seriesSolver';
import { ROLES, type Role } from '$lib/types';

export interface SeriesKnapsackConfig {
    /** Profondeur de comfort par rôle (défaut 3). */
    topN: number;
    /** Décroissance du i-ème comfort, poids ω^(i−1) (défaut 0,5). */
    omega: number;
    /** Poids γ du terme série dans evaluate' (défaut 0,5 — injectable, DA-V2-6). */
    gamma: number;
    /** Shrinkage EB aligné sur gameWin du solveur (0,5 / 10 / 0,25). */
    priorMean: number;
    priorN: number;
    emptyRoleQuality: number;
}

export const DEFAULT_SERIES_KNAPSACK_CONFIG: SeriesKnapsackConfig = {
    topN: 3,
    omega: 0.5,
    gamma: 0.5,
    priorMean: 0.5,
    priorN: 10,
    emptyRoleQuality: 0.25
};

export interface RolePoolValue {
    role: Role;
    value: number;
    entries: { championKey: string; posterior: number; weight: number }[];
}

export interface PoolValueBreakdown {
    side: SeriesSide;
    total: number;
    byRole: RolePoolValue[];
}

/** Posterior EB d'une entrée de pool (shrinkWinrate, doctrine §6.1). */
function posteriorOf(entry: ChampionPoolEntry, config: SeriesKnapsackConfig): number {
    return shrinkWinrate(entry.wins, entry.games, config.priorMean, config.priorN).mean;
}

/** S_side(σ) = Σ_rôles Σ_{i≤topN} ω^(i−1)·posterior_i (EB, non consommés, desc). */
export function poolValue(
    state: SeriesState,
    side: SeriesSide,
    config: SeriesKnapsackConfig = DEFAULT_SERIES_KNAPSACK_CONFIG
): PoolValueBreakdown {
    const byRole: RolePoolValue[] = [];
    let total = 0;
    for (const role of ROLES) {
        const remaining = (state.poolsBySide[side][role] ?? []).filter(
            (entry) => !state.consumed.has(entry.championKey)
        );
        const scored = remaining
            .map((entry) => ({ championKey: entry.championKey, posterior: posteriorOf(entry, config) }))
            .sort((a, b) =>
                // posterior desc ; clé asc en égalité (la Σ est invariante au tie, le rendu non).
                a.posterior !== b.posterior ? b.posterior - a.posterior : a.championKey < b.championKey ? -1 : 1
            )
            .slice(0, Math.max(0, config.topN));
        const entries = scored.map((entry, i) => ({
            championKey: entry.championKey,
            posterior: entry.posterior,
            weight: config.omega ** i
        }));
        let value = 0;
        for (const entry of entries) value += entry.weight * entry.posterior;
        byRole.push({ role, value, entries });
        total += value;
    }
    return { side, total, byRole };
}

/** S(σ) = S_ally(σ) − S_enemy(σ). */
export function seriesEdge(
    state: SeriesState,
    config: SeriesKnapsackConfig = DEFAULT_SERIES_KNAPSACK_CONFIG
): number {
    return poolValue(state, 'ally', config).total - poolValue(state, 'enemy', config).total;
}

export interface SeriesTermComponents {
    championKey: string;
    /** ΔS_ally ≤ 0 : l'option future que NOUS brûlons en le consommant. */
    selfCost: number;
    /** −ΔS_enemy ≥ 0 : l'option que nous LEUR retirons (hard Fearless). */
    denialGain: number;
    /** selfCost + denialGain. */
    deltaEdge: number;
    /** γ·deltaEdge — LE composant affiché à côté de l'équité (DA-V2-12). */
    gammaWeighted: number;
}

/** σ avec le candidat consommé en plus (σ lui-même n'est jamais muté). */
function consumePlus(state: SeriesState, championKey: string): SeriesState {
    const consumed = new Set(state.consumed);
    consumed.add(championKey);
    return { ...state, consumed };
}

/**
 * Décomposition du terme série pour UN candidat consommé depuis σ.
 * `deltaEdge` est CALCULÉ comme selfCost + denialGain — l'additivité
 * (DA-V2-12) est exacte par construction, pas à epsilon près. Un candidat
 * absent des deux pools (ou déjà consommé) a un terme nul.
 */
export function seriesTermOf(
    championKey: string,
    state: SeriesState,
    config: SeriesKnapsackConfig = DEFAULT_SERIES_KNAPSACK_CONFIG
): SeriesTermComponents {
    const after = consumePlus(state, championKey);
    const selfCost = poolValue(after, 'ally', config).total - poolValue(state, 'ally', config).total;
    // −ΔS_enemy écrit « avant − après » pour rendre +0 (jamais −0) à terme nul.
    const denialGain = poolValue(state, 'enemy', config).total - poolValue(after, 'enemy', config).total;
    const deltaEdge = selfCost + denialGain;
    return { championKey, selfCost, denialGain, deltaEdge, gammaWeighted: config.gamma * deltaEdge };
}

/**
 * Évaluateur de feuille du navigator en mode série :
 *   evaluate'(ally, enemy) = base(ally, enemy)
 *                          + γ·[seriesEdge(σ ∪ picks de la ligne) − seriesEdge(σ)]
 * Les clés reçues sont des PICKS uniquement (realPicks du navigator) — les
 * bans ne consomment pas en Fearless et n'entrent jamais dans σ. Les picks
 * des DEUX camps consomment (hard Fearless : ils amputent les deux pools).
 */
export function makeSeriesAwareEvaluator(
    base: DraftEvaluator,
    state: SeriesState,
    config: SeriesKnapsackConfig = DEFAULT_SERIES_KNAPSACK_CONFIG
): DraftEvaluator {
    const edgeBefore = seriesEdge(state, config);
    return (allyKeys, enemyKeys) => {
        const consumed = new Set(state.consumed);
        for (const key of allyKeys) consumed.add(key);
        for (const key of enemyKeys) consumed.add(key);
        const edgeAfter = seriesEdge({ ...state, consumed }, config);
        return base(allyKeys, enemyKeys) + config.gamma * (edgeAfter - edgeBefore);
    };
}
