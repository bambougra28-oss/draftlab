/**
 * M4.4 — Risk Marker detector.
 *
 * Inspects an ally composition (with optional enemy comp, game plans and
 * dataset) and surfaces strategic risks, sorted critical-first.
 *
 * 9 markers are active here; 3 more (`side-disadvantage-unmitigated`,
 * `pool-overlap`, `pocket-pick-risk-enemy`) are reserved in `RiskMarkerId` for
 * M6.4 — they need `sideStats` / `playerPools` context and stay silent until
 * those are wired through. Sort order (D15): critical → warning → info, then
 * alphabetical by id. Wording is FR-only (M4 scope).
 */
import { loadDefaultTags } from '$lib/tags';
import type { ChampionTag, ChampionTagsFile, GamePlanArchetype } from '$lib/tags/types';
import type { Dataset, Role } from '$lib/types';
import { getStats } from '$lib/engine/getStats';
import type { GamePlanResult } from './gamePlanClassifier';

export type RiskMarkerId =
    | 'no-frontline'
    | 'damage-100-ad'
    | 'damage-100-ap'
    | 'no-engage-tool'
    | 'no-disengage-vs-engage'
    | 'difficult-lane-matchup'
    | 'homogeneous-scaling'
    | 'low-mobility-vs-pick'
    | 'split-without-waveclear'
    // Reserved for M6.4 (require sideStats / playerPools context):
    | 'side-disadvantage-unmitigated'
    | 'pool-overlap'
    | 'pocket-pick-risk-enemy';

export type RiskSeverity = 'critical' | 'warning' | 'info';

export interface RiskMarker {
    id: RiskMarkerId;
    severity: RiskSeverity;
    message: string;
    rationale: string;
}

export interface RiskContext {
    allyGamePlan?: GamePlanResult;
    enemyGamePlan?: GamePlanResult;
    dataset?: Dataset;
    tagsFile?: ChampionTagsFile;
}

const SEVERITY_ORDER: Record<RiskSeverity, number> = { critical: 0, warning: 1, info: 2 };
const LANE_NAMES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];

function resolveTags(keys: string[], file: ChampionTagsFile): ChampionTag[] {
    return keys.map((k) => file.champions[k]).filter((t): t is ChampionTag => t !== undefined);
}

function noEngageSeverity(primary: GamePlanArchetype | undefined): RiskSeverity {
    if (primary === undefined) return 'warning';
    if (primary === 'engage') return 'critical';
    return 'info'; // pick / protect / siege / split expect to lack hard engage
}

function findDifficultLane(allyComp: string[], enemyComp: string[], dataset: Dataset): string | null {
    for (let role = 0; role < 5; role++) {
        const allyKey = allyComp[role];
        const enemyKey = enemyComp[role];
        if (!allyKey || !enemyKey) continue;
        const stats = getStats(dataset, allyKey, role as Role, 'matchup', role as Role, enemyKey);
        if (stats.games >= 100 && stats.wins / stats.games < 0.45) {
            return LANE_NAMES[role];
        }
    }
    return null;
}

export function detectRiskMarkers(
    allyComp: string[],
    enemyComp: string[],
    context: RiskContext = {}
): RiskMarker[] {
    const tagsFile = context.tagsFile ?? loadDefaultTags();
    const ally = resolveTags(allyComp, tagsFile);
    if (ally.length === 0) return [];

    const { allyGamePlan, enemyGamePlan, dataset } = context;
    const markers: RiskMarker[] = [];

    // 1. no-frontline — no melee champion that engages or isn't a pure late-scaler.
    if (!ally.some((c) => c.range === 'melee' && (c.engageTool !== 'none' || c.scalingWindow !== 'late'))) {
        markers.push({
            id: 'no-frontline',
            severity: 'warning',
            message: 'Pas de frontline',
            rationale: 'Aucun champion mêlée engageur ou non-late ne tient la ligne de front.'
        });
    }

    // 2/3. damage homogeneity — every champion deals a single damage type.
    if (ally.every((c) => c.damageType === 'AD' && !c.secondaryDamageType)) {
        markers.push({
            id: 'damage-100-ad',
            severity: 'warning',
            message: 'Dégâts 100% AD',
            rationale: 'Une seule stat défensive (armure) adverse réduit toute la composition.'
        });
    }
    if (ally.every((c) => c.damageType === 'AP' && !c.secondaryDamageType)) {
        markers.push({
            id: 'damage-100-ap',
            severity: 'warning',
            message: 'Dégâts 100% AP',
            rationale: 'Une seule stat défensive (MR) adverse réduit toute la composition.'
        });
    }

    // 4. no-engage-tool — nothing can initiate. Severity scales with the plan.
    if (!ally.some((c) => c.engageTool !== 'none')) {
        markers.push({
            id: 'no-engage-tool',
            severity: noEngageSeverity(allyGamePlan?.primary),
            message: "Pas d'outil d'engage",
            rationale: "Aucun champion ne peut initier le combat (engageTool 'none' partout)."
        });
    }

    // 5. no-disengage-vs-engage — enemy plays Engage and we can't peel it off.
    if (enemyGamePlan?.primary === 'engage' && !ally.some((c) => c.disengageTools.length > 0)) {
        markers.push({
            id: 'no-disengage-vs-engage',
            severity: 'critical',
            message: 'Pas de désengage face à un Engage',
            rationale: "L'adversaire joue Engage et aucun allié n'a d'outil de désengage (peel/knockback)."
        });
    }

    // 6. difficult-lane-matchup — a same-role duel under 45% WR on >=100 games.
    if (dataset) {
        const lane = findDifficultLane(allyComp, enemyComp, dataset);
        if (lane) {
            markers.push({
                id: 'difficult-lane-matchup',
                severity: 'warning',
                message: `Matchup de voie difficile (${lane})`,
                rationale: 'Au moins un duel de même rôle est sous 45% de winrate sur ≥100 parties.'
            });
        }
    }

    // 7. homogeneous-scaling — whole comp shares one power window (needs >=3).
    if (ally.length >= 3) {
        const allEarly = ally.every((c) => c.scalingWindow === 'early');
        const allLate = ally.every((c) => c.scalingWindow === 'late');
        if (allEarly || allLate) {
            markers.push({
                id: 'homogeneous-scaling',
                severity: 'info',
                message: `Scaling homogène (${allEarly ? 'early' : 'late'})`,
                rationale: 'Toute la composition partage la même fenêtre de puissance — pas de relais de tempo.'
            });
        }
    }

    // 8. low-mobility-vs-pick — immobile comp into a Pick plan.
    const lowMobility = ally.filter((c) => c.mobility === 'low').length;
    if (enemyGamePlan?.primary === 'pick' && lowMobility >= 3) {
        markers.push({
            id: 'low-mobility-vs-pick',
            severity: 'warning',
            message: 'Faible mobilité face à un Pick',
            rationale: `${lowMobility} champions à faible mobilité face à une composition Pick.`
        });
    }

    // 9. split-without-waveclear — Split plan with no long-range AP waveclear.
    if (allyGamePlan?.primary === 'split' && !ally.some((c) => c.range === 'ranged-long' && c.damageType === 'AP')) {
        markers.push({
            id: 'split-without-waveclear',
            severity: 'warning',
            message: 'Split sans waveclear',
            rationale: 'Plan Split sans mage longue-portée AP pour gérer les vagues en 4v5.'
        });
    }

    return markers.sort(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.id.localeCompare(b.id)
    );
}
