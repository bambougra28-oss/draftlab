/**
 * Chantier F (F-c) — Le correctif du trou de lecture des rôles
 * (docs/run2/F-pocket-picks.md §2 F-c et §3.2 « GARDE DE BRANCHEMENT », gelé).
 *
 * ⚠ CODE PRÊT MAIS DÉBRANCHÉ — AUCUN APPELANT. Branchement conditionné :
 * F2 VERTE (hi < 0 du Δ_contamination, scripts/backtest/roleSurprise.ts)
 * PUIS re-run OBLIGATOIRE de scripts/backtest/roleInference.ts avec
 * non-régression accuracy pooled k=3 ≥ 94,5 % exigée — sinon F-c est
 * débranché et le rouge documenté : le système VERT pré-enregistré (95,0 %)
 * prime sur toute défense nouvelle.
 *
 * Mécanisme SANS nouveau paramètre :
 *  - DÉCLENCHEUR (live) : `surpriseOf(pick).bits ≥ surpriseAlarmBits = 5`
 *    (config commitée `rangeModelConfig.ts` ; ε = 1e-3 ⇒ bits ≤ ~9,97)
 *    ET rôle-novelté STRUCTURELLE : compte train équipe+ligue du couple
 *    (champion, rôle le plus probable de la lecture courante) = 0 — le
 *    compteur est INJECTÉ (fold du harnais ou priors live), jamais lu ici.
 *  - TRANSFORMATION : pour le champion déclencheur SEUL, les poids de rôle
 *    passent à l'UNIFORME (β = 1 — EXACTEMENT le chemin fallback
 *    champion-inconnu de `readEnemyRoles`, `$lib/intel/liveDraft.ts` :
 *    `{ 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 }`) ; les AUTRES champions gardent
 *    leurs priors. La ré-énumération des hypothèses
 *    (`roleAssignmentHypotheses`) est LAISSÉE À L'APPELANT.
 *
 * L'avertissement FR (« pick préparé — leur prep est profonde ») et le dark
 * pool adverse restent de la LECTURE côté UI (PocketPanel) — aucun claim.
 *
 * Module pur : zéro I/O, zéro horloge.
 */
import type { RolePriors } from '$lib/strategic/fogReveal';
import { DEFAULT_RANGE_MODEL_CONFIG, type RangeModelConfig } from '$lib/strategic/rangeModelConfig';
import type { Role } from '$lib/types';

/** β = 1 : le MÊME objet de poids que le fallback uniforme de readEnemyRoles. */
export const UNIFORM_ROLE_WEIGHTS: Readonly<Partial<Record<Role, number>>> = {
    0: 1,
    1: 1,
    2: 1,
    3: 1,
    4: 1
};

export interface SurpriseDefenseTrigger {
    /** `surpriseOf(pick).bits` — la lecture I1 du slot réellement joué. */
    bits: number;
    /** Rôle le plus probable de la LECTURE COURANTE (marginal I2) ; null = illisible. */
    mostProbableRole: Role | null;
}

export interface SurpriseDefenseContext {
    /**
     * Compte train ÉQUIPE+LIGUE du couple (champion, rôle) — injecté (la
     * ligue contient l'équipe : un seul compteur suffit, = 0 exigé).
     */
    trainRoleCountOf: (championKey: string, role: Role) => number;
    /** Config commitée — seule source du seuil (surpriseAlarmBits = 5). */
    config?: RangeModelConfig;
}

/**
 * Déclencheur F-c : alarme en bits (≥ surpriseAlarmBits, seuil commité)
 * ET rôle-novelté structurelle (compte train équipe+ligue de (c, rôle le
 * plus probable de la lecture courante) = 0). Lecture illisible
 * (mostProbableRole null) ⇒ jamais déclenché (pas de couple à tester).
 */
export function shouldTriggerSurpriseDefense(
    championKey: string,
    trigger: SurpriseDefenseTrigger,
    ctx: SurpriseDefenseContext
): boolean {
    const config = ctx.config ?? DEFAULT_RANGE_MODEL_CONFIG;
    if (trigger.bits < config.surpriseAlarmBits) return false;
    if (trigger.mostProbableRole === null) return false;
    return ctx.trainRoleCountOf(championKey, trigger.mostProbableRole) === 0;
}

/**
 * Transformation gelée : les champions déclencheurs passent à l'uniforme
 * (β = 1, sémantique readEnemyRoles), TOUS les autres gardent leurs priors
 * (la fonction de base est rendue telle quelle — référence identique).
 * La ré-énumération (`roleAssignmentHypotheses`) appartient à l'appelant.
 */
export function uniformizeTriggeredPriors(
    base: RolePriors,
    triggeredKeys: ReadonlySet<string>
): RolePriors {
    return (championKey) =>
        triggeredKeys.has(championKey)
            ? { ...UNIFORM_ROLE_WEIGHTS }
            : base(championKey);
}
