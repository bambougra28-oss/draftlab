/**
 * Hand-rolled validator + lookup helpers for the champion tag file.
 *
 * No schema library: a small explicit validator keeps the dependency surface
 * minimal and produces precise, champion-scoped error messages.
 */
import {
    CONFIDENCE_LEVELS,
    DAMAGE_TYPES,
    DISENGAGE_TOOLS,
    ENGAGE_TOOLS,
    GAME_PLAN_ARCHETYPES,
    MOBILITIES,
    RANGES,
    SCALING_WINDOWS,
    SCHEMA_VERSION,
    TAGGED_BY,
    type ChampionTag,
    type ChampionTagsFile
} from './types';

export class TagValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TagValidationError';
    }
}

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function oneOf<T extends readonly string[]>(
    allowed: T,
    value: unknown,
    field: string,
    where: string
): T[number] {
    if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
        throw new TagValidationError(
            `${where}: invalid ${field} "${String(value)}" (expected one of: ${allowed.join(', ')})`
        );
    }
    return value as T[number];
}

const REQUIRED_FIELDS = [
    'id',
    'name',
    'damageType',
    'range',
    'engageTool',
    'disengageTools',
    'mobility',
    'scalingWindow',
    'hyperCarry',
    'confidence',
    'taggedBy'
] as const;

export function parseChampionTag(key: string, raw: unknown): ChampionTag {
    const where = `champion ${key}`;
    if (!isObject(raw)) throw new TagValidationError(`${where}: entry is not an object`);

    for (const field of REQUIRED_FIELDS) {
        if (!(field in raw)) throw new TagValidationError(`${where}: missing field "${field}"`);
    }

    const id = raw.id;
    const name = raw.name;
    const hyperCarry = raw.hyperCarry;
    const disengageRaw = raw.disengageTools;

    if (typeof id !== 'string') throw new TagValidationError(`${where}: id must be a string`);
    if (typeof name !== 'string') throw new TagValidationError(`${where}: name must be a string`);
    if (typeof hyperCarry !== 'boolean') throw new TagValidationError(`${where}: hyperCarry must be a boolean`);
    if (!Array.isArray(disengageRaw)) throw new TagValidationError(`${where}: disengageTools must be an array`);

    const tag: ChampionTag = {
        id,
        name,
        damageType: oneOf(DAMAGE_TYPES, raw.damageType, 'damageType', where),
        range: oneOf(RANGES, raw.range, 'range', where),
        engageTool: oneOf(ENGAGE_TOOLS, raw.engageTool, 'engageTool', where),
        disengageTools: disengageRaw.map((d) => oneOf(DISENGAGE_TOOLS, d, 'disengageTools entry', where)),
        mobility: oneOf(MOBILITIES, raw.mobility, 'mobility', where),
        scalingWindow: oneOf(SCALING_WINDOWS, raw.scalingWindow, 'scalingWindow', where),
        hyperCarry,
        confidence: oneOf(CONFIDENCE_LEVELS, raw.confidence, 'confidence', where),
        taggedBy: oneOf(TAGGED_BY, raw.taggedBy, 'taggedBy', where)
    };

    if ('secondaryDamageType' in raw && raw.secondaryDamageType !== undefined) {
        tag.secondaryDamageType = oneOf(DAMAGE_TYPES, raw.secondaryDamageType, 'secondaryDamageType', where);
    }
    if ('gamePlanHints' in raw && raw.gamePlanHints !== undefined) {
        if (!Array.isArray(raw.gamePlanHints)) {
            throw new TagValidationError(`${where}: gamePlanHints must be an array`);
        }
        tag.gamePlanHints = raw.gamePlanHints.map((h) =>
            oneOf(GAME_PLAN_ARCHETYPES, h, 'gamePlanHints entry', where)
        );
    }
    if ('notes' in raw && raw.notes !== undefined) {
        if (typeof raw.notes !== 'string') throw new TagValidationError(`${where}: notes must be a string`);
        tag.notes = raw.notes;
    }

    return tag;
}

const TOP_LEVEL_FIELDS = ['version', 'schemaVersion', 'patchTagged', 'lastUpdated', 'champions'] as const;

export function validateTagsFile(raw: unknown): ChampionTagsFile {
    if (!isObject(raw)) throw new TagValidationError('tags file: root is not an object');

    for (const field of TOP_LEVEL_FIELDS) {
        if (!(field in raw)) throw new TagValidationError(`tags file: missing top-level field "${field}"`);
    }
    if (raw.schemaVersion !== SCHEMA_VERSION) {
        throw new TagValidationError(
            `tags file: unsupported schemaVersion ${String(raw.schemaVersion)} (expected ${SCHEMA_VERSION})`
        );
    }
    if (!isObject(raw.champions)) throw new TagValidationError('tags file: champions must be an object');

    const champions: Record<string, ChampionTag> = {};
    for (const [key, value] of Object.entries(raw.champions)) {
        champions[key] = parseChampionTag(key, value);
    }

    return {
        version: String(raw.version),
        schemaVersion: SCHEMA_VERSION,
        patchTagged: String(raw.patchTagged),
        lastUpdated: String(raw.lastUpdated),
        champions
    };
}

// ---- lookup helpers ----

export function getTag(file: ChampionTagsFile, key: string): ChampionTag | undefined {
    return file.champions[key];
}

/** Case-insensitive lookup by display name or Data Dragon id. */
export function getTagByName(file: ChampionTagsFile, nameOrId: string): ChampionTag | undefined {
    const needle = nameOrId.toLowerCase();
    return Object.values(file.champions).find(
        (c) => c.name.toLowerCase() === needle || c.id.toLowerCase() === needle
    );
}

export function allTags(file: ChampionTagsFile): ChampionTag[] {
    return Object.values(file.champions);
}

export function tagKeys(file: ChampionTagsFile): string[] {
    return Object.keys(file.champions);
}
