/**
 * I3 — Bilateral win-condition graph (R3 novel engine, ARCHITECTURE_V2 §6 bis).
 *
 * At the top level a comp's identity is *relative* — "we win the front-to-back
 * if we survive their dive" — so instead of a unilateral archetype label this
 * engine scores 8 bilateral conflict axes from both comps' tags. Each score is
 * signed (positive = ally advantage) and decomposed into components whose sum
 * IS the score (auditable, DA-V2-12 spirit). The 5-archetype classifier stays
 * a pedagogical VIEW (DA-V2-13) and is reused as the split-share input of
 * axis 4 without modification.
 *
 * Mechanics:
 * - Clash axes (engage, dive, poke, split, pick) oppose one side's threat to
 *   the other side's counter tools, per direction: max(0, threat − γ·counter).
 *   Counters *neutralize* a threat, they never reverse it — a collapsed enemy
 *   engage is OUR pick threat, which its own axis captures.
 * - Differential axes (scaling, snowball, objectives) are plain signed sums.
 * - Raw tag counts are projected to a full-comp scale (×5/n recognized) so
 *   partial comps (1-4 picks, accepted with degraded confidence) stay on the
 *   same scale as full ones. The lane-indexed snowball axis is NOT projected
 *   (lanes are absolute) and reads keys as role-ordered (0 Top … 4 Support,
 *   project convention); it reports 'low' confidence unless both comps are
 *   full. The dataset power-curve refinement of the scaling axis is likewise
 *   gated on two full comps.
 * - The collision (ally's top lever × enemy's top lever) selects an FR
 *   narrative, observable switch triggers and the relevant existing risk
 *   marker ids — all data-driven from `winConditionAxes.ts` (DA-V2-6).
 * - Statements are postdictable by design (DA-V2-11): R3's harness scores
 *   `gameLength`/`objectives` statements against real duration/objective data.
 */
import { loadDefaultTags } from '$lib/tags';
import type { ChampionTag, ChampionTagsFile } from '$lib/tags/types';
import type { Dataset } from '$lib/types';
import { classifyGamePlan } from '$lib/strategic/gamePlanClassifier';
import { calculatePowerCurve } from '$lib/strategic/powerCurveCalculator';
import type { RiskMarkerId } from '$lib/strategic/riskMarkerDetector';
import {
    DEFAULT_WIN_CONDITION_CONFIG,
    collisionCellKey,
    type WinConditionAxesConfig,
    type WinConditionAxisId
} from '$lib/strategic/winConditionAxes';

export type WinConditionConfidence = 'low' | 'medium' | 'high';

export interface AxisComponent {
    /** FR explanation of this contribution (numbers inlined, 1 decimal). */
    reason: string;
    value: number;
}

export interface WinConditionAxis {
    id: WinConditionAxisId;
    labelFr: string;
    /** Signed score — positive = ally advantage on this axis. */
    score: number;
    /** Components sum exactly to `score`. */
    components: AxisComponent[];
    confidence: WinConditionConfidence;
}

export interface WinConditionCollision {
    allyAxisId: WinConditionAxisId;
    enemyAxisId: WinConditionAxisId;
    /** ~2 concrete coach sentences for this collision cell. */
    narrativeFr: string;
    /** Observable in-game switch conditions (ally lever first, then enemy). */
    triggers: string[];
    /** Existing risk-marker ids relevant to this collision. */
    riskMarkerIds: RiskMarkerId[];
}

export type StatementDirection = 'early' | 'mid' | 'late' | 'axis';
export type StatementFalsifiability = 'gameLength' | 'objectives' | 'none';

export interface WinConditionStatement {
    textFr: string;
    direction: StatementDirection;
    /** What real-game data can postdict this statement (R3 harness). */
    falsifiableVia: StatementFalsifiability;
}

export interface WinConditionReport {
    /** All 8 axes, in canonical order. */
    axes: WinConditionAxis[];
    /** Top axes with score ≥ planMinScore (our levers), strongest first. */
    allyPlan: WinConditionAxisId[];
    /** Top axes with score ≤ −planMinScore (their levers), strongest first. */
    enemyPlan: WinConditionAxisId[];
    /** Null when either comp has no recognized champion. */
    collision: WinConditionCollision | null;
    statements: WinConditionStatement[];
}

