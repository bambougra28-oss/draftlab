import { describe, it, expect } from 'vitest';
import {
    applyOracle,
    estimateResponseCurves,
    type DatedPatchChange,
    type PatchChange,
    type ResponseCurve,
    type ResponseCurvePoint
} from '$lib/strategic/patchOracle';
import { DEFAULT_PATCH_ORACLE_CONFIG, type PatchOracleConfig } from '$lib/strategic/patchOracleConfig';
import { wilson95 } from '$lib/backtest/metrics';
import type { PocketPickContext } from '$lib/strategic/pocketPickRiskAssessor';
import type { DraftRecord } from '$lib/data/types';

/** Minimal record: `championKeys` are blue picks on seq 7+i (presence only). */
function game(gameId: string, patch: string, championKeys: string[]): DraftRecord {
    return {
        gameId,
        patch,
        blueTeam: 'AAA',
        redTeam: 'BBB',
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions: championKeys.map((championKey, i) => ({
            seq: 7 + i,
            type: 'pick' as const,
            phase: 'pick1' as const,
            side: 'blue' as const,
            championKey,
            championName: championKey
        })),
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-10T00:00:00Z' }
    };
}

/** `games` records on `patch`; champion c appears in the first counts[c] games. */
function patchGames(patch: string, games: number, counts: Record<string, number>): DraftRecord[] {
    const records: DraftRecord[] = [];
    for (let i = 0; i < games; i++) {
        const keys = Object.entries(counts)
            .filter(([, n]) => i < n)
            .map(([key]) => key);
        records.push(game(`${patch}-g${i}`, patch, keys));
    }
    return records;
}

/**
 * Hand-built corpus, 50 games per patch (presence steps of 2 pp):
 *   a: 26.1 → 10%, 26.2 → 20%, 26.3 → 10%
 *   b: 26.1 → 20%, 26.2 → 18%, 26.3 → 38%
 *   c: 26.1 →  0%, 26.2 → 20%, 26.3 → 10%
 */
const history: DraftRecord[] = [
    ...patchGames('26.1', 50, { a: 5, b: 10 }),
    ...patchGames('26.2', 50, { a: 10, b: 9, c: 10 }),
    ...patchGames('26.3', 50, { a: 5, b: 19, c: 5 })
];

/**
 * Two major buffs shipped in 26.2 (baseline = 26.1):
 *   a: offset 1 = 20−10 = +10 pp, offset 2 = 10−10 = 0 pp
 *   b: offset 1 = 18−20 = −2 pp,  offset 2 = 38−20 = +18 pp
 * → (buff, major): offset 1 mean +4 pp, offset 2 mean +9 pp, 2 samples each.
 * One minor nerf shipped in 26.3 (baseline = 26.2):
 *   c: offset 1 = 10−20 = −10 pp; offset 2 is beyond the corpus (no sample).
 * d (no patch before 26.1), e (no patch at/after 26.9) and f (unparseable
 * patch) are unmeasurable and must be skipped.
 */
const pastChanges: DatedPatchChange[] = [
    { championKey: 'a', kind: 'buff', magnitude: 'major', patch: '26.2' },
    { championKey: 'b', kind: 'buff', magnitude: 'major', patch: '26.2' },
    { championKey: 'c', kind: 'nerf', magnitude: 'minor', patch: '26.3' },
    { championKey: 'd', kind: 'adjust', magnitude: 'moderate', patch: '26.1' },
    { championKey: 'e', kind: 'buff', magnitude: 'moderate', patch: '26.9' },
    { championKey: 'f', kind: 'buff', magnitude: 'major', patch: 'garbage' }
];

