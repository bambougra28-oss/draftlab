/**
 * Chantier « entraînement de prépa » — drill de répertoire sur un PlanTree.
 *
 * L'analogue du trainer d'ouvertures aux échecs (Chessable) : on rejoue ses
 * lignes PRÉPARÉES jusqu'à les connaître, et l'outil dit où on se trompe. La
 * réaction hors-script reste le rôle du coach live (bannière de déviation,
 * gate D) — le drill n'exerce QUE les lignes de l'arbre compilé.
 *
 * Sémantique :
 *  - une LIGNE = un chemin racine→feuille de l'arbre (feuille = nœud sans
 *    branches : horizon atteint ou ligne mince) ; son identité stable est la
 *    suite d'indices de branches dans l'énumération DFS complète (branche 0 =
 *    masse max, l'ordre du compile) — `sourceIndex` sert à « rejouer les
 *    ratés » entre deux sessions ;
 *  - un DÉFI = une de NOS actions préparées (PlannedAction de la ourLine d'un
 *    nœud), précédée des 0..2 branches adverses révélées depuis notre dernier
 *    coup (0 à l'ouverture ; 2 quand le template enchaîne deux tours adverses,
 *    p. ex. seq 8-9 côté blue) ; une révélation adverse en toute fin de ligne
 *    sans réponse à nous n'est pas drillée (rien à répondre) ;
 *  - modes : 'principale' (à chaque nœud, la branche de masse MAX — la ligne
 *    principale du répertoire), 'pondere' (branche tirée ∝ p via le rng
 *    INJECTÉ — jamais Math.random, règle du projet), 'exhaustif' (toutes les
 *    lignes en profondeur d'abord, une après l'autre, sans doublon — le
 *    « encore et encore ») ;
 *  - verdict : 'primaire' (la réponse préparée), 'fallback' (le repli — la
 *    ligne continue, mais c'est compté à part), 'faux' (raté, listé dans le
 *    résumé « à retravailler » avec le chemin adverse complet).
 *
 * Pur et déterministe à rng fixé : aucune I/O, aucune horloge, aucun aléa
 * caché. `answer` retourne un NOUVEL état (l'état d'entrée n'est pas muté).
 * v1 : score de session uniquement — la répétition espacée (réinterroger en
 * priorité les lignes fautées d'une session à l'autre, persistées) est une v2.
 */
import { DRAFT_TEMPLATE } from '$lib/data/draftRecord';
import type { PlannedAction, PlanTree, PlanTreeNode } from '$lib/strategic/planTree';

export type DrillMode = 'principale' | 'pondere' | 'exhaustif';

export type DrillVerdict = 'primaire' | 'fallback' | 'faux';

/** Branche adverse révélée pendant le drill — p + évidence figées à la compile. */
export interface RevealedEnemyMove {
    seq: number;
    type: 'pick' | 'ban';
    championKey: string;
    /** Masse du modèle à la compilation (« 31 % »). */
    p: number;
    /** Évidence brute — « 4 des 6 dernières » via evidenceString. */
    rawCount: number;
    total: number;
}

/** Un coup du chemin joué (affichage en icônes). */
export interface DrillStep {
    by: 'nous' | 'eux';
    seq: number;
    type: 'pick' | 'ban';
    /** Le coup de la LIGNE (préparé pour nous, branche révélée pour eux). */
    championKey: string;
    /** Pour NOS coups : la réponse réellement donnée et son verdict. */
    answeredKey?: string;
    verdict?: DrillVerdict;
}

/** Le point où NOUS devons jouer. */
export interface DrillChallenge {
    /** Branches révélées depuis notre dernier coup (vide à l'ouverture, 1-2 sinon). */
    enemyMovesJustPlayed: RevealedEnemyMove[];
    /** La réponse préparée : primaire (le fallback éventuel est dans l'objet). */
    expected: PlannedAction;
    seq: number;
    type: 'pick' | 'ban';
    /** Chemin déjà joué sur la ligne courante. */
    pathSoFar: readonly DrillStep[];
    /** Position LOCALE de session (0-based) et total de lignes de la session. */
    lineIndex: number;
    lineCount: number;
}

