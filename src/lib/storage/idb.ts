/**
 * M6.2 — Minimal promisified IndexedDB wrapper (no external dependency).
 *
 * Schema v1: three object stores keyed by `id` — plans, series, preferences.
 * Schema v2 (R1): + `snapshots` (immutable dated provider payloads, DA-V2-3)
 * and `datasets` (the ~50 MB DraftGap feeds, moved off localStorage —
 * STEP_UP #3). Schema v3 (run #2 chantier D, R6): + `planTrees` (compiled
 * opponent plan trees keyed by planId — a separate artefact, DraftPlan is
 * untouched). The upgrade path only ever ADDS stores, so bumping the version
 * preserves existing user data. Used only client-side (DV4: no auth, no cloud
 * sync). In tests, the global `indexedDB` is provided by `fake-indexeddb`.
 */
export const DB_NAME = 'draftlab';
export const DB_VERSION = 3;

export type StoreName = 'plans' | 'series' | 'preferences' | 'snapshots' | 'datasets' | 'planTrees';
const STORES: StoreName[] = ['plans', 'series', 'preferences', 'snapshots', 'datasets', 'planTrees'];

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            for (const store of STORES) {
                if (!db.objectStoreNames.contains(store)) {
                    db.createObjectStore(store, { keyPath: 'id' });
                }
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return dbPromise;
}

async function run<T>(
    store: StoreName,
    mode: IDBTransactionMode,
    fn: (objectStore: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
    const db = await openDatabase();
    const tx = db.transaction(store, mode);
    return promisifyRequest(fn(tx.objectStore(store)));
}

export function idbGet<T>(store: StoreName, id: string): Promise<T | undefined> {
    return run<T | undefined>(store, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>);
}

export function idbGetAll<T>(store: StoreName): Promise<T[]> {
    return run<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}

export function idbPut<T extends { id: string }>(store: StoreName, value: T): Promise<IDBValidKey> {
    return run<IDBValidKey>(store, 'readwrite', (s) => s.put(value));
}

export function idbDelete(store: StoreName, id: string): Promise<undefined> {
    return run<undefined>(store, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
}

export function idbClear(store: StoreName): Promise<undefined> {
    return run<undefined>(store, 'readwrite', (s) => s.clear() as IDBRequest<undefined>);
}

/** Drops the cached connection — test helper / for use after a schema bump. */
export function resetConnection(): void {
    dbPromise = null;
}
