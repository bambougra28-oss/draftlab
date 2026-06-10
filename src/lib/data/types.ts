/**
 * R1 — Normalized draft-data schema (ARCHITECTURE_V2 §5.3).
 *
 * `DraftRecord` is the pivot type every provider (Leaguepedia, Oracle's Elixir,
 * gol.gg, manual scrims) normalizes into. Four dimensions are deliberately
 * independent on each record: side, pick order, game number in series, patch —
 * since the 2026 "First Selection" rule, blue side ≠ first pick, so the action
 * sequence is keyed on the first-pick side, not on blue.
 */
import type { Role } from '$lib/types';

export type DraftSide = 'blue' | 'red';
export type DraftActionType = 'pick' | 'ban';
export type DraftPhase = 'ban1' | 'pick1' | 'ban2' | 'pick2';

/** One pick/ban in global draft order. `seq` is the canonical position 1-20. */
export interface DraftAction {
    seq: number;
    type: DraftActionType;
    phase: DraftPhase;
    side: DraftSide;
    /** Resolved Data Dragon numeric key (as string); '' when unresolved. */
    championKey: string;
    /** Raw champion name as the source rendered it (kept for diagnostics). */
    championName: string;
    /** Role the champion was played in (picks only, when the source knows it). */
    role?: Role;
    /** Player who played the pick, when the source exposes it. */
    playerId?: string;
}

export interface DraftSeriesInfo {
    /** 1-based game number within the series (Leaguepedia `N_GameInMatch`). */
    gameNumber: number;
    /** Source-side series/match identifier when available. */
    matchId?: string;
    mode?: 'standard' | 'fearless';
}

/** 2026 First Selection: the privileged team chose side OR pick order. */
export interface FirstSelectionInfo {
    holder: DraftSide;
    choice: 'side' | 'pick';
}

export interface DraftProvenance {
    /** Provider id, e.g. 'leaguepedia', 'oracles-elixir', 'golgg', 'manual'. */
    source: string;
    /** ISO timestamp of the fetch that produced this record. */
    fetchedAt: string;
    /** Immutable snapshot this record was stored under, once persisted. */
    snapshotId?: string;
}

/**
 * How trustworthy the global action ordering is:
 *  - 'exact'              — the source exposes true global order;
 *  - 'assumed-blue-first' — per-team order is exact but the interleaving
 *    assumes blue picked first (always true pre-2026; an assumption in the
 *    First Selection era — the divergence detector cross-checks it).
 */
export type OrderConfidence = 'exact' | 'assumed-blue-first';

export interface DraftRecord {
    /** Source-scoped stable id (Leaguepedia GameId, OE gameid, golgg game id). */
    gameId: string;
    tournament?: string;
    league?: string;
    /** ISO date (UTC) of the game when known. */
    date?: string;
    patch?: string;
    blueTeam: string;
    redTeam: string;
    winner?: DraftSide;
    /** Game duration in seconds, when the source exposes it (postdiction G1). */
    gameLengthSeconds?: number;
    series?: DraftSeriesInfo;
    firstSelection?: FirstSelectionInfo;
    /** Which side made the first pick (drives the action template). */
    firstPickSide: DraftSide;
    orderConfidence: OrderConfidence;
    /** All picks/bans sorted by `seq`; skipped bans are simply absent. */
    actions: DraftAction[];
    /** Non-fatal anomalies collected during parsing/normalization. */
    warnings: string[];
    provenance: DraftProvenance;
}

/** Per-team draft columns in the order the team made them (source-side shape). */
export interface TeamDraftColumns {
    bans: (string | undefined)[];
    picks: (string | undefined)[];
    /** roles[i] applies to picks[i]. */
    roles?: (Role | undefined)[];
    players?: (string | undefined)[];
}
