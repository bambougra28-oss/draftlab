/**
 * Chantier W2, étape 2 — runner F4 (`scripts/backtest/f4Endgame.ts`, règle
 * gelée docs/run2/F-pocket-picks.md §3.4 recopiée verbatim dans son en-tête).
 *
 *  - convention de racine forcée du bras exhaustif, à la main : au slot racine
 *    du tour le seam ne propose QUE le candidat évalué (|C_racine| = 1 dans
 *    l'espace exact) ; espace > 1e6 ⇒ searched = false (retombée depth-2 chez
 *    l'appelant) ;
 *  - mécanique du runner sur la fixture synthétique `tests/fixtures/f4/` :
 *    restriction gameNumber ≥ 4 (folds/détecteur sur corpus ENTIER), deux bras
 *    appariés sur les mêmes tours, comptes basculés/retombées, IC clusterisé
 *    seed 42, rendu byte-stable ; `--audit-only` = comptes seulement (aucun
 *    taux, aucun delta, aucun rapport écrit).
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDraftActions } from '$lib/data/draftRecord';
import { searchFearlessEndgame } from '$lib/strategic/fearlessEndgame';
import type { DraftState } from '$lib/strategic/draftNavigator';

// ---- convention du bras exhaustif : racine forcée par seq -----------------------

/** État : tout joué sauf les seqs 19 (pick blue) et 20 (pick red). */
function stateBeforeSeq19(): DraftState {
    const { actions } = buildDraftActions({
        blue: { picks: ['A1', 'A2', 'A3', 'A4'], bans: ['u1', 'u2', 'u3', 'u4', 'u5'] },
        red: { picks: ['B1', 'B2', 'B3', 'B4'], bans: ['v1', 'v2', 'v3', 'v4', 'v5'] },
        firstPickSide: 'blue',
        resolveKey: (key) => key
    });
    const used = new Set(actions.map((a) => a.championKey));
    const available = new Set(
        ['X', 'Y', 'E1', 'E2'].filter((key) => !used.has(key))
    );
    return { actions, firstPickSide: 'blue', available };
}

const WEIGHTS: Record<string, number> = { X: 0.1, Y: 0.2, E1: 0.08, E2: 0.02 };
const toyEvaluate = (allyKeys: string[], enemyKeys: string[]): number =>
    0.5 +
    allyKeys.reduce((acc, key) => acc + (WEIGHTS[key] ?? 0), 0) -
    enemyKeys.reduce((acc, key) => acc + (WEIGHTS[key] ?? 0), 0);

describe('bras exhaustif F4 — racine forcée par seq (convention du runner)', () => {
    it('|C_racine| = 1 dans l’espace exact ; valeur expectimax du candidat seul, à la main', () => {
        const state = stateBeforeSeq19();
        const result = searchFearlessEndgame(state, {
            ourSide: 'blue',
            // Le seam du runner : au seq racine ⇒ [candidat forcé], sinon shipped.
            ourCandidatesForSlot: (_s, sl) => (sl.seq === 19 ? ['X'] : ['X', 'Y']),
            enemyRangeForSlot: () => [
                { championKey: 'E1', p: 0.75 },
                { championKey: 'E2', p: 0.25 }
            ],
            evaluate: toyEvaluate,
            now: () => 0
        });
        expect(result.searched).toBe(true);
        // Espace exact = 1 (racine forcée, seq 19) × 2 (range adverse, seq 20).
        expect(result.spaceSize).toBe(2);
        // v(X) = 0,75·eval(+X, +E1) + 0,25·eval(+X, +E2)
        //      = 0,75·(0,6 − 0,08) + 0,25·(0,6 − 0,02) = 0,535.
        expect(result.value).toBeCloseTo(0.535, 12);
        expect(result.bestLine[0]).toBe('pick:X');
    });

    it('espace > 1e6 : searched = false — le runner retombe depth-2 pour CE tour', () => {
        // Draft vide : 20 slots restants à 8 candidats ⇒ 8^19 ≫ 1e6 même racine forcée.
        const eight = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
        const state: DraftState = {
            actions: [],
            firstPickSide: 'blue',
            available: new Set(eight)
        };
        const result = searchFearlessEndgame(state, {
            ourSide: 'blue',
            ourCandidatesForSlot: (_s, sl) => (sl.seq === 1 ? ['c1'] : eight),
            enemyRangeForSlot: () => eight.map((championKey) => ({ championKey, p: 1 / 8 })),
            evaluate: toyEvaluate,
            now: () => 0
        });
        expect(result.searched).toBe(false);
        expect(result.spaceSize).toBeGreaterThan(1e6);
        expect(Number.isNaN(result.value)).toBe(true);
        expect(result.bestLine).toEqual([]);
    });
});

