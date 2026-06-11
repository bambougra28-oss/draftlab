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
 *
 * Chantier « génération automatique de la prépa » : le bouton « Générer la
 * prépa contre X » charge la paire de datasets (même cache IndexedDB que la
 * page draft, au premier clic), construit l'évaluateur M1 en config plain
 * (copie exacte de la page draft) et fait jouer le coach en self-play
 * (generatePrepPlan) pour REMPLIR le plan éditable — bans, primaires,
 * fallbacks, raisons FR — que l'humain cure ensuite (le moteur propose, le
 * joueur dispose). L'arbre est recompilé dans la foulée avec un ourReply =
 * navigate (l'évaluateur étant désormais chargé) : le drill devient riche
 * immédiatement. Sans évaluateur, la compile garde son repli historique
 * () => null → mapping statique du plan (qui fonctionne dès que le plan a
 * des primaires).
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
    import { fetchTeam, fetchTeamList } from '$lib/pro/golgg';
    import type { ProTeam } from '$lib/pro/types';
    import { buildOpponentIntel } from '$lib/intel/opponentIntel';
    import { loadCorpusRecords } from '$lib/intel/corpusStore';
    import { canonicalTeamName } from '$lib/data/normalize';
    import { predict, slotGroupOf } from '$lib/aggregates/tendency';
    import { banRotationOf, rotationOf } from '$lib/aggregates/rotations';
    import { comparePatches } from '$lib/backtest/walkforward';
    import { compilePlanTree, massByEnemyDepth, type CompileContext } from '$lib/strategic/planTree';
    import { fetchDatasetPair } from '$lib/dataset/fetch';
    import {
        makeAnalyzeDraftEvaluator,
        navigate,
        type DraftEvaluator,
        type DraftState,
        type NavigatorCandidate
    } from '$lib/strategic/draftNavigator';
    import { rankOurCandidates } from '$lib/intel/liveDraft';
    import { computePresence } from '$lib/aggregates/presence';
    import { fitRolePriors, rolePriorsOf } from '$lib/aggregates/rolePriors';
    import type { RolePriors } from '$lib/strategic/fogReveal';
    import { generatePrepPlan } from '$lib/strategic/planGenerator';
    import type { DraftSide } from '$lib/data/types';
    import { deletePlanTree, getPlanTree, savePlanTree, type StoredPlanTree } from '$lib/storage/planTrees';
    import PlanDrillPanel from '$lib/components/PlanDrillPanel.svelte';

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
        await deletePlanTree(plan.id); // supprimer un plan supprime son arbre (§2.4)
        await deleteDraftPlan(plan.id);
        await goto(resolve('/plans'));
    }

    // ---- Arbre de prep (chantier D) : compile contre un adversaire synchronisé ----
    let tree = $state<StoredPlanTree | null>(null);
    let opponentLeague = $state('lfl');
    let opponentList = $state<{ id: string; name: string }[]>([]);
    let opponentId = $state<string | null>(null);
    let opponent = $state<ProTeam | null>(null);
    let syncingOpponent = $state(false);
    let compiling = $state(false);

    $effect(() => {
        const id = planId;
        if (id !== '')
            void getPlanTree(id).then((t) => {
                if (planId === id) tree = t ?? null;
            });
    });

    async function loadOpponents(): Promise<void> {
        const { teams } = await fetchTeamList({});
        opponentList = teams
            .map((t) => ({ id: t.id, name: t.name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }

    async function syncOpponent(): Promise<void> {
        if (opponentId === null) return;
        syncingOpponent = true;
        try {
            opponent = await fetchTeam(opponentId, { league: opponentLeague });
        } finally {
            syncingOpponent = false;
        }
    }

    /** Modèle adverse partagé par la compile ET la génération (un seul build par action). */
    interface OpponentModel {
        enemyDistribution: CompileContext['enemyDistribution'];
        evidenceOf: NonNullable<CompileContext['evidenceOf']>;
        table: ReturnType<typeof buildOpponentIntel>['table'];
        /** Priors de rôle + repli de candidats — corpus de la ligue chargée. */
        rolePriors: RolePriors;
        fallbackCandidates: string[];
        intelRecords: number;
        latestPatch?: string;
    }

    /** Intel + seams depuis le corpus de la ligue de l'adversaire (mêmes predict/K que la gate). */
    async function buildOpponentModel(): Promise<OpponentModel | null> {
        if (opponent === null) return null;
        const leagueRecords = (await loadCorpusRecords(opponentLeague)) ?? [];
        const canonical = canonicalTeamName(opponent.name);
        const corpusTeamRecords = leagueRecords.filter(
            (r) => canonicalTeamName(r.blueTeam) === canonical || canonicalTeamName(r.redTeam) === canonical
        );
        const intel = buildOpponentIntel(opponent, {
            now: new Date(Date.now()).toISOString(),
            ...(leagueRecords.length > 0 ? { leagueRecords } : {}),
            ...(corpusTeamRecords.length > 0 ? { corpusTeamRecords } : {})
        });
        const table = intel.table;
        const enemyDistribution: CompileContext['enemyDistribution'] = (state, slot) => {
            const slotGroup = slot.type === 'pick' ? rotationOf(slot.seq) : banRotationOf(slot.seq);
            if (slotGroup === undefined) return [];
            const exclude = new Set(state.actions.map((a) => a.championKey).filter((k) => k !== ''));
            return predict(table, { slotGroup, side: slot.side, exclude }).map((p) => ({
                championKey: p.championKey,
                p: p.p
            }));
        };
        const evidenceOf: NonNullable<CompileContext['evidenceOf']> = (championKey, slot) => {
            const slotGroup = slot.type === 'pick' ? rotationOf(slot.seq) : banRotationOf(slot.seq);
            const entry =
                slotGroup === undefined
                    ? undefined
                    : predict(table, { slotGroup, side: slot.side }).find((p) => p.championKey === championKey);
            const exampleGameIds = intel.records
                .filter((r) =>
                    r.actions.some(
                        (a) =>
                            a.championKey === championKey && a.side === slot.side && slotGroupOf(a) === slotGroup
                    )
                )
                .slice(0, 3)
                .map((r) => r.gameId);
            return {
                rawCount: entry?.rawCount ?? 0,
                total: entry?.total ?? 0,
                ...(exampleGameIds.length > 0 ? { exampleGameIds } : {})
            };
        };
        let latestPatch: string | undefined;
        for (const r of intel.records) {
            if (r.patch !== undefined && (latestPatch === undefined || comparePatches(r.patch, latestPatch) > 0))
                latestPatch = r.patch;
        }
        // Priors de rôle : cette page n'a AUCUNE notion de « notre équipe/ligue »
        // (l'éditeur de plan est adversaire-centré) — « notre ligue » n'est donc
        // jamais disponible ici ; on prend les priors de la ligue de
        // l'ADVERSAIRE (le seul corpus chargé), choix documenté.
        const rolePriors = rolePriorsOf(fitRolePriors(leagueRecords));
        // Repli de candidats = présence de la ligue chargée (copie de la page draft).
        const fallbackCandidates = [...computePresence(leagueRecords).entries()]
            .sort((a, b) => b[1].presence - a[1].presence || (a[0] < b[0] ? -1 : 1))
            .slice(0, 15)
            .map(([key]) => key);
        return {
            enemyDistribution,
            evidenceOf,
            table,
            rolePriors,
            fallbackCandidates,
            intelRecords: intel.records.length,
            ...(latestPatch !== undefined ? { latestPatch } : {})
        };
    }

    /**
     * Self-play du coach sur UN état : candidats classés par navigate (depth 2,
     * topK 5, rankOurCandidates avec repli présence + contrainte de rôle via
     * rolePriors et plancher par défaut) — la même chaîne que la page draft.
     */
    function makeSelfPlay(
        model: OpponentModel,
        evaluate: DraftEvaluator,
        ourSide: DraftSide
    ): (state: DraftState) => NavigatorCandidate[] {
        return (state) =>
            navigate(state, {
                ourSide,
                ourCandidates: (s) =>
                    rankOurCandidates(
                        {
                            ourSide,
                            evaluate,
                            table: model.table,
                            fallbackCandidates: model.fallbackCandidates,
                            rolePriors: model.rolePriors
                        },
                        s,
                        6
                    ),
                enemyDistribution: model.enemyDistribution,
                evaluate,
                depth: 2,
                topK: 5
            }).candidates;
    }

    async function compileAgainstOpponent(prebuilt?: OpponentModel): Promise<void> {
        if (plan === null || opponent === null) return;
        compiling = true;
        try {
            const model = prebuilt ?? (await buildOpponentModel());
            if (model === null) return;
            const ourSide = plan.side ?? 'blue';
            const evaluate = evaluator;
            // ourReply : navigate dès que l'évaluateur M1 est chargé (après une
            // génération) ; sinon, repli historique () => null → mapping
            // statique du plan dans compilePlanTree (riche dès que le plan a
            // des primaires — générés ou saisis).
            const selfPlay = evaluate === null ? null : makeSelfPlay(model, evaluate, ourSide);
            const ourReply: CompileContext['ourReply'] =
                selfPlay === null
                    ? () => null
                    : (state, slot) => {
                          const best = selfPlay(state)[0];
                          if (best === undefined) return null;
                          return {
                              seq: slot.seq,
                              type: slot.type,
                              championKey: best.championKey,
                              reasonsFr: ['Réponse du coach (expectimax profondeur 2) figée à la compilation.']
                          };
                      };
            const compiled = compilePlanTree({
                ourSide,
                plan: $state.snapshot(plan) as DraftPlan,
                enemyDistribution: model.enemyDistribution,
                evidenceOf: model.evidenceOf,
                ourReply,
                now: Date.now(),
                opponent: opponent.name,
                modelProvenance: {
                    records: model.intelRecords,
                    ...(model.latestPatch !== undefined ? { latestPatch: model.latestPatch } : {}),
                    league: opponentLeague
                }
            });
            tree = await savePlanTree(compiled);
        } finally {
            compiling = false;
        }
    }

    // ---- Génération automatique de la prépa (self-play du coach) ----
    /** Évaluateur M1 — chargé au PREMIER clic Générer (datasets ~50 Mo, cache IndexedDB). */
    let evaluator = $state<DraftEvaluator | null>(null);
    let generating = $state(false);
    /** Étape courante du spinner FR (datasets / modèle / self-play / recompile). */
    let generationStep = $state<string | null>(null);
    let generateError = $state<string | null>(null);
    /** Trous laissés par la dernière génération (null = pas encore généré). */
    let lastHoles = $state<number | null>(null);

    /** Le plan porte-t-il déjà du contenu (confirm avant écrasement) ? */
    function planHasContent(p: DraftPlan): boolean {
        return (
            p.bans.some((b) => b.championKey !== null) ||
            p.picks.some((row) => row.primary !== null || row.fallback !== null)
        );
    }

    async function generatePrep(): Promise<void> {
        const currentPlan = plan;
        const currentOpponent = opponent;
        if (currentPlan === null || currentOpponent === null || generating) return;
        if (
            planHasContent(currentPlan) &&
            !confirm(
                `Le plan « ${currentPlan.name} » contient déjà des picks/bans : écraser par la prépa générée contre ${currentOpponent.name} ?`
            )
        )
            return;
        generating = true;
        generateError = null;
        lastHoles = null;
        try {
            let evaluate = evaluator;
            if (evaluate === null) {
                generationStep = 'Chargement des datasets (≈50 Mo au premier chargement, puis cache local)…';
                const pair = await fetchDatasetPair();
                // Config « plain » — copie exacte du coachEvaluate de la page draft.
                evaluate = makeAnalyzeDraftEvaluator(
                    { dataset: pair.dataset, fullDataset: pair.fullDataset },
                    { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 }
                );
                evaluator = evaluate;
            }
            generationStep = `Modèle ${currentOpponent.name} (corpus ${opponentLeague.toUpperCase()})…`;
            const model = await buildOpponentModel();
            if (model === null) return;
            generationStep = 'Self-play du coach (20 tours, profondeur 2)…';
            await new Promise((resolve) => setTimeout(resolve)); // laisser le spinner se peindre
            const ourSide = currentPlan.side ?? 'blue';
            const selfPlay = makeSelfPlay(model, evaluate, ourSide);
            const prep = generatePrepPlan({
                ourSide,
                // navigate trie par valeur desc : 1ᵉʳ = primaire, 2ᵉ = fallback.
                ourReply: (state) => selfPlay(state).map((c) => ({ championKey: c.championKey })),
                enemyDistribution: model.enemyDistribution,
                rolePriors: model.rolePriors,
                nameOf: (key) => championNameByKey(key) ?? key
            });
            // Remplit le plan ÉDITABLE puis persiste — l'utilisateur retouche
            // ensuite tout ce qu'il veut (le moteur propose, le joueur dispose).
            prep.bans.forEach((ban, index) => {
                currentPlan.bans[index] = {
                    championKey: ban.championKey,
                    ...(ban.rationaleFr !== null ? { rationale: ban.rationaleFr } : {})
                };
            });
            for (const row of prep.picks) {
                const target = currentPlan.picks.find((p) => p.role === row.role);
                if (target === undefined) continue;
                target.primary = row.primary;
                target.fallback = row.fallback;
                target.rationale = row.rationaleFr ?? '';
            }
            lastHoles = prep.holes;
            await persist();
            // Recompile dans la foulée : l'évaluateur est désormais chargé,
            // l'arbre porte des réponses navigate — le drill devient riche.
            generationStep = "Recompilation de l'arbre…";
            await compileAgainstOpponent(model);
        } catch (error) {
            generateError = error instanceof Error ? error.message : String(error);
        } finally {
            generating = false;
            generationStep = null;
        }
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

        <!-- Arbre de prep (chantier D) : compile contre un adversaire synchronisé -->
        <section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <h2 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
                Arbre de prep (script à branches)
            </h2>
            <div class="flex flex-wrap items-end gap-2">
                <button
                    type="button"
                    onclick={() => void loadOpponents()}
                    class="rounded-md bg-slate-800 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                    >Charger les équipes</button
                >
                <select
                    bind:value={opponentId}
                    class="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
                >
                    <option value={null}>Adversaire…</option>
                    {#each opponentList as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
                </select>
                <button
                    type="button"
                    onclick={() => void syncOpponent()}
                    disabled={opponentId === null || syncingOpponent}
                    class="rounded-md bg-slate-800 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                >
                    {syncingOpponent ? 'Sync…' : 'Synchroniser'}
                </button>
                <button
                    type="button"
                    onclick={() => void compileAgainstOpponent()}
                    disabled={opponent === null || compiling || generating}
                    class="rounded-md bg-gold-500/15 px-3 py-1.5 text-xs font-semibold text-gold-300 ring-1 ring-gold-600/50 hover:bg-gold-500/25 disabled:opacity-50"
                >
                    {compiling ? 'Compilation…' : opponent === null ? 'Compiler (synchronisez un adversaire)' : `Compiler contre ${opponent.name}`}
                </button>
                <button
                    type="button"
                    onclick={() => void generatePrep()}
                    disabled={opponent === null || generating || compiling}
                    class="rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-600/50 hover:bg-emerald-500/25 disabled:opacity-50"
                >
                    {#if generating}
                        <span class="inline-block animate-pulse">{generationStep ?? 'Génération de la prépa…'}</span>
                    {:else if opponent === null}
                        Générer la prépa (synchronisez un adversaire)
                    {:else}
                        Générer la prépa contre {opponent.name}
                    {/if}
                </button>
            </div>
            <!-- Cadrage honnête : la génération est une proposition, jamais une vérité. -->
            <p class="pt-2 text-[11px] text-slate-600">
                Prépa générée par self-play du coach (explorateur de lignes — gate A rouge : proposition
                data-driven, pas une vérité) ; à curer à la main. Le plan ci-dessus reste entièrement éditable
                après génération.
            </p>
            {#if generateError !== null}
                <p class="pt-1 text-[11px] text-red-400">Échec de la génération : {generateError}</p>
            {/if}
            {#if lastHoles !== null && !generating}
                <p class="pt-1 text-[11px] text-emerald-300/90">
                    Prépa générée et enregistrée dans le plan ci-dessus — retouchez librement (un nouveau «
                    Compiler » mettra l'arbre à jour).
                    {#if lastHoles > 0}
                        {lastHoles} tour{lastHoles > 1 ? 's' : ''} sans proposition du modèle : trou{lastHoles > 1
                            ? 's'
                            : ''} laissé{lastHoles > 1 ? 's' : ''} vide{lastHoles > 1 ? 's' : ''} (jamais inventé).
                    {/if}
                </p>
            {/if}
            {#if opponent === null}
                <p class="pt-2 text-[11px] text-slate-600">
                    Sans adversaire synchronisé (et idéalement un corpus de sa ligue), pas de branches : l'arbre EST
                    le modèle de tendances de cette équipe.
                </p>
            {/if}
            {#if tree !== null}
                <div class="pt-2 text-xs text-slate-400">
                    <p>
                        {tree.nodeCount} nœuds · compilé le {new Date(tree.builtAt).toLocaleString('fr-FR')} · modèle :
                        {tree.modelProvenance.records} games {tree.opponent}{tree.modelProvenance.latestPatch !== undefined
                            ? `, patch ≤ ${tree.modelProvenance.latestPatch}`
                            : ''}
                    </p>
                    <p class="pt-1">
                        Masse couverte par CET arbre, par profondeur adverse (Σ pathMass — propriété du compile,
                        jamais une « tenue moyenne ») :
                        {#each massByEnemyDepth(tree.root) as m, d (d)}<span
                                class="ml-1 rounded bg-slate-800/70 px-1.5 py-0.5 font-mono text-[10px]"
                                >a{d + 1} : {Math.round(m * 100)} %</span
                            >{/each}
                    </p>
                    <p class="pt-1 text-[10px] text-slate-600 italic">
                        Caveat : couverture mesurée sous entrelacement supposé blue-first (ordre intra-équipe exact,
                        alternance conventionnelle).
                    </p>
                </div>
            {/if}
        </section>

        <!-- Entraînement de prépa : drill de répertoire sur l'arbre compilé.
             {#key builtAt} : recompiler réinitialise la session en cours. -->
        {#if tree !== null}
            {#key tree.builtAt}
                <PlanDrillPanel tree={tree} planName={plan.name} />
            {/key}
        {/if}

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
