/**
 * Chantier F (F-b) — pocketAdvisor : filtres gelés, checklist depuis les tags,
 * GARDER/DÉPENSER en composants séparés (jamais fusionnés).
 *
 * Nombre de tests DÉRIVÉ À LA MAIN :
 *  - filtres : seuil bits (défaut surpriseAlarmBits = 5 + injectable),
 *    counterThreat strictement > 0 (positif/négatif/zéro), cohérence
 *    pairPrior (résidu < 0 exclu, évidence 0 neutre), seam viableOnPatch,
 *    consumed, candidat sans tag ................................... 6 tests
 *  - checklist : item peel/knockback (sources + satisfied), item
 *    saturation damageType, item Fearless scalingWindow late ....... 3 tests
 *  - GARDER/DÉPENSER : chemin C-ROUGE (wantProbability absente ⇒
 *    masked + reasonFr), prix de série = seriesTermOf exact (parité
 *    + valeur à la main γ·Δ = −0,2), revelationCost à la main
 *    (1 bit ; 0,05), baitLedger à la main (defaultOptionValue = 0),
 *    composants absents sans injections / σ absent ................. 5 tests
 *  - tri bits desc puis clé asc ; étiquette + experimental ......... 2 tests
 *  TOTAL ........................................................... 16 tests
 */
import { describe, expect, it } from 'vitest';
import { advisePocketPicks, type PocketAdvisorContext } from '$lib/strategic/pocketAdvisor';
import { PUBLIC_SURPRISE_LABEL_FR, type PublicSurpriseEntry } from '$lib/estimators/publicSelfModel';
import type { TagPairCell, TagPairFit } from '$lib/estimators/tagPairs';
import { seriesTermOf } from '$lib/strategic/seriesKnapsack';
import type { SeriesState } from '$lib/strategic/seriesSolver';
import type { FogState, Hypothesis } from '$lib/strategic/fogReveal';
import type { ChampionTag, ChampionTagsFile } from '$lib/tags/types';
import { Role } from '$lib/types';

// ---- fixtures tags / cellules ---------------------------------------------------

function tagOf(id: string, overrides: Partial<ChampionTag> = {}): ChampionTag {
    return {
        id,
        name: id,
        damageType: 'AD',
        range: 'melee',
        engageTool: 'none',
        disengageTools: [],
        mobility: 'low',
        scalingWindow: 'late',
        hyperCarry: false,
        confidence: 'high',
        taggedBy: 'user',
        ...overrides
    };
}

const TAGS: ChampionTagsFile = {
    version: 'test',
    schemaVersion: 1,
    patchTagged: '26.11',
    lastUpdated: '2026-06-11',
    champions: {
        // Profil « Nasus » : late, melee, AD, sans désengage propre.
        nasus: tagOf('nasus'),
        aaaPos: tagOf('aaaPos'),
        bbbPos: tagOf('bbbPos'),
        lowbits: tagOf('lowbits'),
        gone: tagOf('gone'),
        noviable: tagOf('noviable'),
        // Counter négatif : engage hard, PAS late (mid).
        negC: tagOf('negC', { engageTool: 'hard-aoe', scalingWindow: 'mid' }),
        // Counter nul : aucun trait ne touche une cellule du fit.
        zeroC: tagOf('zeroC', {
            damageType: 'AP',
            range: 'ranged-long',
            disengageTools: ['peel'],
            mobility: 'high',
            scalingWindow: 'mid'
        }),
        // Alliés.
        alistar: tagOf('alistar', {
            damageType: 'AP',
            engageTool: 'hard-aoe',
            disengageTools: ['peel', 'knockback'],
            scalingWindow: 'mid'
        }),
        ad1: tagOf('ad1', { range: 'ranged-short', mobility: 'medium', scalingWindow: 'mid' }),
        ad2: tagOf('ad2', { range: 'ranged-short', mobility: 'medium', scalingWindow: 'mid' }),
        // Adverses.
        enemyX: tagOf('enemyX', { damageType: 'AP', range: 'ranged-short', scalingWindow: 'early', mobility: 'medium' }),
        ejEarly: tagOf('ejEarly', { scalingWindow: 'early', mobility: 'high' })
    }
};

const cellOf = (key: string, residual: number, games = 100): TagPairCell => ({
    key,
    games,
    wins: 0,
    posterior: { alpha: 1, beta: 1, mean: 0.5 + residual, n: games, ci95: [0, 1] },
    residual
});

