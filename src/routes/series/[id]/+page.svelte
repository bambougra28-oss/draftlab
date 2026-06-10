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
    import { Role } from '$lib/types';
    import { detectAdversaryPlan } from '$lib/strategic/adversaryPlanDetector';
    import ManualDraftPicker from '$lib/components/ManualDraftPicker.svelte';
    import ConsumptionTrackerPanel from '$lib/components/ConsumptionTrackerPanel.svelte';
    import AdversaryPlanEvolution from '$lib/components/AdversaryPlanEvolution.svelte';
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

    const seriesId = $derived(page.params.id ?? '');

    $effect(() => {
        const id = seriesId;
        if (id !== '') void load(id);
    });

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
    {/if}
</div>
