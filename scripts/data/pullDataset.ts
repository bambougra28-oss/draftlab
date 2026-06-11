/**
 * Chantier E — Snapshot du dataset DraftGap (current-patch + 30-days) pour LE run
 * de calibration (règle gelée : snapshot tiré et HASHÉ AVANT le run, jamais
 * re-tiré ensuite — les sha256 sont publiés dans le rapport).
 *
 * Écrit `data/datasets/current-patch-<date>.json` et `data/datasets/30-days-<date>.json`
 * (répertoire ignoré par git, ~50 Mo : la reproductibilité passe par le hash,
 * pas par le blob), puis imprime taille + sha256 + `version`/`date` de chaque
 * Dataset. Valide que le JSON parse en Dataset avec `championData` non vide.
 *
 * Run : node --experimental-transform-types --no-warnings scripts/data/pullDataset.ts \
 *         [--date YYYY-MM-DD] [--out-dir data/datasets]
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

type FetchModule = typeof import('../../src/lib/dataset/fetch');
type Dataset = import('../../src/lib/types').Dataset;

const { PATCH_DATASET_URL, FULL_DATASET_URL } = (await import(
    `${libRootHref}/dataset/fetch.ts`
)) as FetchModule;

// ---- argv -------------------------------------------------------------------

let dateTag = new Date().toISOString().slice(0, 10);
let outDir = 'data/datasets';
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--date') dateTag = argv[++i];
    else if (argv[i] === '--out-dir') outDir = argv[++i];
    else {
        console.error(`Argument inconnu : ${argv[i]}`);
        console.error(
            'Usage : node scripts/data/pullDataset.ts [--date YYYY-MM-DD] [--out-dir data/datasets]'
        );
        process.exit(1);
    }
}

// ---- pull + hash --------------------------------------------------------------

interface PullSpec {
    label: string;
    url: string;
    file: string;
}

const specs: PullSpec[] = [
    { label: 'current-patch', url: PATCH_DATASET_URL, file: `current-patch-${dateTag}.json` },
    { label: '30-days', url: FULL_DATASET_URL, file: `30-days-${dateTag}.json` }
];

const absOutDir = resolve(repoRoot, outDir);
mkdirSync(absOutDir, { recursive: true });

for (const spec of specs) {
    const res = await fetch(spec.url);
    if (!res.ok) {
        console.error(`Échec du tirage ${spec.label} : ${res.status} ${res.statusText} (${spec.url})`);
        process.exit(1);
    }
    const text = await res.text();

    let dataset: Dataset;
    try {
        dataset = JSON.parse(text) as Dataset;
    } catch (error) {
        console.error(`Le payload ${spec.label} ne parse pas en JSON : ${String(error)}`);
        process.exit(1);
    }
    const championCount = Object.keys(dataset.championData ?? {}).length;
    if (championCount === 0) {
        console.error(`Le payload ${spec.label} ne ressemble pas à un Dataset : championData vide.`);
        process.exit(1);
    }

    const absFile = resolve(absOutDir, spec.file);
    writeFileSync(absFile, text, 'utf8');
    const bytes = readFileSync(absFile); // hash des octets ÉCRITS (= ce que lira le run)
    const sha256 = createHash('sha256').update(bytes).digest('hex');

    console.log(`— ${spec.label}`);
    console.log(`  fichier  : ${absFile}`);
    console.log(`  taille   : ${(bytes.length / (1024 * 1024)).toFixed(2).replace('.', ',')} Mo`);
    console.log(`  sha256   : ${sha256}`);
    console.log(`  version  : ${dataset.version} · date : ${dataset.date} · ${championCount} champions`);
}

console.log('');
console.log('Snapshot figé : reporter les sha256 ci-dessus dans le rapport du run (règle gelée).');
