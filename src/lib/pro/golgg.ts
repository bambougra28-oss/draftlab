/**
 * M2/R1 — gol.gg scraper: pure HTML parsers + best-effort fetchers.
 *
 * PARSING STRATEGY — regex over stable cell-level markers, no DOM parser.
 * gol.gg's markup is structurally malformed (unclosed <tr>/<td> inside the
 * nested draft tables — verified on the 2026-06-10 fixtures), so an HTML5
 * tree-builder "repairs" it in implementation-specific ways: linkedom and a
 * real browser can disagree exactly where the draft data lives. Anchoring on
 * stable markers instead (table captions, champions_icon/<file>.png hrefs,
 * grayscale(1) styling for bans, blueside/redside icons, player-stats/<id>
 * hrefs) is deterministic, identical in node and browser, and keeps linkedom
 * out of the client bundle entirely (it stays a dev-only dependency).
 *
 * Parsing pitfalls inherited from M3.1 (all encoded in tests):
 *  - the side is NEVER read from the "X vs Y" game header (the page's own
 *    team is always listed first there); each draft row self-identifies via
 *    the result cell ("ZYB WIN"/"ZYB LOSS") whose team tag matches exactly
 *    one of the two side-row labels of the nested draft table;
 *  - the draft table renders TWO layouts: a 20-column grid where the cell
 *    index is the true global draft sequence (regular-season games), and a
 *    compact 10-ban-column + appended-picks grid (observed on the 2026
 *    playoff rows). Classifying cells by content (grayscale icon = ban,
 *    colored icon = pick, appearance order = the team's own action order)
 *    is correct for both layouts — positional parsing is exactly what made
 *    the May 2026 scraper swap ban-phase-2 and pick-phase-1 champions;
 *  - picks are in PHASE order, not role order → roles are attributed from
 *    player pools first, then the dataset's primary role, then a leftover
 *    sweep (M3.1 `attributeRoles`);
 *  - dates exist only on the tournament-wide matchlist page, as YYYY-MM-DD
 *    anchored to midnight UTC — lossy for sub-daily ordering, fine for
 *    walk-forward "before this date" filters.
 *
 * Fetchers are best-effort: a failing sub-fetch sets `incomplete: true` and
 * pushes a warning, it never throws. The transport is injectable (proxy in
 * the browser via /api/golgg, direct in node); every fetch goes through a
 * 24h URL-keyed cache (localStorage-backed, quota failures degrade to
 * uncached) and a client-side 1 s rate limit so a team fan-out stays polite.
 */
import { ROLES, type Dataset, type Role } from '$lib/types';
import type {
    ChampionPoolEntry,
    ProPlayer,
    ProTeam,
    RecentDraft,
    TeamSideStats
} from '$lib/pro/types';
import { lookupChampion } from '$lib/pro/championLookup';
import { parseRoleString } from '$lib/data/normalize';
import { readCache, writeCache } from '$lib/dataset/cache';

export const GOLGG_BASE = 'https://gol.gg';
export const GOLGG_CACHE_PREFIX = 'draftlab:golgg:';
export const GOLGG_RATE_LIMIT_MS = 1000;
/** Season slug gol.gg uses for 2026; bump yearly (S15 = 2025, S16 = 2026). */
export const GOLGG_DEFAULT_SEASON = 'S16';
export const GOLGG_USER_AGENT = 'DraftLab/0.1 (local-first draft-prep tool; polite scraper, 1 req/s)';

// ---- URL builders (canonical forms verified against the fixture pages) ----

export function urlTeamList(season: string = GOLGG_DEFAULT_SEASON): string {
    return `${GOLGG_BASE}/teams/list/season-${season}/split-ALL/tournament-ALL/`;
}

export function urlTeamStats(teamId: string): string {
    return `${GOLGG_BASE}/teams/team-stats/${teamId}/split-ALL/tournament-ALL/`;
}

