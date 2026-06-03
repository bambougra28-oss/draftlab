/**
 * Champion tag schema (M4.1).
 *
 * Six descriptive dimensions per champion + workflow metadata. Game-plan
 * affinity is NOT stored here — it's derived in M4.2 from these dimensions
 * (`gamePlanHints` is only an optional override nudge for signature picks).
 */

export const SCHEMA_VERSION = 1;

export const GAME_PLAN_ARCHETYPES = ['siege', 'split', 'pick', 'protect', 'engage'] as const;
export type GamePlanArchetype = (typeof GAME_PLAN_ARCHETYPES)[number];

export const DAMAGE_TYPES = ['AP', 'AD'] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const RANGES = ['melee', 'ranged-short', 'ranged-long'] as const;
export type ChampionRange = (typeof RANGES)[number];

export const ENGAGE_TOOLS = ['none', 'soft-single', 'hard-aoe'] as const;
export type EngageTool = (typeof ENGAGE_TOOLS)[number];

export const DISENGAGE_TOOLS = ['peel', 'knockback'] as const;
export type DisengageTool = (typeof DISENGAGE_TOOLS)[number];

export const MOBILITIES = ['low', 'medium', 'high'] as const;
export type Mobility = (typeof MOBILITIES)[number];

export const SCALING_WINDOWS = ['early', 'mid', 'late'] as const;
export type ScalingWindow = (typeof SCALING_WINDOWS)[number];

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const TAGGED_BY = ['claude', 'user', 'verified'] as const;
export type TaggedBy = (typeof TAGGED_BY)[number];

export interface ChampionTag {
    /** Data Dragon string id, e.g. "TwistedFate". */
    id: string;
    /** Display name, e.g. "Twisted Fate". */
    name: string;
    damageType: DamageType;
    /** Set only for genuine hybrids (Kog'Maw, Kai'Sa, …). */
    secondaryDamageType?: DamageType;
    range: ChampionRange;
    engageTool: EngageTool;
    disengageTools: DisengageTool[];
    mobility: Mobility;
    scalingWindow: ScalingWindow;
    hyperCarry: boolean;
    /** Optional archetype nudges for the M4.2 classifier (signature picks). */
    gamePlanHints?: GamePlanArchetype[];
    confidence: Confidence;
    taggedBy: TaggedBy;
    notes?: string;
}

export interface ChampionTagsFile {
    version: string;
    schemaVersion: number;
    patchTagged: string;
    lastUpdated: string;
    /** Keyed by numeric Data Dragon champion key (as a string). */
    champions: Record<string, ChampionTag>;
}
