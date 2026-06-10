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
        loadAllCorpusRecords,
        loadCorpusRecords,
        type CorpusLeagueStatus
    } from '$lib/intel/corpusStore';
    import { fitTagCounterCells, fitTagPairCells, type TagPairFit } from '$lib/estimators/tagPairs';
    import { fitRolePriors, layerRolePriors, rolePriorsOf } from '$lib/aggregates/rolePriors';
    import {
        draftStateFromActions,
        draftStateFromRoleEntry,
        readEnemyRoles,
        recommendNext
    } from '$lib/intel/liveDraft';
    import {
        assignRole,
        emptySequence,
        lastFilledSeq,
        nextOpenSeq,
        removeLast,
        replaceAt,
        roleEntryView,
        slotOf,
        toDraftActions,
        usedKeys
    } from '$lib/draft/sequence';
    import DraftSequenceBoard, { BOARD_SLOTS } from '$lib/components/DraftSequenceBoard.svelte';
    import { makeAnalyzeDraftEvaluator } from '$lib/strategic/draftNavigator';
    import { computePresence } from '$lib/aggregates/presence';
    import { canonicalTeamName } from '$lib/data/normalize';
    import type { DraftRecord } from '$lib/data/types';
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

    // ---- sequence entry mode (exact tournament order + flex picks) ----
    let entryMode = $state<'roles' | 'sequence'>('roles');
    let draftSeq = $state(emptySequence());

    /** League role priors — flex resolver + board hints (cached on records). */
    const leaguePriorsFn = $derived.by(() => {
        if (leagueRecords === null) return null;
        return rolePriorsOf(fitRolePriors(leagueRecords));
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
    $effect(() => {
        if (entryMode !== 'sequence') return;
        const view = roleEntryView(draftSeq, allySide, seqRoleResolver);
        allyPicks = [...view.allyPicks];
        enemyPicks = [...view.enemyPicks];
        allyBans = [...view.allyBans];
        enemyBans = [...view.enemyBans];
    });

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
        if ('seq' in slot) {
            const info = slotOf(slot.seq);
            const board = BOARD_SLOTS.find((s) => s.seq === slot.seq);
            if (info === undefined || board === undefined) return null;
            return {
                slot,
                entries: [] as ChampionPoolEntry[],
                label: 'Tous les champions',
                title: `${info.type === 'ban' ? 'Ban' : 'Pick'} ${board.label} — côté ${info.side === 'blue' ? 'bleu' : 'rouge'}`
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
        return { slot, entries, label, title };
    });

    function assignPick(championKey: string | null): void {
        const slot = pickerSlot;
        if (slot === null) return;
        if ('seq' in slot) {
            // Sequence target: fill/replace in place; « Retirer » only undoes the tail.
            if (championKey !== null) draftSeq = replaceAt(draftSeq, slot.seq, championKey);
            else if (lastFilledSeq(draftSeq) === slot.seq) draftSeq = removeLast(draftSeq);
            pickerSlot = null;
            return;
        }
        if (slot.team === 'ally') allyPicks[slot.role] = championKey;
        else enemyPicks[slot.role] = championKey;
        pickerSlot = null;
    }

    /** Picker exclusions: the whole board in sequence mode, picks otherwise. */
    const disabledPickerKeys = $derived(entryMode === 'sequence' ? [...usedKeys(draftSeq)] : pickedKeys);

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
    let leagueRecords = $state<DraftRecord[] | null>(null);
    /** Tag-pair cells fitted on the FULL corpus (cross-league) — coach pair axis. */
    let pairFit = $state<TagPairFit | null>(null);
    /** Ordered counter cells (same corpus) — coach counter-the-comp axis. */
    let counterFit = $state<TagPairFit | null>(null);

    async function refreshCorpus(): Promise<void> {
        corpusBusy = true;
        try {
            const report = await importBundledCorpora();
            corpusWarnings = report.warnings;
            corpusStatuses = await corpusStatus();
            leagueRecords = await loadCorpusRecords(leagueId);
            const allRecords = await loadAllCorpusRecords();
            pairFit = allRecords.length > 0 ? fitTagPairCells(allRecords) : null;
            counterFit = allRecords.length > 0 ? fitTagCounterCells(allRecords) : null;
        } catch (error) {
            corpusWarnings = [error instanceof Error ? error.message : String(error)];
        } finally {
            corpusBusy = false;
        }
    }

    onMount(() => {
        void refreshCorpus();
    });

    // Follow the league selector: the intel prior/meta is league-scoped.
    $effect(() => {
        const league = leagueId;
        void loadCorpusRecords(league).then((records) => {
            if (leagueId === league) leagueRecords = records;
        });
    });

    /** Team B's both-sided corpus games (canonical name match). */
    const corpusTeamB = $derived.by((): DraftRecord[] => {
        if (teamB === null || leagueRecords === null) return [];
        const canonical = canonicalTeamName(teamB.name);
        return leagueRecords.filter(
            (r) => canonicalTeamName(r.blueTeam) === canonical || canonicalTeamName(r.redTeam) === canonical
        );
    });

    // ---- C1: opponent intel (team B) ----
    /** Recomputed on sync only (teamB / nowTick) — the clock is injected. */
    const intel = $derived.by(() => {
        if (teamB === null) return null;
        return buildOpponentIntel(teamB, {
            now: new Date(nowTick).toISOString(),
            ...(leagueRecords !== null ? { leagueRecords } : {}),
            ...(corpusTeamB.length > 0 ? { corpusTeamRecords: corpusTeamB } : {})
        });
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

    /** League-presence fallback candidates when no roster is synced. */
    const coachFallback = $derived.by((): string[] => {
        if (leagueRecords === null) return [];
        return [...computePresence(leagueRecords).entries()]
            .sort((a, b) => b[1].presence - a[1].presence || (a[0] < b[0] ? -1 : 1))
            .slice(0, 15)
            .map(([key]) => key);
    });

    /** Enemy role read — team-first priors, league fallback (I2 hypotheses). */
    const enemyRoleReads = $derived.by(() => {
        if (leagueRecords === null && corpusTeamB.length === 0) return null;
        const league = fitRolePriors(leagueRecords ?? []);
        const priors =
            corpusTeamB.length > 0 ? layerRolePriors(fitRolePriors(corpusTeamB), league) : rolePriorsOf(league);
        return readEnemyRoles(
            {
                allyPicks,
                enemyPicks,
                allyBans: [null, null, null, null, null],
                enemyBans: [null, null, null, null, null],
                allySide
            },
            priors
        );
    });

    const coachAdvice = $derived.by(() => {
        const evaluate = coachEvaluate;
        if (evaluate === null) return null;
        // Sequence mode: the EXACT board (true order, bans included) — the
        // coach speaks on ban turns too. Role mode keeps the documented
        // template approximation with forfeited bans.
        const state =
            entryMode === 'sequence'
                ? draftStateFromActions(toDraftActions(draftSeq))
                : draftStateFromRoleEntry({
                      // Bans persist from a sequence session (null in pure role entry).
                      allyPicks,
                      enemyPicks,
                      allyBans,
                      enemyBans,
                      allySide
                  });
        return recommendNext(state, {
            ourSide: allySide,
            evaluate,
            ...(intel !== null ? { table: intel.table } : {}),
            ...(contextActive && teamA !== null ? { allyPlayers: teamA.players } : {}),
            fallbackCandidates: coachFallback,
            ...(datasets !== null ? { dataset: datasets.fullDataset } : {}),
            ...(pairFit !== null ? { pairFit } : {}),
            ...(counterFit !== null ? { counterFit } : {}),
            picksOnly: entryMode !== 'sequence',
            depth: 2,
            topK: 4,
            candidateCount: 6
        });
    });

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
                        banPages: currentIntel.banPages.map((page) => ({
                            rotationLabel: page.rotationLabel,
                            entries: page.entries.slice(0, 8)
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
        <!-- Mode de saisie : par rôle (analyse) ou séquence exacte (draft réelle) -->
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
            {#if entryMode === 'sequence'}
                <span class="text-[11px] text-slate-500">
                    Ordre réel du tournoi, bans compris — les colonnes par rôle se remplissent toutes seules.
                </span>
            {/if}
        </div>

        {#if entryMode === 'sequence'}
            <div class="animate-fade-up">
                <DraftSequenceBoard
                    sequence={draftSeq}
                    {allySide}
                    roleHint={boardRoleHint}
                    onRequestPick={() => {
                        const seq = nextOpenSeq(draftSeq);
                        if (seq !== null) pickerSlot = { seq };
                    }}
                    onReplaceAt={(seq) => (pickerSlot = { seq })}
                    onAssignRole={(seq, role) => (draftSeq = assignRole(draftSeq, seq, role))}
                    onUndo={() => (draftSeq = removeLast(draftSeq))}
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
                    <WinrateBar winrate={result.winrate} />
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

        <!-- Coach en direct : recommandations expliquées sur la draft en cours -->
        <div class="animate-fade-up" style="animation-delay: 180ms">
            <CoachPanel
                advice={coachAdvice}
                roleReads={enemyRoleReads}
                unavailableReason={datasetLoading
                    ? 'Le coach attend la fin du téléchargement du dataset…'
                    : (datasetError ?? 'Coach indisponible.')}
                noteFr={entryMode === 'sequence'
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
                        <span class="rounded bg-slate-800 px-1.5 py-0.5">
                            {status.league.toUpperCase()} · {status.records} drafts
                        </span>
                    {/each}
                {:else if corpusBusy}
                    <span>Import du corpus en cours…</span>
                {:else}
                    <span>Aucun corpus importé.</span>
                {/if}
                <button
                    class="ml-auto rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    onclick={() => void refreshCorpus()}
                    disabled={corpusBusy}
                >
                    {corpusBusy ? 'Import…' : 'Rafraîchir'}
                </button>
            </div>
            <p class="mt-1 text-[10px] text-slate-600">
                Les deux camps, ordre exact, rôles et patchs — alimente tendances, ranges et le coach.
                Data from Leaguepedia (lol.fandom.com), CC BY-SA 3.0.
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

            <!-- Ban pages (EV vs the tendency distribution, components separated) -->
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
                                    {#each page.entries.slice(0, 6) as entry (entry.championKey)}
                                        <li class="rounded-md bg-slate-800/40 px-2 py-1.5">
                                            <div class="flex items-center gap-2">
                                                <ChampionIcon championKey={entry.championKey} size={22} />
                                                <span class="text-xs text-slate-200">
                                                    {championNameByKey(entry.championKey) ?? entry.championKey}
                                                </span>
                                                <span class="ml-auto font-mono text-[11px] text-slate-300" title="EV du ban (clé de tri)">
                                                    EV {entry.ev.toFixed(2).replace('.', ',')}
                                                </span>
                                            </div>
                                            <p class="flex flex-wrap gap-1 pt-1 pl-8">
                                                <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                                    sortie {Math.round(entry.components.takeProbability * 100)} %
                                                </span>
                                                <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                                    si pris −{entry.components.damage.toFixed(1).replace('.', ',')} pp
                                                </span>
                                                <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                                    structurel {Math.round(entry.components.structural * 100)} %
                                                </span>
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
                        EV = sortie attendue × (dégât de remplacement + valeur structurelle) — composantes
                        affichées séparément, l'EV n'est qu'une clé de tri.
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
