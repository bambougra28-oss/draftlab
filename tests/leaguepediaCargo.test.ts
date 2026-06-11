import { describe, it, expect, vi } from 'vitest';
import {
    buildCargoUrl,
    fetchDraftRecords,
    fetchDraftRecordsSplit,
    fetchTournamentDrafts,
    fetchTeamDrafts,
    rowToDraftRecord,
    MwSession,
    CargoError,
    CargoRateLimitError,
    CARGO_PAGE_LIMIT,
    type CargoRow,
    type CargoTransport
} from '$lib/data/providers/leaguepediaCargo';
import { Role } from '$lib/types';

/** A realistic joined PB ⋈ SG row (aliased keys), LCK 2025 (pre-FS era). */
function sampleRow(overrides: CargoRow = {}): CargoRow {
    const row: CargoRow = {
        gid: 'LCK/2025 Season/Rounds 1-2_Week 1_1_1',
        mid: 'LCK/2025 Season/Rounds 1-2_Week 1_1',
        gn: '1',
        winner: '1',
        team1: 'T1',
        team2: 'Gen.G',
        winteam: 'T1',
        dt: '2025-01-15 08:30:00',
        patch: '25.01',
        tournament: 'LCK 2025 Rounds 1-2',
        ovp: 'LCK/2025 Season/Rounds 1-2',
        glen: '28.5'
    };
    const t1Bans = ['Yone', 'Akali', 'Vi', 'Poppy', 'Hwei'];
    const t2Bans = ['Rumble', 'Corki', 'Jax', 'Gnar', 'Udyr'];
    const t1Picks = ["Kai'Sa", 'Maokai', 'Aurora', 'Rell', "K'Sante"];
    const t2Picks = ['Varus', 'Sejuani', 'Yasuo', 'Renata Glasc', 'Gragas'];
    const t1Roles = ['Bot', 'Jungle', 'Mid', 'Support', 'Top'];
    const t2Roles = ['Bot', 'Jungle', 'Mid', 'Support', 'Top'];
    for (let i = 1; i <= 5; i++) {
        row[`t1b${i}`] = t1Bans[i - 1];
        row[`t2b${i}`] = t2Bans[i - 1];
        row[`t1p${i}`] = t1Picks[i - 1];
        row[`t2p${i}`] = t2Picks[i - 1];
        row[`t1r${i}`] = t1Roles[i - 1];
        row[`t2r${i}`] = t2Roles[i - 1];
    }
    return { ...row, ...overrides };
}

const wrap = (rows: CargoRow[]) => ({ cargoquery: rows.map((r) => ({ title: r })) });

describe('buildCargoUrl', () => {
    it('targets the joined PB ⋈ SG query with aliased fields and CORS', () => {
        const url = buildCargoUrl({ where: "SG.OverviewPage='LCK/2026'", orderBy: 'SG.DateTime_UTC ASC' });
        const u = new URL(url);
        expect(u.origin + u.pathname).toBe('https://lol.fandom.com/api.php');
        expect(u.searchParams.get('action')).toBe('cargoquery');
        expect(u.searchParams.get('origin')).toBe('*');
        expect(u.searchParams.get('tables')).toBe('PicksAndBansS7=PB,ScoreboardGames=SG');
        expect(u.searchParams.get('join_on')).toBe('PB.GameId=SG.GameId');
        expect(u.searchParams.get('where')).toBe("SG.OverviewPage='LCK/2026'");
        expect(u.searchParams.get('order_by')).toBe('SG.DateTime_UTC ASC');
        const fields = u.searchParams.get('fields') ?? '';
        expect(fields).toContain('PB.Team1Pick5=t1p5');
        expect(fields).toContain('PB.Team2Role3=t2r3');
        expect(fields).toContain('SG.DateTime_UTC=dt');
    });
});

