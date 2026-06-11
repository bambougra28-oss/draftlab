/**
 * Gate COACH (run #2, chantier A) — cœur PUR du re-ranking apparié
 * vainqueur-perdant (docs/run2/A-coach-gate.md §1.3, §2.2).
 *
 * Tout ce qui se calcule à la main vit ici : percentile avec égalités à ½,
 * crédit de game (1 / ½ / 0), construction des états S_t et agrégation par
 * side. Zéro I/O, zéro horloge : l'évaluateur (`valueOf`), la chaîne de
 * candidats shippée (`candidatesOf`) et la disponibilité (`availableOf`) sont
 * des seams injectés — le script `scripts/backtest/coachGate.ts` les branche
 * sur `navigate` racine-forcée / `rankOurCandidates` / univers − lockouts ;
 * les tests sur des tables posées.
 *
 * Règle gelée appliquée à la lettre (§1.2-1.3) :
 *  - game éligible (côté lib) : vainqueur connu, 10 picks résolus sur les
 *    seqs template (7-12, 17-20) — patch plaçable et fold non vide sont
 *    vérifiés par l'appelant AVANT (cause `no-fold`) ;
 *  - tour scoré : S_t = actions réelles résolues de seq < t (tri seq),
 *    `firstPickSide` du record ; le slot dérivé (`nextSlotOf`) doit coïncider
 *    (seq, type pick, side) avec l'action réelle sinon `template-mismatch` ;
 *    comparateurs |C_t \ {réel}| ≥ 2 sinon `too-few-comparators` ;
 *  - disponibilité du tour : `availableOf(révélés)` minus révélés (soustraits
 *    ici aussi, idempotent) ∪ {pick réel} — le réel a été joué, toute
 *    collision (lockout/univers) est comptée dans `anomalies` ;
 *  - game scorée : chaque side garde ≥ 4 de ses 5 tours ; crédit = 1 si
 *    R(vainqueur) > R(perdant), ½ si égalité exacte, 0 sinon.
 *
 * Le retour porte, EN PLUS du contrat §2.2, les tours écartés par cause et le
 * compte d'anomalies : la table de Couverture (§1.6) les publie PAR CORPUS —
 * champs additifs, les membres documentés (`score` / `skipped`) sont
 * inchangés.
 */
import { DRAFT_TEMPLATE } from '$lib/data/draftRecord';
import type { DraftAction, DraftRecord, DraftSide } from '$lib/data/types';
import { nextSlotOf, type DraftState, type NavigatorSlot } from '$lib/strategic/draftNavigator';

/** Les 10 seqs de pick du template tournoi (7-12, 17-20), dans l'ordre. */
const TEMPLATE_PICK_SEQS: readonly number[] = DRAFT_TEMPLATE.filter((s) => s.type === 'pick').map(
    (s) => s.seq
);

/**
 * Percentile de `value` parmi `comparators` (égalités à ½). [0,1].
 * ρ = (#{v > c} + 0,5·#{v = c}) / n — égalité FLOTTANTE EXACTE (===),
 * approximation déclarée en §1.3. NaN sur comparators vide (jamais atteint
 * par `scoreGameForGate`, qui exige ≥ 2 comparateurs).
 */
export function percentileAmong(value: number, comparators: number[]): number {
    if (comparators.length === 0) return NaN;
    let above = 0;
    let ties = 0;
    for (const c of comparators) {
        if (value > c) above += 1;
        else if (value === c) ties += 1;
    }
    return (above + 0.5 * ties) / comparators.length;
}

/** 1 si winnerMean > loserMean, 0,5 si égalité exacte, 0 sinon. */
export function creditOf(winnerMean: number, loserMean: number): 0 | 0.5 | 1 {
    if (winnerMean > loserMean) return 1;
    if (winnerMean === loserMean) return 0.5;
    return 0;
}

export interface CoachTurnScore {
    seq: number;
    side: DraftSide;
    /** ρ_t du pick réel. */
    percentile: number;
    /** Le pick réel est l'argmax de C_t (secondaire S1) — égalité au max comprise. */
    top1Agree: boolean;
    /** v(argmax C_t) − v(réel), en probabilité (secondaire S2). */
    regret: number;
    comparators: number;
}

export interface CoachGameScore {
    gameId: string;
    credit: 0 | 0.5 | 1;
    winnerMean: number;
    loserMean: number;
    turns: CoachTurnScore[];
}

export type SkipReason =
    | 'no-winner'
    | 'unresolved-picks'
    | 'no-fold'
    | 'template-mismatch'
    | 'too-few-comparators'
    | 'side-coverage';

/** Un tour écarté, avec sa cause — publié PAR CORPUS dans la Couverture (§1.6). */
export interface DiscardedTurn {
    seq: number;
    side: DraftSide;
    reason: Extract<SkipReason, 'template-mismatch' | 'too-few-comparators'>;
}

/** Seam : valeur expectimax d'un candidat à un état (le script l'implémente
 *  par navigate en racine forcée ; les tests par une table à la main). */
export type CandidateValueFn = (state: DraftState, slot: NavigatorSlot, championKey: string) => number;

