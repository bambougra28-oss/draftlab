<!--
/**
 * Route /series — Bo1/Bo3/Bo5 series list (M7.2, Sprint C).
 *
 * Lists the saved Series (IndexedDB, most recently updated first) with format,
 * mode (Fearless badge), current score and consumption count, plus the create
 * form (name, format, mode, team names). Creating navigates straight to the
 * editor. Local-first (DV4).
 */
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import {
        createSeries,
        deleteSeries,
        listSeries,
        saveSeries,
        type Series,
        type SeriesFormat,
        type SeriesMode
    } from '$lib/storage/series';

    let series = $state<Series[]>([]);
    let loading = $state(true);
    let loadError = $state<string | null>(null);

    let newName = $state('');
    let newFormat = $state<SeriesFormat>('bo3');
    let newMode = $state<SeriesMode>('fearless');
    let newAlly = $state('');
    let newEnemy = $state('');
    let creating = $state(false);

    onMount(() => {
        void refresh();
    });

    async function refresh(): Promise<void> {
        loading = true;
        loadError = null;
        try {
            series = (await listSeries()).sort((a, b) => b.updatedAt - a.updatedAt);
        } catch (error) {
            loadError = error instanceof Error ? error.message : String(error);
        } finally {
            loading = false;
        }
    }

    async function create(): Promise<void> {
        const name = newName.trim();
        if (name === '' || creating) return;
        creating = true;
        try {
            const created = createSeries({
                name,
                format: newFormat,
                mode: newMode,
                allyTeam: newAlly.trim(),
                enemyTeam: newEnemy.trim()
            });
            await saveSeries(created);
            await goto(resolve('/series/[id]', { id: created.id }));
        } finally {
            creating = false;
        }
    }

    async function remove(s: Series): Promise<void> {
        if (!confirm(`Supprimer la série « ${s.name} » ?`)) return;
        await deleteSeries(s.id);
        await refresh();
    }

    function score(s: Series): string {
        const ally = s.games.filter((g) => g.result === 'ally').length;
        const enemy = s.games.filter((g) => g.result === 'enemy').length;
        return `${ally} – ${enemy}`;
    }

    function dateLabel(ms: number): string {
        return new Date(ms).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
</script>

<svelte:head>
    <title>DraftLab — Séries</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-3">
    <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <h1 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
            Nouvelle série
        </h1>
        <form
            class="flex flex-wrap items-end gap-2"
            onsubmit={(e) => {
                e.preventDefault();
                void create();
            }}
        >
            <label class="min-w-44 flex-1">
                <span class="block pb-1 text-xs text-slate-500">Nom</span>
                <input
                    type="text"
                    bind:value={newName}
                    placeholder="Playoffs — demi-finale"
                    class="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                />
            </label>
            <label class="block">
                <span class="block pb-1 text-xs text-slate-500">Format</span>
                <select
                    value={newFormat}
                    onchange={(e) => (newFormat = e.currentTarget.value as SeriesFormat)}
                    class="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                >
                    <option value="bo1">Bo1</option>
                    <option value="bo3">Bo3</option>
                    <option value="bo5">Bo5</option>
                </select>
            </label>
            <label class="block">
                <span class="block pb-1 text-xs text-slate-500">Mode</span>
                <select
                    value={newMode}
                    onchange={(e) => (newMode = e.currentTarget.value as SeriesMode)}
                    class="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                >
                    <option value="fearless">Fearless</option>
                    <option value="standard">Standard</option>
                </select>
            </label>
            <label class="block w-36">
                <span class="block pb-1 text-xs text-slate-500">Équipe alliée</span>
                <input
                    type="text"
                    bind:value={newAlly}
                    placeholder="ZYB"
                    class="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                />
            </label>
            <label class="block w-36">
                <span class="block pb-1 text-xs text-slate-500">Équipe adverse</span>
                <input
                    type="text"
                    bind:value={newEnemy}
                    placeholder="KC"
                    class="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                />
            </label>
            <button
                type="submit"
                disabled={newName.trim() === '' || creating}
                class="rounded-md bg-blue-500/15 px-4 py-1.5 text-sm font-medium text-blue-300 hover:bg-blue-500/25 disabled:opacity-40"
            >
                Créer
            </button>
        </form>
    </section>

    {#if loading}
        <p class="px-1 text-sm text-slate-500">Chargement des séries…</p>
    {:else if loadError !== null}
        <p class="px-1 text-sm text-red-400">Échec de lecture des séries : {loadError}</p>
    {:else if series.length === 0}
        <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
            Aucune série enregistrée. Créez la série du week-end ci-dessus (le Fearless suit la consommation
            de champions game après game).
        </div>
    {:else}
        <ul class="space-y-2">
            {#each series as s (s.id)}
                <li class="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <div class="min-w-0 flex-1">
                        <p class="flex flex-wrap items-center gap-2">
                            <span class="truncate text-sm font-semibold text-slate-100">{s.name}</span>
                            <span class="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase">
                                {s.format}
                            </span>
                            {#if s.mode === 'fearless'}
                                <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                                    Fearless
                                </span>
                            {/if}
                        </p>
                        <p class="pt-1 text-[11px] text-slate-500">
                            <span class="text-blue-400">{s.allyTeam || 'Allié'}</span>
                            vs
                            <span class="text-red-400">{s.enemyTeam || 'Adverse'}</span>
                            · {s.games.length} game{s.games.length > 1 ? 's' : ''} saisi{s.games.length > 1
                                ? 's'
                                : ''} · modifiée le {dateLabel(s.updatedAt)}
                        </p>
                    </div>
                    <span class="text-lg font-bold text-slate-200" title="Score allié – adverse">{score(s)}</span>
                    <span class="flex gap-2">
                        <a
                            href={resolve('/series/[id]', { id: s.id })}
                            class="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
                        >
                            Ouvrir
                        </a>
                        <button
                            type="button"
                            onclick={() => void remove(s)}
                            class="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-red-500/10 hover:text-red-400"
                        >
                            Supprimer
                        </button>
                    </span>
                </li>
            {/each}
        </ul>
    {/if}
</div>
