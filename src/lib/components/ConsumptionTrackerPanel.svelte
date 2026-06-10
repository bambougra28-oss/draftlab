<!--
/**
 * M7.2 — Fearless consumption tracker (2-column visual).
 *
 * Shows the champions each side has already picked across the series: ally
 * column (blue) and enemy column (red), greyscale icons with the ban-style ×
 * overlay since those champions are locked out for the rest of a Fearless
 * series. In standard mode the panel explains that nothing carries over.
 * Pure: reads the Series object computed by $lib/storage/series.
 */
-->
<script lang="ts">
    import type { Series } from '$lib/storage/series';
    import { championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';

    interface Props {
        series: Series;
    }

    let { series }: Props = $props();

    const lockedCount = $derived(new Set([...series.consumedAlly, ...series.consumedEnemy]).size);
</script>

{#snippet consumedColumn(label: string, accent: string, keys: string[])}
    <div class="min-w-0 flex-1">
        <p class="pb-1 text-[11px] font-semibold tracking-widest uppercase {accent}">
            {label}
            <span class="font-normal text-slate-600">({keys.length})</span>
        </p>
        {#if keys.length === 0}
            <p class="text-xs text-slate-600">Aucun pick enregistré.</p>
        {:else}
            <div class="flex flex-wrap gap-1.5">
                {#each keys as key (key)}
                    <span
                        class="relative inline-flex"
                        title="{championNameByKey(key) ?? key} — consommé"
                    >
                        <ChampionIcon championKey={key} size={30} grayscale />
                        <span
                            class="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-200/90"
                        >
                            ×
                        </span>
                    </span>
                {/each}
            </div>
        {/if}
    </div>
{/snippet}

<section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
    <div class="flex items-center justify-between pb-2">
        <h2 class="text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
            Champions consommés
        </h2>
        {#if series.mode === 'fearless'}
            <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                Fearless
            </span>
        {/if}
    </div>

    <div class="flex gap-4">
        {@render consumedColumn(series.allyTeam || 'Allié', 'text-blue-400', series.consumedAlly)}
        {@render consumedColumn(series.enemyTeam || 'Adverse', 'text-red-400', series.consumedEnemy)}
    </div>

    <p class="pt-2 text-[11px] text-slate-500">
        {#if series.mode === 'fearless'}
            {lockedCount} champion{lockedCount > 1 ? 's' : ''} verrouillé{lockedCount > 1 ? 's' : ''} pour la
            suite de la série.
        {:else}
            Mode standard — aucun report entre les games.
        {/if}
    </p>
</section>