/** Un raté — la liste « à retravailler » du résumé. */
export interface DrillMiss {
    /** Index STABLE de la ligne (énumération DFS complète) — à passer en `onlyLines`. */
    lineIndex: number;
    /** Le chemin adverse (clés des branches révélées) jusqu'à la faute. */
    enemyPath: string[];
    /** Chemin complet (nos coups + les leurs), faute incluse. */
    pathSteps: DrillStep[];
    seq: number;
    type: 'pick' | 'ban';
    /** Ta réponse. */
    answered: string;
    /** La préparée (primaire + fallback + reasonsFr). */
    expected: PlannedAction;
}

interface FlatChallenge {
    enemyMovesJustPlayed: RevealedEnemyMove[];
    expected: PlannedAction;
}

interface DrillLine {
    /** Index dans l'énumération DFS complète de l'arbre (identité stable). */
    sourceIndex: number;
    /** Suite d'indices de branches racine→feuille. */
    branchPath: number[];
    challenges: FlatChallenge[];
}

export interface DrillCounts {
    primaire: number;
    fallback: number;
    faux: number;
}

export interface DrillState {
    readonly tree: PlanTree;
    readonly mode: DrillMode;
    /** Lignes de LA session (filtrées par onlyLines le cas échéant). */
    readonly lines: readonly DrillLine[];
    /** Ligne courante (index local) ; === lines.length quand la session est finie. */
    readonly lineIndex: number;
    /** Défi courant dans la ligne. */
    readonly stepIndex: number;
    readonly done: boolean;
    /** Chemin joué sur la ligne courante (reset à chaque nouvelle ligne). */
    readonly playedSteps: readonly DrillStep[];
    readonly counts: DrillCounts;
    readonly linesPlayed: number;
    readonly misses: readonly DrillMiss[];
}

export interface DrillOptions {
    mode: DrillMode;
    /** Uniforme [0, 1) INJECTÉ (p. ex. mulberry32(seed)) — requis en 'pondere'. */
    rng?: () => number;
    /**
     * Restreindre la session à ces lignes (indexes de l'énumération complète,
     * cf. DrillSummary.failedLineIndexes) — « rejouer seulement les ratés ».
     * Pris en compte en mode 'exhaustif' uniquement.
     */
    onlyLines?: number[];
}

export interface AnswerResult {
    correct: DrillVerdict;
    /** La réponse préparée du défi (feedback immédiat). */
    expected: PlannedAction;
    /** Le NOUVEL état (l'état d'entrée n'est pas muté). */
    state: DrillState;
    /** Fin de ligne (horizon / ligne mince) : résultat de ligne à afficher. */
    lineComplete: boolean;
    /** Le chemin complet de la ligne qui vient de se terminer. */
    completedLineSteps?: DrillStep[];
    done: boolean;
}

export interface DrillSummary {
    mode: DrillMode;
    /** Lignes de la session. */
    lineCount: number;
    linesPlayed: number;
    /** Réponses justes (primaire) / repli (fallback) / fausses. */
    counts: DrillCounts;
    /** Les ratés, chemin adverse → ta réponse → la préparée. */
    misses: DrillMiss[];
    /** Lignes avec ≥ 1 faute — indexes stables, à passer en onlyLines. */
    failedLineIndexes: number[];
    done: boolean;
}

// ---- énumération des lignes --------------------------------------------------------

/** Type du slot template (les seq adverses viennent du compile, donc du template). */
function templateTypeOf(seq: number): 'pick' | 'ban' {
    return DRAFT_TEMPLATE.find((s) => s.seq === seq)?.type ?? 'pick';
}

/** Toutes les lignes racine→feuille, DFS, branche 0 (masse max) d'abord. */
function enumerateLines(root: PlanTreeNode): number[][] {
    const out: number[][] = [];
    const walk = (node: PlanTreeNode, prefix: number[]): void => {
        if (node.branches.length === 0) {
            out.push(prefix);
            return;
        }
        for (let i = 0; i < node.branches.length; i++) walk(node.branches[i].child, [...prefix, i]);
    };
    walk(root, []);
    return out;
}

