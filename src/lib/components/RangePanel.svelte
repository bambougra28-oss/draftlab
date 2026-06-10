<!--
/**
 * C1 — Enemy range panel (I1 range model).
 *
 * Renders per-slot RangeEntry[] distributions: a probability bar per
 * champion, the five weighted log-linear components in an expandable row
 * (DA-V2-12: tendance / pool / méta / cohérence / négatif shown separately,
 * never fused), raw-count evidence, and the poker-solver close-group
 * convention — entries inside the close band render NEUTRAL (« choix
 * proches »), color is reserved for clear preferences. When a block carries a
 * surprise read on the actually-played pick, an amber alarm banner flags the
 * broken tendency. Badged « Non calibré » (DA-V2-11: the log-linear weights
 * await the R4 harness).
 */
-->
<script module lang="ts">
    import type { RangeEntry, SurpriseReport } from '$lib/strategic/rangeModel';

    export interface RangeBlockView {
        /** FR slot label, e.g. 'P1 — côté bleu' (prepPack slotLabel). */
        labelFr: string;
        entries: RangeEntry[];
        /** Optional surprise read of the pick actually played on this slot. */
        surprise?: { championKey: string; report: SurpriseReport };
    }
</script>

<script lang="ts">
    import { evidenceString } from '$lib/aggregates/tendency';
    import { championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';

    interface Props {
        blocks: RangeBlockView[];
        title?: string;
        /** Entries rendered per block. */
        maxEntries?: number;
    }

    let { blocks, title = 'Ranges par slot', maxEntries = 6 }: Props = $props();

    const COMPONENT_LABELS: readonly { key: keyof RangeEntry['components']; label: string }[] = [
        { key: 'tendency', label: 'tendance' },
        { key: 'pool', label: 'pool' },
        { key: 'meta', label: 'méta' },
        { key: 'coherence', label: 'cohérence' },
        { key: 'negative', label: 'négatif' }
    ];

    const pct = (p: number): string => `${Math.round(p * 100)} %`;

    const fmtComponent = (value: number): string =>
        `${value >= 0 ? '+' : ''}${value.toFixed(2)}`.replace('.', ',');

    const nameOf = (key: string): string => championNameByKey(key) ?? key;

    /** Close-group size: with ≥ 2 near-equal entries, the call is "too close". */
    const closeCount = (entries: RangeEntry[]): number => entries.filter((e) => e.closeGroup).length;
</script>

<section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
    <h2 class="flex items-center gap-2 pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
        {title}
        <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 normal-case tracking-normal">
            Non calibré
        </span>
    </h2>

    {#if blocks.length === 0}
        <p class="text-xs text-slate-600">Aucune range modélisable — pas de tendance pour ces slots.</p>
    {:else}
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            {#each blocks as block (block.labelFr)}
                {@const close = closeCount(block.entries)}
                <div>
                    <p class="flex items-center gap-2 pb-1 text-xs font-semibold text-slate-300">
                        {block.labelFr}
                        {#if close >= 2}
                            <span class="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                                {close} choix proches
                            </span>
                        {/if}
                    </p>

                    {#if block.surprise !== undefined && block.surprise.report.alarm}
                        <p class="mb-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
                            ⚠ Surprise : {nameOf(block.surprise.championKey)} hors range
                            ({block.surprise.report.bits.toFixed(1).replace('.', ',')} bits) — tendance cassée,
                            re-lire la draft.
                        </p>
                    {/if}

                    <ul class="space-y-1">
                        {#each block.entries.slice(0, maxEntries) as entry (entry.championKey)}
                            <li>
                                <details class="group">
                                    <summary class="flex cursor-pointer items-center gap-2 select-none">
                                        <ChampionIcon championKey={entry.championKey} size={22} />
                                        <span
                                            class="w-24 truncate text-xs {entry.closeGroup
                                                ? 'text-slate-100'
                                                : 'text-slate-500'}"
                                            title={nameOf(entry.championKey)}
                                        >
                                            {nameOf(entry.championKey)}
                                        </span>
                                        <span class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-800">
                                            <span
                                                class="block h-full rounded-full {entry.closeGroup
                                                    ? 'bg-slate-300'
                                                    : 'bg-red-500/50'}"
                                                style="width: {Math.max(2, entry.p * 100)}%"
                                            ></span>
                                        </span>
                                        <span class="w-10 shrink-0 text-right font-mono text-[11px] text-slate-300">
                                            {pct(entry.p)}
                                        </span>
                                        <span class="w-24 shrink-0 text-right text-[10px] text-slate-500">
                                            {evidenceString(entry.evidence)}
                                        </span>
                                    </summary>
                                    <p class="flex flex-wrap gap-1 pt-1 pb-0.5 pl-8">
                                        {#each COMPONENT_LABELS as { key, label } (key)}
                                            <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                                {label}
                                                <span class="font-mono {entry.components[key] > 0
                                                    ? 'text-blue-300'
                                                    : entry.components[key] < 0
                                                      ? 'text-red-300'
                                                      : 'text-slate-500'}"
                                                >
                                                    {fmtComponent(entry.components[key])}
                                                </span>
                                            </span>
                                        {/each}
                                    </p>
                                </details>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/each}
        </div>
        <p class="pt-2 text-[10px] text-slate-600">
            Blanc = choix proches (pas de fausse précision) ; composantes log-linéaires dépliables par champion
            (somme = log-score, p ∝ exp).
        </p>
    {/if}
</section>
