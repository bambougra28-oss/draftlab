/**
 * Chantier D (run #2) — Moteur d'arbre de prep contre UN adversaire
 * (docs/run2/D-plans-branches.md §2.2 ; ARCHITECTURE_V2 §8 R6).
 *
 * `compilePlanTree` transforme un DraftPlan statique en arbre conditionnel :
 * nœuds = nos tours (réponses préparées), branches = les K réponses adverses
 * les plus probables selon le modèle injecté. Pur : distribution, évidence,
 * répondeur et horloge sont INJECTÉS (même seam de type de fonction que le
 * navigator — jamais d'import du modèle) ; aucune I/O, aucune horloge système.
 *
 * Algorithme (§2.2, gelé) :
 *  1. État racine : DraftState vide (exclusions = excludedKeys), firstPickSide
 *     'blue' (convention du board) ; ourLine racine = nos actions template
 *     jusqu'au premier tour adverse, chaque action appliquée immutablement.
 *  2. Expansion par PRIORITÉ DE MASSE : frontière max par pathMass (départage
 *     déterministe : ordre d'insertion) ; on dépile le nœud de masse max, on
 *     appelle enemyDistribution sur son état (exclusions du chemin appliquées
 *     — un champion consommé en amont ne réapparaît JAMAIS en aval), on garde
 *     branchK branches, on déroule ourLine de chaque enfant jusqu'au tour
 *     adverse suivant, on empile les enfants dont pathMass ≥ minPathMass et
 *     dont la profondeur adverse < enemyDepth. Arrêt : frontière vide ou
 *     nodeCount ≥ maxNodes.
 *  3. Les réponses ourReply coûteuses (navigate) ne sont calculées que si
 *     pathMass ≥ replyMassFloor ; en dessous, mapping statique du plan
 *     (premier primaire du rôle encore ouvert disponible sur la ligne) — le
 *     pattern « ligne principale épaisse, sidelines minces » du répertoire
 *     d'échecs.
 *
 * Les `p` des branches sont la masse BRUTE du modèle (jamais renormalisée
 * après troncature) : Σ pathMass des nœuds d'une profondeur = masse couverte
 * par CET arbre à cette profondeur — propriété du compile, à ne JAMAIS
 * confondre avec la couverture du modèle mesurée par la gate (§2.6).
 *
 * La gate (§1) ne dépend PAS de ce module — elle appelle predict directement.
 * Si la gate est verte, le produit utilise exactement le même modèle au même K.
 *
 * v1 : format 'pro' uniquement (template 20 slots) — les bans SoloQ sont des
 * exclusions simultanées, pas des actions ordonnées (§2.7).
 */
import { DRAFT_TEMPLATE } from '$lib/data/draftRecord';
import type { DraftAction, DraftSide } from '$lib/data/types';
import type { DraftState, EnemyDistributionEntry, NavigatorSlot } from '$lib/strategic/draftNavigator';
import type { DraftPlan } from '$lib/storage/draftPlans';
import { loadDefaultTags } from '$lib/tags';

/** Tunables DA-V2-6 — injectables, jamais enfouis. */
export interface PlanTreeConfig {
    /** Branches adverses conservées par nœud (le K validé par la gate). */
    branchK: number;
    /** Horizon en ACTIONS ADVERSES (P de la gate). */
    enemyDepth: number;
    /** Masse de chemin minimale pour étendre un nœud (Π des p des branches). */
    minPathMass: number;
    /** Budget total de nœuds — expansion par priorité de masse (frontière max d'abord). */
    maxNodes: number;
    /** Au-dessus : réponse via navigate ; en dessous : mapping statique du plan. */
    replyMassFloor: number;
}

export const PLAN_TREE_DEFAULTS: PlanTreeConfig = {
    branchK: 4,
    enemyDepth: 6,
    minPathMass: 0.02,
    maxNodes: 2000,
    replyMassFloor: 0.05
};

export interface PlannedAction {
    seq: number;
    type: 'pick' | 'ban';
    championKey: string;
    /** Repli si le primaire est indisponible sur cette ligne. */
    fallback?: string;
    /** Raisons FR figées à la compilation (axes du navigator/plan). */
    reasonsFr?: string[];
}

export interface PlanBranch {
    championKey: string;
    /** Masse du modèle à la compilation (tri + affichage). */
    p: number;
    /** Évidence brute figée — « 4 des 6 dernières » (evidenceString). */
    rawCount: number;
    total: number;
    /** L'évidence à un clic (méthodo §7) : jusqu'à 3 games d'exemple. */
    exampleGameIds?: string[];
    child: PlanTreeNode;
}

