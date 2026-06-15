<!--
/**
 * Route / — Team scout + Bayesian draft analyzer + Pool Tier (M1/M2 assembly).
 *
 * Wiring per M2_PING3: `contextActive` / per-side leagues / team state live
 * here; `playerContext` and `sideContext` are $derived and COLLAPSE to
 * undefined when the master toggle is off, so the engine call falls back to
 * the pure M1 path. `fetchTeam` runs on Sync, `fetchTeamList` lazily from the
 * panel buttons, the dataset pair loads on mount (first load is ~50 MB).
 *
 * Matchs inter-régions (directive 2026-06-11) : UNE LIGUE PAR CAMP.
 * `leagueIdA` pilote tout ce qui décrit NOTRE équipe (corpusTeamA,
 * publicModelA, coachFallback, priors de flex) ; `leagueIdB` tout ce qui
 * décrit L'ADVERSAIRE (corpusTeamB, intel, enemyRoleReads, publicModelB,
 * provenance des arbres). leagueIdB === leagueIdA au premier rendu ⇒
 * comportement identique à avant (un seul corpus chargé, référence partagée).
 *
 * Comfort tags: stored overrides (localStorage via $lib/comfort) take priority
 * over the pool-size defaults computed by buildPlayerContext; the subscription
 * keeps every panel in sync. Loading a recent draft from team A fills the ally
 * slots and flips `allySide` to the recorded side; team B fills the enemy
 * slots (ally side becomes the opposite).
 *
 * Provenance badges (DA-V2-4): dataset version/patch under the winrate bar,
 * gol.gg + season on the scouting panels, sample sizes in the score breakdown.
 *
 * C1 additions: the win-condition graph reads the current draft as soon as
 * each side has one champion; syncing team B feeds `buildOpponentIntel` (the
 * single routes→engines glue) whose tendency table, ranges and ban pages
 * render below the analyzer; the ExportBar downloads the prep pack (plans
 * from IndexedDB + intel + win conditions) and the CSV artefacts. The intel
 * clock is `nowTick` (injected, refreshed at sync) — never read inside the
 * derived computations.
 */
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { base } from '$app/paths';
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
    import { calibrateAllyWin, defaultWinCalibrationConfig } from '$lib/estimators/winCalibration';
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
    import WinConditionPanel from '$lib/components/WinConditionPanel.svelte';
    import TendencyPanel, { tendencyBlocksOf } from '$lib/components/TendencyPanel.svelte';
    import RangePanel from '$lib/components/RangePanel.svelte';
    import ExportBar, { type ExportAction } from '$lib/components/ExportBar.svelte';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';
    import { analyzeWinConditions } from '$lib/strategic/winConditionGraph';
    import { buildOpponentIntel } from '$lib/intel/opponentIntel';
    import {
        corpusStatus,
        importBundledCorpora,
        importOracleElixirCorpus,
        loadAllCorpusRecords,
        loadCorpusRecords,
        OE_SOURCE,
        type CorpusLeagueStatus
    } from '$lib/intel/corpusStore';
    import { fitTagCounterCells, fitTagPairCells, type TagPairFit } from '$lib/estimators/tagPairs';
    import { fitRolePriors, layerRolePriors, rolePriorsOf, type RolePriorsFit } from '$lib/aggregates/rolePriors';
    import type { RolePriors } from '$lib/strategic/fogReveal';
    import {
        draftStateFromActions,
        draftStateFromRoleEntry,
        rankOurCandidates,
        readEnemyRoles,
        recommendNext,
        type EnemyRoleReport,
        type RoleEntryDraft
    } from '$lib/intel/liveDraft';
    import {
        detectLiveSurpriseTriggers,
        uniformizeTriggeredPriors,
        type LiveSurpriseTrigger
    } from '$lib/intel/surpriseDefense';
    import {
        assignRole,
        bannedKeys,
        emptySequence,
        lastFilledSeq,
        nextOpenSeq,
        removeLast,
        replaceAt,
        roleEntryView,
        slotOf,
        toDraftActions,
        usedKeys,
        type DraftFormat
    } from '$lib/draft/sequence';
    import DraftSequenceBoard, { boardSlotsFor } from '$lib/components/DraftSequenceBoard.svelte';
    import {
        consumedChampions,
        createSeries,
        saveSeries,
        upsertGame,
        type Series,
        type SeriesFormat
    } from '$lib/storage/series';
    import { makeAnalyzeDraftEvaluator, navigate, nextSlotOf } from '$lib/strategic/draftNavigator';
    import { computePresence } from '$lib/aggregates/presence';
    import { canonicalTeamName } from '$lib/data/normalize';
    import type { DraftRecord, DraftSide } from '$lib/data/types';
    import CoachPanel from '$lib/components/CoachPanel.svelte';
    import { classifyPoolTier } from '$lib/strategic/poolTierClassifier';
    import { championNameByKey } from '$lib/dataDragon/version';
    import {
        exportPoolGridCsv,
        exportTendenciesCsv,
        renderPrepPackMarkdown,
        type PoolGridPlayer
    } from '$lib/exports/prepPack';
    import { listDraftPlans, type DraftPlan } from '$lib/storage/draftPlans';
    import PlanTreePanel from '$lib/components/PlanTreePanel.svelte';
    import PocketPanel, {
        type EnemyPlayerPocketRow,
        type PlayerPocketRow
    } from '$lib/components/PocketPanel.svelte';
    import { fitPublicSelfModel, type PublicSelfModel } from '$lib/estimators/publicSelfModel';
    import {
        anticipateEnemyPockets,
        currentLineup,
        fitPlayerHistory,
        playerReservoir,
        publicMassOf,
        type PlayerHistoryFit
    } from '$lib/estimators/playerPockets';
    import { advisePocketPicks, type PocketCandidate } from '$lib/strategic/pocketAdvisor';
    import { loadDefaultTags } from '$lib/tags';
    import type { BanEvEntry } from '$lib/strategic/banEv';
    import { compilePlanTree, type CompileContext, type PlanTree } from '$lib/strategic/planTree';
    import { trackPlan } from '$lib/strategic/planTracker';
    import { getPlanTree } from '$lib/storage/planTrees';
    import { predict, slotGroupOf, type TendencyTable } from '$lib/aggregates/tendency';
    import { banRotationOf, rotationOf } from '$lib/aggregates/rotations';
    import { comparePatches } from '$lib/backtest/walkforward';

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
    let allyBans = $state<(string | null)[]>(emptyFive());
    let enemyBans = $state<(string | null)[]>(emptyFive());
    let allySide = $state<'blue' | 'red'>('blue');
    let pickerSlot = $state<{ team: 'ally' | 'enemy'; role: Role } | { seq: number } | null>(null);

    // ---- sequence entry mode (exact formats + flex picks) ----
    let entryMode = $state<'roles' | 'sequence'>('roles');
    let draftSeq = $state(emptySequence());
    /** Alain's two real formats: tournament 2026 or SoloQ ranked draft. */
    let draftFormat = $state<DraftFormat>('pro');
    /**
     * First Selection (règle 2026) : camp qui picke en premier, DÉCOUPLÉ du
     * side. Les entrées de `draftSeq` sont stockées par seq template et le
     * side est DÉRIVÉ — changer ce sélecteur en cours de saisie remappe
     * l'affichage et toutes les projections (actions, vue par rôle, coach)
     * sans perdre ni déplacer ce qui est saisi. Pro uniquement ; SoloQ ignore.
     */
    let firstPickSide = $state<DraftSide>('blue');
    /** Simulation deux camps (chantier 2) : le coach joue les deux chaises. */
    let simulationMode = $state(false);

    // ---- series context (Bo1/Bo3/Bo5, ± Fearless — shared store with /series) ----
    let seriesFormatChoice = $state<SeriesFormat>('bo3');
    let fearlessChoice = $state(true);
    let activeSeries = $state<Series | null>(null);
    const SERIES_MAX_GAMES: Record<SeriesFormat, number> = { bo1: 1, bo3: 3, bo5: 5 };
    const currentGameNumber = $derived(activeSeries === null ? 1 : activeSeries.games.length + 1);
    const seriesOver = $derived(
        activeSeries !== null && activeSeries.games.length >= SERIES_MAX_GAMES[activeSeries.format]
    );
    /** Hard Fearless 2026: champions PICKED by either side are gone for both. */
    const fearlessLocked = $derived(
        activeSeries !== null && activeSeries.mode === 'fearless' ? consumedChampions(activeSeries).all : []
    );

    function startSeries(): void {
        const series = createSeries({
            name: `${teamA?.name ?? 'Nous'} vs ${teamB?.name ?? 'Eux'} — ${new Date().toLocaleDateString('fr-FR')}`,
            format: seriesFormatChoice,
            mode: fearlessChoice && seriesFormatChoice !== 'bo1' ? 'fearless' : 'standard',
            allyTeam: teamA?.name ?? 'Nous',
            enemyTeam: teamB?.name ?? 'Eux'
        });
        activeSeries = series;
        void saveSeries(series);
    }

    /** Close the current game with its result, lock its picks, reset the board. */
    function closeGame(result: 'ally' | 'enemy'): void {
        if (activeSeries === null || seriesOver) return;
        const view = roleEntryView(draftSeq, allySide, seqRoleResolver, draftFormat, firstPickSide);
        const compact = (keys: (string | null)[]): string[] => keys.filter((k): k is string => k !== null);
        const updated = upsertGame(activeSeries, {
            gameNumber: currentGameNumber,
            allySide,
            allyPicks: compact(view.allyPicks),
            enemyPicks: compact(view.enemyPicks),
            allyBans: compact(view.allyBans),
            enemyBans: compact(view.enemyBans),
            result
        });
        activeSeries = updated;
        void saveSeries(updated);
        draftSeq = emptySequence();
        pickerSlot = null;
    }

    function endSeries(): void {
        activeSeries = null;
    }

    /**
     * League role priors — flex resolver + board hints (cached on records).
     * Routage inter-régions : ligue de l'équipe A. Le résolveur sert la saisie
     * séquence des DEUX camps mais son API (championKey + rôles libres) ne
     * porte pas le side — choix documenté : NOTRE ligue (A), les priors de
     * rôle adverses dédiés vivent dans enemyRoleReads (ligue B).
     */
    const leaguePriorsFn = $derived.by(() => {
        if (leagueRecordsA === null) return null;
        return rolePriorsOf(fitRolePriors(leagueRecordsA));
    });

    /** Priors de rôle de la ligue B — pour le filtre de couverture quand le coach conseille le camp B. */
    const leaguePriorsFnB = $derived.by(() => {
        if (leagueRecordsB === null) return null;
        return rolePriorsOf(fitRolePriors(leagueRecordsB));
    });

    const seqRoleResolver = $derived.by(() => {
        const priors = leaguePriorsFn;
        if (priors === null) return undefined;
        return (championKey: string, free: Role[]): Role => {
            let best = free[0];
            let bestWeight = -1;
            for (const role of free) {
                const weight = priors(championKey)[role] ?? 0;
                if (weight > bestWeight) {
                    bestWeight = weight;
                    best = role;
                }
            }
            return best;
        };
    });

    const boardRoleHint = $derived.by(() => {
        const priors = leaguePriorsFn;
        if (priors === null) return undefined;
        return (championKey: string): { role: Role; p: number } | null => {
            const weights = priors(championKey);
            let total = 0;
            let best: Role | null = null;
            let bestWeight = 0;
            for (const role of ROLES) {
                const weight = weights[role] ?? 0;
                total += weight;
                if (weight > bestWeight) {
                    bestWeight = weight;
                    best = role;
                }
            }
            return best === null || total === 0 ? null : { role: best, p: bestWeight / total };
        };
    });

    // Sequence mode writes through to the role-keyed state: every consumer
    // (analyzer, win conditions, intel, exports) keeps reading ONE shape.
    // firstPickSide is a dependency: flipping the First Selection re-runs
    // this projection and remaps ally/enemy columns from the same entries.
    $effect(() => {
        if (entryMode !== 'sequence') return;
        const view = roleEntryView(draftSeq, allySide, seqRoleResolver, draftFormat, firstPickSide);
        allyPicks = [...view.allyPicks];
        enemyPicks = [...view.enemyPicks];
        allyBans = [...view.allyBans];
        enemyBans = [...view.enemyBans];
    });

    // ---- team context state (M2_PING3 + inter-régions 2026-06-11) ----
    let contextActive = $state(false);
    /** Ligue de l'équipe A (nous) — l'ancien `leagueId`, même défaut. */
    let leagueIdA = $state('lfl');
    /** Ligue de l'équipe B (eux) — défaut = celle de A ⇒ comportement historique. */
    let leagueIdB = $state('lfl');
    let tournamentSlug = $state<string | null>(null);
    // Listes d'équipes séparées par camp : chacune est fetchée avec la région de SA ligue.
    let teamListA = $state<{ id: string; name: string }[]>([]);
    let teamListB = $state<{ id: string; name: string }[]>([]);
    let teamListLoadingA = $state(false);
    let teamListLoadingB = $state(false);
    let teamListWarningsA = $state<string[]>([]);
    let teamListWarningsB = $state<string[]>([]);
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

    // ---- saved plans (prep-pack export input) ----
    let plans = $state<DraftPlan[]>([]);

    onMount(() => {
        void loadDatasets();
        void loadPlans();
    });

    async function loadPlans(): Promise<void> {
        try {
            plans = (await listDraftPlans()).sort((a, b) => b.updatedAt - a.updatedAt);
        } catch {
            plans = []; // plans are optional export sugar — keep the page alive
        }
    }

    // ---- Script de prep (chantier D) : arbre compilé + suivi de déviation ----
    let activePlanId = $state<string | null>(null);
    let activeTree = $state<PlanTree | null>(null);
    /** Arbre recompilé en séance (« Recompiler d'ici ») — JAMAIS persisté. */
    let sessionTree = $state<PlanTree | null>(null);
    /** Seq de reprise du tracker après une recompile en cours de draft. */
    let sessionTreeOffset = $state(0);
    let recompiling = $state(false);

    $effect(() => {
        const id = activePlanId;
        sessionTree = null;
        sessionTreeOffset = 0;
        if (id === null) {
            activeTree = null;
            return;
        }
        void getPlanTree(id).then((stored) => {
            if (activePlanId === id) activeTree = stored ?? null;
        });
    });

    const planTreeShown = $derived(sessionTree ?? activeTree);

    /**
     * trackPlan PUR en $derived de toDraftActions(draftSeq) — rejoué à chaque
     * action. Limite V1 : les arbres sont compilés en convention bleu-premier
     * (compilePlanTree, racine firstPickSide 'blue') — First Selection rouge ⇒
     * null, le template affiche la ligne honnête plutôt qu'un suivi faux.
     */
    const planTrack = $derived.by(() => {
        const tree = planTreeShown;
        if (tree === null || entryMode !== 'sequence' || draftFormat !== 'pro' || firstPickSide !== 'blue')
            return null;
        const actions = toDraftActions(draftSeq, 'pro').filter((a) => a.seq > sessionTreeOffset);
        return trackPlan(tree, actions, allySide);
    });

    /** Seams de compile — mêmes predict/K que la gate (fonctions, jamais d'import du modèle). */
    function compileSeams(): Pick<CompileContext, 'enemyDistribution' | 'evidenceOf' | 'ourReply'> | null {
        const currentIntel = intel;
        const evaluate = coachEvaluate;
        if (currentIntel === null) return null;
        const table = currentIntel.table;
        const enemyDistribution: CompileContext['enemyDistribution'] = (state, slot) => {
            const slotGroup = slot.type === 'pick' ? rotationOf(slot.seq) : banRotationOf(slot.seq);
            if (slotGroup === undefined) return [];
            const exclude = new Set(state.actions.map((a) => a.championKey).filter((k) => k !== ''));
            return predict(table, { slotGroup, side: slot.side, exclude }).map((p) => ({
                championKey: p.championKey,
                p: p.p
            }));
        };
        const evidenceOf: CompileContext['evidenceOf'] = (championKey, slot) => {
            const slotGroup = slot.type === 'pick' ? rotationOf(slot.seq) : banRotationOf(slot.seq);
            const entry =
                slotGroup === undefined
                    ? undefined
                    : predict(table, { slotGroup, side: slot.side }).find((p) => p.championKey === championKey);
            const exampleGameIds = currentIntel.records
                .filter((r) =>
                    r.actions.some(
                        (a) => a.championKey === championKey && a.side === slot.side && slotGroupOf(a) === slotGroup
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
        const ourReply: CompileContext['ourReply'] = (state, slot) => {
            if (evaluate === null) return null; // → mapping statique du plan dans compilePlanTree
            const result = navigate(state, {
                ourSide: allySide,
                ourCandidates: (s) =>
                    rankOurCandidates(
                        {
                            ourSide: allySide,
                            evaluate,
                            table,
                            ...(contextActive && teamA !== null ? { allyPlayers: teamA.players } : {}),
                            fallbackCandidates: coachFallback
                        },
                        s,
                        6
                    ),
                enemyDistribution,
                evaluate,
                depth: 2,
                topK: 5
            });
            const best = result.candidates[0];
            if (best === undefined) return null;
            return {
                seq: slot.seq,
                type: slot.type,
                championKey: best.championKey,
                reasonsFr: ['Réponse du coach (expectimax profondeur 2) figée à la compilation.']
            };
        };
        return { enemyDistribution, evidenceOf, ourReply };
    }

    function intelProvenance(): PlanTree['modelProvenance'] {
        const records = intel?.records ?? [];
        let latestPatch: string | undefined;
        for (const r of records) {
            if (r.patch !== undefined && (latestPatch === undefined || comparePatches(r.patch, latestPatch) > 0))
                latestPatch = r.patch;
        }
        // Provenance du modèle ADVERSE (tendances/ranges de l'équipe B) ⇒ ligue B.
        return { records: records.length, ...(latestPatch !== undefined ? { latestPatch } : {}), league: leagueIdB };
    }

    /** Recompile « d'ici » : budget réduit (< 2 s), horizon = actions adverses restantes. */
    async function recompileFromHere(): Promise<void> {
        const tree = planTreeShown;
        const seams = compileSeams();
        const plan = plans.find((p) => p.id === (tree?.planId ?? activePlanId));
        // Garde V1 : compilePlanTree est ancré bleu-premier (le panneau est
        // masqué quand le First Selection est rouge — ceinture + bretelles).
        if (firstPickSide !== 'blue') return;
        if (tree === null || seams === null || plan === undefined || teamB === null) return;
        recompiling = true;
        try {
            await new Promise((r) => setTimeout(r));
            const actions = toDraftActions(draftSeq, 'pro');
            const enemyLeft = 10 - actions.filter((a) => a.side !== allySide).length;
            const compiled = compilePlanTree({
                ourSide: allySide,
                plan: $state.snapshot(plan) as DraftPlan,
                ...seams,
                excludedKeys: [...fearlessLocked],
                initialActions: actions,
                config: { enemyDepth: Math.max(1, Math.min(6, enemyLeft)), maxNodes: 600 },
                now: Date.now(),
                opponent: teamB.name,
                modelProvenance: intelProvenance()
            });
            sessionTree = compiled;
            sessionTreeOffset = actions.length > 0 ? actions[actions.length - 1].seq : 0;
        } finally {
            recompiling = false;
        }
    }

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

    /** Picks verrouillés des deux sides — l'ancre de calibration (partition positionOf). */
    const picksLocked = $derived(allyTeamMap.size + enemyTeamMap.size);

    /**
     * Calibration du % global (chantier E) : UNIQUEMENT la config mesurée par la
     * règle gelée — aucun playerContext ni sideContext. Contexte actif ⇒ % brut
     * + badge « Non calibré » (configuration hors claim, limitation V1 déclarée).
     */
    const calibratedWin = $derived.by(() => {
        if (result === null || playerContext !== undefined || sideContext !== undefined) return null;
        return calibrateAllyWin(result.winrate, allySide, picksLocked);
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
        if ('seq' in slot) {
            const info = slotOf(slot.seq, draftFormat, firstPickSide);
            const board = boardSlotsFor(draftFormat, firstPickSide).find((s) => s.seq === slot.seq);
            if (info === undefined || board === undefined) return null;
            return {
                slot,
                entries: [] as ChampionPoolEntry[],
                label: 'Tous les champions',
                title: `${info.type === 'ban' ? 'Ban' : 'Pick'} ${board.label} — côté ${info.side === 'blue' ? 'bleu' : 'rouge'}`,
                // Pick séquence : le choix Flex/rôle est offert AU MOMENT du pick.
                roleChoice: info.type === 'pick'
            };
        }
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
        return { slot, entries, label, title, roleChoice: false };
    });

    /**
     * Rôle choisi AU MOMENT du pick (séquence) — défaut FLEX (rôle non
     * engagé, le modèle le supporte depuis toujours) ; pré-rempli avec le
     * rôle committé quand on rouvre un slot déjà posé, pour ne pas le perdre
     * silencieusement en remplaçant le champion.
     */
    let pickerRole = $state<Role | undefined>(undefined);
    $effect(() => {
        const slot = pickerSlot;
        pickerRole = slot !== null && 'seq' in slot ? draftSeq.entries.get(slot.seq)?.role : undefined;
    });

    function assignPick(championKey: string | null): void {
        const slot = pickerSlot;
        if (slot === null) return;
        if ('seq' in slot) {
            // Sequence target: fill/replace in place; « Retirer » only undoes the tail.
            // pickerRole porte le choix Flex/rôle du picker (undefined = flex).
            if (championKey !== null) draftSeq = replaceAt(draftSeq, slot.seq, championKey, pickerRole, draftFormat);
            else if (lastFilledSeq(draftSeq, draftFormat) === slot.seq) draftSeq = removeLast(draftSeq, draftFormat);
            pickerSlot = null;
            return;
        }
        if (slot.team === 'ally') allyPicks[slot.role] = championKey;
        else enemyPicks[slot.role] = championKey;
        pickerSlot = null;
    }

    /** Picker exclusions: board/picks + Fearless lockouts of the active series. */
    const disabledPickerKeys = $derived([
        ...(entryMode === 'sequence' ? usedKeys(draftSeq) : pickedKeys),
        ...fearlessLocked
    ]);

    function clearTeam(team: 'ally' | 'enemy'): void {
        if (team === 'ally') allyPicks = emptyFive();
        else enemyPicks = emptyFive();
        pickerSlot = null;
    }

    // ---- gol.gg wiring ----
    /**
     * Changer la ligue d'UN camp ne touche que ce camp (l'autre reste intact —
     * c'est ce qui permet d'opposer deux régions, MSI/Worlds). Sa liste se
     * recharge si elle était déjà affichée, son équipe se réinitialise.
     */
    function changeLeague(which: 'A' | 'B', id: string): void {
        tournamentSlug = null;
        if (which === 'A') {
            const hadList = teamListA.length > 0;
            leagueIdA = id;
            teamListA = [];
            teamListWarningsA = [];
            teamAId = null;
            teamA = null;
            syncedAtA = null;
            if (hadList) void loadTeamList('A');
        } else {
            const hadList = teamListB.length > 0;
            leagueIdB = id;
            teamListB = [];
            teamListWarningsB = [];
            teamBId = null;
            teamB = null;
            syncedAtB = null;
            if (hadList) void loadTeamList('B');
        }
    }

    /** Liste d'équipes d'un camp — région de SA ligue (hors mapping ⇒ liste non filtrée). */
    async function loadTeamList(which: 'A' | 'B'): Promise<void> {
        if (which === 'A') teamListLoadingA = true;
        else teamListLoadingB = true;
        const region = REGION_BY_LEAGUE[which === 'A' ? leagueIdA : leagueIdB];
        const { teams, warnings } = await fetchTeamList(region !== undefined ? { region } : {});
        const list = teams
            .map((t) => ({ id: t.id, name: t.name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        if (which === 'A') {
            teamListA = list;
            teamListWarningsA = warnings;
            teamListLoadingA = false;
        } else {
            teamListB = list;
            teamListWarningsB = warnings;
            teamListLoadingB = false;
        }
    }

    async function syncTeam(which: 'A' | 'B'): Promise<void> {
        const id = which === 'A' ? teamAId : teamBId;
        if (id === null) return;
        if (which === 'A') syncingA = true;
        else syncingB = true;
        // fetchTeam is best-effort and never throws (warnings + `incomplete`).
        const team = await fetchTeam(id, {
            league: which === 'A' ? leagueIdA : leagueIdB,
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
        ...teamListWarningsA.map((w) => `Liste équipes A — ${w}`),
        ...teamListWarningsB.map((w) => `Liste équipes B — ${w}`),
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

    // ---- C1: win conditions on the current draft ----
    /** Role-ordered comps with '' holes — lane indices preserved for I3. */
    const winConditionReport = $derived.by(() => {
        const allyComp = allyPicks.map((k) => k ?? '');
        const enemyComp = enemyPicks.map((k) => k ?? '');
        if (!allyComp.some((k) => k !== '') || !enemyComp.some((k) => k !== '')) return null;
        return analyzeWinConditions(
            allyComp,
            enemyComp,
            datasets !== null ? { dataset: datasets.fullDataset } : {}
        );
    });

    // ---- corpus pro (bundled Leaguepedia snapshots → IndexedDB) ----
    let corpusStatuses = $state<CorpusLeagueStatus[]>([]);
    let corpusBusy = $state(false);
    let corpusWarnings = $state<string[]>([]);
    /** Corpus de la ligue de l'équipe A (nous) — nos modèles, nos replis. */
    let leagueRecordsA = $state<DraftRecord[] | null>(null);
    /**
     * Corpus de la ligue de l'équipe B (eux) — intel, priors adverses. Même
     * ligue des deux côtés ⇒ MÊME référence que leagueRecordsA (un seul load).
     */
    let leagueRecordsB = $state<DraftRecord[] | null>(null);
    /** Tag-pair cells fitted on the FULL corpus (cross-league) — coach pair axis. */
    let pairFit = $state<TagPairFit | null>(null);
    /** Ordered counter cells (same corpus) — coach counter-the-comp axis. */
    let counterFit = $state<TagPairFit | null>(null);
    /**
     * Carrière corpus PAR JOUEUR sur TOUTES les ligues chargées (extension
     * par-joueur de F-a) — fit une fois par refresh corpus, même mécanisme que
     * pairFit : jamais recalculé à la frappe.
     */
    let playerFit = $state<PlayerHistoryFit | null>(null);

    /**
     * Charge les corpus des DEUX camps (a, b) puis publie si les sélecteurs
     * n'ont pas bougé entre-temps. b === a ⇒ une seule lecture IndexedDB,
     * référence partagée entre leagueRecordsA et leagueRecordsB.
     */
    async function loadLeaguePairRecords(a: string, b: string): Promise<void> {
        const recordsA = await loadCorpusRecords(a);
        const recordsB = b === a ? recordsA : await loadCorpusRecords(b);
        if (leagueIdA === a) leagueRecordsA = recordsA;
        if (leagueIdB === b) leagueRecordsB = recordsB;
    }

    async function refreshCorpus(): Promise<void> {
        corpusBusy = true;
        try {
            const report = await importBundledCorpora({ basePath: base });
            corpusWarnings = report.warnings;
            corpusStatuses = await corpusStatus();
            await loadLeaguePairRecords(leagueIdA, leagueIdB);
            const allRecords = await loadAllCorpusRecords();
            pairFit = allRecords.length > 0 ? fitTagPairCells(allRecords) : null;
            counterFit = allRecords.length > 0 ? fitTagCounterCells(allRecords) : null;
            playerFit = allRecords.length > 0 ? fitPlayerHistory(allRecords) : null;
        } catch (error) {
            corpusWarnings = [error instanceof Error ? error.message : String(error)];
        } finally {
            corpusBusy = false;
        }
    }

    /** Import a user-supplied Oracle's Elixir CSV → pro corpus (preferred). */
    async function importOeFile(event: Event): Promise<void> {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        corpusBusy = true;
        try {
            const report = await importOracleElixirCorpus(await file.text());
            const n = report.imported.reduce((sum, l) => sum + l.records, 0);
            corpusWarnings =
                report.imported.length > 0
                    ? [
                          `Oracle's Elixir importé : ${n} drafts sur ${report.imported.length} ligues.`,
                          ...report.warnings
                      ]
                    : report.warnings.length > 0
                      ? report.warnings
                      : ['Aucun game importé — vérifie que c’est bien le CSV Oracle’s Elixir.'];
            corpusStatuses = await corpusStatus();
            await loadLeaguePairRecords(leagueIdA, leagueIdB);
            const allRecords = await loadAllCorpusRecords();
            pairFit = allRecords.length > 0 ? fitTagPairCells(allRecords) : null;
            counterFit = allRecords.length > 0 ? fitTagCounterCells(allRecords) : null;
            playerFit = allRecords.length > 0 ? fitPlayerHistory(allRecords) : null;
        } catch (error) {
            corpusWarnings = [error instanceof Error ? error.message : String(error)];
        } finally {
            corpusBusy = false;
            input.value = ''; // allow re-importing the same file
        }
    }

    onMount(() => {
        void refreshCorpus();
    });

    // Follow the league selectors: each side's prior/meta is league-scoped.
    $effect(() => {
        const a = leagueIdA;
        const b = leagueIdB;
        void loadLeaguePairRecords(a, b);
    });

    /** Team B's both-sided corpus games (canonical name match) — filtré depuis SA ligue (B). */
    const corpusTeamB = $derived.by((): DraftRecord[] => {
        if (teamB === null || leagueRecordsB === null) return [];
        const canonical = canonicalTeamName(teamB.name);
        return leagueRecordsB.filter(
            (r) => canonicalTeamName(r.blueTeam) === canonical || canonicalTeamName(r.redTeam) === canonical
        );
    });

    /** Team A's both-sided corpus games (même mécanisme, ligue A) — source du lineup corpus A. */
    const corpusTeamA = $derived.by((): DraftRecord[] => {
        if (teamA === null || leagueRecordsA === null) return [];
        const canonical = canonicalTeamName(teamA.name);
        return leagueRecordsA.filter(
            (r) => canonicalTeamName(r.blueTeam) === canonical || canonicalTeamName(r.redTeam) === canonical
        );
    });

    // ---- C1: opponent intel (team B) ----
    /**
     * Recomputed on sync only (teamB / nowTick) — the clock is injected.
     * Tendances/ranges/pages de bans ADVERSES ⇒ corpus de la ligue B.
     */
    const intel = $derived.by(() => {
        if (teamB === null) return null;
        return buildOpponentIntel(teamB, {
            now: new Date(nowTick).toISOString(),
            ...(leagueRecordsB !== null ? { leagueRecords: leagueRecordsB } : {}),
            ...(corpusTeamB.length > 0 ? { corpusTeamRecords: corpusTeamB } : {})
        });
    });

    /**
     * Intel SYMÉTRIQUE — les tendances de l'ÉQUIPE A (mêmes null-guards,
     * corpus ligue A). Nécessaire en simulation deux camps : quand le coach
     * conseille le camp B, sa « distribution adverse » est l'équipe A.
     * $derived paresseux : jamais calculé tant que la simulation ne le lit pas.
     */
    const intelA = $derived.by(() => {
        if (teamA === null) return null;
        return buildOpponentIntel(teamA, {
            now: new Date(nowTick).toISOString(),
            ...(leagueRecordsA !== null ? { leagueRecords: leagueRecordsA } : {}),
            ...(corpusTeamA.length > 0 ? { corpusTeamRecords: corpusTeamA } : {})
        });
    });

    /**
     * Verdict B (gate ban-history du 2026-06-11, ROUGE : LPL sous la baseline) —
     * l'EV agrégée du régime répertoire est RETIRÉE de l'affichage par défaut :
     * tri par présence (le référentiel de la baseline du rapport), composants
     * montrés séparément, jamais re-fusionnés. Le régime composition (phase 2,
     * contre-compo) reste VERT et continue de s'afficher via le coach.
     */
    const banEntriesByPresence = (entries: BanEvEntry[]): BanEvEntry[] => {
        const presenceOf = (key: string): number => intel?.presence.get(key)?.presence ?? 0;
        return [...entries].sort((a, b) => {
            const pa = presenceOf(a.championKey);
            const pb = presenceOf(b.championKey);
            if (pa !== pb) return pb - pa;
            if (a.components.takeProbability !== b.components.takeProbability) {
                return b.components.takeProbability - a.components.takeProbability;
            }
            return a.championKey < b.championKey ? -1 : 1;
        });
    };

    // ---- Tes pockets (chantier F : F1 ROUGE ⇒ panneau en LECTURE seule, F-c débranché) ----
    /**
     * Modèle public F-a d'une équipe (fitPublicSelfModel sur le corpus ligue,
     * consommés Fearless retirés). Extrait en $derived PARTAGÉ : réutilisé par
     * le conseiller équipe (F-b) ET par la lecture par joueur — il ne dépend
     * pas des picks en cours, donc plus AUCUN refit à la frappe.
     */
    const publicModelA = $derived.by((): PublicSelfModel | null => {
        // Réservoirs de NOS joueurs ⇒ corpus de NOTRE ligue (A).
        if (leagueRecordsA === null || teamA === null) return null;
        return fitPublicSelfModel(
            leagueRecordsA,
            { team: teamA.name, now: new Date(nowTick).toISOString() },
            new Set(fearlessLocked)
        );
    });

    /** Le symétrique pour l'équipe B (anticipation adverse par joueur) — ligue B. */
    const publicModelB = $derived.by((): PublicSelfModel | null => {
        if (leagueRecordsB === null || teamB === null) return null;
        return fitPublicSelfModel(
            leagueRecordsB,
            { team: teamB.name, now: new Date(nowTick).toISOString() },
            new Set(fearlessLocked)
        );
    });

    /**
     * Réservoir F-a (modèle public de l'équipe A) + conseiller F-b. Null tant
     * que corpus/équipe A/fits de tags manquent — le panneau affiche alors le
     * placeholder, jamais un réservoir inventé. `viableOnPatch` est un SEAM
     * assumé : aucune source de viabilité patch n'est branchée, tout passe
     * (documenté, pas deviné).
     */
    const pocketCandidates = $derived.by((): PocketCandidate[] | null => {
        const model = publicModelA;
        if (model === null || pairFit === null || counterFit === null) return null;
        return advisePocketPicks({
            surprises: [...model.byRole.values()].flat(),
            tagsFile: loadDefaultTags(),
            allyCompKeys: [...allyTeamMap.values()],
            enemyCompKeys: [...enemyTeamMap.values()],
            counterFit,
            pairFit,
            viableOnPatch: () => true, // SEAM patch : tout passe tant qu'aucune source n'est branchée.
            consumed: new Set(fearlessLocked)
        });
    });

    /**
     * Extension PAR JOUEUR (directive 2026-06-11) — PROPOSER : réservoir
     * carrière cross-ligues (playerFit) de chaque joueur du lineup CORPUS de
     * l'équipe A (currentLineup — aucune dépendance au roster gol.gg), bits vs
     * le modèle public de NOTRE équipe. null ⇒ section absente du panneau ;
     * [] ⇒ placeholder honnête (corpus sans attribution playerId). Les
     * consommés Fearless sont retirés de l'affichage : un pocket mort ne se
     * propose ni ne s'anticipe.
     */
    const ourPlayerPockets = $derived.by((): PlayerPocketRow[] | null => {
        const fit = playerFit;
        const model = publicModelA;
        if (fit === null || model === null || teamA === null || corpusTeamA.length === 0) return null;
        const lineup = currentLineup(corpusTeamA, teamA.name);
        const mass = publicMassOf(model);
        const consumed = new Set(fearlessLocked);
        const rows: PlayerPocketRow[] = [];
        for (const role of ROLES) {
            const playerId = lineup.get(role);
            if (playerId === undefined) continue;
            rows.push({
                role,
                playerId,
                reservoir: playerReservoir(fit, playerId, mass).filter((e) => !consumed.has(e.championKey))
            });
        }
        return rows;
    });

    /** Le symétrique défensif — ANTICIPER les pockets des joueurs adverses (équipe B). */
    const enemyPlayerPockets = $derived.by((): EnemyPlayerPocketRow[] | null => {
        const fit = playerFit;
        const model = publicModelB;
        if (fit === null || model === null || teamB === null || corpusTeamB.length === 0) return null;
        const lineup = currentLineup(corpusTeamB, teamB.name);
        const consumed = new Set(fearlessLocked);
        const reads = anticipateEnemyPockets(fit, lineup, publicMassOf(model));
        const rows: EnemyPlayerPocketRow[] = [];
        for (const role of ROLES) {
            const read = reads.get(role);
            if (read === undefined) continue;
            rows.push({
                role,
                playerId: read.playerId,
                reservoir: read.reservoir.filter((e) => !consumed.has(e.championKey)),
                deceptions: read.deceptions.filter((e) => !consumed.has(e.championKey))
            });
        }
        return rows;
    });

    // ---- Coach en direct (liveDraft + navigator) ----
    /** Engine evaluator — plain config: the coach compares DRAFT deltas. */
    const coachEvaluate = $derived.by(() => {
        if (datasets === null) return null;
        return makeAnalyzeDraftEvaluator(
            { dataset: datasets.dataset, fullDataset: datasets.fullDataset },
            { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 }
        );
    });

    /** League-presence fallback candidates when no roster is synced — NOS repli ⇒ ligue A. */
    const coachFallback = $derived.by((): string[] => {
        if (leagueRecordsA === null) return [];
        return [...computePresence(leagueRecordsA).entries()]
            .sort((a, b) => b[1].presence - a[1].presence || (a[0] < b[0] ? -1 : 1))
            .slice(0, 15)
            .map(([key]) => key);
    });

    /** Le symétrique pour le camp B en simulation — présence de SA ligue (B). */
    const coachFallbackB = $derived.by((): string[] => {
        if (leagueRecordsB === null) return [];
        return [...computePresence(leagueRecordsB).entries()]
            .sort((a, b) => b[1].presence - a[1].presence || (a[0] < b[0] ? -1 : 1))
            .slice(0, 15)
            .map(([key]) => key);
    });

    /**
     * Fits de priors de rôle ADVERSES (équipe-d'abord, repli ligue B) —
     * extraits en $derived qui ne dépend QUE du corpus, jamais des picks :
     * garde de coût F-c, aucun fit ne tourne à la frappe (le range model,
     * lui, vit dans `intel`/`intelA` — fitté au sync uniquement).
     */
    const roleFitB = $derived.by((): { league: RolePriorsFit; priors: RolePriors } | null => {
        if (leagueRecordsB === null && corpusTeamB.length === 0) return null;
        const league = fitRolePriors(leagueRecordsB ?? []);
        const priors =
            corpusTeamB.length > 0 ? layerRolePriors(fitRolePriors(corpusTeamB), league) : rolePriorsOf(league);
        return { league, priors };
    });

    /** Le symétrique côté A (simulation deux camps) — ligue A + corpus équipe A. */
    const roleFitA = $derived.by((): { league: RolePriorsFit; priors: RolePriors } | null => {
        if (leagueRecordsA === null && corpusTeamA.length === 0) return null;
        const league = fitRolePriors(leagueRecordsA ?? []);
        const priors =
            corpusTeamA.length > 0 ? layerRolePriors(fitRolePriors(corpusTeamA), league) : rolePriorsOf(league);
        return { league, priors };
    });

    /**
     * Lecture de rôles + défense F-c BRANCHÉE (F2 verte Δ_contamination
     * −82,5 pp ; non-régression défense active 95,3 % ≥ plancher gelé 94,5 % —
     * docs/calibration/role-inference-surprise-defense.md) : lecture de BASE,
     * détection des déclencheurs (mécanique W1 sur les données live), puis
     * relecture avec les priors du déclencheur SEUL passés à l'uniforme.
     * Sans table (équipe non synchronisée) : pas de modèle public, défense
     * inactive — la lecture de base est rendue telle quelle.
     */
    function readRolesWithDefense(
        entry: RoleEntryDraft,
        fit: { league: RolePriorsFit; priors: RolePriors },
        table: TendencyTable | undefined
    ): { report: EnemyRoleReport; triggers: LiveSurpriseTrigger[] } {
        const base = readEnemyRoles(entry, fit.priors);
        if (table === undefined) return { report: base, triggers: [] };
        const triggers = detectLiveSurpriseTriggers({
            entry,
            baseReport: base,
            table,
            // Compte train équipe+ligue : la ligue contient l'équipe — un seul
            // compteur suffit (doctrine §3.2), depuis les MÊMES records que les priors.
            trainRoleCountOf: (championKey, role) => fit.league.byChampion.get(championKey)?.[role] ?? 0
        });
        if (triggers.length === 0) return { report: base, triggers };
        const defended = readEnemyRoles(
            entry,
            uniformizeTriggeredPriors(fit.priors, new Set(triggers.map((t) => t.championKey)))
        );
        return { report: defended, triggers };
    }

    /**
     * Enemy role read — team-first priors, league fallback (I2 hypotheses) —
     * ligue ADVERSE (B), défense F-c active. Les bans saisis passent dans
     * l'entrée comme EXCLUSIONS de la range du déclencheur (readEnemyRoles
     * les ignore — la lecture elle-même est inchangée).
     */
    const enemyRoleReads = $derived.by(() => {
        const fit = roleFitB;
        if (fit === null) return null;
        return readRolesWithDefense(
            { allyPicks, enemyPicks, allyBans, enemyBans, allySide },
            fit,
            intel?.table
        );
    });

    /**
     * Le SYMÉTRIQUE pour le camp A (simulation deux camps) : quand le coach
     * conseille le camp B, « ses adversaires » sont les picks de l'équipe A —
     * lus avec les priors de rôle de LA ligue A + le corpus de l'équipe A, et
     * la défense F-c mesurée contre le modèle public de l'équipe A (intelA).
     * $derived paresseux : calculé seulement quand la simulation l'affiche.
     */
    const allyRoleReads = $derived.by(() => {
        const fit = roleFitA;
        if (fit === null) return null;
        return readRolesWithDefense(
            {
                allyPicks: enemyPicks,
                enemyPicks: allyPicks, // « adverse » du point de vue du camp B = équipe A
                allyBans: enemyBans,
                enemyBans: allyBans,
                allySide: enemySide
            },
            fit,
            intelA?.table
        );
    });

    // ---- Simulation deux camps (directive d'Alain) : recommandations DES
    // DEUX CÔTÉS pour simuler seul des drafts basées sur la data. ----
    /** Conditions d'activation : séquence + tournoi + les deux équipes synchronisées. */
    const simulationAvailable = $derived(
        entryMode === 'sequence' && draftFormat === 'pro' && teamA !== null && teamB !== null
    );
    const simulationActive = $derived(simulationMode && simulationAvailable);

    /**
     * Coach en direct. Hors simulation : comportement historique STRICT — le
     * coach ne parle que pour allySide (équipe A). En simulation : le coach
     * parle À CHAQUE TOUR pour LE CAMP AU TRAIT ; mapping camp→équipe :
     * camp === allySide ⇒ équipe A conseillée (distribution adverse =
     * intel.table, tendances B ; pool = teamA.players ; repli = présence
     * ligue A) ; sinon ⇒ équipe B conseillée (distribution adverse =
     * intelA.table, tendances A ; pool = teamB.players ; repli = présence
     * ligue B). pairFit/counterFit/dataset : partagés (cross-ligues). UN seul
     * recommendNext par action — jamais les deux camps à la fois.
     */
    const coach = $derived.by((): { advice: ReturnType<typeof recommendNext> | null; side: DraftSide } => {
        const evaluate = coachEvaluate;
        if (evaluate === null) return { advice: null, side: allySide };
        // Sequence mode: the EXACT board — tournament bans are ordered
        // actions (the coach speaks on ban turns); SoloQ bans are
        // simultaneous, so they enter as EXCLUSIONS and the coach runs the
        // picksOnly path, faithful to the client. Fearless lockouts join
        // the exclusions in every mode.
        const state =
            entryMode === 'sequence'
                ? draftStateFromActions(
                      toDraftActions(draftSeq, draftFormat, firstPickSide),
                      [...fearlessLocked, ...(draftFormat === 'soloq' ? bannedKeys(draftSeq, 'soloq') : [])],
                      undefined,
                      firstPickSide
                  )
                : draftStateFromRoleEntry({
                      // Bans persist from a sequence session (null in pure role entry).
                      allyPicks,
                      enemyPicks,
                      allyBans,
                      enemyBans,
                      allySide,
                      excludedKeys: fearlessLocked
                  });
        const coachSide: DraftSide = simulationActive ? (nextSlotOf(state)?.side ?? allySide) : allySide;
        const forAlly = coachSide === allySide;
        const table = forAlly ? intel?.table : intelA?.table;
        const players = contextActive ? (forAlly ? teamA?.players : teamB?.players) : undefined;
        // Contrainte de couverture de rôle (post-gate-A) : priors de la ligue
        // du CAMP CONSEILLÉ si dispo, sinon l'autre ligue — champion → rôle
        // varie peu entre ligues, mieux vaut des priors approchés que pas de
        // contrainte (choix documenté). La fonction lit state + ourSide : en
        // simulation côté B, les rôles ouverts sont bien LES SIENS.
        const rolePriors = forAlly ? (leaguePriorsFn ?? leaguePriorsFnB) : (leaguePriorsFnB ?? leaguePriorsFn);
        const advice = recommendNext(state, {
            ourSide: coachSide,
            evaluate,
            ...(table !== undefined ? { table } : {}),
            ...(players !== undefined ? { allyPlayers: players } : {}),
            ...(rolePriors !== null ? { rolePriors } : {}),
            fallbackCandidates: forAlly ? coachFallback : coachFallbackB,
            ...(datasets !== null ? { dataset: datasets.fullDataset } : {}),
            ...(pairFit !== null ? { pairFit } : {}),
            ...(counterFit !== null ? { counterFit } : {}),
            picksOnly: entryMode !== 'sequence' || draftFormat === 'soloq',
            depth: 2,
            topK: 4,
            candidateCount: 6
        });
        return { advice, side: coachSide };
    });

    /**
     * Lecture de rôles affichée par le coach — celle du camp au trait en
     * simulation (report défendu F-c + déclencheurs pour l'alerte FR).
     */
    const coachRoleReads = $derived(
        simulationActive && coach.side !== allySide ? allyRoleReads : enemyRoleReads
    );

    const intelTendencyBlocks = $derived(intel === null ? [] : tendencyBlocksOf(intel.table));

    // ---- C1: exports (prep pack + CSV) ----
    const poolGrids = $derived.by((): PoolGridPlayer[] => {
        if (teamB === null) return [];
        return teamB.players.map((player) => ({
            playerName: player.name,
            roleLabel: ROLE_LABELS[player.role],
            entries: player.pool.map((entry) => ({
                championKey: entry.championKey,
                tier: classifyPoolTier({ games: entry.games }),
                games: entry.games
            }))
        }));
    });

    function exportSlug(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'equipe';
    }

    const exportActions = $derived.by((): ExportAction[] => {
        const opponent = teamB;
        const currentIntel = intel;
        if (opponent === null || currentIntel === null) return [];
        const slug = exportSlug(opponent.name);
        return [
            {
                label: 'Prep pack .md',
                filename: `prep-pack-${slug}.md`,
                mime: 'text/markdown;charset=utf-8',
                build: () =>
                    renderPrepPackMarkdown({
                        header: {
                            title: `Prep pack — ${opponent.name}`,
                            opponent: opponent.name,
                            generatedAt: new Date().toLocaleString('fr-FR')
                        },
                        ...(plans.length > 0 ? { plans: $state.snapshot(plans) } : {}),
                        ...(activeTree !== null ? { planTree: $state.snapshot(activeTree) as PlanTree } : {}),
                        // Verdict B : ordre par présence (le ranking EV répertoire est retiré).
                        banPages: currentIntel.banPages.map((page) => ({
                            rotationLabel: page.rotationLabel,
                            entries: banEntriesByPresence(page.entries).slice(0, 8)
                        })),
                        ...(poolGrids.length > 0 ? { poolGrids } : {}),
                        tendencies: intelTendencyBlocks,
                        ranges: currentIntel.rangesBySlotGroup.map((range) => ({
                            slotLabel: range.labelFr,
                            entries: range.entries.slice(0, 8)
                        })),
                        ...(winConditionReport !== null ? { winConditions: winConditionReport } : {})
                    })
            },
            {
                label: 'Tendances .csv',
                filename: `tendances-${slug}.csv`,
                mime: 'text/csv;charset=utf-8',
                build: () => exportTendenciesCsv(intelTendencyBlocks)
            },
            {
                label: 'Pools .csv',
                filename: `pools-${slug}.csv`,
                mime: 'text/csv;charset=utf-8',
                build: () => exportPoolGridCsv(poolGrids)
            }
        ];
    });

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
        {leagueIdA}
        {leagueIdB}
        onLeagueChangeA={(id) => changeLeague('A', id)}
        onLeagueChangeB={(id) => changeLeague('B', id)}
        {tournaments}
        {tournamentSlug}
        onTournamentChange={(slug) => (tournamentSlug = slug)}
        {teamListA}
        {teamListB}
        {teamListLoadingA}
        {teamListLoadingB}
        onLoadTeamListA={() => void loadTeamList('A')}
        onLoadTeamListB={() => void loadTeamList('B')}
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
        <!-- Mode de saisie + format + contexte de série (Bo / Fearless) -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div class="flex items-center gap-2">
                <span class="panel-title">Saisie</span>
                {#each [['roles', 'Par rôle'], ['sequence', 'Séquence exacte + flex']] as const as [mode, label] (mode)}
                    <button
                        type="button"
                        onclick={() => (entryMode = mode)}
                        class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors {entryMode === mode
                            ? 'bg-gold-500/15 text-gold-300 ring-1 ring-gold-600/50'
                            : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'}"
                    >
                        {label}
                    </button>
                {/each}
            </div>
            {#if entryMode === 'sequence'}
                <div class="flex items-center gap-2">
                    <span class="panel-title">Format</span>
                    {#each [['pro', 'Tournoi 2026'], ['soloq', 'SoloQ']] as const as [fmt, label] (fmt)}
                        <button
                            type="button"
                            onclick={() => {
                                if (draftFormat !== fmt) {
                                    draftFormat = fmt;
                                    draftSeq = emptySequence();
                                    pickerSlot = null;
                                }
                            }}
                            class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors {draftFormat === fmt
                                ? 'bg-arcane-500/15 text-arcane-300 ring-1 ring-arcane-600/50'
                                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'}"
                        >
                            {label}
                        </button>
                    {/each}
                </div>
            {/if}
            <div class="flex flex-wrap items-center gap-2">
                <span class="panel-title">Série</span>
                {#if activeSeries === null}
                    {#each ['bo1', 'bo3', 'bo5'] as const as fmt (fmt)}
                        <button
                            type="button"
                            onclick={() => (seriesFormatChoice = fmt)}
                            class="rounded-md px-2.5 py-1.5 text-xs font-semibold uppercase transition-colors {seriesFormatChoice ===
                            fmt
                                ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-600/50'
                                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'}"
                        >
                            {fmt}
                        </button>
                    {/each}
                    <label
                        class="flex cursor-pointer items-center gap-1.5 text-xs {seriesFormatChoice === 'bo1'
                            ? 'text-slate-600'
                            : 'text-slate-300'}"
                    >
                        <input
                            type="checkbox"
                            bind:checked={fearlessChoice}
                            disabled={seriesFormatChoice === 'bo1'}
                            class="accent-amber-400"
                        />
                        Fearless
                    </label>
                    <button
                        type="button"
                        onclick={startSeries}
                        class="rounded-md bg-gold-500/15 px-3 py-1.5 text-xs font-semibold text-gold-300 ring-1 ring-gold-600/50 hover:bg-gold-500/25"
                    >
                        Démarrer
                    </button>
                {:else}
                    <span class="rounded-md bg-abyss-800 px-2.5 py-1 text-xs font-semibold text-slate-200">
                        {activeSeries.format.toUpperCase()}
                        {activeSeries.mode === 'fearless' ? '· Fearless' : ''} — game {Math.min(
                            currentGameNumber,
                            SERIES_MAX_GAMES[activeSeries.format]
                        )}/{SERIES_MAX_GAMES[activeSeries.format]}
                    </span>
                    {#if fearlessLocked.length > 0}
                        <span class="rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-300">
                            {fearlessLocked.length} champion{fearlessLocked.length > 1 ? 's' : ''} verrouillé{fearlessLocked.length >
                            1
                                ? 's'
                                : ''}
                        </span>
                    {/if}
                    {#if !seriesOver}
                        <button
                            type="button"
                            onclick={() => closeGame('ally')}
                            class="rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                        >
                            ✔ Game gagnée
                        </button>
                        <button
                            type="button"
                            onclick={() => closeGame('enemy')}
                            class="rounded-md bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25"
                        >
                            ✘ Game perdue
                        </button>
                    {:else}
                        <span class="text-xs font-semibold text-gold-300">Série terminée.</span>
                    {/if}
                    <button
                        type="button"
                        onclick={endSeries}
                        class="rounded-md bg-slate-800 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                    >
                        Quitter la série
                    </button>
                {/if}
            </div>
        </div>

        {#if entryMode === 'sequence'}
            <div class="animate-fade-up">
                <DraftSequenceBoard
                    sequence={draftSeq}
                    {allySide}
                    format={draftFormat}
                    {firstPickSide}
                    roleHint={boardRoleHint}
                    onRequestPick={() => {
                        const seq = nextOpenSeq(draftSeq, draftFormat);
                        if (seq !== null) pickerSlot = { seq };
                    }}
                    onReplaceAt={(seq) => (pickerSlot = { seq })}
                    onAssignRole={(seq, role) => (draftSeq = assignRole(draftSeq, seq, role, draftFormat))}
                    onUndo={() => (draftSeq = removeLast(draftSeq, draftFormat))}
                    onReset={() => {
                        draftSeq = emptySequence();
                        allyBans = emptyFive();
                        enemyBans = emptyFive();
                        pickerSlot = null;
                    }}
                />
            </div>
        {/if}

        <div class="animate-fade-up grid grid-cols-1 items-start gap-3 xl:grid-cols-12">
            <!-- Ally column -->
            <section class="space-y-2 xl:col-span-3">
                <div class="flex items-center justify-between px-1">
                    <p class="font-display flex items-center gap-2 text-xs tracking-[0.22em] uppercase {allySide === 'blue' ? 'text-blue-300' : 'text-red-300'}">
                        <span
                            class="inline-block h-1.5 w-1.5 animate-pulse-glow rounded-full {allySide === 'blue'
                                ? 'bg-blue-400 shadow-[0_0_8px_rgb(96_165_250)]'
                                : 'bg-red-400 shadow-[0_0_8px_rgb(248_113_113)]'}"
                        ></span>
                        Allié
                        <span class="rounded-full px-2 py-0.5 text-[10px] font-bold {sideBadge(allySide).cls}">
                            {sideBadge(allySide).label}
                        </span>
                    </p>
                    {#if entryMode === 'roles'}
                        <button
                            type="button"
                            onclick={() => clearTeam('ally')}
                            class="text-xs text-slate-600 hover:text-slate-300"
                        >
                            Vider
                        </button>
                    {/if}
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
                        onSelect={entryMode === 'roles' ? () => (pickerSlot = { team: 'ally', role }) : undefined}
                        onClear={entryMode === 'roles' ? () => (allyPicks[role] = null) : undefined}
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

                <!-- First Selection (règle 2026) : qui picke en premier, découplé du side.
                     Visible UNIQUEMENT en saisie séquence + format tournoi. -->
                {#if entryMode === 'sequence' && draftFormat === 'pro'}
                    <div class="rounded-lg border border-slate-800 bg-slate-900 p-3">
                        <p class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
                            First Selection — qui picke en premier
                        </p>
                        <div class="grid grid-cols-2 gap-2">
                            {#each [['blue', 'Bleu picke en 1ᵉʳ'], ['red', 'Rouge picke en 1ᵉʳ']] as const as [side, label] (side)}
                                <button
                                    type="button"
                                    onclick={() => (firstPickSide = side)}
                                    aria-pressed={firstPickSide === side}
                                    class="rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors {firstPickSide ===
                                    side
                                        ? side === 'blue'
                                            ? 'border-blue-500/60 bg-blue-500/20 text-blue-300'
                                            : 'border-red-500/60 bg-red-500/20 text-red-300'
                                        : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'}"
                                >
                                    {label}
                                </button>
                            {/each}
                        </div>
                        <p class="pt-2 text-[11px] text-slate-600">
                            Règle 2026 : le droit de picker en premier est découplé du choix de side — une équipe
                            peut être côté rouge ET picker en premier. Changer en cours de saisie remappe les
                            actions déjà posées (elles sont stockées par slot, le camp est dérivé).
                        </p>
                    </div>
                {/if}

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
                        {#if pickerInfo.roleChoice}
                            <!-- Choix Flex/rôle AU MOMENT du pick (séquence) : Flex est le
                                 défaut et reste toujours accessible au même endroit. -->
                            <div class="flex flex-wrap items-center gap-1 pb-1.5">
                                <button
                                    type="button"
                                    onclick={() => (pickerRole = undefined)}
                                    aria-pressed={pickerRole === undefined}
                                    class="rounded-md px-2 py-1 text-[11px] font-bold transition-colors {pickerRole ===
                                    undefined
                                        ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/60'
                                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'}"
                                >
                                    FLEX (sans rôle)
                                </button>
                                {#each ROLES as role (role)}
                                    <button
                                        type="button"
                                        onclick={() => (pickerRole = role)}
                                        aria-pressed={pickerRole === role}
                                        class="rounded-md px-2 py-1 text-[11px] font-semibold transition-colors {pickerRole ===
                                        role
                                            ? 'bg-arcane-500/25 text-arcane-300 ring-1 ring-arcane-600/50'
                                            : 'bg-slate-800 text-slate-500 hover:text-slate-300'}"
                                    >
                                        {ROLE_LABELS[role]}
                                    </button>
                                {/each}
                            </div>
                            <p class="pb-2 text-[11px] text-slate-500">
                                <span class="font-semibold text-amber-300">Flex</span> : gardez le rôle ouvert —
                                l'adversaire doit couvrir plusieurs hypothèses. Le rôle reste modifiable après
                                coup via les puces du plateau.
                            </p>
                        {/if}
                        <ChampionPicker
                            poolEntries={pickerInfo.entries}
                            poolLabel={pickerInfo.label}
                            disabledKeys={disabledPickerKeys}
                            onSelect={(key) => assignPick(key)}
                        />
                    </div>
                {:else}
                    <div
                        class="rounded-xl border border-dashed border-gold-700/30 bg-abyss-900/40 p-6 text-center text-sm text-slate-500"
                    >
                        Cliquez sur un slot (allié ou adverse) pour choisir un champion.
                    </div>
                {/if}
            </div>

            <!-- Enemy column -->
            <section class="space-y-2 xl:col-span-3">
                <div class="flex items-center justify-between px-1">
                    <p class="font-display flex items-center gap-2 text-xs tracking-[0.22em] uppercase {enemySide === 'blue' ? 'text-blue-300' : 'text-red-300'}">
                        <span
                            class="inline-block h-1.5 w-1.5 rounded-full {enemySide === 'blue'
                                ? 'bg-blue-400 shadow-[0_0_8px_rgb(96_165_250)]'
                                : 'bg-red-400 shadow-[0_0_8px_rgb(248_113_113)]'}"
                        ></span>
                        Adverse
                        <span class="rounded-full px-2 py-0.5 text-[10px] font-bold {sideBadge(enemySide).cls}">
                            {sideBadge(enemySide).label}
                        </span>
                    </p>
                    {#if entryMode === 'roles'}
                        <button
                            type="button"
                            onclick={() => clearTeam('enemy')}
                            class="text-xs text-slate-600 hover:text-slate-300"
                        >
                            Vider
                        </button>
                    {/if}
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
                        onSelect={entryMode === 'roles' ? () => (pickerSlot = { team: 'enemy', role }) : undefined}
                        onClear={entryMode === 'roles' ? () => (enemyPicks[role] = null) : undefined}
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
        <div class="animate-fade-up grid grid-cols-1 items-start gap-3 lg:grid-cols-3" style="animation-delay: 90ms">
            <div class="space-y-1">
                {#if result !== null}
                    <WinrateBar
                        winrate={calibratedWin?.pAlly ?? result.winrate}
                        badgeLabel={calibratedWin !== null && calibratedWin.calibrated
                            ? `Calibré sur ${calibratedWin.nGames} games (7 corpus, walk-forward)`
                            : 'Non calibré'}
                        badgeCalibrated={calibratedWin !== null && calibratedWin.calibrated}
                        badgeTitle={calibratedWin !== null && calibratedWin.calibrated
                            ? 'Quand l’outil affiche X %, la fréquence observée sur corpus pro (walk-forward) tombe dans le bac correspondant — il ne prédit toujours pas le vainqueur. Mesuré sans contexte équipe, rôles réels du corpus ; détail dans l’Aide.'
                            : 'Pas de carte de calibration validée pour cette position de draft ou cette configuration (contexte équipe actif) — % brut SoloQ, à lire comme un signal indicatif. Détail dans l’Aide.'}
                    />
                {/if}
                <p class="px-1 text-[10px] text-slate-600">
                    Source : DraftGap (SoloQ) — patch {datasets?.dataset.version ?? '?'} · 30 j v{datasets
                        ?.fullDataset.version ?? '?'}
                </p>
            </div>

            {#if breakdown !== null}
                <section class="panel p-3">
                    <p class="panel-title pb-2">Détail du score (Elo)</p>
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

        <!-- Script de prep (chantier D) : suivi de l'arbre compilé en mode séquence -->
        {#if entryMode === 'sequence'}
            {#if draftFormat !== 'pro'}
                <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-500">
                    Script de prep indisponible en SoloQ : les bans y sont simultanés (pas d'ordre à suivre) —
                    l'arbre v1 couvre la draft tournoi uniquement.
                </div>
            {:else if firstPickSide !== 'blue'}
                <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-500">
                    Script compilé en convention bleu-premier — indisponible quand le First Selection est rouge
                    (V1). Repassez le First Selection sur Bleu pour suivre un script de prep.
                </div>
            {:else}
                <div class="flex flex-wrap items-center gap-2">
                    <span class="panel-title">Script de prep</span>
                    <select
                        value={activePlanId ?? 'none'}
                        onchange={(e) => (activePlanId = e.currentTarget.value === 'none' ? null : e.currentTarget.value)}
                        class="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
                    >
                        <option value="none">Aucun plan</option>
                        {#each plans as plan (plan.id)}<option value={plan.id}>{plan.name}</option>{/each}
                    </select>
                    {#if activePlanId !== null && planTreeShown === null}
                        <span class="text-[11px] text-slate-500"
                            >Ce plan n'a pas d'arbre compilé — ouvrez sa page /plans et « Compiler contre l'adversaire ».</span
                        >
                    {/if}
                </div>
                {#if planTreeShown !== null && planTrack !== null}
                    {#if planTreeShown.ourSide !== allySide}
                        <div class="rounded-lg border border-amber-900/50 bg-slate-900 p-3 text-xs text-amber-400">
                            Arbre compilé pour le côté {planTreeShown.ourSide === 'blue' ? 'bleu' : 'rouge'} — vous êtes
                            {allySide === 'blue' ? 'bleu' : 'rouge'} : recompilez côté prep, le suivi serait faux.
                        </div>
                    {:else}
                        <!-- Gate D VERTE (docs/calibration/plan-coverage-2026.md, 2026-06-11) :
                             profondeur moyenne tenue à K = 4 (plafond 6) — modèle 0,725 vs
                             baseline ligue 0,588, Δ +0,137 IC [0,111 ; 0,162]. Le composant
                             affiche le wording mesuré + caveat blue-first lui-même. -->
                        <PlanTreePanel
                            tree={planTreeShown}
                            track={planTrack}
                            planName={plans.find((p) => p.id === planTreeShown.planId)?.name}
                            onRecompile={() => void recompileFromHere()}
                            {recompiling}
                            gateVerdict="vert"
                            gateCoverage={{ model: 0.725, baseline: 0.588 }}
                        />
                    {/if}
                {/if}
            {/if}
        {/if}

        <!-- Coach en direct — explorateur de lignes chiffré (gate A rouge du 2026-06-11 :
             pas une recommandation validée), lignes expliquées sur la draft en cours.
             Simulation deux camps : le coach parle à chaque tour, pour le camp au trait,
             avec la data de l'équipe de ce camp (mapping documenté sur `coach`). -->
        <div class="animate-fade-up" style="animation-delay: 180ms">
            <div class="mb-2 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onclick={() => (simulationMode = !simulationMode)}
                    disabled={!simulationAvailable}
                    aria-pressed={simulationActive}
                    class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors {simulationActive
                        ? 'bg-gold-500/15 text-gold-300 ring-1 ring-gold-600/50'
                        : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'} disabled:opacity-40"
                >
                    Simulation deux camps {simulationActive ? '· active' : ''}
                </button>
                {#if !simulationAvailable}
                    <span class="text-[11px] text-slate-600">
                        Pour simuler seul une draft : saisie « Séquence exacte », format Tournoi 2026, et les
                        équipes A et B synchronisées (la data des deux côtés).
                    </span>
                {/if}
            </div>
            <CoachPanel
                advice={coach.advice}
                roleReads={coachRoleReads?.report ?? null}
                surpriseTriggers={coachRoleReads?.triggers ?? null}
                calibration={defaultWinCalibrationConfig()}
                {picksLocked}
                ourSide={coach.side}
                advisedCamp={simulationActive
                    ? {
                          side: coach.side,
                          teamName: (coach.side === allySide ? teamA?.name : teamB?.name) ?? '?'
                      }
                    : null}
                unavailableReason={datasetLoading
                    ? 'Le coach attend la fin du téléchargement du dataset…'
                    : (datasetError ?? 'Coach indisponible.')}
                noteFr={simulationActive
                    ? 'Simulation : l’outil joue les deux chaises avec la data de chaque équipe — conseils du camp au trait, tendances adverses = l’autre équipe.'
                    : entryMode === 'sequence'
                      ? `Ordre EXACT saisi (bans compris) — le coach lit la vraie draft, tours de ban inclus.${teamB === null ? ' Synchronisez l’équipe adverse pour des ranges réelles.' : ''}`
                      : `Phase de picks (cette vue ne saisit pas les bans) — ordre reconstruit sur le template, saisie par rôle.${teamB === null ? ' Synchronisez l’équipe adverse pour des ranges réelles.' : ''}`}
            />
        </div>

        <!-- Corpus pro embarqué (Leaguepedia → IndexedDB) -->
        <div class="panel p-3 text-xs text-slate-400">
            <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold uppercase tracking-wide text-slate-300">Corpus pro</span>
                {#if corpusStatuses.length > 0}
                    {#each corpusStatuses as status (status.league)}
                        <span
                            class="rounded px-1.5 py-0.5 {status.source === OE_SOURCE
                                ? 'bg-gold-500/15 text-gold-200'
                                : 'bg-slate-800'}"
                            title={status.source === OE_SOURCE
                                ? "Oracle's Elixir (importé)"
                                : 'Leaguepedia (embarqué)'}
                        >
                            {status.league.toUpperCase()} · {status.records} drafts
                        </span>
                    {/each}
                {:else if corpusBusy}
                    <span>Import du corpus en cours…</span>
                {:else}
                    <span>Aucun corpus importé.</span>
                {/if}
                <label
                    class="ml-auto cursor-pointer rounded border border-gold-700/50 px-2 py-1 text-gold-300 hover:bg-gold-500/10 {corpusBusy
                        ? 'pointer-events-none opacity-50'
                        : ''}"
                    title="Importe ton CSV Oracle's Elixir (tout le pro mondial, à jour) — reste dans ton navigateur"
                >
                    Importer Oracle's Elixir
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        class="hidden"
                        onchange={(e) => void importOeFile(e)}
                        disabled={corpusBusy}
                    />
                </label>
                <button
                    class="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    onclick={() => void refreshCorpus()}
                    disabled={corpusBusy}
                >
                    {corpusBusy ? 'Import…' : 'Rafraîchir'}
                </button>
            </div>
            <p class="mt-1 text-[10px] text-slate-600">
                Les deux camps, ordre exact, rôles et patchs — alimente tendances, ranges et le coach.
                Importe le CSV Oracle's Elixir (oracleselixir.com) pour couvrir tout le pro mondial à
                jour ; il reste dans ton navigateur. Sinon : Leaguepedia embarqué (CC BY-SA 3.0).
            </p>
            {#if corpusWarnings.length > 0}
                <ul class="mt-1 space-y-0.5 text-[10px] text-amber-400/90">
                    {#each corpusWarnings as warning (warning)}
                        <li>• {warning}</li>
                    {/each}
                </ul>
            {/if}
        </div>

        <!-- C1: win conditions on the current draft -->
        {#if winConditionReport !== null}
            <WinConditionPanel report={winConditionReport} title="Conditions de victoire — draft courante" />
        {:else}
            <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
                Conditions de victoire : placez au moins un champion de chaque côté pour lire les 8 axes
                bilatéraux.
            </div>
        {/if}

        <!-- C1: opponent intel from team B -->
        {#if intel !== null && teamB !== null}
            {#if intel.warnings.length > 0}
                <details class="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
                    <summary class="cursor-pointer select-none">
                        Conditions de lecture de l'intel ({intel.warnings.length})
                    </summary>
                    <ul class="list-disc space-y-0.5 pt-2 pl-5 text-slate-500">
                        {#each intel.warnings as warning, i (i)}
                            <li>{warning}</li>
                        {/each}
                    </ul>
                </details>
            {/if}

            <div class="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
                <TendencyPanel
                    table={intel.table}
                    records={intel.records}
                    title="Tendances — {teamB.name}"
                />
                <RangePanel blocks={intel.rangesBySlotGroup} title="Ranges — {teamB.name}" />
            </div>

            <!-- Chantier F — Tes pockets : F1 ROUGE ⇒ lecture seule (badge du composant) ;
                 F2 VERTE citée en provenance par l'alerte ; F-c reste débranché (aucun
                 appel à surpriseDefense). Extension par-joueur (2026-06-11) : PROPOSER
                 (nos joueurs) / ANTICIPER (joueurs adverses) — sections absentes sans
                 lineup corpus, placeholder honnête sans attribution playerId. -->
            {#if pocketCandidates !== null}
                <PocketPanel
                    candidates={pocketCandidates}
                    ourPlayers={ourPlayerPockets}
                    enemyPlayers={enemyPlayerPockets}
                    ourTeamName={teamA?.name ?? null}
                    enemyTeamName={teamB?.name ?? null}
                />
            {:else}
                <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
                    Tes pockets : synchronisez l'Équipe A (votre équipe) et importez le corpus ligue pour
                    lire le réservoir de surprises — lecture du modèle public, jamais un claim de pool privé.
                </div>
            {/if}

            <!-- Ban pages phase 1 (régime répertoire) — affichage honnête post-gate B
                 (ROUGE, 2026-06-11) : tri par présence, composants séparés, AUCUNE EV
                 agrégée. Le régime composition (phase 2) reste vert et s'affiche via
                 le coach (« contre leur compo »). -->
            <section class="panel p-3">
                <h2 class="panel-title flex items-center gap-2 pb-2">
                    Pages de bans — {teamB.name}
                    <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 normal-case tracking-normal">
                        Non calibré
                    </span>
                </h2>
                {#if intel.banPages.length === 0}
                    <p class="text-xs text-slate-600">
                        Pas assez de tendances de première rotation pour chiffrer des bans.
                    </p>
                {:else}
                    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {#each intel.banPages as page (page.rotationLabel)}
                            <div>
                                <p class="pb-1 text-xs font-semibold text-slate-300">{page.rotationLabel}</p>
                                <ul class="space-y-1">
                                    {#each banEntriesByPresence(page.entries).slice(0, 6) as entry (entry.championKey)}
                                        {@const presenceEntry = intel.presence.get(entry.championKey)}
                                        <li class="rounded-md bg-slate-800/40 px-2 py-1.5">
                                            <div class="flex items-center gap-2">
                                                <ChampionIcon championKey={entry.championKey} size={22} />
                                                <span class="text-xs text-slate-200">
                                                    {championNameByKey(entry.championKey) ?? entry.championKey}
                                                </span>
                                                <span
                                                    class="ml-auto font-mono text-[11px] text-slate-300"
                                                    title="Présence pick+ban dans leurs games (clé de tri — l'EV agrégée du régime répertoire est retirée)"
                                                >
                                                    présence {Math.round((presenceEntry?.presence ?? 0) * 100)} %
                                                </span>
                                            </div>
                                            <p class="flex flex-wrap gap-1 pt-1 pl-8">
                                                <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                                    sortie attendue {Math.round(entry.components.takeProbability * 100)} %
                                                </span>
                                                {#if entry.components.banAttraction > 0}
                                                    <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                                        banni contre eux ~{Math.round(entry.components.banAttraction * 100)} %
                                                    </span>
                                                {/if}
                                                <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                                    si pris −{entry.components.damage.toFixed(1).replace('.', ',')} pp
                                                </span>
                                                {#if entry.components.structural > 0}
                                                    <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                                        structurel {Math.round(entry.components.structural * 100)} %
                                                    </span>
                                                {/if}
                                            </p>
                                            {#if entry.rationaleFr.length > 0}
                                                <p class="pt-0.5 pl-8 text-[10px] text-slate-500">
                                                    {entry.rationaleFr.join(' · ')}
                                                </p>
                                            {/if}
                                        </li>
                                    {/each}
                                </ul>
                            </div>
                        {/each}
                    </div>
                    <p class="pt-2 text-[10px] text-slate-600">
                        Piste EV retirée (gate du 2026-06-11 : sous la baseline en LPL) — composants affichés
                        séparément. Les bans de phase 2 (contrer la compo révélée) sont un régime distinct,
                        validé, qui continue de s'afficher dans le coach.
                    </p>
                {/if}
            </section>

            <ExportBar
                actions={exportActions}
                title="Exports — prep pack"
                note="Contenu généré au clic depuis l'état affiché (plans IndexedDB, intel {teamB.name}, conditions de victoire). Badge « Non calibré » imprimé sur chaque artefact."
            />
        {:else}
            <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
                Intel adverse : synchronisez l'Équipe B pour lire ses tendances par rotation, ses ranges par
                slot, ses pages de bans et exporter le prep pack.
            </div>
        {/if}
    {/if}
</div>
