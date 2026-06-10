/**
 * R3/R9 — Corpus scorecard runner (ARCHITECTURE_V2 §8 R3/R9, S7, DA-V2-9).
 *
 * Pure library: replays a DraftRecord corpus walk-forward BY PATCH and
 * produces the versioned Summit Gate scorecard (markdown + structured
 * results). Three tracks, each metric published NEXT TO its naive baseline
 * with a seeded bootstrap CI of the delta (a claim without a baseline and an
 * interval does not ship):
 *
 *  1. Game outcome (records with a winner): side-only model — P(blue wins) =
 *     blue win rate of the train — vs the mandatory p = 0.5 coin. Log loss,
 *     Brier and accuracy. Side-only is itself a baseline for future engine
 *     entries (the M3.5 verdict: side alone carries real signal).
 *  2. pick-in-range@8: for every test pick (resolved champion, on-template
 *     rotation), the range is `predict` of the acting TEAM's tendency table
 *     fit on the train (league prior = the whole train), champions already
 *     revealed in the draft excluded. Baseline: raw train pick-frequency
 *     top-8 (the R4 « fréquence brute » baseline).
 *  3. ban-hit@5: per test game with ≥ 1 resolved ban, the 5 suggestions are
 *     the train's most-banned champions (banRotationProfile totals, presence
 *     then key as tiebreaks); baseline ranks by overall train presence.
 *     Published value = mean hits per game (0..5).
 *
 * Leakage guarantee: every track rides `walkForward` / `groupByPatch`, so a
 * patch is only ever scored on strictly earlier patches and temporally
 * unplaceable records are dropped (counted in the notes). Retrieval tracks
 * feed walkForward ITEMS that are scoring events (one per pick / one per
 * game) carrying their record; predictions are encoded as PredictionPair.p
 * (hit 1/0, or hits/5) with `won` fixed true — the published rates come from
 * the pooled pairs, the per-fold log-loss numbers of those tracks are
 * meaningless and not published.
 *
 * Determinism: `seed` drives one shared mulberry32 stream through the five
 * bootstrap CIs in a FIXED order (outcome log loss, Brier, accuracy, pick,
 * ban); `generatedAt` is the injected clock (provenance line + tendency
 * `now`). Same corpus + same seed + same timestamp ⇒ byte-identical card.
 */
import { buildTendencyTable, predict, type TendencyTable } from '$lib/aggregates/tendency';
import { computePresence } from '$lib/aggregates/presence';
import { banRotationProfile, rotationOf, type PickRotation } from '$lib/aggregates/rotations';
import {
    accuracy,
    banHitAtK,
    bootstrapDeltaCI,
    brier,
    logLoss,
    mulberry32,
    pickInRangeAtK,
    type BootstrapDelta,
    type PredictionPair
} from './metrics';
import { groupByPatch, parsePatch, walkForward } from './walkforward';
import { renderScorecard, verdictOf, type ScorecardEntry } from './scorecard';
import type { DraftAction, DraftRecord, DraftSide } from '$lib/data/types';

/** Retrieval cutoffs — the Summit Gate names (§8 R9). */
const PICK_RANGE_K = 8;
const BAN_HIT_K = 5;

/** Bootstrap resamples per CI (fixed: the seed is the reproducibility knob). */
const BOOTSTRAP_ITERATIONS = 1000;

export interface CorpusRunnerOptions {
    /** Bootstrap seed (mulberry32) — every published CI replays from it. */
    seed: number;
    /** Injected ISO timestamp: provenance line + tendency-table `now`. */
    generatedAt: string;
    /** Patch label of the card; default = last patch of the corpus timeline. */
    patch?: string;
}

export interface OutcomeTrackMetrics {
    logLoss: number;
    brier: number;
    accuracy: number;
}

export interface OutcomeTrackResult {
    /** Scored predictions (games of test folds having a winner). */
    n: number;
    foldCount: number;
    coinFlip: OutcomeTrackMetrics;
    sideOnly: OutcomeTrackMetrics;
    /** side-only − coin, seeded bootstrap (paired on the shared test set). */
    deltas?: { logLoss: BootstrapDelta; brier: BootstrapDelta; accuracy: BootstrapDelta };
}

export interface RetrievalTrackResult {
    /** Scored events: picks (pick-in-range@8) or games (ban-hit@5). */
    n: number;
    foldCount: number;
    /** pick-in-range@8: hit rate 0..1; ban-hit@5: mean hits per game 0..5. */
    model: number;
    baseline: number;
    /** model − baseline, seeded bootstrap (paired). */
    delta?: BootstrapDelta;
}

