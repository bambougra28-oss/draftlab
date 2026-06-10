<!--
/**
 * M1/M2 — Global draft winrate bar (bottom band).
 *
 * The analyzer's ally win probability as a split bar: blue fill for the ally
 * share, red for the enemy, a center tick at 50%, and the big percentage
 * (French decimal comma, one decimal — the engine output is continuous).
 * Pure display.
 */
-->
<script lang="ts">
    interface Props {
        /** Ally win probability in [0, 1]. */
        winrate: number;
        label?: string;
    }

    let { winrate, label = 'Win % estimé (draft)' }: Props = $props();

    const clamped = $derived(Math.min(1, Math.max(0, winrate)));
    const display = $derived(`${(clamped * 100).toFixed(1).replace('.', ',')}%`);
    const tone = $derived(clamped > 0.5 ? 'text-blue-300' : clamped < 0.5 ? 'text-red-300' : 'text-slate-200');
</script>

<section class="panel p-3">
    <p class="panel-title pb-1">{label}</p>
    <p class="pb-2 text-3xl font-black tracking-tight {tone}">{display}</p>
    <div class="relative h-2.5 overflow-hidden rounded-full bg-gradient-to-r from-red-600/70 to-red-500/50">
        <div
            class="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-blue-600 to-arcane-500 shadow-[0_0_12px_-2px_rgb(10_200_185/0.8)] transition-[width] duration-500 ease-out"
            style="width: {clamped * 100}%"
        ></div>
        <!-- 50% reference tick -->
        <div class="absolute inset-y-0 left-1/2 w-px bg-gold-200/80"></div>
    </div>
    <div class="flex justify-between pt-1 text-[10px] text-slate-500">
        <span class="font-semibold text-blue-400">Allié</span>
        <span class="font-semibold text-red-400">Adverse</span>
    </div>
</section>