/** Aplatit une ligne en défis : NOS actions, chacune précédée des révélations adverses. */
function flattenLine(tree: PlanTree, branchPath: number[]): FlatChallenge[] {
    const out: FlatChallenge[] = [];
    let pending: RevealedEnemyMove[] = [];
    const pushOurs = (node: PlanTreeNode): void => {
        for (const expected of node.ourLine) {
            out.push({ enemyMovesJustPlayed: pending, expected });
            pending = [];
        }
    };
    let node = tree.root;
    pushOurs(node);
    for (const index of branchPath) {
        const branch = node.branches[index];
        const seq = node.enemySeq ?? branch.child.ourLine[0]?.seq ?? 0;
        pending.push({
            seq,
            type: templateTypeOf(seq),
            championKey: branch.championKey,
            p: branch.p,
            rawCount: branch.rawCount,
            total: branch.total
        });
        node = branch.child;
        pushOurs(node);
    }
    // Révélation adverse en fin de ligne sans réponse à nous : rien à driller.
    return out;
}

/** Index de la branche de masse max (défensif : l'arbre stocké est déjà trié p desc). */
function argmaxBranch(node: PlanTreeNode): number {
    let best = 0;
    for (let i = 1; i < node.branches.length; i++) {
        if (node.branches[i].p > node.branches[best].p) best = i;
    }
    return best;
}

/** Tirage ∝ p sur les branches CONSERVÉES (p bruts renormalisés par leur somme). */
function sampleBranch(node: PlanTreeNode, rng: () => number): number {
    let totalMass = 0;
    for (const branch of node.branches) totalMass += branch.p;
    if (totalMass <= 0) return 0; // masses dégénérées : première branche, déterministe
    const r = rng() * totalMass;
    let cumulative = 0;
    for (let i = 0; i < node.branches.length; i++) {
        cumulative += node.branches[i].p;
        if (r < cumulative) return i;
    }
    return node.branches.length - 1;
}

/** Une ligne unique en suivant `choose` à chaque nœud à branches. */
function singleLine(root: PlanTreeNode, choose: (node: PlanTreeNode) => number): number[] {
    const path: number[] = [];
    let node = root;
    while (node.branches.length > 0) {
        const index = choose(node);
        path.push(index);
        node = node.branches[index].child;
    }
    return path;
}

// ---- lectures rapides -----------------------------------------------------------------

/**
 * Vrai si l'arbre porte AU MOINS un défi drillable — une PlannedAction à nous
 * (ourLine) quelque part. Faux ⇔ startDrill rendrait une session à 0 ligne :
 * plan sans picks/bans renseignés, ou arbre compilé sans évaluateur ni
 * mapping statique. Le panneau le lit AVANT de proposer « Démarrer ».
 */
export function hasChallenges(tree: PlanTree): boolean {
    const visit = (node: PlanTreeNode): boolean =>
        node.ourLine.length > 0 || node.branches.some((branch) => visit(branch.child));
    return visit(tree.root);
}

// ---- session ------------------------------------------------------------------------

/**
 * Démarre une session de drill. Pur : même arbre + mêmes options (rng compris)
 * → même session. Les lignes sans AUCUN défi (aucune action à nous) sont
 * écartées — mais leur index dans l'énumération complète reste compté, pour
 * que `onlyLines` soit stable entre sessions.
 */
export function startDrill(tree: PlanTree, options: DrillOptions): DrillState {
    const { mode, rng, onlyLines } = options;
    if (mode === 'pondere' && rng === undefined) {
        throw new Error("mode 'pondere' : un rng injecté est requis (jamais Math.random)");
    }

    const all = enumerateLines(tree.root);
    let branchPaths: { sourceIndex: number; branchPath: number[] }[];
    if (mode === 'exhaustif') {
        const wanted = onlyLines === undefined ? null : new Set(onlyLines);
        branchPaths = all
            .map((branchPath, sourceIndex) => ({ sourceIndex, branchPath }))
            .filter(({ sourceIndex }) => wanted === null || wanted.has(sourceIndex));
    } else {
        const choose =
            mode === 'principale'
                ? argmaxBranch
                : (node: PlanTreeNode): number => sampleBranch(node, rng as () => number);
        const branchPath = singleLine(tree.root, choose);
        // Identité stable même en ligne unique : son index DFS dans l'arbre.
        const sourceIndex = all.findIndex(
            (candidate) => candidate.length === branchPath.length && candidate.every((v, i) => v === branchPath[i])
        );
        branchPaths = [{ sourceIndex: Math.max(0, sourceIndex), branchPath }];
    }

    const lines: DrillLine[] = branchPaths
        .map(({ sourceIndex, branchPath }) => ({
            sourceIndex,
            branchPath,
            challenges: flattenLine(tree, branchPath)
        }))
        .filter((line) => line.challenges.length > 0);

    return {
        tree,
        mode,
        lines,
        lineIndex: 0,
        stepIndex: 0,
        done: lines.length === 0,
        playedSteps: [],
        counts: { primaire: 0, fallback: 0, faux: 0 },
        linesPlayed: 0,
        misses: []
    };
}