export interface CorpusScorecardResults {
    patch: string;
    seed: number;
    generatedAt: string;
    /** Input records / records with a parseable patch / dropped. */
    records: number;
    usableRecords: number;
    droppedNoPatch: number;
    outcome: OutcomeTrackResult;
    pickInRange: RetrievalTrackResult;
    banHit: RetrievalTrackResult;
    /** Rows exactly as rendered (value, baseline, CI, verdict). */
    entries: ScorecardEntry[];
}

/** Team acting on `side` in this record. */
function actingTeam(record: DraftRecord, side: DraftSide): string {
    return side === 'blue' ? record.blueTeam : record.redTeam;
}

/** Champions already revealed (picked or banned, either side) before `seq`. */
function revealedBefore(record: DraftRecord, seq: number): Set<string> {
    const revealed = new Set<string>();
    for (const action of record.actions) {
        if (action.seq < seq && action.championKey !== '') revealed.add(action.championKey);
    }
    return revealed;
}

/** Unique records behind a list of scoring events, input order preserved. */
function uniqueRecords(events: { record: DraftRecord }[]): DraftRecord[] {
    const seen = new Set<DraftRecord>();
    const records: DraftRecord[] = [];
    for (const { record } of events) {
        if (seen.has(record)) continue;
        seen.add(record);
        records.push(record);
    }
    return records;
}

/** Mean of pair.p — the rate metric of the retrieval tracks (p ∈ {0,1} or hits/5). */
function meanP(pairs: PredictionPair[]): number {
    if (pairs.length === 0) return NaN;
    let sum = 0;
    for (const pair of pairs) sum += pair.p;
    return sum / pairs.length;
}

/** One scorable pick: resolved champion on an on-template pick rotation. */
interface PickEvent {
    patch?: string;
    record: DraftRecord;
    action: DraftAction;
    slotGroup: PickRotation;
}

/** One scorable game for the ban track (≥ 1 resolved ban). */
interface BanEvent {
    patch?: string;
    record: DraftRecord;
    bans: string[];
}

