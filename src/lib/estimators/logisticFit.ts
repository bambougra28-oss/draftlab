/**
 * Chantier R4 (run #4) — régression logistique multi-features par Newton/IRLS.
 *
 * Généralise `platt.ts` (le cas k = 1, feature z = logit(p_raw)) à k features.
 * Reprend `platt.ts` AU CARACTÈRE PRÈS (amendement R3 du design R4) afin que
 * l'ancre de test `logisticFit([{x:[z],y}], …).beta == [plattFit.a, plattFit.b]`
 * soit exacte à 1e-12 :
 *   - ridge λ ajouté à TOUTE la diagonale du Hessien, intercept COMPRIS
 *     (platt.ts:75,77 ajoute RIDGE à haa ET hbb) ;
 *   - init = identité du cas Platt : β₀ = 0, βⱼ = 1 sur chaque feature ;
 *   - early-stop STEP_TOL = 1e-10 ; garde det/solve non fini ⇒ break ;
 *   - budget maxIter = régularisation implicite sur données séparables.
 *
 * Modèle : p = σ(β₀ + Σⱼ βⱼ·xⱼ). Cible y ∈ {0,1}.
 * Gradient gₘ = Σᵢ (qᵢ − yᵢ)·φᵢₘ ; Hessien Hₘₗ = λ·[m=l] + Σᵢ wᵢ·φᵢₘ·φᵢₗ,
 * avec φᵢ = [1, xᵢ₁, …, xᵢₖ], qᵢ = σ(φᵢ·β), wᵢ = qᵢ(1−qᵢ). Pas de Newton :
 * β ← β − H⁻¹·g (résolu par élimination de Gauss avec pivot partiel sur le
 * petit système (k+1)×(k+1) ; k ≤ 3 dans R4).
 */

/** Une ligne d'entraînement : vecteur de features + issue binaire. */
export interface LogisticRow {
    x: number[];
    y: 0 | 1;
}

/** Coefficients ajustés : [β₀ (intercept), β₁, …, βₖ]. */
export interface LogisticFit {
    beta: number[];
}

export interface LogisticOptions {
    /** Ridge L2 sur TOUTE la diagonale (intercept compris). */
    ridge: number;
    /** Budget d'itérations Newton (régularisation implicite). */
    maxIter: number;
}

/** Arrêt quand le pas de Newton est numériquement immobile (= platt.ts). */
const STEP_TOL = 1e-10;
/** Clamp de probabilité pour une NLL finie (= platt.ts EPS_P). */
const EPS_P = 1e-6;
/** Budget de halving de la recherche linéaire (amendement R13). */
const MAX_HALVING = 40;

/** Logistique numériquement stable (identique platt.ts). */
function sigmoid(x: number): number {
    if (x >= 0) return 1 / (1 + Math.exp(-x));
    const e = Math.exp(x);
    return e / (1 + e);
}

const clampP = (p: number): number => Math.min(1 - EPS_P, Math.max(EPS_P, p));

/**
 * Résout A·u = g pour u (A symétrique (n×n) définie positive après ridge) par
 * élimination de Gauss à pivot partiel. Renvoie null si A est singulière /
 * non finie (le caller fait alors `break`, comme platt.ts sur det ≤ 0).
 */
function solve(A: number[][], g: number[]): number[] | null {
    const n = g.length;
    // Matrice augmentée [A | g], copiée (on ne mute pas l'appelant).
    const m: number[][] = A.map((row, i) => [...row, g[i]]);
    for (let col = 0; col < n; col++) {
        // Pivot partiel : la plus grande magnitude sur la colonne.
        let pivot = col;
        for (let r = col + 1; r < n; r++) {
            if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
        }
        if (!Number.isFinite(m[pivot][col]) || Math.abs(m[pivot][col]) < 1e-300) return null;
        if (pivot !== col) {
            const tmp = m[pivot];
            m[pivot] = m[col];
            m[col] = tmp;
        }
        const diag = m[col][col];
        for (let r = 0; r < n; r++) {
            if (r === col) continue;
            const factor = m[r][col] / diag;
            if (factor === 0) continue;
            for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c];
        }
    }
    const u = new Array<number>(n);
    for (let i = 0; i < n; i++) {
        u[i] = m[i][n] / m[i][i];
        if (!Number.isFinite(u[i])) return null;
    }
    return u;
}

