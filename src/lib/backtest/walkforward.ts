/**
 * R3 — Walk-forward-by-patch backtest protocol (DA-V2-9; ARCHITECTURE_V2
 * §6.4; methodology report §6).
 *
 * The one rule that makes a backtest honest: a model scored on patch k is fit
 * on patches strictly BEFORE k, never on k itself or later (the M3.x temporal
 * leakage lesson, verdict §3.4). This module owns that guarantee:
 *
 *   - `groupByPatch` orders patches NUMERICALLY by major.minor (26.2 < 26.10
 *     — lexical order would corrupt the timeline twice a season). Records
 *     whose patch is missing or unparseable are dropped: a record that cannot
 *     be placed in time cannot be walked forward without risking leakage.
 *   - `walkForward` rolls fit→predict over the patch timeline and scores each
 *     fold with the harness metrics (log loss + Brier + accuracy), plus a
 *     pooled micro-average aggregate whose pairs feed reliability diagrams
 *     and bootstrap deltas downstream.
 *
 * `fit`/`predict`/`outcome` are injected so the harness stays model-agnostic:
 * the same runner scores the M1 evaluator, a team-Elo baseline or p = 0.5.
 */
import { accuracy, brier, logLoss } from './metrics';
import type { PredictionPair } from './metrics';

/** Numeric components of a `major.minor[.x]` patch string. */
export interface ParsedPatch {
    major: number;
    minor: number;
}

/**
 * Parse the leading `major[.minor]` of a patch string ('26.10', '26.10.1',
 * '26'). Returns undefined when the string does not start with a number —
 * such a patch has no defined place on the timeline.
 */
export function parsePatch(patch: string): ParsedPatch | undefined {
    const match = /^(\d+)(?:\.(\d+))?/.exec(patch.trim());
    if (!match) return undefined;
    return { major: Number(match[1]), minor: match[2] === undefined ? 0 : Number(match[2]) };
}

/**
 * Natural patch order: numeric major then minor (25.24 < 26.1 < 26.2 < 26.10).
 * Unparseable strings sort after parseable ones; remaining ties fall back to
 * lexical comparison so the order is total and deterministic.
 */
export function comparePatches(a: string, b: string): number {
    const pa = parsePatch(a);
    const pb = parsePatch(b);
    if (pa && pb) {
        if (pa.major !== pb.major) return pa.major - pb.major;
        if (pa.minor !== pb.minor) return pa.minor - pb.minor;
        return a < b ? -1 : a > b ? 1 : 0;
    }
    if (pa) return -1;
    if (pb) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
}

export interface PatchGroup<T> {
    patch: string;
    items: T[];
}

/**
 * Group records by patch, groups sorted in natural patch order, items kept in
 * input order inside each group. Records without a parseable patch are
 * EXCLUDED (documented contract: temporally unplaceable data must never enter
 * a walk-forward — callers can diff lengths to count what was dropped).
 */
export function groupByPatch<T extends { patch?: string }>(records: T[]): PatchGroup<T>[] {
    const byPatch = new Map<string, T[]>();
    for (const record of records) {
        const patch = record.patch;
        if (patch === undefined || parsePatch(patch) === undefined) continue;
        const bucket = byPatch.get(patch);
        if (bucket) bucket.push(record);
        else byPatch.set(patch, [record]);
    }
    return [...byPatch.entries()]
        .map(([patch, items]) => ({ patch, items }))
        .sort((a, b) => comparePatches(a.patch, b.patch));
}

export interface WalkForwardSpec<T, M> {
    /** Train a model on records from strictly earlier patches (called once per fold). */
    fit: (train: T[]) => M;
    /** Predicted probability of the modelled outcome for one test record. */
    predict: (model: M, item: T) => number;
    /** Observed outcome of one record. */
    outcome: (item: T) => boolean;
    /** Minimum train-set size before a patch may be scored (default 1, floor 1). */
    minTrainSize?: number;
}

export interface WalkForwardFold {
    /** Patches the model was fit on, in natural order. */
    trainPatches: string[];
    /** The single patch this fold was scored on. */
    testPatch: string;
    pairs: PredictionPair[];
    logLoss: number;
    brier: number;
    accuracy: number;
}

export interface WalkForwardAggregate {
    /** All test pairs pooled across folds (for reliability bins + bootstrap). */
    pairs: PredictionPair[];
    /** Total number of scored predictions. */
    n: number;
    logLoss: number;
    brier: number;
    accuracy: number;
}

export interface WalkForwardResult {
    folds: WalkForwardFold[];
    aggregate: WalkForwardAggregate;
}

/**
 * Roll fit→predict over the patch timeline. For each patch (in natural
 * order), if at least `minTrainSize` earlier records exist: fit on ALL
 * records of strictly earlier patches, predict every record of that patch,
 * score the fold. The first patch is never tested (no history); patches
 * reached before `minTrainSize` accumulates are skipped but still join the
 * training pool of later folds.
 *
 * The aggregate is the micro-average over all pooled test pairs — folds of
 * different sizes weigh by their number of predictions, not equally.
 */
export function walkForward<T extends { patch?: string }, M>(
    items: T[],
    spec: WalkForwardSpec<T, M>
): WalkForwardResult {
    const minTrainSize = Math.max(1, spec.minTrainSize ?? 1);
    const groups = groupByPatch(items);

    const folds: WalkForwardFold[] = [];
    const train: T[] = [];
    const trainPatches: string[] = [];

    for (const group of groups) {
        if (train.length >= minTrainSize) {
            // Pass a copy so a mutating `fit` cannot corrupt the rolling pool.
            const model = spec.fit([...train]);
            const pairs = group.items.map((item) => ({
                p: spec.predict(model, item),
                won: spec.outcome(item)
            }));
            folds.push({
                trainPatches: [...trainPatches],
                testPatch: group.patch,
                pairs,
                logLoss: logLoss(pairs),
                brier: brier(pairs),
                accuracy: accuracy(pairs)
            });
        }
        // Only AFTER scoring does the test patch join the training pool.
        train.push(...group.items);
        trainPatches.push(group.patch);
    }

    const pooled = folds.flatMap((fold) => fold.pairs);
    return {
        folds,
        aggregate: {
            pairs: pooled,
            n: pooled.length,
            logLoss: logLoss(pooled),
            brier: brier(pooled),
            accuracy: accuracy(pooled)
        }
    };
}
