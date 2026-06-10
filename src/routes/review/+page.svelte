<!--
/**
 * Route /review — annotated draft review (C1: I5 annotator + navigator oracle).
 *
 * Pick a game from a saved series OR a sample draft, rebuild a DraftRecord on
 * the blue-first template (role-ordered picks: the manual flow doesn't know
 * the true pick order — flagged in the UI), then grade the chosen side's
 * decisions with `annotateDraft`. The oracle is the expectimax navigator over
 * the M1 evaluator (`makeAnalyzeDraftEvaluator` + `navigate`), bounded at
 * depth 2 / top-6 for UI reactivity and run from a CLICK handler (never a hot
 * $derived); one navigate call per annotated action serves both `valueOf` and
 * `bestAlternative` through a per-prefix cache plus a shared transposition
 * memo.
 *
 * Replay realism: enemy slots are "predicted" as the move actually played
 * (probability 1) — the review grades decisions against the real
 * continuation, the chess-review convention; slots beyond the record fall
 * back to a uniform top-meta range. Template gaps (missed bans, missing
 * picks) are filled with sentinel actions so the navigator's next slot always
 * matches the action under review. Fearless series feed `consumed` (earlier
 * games' picks), enabling the wasted-ban note and shrinking the start pool.
 */
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { resolve } from '$app/paths';
    import { ROLES, type AnalyzeDraftConfig, type Dataset } from '$lib/types';
    import { fetchDatasetPair, type DatasetPair } from '$lib/dataset/fetch';
    import { listSeries, type Series, type SeriesGame } from '$lib/storage/series';
    import { DRAFT_TEMPLATE, buildDraftActions } from '$lib/data/draftRecord';
    import { resolveChampionKey } from '$lib/data/normalize';
    import type { DraftAction, DraftRecord, DraftSide, TeamDraftColumns } from '$lib/data/types';
    import {
        makeAnalyzeDraftEvaluator,
        navigate,
        nextSlotOf,
        type DraftState,
        type EnemyDistributionEntry,
        type NavigatorMemoEntry,
        type NavigatorResult,
        type NavigatorSlot
    } from '$lib/strategic/draftNavigator';
    import {
        annotateDraft,
        leakReport,
        type AnnotatorContext,
        type DraftAnnotation,
        type LeakEntry
    } from '$lib/review/annotator';
    import { loadDefaultTags } from '$lib/tags';
    import ReviewBoard from '$lib/components/ReviewBoard.svelte';
    import rawSamples from '../../../data/sampleDrafts.json';

    interface SampleSide {
        side: string;
        label: string;
        champions: string[];
    }

    interface SampleDraft {
        id: string;
        label: string;
        context: string;
        ally: SampleSide;
        enemy: SampleSide;
    }

    const SAMPLES = rawSamples as SampleDraft[];
    const tagsFile = loadDefaultTags();

    /** UI-reactivity bound (mission C1): never deeper than 2 / wider than 6. */
    const NAVIGATOR_DEPTH = 2;
    const NAVIGATOR_TOP_K = 6;
    /** Meta candidate pool fed to the navigator (most-played champions). */
    const META_CANDIDATES = 30;

    const GAME_COUNT: Record<Series['format'], number> = { bo1: 1, bo3: 3, bo5: 5 };

    // ---- dataset (oracle fuel) ----
    let datasets = $state<DatasetPair | null>(null);
    let datasetLoading = $state(true);
    let datasetError = $state<string | null>(null);

    // ---- source selection ----
    let seriesList = $state<Series[]>([]);
    let seriesLoadError = $state<string | null>(null);
    let sourceMode = $state<'series' | 'sample'>('series');
    let selectedSeriesId = $state('');
    let selectedGameNumber = $state(1);
    let sampleId = $state(SAMPLES[0]?.id ?? '');
    let reviewTeam = $state<'ally' | 'enemy'>('ally');

    // ---- analysis output ----
    let analyzing = $state(false);
    let analysisError = $state<string | null>(null);
    let annotation = $state<DraftAnnotation | null>(null);
    let leaks = $state<LeakEntry[]>([]);

    onMount(() => {
        void loadDatasets();
        void loadSeries();
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

    async function loadSeries(): Promise<void> {
        try {
            seriesList = (await listSeries()).sort((a, b) => b.updatedAt - a.updatedAt);
            if (seriesList.length > 0) selectSeries(seriesList[0].id);
        } catch (error) {
            seriesLoadError = error instanceof Error ? error.message : String(error);
        }
    }

    const selectedSeries = $derived(seriesList.find((s) => s.id === selectedSeriesId) ?? null);
    const selectedGame = $derived(
        selectedSeries?.games.find((g) => g.gameNumber === selectedGameNumber) ?? null
    );
    const selectedSample = $derived(SAMPLES.find((s) => s.id === sampleId) ?? null);

    const gameHasPicks = (game: SeriesGame | null): boolean =>
        game !== null && [...game.allyPicks, ...game.enemyPicks].some((k) => k !== '');

    function selectSeries(id: string): void {
        selectedSeriesId = id;
        const s = seriesList.find((x) => x.id === id);
        // Default to the first game that actually has picks.
        const withPicks = s?.games.find((g) => gameHasPicks(g));
        selectedGameNumber = withPicks?.gameNumber ?? 1;
    }

    const canAnalyze = $derived(
        datasets !== null &&
            !analyzing &&
            (sourceMode === 'series' ? gameHasPicks(selectedGame) : selectedSample !== null)
    );

    // ---- record reconstruction (blue-first template) ----
    function nameOfKey(key: string): string {
        return tagsFile.champions[key]?.name ?? key;
    }

    /** Role-ordered keys → per-team columns (names round-trip the lookup). */
    function columnsOf(picks: string[], bans: string[]): TeamDraftColumns {
        const names = (keys: string[]): (string | undefined)[] =>
            Array.from({ length: 5 }, (_, i) => {
                const key = keys[i] ?? '';
                return key === '' ? undefined : nameOfKey(key);
            });
        return { bans: names(bans), picks: names(picks), roles: [...ROLES] };
    }

    /**
     * Fill missing template slots with sentinel actions (championKey ''): the
     * annotator's walk then advances slot by slot and the navigator's next
     * slot always matches the action under review (samples have no bans,
     * series games may have empty slots).
     */
    function fillTemplateGaps(actions: DraftAction[]): DraftAction[] {
        const bySeq = new Map(actions.map((a) => [a.seq, a]));
        return DRAFT_TEMPLATE.map(
            (slot) =>
                bySeq.get(slot.seq) ?? {
                    seq: slot.seq,
                    type: slot.type,
                    phase: slot.phase,
                    // Records here are always anchored blue-first.
                    side: (slot.first ? 'blue' : 'red') as DraftSide,
                    championKey: '',
                    championName: ''
                }
        );
    }

    function buildRecord(
        gameId: string,
        teams: { ally: string; enemy: string },
        allySide: DraftSide,
        ally: TeamDraftColumns,
        enemy: TeamDraftColumns,
        fetchedAt: string
    ): DraftRecord {
        const { actions, warnings } = buildDraftActions({
            blue: allySide === 'blue' ? ally : enemy,
            red: allySide === 'red' ? ally : enemy,
            firstPickSide: 'blue',
            resolveKey: resolveChampionKey
        });
        return {
            gameId,
            blueTeam: allySide === 'blue' ? teams.ally : teams.enemy,
            redTeam: allySide === 'red' ? teams.ally : teams.enemy,
            firstPickSide: 'blue',
            orderConfidence: 'assumed-blue-first',
            actions: fillTemplateGaps(actions),
            warnings,
            provenance: { source: 'manual', fetchedAt }
        };
    }

    function recordFromSeriesGame(s: Series, game: SeriesGame, fetchedAt: string): DraftRecord {
        const allySide = game.allySide ?? 'blue';
        return buildRecord(
            `${s.name || 'Série'} — G${game.gameNumber}`,
            { ally: s.allyTeam || 'Allié', enemy: s.enemyTeam || 'Adverse' },
            allySide,
            columnsOf(game.allyPicks, game.allyBans),
            columnsOf(game.enemyPicks, game.enemyBans),
            fetchedAt
        );
    }

    function recordFromSample(sample: SampleDraft, fetchedAt: string): DraftRecord {
        const allySide: DraftSide = sample.ally.side === 'red' ? 'red' : 'blue';
        return buildRecord(
            sample.label,
            { ally: sample.ally.label, enemy: sample.enemy.label },
            allySide,
            columnsOf(sample.ally.champions, []),
            columnsOf(sample.enemy.champions, []),
            fetchedAt
        );
    }

    // ---- oracle wiring (navigator over the M1 evaluator) ----
    /** Most-played champions of the 30-day dataset — the candidate generator. */
    function metaTopOf(dataset: Dataset): string[] {
        return Object.values(dataset.championData)
            .map((champion) => ({
                key: champion.key,
                games: ROLES.reduce((sum, role) => sum + (champion.statsByRole[role]?.games ?? 0), 0)
            }))
            .sort((a, b) => b.games - a.games || (a.key < b.key ? -1 : 1))
            .slice(0, META_CANDIDATES)
            .map((entry) => entry.key);
    }

    function runAnnotation(
        pair: DatasetPair,
        record: DraftRecord,
        side: DraftSide,
        consumed: Set<string> | undefined
    ): { annotation: DraftAnnotation; leaks: LeakEntry[] } {
        const config: AnalyzeDraftConfig = {
            ignoreChampionWinrates: false,
            riskLevel: 'medium',
            minGames: 0
        };
        const evaluate = makeAnalyzeDraftEvaluator(
            { dataset: pair.dataset, fullDataset: pair.fullDataset },
            config
        );
        const metaTop = metaTopOf(pair.fullDataset);

        const playedBySeq: Partial<Record<number, string>> = {};
        for (const action of record.actions) {
            if (action.championKey !== '') playedBySeq[action.seq] = action.championKey;
        }

        // Start universe: full dataset pool (+ record keys) minus consumed.
        const universeKeys = [
            ...Object.keys(pair.fullDataset.championData),
            ...record.actions.map((a) => a.championKey).filter((k) => k !== '')
        ].filter((key) => consumed?.has(key) !== true);

        // Engine-owned transposition table (mutated by navigate, not here).
        const navMemo = new Map<string, NavigatorMemoEntry>();
        const navCache: Partial<Record<number, NavigatorResult>> = {};

        /** The actually-played move always heads our candidate list. */
        const ourCandidates = (state: DraftState): string[] => {
            const slot = nextSlotOf(state);
            const played = slot === null ? undefined : playedBySeq[slot.seq];
            return played !== undefined ? [played, ...metaTop.filter((k) => k !== played)] : metaTop;
        };

        /** Replay realism: the enemy "range" is the move they actually made. */
        const enemyDistribution = (state: DraftState, slot: NavigatorSlot): EnemyDistributionEntry[] => {
            const played = playedBySeq[slot.seq];
            if (played !== undefined && state.available.has(played)) {
                return [{ championKey: played, p: 1 }];
            }
            const open = metaTop.filter((k) => state.available.has(k)).slice(0, NAVIGATOR_TOP_K);
            return open.map((k) => ({ championKey: k, p: 1 / Math.max(1, open.length) }));
        };

        /** One navigate per annotated prefix — shared by valueOf AND best. */
        const navigateAt = (state: DraftState): NavigatorResult => {
            const cacheKey = state.actions.length;
            let result = navCache[cacheKey];
            if (result === undefined) {
                result = navigate(state, {
                    ourSide: side,
                    ourCandidates,
                    enemyDistribution,
                    evaluate,
                    depth: NAVIGATOR_DEPTH,
                    topK: NAVIGATOR_TOP_K,
                    memo: navMemo
                });
                navCache[cacheKey] = result;
            }
            return result;
        };

        const picksAfter = (state: DraftState, action: DraftAction, forSide: DraftSide): string[] => {
            const picks = state.actions
                .filter((a) => a.type === 'pick' && a.side === forSide && a.championKey !== '')
                .map((a) => a.championKey);
            if (action.type === 'pick' && action.side === forSide && action.championKey !== '') {
                picks.push(action.championKey);
            }
            return picks;
        };

        const enemyOf = (s: DraftSide): DraftSide => (s === 'blue' ? 'red' : 'blue');

        const ctx: AnnotatorContext = {
            side,
            valueOf: (state, action) => {
                const hit = navigateAt(state).candidates.find(
                    (c) => c.championKey === action.championKey
                );
                if (hit !== undefined) return hit.value;
                // The played move is injected first into the candidates, so
                // this only fires off-template — honest immediate evaluation.
                return evaluate(picksAfter(state, action, side), picksAfter(state, action, enemyOf(side)));
            },
            bestAlternative: (state) => {
                const top = navigateAt(state).candidates[0];
                if (top !== undefined) return { championKey: top.championKey, value: top.value };
                const noop: DraftAction = {
                    seq: 0,
                    type: 'ban',
                    phase: 'ban1',
                    side,
                    championKey: '',
                    championName: ''
                };
                return {
                    championKey: '',
                    value: evaluate(picksAfter(state, noop, side), picksAfter(state, noop, enemyOf(side)))
                };
            },
            availableAtStart: new Set(universeKeys),
            ...(consumed !== undefined ? { consumed } : {})
        };

        const result = annotateDraft(record, ctx);
        return { annotation: result, leaks: leakReport([result]) };
    }

    // ---- analysis trigger (click handler — never a hot $derived) ----
    function analyze(): void {
        const pair = datasets;
        if (pair === null || analyzing) return;
        const fetchedAt = new Date().toISOString(); // clock at the UI edge

        let record: DraftRecord;
        let reviewedSide: DraftSide;
        let consumed: Set<string> | undefined;
        if (sourceMode === 'series') {
            const s = selectedSeries;
            const game = selectedGame;
            if (s === null || game === null) return;
            record = recordFromSeriesGame(s, game, fetchedAt);
            const allySide = game.allySide ?? 'blue';
            reviewedSide = reviewTeam === 'ally' ? allySide : allySide === 'blue' ? 'red' : 'blue';
            if (s.mode === 'fearless') {
                consumed = new Set(
                    s.games
                        .filter((g) => g.gameNumber < game.gameNumber)
                        .flatMap((g) => [...g.allyPicks, ...g.enemyPicks])
                        .filter((k) => k !== '')
                );
            }
        } else {
            const sample = selectedSample;
            if (sample === null) return;
            record = recordFromSample(sample, fetchedAt);
            const allySide: DraftSide = sample.ally.side === 'red' ? 'red' : 'blue';
            reviewedSide = reviewTeam === 'ally' ? allySide : allySide === 'blue' ? 'red' : 'blue';
        }

        if (!record.actions.some((a) => a.side === reviewedSide && a.championKey !== '')) {
            analysisError = 'Aucune action résolue pour ce côté — saisissez des picks avant d\'analyser.';
            annotation = null;
            leaks = [];
            return;
        }

        analyzing = true;
        analysisError = null;
        annotation = null;
        leaks = [];
        // Let the spinner paint before the synchronous search starts.
        setTimeout(() => {
            try {
                const result = runAnnotation(pair, record, reviewedSide, consumed);
                annotation = result.annotation;
                leaks = result.leaks;
            } catch (error) {
                analysisError = error instanceof Error ? error.message : String(error);
            } finally {
                analyzing = false;
            }
        }, 30);
    }
</script>

<svelte:head>
    <title>DraftLab — Revue</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-3">
    <!-- Source selection -->
    <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
                <h1 class="text-sm font-bold text-slate-100">Revue annotée</h1>
                <p class="text-xs text-slate-500">
                    Le « moteur d'échecs » de la draft : chaque décision graduée en points de win %
                    contre l'oracle navigator (profondeur {NAVIGATOR_DEPTH}, top-{NAVIGATOR_TOP_K}).
                </p>
            </div>
            <div class="flex overflow-hidden rounded-md border border-slate-700">
                <button
                    type="button"
                    onclick={() => (sourceMode = 'series')}
                    class="px-3 py-1 text-xs font-semibold {sourceMode === 'series'
                        ? 'bg-slate-700 text-slate-100'
                        : 'text-slate-500 hover:text-slate-300'}"
                >
                    Série sauvée
                </button>
                <button
                    type="button"
                    onclick={() => (sourceMode = 'sample')}
                    class="px-3 py-1 text-xs font-semibold {sourceMode === 'sample'
                        ? 'bg-slate-700 text-slate-100'
                        : 'text-slate-500 hover:text-slate-300'}"
                >
                    Draft d'exemple
                </button>
            </div>
        </div>

        <div class="flex flex-wrap items-end gap-3 pt-3">
            {#if sourceMode === 'series'}
                {#if seriesLoadError !== null}
                    <p class="text-xs text-red-400">Échec de lecture des séries : {seriesLoadError}</p>
                {:else if seriesList.length === 0}
                    <p class="text-xs text-slate-500">
                        Aucune série enregistrée —
                        <a href={resolve('/series')} class="text-blue-400 hover:underline">créez-en une</a>
                        et saisissez ses games, ou passez aux drafts d'exemple.
                    </p>
                {:else}
                    <label class="block min-w-56">
                        <span class="block pb-1 text-xs text-slate-500">Série</span>
                        <select
                            value={selectedSeriesId}
                            onchange={(e) => selectSeries(e.currentTarget.value)}
                            class="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                        >
                            {#each seriesList as s (s.id)}
                                <option value={s.id}>{s.name || 'Sans nom'} ({s.format})</option>
                            {/each}
                        </select>
                    </label>
                    {#if selectedSeries !== null}
                        <div>
                            <span class="block pb-1 text-xs text-slate-500">Game</span>
                            <div class="flex gap-1">
                                {#each Array.from({ length: GAME_COUNT[selectedSeries.format] }, (_, i) => i + 1) as n (n)}
                                    {@const g = selectedSeries.games.find((x) => x.gameNumber === n) ?? null}
                                    <button
                                        type="button"
                                        onclick={() => (selectedGameNumber = n)}
                                        disabled={!gameHasPicks(g)}
                                        title={gameHasPicks(g) ? `Game ${n}` : `Game ${n} — aucun pick saisi`}
                                        class="rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-30 {selectedGameNumber === n
                                            ? 'bg-slate-700 text-slate-100'
                                            : 'bg-slate-800/60 text-slate-500 hover:text-slate-300'}"
                                    >
                                        G{n}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/if}
                {/if}
            {:else}
                <label class="block min-w-72">
                    <span class="block pb-1 text-xs text-slate-500">Draft d'exemple</span>
                    <select
                        value={sampleId}
                        onchange={(e) => (sampleId = e.currentTarget.value)}
                        class="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                    >
                        {#each SAMPLES as s (s.id)}
                            <option value={s.id}>{s.label}</option>
                        {/each}
                    </select>
                </label>
            {/if}

            <div>
                <span class="block pb-1 text-xs text-slate-500">Côté analysé</span>
                <div class="flex overflow-hidden rounded-md border border-slate-700">
                    <button
                        type="button"
                        onclick={() => (reviewTeam = 'ally')}
                        class="px-3 py-1.5 text-xs font-semibold {reviewTeam === 'ally'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'text-slate-500 hover:text-slate-300'}"
                    >
                        Allié
                    </button>
                    <button
                        type="button"
                        onclick={() => (reviewTeam = 'enemy')}
                        class="px-3 py-1.5 text-xs font-semibold {reviewTeam === 'enemy'
                            ? 'bg-red-500/20 text-red-300'
                            : 'text-slate-500 hover:text-slate-300'}"
                    >
                        Adverse
                    </button>
                </div>
            </div>

            <button
                type="button"
                onclick={analyze}
                disabled={!canAnalyze}
                class="rounded-md bg-blue-500/15 px-4 py-1.5 text-sm font-medium text-blue-300 hover:bg-blue-500/25 disabled:opacity-40"
            >
                {analyzing ? 'Analyse…' : 'Analyser la draft'}
            </button>
        </div>

        <p class="pt-2 text-[10px] text-slate-600">
            Reconstruction sur le template blue-first : l'ordre des picks = l'ordre des rôles
            (approximation, ordre réel inconnu en saisie manuelle). L'adversaire est rejoué tel quel
            (convention revue post-game).
        </p>
    </section>

    <!-- Dataset state -->
    {#if datasetLoading}
        <div class="animate-pulse rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p class="pb-3 text-sm text-slate-300">
                Téléchargement du dataset DraftGap (~50 Mo au premier lancement, puis cache 24 h)…
            </p>
            <div class="h-32 rounded-md bg-slate-800/60"></div>
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
    {/if}

    <!-- Analysis result -->
    {#if analysisError !== null}
        <p class="rounded-lg border border-amber-900/50 bg-slate-900 px-3 py-2 text-xs text-amber-400">
            ⚠ {analysisError}
        </p>
    {/if}

    {#if analyzing}
        <div class="animate-pulse rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p class="pb-3 text-sm text-slate-300">
                Rejeu de la draft contre l'oracle (≤ 20 décisions × expectimax)…
            </p>
            <div class="h-48 rounded-md bg-slate-800/60"></div>
        </div>
    {:else if annotation !== null}
        <ReviewBoard {annotation} {leaks} title="Revue — {annotation.gameId}" />
        <p class="px-1 text-[10px] text-slate-600">
            Oracle : analyzeDraft (DraftGap SoloQ) via navigator profondeur {NAVIGATOR_DEPTH} /
            top-{NAVIGATOR_TOP_K} — candidats = pick réel + méta la plus jouée. Signal indicatif, pas
            une vérité pro.
        </p>
    {:else if !datasetLoading && datasetError === null}
        <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
            Choisissez une game (série sauvée ou draft d'exemple), le côté à analyser, puis lancez
            l'analyse pour obtenir la timeline graduée ('' / ?! / ? / ??), les « mieux était » et le
            leak report.
        </div>
    {/if}
</div>