/** Raw pick counts over records, ranked desc then key asc (fréquence brute). */
function rankByPickFrequency(records: DraftRecord[]): string[] {
    const counts = new Map<string, number>();
    for (const record of records) {
        for (const action of record.actions) {
            if (action.type !== 'pick' || action.championKey === '') continue;
            counts.set(action.championKey, (counts.get(action.championKey) ?? 0) + 1);
        }
    }
    return [...counts.entries()]
        .sort((a, b) => (a[1] !== b[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1))
        .map(([key]) => key);
}

/** Train ranking for the ban model: ban totals desc, presence desc, key asc. */
function rankByBanTotals(records: DraftRecord[]): string[] {
    const presence = computePresence(records);
    return [...presence.entries()]
        .map(([key, entry]) => ({
            key,
            bans: banRotationProfile(records, key).total,
            presence: entry.presence
        }))
        .sort((a, b) => {
            if (a.bans !== b.bans) return b.bans - a.bans;
            if (a.presence !== b.presence) return b.presence - a.presence;
            return a.key < b.key ? -1 : 1;
        })
        .map((entry) => entry.key);
}

/** Baseline ranking for the ban track: overall presence desc, key asc. */
function rankByPresence(records: DraftRecord[]): string[] {
    const presence = computePresence(records);
    return [...presence.entries()]
        .sort((a, b) => {
            if (a[1].presence !== b[1].presence) return b[1].presence - a[1].presence;
            return a[0] < b[0] ? -1 : 1;
        })
        .map(([key]) => key);
}

/** French number for notes: at most 4 decimals, no trailing zeros. */
function fmtNote(n: number): string {
    if (Number.isNaN(n)) return '—';
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * Run the full corpus scorecard. Pure function of (records, options) — see
 * the module header for the three tracks and the determinism contract.
 */
export function runCorpusScorecard(
    records: DraftRecord[],
    options: CorpusRunnerOptions
): { markdown: string; results: CorpusScorecardResults } {
    const usable = records.filter((r) => r.patch !== undefined && parsePatch(r.patch) !== undefined);
    const droppedNoPatch = records.length - usable.length;
    const timeline = groupByPatch(usable);
    const resolvedPatch = options.patch ?? (timeline.length > 0 ? timeline[timeline.length - 1].patch : 'corpus');

    // Single seeded stream, consumed in fixed order — the determinism contract.
    const rng = mulberry32(options.seed);
    const bootstrap = (
        pairsA: PredictionPair[],
        pairsB: PredictionPair[],
        metric: (pairs: PredictionPair[]) => number
    ): BootstrapDelta | undefined =>
        pairsA.length > 0 && pairsB.length > 0
            ? bootstrapDeltaCI(pairsA, pairsB, metric, { iterations: BOOTSTRAP_ITERATIONS, rng })
            : undefined;

    // ---- track 1: game outcome (side-only vs p = 0.5) ----------------------
    const withWinner = usable.filter((r) => r.winner !== undefined);
    const outcomeSpec = {
        predict: (m: number) => m,
        outcome: (r: DraftRecord) => r.winner === 'blue'
    };
    const sideOnlyRun = walkForward(withWinner, {
        ...outcomeSpec,
        fit: (train) => train.filter((r) => r.winner === 'blue').length / train.length
    });
    const coinRun = walkForward(withWinner, { ...outcomeSpec, fit: () => 0.5 });

    // ---- track 2: pick-in-range@8 (team tendencies vs raw frequency) -------
    const pickEvents: PickEvent[] = [];
    for (const record of usable) {
        for (const action of record.actions) {
            if (action.type !== 'pick' || action.championKey === '') continue;
            const slotGroup = rotationOf(action.seq);
            if (slotGroup === undefined) continue;
            pickEvents.push({ patch: record.patch, record, action, slotGroup });
        }
    }

    interface TendencyModel {
        records: DraftRecord[];
        tables: Map<string, TendencyTable>;
    }
    const tendencyRun = walkForward<PickEvent, TendencyModel>(pickEvents, {
        // Records with zero scorable picks contribute nothing to pick cells
        // (their picks are unresolved/off-template), so fitting on the events'
        // unique records is equivalent to fitting on all train records.
        fit: (train) => ({ records: uniqueRecords(train), tables: new Map() }),
        predict: (model, event) => {
            const team = actingTeam(event.record, event.action.side);
            let table = model.tables.get(team);
            if (table === undefined) {
                table = buildTendencyTable(model.records, model.records, { now: options.generatedAt, team });
                model.tables.set(team, table);
            }
            const range = predict(table, {
                slotGroup: event.slotGroup,
                side: event.action.side,
                exclude: revealedBefore(event.record, event.action.seq)
            });
            const keys = range.map((entry) => entry.championKey);
            return pickInRangeAtK(keys, event.action.championKey, PICK_RANGE_K) ? 1 : 0;
        },
        outcome: () => true
    });
    const frequencyRun = walkForward<PickEvent, string[]>(pickEvents, {
        fit: (train) => rankByPickFrequency(uniqueRecords(train)),
        predict: (ranked, event) => {
            const exclude = revealedBefore(event.record, event.action.seq);
            const keys = ranked.filter((key) => !exclude.has(key));
            return pickInRangeAtK(keys, event.action.championKey, PICK_RANGE_K) ? 1 : 0;
        },
        outcome: () => true
    });

    // ---- track 3: ban-hit@5 (train ban totals vs train presence) -----------
    const banEvents: BanEvent[] = [];
    for (const record of usable) {
        const bans = record.actions
            .filter((action) => action.type === 'ban' && action.championKey !== '')
            .map((action) => action.championKey);
        if (bans.length === 0) continue;
        banEvents.push({ patch: record.patch, record, bans });
    }
    const banSpec = {
        predict: (ranked: string[], event: BanEvent) => banHitAtK(ranked, event.bans, BAN_HIT_K) / BAN_HIT_K,
        outcome: () => true
    };
    const banModelRun = walkForward<BanEvent, string[]>(banEvents, {
        ...banSpec,
        fit: (train) => rankByBanTotals(uniqueRecords(train))
    });
    const banBaselineRun = walkForward<BanEvent, string[]>(banEvents, {
        ...banSpec,
        fit: (train) => rankByPresence(uniqueRecords(train))
    });

    // ---- assemble (bootstrap order is part of the determinism contract) ----
    const outcomeDeltas =
        sideOnlyRun.aggregate.n > 0
            ? {
                  logLoss: bootstrap(sideOnlyRun.aggregate.pairs, coinRun.aggregate.pairs, logLoss),
                  brier: bootstrap(sideOnlyRun.aggregate.pairs, coinRun.aggregate.pairs, brier),
                  accuracy: bootstrap(sideOnlyRun.aggregate.pairs, coinRun.aggregate.pairs, accuracy)
              }
            : undefined;
    const pickDelta = bootstrap(tendencyRun.aggregate.pairs, frequencyRun.aggregate.pairs, meanP);
    const banMetric = (pairs: PredictionPair[]): number => BAN_HIT_K * meanP(pairs);
    const banDelta = bootstrap(banModelRun.aggregate.pairs, banBaselineRun.aggregate.pairs, banMetric);

    const outcome: OutcomeTrackResult = {
        n: sideOnlyRun.aggregate.n,
        foldCount: sideOnlyRun.folds.length,
        coinFlip: {
            logLoss: coinRun.aggregate.logLoss,
            brier: coinRun.aggregate.brier,
            accuracy: coinRun.aggregate.accuracy
        },
        sideOnly: {
            logLoss: sideOnlyRun.aggregate.logLoss,
            brier: sideOnlyRun.aggregate.brier,
            accuracy: sideOnlyRun.aggregate.accuracy
        }
    };
    if (
        outcomeDeltas !== undefined &&
        outcomeDeltas.logLoss !== undefined &&
        outcomeDeltas.brier !== undefined &&
        outcomeDeltas.accuracy !== undefined
    ) {
        outcome.deltas = {
            logLoss: outcomeDeltas.logLoss,
            brier: outcomeDeltas.brier,
            accuracy: outcomeDeltas.accuracy
        };
    }

    const pickInRange: RetrievalTrackResult = {
        n: tendencyRun.aggregate.n,
        foldCount: tendencyRun.folds.length,
        model: meanP(tendencyRun.aggregate.pairs),
        baseline: meanP(frequencyRun.aggregate.pairs)
    };
    if (pickDelta !== undefined) pickInRange.delta = pickDelta;

    const banHit: RetrievalTrackResult = {
        n: banModelRun.aggregate.n,
        foldCount: banModelRun.folds.length,
        model: banMetric(banModelRun.aggregate.pairs),
        baseline: banMetric(banBaselineRun.aggregate.pairs)
    };
    if (banDelta !== undefined) banHit.delta = banDelta;

    const entry = (
        metric: string,
        value: number,
        baseline: number,
        delta: BootstrapDelta | undefined,
        higherIsBetter: boolean
    ): ScorecardEntry => {
        const row: ScorecardEntry = {
            metric,
            value,
            baseline,
            verdict: verdictOf(value, baseline, delta?.ci95, higherIsBetter)
        };
        if (delta !== undefined) row.deltaCI = delta.ci95;
        return row;
    };
    const entries: ScorecardEntry[] = [
        entry(
            'log loss — issue de partie (side-only vs p=0,5)',
            outcome.sideOnly.logLoss,
            outcome.coinFlip.logLoss,
            outcome.deltas?.logLoss,
            false
        ),
        entry(
            'Brier — issue de partie (side-only vs p=0,5)',
            outcome.sideOnly.brier,
            outcome.coinFlip.brier,
            outcome.deltas?.brier,
            false
        ),
        entry(
            'accuracy — issue de partie (side-only vs p=0,5)',
            outcome.sideOnly.accuracy,
            outcome.coinFlip.accuracy,
            outcome.deltas?.accuracy,
            true
        ),
        entry('pick-in-range@8 — tendances (vs fréquence brute)', pickInRange.model, pickInRange.baseline, pickDelta, true),
        entry('ban-hit@5 — bans du train (vs présence)', banHit.model, banHit.baseline, banDelta, true)
    ];

    const notes: string[] = [
        `Corpus : ${records.length} records, ${usable.length} avec patch exploitable ` +
            `(${droppedNoPatch} écartés sans patch plaçable), ${timeline.length} patchs.`,
        `Issue de partie : ${outcome.n} prédictions sur ${outcome.foldCount} folds ` +
            `(${withWinner.length} games avec vainqueur) ; side-only = winrate blue du train.`,
        `pick-in-range@8 : ${pickInRange.n} picks scorés sur ${pickInRange.foldCount} folds ; ` +
            'range = table de tendances de l’équipe (prior ligue = train complet), ' +
            'champions déjà révélés exclus ; équipe inconnue du train ⇒ miss honnête.',
        `ban-hit@5 : ${banHit.n} games scorées (≥ 1 ban résolu) sur ${banHit.foldCount} folds ; ` +
            'valeur = bans retrouvés en moyenne par game (0..5).',
        `Reproductibilité : seed ${options.seed}, ${fmtNote(BOOTSTRAP_ITERATIONS)} resamples bootstrap, ` +
            'ordre des IC fixe (log loss, Brier, accuracy, pick, ban).',
        'side-only est lui-même une baseline (verdict M3.5) : il borne ce que tout ' +
            'modèle de draft doit dépasser avant de revendiquer un signal.'
    ];

    const markdown = renderScorecard({
        title: 'Scorecard corpus — Summit Gate (R9)',
        patch: resolvedPatch,
        generatedAt: options.generatedAt,
        entries,
        notes
    });

    return {
        markdown,
        results: {
            patch: resolvedPatch,
            seed: options.seed,
            generatedAt: options.generatedAt,
            records: records.length,
            usableRecords: usable.length,
            droppedNoPatch,
            outcome,
            pickInRange,
            banHit,
            entries
        }
    };
}
