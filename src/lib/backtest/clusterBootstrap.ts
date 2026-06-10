/**
 * Cluster-aware statistics — the run #2 adversarial reviewers' shared
 * requirement (chantiers A, C, D): series games are CORRELATED (same teams,
 * same day, availabilities coupled under Fearless), so a CI that resamples
 * games i.i.d. is too narrow exactly where verdicts get decided. Here the
 * resampling unit is the CLUSTER (series matchId; a seriesless game is its
 * own cluster).
 *
 * Conventions mirror metrics.ts exactly: injected rng (`mulberry32(seed)`),
 * type-7 quantiles, percentile (2.5 %, 97.5 %) interval, paired
 * observations (model vs baseline measured on the SAME unit).
 *
 * Also home of the tie-aware Spearman correlation (chantier C's denial
 * read) — average ranks, Pearson on ranks.
 */

export interface PairedObservation {
    /** Cluster key — series matchId, or the game's own id when seriesless. */
    cluster: string;
    /** Model-side value of the paired statistic (credit, hit, …). */
    model: number;
    /** Baseline-side value on the same unit. */
    baseline: number;
}

export interface ClusterBootstrapOptions {
    /** Number of bootstrap resamples (default 1000). */
    iterations?: number;
    /** Uniform [0, 1) source — REQUIRED and injectable, e.g. mulberry32(seed). */
    rng: () => number;
}

export interface ClusterBootstrapDelta {
    /** mean(model) − mean(baseline) over the full sample. */
    delta: number;
    /** Percentile (2.5 %, 97.5 %) interval of the resampled deltas. */
    ci95: { lo: number; hi: number };
    clusters: number;
    observations: number;
}

/** Type-7 (linear interpolation) quantile of an ascending-sorted array. */
function quantileSorted(sorted: number[], q: number): number {
    if (sorted.length === 0) return NaN;
    const h = (sorted.length - 1) * q;
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

function meanDelta(observations: PairedObservation[]): number {
    if (observations.length === 0) return NaN;
    let model = 0;
    let baseline = 0;
    for (const obs of observations) {
        model += obs.model;
        baseline += obs.baseline;
    }
    return (model - baseline) / observations.length;
}

/**
 * Paired bootstrap CI of mean(model) − mean(baseline), resampled BY CLUSTER:
 * each iteration draws `#clusters` clusters with replacement and keeps every
 * paired observation of each drawn cluster (so within-cluster correlation
 * survives into the resample, widening the CI honestly).
 */
export function clusterBootstrapDeltaCI(
    observations: PairedObservation[],
    options: ClusterBootstrapOptions
): ClusterBootstrapDelta {
    const iterations = Math.max(1, options.iterations ?? 1000);
    const rng = options.rng;

    const byCluster = new Map<string, PairedObservation[]>();
    for (const obs of observations) {
        const bucket = byCluster.get(obs.cluster) ?? [];
        bucket.push(obs);
        byCluster.set(obs.cluster, bucket);
    }
    const clusters = [...byCluster.values()];

    const deltas: number[] = [];
    if (clusters.length > 0) {
        for (let i = 0; i < iterations; i++) {
            const draw: PairedObservation[] = [];
            for (let c = 0; c < clusters.length; c++) {
                const picked = clusters[Math.floor(rng() * clusters.length)];
                for (const obs of picked) draw.push(obs);
            }
            deltas.push(meanDelta(draw));
        }
        deltas.sort((a, b) => a - b);
    }

    return {
        delta: meanDelta(observations),
        ci95: { lo: quantileSorted(deltas, 0.025), hi: quantileSorted(deltas, 0.975) },
        clusters: clusters.length,
        observations: observations.length
    };
}

/** Average ranks (ties share the mean of the positions they span). */
function averageRanks(values: number[]): number[] {
    const order = values
        .map((value, index) => ({ value, index }))
        .sort((a, b) => a.value - b.value);
    const ranks = new Array<number>(values.length);
    let i = 0;
    while (i < order.length) {
        let j = i;
        while (j + 1 < order.length && order[j + 1].value === order[i].value) j++;
        const rank = (i + j) / 2 + 1; // 1-based average rank of the tie block
        for (let k = i; k <= j; k++) ranks[order[k].index] = rank;
        i = j + 1;
    }
    return ranks;
}

/**
 * Spearman rank correlation with average ranks for ties (Pearson on ranks).
 * NaN when n < 2 or either side has zero rank variance.
 */
export function spearman(xs: number[], ys: number[]): number {
    if (xs.length !== ys.length || xs.length < 2) return NaN;
    const rx = averageRanks(xs);
    const ry = averageRanks(ys);
    const n = xs.length;
    const mean = (n + 1) / 2; // ranks always average to (n+1)/2
    let cov = 0;
    let varX = 0;
    let varY = 0;
    for (let i = 0; i < n; i++) {
        const dx = rx[i] - mean;
        const dy = ry[i] - mean;
        cov += dx * dy;
        varX += dx * dx;
        varY += dy * dy;
    }
    if (varX === 0 || varY === 0) return NaN;
    return cov / Math.sqrt(varX * varY);
}
