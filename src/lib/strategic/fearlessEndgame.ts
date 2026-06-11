/**
 * Chantier F (F-d) — L'AU-DELÀ : le solveur de fin de série Fearless
 * (docs/run2/F-pocket-picks.md §2 F-d, bornes honnêtes GELÉES).
 *
 * L'analogie des tablebases d'échecs : en toute fin de draft G4/G5 l'espace
 * rétrécit assez pour une recherche EXHAUSTIVE. Bornes gelées :
 *  - candidats par slot = top-`surpriseK` (= 8, config commitée
 *    `rangeModelConfig.ts` — jamais une constante locale) de la range I1
 *    injectée pour les slots ADVERSES ∪ top-`surpriseK` demande/présence
 *    injectés pour les NÔTRES, filtrés disponibilité ;
 *  - **espace exact calculé AVANT toute recherche** :
 *    `spaceSize = Π_{slots restants} |C_s|` sur les candidats du nœud RACINE ;
 *  - bascule exhaustive ssi `spaceSize ≤ 1e6` (sinon `searched: false` — le
 *    depth-2 shippé du panneau reste inchangé chez l'appelant) ;
 *  - recherche = expectimax de la doctrine (§6.6 : l'adversaire est sa
 *    distribution prévue, pas un minimax paranoïaque), PROFONDEUR = tous les
 *    slots restants — RÉUTILISE `navigate` (`$lib/strategic/draftNavigator`)
 *    et son type `DraftEvaluator` : rien de la recherche n'est recodé ;
 *  - memo par état (clé navigator = révélés triés + seq + profondeur),
 *    injectable et partageable entre décisions ;
 *  - `elapsedMs` mesuré par HORLOGE INJECTÉE (cible déclarée < 2 s par
 *    décision, mesurée et publiée — jamais une horloge système cachée).
 *
 * Ship Expérimental (DA-V2-11) dans tous les cas de F4 sauf hi < 0
 * (exhaustif PIRE ⇒ F-d non branché, spec §3.4).
 *
 * Module pur : zéro I/O ; horloge, seams et évaluateur injectés.
 */
import { DRAFT_TEMPLATE, picksOf } from '$lib/data/draftRecord';
import type { DraftSide } from '$lib/data/types';
import {
    navigate,
    nextSlotOf,
    type DraftEvaluator,
    type DraftState,
    type EnemyDistributionEntry,
    type NavigatorMemoEntry,
    type NavigatorSlot
} from '$lib/strategic/draftNavigator';
import { DEFAULT_RANGE_MODEL_CONFIG, type RangeModelConfig } from '$lib/strategic/rangeModelConfig';

/** Borne gelée de la bascule exhaustive : espace ≤ 10⁶ nœuds. */
export const ENDGAME_SPACE_MAX = 1e6;

export interface FearlessEndgameContext {
    ourSide: DraftSide;
    /** SEAM demande/présence : nos candidats pour un slot (état courant). */
    ourCandidatesForSlot: (state: DraftState, slot: NavigatorSlot) => string[];
    /** SEAM range I1 : la distribution adverse pour un slot (état courant). */
    enemyRangeForSlot: (state: DraftState, slot: NavigatorSlot) => EnemyDistributionEntry[];
    /** Évaluateur de feuille — le type RÉUTILISÉ du navigator. */
    evaluate: DraftEvaluator;
    /** Config commitée — seule source de surpriseK (= 8). */
    config?: RangeModelConfig;
    /** Memo par état, injectable (clé navigator : révélés triés + seq). */
    memo?: Map<string, NavigatorMemoEntry>;
    /** Horloge INJECTÉE (ms) ; défaut performance.now — mesurée, publiée. */
    now?: () => number;
}

export interface FearlessEndgameResult {
    /** true ssi spaceSize ≤ 1e6 et la recherche exhaustive a tourné. */
    searched: boolean;
    /** Π_{slots restants} |C_s| — calculé AVANT toute recherche. */
    spaceSize: number;
    /** Ligne principale ('type:championKey' par pli) ; [] si non basculé. */
    bestLine: string[];
    /** Valeur expectimax de la racine ; NaN si non basculé. */
    value: number;
    /** Durée mesurée par l'horloge injectée. */
    elapsedMs: number;
}

/** Slots template restants (seq > max seq joué), side résolu. */
function remainingSlotsOf(state: DraftState): NavigatorSlot[] {
    let lastSeq = 0;
    for (const action of state.actions) {
        if (action.seq > lastSeq) lastSeq = action.seq;
    }
    const firstIsBlue = state.firstPickSide === 'blue';
    return DRAFT_TEMPLATE.filter((slot) => slot.seq > lastSeq).map((slot) => ({
        seq: slot.seq,
        phase: slot.phase,
        type: slot.type,
        side: slot.first === firstIsBlue ? 'blue' : 'red'
    }));
}

