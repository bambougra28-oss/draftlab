/*
F2 — LA SURPRISE CASSE LA LECTURE DES RÔLES (chantier F, run #2). Règle
pré-enregistrée, à geler verbatim dans l'en-tête de
scripts/backtest/roleSurprise.ts AVANT tout run. Restriction du harnais VALIDÉ
scripts/backtest/roleInference.ts (règle 2026-06-10 : priors ligue walk-forward
fitRolePriors, énumération jointe roleAssignmentHypotheses, fallback uniforme
pour champion inconnu, top-hypothèse, k ∈ {3,5}) — rien n'est recodé, le
scoring est importé.

PRÉCONDITION (bloquante) : identique à F1 (re-pull + validateur Bo + amendement
d'architecte ; hashes publiés).

CORPUS : les 7 fichiers canoniques (mêmes que F1).

ÉVÉNEMENTS (structurels, fold only — fold = fitRolePriors des records de patchs
strictement antérieurs, même corpus, patron du harnais) : CLASSE A « hors-rôle
établi » : pick résolu (c, r) d'un side rôle-complet tel que compte fold de
(c, r) = 0 ET compte fold de c tous rôles ≥ 5 — le piège Nasus générique (un
champion à identité de rôle établie, déplacé). CLASSE B « hors-corpus » :
compte fold de c = 0 — le chemin fallback uniforme (le cas G2-Nasus réel dans
lec-2026). Un FLEX légitime (les deux rôles ≥ 1 au fold) n'est JAMAIS un
événement. Side à événement = (game, side, k=5) contenant ≥ 1 événement de la
classe ; un side peut porter les deux classes (compté dans chacune, déclaré).

TAUTOLOGIE DÉCLARÉE ET NEUTRALISÉE : en classe A, l'accuracy sur le champion
surprise lui-même est 0 % PAR CONSTRUCTION (le vrai rôle a un prior fold nul ⇒
roleAssignmentHypotheses, qui exige weight > 0, exclut la vérité de H). Ce 0
est publié comme THÉORÈME (l'explication mécanique du trou) et n'entre dans
AUCUN critère.

MÉTRIQUE PRIMAIRE (l'empirique qui justifie F-c) : à k = 5, acc_contaminée =
accuracy de la top-hypothèse jointe sur les champions VOISINS des sides
classe A — voisin = champion du side qui n'est pas lui-même un événement
classe A (dans les ~3 sides à double événement, les 2 scores mutuels,
tautologiques à 0 % par théorème, sont EXCLUS : le 0 du théorème n'entre
ainsi dans aucun critère, mécaniquement) ; acc_saine = accuracy top-hypothèse
k=5 sur les sides sans AUCUN événement (ni A ni B) des mêmes corpus ;
Δ_contamination = acc_contaminée − acc_saine.

CRITÈRE DE VERDICT (gelé) : IC bootstrap 95 % de Δ_contamination, resampling
par CLUSTER de série, statistique recalculée par resample (patron S2 du
chantier C), 1000 resamples, mulberry32(seed 42), flux unique en ordre fixe
(critère primaire puis S3 puis S4 ; une secondaire publiée sans IC ne consomme
rien). hi < 0 ⇒ F2 VERTE (la
surprise contamine significativement la lecture des voisins par injectivité).
IC touchant 0 ⇒ ORANGE (non significatif). lo > 0 ⇒ ROUGE remarquable
(l'injectivité absorbe la surprise), publié tel quel. PRÉDICTION
PRÉ-ENREGISTRÉE : Δ < 0, ampleur ≥ 5 pp.

PUISSANCE DÉCLARÉE (comptes structurels pris le 2026-06-11 AVANT gel, AUCUNE
accuracy calculée sur ces tranches) : classe A ≈ 146 événements / 143 sides /
131 clusters de série (par gameNumber : 49/38/37/15/7 ; par index de pick du
side : 35/26/18/25/42) ⇒ ~578 scores de voisins (146×4 = 584 paires moins ~6
tautologiques des sides doubles ; recompte exact publié par --audit-only) — un
effet ≥ 5 pp sur une base
~93,4 % (k=5 pooled validé) est détectable même avec l'inflation de cluster ;
classe B ≈ 818 événements / 642 sides. Baselines de contexte publiées :
accuracy pooled k=5 = 93,4 % [93,0;93,7] et k=3 = 95,0 % [94,7;95,4] (rapport
role-inference-2026.md, à RE-MESURER sur les corpora re-pullés — les chiffres
du rapport peuvent bouger marginalement, déclaré).

SECONDAIRES (descriptives, AUCUN pouvoir de verdict) : S1 — accuracy sur le
champion surprise en CLASSE B (uniforme + injectivité : il peut être bien placé
PAR ÉLIMINATION — exemple attendu : Nasus G5, 4 voisins lisibles ⇒ jungle en
reste) ; S2 — le théorème classe A (0 %) et sa pédagogie ; S3 —
Δ_contamination en classe B ; S4 — contamination à k = 3 restreinte aux
événements dans les 3 premiers picks du side (n attendu ≈ 79) ; S5 — table des
événements (champion, rôle réel, rôle prédit pour lui et ses voisins, équipe,
gameId). COUVERTURE : sides écartés par cause.

GARDE DE BRANCHEMENT F-c (gelée ici, conséquence exclusive de F2) : F-c ne se
branche QUE si F2 est VERTE. Mécanisme alors branché SANS nouveau paramètre :
pour le champion déclencheur SEUL, priors de rôle remplacés par l'uniforme
(β = 1 — le chemin classe B déjà testé du système), déclencheur live =
surpriseOf.bits ≥ surpriseAlarmBits = 5 (rangeModelConfig commitée ; ε = 1e-3
⇒ bits ≤ ~9,97) ET rôle-novelté structurelle (compte train équipe+ligue de
(c, rôle le plus probable de la lecture courante) = 0). Après branchement,
RE-RUN OBLIGATOIRE de
scripts/backtest/roleInference.ts : non-régression exigée accuracy pooled
k=3 ≥ 94,5 %, sinon F-c débranché et le rouge documenté — le système VERT
pré-enregistré (95,0 %) prime sur toute défense nouvelle.

FUITES / FISHING : priors fold-only (walk-forward strict du harnais validé) ;
définitions structurelles, aucune issue lue ; confound déclaré : les sides à
événement diffèrent des sides sains (games plus tardives, métas plus
étranges) — non éliminable, ampleur attendue >> biais plausible ; UNE primaire,
secondaires étiquetées d'avance ; --audit-only n'imprime que des comptes ;
commit de l'en-tête avant le run.

RUN : node --experimental-transform-types --no-warnings
scripts/backtest/roleSurprise.ts static/corpus/lck-2026.json
static/corpus/lec-2026.json static/corpus/lfl-2026.json
static/corpus/lpl-2026.json data/corpus/lec-2025.json data/corpus/lfl-2025.json
data/corpus/lpl-2025.json [--seed 42] [--audit-only] [--generated-at ISO]
[--out docs/calibration/role-surprise-f2.md]

--- FIN DE LA RÈGLE GELÉE (recopiée VERBATIM de docs/run2/F-pocket-picks.md §3.2) ---

LES RUNS RÉELS SONT ARCHITECTE-ONLY (préconditions §0 bloquantes).
*/
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const libRootHref = pathToFileURL(resolve(repoRoot, 'src', 'lib')).href;

