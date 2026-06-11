import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    calibrateAllyWin,
    defaultWinCalibrationConfig,
    leagueCardOf,
    positionOf,
    type PositionParams,
    type WinCalibrationConfig
} from '$lib/estimators/winCalibration';
import { plattApply } from '$lib/estimators/platt';

/** A config whose after3Picks and fullDraft are validated at (a=0.2, b=0.7). */
const validated = (): WinCalibrationConfig => ({
    version: 1,
    generatedAt: '2026-06-11T00:00:00.000Z',
    corpora: ['synthétique'],
    nGames: 123,
    positions: {
        afterBans: null,
        after3Picks: { a: 0.2, b: 0.7, nTrain: 123, validated: true },
        fullDraft: { a: 0.2, b: 0.7, nTrain: 123, validated: true }
    }
});

/**
 * A v2 config (chantier E3). The pooled `positions` field is POISONED with
 * validated:true on purpose: the real artifact forces validated:false there,
 * so any resolution path that falls back to it would calibrate where the
 * frozen rule mandates passthrough — the tests below prove it never happens.
 * lck carries the v1 hand-value card (a=0.2, b=0.7) validated; lec carries a
 * non-validated fullDraft (red verdict ships, never applies).
 */
const v2Config = (): WinCalibrationConfig => ({
    version: 2,
    generatedAt: '2026-06-11T00:00:00.000Z',
    corpora: ['synthétique'],
    nGames: 3214,
    fittedThroughPatch: '26.11',
    positions: {
        afterBans: { a: 0.9, b: 0.9, nTrain: 3214, validated: true },
        after3Picks: { a: 0.9, b: 0.9, nTrain: 3214, validated: true },
        fullDraft: { a: 0.9, b: 0.9, nTrain: 3214, validated: true }
    },
    leagues: {
        lck: {
            nGames: 892,
            fittedThroughPatch: '26.11',
            positions: {
                afterBans: null,
                after3Picks: { a: 0.2, b: 0.7, nTrain: 892, validated: true },
                fullDraft: { a: 0.2, b: 0.7, nTrain: 892, validated: true }
            }
        },
        lec: {
            nGames: 554,
            fittedThroughPatch: '26.10',
            positions: {
                afterBans: null,
                after3Picks: null,
                fullDraft: { a: 0.2, b: 0.7, nTrain: 554, validated: false }
            }
        }
    }
});

describe('winCalibration — positionOf (frozen partition)', () => {
    it('routes the locked-pick counts to their anchors at the bounds', () => {
        expect(positionOf(0)).toBe('afterBans');
        expect(positionOf(1)).toBe('after3Picks');
        expect(positionOf(6)).toBe('after3Picks');
        expect(positionOf(7)).toBe('fullDraft');
        expect(positionOf(10)).toBe('fullDraft');
    });
});

