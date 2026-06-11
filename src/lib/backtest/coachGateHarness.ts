/**
 * Harnais de la gate COACH (run #2, chantier A) — folds et deps injectées,
 * extraits À L'IDENTIQUE de `scripts/backtest/coachGate.ts` (chantier W2,
 * étape 1 : refactor d'équivalence — comportement byte-identique exigé,
 * prouvé par `tests/coachGateHarness.test.ts` : le runner v1 re-rend
 * EXACTEMENT le rapport gelé `tests/fixtures/coachgate/expected-report.md`
 * sur la fixture synthétique).
 *
 * RIEN de la règle gelée (docs/run2/A-coach-gate.md §1, recopiée verbatim
 * dans l'en-tête du script) ne change ici : ce module rend RÉUTILISABLE par
 * le runner F4 (`scripts/backtest/f4Endgame.ts`, règle F-pocket-picks.md
 * §3.4 — « méthodologie de la gate A ») la mécanique exacte du bras depth-2 :
 *
 *  - `buildFearlessDetector` : détecteur déterministe par corpus = picks
 *    réutilisés entre games d'une même série (`series.matchId`, `gameNumber`
 *    croissant) ; lockouts ACTIFS ssi détecteur = 0 ; `lockedFor` = picks des
 *    games antérieures de la série (picks seulement — hard Fearless ne
 *    verrouille pas les bans) ;
 *  - `makeFoldProvider` : folds paresseux par patch (walk-forward PAR CORPUS,
 *    patron postdiction) — présence top-15 (tri : présence desc, clé asc),
 *    clés du train, `now_k` = plus ancienne date du patch testé (repli
 *    injecté `fallbackNow` = le `--generated-at` du script), WR train
 *    (vainqueur connu seulement, S4), tables de tendances PAR ÉQUIPE à
 *    `now = now_k` ;
 *  - `makeCoachTurnEngine` : moteur par game — univers (clés tags ∪ train ∪
 *    game) − lockouts, caches par tour (ctx table adverse RÉELLE, liste
 *    shippée `rankOurCandidates`, memo navigate partagé entre les ≤ 5 racines
 *    forcées du même tour), `ScoreGameDeps` modèle (valueOf = navigate
 *    racine-forcée, depth 2, topK 4), sondes de couverture §1.6
 *    (« distribution adverse active », C_t affiché, pick réel par seq).
 *
 * Pur là où c'est possible : zéro I/O, zéro horloge ; l'évaluateur, les clés
 * de tags et l'ancre de repli sont des seams injectés.
 */
import { computePresence } from '$lib/aggregates/presence';
import { buildTendencyTable, type TendencyTable } from '$lib/aggregates/tendency';
import type { ScoreGameDeps } from '$lib/backtest/coachGate';
import { comparePatches, parsePatch } from '$lib/backtest/walkforward';
import type { DraftRecord, DraftSide } from '$lib/data/types';
import { enemyDistributionOf, rankOurCandidates, type CoachContext } from '$lib/intel/liveDraft';
import {
    navigate,
    nextSlotOf,
    type DraftEvaluator,
    type DraftState,
    type NavigatorMemoEntry,
    type NavigatorSlot
} from '$lib/strategic/draftNavigator';

// ---- détecteur Fearless (réutilisations inter-games par série) -----------------

export interface FearlessDetector {
    /** Picks réutilisés entre games d'une même série (gameNumber croissant). */
    reused: number;
    /** Picks examinés (toutes les games de gameNumber > 1 des séries). */
    examined: number;
    /** Lockouts ACTIFS ssi détecteur = 0 (config data-driven, règle §1.2). */
    lockoutsOn: boolean;
    /** Picks des games antérieures de la série — vide si OFF ou game 1. */
    lockedFor: (record: DraftRecord) => Set<string>;
}

const resolvedPicksOf = (record: DraftRecord): string[] =>
    record.actions.filter((a) => a.type === 'pick' && a.championKey !== '').map((a) => a.championKey);

export function buildFearlessDetector(records: DraftRecord[]): FearlessDetector {
    const seriesGames = new Map<string, DraftRecord[]>();
    for (const record of records) {
        const matchId = record.series?.matchId;
        if (matchId === undefined) continue;
        const bucket = seriesGames.get(matchId) ?? [];
        bucket.push(record);
        seriesGames.set(matchId, bucket);
    }
    for (const bucket of seriesGames.values()) {
        bucket.sort(
            (a, b) => a.series!.gameNumber - b.series!.gameNumber || (a.gameId < b.gameId ? -1 : 1)
        );
    }
    let reused = 0;
    let examined = 0;
    for (const bucket of seriesGames.values()) {
        const prior = new Set<string>();
        bucket.forEach((game, index) => {
            const picks = resolvedPicksOf(game);
            if (index > 0) {
                for (const key of picks) {
                    examined += 1;
                    if (prior.has(key)) reused += 1;
                }
            }
            for (const key of picks) prior.add(key);
        });
    }
    const lockoutsOn = reused === 0;
    const lockedFor = (record: DraftRecord): Set<string> => {
        const locked = new Set<string>();
        const matchId = record.series?.matchId;
        const gameNumber = record.series?.gameNumber;
        if (!lockoutsOn || matchId === undefined || gameNumber === undefined || gameNumber <= 1) {
            return locked;
        }
        for (const other of seriesGames.get(matchId) ?? []) {
            if (other.series!.gameNumber >= gameNumber) continue;
            for (const key of resolvedPicksOf(other)) locked.add(key);
        }
        return locked;
    };
    return { reused, examined, lockoutsOn, lockedFor };
}

