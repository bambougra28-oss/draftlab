import { describe, it, expect } from 'vitest';
import {
    CALIBRATION_POSITIONS,
    isCalibrationEligible,
    roleTeamsAt
} from '$lib/backtest/sequencePositions';
import { Role } from '$lib/types';
import type { DraftAction, DraftRecord, DraftSide } from '$lib/data/types';

// ---- synthetic 20-action record (blue = first-pick side of DRAFT_TEMPLATE) ----

const ban = (seq: number, side: DraftSide, key: string): DraftAction => ({
    seq,
    type: 'ban',
    phase: seq <= 6 ? 'ban1' : 'ban2',
    side,
    championKey: key,
    championName: `B${key}`
});

const pick = (seq: number, side: DraftSide, role: Role, key: string): DraftAction => ({
    seq,
    type: 'pick',
    phase: seq <= 12 ? 'pick1' : 'pick2',
    side,
    championKey: key,
    championName: `C${key}`,
    role
});

/** Template order with blue first: bans 1-6/13-16, picks 7-12/17-20. */
const fullActions = (): DraftAction[] => [
    ban(1, 'blue', '901'),
    ban(2, 'red', '902'),
    ban(3, 'blue', '903'),
    ban(4, 'red', '904'),
    ban(5, 'blue', '905'),
    ban(6, 'red', '906'),
    pick(7, 'blue', Role.Top, '101'),
    pick(8, 'red', Role.Top, '201'),
    pick(9, 'red', Role.Jungle, '202'),
    pick(10, 'blue', Role.Jungle, '102'),
    pick(11, 'blue', Role.Middle, '103'),
    pick(12, 'red', Role.Middle, '203'),
    ban(13, 'red', '907'),
    ban(14, 'blue', '908'),
    ban(15, 'red', '909'),
    ban(16, 'blue', '910'),
    pick(17, 'red', Role.Bottom, '204'),
    pick(18, 'blue', Role.Bottom, '104'),
    pick(19, 'blue', Role.Support, '105'),
    pick(20, 'red', Role.Support, '205')
];

const record = (overrides: Partial<DraftRecord> = {}): DraftRecord => ({
    gameId: 'SYN-1',
    blueTeam: 'Bleus',
    redTeam: 'Rouges',
    winner: 'blue',
    patch: '26.05',
    firstPickSide: 'blue',
    orderConfidence: 'exact',
    actions: fullActions(),
    warnings: [],
    provenance: { source: 'synthetic', fetchedAt: '2026-06-11T00:00:00Z' },
    ...overrides
});

describe('sequencePositions — roleTeamsAt', () => {
    it('freezes the three anchors at seq 6/9/20', () => {
        expect(CALIBRATION_POSITIONS).toEqual([
            { id: 'afterBans', maxSeq: 6 },
            { id: 'after3Picks', maxSeq: 9 },
            { id: 'fullDraft', maxSeq: 20 }
        ]);
    });

    it('returns 0+0 picks after bans (seq ≤ 6) — bans never enter the teams', () => {
        const teams = roleTeamsAt(record(), 6);
        expect(teams).toBeDefined();
        expect(teams!.blue.size).toBe(0);
        expect(teams!.red.size).toBe(0);
    });

    it('returns 1 blue + 2 red picks after 3 picks (seq ≤ 9, blue first)', () => {
        const teams = roleTeamsAt(record(), 9)!;
        expect(teams.blue.size).toBe(1);
        expect(teams.red.size).toBe(2);
        expect(teams.blue.get(Role.Top)).toBe('101');
        expect(teams.red.get(Role.Top)).toBe('201');
        expect(teams.red.get(Role.Jungle)).toBe('202');
    });

    it('returns the two full role-keyed comps at seq ≤ 20', () => {
        const teams = roleTeamsAt(record(), 20)!;
        expect(teams.blue.size).toBe(5);
        expect(teams.red.size).toBe(5);
        expect([...teams.blue.entries()].sort((a, b) => a[0] - b[0])).toEqual([
            [Role.Top, '101'],
            [Role.Jungle, '102'],
            [Role.Middle, '103'],
            [Role.Bottom, '104'],
            [Role.Support, '105']
        ]);
        expect(teams.red.get(Role.Bottom)).toBe('204');
    });

    it('rejects a prefix containing a pick without a role (and only from that seq on)', () => {
        const actions = fullActions();
        delete actions[8].role; // seq 9, red Jungle
        const r = record({ actions });
        expect(roleTeamsAt(r, 8)).toBeDefined(); // the bad pick is outside seq ≤ 8
        expect(roleTeamsAt(r, 9)).toBeUndefined();
        expect(roleTeamsAt(r, 20)).toBeUndefined();
    });

    it('rejects a side-duplicated role, but not the same role across sides', () => {
        const actions = fullActions();
        actions[9] = pick(10, 'blue', Role.Top, '102'); // blue already has Top at seq 7
        const r = record({ actions });
        expect(roleTeamsAt(r, 9)).toBeDefined(); // duplicate not yet in the prefix
        expect(roleTeamsAt(r, 10)).toBeUndefined();
        // Base record: blue Top + red Top coexist (different sides) — accepted.
        expect(roleTeamsAt(record(), 20)).toBeDefined();
    });

    it('rejects a prefix containing an unresolved (empty) champion key', () => {
        const actions = fullActions();
        actions[7] = pick(8, 'red', Role.Top, ''); // seq 8 unresolved
        const r = record({ actions });
        expect(roleTeamsAt(r, 7)).toBeDefined();
        expect(roleTeamsAt(r, 8)).toBeUndefined();
    });
});

describe('sequencePositions — isCalibrationEligible', () => {
    it('accepts winner + 10 role-complete picks + parsable patch', () => {
        expect(isCalibrationEligible(record())).toBe(true);
    });

    it('rejects a record without winner', () => {
        const r = record();
        delete r.winner;
        expect(isCalibrationEligible(r)).toBe(false);
    });

    it('rejects a missing or unparseable patch', () => {
        const r = record();
        delete r.patch;
        expect(isCalibrationEligible(r)).toBe(false);
        expect(isCalibrationEligible(record({ patch: 'TBD' }))).toBe(false);
    });

    it('rejects incomplete picks (9 picks, or a role hole)', () => {
        const nine = fullActions().filter((a) => a.seq !== 20);
        expect(isCalibrationEligible(record({ actions: nine }))).toBe(false);
        const noRole = fullActions();
        delete noRole[18].role; // seq 19
        expect(isCalibrationEligible(record({ actions: noRole }))).toBe(false);
    });
});
