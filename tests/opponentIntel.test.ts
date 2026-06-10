/**
 * opponentIntel: the routes→engines glue (C1).
 *
 * Fixtures use REAL champion keys (the bridge round-trips keys through the
 * bundled tag file's display names — synthetic keys would resolve to '').
 * Drafts are undated and the team corpus has no league prior by default, so
 * every tendency p is an exact count ratio (recency weight 1, α effectif 0):
 *   (P1, blue):    picks 68, 68            → p(68) = 1
 *   (B1-B3, blue): bans 59,34,56 / 59,61,80 → p(59) = 2/6
 *   (P2-3, red):   picks 145, 518           → p = 1/2 each before pool term
 *   (B1-B3, red):  bans 68,59,103           → p = 1/3 each
 * Blue-first template (golgg.bridge.test.ts): blue bans seq 1,3,5 + 14,16,
 * blue picks seq 7,10,11 + 18,19; red bans 2,4,6 + 13,15, red picks 8,9,12
 * + 17,20.
 */
import { describe, expect, it } from 'vitest';
import {
    buildOpponentIntel,
    rangeLabelFr,
    seriesStateFromSeries,
    type SeriesPoolsBySide
} from '$lib/intel/opponentIntel';
import type { DraftAction, DraftPhase, DraftRecord, DraftSide } from '$lib/data/types';
import type { ProTeam, RecentDraft } from '$lib/pro/types';
import { predict } from '$lib/aggregates/tendency';
import type { Series } from '$lib/storage/series';
import { Role } from '$lib/types';

const NOW = '2026-06-10T12:00:00.000Z';

// ---- team fixture (3 recent drafts: 2 blue, 1 red) ---------------------------

/** g1 — blue win: 68 Top, 13 Mid, 904 Jg, 18 Bot, 60 Sup. */
const draftBlue1: RecentDraft = {
    gameId: 'g1',
    side: 'blue',
    result: 'W',
    opponent: 'OPP',
    picks: [
        { championKey: '68', role: Role.Top },
        { championKey: '13', role: Role.Middle },
        { championKey: '904', role: Role.Jungle },
        { championKey: '18', role: Role.Bottom },
        { championKey: '60', role: Role.Support }
    ],
    bans: [
        { championKey: '59' },
        { championKey: '34' },
        { championKey: '56' },
        { championKey: '516' },
        { championKey: '800' }
    ]
};

/** g2 — blue loss: 68 flexed to MID (flex evidence), same botlane pair. */
const draftBlue2: RecentDraft = {
    gameId: 'g2',
    side: 'blue',
    result: 'L',
    opponent: 'OPP',
    picks: [
        { championKey: '68', role: Role.Middle },
        { championKey: '103', role: Role.Top },
        { championKey: '904', role: Role.Jungle },
        { championKey: '18', role: Role.Bottom },
        { championKey: '60', role: Role.Support }
    ],
    bans: [
        { championKey: '59' },
        { championKey: '61' },
        { championKey: '80' },
        { championKey: '42' },
        { championKey: '498' }
    ]
};

/** g3 — red win: P2-3 = 145, 518; B1-B3 bans 68, 59, 103. */
const draftRed: RecentDraft = {
    gameId: 'g3',
    side: 'red',
    result: 'W',
    opponent: 'OPP',
    picks: [
        { championKey: '145', role: Role.Bottom },
        { championKey: '518', role: Role.Middle },
        { championKey: '2', role: Role.Top },
        { championKey: '516', role: Role.Jungle },
        { championKey: '34', role: Role.Support }
    ],
    bans: [
        { championKey: '68' },
        { championKey: '59' },
        { championKey: '103' },
        { championKey: '18' },
        { championKey: '60' }
    ]
};

