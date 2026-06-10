<!--
/**
 * M2 Ping 3 — Team context configuration panel.
 *
 * League dropdown (disabled leagues stay visible with a hint), tournament
 * select, Team A / Team B selectors fed from the scraped tournament team list,
 * a per-team Sync button with a "Synchronisé il y a 3 h · rafraîchir"
 * relative-time label, and the "Appliquer le contexte équipe" master toggle
 * that collapses the engine back to the M1 path when off.
 *
 * Pure: every fetch lives in the route; this panel only renders state and
 * emits intents. The clock is injectable (`now`) so relative labels are
 * deterministic in tests/storybook contexts.
 */
-->
<script lang="ts">
    import { LEAGUES, type LeagueInfo, type ProTeam } from '$lib/pro/types';
    import { relativeTimeLabel } from '$lib/pro/contextBuilder';

    interface TeamOption {
        id: string;
        name: string;
    }

    interface Props {
        leagues?: readonly LeagueInfo[];
        leagueId: string;
        onLeagueChange: (id: string) => void;
        tournaments: string[];
        tournamentSlug: string | null;
        onTournamentChange: (slug: string) => void;
        /** Teams of the selected tournament (loaded lazily by the route). */
        teamList: TeamOption[];
        teamListLoading?: boolean;
        onLoadTeamList?: () => void;
        teamAId: string | null;
        teamBId: string | null;
        onTeamAChange: (id: string | null) => void;
        onTeamBChange: (id: string | null) => void;
        /** Synced team payloads (null until the first sync). */
        teamA?: ProTeam | null;
        teamB?: ProTeam | null;
        syncingA?: boolean;
        syncingB?: boolean;
        /** Epoch ms of each team's last sync. */
        syncedAtA?: number | null;
        syncedAtB?: number | null;
        onSyncA?: () => void;
        onSyncB?: () => void;
        /** Master toggle — off collapses the engine to the M1 path. */
        contextActive: boolean;
        onContextActiveChange: (active: boolean) => void;
        /** Injectable clock for the relative-time labels. */
        now?: number;
    }

    let {
        leagues = LEAGUES,
        leagueId,
        onLeagueChange,
        tournaments,
        tournamentSlug,
        onTournamentChange,
        teamList,
        teamListLoading = false,
        onLoadTeamList,
        teamAId,
        teamBId,
        onTeamAChange,
        onTeamBChange,
        teamA = null,
        teamB = null,
        syncingA = false,
        syncingB = false,
        syncedAtA = null,
        syncedAtB = null,
        onSyncA,
        onSyncB,
        contextActive,
        onContextActiveChange,
        now = Date.now()
    }: Props = $props();

    function syncLabel(syncedAt: number | null, syncing: boolean): string {
        if (syncing) return 'Synchronisation…';
        if (syncedAt === null) return 'Jamais synchronisé';
        return `Synchronisé ${relativeTimeLabel(syncedAt, now)} · rafraîchir`;
    }

    const selectClass =
        'w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none disabled:opacity-50';
</script>

<section class="panel p-3">
    <div class="flex items-center justify-between pb-3">
        <h2 class="text-[11px] font-semibold tracking-widest text-slate-500 uppercase">Contexte équipe</h2>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <span>Appliquer le contexte équipe</span>
            <input
                type="checkbox"
                checked={contextActive}
                onchange={(e) => onContextActiveChange(e.currentTarget.checked)}
                class="h-4 w-4 accent-blue-500"
            />
        </label>
    </div>

    <div class="grid grid-cols-2 gap-2">
        <label class="block">
            <span class="block pb-1 text-xs text-slate-500">Ligue</span>
            <select class={selectClass} value={leagueId} onchange={(e) => onLeagueChange(e.currentTarget.value)}>
                {#each leagues as league (league.id)}
                    <option value={league.id} disabled={!league.enabled}>
                        {league.label}{league.enabled ? '' : ' (indisponible)'}
                    </option>
                {/each}
            </select>
        </label>

        <label class="block">
            <span class="block pb-1 text-xs text-slate-500">Tournoi</span>
            <select
                class={selectClass}
                value={tournamentSlug ?? ''}
                disabled={tournaments.length === 0}
                onchange={(e) => onTournamentChange(e.currentTarget.value)}
            >
                <option value="" disabled>Choisir…</option>
                {#each tournaments as slug (slug)}
                    <option value={slug}>{slug}</option>
                {/each}
            </select>
        </label>
    </div>

    {#if teamList.length === 0}
        <button
            type="button"
            onclick={() => onLoadTeamList?.()}
            disabled={teamListLoading}
            class="mt-2 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
            {teamListLoading ? 'Chargement des équipes…' : 'Charger la liste des équipes'}
        </button>
    {:else}
        <div class="mt-2 grid grid-cols-2 gap-2">
            <!-- Team A (ally) column -->
            <div class="rounded-md border border-blue-900/50 bg-slate-950/40 p-2">
                <span class="block pb-1 text-xs font-semibold text-blue-400">Équipe A (alliée)</span>
                <select
                    class={selectClass}
                    value={teamAId ?? ''}
                    onchange={(e) => onTeamAChange(e.currentTarget.value === '' ? null : e.currentTarget.value)}
                    aria-label="Équipe A"
                >
                    <option value="">—</option>
                    {#each teamList as team (team.id)}
                        <option value={team.id}>{team.name}</option>
                    {/each}
                </select>
                <button
                    type="button"
                    onclick={() => onSyncA?.()}
                    disabled={teamAId === null || syncingA}
                    class="mt-2 w-full rounded-md bg-blue-500/15 px-2 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/25 disabled:opacity-40"
                >
                    Sync
                </button>
                <p class="pt-1 text-[11px] text-slate-500">{syncLabel(syncedAtA, syncingA)}</p>
                {#if teamA?.incomplete}
                    <p class="pt-1 text-[11px] text-amber-400">Données partielles — voir avertissements.</p>
                {/if}
            </div>

            <!-- Team B (enemy) column -->
            <div class="rounded-md border border-red-900/50 bg-slate-950/40 p-2">
                <span class="block pb-1 text-xs font-semibold text-red-400">Équipe B (adverse)</span>
                <select
                    class={selectClass}
                    value={teamBId ?? ''}
                    onchange={(e) => onTeamBChange(e.currentTarget.value === '' ? null : e.currentTarget.value)}
                    aria-label="Équipe B"
                >
                    <option value="">—</option>
                    {#each teamList as team (team.id)}
                        <option value={team.id}>{team.name}</option>
                    {/each}
                </select>
                <button
                    type="button"
                    onclick={() => onSyncB?.()}
                    disabled={teamBId === null || syncingB}
                    class="mt-2 w-full rounded-md bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-500/25 disabled:opacity-40"
                >
                    Sync
                </button>
                <p class="pt-1 text-[11px] text-slate-500">{syncLabel(syncedAtB, syncingB)}</p>
                {#if teamB?.incomplete}
                    <p class="pt-1 text-[11px] text-amber-400">Données partielles — voir avertissements.</p>
                {/if}
            </div>
        </div>
    {/if}
</section>
