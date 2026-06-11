/**
 * Ban-attraction estimator — counterfactual demand revealed by SUFFERED bans
 * (design run #2, chantier B : docs/run2/B-ban-history.md §1.1/§2.1).
 *
 * The repertoire regime of banEV reads takeProbability on PICK tendencies; a
 * champion perma-banned against a team never appears in its picks, so its
 * tendency evidence is structurally censored by the bans themselves. The
 * direct evidence of that censored demand exists in the corpus: the bans the
 * team SUFFERS. If T's opponents spend a ban on a champion 8 games out of 10,
 * that is the market's revealed belief that T would take it — exactly the
 * quantity picks cannot show.
 *
 * Estimator (frozen rule, walk-forward fit assiette decided by the caller):
 *   games_T        = records of the fit where team T appears (informative
 *                    zeros included — a record where only T banned still
 *                    counts as zero suffered for T);
 *   suffered_T(c)  = records where T plays AND the side OPPOSITE to T has a
 *                    resolved ban on c (at most 1 per game, deduplicated);
 *   μ_c            = (bannedGames(c) + 0.5) / (2·N + 1)   — league prior,
 *                    add-half smoothing over the 2·N team-game units (each
 *                    ban is suffered by exactly one team);
 *   banAttraction(c | T) = (suffered_T(c) + priorN·μ_c) / (games_T + priorN)
 *                    — closed-form Beta posterior mean (EB shrinkage,
 *                    pre-registered priorN = 10). Unknown team ⇒ μ_c
 *                    (league-prior fallback, cascade DA-V2-4); empty fit ⇒ 0.
 *
 * The posterior is closed-form on purpose: no `shrinkWinrate`, whose
 * betaQuantile bisection (×100 per quantile, two quantiles per call) would be
 * wasted in a 30-candidates × ~600-events × folds loop. No dependency on
 * `presence.ts` either — the two tallies here (bannedGames per GAME, suffered
 * per TEAM) do not exist in computePresence, which counts actions, not games.
 *
 * Like every estimator here: pure, no tags, no clock, no I/O.
 */
import type { DraftRecord, DraftSide } from '$lib/data/types';

/** Évidence de demande contrefactuelle : les bans SUBIS par une équipe. */
export interface TeamSufferedBans {
    /** Records du fit où l'équipe apparaît (zéros informatifs inclus). */
    games: number;
    /** championKey → nombre de games où l'adversaire l'a banni (≤ 1 par game). */
    suffered: Map<string, number>;
}

export interface BanAttractionFit {
    byTeam: Map<string, TeamSufferedBans>;
    /** championKey → games (l'un ou l'autre side) où il fut banni. */
    bannedGames: Map<string, number>;
    /** Nombre total de records du fit. */
    games: number;
    priorN: number;
}

/** Pre-registered EB strength: low end of the doctrine band N₀ ≈ 10-50
 *  (ARCHITECTURE_V2 §6.2) — teams only have ~5-40 games per fold, at 50 a
 *  real perma-ban (8/10) would be crushed under the prior. */
export const DEFAULT_BAN_ATTRACTION_PRIOR_N = 10;

export interface FitBanAttractionOptions {
    /** Pseudo-games EB vers la moyenne ligue (pré-enregistré : 10). */
    priorN?: number;
}

/**
 * Fit the suffered-ban tallies on the given records. The caller owns the fit
 * assiette (walk-forward: the train's unique records — the same base the
 * tendency tables and presence are fitted on); this function reads the
 * records as given and never filters them.
 */
export function fitBanAttraction(
    records: DraftRecord[],
    options: FitBanAttractionOptions = {}
): BanAttractionFit {
    const priorN = options.priorN ?? DEFAULT_BAN_ATTRACTION_PRIOR_N;
    const byTeam = new Map<string, TeamSufferedBans>();
    const bannedGames = new Map<string, number>();

    const teamEntry = (team: string): TeamSufferedBans => {
        let entry = byTeam.get(team);
        if (entry === undefined) {
            entry = { games: 0, suffered: new Map() };
            byTeam.set(team, entry);
        }
        return entry;
    };

    for (const record of records) {
        // bannedGames: at most one count per game per champion, either side.
        const bannedThisGame = new Set<string>();
        // suffered: resolved bans of each side, deduplicated per (game, champion).
        const bansBySide: Record<DraftSide, Set<string>> = { blue: new Set(), red: new Set() };
        for (const action of record.actions) {
            if (action.type !== 'ban' || action.championKey === '') continue;
            bannedThisGame.add(action.championKey);
            bansBySide[action.side].add(action.championKey);
        }
        for (const key of bannedThisGame) {
            bannedGames.set(key, (bannedGames.get(key) ?? 0) + 1);
        }

        // A team playing against itself (corrupted data, blueTeam === redTeam)
        // is counted on the blue side only — determinism; theoretical case.
        const sides: readonly DraftSide[] = record.blueTeam === record.redTeam ? ['blue'] : ['blue', 'red'];
        for (const side of sides) {
            const team = side === 'blue' ? record.blueTeam : record.redTeam;
            const entry = teamEntry(team);
            entry.games += 1;
            const oppositeBans = bansBySide[side === 'blue' ? 'red' : 'blue'];
            for (const key of oppositeBans) {
                entry.suffered.set(key, (entry.suffered.get(key) ?? 0) + 1);
            }
        }
    }

    return { byTeam, bannedGames, games: records.length, priorN };
}

/** Prior ligue : P(l'adversaire d'une équipe quelconque bannit c), add-half. */
export function leagueBanAttraction(fit: BanAttractionFit, championKey: string): number {
    return ((fit.bannedGames.get(championKey) ?? 0) + 0.5) / (2 * fit.games + 1);
}

/**
 * Taux de ban subi EB-shrunk de `team` pour `championKey` — la demande révélée.
 * Posterior Beta en forme fermée : (suffered + priorN·μ) / (games_T + priorN).
 * Équipe inconnue ⇒ μ (prior ligue) ; fit vide (games = 0) ⇒ 0.
 */
export function banAttractionRate(
    fit: BanAttractionFit,
    team: string,
    championKey: string
): number {
    if (fit.games === 0) return 0;
    const mu = leagueBanAttraction(fit, championKey);
    const entry = fit.byTeam.get(team);
    if (entry === undefined) return mu;
    const suffered = entry.suffered.get(championKey) ?? 0;
    return (suffered + fit.priorN * mu) / (entry.games + fit.priorN);
}
