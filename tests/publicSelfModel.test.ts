/**
 * Chantier F (F-a) — publicSelfModel : surface C retournée, bits = −log₂(P).
 *
 * Nombre de tests DÉRIVÉ À LA MAIN :
 *  - P et bits à la main (α = 5, λ = 0,9, records non datés ⇒ poids 1) +
 *    ordre bits desc ................................................ 1 test
 *  - consumed : renormalisation wantProbabilityOf + exclusion ....... 1 test
 *  - parité STRICTE avec wantProbabilityOf (même sémantique) ........ 1 test
 *  - tie-break clé asc à bits égaux ................................. 1 test
 *  - étiquette « surprise vs données publiques » + experimental ..... 1 test
 *  - rôle vidé par consommation absent ; P = 1 ⇒ bits = 0 (pas −0) .. 1 test
 *  TOTAL ............................................................ 6 tests
 *
 * Arithmétique partagée (train non daté, now arbitraire) :
 *   Top : T picke A ×3, U picke B ×1 ⇒ P_ligue(A)=3/4, P_ligue(B)=1/4.
 *   Surface de T : masse(A)=3+5·0,75=6,75 ; masse(B)=0+5·0,25=1,25 ; Σ=8.
 *   P(A)=27/32=0,84375 ⇒ bits(A)=5−3·log₂3≈0,2451124978 ;
 *   P(B)=5/32=0,15625 ⇒ bits(B)=5−log₂5≈2,6780719051.
 *   Jungle : U picke C ×2 ⇒ masse(C)=5·1=5, P=1, bits=0.
 *   Mid : U picke D ×1, E ×1 ⇒ masses 2,5/2,5, P=0,5/0,5, bits=1/1.
 */
import { describe, expect, it } from 'vitest';
import { fitPublicSelfModel, PUBLIC_SURPRISE_LABEL_FR } from '$lib/estimators/publicSelfModel';
import { wantProbabilityOf } from '$lib/estimators/seriesDemand';
import type { DraftRecord } from '$lib/data/types';
import { Role } from '$lib/types';

/** Un record à un seul pick résolu, équipe agissante = blueTeam. */
function pickRecord(team: string, opponent: string, championKey: string, role: Role): DraftRecord {
    return {
        gameId: `g-${team}-${championKey}-${role}`,
        blueTeam: team,
        redTeam: opponent,
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions: [
            {
                seq: 7,
                type: 'pick',
                phase: 'pick1',
                side: 'blue',
                championKey,
                championName: championKey,
                role
            }
        ],
        warnings: [],
        provenance: { source: 'manual', fetchedAt: '2026-06-11T00:00:00Z' }
    };
}

const train: DraftRecord[] = [
    pickRecord('T', 'U', 'A', Role.Top),
    pickRecord('T', 'U', 'A', Role.Top),
    pickRecord('T', 'U', 'A', Role.Top),
    pickRecord('U', 'T', 'B', Role.Top),
    pickRecord('U', 'T', 'C', Role.Jungle),
    pickRecord('U', 'T', 'C', Role.Jungle),
    pickRecord('U', 'T', 'D', Role.Middle),
    pickRecord('U', 'T', 'E', Role.Middle)
];

const OPTIONS = { team: 'T', now: '2026-06-01' };

describe('fitPublicSelfModel — bits à la main sur la surface C', () => {
    it('P = masse renormalisée par rôle, bits = −log₂(P), tri bits desc', () => {
        const model = fitPublicSelfModel(train, OPTIONS);
        const top = model.byRole.get(Role.Top);
        expect(top?.map((e) => e.championKey)).toEqual(['B', 'A']); // surprise d'abord
        expect(top?.[0].p).toBeCloseTo(0.15625, 12);
        expect(top?.[0].bits).toBeCloseTo(5 - Math.log2(5), 12);
        expect(top?.[0].mass).toBeCloseTo(1.25, 12);
        expect(top?.[0].teamRawCount).toBe(0);
        expect(top?.[1].p).toBeCloseTo(0.84375, 12);
        expect(top?.[1].bits).toBeCloseTo(5 - 3 * Math.log2(3), 12);
        expect(top?.[1].teamRawCount).toBe(3);
    });

    it('consumed : exclu de la sortie ET de la masse de renormalisation', () => {
        const model = fitPublicSelfModel(train, OPTIONS, new Set(['A']));
        const top = model.byRole.get(Role.Top);
        expect(top?.map((e) => e.championKey)).toEqual(['B']);
        expect(top?.[0].p).toBe(1); // 1,25 / 1,25
        expect(top?.[0].bits).toBe(0);
    });

    it('parité wantProbabilityOf : P de chaque entrée mono-rôle = wantProbabilityOf(surface, c)', () => {
        const model = fitPublicSelfModel(train, OPTIONS);
        const none = new Set<string>();
        for (const entries of model.byRole.values()) {
            for (const entry of entries) {
                expect(entry.p).toBeCloseTo(wantProbabilityOf(model.surface, entry.championKey, none), 12);
            }
        }
    });

    it('bits égaux → clé asc (D avant E à 1 bit chacun)', () => {
        const model = fitPublicSelfModel(train, OPTIONS);
        const mid = model.byRole.get(Role.Middle);
        expect(mid?.map((e) => e.championKey)).toEqual(['D', 'E']);
        expect(mid?.[0].bits).toBeCloseTo(1, 12);
        expect(mid?.[1].bits).toBeCloseTo(1, 12);
    });

    it('étiquette de provenance gelée + experimental (lecture, jamais pool privé)', () => {
        expect(PUBLIC_SURPRISE_LABEL_FR).toBe('surprise vs données publiques');
        expect(fitPublicSelfModel(train, OPTIONS).experimental).toBe(true);
    });

    it('rôle entièrement consommé absent de byRole ; P = 1 ⇒ bits 0 exact (jamais −0)', () => {
        const model = fitPublicSelfModel(train, OPTIONS, new Set(['C']));
        expect(model.byRole.has(Role.Jungle)).toBe(false);
        const jungle = fitPublicSelfModel(train, OPTIONS).byRole.get(Role.Jungle);
        expect(Object.is(jungle?.[0].bits, 0)).toBe(true);
        expect(jungle?.[0].p).toBe(1);
    });
});