registerHooks({
    resolve(specifier, context, nextResolve) {
        const isLib = specifier.startsWith('$lib/');
        const base = isLib ? `${libRootHref}/${specifier.slice('$lib/'.length)}` : specifier;
        const candidates = isLib
            ? [`${base}.ts`, `${base}/index.ts`]
            : base.startsWith('./') || base.startsWith('../')
              ? [base, `${base}.ts`, `${base}/index.ts`]
              : [base];
        let lastError: unknown;
        for (const candidate of candidates) {
            try {
                return nextResolve(candidate, context);
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    },
    load(url, context, nextLoad) {
        if (url.endsWith('.json')) {
            return {
                format: 'json',
                source: readFileSync(fileURLToPath(url), 'utf8'),
                shortCircuit: true
            };
        }
        return nextLoad(url, context);
    }
});

type FogModule = typeof import('../../src/lib/strategic/fogReveal');
type RolePriorsModule = typeof import('../../src/lib/aggregates/rolePriors');
type WalkforwardModule = typeof import('../../src/lib/backtest/walkforward');
type MetricsModule = typeof import('../../src/lib/backtest/metrics');
type PocketEventsModule = typeof import('../../src/lib/backtest/pocketEvents');
type DraftRecord = import('../../src/lib/data/types').DraftRecord;
type Role = import('../../src/lib/types').Role;

// Le scoring est IMPORTÉ du harnais validé — rien n'est recodé.
const { roleAssignmentHypotheses } = (await import(`${libRootHref}/strategic/fogReveal.ts`)) as FogModule;
const { fitRolePriors, rolePriorsOf } = (await import(`${libRootHref}/aggregates/rolePriors.ts`)) as RolePriorsModule;
const { comparePatches, parsePatch } = (await import(`${libRootHref}/backtest/walkforward.ts`)) as WalkforwardModule;
const { wilson95, mulberry32 } = (await import(`${libRootHref}/backtest/metrics.ts`)) as MetricsModule;
const { foldCountsOf, isClassAEvent, isClassBEvent, roleCompleteSidePicks, eventNeighborsOf } = (await import(
    `${libRootHref}/backtest/pocketEvents.ts`
)) as PocketEventsModule;

// ---- argv -------------------------------------------------------------------

const inputs: string[] = [];
let outPath = 'docs/calibration/role-surprise-f2.md';
let generatedAt = new Date().toISOString();
let auditOnly = false;
let seed = 42;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') outPath = argv[++i];
    else if (argv[i] === '--generated-at') generatedAt = argv[++i];
    else if (argv[i] === '--audit-only') auditOnly = true;
    else if (argv[i] === '--seed') seed = Number(argv[++i]);
    else inputs.push(argv[i]);
}
if (inputs.length === 0 || Number.isNaN(seed)) {
    console.error(
        'Usage: node --experimental-transform-types --no-warnings scripts/backtest/roleSurprise.ts ' +
            '<corpus.json> [...] [--seed 42] [--audit-only] [--generated-at ISO] [--out md]'
    );
    process.exit(1);
}

// ---- helpers -----------------------------------------------------------------

const inc = (map: Map<string, number>, key: string, by = 1): void => {
    map.set(key, (map.get(key) ?? 0) + by);
};
const pct = (x: number): string => (Number.isFinite(x) ? `${(100 * x).toFixed(1)} %` : '—');
const pp = (x: number): string => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${(100 * x).toFixed(2)} pp` : '—');

/** Quantile type-7 (patron metrics.ts/clusterBootstrap.ts) — recopié à l'identique. */
function quantileSorted(sorted: number[], q: number): number {
    if (sorted.length === 0) return NaN;
    const h = (sorted.length - 1) * q;
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

/** Fallback uniforme du harnais (readEnemyRoles doctrine) — copie conforme. */
const UNIFORM: Partial<Record<Role, number>> = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 };

const ROLE_FR = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];

// ---- collecte -----------------------------------------------------------------

interface Score {
    cluster: string;
    hit: boolean;
}

interface EventS5 {
    corpus: string;
    gameId: string;
    team: string;
    eventClass: 'A' | 'B';
    championName: string;
    realRole: Role;
    predictedRole: Role | undefined;
    neighbors: { championName: string; realRole: Role; predictedRole: Role | undefined }[];
}

interface CorpusAudit {
    corpus: string;
    sha256: string;
    records: number;
    sidesScanned: number;
    skipped: Map<string, number>;
    eventsA: number;
    eventsB: number;
    sidesA: number;
    sidesB: number;
    sidesBoth: number;
    sidesDoubleA: number;
    healthySides: number;
    neighborScoresA: number;
    eventsAFirst3: number;
}

const audits: CorpusAudit[] = [];
const contaminatedA: Score[] = [];
const contaminatedB: Score[] = [];
const healthyK5: Score[] = [];
const contaminatedK3: Score[] = [];
const healthyK3: Score[] = [];
const s1ClassB: Score[] = [];
const theoremScores: Score[] = []; // accuracy classe A sur le champion lui-même (attendu : 0 %)
const s5Rows: EventS5[] = [];
/** Baselines de contexte (RE-MESURE du harnais) : `${corpus}|k${k}` → {hits, n}. */
const contextTallies = new Map<string, { hits: number; n: number }>();

for (const input of inputs) {
    const bytes = readFileSync(resolve(repoRoot, input));
    const sha256 = createHash('sha256').update(bytes).digest('hex').toUpperCase();
    const records = JSON.parse(bytes.toString('utf8')) as DraftRecord[];
    const corpus = basename(input);

    // Fold walk-forward du harnais : fitRolePriors des patchs strictement antérieurs.
    const priorsByPatch = new Map<string, ReturnType<typeof fitRolePriors>>();
    const foldFor = (patch: string | undefined): ReturnType<typeof fitRolePriors> | undefined => {
        if (patch === undefined || parsePatch(patch) === undefined) return undefined;
        let fold = priorsByPatch.get(patch);
        if (fold === undefined) {
            fold = fitRolePriors(
                records.filter(
                    (r) =>
                        r.patch !== undefined &&
                        parsePatch(r.patch) !== undefined &&
                        comparePatches(r.patch, patch) < 0
                )
            );
            priorsByPatch.set(patch, fold);
        }
        return fold;
    };

    const skipped = new Map<string, number>();
    let sidesScanned = 0;
    let eventsA = 0;
    let eventsB = 0;
    let sidesA = 0;
    let sidesB = 0;
    let sidesBoth = 0;
    let sidesDoubleA = 0;
    let healthySides = 0;
    let neighborScoresA = 0;
    let eventsAFirst3 = 0;

    for (const record of records) {
        const fold = foldFor(record.patch);
        const cluster =
            record.series?.matchId !== undefined
                ? `${corpus}|${record.series.matchId}`
                : `${corpus}|game:${record.gameId}`;
        for (const side of ['blue', 'red'] as const) {
            sidesScanned += 1;
            if (fold === undefined) {
                inc(skipped, 'patch non plaçable');
                continue;
            }
            if (fold.picks === 0) {
                inc(skipped, 'fold vide (premier patch)');
                continue;
            }
            const picks = roleCompleteSidePicks(record, side);
            if (picks === undefined) {
                inc(skipped, 'side non rôle-complet');
                continue;
            }

            // Événements structurels (fold only).
            const aChampions = new Set<string>();
            const bChampions = new Set<string>();
            for (const pick of picks) {
                const counts = foldCountsOf(fold.byChampion.get(pick.championKey));
                if (isClassAEvent(counts, pick.role)) {
                    aChampions.add(pick.championKey);
                    eventsA += 1;
                }
                if (isClassBEvent(counts)) {
                    bChampions.add(pick.championKey);
                    eventsB += 1;
                }
            }

            // Scoring du harnais (importé) : priors ligue + fallback uniforme.
            const leaguePriors = rolePriorsOf(fold);
            const safePriors = (championKey: string): Partial<Record<Role, number>> => {
                const weights = leaguePriors(championKey);
                for (const value of Object.values(weights)) if ((value ?? 0) > 0) return weights;
                return UNIFORM;
            };
            const keys5 = picks.map((p) => p.championKey);
            const realRoleOf = new Map<string, Role>(picks.map((p) => [p.championKey, p.role]));
            const predictedOf = (keys: string[]): Map<string, Role> => {
                const top = roleAssignmentHypotheses(keys, safePriors)[0];
                const predicted = new Map<string, Role>();
                if (top !== undefined) {
                    for (const [role, key] of top.assignment) predicted.set(key, role);
                }
                return predicted;
            };
            const predicted5 = predictedOf(keys5);
            const keys3 = keys5.slice(0, 3);
            const predicted3 = predictedOf(keys3);

            // Baselines de contexte (RE-MESURE du harnais, k ∈ {3, 5}).
            for (const [k, predicted, keys] of [
                [3, predicted3, keys3],
                [5, predicted5, keys5]
            ] as const) {
                const tallyKey = `${corpus}|k${k}`;
                const tally = contextTallies.get(tallyKey) ?? { hits: 0, n: 0 };
                for (const key of keys) {
                    tally.n += 1;
                    if (predicted.get(key) === realRoleOf.get(key)) tally.hits += 1;
                }
                contextTallies.set(tallyKey, tally);
            }

            const hitOf = (key: string, predicted: Map<string, Role>): boolean =>
                predicted.get(key) === realRoleOf.get(key);

            if (aChampions.size > 0) {
                sidesA += 1;
                if (aChampions.size >= 2) sidesDoubleA += 1;
                // Voisins (exclusion tautologique MÉCANIQUE des sides doubles).
                const neighbors = eventNeighborsOf(keys5, aChampions);
                for (const [, neighborKeys] of neighbors) {
                    for (const key of neighborKeys) {
                        contaminatedA.push({ cluster, hit: hitOf(key, predicted5) });
                        neighborScoresA += 1;
                    }
                }
                // Théorème : le champion surprise lui-même (n'entre dans AUCUN critère).
                for (const key of aChampions) {
                    theoremScores.push({ cluster, hit: hitOf(key, predicted5) });
                }
                // S4 : événements classe A dans les 3 premiers picks du side.
                const aInWindow = new Set(keys3.filter((key) => aChampions.has(key)));
                if (aInWindow.size > 0) {
                    eventsAFirst3 += aInWindow.size;
                    const windowNeighbors = eventNeighborsOf(keys3, aInWindow);
                    for (const [, neighborKeys] of windowNeighbors) {
                        for (const key of neighborKeys) {
                            contaminatedK3.push({ cluster, hit: hitOf(key, predicted3) });
                        }
                    }
                }
            }
            if (bChampions.size > 0) {
                sidesB += 1;
                // S1 : le champion surprise classe B lui-même (par élimination).
                for (const key of bChampions) {
                    s1ClassB.push({ cluster, hit: hitOf(key, predicted5) });
                }
                // S3 : voisins des sides classe B (même définition de voisin).
                const neighbors = eventNeighborsOf(keys5, bChampions);
                for (const [, neighborKeys] of neighbors) {
                    for (const key of neighborKeys) {
                        contaminatedB.push({ cluster, hit: hitOf(key, predicted5) });
                    }
                }
            }
            if (aChampions.size > 0 && bChampions.size > 0) sidesBoth += 1;
            if (aChampions.size === 0 && bChampions.size === 0) {
                healthySides += 1;
                for (const key of keys5) healthyK5.push({ cluster, hit: hitOf(key, predicted5) });
                for (const key of keys3) healthyK3.push({ cluster, hit: hitOf(key, predicted3) });
            }

            // S5 : table des événements.
            const team = side === 'blue' ? record.blueTeam : record.redTeam;
            const nameOf = (key: string): string =>
                record.actions.find((a) => a.championKey === key && a.type === 'pick')?.championName ?? key;
            const pushRow = (eventClass: 'A' | 'B', champions: Set<string>): void => {
                const neighbors = eventNeighborsOf(keys5, champions);
                for (const key of champions) {
                    s5Rows.push({
                        corpus,
                        gameId: record.gameId,
                        team,
                        eventClass,
                        championName: nameOf(key),
                        realRole: realRoleOf.get(key) as Role,
                        predictedRole: predicted5.get(key),
                        neighbors: (neighbors.get(key) ?? []).map((neighborKey) => ({
                            championName: nameOf(neighborKey),
                            realRole: realRoleOf.get(neighborKey) as Role,
                            predictedRole: predicted5.get(neighborKey)
                        }))
                    });
                }
            };
            pushRow('A', aChampions);
            pushRow('B', bChampions);
        }
    }

    audits.push({
        corpus,
        sha256,
        records: records.length,
        sidesScanned,
        skipped,
        eventsA,
        eventsB,
        sidesA,
        sidesB,
        sidesBoth,
        sidesDoubleA,
        healthySides,
        neighborScoresA,
        eventsAFirst3
    });
}

// ---- mode --audit-only : comptes SEULEMENT, aucune accuracy -----------------------

if (auditOnly) {
    const lines: string[] = [];
    lines.push('# Audit F2 (--audit-only) — comptes structurels seulement, AUCUNE accuracy imprimée');
    lines.push('');
    lines.push(`> Généré : ${generatedAt}`);
    lines.push('');
    lines.push('| Corpus | sha256 (8) | Records | Sides scannés | Évts A | Évts B | Sides A | Sides B | Sides A∧B | Sides double-A | Sides sains | Scores voisins A | Évts A picks 1-3 |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    let totalA = 0;
    let totalNeighbors = 0;
    for (const a of audits) {
        totalA += a.eventsA;
        totalNeighbors += a.neighborScoresA;
        lines.push(
            `| ${a.corpus} | ${a.sha256.slice(0, 8)} | ${a.records} | ${a.sidesScanned} | ${a.eventsA} | ${a.eventsB} | ` +
                `${a.sidesA} | ${a.sidesB} | ${a.sidesBoth} | ${a.sidesDoubleA} | ${a.healthySides} | ` +
                `${a.neighborScoresA} | ${a.eventsAFirst3} |`
        );
    }
    lines.push('');
    lines.push('## Recompte exact des voisins classe A (la règle publie ce recompte ici)');
    lines.push('');
    lines.push(
        `- Paires naïves ${totalA} × 4 = ${totalA * 4} ; scores de voisins réels = ${totalNeighbors} ; ` +
            `scores mutuels tautologiques EXCLUS mécaniquement = ${totalA * 4 - totalNeighbors}.`
    );
    lines.push(`- Clusters porteurs (contaminés A ∪ sains k5) : ${new Set([...contaminatedA, ...healthyK5].map((s) => s.cluster)).size}.`);
    lines.push(`- S4 : ${contaminatedK3.length} scores de voisins k=3 (événements classe A dans les 3 premiers picks).`);
    lines.push(`- S1/S3 (classe B) : ${s1ClassB.length} champions surprise scorables, ${contaminatedB.length} scores de voisins.`);
    lines.push('');
    lines.push('## Sides écartés par cause');
    lines.push('');
    for (const a of audits) {
        const causes =
            a.skipped.size === 0
                ? 'aucun écarté'
                : [...a.skipped.entries()].map(([cause, n]) => `${cause} : ${n}`).join(' · ');
        lines.push(`- ${a.corpus} : ${causes}.`);
    }
    lines.push('');
    lines.push('> Mode --audit-only : AUCUNE accuracy, AUCUN Δ, AUCUN IC calculés ni imprimés.');
    console.log(lines.join('\n'));
    process.exit(0);
}

// ---- statistiques : flux mulberry32(seed) UNIQUE, ordre primaire → S3 → S4 ---------

const rng = mulberry32(seed);

const meanHit = (scores: Score[]): number =>
    scores.length === 0 ? NaN : scores.filter((s) => s.hit).length / scores.length;

/**
 * IC bootstrap du Δ = acc(groupe) − acc(sains) : resampling par CLUSTER de
 * série (union des clusters des deux groupes), statistique RECALCULÉE par
 * resample (patron S2 du chantier C) ; resample sans score d'un des deux
 * groupes ⇒ Δ non défini, resample écarté (déclaré, patron du ρ S2).
 */
function deltaBootstrap(group: Score[], healthy: Score[]): { lo: number; hi: number; kept: number } {
    const byCluster = new Map<string, { group: Score[]; healthy: Score[] }>();
    const bucketOf = (cluster: string): { group: Score[]; healthy: Score[] } => {
        let bucket = byCluster.get(cluster);
        if (bucket === undefined) {
            bucket = { group: [], healthy: [] };
            byCluster.set(cluster, bucket);
        }
        return bucket;
    };
    for (const score of group) bucketOf(score.cluster).group.push(score);
    for (const score of healthy) bucketOf(score.cluster).healthy.push(score);
    const clusters = [...byCluster.values()];
    const deltas: number[] = [];
    if (clusters.length > 0) {
        for (let i = 0; i < 1000; i++) {
            let groupHits = 0;
            let groupN = 0;
            let healthyHits = 0;
            let healthyN = 0;
            for (let c = 0; c < clusters.length; c++) {
                const drawn = clusters[Math.floor(rng() * clusters.length)];
                for (const s of drawn.group) {
                    groupN += 1;
                    if (s.hit) groupHits += 1;
                }
                for (const s of drawn.healthy) {
                    healthyN += 1;
                    if (s.hit) healthyHits += 1;
                }
            }
            if (groupN === 0 || healthyN === 0) continue;
            deltas.push(groupHits / groupN - healthyHits / healthyN);
        }
        deltas.sort((a, b) => a - b);
    }
    return { lo: quantileSorted(deltas, 0.025), hi: quantileSorted(deltas, 0.975), kept: deltas.length };
}

// 1. PRIMAIRE — Δ_contamination classe A (k = 5).
const accContaminated = meanHit(contaminatedA);
const accHealthy = meanHit(healthyK5);
const deltaContamination = accContaminated - accHealthy;
const primaryCi = deltaBootstrap(contaminatedA, healthyK5);
const verdict =
    primaryCi.hi < 0 ? 'F2 VERTE' : primaryCi.lo > 0 ? 'F2 ROUGE remarquable' : 'F2 ORANGE';
const verdictReason =
    primaryCi.hi < 0
        ? 'hi < 0 : la surprise contamine significativement la lecture des voisins par injectivité'
        : primaryCi.lo > 0
          ? 'lo > 0 : l’injectivité absorbe la surprise — publié tel quel'
          : 'IC touchant 0 : non significatif';

// 2. S3 — Δ_contamination en classe B (même flux, après la primaire).
const accContaminatedB = meanHit(contaminatedB);
const deltaB = accContaminatedB - accHealthy;
const s3Ci = deltaBootstrap(contaminatedB, healthyK5);

// 3. S4 — contamination à k = 3 (événements dans les 3 premiers picks).
const accContaminatedK3 = meanHit(contaminatedK3);
const accHealthyK3 = meanHit(healthyK3);
const deltaK3 = accContaminatedK3 - accHealthyK3;
const s4Ci = deltaBootstrap(contaminatedK3, healthyK3);

// Secondaires SANS IC (ne consomment rien) : S1, S2, S5, baselines de contexte.
const s1Acc = meanHit(s1ClassB);
const s1Wilson = wilson95(s1ClassB.filter((s) => s.hit).length, s1ClassB.length);
const theoremAcc = meanHit(theoremScores);

// ---- rapport markdown ----------------------------------------------------------

const lines: string[] = [];
lines.push('# Gate F2 — la surprise casse la lecture des rôles (chantier F, run #2)');
lines.push('');
lines.push(`> Généré : ${generatedAt} · seed ${seed} · règle pré-enregistrée VERBATIM en tête de \`scripts/backtest/roleSurprise.ts\``);
lines.push('> (design gelé docs/run2/F-pocket-picks.md §3.2). Restriction du harnais roleInference — scoring importé, rien recodé.');
lines.push(`> Corpus : ${inputs.map((i) => basename(i)).join(', ')}.`);
lines.push('');
lines.push('## Préconditions publiées');
lines.push('');
lines.push('| Fichier | sha256 |');
lines.push('|---|---|');
for (const a of audits) lines.push(`| ${a.corpus} | ${a.sha256} |`);
lines.push('');

