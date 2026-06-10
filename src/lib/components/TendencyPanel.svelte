<!--
/**
 * C1 — Conditional tendency panel (R4 tables).
 *
 * Renders the team-filtered tendency table per (rotation, side) context with
 * probability bars and the coach-facing raw-count evidence (« 4 des 6
 * dernières » — counts, never logits), plus the first-rotation pick profiles
 * of the champions the table surfaces. The module script exports
 * `tendencyBlocksOf` so routes reuse the exact same context blocks for the
 * prep-pack / CSV exports. Badged « Non calibré » (DA-V2-11: α and λ are
 * behaviour defaults until the R4 harness calibrates them).
 */
-->
<script module lang="ts">
    import {
        evidenceString,
        predict,
        type SlotGroup,
        type TendencyPrediction,
        type TendencyTable
    } from '$lib/aggregates/tendency';
    import type { DraftSide } from '$lib/data/types';

    export interface TendencyBlockView {
        /** FR context label, e.g. 'P1 — côté bleu' (prepPack contextLabel). */
        contextLabel: string;
        predictions: TendencyPrediction[];
    }

    /** Contexts shown in draft order; only non-empty cells produce a block. */
    const CONTEXTS: readonly { slotGroup: SlotGroup; side: DraftSide }[] = [
        { slotGroup: 'B1-B3', side: 'blue' },
        { slotGroup: 'B1-B3', side: 'red' },
        { slotGroup: 'P1', side: 'blue' },
        { slotGroup: 'P1', side: 'red' },
        { slotGroup: 'P2-3', side: 'blue' },
        { slotGroup: 'P2-3', side: 'red' }
    ];

    /** Top-k predictions per non-empty prep context — shared with exports. */
    export function tendencyBlocksOf(table: TendencyTable, topK = 5): TendencyBlockView[] {
        const blocks: TendencyBlockView[] = [];
        for (const { slotGroup, side } of CONTEXTS) {
            const predictions = predict(table, { slotGroup, side }).slice(0, topK);
            if (predictions.length === 0) continue;
            blocks.push({
                contextLabel: `${slotGroup} — côté ${side === 'blue' ? 'bleu' : 'rouge'}`,
                predictions
            });
        }
        return blocks;
    }
</script>

<script lang="ts">
    import { rotationProfile } from '$lib/aggregates/rotations';
    import type { DraftRecord } from '$lib/data/types';
    import { championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';

    interface Props {
        table: TendencyTable;
        /** Same corpus the table was built from — feeds the rotation profiles. */
        records?: DraftRecord[];
        title?: string;
        /** Predictions kept per context. */
        topK?: number;
    }

    let { table, records = [], title = 'Tendances adverses', topK = 5 }: Props = $props();

    const blocks = $derived(tendencyBlocksOf(table, topK));

    /** First-rotation profiles of every champion the pick blocks surface. */
    const profiles = $derived.by(() => {
        if (records.length === 0) return [];
        const keys = [
            ...new Set(
                blocks
                    .filter((block) => !block.contextLabel.startsWith('B')) // pick rotations only
                    .flatMap((block) => block.predictions.map((p) => p.championKey))
            )
        ];
        return keys
            .map((key) => rotationProfile(records, key))
            .filter((profile) => profile.total > 0)
            .sort((a, b) => b.total - a.total || (a.championKey < b.championKey ? -1 : 1))
            .slice(0, 8);
    });

    const pct = (p: number): string => `${Math.round(p * 100)} %`;

    const nameOf = (key: string): string => championNameByKey(key) ?? key;
</script>

<section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
    <h2 class="flex items-center gap-2 pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
        {title}
        <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 normal-case tracking-normal">
            Non calibré
        </span>
    </h2>

    {#if blocks.length === 0}
        <p class="text-xs text-slate-600">
            Aucune tendance exploitable — synchronisez une équipe avec des drafts récentes.
        </p>
    {:else}
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            {#each blocks as block (block.contextLabel)}
                <div>
                    <p class="pb-1 text-xs font-semibold text-slate-300">{block.contextLabel}</p>
                    <ul class="space-y-1">
                        {#each block.predictions as prediction (prediction.championKey)}
                            <li class="flex items-center gap-2">
                                <ChampionIcon championKey={prediction.championKey} size={22} />
                                <span class="w-24 truncate text-xs text-slate-300" title={nameOf(prediction.championKey)}>
                                    {nameOf(prediction.championKey)}
                                </span>
                                <span class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-800">
                                    <span
                                        class="block h-full rounded-full bg-blue-500/70"
                                        style="width: {Math.max(2, prediction.p * 100)}%"
                                    ></span>
                                </span>
                                <span class="w-10 shrink-0 text-right font-mono text-[11px] text-slate-300">
                                    {pct(prediction.p)}
                                </span>
                                <span class="w-28 shrink-0 text-right text-[10px] text-slate-500">
                                    {evidenceString(prediction)}
                                </span>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/each}
        </div>

        {#if profiles.length > 0}
            <div class="pt-3">
                <p class="pb-1 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
                    Profils de rotation (picks)
                </p>
                <ul class="flex flex-wrap gap-1.5">
                    {#each profiles as profile (profile.championKey)}
                        <li
                            class="flex items-center gap-1.5 rounded-md bg-slate-800/70 py-0.5 pr-2 pl-0.5"
                            title="{nameOf(profile.championKey)} — {profile.total} pick{profile.total > 1 ? 's' : ''}"
                        >
                            <ChampionIcon championKey={profile.championKey} size={20} />
                            <span class="text-[11px] text-slate-300">{nameOf(profile.championKey)}</span>
                            <span class="text-[10px] text-slate-500">
                                1<sup>re</sup> rotation {pct(profile.firstRotationRate)}
                            </span>
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}

        <p class="pt-2 text-[10px] text-slate-600">
            Lecture : « n des N dernières » = comptes bruts d'actions dans ce contexte (rotation, side).
        </p>
    {/if}
</section>
