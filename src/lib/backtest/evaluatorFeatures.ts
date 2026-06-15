/**
 * Chantier R4 (run #4) — extraction des trois composantes différentielles de
 * l'évaluateur `analyzeDraft`, et standardisation walk-forward (μ, σ de train).
 *
 * `analyzeDraft` est un modèle Elo additif à poids unitaires FIGÉS :
 *   totalRating = (χ_ally − χ_enemy) + (δ_ally − δ_enemy) + μ_matchup + sideOffset
 *   winrate     = ratingToWinrate(totalRating) = σ((ln10/400)·totalRating)
 * (`src/lib/engine/analyzer.ts:272-287`). R4 LIT les trois sous-totaux exposés
 * par `DraftResult` pour les re-pondérer — `analyzer.ts` n'est JAMAIS modifié.
 * Avec `ally = blue` (la cible est `won = winner === 'blue'`) et aucun
 * `sideContext` (sideOffset = 0) : x₁ + x₂ + x₃ = totalRating, donc le modèle
 * shippé est le cas particulier β₀ = 0, β₁ = β₂ = β₃ = ln10/400.
 */
import type { AnalyzeDraftConfig, Dataset } from '$lib/types';
import type { DraftRecord } from '$lib/data/types';
import { analyzeDraft } from '$lib/engine/analyzer';
import { roleTeamsAt } from './sequencePositions';

/** Les trois features différentielles, blue − red. */
export interface EvalFeatures {
    /** Différentiel des ratings champions solo (ally − enemy). */
    x1: number;
    /** Différentiel des deltas de synergie de duo (ally − enemy). */
    x2: number;
    /** Différentiel de matchup (déjà ally-vs-enemy, ajouté une seule fois). */
    x3: number;
}

/** Config gelée E3/R4 du prédicteur brut (verbatim winCalibrationByLeague). */
const ANALYZE_CONFIG: AnalyzeDraftConfig = {
    ignoreChampionWinrates: false,
    riskLevel: 'medium',
    minGames: 0
};

/**
 * Trois features au préfixe seq ≤ maxSeq. `ally = blue`, `enemy = red`. Renvoie
 * undefined ssi le préfixe n'est pas scorable (`roleTeamsAt` undefined — clé
 * vide, rôle manquant ou rôle dupliqué) : record écarté, jamais deviné. À
 * `afterBans` (0 pick) les équipes sont vides ⇒ x₁ = x₂ = x₃ = 0.
 */
export function evaluatorFeaturesAt(
    record: DraftRecord,
    maxSeq: number,
    ds: { dataset: Dataset; fullDataset: Dataset }
): EvalFeatures | undefined {
    const teams = roleTeamsAt(record, maxSeq);
    if (teams === undefined) return undefined;
    const r = analyzeDraft(ds.dataset, teams.blue, teams.red, ANALYZE_CONFIG, ds.fullDataset);
    return {
        x1: r.allyChampionRating.totalRating - r.enemyChampionRating.totalRating,
        x2: r.allyDuoRating.totalRating - r.enemyDuoRating.totalRating,
        x3: r.matchupRating.totalRating
    };
}

/** Tuple ordonné [x₁, x₂, x₃] — l'ordre des colonnes du design R4. */
export function featuresTuple(f: EvalFeatures): number[] {
    return [f.x1, f.x2, f.x3];
}

/**
 * Standardiseur gelé (amendement R8) : μⱼ, σⱼ (écart-type de POPULATION,
 * diviseur n) du TRAIN ; `kept[j] = σⱼ > 1e-9`. Une colonne sous le seuil est
 * EXCLUE (retirée du design), jamais mise à 0 — un seul mécanisme.
 */
export interface Standardizer {
    mu: number[];
    sd: number[];
    kept: boolean[];
}

const SD_FLOOR = 1e-9;

export function standardizeFit(rows: number[][]): Standardizer {
    const k = rows.length > 0 ? rows[0].length : 0;
    const mu = new Array<number>(k).fill(0);
    const sd = new Array<number>(k).fill(0);
    const kept = new Array<boolean>(k).fill(false);
    if (rows.length === 0) return { mu, sd, kept };
    for (const row of rows) {
        for (let j = 0; j < k; j++) mu[j] += row[j];
    }
    for (let j = 0; j < k; j++) mu[j] /= rows.length;
    for (const row of rows) {
        for (let j = 0; j < k; j++) {
            const d = row[j] - mu[j];
            sd[j] += d * d;
        }
    }
    for (let j = 0; j < k; j++) {
        sd[j] = Math.sqrt(sd[j] / rows.length);
        kept[j] = sd[j] > SD_FLOOR;
    }
    return { mu, sd, kept };
}

/**
 * Standardise un vecteur, ne renvoyant QUE les colonnes retenues
 * ((xⱼ − μⱼ)/σⱼ pour `kept[j]`). L'ordre des colonnes retenues est préservé ;
 * c'est l'entrée `x` de `logisticFit`/`logisticPredict`.
 */
export function standardizeApply(s: Standardizer, x: number[]): number[] {
    const out: number[] = [];
    for (let j = 0; j < x.length; j++) {
        if (s.kept[j]) out.push((x[j] - s.mu[j]) / s.sd[j]);
    }
    return out;
}