describe('winCalibration — calibrateAllyWin', () => {
    it('round-trips through BLUE space for a red ally (hand value)', () => {
        // (a=0.2, b=0.7), ally red, pAllyRaw = 0.6 ⇒ pBlue = 0.4,
        // logit(0.4) = ln(2/3) ≈ −0.405465, 0.2 + 0.7·logit = −0.083826,
        // σ(−0.083826) ≈ 0.479056 ⇒ pAlly = 1 − 0.479056 ≈ 0.520944.
        const out = calibrateAllyWin(0.6, 'red', 10, validated());
        expect(out.pAlly).toBeCloseTo(0.520944, 6);
        expect(out.calibrated).toBe(true);
        expect(out.position).toBe('fullDraft');
        expect(out.nGames).toBe(123);
        // Naive ally-space application would give σ(0.2 + 0.7·logit(0.6))
        // = σ(0.483826) ≈ 0.618651 — the side bias INVERTED. Guard the gap.
        expect(out.pAlly).not.toBeCloseTo(plattApply({ a: 0.2, b: 0.7 }, 0.6), 2);
    });

    it('is plattApply directly for a blue ally (identity of the round trip)', () => {
        const out = calibrateAllyWin(0.6, 'blue', 10, validated());
        expect(out.pAlly).toBeCloseTo(plattApply({ a: 0.2, b: 0.7 }, 0.6), 12);
        // Hand value: σ(0.2 + 0.7·ln(1.5)) = σ(0.483826) ≈ 0.618651.
        expect(out.pAlly).toBeCloseTo(0.618651, 6);
    });

    it('routes picksLocked = 3 to the after3Picks params', () => {
        const out = calibrateAllyWin(0.6, 'blue', 3, validated());
        expect(out.position).toBe('after3Picks');
        expect(out.calibrated).toBe(true);
    });

    it('passes through on a null config', () => {
        const out = calibrateAllyWin(0.6, 'red', 10, null);
        expect(out).toEqual({ pAlly: 0.6, calibrated: false, position: 'fullDraft' });
    });

    it('passes through on the SHIPPED default config (run E rouge: validated:false everywhere)', () => {
        // The committed artifact is whatever the LAST run wrote (rule: always
        // written, never hand-edited). Run E (2026-06-11) shipped real fits
        // with validated:false on all three positions — the UI must never
        // apply them. The contract pinned here: no position is applicable,
        // so the default config passes raw values through.
        const positions = defaultWinCalibrationConfig().positions;
        for (const position of Object.values(positions)) {
            if (position !== null) expect(position.validated).toBe(false);
        }
        const out = calibrateAllyWin(0.55, 'blue', 8);
        expect(out.pAlly).toBe(0.55);
        expect(out.calibrated).toBe(false);
        expect(out.nGames).toBeUndefined();
    });

    it('passes through on validated:false params (red verdict ships, never applies)', () => {
        const config = validated();
        config.positions.fullDraft = { a: 0.2, b: 0.7, nTrain: 123, validated: false };
        const out = calibrateAllyWin(0.6, 'blue', 10, config);
        expect(out.pAlly).toBe(0.6);
        expect(out.calibrated).toBe(false);
    });

    it('preserves the ranking of raw values when b > 0 (both sides)', () => {
        const config = validated();
        const blue = [0.3, 0.5, 0.7].map((p) => calibrateAllyWin(p, 'blue', 10, config).pAlly);
        expect(blue[0]).toBeLessThan(blue[1]);
        expect(blue[1]).toBeLessThan(blue[2]);
        const red = [0.3, 0.5, 0.7].map((p) => calibrateAllyWin(p, 'red', 10, config).pAlly);
        expect(red[0]).toBeLessThan(red[1]);
        expect(red[1]).toBeLessThan(red[2]);
    });
});

// ---- v2 (chantier E3) — leagueCardOf, the UNIQUE card resolution ---------------

describe('winCalibration — leagueCardOf (résolution v2 unique)', () => {
    it('null config → null (passthrough), with or without leagueId', () => {
        expect(leagueCardOf(null)).toBeNull();
        expect(leagueCardOf(null, 'lck')).toBeNull();
    });

    it('v1 config → the v1 card (config nGames/fittedThroughPatch/positions), leagueId IGNORED', () => {
        const config = validated();
        const card = leagueCardOf(config, 'lck');
        expect(card).not.toBeNull();
        expect(card!.nGames).toBe(123);
        expect(card!.fittedThroughPatch).toBeUndefined();
        expect(card!.positions).toBe(config.positions);
        // leagueId ignored: same card without one, or with an unknown one.
        expect(leagueCardOf(config)).toEqual(card);
        expect(leagueCardOf(config, 'lcs')).toEqual(card);
    });

    it('v2 + known league → the LEAGUE card (its nGames and fittedThroughPatch)', () => {
        const config = v2Config();
        const card = leagueCardOf(config, 'lck');
        expect(card).not.toBeNull();
        expect(card!.nGames).toBe(892); // the league's, never the 3214 total
        expect(card!.fittedThroughPatch).toBe('26.11');
        expect(card!.positions.fullDraft).toEqual({ a: 0.2, b: 0.7, nTrain: 892, validated: true });
        expect(card!.positions).not.toBe(config.positions);
        // Another league resolves ITS card (nGames of the league again).
        expect(leagueCardOf(config, 'lec')!.nGames).toBe(554);
    });

    it('v2 + unknown league or absent leagueId → null, NEVER config.positions', () => {
        const config = v2Config(); // pooled positions poisoned validated:true
        expect(leagueCardOf(config, 'lcs')).toBeNull();
        expect(leagueCardOf(config, 'cblol')).toBeNull();
        expect(leagueCardOf(config)).toBeNull();
        const noLeagues = v2Config();
        delete noLeagues.leagues;
        expect(leagueCardOf(noLeagues, 'lck')).toBeNull();
    });
});

