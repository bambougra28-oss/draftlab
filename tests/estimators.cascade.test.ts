import { describe, it, expect } from 'vitest';
import { cascadeShrink, ROOT_LABEL } from '$lib/estimators/cascade';
import { shrinkWinrate } from '$lib/estimators/posterior';

describe('cascade — hierarchical shrinkage', () => {
    it('a single level equals a direct shrinkWinrate toward the root mean', () => {
        const res = cascadeShrink([{ label: 'équipe', wins: 7, games: 10, priorN: 10 }], 0.5);
        expect(res.levels[0].posterior).toEqual(shrinkWinrate(7, 10, 0.5, 10));
        expect(res.final).toBe(res.levels[0].posterior);
        // Own-data share t = 10/(10+10) = 0.5 ; the root keeps the rest.
        expect(res.levels[0].weight).toBeCloseTo(0.5, 12);
        expect(res.rootWeight).toBeCloseTo(0.5, 12);
        // Exact tie level vs root → the more specific source wins.
        expect(res.provenance.dominant).toBe('équipe');
    });

    it('chains league → team posteriors (hand-computed)', () => {
        // League: alpha = 55 + 100·0.5 = 105 ; beta = 45 + 100·0.5 = 95
        //         mean = 105/200 = 0.525.
        // Team (prior mean 0.525, priorN 10):
        //         alpha = 7 + 10·0.525 = 12.25 ; beta = 3 + 10·0.475 = 7.75
        //         mean = 12.25/20 = 0.6125.
        const res = cascadeShrink(
            [
                { label: 'ligue', wins: 55, games: 100, priorN: 100 },
                { label: 'équipe', wins: 7, games: 10, priorN: 10 }
            ],
            0.5
        );
        expect(res.levels[0].posterior.mean).toBeCloseTo(0.525, 12);
        expect(res.levels[1].posterior.alpha).toBeCloseTo(12.25, 12);
        expect(res.levels[1].posterior.beta).toBeCloseTo(7.75, 12);
        expect(res.final.mean).toBeCloseTo(0.6125, 12);
        // Weights: t_team = 10/20 = 0.5 → team 0.5 ;
        // t_league = 100/200 = 0.5 → league 0.5·(1−0.5) = 0.25 ; root 0.25.
        expect(res.levels[1].weight).toBeCloseTo(0.5, 12);
        expect(res.levels[0].weight).toBeCloseTo(0.25, 12);
        expect(res.rootWeight).toBeCloseTo(0.25, 12);
        // Provenance: team dominates with weight 0.5 → odds 0.5/0.5 = 1.
        expect(res.provenance.dominant).toBe('équipe');
        expect(res.provenance.weight).toBeCloseTo(0.5, 12);
        expect(res.provenance.evidenceRatio).toBeCloseTo(1, 12);
    });

    it('decomposes the final mean exactly into per-level contributions', () => {
        // Three levels on top of the previous example, player 3/3 priorN 5:
        // own shares t = [0.5 (ligue), 0.5 (équipe), 3/8 (joueur)].
        // weights: joueur 0.375 ; équipe 0.5·0.625 = 0.3125 ;
        //          ligue 0.25·0.625 = 0.15625 ; root 0.15625. Sum = 1.
        // Final mean must equal Σ weight·rawWinrate + rootWeight·rootMean:
        // 0.375·1 + 0.3125·0.7 + 0.15625·0.55 + 0.15625·0.5 = 0.7578125,
        // and directly: alpha = 3 + 5·0.6125 = 6.0625 ; beta = 5·0.3875 =
        // 1.9375 → mean = 6.0625/8 = 0.7578125. Same number both ways.
        const res = cascadeShrink(
            [
                { label: 'ligue', wins: 55, games: 100, priorN: 100 },
                { label: 'équipe', wins: 7, games: 10, priorN: 10 },
                { label: 'joueur', wins: 3, games: 3, priorN: 5 }
            ],
            0.5
        );
        expect(res.levels[2].weight).toBeCloseTo(0.375, 12);
        expect(res.levels[1].weight).toBeCloseTo(0.3125, 12);
        expect(res.levels[0].weight).toBeCloseTo(0.15625, 12);
        expect(res.rootWeight).toBeCloseTo(0.15625, 12);
        const total = res.levels.reduce((acc, l) => acc + l.weight, res.rootWeight);
        expect(total).toBeCloseTo(1, 12);
        const reconstructed =
            0.375 * 1 + 0.3125 * 0.7 + 0.15625 * 0.55 + 0.15625 * 0.5;
        expect(res.final.mean).toBeCloseTo(reconstructed, 12);
        expect(res.final.mean).toBeCloseTo(0.7578125, 12);
    });

    it('passes the prior through an empty level untouched', () => {
        // Team with 0 games: posterior mean = league posterior mean (0.525),
        // own share 0 → weight 0. League weight 0.5·1 = 0.5 ties the root's
        // 0.5 → the more specific 'ligue' wins the tie over ROOT_LABEL.
        const res = cascadeShrink(
            [
                { label: 'ligue', wins: 55, games: 100, priorN: 100 },
                { label: 'équipe', wins: 0, games: 0, priorN: 10 }
            ],
            0.5
        );
        expect(res.final.mean).toBeCloseTo(0.525, 12);
        expect(res.levels[1].weight).toBe(0);
        expect(res.levels[0].weight).toBeCloseTo(0.5, 12);
        expect(res.rootWeight).toBeCloseTo(0.5, 12);
        expect(res.provenance.dominant).toBe('ligue');
    });

    it('attributes everything to the root when no level has data', () => {
        const res = cascadeShrink(
            [
                { label: 'ligue', wins: 0, games: 0, priorN: 10 },
                { label: 'équipe', wins: 0, games: 0, priorN: 10 }
            ],
            0.5
        );
        expect(res.final.mean).toBeCloseTo(0.5, 12);
        expect(res.provenance.dominant).toBe(ROOT_LABEL);
        expect(res.provenance.weight).toBe(1);
        // weight 1 → odds 1/0: the root is the entire story.
        expect(res.provenance.evidenceRatio).toBe(Infinity);
    });

    it('keeps per-level sample sizes for the provenance badges (DA-V2-4)', () => {
        const res = cascadeShrink(
            [
                { label: 'ligue', wins: 55, games: 100, priorN: 100 },
                { label: 'équipe', wins: 7, games: 10, priorN: 10 }
            ],
            0.5
        );
        expect(res.levels[0].posterior.n).toBe(100);
        expect(res.levels[1].posterior.n).toBe(10);
        expect(res.levels.map((l) => l.label)).toEqual(['ligue', 'équipe']);
    });

    it('rejects an empty cascade', () => {
        expect(() => cascadeShrink([], 0.5)).toThrow(RangeError);
    });
});