/** ADC pool holds 145 at strongest tier (25 g) — 518 stays pool-unseen. */
const team: ProTeam = {
    id: 't1',
    name: 'Fixture Esport',
    league: 'lfl',
    players: [
        {
            id: 'p4',
            name: 'BotPlayer',
            role: Role.Bottom,
            pool: [{ championKey: '145', games: 25, wins: 15 }]
        }
    ],
    sideStats: { blue: { wins: 1, games: 2 }, red: { wins: 1, games: 1 } },
    recentDrafts: [draftBlue1, draftBlue2, draftRed],
    warnings: []
};

const intel = buildOpponentIntel(team, { now: NOW, config: { combinationMinGames: 2 } });

// ---- league record factory (rangeModel.test.ts shape) -------------------------

function phaseOf(seq: number): DraftPhase {
    if (seq <= 6) return 'ban1';
    if (seq <= 12) return 'pick1';
    if (seq <= 16) return 'ban2';
    return 'pick2';
}

function pick(seq: number, side: DraftSide, championKey: string): DraftAction {
    return { seq, type: 'pick', phase: phaseOf(seq), side, championKey, championName: championKey };
}

function leagueGame(gameId: string, actions: DraftAction[]): DraftRecord {
    return {
        gameId,
        blueTeam: 'L1',
        redTeam: 'L2',
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: NOW }
    };
}

// ---- records + table ----------------------------------------------------------

describe('buildOpponentIntel — records & tendency table', () => {
    it('converts the 3 drafts into one-sided records stamped with the injected clock', () => {
        expect(intel.records).toHaveLength(3);
        expect(intel.records.every((r) => r.provenance.fetchedAt === NOW)).toBe(true);
        expect(intel.records[0].warnings[0]).toContain('one-sided');
    });

    it('team-filtered tendencies are exact count ratios (no league prior)', () => {
        const p1 = predict(intel.table, { slotGroup: 'P1', side: 'blue' });
        expect(p1).toHaveLength(1);
        expect(p1[0]).toMatchObject({ championKey: '68', p: 1, rawCount: 2, total: 2 });

        const bans = predict(intel.table, { slotGroup: 'B1-B3', side: 'blue' });
        const jarvan = bans.find((e) => e.championKey === '59');
        expect(jarvan?.p).toBeCloseTo(2 / 6, 10);
        expect(jarvan?.total).toBe(6);
    });

    it('flags the missing league corpus and the undated records', () => {
        expect(intel.warnings.some((w) => w.includes('corpus ligue'))).toBe(true);
        expect(intel.warnings.some((w) => w.includes('sans date'))).toBe(true);
    });
});

// ---- aggregates -----------------------------------------------------------------

describe('buildOpponentIntel — presence, flex, combinations', () => {
    it('presence counts picks + bans over the 3-game corpus', () => {
        const rumble = intel.presence.get('68');
        // Picked g1+g2 (blue), banned by the team itself in g3 → presence 3/3.
        expect(rumble).toMatchObject({ picks: 2, bans: 1, games: 3, wins: 1 });
        expect(rumble?.presence).toBeCloseTo(1, 10);
    });

    it('flex: 68 played Top then Middle → 2 roles, 1 bit of entropy', () => {
        const flex = intel.flex.get('68');
        expect(flex?.roleCount).toBe(2);
        expect(flex?.flexScore).toBeCloseTo(1, 10);
        expect(flex?.byRole.get(Role.Top)).toBe(1);
        expect(flex?.byRole.get(Role.Middle)).toBe(1);
    });

    it('mines the recurring botlane pair 18+60 (minGames 2 via config)', () => {
        const botlane = intel.combinations.find(
            (a) => a.kind === 'botlane' && a.championKeys[0] === '18' && a.championKeys[1] === '60'
        );
        expect(botlane).toMatchObject({ games: 2, wins: 1 });
    });
});

// ---- ranges ----------------------------------------------------------------------

