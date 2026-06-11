/**
 * Chantier D (run #2) — Détection de déviation live contre un arbre de prep
 * (docs/run2/D-plans-branches.md §2.3).
 *
 * `trackPlan` est PUR et SANS ÉTAT : rejoué intégralement à chaque changement
 * du board (les actions exactes de `toDraftActions(draftSeq)` en mode
 * séquence). Sémantique gelée :
 *
 * - action ADVERSE → match contre les branches du nœud courant APRÈS filtrage
 *   des branches devenues indisponibles (champion consommé entre-temps ou
 *   exclu Fearless — l'arbre est statique, le board est la vérité) : match →
 *   descente ; non-match → their-deviation avec breakingAction. Si le pick
 *   réel figure dans la distribution compilée du nœud (cas branche périmée),
 *   son p modèle est cité ; sinon rien n'est inventé.
 * - action À NOUS ≠ ourLine (ni primaire ni fallback) → our-deviation,
 *   PERSISTANT : le statut ne redevient jamais on-script, même si la suite
 *   re-matche (il ne peut qu'évoluer vers their-deviation / beyond-prep /
 *   complete), et branchesAuthoritative passe à false pour le RESTE de la
 *   draft : l'arbre a été compilé le long de NOTRE ligne — quittée, les
 *   branches restent indicatives mais ne sont plus garanties par la gate.
 *   Le suivi des branches adverses CONTINUE (notre écart n'invalide pas leur
 *   tendance).
 * - une their-deviation survenant APRÈS un our-deviation garde un wording
 *   NEUTRE (« hors des branches affichées ») et ne cite JAMAIS les chiffres
 *   de couverture mesurés par la gate — la gate a mesuré le modèle conditionné
 *   au préfixe réel, pas un arbre dont nous avons quitté la ligne.
 * - nœud sans branches (ligne mince / horizon) au tour adverse → beyond-prep
 *   (normal en phase 2 : la prep s'arrête, le coach live continue).
 * - draft finie (seq 20 joué) → complete.
 *
 * La proposition après déviation n'est PAS un nouveau moteur : le CoachPanel
 * (`recommendNext`) tourne déjà sur l'état réel — la bannière UI fait le
 * handover explicite + « Recompiler le script d'ici » (dès our-deviation).
 */
import type { DraftAction, DraftSide } from '$lib/data/types';
import type { PlanBranch, PlannedAction, PlanTree, PlanTreeNode } from '$lib/strategic/planTree';

export type PlanTrackStatus =
    | 'not-started' // aucune action saisie
    | 'on-script' // tout matche, l'arbre est vivant
    | 'our-deviation' // NOUS avons quitté notre ligne (suivi continue, averti)
    | 'their-deviation' // pick/ban adverse hors des K branches → coach reprend
    | 'beyond-prep' // horizon de l'arbre atteint sans casse (normal en phase 2)
    | 'complete'; // draft finie

export interface PlanTrackState {
    status: PlanTrackStatus;
    /** Actions adverses matchées depuis la racine. */
    enemyMatched: number;
    /** Nœud courant (null après déviation adverse ou horizon). */
    node: PlanTreeNode | null;
    /** Notre prochaine action préparée si on-script. */
    nextPrepared: PlannedAction | null;
    /** Branches attendues au tour adverse courant (affichage, p + évidence). */
    expectedBranches: PlanBranch[];
    /**
     * false dès le PREMIER our-deviation, et pour tout le reste de la draft :
     * l'arbre a été compilé le long de NOTRE ligne — quittée, les branches
     * restent indicatives mais ne sont plus garanties par la gate.
     */
    branchesAuthoritative: boolean;
    /** L'action qui a cassé le script. */
    breakingAction?: { seq: number; championKey: string; byUs: boolean };
    /** Phrase d'état FR pour le bandeau. */
    headlineFr: string;
}

/** Dernier slot du template pro : seq 20 joué = draft finie. */
const LAST_TEMPLATE_SEQ = 20;

const ORDINAL_FR = (n: number): string => (n === 1 ? '1ʳᵉ' : `${n}ᵉ`);

/** Branches encore jouables : clé non consommée par le board ni exclue. */
function liveBranches(node: PlanTreeNode, consumed: ReadonlySet<string>): PlanBranch[] {
    return node.branches.filter((branch) => !consumed.has(branch.championKey));
}

/**
 * Rejoue les `actions` (triées par seq) contre l'arbre. Même entrée → même
 * sortie : aucun état conservé entre deux appels.
 */
