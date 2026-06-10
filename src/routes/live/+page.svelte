<!--
/**
 * Route /live — match-day view (Sprint D stub; full Mode Match = M8.1).
 *
 * Épuré on purpose: no dataset fetch, no scraping — it only READS the saved
 * series (IndexedDB) and surfaces what matters at the desk: current game of
 * the selected series, both pick rows, bans, the Fearless consumption tracker
 * and the locked-champion count. Amber accent = Match mode (vs blue Prep).
 */
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { resolve } from '$app/paths';
    import { listSeries, type Series, type SeriesGame } from '$lib/storage/series';
    import { championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';
    import ConsumptionTrackerPanel from '$lib/components/ConsumptionTrackerPanel.svelte';
    import { ROLE_LABELS } from '$lib/components/ChampionSlot.svelte';

    const GAME_COUNT: Record<Series['format'], number> = { bo1: 1, bo3: 3, bo5: 5 };

    let allSeries = $state<Series[]>([]);
    let loading = $state(true);
    let selectedId = $state('');

    onMount(() => {
        void load();
    });

    async function load(): Promise<void> {
        loading = true;
        try {
            allSeries = (await listSeries()).sort((a, b) => b.updatedAt - a.updatedAt);
            selectedId = allSeries[0]?.id ?? '';
        } finally {
            loading = false;
        }
    }

    const series = $derived(allSeries.find((s) => s.id === selectedId) ?? null);

    /** Current game = first without a result, else the last played one. */
    const currentGameNumber = $derived.by((): number => {
        if (series === null) return 1;
        const count = GAME_COUNT[series.format];
        for (let n = 1; n <= count; n++) {
            const g = series.games.find((gg) => gg.gameNumber === n);
            if (g === undefined || g.result === null) return n;
        }
        return count;
    });

    const game = $derived.by((): SeriesGame | null => {
        if (series === null) return null;
        return series.games.find((g) => g.gameNumber === currentGameNumber) ?? null;
    });

    const score = $derived.by(() => {
        if (series === null) return { ally: 0, enemy: 0 };
        return {
            ally: series.games.filter((g) => g.result === 'ally').length,
            enemy: series.games.filter((g) => g.result === 'enemy').length
        };
    });

    function padded(keys: string[] | undefined): (string | null)[] {
        return Array.from({ length: 5 }, (_, i) => {
            const k = keys?.[i] ?? '';
            return k === '' ? null : k;
        });
    }

    const allySide = $derived(game?.allySide ?? 'blue');

    const sideBadge = (side: 'blue' | 'red'): { label: string; cls: string } =>
        side === 'blue'
            ? { label: 'BLUE', cls: 'bg-blue-500/15 text-blue-400' }
            : { label: 'RED', cls: 'bg-red-500/15 text-red-400' };
</script>

<svelte:head>
    <title>DraftLab — Live</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-3">
    <section class="rounded-lg border border-amber-900/50 bg-slate-900 p-3">
        <div class="flex flex-wrap items-center gap-3">
            <h1 class="flex items-center gap-2 text-sm font-bold text-amber-300">
                <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400"></span>
                Live — jour de match
            </h1>
            {#if allSeries.length > 1}
                <select
                    bind:value={selectedId}
                    aria-label="Série affichée"
                    class="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                >
                    {#each allSeries as s (s.id)}
                        <option value={s.id}>{s.name}</option>
                    {/each}
                </select>
            {/if}
            <p class="ml-auto text-[10px] text-slate-600">
                Vue épurée V1 — raccourcis clavier et layout « 27 secondes » prévus en M8.1.
            </p>
        </div>
    </section>

    {#if loading}
        <p class="px-1 text-sm text-slate-500">Chargement des séries…</p>
    {:else if series === null}
        <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-500">
            Aucune série enregistrée pour ce match-day.
            <a href={resolve('/series')} class="text-amber-400 hover:underline">Créez-la dans Séries</a>
            pendant la prep, elle apparaîtra ici.
        </div>
    {:else}
        <!-- Scoreline -->
        <section class="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div class="flex flex-wrap items-center justify-center gap-4 text-center">
                <span class="text-xl font-bold text-blue-400">{series.allyTeam || 'Allié'}</span>
                <span class="text-3xl font-bold text-slate-100">{score.ally} – {score.enemy}</span>
                <span class="text-xl font-bold text-red-400">{series.enemyTeam || 'Adverse'}</span>
            </div>
            <p class="pt-1 text-center text-xs text-slate-500">
                {series.name} · <span class="uppercase">{series.format}</span>
                {#if series.mode === 'fearless'}
                    · <span class="font-semibold text-amber-400">Fearless</span>
                {/if}
                · Game en cours : <span class="font-semibold text-slate-300">{currentGameNumber}</span>
            </p>
        </section>

        <!-- Current game picks -->
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            {#each [{ title: series.allyTeam || 'Allié', accent: 'border-blue-900/50', text: 'text-blue-400', side: allySide, picks: padded(game?.allyPicks), bans: padded(game?.allyBans), ring: 'ally' }, { title: series.enemyTeam || 'Adverse', accent: 'border-red-900/50', text: 'text-red-400', side: allySide === 'blue' ? 'red' : 'blue', picks: padded(game?.enemyPicks), bans: padded(game?.enemyBans), ring: 'enemy' }] as col (col.ring)}
                <section class="rounded-lg border bg-slate-900 p-3 {col.accent}">
                    <p class="flex items-center gap-2 pb-2 text-[11px] font-semibold tracking-widest uppercase {col.text}">
                        {col.title}
                        <span class="rounded-full px-2 py-0.5 text-[10px] font-bold {sideBadge(col.side === 'blue' ? 'blue' : 'red').cls}">
                            {sideBadge(col.side === 'blue' ? 'blue' : 'red').label}
                        </span>
                    </p>
                    <div class="space-y-1.5">
                        {#each col.picks as key, i (i)}
                            <div class="flex items-center gap-3">
                                <span class="w-9 text-xs font-bold text-slate-500">{ROLE_LABELS[i]}</span>
                                {#if key !== null}
                                    <ChampionIcon
                                        championKey={key}
                                        size={44}
                                        ring={col.ring === 'ally' ? 'blue' : 'red'}
                                    />
                                    <span class="text-base font-semibold text-slate-100">
                                        {championNameByKey(key) ?? key}
                                    </span>
                                {:else}
                                    <span class="flex h-11 items-center text-sm text-slate-600">—</span>
                                {/if}
                            </div>
                        {/each}
                    </div>
                    <p class="pt-3 pb-1 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Bans</p>
                    <div class="flex gap-1.5">
                        {#each col.bans as ban, i (i)}
                            <span class="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-800/40">
                                {#if ban !== null}
                                    <ChampionIcon championKey={ban} size={28} grayscale />
                                    <span class="absolute text-sm font-bold text-slate-200/90">×</span>
                                {:else}
                                    <span class="text-slate-700">·</span>
                                {/if}
                            </span>
                        {/each}
                    </div>
                </section>
            {/each}
        </div>

        <!-- Fearless tracker -->
        <ConsumptionTrackerPanel {series} />

        <p class="px-1 text-xs text-slate-500">
            Saisie et corrections dans
            <a href={resolve('/series/[id]', { id: series.id })} class="text-amber-400 hover:underline">
                l'éditeur de série
            </a>
            — cette vue est en lecture seule.
        </p>
    {/if}
</div>
