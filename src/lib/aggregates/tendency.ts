/**
 * R4 — Dirichlet-smoothed conditional tendency tables (ARCHITECTURE_V2 §6
 * point 5; research 2026-06_methodologie_draft §5).
 *
 *   P̂(c | slotGroup, side) =
 *       (Σ_a λ^age(a) · 1[a picked/banned c]  +  α · P_league(c | slotGroup, side))
 *     / (Σ_a λ^age(a)                          +  α)
 *
 * summed over the team's actions `a` observed in that (slotGroup, side)
 * context; age is in weeks (fractional), `now` is injected — never read from
 * the system clock. Two deliberate adaptations of the research formula:
 *  - counts are per ACTION, not per game: multi-slot groups (P2-3, B1-B3…)
 *    contribute several actions per game, and action counting is what keeps
 *    the distribution normalized (Σp = 1);
 *  - when the league corpus has no observation for a context, the prior term
 *    is dropped (effective α = 0) instead of inventing a uniform prior — the
 *    estimate honestly degrades to the recency-weighted team frequency.
 * The league prior is deliberately NOT recency-weighted: it is the stable
 * "what anyone in this league does in that slot" baseline; recency belongs to
 * the team evidence. UI convention (research §5): coaches trust counts, not
 * logits — predictions carry raw counts and `evidenceString` renders them as
 * « 4 des 6 dernières ».
 */
import type { DraftActionType, DraftRecord, DraftSide } from '$lib/data/types';
import { banRotationOf, rotationOf, type BanRotation, type PickRotation } from '$lib/aggregates/rotations';

/** Conditioning slot: a pick rotation or a ban phase (one at a time, never jointly). */
export type SlotGroup = PickRotation | BanRotation;

export interface TendencyOptions {
    /** Dirichlet prior strength α in pseudo-actions (research §5: 3-8). */
    alpha?: number;
    /** Weekly recency decay λ (research §5: 0.8-0.95). */
    lambdaPerWeek?: number;
    /** Injected clock (ISO timestamp) for age computation. */
    now: string;
    /**
     * Team whose tendencies we model: only actions made BY this team (matched
     * against blueTeam/redTeam by acting side) count as team evidence. When
     * omitted, every action counts — only sound if the caller pre-split the
     * records to a single point of view.
     */
    team?: string;
}

export interface TendencyCell {
    /** λ-weighted champion counts (team evidence). */
    counts: Map<string, number>;
    /** Raw champion counts (UI evidence — coaches read counts). */
    rawCounts: Map<string, number>;
    /** Σ of weighted counts. */
    totalWeight: number;
    /** Σ of raw counts. */
    totalRaw: number;
    /** League distribution P_league(c | slotGroup, side); empty = no league data. */
    prior: Map<string, number>;
}

