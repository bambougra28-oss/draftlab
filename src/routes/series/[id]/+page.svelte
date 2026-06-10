<!--
/**
 * Route /series/[id] — series editor with Fearless tracking (M7.2 + Sprint E).
 *
 * Game tabs (Bo1/Bo3/Bo5), per-game editor: First Selection selector (2026
 * rule, DA-V2-7 — who holds FS and whether they took side or first pick),
 * side toggle, result, picks/bans through the ManualDraftPicker with
 * Fearless-aware exclusion (champions consumed in the OTHER games of the
 * series are locked), "Appliquer un plan" dropdown filtered by
 * `applicableGames` (primary → fallback cascade when a champion is locked),
 * live adversary-plan recap and the consumption tracker.
 *
 * First Selection is persisted as an extension field on SeriesGame
 * (`firstSelection?: FirstSelectionInfo` from $lib/data/types): IndexedDB's
 * structured clone keeps it, and `upsertGame`/`recomputeConsumed` carry it
 * through untouched. The FS holder is stored as a SIDE (the type's contract);
 * the UI is team-anchored, so flipping the ally side re-anchors the stored
 * holder to keep the same team holding it. Every mutation persists via
 * $state.snapshot (reactive proxies cannot be structured-cloned).
 *
 * C1 war room (Fearless Bo3/Bo5 only): pools are entered MANUALLY through
 * one textarea per team (one line per role, champion names comma-separated)
 * — deliberately the simplest path, since this route has no gol.gg sync of
 * its own; the raw text persists in localStorage per (series, side). Entries
 * carry neutral 0/0 stats (posterior = prior mean), so the solver reads pure
 * DEPTH, not quality. No tendency records exist here either, so
 * `ctx.wantProbability` stays uninjected and the denial column honestly
 * renders « non chiffré » (never zeroed). The FS holder of the upcoming game
 * feeds the solver's side|pick arbitrage; the ExportBar downloads the
 * one-page re-plan sheet (integrity + remaining pools as notes).
 */
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { resolve } from '$app/paths';
    import {
        emptyGame,
        getSeries,
        removeGame,
        saveSeries,
        upsertGame,
        type Series,
        type SeriesGame,
        type GameWinner
    } from '$lib/storage/series';
    import { listDraftPlans, type DraftPlan } from '$lib/storage/draftPlans';
    import type { FirstSelectionInfo } from '$lib/data/types';
    import { ROLES, Role } from '$lib/types';
    import { detectAdversaryPlan } from '$lib/strategic/adversaryPlanDetector';
    import {
        mustWinAnalysis,
        poolIntegrity,
        seriesValue,
        type SeriesState,
        type SeriesValueMemo
    } from '$lib/strategic/seriesSolver';
    import { seriesStateFromSeries } from '$lib/intel/opponentIntel';
    import { parseRoleString, resolveChampionKey } from '$lib/data/normalize';
    import { championNameByKey } from '$lib/dataDragon/version';
    import { renderRePlanSheet } from '$lib/exports/prepPack';
    import type { ChampionPoolEntry } from '$lib/pro/types';
    import ManualDraftPicker from '$lib/components/ManualDraftPicker.svelte';
    import ConsumptionTrackerPanel from '$lib/components/ConsumptionTrackerPanel.svelte';
    import AdversaryPlanEvolution from '$lib/components/AdversaryPlanEvolution.svelte';
    import WarRoomPanel from '$lib/components/WarRoomPanel.svelte';
    import ExportBar, { type ExportAction } from '$lib/components/ExportBar.svelte';
    import { ROLE_LABELS } from '$lib/components/ChampionSlot.svelte';

    /** SeriesGame + the 2026 First Selection annotation (see module header). */
    type FsSeriesGame = SeriesGame & { firstSelection?: FirstSelectionInfo };

    const GAME_COUNT: Record<Series['format'], number> = { bo1: 1, bo3: 3, bo5: 5 };

    let series = $state<Series | null>(null);
    let loading = $state(true);
    let loadError = $state<string | null>(null);
    let currentGame = $state(1);
    let plans = $state<DraftPlan[]>([]);
    let selectedPlanId = $state('');
    let applyNotes = $state<string[]>([]);

    // ---- C1 war room: manual pool text per side (localStorage-backed) ----
    let poolTextAlly = $state('');
    let poolTextEnemy = $state('');

    const seriesId = $derived(page.params.id ?? '');

    const poolStorageKey = (id: string, side: 'ally' | 'enemy'): string =>
        `draftlab:warroom:${id}:${side}`;

    $effect(() => {
        const id = seriesId;
        if (id !== '') {
            void load(id);
            poolTextAlly = localStorage.getItem(poolStorageKey(id, 'ally')) ?? '';
            poolTextEnemy = localStorage.getItem(poolStorageKey(id, 'enemy')) ?? '';
        }
    });

    function setPoolText(side: 'ally' | 'enemy', text: string): void {
        if (side === 'ally') poolTextAlly = text;
        else poolTextEnemy = text;
        if (seriesId !== '') localStorage.setItem(poolStorageKey(seriesId, side), text);
    }

    onMount(() => {
        void loadPlans();
    });

    async function load(id: string): Promise<void> {
        loading = true;
        loadError = null;
        try {
            const found = (await getSeries(id)) ?? null;
            series = found;
            if (found !== null) currentGame = defaultGameNumber(found);
        } catch (error) {
            loadError = error instanceof Error ? error.message : String(error);
        } finally {
            loading = false;
        }
    }

    async function loadPlans(): Promise<void> {
        try {
            plans = (await listDraftPlans()).sort((a, b) => b.updatedAt - a.updatedAt);
        } catch {
            plans = []; // plans are optional sugar here — keep the editor alive
        }
    }

    /** First game without a result, else the last game of the format. */
    function defaultGameNumber(s: Series): number {
        const count = GAME_COUNT[s.format];
        for (let n = 1; n <= count; n++) {
            const g = s.games.find((gg) => gg.gameNumber === n);
            if (g === undefined || g.result === null) return n;
        }
        return count;
    }

    const gameCount = $derived(series === null ? 0 : GAME_COUNT[series.format]);

    const game = $derived.by((): FsSeriesGame | null => {
        if (series === null) return null;
        return (series.games.find((g) => g.gameNumber === currentGame) as FsSeriesGame | undefined) ?? null;
    });

    // ---- slot array helpers ('' = empty in storage, null = empty in the UI) ----
    function padded(keys: string[] | undefined): (string | null)[] {
        return Array.from({ length: 5 }, (_, i) => {
            const k = keys?.[i] ?? '';
            return k === '' ? null : k;
        });
    }

    function packed(slots: (string | null)[]): string[] {
        return slots.map((k) => k ?? '');
    }

    const allyPicks = $derived(padded(game?.allyPicks));
    const enemyPicks = $derived(padded(game?.enemyPicks));
    const allyBans = $derived(padded(game?.allyBans));
    const enemyBans = $derived(padded(game?.enemyBans));
    const allySide = $derived(game?.allySide ?? 'blue');

    /** Fearless: champions consumed in the OTHER games of the series. */
    const lockedKeys = $derived.by((): string[] => {
        if (series === null || series.mode !== 'fearless') return [];
        const keys: string[] = [];
        for (const g of series.games) {
            if (g.gameNumber === currentGame) continue;
            for (const key of [...g.allyPicks, ...g.enemyPicks]) {
                if (key !== '') keys.push(key);
            }
        }
        return [...new Set(keys)];
    });

    const enemyKeys = $derived(enemyPicks.filter((k): k is string => k !== null));
    const adversaryRead = $derived(enemyKeys.length > 0 ? detectAdversaryPlan(enemyKeys) : null);

    const score = $derived.by(() => {
        if (series === null) return { ally: 0, enemy: 0 };
        return {
            ally: series.games.filter((g) => g.result === 'ally').length,
            enemy: series.games.filter((g) => g.result === 'enemy').length
        };
    });

    // ---- persistence ----
    async function patchGame(patch: Partial<FsSeriesGame>): Promise<void> {
        const s = series;
        if (s === null) return;
        // Snapshot first: reactive proxies cannot be structured-cloned by IndexedDB.
        const plain = $state.snapshot(s) as Series;
        const existing = plain.games.find((g) => g.gameNumber === currentGame) as FsSeriesGame | undefined;
        const base: FsSeriesGame =
            existing ??
            ({
                ...emptyGame(currentGame),
                allyPicks: packed(padded(undefined)),
                enemyPicks: packed(padded(undefined)),
                allyBans: packed(padded(undefined)),
                enemyBans: packed(padded(undefined))
            } as FsSeriesGame);
        const next: FsSeriesGame = { ...base, ...patch };
        series = await saveSeries(upsertGame(plain, next));
    }

    function setPick(team: 'ally' | 'enemy', role: Role, championKey: string | null): void {
        const slots = team === 'ally' ? [...allyPicks] : [...enemyPicks];
        slots[role] = championKey;
        void patchGame(team === 'ally' ? { allyPicks: packed(slots) } : { enemyPicks: packed(slots) });
    }

    function setBan(team: 'ally' | 'enemy', banIndex: number, championKey: string | null): void {
        const slots = team === 'ally' ? [...allyBans] : [...enemyBans];
        slots[banIndex] = championKey;
        void patchGame(team === 'ally' ? { allyBans: packed(slots) } : { enemyBans: packed(slots) });
    }

    function setResult(result: GameWinner): void {
        void patchGame({ result });
    }

    async function resetGame(): Promise<void> {
        const s = series;
        if (s === null) return;
        if (!confirm(`Réinitialiser le game ${currentGame} ?`)) return;
        applyNotes = [];
        const plain = $state.snapshot(s) as Series;
        series = await saveSeries(removeGame(plain, currentGame));
    }

    // ---- First Selection (2026 rule) ----
    const opposite = (side: 'blue' | 'red'): 'blue' | 'red' => (side === 'blue' ? 'red' : 'blue');

    /** Team-anchored view of the stored side-anchored holder. */
    const fsTeam = $derived.by((): 'none' | 'ally' | 'enemy' => {
        const fs = game?.firstSelection;
        if (fs === undefined) return 'none';
        return fs.holder === allySide ? 'ally' : 'enemy';
    });

    function setFsTeam(value: string): void {
        if (value !== 'ally' && value !== 'enemy') {
            void patchGame({ firstSelection: undefined });
            return;
        }
        const holder = value === 'ally' ? allySide : opposite(allySide);
        const choice = game?.firstSelection?.choice ?? 'side';
        void patchGame({ firstSelection: { holder, choice } });
    }

    function setFsChoice(choice: 'side' | 'pick'): void {
        const fs = game?.firstSelection;
        if (fs === undefined) return;
        void patchGame({ firstSelection: { holder: fs.holder, choice } });
    }

    /** Flip the ally side, re-anchoring the FS holder to keep the same TEAM. */
    function setAllySide(side: 'blue' | 'red'): void {
        const fs = game?.firstSelection;
        if (fs === undefined) {
            void patchGame({ allySide: side });
            return;
        }
        const holderTeam = fs.holder === allySide ? 'ally' : 'enemy';
        void patchGame({
            allySide: side,
            firstSelection: { holder: holderTeam === 'ally' ? side : opposite(side), choice: fs.choice }
        });
    }

    // ---- apply a saved plan to the ally slots (Sprint E) ----
    const applicablePlans = $derived(
        plans.filter(
            (p) =>
                p.applicableGames === undefined ||
                p.applicableGames.length === 0 ||
                p.applicableGames.includes(currentGame)
        )
    );

    function applyPlan(): void {
        const plan = plans.find((p) => p.id === selectedPlanId);
        if (plan === undefined || series === null) return;
        const notes: string[] = [];
        const used: string[] = [...lockedKeys, ...enemyKeys];
        const nextPicks: string[] = ['', '', '', '', ''];
        for (const row of plan.picks) {
            const candidate = [row.primary, row.fallback].find(
                (k): k is string => k !== null && !used.includes(k)
            );
            if (candidate !== undefined) {
                nextPicks[row.role] = candidate;
                used.push(candidate);
                if (candidate !== row.primary) {
                    notes.push(`${ROLE_LABELS[row.role]} : pick principal indisponible → fallback appliqué.`);
                }
            } else if (row.primary !== null) {
                notes.push(`${ROLE_LABELS[row.role]} : principal et fallback indisponibles (Fearless) — slot laissé vide.`);
            }
        }
        const nextBans = plan.bans.map((b) => b.championKey ?? '');
        applyNotes = notes;
        void patchGame({ allyPicks: nextPicks, allyBans: nextBans, planId: plan.id });
    }

    function tabResult(n: number): GameWinner {
        return series?.games.find((g) => g.gameNumber === n)?.result ?? null;
    }

    // ---- C1: Fearless war room (I4 solver) ----
    interface ParsedPools {
        pools: Partial<Record<Role, ChampionPoolEntry[]>>;
        /** Names the champion lookup could not resolve. */
        unresolved: string[];
        /** Total resolved entries across the five roles. */
        count: number;
    }

    /**
     * One line per role ("Top : Rumble, Gnar"), names resolved through the
     * champion lookup. Entries carry neutral 0/0 stats: the solver then reads
     * pool DEPTH, not quality (manual entry has no winrate evidence).
     */
    function parsePoolText(text: string): ParsedPools {
        const pools: Partial<Record<Role, ChampionPoolEntry[]>> = {};
        const unresolved: string[] = [];
        let count = 0;
        for (const line of text.split('\n')) {
            const sep = line.indexOf(':');
            if (sep < 0) continue;
            const role = parseRoleString(line.slice(0, sep));
            if (role === undefined) continue;
            const entries: ChampionPoolEntry[] = pools[role] ?? [];
            for (const raw of line.slice(sep + 1).split(',')) {
                const name = raw.trim();
                if (name === '') continue;
                const key = resolveChampionKey(name);
                if (key === undefined) {
                    unresolved.push(name);
                } else if (!entries.some((e) => e.championKey === key)) {
                    entries.push({ championKey: key, games: 0, wins: 0 });
                    count += 1;
                }
            }
            pools[role] = entries;
        }
        return { pools, unresolved, count };
    }

    const allyParsed = $derived(parsePoolText(poolTextAlly));
    const enemyParsed = $derived(parsePoolText(poolTextEnemy));

    /** The solver only models the Fearless resource war on Bo3/Bo5. */
    const warRoomEligible = $derived(
        series !== null && series.mode === 'fearless' && series.format !== 'bo1'
    );

    /**
     * Solver outputs, recomputed when the series or the pools change (never a
     * hot path — both change on explicit edits). One memo shared between
     * seriesValue and mustWinAnalysis. No want model on this route →
     * mustWin's denial column stays null (« non chiffré »).
     */
    const warRoom = $derived.by(() => {
        const s = series;
        if (s === null || s.mode !== 'fearless' || s.format === 'bo1') return null;
        if (allyParsed.count === 0 && enemyParsed.count === 0) return null;
        const state = seriesStateFromSeries(
            s,
            { ally: allyParsed.pools, enemy: enemyParsed.pools },
            fsTeam === 'none' ? undefined : fsTeam
        );
        const memo: SeriesValueMemo = new Map();
        return {
            state,
            integrityAlly: poolIntegrity(state, 'ally'),
            integrityEnemy: poolIntegrity(state, 'enemy'),
            value: seriesValue(state, {}, memo),
            mustWin: mustWinAnalysis(state, {}, memo)
        };
    });

    /** FR note lines for the re-plan sheet: remaining champions per role. */
    function remainingPoolNotes(state: SeriesState): string[] {
        const notes: string[] = [];
        for (const side of ['ally', 'enemy'] as const) {
            const label = side === 'ally' ? 'Allié' : 'Adverse';
            for (const role of ROLES) {
                const remaining = (state.poolsBySide[side][role] ?? []).filter(
                    (e) => !state.consumed.has(e.championKey)
                );
                if (remaining.length === 0) continue;
                const names = remaining
                    .map((e) => championNameByKey(e.championKey) ?? e.championKey)
                    .join(', ');
                notes.push(`${label} ${ROLE_LABELS[role]} restants : ${names}`);
            }
        }
        return notes;
    }

    const replanActions = $derived.by((): ExportAction[] => {
        const room = warRoom;
        const s = series;
        if (room === null || s === null) return [];
        const slug =
            s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'serie';
        return [
            {
                label: 'Feuille re-plan .md',
                filename: `replan-${slug}-g${room.state.gameNumber}.md`,
                mime: 'text/markdown;charset=utf-8',
                build: () =>
                    renderRePlanSheet({
                        gameNumber: room.state.gameNumber,
                        score: room.state.score,
                        generatedAt: new Date().toLocaleString('fr-FR'),
                        integrity: { ally: room.integrityAlly, enemy: room.integrityEnemy },
                        notesFr: remainingPoolNotes(room.state)
                    })
            }
        ];
    });
