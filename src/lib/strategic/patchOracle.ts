/**
 * I6 — Patch Oracle: historical buff-response curves, prior-uncertainty
 * inflation and patch watchlist (ARCHITECTURE_V2 §6 bis I6, §8 R8; porte G6).
 *
 * A purely statistical tool is structurally one patch late; teams draft on
 * *reads*. This module assists the read, quantitatively:
 *  - `estimateResponseCurves` measures, on a historical corpus, how stage
 *    presence responded to past changes of each (kind, magnitude) class:
 *    mean presence delta (pp) per patch offset after the change shipped.
 *    Prior art credited: iTero shipped validated per-patch tier-forecasts
 *    (2022) — OUR slice is the estimation and prospective use of these
 *    historical response curves, not the idea of forecasting a patch.
 *  - `applyOracle` turns the CURRENT patch diff into a watchlist: expected
 *    presence delta from the matched curve, a prior-inflation directive for
 *    the estimators (consigne only — consumed later, see below), and the
 *    pocket-pick cross-check (M5.4 assessor, read-only).
 *
 * Input is a STRUCTURED `PatchChange` entry (champion, kind, magnitude,
 * optional FR note) — parsing Riot/CDragon patch notes into these entries is
 * deliberate FUTURE WORK (R8 hardening): until that parser exists the
 * analyst types the diff in ~2 minutes from the patch notes, and the
 * structured form keeps this engine testable and source-agnostic.
 *
 * Honesty rails:
 *  - offsets are measured against the last patch played strictly BEFORE the
 *    change shipped; changes without a measurable baseline (no earlier patch
 *    in the corpus, unparseable patch) are skipped, never guessed;
 *  - thin samples carry a wilson95 interval on the DIRECTION (share of
 *    samples whose presence actually rose) plus a `lowConfidence` flag —
 *    a mean over 2 changes is published as exactly that;
 *  - `priorInflation` is a directive for the estimators layer (divide prior
 *    strength N0 by `factor`, cap at `targetN` pseudo-games) — published
 *    here, applied THERE once the estimators consume it (documented seam);
 *  - DA-V2-11: every output carries `experimental: true` until the G6 gate
 *    (backtested curves, watchlist hit rate > base rate);
 *  - components stay separate (DA-V2-12): expected delta, inflation and
 *    pocket signal are never collapsed into a single score.
 */
import { computePresence } from '$lib/aggregates/presence';
import { wilson95, type Interval } from '$lib/backtest/metrics';
import { groupByPatch, parsePatch, comparePatches } from '$lib/backtest/walkforward';
import {
    assessPocketPickRisk,
    type PocketPickContext,
    type PocketPickReason,
    type PocketPickRisk
} from '$lib/strategic/pocketPickRiskAssessor';
import {
    DEFAULT_PATCH_ORACLE_CONFIG,
    type PatchOracleConfig,
    type PriorInflationDirective
} from '$lib/strategic/patchOracleConfig';
import type { DraftRecord } from '$lib/data/types';

export type PatchChangeKind = 'buff' | 'nerf' | 'adjust';
export type PatchChangeMagnitude = 'minor' | 'moderate' | 'major';

/** One structured patch-notes entry (typed by the analyst — see header). */
export interface PatchChange {
    championKey: string;
    kind: PatchChangeKind;
    magnitude: PatchChangeMagnitude;
    /** Optional analyst note, e.g. 'W cooldown 14→10s'. */
    noteFr?: string;
}

/** A PAST change anchored on the patch whose notes shipped it. */
export interface DatedPatchChange extends PatchChange {
    /** Patch the change shipped in (e.g. '26.4'); unparseable ⇒ skipped. */
    patch: string;
}

/** One measured point of a response curve. */
export interface ResponseCurvePoint {
    /** 1-based patch offset: 1 = first corpus patch played WITH the change. */
    offset: number;
    /** Mean presence delta vs the pre-change baseline patch, in pp. */
    meanDeltaPp: number;
    /** Number of (change × offset) samples behind the mean. */
    samples: number;
    /** Share of samples whose presence rose (delta > 0). */
    positiveShare: number;
    /** Wilson 95% interval of `positiveShare` — direction consistency. */
    ci: Interval;
    /** samples < config.minSamplesPerPoint. */
    lowConfidence: boolean;
}

/** Historical presence response of one (kind, magnitude) change class. */
export interface ResponseCurve {
    kind: PatchChangeKind;
    magnitude: PatchChangeMagnitude;
    /** Points by ascending offset; only offsets with ≥ 1 sample exist. */
    points: ResponseCurvePoint[];
    /** Distinct past changes that contributed at least one offset sample. */
    samples: number;
    /** DA-V2-11: experimental until the G6 backtest gate. */
    experimental: true;
}