export interface ScoreGameDeps {
    valueOf: CandidateValueFn;
    /** C_t : les candidats que le panneau shippé classerait à cet état (le
     *  script l'implémente par `rankOurCandidates` importé de `liveDraft.ts` ;
     *  les tests par une liste posée). Appelée AVANT `valueOf` à chaque tour. */
    candidatesOf: (state: DraftState, slot: NavigatorSlot) => string[];
    /** Univers − lockouts Fearless de la game (révélés gérés en interne). */
    availableOf: (revealed: Set<string>) => Set<string>;
}

export type ScoreGameResult =
    | { score: CoachGameScore; discarded: DiscardedTurn[]; anomalies: number }
    | { skipped: SkipReason; discarded: DiscardedTurn[]; anomalies: number };

/**
 * Scoring d'une game : tours → sides → crédit. Pure, déterministe — mêmes
 * (record, candidatesOf, availableOf) ⇒ mêmes tours scorés, quel que soit
 * `valueOf` : les baselines B1/B2 rejouent EXACTEMENT les mêmes tours et les
 * mêmes C_t que le coach (§1.4), seules les valeurs changent.
 */
export function scoreGameForGate(record: DraftRecord, deps: ScoreGameDeps): ScoreGameResult {
    const discarded: DiscardedTurn[] = [];
    let anomalies = 0;

    // Éligibilité côté lib, dans l'ordre de la règle : vainqueur, 10 picks.
    if (record.winner === undefined) return { skipped: 'no-winner', discarded, anomalies };

    const bySeq = new Map<number, DraftAction>();
    for (const action of record.actions) {
        if (!bySeq.has(action.seq)) bySeq.set(action.seq, action);
    }
    const resolvedPickAt = (seq: number): DraftAction | undefined => {
        const action = bySeq.get(seq);
        return action !== undefined && action.type === 'pick' && action.championKey !== ''
            ? action
            : undefined;
    };
    for (const seq of TEMPLATE_PICK_SEQS) {
        if (resolvedPickAt(seq) === undefined) return { skipped: 'unresolved-picks', discarded, anomalies };
    }

    // Actions réelles RÉSOLUES, triées par seq — la matière des états S_t.
    const resolvedActions = record.actions
        .filter((a) => a.championKey !== '')
        .sort((a, b) => a.seq - b.seq);

    const turns: CoachTurnScore[] = [];
    for (const seq of TEMPLATE_PICK_SEQS) {
        const real = resolvedPickAt(seq)!;
        const prior = resolvedActions.filter((a) => a.seq < seq);
        const revealed = new Set<string>(prior.map((a) => a.championKey));

        // Disponibilité = (univers − lockouts) − révélés ∪ {pick réel}. Les
        // révélés sont re-soustraits ici (idempotent si l'impl l'a déjà fait).
        const available = new Set<string>(deps.availableOf(revealed));
        for (const key of revealed) available.delete(key);
        if (!available.has(real.championKey)) {
            // Le pick réel a été joué : son absence (collision lockout /
            // univers troué) est une anomalie comptée, jamais un crash.
            anomalies += 1;
            available.add(real.championKey);
        }

        const state: DraftState = { actions: prior, firstPickSide: record.firstPickSide, available };
        const slot = nextSlotOf(state);
        if (slot === null || slot.seq !== seq || slot.type !== 'pick' || slot.side !== real.side) {
            discarded.push({ seq, side: real.side, reason: 'template-mismatch' });
            continue;
        }

        const candidates = deps.candidatesOf(state, slot);
        const comparatorKeys = candidates.filter((key) => key !== real.championKey);
        if (comparatorKeys.length < 2) {
            discarded.push({ seq, side: real.side, reason: 'too-few-comparators' });
            continue;
        }

        // v(x) pour x ∈ C_t ∪ {réel} — le réel est évalué par exactement le
        // même chemin (une seule fois, même s'il appartient à C_t).
        const realValue = deps.valueOf(state, slot, real.championKey);
        const candidateValues = candidates.map((key) =>
            key === real.championKey ? realValue : deps.valueOf(state, slot, key)
        );
        const comparatorValues: number[] = [];
        for (let i = 0; i < candidates.length; i++) {
            if (candidates[i] !== real.championKey) comparatorValues.push(candidateValues[i]);
        }
        const bestOfCt = Math.max(...candidateValues);

        turns.push({
            seq,
            side: real.side,
            percentile: percentileAmong(realValue, comparatorValues),
            top1Agree: candidates.includes(real.championKey) && realValue >= bestOfCt,
            regret: bestOfCt - realValue,
            comparators: comparatorValues.length
        });
    }

    // Game scorée : chaque side garde ≥ 4 de ses 5 tours.
    const turnsOf = (side: DraftSide): CoachTurnScore[] => turns.filter((t) => t.side === side);
    if (turnsOf('blue').length < 4 || turnsOf('red').length < 4) {
        return { skipped: 'side-coverage', discarded, anomalies };
    }

    const mean = (xs: number[]): number => xs.reduce((sum, x) => sum + x, 0) / xs.length;
    const winner = record.winner;
    const loser: DraftSide = winner === 'blue' ? 'red' : 'blue';
    const winnerMean = mean(turnsOf(winner).map((t) => t.percentile));
    const loserMean = mean(turnsOf(loser).map((t) => t.percentile));

    return {
        score: {
            gameId: record.gameId,
            credit: creditOf(winnerMean, loserMean),
            winnerMean,
            loserMean,
            turns
        },
        discarded,
        anomalies
    };
}