// ---- runner : mécanique sur la fixture synthétique tests/fixtures/f4/ ----------

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..');
const runnerScript = resolve(repoRoot, 'scripts', 'backtest', 'f4Endgame.ts');

const runnerArgs = (extra: string[]): string[] => [
    '--experimental-transform-types',
    '--no-warnings',
    runnerScript,
    'tests/fixtures/f4/corpus.json',
    '--dataset',
    'tests/fixtures/f4/dataset.json',
    '--full-dataset',
    'tests/fixtures/f4/dataset.json',
    '--seed',
    '42',
    '--generated-at',
    '2026-06-11T00:00:00.000Z',
    ...extra
];

describe('runner scripts/backtest/f4Endgame.ts (mini-corpus synthétique)', () => {
    it(
        'rendu byte-stable + restriction, appariement et bascule comptés à la main',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'f4-'));
            const out1 = join(dir, 'rapport-1.md');
            const out2 = join(dir, 'rapport-2.md');
            execFileSync(process.execPath, runnerArgs(['--out', out1]), { cwd: repoRoot, stdio: 'pipe' });
            execFileSync(process.execPath, runnerArgs(['--out', out2]), { cwd: repoRoot, stdio: 'pipe' });
            const report1 = readFileSync(out1, 'utf8');
            expect(report1).toBe(readFileSync(out2, 'utf8')); // byte-stable

            // Structure et règle déclarée.
            expect(report1).toContain('# F4 — endgame solver : delta apparié, jamais gate isolée');
            expect(report1).toContain('## Verdict (règle gelée §3.4)');
            expect(report1).toContain('MDE DÉCLARÉ ≈ ±8 pp');
            expect(report1).toContain("l'issue « non concluant » est ASSUMÉE");
            expect(report1).toContain('seed 42');
            expect(report1).toContain('sha256');

            // Restriction et couverture, comptes à la main depuis la fixture :
            // 9 records ; hors restriction = 2 train sans série + G1-G3 = 5 ;
            // kept = G4, G5, H4 (SER-F5), N4 (SER-F6, sans vainqueur) ;
            // éligibles 3 → scorées 3 → 30 tours, tous appariés.
            expect(report1).toContain(
                '9 records → 5 hors restriction (sans série ou gameNumber < 4) → 3 éligibles ' +
                    '(1 sans vainqueur, 0 avec picks non résolus, 0 sans fold)'
            );
            expect(report1).toContain('3 scorées (0 écartées side-coverage) · 30 tours scorés');
            // Bascule F-d (déterministe sur la fixture) : 21 tours ≤ 1e6,
            // 9 retombées depth-2 — et l'espace basculé reste sous la borne.
            expect(report1).toContain('21 tours basculés, 9 retombées depth-2');
            expect(report1).toContain('(plus grand espace basculé 995328)');
            // Détecteur Fearless : G2-G5 de SER-F4 = 40 picks examinés, 0 réutilisé.
            expect(report1).toContain('0/40 → lockouts ON');
            // Appariement : clusters = SER-F4 (2 games) + SER-F5 (1 game).
            expect(report1).toContain('(2 clusters, 3 games, 1000 resamples, seed 42)');
            // Les deux bras publient un TD sur les MÊMES 3 games.
            expect(report1).toContain('| depth-2 (le bras de A) | 3 |');
            expect(report1).toContain('| exhaustif (F-d) | 3 |');
            // Le timing reste hors markdown (byte-stabilité) — stderr seulement.
            expect(report1).not.toMatch(/\d+(\.\d+)? ms/);
        },
        240000
    );

    it(
        '--audit-only : comptes structurels seulement, aucun taux, aucun rapport écrit',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'f4-audit-'));
            const out = join(dir, 'rapport-audit.md');
            const stdout = execFileSync(process.execPath, runnerArgs(['--out', out, '--audit-only']), {
                cwd: repoRoot,
                encoding: 'utf8'
            });
            expect(stdout).toContain('[audit] corpus tests/fixtures/f4/corpus.json');
            expect(stdout).toContain('lockouts ON');
            expect(stdout).toContain(
                'records 9 · hors restriction (sans série ou gameNumber < 4) 5'
            );
            expect(stdout).toContain('games G4-5 éligibles 3 · scorées 3 · tours scorés 30');
            expect(stdout).toContain('no-winner 1');
            // Aveugle : aucun TD, aucun delta, aucun taux ; rien d'écrit ; et
            // aucune recherche lancée (les comptes de bascule sont absents).
            expect(stdout).not.toMatch(/TD/);
            expect(stdout).not.toMatch(/%/);
            expect(stdout).not.toMatch(/bascul/);
            expect(stdout).not.toMatch(/delta|Δ/);
            expect(existsSync(out)).toBe(false);
        },
        240000
    );
});
