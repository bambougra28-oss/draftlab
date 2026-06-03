/**
 * M6.2 — Plan A/B/C builder storage.
 *
 * A DraftPlan is a free-form-named (DA1) draft blueprint: 5 ban slots + 5 pick
 * slots (primary + fallback + rationale per role), optionally linked to the
 * games of a series via `applicableGames`. Persisted in the `plans` store.
 */
import { idbDelete, idbGet, idbGetAll, idbPut } from './idb';
import { ROLES, Role } from '$lib/types';

export interface BanPlan {
    championKey: string | null;
    rationale?: string;
}

export interface PickPlan {
    role: Role;
    primary: string | null;
    fallback: string | null;
    rationale?: string;
}

export interface DraftPlan {
    id: string;
    name: string;
    side?: 'blue' | 'red';
    bans: BanPlan[];
    picks: PickPlan[];
    /** Series game numbers this plan is meant for (DA1 link). */
    applicableGames?: number[];
    notes?: string;
    createdAt: number;
    updatedAt: number;
}

export interface DraftPlanInput {
    name: string;
    side?: 'blue' | 'red';
    bans?: BanPlan[];
    picks?: PickPlan[];
    applicableGames?: number[];
    notes?: string;
}

const STORE = 'plans' as const;

function newId(): string {
    return crypto.randomUUID();
}

function emptyBans(): BanPlan[] {
    return Array.from({ length: 5 }, () => ({ championKey: null }));
}

function emptyPicks(): PickPlan[] {
    return ROLES.map((role) => ({ role, primary: null, fallback: null }));
}

export function createDraftPlan(input: DraftPlanInput): DraftPlan {
    const now = Date.now();
    return {
        id: newId(),
        name: input.name,
        side: input.side,
        bans: input.bans ?? emptyBans(),
        picks: input.picks ?? emptyPicks(),
        applicableGames: input.applicableGames,
        notes: input.notes,
        createdAt: now,
        updatedAt: now
    };
}

export async function saveDraftPlan(plan: DraftPlan): Promise<DraftPlan> {
    const updated: DraftPlan = { ...plan, updatedAt: Date.now() };
    await idbPut(STORE, updated);
    return updated;
}

export function getDraftPlan(id: string): Promise<DraftPlan | undefined> {
    return idbGet<DraftPlan>(STORE, id);
}

export function listDraftPlans(): Promise<DraftPlan[]> {
    return idbGetAll<DraftPlan>(STORE);
}

export function deleteDraftPlan(id: string): Promise<undefined> {
    return idbDelete(STORE, id);
}