export interface WinConditionOptions {
    tagsFile?: ChampionTagsFile;
    /** Refines the scaling axis with observed power curves (full comps only). */
    dataset?: Dataset;
    /** Override the data-driven weights/narratives (DA-V2-6). */
    config?: WinConditionAxesConfig;
}

// ---- internal: side profile -------------------------------------------------

interface SideProfile {
    keys: string[];
    tags: ChampionTag[];
    recognized: number;
    /** Projects raw tag counts to a full-comp scale (5/recognized; 0 if empty). */
    factor: number;
    /** Split share from the M4.2 classifier view (0 when nothing resolved). */
    splitShare: number;
    /** Tag at a role index (0 Top … 4 Support) — trustworthy on full comps only. */
    laneTag: (role: number) => ChampionTag | undefined;
}

function profileOf(keys: string[], tagsFile: ChampionTagsFile): SideProfile {
    const tags = keys
        .map((k) => tagsFile.champions[k])
        .filter((t): t is ChampionTag => t !== undefined);
    const recognized = tags.length;
    return {
        keys,
        tags,
        recognized,
        factor: recognized > 0 ? 5 / recognized : 0,
        // Guard: the classifier returns a uniform 0.2 share for empty comps —
        // that would leak a phantom split signal, so force 0 instead.
        splitShare: recognized > 0 ? classifyGamePlan(keys, tagsFile).distribution.split : 0,
        laneTag: (role: number) => (keys[role] === undefined ? undefined : tagsFile.champions[keys[role]])
    };
}

function sumTags(tags: ChampionTag[], contribution: (t: ChampionTag) => number): number {
    return tags.reduce((acc, t) => acc + contribution(t), 0);
}

const fmt = (n: number): string => n.toFixed(1);

function confidenceFor(minRecognized: number): WinConditionConfidence {
    if (minRecognized >= 4) return 'high';
    if (minRecognized === 3) return 'medium';
    return 'low';
}

// ---- internal: axis builders ------------------------------------------------

/**
 * Shared clash form: each direction is max(0, threat − γ·counter), the score
 * is the ally direction minus the enemy direction. Components carry the raw
 * inputs in their FR reason and the clamped value, so they sum to the score.
 */
function clashAxis(
    id: WinConditionAxisId,
    cfg: WinConditionAxesConfig,
    confidence: WinConditionConfidence,
    allyThreat: number,
    enemyCounter: number,
    enemyThreat: number,
    allyCounter: number,
    threatNounFr: string,
    counterNounFr: string
): WinConditionAxis {
    const g = cfg.counterWeight;
    const allyClash = Math.max(0, allyThreat - g * enemyCounter);
    const enemyClash = Math.max(0, enemyThreat - g * allyCounter);
    return {
        id,
        labelFr: cfg.narratives[id].labelFr,
        score: allyClash - enemyClash,
        components: [
            {
                reason: `Menace ${threatNounFr} alliée : ${fmt(allyThreat)} − ${g} × ${counterNounFr} adverse ${fmt(enemyCounter)} (plancher 0)`,
                value: allyClash
            },
            {
                reason: `Menace ${threatNounFr} adverse : ${fmt(enemyThreat)} − ${g} × ${counterNounFr} allié ${fmt(allyCounter)} (plancher 0)`,
                value: -enemyClash
            }
        ],
        confidence
    };
}

/** Axis 1 — engage tools vs disengage tools (peel/knockback). */
function engageAxis(a: SideProfile, b: SideProfile, cfg: WinConditionAxesConfig, c: WinConditionConfidence): WinConditionAxis {
    const w = cfg.engage;
    const threat = (p: SideProfile): number =>
        p.factor * sumTags(p.tags, (t) => (t.engageTool === 'hard-aoe' ? w.hardAoe : t.engageTool === 'soft-single' ? w.softSingle : 0));
    const counter = (p: SideProfile): number =>
        p.factor * sumTags(p.tags, (t) =>
            (t.disengageTools.includes('peel') ? w.peel : 0) + (t.disengageTools.includes('knockback') ? w.knockback : 0));
    return clashAxis('engage-vs-disengage', cfg, c, threat(a), counter(b), threat(b), counter(a), "d'engage", 'désengage');
}