const fitOf = (cells: TagPairCell[]): TagPairFit => ({
    cells: new Map<string, TagPairCell>(cells.map((c) => [c.key, c])),
    baseline: 0.5,
    pairObservations: 1000,
    priorN: 400
});

// enemyX a les traits ['ap', 'early'] ; profil nasus = ['melee', 'ad', 'late'].
const counterFit = fitOf([cellOf('late>early', 0.05), cellOf('engage-hard>early', -0.04)]);
// alistar : ['engage-hard', 'peel', 'knockback', 'melee', 'ap'].
const pairFit = fitOf([cellOf('late+peel', 0.02, 200)]);
const incoherentPairFit = fitOf([cellOf('late+peel', -0.03, 200)]);

const surpriseOfKey = (championKey: string, bits: number): PublicSurpriseEntry => ({
    championKey,
    role: Role.Jungle,
    p: 2 ** -bits,
    bits,
    mass: 1,
    teamRawCount: 0
});

function ctxOf(over: Partial<PocketAdvisorContext> = {}): PocketAdvisorContext {
    return {
        surprises: [surpriseOfKey('nasus', 6)],
        tagsFile: TAGS,
        allyCompKeys: ['alistar'],
        enemyCompKeys: ['enemyX'],
        counterFit,
        pairFit,
        viableOnPatch: () => true,
        consumed: new Set<string>(),
        ...over
    };
}

const keysOf = (ctx: PocketAdvisorContext): string[] =>
    advisePocketPicks(ctx).map((c) => c.championKey);

// ---- filtres gelés ------------------------------------------------------------------

describe('advisePocketPicks — filtres gelés', () => {
    it('seuil bits : défaut = surpriseAlarmBits (5) ; minSurpriseBits injectable', () => {
        const ctx = ctxOf({ surprises: [surpriseOfKey('nasus', 6), surpriseOfKey('lowbits', 4)] });
        expect(keysOf(ctx)).toEqual(['nasus']); // 4 bits < 5 exclu, 6 bits ≥ 5 gardé
        expect(keysOf({ ...ctx, minSurpriseBits: 7 })).toEqual([]); // 6 < 7
    });

    it('counterThreat strictement > 0 : positif gardé, négatif exclu, zéro exclu', () => {
        const ctx = ctxOf({
            surprises: [surpriseOfKey('nasus', 6), surpriseOfKey('negC', 6), surpriseOfKey('zeroC', 6)],
            allyCompKeys: [] // neutralise la cohérence pour isoler le filtre counter
        });
        const kept = advisePocketPicks(ctx);
        expect(kept.map((c) => c.championKey)).toEqual(['nasus']);
        expect(kept[0].counter.threat).toBeCloseTo(0.05, 12);
        expect(kept[0].counter.evidence).toBe(100);
    });

    it('cohérence pairPrior : résidu mesuré < 0 exclu ; évidence nulle = neutre gardé', () => {
        expect(keysOf(ctxOf({ pairFit: incoherentPairFit }))).toEqual([]); // −0,03 sur 200 games
        const neutral = advisePocketPicks(ctxOf({ allyCompKeys: ['ad1'] })); // aucune cellule ne tire
        expect(neutral.map((c) => c.championKey)).toEqual(['nasus']);
        expect(neutral[0].coherence).toEqual({ residual: 0, evidence: 0 });
    });

    it('seam viableOnPatch : non viable exclu', () => {
        const ctx = ctxOf({
            surprises: [surpriseOfKey('nasus', 6), surpriseOfKey('noviable', 6)],
            viableOnPatch: (key) => key !== 'noviable'
        });
        expect(keysOf(ctx)).toEqual(['nasus']);
    });

    it('consumed (Fearless) : jamais candidat', () => {
        const ctx = ctxOf({
            surprises: [surpriseOfKey('nasus', 6), surpriseOfKey('gone', 7)],
            consumed: new Set(['gone'])
        });
        expect(keysOf(ctx)).toEqual(['nasus']);
    });

    it('candidat sans tag : hors périmètre (ni counter ni checklist possibles)', () => {
        const ctx = ctxOf({ surprises: [surpriseOfKey('nasus', 6), surpriseOfKey('untagged', 9)] });
        expect(keysOf(ctx)).toEqual(['nasus']);
    });
});