// Événements.
lines.push('## Événements structurels (fold only)');
lines.push('');
lines.push('| Corpus | Évts A | Évts B | Sides A | Sides B | Sides A∧B (déclaré) | Sides double-A | Sides sains | Scores voisins A |');
lines.push('|---|---|---|---|---|---|---|---|---|');
for (const a of audits) {
    lines.push(
        `| ${a.corpus} | ${a.eventsA} | ${a.eventsB} | ${a.sidesA} | ${a.sidesB} | ${a.sidesBoth} | ` +
            `${a.sidesDoubleA} | ${a.healthySides} | ${a.neighborScoresA} |`
    );
}
const totalA = audits.reduce((sum, a) => sum + a.eventsA, 0);
const totalNeighbors = audits.reduce((sum, a) => sum + a.neighborScoresA, 0);
lines.push('');
lines.push(
    `Recompte voisins classe A : ${totalA} × 4 = ${totalA * 4} paires naïves − ` +
        `${totalA * 4 - totalNeighbors} scores mutuels tautologiques (sides doubles, exclus MÉCANIQUEMENT) = ${totalNeighbors}.`
);
lines.push('');

// S2 — théorème.
lines.push('## S2 — le théorème classe A (pédagogie, n’entre dans AUCUN critère)');
lines.push('');
lines.push(
    `- Accuracy sur le champion surprise classe A lui-même : ${pct(theoremAcc)} sur ${theoremScores.length} événements — ` +
        'attendu 0 % PAR CONSTRUCTION : le vrai rôle a un prior fold nul, roleAssignmentHypotheses (weight > 0) exclut la vérité de H.'
);
lines.push('- Toute valeur ≠ 0 % serait un bug de définition, pas une découverte.');
lines.push('');

