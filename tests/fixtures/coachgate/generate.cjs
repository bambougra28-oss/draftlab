/**
 * Générateur ONE-OFF des fixtures synthétiques du chantier A (gate coach).
 * Données 100 % synthétiques — aucun rapport avec les corpus réels.
 * Conservé pour relecture : `node tests/fixtures/coachgate/generate.cjs`
 * régénère corpus.json + dataset.json à l'identique (déterministe).
 */
/* eslint-disable @typescript-eslint/no-require-imports -- one-off CJS generator, run via plain node */
const fs = require('fs');
const path = require('path');

// Template tournoi (firstPickSide blue) : interleave per-team columns.
const TEMPLATE = [
    { seq: 1, phase: 'ban1', type: 'ban', first: true, i: 0 },
    { seq: 2, phase: 'ban1', type: 'ban', first: false, i: 0 },
    { seq: 3, phase: 'ban1', type: 'ban', first: true, i: 1 },
    { seq: 4, phase: 'ban1', type: 'ban', first: false, i: 1 },
    { seq: 5, phase: 'ban1', type: 'ban', first: true, i: 2 },
    { seq: 6, phase: 'ban1', type: 'ban', first: false, i: 2 },
    { seq: 7, phase: 'pick1', type: 'pick', first: true, i: 0 },
    { seq: 8, phase: 'pick1', type: 'pick', first: false, i: 0 },
    { seq: 9, phase: 'pick1', type: 'pick', first: false, i: 1 },
    { seq: 10, phase: 'pick1', type: 'pick', first: true, i: 1 },
    { seq: 11, phase: 'pick1', type: 'pick', first: true, i: 2 },
    { seq: 12, phase: 'pick1', type: 'pick', first: false, i: 2 },
    { seq: 13, phase: 'ban2', type: 'ban', first: false, i: 3 },
    { seq: 14, phase: 'ban2', type: 'ban', first: true, i: 3 },
    { seq: 15, phase: 'ban2', type: 'ban', first: false, i: 4 },
    { seq: 16, phase: 'ban2', type: 'ban', first: true, i: 4 },
    { seq: 17, phase: 'pick2', type: 'pick', first: false, i: 3 },
    { seq: 18, phase: 'pick2', type: 'pick', first: true, i: 3 },
    { seq: 19, phase: 'pick2', type: 'pick', first: true, i: 4 },
    { seq: 20, phase: 'pick2', type: 'pick', first: false, i: 4 }
];

function actionsOf(blue, red) {
    const out = [];
    for (const s of TEMPLATE) {
        const side = s.first ? 'blue' : 'red';
        const team = side === 'blue' ? blue : red;
        const key = s.type === 'ban' ? team.bans[s.i] : team.picks[s.i];
        if (key === undefined || key === null) continue; // ban skippé
        out.push({
            seq: s.seq,
            type: s.type,
            phase: s.phase,
            side,
            championKey: key,
            championName: 'Champ' + key
        });
    }
    return out;
}

const PROV = { source: 'fixture', fetchedAt: '2026-06-11T00:00:00Z' };
function rec(gameId, opts) {
    const r = {
        gameId,
        tournament: 'Ligue Synthétique CoachGate',
        league: 'syn',
        date: opts.date,
        patch: opts.patch,
        blueTeam: opts.blueTeam,
        redTeam: opts.redTeam,
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions: actionsOf(opts.blue, opts.red),
        warnings: [],
        provenance: PROV
    };
    if (opts.winner !== undefined) r.winner = opts.winner;
    if (opts.series !== undefined) r.series = opts.series;
    return r;
}

const range = (a, n) => Array.from({ length: n }, (_, i) => String(a + i));