/** Axis 2 — dive (high mobility + engage) vs carry peel. */
function diveAxis(a: SideProfile, b: SideProfile, cfg: WinConditionAxesConfig, c: WinConditionConfidence): WinConditionAxis {
    const w = cfg.dive;
    const threat = (p: SideProfile): number =>
        p.factor * sumTags(p.tags, (t) => {
            if (t.mobility !== 'high' || t.engageTool === 'none') return 0;
            return t.engageTool === 'hard-aoe' ? w.hardAoeDiver : w.softSingleDiver;
        });
    const counter = (p: SideProfile): number =>
        p.factor * sumTags(p.tags, (t) =>
            (t.disengageTools.includes('peel') ? w.peel : 0) + (t.disengageTools.includes('knockback') ? w.knockback : 0));
    return clashAxis('dive-vs-peel', cfg, c, threat(a), counter(b), threat(b), counter(a), 'de dive', 'peel');
}

/** Axis 3 — long-range poke/siege vs hard-AoE punish (sustain is not in the tag schema). */
function pokeAxis(a: SideProfile, b: SideProfile, cfg: WinConditionAxesConfig, c: WinConditionConfidence): WinConditionAxis {
    const w = cfg.poke;
    const threat = (p: SideProfile): number =>
        p.factor * sumTags(p.tags, (t) =>
            (t.range === 'ranged-long' ? w.rangedLong : 0) + (t.gamePlanHints?.includes('siege') ? w.siegeHint : 0));
    const counter = (p: SideProfile): number =>
        p.factor * sumTags(p.tags, (t) => (t.engageTool === 'hard-aoe' ? w.hardAoeCounter : 0));
    return clashAxis('poke-vs-engage', cfg, c, threat(a), counter(b), threat(b), counter(a), 'de poke', 'engage AoE');
}

/** Axis 4 — split pressure (classifier view + structural markers) vs waveclear + early tempo. */
function splitAxis(a: SideProfile, b: SideProfile, cfg: WinConditionAxesConfig, c: WinConditionConfidence): WinConditionAxis {
    const w = cfg.split;
    const threat = (p: SideProfile): number =>
        p.splitShare * w.classifierShare +
        p.factor * sumTags(p.tags, (t) =>
            (t.gamePlanHints?.includes('split') ? w.splitHint : 0) +
            (t.range === 'melee' && t.mobility === 'high' ? w.meleeHighMobility : 0));
    const counter = (p: SideProfile): number =>
        p.factor * sumTags(p.tags, (t) =>
            (t.range === 'ranged-long' && t.damageType === 'AP' ? w.waveclear : 0) +
            (t.scalingWindow === 'early' ? w.earlyTempo : 0));
    return clashAxis('split-vs-crossmap', cfg, c, threat(a), counter(b), threat(b), counter(a), 'de split', 'waveclear/tempo');
}