// Primaire.
lines.push('## Primaire — Δ_contamination (k = 5)');
lines.push('');
lines.push('| Tranche | Scores | Accuracy |');
lines.push('|---|---|---|');
lines.push(`| Voisins des sides classe A (contaminés) | ${contaminatedA.length} | ${pct(accContaminated)} |`);
lines.push(`| Sides sans AUCUN événement (sains) | ${healthyK5.length} | ${pct(accHealthy)} |`);
lines.push('');
lines.push(
    `- **Δ_contamination = ${pp(deltaContamination)}**, IC bootstrap 95 % cluster par série ` +
        `[${pp(primaryCi.lo)} ; ${pp(primaryCi.hi)}] (${primaryCi.kept}/1000 resamples définis).`
);
lines.push(`- Prédiction pré-enregistrée : Δ < 0, ampleur ≥ 5 pp.`);
lines.push('');
lines.push(`**Verdict : ${verdict}** — ${verdictReason}.`);
lines.push('');
lines.push(
    '**Garde de branchement F-c (conséquence exclusive)** : F-c ne se branche QUE si F2 est VERTE — puis RE-RUN ' +
        'obligatoire de scripts/backtest/roleInference.ts, non-régression accuracy pooled k=3 ≥ 94,5 % exigée, sinon ' +
        'F-c débranché et le rouge documenté (le système VERT pré-enregistré prime).'
);
lines.push('');

