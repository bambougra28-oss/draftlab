/**
 * Chantier D (run #2) — Persistance des arbres de prep compilés (§2.4).
 *
 * L'arbre est un artefact SÉPARÉ keyé par `planId` : `DraftPlan` n'est pas
 * modifié (rétro-compat parfaite, pas de migration), la liste /plans ne paie
 * jamais le poids des arbres (~0,2-1 Mo par arbre selon le budget) — l'arbre
 * se charge paresseusement quand on en a besoin. Supprimer un plan supprime
 * son arbre (cascade dans la page, voir /plans/[id]).
 *
 * Store `planTrees` (schema v3 — l'upgrade path n'ajoute QUE des stores,
 * invariant documenté dans idb.ts). PlanTree est intégralement composé de
 * types structurés clonables (aucun Set/Map) : structured clone direct.
 */
import { idbDelete, idbGet, idbPut } from './idb';
import type { PlanTree } from '$lib/strategic/planTree';

export interface StoredPlanTree extends PlanTree {
    id: string; // id = planId (clé du store)
}

const STORE = 'planTrees' as const;

/** Persiste l'arbre sous la clé de son plan (un arbre par plan, remplacé). */
export async function savePlanTree(tree: PlanTree): Promise<StoredPlanTree> {
    const stored: StoredPlanTree = { ...tree, id: tree.planId };
    await idbPut(STORE, stored);
    return stored;
}

export function getPlanTree(planId: string): Promise<StoredPlanTree | undefined> {
    return idbGet<StoredPlanTree>(STORE, planId);
}

export function deletePlanTree(planId: string): Promise<undefined> {
    return idbDelete(STORE, planId);
}
