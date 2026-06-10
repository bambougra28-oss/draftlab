/**
 * golggBridge: RecentDraft → DraftRecord conversion.
 *
 * Seq expectations are hand-derived from the 20-slot template anchored on
 * blue as first-pick side (DRAFT_TEMPLATE in $lib/data/draftRecord):
 *   blue bans  → seq 1,3,5 (phase 1) and 14,16 (phase 2)
 *   blue picks → seq 7,10,11 (phase 1) and 18,19 (phase 2)
 *   red  bans  → seq 2,4,6 and 13,15
 *   red  picks → seq 8,9,12 and 17,20
 * The two unit drafts mirror real fixture games 76627 (ZYB blue WIN vs TLNP)
 * and 77034 (ZYB red LOSS vs KCB), values hand-read in golgg.parser.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { recentDraftToDraftRecord, recentDraftsToDraftRecords } from '$lib/pro/golggBridge';
import { parseRecentDrafts, parseTournamentMatchList } from '$lib/pro/golgg';
import type { ProTeam, RecentDraft } from '$lib/pro/types';
import { Role } from '$lib/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FETCHED_AT = '2026-06-10T12:00:00.000Z';

/** Game 76627: ZYB blue side, win vs TLN Pirates (tag TLNP), 2026-04-16. */
const draftBlue: RecentDraft = {
    gameId: '76627',
    side: 'blue',
    result: 'W',
    opponent: 'TLNP',
    picks: [
        { championKey: '68', role: Role.Top }, // Rumble
        { championKey: '18', role: Role.Bottom }, // Tristana
        { championKey: '904', role: Role.Jungle }, // Zaahen
        { championKey: '103', role: Role.Middle }, // Ahri
        { championKey: '60', role: Role.Support } // Elise
    ],
    bans: [
        { championKey: '59' }, // Jarvan IV
        { championKey: '34' }, // Anivia
        { championKey: '56' }, // Nocturne
        { championKey: '516' }, // Ornn
        { championKey: '800' } // Mel
    ],
    playedAt: '2026-04-16T00:00:00.000Z'
};

/** Game 77034: ZYB red side, loss vs Karmine Corp Blue (tag KCB). No date. */
const draftRed: RecentDraft = {
    gameId: '77034',
    side: 'red',
    result: 'L',
    opponent: 'KCB',
    picks: [
        { championKey: '904' },
        { championKey: '13' },
        { championKey: '145' },
        { championKey: '518' },
        { championKey: '2' }
    ],
    bans: [
        { championKey: '61' },
        { championKey: '68' },
        { championKey: '80' },
        { championKey: '42' },
        { championKey: '498' }
    ]
};

const team: ProTeam = {
    id: '2924',
    name: 'ZYB Esport',
    league: 'lfl',
    tournament: 'LFL 2026 Spring Split',
    players: [],
    sideStats: { blue: { wins: 4, games: 14 }, red: { wins: 5, games: 12 } },
    recentDrafts: [draftBlue, draftRed],
    warnings: []
};

