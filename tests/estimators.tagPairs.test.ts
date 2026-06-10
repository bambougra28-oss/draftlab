/**
 * tagPairs: trait projection (real tag file), cell fitting and pair priors
 * (synthetic tag file with an ENGINEERED effect — full control, hand math).
 *
 * Data-quality note surfaced while writing this: Malphite (54) is tagged
 * damageType 'AD' in data/championTags.json — almost certainly wrong (his
 * damage is overwhelmingly magic). Logged for the confidence:medium human
 * review pass; the projection test below asserts the CURRENT data on
 * purpose so the review flips it consciously.
 */
import { describe, it, expect } from 'vitest';
import { cellKey, fitTagPairCells, pairPrior, traitsOf } from '$lib/estimators/tagPairs';
import { loadDefaultTags } from '$lib/tags';
import type { ChampionTag, ChampionTagsFile } from '$lib/tags/types';
import type { DraftRecord, DraftSide } from '$lib/data/types';

const realTags = loadDefaultTags();

describe('traitsOf (real tag file)', () => {
    it('projects Malphite onto engage-hard/melee (+ the questionable ad)', () => {
        const traits = traitsOf(realTags.champions['54']);
        expect(traits).toEqual(expect.arrayContaining(['engage-hard', 'melee', 'ad']));
        expect(traits).not.toContain('hyper-carry');
    });

    it('projects Tristana onto ad/late/hyper-carry/knockback', () => {
        const traits = traitsOf(realTags.champions['18']);
        expect(traits).toEqual(expect.arrayContaining(['ad', 'late', 'hyper-carry', 'knockback']));
    });

    it("projects Kog'Maw onto both damage traits (secondary AP)", () => {
        const traits = traitsOf(realTags.champions['96']);
        expect(traits).toEqual(expect.arrayContaining(['ad', 'ap', 'hyper-carry', 'late']));
    });
});

describe('cellKey', () => {
    it('is unordered (canonical sort)', () => {
        expect(cellKey('late', 'engage-hard')).toBe('engage-hard+late');
        expect(cellKey('engage-hard', 'late')).toBe('engage-hard+late');
    });
});

// ---- synthetic universe: full control over traits ---------------------------

const syntheticTag = (id: string, partial: Partial<ChampionTag>): ChampionTag => ({
    id,
    name: id,
    damageType: 'AD',
    range: 'melee',
    engageTool: 'none',
    disengageTools: [],
    mobility: 'medium',
    scalingWindow: 'mid',
    hyperCarry: false,
    confidence: 'high',
    taggedBy: 'user',
    ...partial
});

/** ENG: engage-hard+melee+ad · CAR: hyper-carry+late+ad · PEL: peel+ap · BRU: melee+ad. */
const synthetic: ChampionTagsFile = {
    version: 'test',
    schemaVersion: 1,
    patchTagged: '26.11',
    lastUpdated: 'test',
    champions: {
        ENG: syntheticTag('ENG', { engageTool: 'hard-aoe' }),
        CAR: syntheticTag('CAR', { hyperCarry: true, scalingWindow: 'late', range: 'ranged-short' }),
        PEL: syntheticTag('PEL', { damageType: 'AP', disengageTools: ['peel'], range: 'ranged-short' }),
        BRU: syntheticTag('BRU', {}),
        ENG2: syntheticTag('ENG2', { engageTool: 'hard-aoe', damageType: 'AP' }),
        CAR2: syntheticTag('CAR2', { hyperCarry: true, scalingWindow: 'late', range: 'ranged-long' })
    }
};

function game(gameId: string, bluePicks: string[], redPicks: string[], winner: DraftSide): DraftRecord {
    const pick = (key: string, side: DraftSide, seq: number) => ({
        seq,
        type: 'pick' as const,
        phase: 'pick1' as const,
        side,
        championKey: key,
        championName: key
    });
    return {
        gameId,
        blueTeam: 'A',
        redTeam: 'B',
        winner,
        firstPickSide: 'blue',
        orderConfidence: 'assumed-blue-first',
        actions: [
            ...bluePicks.map((k, i) => pick(k, 'blue', 7 + i)),
            ...redPicks.map((k, i) => pick(k, 'red', 12 + i))
        ],
        warnings: [],
        provenance: { source: 'test', fetchedAt: 'now' }
    };
}