/** Axis 5 — scaling-window differential, refined by the observed power curve when available. */
function scalingAxis(
    a: SideProfile,
    b: SideProfile,
    cfg: WinConditionAxesConfig,
    c: WinConditionConfidence,
    dataset: Dataset | undefined
): WinConditionAxis {
    const w = cfg.scaling;
    const lateness = (p: SideProfile): number =>
        p.factor * sumTags(p.tags, (t) => {
            if (t.scalingWindow === 'late') return w.lateWindow + (t.hyperCarry ? w.lateHyperCarryBonus : 0);
            if (t.scalingWindow === 'early') return -w.earlyWindow;
            return 0;
        });
    const latenessA = lateness(a);
    const latenessB = lateness(b);
    const components: AxisComponent[] = [
        { reason: `Fenêtres de scaling alliées (late − early, bonus hyper-carry) : ${fmt(latenessA)}`, value: latenessA },
        { reason: `Fenêtres de scaling adverses : ${fmt(latenessB)}`, value: -latenessB }
    ];
    // Dataset refinement — only when both comps are full (role-ordered keys).
    if (dataset !== undefined && a.recognized === 5 && b.recognized === 5) {
        const curve = calculatePowerCurve(a.keys, b.keys, dataset);
        if (curve.ally.late !== null && curve.enemy.late !== null && curve.ally.early !== null && curve.enemy.early !== null) {
            const lateEdge = curve.ally.late - curve.enemy.late;
            const earlyEdge = curve.ally.early - curve.enemy.early;
            const delta = (lateEdge - earlyEdge) * w.datasetEdgeWeight;
            components.push({
                reason: `Courbe de puissance observée : edge late ${fmt(lateEdge * 100)} pp − edge early ${fmt(earlyEdge * 100)} pp`,
                value: delta
            });
        }
    }
    return {
        id: 'scaling-differential',
        labelFr: cfg.narratives['scaling-differential'].labelFr,
        score: components.reduce((s, comp) => s + comp.value, 0),
        components,
        confidence: c
    };
}

/**
 * Axis 6 — snowball lanes: early scalers on top/bot (amplified when facing a
 * late scaler in the same lane = exposed weak side) plus an early jungle
 * bonus. Mid/support are excluded per spec; lanes are absolute, no projection.
 */
function snowballAxis(a: SideProfile, b: SideProfile, cfg: WinConditionAxesConfig, c: WinConditionConfidence): WinConditionAxis {
    const w = cfg.snowball;
    const pressure = (p: SideProfile, opp: SideProfile): number => {
        let total = 0;
        for (const role of [0, 3]) {
            // 0 = Top, 3 = Bottom
            if (p.laneTag(role)?.scalingWindow !== 'early') continue;
            total += w.earlyLane + (opp.laneTag(role)?.scalingWindow === 'late' ? w.lateOppositionBonus : 0);
        }
        if (p.laneTag(1)?.scalingWindow === 'early') total += w.earlyJungle; // 1 = Jungle
        return total;
    };
    const allyPressure = pressure(a, b);
    const enemyPressure = pressure(b, a);
    // Lane reading needs both comps full and resolved to be trustworthy.
    const laneConfidence: WinConditionConfidence = a.recognized === 5 && b.recognized === 5 ? c : 'low';
    return {
        id: 'snowball-weakside',
        labelFr: cfg.narratives['snowball-weakside'].labelFr,
        score: allyPressure - enemyPressure,
        components: [
            { reason: `Lanes de snowball alliées (top/bot early, bonus vs late, jungle early) : ${fmt(allyPressure)}`, value: allyPressure },
            { reason: `Lanes de snowball adverses : ${fmt(enemyPressure)}`, value: -enemyPressure }
        ],
        confidence: laneConfidence
    };
}

/** Axis 7 — objective profile differential: zone control (poke) + forced-fight power (hard AoE). */
function objectiveAxis(a: SideProfile, b: SideProfile, cfg: WinConditionAxesConfig, c: WinConditionConfidence): WinConditionAxis {
    const w = cfg.objectives;
    const zone = (p: SideProfile): number =>
        p.factor * sumTags(p.tags, (t) =>
            (t.range === 'ranged-long' ? w.rangedLong : 0) + (t.gamePlanHints?.includes('siege') ? w.siegeHint : 0));
    const fight = (p: SideProfile): number =>
        p.factor * sumTags(p.tags, (t) => (t.engageTool === 'hard-aoe' ? w.hardAoe : 0));
    const allyProfile = zone(a) + fight(a);
    const enemyProfile = zone(b) + fight(b);
    return {
        id: 'objective-control',
        labelFr: cfg.narratives['objective-control'].labelFr,
        score: allyProfile - enemyProfile,
        components: [
            { reason: `Profil d'objectifs allié : zone ${fmt(zone(a))} + fight AoE ${fmt(fight(a))}`, value: allyProfile },
            { reason: `Profil d'objectifs adverse : zone ${fmt(zone(b))} + fight AoE ${fmt(fight(b))}`, value: -enemyProfile }
        ],
        confidence: c
    };
}

