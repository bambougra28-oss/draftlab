/**
 * G — Diff de corpus (CLI standalone, leçon Nasus) : audite un re-pull.
 *
 * Le pull lec-2026 du 10 juin 2026 a figé des erreurs de saisie wiki sur la
 * finale LEC ; l'API live est corrigée depuis. Avant de remplacer un snapshot
 * gelé par un re-pull, l'architecte doit voir EXACTEMENT ce qui a changé :
 * ce script compare deux fichiers corpus DraftRecord[] champ par champ.
 *
 * Comparaison :
 *  - gameIds ajoutés / retirés (triés, déterministes) ;
 *  - par gameId commun, champs scalaires : winner, patch, date, blueTeam,
 *    redTeam, series.matchId, series.gameNumber, gameLengthSeconds ;
 *  - actions : appariées par `seq` (position canonique 1-20) — une action
 *    diverge si championKey/type/side/role/playerId diffèrent, ou si le seq
 *    n'existe que d'un côté (+seq / -seq) ; on rapporte le NOMBRE d'actions
 *    divergentes par game (et les seq concernés) ;
 *  - résumé agrégé par champ (combien de games touchées) + détail par gameId,
 *    plafonné par --max-detail (défaut 50), trié par gameId.
 *
 * Outil d'AUDIT purement structurel : aucune métrique d'outcome. Exit 0 sauf
 * usage/fichier illisible (le verdict appartient à l'architecte).
 *
 * Run : node --experimental-transform-types --no-warnings scripts/data/diffCorpus.ts \
 *         ancien.json nouveau.json [--max-detail 50]
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type DraftAction = import('../../src/lib/data/types').DraftAction;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

// ---- argv -------------------------------------------------------------------

const positional: string[] = [];
let maxDetail = 50;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--max-detail') maxDetail = Number(argv[++i]);
    else positional.push(argv[i]);
}
if (positional.length !== 2 || !Number.isInteger(maxDetail) || maxDetail < 0) {
    console.error(
        'Usage: node --experimental-transform-types --no-warnings scripts/data/diffCorpus.ts ' +
            'ancien.json nouveau.json [--max-detail 50]'
    );
    process.exit(1);
}
const [oldPath, newPath] = positional;

function loadCorpus(path: string): Map<string, DraftRecord> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'));
    } catch (error) {
        console.error(`Fichier illisible : ${path} — ${(error as Error).message}`);
        process.exit(1);
    }
    if (!Array.isArray(parsed)) {
        console.error(`Fichier malformé : ${path} ne contient pas un tableau DraftRecord[].`);
        process.exit(1);
    }
    const byId = new Map<string, DraftRecord>();
    let duplicates = 0;
    for (const record of parsed as DraftRecord[]) {
        if (byId.has(record.gameId)) duplicates++;
        byId.set(record.gameId, record);
    }
    if (duplicates > 0) {
        console.warn(
            `attention : ${duplicates} gameId dupliqué(s) dans ${path} (dernière occurrence retenue)`
        );
    }
    return byId;
}

// Tri déterministe par unités de code UTF-16 (indépendant de la locale/ICU).
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const fmt = (value: string | number | undefined): string =>
    value === undefined ? '∅' : String(value);

// ---- champs scalaires comparés (ordre d'affichage canonique) -----------------

const SCALAR_FIELDS: ReadonlyArray<
    readonly [string, (r: DraftRecord) => string | number | undefined]
> = [
    ['winner', (r) => r.winner],
    ['patch', (r) => r.patch],
    ['date', (r) => r.date],
    ['blueTeam', (r) => r.blueTeam],
    ['redTeam', (r) => r.redTeam],
    ['series.matchId', (r) => r.series?.matchId],
    ['series.gameNumber', (r) => r.series?.gameNumber],
    ['gameLengthSeconds', (r) => r.gameLengthSeconds]
];

// ---- actions : appariement par seq, divergence sur les sous-champs gelés -----

function actionDivergences(
    oldActions: DraftAction[],
    newActions: DraftAction[]
): { count: number; seqLabels: string[] } {
    const oldBySeq = new Map<number, DraftAction>();
    for (const action of oldActions) oldBySeq.set(action.seq, action);
    const newBySeq = new Map<number, DraftAction>();
    for (const action of newActions) newBySeq.set(action.seq, action);
    const seqs = [...new Set([...oldBySeq.keys(), ...newBySeq.keys()])].sort((a, b) => a - b);
    const seqLabels: string[] = [];
    for (const seq of seqs) {
        const o = oldBySeq.get(seq);
        const n = newBySeq.get(seq);
        if (o === undefined) seqLabels.push(`+seq ${seq}`);
        else if (n === undefined) seqLabels.push(`-seq ${seq}`);
        else if (
            o.championKey !== n.championKey ||
            o.type !== n.type ||
            o.side !== n.side ||
            (o.role ?? '') !== (n.role ?? '') ||
            (o.playerId ?? '') !== (n.playerId ?? '')
        ) {
            seqLabels.push(`seq ${seq}`);
        }
    }
    return { count: seqLabels.length, seqLabels };
}

// ---- diff -------------------------------------------------------------------

const oldById = loadCorpus(oldPath);
const newById = loadCorpus(newPath);

const added = [...newById.keys()].filter((id) => !oldById.has(id)).sort(byCodeUnit);
const removed = [...oldById.keys()].filter((id) => !newById.has(id)).sort(byCodeUnit);
const common = [...oldById.keys()].filter((id) => newById.has(id)).sort(byCodeUnit);

interface GameDiff {
    gameId: string;
    /** Lignes prêtes à imprimer : `champ : avant → après`. */
    lines: string[];
}

