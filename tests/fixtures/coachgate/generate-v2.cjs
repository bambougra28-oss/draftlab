/**
 * Générateur ONE-OFF de la fixture synthétique v2 du chantier A3 (gate coach
 * v2, pools joueurs). Données 100 % synthétiques — aucun rapport avec les
 * corpus réels. `node tests/fixtures/coachgate/generate-v2.cjs` régénère
 * corpus-v2.json à l'identique (déterministe).
 *
 * Même structure que corpus.json (9 records, mêmes gameIds/patchs/équipes —
 * corpus.json reste INTANGIBLE : la porte W2 et le replay `--chain v1` en
 * dépendent byte à byte), PLUS `role` (0..4 = index de pick) et `playerId`
 * sur chaque pick résolu — la matière de la chaîne v2 (`fitPlayerHistory`,
 * `currentLineup`, `fitRolePriors`). Topaze n'apparaît qu'au patch testé :
 * lineup inconnu du train ⇒ chemin de repli présence-15 exercé.
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

/** Joueur synthétique d'une équipe au rôle i : stable à travers tout le corpus. */
const PLAYER_PREFIX = { Azur: 'Az', Carmin: 'Ca', Topaze: 'To' };
const playerOf = (team, i) => `${PLAYER_PREFIX[team]}${i}`;

function actionsOf(blueTeam, redTeam, blue, red) {
    const out = [];
    for (const s of TEMPLATE) {
        const side = s.first ? 'blue' : 'red';
        const team = side === 'blue' ? blue : red;
        const teamName = side === 'blue' ? blueTeam : redTeam;
        const key = s.type === 'ban' ? team.bans[s.i] : team.picks[s.i];
        if (key === undefined || key === null) continue; // ban skippé
        const action = {
            seq: s.seq,
            type: s.type,
            phase: s.phase,
            side,
            championKey: key,
            championName: 'Champ' + key
        };
        if (s.type === 'pick') {
            // Rôle = index de pick (0..4) ; joueur stable par (équipe, rôle).
            action.role = s.i;
            action.playerId = playerOf(teamName, s.i);
        }
        out.push(action);
    }
    return out;
}

const PROV = { source: 'fixture', fetchedAt: '2026-06-11T00:00:00Z' };
function rec(gameId, opts) {
    const r = {
        gameId,
        tournament: 'Ligue Synthétique CoachGate v2',
        league: 'syn',
        date: opts.date,
        patch: opts.patch,
        blueTeam: opts.blueTeam,
        redTeam: opts.redTeam,
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions: actionsOf(opts.blueTeam, opts.redTeam, opts.blue, opts.red),
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

// G5 : le pick rouge seq 20 doit être présent mais NON résolu (championKey '')
// — un pick non résolu ne porte ni rôle ni joueur (convention corpus).
const g5 = records.find((r) => r.gameId === 'CG-G5');
const a20 = { seq: 20, type: 'pick', phase: 'pick2', side: 'red', championKey: '', championName: 'Inconnu' };
g5.actions = g5.actions
    .filter((a) => a.seq !== 20)
    .concat([a20])
    .sort((x, y) => x.seq - y.seq);

fs.writeFileSync(path.join(__dirname, 'corpus-v2.json'), JSON.stringify(records, null, 4) + '\n');
console.log('fixture v2 écrite :', records.length, 'records');
