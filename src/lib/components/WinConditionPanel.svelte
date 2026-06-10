<!--
/**
 * C1 — Bilateral win-condition panel (I3 graph).
 *
 * Renders a WinConditionReport: the 8 axes as signed bars (blue = ally
 * advantage, red = enemy) with their components expandable per axis
 * (DA-V2-12: the components sum to the score and are shown separately), the
 * plan collision as the "vue 27 secondes" box (narrative + observable
 * triggers), and the falsifiable statements. Carries the « Expérimental »
 * badge (DA-V2-11 — the I3 engine awaits its G4 validation). Pure display:
 * the report comes in by prop.
 */
-->
<script lang="ts">
    import type {
        WinConditionConfidence,
        WinConditionReport
    } from '$lib/strategic/winConditionGraph';

    interface Props {
        report: WinConditionReport;
        title?: string;
    }

    let { report, title = 'Conditions de victoire' }: Props = $props();

    const CONFIDENCE_META: Record<WinConditionConfidence, { label: string; cls: string }> = {
        low: { label: 'confiance faible', cls: 'bg-slate-800 text-slate-500' },
        medium: { label: 'confiance moyenne', cls: 'bg-slate-800 text-slate-400' },
        high: { label: 'confiance haute', cls: 'bg-slate-700 text-slate-300' }
    };

    const DIRECTION_LABELS: Record<string, string> = {
        early: 'early',
        mid: 'mid',
        late: 'late',
        axis: 'axe'
    };

    const FALSIFIABLE_LABELS: Record<string, string> = {
        gameLength: 'falsifiable via la durée des parties',
        objectives: 'falsifiable via le contrôle des objectifs',
        none: 'narratif (non falsifiable)'
    };

    /** Bar scale: the largest |score| across axes (floor 1 keeps bars sane). */
    const maxAbs = $derived(Math.max(1, ...report.axes.map((axis) => Math.abs(axis.score))));

    const fmtSigned = (value: number): string =>
        `${value >= 0 ? '+' : ''}${value.toFixed(1)}`.replace('.', ',');

    const widthPct = (score: number): number => Math.min(100, (Math.abs(score) / maxAbs) * 100);

    function planChip(axisId: string): { label: string; cls: string } | null {
        if (report.allyPlan.includes(axisId as (typeof report.allyPlan)[number])) {
            return { label: 'levier allié', cls: 'bg-blue-500/15 text-blue-400' };
        }
        if (report.enemyPlan.includes(axisId as (typeof report.enemyPlan)[number])) {
            return { label: 'levier adverse', cls: 'bg-red-500/15 text-red-400' };
        }
        return null;
    }
</script>

<section class="panel p-3">
    <h2 class="flex items-center gap-2 pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
        {title}
        <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 normal-case tracking-normal">
            Expérimental
        </span>
    </h2>

    <!-- 8 bilateral axes as signed bars + expandable components -->
    <div class="space-y-1">
        {#each report.axes as axis (axis.id)}
            {@const chip = planChip(axis.id)}
            <details class="group rounded-md bg-slate-800/40 px-2 py-1">
                <summary class="flex cursor-pointer items-center gap-2 select-none">
                    <span class="w-44 shrink-0 truncate text-xs text-slate-300" title={axis.labelFr}>
                        {axis.labelFr}
                    </span>
                    <!-- signed bar: red half (enemy) | center | blue half (ally) -->
                    <span class="flex h-2 min-w-0 flex-1 items-center">
                        <span class="flex h-full flex-1 justify-end overflow-hidden rounded-l-sm bg-slate-800">
                            {#if axis.score < 0}
                                <span class="h-full rounded-l-sm bg-red-500/70" style="width: {widthPct(axis.score)}%"></span>
                            {/if}
                        </span>
                        <span class="h-3 w-px shrink-0 bg-slate-600"></span>
                        <span class="flex h-full flex-1 overflow-hidden rounded-r-sm bg-slate-800">
                            {#if axis.score > 0}
                                <span class="h-full rounded-r-sm bg-blue-500/70" style="width: {widthPct(axis.score)}%"></span>
                            {/if}
                        </span>
                    </span>
                    <span class="w-12 shrink-0 text-right font-mono text-xs {axis.score > 0
                        ? 'text-blue-300'
                        : axis.score < 0
                          ? 'text-red-300'
                          : 'text-slate-500'}"
                    >
                        {fmtSigned(axis.score)}
                    </span>
                    {#if chip !== null}
                        <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold {chip.cls}">
                            {chip.label}
                        </span>
                    {/if}
                    <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] {CONFIDENCE_META[axis.confidence].cls}">
                        {CONFIDENCE_META[axis.confidence].label}
                    </span>
                </summary>
                <ul class="space-y-0.5 pt-1.5 pb-0.5 pl-2">
                    {#each axis.components as component, i (i)}
                        <li class="flex items-baseline gap-2 text-[11px]">
                            <span class="font-mono {component.value > 0
                                ? 'text-blue-300'
                                : component.value < 0
                                  ? 'text-red-300'
                                  : 'text-slate-500'}"
                            >
                                {fmtSigned(component.value)}
                            </span>
                            <span class="text-slate-400">{component.reason}</span>
                        </li>
                    {/each}
                </ul>
            </details>
        {/each}
    </div>

    <!-- Collision: the 27-second view -->
    {#if report.collision !== null}
        <div class="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
            <p class="pb-1 text-[10px] font-semibold tracking-widest text-amber-400 uppercase">
                Vue 27 secondes — collision des plans
            </p>
            <p class="text-sm text-slate-200">{report.collision.narrativeFr}</p>
            {#if report.collision.triggers.length > 0}
                <ul class="list-disc space-y-0.5 pt-2 pl-5 text-xs text-slate-400">
                    {#each report.collision.triggers as trigger, i (i)}
                        <li>{trigger}</li>
                    {/each}
                </ul>
            {/if}
            {#if report.collision.riskMarkerIds.length > 0}
                <p class="flex flex-wrap items-center gap-1 pt-2 text-[10px] text-slate-600">
                    Marqueurs de risque liés :
                    {#each report.collision.riskMarkerIds as id (id)}
                        <span class="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-500">{id}</span>
                    {/each}
                </p>
            {/if}
        </div>
    {:else}
        <p class="pt-3 text-xs text-slate-600">
            Collision non lisible : il faut au moins un champion reconnu de chaque côté.
        </p>
    {/if}

    <!-- Falsifiable statements -->
    {#if report.statements.length > 0}
        <div class="pt-3">
            <p class="pb-1 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
                Conditions falsifiables
            </p>
            <ul class="space-y-1.5">
                {#each report.statements as statement, i (i)}
                    <li class="text-xs">
                        <span class="mr-1.5 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400 uppercase">
                            {DIRECTION_LABELS[statement.direction] ?? statement.direction}
                        </span>
                        <span class="text-slate-300">{statement.textFr}</span>
                        <span class="block pt-0.5 pl-1 text-[10px] text-slate-600">
                            {FALSIFIABLE_LABELS[statement.falsifiableVia] ?? statement.falsifiableVia}
                        </span>
                    </li>
                {/each}
            </ul>
        </div>
    {/if}
</section>
