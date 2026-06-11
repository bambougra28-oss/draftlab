/**
 * banAttraction: suffered-ban demand estimator, hand-computed on the §2.4
 * synthetic corpus of docs/run2/B-ban-history.md — 3 records (teams A/B/C),
 * champion X banned by A's opponents in g1 and g2, never in g3 (= B vs C),
 * priorN 10:
 *
 *   N = 3, bannedGames(X) = 2 → μ_X = (2 + 0.5) / (2·3 + 1) = 2.5/7
 *   games_A = 2, suffered_A(X) = 2 → rate(A, X) = (2 + 10·2.5/7) / 12
 *                                              = 39/84 = 13/28
 *   games_B = 3, suffered_B(X) = 0 → rate(B, X) = (25/7) / 13 = 25/91
 *   Y never banned → μ_Y = 0.5/7, rate(A, Y) = (5/7) / 12 = 5/84
 */
import { describe, it, expect } from 'vitest';
import {
    banAttractionRate,
    DEFAULT_BAN_ATTRACTION_PRIOR_N,
    fitBanAttraction,
    leagueBanAttraction
} from '$lib/estimators/banAttraction';
import type { DraftRecord, DraftSide } from '$lib/data/types';

/** Minimal record: only teams and ban actions matter to the estimator. */
function game(
    gameId: string,
    blueTeam: string,
    redTeam: string,
    bans: { side: DraftSide; key: string }[]
): DraftRecord {
    return {
        gameId,
        blueTeam,
        redTeam,
        firstPickSide: 'blue',
        orderConfidence: 'assumed-blue-first',
        actions: bans.map((ban, i) => ({
            seq: i + 1,
            type: 'ban' as const,
            phase: 'ban1' as const,
            side: ban.side,
            championKey: ban.key,
            championName: ban.key
        })),
        warnings: [],
        provenance: { source: 'test', fetchedAt: 'now' }
    };
}

// g1/g2: A (blue) vs B (red), B's side bans X → A suffers X twice.
// g3: B (blue) vs C (red), B bans W → C suffers W; X never banned here.
const corpus: DraftRecord[] = [
    game('g1', 'A', 'B', [{ side: 'red', key: 'X' }]),
    game('g2', 'A', 'B', [{ side: 'red', key: 'X' }]),
    game('g3', 'B', 'C', [{ side: 'blue', key: 'W' }])
];

describe('fitBanAttraction', () => {
    const fit = fitBanAttraction(corpus, { priorN: 10 });

    it('tallies games per team, suffered bans and banned games', () => {
        expect(fit.games).toBe(3);
        expect(fit.priorN).toBe(10);
        expect(fit.byTeam.get('A')!.games).toBe(2);
        expect(fit.byTeam.get('B')!.games).toBe(3);
        expect(fit.byTeam.get('C')!.games).toBe(1);
        expect(fit.byTeam.get('A')!.suffered.get('X')).toBe(2);
        // Informative zero: B plays all 3 games and never suffers a ban on X
        // (its own side banned it in g1/g2) — games count, suffered stays empty.
        expect(fit.byTeam.get('B')!.suffered.size).toBe(0);
        expect(fit.byTeam.get('C')!.suffered.get('W')).toBe(1);
        expect(fit.bannedGames.get('X')).toBe(2);
        expect(fit.bannedGames.get('W')).toBe(1);
    });

    it('defaults priorN to the pre-registered 10', () => {
        expect(DEFAULT_BAN_ATTRACTION_PRIOR_N).toBe(10);
        expect(fitBanAttraction(corpus).priorN).toBe(10);
    });

    it('ignores unresolved bans (championKey "")', () => {
        const withUnresolved = fitBanAttraction([
            game('u1', 'A', 'B', [
                { side: 'red', key: '' },
                { side: 'red', key: 'X' }
            ])
        ]);
        expect(withUnresolved.bannedGames.size).toBe(1);
        expect(withUnresolved.bannedGames.get('X')).toBe(1);
        expect(withUnresolved.byTeam.get('A')!.suffered.size).toBe(1);
        expect(withUnresolved.byTeam.get('A')!.suffered.get('X')).toBe(1);
    });

    it('deduplicates per game: double ban on one side and both-sides ban count once', () => {
        // Corrupted double red ban on X + a blue ban on X in the same game:
        // suffered_A(X) = 1 (≤ 1 per game), bannedGames(X) = 1 (per game).
        const fitDup = fitBanAttraction([
            game('d1', 'A', 'B', [
                { side: 'red', key: 'X' },
                { side: 'red', key: 'X' },
                { side: 'blue', key: 'X' }
            ])
        ]);
        expect(fitDup.byTeam.get('A')!.suffered.get('X')).toBe(1);
        // B also suffers blue's ban on X exactly once.
        expect(fitDup.byTeam.get('B')!.suffered.get('X')).toBe(1);
        expect(fitDup.bannedGames.get('X')).toBe(1);
    });
});

describe('leagueBanAttraction (μ, add-half)', () => {
    const fit = fitBanAttraction(corpus, { priorN: 10 });

    it('μ_X = (2 + 0.5) / (2·3 + 1) = 2.5/7', () => {
        expect(leagueBanAttraction(fit, 'X')).toBeCloseTo(2.5 / 7, 12);
    });

    it('a never-banned champion gets the pure smoothing mass: μ_Y = 0.5/7', () => {
        expect(leagueBanAttraction(fit, 'Y')).toBeCloseTo(0.5 / 7, 12);
    });
});

describe('banAttractionRate (closed-form Beta posterior, priorN 10)', () => {
    const fit = fitBanAttraction(corpus, { priorN: 10 });

    it('rate(A, X) = (2 + 10·2.5/7) / (2 + 10) = 13/28', () => {
        expect(banAttractionRate(fit, 'A', 'X')).toBeCloseTo(13 / 28, 12);
    });

    it('rate(B, X) = (0 + 10·2.5/7) / (3 + 10) = 25/91 (informative zero shrinks below μ)', () => {
        expect(banAttractionRate(fit, 'B', 'X')).toBeCloseTo(25 / 91, 12);
        expect(banAttractionRate(fit, 'B', 'X')).toBeLessThan(leagueBanAttraction(fit, 'X'));
    });

    it('unknown team falls back to the league prior μ_X (cascade DA-V2-4)', () => {
        expect(banAttractionRate(fit, 'D', 'X')).toBeCloseTo(2.5 / 7, 12);
    });

    it('never-banned champion: rate(A, Y) = (0 + 10·0.5/7) / 12 = 5/84', () => {
        expect(banAttractionRate(fit, 'A', 'Y')).toBeCloseTo(5 / 84, 12);
    });

    it('empty fit (0 record) returns 0', () => {
        const empty = fitBanAttraction([]);
        expect(banAttractionRate(empty, 'A', 'X')).toBe(0);
    });
});