/** Axis 8 — pick threat (soft-single catch + mobility reach) vs grouped safety (peel-weighted). */
function pickAxis(a: SideProfile, b: SideProfile, cfg: WinConditionAxesConfig, c: WinConditionConfidence): WinConditionAxis {
    const w = cfg.pick;
    const threat = (p: SideProfile): number =>
        p.factor * sumTags(p.tags, (t) =>
            t.engageTool === 'soft-single' ? w.softSingle + (t.mobility === 'high' ? w.highMobilityBonus : 0) : 0);
    const counter = (p: SideProfile): number =>
        p.factor * sumTags(p.tags, (t) =>
            (t.disengageTools.includes('peel') ? w.peel : 0) + (t.disengageTools.includes('knockback') ? w.knockback : 0));
    return clashAxis('pick-vs-grouped', cfg, c, threat(a), counter(b), threat(b), counter(a), 'de pick', 'sécurité groupée');
}

// ---- internal: plans, collision, statements ---------------------------------

function planOf(axes: WinConditionAxis[], cfg: WinConditionAxesConfig, side: 1 | -1): WinConditionAxisId[] {
    return axes
        .filter((axis) => side * axis.score >= cfg.planMinScore)
        .sort((x, y) => side * y.score - side * x.score)
        .map((axis) => axis.id)
        .slice(0, cfg.planTopK);
}

function dedupeMarkers(ids: RiskMarkerId[]): RiskMarkerId[] {
    return [...new Set(ids)];
}

function buildCollision(
    axes: WinConditionAxis[],
    allyPlan: WinConditionAxisId[],
    enemyPlan: WinConditionAxisId[],
    cfg: WinConditionAxesConfig
): WinConditionCollision {
    // Fall back to the extreme axes when a plan is empty (one-sided draft):
    // the collision still names each side's least-bad lever.
    const byScoreDesc = [...axes].sort((x, y) => y.score - x.score);
    const allyAxisId = allyPlan[0] ?? byScoreDesc[0].id;
    const enemyCandidates = [...axes].sort((x, y) => x.score - y.score).filter((axis) => axis.id !== allyAxisId);
    const enemyAxisId = enemyPlan[0] !== undefined && enemyPlan[0] !== allyAxisId ? enemyPlan[0] : enemyCandidates[0].id;

    const allyNarrative = cfg.narratives[allyAxisId];
    const enemyNarrative = cfg.narratives[enemyAxisId];
    const override = cfg.collisionOverridesFr[collisionCellKey(allyAxisId, enemyAxisId)];
    return {
        allyAxisId,
        enemyAxisId,
        narrativeFr: override ?? `${allyNarrative.allyLeverFr} ${enemyNarrative.enemyLeverFr}`,
        triggers: [...allyNarrative.triggersAlly, ...enemyNarrative.triggersEnemy],
        riskMarkerIds: dedupeMarkers([...allyNarrative.riskWhenAlly, ...enemyNarrative.riskWhenEnemy])
    };
}

