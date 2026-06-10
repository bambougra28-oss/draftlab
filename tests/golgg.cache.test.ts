/**
 * gol.gg fetch layer: 24h URL-keyed cache, 1 s client-side rate limit, and
 * the best-effort fetchTeam orchestration — all against a Map-backed Storage
 * stub and an injected fake clock/sleeper (no real timers, no network).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    GOLGG_RATE_LIMIT_MS,
    GolggHttpError,
    fetchTeam,
    fetchWithCache,
    urlTeamDraft,
    urlTeamStats,
    type GolggRateLimiter,
    type Transport
} from '$lib/pro/golgg';
import { CACHE_TTL_MS } from '$lib/dataset/cache';

const fixture = (name: string): string =>
    readFileSync(join(process.cwd(), 'tests', 'fixtures', 'golgg', name), 'utf8');

function memoryStorage(): Storage {
    const map = new Map<string, string>();
    return {
        get length() {
            return map.size;
        },
        clear: () => map.clear(),
        getItem: (k: string) => map.get(k) ?? null,
        key: (i: number) => [...map.keys()][i] ?? null,
        removeItem: (k: string) => {
            map.delete(k);
        },
        setItem: (k: string, v: string) => {
            map.set(k, v);
        }
    };
}

/** Fake clock advanced by the fake sleeper — deterministic rate-limit math. */
function fakeTime(start = 1_000_000) {
    let nowMs = start;
    const now = () => nowMs;
    const sleep = vi.fn(async (ms: number) => {
        nowMs += ms;
    });
    const advance = (ms: number) => {
        nowMs += ms;
    };
    return { now, sleep, advance };
}

function ctx(transport: Transport, storage?: Storage, time = fakeTime()) {
    const limiter: GolggRateLimiter = { lastAt: 0 };
    return { transport, storage, now: time.now, sleep: time.sleep, limiter, season: 'S16', time };
}

describe('fetchWithCache', () => {
    it('serves the second call from cache: transport invoked exactly once', async () => {
        const transport = vi.fn(async () => '<html>page</html>');
        const c = ctx(transport, memoryStorage());

        expect(await fetchWithCache('https://gol.gg/x/', c)).toBe('<html>page</html>');
        expect(await fetchWithCache('https://gol.gg/x/', c)).toBe('<html>page</html>');
        expect(transport).toHaveBeenCalledTimes(1);
    });

    it('expired entries (>24h) bypass the cache and refetch', async () => {
        const transport = vi.fn(async () => 'v');
        const time = fakeTime();
        const c = ctx(transport, memoryStorage(), time);

        await fetchWithCache('https://gol.gg/x/', c);
        time.advance(CACHE_TTL_MS + 1); // 24h + 1ms after the write → stale
        await fetchWithCache('https://gol.gg/x/', c);
        expect(transport).toHaveBeenCalledTimes(2);
    });

    it('rate-limits back-to-back uncached calls by exactly 1000 ms', async () => {
        const transport = vi.fn(async () => 'v');
        const time = fakeTime();
        const c = ctx(transport, memoryStorage(), time);

        // Call 1 at t0: limiter.lastAt=0 → wait = 0+1000-1_000_000 < 0 → no sleep.
        await fetchWithCache('https://gol.gg/a/', c);
        expect(time.sleep).not.toHaveBeenCalled();
        // Call 2 still at t0 (clock did not move): wait = t0+1000-t0 = 1000.
        await fetchWithCache('https://gol.gg/b/', c);
        expect(time.sleep).toHaveBeenCalledTimes(1);
        expect(time.sleep).toHaveBeenCalledWith(GOLGG_RATE_LIMIT_MS);
    });

    it('cache hits do not consume the rate limit', async () => {
        const transport = vi.fn(async () => 'v');
        const time = fakeTime();
        const c = ctx(transport, memoryStorage(), time);

        await fetchWithCache('https://gol.gg/a/', c);
        await fetchWithCache('https://gol.gg/a/', c); // cached → no wait, no transport
        expect(time.sleep).not.toHaveBeenCalled();
        expect(transport).toHaveBeenCalledTimes(1);
    });

    it('degrades gracefully when the storage quota is exceeded', async () => {
        const transport = vi.fn(async () => 'big-page');
        const throwing = memoryStorage();
        throwing.setItem = () => {
            throw new Error('QuotaExceededError');
        };
        const c = ctx(transport, throwing);

        expect(await fetchWithCache('https://gol.gg/x/', c)).toBe('big-page');
        // Not cached → second call refetches, still without throwing.
        expect(await fetchWithCache('https://gol.gg/x/', c)).toBe('big-page');
        expect(transport).toHaveBeenCalledTimes(2);
    });
});

