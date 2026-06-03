/**
 * M1 draft analyzer — DraftGap-equivalent Bayesian winrate model.
 *
 * Three additive passes (see ATTRIBUTION.md, reimplemented in TS):
 *   1. solo champion ratings (sample = current patch, prior target = 30-day);
 *   2. pairwise duo deltas vs the duo's expected rating;
 *   3. ally-vs-enemy matchup deltas vs the matchup's expected rating.
 *
 * Two-dataset signature (M1_VALIDATION.md): `dataset` is the current-patch
 * sample, `fullDataset` (30-day) supplies the longer-term prior target and all
 * pair-level data. `fullDataset` defaults to `dataset` for the single-dataset
 * unit fixtures.
 */
import type {
    AnalyzeDraftConfig,
    Dataset,
    PlayerContext,
    PlayerSlotContext,
    ProAnalysisParams,
    Role,
    SideContext,
    TeamSideRecord,
    Team
} from '$lib/types';
import { PRIOR_GAMES_BY_RISK } from '$lib/types';
import { ratingToWinrate, winrateToRating } from './ratings';
import { averageStats, winrateOf, withPrior } from './bayesian';
import { getStats } from './getStats';

export interface AnalyzeChampionResult {
    role: Role;
    championKey: string;
    rating: number;
    wins: number;
    games: number;
}

export interface AnalyzeChampionsResult {
    championResults: AnalyzeChampionResult[];
    totalRating: number;
}

export interface AnalyzeDuoResult {
    roleA: Role;
    championKeyA: string;
    roleB: Role;
    championKeyB: string;
    rating: number;
    wins: number;
    games: number;
}

export interface AnalyzeDuosResult {
    duoResults: AnalyzeDuoResult[];
    totalRating: number;
}

export interface AnalyzeMatchupResult {
    roleA: Role;
    championKeyA: string;
    roleB: Role;
    championKeyB: string;
    rating: number;
    wins: number;
    games: number;
}

export interface AnalyzeMatchupsResult {
    matchupResults: AnalyzeMatchupResult[];
    totalRating: number;
}

export interface DraftResult {
    allyChampionRating: AnalyzeChampionsResult;
    enemyChampionRating: AnalyzeChampionsResult;
    allyDuoRating: AnalyzeDuosResult;
    enemyDuoRating: AnalyzeDuosResult;
    matchupRating: AnalyzeMatchupsResult;
    totalRating: number;
    winrate: number;
}

const EMPTY_CHAMPIONS: AnalyzeChampionsResult = { championResults: [], totalRating: 0 };

/**
 * Solo rating for one champion-role. Sample comes from `dataset` (current
 * patch); the prior is pulled toward the champion's 30-day winrate in
 * `fullDataset`, so thin patch samples are damped toward longer-term reality.
 */
export function analyzeChampion(
    dataset: Dataset,
    fullDataset: Dataset,
    role: Role,
    championKey: string,
    priorGames: number,
    slot?: PlayerSlotContext,
    proParams?: ProAnalysisParams
): AnalyzeChampionResult {
    const roleData = dataset.championData[championKey]?.statsByRole[role];
    const sample = roleData ? { wins: roleData.wins, games: roleData.games } : { wins: 0, games: 0 };

    const fullRoleData = fullDataset.championData[championKey]?.statsByRole[role];
    const baselineWinrate = winrateOf(fullRoleData ?? { wins: 0, games: 0 });
    // M2: blend the baseline toward the assigned player's comfort, if provided.
    const priorWinrate = slot ? blendedPriorWinrate(baselineWinrate, slot, proParams) : baselineWinrate;

    const stats = withPrior(sample, priorGames, priorWinrate);
    const rating = winrateToRating(stats.wins / stats.games);

    return { role, championKey, rating, wins: sample.wins, games: sample.games };
}