function buildStatements(
    axes: WinConditionAxis[],
    collision: WinConditionCollision,
    cfg: WinConditionAxesConfig
): WinConditionStatement[] {
    const score = (id: WinConditionAxisId): number => {
        const axis = axes.find((x) => x.id === id);
        return axis === undefined ? 0 : axis.score;
    };
    const statements: WinConditionStatement[] = [];
    const t = cfg.statementMinScore;

    // 1. The collision itself — narrative, not directly scoreable.
    statements.push({
        textFr:
            `Collision : « ${cfg.narratives[collision.allyAxisId].labelFr} » (vous) contre ` +
            `« ${cfg.narratives[collision.enemyAxisId].labelFr} » (eux) — le premier levier déclenché dicte la partie.`,
        direction: 'axis',
        falsifiableVia: 'none'
    });

    // 2. Scaling — postdictable on game duration conditional on the winner.
    const scaling = score('scaling-differential');
    if (scaling >= t) {
        statements.push({
            textFr:
                `Condition primaire : atteindre la phase tardive (${cfg.lateGameMinute} min+) — différentiel de scaling ` +
                `+${fmt(scaling)}. Vos victoires devraient être des parties longues.`,
            direction: 'late',
            falsifiableVia: 'gameLength'
        });
    } else if (scaling <= -t) {
        statements.push({
            textFr:
                `Votre fenêtre se referme avec le temps (différentiel de scaling −${fmt(-scaling)}) : conclure avant ` +
                `~${cfg.lateGameMinute} min. Vos victoires devraient être des parties courtes.`,
            direction: 'early',
            falsifiableVia: 'gameLength'
        });
    }

    // 3. Snowball — also a duration claim (a converted early lead ends games).
    const snowball = score('snowball-weakside');
    if (snowball >= t) {
        statements.push({
            textFr:
                `Le snowball early est votre moteur (+${fmt(snowball)}) : créer l'écart top/bot avant ` +
                `${cfg.earlyGameMinute} min et le convertir en victoire courte.`,
            direction: 'early',
            falsifiableVia: 'gameLength'
        });
    } else if (snowball <= -t) {
        statements.push({
            textFr:
                `Leur snowball early est leur moteur (−${fmt(-snowball)}) : passer les ${cfg.earlyGameMinute} premières ` +
                'minutes sans casse éteint leur plan.',
            direction: 'early',
            falsifiableVia: 'gameLength'
        });
    }

    // 4. Objectives — postdictable on objective-control columns (OE/Leaguepedia).
    const objectives = score('objective-control');
    if (objectives >= t) {
        statements.push({
            textFr: `Le contrôle des premiers objectifs (dragons, Nashor) devrait être vôtre (profil +${fmt(objectives)}).`,
            direction: 'mid',
            falsifiableVia: 'objectives'
        });
    } else if (objectives <= -t) {
        statements.push({
            textFr:
                `Les premiers objectifs penchent côté adverse (profil −${fmt(-objectives)}) : ` +
                'les acheter par un pick ou les céder proprement.',
            direction: 'mid',
            falsifiableVia: 'objectives'
        });
    }

    return statements;
}

// ---- public API ---------------------------------------------------------------

/**
 * Score the 8 bilateral win-condition axes for ally vs enemy comps (1-5
 * champion keys each, role-ordered 0 Top … 4 Support when full) and derive
 * plans, the plan collision and falsifiable statements.
 */
export function analyzeWinConditions(
    allyKeys: string[],
    enemyKeys: string[],
    options: WinConditionOptions = {}
): WinConditionReport {
    const tagsFile = options.tagsFile ?? loadDefaultTags();
    const cfg = options.config ?? DEFAULT_WIN_CONDITION_CONFIG;
    const ally = profileOf(allyKeys, tagsFile);
    const enemy = profileOf(enemyKeys, tagsFile);
    const confidence = confidenceFor(Math.min(ally.recognized, enemy.recognized));

    const axes: WinConditionAxis[] = [
        engageAxis(ally, enemy, cfg, confidence),
        diveAxis(ally, enemy, cfg, confidence),
        pokeAxis(ally, enemy, cfg, confidence),
        splitAxis(ally, enemy, cfg, confidence),
        scalingAxis(ally, enemy, cfg, confidence, options.dataset),
        snowballAxis(ally, enemy, cfg, confidence),
        objectiveAxis(ally, enemy, cfg, confidence),
        pickAxis(ally, enemy, cfg, confidence)
    ];

    const allyPlan = planOf(axes, cfg, 1);
    const enemyPlan = planOf(axes, cfg, -1);

    // A collision (and its statements) needs at least one champion per side.
    const readable = ally.recognized > 0 && enemy.recognized > 0;
    const collision = readable ? buildCollision(axes, allyPlan, enemyPlan, cfg) : null;
    const statements = collision === null ? [] : buildStatements(axes, collision, cfg);

    return { axes, allyPlan, enemyPlan, collision, statements };
}