// ---- checklist d'activation -----------------------------------------------------------

describe('checklist — items dérivés des tags, dimensions sources citées', () => {
    it('sans désengage propre ⇒ exige peel OU knockback allié (sources exactes)', () => {
        const withAlistar = advisePocketPicks(ctxOf())[0];
        const item = withAlistar.checklist.find((i) => i.sources.includes('disengageTools.peel'));
        expect(item?.sources).toEqual(['disengageTools.peel', 'disengageTools.knockback']);
        expect(item?.satisfied).toBe(true); // Alistar a peel + knockback
        const withoutPeel = advisePocketPicks(ctxOf({ allyCompKeys: ['ad1'] }))[0];
        expect(
            withoutPeel.checklist.find((i) => i.sources.includes('disengageTools.peel'))?.satisfied
        ).toBe(false);
    });

    it('saturation damageType : ≥ 2 AD alliés ⇒ non satisfait ; 1 seul ⇒ satisfait', () => {
        const saturated = advisePocketPicks(ctxOf({ allyCompKeys: ['ad1', 'ad2'] }))[0];
        const item = saturated.checklist.find((i) => i.sources.includes('damageType'));
        expect(item?.satisfied).toBe(false);
        expect(item?.textFr).toContain('AD');
        const fine = advisePocketPicks(ctxOf({ allyCompKeys: ['ad1'] }))[0];
        expect(fine.checklist.find((i) => i.sources.includes('damageType'))?.satisfied).toBe(true);
    });

    it('scalingWindow late ⇒ item Fearless ; satisfied selon la lecture jungle injectée', () => {
        // Sans lecture jungle : à vérifier (undefined).
        const noRead = advisePocketPicks(ctxOf())[0];
        const pending = noRead.checklist.find((i) => i.sources.includes('scalingWindow'));
        expect(pending).toBeDefined();
        expect(pending?.satisfied).toBeUndefined();
        // Jungler early adverse NON consommé ⇒ false ; consommé ⇒ true.
        const notConsumed = advisePocketPicks(ctxOf({ enemyJungleCandidates: ['ejEarly'] }))[0];
        expect(notConsumed.checklist.find((i) => i.sources.includes('scalingWindow'))?.satisfied).toBe(false);
        const consumed = advisePocketPicks(
            ctxOf({ enemyJungleCandidates: ['ejEarly'], consumed: new Set(['ejEarly']) })
        )[0];
        expect(consumed.checklist.find((i) => i.sources.includes('scalingWindow'))?.satisfied).toBe(true);
        // Pas d'item scalingWindow pour un candidat non-late (negC est mid) :
        // vérifié via activation directe — negC est filtré par counter, donc on
        // contrôle sur un fit où il passe.
        const negKept = advisePocketPicks(
            ctxOf({
                surprises: [surpriseOfKey('negC', 6)],
                counterFit: fitOf([cellOf('engage-hard>early', 0.05)]),
                allyCompKeys: []
            })
        )[0];
        expect(negKept.checklist.some((i) => i.sources.includes('scalingWindow'))).toBe(false);
    });
});

// ---- GARDER / DÉPENSER ------------------------------------------------------------------

/*
 * σ à la main (arithmétique du fichier seriesKnapsack.test.ts) : pool allié
 * Top = [X 8/10 → 0,65 ; Y 5/10 → 0,5], autres rôles vides, ennemi vide.
 * Consommer X : S_ally 0,9 → 0,5 ⇒ selfCost −0,4, denialGain 0,
 * deltaEdge −0,4, γ·Δ = −0,2 (γ = 0,5 gelé).
 */
function sigmaOf(): SeriesState {
    return {
        gameNumber: 1,
        format: 'bo3',
        score: { ally: 0, enemy: 0 },
        mode: 'fearless',
        poolsBySide: {
            ally: { [Role.Top]: [{ championKey: 'nasus', wins: 8, games: 10 }, { championKey: 'Y', wins: 5, games: 10 }] },
            enemy: {}
        },
        consumed: new Set<string>()
    };
}

const hypothesisOf = (p: number, role: Role, key: string): Hypothesis => ({
    assignment: new Map([[role, key]]),
    p
});