describe('recentDraftToDraftRecord', () => {
    const blueRecord = recentDraftToDraftRecord(team, draftBlue, FETCHED_AT);
    const redRecord = recentDraftToDraftRecord(team, draftRed, FETCHED_AT);

    it('maps identity, sides, winner and provenance for a blue-side win', () => {
        expect(blueRecord.gameId).toBe('76627');
        expect(blueRecord.blueTeam).toBe('ZYB Esport');
        expect(blueRecord.redTeam).toBe('TLNP');
        expect(blueRecord.winner).toBe('blue'); // result W on our (blue) side
        expect(blueRecord.date).toBe('2026-04-16T00:00:00.000Z');
        expect(blueRecord.league).toBe('lfl');
        expect(blueRecord.tournament).toBe('LFL 2026 Spring Split');
        expect(blueRecord.firstPickSide).toBe('blue');
        expect(blueRecord.orderConfidence).toBe('assumed-blue-first');
        expect(blueRecord.provenance).toEqual({ source: 'golgg', fetchedAt: FETCHED_AT });
    });

    it('places blue actions on the template seqs 1,3,5,7,10,11,14,16,18,19', () => {
        expect(blueRecord.actions.map((a) => a.seq)).toEqual([1, 3, 5, 7, 10, 11, 14, 16, 18, 19]);
        const bySeq = new Map(blueRecord.actions.map((a) => [a.seq, a]));
        // b1 = Jarvan IV at seq 1; b4 = Ornn at the phase-2 seq 14.
        expect(bySeq.get(1)).toMatchObject({ type: 'ban', side: 'blue', championKey: '59' });
        expect(bySeq.get(14)).toMatchObject({ type: 'ban', championKey: '516' });
        // p1 = Rumble at seq 7 (role forwarded); p4 = Ahri at seq 18.
        expect(bySeq.get(7)).toMatchObject({
            type: 'pick',
            championKey: '68',
            championName: 'Rumble',
            role: Role.Top
        });
        expect(bySeq.get(18)).toMatchObject({ type: 'pick', championKey: '103', role: Role.Middle });
    });

    it('round-trips 2026 champions (Zaahen 904, Mel 800) through display names', () => {
        const zaahen = blueRecord.actions.find((a) => a.championKey === '904');
        expect(zaahen?.championName).toBe('Zaahen');
        const mel = blueRecord.actions.find((a) => a.championKey === '800');
        expect(mel).toMatchObject({ type: 'ban', championName: 'Mel' });
        expect(blueRecord.warnings.filter((w) => w.includes('unresolved'))).toHaveLength(0);
    });

    it('flags the one-sided nature: leading note + 5 missing enemy picks', () => {
        expect(blueRecord.warnings[0]).toContain('one-sided');
        expect(blueRecord.warnings.filter((w) => w.includes('missing red pick'))).toHaveLength(5);
        // 2026 game → the first-selection order assumption is flagged too.
        expect(blueRecord.warnings.some((w) => w.includes('first-selection era'))).toBe(true);
    });

    it('places red actions on seqs 2,4,6,8,9,12,13,15,17,20 with winner=blue on a loss', () => {
        expect(redRecord.actions.map((a) => a.seq)).toEqual([2, 4, 6, 8, 9, 12, 13, 15, 17, 20]);
        expect(redRecord.blueTeam).toBe('KCB');
        expect(redRecord.redTeam).toBe('ZYB Esport');
        expect(redRecord.winner).toBe('blue'); // we lost on red → blue won
        const bySeq = new Map(redRecord.actions.map((a) => [a.seq, a]));
        expect(bySeq.get(8)).toMatchObject({ type: 'pick', side: 'red', championKey: '904' });
        expect(bySeq.get(13)).toMatchObject({ type: 'ban', side: 'red', championKey: '42' });
        expect(redRecord.warnings.filter((w) => w.includes('missing blue pick'))).toHaveLength(5);
    });

    it('omits date and the first-selection warning when playedAt is unknown', () => {
        expect(redRecord.date).toBeUndefined();
        expect(redRecord.warnings.some((w) => w.includes('first-selection era'))).toBe(false);
    });
});

describe('recentDraftsToDraftRecords (full fixture chain)', () => {
    const fixture = (name: string): string =>
        readFileSync(join(process.cwd(), 'tests', 'fixtures', 'golgg', name), 'utf8');
    const gameDates = parseTournamentMatchList(fixture('tournament-matchlist-lfl-spring-2026.html'));
    const { drafts } = parseRecentDrafts(fixture('team-draft-zyb.html'), { gameDates });
    const records = recentDraftsToDraftRecords(
        { ...team, recentDrafts: drafts },
        { fetchedAt: FETCHED_AT }
    );

    it('converts all 26 scraped drafts with unique game ids', () => {
        expect(records).toHaveLength(26);
        expect(new Set(records.map((r) => r.gameId)).size).toBe(26);
    });

    it('emits 10 one-sided actions per record (8 for game 74155 with its 2 lost icons)', () => {
        for (const record of records) {
            expect(record.actions).toHaveLength(record.gameId === '74155' ? 8 : 10);
            expect(record.actions.every((a) => a.championKey !== '')).toBe(true);
        }
    });

    it('dates flow through for split games (77034 → 2026-04-23)', () => {
        const r = records.find((x) => x.gameId === '77034');
        expect(r?.date).toBe('2026-04-23T00:00:00.000Z');
    });
});