export interface TendencyTable {
    alpha: number;
    lambdaPerWeek: number;
    /** Cells keyed by `cellKey(slotGroup, side)`. */
    cells: Map<string, TendencyCell>;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Stable key of a (slotGroup, side) context. */
export function cellKey(slotGroup: SlotGroup, side: DraftSide): string {
    return `${slotGroup}|${side}`;
}

/** Slot group of an action: pick rotation or ban phase; undefined off-template. */
export function slotGroupOf(action: { type: DraftActionType; seq: number }): SlotGroup | undefined {
    return action.type === 'pick' ? rotationOf(action.seq) : banRotationOf(action.seq);
}

/**
 * λ^(age in weeks), age clamped at 0 (future-dated records count as fresh).
 * Undated/unparseable records get full weight 1: manual scrim entries often
 * lack a date, and dropping them entirely would be worse than over-weighting.
 */
export function recencyWeight(date: string | undefined, now: string, lambdaPerWeek: number): number {
    if (date === undefined) return 1;
    const dateMs = Date.parse(date);
    const nowMs = Date.parse(now);
    if (Number.isNaN(dateMs) || Number.isNaN(nowMs)) return 1;
    const weeks = Math.max(0, (nowMs - dateMs) / WEEK_MS);
    return lambdaPerWeek ** weeks;
}

/** Team acting on `side` in this record. */
function actingTeam(record: DraftRecord, side: DraftSide): string {
    return side === 'blue' ? record.blueTeam : record.redTeam;
}

/**
 * Build the conditional table from the team's recent records plus a league
 * corpus for the prior. Unresolved actions (championKey '') are skipped.
 */
export function buildTendencyTable(
    teamRecords: DraftRecord[],
    leagueRecords: DraftRecord[],
    options: TendencyOptions
): TendencyTable {
    const alpha = options.alpha ?? 5;
    const lambdaPerWeek = options.lambdaPerWeek ?? 0.9;
    const cells = new Map<string, TendencyCell>();

    const cellOf = (key: string): TendencyCell => {
        let cell = cells.get(key);
        if (cell === undefined) {
            cell = {
                counts: new Map<string, number>(),
                rawCounts: new Map<string, number>(),
                totalWeight: 0,
                totalRaw: 0,
                prior: new Map<string, number>()
            };
            cells.set(key, cell);
        }
        return cell;
    };

    // League prior: raw conditional frequencies, every action counts (the
    // prior is what ANY team does in that slot — no team filter, no decay).
    const leagueTotals = new Map<string, number>();
    for (const record of leagueRecords) {
        for (const action of record.actions) {
            if (action.championKey === '') continue;
            const group = slotGroupOf(action);
            if (group === undefined) continue;
            const key = cellKey(group, action.side);
            const cell = cellOf(key);
            cell.prior.set(action.championKey, (cell.prior.get(action.championKey) ?? 0) + 1);
            leagueTotals.set(key, (leagueTotals.get(key) ?? 0) + 1);
        }
    }
    for (const [key, total] of leagueTotals) {
        const prior = cellOf(key).prior;
        for (const [championKey, count] of prior) prior.set(championKey, count / total);
    }

    // Team evidence: λ-weighted + raw action counts, filtered to the team.
    for (const record of teamRecords) {
        const weight = recencyWeight(record.date, options.now, lambdaPerWeek);
        for (const action of record.actions) {
            if (action.championKey === '') continue;
            if (options.team !== undefined && actingTeam(record, action.side) !== options.team) continue;
            const group = slotGroupOf(action);
            if (group === undefined) continue;
            const cell = cellOf(cellKey(group, action.side));
            cell.counts.set(action.championKey, (cell.counts.get(action.championKey) ?? 0) + weight);
            cell.rawCounts.set(action.championKey, (cell.rawCounts.get(action.championKey) ?? 0) + 1);
            cell.totalWeight += weight;
            cell.totalRaw += 1;
        }
    }

    return { alpha, lambdaPerWeek, cells };
}

export interface PredictQuery {
    slotGroup: SlotGroup;
    side: DraftSide;
    /** Champions ruled out (banned, picked, Fearless-consumed…). */
    exclude?: Set<string>;
}

export interface TendencyPrediction {
    championKey: string;
    /** Posterior probability, renormalized over the non-excluded candidates. */
    p: number;
    /** λ-weighted team count (the numerator's evidence term). */
    count: number;
    /** Raw team count — what the UI shows. */
    rawCount: number;
    /** Raw total of team observations in this context (denominator of the evidence). */
    total: number;
}

/**
 * Posterior over candidate champions for a context. Candidates are the union
 * of team-observed and league-prior champions, minus `exclude`; masses
 * (weighted count + α·prior) are renormalized after exclusion. Sorted by p
 * desc, then raw count desc, then champion key asc.
 */
export function predict(table: TendencyTable, query: PredictQuery): TendencyPrediction[] {
    const cell = table.cells.get(cellKey(query.slotGroup, query.side));
    if (cell === undefined) return [];

    const exclude = query.exclude ?? new Set<string>();
    const effectiveAlpha = cell.prior.size > 0 ? table.alpha : 0;

    const candidates = new Set<string>([...cell.counts.keys(), ...cell.prior.keys()]);
    const scored: { championKey: string; mass: number; count: number; rawCount: number }[] = [];
    let totalMass = 0;
    for (const championKey of candidates) {
        if (exclude.has(championKey)) continue;
        const count = cell.counts.get(championKey) ?? 0;
        const mass = count + effectiveAlpha * (cell.prior.get(championKey) ?? 0);
        scored.push({ championKey, mass, count, rawCount: cell.rawCounts.get(championKey) ?? 0 });
        totalMass += mass;
    }
    if (totalMass <= 0) return [];

    return scored
        .map(({ championKey, mass, count, rawCount }): TendencyPrediction => ({
            championKey,
            p: mass / totalMass,
            count,
            rawCount,
            total: cell.totalRaw
        }))
        .sort((a, b) => {
            if (a.p !== b.p) return b.p - a.p;
            if (a.rawCount !== b.rawCount) return b.rawCount - a.rawCount;
            return a.championKey < b.championKey ? -1 : 1;
        });
}

/**
 * Coach-facing evidence: « 4 des 6 dernières » (sous-entendu : parties). Raw
 * counts on purpose — the research's UI convention is counts, never logits.
 */
export function evidenceString(entry: { rawCount: number; total: number }): string {
    if (entry.total === 0) return 'aucune donnée';
    if (entry.total === 1) return entry.rawCount === 0 ? 'jamais sur la dernière' : '1 de la dernière';
    if (entry.rawCount === 0) return `jamais sur les ${entry.total} dernières`;
    return `${entry.rawCount} des ${entry.total} dernières`;
}