const records = [
    // ---- patch 1.1 : matière de train (premier patch => no-fold) ----
    rec('CG-T1', {
        date: '2026-01-07',
        patch: '1.1',
        blueTeam: 'Azur',
        redTeam: 'Carmin',
        winner: 'blue',
        blue: { picks: ['901', '902', '903', '904', '905'], bans: range(941, 5) },
        red: { picks: ['906', '907', '908', '909', '910'], bans: range(946, 5) }
    }),
    rec('CG-T2', {
        date: '2026-01-08',
        patch: '1.1',
        blueTeam: 'Carmin',
        redTeam: 'Azur',
        winner: 'red',
        blue: { picks: ['911', '912', '913', '914', '915'], bans: range(946, 5) },
        red: { picks: ['901', '902', '903', '916', '917'], bans: range(941, 5) }
    }),
    // ---- patch 1.2 : games testées ----
    rec('CG-G1', {
        date: '2026-02-01',
        patch: '1.2',
        blueTeam: 'Azur',
        redTeam: 'Carmin',
        winner: 'blue',
        series: { gameNumber: 1, matchId: 'SER-1' },
        blue: { picks: range(921, 5), bans: range(951, 5) },
        red: { picks: range(926, 5), bans: range(956, 5) }
    }),
    rec('CG-G2', {
        date: '2026-02-02',
        patch: '1.2',
        blueTeam: 'Carmin',
        redTeam: 'Azur',
        winner: 'blue',
        series: { gameNumber: 2, matchId: 'SER-1' },
        blue: { picks: range(931, 5), bans: range(961, 5) },
        red: { picks: range(936, 5), bans: range(966, 5) }
    }),
    rec('CG-G3', {
        date: '2026-02-03',
        patch: '1.2',
        blueTeam: 'Azur',
        redTeam: 'Topaze',
        winner: 'red',
        blue: { picks: range(921, 5), bans: range(951, 5) },
        red: { picks: range(931, 5), bans: range(961, 5) }
    }),
    rec('CG-G4', {
        date: '2026-02-04',
        patch: '1.2',
        blueTeam: 'Azur',
        redTeam: 'Carmin',
        blue: { picks: range(921, 5), bans: range(951, 5) },
        red: { picks: range(926, 5), bans: range(956, 5) }
    }),
    rec('CG-G5', {
        date: '2026-02-05',
        patch: '1.2',
        blueTeam: 'Azur',
        redTeam: 'Carmin',
        winner: 'blue',
        blue: { picks: range(921, 5), bans: range(951, 5) },
        red: { picks: ['926', '927', '928', '929', ''], bans: range(956, 5) }
    }),
    rec('CG-G6', {
        date: '2026-02-06',
        patch: '1.2',
        blueTeam: 'Carmin',
        redTeam: 'Azur',
        winner: 'red',
        // ban seq 6 (red, index 2 phase 1) skippé => template-mismatch au seq 7.
        blue: { picks: range(936, 5), bans: ['971', '972', '973', '976', '978'] },
        red: { picks: range(926, 5), bans: ['974', '975', null, '977', '979'] }
    }),
    // ---- patch non parseable => no-fold ----
    rec('CG-G7', {
        date: '2026-02-07',
        patch: 'preseason',
        blueTeam: 'Azur',
        redTeam: 'Carmin',
        winner: 'blue',
        blue: { picks: range(921, 5), bans: range(951, 5) },
        red: { picks: range(926, 5), bans: range(956, 5) }
    })
];

// G5 : le pick rouge seq 20 doit être présent mais NON résolu (championKey '').
const g5 = records.find((r) => r.gameId === 'CG-G5');
const a20 = { seq: 20, type: 'pick', phase: 'pick2', side: 'red', championKey: '', championName: 'Inconnu' };
g5.actions = g5.actions
    .filter((a) => a.seq !== 20)
    .concat([a20])
    .sort((x, y) => x.seq - y.seq);

fs.writeFileSync(path.join(__dirname, 'corpus.json'), JSON.stringify(records, null, 4) + '\n');

// ---- dataset synthétique (forme DraftGap minimale) ---------------------------
function champ(key, role, games, wins) {
    const statsByRole = {};
    statsByRole[role] = {
        games,
        wins,
        matchup: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} },
        synergy: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} },
        damageProfile: { magic: 0, physical: 0, true: 0 },
        statsByTime: Array.from({ length: 5 }, () => ({ wins: 0, games: 0 }))
    };
    return { key, name: 'Champ' + key, statsByRole };
}

const championData = {};
const add = (key, role, games, wins) => {
    championData[key] = champ(key, role, games, wins);
};
// Candidats C_t / shipped6 (présence du train) : valeurs distinctes.
add('901', 0, 200, 120);
add('902', 1, 200, 112);
add('903', 2, 200, 104);
add('941', 3, 200, 96);
add('942', 4, 200, 88);
add('943', 0, 200, 80);
// Picks réels des games testées.
[
    ['921', 0, 110], ['922', 1, 108], ['923', 2, 106], ['924', 3, 104], ['925', 4, 102],
    ['926', 0, 90], ['927', 1, 92], ['928', 2, 94], ['929', 3, 96], ['930', 4, 98],
    ['931', 0, 100], ['932', 1, 101], ['933', 2, 102], ['934', 3, 103], ['935', 4, 104],
    ['936', 0, 99], ['937', 1, 98], ['938', 2, 97], ['939', 3, 96], ['940', 4, 95]
].forEach(([k, r, w]) => add(k, r, 200, w));
// Quelques clés de range adverse (cellules du train).
add('906', 0, 200, 100);
add('911', 0, 200, 100);

const dataset = { version: 'fixture-coachgate-1', date: '2026-06-11', championData };
fs.writeFileSync(path.join(__dirname, 'dataset.json'), JSON.stringify(dataset, null, 4) + '\n');
console.log('fixtures écrites :', records.length, 'records,', Object.keys(championData).length, 'champions dataset');
