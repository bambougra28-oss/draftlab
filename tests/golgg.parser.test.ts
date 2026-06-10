/**
 * gol.gg parser tests against the 9 committed fixtures (captured 2026-06-10).
 *
 * Every expected value below was read BY HAND from the fixture HTML (Grep /
 * substring inspection of the raw pages), then cross-validated where two
 * pages overlap (e.g. WRData side games vs the teams-list games column, and
 * vs the per-side count of parsed draft rows). M2_PING1_ZYB.json is a SHAPE
 * reference only — its values date from May 2026 and its parser had a
 * positional bug (ban-phase-2/pick-phase-1 swap) that these fixtures expose.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    attributeRoles,
    championPrimaryRole,
    parsePlayerPool,
    parseRecentDrafts,
    parseRoster,
    parseSideStats,
    parseTeamList,
    parseTeamMeta,
    parseTournamentMatchList,
    urlPlayerStats,
    urlTournamentMatchList
} from '$lib/pro/golgg';
import type { ProPlayer } from '$lib/pro/types';
import { Role, defaultChampionRoleData, type Dataset } from '$lib/types';

const fixture = (name: string): string =>
    readFileSync(join(process.cwd(), 'tests', 'fixtures', 'golgg', name), 'utf8');

const teamsList = fixture('teams-list-S16.html');
const teamStatsZyb = fixture('team-stats-zyb.html');
const teamStatsT1 = fixture('team-stats-t1.html');
const teamDraftZyb = fixture('team-draft-zyb.html');
const playerStatsNisqy = fixture('player-stats-nisqy.html');
const tournamentMatchList = fixture('tournament-matchlist-lfl-spring-2026.html');

describe('parseTeamList (S16 season list)', () => {
    const teams = parseTeamList(teamsList);

    it('parses all 292 team rows (hand count of ./team-stats/<id>/ row anchors)', () => {
        expect(teams).toHaveLength(292);
    });

    it('parses the ZYB row exactly as rendered (id 2924, FR, 26 games)', () => {
        const zyb = teams.find((t) => t.id === '2924');
        expect(zyb).toEqual({ id: '2924', name: 'ZYB Esport', season: 'S16', region: 'FR', games: 26 });
    });

    it('parses the T1 row (id 2809, KR, 89 games)', () => {
        const t1 = teams.find((t) => t.id === '2809');
        expect(t1).toEqual({ id: '2809', name: 'T1', season: 'S16', region: 'KR', games: 89 });
    });

    it('region filter material: exactly 21 FR teams on the page (hand count)', () => {
        expect(teams.filter((t) => t.region === 'FR')).toHaveLength(21);
    });
});

describe('parseTeamMeta', () => {
    it('reads the h1 name and the tournament select, most recent first (ZYB)', () => {
        // Hand-read from the cbtournament <select>: ALL is skipped, then
        // Playoffs / Spring Split / Invitational in page order.
        expect(parseTeamMeta(teamStatsZyb)).toEqual({
            name: 'ZYB Esport',
            tournaments: ['LFL 2026 Spring Playoffs', 'LFL 2026 Spring Split', 'LFL 2026 Invitational']
        });
    });

    it('reads the T1 page (4 tournaments after skipping ALL)', () => {
        const meta = parseTeamMeta(teamStatsT1);
        expect(meta.name).toBe('T1');
        expect(meta.tournaments).toEqual([
            'EWC 2026 Online Qualifier - Korea',
            'LCK 2026 Rounds 1-2',
            'LCK Cup 2026',
            'Kespa Cup 2025'
        ]);
    });
});

describe('parseRoster', () => {
    it('parses the 5 ZYB mains with ids/roles and excludes the 3 Subs rows', () => {
        // Hand-read hrefs: Wao 4981 TOP, Manaty 2048 JUNGLE, Nisqy 873 MID,
        // Jezu 2678 BOT (ADC icon, BOT text), Riippp 6710 SUPPORT. The Subs
        // section lists H1ro 4111, Sleyer 4909, Stend 4008 — all excluded.
        const { players, warnings } = parseRoster(teamStatsZyb);
        expect(warnings).toEqual([]);
        expect(players).toEqual([
            { id: '4981', name: 'Wao', role: Role.Top, pool: [] },
            { id: '2048', name: 'Manaty', role: Role.Jungle, pool: [] },
            { id: '873', name: 'Nisqy', role: Role.Middle, pool: [] },
            { id: '2678', name: 'Jezu', role: Role.Bottom, pool: [] },
            { id: '6710', name: 'Riippp', role: Role.Support, pool: [] }
        ]);
    });

    it('parses a roster without Last line-up/Subs separators (T1)', () => {
        const { players } = parseRoster(teamStatsT1);
        expect(players.map((p) => [p.id, p.name, p.role])).toEqual([
            ['1242', 'Doran', Role.Top],
            ['3741', 'Oner', Role.Jungle],
            ['48', 'Faker', Role.Middle],
            ['4247', 'Peyz', Role.Bottom],
            ['1258', 'Keria', Role.Support]
        ]);
    });
});

describe('parseSideStats (JS-embedded WRData)', () => {
    it('ZYB: wins [4,5] / losses [10,7] → blue 4W/14, red 5W/12', () => {
        // Cross-check: 14+12 = 26 games and (4+5)/26 = 34.6%, both matching
        // the ZYB row of the teams-list page.
        expect(parseSideStats(teamStatsZyb)).toEqual({
            blue: { wins: 4, games: 14 },
            red: { wins: 5, games: 12 }
        });
    });

    it('T1: wins [32,31] / losses [12,14] → blue 32W/44, red 31W/45', () => {
        // Cross-check: 44+45 = 89 games and 63/89 = 70.8% per the teams list.
        expect(parseSideStats(teamStatsT1)).toEqual({
            blue: { wins: 32, games: 44 },
            red: { wins: 31, games: 45 }
        });
    });

    it('returns null when the WRData block is absent', () => {
        expect(parseSideStats('<html><body>no charts here</body></html>')).toBeNull();
    });
});

describe('parsePlayerPool (Nisqy, S16 split-ALL)', () => {
    const { pool, warnings } = parsePlayerPool(playerStatsNisqy);

    it('parses the 15 pool rows totalling 26 games (hand count)', () => {
        expect(pool).toHaveLength(15);
        expect(pool.reduce((sum, e) => sum + e.games, 0)).toBe(26);
    });

    it('reconstructs wins from the displayed winrate (Ryze 5g×40%=2, Azir 4g×25%=1)', () => {
        // First two rows of the table, in page order (games desc).
        expect(pool[0]).toEqual({ championKey: '13', games: 5, wins: 2 });
        expect(pool[1]).toEqual({ championKey: '268', games: 4, wins: 1 });
    });

    it('handles 100% rows and the "-" (perfect) KDA cell (Ahri 2g×100%, Anivia 1g×100%)', () => {
        expect(pool).toContainEqual({ championKey: '103', games: 2, wins: 2 });
        expect(pool).toContainEqual({ championKey: '34', games: 1, wins: 1 });
    });

    it('maps every champion through the lookup with zero warnings', () => {
        expect(warnings).toEqual([]);
        // gol.gg's champion-stats/<id> hrefs are INTERNAL ids (Ryze renders
        // as 76) — the parser must resolve via alt/icon name instead: Ryze=13.
        expect(pool.every((e) => /^\d+$/.test(e.championKey))).toBe(true);
    });
});

describe('parseRecentDrafts (ZYB team-draft page)', () => {
    const { drafts, warnings } = parseRecentDrafts(teamDraftZyb);
    const byId = new Map(drafts.map((d) => [d.gameId, d]));

    it('parses all 26 games of the season (matches 14 blue + 12 red WRData games)', () => {
        expect(drafts).toHaveLength(26);
        expect(drafts.filter((d) => d.side === 'blue')).toHaveLength(14);
        expect(drafts.filter((d) => d.side === 'red')).toHaveLength(12);
    });

    it('matches the 9W/17L season record (4+5 wins per WRData)', () => {
        expect(drafts.filter((d) => d.result === 'W')).toHaveLength(9);
        expect(drafts.filter((d) => d.result === 'L')).toHaveLength(17);
    });

    it('game 78152 (compact playoff layout): blue side despite "ZYB vs VITB" header order', () => {
        // Hand-read row: blue label = ZYB, result cell "ZYB LOSS". Bans are
        // the grayscale icons in appearance order: Yunara, Fiora, Ryze, Ahri,
        // Renekton; picks are the colored ones: Ambessa, Shen, Akali, Kaisa,
        // Neeko (phase order, NOT role order).
        const g = byId.get('78152');
        expect(g?.side).toBe('blue');
        expect(g?.result).toBe('L');
        expect(g?.opponent).toBe('VITB');
        expect(g?.bans.map((b) => b.championKey)).toEqual(['804', '114', '13', '103', '58']);
        expect(g?.picks.map((p) => p.championKey)).toEqual(['799', '98', '84', '145', '518']);
    });

    it('game 77034 (20-column layout): red side despite "KCB vs ZYB" header order', () => {
        // Hand-read row: ZYB is the RED-side label; the May 2026 scraper had
        // crossed ban2/pick1 here — ground truth from the fixture cells:
        // gray = Orianna(2) Rumble(4) Pantheon(6) Corki(13) Xayah(15);
        // color = Zaahen(8) Ryze(9) Kaisa(12) Neeko(17) Olaf(20).
        const g = byId.get('77034');
        expect(g?.side).toBe('red');
        expect(g?.result).toBe('L');
        expect(g?.opponent).toBe('KCB');
        expect(g?.bans.map((b) => b.championKey)).toEqual(['61', '68', '80', '42', '498']);
        expect(g?.picks.map((p) => p.championKey)).toEqual(['904', '13', '145', '518', '2']);
    });

    it('game 74155: empty icon cells (lost ban + lost pick) degrade to 4+4 with a warning', () => {
        // Hand-read: ZYB red row has src='../_img/champions_icon/' (empty
        // filename) at the ban-2 slot 15 and the last pick slot 20.
        const g = byId.get('74155');
        expect(g?.bans).toHaveLength(4);
        expect(g?.picks).toHaveLength(4);
        expect(warnings.some((w) => w.includes('74155') && w.includes('unreadable'))).toBe(true);
    });

    it('keeps roles undefined without players/dataset (no fabricated pick-order roles)', () => {
        expect(drafts.every((d) => d.picks.every((p) => p.role === undefined))).toBe(true);
    });
});

describe('parseRecentDrafts × role attribution (M3.1 pick-swap pitfall)', () => {
    // Minimal hand-built pools: each main owns exactly the champion he played
    // in game 77034, so pool matching must invert the phase order.
    const players: ProPlayer[] = [
        { id: '4981', name: 'Wao', role: Role.Top, pool: [{ championKey: '2', games: 1, wins: 0 }] },
        { id: '2048', name: 'Manaty', role: Role.Jungle, pool: [{ championKey: '904', games: 2, wins: 1 }] },
        { id: '873', name: 'Nisqy', role: Role.Middle, pool: [{ championKey: '13', games: 2, wins: 0 }] },
        { id: '2678', name: 'Jezu', role: Role.Bottom, pool: [{ championKey: '145', games: 1, wins: 0 }] },
        { id: '6710', name: 'Riippp', role: Role.Support, pool: [{ championKey: '518', games: 2, wins: 0 }] }
    ];
    const { drafts } = parseRecentDrafts(teamDraftZyb, { players });
    const g77034 = drafts.find((d) => d.gameId === '77034');

    it('attributes Olaf (5th pick in phase order) to TOP, not pick-order Support', () => {
        const olaf = g77034?.picks.find((p) => p.championKey === '2');
        expect(olaf?.role).toBe(Role.Top);
    });

    it('attributes Zaahen→JG, Ryze→MID, Kaisa→BOT, Neeko→SUP (phase order [1,2,3,4])', () => {
        expect(g77034?.picks.map((p) => p.role)).toEqual([
            Role.Jungle,
            Role.Middle,
            Role.Bottom,
            Role.Support,
            Role.Top
        ]);
    });

    it('every draft gets 5 unique roles (bijection via the leftover sweep)', () => {
        for (const d of drafts.filter((x) => x.picks.length === 5)) {
            const roles = d.picks.map((p) => p.role);
            expect(new Set(roles).size).toBe(5);
        }
    });
});

describe('attributeRoles / championPrimaryRole (unit)', () => {
    const roleData = (games: number) => ({ ...defaultChampionRoleData(), games, wins: 0 });
    // Ryze: 10 mid games vs 2 top games → primary role Middle.
    const dataset: Dataset = {
        version: 'test',
        date: '2026-06-10',
        championData: {
            '13': {
                key: '13',
                name: 'Ryze',
                statsByRole: {
                    [Role.Top]: roleData(2),
                    [Role.Jungle]: roleData(0),
                    [Role.Middle]: roleData(10),
                    [Role.Bottom]: roleData(0),
                    [Role.Support]: roleData(0)
                }
            }
        }
    };

    it('championPrimaryRole picks the most-played role; unknown key → undefined', () => {
        expect(championPrimaryRole(dataset, '13')).toBe(Role.Middle);
        expect(championPrimaryRole(dataset, '9999')).toBeUndefined();
    });

    it('dataset fallback fills unmatched picks before the sweep', () => {
        const players: ProPlayer[] = [
            { id: '1', name: 'TopGuy', role: Role.Top, pool: [{ championKey: '24', games: 3, wins: 1 }] }
        ];
        // '24' pool-matches Top; '13' has no owner → dataset → Middle;
        // '99' unknown everywhere → sweep takes the first free role (Jungle).
        expect(attributeRoles(['24', '13', '99'], players, dataset)).toEqual([
            Role.Top,
            Role.Middle,
            Role.Jungle
        ]);
    });

    it('an ambiguous pool match (two owners) is NOT pool-attributed', () => {
        const players: ProPlayer[] = [
            { id: '1', name: 'TopGuy', role: Role.Top, pool: [{ championKey: '24', games: 3, wins: 1 }] },
            { id: '2', name: 'JgGuy', role: Role.Jungle, pool: [{ championKey: '24', games: 1, wins: 0 }] }
        ];
        // Jax ('24') is in two pools → unique-match fails → sweep gives the
        // first remaining role in canonical order: Top.
        expect(attributeRoles(['24'], players)).toEqual([Role.Top]);
    });
});

describe('parseTournamentMatchList (LFL 2026 Spring Split)', () => {
    const dates = parseTournamentMatchList(tournamentMatchList);

    it('maps all 45 games of the page (hand count of rows, all dated)', () => {
        expect(dates.size).toBe(45);
    });

    it('game 77034 → 2026-04-23, game 77433 → 2026-05-01 (hand-read cells)', () => {
        expect(dates.get('77034')).toBe('2026-04-23T00:00:00.000Z');
        expect(dates.get('77433')).toBe('2026-05-01T00:00:00.000Z');
    });

    it('anchors every value to midnight UTC', () => {
        for (const value of dates.values()) {
            expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
        }
    });
});

describe('parseRecentDrafts × gameDates', () => {
    const gameDates = parseTournamentMatchList(tournamentMatchList);
    const { drafts } = parseRecentDrafts(teamDraftZyb, { gameDates });
    const byId = new Map(drafts.map((d) => [d.gameId, d]));

    it('stamps playedAt when the game is in the map (77034, spring split)', () => {
        expect(byId.get('77034')?.playedAt).toBe('2026-04-23T00:00:00.000Z');
    });

    it('leaves playedAt undefined off-map (78152 is in the Playoffs, not the Split)', () => {
        expect(byId.get('78152')?.playedAt).toBeUndefined();
    });
});

describe('url builders', () => {
    it('encodes tournament names with spaces', () => {
        expect(urlTournamentMatchList('LFL 2026 Spring Split')).toBe(
            'https://gol.gg/tournament/tournament-matchlist/LFL%202026%20Spring%20Split/'
        );
    });

    it('builds the canonical player-stats URL', () => {
        expect(urlPlayerStats('873', 'S16')).toBe(
            'https://gol.gg/players/player-stats/873/season-S16/split-ALL/tournament-ALL/champion-ALL/'
        );
    });
});