describe('winCalibration — calibrateAllyWin v2 (carte par ligue)', () => {
    it('validated lck card, red ally: the v1 hand value unchanged (0.520944), nGames = the LEAGUE\'s', () => {
        // Same card (a=0.2, b=0.7) as the v1 hand test, resolved BY LEAGUE:
        // pBlue = 0.4 ⇒ σ(0.2 + 0.7·logit(0.4)) ≈ 0.479056 ⇒ pAlly ≈ 0.520944.
        const out = calibrateAllyWin(0.6, 'red', 10, v2Config(), 'lck');
        expect(out.pAlly).toBeCloseTo(0.520944, 6);
        expect(out.calibrated).toBe(true);
        expect(out.position).toBe('fullDraft');
        expect(out.nGames).toBe(892); // the league's badge count, never the 3214 total
    });

    it('same config queried with leagueId lcs → passthrough (league without a card)', () => {
        const out = calibrateAllyWin(0.6, 'red', 10, v2Config(), 'lcs');
        expect(out).toEqual({ pAlly: 0.6, calibrated: false, position: 'fullDraft' });
    });

    it('v2 without leagueId → passthrough, even with poisoned pooled positions', () => {
        // The pooled v2 `positions` field is validated:true in the fixture —
        // a fallback onto it would calibrate here. The frozen rule says null.
        const out = calibrateAllyWin(0.6, 'blue', 10, v2Config());
        expect(out).toEqual({ pAlly: 0.6, calibrated: false, position: 'fullDraft' });
    });

    it('v2 with a non-validated league position → passthrough (red verdict ships, never applies)', () => {
        const out = calibrateAllyWin(0.6, 'blue', 10, v2Config(), 'lec'); // lec fullDraft validated:false
        expect(out.pAlly).toBe(0.6);
        expect(out.calibrated).toBe(false);
        expect(out.nGames).toBeUndefined();
        // lec after3Picks is null ⇒ passthrough too.
        const after3 = calibrateAllyWin(0.6, 'blue', 3, v2Config(), 'lec');
        expect(after3.calibrated).toBe(false);
    });
});

// ---- runner winCalibrationByLeague — smoke de plomberie (fixtures synthétiques) -
// JAMAIS d'exécution sur données réelles ici : mini-corpus byLeague (12 éligibles,
// zéro fold scoré sous minTrainSize = 50) + dataset jouet, hashes surchargés via
// --expected-sha256-current/--expected-sha256-full (flags INTERDITS sur corpus réels).

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..');
const runnerPath = resolve(repoRoot, 'scripts', 'backtest', 'winCalibrationByLeague.ts');
const FIX = 'tests/fixtures/calibration/byLeague';
const LCK25 = `${FIX}/lck-2025.json`;
const LCK26 = `${FIX}/lck-2026.json`;
const LEC26 = `${FIX}/lec-2026.json`;
const TOY_DATASET = `${FIX}/dataset.json`;
const toySha256 = createHash('sha256')
    .update(readFileSync(resolve(repoRoot, TOY_DATASET)))
    .digest('hex');