describe('rowToDraftRecord', () => {
    const record = rowToDraftRecord(sampleRow(), '2026-06-10T12:00:00Z');

    it('maps identity, series and provenance', () => {
        expect(record.gameId).toBe('LCK/2025 Season/Rounds 1-2_Week 1_1_1');
        expect(record.blueTeam).toBe('T1');
        expect(record.redTeam).toBe('Gen.G');
        expect(record.winner).toBe('blue');
        expect(record.date).toBe('2025-01-15T08:30:00Z');
        expect(record.patch).toBe('25.01');
        expect(record.gameLengthSeconds).toBe(1710); // 28.5 min

        expect(record.series).toEqual({
            gameNumber: 1,
            matchId: 'LCK/2025 Season/Rounds 1-2_Week 1_1'
        });
        expect(record.provenance).toEqual({ source: 'leaguepedia', fetchedAt: '2026-06-10T12:00:00Z' });
        expect(record.orderConfidence).toBe('assumed-blue-first');
    });

    it('reconstructs the full 20-action sequence', () => {
        expect(record.actions).toHaveLength(20);
        const bySeq = new Map(record.actions.map((a) => [a.seq, a]));
        expect(bySeq.get(1)).toMatchObject({ side: 'blue', type: 'ban', championName: 'Yone' });
        expect(bySeq.get(2)).toMatchObject({ side: 'red', type: 'ban', championName: 'Rumble' });
        expect(bySeq.get(7)).toMatchObject({ side: 'blue', type: 'pick', championName: "Kai'Sa" });
        expect(bySeq.get(8)).toMatchObject({ side: 'red', championName: 'Varus' });
        expect(bySeq.get(9)).toMatchObject({ side: 'red', championName: 'Sejuani' });
        expect(bySeq.get(10)).toMatchObject({ side: 'blue', championName: 'Maokai' });
        expect(bySeq.get(17)).toMatchObject({ side: 'red', championName: 'Renata Glasc' });
        expect(bySeq.get(20)).toMatchObject({ side: 'red', championName: 'Gragas' });
    });

    it('resolves champion names to Data Dragon keys through the tag lookup', () => {
        const kaisa = record.actions.find((a) => a.championName === "Kai'Sa");
        expect(kaisa?.championKey).toBe('145');
        const renata = record.actions.find((a) => a.championName === 'Renata Glasc');
        expect(renata?.championKey).not.toBe('');
        expect(record.warnings.filter((w) => w.includes('unresolved'))).toHaveLength(0);
    });

    it('attaches roles from TeamNRoleK to the matching pick', () => {
        const kaisa = record.actions.find((a) => a.championName === "Kai'Sa");
        expect(kaisa?.role).toBe(Role.Bottom);
        const ksante = record.actions.find((a) => a.championName === "K'Sante");
        expect(ksante?.role).toBe(Role.Top);
    });

    it('has no First Selection warning for pre-2026 games', () => {
        expect(record.warnings.some((w) => w.includes('first-selection'))).toBe(false);
    });

    it('adds the First Selection warning for 2026+ games', () => {
        const r2026 = rowToDraftRecord(sampleRow({ dt: '2026-02-01 10:00:00' }), 'now');
        expect(r2026.warnings.some((w) => w.includes('first-selection era'))).toBe(true);
    });

    it('falls back to WinTeam name when Winner index is missing', () => {
        const r = rowToDraftRecord(sampleRow({ winner: '', winteam: 'Gen.G' }), 'now');
        expect(r.winner).toBe('red');
    });
});

describe('fetchDraftRecords — pagination & errors', () => {
    it('paginates with the politeness delay until a short page', async () => {
        const calls: string[] = [];
        const fullPage = wrap(Array.from({ length: CARGO_PAGE_LIMIT }, () => sampleRow()));
        const lastPage = wrap([sampleRow()]);
        const transport: CargoTransport = async (url) => {
            calls.push(url);
            return calls.length === 1 ? fullPage : lastPage;
        };
        const sleep = vi.fn(async () => {});
        const records = await fetchDraftRecords(
            { where: "SG.OverviewPage='X'" },
            { transport, sleep, pageDelayMs: 2000, now: () => 'now' }
        );
        expect(records).toHaveLength(CARGO_PAGE_LIMIT + 1);
        expect(calls).toHaveLength(2);
        expect(new URL(calls[0]).searchParams.get('offset')).toBe('0');
        expect(new URL(calls[1]).searchParams.get('offset')).toBe(String(CARGO_PAGE_LIMIT));
        expect(sleep).toHaveBeenCalledTimes(1);
    });

    it('throws a typed rate-limit error', async () => {
        const transport: CargoTransport = async () => ({
            error: { code: 'ratelimited', info: 'slow down' }
        });
        await expect(
            fetchDraftRecords({ where: 'x' }, { transport })
        ).rejects.toBeInstanceOf(CargoRateLimitError);
    });

    it('throws a CargoError with the upstream code otherwise', async () => {
        const transport: CargoTransport = async () => ({
            error: { code: 'badvalue', info: 'no such field' }
        });
        const err = await fetchDraftRecords({ where: 'x' }, { transport }).catch((e) => e);
        expect(err).toBeInstanceOf(CargoError);
        expect((err as CargoError).code).toBe('badvalue');
    });
});