export function analyzeChampions(
    dataset: Dataset,
    fullDataset: Dataset,
    team: Team,
    priorGames: number,
    playerContext?: PlayerContext,
    proParams?: ProAnalysisParams
): AnalyzeChampionsResult {
    const championResults: AnalyzeChampionResult[] = [];
    let totalRating = 0;

    for (const [role, championKey] of team) {
        const result = analyzeChampion(
            dataset,
            fullDataset,
            role,
            championKey,
            priorGames,
            playerContext?.[role],
            proParams
        );
        championResults.push(result);
        totalRating += result.rating;
    }

    return { championResults, totalRating };
}

/**
 * Duo deltas. For each unordered pair we compute an *expected* combined rating
 * (the sum of the two solo ratings), then measure how the observed pair winrate
 * deviates from it. The delta — not the absolute winrate — is what feeds the
 * total, so duos only move the needle when they over/under-perform expectation.
 */
export function analyzeDuos(dataset: Dataset, team: Team, priorGames: number): AnalyzeDuosResult {
    const entries = Array.from(team.entries()).sort((a, b) => a[0] - b[0]);
    const duoResults: AnalyzeDuoResult[] = [];
    let totalRating = 0;

    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const [roleA, championKeyA] = entries[i];
            const [roleB, championKeyB] = entries[j];

            const soloA = getStats(dataset, championKeyA, roleA);
            const soloB = getStats(dataset, championKeyB, roleB);
            const expectedRating = winrateToRating(winrateOf(soloA)) + winrateToRating(winrateOf(soloB));
            const expectedWinrate = ratingToWinrate(expectedRating);

            const duoA = getStats(dataset, championKeyA, roleA, 'duo', roleB, championKeyB);
            const duoB = getStats(dataset, championKeyB, roleB, 'duo', roleA, championKeyA);
            const combined = averageStats(duoA, duoB);

            const adjusted = withPrior(combined, priorGames, expectedWinrate);
            const rating = winrateToRating(adjusted.wins / adjusted.games) - expectedRating;

            duoResults.push({
                roleA,
                championKeyA,
                roleB,
                championKeyB,
                rating,
                wins:
                    combined.games === 0
                        ? 0
                        : ratingToWinrate(winrateToRating(winrateOf(combined)) - expectedRating) *
                          combined.games,
                games: combined.games
            });
            totalRating += rating;
        }
    }

    return { duoResults, totalRating };
}

/**
 * Matchup deltas. Each ally champion is compared against each enemy champion.
 * The two directions of the matchup sample are merged (ally wins + enemy losses)
 * and the result is measured against the expected rating gap of the two solos.
 */
export function analyzeMatchups(
    dataset: Dataset,
    team: Team,
    enemy: Team,
    priorGames: number
): AnalyzeMatchupsResult {
    const matchupResults: AnalyzeMatchupResult[] = [];
    let totalRating = 0;

    for (const [allyRole, allyChampionKey] of team) {
        for (const [enemyRole, enemyChampionKey] of enemy) {
            const soloAlly = getStats(dataset, allyChampionKey, allyRole);
            const soloEnemy = getStats(dataset, enemyChampionKey, enemyRole);
            const expectedRating =
                winrateToRating(winrateOf(soloAlly)) - winrateToRating(winrateOf(soloEnemy));
            const expectedWinrate = ratingToWinrate(expectedRating);

            const matchup = getStats(dataset, allyChampionKey, allyRole, 'matchup', enemyRole, enemyChampionKey);
            const enemyMatchup = getStats(dataset, enemyChampionKey, enemyRole, 'matchup', allyRole, allyChampionKey);
            const enemyLosses = enemyMatchup.games - enemyMatchup.wins;

            const wins = (matchup.wins + enemyLosses) / 2;
            const games = (matchup.games + enemyMatchup.games) / 2;

            const adjusted = withPrior({ wins, games }, priorGames, expectedWinrate);
            const rating = winrateToRating(adjusted.wins / adjusted.games) - expectedRating;

            matchupResults.push({
                roleA: allyRole,
                championKeyA: allyChampionKey,
                roleB: enemyRole,
                championKeyB: enemyChampionKey,
                rating,
                wins:
                    games === 0
                        ? 0
                        : ratingToWinrate(winrateToRating(wins / games) - expectedRating) * games,
                games
            });
            totalRating += rating;
        }
    }

    return { matchupResults, totalRating };
}

