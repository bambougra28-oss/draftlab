/**
 * Chantier « génération automatique de la prépa » — self-play de la draft
 * complète pour PROPOSER un DraftPlan (bans + picks primaire/fallback +
 * raisons FR) que l'humain CURE ensuite — workflow échecs : le moteur
 * propose, le joueur dispose. La page /plans/[id] remplit le plan ÉDITABLE
 * avec cette sortie, l'utilisateur retouche, puis l'arbre se recompile.
 *
 * Pur, seams injectés (couplage par type de fonction, jamais d'import du
 * modèle) : répondeur à NOS tours (navigate côté page), distribution adverse
 * à LEURS tours (predict — le MÊME seam que compilePlanTree), priors de rôle
 * et pool. Aucune I/O, aucune horloge, aucun aléa : mêmes seams, même plan.
 *
 * Déroulé : les 20 slots du template en convention bleu-premier (même ancre
 * que compilePlanTree). À NOS tours, le 1ᵉʳ candidat du répondeur devient le
 * primaire, le 2ᵉ le fallback (PICKS uniquement — un ban n'a pas de repli) ;
 * à LEURS tours, l'argmax de leur distribution est joué (la ligne principale
 * du modèle, pas une vérité).
 *
 * Honnêteté : un seam muet (aucun candidat à nous, distribution adverse
 * vide) laisse un TROU explicite (null) — jamais une invention ; `holes`
 * compte nos tours vides, `enemySkips` leurs tours sautés.
 *
 * Mapping picks → rôles : chaque pick généré (dans l'ordre de la draft)
 * prend son rôle LE PLUS PROBABLE selon les priors injectés ; collision →
 * le pick SUIVANT prend son rôle suivant le plus probable (départage
 * déterministe : index de rôle croissant). Champion inconnu des priors ⇒
 * uniforme honnête : premier rôle encore libre dans l'ordre canonique.
 */
import { DRAFT_TEMPLATE } from '$lib/data/draftRecord';
import type { DraftAction, DraftSide } from '$lib/data/types';
import type { DraftState, EnemyDistributionEntry, NavigatorSlot } from '$lib/strategic/draftNavigator';
import type { RolePriors } from '$lib/strategic/fogReveal';
import { loadDefaultTags } from '$lib/tags';
import { ROLES, type Role } from '$lib/types';

/** Préfixe FR de la raison générée (la profondeur 2 est celle du navigate de la page). */
export const SELF_PLAY_LABEL_FR = 'Self-play coach (profondeur 2)';

export interface GeneratedCandidate {
    championKey: string;
    /** Raisons FR exposées par le répondeur (axes du coach) — sinon raison générée ici. */
    reasonsFr?: string[];
}

export interface PrepGeneratorContext {
    ourSide: DraftSide;
    /** NOS tours : candidats CLASSÉS (meilleur d'abord) — navigate côté appelant. */
    ourReply: (state: DraftState, slot: NavigatorSlot) => GeneratedCandidate[];
    /** LEURS tours : distribution predict au slot (argmax pris ici) — même seam que la compile. */
    enemyDistribution: (state: DraftState, slot: NavigatorSlot) => EnemyDistributionEntry[];
    /** P(rôle | champion) — mapping de nos picks générés vers les 5 rôles. */
    rolePriors: RolePriors;
    /** Lockouts (Fearless…) — exclus du board ET du plan. */
    excludedKeys?: string[];
    /** Univers des clés jouables (défaut : fichier de tags embarqué). */
    pool?: readonly string[];
    /** Nom affichable d'une clé (raisons FR) — défaut : la clé elle-même. */
    nameOf?: (championKey: string) => string;
}

export interface GeneratedBan {
    /** null = trou explicite (le répondeur n'a rien proposé à ce tour). */
    championKey: string | null;
    rationaleFr: string | null;
}

export interface GeneratedPickRow {
    role: Role;
    /** null = rôle non couvert par le self-play (trou explicite). */
    primary: string | null;
    /** 2ᵉ candidat du même tour — null si le répondeur n'en avait qu'un. */
    fallback: string | null;
    rationaleFr: string | null;
}

export interface GeneratedPrep {
    /** Nos 5 slots de ban, dans l'ordre du template. */
    bans: GeneratedBan[];
    /** Les 5 rôles dans l'ordre canonique (Top → Support). */
    picks: GeneratedPickRow[];
    /** Tours à NOUS restés sans proposition — trous laissés vides, jamais inventés. */
    holes: number;
    /** Tours ADVERSES sautés (distribution vide) pendant le self-play. */
    enemySkips: number;
}

/** Application immutable d'une action (clé retirée du pool) — même forme que planTree. */
function applyAction(state: DraftState, slot: NavigatorSlot, championKey: string): DraftState {
    const available = new Set(state.available);
    available.delete(championKey);
    const action: DraftAction = {
        seq: slot.seq,
        type: slot.type,
        phase: slot.phase,
        side: slot.side,
        championKey,
        championName: championKey
    };
    return { actions: [...state.actions, action], firstPickSide: state.firstPickSide, available };
}

/** Rôles d'un champion par affinité décroissante (départage : index croissant). */
function rolesByAffinity(championKey: string, rolePriors: RolePriors): Role[] {
    const weights = rolePriors(championKey);
    return [...ROLES].sort((a, b) => {
        const wa = Number.isFinite(weights[a]) ? (weights[a] ?? 0) : 0;
        const wb = Number.isFinite(weights[b]) ? (weights[b] ?? 0) : 0;
        return wb - wa || a - b;
    });
}

