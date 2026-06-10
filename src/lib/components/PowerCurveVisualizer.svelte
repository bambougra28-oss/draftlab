<!--
/**
 * M4.3 — Power curve visualizer (SVG, no canvas).
 *
 * Two modes: 'team' superimposes the ally (blue) and enemy (red) aggregate
 * curves over the 3 game-length buckets; 'lanes' stacks five per-role mini
 * curves. Y axis fixed to [0.30, 0.70] (typical winrate spread, clamped on
 * extremes), dashed reference line at 50%, circles at data points, missing
 * bucket data renders as a gap in the path. Delta callouts in pp at the
 * bottom and a "fenêtre de domination" line via `dominantBucket`.
 *
 * Bucket labels reflect the dataset's real boundaries (docs/M4_3.md):
 * early <25 min · mid 25–35 · late 35+.
 */
-->
<script lang="ts">
    import {
        POWER_BUCKETS,
        calculateLanePowerCurves,
        calculatePowerCurve,
        dominantBucket,
        type BucketCurve,
        type PowerBucket
    } from '$lib/strategic/powerCurveCalculator';
    import type { Dataset } from '$lib/types';
    import { ROLE_LABELS } from '$lib/components/ChampionSlot.svelte';

    interface Props {
        /** Champion keys ordered by role (0=Top … 4=Support). */
        allyComp: string[];
        enemyComp: string[];
        dataset: Dataset;
        /** Initial mode; the built-in toggle switches it afterwards. */
        mode?: 'team' | 'lanes';
        showModeToggle?: boolean;
    }

    let { allyComp, enemyComp, dataset, mode = 'team', showModeToggle = true }: Props = $props();

    /** User toggle overrides the prop; follows the prop until first interaction. */
    let modeOverride = $state<'team' | 'lanes' | null>(null);
    const activeMode = $derived(modeOverride ?? mode);

    const curve = $derived(calculatePowerCurve(allyComp, enemyComp, dataset));
    const laneCurves = $derived(calculateLanePowerCurves(allyComp, enemyComp, dataset));
    /** Named to avoid shadowing the `window` browser global. */
    const dominance = $derived(dominantBucket(curve));

    const BUCKET_META: Record<PowerBucket, { label: string; range: string }> = {
        early: { label: 'Early', range: '<25 min' },
        mid: { label: 'Mid', range: '25–35 min' },
        late: { label: 'Late', range: '35+ min' }
    };

    // ---- geometry (team chart: 300×150 viewBox) ----
    const W = 300;
    const H = 150;
    const PAD = { left: 34, right: 12, top: 10, bottom: 24 };
    const PLOT_W = W - PAD.left - PAD.right; // 254
    const PLOT_H = H - PAD.top - PAD.bottom; // 116
    const Y_MIN = 0.3;
    const Y_MAX = 0.7;

    function xAt(index: number, width = PLOT_W, left = PAD.left): number {
        return left + (index * width) / (POWER_BUCKETS.length - 1);
    }

    function yAt(winrate: number, height = PLOT_H, top = PAD.top): number {
        const clamped = Math.min(Y_MAX, Math.max(Y_MIN, winrate));
        return top + ((Y_MAX - clamped) / (Y_MAX - Y_MIN)) * height;
    }

    /** Polyline path with gaps where a bucket has no data. */
    function pathFor(bucketCurve: BucketCurve, width = PLOT_W, height = PLOT_H, left = PAD.left, top = PAD.top): string {
        let path = '';
        let penUp = true;
        POWER_BUCKETS.forEach((bucket, i) => {
            const value = bucketCurve[bucket];
            if (value === null) {
                penUp = true;
                return;
            }
            const cmd = penUp ? 'M' : 'L';
            path += `${cmd}${xAt(i, width, left).toFixed(1)},${yAt(value, height, top).toFixed(1)} `;
            penUp = false;
        });
        return path.trim();
    }

    function pointsFor(bucketCurve: BucketCurve, width = PLOT_W, height = PLOT_H, left = PAD.left, top = PAD.top): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];
        POWER_BUCKETS.forEach((bucket, i) => {
            const value = bucketCurve[bucket];
            if (value !== null) points.push({ x: xAt(i, width, left), y: yAt(value, height, top) });
        });
        return points;
    }

    /** Signed delta in percentage points, French decimal comma. */
    function deltaLabel(bucket: PowerBucket): string {
        const ally = curve.ally[bucket];
        const enemy = curve.enemy[bucket];
        if (ally === null || enemy === null) return '—';
        const pp = (ally - enemy) * 100;
        const sign = pp > 0 ? '+' : pp < 0 ? '−' : '';
        return `${sign}${Math.abs(pp).toFixed(1).replace('.', ',')} pp`;
    }

    function deltaClass(bucket: PowerBucket): string {
        const ally = curve.ally[bucket];
        const enemy = curve.enemy[bucket];
        if (ally === null || enemy === null) return 'fill-slate-500';
        if (ally > enemy) return 'fill-emerald-400';
        if (ally < enemy) return 'fill-red-400';
        return 'fill-slate-400';
    }

    // Lane minis: 120×50 viewBox, lighter padding.
    const LANE = { w: 120, h: 50, left: 6, right: 6, top: 4, bottom: 4 };
    const LANE_PLOT_W = LANE.w - LANE.left - LANE.right;
    const LANE_PLOT_H = LANE.h - LANE.top - LANE.bottom;