export interface PlanTreeNode {
    /** NOS actions préparées depuis la branche parente jusqu'au tour adverse (0..2). */
    ourLine: PlannedAction[];
    /** seq template du tour adverse de ce nœud ; null = horizon atteint. */
    enemySeq: number | null;
    /** Triées p desc ; vide si nœud non étendu (masse/budget) — « ligne mince ». */
    branches: PlanBranch[];
    /** Produit des p depuis la racine (1 à la racine). */
    pathMass: number;
}

export interface PlanTree {
    planId: string;
    /** Nom de l'équipe adverse modélisée. */
    opponent: string;
    ourSide: DraftSide;
    /** Horloge injectée à la compile. */
    builtAt: number;
    /** Provenance du modèle : nb de records, patch max, ligue (DA-V2-4). */
    modelProvenance: { records: number; latestPatch?: string; league?: string };
    config: PlanTreeConfig;
    /** Lockouts Fearless / exclusions au moment de la compile. */
    excludedKeys: string[];
    root: PlanTreeNode;
    nodeCount: number;
}

export interface CompileContext {
    ourSide: DraftSide;
    plan: DraftPlan;
    /** MÊME seam que le navigator (couplage par type de fonction, jamais d'import). */
    enemyDistribution: (state: DraftState, slot: NavigatorSlot) => EnemyDistributionEntry[];
    /** Évidence brute par candidat (rawCount/total/gameIds) — depuis l'intel. */
    evidenceOf?: (
        championKey: string,
        slot: NavigatorSlot
    ) => { rawCount: number; total: number; exampleGameIds?: string[] };
    /** Notre réponse sur une ligne : navigate (masse haute) ou plan statique (masse basse). */
    ourReply: (state: DraftState, slot: NavigatorSlot) => PlannedAction | null;
    excludedKeys?: string[];
    config?: Partial<PlanTreeConfig>;
    /** Horloge injectée. */
    now: number;
    /**
     * Adversaire modélisé (affichage/provenance). Optionnel pour rester
     * compatible avec l'interface gelée de §2.2 — défaut 'Adversaire'.
     */
    opponent?: string;
    /**
     * Provenance du modèle injecté (PlanTree.modelProvenance l'exige mais le
     * seam ne la porte pas) — défaut honnête { records: 0 }.
     */
    modelProvenance?: PlanTree['modelProvenance'];
    /**
     * « Recompiler le script d'ici » (§2.3) : actions DÉJÀ jouées — l'arbre
     * démarre au slot template suivant, ces clés sont consommées, et la
     * profondeur adverse repart à zéro (horizon = actions adverses
     * restantes, via config.enemyDepth). Le suivi post-recompile passe au
     * tracker les seules actions de seq strictement supérieur.
     */
    initialActions?: DraftAction[];
}

// ---- marche du template ----------------------------------------------------------

/** Slot template (blue-first, convention du board) strictement après `seqFloor`. */
function slotAfter(seqFloor: number): NavigatorSlot | null {
    const slot = DRAFT_TEMPLATE.find((s) => s.seq > seqFloor);
    if (slot === undefined) return null;
    return { seq: slot.seq, phase: slot.phase, type: slot.type, side: slot.first ? 'blue' : 'red' };
}

/** Application immutable d'une action sur l'état (clé retirée du pool). */
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

// ---- mapping statique du plan (sous le plancher de masse) -------------------------

interface LineContext {
    consumed: Set<string>;
    /** Rôles déjà revendiqués par un pick statique sur cette ligne. */
    claimedRoles: Set<number>;
}

/**
 * Réponse statique : bans du plan dans l'ordre (premier disponible) ; picks =
 * premier PRIMAIRE d'un rôle encore ouvert disponible sur la ligne (§2.2.3).
 */