// ---- folds paresseux par patch (présence, top-15, tables par équipe, now_k) ----

export interface CoachGateFold {
    presenceOrder: string[];
    presenceValue: Map<string, number>;
    top15: string[];
    trainKeys: Set<string>;
    nowK: string;
    wrTrain: Map<string, { wins: number; games: number }>;
    tableFor: (team: string) => TendencyTable;
}

/**
 * Fournisseur de folds walk-forward du corpus `records` : pour un patch k,
 * train = records du MÊME corpus de patch plaçable strictement antérieur
 * (`parsePatch`/`comparePatches`) ; premier patch ⇒ null (cause `no-fold`
 * chez l'appelant). `fallbackNow` = repli de `now_k` (le `--generated-at`).
 */
export function makeFoldProvider(
    records: DraftRecord[],
    fallbackNow: string
): (patch: string) => CoachGateFold | null {
    const foldByPatch = new Map<string, CoachGateFold | null>();
    return (patch: string): CoachGateFold | null => {
        const cached = foldByPatch.get(patch);
        if (cached !== undefined) return cached;
        const train = records.filter(
            (r) =>
                r.patch !== undefined && parsePatch(r.patch) !== undefined && comparePatches(r.patch, patch) < 0
        );
        if (train.length === 0) {
            foldByPatch.set(patch, null);
            return null;
        }
        const presenceOrder = [...computePresence(train).entries()]
            .sort((a, b) => b[1].presence - a[1].presence || (a[0] < b[0] ? -1 : 1))
            .map(([key]) => key);
        const presenceValue = new Map<string, number>(presenceOrder.map((key, index) => [key, -index]));
        const top15 = presenceOrder.slice(0, 15);
        const trainKeys = new Set<string>();
        for (const r of train) {
            for (const a of r.actions) if (a.championKey !== '') trainKeys.add(a.championKey);
        }
        let nowK: string | undefined;
        for (const r of records) {
            if (r.patch !== patch || r.date === undefined) continue;
            if (nowK === undefined || r.date < nowK) nowK = r.date;
        }
        const wrTrain = new Map<string, { wins: number; games: number }>();
        const tally = (team: string, won: boolean): void => {
            const cell = wrTrain.get(team) ?? { wins: 0, games: 0 };
            cell.games += 1;
            if (won) cell.wins += 1;
            wrTrain.set(team, cell);
        };
        for (const r of train) {
            if (r.winner === undefined) continue;
            tally(r.blueTeam, r.winner === 'blue');
            tally(r.redTeam, r.winner === 'red');
        }
        const tables = new Map<string, TendencyTable>();
        const now = nowK ?? fallbackNow;
        const tableFor = (team: string): TendencyTable => {
            let table = tables.get(team);
            if (table === undefined) {
                table = buildTendencyTable(train, train, { team, now });
                tables.set(team, table);
            }
            return table;
        };
        const fold: CoachGateFold = { presenceOrder, presenceValue, top15, trainKeys, nowK: now, wrTrain, tableFor };
        foldByPatch.set(patch, fold);
        return fold;
    };
}

// ---- moteur par game : univers, caches par tour, deps modèle, sondes §1.6 ------

/** Cache d'un tour : ctx (table adverse réelle), liste shippée, memo navigate. */
export interface CoachTurnEntry {
    ctx: CoachContext;
    shipped6: string[];
    memo: Map<string, NavigatorMemoEntry>;
}

export interface CoachTurnEngineOptions {
    fold: CoachGateFold;
    /** Lockouts Fearless de la game (`detector.lockedFor(record)`). */
    locked: Set<string>;
    /** Clés du fichier de tags (base de l'univers de disponibilité). */
    tagsKeys: readonly string[];
    /** Évaluateur shippé (`makeAnalyzeDraftEvaluator` côté runner). */
    evaluate: DraftEvaluator;
}