const DATASET_ARGS = ['--dataset', TOY_DATASET, '--full-dataset', TOY_DATASET];
const OVERRIDE_ARGS = [
    '--expected-sha256-current',
    toySha256,
    '--expected-sha256-full',
    toySha256
];

function runRunner(args: string[]): void {
    execFileSync(
        process.execPath,
        ['--experimental-transform-types', '--no-warnings', runnerPath, ...args],
        { cwd: repoRoot, stdio: 'pipe' }
    );
}

/** Runs the runner expecting exit 1; returns stderr for message assertions. */
function runRunnerExpectAbort(args: string[]): string {
    try {
        runRunner(args);
    } catch (error) {
        const failure = error as { status?: number | null; stderr?: Buffer };
        expect(failure.status).toBe(1);
        return String(failure.stderr);
    }
    throw new Error('le runner aurait dû abort (exit 1) — il a terminé en succès.');
}

describe('winCalibrationByLeague — smoke mode ligue (fixtures synthétiques)', () => {
    it(
        'couverture, sections par ligue et artefact params v2 (validated:false partout, poolé forcé)',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'e3-byleague-'));
            const out = join(dir, 'rapport.md');
            const paramsOut = join(dir, 'params.json');
            runRunner([
                LCK26, LCK25, LEC26,
                ...DATASET_ARGS, ...OVERRIDE_ARGS,
                '--seed', '42',
                '--generated-at', '2026-06-11T00:00:00.000Z',
                '--out', out,
                '--params-out', paramsOut
            ]);
            const report = readFileSync(out, 'utf8');
            expect(report).toContain('# Calibration Platt PAR LIGUE × position de séquence — chantier E3, run #3');
            // A6 : l'override de hash est auditable dans l'artefact lui-même.
            expect(report).toContain(`Override de hash : --expected-sha256-current=${toySha256}`);
            // Couverture par fichier (ligue, records, éligibles, écartés, paires).
            expect(report).toContain('| lck-2026.json | lck | 4 | 4 | 0 | 0 |');
            expect(report).toContain('| lck-2025.json | lck | 4 | 4 | 0 | 0 |');
            expect(report).toContain('| lec-2026.json | lec | 5 | 4 | 1 | 0 |');
            expect(report).toContain('| **TOTAL** | — | 13 | 12 | 1 | 0 |');
            // Une section par ligue présente, dans l'ordre gelé lck → lec.
            expect(report.indexOf('## Ligue lck')).toBeGreaterThan(0);
            expect(report.indexOf('## Ligue lec')).toBeGreaterThan(report.indexOf('## Ligue lck'));
            expect(report).toContain(
                'aucune paire de test (mini-corpus sous minTrainSize : smoke de plomberie uniquement)'
            );
            expect(report).toContain('## Récapitulatif des 6 cellules');

            const config = JSON.parse(readFileSync(paramsOut, 'utf8')) as WinCalibrationConfig;
            expect(config.version).toBe(2);
            expect(config.seed).toBe(42);
            expect(config.nGames).toBe(12); // total éligible (descriptif)
            expect(config.corpora).toEqual([LCK26, LCK25, LEC26]);
            // Full-fit poolé = PROVENANCE, validated:false FORCÉ par construction.
            for (const params of Object.values(config.positions)) {
                expect((params as PositionParams).validated).toBe(false);
            }
            // Cartes par ligue : nGames DE LA LIGUE, 0 paire ⇒ tout rouge ⇒ validated:false.
            expect(config.leagues!.lck.nGames).toBe(8);
            expect(config.leagues!.lck.fittedThroughPatch).toBe('26.01');
            expect(config.leagues!.lec.nGames).toBe(4);
            for (const league of Object.values(config.leagues!)) {
                for (const params of Object.values(league.positions)) {
                    expect((params as PositionParams).validated).toBe(false);
                }
            }
        },
        240000
    );

    it(
        'abort si basename de corpus inconnu (regex gelée ^(lck|lec|lfl|lpl)-\\d{4}\\.json$)',
        () => {
            const stderr = runRunnerExpectAbort([
                'tests/fixtures/calibration/synthetic.json',
                ...DATASET_ARGS, ...OVERRIDE_ARGS,
                '--out', join(mkdtempSync(join(tmpdir(), 'e3-abort-')), 'rapport.md')
            ]);
            expect(stderr).toContain('ABORT');
            expect(stderr).toContain('basename de corpus inconnu : synthetic.json');
        },
        120000
    );

    it(
        'abort si sha256 du dataset ≠ défauts gelés (dataset jouet sans override)',
        () => {
            const stderr = runRunnerExpectAbort([
                LCK26,
                ...DATASET_ARGS, // PAS d'override : les défauts gelés de la règle s'appliquent
                '--out', join(mkdtempSync(join(tmpdir(), 'e3-abort-')), 'rapport.md')
            ]);
            expect(stderr).toContain('ABORT');
            expect(stderr).toContain('sha256(current-patch) ≠ attendu');
        },
        120000
    );

    it(
        'abort si gameId dupliqué sur l\'union des corpus chargés',
        () => {
            const stderr = runRunnerExpectAbort([
                LCK26, LCK26,
                ...DATASET_ARGS, ...OVERRIDE_ARGS,
                '--out', join(mkdtempSync(join(tmpdir(), 'e3-abort-')), 'rapport.md')
            ]);
            expect(stderr).toContain('ABORT');
            expect(stderr).toContain('gameId dupliqué sur l\'union des corpus : LCK26-G1');
        },
        120000
    );
});

