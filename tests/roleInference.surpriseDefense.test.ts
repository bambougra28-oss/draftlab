/**
 * Chantier W1 — mode `--surprise-defense` du harnais
 * scripts/backtest/roleInference.ts (non-régression F-c, garde F2 gelée :
 * exigence k=3 pooled ≥ 94,5 % sinon F-c reste débranché —
 * docs/run2/F-pocket-picks.md §3.2 « GARDE DE BRANCHEMENT F-c »).
 *
 * Fixture 100 % synthétique (tests/fixtures/roleinference/, générée par
 * generate.cjs) — JAMAIS les corpus réels (les runs réels = architecte).
 *
 * DÉRIVATION À LA MAIN (fixture : 4 games train patch 16.1, 1 game test
 * patch 16.2, rôles mono-identitaires 101..105 / 201..205) :
 *  - Sans flag : k3 top 6/6 = 100 %, k5 top 10/10 = 100 % (999 hors-corpus
 *    placé Support PAR ÉLIMINATION — fallback uniforme + injectivité),
 *    argmax k5 9/10 = 90 % (999 → uniforme → argmax Top ≠ Support),
 *    4 records sans fold (premier patch). Capturé byte-à-byte dans
 *    baseline-output.md AVANT la modification du harnais.
 *  - Avec flag, jambes du déclencheur :
 *      · 999 (blue, seq 19, k=5 seulement — 5ᵉ pick du side) : absent de la
 *        range P8-9|blue ⇒ bits = −log2(ε = 1e-3) = 9,9658 ≥ 5 (alarme) ET
 *        lecture courante marginale = Support (par élimination), compte
 *        train (999, Support) = 0 ⇒ DÉCLENCHEUR. Uniformisation (β = 1) ≡
 *        fallback uniforme déjà appliqué (classe B) ⇒ ré-énumération
 *        IDENTIQUE ⇒ accuracy STRICTEMENT inchangée (le théorème no-op).
 *      · 205 (red, seq 12, k=3 et k=5) : déplacé de cellule (P10→P6) ⇒
 *        absent de la range ⇒ bits 9,97 (alarme) MAIS lu Support et compte
 *        train (205, Support) = 4 > 0 ⇒ PAS de déclencheur (jambe novelté).
 *      · 203 (red, seq 20, k=5) : cellule P10|red vidée (205 consommé) ⇒
 *        range vide ⇒ bits 9,97 (alarme) MAIS rôle connu ⇒ PAS déclenché.
 *      · 101/102/103/104/201/202/204 : bits ∈ {0, 1} < 5 ⇒ pas d'alarme.
 *    Comptes attendus : k=3 → 6 évalués, 1 alarme, 0 déclencheur, 0
 *    ré-énumération ; k=5 → 10 évalués, 3 alarmes, 1 déclencheur, 1
 *    ré-énumération. Garde : k=3 pooled 100,0 % ≥ 94,5 % ⇒ ATTEINT.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..');
const runnerScript = resolve(repoRoot, 'scripts', 'backtest', 'roleInference.ts');
const fixtureCorpus = 'tests/fixtures/roleinference/synthetic.json';
const baselinePath = resolve(repoRoot, 'tests', 'fixtures', 'roleinference', 'baseline-output.md');

const runnerArgs = (extra: string[]): string[] => [
    '--experimental-transform-types',
    '--no-warnings',
    runnerScript,
    fixtureCorpus,
    '--generated-at',
    '2026-06-11T00:00:00.000Z',
    ...extra
];

const runTo = (out: string, extra: string[] = []): string => {
    execFileSync(process.execPath, runnerArgs(['--out', out, ...extra]), { cwd: repoRoot, stdio: 'pipe' });
    return readFileSync(out, 'utf8');
};

describe('roleInference --surprise-defense (fixture synthétique, jamais les corpus réels)', () => {
    it(
        'SANS le flag : sortie byte-identique au baseline gelé AVANT modification (diff)',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'roleinf-noflag-'));
            const report = runTo(join(dir, 'rapport.md'));
            const baseline = readFileSync(baselinePath, 'utf8');
            expect(report).toBe(baseline); // byte-identique : le harnais validé est INCHANGÉ
        },
        120000
    );

    it(
        'AVEC le flag : déclencheur (bits ≥ 5 ET novelté), jambes négatives, uniformisation no-op, garde ATTEINTE',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'roleinf-flag-'));
            const report = runTo(join(dir, 'rapport.md'), ['--surprise-defense']);
            const baseline = readFileSync(baselinePath, 'utf8');

            // Le harnais de base est INCHANGÉ sous le flag : le rapport COMMENCE
            // par le baseline byte-à-byte (l'uniformisation du déclencheur classe B
            // ≡ fallback uniforme ⇒ accuracy strictement identique — théorème no-op),
            // la section du mode est APPENDUE.
            expect(report.startsWith(baseline.trimEnd())).toBe(true);
            expect(report).toContain('## Mode `--surprise-defense` — non-régression F-c (chantier W1)');
            expect(report).toContain('GARDE F2 GELÉE');

            // Comptes dérivés à la main (en-tête du fichier) : 1 alarme sans
            // déclencheur à k=3 (205 — novelté absente), 3 alarmes / 1 seul
            // déclencheur / 1 ré-énumération à k=5.
            expect(report).toContain('| 3 | 6 | 1 | 0 | 0 | 0 |');
            expect(report).toContain('| 5 | 10 | 3 | 1 | 1 | 0 |');

            // Le déclencheur exact : 999 hors-train, bits = −log2(1e-3) = 9,97,
            // lu Support par élimination (marginal de la lecture courante).
            expect(report).toContain('| synthetic.json | G-TEST | blue | 5 | Inconnu999 | 9.97 | Support |');
            // Aucun autre déclencheur (205 et 203 : alarme SANS novelté).
            expect(report).not.toContain('Champ205');
            expect(report).not.toContain('Champ203');

            // Garde gelée : k=3 pooled 100,0 % ≥ 94,5 % ⇒ ATTEINT.
            expect(report).toContain(
                'Accuracy pooled k=3 (top-hypothèse, défense active) : 100.0 % (n = 6) — seuil gelé 94,5 % : **ATTEINT**'
            );

            // Les tables d'accuracy restent celles du baseline (défense active).
            expect(report).toContain('| TOUS — top-hypothèse jointe | 10 | 100.0 % | [72.2 ; 100.0] % |');
            expect(report).toContain('| TOUS — argmax indépendant (baseline) | 10 | 90.0 % | [59.6 ; 98.2] % |');
        },
        120000
    );

    it(
        'AVEC le flag : rendu byte-stable (deux runs identiques — aucun aléa, aucune horloge)',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'roleinf-stable-'));
            const report1 = runTo(join(dir, 'rapport-1.md'), ['--surprise-defense']);
            const report2 = runTo(join(dir, 'rapport-2.md'), ['--surprise-defense']);
            expect(report1).toBe(report2);
        },
        120000
    );
});
