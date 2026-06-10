<!--
/**
 * M5.1 — Adversary plan read: evolution stepper + current read.
 *
 * Renders a `detectAdversaryPlan` result: the pick-by-pick evolution of the
 * primary archetype (stepper, one box per revealed pick), the capped current
 * distribution, the convergence flag, the FR adaptive recommendation and the
 * pocket-pick warnings. Pure: the read is computed by the route/engine.
 */
-->
<script lang="ts">
    import type { AdversaryPlanRead } from '$lib/strategic/adversaryPlanDetector';
    import { GAME_PLAN_ARCHETYPES, type GamePlanArchetype } from '$lib/tags/types';
    import type { PocketPickReason } from '$lib/strategic/pocketPickRiskAssessor';
    import { championNameByKey } from '$lib/dataDragon/version';

    interface Props {
        read: AdversaryPlanRead | null;
        title?: string;
    }

    let { read = null, title = 'Lecture adverse' }: Props = $props();

    /** Archetype names stay in draft jargon (Siege/Split/…), capitalized. */
    const ARCHETYPE_LABELS: Record<GamePlanArchetype, string> = {
        siege: 'Siege',
        split: 'Split',
        pick: 'Pick',
        protect: 'Protect',
        engage: 'Engage'
    };

    const REASON_LABELS: Record<PocketPickReason, string> = {
        tagged_low_confidence: 'tag basse confiance',
        low_stage_presence: 'faible présence sur scène',
        recent_buff: 'buff récent'
    };

    const pct = (share: number): string => `${Math.round(share * 100)}%`;
</script>

<section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
    <div class="flex items-center justify-between pb-2">
        <h2 class="text-[11px] font-semibold tracking-widest text-slate-500 uppercase">{title}</h2>
        <span class="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">M5.1</span>
    </div>

    {#if read === null || read.evolution.length === 0}
        <p class="text-xs text-slate-600">Pas encore de pick adverse à lire.</p>
    {:else}
        <!-- Current read headline -->
        <div class="flex items-baseline gap-2 pb-2">
            <span class="text-xl font-bold text-slate-100">{ARCHETYPE_LABELS[read.primary]}</span>
            <span class="text-sm text-slate-400">{pct(read.confidence)}</span>
            {#if read.converged}
                <span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    Convergé
                </span>
            {:else}
                <span class="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    Lecture en cours
                </span>
            {/if}
        </div>

        <!-- Evolution stepper: one box per revealed pick -->
        <div class="flex flex-wrap items-center gap-1 pb-3">
            {#each read.evolution as step, i (step.picks)}
                {#if i > 0}
                    <span class="text-slate-600">→</span>
                {/if}
                <div class="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-center">
                    <p class="text-[10px] text-slate-500">P{step.picks}</p>
                    <p class="text-xs font-semibold text-slate-200">
                        {ARCHETYPE_LABELS[step.primary]}
                        <span class="font-normal text-slate-400">{pct(step.topShare)}</span>
                    </p>
                </div>
            {/each}
        </div>

        <!-- Capped distribution bars -->
        <div class="flex flex-col gap-1 pb-3">
            {#each GAME_PLAN_ARCHETYPES as archetype (archetype)}
                {@const share = read.distribution[archetype]}
                <div class="flex items-center gap-2">
                    <span class="w-14 text-xs {archetype === read.primary ? 'font-semibold text-slate-200' : 'text-slate-500'}">
                        {ARCHETYPE_LABELS[archetype]}
                    </span>
                    <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                        <div class="h-full rounded-full bg-red-500/70" style="width: {share * 100}%"></div>
                    </div>
                    <span class="w-9 text-right text-xs text-slate-400">{pct(share)}</span>
                </div>
            {/each}
        </div>

        <!-- Adaptive recommendation -->
        <p class="rounded-md border-l-2 border-blue-500/60 bg-slate-800/40 px-2 py-1.5 text-xs text-slate-300">
            {read.recommendation}
        </p>

        <!-- Pocket-pick warnings -->
        {#if read.pocketPickWarnings.length > 0}
            <div class="pt-2">
                {#each read.pocketPickWarnings as warning (warning.championKey)}
                    <p class="text-xs text-amber-400">
                        ⚠ {championNameByKey(warning.championKey) ?? warning.championKey}
                        <span class="text-amber-400/70">
                            — {warning.reasons.map((r) => REASON_LABELS[r]).join(', ')}
                        </span>
                    </p>
                {/each}
            </div>
        {/if}
    {/if}
</section>
