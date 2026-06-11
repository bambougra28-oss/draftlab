/**
 * Chantier D (run #2) — storage des arbres de prep (fake-indexeddb, patron
 * des tests storage existants). Couvre EXPLICITEMENT l'upgrade v2→v3 : une
 * base écrite au schéma v2 (5 stores) conserve ses plans après le bump —
 * l'upgrade path n'ajoute QUE des stores (invariant documenté d'idb.ts).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { DB_NAME, DB_VERSION, idbClear, idbGet, openDatabase, resetConnection } from '$lib/storage/idb';
import { deletePlanTree, getPlanTree, savePlanTree } from '$lib/storage/planTrees';
import { PLAN_TREE_DEFAULTS, type PlanTree } from '$lib/strategic/planTree';

function deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => resolve(); // fake-indexeddb : pas d'onglets concurrents
    });
}

/** Ouvre la base au schéma v2 HISTORIQUE (5 stores, sans planTrees). */
function openV2(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onupgradeneeded = () => {
            for (const store of ['plans', 'series', 'preferences', 'snapshots', 'datasets']) {
                if (!request.result.objectStoreNames.contains(store)) {
                    request.result.createObjectStore(store, { keyPath: 'id' });
                }
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function putV2Plan(db: IDBDatabase, plan: { id: string; name: string }): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('plans', 'readwrite');
        tx.objectStore('plans').put(plan);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

const tree: PlanTree = {
    planId: 'plan-1',
    opponent: 'KOI',
    ourSide: 'blue',
    builtAt: 1000,
    modelProvenance: { records: 12, latestPatch: '26.10', league: 'lec' },
    config: PLAN_TREE_DEFAULTS,
    excludedKeys: ['x1'],
    root: {
        ourLine: [{ seq: 1, type: 'ban', championKey: 'Z', fallback: 'Z2' }],
        enemySeq: 2,
        branches: [
            {
                championKey: 'a',
                p: 0.5,
                rawCount: 4,
                total: 6,
                exampleGameIds: ['g1'],
                child: { ourLine: [], enemySeq: null, branches: [], pathMass: 0.5 }
            }
        ],
        pathMass: 1
    },
    nodeCount: 2
};

describe('upgrade v2 → v3 (ordre garanti : ce describe tourne sur base vierge)', () => {
    it('préserve un plan écrit en v2 et ajoute le store planTrees', async () => {
        resetConnection();
        await deleteDatabase();

        // 1. Base v2 historique + un plan utilisateur.
        const v2 = await openV2();
        expect([...v2.objectStoreNames]).not.toContain('planTrees');
        await putV2Plan(v2, { id: 'legacy-plan', name: 'Plan écrit en v2' });
        v2.close();

        // 2. Réouverture par le module (bump v3) : données intactes + nouveau store.
        resetConnection();
        const v3 = await openDatabase();
        expect(DB_VERSION).toBe(3);
        expect(v3.version).toBe(3);
        expect([...v3.objectStoreNames]).toContain('planTrees');
        const legacy = await idbGet<{ id: string; name: string }>('plans', 'legacy-plan');
        expect(legacy?.name).toBe('Plan écrit en v2');

        // 3. Le nouveau store est fonctionnel dans la même base.
        await savePlanTree(tree);
        expect((await getPlanTree('plan-1'))?.opponent).toBe('KOI');
    });
});

describe('planTrees — save/get/delete keyés par planId', () => {
    beforeEach(async () => {
        await idbClear('planTrees');
    });

    it('round-trip complet : l’arbre revient identique, id = planId', async () => {
        const stored = await savePlanTree(tree);
        expect(stored.id).toBe('plan-1');
        const fetched = await getPlanTree('plan-1');
        expect(fetched).toEqual({ ...tree, id: 'plan-1' });
        expect(fetched?.root.branches[0].child.pathMass).toBe(0.5);
        expect(fetched?.excludedKeys).toEqual(['x1']);
    });

    it('recompiler remplace l’arbre du plan (une clé, un arbre)', async () => {
        await savePlanTree(tree);
        await savePlanTree({ ...tree, builtAt: 2000, nodeCount: 9 });
        const fetched = await getPlanTree('plan-1');
        expect(fetched?.builtAt).toBe(2000);
        expect(fetched?.nodeCount).toBe(9);
    });

    it('delete par planId, get inconnu → undefined (cascade côté page)', async () => {
        await savePlanTree(tree);
        await deletePlanTree('plan-1');
        expect(await getPlanTree('plan-1')).toBeUndefined();
        expect(await getPlanTree('jamais-vu')).toBeUndefined();
    });
});