</script>

<section class="panel p-3">
    <div class="flex items-center justify-between pb-2">
        <h2 class="text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
            Power curve
            <span class="ml-2 normal-case tracking-normal">
                <span class="text-blue-400">● Allié</span>
                <span class="ml-1 text-red-400">● Adverse</span>
            </span>
        </h2>
        {#if showModeToggle}
            <div class="flex gap-1">
                <button
                    type="button"
                    onclick={() => (modeOverride = 'team')}
                    class="rounded px-2 py-0.5 text-xs {activeMode === 'team'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-500 hover:text-slate-300'}"
                >
                    Équipe
                </button>
                <button
                    type="button"
                    onclick={() => (modeOverride = 'lanes')}
                    class="rounded px-2 py-0.5 text-xs {activeMode === 'lanes'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-500 hover:text-slate-300'}"
                >
                    Lanes
                </button>
            </div>
        {/if}
    </div>

    {#if activeMode === 'team'}
        <svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label="Courbes de puissance allié contre adverse">
            <!-- Y axis ticks: 30 / 50 / 70% -->
            {#each [0.3, 0.5, 0.7] as tick (tick)}
                <text x={PAD.left - 6} y={yAt(tick) + 3} text-anchor="end" class="fill-slate-500 text-[8px]">
                    {Math.round(tick * 100)}%
                </text>
            {/each}
            <!-- 50% reference line -->
            <line
                x1={PAD.left}
                y1={yAt(0.5)}
                x2={W - PAD.right}
                y2={yAt(0.5)}
                stroke-dasharray="4 3"
                class="stroke-slate-700"
            />
            <!-- curves -->
            <path d={pathFor(curve.ally)} fill="none" stroke-width="2" class="stroke-blue-500" />
            <path d={pathFor(curve.enemy)} fill="none" stroke-width="2" class="stroke-red-500" />
            {#each pointsFor(curve.ally) as p (p.x)}
                <circle cx={p.x} cy={p.y} r="3" class="fill-blue-500" />
            {/each}
            {#each pointsFor(curve.enemy) as p (p.x)}
                <circle cx={p.x} cy={p.y} r="3" class="fill-red-500" />
            {/each}
            <!-- bucket labels + deltas -->
            {#each POWER_BUCKETS as bucket, i (bucket)}
                <text x={xAt(i)} y={H - 12} text-anchor="middle" class="fill-slate-400 text-[8px]">
                    {BUCKET_META[bucket].label} ({BUCKET_META[bucket].range})
                </text>
                <text x={xAt(i)} y={H - 3} text-anchor="middle" class="text-[8px] {deltaClass(bucket)}">
                    {deltaLabel(bucket)}
                </text>
            {/each}
        </svg>
    {:else}
        <div class="grid grid-cols-1 gap-2">
            {#each laneCurves as lane (lane.role)}
                <div class="flex items-center gap-2">
                    <span class="w-9 shrink-0 text-xs font-bold text-slate-400">{ROLE_LABELS[lane.role]}</span>
                    <svg
                        viewBox="0 0 {LANE.w} {LANE.h}"
                        class="h-12 flex-1"
                        role="img"
                        aria-label="Courbe de la lane {ROLE_LABELS[lane.role]}"
                    >
                        <line
                            x1={LANE.left}
                            y1={yAt(0.5, LANE_PLOT_H, LANE.top)}
                            x2={LANE.w - LANE.right}
                            y2={yAt(0.5, LANE_PLOT_H, LANE.top)}
                            stroke-dasharray="3 3"
                            class="stroke-slate-700"
                        />
                        <path
                            d={pathFor(lane.ally, LANE_PLOT_W, LANE_PLOT_H, LANE.left, LANE.top)}
                            fill="none"
                            stroke-width="1.5"
                            class="stroke-blue-500"
                        />
                        <path
                            d={pathFor(lane.enemy, LANE_PLOT_W, LANE_PLOT_H, LANE.left, LANE.top)}
                            fill="none"
                            stroke-width="1.5"
                            class="stroke-red-500"
                        />
                        {#each pointsFor(lane.ally, LANE_PLOT_W, LANE_PLOT_H, LANE.left, LANE.top) as p (p.x)}
                            <circle cx={p.x} cy={p.y} r="2" class="fill-blue-500" />
                        {/each}
                        {#each pointsFor(lane.enemy, LANE_PLOT_W, LANE_PLOT_H, LANE.left, LANE.top) as p (p.x)}
                            <circle cx={p.x} cy={p.y} r="2" class="fill-red-500" />
                        {/each}
                    </svg>
                </div>
            {/each}
            <p class="text-center text-[10px] text-slate-600">Early · Mid · Late (gauche → droite)</p>
        </div>
    {/if}

    <p class="pt-2 text-xs text-slate-400">
        {#if dominance !== null}
            Fenêtre de domination alliée :
            <span class="font-semibold text-slate-200">
                {BUCKET_META[dominance].label} ({BUCKET_META[dominance].range})
            </span>
        {:else}
            Aucune fenêtre comparable (données insuffisantes).
        {/if}
    </p>
</section>