describe('fetchDraftRecordsSplit — no-join fallback', () => {
    /** Keys served by the SG-only query (plus gid). */
    const SG_KEYS = ['team1', 'team2', 'winteam', 'dt', 'patch', 'tournament', 'ovp', 'glen'];

    function sgSideRow(gid: string): CargoRow {
        const full = sampleRow();
        const row: CargoRow = { gid };
        for (const k of SG_KEYS) row[k] = full[k];
        return row;
    }

    function pbSideRow(gid: string): CargoRow {
        const row = sampleRow({ gid });
        for (const k of SG_KEYS) delete row[k];
        return row;
    }

    it('queries SG alone, then PB by GameId IN chunks, joins locally in SG order', async () => {
        const calls: string[] = [];
        const transport: CargoTransport = async (url) => {
            calls.push(url);
            if (calls.length === 1) return wrap([sgSideRow('g1'), sgSideRow('g2'), sgSideRow('g3')]);
            if (calls.length === 2) return wrap([pbSideRow('g1')]); // g2: trou PB amont
            return wrap([pbSideRow('g3')]);
        };
        const sleep = vi.fn(async () => {});
        const { records, missingDrafts } = await fetchDraftRecordsSplit(
            { where: "SG.OverviewPage LIKE 'LCK/2025%'", orderBy: 'SG.DateTime_UTC ASC' },
            { transport, sleep, pageDelayMs: 2000, chunkSize: 2, now: () => 'now' }
        );

        expect(calls).toHaveLength(3);
        const u1 = new URL(calls[0]);
        expect(u1.searchParams.get('tables')).toBe('ScoreboardGames=SG');
        expect(u1.searchParams.get('join_on')).toBeNull();
        expect(u1.searchParams.get('where')).toBe("SG.OverviewPage LIKE 'LCK/2025%'");
        expect(u1.searchParams.get('order_by')).toBe('SG.DateTime_UTC ASC');
        expect(u1.searchParams.get('fields')).toContain('SG.GameId=gid');
        expect(u1.searchParams.get('fields')).not.toContain('PB.');

        const u2 = new URL(calls[1]);
        expect(u2.searchParams.get('tables')).toBe('PicksAndBansS7=PB');
        expect(u2.searchParams.get('where')).toBe("PB.GameId IN ('g1','g2')");
        expect(u2.searchParams.get('fields')).toContain('PB.Team2Role3=t2r3');
        expect(u2.searchParams.get('fields')).not.toContain('SG.');
        expect(new URL(calls[2]).searchParams.get('where')).toBe("PB.GameId IN ('g3')");

        // Jointure locale : ordre SG conservé, champs des deux moitiés fusionnés.
        expect(records.map((r) => r.gameId)).toEqual(['g1', 'g3']);
        expect(records[0].blueTeam).toBe('T1'); // moitié SG
        expect(records[0].actions).toHaveLength(20); // moitié PB
        expect(records[0].series?.gameNumber).toBe(1);
        expect(missingDrafts).toEqual(['g2']);
        // 0 sleep après la page SG courte ; 1 avant chaque chunk PB.
        expect(sleep).toHaveBeenCalledTimes(2);
    });

    it('escapes quotes inside the IN clause', async () => {
        const calls: string[] = [];
        const transport: CargoTransport = async (url) => {
            calls.push(url);
            return calls.length === 1 ? wrap([sgSideRow("g'1")]) : wrap([pbSideRow("g'1")]);
        };
        const { records } = await fetchDraftRecordsSplit(
            { where: 'x' },
            { transport, sleep: async () => {}, now: () => 'now' }
        );
        expect(new URL(calls[1]).searchParams.get('where')).toBe("PB.GameId IN ('g\\'1')");
        expect(records).toHaveLength(1);
    });

    it('propagates the typed rate-limit error', async () => {
        const transport: CargoTransport = async () => ({
            error: { code: 'ratelimited', info: 'slow down' }
        });
        await expect(
            fetchDraftRecordsSplit({ where: 'x' }, { transport })
        ).rejects.toBeInstanceOf(CargoRateLimitError);
    });
});