describe('buildOpponentIntel — rangesBySlotGroup', () => {
    it('keeps only the contexts with evidence, in fixed order, labelled in FR', () => {
        expect(intel.rangesBySlotGroup.map((r) => `${r.slotGroup}|${r.side}`)).toEqual([
            'B1-B3|blue',
            'B1-B3|red',
            'P1|blue',
            'P2-3|red'
        ]);
        expect(rangeLabelFr('P1', 'blue')).toBe('P1 — côté bleu');
        expect(intel.rangesBySlotGroup[2].labelFr).toBe('P1 — côté bleu');
    });

    it('(P1, blue) is a certainty on 68 with its raw evidence', () => {
        const p1 = intel.rangesBySlotGroup.find((r) => r.slotGroup === 'P1' && r.side === 'blue');
        expect(p1?.entries).toHaveLength(1);
        expect(p1?.entries[0]).toMatchObject({
            championKey: '68',
            p: 1,
            closeGroup: true,
            evidence: { rawCount: 2, total: 2 }
        });
    });

    it('(P2-3, red): the pool term separates 145 (strongest) from 518 (unseen)', () => {
        const p23 = intel.rangesBySlotGroup.find((r) => r.slotGroup === 'P2-3' && r.side === 'red');
        expect(p23?.entries.map((e) => e.championKey)).toEqual(['145', '518']);
        const [kaisa, neeko] = p23?.entries ?? [];
        // Equal tendencies (1/2 each); odds ratio = (1/0.05)^0.5 = √20.
        expect(kaisa.p / neeko.p).toBeCloseTo(Math.sqrt(20), 6);
        // DA-V2-12: the pool term is visible separately (0.5·ln 0.05 for 518).
        expect(neeko.components.pool).toBeCloseTo(0.5 * Math.log(0.05), 10);
        expect(kaisa.components.pool).toBeCloseTo(0, 10);
        // No meta map injected → neutral meta term, exactly 0.
        expect(kaisa.components.meta).toBe(0);
        // √20 ≈ 4.47 → 518 falls out of the 0.8 close group.
        expect(kaisa.closeGroup).toBe(true);
        expect(neeko.closeGroup).toBe(false);
    });
});

// ---- ban pages -------------------------------------------------------------------

describe('buildOpponentIntel — banPages', () => {
    it('builds one page per enemy side, on their opening rotation', () => {
        expect(intel.banPages.map((p) => p.side)).toEqual(['blue', 'red']);
        expect(intel.banPages[0].rotationLabel).toBe('B1-B3 — adversaire côté bleu');
        expect(intel.banPages[0].upcomingSlotGroups).toEqual(['P1']);
        expect(intel.banPages[1].upcomingSlotGroups).toEqual(['P2-3']);
    });

    it('blue page: ev(68) = 1 × (1.5 + structural 0.4), components separated', () => {
        const top = intel.banPages[0].entries[0];
        // Five recurring pairs of weight 2 each (total 10); 68 touches (68,18)
        // and (68,60) → structural = 4/10.
        expect(top.championKey).toBe('68');
        expect(top.components.takeProbability).toBeCloseTo(1, 10);
        expect(top.components.damage).toBeCloseTo(1.5, 10);
        expect(top.components.structural).toBeCloseTo(0.4, 10);
        expect(top.ev).toBeCloseTo(1.9, 10);
        expect(top.rationaleFr.length).toBeGreaterThan(0);
    });

    it('red page: 145 leads (higher take probability via the pool term)', () => {
        const entries = intel.banPages[1].entries;
        expect(entries[0].championKey).toBe('145');
        const neeko = entries.find((e) => e.championKey === '518');
        expect(neeko !== undefined && entries[0].ev > neeko.ev).toBe(true);
    });
});

// ---- league corpus + patch filter --------------------------------------------------