export function urlTeamDraft(teamId: string): string {
    return `${GOLGG_BASE}/teams/team-draft/${teamId}/split-ALL/tournament-ALL/`;
}

export function urlPlayerStats(playerId: string, season: string = GOLGG_DEFAULT_SEASON): string {
    return `${GOLGG_BASE}/players/player-stats/${playerId}/season-${season}/split-ALL/tournament-ALL/champion-ALL/`;
}

export function urlTournamentMatchList(tournament: string): string {
    return `${GOLGG_BASE}/tournament/tournament-matchlist/${encodeURIComponent(tournament)}/`;
}

// ---- small shared helpers ----

/** Minimal entity decoding for the handful gol.gg actually emits in names. */
function decodeEntities(value: string): string {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&#0?39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .trim();
}

/**
 * Champion name from an icon cell. Returns null when the cell holds no icon,
 * '' when gol.gg lost the icon (`champions_icon/` with an empty filename —
 * a real case in the ZYB fixtures, game 74155).
 */
function iconChampionName(cell: string): string | null {
    const m = cell.match(/champions_icon\/([^']*)'/);
    if (!m) return null;
    const file = m[1];
    return file.toLowerCase().endsWith('.png') ? file.slice(0, -4) : file;
}

function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

// ---- parseTeamList ----

export interface TeamListEntry {
    /** gol.gg team id (string form of the numeric path segment). */
    id: string;
    name: string;
    /** Season slug as rendered (e.g. 'S16'). */
    season: string;
    /** gol.gg region code (e.g. 'FR', 'KR'). */
    region: string;
    games: number;
}

/**
 * Row shape: <a href='./team-stats/<id>/...'>Name</a></td> followed by the
 * Season / Region / Games text-center cells. A team name containing a raw
 * apostrophe would break the attribute quoting and drop that row — none in
 * the current season; degradation is one missing team, not a parse failure.
 */
const TEAM_ROW_RE =
    /<a href='[^']*team-stats\/(\d+)\/[^']*'[^>]*>([^<]+)<\/a><\/td><td class='text-center'>([^<]*)<\/td><td class='text-center'>([^<]*)<\/td><td class='text-center'>([^<]*)<\/td>/g;

export function parseTeamList(html: string): TeamListEntry[] {
    const teams: TeamListEntry[] = [];
    for (const m of html.matchAll(TEAM_ROW_RE)) {
        const games = Number.parseInt(m[5], 10);
        teams.push({
            id: m[1],
            name: decodeEntities(m[2]),
            season: m[3].trim(),
            region: m[4].trim(),
            games: Number.isFinite(games) ? games : 0
        });
    }
    return teams;
}

// ---- parseTeamMeta ----

export interface TeamMeta {
    name: string;
    /** Tournaments the team played, most recent first (page select order). */
    tournaments: string[];
}

export function parseTeamMeta(html: string): TeamMeta {
    const h1 = html.match(/<h1[^>]*>([^<]*)<\/h1>/);
    const name = h1 ? decodeEntities(h1[1]) : '';

    const tournaments: string[] = [];
    const selectStart = html.indexOf("id='cbtournament'");
    if (selectStart >= 0) {
        const selectEnd = html.indexOf('</select>', selectStart);
        const section = html.slice(selectStart, selectEnd === -1 ? undefined : selectEnd);
        for (const m of section.matchAll(/<option value='([^']+)'/g)) {
            const value = decodeEntities(m[1]);
            if (value !== 'ALL') tournaments.push(value);
        }
    }
    return { name, tournaments };
}

// ---- parseRoster ----

/**
 * Roster rows live in the "<team> player's stats" table: a role icon+text
 * cell, then the player link. The table may carry a 'Last line-up' header
 * row and a '<em>Subs</em>' separator (ZYB) or list the five mains directly
 * (T1) — everything after the Subs separator is excluded.
 */
const ROSTER_ROW_RE =
    /_img\/role\/[A-Za-z]+\.png'[^>]*>\s*([A-Za-z]+)<\/td><td>(?:<img[^>]*>)?(?:&nbsp;|\s)*<a title='[^']*' href='[^']*player-stats\/(\d+)\/[^']*'>([^<]+)<\/a>/g;

export function parseRoster(html: string): { players: ProPlayer[]; warnings: string[] } {
    const players: ProPlayer[] = [];
    const warnings: string[] = [];

    const capIdx = html.search(/<caption>[^<]*player'?s stats<\/caption>/i);
    const start = capIdx >= 0 ? capIdx : 0;
    const subsIdx = html.indexOf('<em>Subs</em>', start);
    const section = html.slice(start, subsIdx === -1 ? undefined : subsIdx);

    for (const m of section.matchAll(ROSTER_ROW_RE)) {
        const role = parseRoleString(m[1]);
        if (role === undefined) {
            warnings.push(`roster: unknown role "${m[1]}" for player ${m[3]}`);
            continue;
        }
        players.push({ id: m[2], name: decodeEntities(m[3]), role, pool: [] });
    }
    return { players, warnings };
}

// ---- parseSideStats ----

/**
 * Side win rates are not in a table: they live in the JS-embedded `WRData`
 * Chart.js payload — two datasets labelled 'Wins'/'Losses', each with
 * `data : [blue, red]`. Returns null when the block is absent.
 */
export function parseSideStats(html: string): TeamSideStats | null {
    const start = html.indexOf('var WRData');
    if (start === -1) return null;
    const end = html.indexOf('};', start);
    const block = html.slice(start, end === -1 ? undefined : end);

    const series = new Map<string, [number, number]>();
    for (const m of block.matchAll(/label:\s*'(Wins|Losses)'[\s\S]*?data\s*:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/g)) {
        series.set(m[1], [Number.parseInt(m[2], 10), Number.parseInt(m[3], 10)]);
    }
    const wins = series.get('Wins');
    const losses = series.get('Losses');
    if (!wins || !losses) return null;

    return {
        blue: { wins: wins[0], games: wins[0] + losses[0] },
        red: { wins: wins[1], games: wins[1] + losses[1] }
    };
}

// ---- parsePlayerPool ----

/**
 * Champion pool table on the player-stats page. The champion-stats/<id> href
 * uses gol.gg's INTERNAL champion ids (not Data Dragon keys) — resolution
 * goes through the icon alt/filename via lookupChampion instead. Wins are
 * reconstructed from the displayed win-rate percentage (true wins are
 * integers, so rounding games×pct is exact for the displayed precision).
 */
export function parsePlayerPool(html: string): { pool: ChampionPoolEntry[]; warnings: string[] } {
    const pool: ChampionPoolEntry[] = [];
    const warnings: string[] = [];

    const capIdx = html.search(/<caption>[^<]*champion pool\.?<\/caption>/i);
    if (capIdx === -1) {
        return { pool, warnings: ['player pool: champion pool table not found'] };
    }
    const end = html.indexOf('</tbody>', capIdx);
    const section = html.slice(capIdx, end === -1 ? undefined : end);

    const rows = section.split("<tr><td class='align-middle'>").slice(1);
    for (const row of rows) {
        const alt = row.match(/alt='([^']*)'/);
        const name = alt ? decodeEntities(alt[1]) : (iconChampionName(row) ?? '');
        const games = row.match(/<td\s+class='text-center align-middle'>(\d+)<\/td>/);
        const pct = row.match(/line-height:1\.2em'>\s*([\d.]+)%/);
        if (name === '' || !games) {
            warnings.push('player pool: unreadable row skipped');
            continue;
        }
        const key = lookupChampion(name);
        if (key === undefined) {
            warnings.push(`player pool: unmapped champion "${name}"`);
            continue;
        }
        const gamesN = Number.parseInt(games[1], 10);
        const winrate = pct ? Number.parseFloat(pct[1]) : 0;
        pool.push({ championKey: key, games: gamesN, wins: Math.round((gamesN * winrate) / 100) });
    }
    return { pool, warnings };
}

// ---- role attribution (M3.1) ----

/** Role where the dataset has the most games for this champion. */
export function championPrimaryRole(dataset: Dataset, championKey: string): Role | undefined {
    const data = dataset.championData[championKey];
    if (!data) return undefined;
    let best: Role | undefined;
    let bestGames = 0;
    for (const role of ROLES) {
        const games = data.statsByRole[role]?.games ?? 0;
        if (games > bestGames) {
            bestGames = games;
            best = role;
        }
    }
    return best;
}

/**
 * Attribute a role to each picked champion (picks are in PHASE order on
 * gol.gg, never role order): unique pool match first, dataset primary-role
 * fallback second, leftover sweep (remaining roles in Top→Support order)
 * last. Produces unique roles across the (≤5) picks.
 */
export function attributeRoles(
    pickKeys: readonly string[],
    players: readonly ProPlayer[],
    dataset?: Dataset
): (Role | undefined)[] {
    const roles: (Role | undefined)[] = pickKeys.map(() => undefined);
    const taken = new Set<Role>();

    // 1. Unique pool match: exactly one roster member plays this champion.
    pickKeys.forEach((key, i) => {
        const owners = players.filter((p) => p.pool.some((e) => e.championKey === key));
        if (owners.length === 1 && !taken.has(owners[0].role)) {
            roles[i] = owners[0].role;
            taken.add(owners[0].role);
        }
    });

    // 2. Dataset fallback: the champion's primary role, if still free.
    if (dataset) {
        pickKeys.forEach((key, i) => {
            if (roles[i] !== undefined) return;
            const primary = championPrimaryRole(dataset, key);
            if (primary !== undefined && !taken.has(primary)) {
                roles[i] = primary;
                taken.add(primary);
            }
        });
    }

    // 3. Leftover sweep: hand out the remaining roles in canonical order.
    const remaining = ROLES.filter((r) => !taken.has(r));
    let cursor = 0;
    for (let i = 0; i < roles.length; i++) {
        if (roles[i] === undefined && cursor < remaining.length) {
            roles[i] = remaining[cursor];
            cursor += 1;
        }
    }
    return roles;
}

// ---- parseRecentDrafts ----

export interface RecentDraftsOptions {
    /** Roster with pools — enables role attribution on picks. */
    players?: ProPlayer[];
    /** Dataset for the primary-role fallback of the attribution. */
    dataset?: Dataset;
    /** gameId → ISO datetime map from parseTournamentMatchList. */
    gameDates?: ReadonlyMap<string, string>;
}

/** One game row of the team-draft page (label cell, result cell, nested table). */
const GAME_ROW_RE =
    /<a href='[^']*\/game\/stats\/(\d+)\/page-game\/'[^>]*>[^<]*<\/a><\/td><td>[^<]*<\/td><td class='text-center'><span class='text_(victory|defeat)'>([^<]*)<\/span><\/td><td><table>([\s\S]*?)<\/table>/g;

/** A side row inside the nested table: side icon, team tag, then the cells. */
const SIDE_ROW_RE =
    /<td width='100px'><img[^>]*alt='(Blue|Red) Side'[^>]*\/>\s*([^<]*)<\/td>([\s\S]*?)(?=<tr><td width='100px'>|$)/g;

interface ParsedSideRow {
    side: 'blue' | 'red';
    tag: string;
    /** Grayscale icons in appearance order = the team's own ban order. */
    bans: string[];
    /** Colored icons in appearance order = the team's own pick order. */
    picks: string[];
    emptyIcons: number;
}

/**
 * Cells are split on the OPENING `<td>` because gol.gg leaves the last cell
 * of a side row unclosed (`<img .../></tr></table>`) — pair-matching
 * `<td>…</td>` would silently drop the team's fifth pick.
 */
function parseSideRow(side: 'Blue' | 'Red', tag: string, cellsHtml: string): ParsedSideRow {
    const row: ParsedSideRow = {
        side: side === 'Blue' ? 'blue' : 'red',
        tag: tag.trim(),
        bans: [],
        picks: [],
        emptyIcons: 0
    };
    for (const cell of cellsHtml.split('<td>').slice(1)) {
        const name = iconChampionName(cell.split('</td>')[0]);
        if (name === null) continue;
        if (name === '') {
            row.emptyIcons += 1;
            continue;
        }
        if (cell.includes('grayscale')) row.bans.push(name);
        else row.picks.push(name);
    }
    return row;
}

function resolveAll(
    names: readonly string[],
    gameId: string,
    what: 'pick' | 'ban',
    warnings: string[]
): string[] {
    const keys: string[] = [];
    for (const name of names) {
        const key = lookupChampion(name);
        if (key === undefined) {
            warnings.push(`game ${gameId}: unmapped ${what} champion "${name}" skipped`);
            continue;
        }
        keys.push(key);
    }
    return keys;
}

/**
 * Parse the team-draft page into RecentDrafts (most recent first, as listed).
 *
 * Side detection: the result cell always reads "<ourTag> WIN|LOSS" (it is the
 * page team's own result), and exactly one of the two side-row labels carries
 * that tag — the "X vs Y" header is NEVER used (the page team is always
 * listed first there, regardless of side; M3.1 Skillcamp pitfall).
 *
 * Without `players`/`dataset`, pick roles stay undefined (deliberate change
 * from M3.1's pick-order fallback, which fabricated wrong roles: the type
 * marks `role` optional, so absent beats wrong).
 */
export function parseRecentDrafts(
    html: string,
    opts: RecentDraftsOptions = {}
): { drafts: RecentDraft[]; warnings: string[] } {
    const drafts: RecentDraft[] = [];
    const warnings: string[] = [];
    const canAttribute =
        opts.players !== undefined &&
        opts.players.length > 0 &&
        (opts.players.some((p) => p.pool.length > 0) || opts.dataset !== undefined);

    for (const m of html.matchAll(GAME_ROW_RE)) {
        const [, gameId, outcome, resultText, inner] = m;
        const tagMatch = resultText.trim().match(/^(.*\S)\s+(?:WIN|LOSS)$/);
        if (!tagMatch) {
            warnings.push(`game ${gameId}: unrecognized result cell "${resultText.trim()}"`);
            continue;
        }
        const ourTag = tagMatch[1];

        const rows: ParsedSideRow[] = [];
        for (const s of inner.matchAll(SIDE_ROW_RE)) {
            rows.push(parseSideRow(s[1] as 'Blue' | 'Red', s[2], s[3]));
        }
        const ours = rows.find((r) => r.tag === ourTag);
        const enemy = rows.find((r) => r.tag !== ourTag);
        if (rows.length !== 2 || !ours || !enemy) {
            warnings.push(`game ${gameId}: cannot identify team side (tag "${ourTag}")`);
            continue;
        }
        if (ours.emptyIcons > 0) {
            warnings.push(`game ${gameId}: ${ours.emptyIcons} unreadable champion icon(s) skipped`);
        }

        const pickKeys = resolveAll(ours.picks, gameId, 'pick', warnings);
        const banKeys = resolveAll(ours.bans, gameId, 'ban', warnings);
        const roles = canAttribute
            ? attributeRoles(pickKeys, opts.players ?? [], opts.dataset)
            : pickKeys.map(() => undefined);

        const draft: RecentDraft = {
            gameId,
            side: ours.side,
            result: outcome === 'victory' ? 'W' : 'L',
            opponent: enemy.tag,
            picks: pickKeys.map((championKey, i) =>
                roles[i] === undefined ? { championKey } : { championKey, role: roles[i] }
            ),
            bans: banKeys.map((championKey) => ({ championKey }))
        };
        const playedAt = opts.gameDates?.get(gameId);
        if (playedAt !== undefined) draft.playedAt = playedAt;
        drafts.push(draft);
    }
    return { drafts, warnings };
}

// ---- parseTournamentMatchList ----

/**
 * gameId → ISO datetime from the tournament-wide matchlist (the ONLY gol.gg
 * page carrying dates — M3.1). Dates render as date-only YYYY-MM-DD cells;
 * they are anchored to midnight UTC, which is lossy for sub-daily ordering
 * but exact for day-level walk-forward filters. The date is taken from the
 * LAST date-shaped cell of each row, so column insertions don't break it.
 */
export function parseTournamentMatchList(html: string): Map<string, string> {
    const dates = new Map<string, string>();
    for (const row of html.split('<tr>')) {
        const game = row.match(/game\/stats\/(\d+)\/page-game/);
        if (!game) continue;
        const cells = [...row.matchAll(/>(\d{4}-\d{2}-\d{2})</g)];
        if (cells.length === 0) continue;
        dates.set(game[1], `${cells[cells.length - 1][1]}T00:00:00.000Z`);
    }
    return dates;
}

// ---- transports ----

export type Transport = (url: string) => Promise<string>;

/** HTTP failure carrying the status (and Retry-After) for the retry layer. */
export class GolggHttpError extends Error {
    readonly status: number;
    readonly retryAfterMs?: number;

    constructor(message: string, status: number, retryAfterMs?: number) {
        super(message);
        this.name = 'GolggHttpError';
        this.status = status;
        if (retryAfterMs !== undefined) this.retryAfterMs = retryAfterMs;
    }
}

function retryAfterMsOf(res: Response): number | undefined {
    const seconds = Number.parseFloat(res.headers.get('retry-after') ?? '');
    return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : undefined;
}

/** Browser default: same-origin hardened proxy (see /api/golgg). */
export const proxyTransport: Transport = async (url) => {
    const res = await fetch(`/api/golgg?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
        throw new GolggHttpError(
            `golgg proxy fetch failed: ${res.status} (${url})`,
            res.status,
            retryAfterMsOf(res)
        );
    }
    return res.text();
};

/**
 * Node/server-side default (live tests, local scripts). Mirrors the proxy
 * hardening: custom UA, manual redirect refusal. gol.gg blocks datacenter
 * IPs — this transport is for residential/local use only, never CI.
 */
export const directTransport: Transport = async (url) => {
    const res = await fetch(url, {
        redirect: 'manual',
        headers: { 'user-agent': GOLGG_USER_AGENT, accept: 'text/html' }
    });
    if (res.status >= 300 && res.status < 400) {
        throw new GolggHttpError(
            `gol.gg redirect refused: ${res.status} → ${res.headers.get('location') ?? '?'} (${url})`,
            res.status
        );
    }
    if (!res.ok) {
        throw new GolggHttpError(`gol.gg fetch failed: ${res.status} (${url})`, res.status, retryAfterMsOf(res));
    }
    return res.text();
};

// ---- cached, rate-limited fetching ----

/**
 * Mutable token holding the last transport call time (injectable in tests).
 * `tail` is the FIFO serialization chain: concurrent callers (e.g. syncing
 * team A and team B in parallel) acquire turns in order, so the 1 s spacing
 * holds across the UNION of all in-flight fetchers — the naive
 * read-sleep-write pattern raced and burst the proxy's per-IP limit.
 */
export interface GolggRateLimiter {
    lastAt: number;
    tail?: Promise<void>;
}

const sharedLimiter: GolggRateLimiter = { lastAt: 0 };

/** 429 responses are retried (Retry-After honored) before giving up. */
const MAX_429_RETRIES = 3;

/** FIFO turn acquisition: wait for predecessors, then enforce the spacing. */
async function acquireTurn(ctx: FetchContext): Promise<void> {
    const previous = ctx.limiter.tail ?? Promise.resolve();
    let release!: () => void;
    ctx.limiter.tail = new Promise<void>((resolve) => {
        release = resolve;
    });
    await previous;
    try {
        const wait = ctx.limiter.lastAt + GOLGG_RATE_LIMIT_MS - ctx.now();
        if (wait > 0) await ctx.sleep(wait);
        ctx.limiter.lastAt = ctx.now();
    } finally {
        release();
    }
}

export interface GolggFetchOptions {
    transport?: Transport;
    /** Cache backing store; defaults to localStorage when available. */
    storage?: Storage;
    /** Injectable clock (ms). */
    now?: () => number;
    /** Injectable waiter for the client-side rate limit. */
    sleep?: (ms: number) => Promise<void>;
    /** Injectable limiter token (tests isolate themselves with a fresh one). */
    limiter?: GolggRateLimiter;
    season?: string;
    /** League id stamped on the returned ProTeam (caller context, e.g. 'lfl'). */
    league?: string;
    /** Dataset for pick role attribution in fetchTeam. */
    dataset?: Dataset;
    /** Region filter for fetchTeamList (gol.gg code, e.g. 'FR'). */
    region?: string;
}

interface FetchContext {
    transport: Transport;
    storage?: Storage;
    now: () => number;
    sleep: (ms: number) => Promise<void>;
    limiter: GolggRateLimiter;
    season: string;
}

function resolveContext(opts: GolggFetchOptions): FetchContext {
    const ctx: FetchContext = {
        transport:
            opts.transport ?? (typeof window === 'undefined' ? directTransport : proxyTransport),
        now: opts.now ?? Date.now,
        sleep: opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
        limiter: opts.limiter ?? sharedLimiter,
        season: opts.season ?? GOLGG_DEFAULT_SEASON
    };
    if (opts.storage !== undefined) ctx.storage = opts.storage;
    return ctx;
}

/**
 * URL-keyed 24h cache (TTL lives in $lib/dataset/cache) around the transport,
 * with a FIFO-serialized 1 s client-side rate limit between actual transport
 * calls (spacing holds across concurrent fetchers) and a Retry-After-honoring
 * retry on 429. Cache hits consume neither the rate limit nor a retry.
 */
export async function fetchWithCache(url: string, ctx: FetchContext): Promise<string> {
    const key = GOLGG_CACHE_PREFIX + url;
    const cached = readCache<string>(key, ctx.now(), ctx.storage);
    if (cached !== null) return cached;

    let html: string;
    for (let attempt = 0; ; attempt++) {
        await acquireTurn(ctx);
        try {
            html = await ctx.transport(url);
            break;
        } catch (error) {
            const throttled = error instanceof GolggHttpError && error.status === 429;
            if (!throttled || attempt >= MAX_429_RETRIES) throw error;
            const backoff = Math.max(error.retryAfterMs ?? 0, GOLGG_RATE_LIMIT_MS) * (attempt + 1);
            await ctx.sleep(backoff);
        }
    }

    writeCache(key, html, ctx.now(), ctx.storage); // quota failure → uncached, fine
    return html;
}

// ---- fetchers (best-effort, never throw) ----

export async function fetchTeamList(
    opts: GolggFetchOptions = {}
): Promise<{ teams: TeamListEntry[]; warnings: string[] }> {
    const ctx = resolveContext(opts);
    try {
        const html = await fetchWithCache(urlTeamList(ctx.season), ctx);
        let teams = parseTeamList(html);
        if (opts.region !== undefined) teams = teams.filter((t) => t.region === opts.region);
        const warnings = teams.length === 0 ? ['team list: no teams parsed'] : [];
        return { teams, warnings };
    } catch (error) {
        return { teams: [], warnings: [`team list fetch failed: ${describeError(error)}`] };
    }
}

export async function fetchPlayerPool(
    playerId: string,
    opts: GolggFetchOptions = {}
): Promise<{ pool: ChampionPoolEntry[]; warnings: string[] }> {
    const ctx = resolveContext(opts);
    try {
        const html = await fetchWithCache(urlPlayerStats(playerId, ctx.season), ctx);
        return parsePlayerPool(html);
    } catch (error) {
        return { pool: [], warnings: [`player pool fetch failed (${playerId}): ${describeError(error)}`] };
    }
}

/**
 * Full team scrape: team-stats (meta + roster + side stats), one player-stats
 * page per roster member (pools), the tournament matchlists (game dates) and
 * team-draft (recent drafts, roles attributed from the freshly fetched
 * pools). Every sub-fetch is best-effort: a failure pushes a warning and
 * sets `incomplete`, the rest of the team survives.
 */
export async function fetchTeam(teamId: string, opts: GolggFetchOptions = {}): Promise<ProTeam> {
    const ctx = resolveContext(opts);
    const warnings: string[] = [];
    let incomplete = false;

    let name = '';
    let tournaments: string[] = [];
    let players: ProPlayer[] = [];
    let sideStats: TeamSideStats = { blue: { wins: 0, games: 0 }, red: { wins: 0, games: 0 } };

    try {
        const statsHtml = await fetchWithCache(urlTeamStats(teamId), ctx);
        const meta = parseTeamMeta(statsHtml);
        name = meta.name;
        tournaments = meta.tournaments;

        const roster = parseRoster(statsHtml);
        players = roster.players;
        warnings.push(...roster.warnings);
        if (players.length === 0) {
            warnings.push('team page: no roster rows parsed');
            incomplete = true;
        }

        const side = parseSideStats(statsHtml);
        if (side !== null) {
            sideStats = side;
        } else {
            warnings.push('team page: side stats (WRData) not found');
            incomplete = true;
        }
    } catch (error) {
        warnings.push(`team-stats fetch failed: ${describeError(error)}`);
        incomplete = true;
    }

    for (const player of players) {
        try {
            const poolHtml = await fetchWithCache(urlPlayerStats(player.id, ctx.season), ctx);
            const parsed = parsePlayerPool(poolHtml);
            player.pool = parsed.pool;
            warnings.push(...parsed.warnings);
        } catch (error) {
            warnings.push(`player pool fetch failed (${player.name}): ${describeError(error)}`);
            incomplete = true;
        }
    }

    // Dates: merge the matchlists of every tournament the team played this
    // season (the team page is split-ALL, so drafts span several of them).
    const gameDates = new Map<string, string>();
    for (const tournament of tournaments) {
        try {
            const mlHtml = await fetchWithCache(urlTournamentMatchList(tournament), ctx);
            for (const [gameId, iso] of parseTournamentMatchList(mlHtml)) {
                gameDates.set(gameId, iso);
            }
        } catch (error) {
            warnings.push(`matchlist fetch failed ("${tournament}"): ${describeError(error)}`);
            incomplete = true;
        }
    }

    let recentDrafts: RecentDraft[] = [];
    try {
        const draftHtml = await fetchWithCache(urlTeamDraft(teamId), ctx);
        const parseOpts: RecentDraftsOptions = { players, gameDates };
        if (opts.dataset !== undefined) parseOpts.dataset = opts.dataset;
        const parsed = parseRecentDrafts(draftHtml, parseOpts);
        recentDrafts = parsed.drafts;
        warnings.push(...parsed.warnings);
    } catch (error) {
        warnings.push(`team-draft fetch failed: ${describeError(error)}`);
        incomplete = true;
    }

    const team: ProTeam = {
        id: teamId,
        name,
        league: opts.league ?? '',
        players,
        sideStats,
        recentDrafts,
        warnings
    };
    if (tournaments.length > 0) team.tournament = tournaments[0];
    if (incomplete) team.incomplete = true;
    return team;
}