function staticPlanReply(plan: DraftPlan, slot: NavigatorSlot, line: LineContext): PlannedAction | null {
    if (slot.type === 'ban') {
        for (const ban of plan.bans) {
            if (ban.championKey === null || line.consumed.has(ban.championKey)) continue;
            return {
                seq: slot.seq,
                type: 'ban',
                championKey: ban.championKey,
                ...(ban.rationale !== undefined && ban.rationale !== '' ? { reasonsFr: [ban.rationale] } : {})
            };
        }
        return null;
    }
    for (const pick of plan.picks) {
        if (line.claimedRoles.has(pick.role)) continue;
        if (pick.primary === null || line.consumed.has(pick.primary)) continue;
        line.claimedRoles.add(pick.role);
        return {
            seq: slot.seq,
            type: 'pick',
            championKey: pick.primary,
            ...(pick.fallback !== null ? { fallback: pick.fallback } : {}),
            ...(pick.rationale !== undefined && pick.rationale !== '' ? { reasonsFr: [pick.rationale] } : {})
        };
    }
    return null;
}

// ---- compile ----------------------------------------------------------------------

interface FrontierItem {
    node: PlanTreeNode;
    state: DraftState;
    line: LineContext;
    /** Profondeur adverse du nœud (actions adverses depuis la racine). */
    enemyDepth: number;
}

/**
 * Déroule NOS slots depuis `seqFloor` jusqu'au prochain tour adverse (ou la fin
 * du template). Mute `state`/`line` du wrapper passé — appelé sur des copies.
 */
function walkOurLine(
    ctx: CompileContext,
    cfg: PlanTreeConfig,
    item: { state: DraftState; line: LineContext },
    seqFloor: number,
    pathMass: number,
    ourLine: PlannedAction[]
): number | null {
    let cursor = seqFloor;
    for (;;) {
        const slot = slotAfter(cursor);
        if (slot === null) return null; // template épuisé
        if (slot.side !== ctx.ourSide) return slot.seq; // tour adverse
        cursor = slot.seq;
        // Plancher de masse : navigate (injecté) au-dessus, plan statique en dessous.
        let action: PlannedAction | null = null;
        if (pathMass >= cfg.replyMassFloor) {
            const reply = ctx.ourReply(item.state, slot);
            // Une réponse déjà consommée sur la ligne violerait l'invariant
            // d'exclusion — repli statique (défensif, documenté).
            if (reply !== null && !item.line.consumed.has(reply.championKey)) action = reply;
        }
        if (action === null) action = staticPlanReply(ctx.plan, slot, item.line);
        if (action === null) continue; // rien à jouer : slot sauté, le template avance
        ourLine.push(action);
        item.line.consumed.add(action.championKey);
        item.state = applyAction(item.state, slot, action.championKey);
    }
}

/** Frontière max par pathMass — départage déterministe par ordre d'insertion. */
function popMax(frontier: FrontierItem[]): FrontierItem {
    let best = 0;
    for (let i = 1; i < frontier.length; i++) {
        if (frontier[i].node.pathMass > frontier[best].node.pathMass) best = i;
    }
    return frontier.splice(best, 1)[0];
}

/**
 * Compile l'arbre de prep. Déterministe : mêmes entrées, même arbre — la
 * frontière, les départages et les seams injectés ne tirent aucun aléa.
 */