describe('buildOpponentIntel — league corpus & patch options', () => {
    it('a league corpus activates the Dirichlet prior (α 5 vs 2 observations)', () => {
        const withLeague = buildOpponentIntel(team, {
            now: NOW,
            leagueRecords: [leagueGame('lg1', [pick(7, 'blue', '516')])]
        });
        const p1 = withLeague.rangesBySlotGroup.find((r) => r.slotGroup === 'P1' && r.side === 'blue');
        expect(p1?.entries.map((e) => e.championKey).sort()).toEqual(['516', '68']);
        expect(withLeague.warnings.some((w) => w.includes('corpus ligue'))).toBe(false);
    });

    it('a patch filter that matches nothing degrades to unfiltered + warning', () => {
        const filtered = buildOpponentIntel(team, { now: NOW, patch: '16.11' });
        expect(filtered.presence.size).toBeGreaterThan(0);
        expect(filtered.warnings.some((w) => w.includes('Patch 16.11'))).toBe(true);
    });

    it('a team without drafts yields empty reads and the dedicated warning', () => {
        const empty = buildOpponentIntel({ ...team, recentDrafts: [] }, { now: NOW });
        expect(empty.records).toEqual([]);
        expect(empty.banPages).toEqual([]);
        expect(empty.rangesBySlotGroup).toEqual([]);
        expect(empty.presence.size).toBe(0);
        expect(empty.warnings.some((w) => w.includes('Aucune draft récente'))).toBe(true);
    });
});

// ---- storage → solver mapping --------------------------------------------------------

describe('seriesStateFromSeries', () => {
    const pools: SeriesPoolsBySide = {
        ally: { [Role.Top]: [{ championKey: '68', games: 10, wins: 5 }] },
        enemy: { [Role.Top]: [{ championKey: '2', games: 10, wins: 5 }] }
    };

    function seriesOf(over: Partial<Series> = {}): Series {
        return {
            id: 's1',
            name: 'Demi',
            format: 'bo5',
            mode: 'fearless',
            allyTeam: 'A',
            enemyTeam: 'B',
            games: [
                {
                    gameNumber: 1,
                    allyPicks: ['68', '', '', '', ''],
                    enemyPicks: ['145', '', '', '', ''],
                    allyBans: [],
                    enemyBans: [],
                    result: 'ally'
                },
                {
                    gameNumber: 2,
                    allyPicks: ['13', '', '', '', ''],
                    enemyPicks: [],
                    allyBans: [],
                    enemyBans: [],
                    result: 'enemy'
                },
                {
                    gameNumber: 3,
                    allyPicks: [],
                    enemyPicks: [],
                    allyBans: [],
                    enemyBans: [],
                    result: null
                }
            ],
            consumedAlly: ['68', '13'],
            consumedEnemy: ['145'],
            createdAt: 0,
            updatedAt: 0,
            ...over
        };
    }

    it('maps score, next game number, consumed union and the FS holder', () => {
        const state = seriesStateFromSeries(seriesOf(), pools, 'ally');
        expect(state.format).toBe('bo5');
        expect(state.score).toEqual({ ally: 1, enemy: 1 });
        expect(state.gameNumber).toBe(3); // two decided games → game 3 up next
        expect([...state.consumed].sort()).toEqual(['13', '145', '68']);
        expect(state.firstSelectionHolder).toBe('ally');
        expect(state.poolsBySide.ally).toBe(pools.ally);
        expect(state.mode).toBe('fearless');
    });

    it('omits the holder when not provided', () => {
        expect(seriesStateFromSeries(seriesOf(), pools).firstSelectionHolder).toBeUndefined();
    });

    it('rejects standard series and Bo1 (the solver is fearless bo3/bo5 only)', () => {
        expect(() => seriesStateFromSeries(seriesOf({ mode: 'standard' }), pools)).toThrow(RangeError);
        expect(() => seriesStateFromSeries(seriesOf({ format: 'bo1' }), pools)).toThrow(RangeError);
    });
});

// ---- corpus merge (Leaguepedia both-sided ∪ gol.gg fresh) ---------------------