describe('fetchWithCache — concurrence (FIFO) et retry 429', () => {
    it('serializes CONCURRENT callers on the shared limiter: FIFO order, one full slot each', async () => {
        // Regression for the field bug: syncing team A and team B in parallel
        // raced the naive read-sleep-write limiter — every caller computed its
        // wait from the same stale lastAt during the synchronous phase, slept
        // ZERO times in this fixture and burst the proxy's per-IP 1 req/s
        // limit (429 cascade). The FIFO chain makes each successor wait one
        // full slot from its predecessor's stamp: exactly two sleep(1000).
        // (Transport-side now() readings are NOT asserted: the fake clock
        // advances instantly inside other callers' sleeps, skewing them —
        // the limiter stamps, which gate the sends, are what's serialized.)
        const order: string[] = [];
        const time = fakeTime();
        const transport: Transport = async (url) => {
            order.push(url);
            return 'v';
        };
        const c = ctx(transport, undefined, time);

        await Promise.all([
            fetchWithCache('https://gol.gg/a/', c),
            fetchWithCache('https://gol.gg/b/', c),
            fetchWithCache('https://gol.gg/c/', c)
        ]);

        expect(order).toEqual(['https://gol.gg/a/', 'https://gol.gg/b/', 'https://gol.gg/c/']);
        // a fires immediately (lastAt=0 far in the past); b and c each wait
        // exactly one full rate-limit slot computed from the FRESH stamp.
        expect(time.sleep.mock.calls).toEqual([[GOLGG_RATE_LIMIT_MS], [GOLGG_RATE_LIMIT_MS]]);
    });

    it('retries a 429 after the Retry-After delay and succeeds', async () => {
        const time = fakeTime();
        let calls = 0;
        const transport: Transport = async (url) => {
            calls++;
            if (calls === 1) {
                throw new GolggHttpError(`golgg proxy fetch failed: 429 (${url})`, 429, 1500);
            }
            return 'recovered';
        };
        const c = ctx(transport, memoryStorage(), time);

        expect(await fetchWithCache('https://gol.gg/x/', c)).toBe('recovered');
        expect(calls).toBe(2);
        // Backoff = max(retryAfterMs 1500, rate limit 1000) × attempt 1.
        expect(time.sleep).toHaveBeenCalledWith(1500);
    });

    it('gives up after MAX retries on a persistent 429 (initial + 3 retries)', async () => {
        const time = fakeTime();
        const transport = vi.fn(async (url: string) => {
            throw new GolggHttpError(`golgg proxy fetch failed: 429 (${url})`, 429, 1000);
        });
        const c = ctx(transport, memoryStorage(), time);

        await expect(fetchWithCache('https://gol.gg/x/', c)).rejects.toBeInstanceOf(GolggHttpError);
        expect(transport).toHaveBeenCalledTimes(4);
    });

    it('does not retry non-429 failures (single transport call)', async () => {
        const transport = vi.fn(async (url: string) => {
            throw new GolggHttpError(`gol.gg fetch failed: 500 (${url})`, 500);
        });
        const c = ctx(transport, memoryStorage());

        await expect(fetchWithCache('https://gol.gg/x/', c)).rejects.toThrow('500');
        expect(transport).toHaveBeenCalledTimes(1);
    });
});

