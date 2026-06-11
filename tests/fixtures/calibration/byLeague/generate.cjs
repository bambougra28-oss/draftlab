/**
 * Chantier E3 (run #3) — generator of the SYNTHETIC by-league fixtures for the
 * plumbing smoke of scripts/backtest/winCalibrationByLeague.ts. Pure synthetic
 * data — NEVER real corpus material. Deterministic: re-running rewrites the
 * same bytes.
 *
 *   node tests/fixtures/calibration/byLeague/generate.cjs
 *
 * Produces (basenames frozen by the rule's regex ^(lck|lec|lfl|lpl)-\d{4}\.json$):
 *   - lck-2025.json : 4 eligible games (patches 25.01 ×2, 25.02 ×2)
 *   - lck-2026.json : 4 eligible games (patch 26.01; two in series LCK26-M1)
 *   - lec-2026.json : 5 records, 4 eligible (patch 26.01; LEC26-D1 has no
 *     winner — exercises the discarded counter), two in series LEC26-M1
 *   - dataset.json  : toy DraftGap-shaped dataset (champs 11..15 / 21..25,
 *     one role each) whose sha256 the smoke passes via
 *     --expected-sha256-current/--expected-sha256-full (flags FORBIDDEN on
 *     real corpora)
 *
 * 12 eligible games over 3 patches, all leagues far under minTrainSize = 50:
 * zero scored folds by construction — plumbing smoke only, never a metric.
 */
'use strict';

const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const here = __dirname;

// ---- toy dataset (same shape as ../synthetic-dataset.json) -------------------

const champion = (key, role, wins) => ({
    key,
    name: `Champ${key}`,
    statsByRole: {
        [role]: {
            games: 2000,
            wins,
            matchup: {},
            synergy: {},
            damageProfile: { magic: 0.34, physical: 0.33, true: 0.33 },
            statsByTime: []
        }
    }
});

const dataset = {
    version: 'synthetic-byleague-1',
    date: '2026-06-11',
    championData: {
        '11': champion('11', 0, 1040),
        '12': champion('12', 1, 1040),
        '13': champion('13', 2, 1040),
        '14': champion('14', 3, 1040),
        '15': champion('15', 4, 1040),
        '21': champion('21', 0, 990),
        '22': champion('22', 1, 990),
        '23': champion('23', 2, 990),
        '24': champion('24', 3, 990),
        '25': champion('25', 4, 990)
    }
};

// ---- records (10 role-complete picks, tournament template seqs) --------------

/** Pick slots of the tournament template: [seq, side, phase, roleOfSlot]. */
const PICK_SLOTS = [
    [7, 'blue', 'pick1', 0],
    [8, 'red', 'pick1', 0],
    [9, 'red', 'pick1', 1],
    [10, 'blue', 'pick1', 1],
    [11, 'blue', 'pick1', 2],
    [12, 'red', 'pick1', 2],
    [17, 'red', 'pick2', 3],
    [18, 'blue', 'pick2', 3],
    [19, 'blue', 'pick2', 4],
    [20, 'red', 'pick2', 4]
];

/**
 * One synthetic record. `mirrored: false` → blue plays 11..15 vs red 21..25;
 * `mirrored: true` swaps the comps (champion keys keep their single role).
 */
function rec({ gameId, league, date, patch, winner, mirrored, series }) {
    const bluePrefix = mirrored ? '2' : '1';
    const redPrefix = mirrored ? '1' : '2';
    const actions = PICK_SLOTS.map(([seq, side, phase, role]) => {
        const key = `${side === 'blue' ? bluePrefix : redPrefix}${role + 1}`;
        return {
            seq,
            type: 'pick',
            phase,
            side,
            championKey: key,
            championName: `Champ${key}`,
            role
        };
    });
    const record = {
        gameId,
        tournament: `Ligue Synthétique ${league.toUpperCase()}`,
        league,
        date,
        patch,
        blueTeam: 'Équipe Azur',
        redTeam: 'Équipe Carmin',
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions,
        warnings: [],
        provenance: { source: 'synthetic', fetchedAt: '2026-06-11T00:00:00Z' }
    };
    if (winner !== undefined) record.winner = winner;
    if (series !== undefined) record.series = series;
    return record;
}

const lck2025 = [
    rec({ gameId: 'LCK25-G1', league: 'lck', date: '2025-01-10', patch: '25.01', winner: 'blue', mirrored: false }),
    rec({ gameId: 'LCK25-G2', league: 'lck', date: '2025-01-12', patch: '25.01', winner: 'red', mirrored: true }),
    rec({ gameId: 'LCK25-G3', league: 'lck', date: '2025-02-10', patch: '25.02', winner: 'blue', mirrored: true }),
    rec({ gameId: 'LCK25-G4', league: 'lck', date: '2025-02-12', patch: '25.02', winner: 'blue', mirrored: false })
];

const lck2026 = [
    rec({
        gameId: 'LCK26-G1', league: 'lck', date: '2026-01-10', patch: '26.01', winner: 'blue',
        mirrored: false, series: { matchId: 'LCK26-M1', gameNumber: 1 }
    }),
    rec({
        gameId: 'LCK26-G2', league: 'lck', date: '2026-01-10', patch: '26.01', winner: 'red',
        mirrored: true, series: { matchId: 'LCK26-M1', gameNumber: 2 }
    }),
    rec({ gameId: 'LCK26-G3', league: 'lck', date: '2026-01-14', patch: '26.01', winner: 'blue', mirrored: false }),
    rec({ gameId: 'LCK26-G4', league: 'lck', date: '2026-01-16', patch: '26.01', winner: 'red', mirrored: false })
];

const lec2026 = [
    rec({ gameId: 'LEC26-G1', league: 'lec', date: '2026-01-11', patch: '26.01', winner: 'blue', mirrored: false }),
    rec({
        gameId: 'LEC26-G2', league: 'lec', date: '2026-01-13', patch: '26.01', winner: 'red',
        mirrored: true, series: { matchId: 'LEC26-M1', gameNumber: 1 }
    }),
    rec({
        gameId: 'LEC26-G3', league: 'lec', date: '2026-01-13', patch: '26.01', winner: 'blue',
        mirrored: false, series: { matchId: 'LEC26-M1', gameNumber: 2 }
    }),
    rec({ gameId: 'LEC26-G4', league: 'lec', date: '2026-01-17', patch: '26.01', winner: 'blue', mirrored: true }),
    // No winner ⇒ NOT eligible — exercises the « écartés » column of the coverage.
    rec({ gameId: 'LEC26-D1', league: 'lec', date: '2026-01-17', patch: '26.01', mirrored: false })
];

const write = (name, value) =>
    writeFileSync(join(here, name), JSON.stringify(value, null, 4) + '\n', 'utf8');

write('dataset.json', dataset);
write('lck-2025.json', lck2025);
write('lck-2026.json', lck2026);
write('lec-2026.json', lec2026);
console.log('Fixtures byLeague écrites (12 éligibles / 13 records, 3 patchs).');
