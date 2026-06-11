/**
 * Chantier F (F-c) — Le correctif du trou de lecture des rôles
 * (docs/run2/F-pocket-picks.md §2 F-c et §3.2 « GARDE DE BRANCHEMENT », gelé).
 *
 * ✅ BRANCHÉ LIVE (2026-06-11) — les deux conditions gelées sont passées :
 *  - F2 VERTE : Δ_contamination = −82,49 pp, IC bootstrap 95 % cluster
 *    [−87,7 ; −77,7] (docs/calibration/role-surprise-f2.md) ;
 *  - non-régression re-jouée DÉFENSE ACTIVE : accuracy pooled k=3 = 95,3 %
 *    ≥ plancher gelé 94,5 % (docs/calibration/role-inference-surprise-defense.md,
 *    mode --surprise-defense de scripts/backtest/roleInference.ts, chantier W1).
 * Appelants : le harnais W1 (déclencheur par fold) et la page draft
 * (+page.svelte) via `detectLiveSurpriseTriggers` ci-dessous — la version
 * LIVE de la même mécanique sur les données de la page.
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
 * L'avertissement FR (« pick préparé — leur prep est profonde ») est de la
 * LECTURE côté UI (CoachPanel, près des alertes de rôles) — aucun claim ; le
 * dark pool adverse reste de la lecture (PocketPanel).
 *
 * Module pur : zéro I/O, zéro horloge.
 */
import { slotGroupOf, type TendencyTable } from '$lib/aggregates/tendency';
import type { DraftSide } from '$lib/data/types';
import { draftStateFromRoleEntry, type EnemyRoleReport, type RoleEntryDraft } from '$lib/intel/liveDraft';
import type { RolePriors } from '$lib/strategic/fogReveal';
import { predictEnemyRange, surpriseOf } from '$lib/strategic/rangeModel';
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

// ---- branchement LIVE (page draft) ------------------------------------------

/** Un déclencheur F-c actif sur la draft en cours (alerte « pick préparé »). */
export interface LiveSurpriseTrigger {
    championKey: string;
    /** `surpriseOf(pick).bits` — lecture I1 du slot reconstruit (≤ ~9,97). */
    bits: number;
    /** Rôle le plus probable de la lecture de BASE au moment du déclenchement. */
    role: Role;
}

export interface LiveSurpriseDefenseInput {
    /**
     * La MÊME entrée role-keyed que `readEnemyRoles` : les picks LUS sont
     * `entry.enemyPicks` ; les bans saisis servent d'exclusions de range
     * (readEnemyRoles les ignore — aucun effet sur la lecture elle-même).
     */
    entry: RoleEntryDraft;
    /**
     * La lecture de BASE (priors non défendus) — source du rôle le plus
     * probable (marginal I2, même sémantique que `marginalTopRole` du
     * harnais W1 : égalité ⇒ rôle d'indice le plus bas, lecture vide ⇒ null).
     */
    baseReport: EnemyRoleReport;
    /**
     * Table de tendances de l'ÉQUIPE LUE — le « modèle public » dont les bits
     * mesurent l'écart. GARDE DE COÛT : fittée sur corpus/équipe uniquement
     * (au sync — `buildOpponentIntel` côté page), JAMAIS à la frappe.
     */
    table: TendencyTable;
    /** Compte train ÉQUIPE+LIGUE du couple (champion, rôle) — injecté. */
    trainRoleCountOf: (championKey: string, role: Role) => number;
    /** Config commitée — seule source du seuil (surpriseAlarmBits = 5). */
    config?: RangeModelConfig;
}

/**
 * Déclencheurs F-c sur les données LIVE — la mécanique du harnais W1
 * (scripts/backtest/roleInference.ts --surprise-defense) reproduite sur la
 * saisie de la page : chaque pick révélé du camp LU est replacé sur le
 * template (l'approximation d'ordre documentée de `draftStateFromRoleEntry`),
 * la range tenue AVANT lui est `predictEnemyRange` (exclude = tout champion
 * sorti à un seq strictement antérieur — picks ET bans saisis), et le
 * déclencheur gelé `shouldTriggerSurpriseDefense` décide. Pick hors-template :
 * jamais évalué, jamais déclenché (doctrine W1). La transformation
 * (`uniformizeTriggeredPriors`) et la ré-énumération restent À L'APPELANT.
 *
 * Différence assumée avec W1 (saisie par rôle oblige) : le seq de chaque pick
 * est l'approximation template par ordre de rôle, pas l'ordre réel — en mode
 * séquence la projection role-keyed de la page porte le même ordre approché.
 */
export function detectLiveSurpriseTriggers(input: LiveSurpriseDefenseInput): LiveSurpriseTrigger[] {
    const state = draftStateFromRoleEntry(input.entry);
    const readSide: DraftSide = input.entry.allySide === 'blue' ? 'red' : 'blue';
    const topRoleOf = new Map<string, Role | null>();
    for (const read of input.baseReport.reads) topRoleOf.set(read.championKey, read.topRole);

    const triggers: LiveSurpriseTrigger[] = [];
    for (const action of state.actions) {
        if (action.type !== 'pick' || action.side !== readSide || action.championKey === '') continue;
        const group = slotGroupOf(action);
        if (group === undefined) continue; // hors template : jamais évalué, jamais déclenché
        // La range tenue pour le slot AVANT le pick : exclude = tout champion
        // déjà sorti (picks/bans, seq strictement antérieur) — patron W1.
        const exclude = new Set<string>();
        for (const other of state.actions) {
            if (other.championKey !== '' && other.seq < action.seq) exclude.add(other.championKey);
        }
        const range = predictEnemyRange({
            table: input.table,
            slotGroup: group,
            side: action.side,
            exclude,
            ...(input.config !== undefined ? { config: input.config } : {})
        });
        const { bits } = surpriseOf(action.championKey, range, input.config ?? DEFAULT_RANGE_MODEL_CONFIG);
        const mostProbableRole = topRoleOf.get(action.championKey) ?? null;
        const triggered = shouldTriggerSurpriseDefense(
            action.championKey,
            { bits, mostProbableRole },
            {
                trainRoleCountOf: input.trainRoleCountOf,
                ...(input.config !== undefined ? { config: input.config } : {})
            }
        );
        if (triggered) {
            // mostProbableRole non-null garanti : le déclencheur l'exige.
            triggers.push({ championKey: action.championKey, bits, role: mostProbableRole as Role });
        }
    }
    return triggers;
}
