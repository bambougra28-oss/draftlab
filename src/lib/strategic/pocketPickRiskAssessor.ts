/**
 * M5.4 — Pocket Pick Risk Assessor.
 *
 * Flags how likely a champion is to be an off-radar "pocket pick" the scout
 * layer might miss, from up to three independent reasons. Standalone so M6.1
 * (ban priority) can reuse it. Risk level scales with the number of reasons.
 *
 * NOTE: thresholds are a behaviour-faithful reconstruction (detailed M5 spec
 * was lost) — see docs/STEP_UP.md to re-tune against a real pro corpus.
 */
import type { ChampionTag } from '$lib/tags/types';

export type PocketPickReason = 'tagged_low_confidence' | 'low_stage_presence' | 'recent_buff';
export type PocketPickRisk = 'none' | 'low' | 'medium' | 'high';

export interface PocketPickContext {
    /** The champion's tag — a `confidence: 'low'` tag is itself a signal. */
    tag?: ChampionTag;
    /** Pro stage presence as a fraction [0,1]; below the threshold is a flag. */
    stagePresence?: number;
    /** True if the champion was buffed in a recent patch. */
    recentlyBuffed?: boolean;
}

export interface PocketPickAssessment {
    reasons: PocketPickReason[];
    risk: PocketPickRisk;
}

/** Below 5% pick+ban presence at the relevant stage is "off the radar". */
const LOW_STAGE_PRESENCE = 0.05;
const RISK_BY_COUNT: readonly PocketPickRisk[] = ['none', 'low', 'medium', 'high'];

export function assessPocketPickRisk(context: PocketPickContext): PocketPickAssessment {
    const reasons: PocketPickReason[] = [];

    if (context.tag?.confidence === 'low') reasons.push('tagged_low_confidence');
    if (context.stagePresence !== undefined && context.stagePresence < LOW_STAGE_PRESENCE) {
        reasons.push('low_stage_presence');
    }
    if (context.recentlyBuffed) reasons.push('recent_buff');

    return { reasons, risk: RISK_BY_COUNT[Math.min(reasons.length, RISK_BY_COUNT.length - 1)] };
}