describe('fetchTeam orchestration (fixture-serving stub transport)', () => {
    const teamStatsZyb = fixture('team-stats-zyb.html');
    const teamDraftZyb = fixture('team-draft-zyb.html');
    const playerStatsNisqy = fixture('player-stats-nisqy.html');
    const tournamentMatchList = fixture('tournament-matchlist-lfl-spring-2026.html');

    const stubTransport: Transport = async (url) => {
        if (url === urlTeamStats('2924')) return teamStatsZyb;
        if (url === urlTeamDraft('2924')) return teamDraftZyb;
        if (url.includes('/players/player-stats/')) return playerStatsNisqy;
        if (url.includes('/tournament/tournament-matchlist/')) return tournamentMatchList;
        throw new Error(`unexpected URL ${url}`);
    };

    it('assembles a complete ProTeam (roster+pools+sides+dated drafts), no incomplete flag', async () => {
        const time = fakeTime();
        const team = await fetchTeam('2924', {
            transport: stubTransport,
            now: time.now,
            sleep: time.sleep,
            limiter: { lastAt: 0 },
            league: 'lfl'
        });

        expect(team.name).toBe('ZYB Esport');
        expect(team.league).toBe('lfl');
        expect(team.tournament).toBe('LFL 2026 Spring Playoffs'); // most recent first
        expect(team.players).toHaveLength(5);
        // Every player-stats URL is served the Nisqy fixture → 15-entry pools.
        expect(team.players.every((p) => p.pool.length === 15)).toBe(true);
        expect(team.sideStats).toEqual({ blue: { wins: 4, games: 14 }, red: { wins: 5, games: 12 } });
        expect(team.recentDrafts).toHaveLength(26);
        // Dates flow from the merged tournament matchlists into the drafts.
        const g77034 = team.recentDrafts.find((d) => d.gameId === '77034');
        expect(g77034?.playedAt).toBe('2026-04-23T00:00:00.000Z');
        // Roles are attributed (pools present): full bijection on 5-pick drafts.
        for (const d of team.recentDrafts.filter((x) => x.picks.length === 5)) {
            expect(new Set(d.picks.map((p) => p.role)).size).toBe(5);
        }
        expect(team.incomplete).toBeUndefined();
        // 10 sub-fetches: 1 team-stats + 5 pools + 3 matchlists + 1 team-draft,
        // each rate-limited 1 s apart except the very first → 9 sleeps.
        expect(time.sleep).toHaveBeenCalledTimes(9);
    });

    it('a failing sub-fetch (team-draft 404) yields incomplete:true + warning, rest survives', async () => {
        const failingDraft: Transport = async (url) => {
            if (url === urlTeamDraft('2924')) throw new Error('404 Not Found');
            return stubTransport(url);
        };
        const time = fakeTime();
        const team = await fetchTeam('2924', {
            transport: failingDraft,
            now: time.now,
            sleep: time.sleep,
            limiter: { lastAt: 0 }
        });

        expect(team.incomplete).toBe(true);
        expect(team.warnings.some((w) => w.includes('team-draft fetch failed'))).toBe(true);
        expect(team.recentDrafts).toEqual([]);
        expect(team.players).toHaveLength(5); // the rest of the scrape survived
        expect(team.name).toBe('ZYB Esport');
    });

    it('never throws even when everything is down', async () => {
        const down: Transport = async () => {
            throw new Error('ECONNREFUSED');
        };
        const time = fakeTime();
        const team = await fetchTeam('2924', {
            transport: down,
            now: time.now,
            sleep: time.sleep,
            limiter: { lastAt: 0 }
        });
        expect(team.incomplete).toBe(true);
        expect(team.players).toEqual([]);
        expect(team.warnings.length).toBeGreaterThan(0);
    });

    it('second fetchTeam is fully cache-served (zero new transport calls)', async () => {
        const transport = vi.fn(stubTransport);
        const time = fakeTime();
        const storage = memoryStorage();
        const opts = {
            transport,
            storage,
            now: time.now,
            sleep: time.sleep,
            limiter: { lastAt: 0 },
            league: 'lfl'
        };

        await fetchTeam('2924', opts);
        const calls = transport.mock.calls.length;
        expect(calls).toBe(10);
        const again = await fetchTeam('2924', opts);
        expect(transport.mock.calls.length).toBe(calls); // all 10 pages cached
        expect(again.name).toBe('ZYB Esport');
    });
});
