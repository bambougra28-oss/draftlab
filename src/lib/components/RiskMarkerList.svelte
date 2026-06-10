<!--
/**
 * M4.4 — Risk markers list.
 *
 * Renders `detectRiskMarkers` output (already sorted critical-first by the
 * detector): a severity chip (⚠ critique / ! attention / ⓘ info — same glyphs
 * as the M4 prototype), the FR message and its rationale. Pure display.
 */
-->
<script lang="ts">
    import type { RiskMarker, RiskSeverity } from '$lib/strategic/riskMarkerDetector';

    interface Props {
        markers: RiskMarker[];
        title?: string;
        emptyLabel?: string;
    }

    let { markers, title = 'Risques', emptyLabel = 'Aucun risque détecté.' }: Props = $props();

    const SEVERITY_META: Record<RiskSeverity, { glyph: string; label: string; chip: string; border: string }> = {
        critical: {
            glyph: '⚠',
            label: 'Critique',
            chip: 'bg-red-500/15 text-red-400',
            border: 'border-red-500/40'
        },
        warning: {
            glyph: '!',
            label: 'Attention',
            chip: 'bg-amber-500/15 text-amber-400',
            border: 'border-amber-500/40'
        },
        info: {
            glyph: 'ⓘ',
            label: 'Info',
            chip: 'bg-slate-700/60 text-slate-300',
            border: 'border-slate-600/60'
        }
    };
</script>

<section class="panel p-3">
    <h2 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
        {title} ({markers.length})
    </h2>

    {#if markers.length === 0}
        <p class="text-xs text-slate-600">{emptyLabel}</p>
    {:else}
        <ul class="flex flex-col gap-2">
            {#each markers as marker (marker.id)}
                <li class="rounded-md border-l-2 bg-slate-800/40 px-2 py-1.5 {SEVERITY_META[marker.severity].border}">
                    <p class="flex items-center gap-2">
                        <span
                            class="rounded-full px-2 py-0.5 text-[10px] font-semibold {SEVERITY_META[marker.severity].chip}"
                        >
                            {SEVERITY_META[marker.severity].glyph}
                            {SEVERITY_META[marker.severity].label}
                        </span>
                        <span class="text-sm font-semibold text-slate-200">{marker.message}</span>
                    </p>
                    <p class="pt-1 text-xs text-slate-400">{marker.rationale}</p>
                </li>
            {/each}
        </ul>
    {/if}
</section>