export function trackPlan(tree: PlanTree, actions: DraftAction[], ourSide: DraftSide): PlanTrackState {
    const ordered = [...actions].sort((a, b) => a.seq - b.seq);
    const consumed = new Set<string>(tree.excludedKeys);

    let node: PlanTreeNode | null = tree.root;
    /** Position dans la ourLine du nœud courant (prochaine action attendue). */
    let lineCursor = 0;
    let enemyMatched = 0;
    let enemySeen = 0;
    let ourDeviated = false;
    let theirDeviated = false;
    let beyondPrep = false;
    let breakingAction: PlanTrackState['breakingAction'];
    /** Branches affichables au moment de la casse (déjà filtrées). */
    let breakingBranches: PlanBranch[] = [];
    /** p modèle du pick réel s'il figurait dans la distribution compilée. */
    let breakingModelP: number | undefined;
    let maxSeq = 0;

    for (const action of ordered) {
        if (action.seq > maxSeq) maxSeq = action.seq;
        const isOurs = action.side === ourSide;

        if (isOurs) {
            // Après une casse adverse / l'horizon / notre sortie, nos actions
            // ne sont plus confrontées à la ligne (le coach a la main).
            if (node !== null && !theirDeviated && !beyondPrep && !ourDeviated) {
                const expected: PlannedAction | undefined = node.ourLine
                    .slice(lineCursor)
                    .find((planned) => planned.seq === action.seq);
                const matches =
                    expected !== undefined &&
                    (expected.championKey === action.championKey || expected.fallback === action.championKey);
                if (matches) {
                    lineCursor = node.ourLine.indexOf(expected) + 1;
                } else if (!ourDeviated) {
                    ourDeviated = true;
                    breakingAction = { seq: action.seq, championKey: action.championKey, byUs: true };
                }
            }
        } else if (node !== null && !theirDeviated && !beyondPrep) {
            enemySeen += 1;
            if (node.branches.length === 0) {
                // Ligne mince ou horizon : la prep s'arrête sans casse.
                beyondPrep = true;
                node = null;
            } else {
                const live = liveBranches(node, consumed);
                const match = live.find((branch) => branch.championKey === action.championKey);
                if (match !== undefined) {
                    enemyMatched += 1;
                    node = match.child;
                    lineCursor = 0;
                } else {
                    theirDeviated = true;
                    breakingAction = { seq: action.seq, championKey: action.championKey, byUs: false };
                    breakingBranches = live;
                    const compiled = node.branches.find((branch) => branch.championKey === action.championKey);
                    breakingModelP = compiled?.p;
                    node = null;
                }
            }
        }

        consumed.add(action.championKey);
    }

    // ---- statut final (priorités gelées §2.3) ----
    const complete = maxSeq >= LAST_TEMPLATE_SEQ;
    let status: PlanTrackStatus;
    if (ordered.length === 0) status = 'not-started';
    else if (complete) status = 'complete';
    else if (theirDeviated) status = 'their-deviation';
    else if (beyondPrep) status = 'beyond-prep';
    else if (ourDeviated) status = 'our-deviation';
    else status = 'on-script';

    const branchesAuthoritative = !ourDeviated;
    const onLine = status === 'not-started' || status === 'on-script';
    const nextPrepared = onLine && node !== null ? (node.ourLine[lineCursor] ?? null) : null;
    const expectedBranches =
        status === 'complete'
            ? []
            : status === 'their-deviation'
              ? breakingBranches
              : node !== null
                ? liveBranches(node, consumed)
                : [];

    // ---- bandeau FR (apprenant : toujours le pourquoi) ----
    let headlineFr: string;
    switch (status) {
        case 'not-started':
            headlineFr = `Script prêt contre ${tree.opponent} — en attente de la première action.`;
            break;
        case 'on-script':
            headlineFr =
                enemySeen === 0
                    ? 'Dans le script — en attente de leur première action.'
                    : `Dans le script (${enemyMatched} sur ${enemySeen} actions adverses).`;
            break;
        case 'our-deviation':
            headlineFr =
                'Vous avez quitté votre ligne — les branches adverses restent affichées à titre indicatif ' +
                '(l’arbre avait été compilé le long de VOTRE ligne). Recompilez le script depuis l’état réel.';
            break;
        case 'their-deviation': {
            const key = breakingAction?.championKey ?? '?';
            if (!branchesAuthoritative) {
                // Wording NEUTRE post our-deviation : jamais les chiffres de la gate.
                headlineFr = `${key} est hors des branches affichées — le coach en direct reprend la main.`;
            } else {
                const pNote =
                    breakingModelP !== undefined ? ` (p modèle ${Math.round(breakingModelP * 100)} %)` : '';
                headlineFr =
                    `Sorti du script à leur ${ORDINAL_FR(enemySeen)} action : ${key} n'était dans aucune des ` +
                    `${breakingBranches.length} branche${breakingBranches.length > 1 ? 's' : ''} préparées${pNote}. ` +
                    'Le coach en direct reprend la main.';
            }
            break;
        }
        case 'beyond-prep':
            headlineFr =
                'Fin de la prep — l’horizon de l’arbre est atteint sans casse (normal en phase 2). ' +
                'Le coach en direct continue.';
            break;
        case 'complete':
            headlineFr = 'Draft terminée — passez à la lecture stratégique ou à la revue.';
            break;
    }

    return {
        status,
        enemyMatched,
        node,
        nextPrepared,
        expectedBranches,
        branchesAuthoritative,
        ...(breakingAction !== undefined ? { breakingAction } : {}),
        headlineFr
    };
}
