/**
 * M5.1 — Adversary Plan Detector.
 *
 * Reads the enemy's emerging game plan pick-by-pick. Each partial comp is run
 * through the M4.2 classifier, then the distribution is *capped* by a linear
 * blend toward uniform scaled by how many picks are revealed — so a single pick
 * never reads as a confident plan, while a full five does. Linear blending
 * preserves ordering (no top-1/top-2 ties), per the M5.1 design note.
 *
 * Also exposes the read's evolution across picks, a convergence flag, pocket-pick
 * warnings (via M5.4) and an FR adaptive recommendation.
 *
 * NOTE: detailed M5.1 spec was lost; this is a behaviour-faithful reconstruction
 * (blend slope, convergence floor) — see docs/STEP_UP.md.
 */
import { classifyGamePlan } from './gamePlanClassifier';
import { GAME_PLAN_ARCHETYPES, type ChampionTagsFile, type GamePlanArchetype } from '$lib/tags/types';
import { loadDefaultTags } from '$lib/tags';
import { assessPocketPickRisk, type PocketPickContext, type PocketPickReason } from './pocketPickRiskAssessor';

export interface AdversaryEvolutionStep {
    picks: number;
    primary: GamePlanArchetype;
    topShare: number;
}

export interface AdversaryPocketWarning {
    championKey: string;
    reasons: PocketPickReason[];
}

export interface AdversaryPlanRead {
    distribution: Record<GamePlanArchetype, number>;
    primary: GamePlanArchetype;
    secondary: GamePlanArchetype;
    /** Capped top share, in [1/5, 1] — the read's confidence. */
    confidence: number;
    converged: boolean;
    evolution: AdversaryEvolutionStep[];
    pocketPickWarnings: AdversaryPocketWarning[];
    recommendation: string;
}

export interface AdversaryPlanContext {
    tagsFile?: ChampionTagsFile;
    /** Optional per-champion pocket-pick signals (stage presence, recent buff). */
    pocketPickByKey?: Record<string, PocketPickContext>;
}

const CONFIDENCE_FLOOR = 0.4;

const RECOMMENDATIONS: Record<GamePlanArchetype, string> = {
    engage: 'Adversaire orienté Engage : prévoir du désengage (peel/knockback) et éviter de se faire bus à 5.',
    pick: 'Adversaire orienté Pick : vision constante, jouer groupé, punir les écarts isolés.',
    protect: 'Adversaire orienté Protect : forcer le combat avant le spike du carry, focus la backline protégée.',
    siege: 'Adversaire orienté Siege : contester vision et objectifs, chercher les flancs sur les champions de poke.',
    split: 'Adversaire orienté Split : gérer la map en 1-3-1, soigner les matchups de side, vision profonde.'
};

function blendWithUniform(
    dist: Record<GamePlanArchetype, number>,
    pickCount: number
): Record<GamePlanArchetype, number> {
    const n = GAME_PLAN_ARCHETYPES.length;
    const uniform = 1 / n;
    const alpha = Math.min(pickCount / n, 1); // full confidence at 5 picks
    const out = { siege: 0, split: 0, pick: 0, protect: 0, engage: 0 } as Record<GamePlanArchetype, number>;
    for (const a of GAME_PLAN_ARCHETYPES) {
        out[a] = alpha * dist[a] + (1 - alpha) * uniform;
    }
    return out;
}

function readAt(picks: string[], tagsFile: ChampionTagsFile) {
    const dist = blendWithUniform(classifyGamePlan(picks, tagsFile).distribution, picks.length);
    const ranked = [...GAME_PLAN_ARCHETYPES].sort((a, b) => dist[b] - dist[a]);
    return { dist, primary: ranked[0], secondary: ranked[1], topShare: dist[ranked[0]] };
}

export function detectAdversaryPlan(enemyPicks: string[], context: AdversaryPlanContext = {}): AdversaryPlanRead {
    const tagsFile = context.tagsFile ?? loadDefaultTags();

    const evolution: AdversaryEvolutionStep[] = [];
    for (let k = 1; k <= enemyPicks.length; k++) {
        const step = readAt(enemyPicks.slice(0, k), tagsFile);
        evolution.push({ picks: k, primary: step.primary, topShare: step.topShare });
    }

    const current = readAt(enemyPicks, tagsFile);
    const pickCount = enemyPicks.length;

    const stablePrimary =
        evolution.length >= 2 &&
        evolution[evolution.length - 1].primary === evolution[evolution.length - 2].primary;
    const converged = pickCount >= 3 && current.topShare >= CONFIDENCE_FLOOR && stablePrimary;

    const pocketPickWarnings: AdversaryPocketWarning[] = [];
    for (const key of enemyPicks) {
        const ppContext: PocketPickContext = context.pocketPickByKey?.[key] ?? { tag: tagsFile.champions[key] };
        const assessment = assessPocketPickRisk(ppContext);
        if (assessment.reasons.length > 0) {
            pocketPickWarnings.push({ championKey: key, reasons: assessment.reasons });
        }
    }

    return {
        distribution: current.dist,
        primary: current.primary,
        secondary: current.secondary,
        confidence: current.topShare,
        converged,
        evolution,
        pocketPickWarnings,
        recommendation: pickCount === 0 ? 'Pas encore de pick adverse à lire.' : RECOMMENDATIONS[current.primary]
    };
}
