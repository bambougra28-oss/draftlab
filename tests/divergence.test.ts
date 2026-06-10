import { describe, it, expect } from 'vitest';
import { compareDraftRecords, divergenceReport, recordMatchKey } from '$lib/data/divergence';
import type { DraftAction, DraftRecord } from '$lib/data/types';

let seqCounter = 0;
function pick(side: 'blue' | 'red', key: string, seq?: number): DraftAction {
    return {
        seq: seq ?? ++seqCounter,
        type: 'pick',
        phase: 'pick1',
        side,
        championKey: key,
        championName: key
    };
}

function ban(side: 'blue' | 'red', key: string, seq?: number): DraftAction {
    return {
        seq: seq ?? ++seqCounter,
        type: 'ban',
        phase: 'ban1',
        side,
        championKey: key,
        championName: key
    };
}

interface MkOptions {
    source?: string;
    blueTeam?: string;
    redTeam?: string;
    date?: string;
    gameNumber?: number;
    winner?: 'blue' | 'red';
    patch?: string;
    actions?: DraftAction[];
    orderConfidence?: 'exact' | 'assumed-blue-first';
    gameId?: string;
}

function mk(options: MkOptions = {}): DraftRecord {
    seqCounter = 0;
    return {
        gameId: options.gameId ?? 'g1',
        blueTeam: options.blueTeam ?? 'T1',
        redTeam: options.redTeam ?? 'Gen.G',
        date: options.date ?? '2026-02-01T08:00:00Z',
        patch: options.patch ?? '26.03',
        winner: options.winner ?? 'blue',
        series: { gameNumber: options.gameNumber ?? 1 },
        firstPickSide: 'blue',
        orderConfidence: options.orderConfidence ?? 'assumed-blue-first',
        actions: options.actions ?? [ban('blue', 'Yone', 1), pick('blue', '145', 7), pick('red', '268', 8)],
        warnings: [],
        provenance: { source: options.source ?? 'leaguepedia', fetchedAt: 'now' }
    };
}

describe('recordMatchKey', () => {
    it('is stable across team order, punctuation and source ids', () => {
        const a = mk({ blueTeam: 'Gen.G', redTeam: 'T1', gameId: 'lp-1' });
        const b = mk({ blueTeam: 'T1', redTeam: 'GenG', gameId: 'oe-99' });
        expect(recordMatchKey(a)).toBe(recordMatchKey(b));
    });

    it('separates different game numbers of the same match day', () => {
        expect(recordMatchKey(mk({ gameNumber: 1 }))).not.toBe(recordMatchKey(mk({ gameNumber: 2 })));
    });
});

describe('compareDraftRecords', () => {
    it('reports nothing for identical records', () => {
        expect(compareDraftRecords(mk(), mk({ source: 'oracles-elixir' }))).toHaveLength(0);
    });

    it('flags winner and side-swap as critical', () => {
        const swapped = mk({ blueTeam: 'Gen.G', redTeam: 'T1', winner: 'red' });
        const out = compareDraftRecords(mk(), swapped);
        const fields = out.filter((d) => d.severity === 'critical').map((d) => d.field);
        expect(fields).toContain('winner');
        expect(fields).toContain('blueTeam');
    });

    it('flags a pick-set mismatch as critical and ban mismatch as warning', () => {
        const altered = mk({
            actions: [ban('blue', 'Akali', 1), pick('blue', '145', 7), pick('red', '777', 8)]
        });
        const out = compareDraftRecords(mk(), altered);
        expect(out.find((d) => d.field === 'picks.red')?.severity).toBe('critical');
        expect(out.find((d) => d.field === 'bans.blue')?.severity).toBe('warning');
    });

    it('escalates order divergence to critical when one source is exact', () => {
        const base = mk();
        const reordered = mk({
            orderConfidence: 'exact',
            actions: [ban('blue', 'Yone', 1), pick('red', '268', 7), pick('blue', '145', 8)]
        });
        const out = compareDraftRecords(base, reordered);
        expect(out.find((d) => d.field === 'order.picks')?.severity).toBe('critical');
    });

    it('keeps order divergence a warning between two assumed orders', () => {
        const reordered = mk({
            actions: [ban('blue', 'Yone', 1), pick('red', '268', 7), pick('blue', '145', 8)]
        });
        const out = compareDraftRecords(mk(), reordered);
        expect(out.find((d) => d.field === 'order.picks')?.severity).toBe('warning');
    });
});

describe('divergenceReport', () => {
    it('matches across sources, lists unmatched, computes agreement', () => {
        const lp = [
            mk({ gameId: 'lp-1' }),
            mk({ gameId: 'lp-2', gameNumber: 2, winner: 'red' }),
            mk({ gameId: 'lp-3', blueTeam: 'Fnatic', redTeam: 'G2 Esports' })
        ];
        const oe = [
            mk({ gameId: 'oe-1', source: 'oracles-elixir' }),
            // Game 2 disagrees on the winner → critical divergence.
            mk({ gameId: 'oe-2', gameNumber: 2, winner: 'blue', source: 'oracles-elixir' }),
            // A game Leaguepedia doesn't have.
            mk({ gameId: 'oe-4', blueTeam: 'BDS', redTeam: 'SK', source: 'oracles-elixir' })
        ];

        const report = divergenceReport(lp, oe);
        expect(report.pairs).toHaveLength(2);
        expect(report.unmatchedA.map((r) => r.gameId)).toEqual(['lp-3']);
        expect(report.unmatchedB.map((r) => r.gameId)).toEqual(['oe-4']);
        expect(report.agreementRate).toBe(0.5);
        expect(report.byField.winner).toBe(1);
        expect(report.totalDivergences).toBeGreaterThanOrEqual(1);
    });

    it('reports perfect agreement as 1 with no pairs', () => {
        const report = divergenceReport([], []);
        expect(report.agreementRate).toBe(1);
    });
});