export interface ResponseCurveOptions {
    /** Override of config.horizonPatches (mission default 2). */
    horizonPatches?: number;
    config?: PatchOracleConfig;
}

/** Deterministic kind order for curve output. */
const KINDS: readonly PatchChangeKind[] = ['buff', 'nerf', 'adjust'];

/** Internal accumulator of one curve cell. */
interface CurveAccumulator {
    kind: PatchChangeKind;
    magnitude: PatchChangeMagnitude;
    /** offset → deltas in pp (one per contributing change). */
    deltasByOffset: Map<number, number[]>;
    changes: number;
}

/**
 * Estimate response curves from a historical corpus and its annotated past
 * changes. For each change shipped in patch P:
 *  - baseline = champion presence on the LAST corpus patch strictly before P
 *    (no earlier patch ⇒ the change is unmeasurable and skipped);
 *  - offset k (1..horizon) = presence on the k-th corpus patch at-or-after P
 *    minus the baseline, in pp (champion absent ⇒ presence 0);
 *  - offsets beyond the corpus simply produce no sample (never extrapolated).
 * Presence windows come from `computePresence` per `groupByPatch` group, so
 * patch ordering is numeric (26.2 < 26.10) and unplaceable records are
 * excluded — the walk-forward leakage rules apply verbatim.
 */
export function estimateResponseCurves(
    history: DraftRecord[],
    pastChanges: DatedPatchChange[],
    options: ResponseCurveOptions = {}
): ResponseCurve[] {
    const config = options.config ?? DEFAULT_PATCH_ORACLE_CONFIG;
    const horizon = Math.max(1, options.horizonPatches ?? config.horizonPatches);

    const groups = groupByPatch(history);
    const presenceByPatch = groups.map((group) => computePresence(group.items));

    const presencePp = (patchIndex: number, championKey: string): number =>
        (presenceByPatch[patchIndex].get(championKey)?.presence ?? 0) * 100;

    const cells = new Map<string, CurveAccumulator>();

    for (const change of pastChanges) {
        if (parsePatch(change.patch) === undefined) continue;

        // Last patch strictly before the change = baseline; first patch
        // at-or-after = offset 1. Groups are in natural patch order.
        let baselineIndex = -1;
        let firstIndex = groups.length;
        for (let i = 0; i < groups.length; i++) {
            if (comparePatches(groups[i].patch, change.patch) < 0) baselineIndex = i;
            else {
                firstIndex = i;
                break;
            }
        }
        if (baselineIndex < 0 || firstIndex >= groups.length) continue;

        const baseline = presencePp(baselineIndex, change.championKey);
        const key = `${change.kind}|${change.magnitude}`;
        let cell = cells.get(key);
        if (cell === undefined) {
            cell = { kind: change.kind, magnitude: change.magnitude, deltasByOffset: new Map(), changes: 0 };
            cells.set(key, cell);
        }

        let contributed = false;
        for (let offset = 1; offset <= horizon; offset++) {
            const index = firstIndex + offset - 1;
            if (index >= groups.length) break;
            const delta = presencePp(index, change.championKey) - baseline;
            const bucket = cell.deltasByOffset.get(offset);
            if (bucket) bucket.push(delta);
            else cell.deltasByOffset.set(offset, [delta]);
            contributed = true;
        }
        if (contributed) cell.changes += 1;
    }

    const curves: ResponseCurve[] = [];
    for (const cell of cells.values()) {
        if (cell.changes === 0) continue;
        const points: ResponseCurvePoint[] = [...cell.deltasByOffset.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([offset, deltas]) => {
                const samples = deltas.length;
                const positives = deltas.filter((d) => d > 0).length;
                return {
                    offset,
                    meanDeltaPp: deltas.reduce((sum, d) => sum + d, 0) / samples,
                    samples,
                    positiveShare: positives / samples,
                    ci: wilson95(positives, samples),
                    lowConfidence: samples < config.minSamplesPerPoint
                };
            });
        curves.push({
            kind: cell.kind,
            magnitude: cell.magnitude,
            points,
            samples: cell.changes,
            experimental: true
        });
    }

    return curves.sort((a, b) => {
        const kindDelta = KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind);
        if (kindDelta !== 0) return kindDelta;
        return config.magnitudeRank[a.magnitude] - config.magnitudeRank[b.magnitude];
    });
}

/** One champion to watch on the current patch (briefing line). */
export interface WatchlistEntry {
    championKey: string;
    /**
     * Expected presence delta at config.briefingOffset from the matched
     * curve, in pp; 0 when no historical curve covers the change class
     * (the entry still exists — the change itself is the watch signal).
     */
    expectedPresenceDeltaPp: number;
    /** Direction-consistency interval carried from the curve point. */
    ci?: Interval;
    /** Separate components, never fused (DA-V2-12): change, curve, pocket. */
    reasonsFr: string[];
    /** Uncertainty-inflation consigne for the estimators (see config). */
    priorInflation: PriorInflationDirective;
    /** No curve point, or a point under the sample threshold. */
    lowConfidence: boolean;
    /** DA-V2-11: experimental until the G6 watchlist hit-rate gate. */
    experimental: true;
}

