/**
 * liveDraft: role-keyed entry → navigator state, and the explained
 * recommendations of the Coach panel. The evaluator is a hand-written stub
 * (value = f(comp contents)) so every ranking below is verifiable on paper.
 * Real champion keys: 54 Malphite (melee, hard-aoe engage), 18 Tristana,
 * 103 Ahri, 68 Rumble, 13 Ryze, 60 Elise, 412 Thresh, 145 Kai'Sa.
 */
import { describe, it, expect } from 'vitest';
import { draftStateFromRoleEntry, recommendNext, type RoleEntryDraft } from '$lib/intel/liveDraft';
import { buildTendencyTable } from '$lib/aggregates/tendency';
import { buildDraftActions } from '$lib/data/draftRecord';
import type { DraftRecord } from '$lib/data/types';

const emptyEntry = (): RoleEntryDraft => ({
    allyPicks: [null, null, null, null, null],
    enemyPicks: [null, null, null, null, null],
    allyBans: [null, null, null, null, null],
    enemyBans: [null, null, null, null, null],
    allySide: 'blue'
});

describe('draftStateFromRoleEntry', () => {
    it('maps role-keyed entry onto the blue-first template (gaps = skipped)', () => {
        const entry = emptyEntry();
        entry.allyPicks = ['54', '103', null, null, null];
        entry.allyBans = ['68', null, null, null, null];
        entry.enemyPicks = ['145', null, null, null, null];

        const state = draftStateFromRoleEntry(entry);
        const bySeq = new Map(state.actions.map((a) => [a.seq, a]));
        expect(bySeq.get(1)).toMatchObject({ type: 'ban', side: 'blue', championKey: '68' });
        expect(bySeq.get(7)).toMatchObject({ type: 'pick', side: 'blue', championKey: '54' });
        expect(bySeq.get(8)).toMatchObject({ type: 'pick', side: 'red', championKey: '145' });
        expect(bySeq.get(10)).toMatchObject({ type: 'pick', side: 'blue', championKey: '103' });
        expect(state.actions).toHaveLength(4);
    });

    it('swaps columns when the ally plays red, and excludes locked champions', () => {
        const entry = emptyEntry();
        entry.allySide = 'red';
        entry.allyPicks = ['13', null, null, null, null];
        entry.excludedKeys = ['54', '103'];

        const state = draftStateFromRoleEntry(entry);
        expect(state.actions[0]).toMatchObject({ seq: 8, side: 'red', championKey: '13' });
        expect(state.available.has('54')).toBe(false);
        expect(state.available.has('103')).toBe(false);
        expect(state.available.has('13')).toBe(false); // used
        expect(state.available.has('68')).toBe(true);
    });
});

// ---- recommendNext ------------------------------------------------------------

/** Stub evaluator: 0.5 + 0.1 per ally Malphite(54) + 0.05 per ally Ahri(103). */
const evaluate = (allyKeys: string[], enemyKeys: string[]): number => {
    let value = 0.5;
    for (const key of allyKeys) value += key === '54' ? 0.1 : key === '103' ? 0.05 : 0;
    for (const key of enemyKeys) value -= key === '54' ? 0.1 : key === '103' ? 0.05 : 0;
    return value;
};

/** Two synthetic enemy records so the tendency table predicts P2-3 red = 145. */
function enemyRecord(gameId: string): DraftRecord {
    const { actions } = buildDraftActions({
        blue: { bans: [], picks: ['13', '60', '412'] },
        red: { bans: [], picks: ['145', '68', '103'] },
        firstPickSide: 'blue',
        resolveKey: (k) => k
    });
    return {
        gameId,
        blueTeam: 'NOUS',
        redTeam: 'EUX',
        firstPickSide: 'blue',
        orderConfidence: 'assumed-blue-first',
        actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-01T00:00:00Z' }
    };
}

