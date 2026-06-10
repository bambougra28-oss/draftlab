<!--
/**
 * Route /plans — Plan A/B/C list (M6.2, Sprint A).
 *
 * Lists the saved DraftPlans (IndexedDB, most recently updated first) with a
 * picks summary, and a create form (DA1: free-form naming — "Plan A vs KC",
 * "Anti-Engage G3"…). Creating a plan persists it immediately and navigates to
 * the editor. Local-first (DV4): everything stays in the browser.
 */
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import {
        createDraftPlan,
        deleteDraftPlan,
        listDraftPlans,
        saveDraftPlan,
        type DraftPlan
    } from '$lib/storage/draftPlans';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';

    let plans = $state<DraftPlan[]>([]);
    let loading = $state(true);
    let loadError = $state<string | null>(null);

    let newName = $state('');
    let newSide = $state<'none' | 'blue' | 'red'>('none');
    let creating = $state(false);

    onMount(() => {
        void refresh();
    });

    async function refresh(): Promise<void> {
        loading = true;
        loadError = null;
        try {
            plans = (await listDraftPlans()).sort((a, b) => b.updatedAt - a.updatedAt);
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
            const plan = createDraftPlan({
                name,
                ...(newSide !== 'none' ? { side: newSide } : {})
            });
            await saveDraftPlan(plan);
            await goto(resolve('/plans/[id]', { id: plan.id }));
        } finally {
            creating = false;
        }
    }

    async function remove(plan: DraftPlan): Promise<void> {
        if (!confirm(`Supprimer le plan « ${plan.name} » ?`)) return;
        await deleteDraftPlan(plan.id);
        await refresh();
    }

    function primaryKeys(plan: DraftPlan): string[] {
        return plan.picks
            .map((p) => p.primary)
            .filter((k): k is string => k !== null);
    }

    function gamesLabel(plan: DraftPlan): string | null {
        if (!plan.applicableGames || plan.applicableGames.length === 0) return null;
        return plan.applicableGames.map((g) => `G${g}`).join(' · ');
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
    <title>DraftLab — Plans</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-3">
    <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <h1 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
            Nouveau plan de draft
        </h1>
        <form
            class="flex flex-wrap items-end gap-2"
            onsubmit={(e) => {
                e.preventDefault();
                void create();
            }}
        >
            <label class="min-w-48 flex-1">
                <span class="block pb-1 text-xs text-slate-500">Nom (libre — « Plan A vs KC », « Anti-Engage »…)</span>
                <input
                    type="text"
                    bind:value={newName}
                    placeholder="Plan A"
                    class="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                />
            </label>
            <label class="block">
                <span class="block pb-1 text-xs text-slate-500">Side visé</span>
                <select
                    value={newSide}
                    onchange={(e) => (newSide = e.currentTarget.value as 'none' | 'blue' | 'red')}
                    class="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                >
                    <option value="none">Indifférent</option>
                    <option value="blue">Bleu</option>
                    <option value="red">Rouge</option>
                </select>
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
        <p class="px-1 text-sm text-slate-500">Chargement des plans…</p>
    {:else if loadError !== null}
        <p class="px-1 text-sm text-red-400">Échec de lecture des plans : {loadError}</p>
    {:else if plans.length === 0}
        <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
            Aucun plan enregistré. Créez votre Plan A ci-dessus, puis ses variantes B/C.
        </div>
    {:else}
        <ul class="space-y-2">
            {#each plans as plan (plan.id)}
                <li class="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <div class="min-w-0 flex-1">
                        <p class="flex flex-wrap items-center gap-2">
                            <span class="truncate text-sm font-semibold text-slate-100">{plan.name}</span>
                            {#if plan.side !== undefined}
                                <span
                                    class="rounded-full px-2 py-0.5 text-[10px] font-bold {plan.side === 'blue'
                                        ? 'bg-blue-500/15 text-blue-400'
                                        : 'bg-red-500/15 text-red-400'}"
                                >
                                    {plan.side === 'blue' ? 'BLUE' : 'RED'}
                                </span>
                            {/if}
                            {#if gamesLabel(plan) !== null}
                                <span class="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                                    {gamesLabel(plan)}
                                </span>
                            {/if}
                        </p>
                        <p class="pt-1 text-[11px] text-slate-500">
                            Modifié le {dateLabel(plan.updatedAt)} · stockage local (IndexedDB)
                        </p>
                    </div>
                    <span class="flex gap-0.5">
                        {#if primaryKeys(plan).length === 0}
                            <span class="text-xs text-slate-600">Aucun pick planifié</span>
                        {:else}
                            {#each primaryKeys(plan) as key (key)}
                                <ChampionIcon championKey={key} size={24} />
                            {/each}
                        {/if}
                    </span>
                    <span class="flex gap-2">
                        <a
                            href={resolve('/plans/[id]', { id: plan.id })}
                            class="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
                        >
                            Ouvrir
                        </a>
                        <button
                            type="button"
                            onclick={() => void remove(plan)}
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