describe('winCalibrationByLeague — smoke mode --pooled (porte de validité)', () => {
    it(
        'rapport au format v1 (aucune section par ligue), hash audité, artefact v1 du repo intact',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'e3-pooled-'));
            const out = join(dir, 'rapport.md');
            runRunner([
                '--pooled',
                LCK26, LCK25, LEC26,
                ...DATASET_ARGS, ...OVERRIDE_ARGS,
                '--seed', '42',
                '--generated-at', '2026-06-11T00:00:00.000Z',
                '--out', out
            ]);
            const report = readFileSync(out, 'utf8');
            // Format v1 : positions poolées, lignes par corpus, pas de sections ligue.
            expect(report).toContain('mode --pooled');
            expect(report).toContain('## Position afterBans');
            expect(report).toContain('## Lignes par corpus');
            expect(report).toContain('## Verdicts (réplication v1 — aucun artefact params)');
            expect(report).not.toContain('## Ligue ');
            expect(report).toContain('Override de hash');
            // Double verrou : le smoke n'a RIEN écrit dans l'artefact shippé du
            // repo. L'artefact est ce que le DERNIER run a écrit (v1 poolée puis
            // v2 par ligue depuis le run E3 du 2026-06-11) — le contrat épinglé :
            // le smoke ne le modifie pas, et rien n'y est validé tant qu'aucune
            // cellule n'a de verdict VERT.
            const shipped = JSON.parse(
                readFileSync(resolve(repoRoot, 'data', 'calibration', 'winCalibration.json'), 'utf8')
            ) as WinCalibrationConfig;
            expect([1, 2]).toContain(shipped.version);
            for (const card of Object.values(shipped.positions)) {
                if (card !== null) expect(card.validated).toBe(false);
            }
        },
        240000
    );

    it(
        'abort si --params-out est passé en mode --pooled (porte de validité : AUCUN params écrit)',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'e3-pooled-abort-'));
            const stderr = runRunnerExpectAbort([
                '--pooled',
                LCK26,
                ...DATASET_ARGS, ...OVERRIDE_ARGS,
                '--out', join(dir, 'rapport.md'),
                '--params-out', join(dir, 'params.json')
            ]);
            expect(stderr).toContain('ABORT');
            expect(stderr).toContain('--params-out est interdit en mode --pooled');
        },
        120000
    );
});