/** Un coup à nous en attente de sa raison générée (patchée au coup adverse suivant). */
interface OurMove {
    championKey: string;
    fallback: string | null;
    rationaleFr: string | null;
    /** true = raison à générer depuis le prochain coup adverse du self-play. */
    awaitingEnemy: boolean;
}

/**
 * Self-play de la draft complète depuis le board vide (convention
 * bleu-premier) et assemblage d'une proposition de DraftPlan.
 *
 * Anti-doublons à DEUX niveaux, documenté :
 *  - le BOARD (`state.available`) : une clé jouée ou exclue ne rejoue jamais,
 *    ni chez nous ni chez eux ;
 *  - le PLAN (`planUsed`) : nos primaires, fallbacks et bans ne se répètent
 *    pas entre eux (l'éditeur de plan interdit les doublons). Un fallback
 *    n'est PAS retiré du board : l'adversaire du self-play peut le jouer —
 *    le fallback reste une alternative valable hors de cette ligne précise.
 */
export function generatePrepPlan(ctx: PrepGeneratorContext): GeneratedPrep {
    const pool = ctx.pool ?? Object.keys(loadDefaultTags().champions);
    const excluded = new Set(ctx.excludedKeys ?? []);
    const nameOf = ctx.nameOf ?? ((key: string): string => key);

    let state: DraftState = {
        actions: [],
        firstPickSide: 'blue',
        available: new Set(pool.filter((key) => !excluded.has(key)))
    };
    /** Clés déjà revendiquées par le plan (bans + primaires + fallbacks + exclusions). */
    const planUsed = new Set(excluded);

    const banMoves: (OurMove | null)[] = [];
    const pickMoves: OurMove[] = [];
    /** Coups à nous dont la raison attend le prochain coup adverse. */
    let pendingReasons: OurMove[] = [];
    let holes = 0;
    let enemySkips = 0;

    const settlePendingReasons = (enemyKey: string): void => {
        for (const move of pendingReasons) {
            move.rationaleFr = `${SELF_PLAY_LABEL_FR} — sortie attendue adverse : ${nameOf(enemyKey)}.`;
            move.awaitingEnemy = false;
        }
        pendingReasons = [];
    };

    for (const template of DRAFT_TEMPLATE) {
        const slot: NavigatorSlot = {
            seq: template.seq,
            phase: template.phase,
            type: template.type,
            side: template.first ? 'blue' : 'red'
        };

        if (slot.side === ctx.ourSide) {
            // NOTRE tour : 1ᵉʳ candidat utilisable = primaire, 2ᵉ = fallback (picks).
            const candidates = ctx
                .ourReply(state, slot)
                .filter((c) => state.available.has(c.championKey) && !planUsed.has(c.championKey));
            const primary = candidates[0];
            if (primary === undefined) {
                holes += 1;
                if (slot.type === 'ban') banMoves.push(null);
                continue; // trou explicite — le template avance sans action.
            }
            const fallbackEntry =
                slot.type === 'pick'
                    ? candidates.find((c) => c.championKey !== primary.championKey)
                    : undefined;
            const reasons = primary.reasonsFr ?? [];
            const move: OurMove = {
                championKey: primary.championKey,
                fallback: fallbackEntry?.championKey ?? null,
                rationaleFr: reasons.length > 0 ? reasons.join(' · ') : null,
                awaitingEnemy: reasons.length === 0
            };
            if (move.awaitingEnemy) pendingReasons.push(move);
            if (slot.type === 'ban') banMoves.push(move);
            else pickMoves.push(move);
            planUsed.add(move.championKey);
            if (move.fallback !== null) planUsed.add(move.fallback);
            state = applyAction(state, slot, move.championKey);
        } else {
            // LEUR tour : argmax de la distribution injectée (stable : premier max).
            const entries = ctx.enemyDistribution(state, slot).filter((e) => state.available.has(e.championKey));
            let top: EnemyDistributionEntry | undefined;
            for (const entry of entries) {
                if (top === undefined || entry.p > top.p) top = entry;
            }
            if (top === undefined) {
                enemySkips += 1;
                continue; // leur slot sauté — rien d'inventé.
            }
            state = applyAction(state, slot, top.championKey);
            settlePendingReasons(top.championKey);
        }
    }

    // Fin de draft sans coup adverse derrière (p. ex. seq 20 à nous, side rouge) :
    // raison générée sans la sortie attendue — il n'y en a plus.
    for (const move of pendingReasons) {
        move.rationaleFr = `${SELF_PLAY_LABEL_FR}.`;
        move.awaitingEnemy = false;
    }

    // Mapping picks → rôles (règle de collision documentée en tête de module).
    const taken = new Set<Role>();
    const rows = new Map<Role, GeneratedPickRow>();
    for (const move of pickMoves) {
        const role = rolesByAffinity(move.championKey, ctx.rolePriors).find((r) => !taken.has(r));
        if (role === undefined) continue; // impossible : ≤ 5 picks pour 5 rôles (défensif)
        taken.add(role);
        rows.set(role, {
            role,
            primary: move.championKey,
            fallback: move.fallback,
            rationaleFr: move.rationaleFr
        });
    }

    return {
        bans: banMoves.map(
            (move): GeneratedBan =>
                move === null
                    ? { championKey: null, rationaleFr: null }
                    : { championKey: move.championKey, rationaleFr: move.rationaleFr }
        ),
        picks: ROLES.map(
            (role): GeneratedPickRow =>
                rows.get(role) ?? { role, primary: null, fallback: null, rationaleFr: null }
        ),
        holes,
        enemySkips
    };
}