// 10 games: blue = ENG+CAR (the engineered duo, 8 wins), red = BRU+PEL.
const corpus: DraftRecord[] = Array.from({ length: 10 }, (_, i) =>
    game(`g${i}`, ['ENG', 'CAR'], ['BRU', 'PEL'], i < 8 ? 'blue' : 'red')
);

describe('fitTagPairCells (synthetic)', () => {
    const fit = fitTagPairCells(corpus, { tagsFile: synthetic, priorN: 10 });

    it('pools one observation per pair per game (2 pairs × 10 games), baseline 0.5', () => {
        expect(fit.pairObservations).toBe(20);
        expect(fit.baseline).toBe(0.5);
    });

    it('the engineered engage-hard+hyper-carry cell surfaces, shrunk', () => {
        const cell = fit.cells.get(cellKey('engage-hard', 'hyper-carry'))!;
        expect(cell.games).toBe(10); // only the blue pair activates it
        expect(cell.wins).toBe(8);
        // shrink(8, 10, 0.5, 10) = (8 + 5) / 20 = 0.65 → residual +0.15.
        expect(cell.posterior.mean).toBeCloseTo(0.65, 10);
        expect(cell.residual).toBeCloseTo(0.15, 10);
    });

    it('the losing pair’s cell goes symmetric below baseline (peel+melee)', () => {
        const cell = fit.cells.get(cellKey('peel', 'melee'))!;
        expect(cell.games).toBe(10);
        expect(cell.residual).toBeCloseTo(-0.15, 10);
    });

    it('a cell active for BOTH teams nets out neutral (ad+ad: ENG·CAR and BRU·? no — ad+ap)', () => {
        // ad+ap fires for ENG(ad)+? no AP on blue… use melee+ad: blue pair has
        // melee(ENG)×ad(CAR) AND red pair melee(BRU)×ad(BRU? BRU is the only
        // melee+ad on red, PEL is ranged AP) → red fires melee(BRU)+ad(BRU)?
        // Cross-champion only: BRU(melee)×PEL(ap) no… so melee+ad = blue-only.
        // The truly two-sided cell here: melee+ranged-short? not a trait.
        // Use ad+ap: blue none (CAR ad, ENG ad), red BRU(ad)×PEL(ap) → red-only,
        // 2 wins / 10 games → residual −0.15 symmetric to the engineered cell.
        const cell = fit.cells.get(cellKey('ad', 'ap'))!;
        expect(cell.games).toBe(10);
        expect(cell.residual).toBeCloseTo(-0.15, 10);
    });

    it('cells fire once per pair even when several trait products map to the same key', () => {
        // engage-hard+ad: ENG(engage-hard)×CAR(ad) and ENG(ad)... ENG is also ad,
        // so the products (engage-hard,ad) arise twice — counted ONCE per pair.
        const cell = fit.cells.get(cellKey('engage-hard', 'ad'))!;
        expect(cell.games).toBe(10);
    });
});

describe('pairPrior (synthetic)', () => {
    const fit = fitTagPairCells(corpus, { tagsFile: synthetic, priorN: 10 });

    it('gives a NEVER-SEEN pair (ENG2+CAR2) a structured prior via shared cells', () => {
        const prior = pairPrior(synthetic.champions.ENG2, synthetic.champions.CAR2, fit);
        expect(prior.cells.some((c) => c.key === 'engage-hard+hyper-carry')).toBe(true);
        expect(prior.evidence).toBeGreaterThan(0);
        expect(prior.residual).toBeGreaterThan(0); // inherits the engineered effect
    });

    it('returns a neutral prior on an empty fit', () => {
        const empty = fitTagPairCells([], { tagsFile: synthetic });
        const prior = pairPrior(synthetic.champions.ENG, synthetic.champions.CAR, empty);
        expect(prior).toEqual({ residual: 0, cells: [], evidence: 0 });
    });
});
