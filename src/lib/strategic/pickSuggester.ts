/**
 * M5.5 — PickSuggester.
 *
 * Ranks candidate champions for the next pick on four axes:
 *   - planAlignment: how strongly the candidate serves the ally target plan
 *     (its M4.2 vote share for that archetype);
 *   - gapFill: whether it covers a missing need (engage, frontline, an absent
 *     damage type, disengage);
 *   - counter: average matchup edge vs the revealed enemy comp (needs a dataset);
 *   - penalty: redundancy (e.g. piling onto an already all-AD comp).
 * An FR rationale is auto-generated from the axes that fired.
 *
 * NOTE: detailed M5.5 spec was lost; weights/needs are a behaviour-faithful
 * reconstruction — see docs/STEP_UP.md.
 */
import { classifyGamePlan } from './gamePlanClassifier';
import { loadDefaultTags } from '$lib/tags';
import type { ChampionTag, ChampionTagsFile, GamePlanArchetype } from '$lib/tags/types';
import { ROLES, type Dataset, type Role } from '$lib/types';
import { getStats } from '$lib/engine/getStats';

export interface PickSuggesterInput {
    allyComp: string[];
    enemyComp?: string[];
    targetPlan: GamePlanArchetype;
    candidates: string[];
    dataset?: Dataset;
    tagsFile?: ChampionTagsFile;
    limit?: number;
}

export interface PickSuggestion {
    championKey: string;
    score: number;
    axes: { planAlignment: number; gapFill: number; counter: number; penalty: number };
    rationale: string[];
}

const W_PLAN = 2;
const W_COUNTER = 2;

function primaryRole(dataset: Dataset, key: string): Role | null {
    const champ = dataset.championData[key];
    if (!champ) return null;
    let best: Role | null = null;
    let bestGames = -1;
    for (const role of ROLES) {
        const games = champ.statsByRole[role]?.games ?? 0;
        if (games > bestGames) {
            bestGames = games;
            best = role;
        }
    }
    return bestGames > 0 ? best : null;
}

function counterScore(key: string, enemyComp: string[], dataset: Dataset): number {
    const role = primaryRole(dataset, key);
    if (role === null) return 0;
    let sum = 0;
    let n = 0;
    enemyComp.forEach((enemyKey, enemyRole) => {
        if (!enemyKey) return;
        const m = getStats(dataset, key, role, 'matchup', enemyRole as Role, enemyKey);
        if (m.games > 0) {
            sum += m.wins / m.games - 0.5;
            n++;
        }
    });
    return n === 0 ? 0 : sum / n;
}

export function suggestPicks(input: PickSuggesterInput): PickSuggestion[] {
    const tagsFile = input.tagsFile ?? loadDefaultTags();
    const ally = input.allyComp.map((k) => tagsFile.champions[k]).filter((t): t is ChampionTag => t !== undefined);
    const enemyComp = input.enemyComp ?? [];

    const needsEngage = !ally.some((c) => c.engageTool !== 'none');
    const needsFrontline = !ally.some((c) => c.range === 'melee' && (c.engageTool !== 'none' || c.scalingWindow !== 'late'));
    const allAD = ally.length > 0 && ally.every((c) => c.damageType === 'AD' && !c.secondaryDamageType);
    const allAP = ally.length > 0 && ally.every((c) => c.damageType === 'AP' && !c.secondaryDamageType);
    const hasDisengage = ally.some((c) => c.disengageTools.length > 0);
    const adCount = ally.filter((c) => c.damageType === 'AD').length;

    const suggestions: PickSuggestion[] = [];

    for (const key of input.candidates) {
        const tag = tagsFile.champions[key];
        if (!tag) continue;
        const rationale: string[] = [];

        const planAlignment = classifyGamePlan([key], tagsFile).distribution[input.targetPlan];
        if (planAlignment >= 0.3) rationale.push(`Aligné sur le plan ${input.targetPlan}`);

        let gapFill = 0;
        if (needsEngage && tag.engageTool !== 'none') {
            gapFill += 1;
            rationale.push("Comble : outil d'engage");
        }
        if (needsFrontline && tag.range === 'melee' && (tag.engageTool !== 'none' || tag.scalingWindow !== 'late')) {
            gapFill += 1;
            rationale.push('Comble : frontline');
        }
        if (allAD && (tag.damageType === 'AP' || tag.secondaryDamageType === 'AP')) {
            gapFill += 1;
            rationale.push('Comble : dégâts AP');
        }
        if (allAP && (tag.damageType === 'AD' || tag.secondaryDamageType === 'AD')) {
            gapFill += 1;
            rationale.push('Comble : dégâts AD');
        }
        if (!hasDisengage && tag.disengageTools.length > 0) {
            gapFill += 0.5;
            rationale.push('Apporte du désengage');
        }

        let penalty = 0;
        if (adCount >= 3 && tag.damageType === 'AD' && !tag.secondaryDamageType) {
            penalty += 1;
            rationale.push('Redondance : dégâts AD déjà saturés');
        }

        let counter = 0;
        if (input.dataset && enemyComp.length > 0) {
            counter = counterScore(key, enemyComp, input.dataset);
            if (counter > 0.01) rationale.push('Bon matchup global contre la comp adverse');
        }

        const score = W_PLAN * planAlignment + gapFill + W_COUNTER * counter - penalty;
        suggestions.push({ championKey: key, score, axes: { planAlignment, gapFill, counter, penalty }, rationale });
    }

    suggestions.sort((a, b) => b.score - a.score);
    return input.limit !== undefined ? suggestions.slice(0, input.limit) : suggestions;
}
