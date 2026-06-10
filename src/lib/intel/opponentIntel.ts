/**
 * C1 — Opponent intel: the single glue layer between routes and the summit
 * engines (R4 aggregates, I1 range model, ban EV, I4 series solver).
 *
 * `buildOpponentIntel` turns ONE scraped gol.gg team into every prep read the
 * UI renders: normalized records (R1 bridge), the conditional tendency table
 * (team-filtered), presence/flex/combination aggregates, per-context enemy
 * ranges and ready-to-render ban pages. Pure and injected: the clock comes in
 * as `opts.now` (recency weights + provenance), the league corpus and every
 * engine tunable are optional inputs — no fetch, no storage, no system clock.
 *
 * Modelling notes:
 * - gol.gg records are ONE-SIDED (only the scraped team's actions), which is
 *   exactly what the team-filtered tendency table needs; presence is then the
 *   team's own pick/ban presence, not a league meta.
 * - the meta term of the ranges comes from the LEAGUE corpus when provided
 *   (patch presence across the league); without it the term stays neutral —
 *   the team's own presence would double-count the tendency backbone.
 * - records are interleaved on the blue-first template (`assumed-blue-first`),
 *   so blue contexts are P1/P4-5/P8-9 and red contexts are P2-3/P6/P7/P10:
 *   ban pages target the OPENING rotation of each possible enemy side (P1 on
 *   blue, P2-3 on red) and a page is only built where evidence exists.
 * - `opts.patch` filters presence when at least one record carries the patch;
 *   gol.gg records have none, so the filter degrades to unfiltered WITH a
 *   warning instead of silently emptying the read.
 *
 * `seriesStateFromSeries` is the storage→solver mapping (M7 Series → I4
 * SeriesState): consumed = union of both sides' consumption, score from the
 * decided games, gameNumber = the game about to be played.
 */
import { flexMap, type FlexEntry } from '$lib/aggregates/flex';
import { mineCombinations, type CombinationAsset } from '$lib/aggregates/combinations';
import { computePresence, recordMatchesFilter, type PresenceEntry } from '$lib/aggregates/presence';
import {
    buildTendencyTable,
    predict,
    type SlotGroup,
    type TendencyTable
} from '$lib/aggregates/tendency';
import type { DraftRecord, DraftSide } from '$lib/data/types';
import { recentDraftsToDraftRecords } from '$lib/pro/golggBridge';
import type { ChampionPoolEntry, ProTeam } from '$lib/pro/types';
import { banEV, type BanEvConfig, type BanEvEntry } from '$lib/strategic/banEv';
import { predictEnemyRange, type RangeEntry } from '$lib/strategic/rangeModel';
import type { RangeModelConfig } from '$lib/strategic/rangeModelConfig';
import type { SeriesSide, SeriesState } from '$lib/strategic/seriesSolver';
import type { Series } from '$lib/storage/series';
import type { Role } from '$lib/types';

export interface OpponentIntelConfig {
    /** Dirichlet prior strength α forwarded to the tendency table. */
    alpha?: number;
    /** Weekly recency decay λ forwarded to the tendency table. */
    lambdaPerWeek?: number;
    /** Pair recurrence floor for structural assets (mineCombinations). */
    combinationMinGames?: number;
    /** Ban-page candidate pool size taken from the top presence list. */
    banCandidateCount?: number;
    /** Tendency predictions folded into the ban candidates, per pick context. */
    banTendencyTopK?: number;
    /** I1 range-model tunables forwarded to every predictEnemyRange call. */
    rangeConfig?: RangeModelConfig;
    /** Ban EV tunables forwarded to banEV. */
    banEvConfig?: BanEvConfig;
}

export interface OpponentIntelOptions {
    /** League corpus: tendency prior + meta term of the ranges. */
    leagueRecords?: DraftRecord[];
    /** Injected clock (ISO) — recency weights and record provenance. */
    now: string;
    /** Presence patch filter (degrades to unfiltered with a warning). */
    patch?: string;
    config?: OpponentIntelConfig;
}

/** One per-context enemy range, prepPack/RangePanel-ready. */
export interface SlotRange {
    slotGroup: SlotGroup;
    side: DraftSide;
    /** FR context label, e.g. 'P1 — côté bleu'. */
    labelFr: string;
    entries: RangeEntry[];
}

/** One ready-to-render ban page (entries are BanPageEntry-compatible). */
export interface OpponentBanPage {
    /** FR rotation label, e.g. 'B1-B3 — adversaire côté bleu'. */
    rotationLabel: string;
    /** Enemy side this page assumes. */
    side: DraftSide;
    /** Their opening pick rotation the EV sums over. */
    upcomingSlotGroups: SlotGroup[];
    entries: BanEvEntry[];
}