describe('GARDER/DÉPENSER — composants séparés, jamais fusionnés', () => {
    it('chemin C-ROUGE : wantProbability ABSENTE ⇒ prix masqué et le composant le dit', () => {
        const [candidate] = advisePocketPicks(ctxOf({ seriesState: sigmaOf() }));
        const price = candidate.holdOrSpend.seriesPrice;
        expect(price.masked).toBe(true);
        if (price.masked) {
            expect(price.reasonFr).toContain('wantProbability');
            expect(price.experimental).toBe(true);
        }
    });

    it('prix de série : seriesTermOf EXACT (γ·Δ = −0,2 à la main) + wantProbability passée', () => {
        const sigma = sigmaOf();
        const [candidate] = advisePocketPicks(
            ctxOf({ seriesState: sigma, wantProbability: (key) => (key === 'nasus' ? 0.17 : 0) })
        );
        const price = candidate.holdOrSpend.seriesPrice;
        expect(price.masked).toBe(false);
        if (!price.masked) {
            expect(price.term).toEqual(seriesTermOf('nasus', sigma));
            expect(price.term.gammaWeighted).toBeCloseTo(-0.2, 12);
            expect(price.term.selfCost).toBeCloseTo(-0.4, 12);
            expect(price.term.denialGain).toBeCloseTo(0, 12);
            expect(price.wantProbability).toBe(0.17);
        }
    });

    it('revelationCost à la main : 2 hypothèses uniformes → 1 → perte 1 bit ; gain de réponses 0,05', () => {
        const before = [hypothesisOf(0.5, Role.Top, 'a'), hypothesisOf(0.5, Role.Jungle, 'a')];
        const after = [hypothesisOf(1, Role.Jungle, 'nasus')];
        const fogStateOf = (): FogState => ({ before, after });
        const [candidate] = advisePocketPicks(
            ctxOf({
                fogStateOf,
                fogEval: {
                    enemyBestResponse: () => 0.6,
                    enemyBestResponseUnderUncertainty: () => 0.55
                }
            })
        );
        const revelation = candidate.holdOrSpend.revelation;
        expect(revelation?.entropyLossBits).toBeCloseTo(1, 12);
        expect(revelation?.unlockedCounterGain).toBeCloseTo(0.05, 12);
        expect(revelation?.experimental).toBe(true);
    });

    it('baitLedger à la main : P 0,4 × (0,6 − 0,55) = 0,02 ; defaultOptionValue = 0 commité', () => {
        const [candidate] = advisePocketPicks(
            ctxOf({
                baitContext: {
                    takeProbability: () => 0.4,
                    theirEquityIfTaken: () => 0.55,
                    ourPreparedAnswerEquity: () => 0.6
                }
            })
        );
        const bait = candidate.holdOrSpend.bait;
        expect(bait?.components.takenBranch).toBeCloseTo(0.02, 12);
        expect(bait?.components.keptBranch).toBe(0); // (1 − 0,4) · 0 — option par défaut 0
        expect(bait?.components.optionValue).toBe(0);
        expect(bait?.ev).toBeCloseTo(0.02, 12);
        expect(bait?.experimental).toBe(true);
    });

    it('injections absentes ⇒ composants absents ; σ absent ⇒ prix masqué (autre raison)', () => {
        const [bare] = advisePocketPicks(ctxOf());
        expect(bare.holdOrSpend.revelation).toBeUndefined();
        expect(bare.holdOrSpend.bait).toBeUndefined();
        const [noSigma] = advisePocketPicks(ctxOf({ wantProbability: () => 0.5 }));
        const price = noSigma.holdOrSpend.seriesPrice;
        expect(price.masked).toBe(true);
        if (price.masked) expect(price.reasonFr).toContain('σ');
    });
});

// ---- tri et étiquette ----------------------------------------------------------------------

describe('tri et provenance', () => {
    it('tri bits desc, clé asc en égalité', () => {
        const ctx = ctxOf({
            surprises: [surpriseOfKey('nasus', 6), surpriseOfKey('bbbPos', 8), surpriseOfKey('aaaPos', 8)]
        });
        expect(keysOf(ctx)).toEqual(['aaaPos', 'bbbPos', 'nasus']);
    });

    it('étiquette « surprise vs données publiques » ré-exportée + experimental', () => {
        expect(PUBLIC_SURPRISE_LABEL_FR).toBe('surprise vs données publiques');
        expect(advisePocketPicks(ctxOf())[0].experimental).toBe(true);
    });
});
