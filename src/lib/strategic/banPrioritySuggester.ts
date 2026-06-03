/**
 * M6.1 — Ban Priority Suggester.
 *
 * Ranks ban candidates into a 5-tier hierarchy from how threatening each is:
 * the enemy's pool comfort (M5.3 tier), pocket-pick risk (M5.4) and optional
 * meta strength. Fearless-aware: a champion already consumed earlier in the
 * series can't be re-picked, so banning it is wasted → forced to `skip`.
 *
 * NOTE: weights/thresholds are a behaviour-faithful reconstruction (detailed
 * M6.1 spec was lost) — see docs/STEP_UP.md.
 */
import type { PoolTier } from './poolTierClassifier';
import type { PocketPickRisk } from './pocketPickRiskAssessor';

export type BanTier = 'must-ban' | 'high' | 'medium' | 'low' | 'skip';

export interface BanCandidate {
    championKey: string;
    /** Enemy pool comfort on this champion (M5.3). */
    poolTier?: PoolTier;
    /** Pocket-pick risk (M5.4). */
    pocketRisk?: PocketPickRisk;
    /** On-patch strength, 0..1. */
    metaStrength?: number;
    /** Already played by either team this Fearless series. */
    consumed?: boolean;
}

export interface BanContext {
    fearless?: boolean;
    gameNumber?: number;
}

export interface BanSuggestion {
    championKey: string;
    tier: BanTier;
    score: number;
    rationale: string[];
}

const POOL_WEIGHT: Record<PoolTier, number> = {
    strongest: 3,
    'match-ready': 2,
    'scrim-ready': 1,
    learning: 0
};

const POCKET_WEIGHT: Record<PocketPickRisk, number> = { high: 2, medium: 1.5, low: 1, none: 0 };

const TIER_ORDER: Record<BanTier, number> = { 'must-ban': 0, high: 1, medium: 2, low: 3, skip: 4 };

function tierFromScore(score: number): BanTier {
    if (score >= 5) return 'must-ban';
    if (score >= 3.5) return 'high';
    if (score >= 2) return 'medium';
    if (score >= 0.5) return 'low';
    return 'skip';
}

export function suggestBans(candidates: BanCandidate[], context: BanContext = {}): BanSuggestion[] {
    const suggestions = candidates.map((c): BanSuggestion => {
        if (context.fearless && c.consumed) {
            return {
                championKey: c.championKey,
                tier: 'skip',
                score: 0,
                rationale: ['Déjà consommé en Fearless — ne peut plus être repické']
            };
        }

        const rationale: string[] = [];
        let score = 0;

        if (c.poolTier && POOL_WEIGHT[c.poolTier] > 0) {
            score += POOL_WEIGHT[c.poolTier];
            rationale.push(`Pool adverse : ${c.poolTier}`);
        }
        if (c.pocketRisk && POCKET_WEIGHT[c.pocketRisk] > 0) {
            score += POCKET_WEIGHT[c.pocketRisk];
            rationale.push(`Risque pocket pick : ${c.pocketRisk}`);
        }
        if (c.metaStrength !== undefined) {
            score += c.metaStrength * 2;
            if (c.metaStrength >= 0.5) rationale.push('Fort sur le patch actuel');
        }

        return { championKey: c.championKey, tier: tierFromScore(score), score, rationale };
    });

    return suggestions.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.score - a.score);
}