// S1.
lines.push('## S1 — classe B : le champion surprise lui-même (par élimination)');
lines.push('');
lines.push(
    `- Accuracy top-hypothèse k=5 sur le champion classe B : ${pct(s1Acc)} ` +
        `[${pct(s1Wilson.lo)} ; ${pct(s1Wilson.hi)}] sur ${s1ClassB.length} événements (uniforme + injectivité — ` +
        'exemple attendu : Nasus G5, 4 voisins lisibles ⇒ jungle en reste).'
);
lines.push('');

// S3.
lines.push('## S3 — Δ_contamination en classe B (descriptif)');
lines.push('');
lines.push(
    `- Voisins des sides classe B : ${pct(accContaminatedB)} (${contaminatedB.length} scores) vs sains ${pct(accHealthy)} — ` +
        `Δ = ${pp(deltaB)}, IC [${pp(s3Ci.lo)} ; ${pp(s3Ci.hi)}] (${s3Ci.kept}/1000).`
);
lines.push('');

// S4.
lines.push('## S4 — contamination à k = 3 (événements dans les 3 premiers picks du side)');
lines.push('');
lines.push(
    `- Voisins k=3 contaminés : ${pct(accContaminatedK3)} (${contaminatedK3.length} scores) vs sains k=3 ${pct(accHealthyK3)} ` +
        `(${healthyK3.length}) — Δ = ${pp(deltaK3)}, IC [${pp(s4Ci.lo)} ; ${pp(s4Ci.hi)}] (${s4Ci.kept}/1000).`
);
lines.push('');

