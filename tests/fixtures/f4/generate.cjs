/**
 * Générateur ONE-OFF des fixtures synthétiques du chantier W2 (runner F4).
 * Données 100 % synthétiques — aucun rapport avec les corpus réels.
 * Conservé pour relecture : `node tests/fixtures/f4/generate.cjs` régénère
 * corpus.json + dataset.json à l'identique (déterministe).
 *
 * Dessin (restriction F4 : seules les games series.gameNumber >= 4 sont
 * scorées ; folds et détecteur Fearless sur le corpus ENTIER, comme A) :
 *  - F4-T1/F4-T2 : patch 1.1, sans série — matière de train (présence top :
 *    901,902,903 puis bans 941-950), exclues par la restriction.
 *  - SER-F4 (Bo5 Azur/Carmin, patch 1.2) : G1-G3 picks 1001-1030 (hors
 *    dataset, jamais évalués — exclus par la restriction mais ils nourrissent
 *    les lockouts Fearless de G4/G5) ; G4 picks 921-930, G5 picks 931-940
 *    (clés du dataset), toutes distinctes => détecteur 0/40 => lockouts ON.
 *  - SER-F5 G4 (Topaze/Quartz, équipes SANS train) : picks 1101-1110, scorée.
 *  - SER-F6 G4 : sans vainqueur => skip no-winner compté côté kept.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- one-off CJS generator, run via plain node */
const fs = require('fs');
const path = require('path');

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
        if (key === undefined || key === null) continue;
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
        tournament: 'Ligue Synthétique F4',
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
    // ---- patch 1.1 : matière de train (sans série => hors restriction F4) ----
    rec('F4-T1', {
        date: '2026-01-07',
        patch: '1.1',
        blueTeam: 'Azur',
        redTeam: 'Carmin',
        winner: 'blue',
        blue: { picks: ['901', '902', '903', '904', '905'], bans: range(941, 5) },
        red: { picks: ['906', '907', '908', '909', '910'], bans: range(946, 5) }
    }),
    rec('F4-T2', {
        date: '2026-01-08',
        patch: '1.1',
        blueTeam: 'Carmin',
        redTeam: 'Azur',
        winner: 'red',
        blue: { picks: ['911', '912', '913', '914', '915'], bans: range(946, 5) },
        red: { picks: ['901', '902', '903', '916', '917'], bans: range(941, 5) }
    }),
    // ---- SER-F4 : Bo5 Azur/Carmin (Azur 3-2) — G1-G3 hors restriction ----
    rec('F4-G1', {
        date: '2026-02-01',
        patch: '1.2',
        blueTeam: 'Azur',
        redTeam: 'Carmin',
        winner: 'blue',
        series: { gameNumber: 1, matchId: 'SER-F4' },
        blue: { picks: range(1001, 5), bans: range(951, 5) },
        red: { picks: range(1006, 5), bans: range(956, 5) }
    }),
    rec('F4-G2', {
        date: '2026-02-01',
        patch: '1.2',
        blueTeam: 'Carmin',
        redTeam: 'Azur',
        winner: 'red',
        series: { gameNumber: 2, matchId: 'SER-F4' },
        blue: { picks: range(1011, 5), bans: range(961, 5) },
        red: { picks: range(1016, 5), bans: range(966, 5) }
    }),
    rec('F4-G3', {
        date: '2026-02-01',
        patch: '1.2',
        blueTeam: 'Azur',
        redTeam: 'Carmin',
        winner: 'red',
        series: { gameNumber: 3, matchId: 'SER-F4' },
        blue: { picks: range(1021, 5), bans: range(951, 5) },
        red: { picks: range(1026, 5), bans: range(956, 5) }
    }),
    // ---- les games SCORÉES par F4 (gameNumber >= 4) ----
    rec('F4-G4', {
        date: '2026-02-01',
        patch: '1.2',
        blueTeam: 'Carmin',
        redTeam: 'Azur',
        winner: 'blue',
        series: { gameNumber: 4, matchId: 'SER-F4' },
        blue: { picks: range(926, 5), bans: range(961, 5) },
        red: { picks: range(921, 5), bans: range(966, 5) }
    }),
    rec('F4-G5', {
        date: '2026-02-01',
        patch: '1.2',
        blueTeam: 'Azur',
        redTeam: 'Carmin',
        winner: 'blue',
        series: { gameNumber: 5, matchId: 'SER-F4' },
        blue: { picks: range(931, 5), bans: range(951, 5) },
        red: { picks: range(936, 5), bans: range(956, 5) }
    }),
    rec('F4-H4', {
        date: '2026-02-02',
        patch: '1.2',
        blueTeam: 'Topaze',
        redTeam: 'Quartz',
        winner: 'red',
        series: { gameNumber: 4, matchId: 'SER-F5' },
        blue: { picks: range(1101, 5), bans: range(951, 5) },
        red: { picks: range(1106, 5), bans: range(956, 5) }
    }),
    // ---- gameNumber 4 sans vainqueur => skip no-winner côté kept ----
    rec('F4-N4', {
        date: '2026-02-03',
        patch: '1.2',
        blueTeam: 'Azur',
        redTeam: 'Carmin',
        series: { gameNumber: 4, matchId: 'SER-F6' },
        blue: { picks: range(1111, 5), bans: range(951, 5) },
        red: { picks: range(1116, 5), bans: range(956, 5) }
    })
];

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
// Picks réels des games scorées (G4 : 921-930, G5 : 931-940).
[
    ['921', 0, 110], ['922', 1, 108], ['923', 2, 106], ['924', 3, 104], ['925', 4, 102],
    ['926', 0, 90], ['927', 1, 92], ['928', 2, 94], ['929', 3, 96], ['930', 4, 98],
    ['931', 0, 100], ['932', 1, 101], ['933', 2, 102], ['934', 3, 103], ['935', 4, 104],
    ['936', 0, 99], ['937', 1, 98], ['938', 2, 97], ['939', 3, 96], ['940', 4, 95]
].forEach(([k, r, w]) => add(k, r, 200, w));
// Picks réels de F4-H4 (SER-F5).
[
    ['1101', 0, 105], ['1102', 1, 103], ['1103', 2, 101], ['1104', 3, 99], ['1105', 4, 97],
    ['1106', 0, 95], ['1107', 1, 97], ['1108', 2, 99], ['1109', 3, 101], ['1110', 4, 103]
].forEach(([k, r, w]) => add(k, r, 200, w));
// Quelques clés de range adverse (cellules du train).
add('906', 0, 200, 100);
add('911', 0, 200, 100);

const dataset = { version: 'fixture-f4-1', date: '2026-06-11', championData };
fs.writeFileSync(path.join(__dirname, 'dataset.json'), JSON.stringify(dataset, null, 4) + '\n');
console.log('fixtures écrites :', records.length, 'records,', Object.keys(championData).length, 'champions dataset');
