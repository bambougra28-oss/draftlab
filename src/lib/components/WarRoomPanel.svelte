<!--
/**
 * C1 — Fearless war room panel (I4 series solver).
 *
 * Renders the between-games budget view: pool-integrity gauges for BOTH
 * teams (Monte-Carlo share of complete comps still sampleable, per-role
 * remaining counts, bottleneck role, below-minimum flags), the series value
 * with the First Selection side|pick arbitrage when the holder is known, and
 * the spend-vs-save table — Maintenant / Option future / Net / Déni shown as
 * SEPARATE components (DA-V2-12), denial rendered « non chiffré » when no
 * want model is injected (never zeroed). Badged « Expérimental » (DA-V2-11:
 * the solver edges await the R9 calibration). Pure display: every result
 * comes in by prop.
 */
-->
<script lang="ts">
    import type {
        MustWinAnalysis,
        PoolIntegrityResult,
        SeriesValueResult
    } from '$lib/strategic/seriesSolver';
    import { championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';
    import { ROLE_LABELS } from '$lib/components/ChampionSlot.svelte';

    interface Props {
        integrityAlly: PoolIntegrityResult;
        integrityEnemy: PoolIntegrityResult;
        series: SeriesValueResult;
        mustWin: MustWinAnalysis;
        title?: string;
    }

    let { integrityAlly, integrityEnemy, series, mustWin, title = 'War room — budget de série' }: Props = $props();

    const pct = (p: number): string => `${Math.round(p * 100)} %`;

    const pp = (value: number): string =>
        `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} pp`.replace('.', ',');

    const nameOf = (key: string): string => championNameByKey(key) ?? key;

    const gauges = $derived([
        { label: 'Pool allié', result: integrityAlly, bar: 'bg-blue-500/70', accent: 'text-blue-400' },
        { label: 'Pool adverse', result: integrityEnemy, bar: 'bg-red-500/70', accent: 'text-red-400' }
    ]);
</script>

<section class="panel p-3">
    <h2 class="flex items-center gap-2 pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
        {title}
        <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 normal-case tracking-normal">
            Expérimental
        </span>
        {#if mustWin.isMustWin}
            <span class="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300 normal-case tracking-normal">
                MUST-WIN
            </span>
        {/if}
    </h2>

    <!-- Pool integrity gauges, both teams -->
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        {#each gauges as gauge (gauge.label)}
            <div class="rounded-md bg-slate-800/40 p-2">
                <p class="flex items-baseline justify-between pb-1">
                    <span class="text-xs font-semibold {gauge.accent}">{gauge.label}</span>
                    <span class="font-mono text-sm text-slate-200">{pct(gauge.result.integrity)}</span>
                </p>
                <div class="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div class="h-full rounded-full {gauge.bar}" style="width: {gauge.result.integrity * 100}%"></div>
                </div>
                <p class="flex flex-wrap gap-1 pt-1.5">
                    {#each gauge.result.byRole as roleRow (roleRow.role)}
                        <span
                            class="rounded px-1.5 py-0.5 text-[10px] {roleRow.belowMinimum
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-slate-800 text-slate-400'} {roleRow.role === gauge.result.bottleneckRole
                                ? 'ring-1 ring-amber-500/60'
                                : ''}"
                            title="{roleRow.failures} échec(s) d'échantillonnage sur ce rôle"
                        >
                            {ROLE_LABELS[roleRow.role]}
                            {roleRow.remaining}
                            {#if roleRow.role === gauge.result.bottleneckRole}· goulot{/if}
                            {#if roleRow.belowMinimum}· sous min{/if}
                        </span>
                    {/each}
                </p>
                <p class="pt-1 text-[10px] text-slate-600">
                    Comps complètes encore composables ({gauge.result.samples} tirages Monte-Carlo).
                </p>
            </div>
        {/each}
    </div>

    <!-- Series value + First Selection advice -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3">
        <p class="text-sm text-slate-300">
            P(série gagnée) :
            <span class="font-mono font-semibold text-slate-100">{pct(series.value)}</span>
            {#if series.components !== null}
                <span class="pl-1 text-[10px] text-slate-600">
                    (p game {pct(series.components.pUsed)} · V si victoire {pct(series.components.winBranchValue)} ·
                    V si défaite {pct(series.components.loseBranchValue)})
                </span>
            {/if}
        </p>
        <p class="text-[11px] text-slate-500">
            Victoire dans {mustWin.gamesToVictory} win{mustWin.gamesToVictory > 1 ? 's' : ''} ·
            élimination dans {mustWin.gamesToElimination} défaite{mustWin.gamesToElimination > 1 ? 's' : ''}.
        </p>
    </div>

    {#if series.firstSelection !== null}
        {@const fs = series.firstSelection}
        <div class="mt-2 rounded-md border border-slate-700 bg-slate-800/40 px-2.5 py-2">
            <p class="text-xs text-slate-300">
                <span class="font-semibold {fs.holder === 'ally' ? 'text-blue-400' : 'text-red-400'}">
                    First Selection {fs.holder === 'ally' ? 'alliée' : 'adverse'}
                </span>
                — choix conseillé pour son détenteur :
                <span class="font-semibold text-slate-100">
                    {fs.recommended === 'side' ? 'prendre son side' : 'prendre le first pick'}
                </span>
            </p>
            <p class="pt-0.5 text-[10px] text-slate-500">
                V(série) si side {pct(fs.valueSide)} · si first pick {pct(fs.valuePick)} — vu de notre côté.
            </p>
        </div>
    {/if}

    {#if mustWin.puntRecommendationFr !== undefined}
        <p class="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-300">
            {mustWin.puntRecommendationFr}
        </p>
    {/if}

    <!-- Spend vs save table -->
    {#if mustWin.spendVsSave.length > 0}
        <div class="overflow-x-auto pt-3">
            <p class="pb-1 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
                Dépenser ou garder (meilleurs atouts alliés)
            </p>
            <table class="w-full min-w-[40rem] text-left text-xs">
                <thead>
                    <tr class="text-[10px] text-slate-500 uppercase">
                        <th class="py-1 pr-2 font-semibold">Champion</th>
                        <th class="py-1 pr-2 font-semibold">Rôle</th>
                        <th class="py-1 pr-2 font-semibold" title="Gain d'équité sur la game courante">Maintenant</th>
                        <th class="py-1 pr-2 font-semibold" title="Valeur d'option des games futures">Option future</th>
                        <th class="py-1 pr-2 font-semibold">Net</th>
                        <th class="py-1 pr-2 font-semibold" title="Prix de déni Benoît-Krishna">Déni</th>
                        <th class="py-1 font-semibold">Verdict</th>
                    </tr>
                </thead>
                <tbody>
                    {#each mustWin.spendVsSave as row (row.championKey)}
                        <tr class="border-t border-slate-800">
                            <td class="py-1.5 pr-2">
                                <span class="flex items-center gap-1.5">
                                    <ChampionIcon championKey={row.championKey} size={20} />
                                    <span class="text-slate-200">{nameOf(row.championKey)}</span>
                                </span>
                            </td>
                            <td class="py-1.5 pr-2 text-slate-400">{ROLE_LABELS[row.role]}</td>
                            <td class="py-1.5 pr-2 font-mono {row.retention.nowGain >= 0 ? 'text-blue-300' : 'text-red-300'}">
                                {pp(row.retention.nowGain)}
                            </td>
                            <td class="py-1.5 pr-2 font-mono {row.retention.futureLoss >= 0 ? 'text-blue-300' : 'text-red-300'}">
                                {pp(row.retention.futureLoss)}
                            </td>
                            <td class="py-1.5 pr-2 font-mono font-semibold {row.retention.net >= 0 ? 'text-blue-300' : 'text-red-300'}">
                                {pp(row.retention.net)}
                            </td>
                            <td class="py-1.5 pr-2 font-mono {row.denial === null ? 'text-slate-500' : 'text-slate-300'}">
                                {row.denial === null ? 'non chiffré' : pp(row.denial.total)}
                            </td>
                            <td class="py-1.5 text-slate-400">{row.verdictFr}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
            <p class="pt-1 text-[10px] text-slate-600">
                Maintenant + Option future = Net (composantes affichées séparément, jamais fusionnées). Déni «
                non chiffré » = aucun modèle de tendances adverse branché sur cette page.
            </p>
        </div>
    {/if}
</section>