export interface OpponentIntel {
    /** Normalized one-sided records (R1 bridge), most recent first. */
    records: DraftRecord[];
    /** Conditional tendency table, filtered to the team's own actions. */
    table: TendencyTable;
    /** The team's pick/ban presence over its records. */
    presence: Map<string, PresenceEntry>;
    /** Role distribution of every role-tagged pick. */
    flex: Map<string, FlexEntry>;
    /** Recurring prepared pairs (structural assets). */
    combinations: CombinationAsset[];
    /** Ban pages per possible enemy side, where evidence exists. */
    banPages: OpponentBanPage[];
    /** Enemy ranges for B1-B3 / P1 / P2-3 on each side with data. */
    rangesBySlotGroup: SlotRange[];
    /** FR data caveats — honest reading conditions, never hidden. */
    warnings: string[];
}

/** Contexts the prep reads cover, in draft order then blue-first side order. */
const RANGE_CONTEXTS: readonly { slotGroup: SlotGroup; side: DraftSide }[] = [
    { slotGroup: 'B1-B3', side: 'blue' },
    { slotGroup: 'B1-B3', side: 'red' },
    { slotGroup: 'P1', side: 'blue' },
    { slotGroup: 'P1', side: 'red' },
    { slotGroup: 'P2-3', side: 'blue' },
    { slotGroup: 'P2-3', side: 'red' }
];

/** Opening pick rotation of each side under the blue-first template. */
const OPENING_PICKS_BY_SIDE: Record<DraftSide, SlotGroup[]> = {
    blue: ['P1'],
    red: ['P2-3']
};

const SIDE_LABEL_FR: Record<DraftSide, string> = { blue: 'bleu', red: 'rouge' };

export function rangeLabelFr(slotGroup: SlotGroup, side: DraftSide): string {
    return `${slotGroup} — côté ${SIDE_LABEL_FR[side]}`;
}

/**
 * Build every opponent read from one scraped team. Pure: same inputs, same
 * intel. Empty inputs yield empty (never invented) reads plus a warning.
 */