describe('estimateResponseCurves', () => {
    const curves = estimateResponseCurves(history, pastChanges);

    it('produces one curve per measurable (kind, magnitude), in deterministic order', () => {
        expect(curves.map((c) => [c.kind, c.magnitude])).toEqual([
            ['buff', 'major'],
            ['nerf', 'minor']
        ]);
        for (const curve of curves) expect(curve.experimental).toBe(true);
    });

    it('(buff, major): +4 pp mean at offset 1 over the 2 major buffs, +9 pp at offset 2', () => {
        const curve = curves[0];
        expect(curve.samples).toBe(2);
        expect(curve.points.map((p) => p.offset)).toEqual([1, 2]);
        expect(curve.points[0].meanDeltaPp).toBeCloseTo(4, 9);
        expect(curve.points[0].samples).toBe(2);
        // Direction consistency: a rose (+10), b dipped (−2) → 1 of 2 positive.
        expect(curve.points[0].positiveShare).toBeCloseTo(0.5, 12);
        expect(curve.points[0].ci).toEqual(wilson95(1, 2));
        expect(curve.points[0].lowConfidence).toBe(true);
        // Offset 2: a back to baseline (0, NOT positive), b +18 → mean +9.
        expect(curve.points[1].meanDeltaPp).toBeCloseTo(9, 9);
        expect(curve.points[1].positiveShare).toBeCloseTo(0.5, 12);
    });

    it('(nerf, minor): −10 pp at offset 1, single sample, no extrapolated offset 2', () => {
        const curve = curves[1];
        expect(curve.samples).toBe(1);
        expect(curve.points).toHaveLength(1);
        expect(curve.points[0].offset).toBe(1);
        expect(curve.points[0].meanDeltaPp).toBeCloseTo(-10, 9);
        expect(curve.points[0].samples).toBe(1);
        expect(curve.points[0].positiveShare).toBe(0);
        expect(curve.points[0].ci).toEqual(wilson95(0, 1));
        expect(curve.points[0].lowConfidence).toBe(true);
    });

    it('skips unmeasurable changes: no baseline, no later patch, unparseable patch', () => {
        const classes = curves.map((c) => `${c.kind}|${c.magnitude}`);
        expect(classes).not.toContain('adjust|moderate');
        expect(classes).not.toContain('buff|moderate');
    });

    it('horizonPatches caps the measured offsets', () => {
        const short = estimateResponseCurves(history, pastChanges, { horizonPatches: 1 });
        expect(short[0].points.map((p) => p.offset)).toEqual([1]);
        expect(short[0].points[0].meanDeltaPp).toBeCloseTo(4, 9);
    });

    it('minSamplesPerPoint is config-driven: threshold 2 clears the 2-sample points', () => {
        const config: PatchOracleConfig = { ...DEFAULT_PATCH_ORACLE_CONFIG, minSamplesPerPoint: 2 };
        const tuned = estimateResponseCurves(history, pastChanges, { config });
        expect(tuned[0].points[0].lowConfidence).toBe(false);
        // The single-sample nerf point stays thin.
        expect(tuned[1].points[0].lowConfidence).toBe(true);
    });

    it('returns no curves on an empty corpus', () => {
        expect(estimateResponseCurves([], pastChanges)).toEqual([]);
    });
});

/** Curve point literal with healthy sample defaults. */
function point(offset: number, meanDeltaPp: number, extra: Partial<ResponseCurvePoint> = {}): ResponseCurvePoint {
    return {
        offset,
        meanDeltaPp,
        samples: 8,
        positiveShare: 0.75,
        ci: { lo: 0.4, hi: 0.93 },
        lowConfidence: false,
        ...extra
    };
}

function curve(
    kind: ResponseCurve['kind'],
    magnitude: ResponseCurve['magnitude'],
    points: ResponseCurvePoint[]
): ResponseCurve {
    return { kind, magnitude, points, samples: 8, experimental: true };
}

const handCurves: ResponseCurve[] = [
    curve('buff', 'major', [point(1, 4), point(2, 9)]),
    curve('nerf', 'moderate', [point(1, -6)])
];

