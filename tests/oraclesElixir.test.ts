import { describe, it, expect } from 'vitest';
import { parseCsv, parseOraclesElixirCsv } from '$lib/data/providers/oraclesElixir';
import { Role } from '$lib/types';

describe('parseCsv', () => {
    it('handles quoted commas, escaped quotes and CRLF line endings', () => {
        const csv = 'a,b,c\r\n"x,1","said ""hi""",plain\r\n2,,3\r\n';
        const rows = parseCsv(csv);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({ a: 'x,1', b: 'said "hi"', c: 'plain' });
        expect(rows[1]).toEqual({ a: '2', b: '', c: '3' });
    });

    it('lowercases headers and tolerates a missing trailing newline', () => {
        const rows = parseCsv('GameID,Side\ng1,Blue');
        expect(rows[0]).toEqual({ gameid: 'g1', side: 'Blue' });
    });
});

/** Build a realistic OE 2024+ slice: 2 team rows + 4 player rows per game. */
function oeFixture(): string {
    const header =
        'gameid,league,date,game,patch,side,position,playername,champion,teamname,' +
        'ban1,ban2,ban3,ban4,ban5,pick1,pick2,pick3,pick4,pick5,result';
    const lines = [header];
    // Game 1 — LFL, red side wins, full data.
    lines.push(
        'LFL1,LFL,2025-04-12 18:00:00,2,25.07,Blue,team,,,"ZYB Esport",' +
            'Yone,Akali,Vi,Poppy,Hwei,"Kai\'Sa",Maokai,Aurora,Rell,"K\'Sante",0'
    );
    lines.push(
        'LFL1,LFL,2025-04-12 18:00:00,2,25.07,Red,team,,,"Karmine Corp",' +
            'Rumble,Corki,Jax,,Udyr,Varus,Sejuani,Yasuo,"Renata Glasc",Gragas,1'
    );
    lines.push("LFL1,LFL,2025-04-12 18:00:00,2,25.07,Blue,bot,Jezu,Kai'Sa,ZYB Esport,,,,,,,,,,,0");
    lines.push('LFL1,LFL,2025-04-12 18:00:00,2,25.07,Blue,jng,Manaty,Maokai,ZYB Esport,,,,,,,,,,,0');
    lines.push('LFL1,LFL,2025-04-12 18:00:00,2,25.07,Red,bot,Caliste,Varus,Karmine Corp,,,,,,,,,,,1');
    lines.push('LFL1,LFL,2025-04-12 18:00:00,2,25.07,Red,sup,Targamas,Renata Glasc,Karmine Corp,,,,,,,,,,,1');
    // Game 2 — missing the red team row → must be skipped.
    lines.push('LFL2,LFL,2025-04-13 18:00:00,1,25.07,Blue,team,,,Solary,' + 'A,B,C,D,E,F,G,H,I,J,1');
    return lines.join('\n');
}

describe('parseOraclesElixirCsv', () => {
    const { records, skipped } = parseOraclesElixirCsv(oeFixture(), '2026-06-10T12:00:00Z');

    it('produces one record per complete game and skips incomplete ones', () => {
        expect(records).toHaveLength(1);
        expect(skipped).toEqual(['LFL2']);
    });

    const record = records[0];

    it('maps identity, winner, series and provenance', () => {
        expect(record.gameId).toBe('LFL1');
        expect(record.blueTeam).toBe('ZYB Esport');
        expect(record.redTeam).toBe('Karmine Corp');
        expect(record.winner).toBe('red');
        expect(record.league).toBe('LFL');
        expect(record.patch).toBe('25.07');
        expect(record.series).toEqual({ gameNumber: 2 });
        expect(record.provenance.source).toBe('oracles-elixir');
    });

    it('keeps the made-order pick/ban columns and the skipped red ban 4', () => {
        const bySeq = new Map(record.actions.map((a) => [a.seq, a]));
        expect(bySeq.get(7)).toMatchObject({ side: 'blue', championName: "Kai'Sa" });
        expect(bySeq.get(8)).toMatchObject({ side: 'red', championName: 'Varus' });
        expect(bySeq.get(17)).toMatchObject({ side: 'red', championName: 'Renata Glasc' });
        // Red ban4 cell is empty → seq 13 absent (red bans first in phase 2).
        expect(bySeq.has(13)).toBe(false);
        expect(record.actions).toHaveLength(19);
    });

    it('enriches picks with role + player from the player rows', () => {
        const kaisa = record.actions.find((a) => a.championName === "Kai'Sa");
        expect(kaisa?.role).toBe(Role.Bottom);
        expect(kaisa?.playerId).toBe('Jezu');
        const sejuani = record.actions.find((a) => a.championName === 'Sejuani');
        expect(sejuani?.role).toBeUndefined(); // no player row supplied for it
    });

    it('does not flag pre-2026 games for First Selection', () => {
        expect(record.warnings.some((w) => w.includes('first-selection'))).toBe(false);
    });

    it('flags 2026 games for the First Selection order assumption', () => {
        const csv = oeFixture().replaceAll('2025-04-12', '2026-04-12').replaceAll('2025-04-13', '2026-04-13');
        const res = parseOraclesElixirCsv(csv, 'now');
        expect(res.records[0].warnings.some((w) => w.includes('first-selection era'))).toBe(true);
    });

    it('uses the real firstPick column → exact order, no assumption warning (even in 2026)', () => {
        const header =
            'gameid,league,date,side,position,champion,teamname,firstpick,' +
            'pick1,pick2,pick3,pick4,pick5,ban1,ban2,ban3,ban4,ban5,result';
        const blue = 'G,LCK,2026-02-01 10:00:00,Blue,team,,T1,0,Ahri,Jinx,Leona,Gnar,Vi,,,,,,1';
        const red = 'G,LCK,2026-02-01 10:00:00,Red,team,,GEN,1,Azir,Varus,Rakan,Rumble,Sejuani,,,,,,0';
        const { records } = parseOraclesElixirCsv([header, blue, red].join('\n'), 'now');
        expect(records[0].firstPickSide).toBe('red'); // red carried firstPick=1
        expect(records[0].orderConfidence).toBe('exact');
        expect(records[0].warnings.some((w) => w.includes('first-selection'))).toBe(false);
    });
});