</script>

<svelte:head>
    <title>DraftLab — Série {series?.name ?? ''}</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-3">
    <p>
        <a href={resolve('/series')} class="text-xs text-slate-500 hover:text-slate-300">← Toutes les séries</a>
    </p>

    {#if loading}
        <p class="px-1 text-sm text-slate-500">Chargement de la série…</p>
    {:else if loadError !== null}
        <p class="px-1 text-sm text-red-400">Échec de lecture : {loadError}</p>
    {:else if series === null}
        <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
            Série introuvable — elle a peut-être été supprimée.
        </div>
    {:else}
        <!-- Header -->
        <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <div class="flex flex-wrap items-center gap-3">
                <h1 class="text-sm font-bold text-slate-100">{series.name}</h1>
                <span class="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase">
                    {series.format}
                </span>
                {#if series.mode === 'fearless'}
                    <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                        Fearless
                    </span>
                {:else}
                    <span class="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                        Standard
                    </span>
                {/if}
                <span class="ml-auto text-sm">
                    <span class="font-semibold text-blue-400">{series.allyTeam || 'Allié'}</span>
                    <span class="px-2 text-lg font-bold text-slate-200">{score.ally} – {score.enemy}</span>
                    <span class="font-semibold text-red-400">{series.enemyTeam || 'Adverse'}</span>
                </span>
            </div>

            <!-- Game tabs -->
            <div class="flex gap-1 pt-3">
                {#each Array.from({ length: gameCount }, (_, i) => i + 1) as n (n)}
                    <button
                        type="button"
                        onclick={() => {
                            currentGame = n;
                            applyNotes = [];
                        }}
                        class="flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold {currentGame === n
                            ? 'bg-slate-700 text-slate-100'
                            : 'bg-slate-800/60 text-slate-500 hover:text-slate-300'}"
                    >
                        Game {n}
                        {#if tabResult(n) === 'ally'}
                            <span class="font-bold text-emerald-400">V</span>
                        {:else if tabResult(n) === 'enemy'}
                            <span class="font-bold text-red-400">D</span>
                        {/if}
                    </button>
                {/each}
            </div>
        </section>

        <!-- Per-game controls: First Selection + result + plan -->
        <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <div class="flex flex-wrap items-end gap-4">
                <div>
                    <span class="block pb-1 text-xs text-slate-500">
                        First Selection (règle 2026 : side <em>ou</em> first pick)
                    </span>
                    <div class="flex gap-2">
                        <select
                            value={fsTeam}
                            onchange={(e) => setFsTeam(e.currentTarget.value)}
                            aria-label="Détenteur de la First Selection"
                            class="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="none">— non renseignée</option>
                            <option value="ally">{series.allyTeam || 'Allié'} (nous)</option>
                            <option value="enemy">{series.enemyTeam || 'Adverse'} (eux)</option>
                        </select>
                        <select
                            value={game?.firstSelection?.choice ?? 'side'}
                            disabled={fsTeam === 'none'}
                            onchange={(e) => setFsChoice(e.currentTarget.value === 'pick' ? 'pick' : 'side')}
                            aria-label="Choix de la First Selection"
                            class="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none disabled:opacity-40"
                        >
                            <option value="side">a choisi son side</option>
                            <option value="pick">a choisi le first pick</option>
                        </select>
                    </div>
                </div>

                <div>
                    <span class="block pb-1 text-xs text-slate-500">Résultat du game</span>
                    <div class="flex overflow-hidden rounded-md border border-slate-700">
                        <button
                            type="button"
                            onclick={() => setResult('ally')}
                            class="px-3 py-1.5 text-xs font-semibold {game?.result === 'ally'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'text-slate-500 hover:text-slate-300'}"
                        >
                            Victoire
                        </button>
                        <button
                            type="button"
                            onclick={() => setResult('enemy')}
                            class="px-3 py-1.5 text-xs font-semibold {game?.result === 'enemy'
                                ? 'bg-red-500/20 text-red-300'
                                : 'text-slate-500 hover:text-slate-300'}"
                        >
                            Défaite
                        </button>
                        <button
                            type="button"
                            onclick={() => setResult(null)}
                            class="px-3 py-1.5 text-xs font-semibold {game?.result === null ||
                            game === null
                                ? 'bg-slate-700 text-slate-200'
                                : 'text-slate-500 hover:text-slate-300'}"
                        >
                            Non joué
                        </button>
                    </div>
                </div>

                <div class="min-w-56">
                    <span class="block pb-1 text-xs text-slate-500">Appliquer un plan aux slots alliés</span>
                    <div class="flex gap-2">
                        <select
                            bind:value={selectedPlanId}
                            aria-label="Plan à appliquer"
                            class="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">Choisir un plan…</option>
                            {#each applicablePlans as plan (plan.id)}
                                <option value={plan.id}>{plan.name}</option>
                            {/each}
                        </select>
                        <button
                            type="button"
                            onclick={applyPlan}
                            disabled={selectedPlanId === ''}
                            class="rounded-md bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/25 disabled:opacity-40"
                        >
                            Appliquer
                        </button>
                    </div>
                    {#if applicablePlans.length === 0}
                        <p class="pt-1 text-[10px] text-slate-600">
                            Aucun plan applicable au game {currentGame} — voir l'onglet Plans.
                        </p>
                    {/if}
                </div>

                <button
                    type="button"
                    onclick={() => void resetGame()}
                    class="ml-auto rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-red-500/10 hover:text-red-400"
                >
                    Réinitialiser ce game
                </button>
            </div>

            {#if applyNotes.length > 0}
                <ul class="space-y-0.5 pt-2 text-[11px] text-amber-400">
                    {#each applyNotes as note, i (i)}
                        <li>⚠ {note}</li>
                    {/each}
                </ul>
            {/if}
        </section>

        <!-- Draft input -->
        <ManualDraftPicker
            {allySide}
            {allyPicks}
            {enemyPicks}
            {allyBans}
            {enemyBans}
            excludedKeys={lockedKeys}
            onAllySideChange={setAllySide}
            onPickChange={setPick}
            onBanChange={setBan}
        />
        {#if series.mode === 'fearless' && lockedKeys.length > 0}
            <p class="px-1 text-[10px] text-slate-600">
                Fearless : {lockedKeys.length} champion{lockedKeys.length > 1 ? 's' : ''} des autres games
                désactivé{lockedKeys.length > 1 ? 's' : ''} dans le sélecteur.
            </p>
        {/if}

        <!-- Series-wide reads -->
        <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
            <ConsumptionTrackerPanel {series} />
            <div class="space-y-1">
                <AdversaryPlanEvolution read={adversaryRead} title="Lecture adverse — game {currentGame}" />
                {#if enemyKeys.length > 0}
                    <p class="px-1 text-[10px] text-slate-600">
                        Saisie par rôle : l'ordre des picks adverses est indicatif (Top → Support).
                    </p>
                {/if}
            </div>
        </div>

        <!-- C1: Fearless war room (Bo3/Bo5 only) -->
        {#if warRoomEligible}
            <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <h2 class="pb-1 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
                    Pools par rôle (saisie manuelle)
                </h2>
                <p class="pb-2 text-[11px] text-slate-500">
                    Une ligne par rôle, champions séparés par des virgules — ex. «&nbsp;Top : Rumble, Gnar&nbsp;».
                    Sauvegardé localement pour cette série. Sans stats, le solveur lit la
                    <em>profondeur</em> des pools, pas leur qualité.
                </p>
                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {#each [{ side: 'ally' as const, label: series.allyTeam || 'Allié', accent: 'text-blue-400', text: poolTextAlly, parsed: allyParsed }, { side: 'enemy' as const, label: series.enemyTeam || 'Adverse', accent: 'text-red-400', text: poolTextEnemy, parsed: enemyParsed }] as col (col.side)}
                        <div>
                            <span class="block pb-1 text-xs font-semibold {col.accent}">
                                {col.label} — {col.parsed.count} champion{col.parsed.count > 1 ? 's' : ''}
                            </span>
                            <textarea
                                value={col.text}
                                oninput={(e) => setPoolText(col.side, e.currentTarget.value)}
                                rows="6"
                                spellcheck="false"
                                aria-label="Pools par rôle — {col.label}"
                                placeholder="Top : Rumble, Gnar&#10;Jungle : Vi, Sejuani&#10;Mid : Ahri&#10;ADC : Xayah, Tristana&#10;Support : Rakan"
                                class="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                            ></textarea>
                            {#if col.parsed.unresolved.length > 0}
                                <p class="pt-1 text-[11px] text-amber-400">
                                    ⚠ Non reconnus : {col.parsed.unresolved.join(', ')}
                                </p>
                            {/if}
                        </div>
                    {/each}
                </div>
            </section>

            {#if warRoom !== null}
                <WarRoomPanel
                    integrityAlly={warRoom.integrityAlly}
                    integrityEnemy={warRoom.integrityEnemy}
                    series={warRoom.value}
                    mustWin={warRoom.mustWin}
                    title="War room — game {warRoom.state.gameNumber} à venir"
                />
                <ExportBar
                    actions={replanActions}
                    title="Exports — entre les games"
                    note="Feuille re-plan une page : intégrité des deux pools + champions restants par rôle. Générée au clic depuis l'état affiché."
                />
            {:else}
                <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
                    War room : renseignez au moins un pool ci-dessus pour lire l'intégrité des pools, la
                    valeur de série et l'arbitrage dépenser/garder.
                </div>
            {/if}
        {/if}
    {/if}
</div>