export interface ApplyOracleOptions {
    /**
     * Optional pocket-pick contexts by champion key (pro-soloq cross-check):
     * read through `assessPocketPickRisk` (M5.4) and surfaced as a reason
     * only when the assessed risk clears config.pocketRiskMinimum.
     */
    pocketSignals?: Map<string, PocketPickContext>;
    config?: PatchOracleConfig;
}

const KIND_FR: Record<PatchChangeKind, string> = { buff: 'Buff', nerf: 'Nerf', adjust: 'Ajustement' };
const MAGNITUDE_FR: Record<PatchChangeMagnitude, string> = {
    minor: 'mineur',
    moderate: 'modéré',
    major: 'majeur'
};
const RISK_ORDER: Record<PocketPickRisk, number> = { none: 0, low: 1, medium: 2, high: 3 };
const RISK_FR: Record<PocketPickRisk, string> = {
    none: 'nul',
    low: 'faible',
    medium: 'moyen',
    high: 'élevé'
};
const POCKET_REASON_FR: Record<PocketPickReason, string> = {
    tagged_low_confidence: 'tag basse confiance',
    low_stage_presence: 'présence scène faible',
    recent_buff: 'buff récent'
};

/** '+4' / '-2.5' — 1 decimal max, trailing zero trimmed, explicit '+'. */
function fmtPp(value: number): string {
    const fixed = value.toFixed(1).replace(/\.0$/, '');
    return value > 0 ? `+${fixed}` : fixed;
}

/**
 * Build the current-patch watchlist from the structured diff and the
 * estimated curves. One entry PER CHANGE (a champion with two entries in the
 * diff appears twice — the estimators take the strongest inflation). Order:
 * |expected delta| descending (nerf crashes matter as much as buff spikes),
 * then magnitude rank descending, then champion key ascending.
 */
export function applyOracle(
    changes: PatchChange[],
    curves: ResponseCurve[],
    options: ApplyOracleOptions = {}
): WatchlistEntry[] {
    const config = options.config ?? DEFAULT_PATCH_ORACLE_CONFIG;

    const entries = changes.map((change) => {
        const curve = curves.find((c) => c.kind === change.kind && c.magnitude === change.magnitude);
        const point = curve?.points.find((p) => p.offset === config.briefingOffset);

        const reasonsFr: string[] = [];
        const changeLabel = `${KIND_FR[change.kind]} ${MAGNITUDE_FR[change.magnitude]} au patch courant`;
        reasonsFr.push(change.noteFr === undefined ? changeLabel : `${changeLabel} — ${change.noteFr}`);

        if (point !== undefined) {
            const thin = point.lowConfidence ? ', échantillon faible' : '';
            reasonsFr.push(
                `Courbe historique : ${fmtPp(point.meanDeltaPp)} pp de présence attendus ` +
                    `au patch +${point.offset} (n=${point.samples}${thin})`
            );
        } else {
            reasonsFr.push('Aucune courbe historique mesurable pour ce type de changement');
        }

        const context = options.pocketSignals?.get(change.championKey);
        if (context !== undefined) {
            const assessment = assessPocketPickRisk(context);
            if (RISK_ORDER[assessment.risk] >= RISK_ORDER[config.pocketRiskMinimum]) {
                const details = assessment.reasons.map((r) => POCKET_REASON_FR[r]).join(', ');
                reasonsFr.push(`Signal pocket pick (risque ${RISK_FR[assessment.risk]}) : ${details}`);
            }
        }

        const entry: WatchlistEntry = {
            championKey: change.championKey,
            expectedPresenceDeltaPp: point?.meanDeltaPp ?? 0,
            reasonsFr,
            priorInflation: config.inflationByMagnitude[change.magnitude],
            lowConfidence: point === undefined || point.lowConfidence,
            experimental: true
        };
        if (point !== undefined) entry.ci = point.ci;
        return { entry, magnitude: change.magnitude };
    });

    return entries
        .sort((a, b) => {
            const absDelta =
                Math.abs(b.entry.expectedPresenceDeltaPp) - Math.abs(a.entry.expectedPresenceDeltaPp);
            if (absDelta !== 0) return absDelta;
            const rank = config.magnitudeRank[b.magnitude] - config.magnitudeRank[a.magnitude];
            if (rank !== 0) return rank;
            return a.entry.championKey < b.entry.championKey ? -1 : 1;
        })
        .map(({ entry }) => entry);
}
