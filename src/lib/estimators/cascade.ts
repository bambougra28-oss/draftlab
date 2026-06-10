/**
 * Hierarchical shrinkage cascade — global → ligue → équipe → joueur
 * (doctrine §6.1, research 2026-06_methodologie_draft §1.3).
 *
 * Each level's sample is shrunk toward the *posterior mean of the level
 * above* (the two-level empirical-Bayes shortcut applied recursively):
 *
 *   ŵ_league = shrink(league data, toward rootMean,  N0_league)
 *   ŵ_team   = shrink(team data,   toward ŵ_league,  N0_team)
 *   ŵ_player = shrink(player data, toward ŵ_team,    N0_player)
 *
 * Because each step is a convex blend (own data weight t = games/(games+N0)),
 * the final mean decomposes exactly into per-level contributions:
 *
 *   weight(level j) = t_j · Π_{k deeper than j} (1 − t_k),  Σ weights + rootWeight = 1
 *
 * That decomposition is the provenance the UI must surface (DA-V2-4): which
 * layer actually drives the displayed number, and by how much.
 */
import { shrinkWinrate, type BetaPosterior } from './posterior';

/** One cascade level, ordered from the most global to the most specific. */
export interface CascadeLevelInput {
    /** Display label ('ligue', 'équipe', 'joueur', …) — also the provenance key. */
    label: string;
    wins: number;
    games: number;
    /** Pseudo-games of trust toward the previous level's posterior mean. */
    priorN: number;
}

export interface CascadeLevelResult {
    label: string;
    /** Posterior of this level (its data shrunk toward the level above). */
    posterior: BetaPosterior;
    /** Share [0, 1] of the FINAL mean contributed by this level's own games. */
    weight: number;
}

/** Synthetic provenance label for the root prior (`rootMean`). */
export const ROOT_LABEL = 'root';

export interface CascadeProvenance {
    /** Label of the layer contributing most to the final mean (ROOT_LABEL when data is empty). */
    dominant: string;
    /** Weight [0, 1] of that layer in the final mean. */
    weight: number;
    /** Evidence odds of the dominant layer vs everything else: weight / (1 − weight). */
    evidenceRatio: number;
}

export interface CascadeResult {
    /** Per-level posteriors and final-mean weights, in input order. */
    levels: CascadeLevelResult[];
    /** Share of the final mean still carried by the root prior mean. */
    rootWeight: number;
    /** Posterior of the deepest level — the number to display. */
    final: BetaPosterior;
    provenance: CascadeProvenance;
}

/**
 * Run the shrinkage cascade. `levels` must be ordered global → specific and
 * non-empty; `rootMean` is the top-of-cascade prior mean (e.g. global pro
 * winrate, or 0.5 when nothing better exists). Ties in dominance resolve to
 * the more specific layer (a coach prefers the closest evidence at equal weight).
 */
export function cascadeShrink(levels: CascadeLevelInput[], rootMean: number): CascadeResult {
    if (levels.length === 0) {
        throw new RangeError('cascadeShrink: at least one level is required');
    }

    // Forward pass: shrink each level toward the previous posterior mean.
    const results: CascadeLevelResult[] = [];
    const ownShare: number[] = [];
    let priorMean = rootMean;
    for (const level of levels) {
        const posterior = shrinkWinrate(level.wins, level.games, priorMean, level.priorN);
        ownShare.push(level.games / (level.games + level.priorN));
        results.push({ label: level.label, posterior, weight: 0 });
        priorMean = posterior.mean;
    }

    // Backward pass: unroll the convex blends into final-mean weights.
    // weight_j = t_j · Π_{k>j} (1 − t_k); what survives every level is the root's share.
    let carry = 1;
    for (let j = levels.length - 1; j >= 0; j--) {
        results[j].weight = ownShare[j] * carry;
        carry *= 1 - ownShare[j];
    }
    const rootWeight = carry;

    // Dominant layer: deepest-first scan with strict '>' keeps the more
    // specific level on exact ties; the root only wins strictly.
    let dominant = { label: results[results.length - 1].label, weight: results[results.length - 1].weight };
    for (let j = levels.length - 2; j >= 0; j--) {
        if (results[j].weight > dominant.weight) {
            dominant = { label: results[j].label, weight: results[j].weight };
        }
    }
    if (rootWeight > dominant.weight) {
        dominant = { label: ROOT_LABEL, weight: rootWeight };
    }

    return {
        levels: results,
        rootWeight,
        final: results[results.length - 1].posterior,
        provenance: {
            dominant: dominant.label,
            weight: dominant.weight,
            // weight = 1 (within float) yields Infinity — the layer is the whole story.
            evidenceRatio: dominant.weight / (1 - dominant.weight)
        }
    };
}
