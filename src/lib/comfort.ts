/**
 * M2 — localStorage-backed champion comfort tags (per championKey).
 *
 * The coach can manually mark a champion as comfort / cheese / unavailable;
 * the override persists across sessions in a single JSON map under
 * `COMFORT_STORAGE_KEY`. When no override exists, the default comes from the
 * player's pool size via `$lib/pro/comfortDefaults` (≥5g comfort, 1–4g cheese,
 * 0g unavailable — single source of truth, per M2 Ping 3).
 *
 * This module is the documented localStorage exception to the "pure
 * components" rule: UI components stay props-driven, the *routes* call this
 * API and pass the resolved modes down. `storage` is injectable everywhere so
 * the logic is testable in Node; subscribers get notified on every write so
 * independent panels can stay in sync without a store framework.
 */
import type { ComfortMode } from '$lib/types';
import { comfortModeFromGames } from '$lib/pro/comfortDefaults';

export const COMFORT_STORAGE_KEY = 'draftlab:comfort:tags';

/** Only explicit overrides are persisted — 'none' clears the entry instead. */
const STORED_MODES: readonly ComfortMode[] = ['comfort', 'cheese', 'unavailable'];

export type ComfortListener = (championKey: string, mode: ComfortMode) => void;

const listeners = new Set<ComfortListener>();

function resolveStorage(explicit?: Storage): Storage | null {
    if (explicit) return explicit;
    return typeof localStorage !== 'undefined' ? localStorage : null;
}

/** All persisted overrides, ignoring corrupt JSON and unknown values. */
export function readComfortTags(storage?: Storage): Record<string, ComfortMode> {
    const raw = resolveStorage(storage)?.getItem(COMFORT_STORAGE_KEY);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
        const tags: Record<string, ComfortMode> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (STORED_MODES.includes(value as ComfortMode)) tags[key] = value as ComfortMode;
        }
        return tags;
    } catch {
        return {};
    }
}

export interface GetComfortOptions {
    storage?: Storage;
    /** Pool size used to derive the default when no override is stored. */
    poolGames?: number;
}

/**
 * Resolved comfort mode for a champion: stored override → pool-size default
 * (when `poolGames` is provided) → 'none'.
 */
export function getComfortTag(championKey: string, options: GetComfortOptions = {}): ComfortMode {
    const stored = readComfortTags(options.storage)[championKey];
    if (stored !== undefined) return stored;
    if (options.poolGames !== undefined) return comfortModeFromGames(options.poolGames);
    return 'none';
}

/**
 * Persist an override (or clear it with 'none') and notify subscribers.
 * Quota/serialization failures are swallowed — the in-session notification
 * still fires so the UI stays coherent.
 */
export function setComfortTag(championKey: string, mode: ComfortMode, storage?: Storage): void {
    const store = resolveStorage(storage);
    const tags = readComfortTags(storage);

    if (mode === 'none') {
        delete tags[championKey];
    } else {
        tags[championKey] = mode;
    }

    try {
        store?.setItem(COMFORT_STORAGE_KEY, JSON.stringify(tags));
    } catch {
        // QuotaExceededError — degrade gracefully.
    }

    for (const listener of listeners) listener(championKey, mode);
}

/** Subscribe to comfort writes; returns the unsubscribe function. */
export function subscribeComfort(listener: ComfortListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Drop every persisted override (manual reset, e.g. on team change). */
export function clearComfortTags(storage?: Storage): void {
    resolveStorage(storage)?.removeItem(COMFORT_STORAGE_KEY);
}
