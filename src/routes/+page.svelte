<!--
/**
 * Route / — Team scout + Bayesian draft analyzer + Pool Tier (M1/M2 assembly).
 *
 * Wiring per M2_PING3: `contextActive` / `leagueId` / team state live here;
 * `playerContext` and `sideContext` are $derived and COLLAPSE to undefined when
 * the master toggle is off, so the engine call falls back to the pure M1 path.
 * `fetchTeam` runs on Sync, `fetchTeamList` lazily from the panel button, the
 * dataset pair loads on mount (skeleton — first load is ~50 MB).
 *
 * Comfort tags: stored overrides (localStorage via $lib/comfort) take priority
 * over the pool-size defaults computed by buildPlayerContext; the subscription
 * keeps every panel in sync. Loading a recent draft from team A fills the ally
 * slots and flips `allySide` to the recorded side; team B fills the enemy
 * slots (ally side becomes the opposite).
 *
 * Provenance badges (DA-V2-4): dataset version/patch under the winrate bar,
 * gol.gg + season on the scouting panels, sample sizes in the score breakdown.
 */
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import {
        ROLES,
        Role,
        type AnalyzeDraftConfig,
        type ComfortMode,
        type PlayerContext,
        type PlayerStats,
        type SideContext,
        type Team
    } from '$lib/types';
    import { analyzeDraft } from '$lib/engine/analyzer';
    import { fetchDatasetPair, type DatasetPair } from '$lib/dataset/fetch';
    import { fetchTeam, fetchTeamList, GOLGG_DEFAULT_SEASON } from '$lib/pro/golgg';
    import type { ChampionPoolEntry, ProTeam, RecentDraft } from '$lib/pro/types';
    import { buildPlayerContext, buildSideContext, poolForRole } from '$lib/pro/contextBuilder';
    import { comfortModeFromGames } from '$lib/pro/comfortDefaults';
    import { readComfortTags, setComfortTag, subscribeComfort } from '$lib/comfort';
    import TeamContextPanel from '$lib/components/TeamContextPanel.svelte';
    import SidePicker from '$lib/components/SidePicker.svelte';
    import RecentDraftsSidebar from '$lib/components/RecentDraftsSidebar.svelte';
    import ChampionSlot, { ROLE_LABELS } from '$lib/components/ChampionSlot.svelte';
    import ChampionPicker from '$lib/components/ChampionPicker.svelte';
    import WinrateBar from '$lib/components/WinrateBar.svelte';
    import PoolTierPanel from '$lib/components/PoolTierPanel.svelte';

    /**
     * gol.gg region code per league id. LEAGUE_REGISTRY carries no such mapping
     * (A1 step-up), so the route owns it; leagues absent here (LCP,
     * internationals) get the unfiltered season-wide team list.
     */
    const REGION_BY_LEAGUE: Record<string, string> = {
        lfl: 'FR',
        lck: 'KR',
        lpl: 'CN',
        lec: 'EUW',
        lcs: 'NA',
        cblol: 'BR'
    };

    // ---- dataset (M1 fuel) ----
    let datasets = $state<DatasetPair | null>(null);
    let datasetLoading = $state(true);
    let datasetError = $state<string | null>(null);

    // ---- draft state ----
    const emptyFive = (): (string | null)[] => [null, null, null, null, null];
    let allyPicks = $state<(string | null)[]>(emptyFive());
    let enemyPicks = $state<(string | null)[]>(emptyFive());
    let allySide = $state<'blue' | 'red'>('blue');
    let pickerSlot = $state<{ team: 'ally' | 'enemy'; role: Role } | null>(null);

    // ---- team context state (M2_PING3) ----
    let contextActive = $state(false);
    let leagueId = $state('lfl');
    let tournamentSlug = $state<string | null>(null);
    let teamList = $state<{ id: string; name: string }[]>([]);
    let teamListLoading = $state(false);
    let teamListWarnings = $state<string[]>([]);
    let teamAId = $state<string | null>(null);
    let teamBId = $state<string | null>(null);
    let teamA = $state<ProTeam | null>(null);
    let teamB = $state<ProTeam | null>(null);
    let syncingA = $state(false);
    let syncingB = $state(false);
    let syncedAtA = $state<number | null>(null);
    let syncedAtB = $state<number | null>(null);
    /** Clock fed to the panel's relative labels; refreshed after each sync. */
    let nowTick = $state(Date.now());

    // ---- comfort overrides (localStorage, kept in sync via subscription) ----
    let comfortTags = $state<Record<string, ComfortMode>>({});

    // ---- pool tier panel ----
    let poolTierRole = $state<Role>(Role.Top);

    onMount(() => {
        void loadDatasets();
    });

    $effect(() => {
        comfortTags = readComfortTags();
        // Re-read on every write so independent panels stay coherent.
        return subscribeComfort(() => {
            comfortTags = readComfortTags();
        });
    });

    async function loadDatasets(): Promise<void> {
        datasetLoading = true;
        datasetError = null;
        try {
            datasets = await fetchDatasetPair();
        } catch (error) {
            datasetError = error instanceof Error ? error.message : String(error);
        } finally {
            datasetLoading = false;
        }
    }

    // ---- derived engine inputs ----
    const enemySide = $derived(allySide === 'blue' ? 'red' : 'blue');

    function teamFromPicks(picks: (string | null)[]): Team {
        // Built in one shot (entries → Map): the engine's Team input is plain
        // data, never mutated after construction.
        const entries: [Role, string][] = [];
        for (const role of ROLES) {
            const key = picks[role];
            if (key !== null && key !== undefined) entries.push([role, key]);
        }
        return new Map(entries);
    }

    const allyTeamMap = $derived(teamFromPicks(allyPicks));
    const enemyTeamMap = $derived(teamFromPicks(enemyPicks));

    /** Pool-derived context, display basis (undefined when the toggle is off). */
    const builtPlayerContext = $derived(
        contextActive && teamA !== null ? buildPlayerContext(teamA, allyTeamMap) : undefined
    );

    /** Engine context = built context with the stored comfort overrides applied. */
    const playerContext = $derived.by((): PlayerContext | undefined => {
        if (builtPlayerContext === undefined) return undefined;
        const ctx: PlayerContext = {};
        for (const role of ROLES) {
            const slot = builtPlayerContext[role];
            if (slot === undefined) continue;
            const key = allyTeamMap.get(role);
            const override = key !== undefined ? comfortTags[key] : undefined;
            ctx[role] = override !== undefined ? { ...slot, comfortMode: override } : slot;
        }
        return ctx;
    });

    const sideContext = $derived.by((): SideContext | undefined => {
        if (!contextActive || teamA === null || teamB === null) return undefined;
        return buildSideContext(teamA, teamB, allySide, enemySide);
    });

    const result = $derived.by(() => {
        if (datasets === null) return null;
        const config: AnalyzeDraftConfig = {
            ignoreChampionWinrates: false,
            riskLevel: 'medium',
            minGames: 0,
            playerContext,
            sideContext
        };
        return analyzeDraft(datasets.dataset, allyTeamMap, enemyTeamMap, config, datasets.fullDataset);
    });

    /** Per-pass contributions + sample sizes (S4/DA-V2-4: defendable numbers). */
    const breakdown = $derived.by(() => {
        if (result === null) return null;
        const champions = result.allyChampionRating.totalRating - result.enemyChampionRating.totalRating;
        const duos = result.allyDuoRating.totalRating - result.enemyDuoRating.totalRating;
        const matchups = result.matchupRating.totalRating;
        const side = result.totalRating - champions - duos - matchups;
        const championGames = [
            ...result.allyChampionRating.championResults,
            ...result.enemyChampionRating.championResults
        ].reduce((sum, r) => sum + r.games, 0);
        const matchupGames = Math.round(
            result.matchupRating.matchupResults.reduce((sum, r) => sum + r.games, 0)
        );
        return { champions, duos, matchups, side, championGames, matchupGames };
    });

    function fmtElo(value: number): string {
        return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`.replace('.', ',');
    }

    // ---- slot display helpers ----
    interface SlotView {
        playerName: string | null;
        playerStats: PlayerStats | null;
        outsidePool: boolean;
    }

    /** Scouting subtitle data for one slot (both teams — display only). */
    function slotView(team: ProTeam | null, role: Role, key: string | null): SlotView {
        if (!contextActive || team === null) return { playerName: null, playerStats: null, outsidePool: false };
        const player = team.players.find((p) => p.role === role) ?? null;
        const view: SlotView = { playerName: player?.name ?? null, playerStats: null, outsidePool: false };
        if (key === null || player === null) return view;
        const entry = player.pool.find((e) => e.championKey === key);
        if (entry === undefined || entry.games === 0) {
            view.outsidePool = true;
            return view;
        }
        view.playerStats = { games: entry.games, winrate: entry.wins / entry.games };
        return view;
    }

    /** Resolved comfort tag for an ally slot: override → pool default → none. */
    function allyComfort(role: Role): ComfortMode {
        const key = allyPicks[role];
        if (key === null) return 'none';
        const override = comfortTags[key];
        if (override !== undefined) return override;
        if (contextActive && teamA !== null) {
            const entry = poolForRole(teamA, role).find((e) => e.championKey === key);
            return comfortModeFromGames(entry?.games ?? 0);
        }
        return 'none';
    }

    // ---- picker ----
    const pickedKeys = $derived(
        [...allyPicks, ...enemyPicks].filter((k): k is string => k !== null)
    );

    const pickerInfo = $derived.by(() => {
        const slot = pickerSlot;
        if (slot === null) return null;
        const team = slot.team === 'ally' ? teamA : teamB;
        let entries: ChampionPoolEntry[] = [];
        let label = 'Pool du joueur';
        if (contextActive && team !== null) {
            const player = team.players.find((p) => p.role === slot.role);
            if (player !== undefined) {
                entries = player.pool;
                label = `Pool de ${player.name}`;
            }
        }
        const title = `${slot.team === 'ally' ? 'Pick allié' : 'Pick adverse'} — ${ROLE_LABELS[slot.role]}`;
        return { slot, entries, label, title };
    });

    function assignPick(championKey: string | null): void {
        const slot = pickerSlot;
        if (slot === null) return;
        if (slot.team === 'ally') allyPicks[slot.role] = championKey;
        else enemyPicks[slot.role] = championKey;
        pickerSlot = null;
    }

    function clearTeam(team: 'ally' | 'enemy'): void {
        if (team === 'ally') allyPicks = emptyFive();
        else enemyPicks = emptyFive();
        pickerSlot = null;
    }

    // ---- gol.gg wiring ----
    function changeLeague(id: string): void {
        leagueId = id;
        tournamentSlug = null;
        teamList = [];
        teamListWarnings = [];
        teamAId = null;
        teamBId = null;
        teamA = null;
        teamB = null;
        syncedAtA = null;
        syncedAtB = null;
    }

    async function loadTeamList(): Promise<void> {
        teamListLoading = true;
        const region = REGION_BY_LEAGUE[leagueId];
        const { teams, warnings } = await fetchTeamList(region !== undefined ? { region } : {});
        teamList = teams
            .map((t) => ({ id: t.id, name: t.name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        teamListWarnings = warnings;
        teamListLoading = false;
    }

    async function syncTeam(which: 'A' | 'B'): Promise<void> {
        const id = which === 'A' ? teamAId : teamBId;
        if (id === null) return;
        if (which === 'A') syncingA = true;
        else syncingB = true;
        // fetchTeam is best-effort and never throws (warnings + `incomplete`).
        const team = await fetchTeam(id, {
            league: leagueId,
            ...(datasets !== null ? { dataset: datasets.fullDataset } : {})
        });
        if (which === 'A') {
            teamA = team;
            syncedAtA = Date.now();
            syncingA = false;
        } else {
            teamB = team;
            syncedAtB = Date.now();
            syncingB = false;
        }
        nowTick = Date.now();
    }

    /** Tournament select is informational in V1 (fetchers are split-ALL). */
    const tournaments = $derived(
        [...new Set([teamA?.tournament, teamB?.tournament].filter((t): t is string => t !== undefined))]
    );

    const dataWarnings = $derived([
        ...teamListWarnings,
        ...(teamA?.warnings ?? []).map((w) => `Équipe A — ${w}`),
        ...(teamB?.warnings ?? []).map((w) => `Équipe B — ${w}`)
    ]);

    // ---- recent drafts → picker (M2_PING3 behaviour) ----
    function loadRecentDraft(team: 'A' | 'B', draft: RecentDraft): void {
        const next = emptyFive();
        const unroled: string[] = [];
        for (const pick of draft.picks) {
            if (pick.role !== undefined && next[pick.role] === null) next[pick.role] = pick.championKey;
            else unroled.push(pick.championKey);
        }
        // Picks without an attributed role fill the remaining slots in order.
        for (const key of unroled) {
            const free = ROLES.find((role) => next[role] === null);
            if (free !== undefined) next[free] = key;
        }
        if (team === 'A') {
            allyPicks = next;
            allySide = draft.side;
        } else {
            enemyPicks = next;
            allySide = draft.side === 'blue' ? 'red' : 'blue';
        }
        pickerSlot = null;
    }

    // ---- pool tier panel ----
    const poolTierEntries = $derived(teamA === null ? [] : poolForRole(teamA, poolTierRole));
    const poolTierPlayer = $derived(
        teamA?.players.find((p) => p.role === poolTierRole)?.name ?? null
    );

    const sideBadge = (side: 'blue' | 'red'): { label: string; cls: string } =>
        side === 'blue'
            ? { label: 'BLUE', cls: 'bg-blue-500/15 text-blue-400' }
            : { label: 'RED', cls: 'bg-red-500/15 text-red-400' };
</script>

<svelte:head>
    <title>DraftLab — Draft</title>
</svelte:head>

<div class="space-y-3">
    <TeamContextPanel
        {leagueId}
        onLeagueChange={changeLeague}
        {tournaments}
        {tournamentSlug}
        onTournamentChange={(slug) => (tournamentSlug = slug)}
        {teamList}
        {teamListLoading}
        onLoadTeamList={() => void loadTeamList()}
        {teamAId}
        {teamBId}
        onTeamAChange={(id) => (teamAId = id)}
        onTeamBChange={(id) => (teamBId = id)}
        {teamA}
        {teamB}
        {syncingA}
        {syncingB}
        {syncedAtA}
        {syncedAtB}
        onSyncA={() => void syncTeam('A')}
        onSyncB={() => void syncTeam('B')}
        {contextActive}
        onContextActiveChange={(active) => (contextActive = active)}
        now={nowTick}
    />

    {#if dataWarnings.length > 0}
        <details class="rounded-lg border border-amber-900/50 bg-slate-900 px-3 py-2 text-xs text-amber-400">
            <summary class="cursor-pointer select-none">
                ⚠ {dataWarnings.length} avertissement{dataWarnings.length > 1 ? 's' : ''} de données (gol.gg)
            </summary>
            <ul class="list-disc space-y-0.5 pt-2 pl-5 text-slate-400">
                {#each dataWarnings as warning, i (i)}
                    <li>{warning}</li>
                {/each}
            </ul>
        </details>
    {/if}

    {#if datasetLoading}
        <div class="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p class="pb-3 text-sm text-slate-300">
                Téléchargement du dataset DraftGap (~50 Mo au premier lancement, puis cache 24 h)…
            </p>
            <div class="grid animate-pulse grid-cols-1 gap-3 xl:grid-cols-4">
                {#each [0, 1, 2, 3] as i (i)}
                    <div class="h-64 rounded-lg bg-slate-800/60"></div>
                {/each}
            </div>
        </div>
    {:else if datasetError !== null}
        <div class="rounded-lg border border-red-900/60 bg-red-950/30 p-4">
            <p class="pb-1 text-sm font-semibold text-red-300">Échec du chargement du dataset.</p>
            <p class="pb-3 text-xs text-red-200/70">{datasetError}</p>
            <button
                type="button"
                onclick={() => void loadDatasets()}
                class="rounded-md bg-red-500/15 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/25"
            >
                Réessayer
            </button>
        </div>
    {:else}
        <div class="grid grid-cols-1 items-start gap-3 xl:grid-cols-12">
            <!-- Ally column -->
            <section class="space-y-2 xl:col-span-3">
                <div class="flex items-center justify-between px-1">
                    <p class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
                        Allié
                        <span class="rounded-full px-2 py-0.5 text-[10px] font-bold {sideBadge(allySide).cls}">
                            {sideBadge(allySide).label}
                        </span>
                    </p>
                    <button
                        type="button"
                        onclick={() => clearTeam('ally')}
                        class="text-xs text-slate-600 hover:text-slate-300"
                    >
                        Vider
                    </button>
                </div>
                {#each ROLES as role (role)}
                    {@const view = slotView(teamA, role, allyPicks[role])}
                    <ChampionSlot
                        {role}
                        championKey={allyPicks[role]}
                        side="ally"
                        playerName={view.playerName}
                        playerStats={view.playerStats}
                        outsidePool={view.outsidePool}
                        comfortMode={allyPicks[role] !== null ? allyComfort(role) : undefined}
                        onComfortChange={(mode) => {
                            const key = allyPicks[role];
                            if (key !== null) setComfortTag(key, mode);
                        }}
                        onSelect={() => (pickerSlot = { team: 'ally', role })}
                        onClear={() => (allyPicks[role] = null)}
                    />
                {/each}
            </section>

            <!-- Center column: side picker + champion picker -->
            <div class="space-y-3 xl:col-span-4">
                <SidePicker
                    value={allySide}
                    onChange={(side) => (allySide = side)}
                    allyStats={teamA?.sideStats ?? null}
                    enemyStats={teamB?.sideStats ?? null}
                />

                {#if pickerInfo !== null}
                    <div>
                        <div class="flex items-center justify-between pb-1">
                            <p class="text-sm font-semibold text-slate-200">{pickerInfo.title}</p>
                            <div class="flex gap-2">
                                <button
                                    type="button"
                                    onclick={() => assignPick(null)}
                                    class="rounded-md bg-slate-800 px-2 py-1 text-xs text-amber-300 hover:bg-slate-700"
                                >
                                    Retirer
                                </button>
                                <button
                                    type="button"
                                    onclick={() => (pickerSlot = null)}
                                    class="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                        <ChampionPicker
                            poolEntries={pickerInfo.entries}
                            poolLabel={pickerInfo.label}
                            disabledKeys={pickedKeys}
                            onSelect={(key) => assignPick(key)}
                        />
                    </div>
                {:else}
                    <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
                        Cliquez sur un slot (allié ou adverse) pour choisir un champion.
                    </div>
                {/if}
            </div>

            <!-- Enemy column -->
            <section class="space-y-2 xl:col-span-3">
                <div class="flex items-center justify-between px-1">
                    <p class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
                        Adverse
                        <span class="rounded-full px-2 py-0.5 text-[10px] font-bold {sideBadge(enemySide).cls}">
                            {sideBadge(enemySide).label}
                        </span>
                    </p>
                    <button
                        type="button"
                        onclick={() => clearTeam('enemy')}
                        class="text-xs text-slate-600 hover:text-slate-300"
                    >
                        Vider
                    </button>
                </div>
                {#each ROLES as role (role)}
                    {@const view = slotView(teamB, role, enemyPicks[role])}
                    <ChampionSlot
                        {role}
                        championKey={enemyPicks[role]}
                        side="enemy"
                        playerName={view.playerName}
                        playerStats={view.playerStats}
                        outsidePool={view.outsidePool}
                        onSelect={() => (pickerSlot = { team: 'enemy', role })}
                        onClear={() => (enemyPicks[role] = null)}
                    />
                {/each}
            </section>

            <!-- Recent drafts sidebar -->
            <div class="space-y-1 xl:col-span-2">
                <RecentDraftsSidebar {teamA} {teamB} onLoadDraft={loadRecentDraft} />
                <p class="px-1 text-[10px] text-slate-600">Source : gol.gg · cache 24 h</p>
            </div>
        </div>

        <!-- Bottom band: winrate + score detail + pool tiers -->
        <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
            <div class="space-y-1">
                {#if result !== null}
                    <WinrateBar winrate={result.winrate} />
                {/if}
                <p class="px-1 text-[10px] text-slate-600">
                    Source : DraftGap (SoloQ) — patch {datasets?.dataset.version ?? '?'} · 30 j v{datasets
                        ?.fullDataset.version ?? '?'}
                </p>
            </div>

            {#if breakdown !== null}
                <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
                        Détail du score (Elo)
                    </p>
                    <dl class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <dt class="text-slate-400">Champions (solo)</dt>
                            <dd class="font-mono {breakdown.champions >= 0 ? 'text-blue-300' : 'text-red-300'}">
                                {fmtElo(breakdown.champions)}
                            </dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-slate-400">Duos (synergies)</dt>
                            <dd class="font-mono {breakdown.duos >= 0 ? 'text-blue-300' : 'text-red-300'}">
                                {fmtElo(breakdown.duos)}
                            </dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-slate-400">Matchups</dt>
                            <dd class="font-mono {breakdown.matchups >= 0 ? 'text-blue-300' : 'text-red-300'}">
                                {fmtElo(breakdown.matchups)}
                            </dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-slate-400">Side (préférence équipe)</dt>
                            <dd class="font-mono {breakdown.side >= 0 ? 'text-blue-300' : 'text-red-300'}">
                                {fmtElo(breakdown.side)}
                            </dd>
                        </div>
                    </dl>
                    <p class="pt-2 text-[10px] text-slate-600">
                        Échantillon : {breakdown.championGames} games champions (patch) ·
                        {breakdown.matchupGames} games matchups (30 j)
                    </p>
                </section>
            {/if}

            <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-1 px-1">
                    <span class="pr-1 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
                        Pool tiers
                    </span>
                    {#each ROLES as role (role)}
                        <button
                            type="button"
                            onclick={() => (poolTierRole = role)}
                            class="rounded px-2 py-0.5 text-xs font-semibold {poolTierRole === role
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-slate-800 text-slate-500 hover:text-slate-300'}"
                        >
                            {ROLE_LABELS[role]}
                        </button>
                    {/each}
                </div>
                {#if teamA !== null}
                    <PoolTierPanel
                        entries={poolTierEntries}
                        playerName={poolTierPlayer}
                        title="Pool tiers — {ROLE_LABELS[poolTierRole]}"
                    />
                    <p class="px-1 text-[10px] text-slate-600">
                        Source : gol.gg · saison {GOLGG_DEFAULT_SEASON} ·
                        {poolTierEntries.length} champion{poolTierEntries.length > 1 ? 's' : ''}
                    </p>
                {:else}
                    <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
                        Synchronisez l'Équipe A pour classer le pool de ses joueurs.
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>