/**
 * Ajuste β par Newton/IRLS sur la log-vraisemblance, depuis l'init identité
 * (β₀ = 0, βⱼ = 1). `rows` doivent toutes avoir la même longueur de `x` (k) ;
 * la matrice de design a k+1 colonnes (intercept en tête). Lignes vides
 * interdites (RangeError, comme plattFit).
 */
export function logisticFit(rows: LogisticRow[], opts: LogisticOptions): LogisticFit {
    if (rows.length === 0) {
        throw new RangeError('logisticFit: rows must be non-empty');
    }
    const k = rows[0].x.length;
    for (const row of rows) {
        if (row.x.length !== k) {
            throw new RangeError('logisticFit: all rows must share feature length');
        }
    }
    const { ridge, maxIter } = opts;
    const dim = k + 1; // intercept + features

    // φᵢ = [1, xᵢ…] ; yᵢ.
    const phi = rows.map((row) => [1, ...row.x]);
    const y = rows.map((row) => (row.y ? 1 : 0));

    // Moyenne (sur n) de la log-vraisemblance négative — sert à la recherche
    // linéaire (R13). Clamp identique platt.ts pour rester fini sous saturation.
    const nll = (b: number[]): number => {
        let total = 0;
        for (let i = 0; i < phi.length; i++) {
            let lin = 0;
            for (let m = 0; m < dim; m++) lin += b[m] * phi[i][m];
            const q = clampP(sigmoid(lin));
            total += y[i] ? -Math.log(q) : -Math.log(1 - q);
        }
        return total;
    };

    // Init identité : intercept 0, chaque feature 1 (= plattFit a=0, b=1 en k=1).
    const beta = new Array<number>(dim).fill(1);
    beta[0] = 0;

    for (let iter = 0; iter < maxIter; iter++) {
        const g = new Array<number>(dim).fill(0);
        const H: number[][] = Array.from({ length: dim }, (_, m) =>
            Array.from({ length: dim }, (_, l) => (m === l ? ridge : 0))
        );
        for (let i = 0; i < phi.length; i++) {
            let lin = 0;
            for (let m = 0; m < dim; m++) lin += beta[m] * phi[i][m];
            const q = sigmoid(lin);
            const r = q - y[i];
            const w = q * (1 - q);
            for (let m = 0; m < dim; m++) {
                g[m] += r * phi[i][m];
                for (let l = m; l < dim; l++) {
                    H[m][l] += w * phi[i][m] * phi[i][l];
                }
            }
        }
        // Symétriser (on n'a rempli que le triangle supérieur).
        for (let m = 0; m < dim; m++) {
            for (let l = m + 1; l < dim; l++) H[l][m] = H[m][l];
        }
        const step = solve(H, g);
        if (step === null) break;
        // R13 — NEWTON AMORTI (recherche linéaire par halving). Newton non amorti
        // diverge sur données quasi-séparables : un pas déborde, q sature, w→0,
        // le Hessien tombe au ridge, le pas suivant explose (β→10⁸). On n'accepte
        // un pas que s'il ne fait pas REMONTER la NLL, sinon on le divise par 2.
        // C'est une garantie de CONVERGENCE (aveugle au résultat), pas un
        // changement de modèle : le pas plein t=1 est accepté quand Newton
        // descend (cas non séparable) ⇒ l'équivalence avec plattFit (§2.3-4) est
        // préservée. La donnée n'étant pas séparable (MLE fini), le ridge n'a
        // aucune influence sur l'optimum (vérifié : β identique pour ridge ∈
        // {1e-6, 1, √n}).
        const f0 = nll(beta);
        let t = 1;
        let accepted = false;
        for (let h = 0; h < MAX_HALVING; h++) {
            const trial = beta.map((b, m) => b - t * step[m]);
            if (nll(trial) <= f0 + 1e-12) {
                for (let m = 0; m < dim; m++) beta[m] = trial[m];
                accepted = true;
                break;
            }
            t /= 2;
        }
        if (!accepted) break; // aucune direction de descente trouvée ⇒ convergé
        let maxStep = 0;
        for (let m = 0; m < dim; m++) {
            if (Math.abs(t * step[m]) > maxStep) maxStep = Math.abs(t * step[m]);
        }
        if (maxStep < STEP_TOL) break;
    }
    return { beta };
}

/** Applique le fit : σ(β₀ + Σⱼ βⱼ·xⱼ). `x` doit avoir k = beta.length − 1 features. */
export function logisticPredict(fit: LogisticFit, x: number[]): number {
    const { beta } = fit;
    let lin = beta[0];
    for (let j = 0; j < x.length; j++) lin += beta[j + 1] * x[j];
    return sigmoid(lin);
}