const fieldGameCounts = new Map<string, number>();
let actionsTotalDivergences = 0;
const changedGames: GameDiff[] = [];

for (const gameId of common) {
    const oldRecord = oldById.get(gameId)!;
    const newRecord = newById.get(gameId)!;
    const lines: string[] = [];
    for (const [field, pick] of SCALAR_FIELDS) {
        const before = pick(oldRecord);
        const after = pick(newRecord);
        if (before === after) continue;
        lines.push(`${field} : ${fmt(before)} → ${fmt(after)}`);
        fieldGameCounts.set(field, (fieldGameCounts.get(field) ?? 0) + 1);
    }
    const { count, seqLabels } = actionDivergences(oldRecord.actions ?? [], newRecord.actions ?? []);
    if (count > 0) {
        lines.push(`actions : ${count} divergence(s) (${seqLabels.join(', ')})`);
        fieldGameCounts.set('actions', (fieldGameCounts.get('actions') ?? 0) + 1);
        actionsTotalDivergences += count;
    }
    if (lines.length > 0) changedGames.push({ gameId, lines });
}

// ---- rapport ------------------------------------------------------------------

console.log(`Diff corpus : ${oldPath} (${oldById.size} records) → ${newPath} (${newById.size} records)`);

function printIdList(label: string, prefix: string, ids: string[]): void {
    console.log(`\n${label} : ${ids.length}`);
    for (const id of ids.slice(0, maxDetail)) console.log(`  ${prefix} ${id}`);
    if (ids.length > maxDetail) {
        console.log(`  … et ${ids.length - maxDetail} autre(s) (--max-detail ${maxDetail})`);
    }
}

printIdList('Games ajoutées', '+', added);
printIdList('Games retirées', '-', removed);
console.log(`\nGames communes : ${common.length}, dont ${changedGames.length} modifiée(s).`);

console.log('\nRésumé agrégé par champ (games communes modifiées) :');
const summaryOrder = [...SCALAR_FIELDS.map(([field]) => field), 'actions'];
let anyFieldChanged = false;
for (const field of summaryOrder) {
    const count = fieldGameCounts.get(field);
    if (count === undefined) continue;
    anyFieldChanged = true;
    const suffix =
        field === 'actions' ? `, ${actionsTotalDivergences} action(s) divergente(s) au total` : '';
    console.log(`  ${field} : ${count} game(s)${suffix}`);
}
if (!anyFieldChanged) console.log('  aucun champ modifié.');

if (changedGames.length > 0) {
    console.log(`\nDétail par gameId (tri déterministe, --max-detail ${maxDetail}) :`);
    for (const diff of changedGames.slice(0, maxDetail)) {
        console.log(`~ ${diff.gameId}`);
        for (const line of diff.lines) console.log(`    ${line}`);
    }
    if (changedGames.length > maxDetail) {
        console.log(
            `… et ${changedGames.length - maxDetail} autre(s) game(s) modifiée(s) — ` +
                `augmentez --max-detail pour tout voir.`
        );
    }
}