// Baselines de contexte.
lines.push('## Baselines de contexte (RE-MESURE du harnais sur ces corpora, déclarée)');
lines.push('');
lines.push('| Tranche | n champions | Accuracy | Wilson 95 % |');
lines.push('|---|---|---|---|');
for (const k of [3, 5]) {
    let hits = 0;
    let n = 0;
    for (const input of inputs) {
        const tally = contextTallies.get(`${basename(input)}|k${k}`);
        if (tally !== undefined) {
            hits += tally.hits;
            n += tally.n;
        }
    }
    const ci = wilson95(hits, n);
    lines.push(`| TOUS — top-hypothèse k=${k} | ${n} | ${pct(n > 0 ? hits / n : NaN)} | [${pct(ci.lo)} ; ${pct(ci.hi)}] |`);
}
lines.push('');

// S5.
lines.push('## S5 — table des événements (champion, rôle réel, rôle prédit pour lui et ses voisins, équipe, gameId)');
lines.push('');
lines.push('| Corpus | Classe | Champion | Rôle réel | Rôle prédit | Voisins (réel → prédit) | Équipe | gameId |');
lines.push('|---|---|---|---|---|---|---|---|');
const roleLabel = (role: Role | undefined): string => (role === undefined ? '∅' : (ROLE_FR[role] ?? `${role}`));
for (const row of s5Rows) {
    const neighbors = row.neighbors
        .map((n) => `${n.championName} (${roleLabel(n.realRole)} → ${roleLabel(n.predictedRole)})`)
        .join(' · ');
    lines.push(
        `| ${row.corpus} | ${row.eventClass} | ${row.championName} | ${roleLabel(row.realRole)} | ` +
            `${roleLabel(row.predictedRole)} | ${neighbors} | ${row.team} | ${row.gameId} |`
    );
}
lines.push('');

