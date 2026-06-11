/**
 * Générateur ONE-OFF de la fixture synthétique du chantier W1 (mode
 * --surprise-defense du harnais scripts/backtest/roleInference.ts).
 * Données 100 % synthétiques — aucun rapport avec les corpus réels.
 * Conservé pour relecture : `node tests/fixtures/roleinference/generate.cjs`
 * régénère synthetic.json à l'identique (déterministe).
 *
 * Construction DÉRIVÉE À LA MAIN (voir tests/roleInference.surpriseDefense.test.ts) :
 *  - 4 games train (patch 16.1) : rôles mono-identitaires — AZUR pick toujours
 *    101..105 (Top..Support), ROUGE 201..205 (Top..Support), mêmes slots.
 *  - 1 game test (patch 16.2) qui exerce les TROIS jambes du déclencheur F-c :
 *      · 999 (blue, seq 19) : champion HORS-TRAIN ⇒ bits = −log2(ε) ≈ 9,97 ≥ 5
 *        ET rôle-novelté (compte train (999, r*) = 0) ⇒ SEUL DÉCLENCHEUR (k=5) ;
 *      · 205 (red, seq 12) : déplacé de slot (P10→P6) ⇒ bits ≈ 9,97 mais rôle
 *        CONNU au train (205, Support) = 4 ⇒ alarme SANS déclencheur ;
 *      · 203 (red, seq 20) : cellule P10|red vidée par exclusion (205 déjà
 *        pické) ⇒ range vide, bits ≈ 9,97, rôle connu ⇒ alarme SANS déclencheur ;
 *      · 101/102/103/104/201/202/204 : tendances train fortes ⇒ bits ≤ 1 < 5.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- one-off CJS generator, run via plain node */
const fs = require('fs');
const path = require('path');

// Template tournoi (firstPickSide blue), picks seulement (bans skippés — absents).
const PICK_TEMPLATE = [
    { seq: 7, phase: 'pick1', side: 'blue', i: 0 },
    { seq: 8, phase: 'pick1', side: 'red', i: 0 },
    { seq: 9, phase: 'pick1', side: 'red', i: 1 },
    { seq: 10, phase: 'pick1', side: 'blue', i: 1 },
    { seq: 11, phase: 'pick1', side: 'blue', i: 2 },
    { seq: 12, phase: 'pick1', side: 'red', i: 2 },
    { seq: 17, phase: 'pick2', side: 'red', i: 3 },
    { seq: 18, phase: 'pick2', side: 'blue', i: 3 },
    { seq: 19, phase: 'pick2', side: 'blue', i: 4 },
    { seq: 20, phase: 'pick2', side: 'red', i: 4 }
];

const nameOf = (key) => (key === '999' ? 'Inconnu999' : 'Champ' + key);

function actionsOf(bluePicks, redPicks) {
    return PICK_TEMPLATE.map((slot) => {
        const picks = slot.side === 'blue' ? bluePicks : redPicks;
        const [championKey, role] = picks[slot.i];
        return {
            seq: slot.seq,
            type: 'pick',
            phase: slot.phase,
            side: slot.side,
            championKey,
            championName: nameOf(championKey),
            role
        };
    });
}

const PROV = { source: 'fixture', fetchedAt: '2026-06-11T00:00:00Z' };

function rec(gameId, patch, bluePicks, redPicks) {
    return {
        gameId,
        tournament: 'Ligue Synthétique W1',
        league: 'syn',
        patch,
        blueTeam: 'AZUR',
        redTeam: 'ROUGE',
        winner: 'blue',
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions: actionsOf(bluePicks, redPicks),
        warnings: [],
        provenance: PROV
    };
}

// Train : identités de rôle nettes (chaque champion UN SEUL rôle au fold).
const TRAIN_BLUE = [['101', 0], ['102', 1], ['103', 2], ['104', 3], ['105', 4]];
const TRAIN_RED = [['201', 0], ['202', 1], ['203', 2], ['204', 3], ['205', 4]];

const records = [
    rec('T1', '16.1', TRAIN_BLUE, TRAIN_RED),
    rec('T2', '16.1', TRAIN_BLUE, TRAIN_RED),
    rec('T3', '16.1', TRAIN_BLUE, TRAIN_RED),
    rec('T4', '16.1', TRAIN_BLUE, TRAIN_RED),
    // Game test (fold = les 4 games 16.1) : 999 hors-train (Support réel,
    // lu Support PAR ÉLIMINATION) ; 205 déplacé de slot mais PAS de rôle ;
    // 203 pris en P10 alors que sa cellule de range est vide (205 consommé).
    rec(
        'G-TEST',
        '16.2',
        [['101', 0], ['102', 1], ['103', 2], ['104', 3], ['999', 4]],
        [['201', 0], ['202', 1], ['205', 4], ['204', 3], ['203', 2]]
    )
];

const out = path.join(__dirname, 'synthetic.json');
fs.writeFileSync(out, JSON.stringify(records, null, 4) + '\n', 'utf8');
console.log('Écrit : ' + out + ' (' + records.length + ' records)');