export function buildOpponentIntel(team: ProTeam, opts: OpponentIntelOptions): OpponentIntel {
    const cfg = opts.config ?? {};
    const banCandidateCount = cfg.banCandidateCount ?? 12;
    const banTendencyTopK = cfg.banTendencyTopK ?? 3;
    const warnings: string[] = [];

    // 1. Records (R1 bridge) — provenance stamped with the injected clock.
    const records = recentDraftsToDraftRecords(team, { fetchedAt: opts.now });
    if (records.length === 0) {
        warnings.push(`Aucune draft récente gol.gg pour ${team.name} — intel adverse vide.`);
    } else {
        warnings.push(
            `Records gol.gg one-sided : seules les actions de ${team.name} sont connues ` +
                '(suffisant pour ses tendances ; la présence reflète ses propres picks/bans).'
        );
        const undated = records.filter((r) => r.date === undefined).length;
        if (undated > 0) {
            warnings.push(`${undated} record(s) sans date — poids de récence 1 (aucune décote).`);
        }
    }

    // 2. Tendency table — team-filtered, league prior when a corpus exists.
    const leagueRecords = opts.leagueRecords ?? [];
    if (leagueRecords.length === 0 && records.length > 0) {
        warnings.push('Pas de corpus ligue : prior de tendance désactivé (α effectif 0) et terme méta neutre.');
    }
    const table = buildTendencyTable(records, leagueRecords, {
        now: opts.now,
        team: team.name,
        ...(cfg.alpha !== undefined ? { alpha: cfg.alpha } : {}),
        ...(cfg.lambdaPerWeek !== undefined ? { lambdaPerWeek: cfg.lambdaPerWeek } : {})
    });

    // 3. Aggregates. The patch filter only applies when it matches something:
    // gol.gg records carry no patch, so it would silently empty the read.
    let presenceFilter = {};
    if (opts.patch !== undefined) {
        const matching = records.filter((r) => recordMatchesFilter(r, { patch: opts.patch })).length;
        if (matching > 0) {
            presenceFilter = { patch: opts.patch };
        } else if (records.length > 0) {
            warnings.push(
                `Patch ${opts.patch} : aucun record correspondant (gol.gg ne fournit pas le patch) — ` +
                    'présence calculée sans filtre.'
            );
        }
    }
    const presence = computePresence(records, presenceFilter);
    const flex = flexMap(records);
    const combinations = mineCombinations(
        records,
        cfg.combinationMinGames !== undefined ? { minGames: cfg.combinationMinGames } : {}
    );

    // 4. Per-context ranges. Meta = league presence (the patch meta), never
    // the team's own presence (it would double-count the tendency term).
    const leagueMeta = leagueRecords.length > 0 ? computePresence(leagueRecords, presenceFilter) : undefined;
    const rangesBySlotGroup: SlotRange[] = [];
    for (const { slotGroup, side } of RANGE_CONTEXTS) {
        const entries = predictEnemyRange({
            table,
            slotGroup,
            side,
            pools: team.players,
            ...(leagueMeta !== undefined ? { meta: leagueMeta } : {}),
            exclude: new Set<string>(),
            ...(cfg.rangeConfig !== undefined ? { config: cfg.rangeConfig } : {})
        });
        if (entries.length > 0) {
            rangesBySlotGroup.push({ slotGroup, side, labelFr: rangeLabelFr(slotGroup, side), entries });
        }
    }
    const rangeOf = (slotGroup: SlotGroup, side: DraftSide): RangeEntry[] =>
        rangesBySlotGroup.find((r) => r.slotGroup === slotGroup && r.side === side)?.entries ?? [];

    // 5. Ban candidates: top presence first, then the top tendency predictions
    // of each opening pick context (order is irrelevant — banEV re-sorts).
    const seen = new Set<string>();
    const candidates: string[] = [];
    const pushCandidate = (championKey: string): void => {
        if (!seen.has(championKey)) {
            seen.add(championKey);
            candidates.push(championKey);
        }
    };
    [...presence.values()]
        .sort((a, b) => b.presence - a.presence || (a.championKey < b.championKey ? -1 : 1))
        .slice(0, banCandidateCount)
        .forEach((entry) => pushCandidate(entry.championKey));
    for (const side of ['blue', 'red'] as const) {
        for (const slotGroup of OPENING_PICKS_BY_SIDE[side]) {
            for (const prediction of predict(table, { slotGroup, side }).slice(0, banTendencyTopK)) {
                pushCandidate(prediction.championKey);
            }
        }
    }

    // 6. Ban pages — one per enemy side whose opening rotation has evidence.
    const banPages: OpponentBanPage[] = [];
    for (const side of ['blue', 'red'] as const) {
        const upcomingSlotGroups = OPENING_PICKS_BY_SIDE[side];
        if (!upcomingSlotGroups.some((group) => rangeOf(group, side).length > 0)) continue;
        banPages.push({
            rotationLabel: `B1-B3 — adversaire côté ${SIDE_LABEL_FR[side]}`,
            side,
            upcomingSlotGroups: [...upcomingSlotGroups],
            entries: banEV(candidates, {
                upcomingSlotGroups: [...upcomingSlotGroups],
                rangeFor: (group) => rangeOf(group, side),
                structuralAssets: combinations,
                ...(cfg.banEvConfig !== undefined ? { config: cfg.banEvConfig } : {})
            })
        });
    }

    return { records, table, presence, flex, combinations, banPages, rangesBySlotGroup, warnings };
}

// ---- storage → solver mapping ---------------------------------------------------

export interface SeriesPoolsBySide {
    ally: Partial<Record<Role, ChampionPoolEntry[]>>;
    enemy: Partial<Record<Role, ChampionPoolEntry[]>>;
}

/**
 * Map an M7 stored Series onto an I4 SeriesState: consumed = union of both
 * sides' consumption (hard Fearless), score from the decided games and
 * gameNumber = the game about to be played (decided + 1). Pools are injected
 * by the caller (gol.gg rosters or manual entry — the storage layer has
 * none). Throws on non-Fearless or Bo1 series: the solver models the
 * Fearless resource war only.
 */
export function seriesStateFromSeries(
    series: Series,
    pools: SeriesPoolsBySide,
    holder?: SeriesSide
): SeriesState {
    if (series.mode !== 'fearless') {
        throw new RangeError('seriesStateFromSeries: the series solver models fearless series only');
    }
    if (series.format === 'bo1') {
        throw new RangeError('seriesStateFromSeries: bo1 has no series dimension (bo3/bo5 only)');
    }
    const ally = series.games.filter((g) => g.result === 'ally').length;
    const enemy = series.games.filter((g) => g.result === 'enemy').length;
    const state: SeriesState = {
        gameNumber: ally + enemy + 1,
        format: series.format,
        score: { ally, enemy },
        mode: 'fearless',
        poolsBySide: { ally: pools.ally, enemy: pools.enemy },
        consumed: new Set<string>([...series.consumedAlly, ...series.consumedEnemy])
    };
    if (holder !== undefined) state.firstSelectionHolder = holder;
    return state;
}