describe('applyOracle — watchlist', () => {
    const changes: PatchChange[] = [
        { championKey: 'x', kind: 'buff', magnitude: 'major', noteFr: 'W 14→10s' },
        { championKey: 'y', kind: 'nerf', magnitude: 'moderate' },
        { championKey: 'z', kind: 'buff', magnitude: 'minor' }
    ];
    const watchlist = applyOracle(changes, handCurves);

    it('orders by |expected delta| desc — a nerf crash outranks a smaller buff spike', () => {
        expect(watchlist.map((e) => e.championKey)).toEqual(['y', 'x', 'z']);
        expect(watchlist[0].expectedPresenceDeltaPp).toBe(-6);
        expect(watchlist[1].expectedPresenceDeltaPp).toBe(4);
        for (const entry of watchlist) expect(entry.experimental).toBe(true);
    });

    it('carries the briefing-offset point: delta, ci, confidence, FR reasons', () => {
        const x = watchlist[1];
        expect(x.ci).toEqual({ lo: 0.4, hi: 0.93 });
        expect(x.lowConfidence).toBe(false);
        expect(x.reasonsFr[0]).toBe('Buff majeur au patch courant — W 14→10s');
        expect(x.reasonsFr[1]).toBe('Courbe historique : +4 pp de présence attendus au patch +1 (n=8)');
    });

    it('no matching curve: delta 0, no ci, lowConfidence, explicit FR reason', () => {
        const z = watchlist[2];
        expect(z.expectedPresenceDeltaPp).toBe(0);
        expect(z.ci).toBeUndefined();
        expect(z.lowConfidence).toBe(true);
        expect(z.reasonsFr[0]).toBe('Buff mineur au patch courant');
        expect(z.reasonsFr[1]).toBe('Aucune courbe historique mesurable pour ce type de changement');
    });

    it('inflation directive follows the magnitude (config-driven)', () => {
        expect(watchlist[1].priorInflation).toEqual({ factor: 4, targetN: 5 });
        expect(watchlist[0].priorInflation).toEqual({ factor: 2.5, targetN: 15 });
        expect(watchlist[2].priorInflation).toEqual({ factor: 1.5, targetN: 30 });

        const config: PatchOracleConfig = {
            ...DEFAULT_PATCH_ORACLE_CONFIG,
            inflationByMagnitude: {
                minor: { factor: 1.1, targetN: 50 },
                moderate: { factor: 2, targetN: 20 },
                major: { factor: 8, targetN: 3 }
            }
        };
        const tuned = applyOracle(changes, handCurves, { config });
        expect(tuned[1].priorInflation).toEqual({ factor: 8, targetN: 3 });
    });

    it('a thin curve point marks the entry and the reason', () => {
        const thinCurves = [curve('buff', 'major', [point(1, 4, { samples: 2, lowConfidence: true })])];
        const [entry] = applyOracle([{ championKey: 'x', kind: 'buff', magnitude: 'major' }], thinCurves);
        expect(entry.lowConfidence).toBe(true);
        expect(entry.reasonsFr[1]).toBe(
            'Courbe historique : +4 pp de présence attendus au patch +1 (n=2, échantillon faible)'
        );
    });

    it('breaks |delta| ties by magnitude rank desc, then champion key asc', () => {
        const tied: PatchChange[] = [
            { championKey: 'm1', kind: 'buff', magnitude: 'minor' },
            { championKey: 'm2', kind: 'nerf', magnitude: 'major' },
            { championKey: 'm0', kind: 'adjust', magnitude: 'minor' }
        ];
        expect(applyOracle(tied, []).map((e) => e.championKey)).toEqual(['m2', 'm0', 'm1']);
    });
});

describe('applyOracle — pocket-signal gating (M5.4 read-only)', () => {
    const changes: PatchChange[] = [
        { championKey: 'x', kind: 'buff', magnitude: 'major' },
        { championKey: 'z', kind: 'buff', magnitude: 'minor' }
    ];
    const pocketSignals = new Map<string, PocketPickContext>([
        // Two reasons → risk 'medium': clears the default gate.
        ['z', { stagePresence: 0.01, recentlyBuffed: true }],
        // No reason → risk 'none': stays silent.
        ['x', { stagePresence: 0.5 }]
    ]);

    it('surfaces the pocket reason only above the configured risk gate', () => {
        const watchlist = applyOracle(changes, handCurves, { pocketSignals });
        const z = watchlist.find((e) => e.championKey === 'z');
        const x = watchlist.find((e) => e.championKey === 'x');
        expect(z?.reasonsFr).toContain(
            'Signal pocket pick (risque moyen) : présence scène faible, buff récent'
        );
        expect(x?.reasonsFr.some((r) => r.startsWith('Signal pocket pick'))).toBe(false);
    });

    it('a stricter gate silences the medium-risk signal', () => {
        const config: PatchOracleConfig = { ...DEFAULT_PATCH_ORACLE_CONFIG, pocketRiskMinimum: 'high' };
        const watchlist = applyOracle(changes, handCurves, { pocketSignals, config });
        const z = watchlist.find((e) => e.championKey === 'z');
        expect(z?.reasonsFr.some((r) => r.startsWith('Signal pocket pick'))).toBe(false);
    });

    it('no signals map → no pocket reasons at all', () => {
        const watchlist = applyOracle(changes, handCurves);
        for (const entry of watchlist) {
            expect(entry.reasonsFr.some((r) => r.startsWith('Signal pocket pick'))).toBe(false);
        }
    });
});

describe('estimateResponseCurves → applyOracle (end to end)', () => {
    it('a new major buff is briefed with the historical +4 pp curve', () => {
        const curves = estimateResponseCurves(history, pastChanges);
        const [entry] = applyOracle([{ championKey: 'nv', kind: 'buff', magnitude: 'major' }], curves);
        expect(entry.expectedPresenceDeltaPp).toBeCloseTo(4, 9);
        expect(entry.ci).toEqual(wilson95(1, 2));
        expect(entry.lowConfidence).toBe(true);
        expect(entry.priorInflation).toEqual(DEFAULT_PATCH_ORACLE_CONFIG.inflationByMagnitude.major);
    });
});
