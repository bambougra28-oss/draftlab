<!--
/**
 * Route /plans/[id] — DraftPlan editor (M6.2, Sprint A).
 *
 * Editor for one plan: free-form name, target side, applicable games (DA1 link
 * to series game numbers), 5 ban slots, and 5 pick rows (primary + fallback +
 * rationale per role). Champion choice goes through a search-driven
 * ChampionPicker overlay; champions already used anywhere in the plan are
 * disabled to prevent accidental duplicates. Every mutation persists
 * immediately to IndexedDB ($state.snapshot strips the reactive proxies before
 * the structured clone); text fields persist on change (blur/commit).
 */
-->
<script lang="ts">
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { Role } from '$lib/types';
    import {
        deleteDraftPlan,
        getDraftPlan,
        saveDraftPlan,
        type DraftPlan
    } from '$lib/storage/draftPlans';
    import { championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';
    import ChampionPicker from '$lib/components/ChampionPicker.svelte';
    import { ROLE_LABELS } from '$lib/components/ChampionSlot.svelte';

    let plan = $state<DraftPlan | null>(null);
    let loading = $state(true);
    let loadError = $state<string | null>(null);
    let saving = $state(false);
    let savedAt = $state<number | null>(null);

    type PickerTarget =
        | { kind: 'ban'; index: number }
        | { kind: 'primary' | 'fallback'; role: Role };
    let target = $state<PickerTarget | null>(null);

    const planId = $derived(page.params.id ?? '');

    $effect(() => {
        const id = planId;
        if (id !== '') void load(id);
    });

    async function load(id: string): Promise<void> {
        loading = true;
        loadError = null;
        try {
            plan = (await getDraftPlan(id)) ?? null;
        } catch (error) {
            loadError = error instanceof Error ? error.message : String(error);
        } finally {
            loading = false;
        }
    }

    async function persist(): Promise<void> {
        if (plan === null) return;
        saving = true;
        try {
            plan = await saveDraftPlan($state.snapshot(plan) as DraftPlan);
            savedAt = Date.now();
        } finally {
            saving = false;
        }
    }

    async function removePlan(): Promise<void> {
        if (plan === null) return;
        if (!confirm(`Supprimer le plan « ${plan.name} » ?`)) return;
        await deleteDraftPlan(plan.id);
        await goto(resolve('/plans'));
    }

    /** Keys already used anywhere in the plan (bans + primaries + fallbacks). */
    const usedKeys = $derived.by((): string[] => {
        if (plan === null) return [];
        return [
            ...plan.bans.map((b) => b.championKey),
            ...plan.picks.flatMap((p) => [p.primary, p.fallback])
        ].filter((k): k is string => k !== null);
    });

    const targetTitle = $derived.by((): string => {
        if (target === null) return '';
        if (target.kind === 'ban') return `Ban — slot ${target.index + 1}`;
        return `${target.kind === 'primary' ? 'Pick principal' : 'Fallback'} — ${ROLE_LABELS[target.role]}`;
    });

    /** Champion currently held by the targeted slot (enables "Retirer"). */
    const targetKey = $derived.by((): string | null => {
        const t = target;
        if (plan === null || t === null) return null;
        if (t.kind === 'ban') return plan.bans[t.index]?.championKey ?? null;
        const row = plan.picks.find((p) => p.role === t.role);
        if (row === undefined) return null;
        return t.kind === 'primary' ? row.primary : row.fallback;
    });

    /** Write a champion (or null) into a plan slot, then persist. */
    function writeSlot(slot: PickerTarget, championKey: string | null): void {
        if (plan === null) return;
        if (slot.kind === 'ban') {
            plan.bans[slot.index] = { ...plan.bans[slot.index], championKey };
        } else {
            const row = plan.picks.find((p) => p.role === slot.role);
            if (row !== undefined) {
                if (slot.kind === 'primary') row.primary = championKey;
                else row.fallback = championKey;
            }
        }
        void persist();
    }

    function applySelection(championKey: string | null): void {
        if (target === null) return;
        writeSlot(target, championKey);
        target = null;
    }

    function toggleGame(game: number): void {
        if (plan === null) return;
        const current = plan.applicableGames ?? [];
        const next = current.includes(game)
            ? current.filter((g) => g !== game)
            : [...current, game].sort((a, b) => a - b);
        plan.applicableGames = next.length > 0 ? next : undefined;
        void persist();
    }

    function setSide(value: string): void {
        if (plan === null) return;
        plan.side = value === 'blue' || value === 'red' ? value : undefined;
        void persist();
    }
</script>

<svelte:head>
    <title>DraftLab — Plan {plan?.name ?? ''}</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-3">
    <p>
        <a href={resolve('/plans')} class="text-xs text-slate-500 hover:text-slate-300">← Tous les plans</a>
    </p>

    {#if loading}
        <p class="px-1 text-sm text-slate-500">Chargement du plan…</p>
    {:else if loadError !== null}
        <p class="px-1 text-sm text-red-400">Échec de lecture : {loadError}</p>
    {:else if plan === null}
        <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
            Plan introuvable — il a peut-être été supprimé.
        </div>
    {:else}
        <!-- Metadata -->
        <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <div class="flex flex-wrap items-end gap-3">
                <label class="min-w-48 flex-1">
                    <span class="block pb-1 text-xs text-slate-500">Nom du plan</span>
                    <input
                        type="text"
                        bind:value={plan.name}
                        onchange={() => void persist()}
                        class="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-100 focus:border-blue-500 focus:outline-none"
                    />
                </label>
                <label class="block">
                    <span class="block pb-1 text-xs text-slate-500">Side visé</span>
                    <select
                        value={plan.side ?? 'none'}
                        onchange={(e) => setSide(e.currentTarget.value)}
                        class="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                    >
                        <option value="none">Indifférent</option>
                        <option value="blue">Bleu</option>
                        <option value="red">Rouge</option>
                    </select>
                </label>
                <div>
                    <span class="block pb-1 text-xs text-slate-500">Games visés (série)</span>
                    <div class="flex gap-1">
                        {#each [1, 2, 3, 4, 5] as game (game)}
                            <button
                                type="button"
                                onclick={() => toggleGame(game)}
                                class="rounded px-2 py-1 text-xs font-semibold {(plan.applicableGames ?? []).includes(game)
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-slate-800 text-slate-500 hover:text-slate-300'}"
                            >
                                G{game}
                            </button>
                        {/each}
                    </div>
                </div>
                <button
                    type="button"
                    onclick={() => void removePlan()}
                    class="rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-red-500/10 hover:text-red-400"
                >
                    Supprimer
                </button>
            </div>
            <p class="pt-2 text-[11px] text-slate-600">
                {#if saving}
                    Enregistrement…
                {:else if savedAt !== null}
                    Enregistré ✓ — stockage local (IndexedDB)
                {:else}
                    Modifications enregistrées automatiquement (IndexedDB local).
                {/if}
                {#if (plan.applicableGames ?? []).length === 0}
                    · Aucun game coché = applicable à tous les games.
                {/if}
            </p>
        </section>

        <!-- Bans -->
        <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <h2 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
                Bans planifiés
            </h2>
            <div class="flex flex-wrap gap-2">
                {#each plan.bans as ban, index (index)}
                    <div class="flex items-center gap-1">
                        <button
                            type="button"
                            onclick={() => (target = { kind: 'ban', index })}
                            class="relative flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-slate-800/60 hover:border-slate-500"
                            title={ban.championKey !== null
                                ? `Ban ${index + 1} : ${championNameByKey(ban.championKey) ?? ban.championKey}`
                                : `Choisir le ban ${index + 1}`}
                        >
                            {#if ban.championKey !== null}
                                <ChampionIcon championKey={ban.championKey} size={36} grayscale />
                                <span class="absolute text-base font-bold text-slate-200/90">×</span>
                            {:else}
                                <span class="text-slate-600">{index + 1}</span>
                            {/if}
                        </button>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Picks -->
        <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <h2 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
                Picks planifiés (principal + fallback)
            </h2>
            <div class="space-y-2">
                {#each plan.picks as row (row.role)}
                    <div class="flex flex-wrap items-center gap-2 border-t border-slate-800/60 pt-2 first:border-t-0 first:pt-0">
                        <span class="w-10 shrink-0 text-xs font-bold text-slate-400">{ROLE_LABELS[row.role]}</span>

                        {#each [{ kind: 'primary' as const, key: row.primary, label: 'Principal' }, { kind: 'fallback' as const, key: row.fallback, label: 'Fallback' }] as slot (slot.kind)}
                            <div class="flex w-44 items-center gap-1.5">
                                <button
                                    type="button"
                                    onclick={() => (target = { kind: slot.kind, role: row.role })}
                                    class="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950/40 px-1.5 py-1 text-left hover:border-slate-600"
                                >
                                    {#if slot.key !== null}
                                        <ChampionIcon championKey={slot.key} size={24} />
                                        <span class="truncate text-xs text-slate-200">
                                            {championNameByKey(slot.key) ?? slot.key}
                                        </span>
                                    {:else}
                                        <span class="text-xs text-slate-600">{slot.label}…</span>
                                    {/if}
                                </button>
                                {#if slot.key !== null}
                                    <button
                                        type="button"
                                        onclick={() => writeSlot({ kind: slot.kind, role: row.role }, null)}
                                        class="shrink-0 rounded px-1 text-slate-600 hover:bg-slate-800 hover:text-slate-300"
                                        title="Retirer"
                                        aria-label="Retirer le {slot.label} {ROLE_LABELS[row.role]}"
                                    >
                                        ×
                                    </button>
                                {/if}
                            </div>
                        {/each}

                        <input
                            type="text"
                            bind:value={row.rationale}
                            onchange={() => void persist()}
                            placeholder="Justification (matchup, win condition…)"
                            class="min-w-40 flex-1 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1 text-xs text-slate-300 placeholder:text-slate-700 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                {/each}
            </div>
        </section>

        <!-- Notes -->
        <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <h2 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">Notes</h2>
            <textarea
                bind:value={plan.notes}
                onchange={() => void persist()}
                rows="3"
                placeholder="Conditions de bascule vers le plan B/C, lectures adverses attendues…"
                class="w-full rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1.5 text-sm text-slate-300 placeholder:text-slate-700 focus:border-blue-500 focus:outline-none"
            ></textarea>
        </section>

        <!-- Champion picker overlay -->
        {#if target !== null}
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <button
                    type="button"
                    onclick={() => (target = null)}
                    class="absolute inset-0 bg-black/60"
                    aria-label="Fermer le sélecteur"
                ></button>
                <div class="relative w-full max-w-md">
                    <div class="flex items-center justify-between rounded-t-lg border border-b-0 border-slate-700 bg-slate-900 px-3 py-2">
                        <p class="text-sm font-semibold text-slate-200">{targetTitle}</p>
                        <div class="flex gap-2">
                            {#if targetKey !== null}
                                <button
                                    type="button"
                                    onclick={() => applySelection(null)}
                                    class="rounded-md bg-slate-800 px-2 py-1 text-xs text-amber-300 hover:bg-slate-700"
                                >
                                    Retirer
                                </button>
                            {/if}
                            <button
                                type="button"
                                onclick={() => (target = null)}
                                class="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                    <ChampionPicker disabledKeys={usedKeys} onSelect={(key) => applySelection(key)} />
                </div>
            </div>
        {/if}
    {/if}
</div>
