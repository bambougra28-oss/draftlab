/**
 * Chantier F (F-c) — surpriseDefense : déclencheur gelé + transformation
 * uniforme (β = 1, sémantique readEnemyRoles), et depuis le branchement
 * (F2 verte + non-régression 95,3 %) le détecteur LIVE de la page
 * (`detectLiveSurpriseTriggers` — mécanique W1 sur les données saisies).
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
 *  - détecteur LIVE : pick attendu (bits faibles) → rien ............ 1 test
 *  - détecteur LIVE : surprise hors-range + rôle-novelté → déclenche
 *    (bits ≈ −log₂ ε, rôle = lecture de base) ........................ 1 test
 *  - détecteur LIVE : couple (c, r*) connu au train → rien .......... 1 test
 *  - détecteur LIVE : seuls les picks du camp LU sont évalués ....... 1 test
 *  TOTAL ............................................................ 11 tests
 */
import { describe, expect, it } from 'vitest';
import {
    UNIFORM_ROLE_WEIGHTS,
    detectLiveSurpriseTriggers,
    shouldTriggerSurpriseDefense,
    uniformizeTriggeredPriors,
    type SurpriseDefenseContext
} from '$lib/intel/surpriseDefense';
import { readEnemyRoles, type RoleEntryDraft } from '$lib/intel/liveDraft';
import { buildTendencyTable } from '$lib/aggregates/tendency';
import { buildDraftActions } from '$lib/data/draftRecord';
import type { DraftRecord } from '$lib/data/types';
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

// ---- détecteur LIVE (branchement page) ---------------------------------------

const NOW = '2026-06-11T00:00:00Z';

/** Game corpus de l'équipe EUX (côté red, blue-first) : son P2-3 = `redFirst`. */
function euxRecord(gameId: string, redFirst: string): DraftRecord {
    const { actions } = buildDraftActions({
        blue: { bans: [], picks: ['1', '2', '3', '4', '5'] },
        red: { bans: [], picks: [redFirst, '6', '7', '8', '9'] },
        firstPickSide: 'blue',
        resolveKey: (k) => k
    });
    return {
        gameId,
        blueTeam: 'NOUS',
        redTeam: 'EUX',
        firstPickSide: 'blue',
        orderConfidence: 'assumed-blue-first',
        actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: NOW }
    };
}

/** Tendances EUX : cellule (P2-3, red) = { '54': 0.5, '6': 0.5 } — bits('54') = 1. */
const euxTable = buildTendencyTable([euxRecord('g1', '54'), euxRecord('g2', '54')], [], {
    now: NOW,
    team: 'EUX'
});

/** Saisie par rôle : un seul pick ADVERSE au slot Top (red seq 8 → P2-3). */
const enemyTopEntry = (championKey: string): RoleEntryDraft => ({
    allyPicks: [null, null, null, null, null],
    enemyPicks: [championKey, null, null, null, null],
    allyBans: [null, null, null, null, null],
    enemyBans: [null, null, null, null, null],
    allySide: 'blue'
});

/** Priors de la lecture de base : '86' et '54' lus Top, le reste inconnu. */
const livePriors: RolePriors = (championKey) =>
    championKey === '86' || championKey === '54' ? { [Role.Top]: 5 } : {};

describe('detectLiveSurpriseTriggers — mécanique W1 sur les données live', () => {
    it('pick attendu (dans leur range, bits 1 < 5) → aucun déclencheur, même novelté totale', () => {
        const entry = enemyTopEntry('54');
        const triggers = detectLiveSurpriseTriggers({
            entry,
            baseReport: readEnemyRoles(entry, livePriors),
            table: euxTable,
            trainRoleCountOf: () => 0
        });
        expect(triggers).toEqual([]);
    });

    it('pick hors-range (bits = −log₂ ε ≈ 9,97) + rôle-novelté → déclenche, rôle = lecture de base', () => {
        const entry = enemyTopEntry('86');
        const triggers = detectLiveSurpriseTriggers({
            entry,
            baseReport: readEnemyRoles(entry, livePriors),
            table: euxTable,
            trainRoleCountOf: () => 0
        });
        expect(triggers).toHaveLength(1);
        expect(triggers[0].championKey).toBe('86');
        expect(triggers[0].role).toBe(Role.Top);
        expect(triggers[0].bits).toBeCloseTo(-Math.log2(DEFAULT_RANGE_MODEL_CONFIG.epsilon), 2);
        expect(triggers[0].bits).toBeGreaterThanOrEqual(DEFAULT_RANGE_MODEL_CONFIG.surpriseAlarmBits);
    });

    it('couple (champion, rôle lu) déjà vu au train → pas de rôle-novelté, rien', () => {
        const entry = enemyTopEntry('86');
        const triggers = detectLiveSurpriseTriggers({
            entry,
            baseReport: readEnemyRoles(entry, livePriors),
            table: euxTable,
            trainRoleCountOf: (key, role) => (key === '86' && role === Role.Top ? 1 : 0)
        });
        expect(triggers).toEqual([]);
    });

    it('seuls les picks du camp LU (enemyPicks) sont évalués — un pick allié surprenant ne déclenche rien', () => {
        const entry = enemyTopEntry('54');
        entry.allyPicks = ['86', null, null, null, null]; // surprise CHEZ NOUS : hors périmètre
        const triggers = detectLiveSurpriseTriggers({
            entry,
            baseReport: readEnemyRoles(entry, livePriors),
            table: euxTable,
            trainRoleCountOf: () => 0
        });
        expect(triggers).toEqual([]);
    });
});
