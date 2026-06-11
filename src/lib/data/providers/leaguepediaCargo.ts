/**
 * R1 — Leaguepedia Cargo provider (PRIMARY draft source, ARCHITECTURE_V2 §5.2).
 *
 * Queries `PicksAndBansS7 ⋈ ScoreboardGames` on GameId through the MediaWiki
 * cargoquery API. Field names were verified against the wiki's CargoDeclare
 * modules (research report 2026-06): Team1 = blue side, picks/bans are listed
 * per team in the order made, `N_GameInMatch` is the fearless game counter.
 *
 * Operational reality (verified live): anonymous queries are rate-limited to
 * roughly one per several minutes — real ingestion REQUIRES a bot-password
 * login (free wiki account). `MwSession` implements the login + cookie flow
 * for node-side scripts; the browser path stays anonymous (origin=*) and is
 * only suitable for single-query refreshes.
 *
 * License: CC BY-SA 3.0 — keep the attribution string in any export.
 */
import type { DraftRecord, DraftSide, TeamDraftColumns } from '../types';
import { buildDraftActions, inFirstSelectionEra } from '../draftRecord';
import { cargoDateTimeToIso, parseRoleString, resolveChampionKey } from '../normalize';

export const LEAGUEPEDIA_API = 'https://lol.fandom.com/api.php';
export const LEAGUEPEDIA_ATTRIBUTION =
    'Data from Leaguepedia (lol.fandom.com), CC BY-SA 3.0';

/** Max rows per cargoquery for non-admin accounts. */
export const CARGO_PAGE_LIMIT = 500;

/** A transport returns parsed JSON for a GET url (injectable for tests). */
export type CargoTransport = (url: string) => Promise<unknown>;

export class CargoError extends Error {
    readonly code: string;

    constructor(message: string, code: string) {
        super(message);
        this.name = 'CargoError';
        this.code = code;
    }
}

export class CargoRateLimitError extends CargoError {
    constructor() {
        super('Leaguepedia rate limit hit — log in with a bot password for real ingestion', 'ratelimited');
        this.name = 'CargoRateLimitError';
    }
}

/** SG-side aliases — the scoreboard columns (carry WHERE/ORDER of the pulls). */
const SG_FIELD_ALIASES: Record<string, string> = {
    'SG.Team1': 'team1',
    'SG.Team2': 'team2',
    'SG.WinTeam': 'winteam',
    'SG.DateTime_UTC': 'dt',
    'SG.Patch': 'patch',
    'SG.Tournament': 'tournament',
    'SG.OverviewPage': 'ovp',
    'SG.Gamelength_Number': 'glen'
};

/** PB-side aliases — the draft table proper (GameId added separately). */
const PB_FIELD_ALIASES: Record<string, string> = {
    'PB.MatchId': 'mid',
    'PB.N_GameInMatch': 'gn',
    'PB.Winner': 'winner'
};
for (let i = 1; i <= 5; i++) {
    PB_FIELD_ALIASES[`PB.Team1Ban${i}`] = `t1b${i}`;
    PB_FIELD_ALIASES[`PB.Team2Ban${i}`] = `t2b${i}`;
    PB_FIELD_ALIASES[`PB.Team1Pick${i}`] = `t1p${i}`;
    PB_FIELD_ALIASES[`PB.Team2Pick${i}`] = `t2p${i}`;
    PB_FIELD_ALIASES[`PB.Team1Role${i}`] = `t1r${i}`;
    PB_FIELD_ALIASES[`PB.Team2Role${i}`] = `t2r${i}`;
}

/** Aliased field list for the joined PB ⋈ SG query. */
const FIELD_ALIASES: Record<string, string> = {
    'PB.GameId': 'gid',
    ...PB_FIELD_ALIASES,
    ...SG_FIELD_ALIASES
};

const fieldsParamOf = (aliases: Record<string, string>): string =>
    Object.entries(aliases)
        .map(([field, alias]) => `${field}=${alias}`)
        .join(',');

/** One raw cargoquery row, keyed by our aliases (all values are strings). */
export type CargoRow = Record<string, string>;