describe('buildOpponentIntel — corpusTeamRecords merge', () => {
    /** One both-sided corpus record: same day + same team picks as a golgg
     *  duplicate would produce; opponent plays 412 (Thresh) — the marker that
     *  must NOT leak into the team's presence. Team name spelled differently
     *  (canonical-equal) to exercise the rename. */
    const corpusRecord = (gameId: string, day: string, teamPicks: string[]): DraftRecord => ({
        gameId,
        blueTeam: 'MERGE  Esport', // canonical-equal to 'Merge Esport'
        redTeam: 'Les Adversaires',
        date: `${day}T17:00:00Z`,
        winner: 'blue',
        firstPickSide: 'blue',
        orderConfidence: 'assumed-blue-first',
        actions: [
            ...teamPicks.map((championKey, i) => ({
                seq: [7, 10, 11][i],
                type: 'pick' as const,
                phase: 'pick1' as DraftPhase,
                side: 'blue' as DraftSide,
                championKey,
                championName: championKey
            })),
            {
                seq: 8,
                type: 'pick' as const,
                phase: 'pick1' as DraftPhase,
                side: 'red' as DraftSide,
                championKey: '412',
                championName: '412'
            }
        ],
        warnings: [],
        provenance: { source: 'leaguepedia', fetchedAt: '2026-06-09T00:00:00Z' }
    });

    const mergeTeam: ProTeam = {
        id: '999',
        name: 'Merge Esport',
        league: 'lfl',
        players: [],
        sideStats: { blue: { wins: 0, games: 0 }, red: { wins: 0, games: 0 } },
        recentDrafts: [
            {
                gameId: 'golgg-dup',
                side: 'blue',
                result: 'W',
                opponent: 'ADV',
                playedAt: '2026-06-01T00:00:00.000Z',
                picks: [{ championKey: '68' }, { championKey: '13' }, { championKey: '103' }],
                bans: []
            },
            {
                gameId: 'golgg-fresh',
                side: 'blue',
                result: 'L',
                opponent: 'ADV',
                playedAt: '2026-06-08T00:00:00.000Z',
                picks: [{ championKey: '145' }, { championKey: '18' }, { championKey: '60' }],
                bans: []
            }
        ],
        warnings: []
    };

    const intel = buildOpponentIntel(mergeTeam, {
        now: NOW,
        corpusTeamRecords: [
            corpusRecord('lp-dup', '2026-06-01', ['68', '13', '103']), // duplicate of golgg-dup
            corpusRecord('lp-old', '2026-05-20', ['54', '54', '54'])
        ]
    });

    it('dedupes by (day + team pick set): corpus wins, fresh golgg survives', () => {
        expect(intel.records).toHaveLength(3);
        const ids = intel.records.map((r) => r.gameId);
        expect(ids).toContain('lp-dup');
        expect(ids).toContain('lp-old');
        expect(ids).toContain('golgg-fresh');
        expect(ids).not.toContain('golgg-dup');
        // Sorted most recent first.
        expect(ids[0]).toBe('golgg-fresh');
    });

    it('rewrites corpus team names to the gol.gg spelling (one team string)', () => {
        const lp = intel.records.find((r) => r.gameId === 'lp-dup');
        expect(lp?.blueTeam).toBe('Merge Esport');
        expect(lp?.redTeam).toBe('Les Adversaires');
    });

    it('keeps the opponent actions OUT of the team presence (team-side view)', () => {
        expect(intel.presence.has('412')).toBe(false); // corpus opponent pick
        expect(intel.presence.get('68')?.picks).toBe(1); // deduped, counted once
        expect(intel.presence.get('54')?.picks).toBe(3); // corpus-only game
    });

    it('says so in the warnings, in plain French', () => {
        expect(intel.warnings.some((w) => w.includes('Corpus Leaguepedia fusionné : 2 games complets'))).toBe(true);
        expect(intel.warnings.some((w) => w.includes('+ 1 récents gol.gg'))).toBe(true);
    });
});