/** |C_s| à la racine : filtre disponibilité puis troncature top-surpriseK —
 *  EXACTEMENT la troncature que `navigate` appliquera (topK = surpriseK). */
function rootCandidateCount(
    state: DraftState,
    slot: NavigatorSlot,
    ctx: FearlessEndgameContext,
    surpriseK: number
): number {
    if (slot.side === ctx.ourSide) {
        return ctx
            .ourCandidatesForSlot(state, slot)
            .filter((key) => state.available.has(key))
            .slice(0, surpriseK).length;
    }
    return ctx
        .enemyRangeForSlot(state, slot)
        .filter((entry) => state.available.has(entry.championKey))
        .sort((a, b) => b.p - a.p)
        .slice(0, surpriseK).length;
}

const realPicks = (state: DraftState, side: DraftSide): string[] =>
    picksOf(state.actions, side)
        .map((a) => a.championKey)
        .filter((key) => key !== '');

/**
 * Le solveur : espace exact d'abord, bascule ssi ≤ 1e6, puis expectimax
 * exhaustif via `navigate` (depth = slots restants, topK = surpriseK, memo
 * partagé). Racine à nous ⇒ valeur du meilleur candidat ; racine adverse ⇒
 * espérance sur leur range renormalisée (ligne = branche la plus probable,
 * convention navigator). Draft complète ⇒ feuille évaluée directement.
 */
export function searchFearlessEndgame(
    state: DraftState,
    ctx: FearlessEndgameContext
): FearlessEndgameResult {
    const now = ctx.now ?? ((): number => performance.now());
    const start = now();
    const config = ctx.config ?? DEFAULT_RANGE_MODEL_CONFIG;
    const surpriseK = config.surpriseK;

    // 1. Espace exact AVANT toute recherche : Π |C_s| sur l'état racine.
    const remaining = remainingSlotsOf(state);
    let spaceSize = 1;
    for (const slot of remaining) {
        spaceSize *= rootCandidateCount(state, slot, ctx, surpriseK);
    }

    // 2. Pas de bascule : le depth-2 shippé reste inchangé chez l'appelant.
    if (spaceSize > ENDGAME_SPACE_MAX) {
        return { searched: false, spaceSize, bestLine: [], value: NaN, elapsedMs: now() - start };
    }

    // 3. Draft complète : feuille évaluée, aucune recherche nécessaire.
    if (remaining.length === 0 || nextSlotOf(state) === null) {
        const value = ctx.evaluate(
            realPicks(state, ctx.ourSide),
            realPicks(state, ctx.ourSide === 'blue' ? 'red' : 'blue')
        );
        return { searched: true, spaceSize, bestLine: [], value, elapsedMs: now() - start };
    }

    // 4. Recherche exhaustive : navigate, profondeur = TOUS les slots restants.
    const result = navigate(state, {
        ourSide: ctx.ourSide,
        ourCandidates: (s) => {
            const slot = nextSlotOf(s);
            return slot === null ? [] : ctx.ourCandidatesForSlot(s, slot);
        },
        enemyDistribution: (s, slot) => ctx.enemyRangeForSlot(s, slot),
        evaluate: ctx.evaluate,
        depth: remaining.length,
        topK: surpriseK,
        ...(ctx.memo !== undefined ? { memo: ctx.memo } : {})
    });

    if (result.candidates.length === 0) {
        // Slots restants tous dégénérés : la position vaut sa feuille.
        const value = ctx.evaluate(
            realPicks(state, ctx.ourSide),
            realPicks(state, ctx.ourSide === 'blue' ? 'red' : 'blue')
        );
        return { searched: true, spaceSize, bestLine: [], value, elapsedMs: now() - start };
    }

    const root = result.nextSlot;
    if (root !== null && root.side !== ctx.ourSide) {
        // Racine adverse : espérance sur la range renormalisée (p fournis par
        // navigate) ; ligne = branche la plus probable (convention navigator).
        let value = 0;
        for (const candidate of result.candidates) value += (candidate.p ?? 0) * candidate.value;
        return {
            searched: true,
            spaceSize,
            bestLine: result.candidates[0].line,
            value,
            elapsedMs: now() - start
        };
    }

    const best = result.candidates[0];
    return { searched: true, spaceSize, bestLine: best.line, value: best.value, elapsedMs: now() - start };
}
