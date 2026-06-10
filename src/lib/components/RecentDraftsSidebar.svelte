<!--
/**
 * M2 Ping 3 — Recent drafts of each synced team.
 *
 * Two stacked sections (Team A / Team B), up to 6 drafts each: side square
 * (blue/red) + W/L + opponent + the 5-pick summary as mini icons. Clicking a
 * row asks the route to load that draft into the picker (team A's drafts go
 * into ally slots and flip `allySide` to the draft's recorded side; team B's
 * go into enemy slots — wiring lives in the route).
 */
-->
<script lang="ts">
    import type { ProTeam, RecentDraft } from '$lib/pro/types';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';

    interface Props {
        teamA?: ProTeam | null;
        teamB?: ProTeam | null;
        onLoadDraft: (team: 'A' | 'B', draft: RecentDraft) => void;
        maxPerTeam?: number;
    }

    let { teamA = null, teamB = null, onLoadDraft, maxPerTeam = 6 }: Props = $props();
</script>

{#snippet draftRow(team: 'A' | 'B', draft: RecentDraft)}
    <button
        type="button"
        onclick={() => onLoadDraft(team, draft)}
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-800"
        title="Charger cette draft dans le picker"
    >
        <span
            class="h-3 w-3 shrink-0 rounded-sm {draft.side === 'blue' ? 'bg-blue-500' : 'bg-red-500'}"
            aria-label={draft.side === 'blue' ? 'Side bleu' : 'Side rouge'}
        ></span>
        <span
            class="w-4 shrink-0 text-xs font-bold {draft.result === 'W'
                ? 'text-emerald-400'
                : draft.result === 'L'
                  ? 'text-red-400'
                  : 'text-slate-500'}"
        >
            {draft.result ?? '·'}
        </span>
        <span class="w-16 shrink-0 truncate text-xs text-slate-400" title={draft.opponent}>
            {draft.opponent ?? '?'}
        </span>
        <span class="flex gap-0.5">
            {#each draft.picks as pick, i (i)}
                <ChampionIcon championKey={pick.championKey} size={18} />
            {/each}
        </span>
    </button>
{/snippet}

{#snippet teamSection(team: 'A' | 'B', proTeam: ProTeam | null, accent: string)}
    <div class="pb-3">
        <p class="px-2 pb-1 text-[11px] font-semibold tracking-widest uppercase {accent}">
            {proTeam?.name ?? `Équipe ${team}`}
        </p>
        {#if proTeam === null}
            <p class="px-2 text-xs text-slate-600">Synchronisez l'équipe pour voir ses drafts.</p>
        {:else if proTeam.recentDrafts.length === 0}
            <p class="px-2 text-xs text-slate-600">Aucune draft récente.</p>
        {:else}
            {#each proTeam.recentDrafts.slice(0, maxPerTeam) as draft (draft.gameId)}
                {@render draftRow(team, draft)}
            {/each}
        {/if}
    </div>
{/snippet}

<aside class="rounded-lg border border-slate-800 bg-slate-900 p-2">
    <h2 class="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
        Drafts récentes
    </h2>
    {@render teamSection('A', teamA, 'text-blue-400')}
    {@render teamSection('B', teamB, 'text-red-400')}
</aside>
