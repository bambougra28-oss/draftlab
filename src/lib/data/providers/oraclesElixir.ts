/**
 * R1 — Oracle's Elixir CSV provider (historical backfill + cross-validation).
 *
 * OE ships one CSV per year (2014→present, updated daily): 12 rows per game —
 * 10 player rows + 2 team rows per side. Since Feb 2024 the team rows carry
 * `ban1..5` and `pick1..5` **in the order they were made** (official OE
 * announcement), which is exactly what DraftRecord needs. Player rows supply
 * role + player attribution for each picked champion.
 *
 * The parser is header-name based (column order shifts across years are a
 * documented hazard) and tolerant of missing fields in old seasons.
 * Terms: free, attribute "Oracle's Elixir", non-commercial expectation.
 */
import type { DraftRecord, DraftSide, OrderConfidence, TeamDraftColumns } from '../types';
import { buildDraftActions, inFirstSelectionEra } from '../draftRecord';
import { parseRoleString, resolveChampionKey } from '../normalize';
import type { Role } from '$lib/types';

export const ORACLES_ELIXIR_ATTRIBUTION = "Data from Oracle's Elixir (oracleselixir.com)";

/** Parse CSV text into rows of header-keyed string maps (RFC-4180 quoting). */
export function parseCsv(text: string): Record<string, string>[] {
    const rows: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;

    const pushField = () => {
        row.push(field);
        field = '';
    };
    const pushRow = () => {
        // Ignore fully empty trailing lines.
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
        row = [];
    };

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            pushField();
        } else if (c === '\n') {
            pushField();
            pushRow();
        } else if (c !== '\r') {
            field += c;
        }
    }
    if (field !== '' || row.length > 0) {
        pushField();
        pushRow();
    }

    if (rows.length === 0) return [];
    const header = rows[0].map((h) => h.trim().toLowerCase());
    return rows.slice(1).map((cells) => {
        const obj: Record<string, string> = {};
        header.forEach((h, idx) => {
            obj[h] = cells[idx] ?? '';
        });
        return obj;
    });
}

interface OeTeamRow {
    row: Record<string, string>;
    side: DraftSide;
}

function sideOf(row: Record<string, string>): DraftSide | undefined {
    const s = (row.side ?? '').trim().toLowerCase();
    if (s === 'blue') return 'blue';
    if (s === 'red') return 'red';
    return undefined;
}

function isTeamRow(row: Record<string, string>): boolean {
    return (row.position ?? '').trim().toLowerCase() === 'team';
}

function columnsFromTeamRow(
    teamRow: Record<string, string>,
    playerRows: Record<string, string>[]
): TeamDraftColumns {
    const bans: (string | undefined)[] = [];
    const picks: (string | undefined)[] = [];
    for (let i = 1; i <= 5; i++) {
        bans.push(teamRow[`ban${i}`]);
        picks.push(teamRow[`pick${i}`]);
    }

    // Role/player attribution: match each ordered pick to the player row that
    // played that champion on this side.
    const roles: (Role | undefined)[] = [];
    const players: (string | undefined)[] = [];
    const remaining = [...playerRows];
    for (const pick of picks) {
        const norm = (pick ?? '').trim().toLowerCase();
        const idx = remaining.findIndex(
            (p) => (p.champion ?? '').trim().toLowerCase() === norm && norm !== ''
        );
        if (idx >= 0) {
            const p = remaining.splice(idx, 1)[0];
            roles.push(parseRoleString(p.position));
            players.push(p.playername || p.playerid || undefined);
        } else {
            roles.push(undefined);
            players.push(undefined);
        }
    }
    return { bans, picks, roles, players };
}

/**
 * Convert OE rows (already CSV-parsed) into DraftRecords, one per game.
 * Games missing a side's team row are skipped with no record (logged via
 * the returned `skipped` list).
 */
export function oeRowsToDraftRecords(
    rows: Record<string, string>[],
    fetchedAt: string
): { records: DraftRecord[]; skipped: string[] } {
    const byGame = new Map<string, Record<string, string>[]>();
    for (const row of rows) {
        const id = (row.gameid ?? '').trim();
        if (id === '') continue;
        const bucket = byGame.get(id);
        if (bucket) bucket.push(row);
        else byGame.set(id, [row]);
    }

    const records: DraftRecord[] = [];
    const skipped: string[] = [];

    for (const [gameId, gameRows] of byGame) {
        const teamRows: OeTeamRow[] = [];
        for (const row of gameRows) {
            if (!isTeamRow(row)) continue;
            const side = sideOf(row);
            if (side) teamRows.push({ row, side });
        }
        const blueTeam = teamRows.find((t) => t.side === 'blue');
        const redTeam = teamRows.find((t) => t.side === 'red');
        if (!blueTeam || !redTeam) {
            skipped.push(gameId);
            continue;
        }

        const bluePlayers = gameRows.filter((r) => !isTeamRow(r) && sideOf(r) === 'blue');
        const redPlayers = gameRows.filter((r) => !isTeamRow(r) && sideOf(r) === 'red');

        const date = (blueTeam.row.date ?? '').trim() || undefined;
        // OE carries the real `firstPick` flag (1 on every row of the side that
        // picked first — official since Feb 2024). Use it for an EXACT global
        // pick/ban interleave; fall back to the blue-first assumption only when
        // the column is absent/ambiguous (old seasons).
        const blueFirst = (blueTeam.row.firstpick ?? '').trim() === '1';
        const redFirst = (redTeam.row.firstpick ?? '').trim() === '1';
        let firstPickSide: DraftSide = 'blue';
        let orderConfidence: OrderConfidence = 'assumed-blue-first';
        if (blueFirst !== redFirst) {
            firstPickSide = blueFirst ? 'blue' : 'red';
            orderConfidence = 'exact';
        }

        const { actions, warnings } = buildDraftActions({
            blue: columnsFromTeamRow(blueTeam.row, bluePlayers),
            red: columnsFromTeamRow(redTeam.row, redPlayers),
            firstPickSide,
            resolveKey: resolveChampionKey
        });

        let winner: DraftSide | undefined;
        if ((blueTeam.row.result ?? '') === '1') winner = 'blue';
        else if ((redTeam.row.result ?? '') === '1') winner = 'red';

        if (orderConfidence === 'assumed-blue-first' && inFirstSelectionEra(date)) {
            warnings.push('first-selection era: firstPick flag absent — pick order assumed blue-first');
        }

        const gameNumber = Number.parseInt(blueTeam.row.game ?? '', 10);

        records.push({
            gameId,
            tournament: blueTeam.row.league || undefined,
            league: blueTeam.row.league || undefined,
            date,
            patch: blueTeam.row.patch || undefined,
            blueTeam: blueTeam.row.teamname ?? '',
            redTeam: redTeam.row.teamname ?? '',
            winner,
            series: Number.isFinite(gameNumber) ? { gameNumber } : undefined,
            firstPickSide,
            orderConfidence,
            actions,
            warnings,
            provenance: { source: 'oracles-elixir', fetchedAt }
        });
    }

    return { records, skipped };
}

/** One-call convenience: CSV text → DraftRecords. */
export function parseOraclesElixirCsv(
    csv: string,
    fetchedAt: string = new Date().toISOString()
): { records: DraftRecord[]; skipped: string[] } {
    return oeRowsToDraftRecords(parseCsv(csv), fetchedAt);
}