export interface CargoQueryOptions {
    where: string;
    orderBy?: string;
    limit?: number;
    offset?: number;
}

/** Build the full cargoquery GET url for the PB ⋈ SG join. */
export function buildCargoUrl(options: CargoQueryOptions, api: string = LEAGUEPEDIA_API): string {
    const fields = fieldsParamOf(FIELD_ALIASES);
    const params = new URLSearchParams({
        action: 'cargoquery',
        format: 'json',
        origin: '*',
        tables: 'PicksAndBansS7=PB,ScoreboardGames=SG',
        join_on: 'PB.GameId=SG.GameId',
        fields,
        where: options.where,
        limit: String(options.limit ?? CARGO_PAGE_LIMIT),
        offset: String(options.offset ?? 0)
    });
    if (options.orderBy) params.set('order_by', options.orderBy);
    return `${api}?${params.toString()}`;
}

interface CargoResponse {
    cargoquery?: { title: CargoRow }[];
    error?: { code?: string; info?: string };
    warnings?: unknown;
}

function unwrapResponse(payload: unknown): CargoRow[] {
    const res = payload as CargoResponse;
    if (res.error) {
        if (res.error.code === 'ratelimited') throw new CargoRateLimitError();
        throw new CargoError(res.error.info ?? 'cargoquery failed', res.error.code ?? 'unknown');
    }
    return (res.cargoquery ?? []).map((entry) => entry.title);
}

const defaultTransport: CargoTransport = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new CargoError(`HTTP ${res.status} ${res.statusText}`, `http-${res.status}`);
    return res.json();
};

function columnsFor(row: CargoRow, team: 1 | 2): TeamDraftColumns {
    const bans: (string | undefined)[] = [];
    const picks: (string | undefined)[] = [];
    const roles: ReturnType<typeof parseRoleString>[] = [];
    for (let i = 1; i <= 5; i++) {
        bans.push(row[`t${team}b${i}`]);
        picks.push(row[`t${team}p${i}`]);
        roles.push(parseRoleString(row[`t${team}r${i}`]));
    }
    return { bans, picks, roles };
}

/** Map one joined cargo row to a normalized DraftRecord. */
export function rowToDraftRecord(row: CargoRow, fetchedAt: string): DraftRecord {
    const date = cargoDateTimeToIso(row.dt);

    // Team1 = blue side (verified from the PicksAndBansS7 schema docs).
    const blue = columnsFor(row, 1);
    const red = columnsFor(row, 2);

    // Pre-First-Selection the blue side always picked first; in the FS era the
    // interleaving is an assumption until cross-checked (see draftRecord.ts).
    const firstPickSide: DraftSide = 'blue';
    const { actions, warnings } = buildDraftActions({
        blue,
        red,
        firstPickSide,
        resolveKey: resolveChampionKey
    });

    let winner: DraftSide | undefined;
    if (row.winner === '1') winner = 'blue';
    else if (row.winner === '2') winner = 'red';
    else if (row.winteam && row.team1 && row.winteam === row.team1) winner = 'blue';
    else if (row.winteam && row.team2 && row.winteam === row.team2) winner = 'red';

    if (inFirstSelectionEra(date)) {
        warnings.push('first-selection era: pick order assumed blue-first, cross-check pending');
    }

    const gameNumber = Number.parseInt(row.gn ?? '', 10);

    // Gamelength_Number is decimal minutes ("28.5"); store whole seconds.
    const lengthMinutes = Number.parseFloat(row.glen ?? '');
    const gameLengthSeconds = Number.isFinite(lengthMinutes)
        ? Math.round(lengthMinutes * 60)
        : undefined;

    return {
        gameId: row.gid ?? '',
        tournament: row.tournament || row.ovp || undefined,
        date,
        patch: row.patch || undefined,
        blueTeam: row.team1 ?? '',
        redTeam: row.team2 ?? '',
        winner,
        ...(gameLengthSeconds !== undefined ? { gameLengthSeconds } : {}),
        series: Number.isFinite(gameNumber)
            ? { gameNumber, matchId: row.mid || undefined }
            : undefined,
        firstPickSide,
        orderConfidence: 'assumed-blue-first',
        actions,
        warnings,
        provenance: { source: 'leaguepedia', fetchedAt }
    };
}