export function compilePlanTree(ctx: CompileContext): PlanTree {
    const cfg: PlanTreeConfig = { ...PLAN_TREE_DEFAULTS, ...ctx.config };
    const excludedKeys = [...(ctx.excludedKeys ?? [])];
    const initial = [...(ctx.initialActions ?? [])].sort((a, b) => a.seq - b.seq);
    const initialKeys = initial.map((a) => a.championKey).filter((key) => key !== '');

    // Pool racine : univers des tags moins les exclusions (Fearless) et le
    // préfixe déjà joué (recompile). Les clés synthétiques inconnues du
    // fichier de tags ne cassent rien : le compile filtre par `consumed`,
    // jamais par `available` (le pool n'est là que pour les seams style
    // navigator qui le lisent).
    const universe = new Set<string>(Object.keys(loadDefaultTags().champions));
    for (const key of excludedKeys) universe.delete(key);
    for (const key of initialKeys) universe.delete(key);

    const rootItem: { state: DraftState; line: LineContext } = {
        state: { actions: initial, firstPickSide: 'blue', available: universe },
        line: { consumed: new Set([...excludedKeys, ...initialKeys]), claimedRoles: new Set() }
    };
    // Recompile « d'ici » : nos picks passés revendiquent leur rôle au plan
    // (match par primaire, ou rôle explicite de l'action) — le mapping
    // statique ne re-proposera pas un rôle déjà couvert.
    for (const action of initial) {
        if (action.type !== 'pick' || action.side !== ctx.ourSide) continue;
        if (action.role !== undefined) {
            rootItem.line.claimedRoles.add(action.role);
            continue;
        }
        const row = ctx.plan.picks.find(
            (pick) => pick.primary === action.championKey || pick.fallback === action.championKey
        );
        if (row !== undefined) rootItem.line.claimedRoles.add(row.role);
    }
    const startSeq = initial.length > 0 ? initial[initial.length - 1].seq : 0;
    const rootLine: PlannedAction[] = [];
    const rootEnemySeq = walkOurLine(ctx, cfg, rootItem, startSeq, 1, rootLine);
    const root: PlanTreeNode = { ourLine: rootLine, enemySeq: rootEnemySeq, branches: [], pathMass: 1 };
    let nodeCount = 1;

    const frontier: FrontierItem[] = [];
    if (rootEnemySeq !== null) {
        frontier.push({ node: root, state: rootItem.state, line: rootItem.line, enemyDepth: 0 });
    }

    while (frontier.length > 0 && nodeCount < cfg.maxNodes) {
        const item = popMax(frontier);
        const enemySeq = item.node.enemySeq;
        if (enemySeq === null) continue;
        const template = DRAFT_TEMPLATE.find((s) => s.seq === enemySeq);
        if (template === undefined) continue;
        const slot: NavigatorSlot = {
            seq: template.seq,
            phase: template.phase,
            type: template.type,
            side: template.first ? 'blue' : 'red'
        };

        // Exclusions du chemin : un champion consommé en amont ne réapparaît
        // jamais en aval. Tri p desc (stable), troncature à branchK.
        const entries = ctx
            .enemyDistribution(item.state, slot)
            .filter((entry) => !item.line.consumed.has(entry.championKey))
            .sort((a, b) => b.p - a.p)
            .slice(0, cfg.branchK);

        for (const entry of entries) {
            if (nodeCount >= cfg.maxNodes) break;
            const childDepth = item.enemyDepth + 1;
            const childPathMass = item.node.pathMass * entry.p;
            const childItem = {
                state: applyAction(item.state, slot, entry.championKey),
                line: {
                    consumed: new Set(item.line.consumed),
                    claimedRoles: new Set(item.line.claimedRoles)
                }
            };
            childItem.line.consumed.add(entry.championKey);

            const childLine: PlannedAction[] = [];
            const nextEnemySeq = walkOurLine(ctx, cfg, childItem, slot.seq, childPathMass, childLine);
            const child: PlanTreeNode = {
                ourLine: childLine,
                // null = horizon atteint (profondeur adverse pleine ou template épuisé).
                enemySeq: childDepth < cfg.enemyDepth ? nextEnemySeq : null,
                branches: [],
                pathMass: childPathMass
            };
            nodeCount += 1;

            const evidence = ctx.evidenceOf?.(entry.championKey, slot);
            item.node.branches.push({
                championKey: entry.championKey,
                p: entry.p,
                rawCount: evidence?.rawCount ?? 0,
                total: evidence?.total ?? 0,
                ...(evidence?.exampleGameIds !== undefined
                    ? { exampleGameIds: evidence.exampleGameIds.slice(0, 3) }
                    : {}),
                child
            });

            if (child.enemySeq !== null && childPathMass >= cfg.minPathMass) {
                frontier.push({ node: child, state: childItem.state, line: childItem.line, enemyDepth: childDepth });
            }
        }
    }

    return {
        planId: ctx.plan.id,
        opponent: ctx.opponent ?? 'Adversaire',
        ourSide: ctx.ourSide,
        builtAt: ctx.now,
        modelProvenance: ctx.modelProvenance ?? { records: 0 },
        config: cfg,
        excludedKeys,
        root,
        nodeCount
    };
}

// ---- lectures de l'arbre ------------------------------------------------------------

/**
 * Masse couverte par CET arbre, par profondeur adverse : Σ pathMass des nœuds
 * de chaque profondeur (index 0 = 1ʳᵉ action adverse). Propriété du compile
 * (budget, plancher) — ne se déguise JAMAIS en « tenue moyenne » mesurée (§2.6).
 */
export function massByEnemyDepth(root: PlanTreeNode): number[] {
    const mass: number[] = [];
    const visit = (node: PlanTreeNode, depth: number): void => {
        for (const branch of node.branches) {
            mass[depth] = (mass[depth] ?? 0) + branch.child.pathMass;
            visit(branch.child, depth + 1);
        }
    };
    visit(root, 0);
    return mass;
}
