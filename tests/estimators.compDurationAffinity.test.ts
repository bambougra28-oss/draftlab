/**
 * compDurationAffinity: duration-split cells and comp affinity, hand-computed
 * on an engineered universe — blue ENG+CAR wins ALL long games and loses ALL
 * short ones vs red BRU+PEL, so every blue-duo cell carries differential
 * +1/3 (priorN 8) and every red-duo cell its exact mirror.
 */
import { describe, it, expect } from 'vitest';
import {
    compLateAffinity,
    DEFAULT_COMP_DURATION_PRIOR_N,
    fitCompDurationCells
} from '$lib/estimators/compDurationAffinity';
import { cellKey } from '$lib/estimators/tagPairs';
import type { ChampionTag, ChampionTagsFile } from '$lib/tags/types';
import type { DraftRecord, DraftSide } from '$lib/data/types';

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
        BRU: syntheticTag('BRU', {})
    }
};

function game(
    gameId: string,
    winner: DraftSide,
    gameLengthSeconds: number,
    bluePicks: string[] = ['ENG', 'CAR'],
    redPicks: string[] = ['BRU', 'PEL']
): DraftRecord {
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
        gameLengthSeconds,
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

// 4 long games (3000 s) won by blue + 4 short (1200 s) won by red.
const corpus: DraftRecord[] = [
    ...Array.from({ length: 4 }, (_, i) => game(`L${i}`, 'blue', 3000)),
    ...Array.from({ length: 4 }, (_, i) => game(`S${i}`, 'red', 1200))
];

describe('fitCompDurationCells', () => {
    const fit = fitCompDurationCells(corpus, { tagsFile: synthetic, priorN: 8 });

    it('splits on the fitting median and pools one observation per cell per pair', () => {
        expect(fit.medianSeconds).toBe(2100); // (1200 + 3000) / 2
        expect(fit.pairObservations).toBe(16); // 8 games × 2 pairs
    });

    it('the engineered blue cell: long 4/4, short 0/4 → differential exactly 1/3', () => {
        // pooled 0.5 ; long = (4 + 0.5·8)/12 = 2/3 ; short = (0 + 4)/12 = 1/3.
        const cell = fit.cells.get(cellKey('engage-hard', 'hyper-carry'))!;
        expect(cell.longGames).toBe(4);
        expect(cell.shortGames).toBe(4);
        expect(cell.pooled).toBe(0.5);
        expect(cell.differential).toBeCloseTo(1 / 3, 10);
        expect(cell.weight).toBeCloseTo(2, 10); // 4·4/8
    });

    it('the red mirror cell is symmetric negative', () => {
        const cell = fit.cells.get(cellKey('peel', 'melee'))!;
        expect(cell.differential).toBeCloseTo(-1 / 3, 10);
    });

    it('a cell that simply WINS both halves reads 0 (pure timing signal)', () => {
        // Blue wins all 8 games: pooled 1, both halves shrink toward 1 → 0.
        const allWins: DraftRecord[] = [
            ...Array.from({ length: 4 }, (_, i) => game(`L${i}`, 'blue', 3000)),
            ...Array.from({ length: 4 }, (_, i) => game(`S${i}`, 'blue', 1200))
        ];
        const flat = fitCompDurationCells(allWins, { tagsFile: synthetic, priorN: 8 });
        expect(flat.cells.get(cellKey('engage-hard', 'hyper-carry'))!.differential).toBeCloseTo(0, 10);
    });

    it('games exactly at the fitting median are excluded (mirror of the scoring rule)', () => {
        const withTies = [...corpus, game('T0', 'blue', 2100), game('T1', 'red', 2100)];
        const fitTies = fitCompDurationCells(withTies, { tagsFile: synthetic, priorN: 8 });
        expect(fitTies.medianSeconds).toBe(2100);
        expect(fitTies.pairObservations).toBe(16); // the two tie games contribute nothing
        expect(fitTies.cells.get(cellKey('engage-hard', 'hyper-carry'))!.differential).toBeCloseTo(1 / 3, 10);
    });

    it('pins the pre-registered default prior', () => {
        expect(DEFAULT_COMP_DURATION_PRIOR_N).toBe(200);
    });
});

describe('compLateAffinity', () => {
    const fit = fitCompDurationCells(corpus, { tagsFile: synthetic, priorN: 8 });

    it('the long-game duo reads +1/3, its victim −1/3 (every activated cell agrees)', () => {
        const blue = compLateAffinity(['ENG', 'CAR'], fit, synthetic);
        expect(blue.affinity).toBeCloseTo(1 / 3, 10);
        expect(blue.activations).toBe(9); // |{ENG traits} × {CAR traits}| deduped
        expect(blue.evidence).toBeCloseTo(18, 10); // 9 cells × weight 2
        const red = compLateAffinity(['BRU', 'PEL'], fit, synthetic);
        expect(red.affinity).toBeCloseTo(-1 / 3, 10);
    });

    it('unknown champions are skipped; an empty fit reads 0', () => {
        const ghost = compLateAffinity(['GHOST', 'ENG'], fit, synthetic);
        expect(ghost).toEqual({ affinity: 0, activations: 0, evidence: 0 });
        const empty = fitCompDurationCells([], { tagsFile: synthetic });
        expect(compLateAffinity(['ENG', 'CAR'], empty, synthetic)).toEqual({
            affinity: 0,
            activations: 0,
            evidence: 0
        });
    });
});
