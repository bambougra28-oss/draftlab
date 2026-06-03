/**
 * M4.2 — Game Plan Classifier.
 *
 * Maps a composition (1–5 champion keys) to a probability distribution over the
 * five game-plan archetypes (Siege / Split / Pick / Protect / Engage) using a
 * numeric vote table over the M4.1 champion tags. Pure tag-based reading — no
 * matchup, meta, or skill signal (those live in other modules).
 *
 * Decisions (M4_2.md): D1 numeric votes · D2 distribution sums to 1 · D3
 * ambiguous when primary < 0.40 · D5 empty/zero-sum → uniform + ambiguous ·
 * D6 confidence by champion count (1–2 low, 3 medium, 4–5 high).
 *
 * The spec's Split rule on `disengageTools: 'self'` is intentionally skipped —
 * the M4.1 schema replaced 'self' with the broader `mobility` dimension
 * (see docs/unresolved.md / docs/STEP_UP.md).
 */
import { GAME_PLAN_ARCHETYPES, type ChampionTag, type ChampionTagsFile, type GamePlanArchetype } from '$lib/tags/types';
import { loadDefaultTags } from '$lib/tags';

export type GamePlanConfidence = 'low' | 'medium' | 'high';

export interface GamePlanResult {
    distribution: Record<GamePlanArchetype, number>;
    primary: GamePlanArchetype;
    secondary: GamePlanArchetype;
    confidence: GamePlanConfidence;
    ambiguous: boolean;
}

/** D3 — primary below this share means the read is ambiguous. */
const AMBIGUOUS_THRESHOLD = 0.4;

function emptyScores(): Record<GamePlanArchetype, number> {
    return { siege: 0, split: 0, pick: 0, protect: 0, engage: 0 };
}

/** Accumulate one champion's archetype votes (vote table D4). */
function addVotes(tag: ChampionTag, scores: Record<GamePlanArchetype, number>): void {
    const { range, engageTool, damageType, mobility, scalingWindow, hyperCarry, disengageTools } = tag;

    // Siege
    if (range === 'ranged-long') scores.siege += 2;
    if (engageTool === 'none') scores.siege += 1;
    if (damageType === 'AP') scores.siege += 0.5;
    if (mobility === 'low') scores.siege += 0.5;

    // Split
    if (range === 'melee' && scalingWindow !== 'early') scores.split += 2;
    if (mobility === 'high' && range === 'melee') scores.split += 1;
    if (range === 'melee' && damageType === 'AD' && scalingWindow === 'late') scores.split += 1; // duelist

    // Pick
    if (engageTool === 'soft-single') scores.pick += 2;
    if (mobility === 'high') scores.pick += 1;
    if (damageType === 'AP' && range === 'ranged-short') scores.pick += 1;

    // Protect
    if (disengageTools.includes('peel')) scores.protect += 2;
    if (scalingWindow === 'late' || hyperCarry) scores.protect += 1;
    if (engageTool === 'none' && range === 'ranged-long') scores.protect += 0.5;

    // Engage
    if (engageTool === 'hard-aoe') scores.engage += 3;
    if (engageTool === 'soft-single') scores.engage += 1;
    if (range === 'melee' && engageTool !== 'none') scores.engage += 0.5;
    if (mobility === 'medium' && engageTool === 'soft-single') scores.engage += 0.5;

    // Signature-pick override: each explicit hint is a soft +1 nudge.
    for (const hint of tag.gamePlanHints ?? []) {
        scores[hint] += 1;
    }
}

function confidenceFor(recognizedCount: number): GamePlanConfidence {
    if (recognizedCount >= 4) return 'high';
    if (recognizedCount === 3) return 'medium';
    return 'low';
}

export function classifyGamePlan(
    championKeys: string[],
    tagsFile: ChampionTagsFile = loadDefaultTags()
): GamePlanResult {
    const scores = emptyScores();
    let recognized = 0;

    for (const key of championKeys) {
        const tag = tagsFile.champions[key];
        if (!tag) continue;
        recognized++;
        addVotes(tag, scores);
    }

    const total = GAME_PLAN_ARCHETYPES.reduce((sum, a) => sum + scores[a], 0);
    const distribution = emptyScores();
    let ambiguous: boolean;

    if (recognized === 0 || total === 0) {
        // D5 — no usable signal → uniform distribution, flagged ambiguous.
        const uniform = 1 / GAME_PLAN_ARCHETYPES.length;
        for (const a of GAME_PLAN_ARCHETYPES) distribution[a] = uniform;
        ambiguous = true;
    } else {
        for (const a of GAME_PLAN_ARCHETYPES) distribution[a] = scores[a] / total;
        ambiguous = false;
    }

    const ranked = [...GAME_PLAN_ARCHETYPES].sort((a, b) => distribution[b] - distribution[a]);
    const primary = ranked[0];
    const secondary = ranked[1];
    if (!ambiguous) ambiguous = distribution[primary] < AMBIGUOUS_THRESHOLD;

    return {
        distribution,
        primary,
        secondary,
        confidence: confidenceFor(recognized),
        ambiguous
    };
}
