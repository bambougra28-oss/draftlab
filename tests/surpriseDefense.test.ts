/**
 * Chantier F (F-c) — surpriseDefense : déclencheur gelé + transformation
 * uniforme (β = 1, sémantique readEnemyRoles). Code PRÊT mais DÉBRANCHÉ —
 * ces tests valident le mécanisme SANS le brancher (aucun appelant).
 *
 * Nombre de tests DÉRIVÉ À LA MAIN :
 *  - déclencheur : bits = 5 exactement (≥ inclusif) + novelté ........ 1 test
 *  - bits 4,9 < seuil → jamais déclenché ............................. 1 test
 *  - compte train (c, r*) ≥ 1 → pas de novelté structurelle ......... 1 test
 *  - lecture illisible (mostProbableRole null) → jamais ............. 1 test
 *  - seuil = config commitée (défaut 5) et INJECTABLE ............... 1 test
 *  - transformation : déclencheur SEUL → uniforme β = 1 EXACT
 *    (l'objet du fallback readEnemyRoles), autres priors intacts
 *    (référence identique), base jamais mutée ........................ 2 tests
 *  TOTAL ............................................................. 7 tests
 */
import { describe, expect, it } from 'vitest';
import {
    UNIFORM_ROLE_WEIGHTS,
    shouldTriggerSurpriseDefense,
    uniformizeTriggeredPriors,
    type SurpriseDefenseContext
} from '$lib/intel/surpriseDefense';
import { DEFAULT_RANGE_MODEL_CONFIG } from '$lib/strategic/rangeModelConfig';
import type { RolePriors } from '$lib/strategic/fogReveal';
import { Role } from '$lib/types';

const neverSeen: SurpriseDefenseContext = { trainRoleCountOf: () => 0 };

describe('shouldTriggerSurpriseDefense — déclencheur gelé', () => {
    it('bits = 5 exactement (seuil commité, ≥ inclusif) ∧ compte (c, r*) = 0 → déclenche', () => {
        expect(
            shouldTriggerSurpriseDefense('75', { bits: 5, mostProbableRole: Role.Top }, neverSeen)
        ).toBe(true);
        expect(DEFAULT_RANGE_MODEL_CONFIG.surpriseAlarmBits).toBe(5);
    });

    it('bits 4,9 < seuil → jamais déclenché (même novelté totale)', () => {
        expect(
            shouldTriggerSurpriseDefense('75', { bits: 4.9, mostProbableRole: Role.Top }, neverSeen)
        ).toBe(false);
    });

    it('compte train équipe+ligue (c, r*) ≥ 1 → pas de rôle-novelté structurelle', () => {
        const ctx: SurpriseDefenseContext = {
            trainRoleCountOf: (key, role) => (key === '75' && role === Role.Top ? 1 : 0)
        };
        expect(shouldTriggerSurpriseDefense('75', { bits: 9, mostProbableRole: Role.Top }, ctx)).toBe(false);
        // Le même pick lu sur un AUTRE rôle jamais vu déclenche bien.
        expect(shouldTriggerSurpriseDefense('75', { bits: 9, mostProbableRole: Role.Jungle }, ctx)).toBe(true);
    });

    it('lecture courante illisible (mostProbableRole null) → jamais déclenché', () => {
        expect(shouldTriggerSurpriseDefense('75', { bits: 9, mostProbableRole: null }, neverSeen)).toBe(false);
    });

    it('seuil = config commitée par défaut, injectable sans nouveau paramètre', () => {
        const stricter = { ...DEFAULT_RANGE_MODEL_CONFIG, surpriseAlarmBits: 6 };
        expect(
            shouldTriggerSurpriseDefense(
                '75',
                { bits: 5.5, mostProbableRole: Role.Top },
                { ...neverSeen, config: stricter }
            )
        ).toBe(false);
        expect(
            shouldTriggerSurpriseDefense('75', { bits: 5.5, mostProbableRole: Role.Top }, neverSeen)
        ).toBe(true);
    });
});

describe('uniformizeTriggeredPriors — transformation du déclencheur SEUL', () => {
    const basePriors: Partial<Record<Role, number>> = { [Role.Top]: 7, [Role.Middle]: 3 };
    const base: RolePriors = (championKey) => (championKey === 'autre' ? basePriors : { [Role.Top]: 2 });

    it('déclencheur → uniforme β = 1 EXACT (l’objet du fallback readEnemyRoles)', () => {
        const priors = uniformizeTriggeredPriors(base, new Set(['75']));
        expect(priors('75')).toEqual({ 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 });
        expect(priors('75')).toEqual({ ...UNIFORM_ROLE_WEIGHTS });
    });

    it('les autres champions gardent leurs priors (référence identique, base jamais mutée)', () => {
        const priors = uniformizeTriggeredPriors(base, new Set(['75']));
        expect(priors('autre')).toBe(basePriors); // même référence : aucun re-calcul
        expect(basePriors).toEqual({ [Role.Top]: 7, [Role.Middle]: 3 }); // pas de mutation
        // Le retour du déclencheur est une copie : l'appelant ne peut pas
        // corrompre la constante partagée UNIFORM_ROLE_WEIGHTS.
        const uniform = priors('75');
        uniform[Role.Top] = 99;
        expect(UNIFORM_ROLE_WEIGHTS[Role.Top]).toBe(1);
    });
});
