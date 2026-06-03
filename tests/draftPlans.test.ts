import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    createDraftPlan,
    saveDraftPlan,
    getDraftPlan,
    listDraftPlans,
    deleteDraftPlan
} from '$lib/storage/draftPlans';
import { idbClear } from '$lib/storage/idb';
import { Role } from '$lib/types';

beforeEach(async () => {
    await idbClear('plans');
});

describe('draftPlans storage', () => {
    it('creates a plan with 5 ban slots and 5 role pick slots', () => {
        const plan = createDraftPlan({ name: 'Plan A' });
        expect(plan.name).toBe('Plan A');
        expect(plan.bans).toHaveLength(5);
        expect(plan.picks).toHaveLength(5);
        expect(plan.picks.map((p) => p.role)).toEqual([Role.Top, Role.Jungle, Role.Middle, Role.Bottom, Role.Support]);
        expect(plan.id).toBeTruthy();
    });

    it('round-trips a plan through IndexedDB', async () => {
        const plan = createDraftPlan({ name: 'Plan B', side: 'blue' });
        await saveDraftPlan(plan);
        const fetched = await getDraftPlan(plan.id);
        expect(fetched?.name).toBe('Plan B');
        expect(fetched?.side).toBe('blue');
    });

    it('lists all saved plans', async () => {
        await saveDraftPlan(createDraftPlan({ name: 'P1' }));
        await saveDraftPlan(createDraftPlan({ name: 'P2' }));
        expect(await listDraftPlans()).toHaveLength(2);
    });

    it('deletes a plan', async () => {
        const plan = createDraftPlan({ name: 'P' });
        await saveDraftPlan(plan);
        await deleteDraftPlan(plan.id);
        expect(await getDraftPlan(plan.id)).toBeUndefined();
    });

    it('refreshes updatedAt on save', async () => {
        const plan = createDraftPlan({ name: 'P' });
        const saved = await saveDraftPlan({ ...plan, name: 'P renamed' });
        expect(saved.name).toBe('P renamed');
        expect(saved.updatedAt).toBeGreaterThanOrEqual(plan.createdAt);
    });
});
