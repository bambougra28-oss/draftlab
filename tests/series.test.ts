import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    createSeries,
    emptyGame,
    upsertGame,
    removeGame,
    recomputeConsumed,
    consumedChampions,
    availableChampions,
    saveSeries,
    getSeries,
    listSeries,
    deleteSeries,
    type Series
} from '$lib/storage/series';
import { idbClear } from '$lib/storage/idb';

beforeEach(async () => {
    await idbClear('series');
});

function fearless(): Series {
    return createSeries({ name: 'LEC W1', format: 'bo3', mode: 'fearless', allyTeam: 'Us', enemyTeam: 'Them' });
}

describe('series — pure logic', () => {
    it('creates an empty series with the right shape', () => {
        const s = fearless();
        expect(s.games).toEqual([]);
        expect(s.consumedAlly).toEqual([]);
        expect(s.format).toBe('bo3');
        expect(s.id).toBeTruthy();
    });

    it('upserts games in game-number order', () => {
        let s = fearless();
        s = upsertGame(s, { ...emptyGame(2), allyPicks: ['10'] });
        s = upsertGame(s, { ...emptyGame(1), allyPicks: ['1'] });
        expect(s.games.map((g) => g.gameNumber)).toEqual([1, 2]);
    });

    it('replaces a game with the same number', () => {
        let s = fearless();
        s = upsertGame(s, { ...emptyGame(1), allyPicks: ['1'] });
        s = upsertGame(s, { ...emptyGame(1), allyPicks: ['2'] });
        expect(s.games).toHaveLength(1);
        expect(s.consumedAlly).toEqual(['2']);
    });

    it('removes a game and recomputes consumption', () => {
        let s = fearless();
        s = upsertGame(s, { ...emptyGame(1), allyPicks: ['1'] });
        s = upsertGame(s, { ...emptyGame(2), allyPicks: ['2'] });
        s = removeGame(s, 1);
        expect(s.games).toHaveLength(1);
        expect(s.consumedAlly).toEqual(['2']);
    });

    it('recomputes consumed picks as a de-duplicated union', () => {
        let s = fearless();
        s = upsertGame(s, { ...emptyGame(1), allyPicks: ['1', '2'], enemyPicks: ['3'] });
        s = upsertGame(s, { ...emptyGame(2), allyPicks: ['2', '4'], enemyPicks: ['5'] });
        const consumed = consumedChampions(s);
        expect(consumed.ally.sort()).toEqual(['1', '2', '4']);
        expect(consumed.enemy.sort()).toEqual(['3', '5']);
        expect(consumed.all).toContain('1');
        expect(consumed.all).toContain('5');
    });

    it('locks consumed champions out of availability in Fearless', () => {
        let s = fearless();
        s = upsertGame(s, { ...emptyGame(1), allyPicks: ['1'], enemyPicks: ['2'] });
        const available = availableChampions(s, ['1', '2', '3', '4']);
        expect(available).toEqual(['3', '4']);
    });

    it('does not carry champions over between games in standard mode', () => {
        let s = createSeries({ name: 'Scrim', format: 'bo5', mode: 'standard', allyTeam: 'A', enemyTeam: 'B' });
        s = upsertGame(s, { ...emptyGame(1), allyPicks: ['1'], enemyPicks: ['2'] });
        expect(availableChampions(s, ['1', '2', '3'])).toEqual(['1', '2', '3']);
    });

    it('recomputeConsumed is idempotent', () => {
        let s = fearless();
        s = upsertGame(s, { ...emptyGame(1), allyPicks: ['1'] });
        const again = recomputeConsumed(s);
        expect(again.consumedAlly).toEqual(s.consumedAlly);
    });
});

describe('series — persistence', () => {
    it('round-trips through IndexedDB', async () => {
        const s = await saveSeries(upsertGame(fearless(), { ...emptyGame(1), allyPicks: ['1'] }));
        const fetched = await getSeries(s.id);
        expect(fetched?.name).toBe('LEC W1');
        expect(fetched?.consumedAlly).toEqual(['1']);
    });

    it('lists series', async () => {
        await saveSeries(fearless());
        await saveSeries(fearless());
        expect(await listSeries()).toHaveLength(2);
    });

    it('deletes a series', async () => {
        const s = await saveSeries(fearless());
        await deleteSeries(s.id);
        expect(await getSeries(s.id)).toBeUndefined();
    });
});