/**
 * Full draft analysis. `winrate` is the ally team's projected win probability.
 *
 * @param dataset      current-patch sample (solo champion signal)
 * @param team         ally team (role → champion key)
 * @param enemy        enemy team (role → champion key)
 * @param config       risk level + flags
 * @param fullDataset  30-day dataset for priors + pair data (defaults to `dataset`)
 */
export function analyzeDraft(
    dataset: Dataset,
    team: Team,
    enemy: Team,
    config: AnalyzeDraftConfig,
    fullDataset: Dataset = dataset
): DraftResult {
    const priorGames = PRIOR_GAMES_BY_RISK[config.riskLevel];

    const allyChampionRating = config.ignoreChampionWinrates
        ? EMPTY_CHAMPIONS
        : analyzeChampions(dataset, fullDataset, team, priorGames, config.playerContext, config.proParams);
    const enemyChampionRating = config.ignoreChampionWinrates
        ? EMPTY_CHAMPIONS
        : analyzeChampions(dataset, fullDataset, enemy, priorGames);

    const allyDuoRating = analyzeDuos(fullDataset, team, priorGames);
    const enemyDuoRating = analyzeDuos(fullDataset, enemy, priorGames);
    const matchupRating = analyzeMatchups(fullDataset, team, enemy, priorGames);

    // M2: side-preference offset (0 when no side context is supplied).
    const sideOffset = computeSideOffset(config.sideContext, config.proParams);

    const totalRating =
        allyChampionRating.totalRating +
        allyDuoRating.totalRating +
        matchupRating.totalRating -
        enemyChampionRating.totalRating -
        enemyDuoRating.totalRating +
        sideOffset;

    return {
        allyChampionRating,
        enemyChampionRating,
        allyDuoRating,
        enemyDuoRating,
        matchupRating,
        totalRating,
        winrate: ratingToWinrate(totalRating)
    };
}

/**
 * M2 — blend a champion's baseline winrate toward the assigned player's comfort.
 * comfort/none use full weight, cheese is attenuated, unavailable/no-signal
 * returns the baseline unchanged. Closed-form numbers per M2 Ping 2.
 */
export function blendedPriorWinrate(
    baseline: number,
    slot: PlayerSlotContext | undefined,
    params: ProAnalysisParams = {}
): number {
    if (!slot || !slot.playerStats || slot.comfortMode === 'unavailable') return baseline;
    const { games, winrate } = slot.playerStats;
    if (games === 0) return baseline;

    const attenuation = slot.comfortMode === 'cheese' ? (params.cheeseAttenuationFactor ?? 0.5) : 1;
    const effectiveGames = games * attenuation;
    const priorGames = params.defaultPriorGames ?? 1000;

    return (effectiveGames * winrate + priorGames * baseline) / (effectiveGames + priorGames);
}

/** M2 — a team's side-preference rating offset (Elo of its 0.5-smoothed side WR). */
export function teamSideOffset(
    record: TeamSideRecord,
    side: 'blue' | 'red',
    params: ProAnalysisParams = {}
): number {
    const sidePriorGames = params.sidePriorGames ?? 50;
    const smoothed = withPrior({ wins: record[side].wins, games: record[side].games }, sidePriorGames, 0.5);
    return winrateToRating(smoothed.wins / smoothed.games);
}

/** M2 — net side offset (ally − enemy); 0 when no side context is provided. */
export function computeSideOffset(sideContext: SideContext | undefined, params?: ProAnalysisParams): number {
    if (!sideContext) return 0;
    return (
        teamSideOffset(sideContext.ally.record, sideContext.ally.side, params) -
        teamSideOffset(sideContext.enemy.record, sideContext.enemy.side, params)
    );
}