export interface FetchDraftsOptions {
    transport?: CargoTransport;
    /** Politeness delay between pages, ms (anonymous default 2000; tests 0). */
    pageDelayMs?: number;
    /** Injectable sleeper for tests. */
    sleep?: (ms: number) => Promise<void>;
    /** Injectable clock for provenance. */
    now?: () => string;
    /** Safety cap on pages fetched (500 rows each). */
    maxPages?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Free-form cargoquery (any tables/fields) — enrichment scripts' seam. */
export interface GenericCargoQuery {
    /** e.g. 'ScoreboardPlayers=SP'. */
    tables: string;
    /** Raw aliased field list, e.g. 'SP.GameId=gid,SP.Link=link'. */
    fields: string;
    where: string;
    joinOn?: string;
    orderBy?: string;
}

/**
 * Run a full paginated cargoquery on arbitrary tables and return the raw
 * rows. Same transport/paging/ratelimit semantics as `fetchDraftRecords`.
 */
export async function fetchCargoRows(
    query: GenericCargoQuery,
    options: FetchDraftsOptions = {}
): Promise<CargoRow[]> {
    const transport = options.transport ?? defaultTransport;
    const sleep = options.sleep ?? defaultSleep;
    const delay = options.pageDelayMs ?? 2000;
    const maxPages = options.maxPages ?? 40;

    const rows: CargoRow[] = [];
    for (let page = 0; page < maxPages; page++) {
        const params = new URLSearchParams({
            action: 'cargoquery',
            format: 'json',
            origin: '*',
            tables: query.tables,
            fields: query.fields,
            where: query.where,
            limit: String(CARGO_PAGE_LIMIT),
            offset: String(page * CARGO_PAGE_LIMIT)
        });
        if (query.joinOn) params.set('join_on', query.joinOn);
        if (query.orderBy) params.set('order_by', query.orderBy);
        const pageRows = unwrapResponse(await transport(`${LEAGUEPEDIA_API}?${params.toString()}`));
        rows.push(...pageRows);
        if (pageRows.length < CARGO_PAGE_LIMIT) break;
        if (delay > 0) await sleep(delay);
    }
    return rows;
}

/** Run a full paginated PB ⋈ SG query and normalize every row. */
export async function fetchDraftRecords(
    query: Omit<CargoQueryOptions, 'offset' | 'limit'>,
    options: FetchDraftsOptions = {}
): Promise<DraftRecord[]> {
    const transport = options.transport ?? defaultTransport;
    const sleep = options.sleep ?? defaultSleep;
    const delay = options.pageDelayMs ?? 2000;
    const maxPages = options.maxPages ?? 20;
    const fetchedAt = options.now ? options.now() : new Date().toISOString();

    const records: DraftRecord[] = [];
    for (let page = 0; page < maxPages; page++) {
        const url = buildCargoUrl({ ...query, limit: CARGO_PAGE_LIMIT, offset: page * CARGO_PAGE_LIMIT });
        const rows = unwrapResponse(await transport(url));
        for (const row of rows) records.push(rowToDraftRecord(row, fetchedAt));
        if (rows.length < CARGO_PAGE_LIMIT) break;
        if (delay > 0) await sleep(delay);
    }
    return records;
}

/** GameIds per PicksAndBansS7 `IN (…)` chunk — bounded by URL length (ids are long page names). */
export const SPLIT_GAMEID_CHUNK = 40;

export interface SplitFetchResult {
    records: DraftRecord[];
    /** GameIds with a scoreboard row but no PB row (remakes/forfeits/upstream holes). */
    missingDrafts: string[];
}

/**
 * `fetchDraftRecords` WITHOUT the server-side join — for the windows where
 * Leaguepedia throttles `PB ⋈ SG` (observed 2026-06-10/11: the join is the
 * expensive query; single-table reads stay cheap):
 *   1) page `ScoreboardGames` alone — it carries every WHERE/ORDER column the
 *      pull queries use (OverviewPage, DateTime, teams);
 *   2) read `PicksAndBansS7` alone, `GameId IN (…)` by chunks;
 *   3) join locally and feed the exact merged row shape to `rowToDraftRecord`.
 * The WHERE clause must reference SG.* columns only (the pull scripts' case).
 * Scoreboard order (the injected `orderBy`) is preserved in the output.
 */
export async function fetchDraftRecordsSplit(
    query: Omit<CargoQueryOptions, 'offset' | 'limit'>,
    options: FetchDraftsOptions & { chunkSize?: number } = {}
): Promise<SplitFetchResult> {
    const transport = options.transport ?? defaultTransport;
    const sleep = options.sleep ?? defaultSleep;
    const delay = options.pageDelayMs ?? 2000;
    const maxPages = options.maxPages ?? 20;
    const chunkSize = options.chunkSize ?? SPLIT_GAMEID_CHUNK;
    const fetchedAt = options.now ? options.now() : new Date().toISOString();

    // 1) Scoreboard pages (dedup defensively on paging boundaries).
    const sgByGid = new Map<string, CargoRow>();
    for (let page = 0; page < maxPages; page++) {
        const params = new URLSearchParams({
            action: 'cargoquery',
            format: 'json',
            origin: '*',
            tables: 'ScoreboardGames=SG',
            fields: `SG.GameId=gid,${fieldsParamOf(SG_FIELD_ALIASES)}`,
            where: query.where,
            limit: String(CARGO_PAGE_LIMIT),
            offset: String(page * CARGO_PAGE_LIMIT)
        });
        if (query.orderBy) params.set('order_by', query.orderBy);
        const rows = unwrapResponse(await transport(`${LEAGUEPEDIA_API}?${params.toString()}`));
        for (const row of rows) {
            if (row.gid && !sgByGid.has(row.gid)) sgByGid.set(row.gid, row);
        }
        if (rows.length < CARGO_PAGE_LIMIT) break;
        if (delay > 0) await sleep(delay);
    }

    // 2) Draft rows, GameId IN (…) by chunks (also spaces phase 1 → phase 2).
    const ids = Array.from(sgByGid.keys());
    const pbByGid = new Map<string, CargoRow>();
    for (let i = 0; i < ids.length; i += chunkSize) {
        if (delay > 0) await sleep(delay);
        const inList = ids
            .slice(i, i + chunkSize)
            .map((id) => `'${id.replace(/'/g, "\\'")}'`)
            .join(',');
        const params = new URLSearchParams({
            action: 'cargoquery',
            format: 'json',
            origin: '*',
            tables: 'PicksAndBansS7=PB',
            fields: `PB.GameId=gid,${fieldsParamOf(PB_FIELD_ALIASES)}`,
            where: `PB.GameId IN (${inList})`,
            limit: String(CARGO_PAGE_LIMIT),
            offset: '0'
        });
        const rows = unwrapResponse(await transport(`${LEAGUEPEDIA_API}?${params.toString()}`));
        for (const row of rows) {
            if (row.gid && !pbByGid.has(row.gid)) pbByGid.set(row.gid, row);
        }
    }

    // 3) Local join, scoreboard order preserved.
    const records: DraftRecord[] = [];
    const missingDrafts: string[] = [];
    for (const [gid, sgRow] of sgByGid) {
        const pbRow = pbByGid.get(gid);
        if (!pbRow) {
            missingDrafts.push(gid);
            continue;
        }
        records.push(rowToDraftRecord({ ...sgRow, ...pbRow }, fetchedAt));
    }
    return { records, missingDrafts };
}

/** All drafts of a tournament (Leaguepedia OverviewPage, e.g. "LCK/2026 Season/Rounds 1-2"). */
export function fetchTournamentDrafts(
    overviewPage: string,
    options?: FetchDraftsOptions
): Promise<DraftRecord[]> {
    const safe = overviewPage.replace(/'/g, "\\'");
    return fetchDraftRecords(
        { where: `SG.OverviewPage='${safe}'`, orderBy: 'SG.DateTime_UTC ASC' },
        options
    );
}

/** Recent drafts of a team (either side), newest first. */
export function fetchTeamDrafts(
    teamName: string,
    options?: FetchDraftsOptions & { sinceIsoDate?: string }
): Promise<DraftRecord[]> {
    const safe = teamName.replace(/'/g, "\\'");
    const since = options?.sinceIsoDate
        ? ` AND SG.DateTime_UTC >= '${options.sinceIsoDate.replace(/'/g, "\\'")}'`
        : '';
    return fetchDraftRecords(
        {
            where: `(SG.Team1='${safe}' OR SG.Team2='${safe}')${since}`,
            orderBy: 'SG.DateTime_UTC DESC'
        },
        options
    );
}

// ---- Authenticated session (bot password) — node-side ingestion ----

export interface MwCredentials {
    /** Bot username, e.g. "User@DraftLab". */
    username: string;
    /** Bot password generated at Special:BotPasswords. */
    password: string;
}

/**
 * Minimal MediaWiki login session with manual cookie accumulation, so the
 * corpus scripts can authenticate (fetch keeps no cookie jar in node).
 * Usage: `const t = await MwSession.login(creds); fetchDraftRecords(q, {transport: t.transport})`.
 */
export class MwSession {
    private cookies: string;
    private readonly fetchImpl: typeof fetch;
    readonly api: string;

    private constructor(cookies: string, fetchImpl: typeof fetch, api: string) {
        this.cookies = cookies;
        this.fetchImpl = fetchImpl;
        this.api = api;
    }

    static async login(
        creds: MwCredentials,
        fetchImpl: typeof fetch = fetch,
        api: string = LEAGUEPEDIA_API
    ): Promise<MwSession> {
        // Step 1: obtain a login token (cookies start here).
        const tokenRes = await fetchImpl(`${api}?action=query&meta=tokens&type=login&format=json`);
        const tokenCookies = collectCookies(tokenRes.headers);
        const tokenJson = (await tokenRes.json()) as {
            query?: { tokens?: { logintoken?: string } };
        };
        const loginToken = tokenJson.query?.tokens?.logintoken;
        if (!loginToken) throw new CargoError('no login token returned', 'login-token');

        // Step 2: action=login with the bot password.
        const body = new URLSearchParams({
            action: 'login',
            format: 'json',
            lgname: creds.username,
            lgpassword: creds.password,
            lgtoken: loginToken
        });
        const loginRes = await fetchImpl(api, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Cookie: tokenCookies
            },
            body: body.toString()
        });
        const sessionCookies = mergeCookies(tokenCookies, collectCookies(loginRes.headers));
        const loginJson = (await loginRes.json()) as { login?: { result?: string; reason?: string } };
        if (loginJson.login?.result !== 'Success') {
            throw new CargoError(
                `login failed: ${loginJson.login?.result ?? 'unknown'} ${loginJson.login?.reason ?? ''}`.trim(),
                'login-failed'
            );
        }
        return new MwSession(sessionCookies, fetchImpl, api);
    }

    /** Authenticated transport for `fetchDraftRecords`. */
    get transport(): CargoTransport {
        return async (url: string) => {
            const res = await this.fetchImpl(url, { headers: { Cookie: this.cookies } });
            if (!res.ok) throw new CargoError(`HTTP ${res.status}`, `http-${res.status}`);
            return res.json();
        };
    }
}

function collectCookies(headers: Headers): string {
    const all =
        typeof headers.getSetCookie === 'function'
            ? headers.getSetCookie()
            : ([headers.get('set-cookie')].filter(Boolean) as string[]);
    return all.map((c) => c.split(';')[0]).join('; ');
}

function mergeCookies(a: string, b: string): string {
    const jar = new Map<string, string>();
    for (const part of `${a}; ${b}`.split(';')) {
        const [k, ...rest] = part.trim().split('=');
        if (k && rest.length > 0) jar.set(k, rest.join('='));
    }
    return Array.from(jar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}