// Couverture.
lines.push('## Couverture — sides écartés par cause');
lines.push('');
for (const a of audits) {
    const causes =
        a.skipped.size === 0
            ? 'aucun écarté'
            : [...a.skipped.entries()].map(([cause, n]) => `${cause} : ${n}`).join(' · ');
    lines.push(`- ${a.corpus} : ${a.sidesScanned} sides scannés ; ${causes}.`);
}
lines.push('');

// Notes.
lines.push('## Notes');
lines.push('');
lines.push(`- Flux rng UNIQUE mulberry32(${seed}) consommé en ordre fixe : primaire → S3 → S4 (1000 resamples chacun, statistique recalculée par resample, patron S2 du chantier C) ; S1/S2/S5 et les baselines de contexte sont publiées SANS IC bootstrap et ne consomment rien.`);
lines.push('- Resamples sans score d’un des deux groupes écartés et comptés (colonne kept) — patron du ρ S2.');
lines.push('- Cluster = série (corpus, matchId) ; game sans série = son propre cluster.');
lines.push('- Confound déclaré : les sides à événement diffèrent des sides sains (games plus tardives, métas plus étranges) — non éliminable.');
lines.push('- Un side peut porter les deux classes (compté dans chacune — colonne « Sides A∧B »).');
lines.push('- Une règle, un run : tout rouge est gelé ; toute nouvelle piste = NOUVEL en-tête daté.');
lines.push('');

const markdown = lines.join('\n') + '\n';
const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, markdown, 'utf8');
console.log(markdown);
console.log(`Écrit : ${absOut}`);
console.log(`Verdict : ${verdict}`);