describe('recommendNext', () => {
    it('our ban turn: ranks fallback candidates by navigator value, FIFO of the template', () => {
        const state = draftStateFromRoleEntry(emptyEntry());
        const advice = recommendNext(state, {
            ourSide: 'blue',
            evaluate,
            fallbackCandidates: ['54', '103', '13'],
            depth: 1,
            topK: 3
        });

        expect(advice.turn).toMatchObject({ seq: 1, type: 'ban', side: 'blue', isOurs: true });
        expect(advice.candidates.length).toBeGreaterThan(0);
        // Banning Malphite removes the +0.1 enemy threat → best ban by the stub.
        expect(advice.candidates[0].championKey).toBe('54');
        expect(advice.candidates[0].actionType).toBe('ban');
        expect(advice.headlineFr).toContain('À vous de ban');
        expect(advice.experimental).toBe(true);
    });

    it('enemy turn: no candidates, the expectation comes from the tendency table', () => {
        // Ally red, empty draft → seq 1 is blue's ban: their turn.
        const entry = emptyEntry();
        entry.allySide = 'red';
        const state = draftStateFromRoleEntry(entry);
        const table = buildTendencyTable([enemyRecord('e1'), enemyRecord('e2')], [], {
            now: '2026-06-10T00:00:00Z',
            team: 'EUX'
        });
        const advice = recommendNext(state, { ourSide: 'red', evaluate, table });

        expect(advice.turn).toMatchObject({ seq: 1, side: 'blue', isOurs: false });
        expect(advice.candidates).toEqual([]);
        expect(advice.headlineFr).toContain('Tour adverse');
    });

    it('our pick turn: plain-French reasons fire (engage gap via M5.5 axes)', () => {
        // Fill all 6 phase-1 bans so the next slot is seq 7 — blue pick, ours.
        const entry = emptyEntry();
        entry.allyBans = ['86', '23', '36', null, null];
        entry.enemyBans = ['75', '77', '106', null, null];
        const state = draftStateFromRoleEntry(entry);
        expect(state.actions).toHaveLength(6);

        const advice = recommendNext(state, {
            ourSide: 'blue',
            evaluate,
            fallbackCandidates: ['54', '103'],
            depth: 1,
            topK: 2
        });

        expect(advice.turn).toMatchObject({ seq: 7, type: 'pick', side: 'blue', isOurs: true });
        expect(advice.candidates[0].championKey).toBe('54'); // +0.10 beats +0.05
        expect(advice.candidates[0].winAfter).toBeCloseTo(0.6, 10);
        expect(advice.candidates[0].edgeVsNextPp).toBeCloseTo(5, 10);
        // Malphite carries a hard-aoe engage tool → the M5.5 gap-fill reason.
        expect(advice.candidates[0].reasonsFr.some((r) => r.includes('engage'))).toBe(true);
    });

    it('pool-ranked candidates: strongest tier first, fallback fills the rest', () => {
        const entry = emptyEntry();
        entry.allyBans = ['86', '23', '36', null, null];
        entry.enemyBans = ['75', '77', '106', null, null];
        const state = draftStateFromRoleEntry(entry);

        const advice = recommendNext(state, {
            ourSide: 'blue',
            evaluate,
            allyPlayers: [
                {
                    id: 'p1',
                    name: 'Toplaner',
                    role: 0,
                    pool: [
                        { championKey: '103', games: 25, wins: 15 }, // strongest tier
                        { championKey: '13', games: 4, wins: 2 } // scrim-ready
                    ]
                }
            ],
            fallbackCandidates: ['54'],
            depth: 1,
            topK: 3,
            candidateCount: 3
        });

        // Navigator still ranks by value (54 wins on the stub), but the pool
        // champion 103 is IN the candidate set ahead of the scrim-ready 13.
        const keys = advice.candidates.map((c) => c.championKey);
        expect(keys).toContain('103');
        expect(keys[0]).toBe('54');
    });

    it('picksOnly: skips the whole ban phase — first turn is seq 7, ours on blue', () => {
        const state = draftStateFromRoleEntry(emptyEntry()); // nothing entered at all
        const advice = recommendNext(state, {
            ourSide: 'blue',
            evaluate,
            fallbackCandidates: ['54', '103'],
            picksOnly: true,
            depth: 2,
            topK: 2
        });

        expect(advice.turn).toMatchObject({ seq: 7, type: 'pick', side: 'blue', isOurs: true });
        expect(advice.candidates[0]).toMatchObject({ championKey: '54', actionType: 'pick' });
        // Lookahead crossed the skipped ban slots without burning depth:
        // the line contains real picks, never sentinel bans.
        expect(advice.candidates[0].line.every((key) => key !== '')).toBe(true);
    });

    it('complete draft: turn null and an explicit FR headline', () => {
        const entry = emptyEntry();
        entry.allyPicks = ['54', '103', '13', '18', '60'];
        entry.enemyPicks = ['145', '68', '412', '86', '23'];
        entry.allyBans = ['36', '75', '77', '106', '111'];
        entry.enemyBans = ['117', '120', '121', '122', '126'];
        const state = draftStateFromRoleEntry(entry);

        const advice = recommendNext(state, { ourSide: 'blue', evaluate });
        expect(advice.turn).toBeNull();
        expect(advice.headlineFr).toContain('Draft complète');
    });
});