export interface CoachTurnEngine {
    /** Deps du bras MODÈLE : valueOf = navigate racine-forcée depth 2 topK 4. */
    modelDeps: ScoreGameDeps;
    /** Mêmes seams pour les baselines/bras appariés : mêmes tours, mêmes C_t. */
    availableOf: ScoreGameDeps['availableOf'];
    candidatesOf: ScoreGameDeps['candidatesOf'];
    /** Univers (clés tags ∪ train ∪ game) − lockouts. */
    universe: Set<string>;
    /** Nœuds navigate évalués (cumul des valueOf du bras modèle). */
    readonly evaluatedNodes: number;
    /** Cache du tour (ctx, shipped6, memo) — le seam du bras exhaustif F4. */
    turnEntryOf: (state: DraftState, slot: NavigatorSlot) => CoachTurnEntry;
    /** C_t affiché du tour (shipped6 tronqué à 4) si le tour a été visité. */
    ctOf: (seq: number) => string[] | undefined;
    /** Pick réel résolu à ce seq (couverture « pick réel déjà dans C_t »). */
    realPickKeyAt: (seq: number) => string | undefined;
    /** Sonde « distribution adverse active » (couverture §1.6). */
    adverseActiveAt: (seq: number, side: DraftSide) => boolean;
}

export function makeCoachTurnEngine(
    record: DraftRecord,
    opts: CoachTurnEngineOptions
): CoachTurnEngine {
    const { fold, locked, tagsKeys, evaluate } = opts;

    // Disponibilité : univers (clés tags ∪ train ∪ game) − lockouts ; les
    // révélés sont soustraits par la lib, le pick réel ré-ajouté par elle.
    const universe = new Set<string>(tagsKeys);
    for (const key of fold.trainKeys) universe.add(key);
    for (const action of record.actions) {
        if (action.championKey !== '') universe.add(action.championKey);
    }
    for (const key of locked) universe.delete(key);

    // Caches par tour : ctx (table adverse réelle), liste shippée, memo
    // navigate partagé entre les ≤ 5 racines forcées du même tour.
    const turnEntries = new Map<number, CoachTurnEntry>();
    const turnEntryOf = (state: DraftState, slot: NavigatorSlot): CoachTurnEntry => {
        let entry = turnEntries.get(slot.seq);
        if (entry === undefined) {
            const enemyTeam = slot.side === 'blue' ? record.redTeam : record.blueTeam;
            const ctx: CoachContext = {
                ourSide: slot.side,
                evaluate,
                table: fold.tableFor(enemyTeam),
                fallbackCandidates: fold.top15,
                depth: 2,
                topK: 4,
                candidateCount: 6
            };
            entry = { ctx, shipped6: rankOurCandidates(ctx, state, 6), memo: new Map() };
            turnEntries.set(slot.seq, entry);
        }
        return entry;
    };

    const availableOf = (): Set<string> => universe;
    const candidatesOf = (state: DraftState, slot: NavigatorSlot): string[] =>
        turnEntryOf(state, slot).shipped6.slice(0, 4);

    let evaluatedNodes = 0;
    const modelDeps: ScoreGameDeps = {
        availableOf,
        candidatesOf,
        valueOf: (state, slot, championKey) => {
            const entry = turnEntryOf(state, slot);
            const result = navigate(state, {
                ourSide: slot.side,
                ourCandidates: (s) =>
                    s.actions.length === state.actions.length ? [championKey] : entry.shipped6,
                enemyDistribution: (s, enemySlot) => enemyDistributionOf(entry.ctx, s, enemySlot),
                evaluate,
                depth: 2,
                topK: 4,
                memo: entry.memo
            });
            evaluatedNodes += result.evaluatedNodes;
            return result.candidates[0]?.value ?? Number.NaN;
        }
    };

    // Couverture par tour scoré : pick réel par seq + sonde « distribution
    // adverse active » (premier nœud du lookahead après le pick réel).
    const resolvedActions = record.actions
        .filter((a) => a.championKey !== '')
        .sort((a, b) => a.seq - b.seq);
    const realKeyAt = new Map<number, string>();
    for (const action of resolvedActions) {
        if (action.type === 'pick' && !realKeyAt.has(action.seq)) {
            realKeyAt.set(action.seq, action.championKey);
        }
    }
    const adverseActiveAt = (seq: number, side: DraftSide): boolean => {
        const actions = resolvedActions.filter((a) => a.seq <= seq);
        const used = new Set<string>(actions.map((a) => a.championKey));
        const available = new Set<string>();
        for (const key of universe) {
            if (!used.has(key)) available.add(key);
        }
        const state: DraftState = { actions, firstPickSide: record.firstPickSide, available };
        const slot = nextSlotOf(state);
        if (slot === null || slot.side === side) return false;
        const entry = turnEntries.get(seq);
        if (entry === undefined) return false;
        return enemyDistributionOf(entry.ctx, state, slot).length > 0;
    };

    return {
        modelDeps,
        availableOf,
        candidatesOf,
        universe,
        get evaluatedNodes(): number {
            return evaluatedNodes;
        },
        turnEntryOf,
        ctOf: (seq: number): string[] | undefined => turnEntries.get(seq)?.shipped6.slice(0, 4),
        realPickKeyAt: (seq: number): string | undefined => realKeyAt.get(seq),
        adverseActiveAt
    };
}
