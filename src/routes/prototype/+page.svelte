<!--
/**
 * Route /prototype — strategic layer demo (M4.2 + M4.3 + M4.4 + M5.1 + M5.2).
 *
 * Two input modes (docs/M4_PROTOTYPE.md + M5.2): a selector over the 5
 * illustrative drafts of data/sampleDrafts.json, and a manual mode driven by
 * the ManualDraftPicker. Both feed the same four sections: Game Plan cards
 * (ally/enemy), Power Curves (needs the 30-day dataset → skeleton while it
 * loads), Risk Markers, and the Adversary Plan read (M5.1) on the revealed
 * enemy picks. In manual mode picks are entered by role, so the adversary
 * "pick order" is the role order — flagged as indicative in the UI.
 *
 * Provenance (DA-V2-4): tags coverage under the game plans, dataset version
 * under the curves; sample drafts carry their illustrative-only caveat.
 *
 * C1: the bilateral win-condition graph (I3) reads the same sample/manual
 * comps as soon as each side has one champion — role-ordered arrays with ''
 * holes keep the lane indices for the snowball axis; the dataset refinement
 * of the scaling axis kicks in when both comps are full.
 */
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { Role } from '$lib/types';
    import { fetchDatasetPair, type DatasetPair } from '$lib/dataset/fetch';
    import { classifyGamePlan } from '$lib/strategic/gamePlanClassifier';
    import { detectRiskMarkers } from '$lib/strategic/riskMarkerDetector';
    import { detectAdversaryPlan } from '$lib/strategic/adversaryPlanDetector';
    import { analyzeWinConditions } from '$lib/strategic/winConditionGraph';
    import { loadDefaultTags } from '$lib/tags';
    import WinConditionPanel from '$lib/components/WinConditionPanel.svelte';
    import GamePlanCard from '$lib/components/GamePlanCard.svelte';
    import PowerCurveVisualizer from '$lib/components/PowerCurveVisualizer.svelte';
    import RiskMarkerList from '$lib/components/RiskMarkerList.svelte';
    import AdversaryPlanEvolution from '$lib/components/AdversaryPlanEvolution.svelte';
    import ManualDraftPicker from '$lib/components/ManualDraftPicker.svelte';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';
    import { ROLE_LABELS } from '$lib/components/ChampionSlot.svelte';
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

    // ---- dataset (power curves + matchup-based risk marker) ----
    let datasets = $state<DatasetPair | null>(null);
    let datasetLoading = $state(true);
    let datasetError = $state<string | null>(null);

    onMount(() => {
        void loadDatasets();
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

    // ---- input modes ----
    let mode = $state<'sample' | 'manual'>('sample');
    let sampleId = $state(SAMPLES[0]?.id ?? '');

    const emptyFive = (): (string | null)[] => [null, null, null, null, null];
    let allySide = $state<'blue' | 'red'>('blue');
    let allyPicks = $state<(string | null)[]>(emptyFive());
    let enemyPicks = $state<(string | null)[]>(emptyFive());
    let allyBans = $state<(string | null)[]>(emptyFive());
    let enemyBans = $state<(string | null)[]>(emptyFive());

    const sample = $derived(SAMPLES.find((s) => s.id === sampleId) ?? null);

    /**
     * Compositions ordered by role; '' marks an empty manual slot (the
     * calculators skip unknown keys, preserving the role index).
     */
    const allyComp = $derived(
        mode === 'sample' ? (sample?.ally.champions ?? []) : allyPicks.map((k) => k ?? '')
    );
    const enemyComp = $derived(
        mode === 'sample' ? (sample?.enemy.champions ?? []) : enemyPicks.map((k) => k ?? '')
    );

    const allyKeys = $derived(allyComp.filter((k) => k !== ''));
    const enemyKeys = $derived(enemyComp.filter((k) => k !== ''));

    // ---- strategic reads ----
    const allyPlan = $derived(allyKeys.length > 0 ? classifyGamePlan(allyKeys, tagsFile) : null);
    const enemyPlan = $derived(enemyKeys.length > 0 ? classifyGamePlan(enemyKeys, tagsFile) : null);

    const riskMarkers = $derived.by(() => {
        if (allyKeys.length === 0) return [];
        return detectRiskMarkers(allyComp, enemyComp, {
            ...(allyPlan !== null ? { allyGamePlan: allyPlan } : {}),
            ...(enemyPlan !== null ? { enemyGamePlan: enemyPlan } : {}),
            ...(datasets !== null ? { dataset: datasets.fullDataset } : {}),
            tagsFile
        });
    });

    const adversaryRead = $derived(
        enemyKeys.length > 0 ? detectAdversaryPlan(enemyKeys, { tagsFile }) : null
    );

    /** I3 bilateral read — role-ordered comps ('' holes keep lane indices). */
    const winConditionReport = $derived.by(() => {
        if (allyKeys.length === 0 || enemyKeys.length === 0) return null;
        return analyzeWinConditions(allyComp, enemyComp, {
            tagsFile,
            ...(datasets !== null ? { dataset: datasets.fullDataset } : {})
        });
    });

    const taggedCount = $derived(Object.keys(tagsFile.champions).length);

    function setPick(team: 'ally' | 'enemy', role: Role, championKey: string | null): void {
        if (team === 'ally') allyPicks[role] = championKey;
        else enemyPicks[role] = championKey;
    }

    function setBan(team: 'ally' | 'enemy', banIndex: number, championKey: string | null): void {
        if (team === 'ally') allyBans[banIndex] = championKey;
        else enemyBans[banIndex] = championKey;
    }
</script>

<svelte:head>
    <title>DraftLab — Stratégie</title>
</svelte:head>

<div class="space-y-3">
    <!-- Header + mode toggle -->
    <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
                <h1 class="text-sm font-bold text-slate-100">Lecture stratégique</h1>
                <p class="text-xs text-slate-500">
                    Game Plan (M4.2) · Power Curves (M4.3) · Risques (M4.4) · Lecture adverse (M5.1)
                </p>
            </div>
            <div class="flex overflow-hidden rounded-md border border-slate-700">
                <button
                    type="button"
                    onclick={() => (mode = 'sample')}
                    class="px-3 py-1 text-xs font-semibold {mode === 'sample'
                        ? 'bg-slate-700 text-slate-100'
                        : 'text-slate-500 hover:text-slate-300'}"
                >
                    Drafts d'exemple
                </button>
                <button
                    type="button"
                    onclick={() => (mode = 'manual')}
                    class="px-3 py-1 text-xs font-semibold {mode === 'manual'
                        ? 'bg-slate-700 text-slate-100'
                        : 'text-slate-500 hover:text-slate-300'}"
                >
                    Saisie manuelle
                </button>
            </div>
        </div>

        {#if mode === 'sample'}
            <div class="pt-3">
                <label class="block">
                    <span class="block pb-1 text-xs text-slate-500">Draft d'exemple</span>
                    <select
                        value={sampleId}
                        onchange={(e) => (sampleId = e.currentTarget.value)}
                        class="w-full max-w-md rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                    >
                        {#each SAMPLES as s (s.id)}
                            <option value={s.id}>{s.label}</option>
                        {/each}
                    </select>
                </label>
                {#if sample !== null}
                    <p class="pt-2 text-xs text-slate-400">{sample.context}</p>
                    <p class="pt-1 text-[10px] text-slate-600">
                        Drafts illustratives (patterns pro plausibles 2025-2026), pas des références historiques
                        exactes.
                    </p>
                {/if}
            </div>
        {/if}
    </section>

    <!-- Compositions -->
    {#if mode === 'sample' && sample !== null}
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            {#each [{ team: sample.ally, title: 'Allié', accent: 'text-blue-400', ring: 'blue' }, { team: sample.enemy, title: 'Adverse', accent: 'text-red-400', ring: 'red' }] as col (col.title)}
                <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p class="pb-2 text-[11px] font-semibold tracking-widest uppercase {col.accent}">
                        {col.title} ({col.team.side === 'blue' ? 'bleu' : 'rouge'}) — {col.team.label}
                    </p>
                    <div class="space-y-1">
                        {#each col.team.champions as key, i (key)}
                            <div class="flex items-center gap-2">
                                <span class="w-9 text-[11px] font-bold text-slate-500">{ROLE_LABELS[i]}</span>
                                <ChampionIcon championKey={key} size={28} ring={col.ring === 'blue' ? 'blue' : 'red'} />
                                <span class="text-sm text-slate-200">
                                    {tagsFile.champions[key]?.name ?? key}
                                </span>
                            </div>
                        {/each}
                    </div>
                </section>
            {/each}
        </div>
    {:else if mode === 'manual'}
        <ManualDraftPicker
            {allySide}
            {allyPicks}
            {enemyPicks}
            {allyBans}
            {enemyBans}
            onAllySideChange={(side) => (allySide = side)}
            onPickChange={setPick}
            onBanChange={setBan}
        />
    {/if}

    <!-- Game plans -->
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <GamePlanCard title="Plan de jeu allié" plan={allyPlan} accent="blue" />
        <GamePlanCard title="Plan de jeu adverse" plan={enemyPlan} accent="red" />
    </div>
    <p class="px-1 text-[10px] text-slate-600">
        Source : tags champions DraftLab — {taggedCount} champions tagués (M4.1).
    </p>

    <!-- Win conditions (I3 bilateral graph) -->
    {#if winConditionReport !== null}
        <WinConditionPanel report={winConditionReport} />
        <p class="px-1 text-[10px] text-slate-600">
            8 axes de conflit bilatéraux (tags M4.1{datasets !== null
                ? ' + courbe de puissance observée sur comps complètes'
                : ''}) — score positif = avantage allié.
        </p>
    {:else}
        <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
            Conditions de victoire : il faut au moins un champion de chaque côté.
        </div>
    {/if}

    <!-- Power curves + risks -->
    <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <div class="space-y-1">
            {#if datasetLoading}
                <div class="animate-pulse rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p class="pb-3 text-xs text-slate-500">
                        Power curves — téléchargement du dataset (~50 Mo au premier lancement)…
                    </p>
                    <div class="h-44 rounded-md bg-slate-800/60"></div>
                </div>
            {:else if datasetError !== null}
                <div class="rounded-lg border border-red-900/60 bg-red-950/30 p-3">
                    <p class="pb-1 text-sm font-semibold text-red-300">Power curves indisponibles.</p>
                    <p class="pb-2 text-xs text-red-200/70">{datasetError}</p>
                    <button
                        type="button"
                        onclick={() => void loadDatasets()}
                        class="rounded-md bg-red-500/15 px-3 py-1 text-xs font-medium text-red-300 hover:bg-red-500/25"
                    >
                        Réessayer
                    </button>
                </div>
            {:else if datasets !== null}
                <PowerCurveVisualizer {allyComp} {enemyComp} dataset={datasets.fullDataset} />
                <p class="px-1 text-[10px] text-slate-600">
                    Source : DraftGap (SoloQ) — 30 j v{datasets.fullDataset.version}
                </p>
            {/if}
        </div>

        <RiskMarkerList
            markers={riskMarkers}
            title="Risques de la composition alliée"
            emptyLabel={allyKeys.length === 0
                ? 'Sélectionnez des champions alliés pour lancer la détection.'
                : 'Aucun risque détecté.'}
        />
    </div>

    <!-- Adversary plan read -->
    <div class="space-y-1">
        <AdversaryPlanEvolution read={adversaryRead} />
        {#if mode === 'manual' && enemyKeys.length > 0}
            <p class="px-1 text-[10px] text-slate-600">
                Saisie par rôle : l'ordre des picks adverses est indicatif (Top → Support).
            </p>
        {/if}
    </div>
</div>
