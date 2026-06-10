<!--
/**
 * M4.2 — Game plan distribution card.
 *
 * One team's `classifyGamePlan` result: headline "Engage (64% · haute)" plus
 * the five archetype shares as horizontal bars in the side's accent color
 * (canonical archetype order, like the M4 prototype). The ambiguous flag
 * renders as an amber badge. Pure display.
 */
-->
<script lang="ts">
    import type { GamePlanResult } from '$lib/strategic/gamePlanClassifier';
    import { GAME_PLAN_ARCHETYPES, type GamePlanArchetype } from '$lib/tags/types';

    interface Props {
        plan: GamePlanResult | null;
        title: string;
        accent?: 'blue' | 'red' | 'neutral';
    }

    let { plan = null, title, accent = 'neutral' }: Props = $props();

    const ARCHETYPE_LABELS: Record<GamePlanArchetype, string> = {
        siege: 'Siege',
        split: 'Split',
        pick: 'Pick',
        protect: 'Protect',
        engage: 'Engage'
    };

    const CONFIDENCE_LABELS = { low: 'faible', medium: 'moyenne', high: 'haute' } as const;

    const BAR_CLASS: Record<'blue' | 'red' | 'neutral', string> = {
        blue: 'bg-blue-500/70',
        red: 'bg-red-500/70',
        neutral: 'bg-slate-400/70'
    };

    const TITLE_CLASS: Record<'blue' | 'red' | 'neutral', string> = {
        blue: 'text-blue-400',
        red: 'text-red-400',
        neutral: 'text-slate-400'
    };

    const pct = (share: number): string => `${Math.round(share * 100)}%`;
</script>

<section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
    <h2 class="pb-1 text-[11px] font-semibold tracking-widest uppercase {TITLE_CLASS[accent]}">{title}</h2>

    {#if plan === null}
        <p class="text-xs text-slate-600">Complétez la composition pour lire le plan de jeu.</p>
    {:else}
        <div class="flex items-baseline gap-2 pb-2">
            <span class="text-lg font-bold text-slate-100">{ARCHETYPE_LABELS[plan.primary]}</span>
            <span class="text-sm text-slate-400">
                ({pct(plan.distribution[plan.primary])} · {CONFIDENCE_LABELS[plan.confidence]})
            </span>
            {#if plan.ambiguous}
                <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                    Lecture ambiguë
                </span>
            {/if}
        </div>
        <p class="pb-2 text-[11px] text-slate-500">
            Secondaire : {ARCHETYPE_LABELS[plan.secondary]} ({pct(plan.distribution[plan.secondary])})
        </p>

        <div class="flex flex-col gap-1">
            {#each GAME_PLAN_ARCHETYPES as archetype (archetype)}
                {@const share = plan.distribution[archetype]}
                <div class="flex items-center gap-2">
                    <span
                        class="w-14 text-xs {archetype === plan.primary
                            ? 'font-semibold text-slate-200'
                            : 'text-slate-500'}"
                    >
                        {ARCHETYPE_LABELS[archetype]}
                    </span>
                    <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                        <div class="h-full rounded-full {BAR_CLASS[accent]}" style="width: {share * 100}%"></div>
                    </div>
                    <span class="w-9 text-right text-xs text-slate-400">{pct(share)}</span>
                </div>
            {/each}
        </div>
    {/if}
</section>
