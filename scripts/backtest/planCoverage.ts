/**
 * Chantier D (run #2) — Gate de couverture des plans à branches.
 *
 * RÈGLE PRÉ-ENREGISTRÉE — gelée TELLE QUELLE depuis docs/run2/D-plans-branches.md §1
 * (2026-06-11, post-revue adversariale) AVANT tout run sur données réelles.
 * Aucun paramètre ne bouge après lecture des résultats.
 *
 * ## 1.1 La question
 *
 * Un arbre de prep contre une équipe T (branches = top-K du modèle de tendances de T
 * à chaque tour adverse) couvre-t-il les drafts réelles de T **mieux qu'un arbre
 * construit sur la ligue seule (sans modèle d'équipe)** ? La métrique est la
 * **couverture** : la part des séquences adverses réelles qui restent dans l'arbre,
 * publiée **en courbe** sur (K, P) — jamais un point isolé.
 *
 * ## 1.2 Données, unités, éligibilité
 *
 * - **Corpus** : les fichiers passés en argv au lancement — au jour du design, les
 *   7 disponibles : `static/corpus/{lck,lec,lfl,lpl}-2026.json` +
 *   `data/corpus/{lec,lfl,lpl}-2025.json` (LCK 2025 absent — on n'en dépend pas).
 *   La liste exacte est imprimée dans le rapport. Tout corpus ajouté APRÈS le run
 *   (ex. lck-2025) = run de **réplication séparé**, même règle, fichier distinct.
 * - **Unité d'évaluation** : u = (game g, côté s) avec s ∈ {blue, red} traité comme
 *   « l'adversaire qu'on prépare ». Chaque game éligible donne 2 unités ; les 2
 *   unités d'une même game sont **clusterisées ensemble** dans le bootstrap.
 * - **Éligibilité de g** : patch présent et parsable (`parsePatch`), toutes les
 *   actions résolues (aucun `championKey === ''`), et au moins un patch
 *   strictement antérieur dans le même corpus (le premier patch n'est jamais
 *   scoré). Records écartés comptés dans les notes du rapport, jamais devinés.
 *
 * ## 1.3 Walk-forward et les deux bras
 *
 * Pour une game g de patch k dans le corpus C :
 *
 * - `Train(g)` = records de C de patch **strictement antérieur** à k
 *   (`comparePatches(r.patch, k) < 0`) — jamais k, jamais après, jamais g.
 * - `now(g)` = le **jour UTC** de `g.date` si défini, sinon le jour UTC de la
 *   date max de `Train(g)` ; si **aucun** record de `Train(g)` n'est daté,
 *   l'unité est **écartée et comptée dans les notes** du rapport — 0 cas sur
 *   les corpus actuels (les 2 661 records des 7 fichiers sont tous datés :
 *   même le fallback « date max » n'y sert jamais). Le staff connaît le jour du
 *   match au moment de la prep — aucune info de la game n'entre dans le modèle
 *   par ce biais ; la granularité jour fait que les games d'une même journée
 *   partagent la même table (cache, §2.5).
 * - **Bras A — modèle ÉQUIPE** (l'arbre revendiqué) :
 *   `buildTendencyTable(Train(g), Train(g), { alpha: 5, lambdaPerWeek: 0.9, now: now(g), team: T })`
 *   où T = `g.blueTeam` si s = blue, `g.redTeam` sinon (chaîne telle quelle —
 *   cohérente intra-corpus Leaguepedia, pas de fuzzy matching).
 * - **Bras B — baseline LIGUE (sans modèle d'équipe)** :
 *   `buildTendencyTable([], Train(g), { alpha: 5, lambdaPerWeek: 0.9, now: now(g) })`
 *   → les prédictions se réduisent au prior ligue conditionnel P_ligue(c | slotGroup, side),
 *   renormalisé après exclusions. C'est la version FORTE de « présence ligue »
 *   (conditionnelle au slot) — choisie exprès : battre une présence brute
 *   slot-agnostique serait trop facile.
 * - **Baseline secondaire (descriptive, jamais de verdict)** — gelée elle
 *   aussi : top-K par **présence brute pick+ban** de `Train(g)` — comptes
 *   d'**actions** (chaque pick et chaque ban résolu compte 1),
 *   **slot-agnostique et side-agnostique** (un seul classement, tous slots et
 *   sides confondus, recalculé par game sur son `Train(g)`) ; l'exclusion `E_i`
 *   (§1.4) est appliquée par **filtrage** de la liste classée **avant la
 *   troncature au K** ; **aucune renormalisation** (des comptes, jamais des
 *   probabilités). Ex æquo : compte desc, puis clé asc — déterministe.
 * - α = 5 et λ = 0,9 sont les défauts shippés de `aggregates/tendency.ts` — gelés,
 *   aucun réglage pour ce run.
 * - **Caches du harnais (gelés)** : tables du bras A mémoïsées par
 *   **(corpus, patch, équipe, now(g))** — la table équipe dépend de `now(g)`
 *   via λ, jamais de réutilisation entre jours ; tables du bras B par
 *   **(corpus, patch)** — licite car le prior ligue n'est **pas décoté**
 *   (`aggregates/tendency.ts` : « deliberately NOT recency-weighted », aucun λ
 *   sur le prior), la table baseline est donc indépendante de `now(g)`.
 *
 * ## 1.4 Scoring d'une unité
 *
 * Soit a₁…a_m les actions de g du côté s, triées par `seq` (m ≤ 10 ; les bans
 * sautés sont absents par construction). Pour i = 1…m :
 *
 * - `E_i` = ensemble des `championKey` des actions de g (les DEUX côtés) de
 *   `seq < seq(a_i)` — exactement l'information publique au moment réel de l'action ;
 * - `pred_i` = `predict(table, { slotGroup: slotGroupOf(a_i), side: s, exclude: E_i })`
 *   (tri déterministe du module : p desc, rawCount desc, clé asc) ;
 * - `hit_i(K)` = `a_i.championKey` ∈ les K premiers de `pred_i`
 *   (`pred_i` vide ⇒ miss honnête, convention du runner existant) ;
 * - **survie** : `survive_u(K, P) = ∧_{i=1..P} hit_i(K)`, définie ssi m ≥ P ;
 * - **profondeur tenue** : `D_u(K) = max{ d ≤ 6 : ∧_{i≤d} hit_i(K) }` (0 si
 *   hit₁ est faux). Les unités avec m < 6 sont exclues du critère primaire et
 *   comptées (m < 6 exige ≥ 4 bans sautés — quasi inexistant).
 *
 * Identité structurelle (publiée dans le rapport) :
 * **moyenne(D) = Σ_{P=1..6} taux de survive(K, P)** — le critère primaire est
 * l'aire sous la courbe de survie, pas une cellule.
 *
 * ## 1.5 Publication — la courbe, pas un point
 *
 * - **Grille complète** : taux de survive(K, P) pour K ∈ {1, 2, 4, 6, 8} ×
 *   P ∈ {1…10}, bras A et bras B côte à côte, **Wilson 95 %** par cellule, sur le
 *   pool des corpus. Par corpus : la colonne K = 4 (P = 1…10) + le point d'usage.
 * - **Taux par action** (descriptif) : hit rate à K = 4 par slotGroup
 *   (B1-B3, B4-B5, P1, P2-3, P4-5, P6, P7, P8-9, P10) — le complément est le taux
 *   d'alarme que l'UI affichera.
 * - **Tranches descriptives** (jamais promues en verdict) : unités dont l'équipe a
 *   ≥ 10 games au train vs < 10 (informera le badge de confiance UI).
 * - **Profondeur tenue** : moyenne(D) à K = 4 par bras, pool + par corpus.
 *
 * ## 1.6 Critère de verdict (UN run, UN critère)
 *
 * > **PRIMAIRE** : sur le pool des corpus listés, unités éligibles (m ≥ 6) ;
 * > Δ = moyenne(D_modèle) − moyenne(D_baseline) à K = 4 (plafond 6) ;
 * > IC bootstrap 95 % **apparié par unité et clusterisé par game** (les 2 unités
 * > d'une game tirées ensemble), `mulberry32(seed 42)`, 1000 resamples.
 * > **VERT ssi lo(IC) > 0.** Rien d'autre ne rend la gate verte : aucune cellule
 * > de la grille, aucune tranche, aucun corpus isolé ne peut être promu si le
 * > primaire échoue. Pas de second essai, pas de retuning après lecture.
 *
 * Le choix (K = 4, plafond P = 6) est un choix **produit** gelé avant le run :
 * K = 4 branches = ce qu'un panneau et une page A4 de répertoire affichent
 * lisiblement (convention prep échecs) ; P = 6 = la phase 1 adverse complète
 * (3 bans + 3 picks), l'horizon réaliste d'une prep — la phase 2 est réactive
 * par nature et appartient au coach live. Aucune cible chiffrée de couverture
 * n'est inventée avant la mesure (règle R9) : le verdict porte uniquement sur
 * le **delta vs baseline**.
 *
 * Ce run valide le **squelette de l'arbre** (les branches adverses et l'alarme
 * de déviation — qui en est le complément exact). Il ne dit RIEN de la qualité
 * de NOS réponses dans l'arbre : ça, c'est la gate coach (cible #1 de la run #2,
 * chantier séparé). Les deux claims ne se mélangent pas.
 *
 * ## 1.7 Commande du run
 *
 * node --experimental-transform-types --no-warnings scripts/backtest/planCoverage.ts \
 *   static/corpus/lck-2026.json static/corpus/lec-2026.json \
 *   static/corpus/lfl-2026.json static/corpus/lpl-2026.json \
 *   data/corpus/lec-2025.json data/corpus/lfl-2025.json data/corpus/lpl-2025.json \
 *   --seed 42 --out docs/calibration/plan-coverage-2026.md
 *
 * ---
 *
 * Le script ne contient AUCUNE logique de scoring ni de cache (pattern
 * runCorpus) : tout vit dans `$lib/backtest/planCoverage` (pur, testé). Ici :
 * lecture des corpus, injection du rng (`mulberry32(seed)`), mise en forme du
 * rapport markdown.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

type PlanCoverageModule = typeof import('../../src/lib/backtest/planCoverage');
type MetricsModule = typeof import('../../src/lib/backtest/metrics');
type DraftRecord = import('../../src/lib/data/types').DraftRecord;

const { PLAN_COVERAGE_FROZEN, buildPlanCoverageData, makeTableCache, scoreCorpus } = (await import(
    `${libRootHref}/backtest/planCoverage.ts`
)) as PlanCoverageModule;
const { mulberry32 } = (await import(`${libRootHref}/backtest/metrics.ts`)) as MetricsModule;

// ---- argv -------------------------------------------------------------------

const inputs: string[] = [];
let outPath = 'docs/calibration/plan-coverage-2026.md';
let generatedAt = new Date().toISOString();
let seed = 42;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') outPath = argv[++i];
    else if (argv[i] === '--generated-at') generatedAt = argv[++i];
    else if (argv[i] === '--seed') seed = Number(argv[++i]);
    else inputs.push(argv[i]);
}
if (inputs.length === 0 || !Number.isFinite(seed)) {
    console.error(
        'Usage: node scripts/backtest/planCoverage.ts <corpus.json> [...] [--seed 42] [--out md] [--generated-at ISO]'
    );
    process.exit(1);
}

// ---- scoring (délégué à la lib — aucune logique ici) --------------------------

const corpora = inputs.map((input) => {
    const records = JSON.parse(readFileSync(resolve(repoRoot, input), 'utf8')) as DraftRecord[];
    // Une instance de cache PAR corpus : la dimension « corpus » des clés
    // gelées (§1.3) est portée par l'instance.
    return scoreCorpus(basename(input), records, { cache: makeTableCache(records) });
});

const data = buildPlanCoverageData(corpora, { rng: mulberry32(seed) });

// ---- rapport -----------------------------------------------------------------

const wilsonCell = (cell: { rate: number; wilson: { lo: number; hi: number } }): string =>
    Number.isNaN(cell.rate)
        ? '—'
        : `${(100 * cell.rate).toFixed(1)} % [${(100 * cell.wilson.lo).toFixed(1)} ; ${(100 * cell.wilson.hi).toFixed(1)}]`;
const num = (value: number, digits = 3): string => (Number.isNaN(value) ? '—' : value.toFixed(digits));

const rows: string[] = [
    '# Gate D — couverture des plans à branches (modèle équipe vs prior ligue)',
    '',
    `> Généré : ${generatedAt} · seed ${seed} · règle pré-enregistrée gelée dans`,
    '> `scripts/backtest/planCoverage.ts` (copie de `docs/run2/D-plans-branches.md` §1).',
    '',
    '## Corpus évalués',
    '',
    ...inputs.map((input) => `- \`${input}\``),
    '',
    '## Verdict (critère PRIMAIRE, §1.6)',
    '',
    `- Unités éligibles (m ≥ ${data.pCap}) : ${data.pool.unitsPrimary} sur ${data.pool.units} (pool).`,
    `- Profondeur moyenne tenue à K = ${data.kUsage} (plafond ${data.pCap}) : modèle ${num(
        data.pool.meanDepthModel
    )} vs baseline ligue ${num(data.pool.meanDepthBaseline)}.`,
    `- Δ = ${num(data.pool.primary.delta, 4)} ; IC bootstrap 95 % apparié-clusterisé par game ` +
        `(mulberry32(${seed}), ${data.iterations} resamples, ${data.pool.primary.clusters} clusters, ` +
        `${data.pool.primary.observations} unités) : [${num(data.pool.primary.ci95.lo, 4)} ; ${num(
            data.pool.primary.ci95.hi,
            4
        )}].`,
    '',
    data.pool.verdictVert
        ? '**VERDICT : VERT** — lo(IC) > 0. Le modèle équipe couvre strictement mieux que le prior ligue.'
        : '**VERDICT : ROUGE** — lo(IC) ≤ 0. Le claim adverse-spécifique ne ship pas ; repli répertoire de ligue (§5 du design).',
    '',
    `- Identité structurelle (publiée, K = ${data.kUsage}) : moyenne(D) = Σ survive — ` +
        `modèle ${num(data.pool.identityModel.meanHeldDepth)} = ${num(data.pool.identityModel.surviveSum)} ; ` +
        `baseline ${num(data.pool.identityBaseline.meanHeldDepth)} = ${num(data.pool.identityBaseline.surviveSum)}.`,
    `- Plancher descriptif (présence brute, jamais de verdict) : moyenne(D) = ${num(data.pool.meanDepthPresence)}.`,
    '',
    '> Caveat ordre : couverture mesurée sous entrelacement supposé blue-first (ordre',
    "> intra-équipe exact, alternance entre équipes conventionnelle) — biais PARTAGÉ par",
    '> les deux bras (§3 risque 9), le delta n’est pas contaminé.',
    '',
    '## Grille complète survive(K, P) — pool (§1.5)',
    ''
];

for (const k of PLAN_COVERAGE_FROZEN.ks) {
    rows.push(`### K = ${k}`, '');
    rows.push('| P | n | Bras A — modèle équipe (Wilson 95 %) | Bras B — prior ligue (Wilson 95 %) |');
    rows.push('|---|---|---|---|');
    for (const p of PLAN_COVERAGE_FROZEN.ps) {
        const a = data.pool.gridModel.find((c) => c.k === k && c.p === p);
        const b = data.pool.gridBaseline.find((c) => c.k === k && c.p === p);
        if (a === undefined || b === undefined) continue;
        rows.push(`| ${p} | ${a.n} | ${wilsonCell(a)} | ${wilsonCell(b)} |`);
    }
    rows.push('');
}

rows.push(
    `### Plancher descriptif — présence brute (colonne K = ${data.kUsage})`,
    '',
    '| P | n | Survie (Wilson 95 %) |',
    '|---|---|---|',
    ...data.pool.presenceColumn.map((cell) => `| ${cell.p} | ${cell.n} | ${wilsonCell(cell)} |`),
    '',
    `## Taux par action à K = ${data.kUsage} (descriptif — le complément = taux d'alarme UI)`,
    '',
    '| SlotGroup | n actions | Modèle (Wilson 95 %) | Baseline (Wilson 95 %) |',
    '|---|---|---|---|',
    ...data.pool.slotGroupRates.map(
        (rate) =>
            `| ${rate.slotGroup} | ${rate.n} | ${
                rate.n === 0 ? '—' : wilsonCell({ rate: rate.rateModel, wilson: rate.wilsonModel })
            } | ${rate.n === 0 ? '—' : wilsonCell({ rate: rate.rateBaseline, wilson: rate.wilsonBaseline })} |`
    ),
    '',
    '## Tranches descriptives (jamais promues en verdict)',
    '',
    '| Tranche | n unités | moyenne(D) modèle | moyenne(D) baseline |',
    '|---|---|---|---|',
    ...data.pool.slices.map(
        (slice) => `| ${slice.label} | ${slice.n} | ${num(slice.meanDepthModel)} | ${num(slice.meanDepthBaseline)} |`
    ),
    '',
    '## Par corpus'
);

for (const corpus of data.perCorpus) {
    rows.push(
        '',
        `### ${corpus.label}`,
        '',
        `- ${corpus.notes.records} records → ${corpus.notes.gamesScored} games scorées → ` +
            `${corpus.notes.units} unités (${corpus.unitsPrimary} primaires m ≥ ${data.pCap}).`,
        `- Écartés : ${corpus.notes.discardedNoPatch} sans patch parsable, ` +
            `${corpus.notes.discardedUnresolved} avec action non résolue, ` +
            `${corpus.notes.discardedFirstPatch} premier patch ; ` +
            `unités écartées sans train daté : ${corpus.notes.unitsDiscardedNoDatedTrain} ; ` +
            `unités m < ${data.pCap} : ${corpus.notes.unitsMLt6}.`,
        `- Caches gelés : ${corpus.cacheStats.teamTables} tables équipe pour ` +
            `${corpus.cacheStats.teamRequests} demandes (clé patch×équipe×jour) ; ` +
            `${corpus.cacheStats.leagueTables} tables ligue pour ${corpus.cacheStats.leagueRequests} demandes (clé patch).`,
        `- Point d'usage (K = ${data.kUsage}, m ≥ ${data.pCap}) : moyenne(D) modèle ${num(
            corpus.meanDepthModel
        )} vs baseline ${num(corpus.meanDepthBaseline)}.`,
        '',
        `| P | n | Modèle K = ${data.kUsage} (Wilson 95 %) | Baseline K = ${data.kUsage} (Wilson 95 %) |`,
        '|---|---|---|---|',
        ...corpus.columnModel.map((cell, index) => {
            const baseline = corpus.columnBaseline[index];
            return `| ${cell.p} | ${cell.n} | ${wilsonCell(cell)} | ${wilsonCell(baseline)} |`;
        })
    );
}

rows.push(
    '',
    '## Lecture honnête',
    '',
    `> La survie jointe s'effondre mécaniquement avec P (≈ produit des taux par action)`,
    `> pour les DEUX bras — attendu et honnête (§3 risque 8). Le verdict est l'aire sous`,
    `> la courbe (moyenne de D) au point d'usage produit (K = ${data.kUsage}, P ≤ ${data.pCap}), gelé avant le run.`,
    '> Ce run valide le squelette adverse (branches + alarme) — il ne dit RIEN de la',
    '> qualité de NOS réponses (gate coach, chantier séparé).',
    ''
);

const markdown = rows.join('\n');
const absOut = resolve(repoRoot, outPath);
mkdirSync(dirname(absOut), { recursive: true });
writeFileSync(absOut, markdown, 'utf8');
console.log(markdown);
console.log(`Écrit : ${absOut}`);