describe('query helpers', () => {
    it('fetchTournamentDrafts scopes on OverviewPage and escapes quotes', async () => {
        const calls: string[] = [];
        const transport: CargoTransport = async (url) => {
            calls.push(url);
            return wrap([]);
        };
        await fetchTournamentDrafts("LCK/2026 Season/Rounds 1-2", { transport });
        expect(new URL(calls[0]).searchParams.get('where')).toBe(
            "SG.OverviewPage='LCK/2026 Season/Rounds 1-2'"
        );
    });

    it('fetchTeamDrafts matches either side, newest first, with a since filter', async () => {
        const calls: string[] = [];
        const transport: CargoTransport = async (url) => {
            calls.push(url);
            return wrap([]);
        };
        await fetchTeamDrafts("Vitality.Bee's", { transport, sinceIsoDate: '2026-01-01' });
        const u = new URL(calls[0]);
        expect(u.searchParams.get('where')).toBe(
            "(SG.Team1='Vitality.Bee\\'s' OR SG.Team2='Vitality.Bee\\'s') AND SG.DateTime_UTC >= '2026-01-01'"
        );
        expect(u.searchParams.get('order_by')).toBe('SG.DateTime_UTC DESC');
    });
});

describe('MwSession (bot-password login)', () => {
    function jsonResponse(payload: unknown, cookies: string[] = []): Response {
        const headers = new Headers();
        for (const c of cookies) headers.append('set-cookie', c);
        return { ok: true, headers, json: async () => payload } as unknown as Response;
    }

    it('logs in and threads session cookies into the transport', async () => {
        const seen: { url: string; init?: RequestInit }[] = [];
        const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
            seen.push({ url: String(url), init });
            if (seen.length === 1) {
                return jsonResponse(
                    { query: { tokens: { logintoken: 'TOK' } } },
                    ['session=abc; Path=/; HttpOnly']
                );
            }
            if (seen.length === 2) {
                return jsonResponse({ login: { result: 'Success' } }, ['auth=xyz; Path=/']);
            }
            return jsonResponse(wrap([sampleRow()]));
        }) as unknown as typeof fetch;

        const session = await MwSession.login({ username: 'U@bot', password: 'pw' }, fetchImpl);
        const rows = (await session.transport('https://lol.fandom.com/api.php?x=1')) as {
            cargoquery: unknown[];
        };
        expect(rows.cargoquery).toHaveLength(1);

        // Login POST carried the token + cookies from step 1.
        const loginCall = seen[1];
        expect(String(loginCall.init?.body)).toContain('lgtoken=TOK');
        expect((loginCall.init?.headers as Record<string, string>).Cookie).toContain('session=abc');
        // Subsequent GET carries the merged cookie jar.
        const dataCall = seen[2];
        expect((dataCall.init?.headers as Record<string, string>).Cookie).toContain('auth=xyz');
        expect((dataCall.init?.headers as Record<string, string>).Cookie).toContain('session=abc');
    });

    it('throws a typed error on a failed login', async () => {
        const fetchImpl = (async (url: string | URL) => {
            if (String(url).includes('meta=tokens')) {
                return jsonResponse({ query: { tokens: { logintoken: 'TOK' } } }, ['s=1']);
            }
            return jsonResponse({ login: { result: 'Failed', reason: 'wrong password' } });
        }) as unknown as typeof fetch;
        const err = await MwSession.login({ username: 'U', password: 'bad' }, fetchImpl).catch((e) => e);
        expect(err).toBeInstanceOf(CargoError);
        expect((err as CargoError).code).toBe('login-failed');
    });
});
