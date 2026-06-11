/**
 * G — Validateur d'intégrité Bo des corpus (CLI standalone, leçon Nasus).
 *
 * Relit des fichiers corpus DraftRecord[] et rapporte, PAR FICHIER :
 *  - les violations d'intégrité Bo groupées par kind (règle gelée de
 *    src/lib/data/boIntegrity.ts : doublons, gaps, équipes, game-after-clinch,
 *    decider-winner-mismatch, winner-unknown descriptif) ;
 *  - les comptes de quarantaine fraîcheur (--fresh-days N, défaut 3) : les
 *    saisies wiki récentes sont les plus exposées aux erreurs humaines — la
 *    finale LEC du 7 juin 2026 est entrée corrompue dans le pull du 10 juin.
 *
 * Diagnostic STRUCTUREL uniquement : aucune métrique d'outcome (winrate, hit
 * rate…) n'est calculée ni imprimée ici.
 *
 * Run : node --experimental-transform-types --no-warnings scripts/data/validateCorpus.ts \
 *         static/corpus/lec-2026.json data/corpus/lec-2025.json [--fresh-days 3]
 *
 * Exit : 1 si ≥ 1 violation STRUCTURELLE (duplicate-game-number, gap,
 * teams-changed, game-after-clinch, decider-winner-mismatch) sur l'ensemble
 * des fichiers — un corpus dans cet état ne doit alimenter aucun run de gate.
 * 0 sinon (winner-unknown seul reste descriptif). Fichier illisible ou
 * malformé : exit 1 aussi.
 *
 * Même hook de résolution $lib que scripts/backtest/postdiction.ts.
 */
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve } from 'node:path';
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

type BoIntegrityModule = typeof import('../../src/lib/data/boIntegrity');
type BoViolation = import('../../src/lib/data/boIntegrity').BoViolation;
type BoViolationKind = import('../../src/lib/data/boIntegrity').BoViolationKind;
type DraftRecord = import('../../src/lib/data/types').DraftRecord;

const { validateBoIntegrity, countFreshRecords, isStructuralBoViolation } = (await import(
    `${libRootHref}/data/boIntegrity.ts`
)) as BoIntegrityModule;

// ---- argv -------------------------------------------------------------------

const files: string[] = [];
let freshDays = 3;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--fresh-days') freshDays = Number(argv[++i]);
    else files.push(argv[i]);
}
if (files.length === 0 || !Number.isFinite(freshDays) || freshDays < 0) {
    console.error(
        'Usage: node --experimental-transform-types --no-warnings scripts/data/validateCorpus.ts ' +
            '<corpus.json> [...] [--fresh-days 3]'
    );
    process.exit(1);
}

// Ordre d'affichage canonique des kinds (séquence d'abord, descriptif en queue).
const KIND_ORDER: readonly BoViolationKind[] = [
    'duplicate-game-number',
    'gap',
    'teams-changed',
    'game-after-clinch',
    'decider-winner-mismatch',
    'winner-unknown'
];

const nowMs = Date.now();
let totalStructural = 0;
let totalDescriptive = 0;
let unreadable = 0;

for (const file of files) {
    const absPath = resolve(repoRoot, file);
    let records: DraftRecord[];
    try {
        const parsed: unknown = JSON.parse(readFileSync(absPath, 'utf8'));
        if (!Array.isArray(parsed)) throw new Error('le fichier ne contient pas un tableau JSON');
        records = parsed as DraftRecord[];
    } catch (error) {
        console.error(`\n=== ${file} ===`);
        console.error(`ILLISIBLE : ${(error as Error).message}`);
        unreadable++;
        continue;
    }

    const seriesIds = new Set<string>();
    let withoutSeries = 0;
    for (const record of records) {
        const matchId = record.series?.matchId;
        if (matchId === undefined || matchId === '') withoutSeries++;
        else seriesIds.add(matchId);
    }

    console.log(`\n=== ${file} — ${records.length} records, ${seriesIds.size} séries ===`);
    if (withoutSeries > 0) {
        console.log(
            `  (${withoutSeries} record(s) sans series.matchId — hors périmètre du contrôle Bo)`
        );
    }

    const violations = validateBoIntegrity(records);
    const byKind = new Map<BoViolationKind, BoViolation[]>();
    for (const violation of violations) {
        const bucket = byKind.get(violation.kind);
        if (bucket === undefined) byKind.set(violation.kind, [violation]);
        else bucket.push(violation);
    }

    if (violations.length === 0) {
        console.log('Intégrité Bo : aucune violation.');
    } else {
        for (const kind of KIND_ORDER) {
            const bucket = byKind.get(kind);
            if (bucket === undefined) continue;
            const tag = isStructuralBoViolation(kind) ? 'STRUCTUREL' : 'descriptif';
            console.log(`[${kind}] ×${bucket.length} (${tag})`);
            for (const violation of bucket) {
                console.log(`  série ${violation.matchId} · game ${violation.gameId}`);
                console.log(`    ${violation.detailFr}`);
                if (isStructuralBoViolation(kind)) totalStructural++;
                else totalDescriptive++;
            }
        }
    }

    const freshCount = countFreshRecords(records, freshDays, nowMs);
    console.log(`Fraîcheur : ${freshCount} record(s) daté(s) de moins de ${freshDays} jours.`);
    if (freshCount > 0) {
        console.warn(
            `quarantaine fraîcheur : ${freshCount} records saisis il y a moins de ${freshDays} jours ` +
                `— re-pull recommandé avant tout run de gate`
        );
    }
}

console.log(
    `\nTOTAL : ${totalStructural} violation(s) structurelle(s), ${totalDescriptive} descriptive(s) ` +
        `sur ${files.length} fichier(s)${unreadable > 0 ? ` (${unreadable} fichier(s) illisible(s))` : ''}.`
);
if (totalStructural > 0 || unreadable > 0) {
    console.log('Verdict : corpus IMPROPRE à un run de gate tant que les violations structurelles persistent.');
    process.exit(1);
}
console.log('Verdict : aucune impossibilité structurelle détectée.');