/** Le point où NOUS devons jouer — null si la session est finie. */
export function currentChallenge(state: DrillState): DrillChallenge | null {
    if (state.done) return null;
    const line = state.lines[state.lineIndex];
    const challenge = line?.challenges[state.stepIndex];
    if (line === undefined || challenge === undefined) return null;
    return {
        enemyMovesJustPlayed: challenge.enemyMovesJustPlayed,
        expected: challenge.expected,
        seq: challenge.expected.seq,
        type: challenge.expected.type,
        pathSoFar: state.playedSteps,
        lineIndex: state.lineIndex,
        lineCount: state.lines.length
    };
}

/**
 * Répond au défi courant. Verdict : primaire / fallback / faux ; le drill
 * descend l'arbre ; en fin de ligne, enchaîne la ligne suivante (exhaustif)
 * ou termine la session. Retourne un NOUVEL état.
 */
export function answer(state: DrillState, championKey: string): AnswerResult {
    const line = state.lines[state.lineIndex];
    const challenge = line?.challenges[state.stepIndex];
    if (state.done || line === undefined || challenge === undefined) {
        throw new Error('answer : la session est terminée (currentChallenge === null)');
    }
    const expected = challenge.expected;
    const correct: DrillVerdict =
        championKey === expected.championKey
            ? 'primaire'
            : expected.fallback !== undefined && championKey === expected.fallback
              ? 'fallback'
              : 'faux';

    const playedSteps: DrillStep[] = [
        ...state.playedSteps,
        ...challenge.enemyMovesJustPlayed.map(
            (move): DrillStep => ({
                by: 'eux',
                seq: move.seq,
                type: move.type,
                championKey: move.championKey
            })
        ),
        {
            by: 'nous',
            seq: expected.seq,
            type: expected.type,
            championKey: expected.championKey,
            answeredKey: championKey,
            verdict: correct
        }
    ];

    const counts: DrillCounts = { ...state.counts, [correct]: state.counts[correct] + 1 };
    const misses =
        correct === 'faux'
            ? [
                  ...state.misses,
                  {
                      lineIndex: line.sourceIndex,
                      enemyPath: playedSteps.filter((s) => s.by === 'eux').map((s) => s.championKey),
                      pathSteps: playedSteps,
                      seq: expected.seq,
                      type: expected.type,
                      answered: championKey,
                      expected
                  }
              ]
            : state.misses;

    let lineIndex = state.lineIndex;
    let stepIndex = state.stepIndex + 1;
    let linesPlayed = state.linesPlayed;
    let nextSteps: readonly DrillStep[] = playedSteps;
    let done = false;
    const lineComplete = stepIndex >= line.challenges.length;
    if (lineComplete) {
        linesPlayed += 1;
        lineIndex += 1;
        stepIndex = 0;
        nextSteps = [];
        done = lineIndex >= state.lines.length;
    }

    return {
        correct,
        expected,
        lineComplete,
        ...(lineComplete ? { completedLineSteps: playedSteps } : {}),
        done,
        state: {
            ...state,
            lineIndex,
            stepIndex,
            done,
            playedSteps: nextSteps,
            counts,
            linesPlayed,
            misses
        }
    };
}

/** Le bilan de session : lignes jouées, justes/repli/fausses, les ratés. */
export function drillSummary(state: DrillState): DrillSummary {
    const failed: number[] = [];
    for (const miss of state.misses) {
        if (!failed.includes(miss.lineIndex)) failed.push(miss.lineIndex);
    }
    return {
        mode: state.mode,
        lineCount: state.lines.length,
        linesPlayed: state.linesPlayed,
        counts: { ...state.counts },
        misses: [...state.misses],
        failedLineIndexes: failed,
        done: state.done
    };
}
