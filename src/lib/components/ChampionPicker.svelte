<!--
/**
 * M2 Ping 3 — Pool-first champion picker.
 *
 * Pool champions appear at the top under a "Pool du joueur" header with a
 * green tint and a "4g · 75%" games/winrate badge; below a separator comes the
 * FULL alphabetical catalogue — no filter, no toggle, so exploring an
 * out-of-pool pick stays one click away. Champions that are in the pool also
 * carry a small grey games-count in the catalogue section, so the signal is
 * visible in both places. Both groups filter together on search (apostrophe/
 * case-insensitive, same normalization as the gol.gg lookup).
 *
 * Pure: catalogue defaults to the bundled tags (synchronous data, like every
 * engine module); selection goes up via `onSelect`. `disabledKeys` (already
 * picked / Fearless-consumed) render dimmed and unclickable but stay visible.
 */
-->
<script lang="ts">
    import { loadDefaultTags } from '$lib/tags';
    import { normalizeChampionName } from '$lib/pro/championLookup';
    import type { ChampionPoolEntry } from '$lib/pro/types';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';

    interface Props {
        /** Assigned player's pool — enables the pool-first section. */
        poolEntries?: ChampionPoolEntry[];
        /** Header of the pool section, e.g. "Pool de Manaty". */
        poolLabel?: string;
        /** Keys that can't be picked (already picked/banned, Fearless-consumed). */
        disabledKeys?: string[];
        /** Restrict the catalogue (defaults to every tagged champion). */
        availableKeys?: string[];
        onSelect: (championKey: string) => void;
    }

    let {
        poolEntries = [],
        poolLabel = 'Pool du joueur',
        disabledKeys = [],
        availableKeys,
        onSelect
    }: Props = $props();

    const tagsFile = loadDefaultTags();

    let query = $state('');

    const disabled = $derived(new Set(disabledKeys));
    const poolByKey = $derived(new Map(poolEntries.map((e) => [e.championKey, e])));

    /** Full catalogue, alphabetical by display name (French collation). */
    const catalogue = $derived(
        (availableKeys ?? Object.keys(tagsFile.champions))
            .map((key) => ({ key, name: tagsFile.champions[key]?.name ?? key }))
            .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    );

    const needle = $derived(normalizeChampionName(query));
    const matches = (name: string): boolean => needle === '' || normalizeChampionName(name).includes(needle);

    /** Pool section: known champions only, most-played first, search-filtered. */
    const poolRows = $derived(
        poolEntries
            .filter((e) => tagsFile.champions[e.championKey] !== undefined)
            .filter((e) => matches(tagsFile.champions[e.championKey].name))
            .sort((a, b) => b.games - a.games)
    );

    const catalogueRows = $derived(catalogue.filter((c) => matches(c.name)));

    /** "4g · 75%" badge text for a pool entry. */
    function poolBadge(entry: ChampionPoolEntry): string {
        const wr = entry.games > 0 ? Math.round((entry.wins / entry.games) * 100) : 0;
        return `${entry.games}g · ${wr}%`;
    }

    function pick(key: string): void {
        if (!disabled.has(key)) onSelect(key);
    }
</script>

<div class="flex flex-col rounded-lg border border-slate-700 bg-slate-900">
    <div class="border-b border-slate-800 p-2">
        <input
            type="search"
            bind:value={query}
            placeholder="Rechercher un champion…"
            aria-label="Rechercher un champion"
            class="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />
    </div>

    <div class="max-h-80 overflow-y-auto p-2">
        {#if poolEntries.length > 0}
            <p class="px-1 pb-1 text-[11px] font-semibold tracking-widest text-emerald-400 uppercase">
                {poolLabel}
            </p>
            {#if poolRows.length === 0}
                <p class="px-1 pb-2 text-xs text-slate-500">Aucun champion du pool ne correspond.</p>
            {/if}
            {#each poolRows as entry (entry.championKey)}
                <button
                    type="button"
                    disabled={disabled.has(entry.championKey)}
                    onclick={() => pick(entry.championKey)}
                    class="flex w-full items-center gap-2 rounded-md bg-emerald-500/10 px-2 py-1.5 text-left hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    title={disabled.has(entry.championKey) ? 'Indisponible' : undefined}
                >
                    <ChampionIcon championKey={entry.championKey} size={24} />
                    <span class="flex-1 truncate text-sm text-slate-200">
                        {tagsFile.champions[entry.championKey].name}
                    </span>
                    <span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                        {poolBadge(entry)}
                    </span>
                </button>
            {/each}

            <p class="px-1 pt-3 pb-1 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
                Autres champions
            </p>
        {/if}

        {#if catalogueRows.length === 0}
            <p class="px-1 py-2 text-xs text-slate-500">Aucun champion ne correspond à « {query} ».</p>
        {/if}
        {#each catalogueRows as champ (champ.key)}
            <button
                type="button"
                disabled={disabled.has(champ.key)}
                onclick={() => pick(champ.key)}
                class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                title={disabled.has(champ.key) ? 'Indisponible' : undefined}
            >
                <ChampionIcon championKey={champ.key} size={24} />
                <span class="flex-1 truncate text-sm text-slate-300">{champ.name}</span>
                {#if poolByKey.has(champ.key)}
                    <!-- In-pool signal repeated in the catalogue (M2 Ping 3 UX point #1). -->
                    <span class="text-xs text-slate-500">{poolByKey.get(champ.key)?.games}g</span>
                {/if}
            </button>
        {/each}
    </div>
</div>
