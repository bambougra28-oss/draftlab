/**
 * Gate COACH v2 (run #3, chantier A3) — tests calculés À LA MAIN depuis la
 * règle gelée (docs/run3/A3-coach-player-pools.md §2.2-2.3) :
 *  - `championPoolOf` : agrégation par champion (multi-rôles, wins compris),
 *    tri clé asc, joueur inconnu ;
 *  - `lineupProPlayers` : ordre ROLES, id = name = playerId, deux joueurs
 *    partageant un champion = deux entrées (le dédoublonnage appartient à
 *    `rankOurCandidates`) ;
 *  - ANTI-FUITE lineup : un fit/lineup bâti sur le train SANS la game testée
 *    ignore le joueur qui n'apparaît que dans la game testée (le test
 *    matérialise la discipline du runner) ;
 *  - ÉQUIVALENCE chaîne shippée (patron v1 étape 2, OBLIGATOIRE) : le pilotage
 *    runner (rankOurCandidates + navigate) reproduit exactement
 *    candidates[].championKey ET enemyExpectation de recommendNext, ctx avec
 *    allyPlayers/rolePriors posés ; et chain v1 (ctx sans injections) → C_t v1
 *    avec filtre de rôle inerte ;
 *  - filtre de rôle effectif (retranche le mono-rôle fermé, garde-fou liste
 *    vidée, priors vides conservés), repli top-up ;
 *  - runner scripts/backtest/coachGateV2.ts : --chain obligatoire, --chain v1
 *    byte-identique au rapport gelé (porte de validité, version fixture) +
 *    --credits-out, --chain v2 byte-stable + couverture §1.2 + S6, --smoke
 *    aveugle (couverture, aucun taux).
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { championPoolOf, lineupProPlayers } from '$lib/backtest/coachPlayerChain';
import { currentLineup, fitPlayerHistory } from '$lib/estimators/playerPockets';
import {
    draftStateFromActions,
    enemyDistributionOf,
    filterByOpenRoles,
    rankOurCandidates,
    recommendNext,
    type CoachContext
} from '$lib/intel/liveDraft';
import { buildTendencyTable } from '$lib/aggregates/tendency';
import { buildDraftActions } from '$lib/data/draftRecord';
import type { DraftAction, DraftRecord, DraftSide } from '$lib/data/types';
import type { ProPlayer } from '$lib/pro/types';
import type { RolePriors } from '$lib/strategic/fogReveal';
import { navigate, nextSlotOf } from '$lib/strategic/draftNavigator';
import { Role } from '$lib/types';

// ---- fabrique de records minimaux (un pick attribué par record) -----------------

interface PickRecOpts {
    winner?: DraftSide;
    date?: string;
    blueTeam?: string;
    redTeam?: string;
}

/** Record minimal : UN pick résolu attribué (playerId + role) côté blue. */
function pickRec(
    gameId: string,
    championKey: string,
    role: Role,
    playerId: string,
    opts: PickRecOpts = {}
): DraftRecord {
    const action: DraftAction = {
        seq: 7,
        type: 'pick',
        phase: 'pick1',
        side: 'blue',
        championKey,
        championName: championKey,
        role,
        playerId
    };
    const record: DraftRecord = {
        gameId,
        blueTeam: opts.blueTeam ?? 'NOUS',
        redTeam: opts.redTeam ?? 'EUX',
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions: [action],
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-11T00:00:00Z' }
    };
    if (opts.winner !== undefined) record.winner = opts.winner;
    if (opts.date !== undefined) record.date = opts.date;
    return record;
}

// ---- championPoolOf : agrégation par champion, à la main -------------------------

describe('championPoolOf', () => {
    it('agrège par CHAMPION (Σ games, Σ wins sur les rôles), tri clé asc', () => {
        // PX : X|top 3 games (2 wins), X|jng 2 games (1 win), A|mid 1 game (0 win)
        // → {A, 1, 0} puis {X, 5, 3} (clé asc : 'A' < 'X').
        const fit = fitPlayerHistory([
            pickRec('g1', 'X', Role.Top, 'PX', { winner: 'blue' }),
            pickRec('g2', 'X', Role.Top, 'PX', { winner: 'blue' }),
            pickRec('g3', 'X', Role.Top, 'PX', { winner: 'red' }),
            pickRec('g4', 'X', Role.Jungle, 'PX', { winner: 'blue' }),
            pickRec('g5', 'X', Role.Jungle, 'PX', { winner: 'red' }),
            pickRec('g6', 'A', Role.Middle, 'PX', { winner: 'red' })
        ]);
        expect(championPoolOf(fit, 'PX')).toEqual([
            { championKey: 'A', games: 1, wins: 0 },
            { championKey: 'X', games: 5, wins: 3 }
        ]);
    });

    it('joueur inconnu du fit : []', () => {
        const fit = fitPlayerHistory([pickRec('g1', 'X', Role.Top, 'PX')]);
        expect(championPoolOf(fit, 'INCONNU')).toEqual([]);
    });
});

// ---- lineupProPlayers : forme ProPlayer, ordre ROLES ------------------------------

describe('lineupProPlayers', () => {
    it('ordre ROLES, id = name = playerId ; un champion partagé = deux entrées', () => {
        // P1 (top) et P2 (mid) ont tous deux montré 'X' : DEUX entrées (une
        // par pool) — le dédoublonnage appartient à rankOurCandidates.
        const fit = fitPlayerHistory([
            pickRec('g1', 'X', Role.Top, 'P1', { winner: 'blue' }),
            pickRec('g2', 'X', Role.Middle, 'P2', { winner: 'red' })
        ]);
        const lineup = new Map<Role, string>([
            [Role.Middle, 'P2'], // inséré AVANT top : l'ordre de sortie est ROLES
            [Role.Top, 'P1']
        ]);
        const players = lineupProPlayers(fit, lineup);
        expect(players).toEqual([
            { id: 'P1', name: 'P1', role: Role.Top, pool: [{ championKey: 'X', games: 1, wins: 1 }] },
            { id: 'P2', name: 'P2', role: Role.Middle, pool: [{ championKey: 'X', games: 1, wins: 0 }] }
        ]);
    });

    it('lineup vide : [] ; joueur sans cellule : pool []', () => {
        const fit = fitPlayerHistory([]);
        expect(lineupProPlayers(fit, new Map())).toEqual([]);
        expect(lineupProPlayers(fit, new Map([[Role.Top, 'P9']]))).toEqual([
            { id: 'P9', name: 'P9', role: Role.Top, pool: [] }
        ]);
    });
});

// ---- anti-fuite lineup : la game testée n'informe jamais son propre lineup --------

describe('anti-fuite lineup (discipline walk-forward du runner)', () => {
    it('fit/lineup sur le train SANS la game testée : le joueur du jour est invisible', () => {
        const trainGame = pickRec('TR-1', 'X', Role.Top, 'Vet', { winner: 'blue', date: '2026-01-01' });
        const testedGame = pickRec('TE-1', 'Y', Role.Top, 'Rookie', { winner: 'blue', date: '2026-02-01' });

        // Discipline du runner : fits sur train_k STRICT (la game testée exclue).
        const fitTrain = fitPlayerHistory([trainGame]);
        expect(championPoolOf(fitTrain, 'Rookie')).toEqual([]);
        const lineupTrain = currentLineup([trainGame], 'NOUS');
        expect(lineupTrain.get(Role.Top)).toBe('Vet');
        expect(lineupProPlayers(fitTrain, lineupTrain)).toEqual([
            { id: 'Vet', name: 'Vet', role: Role.Top, pool: [{ championKey: 'X', games: 1, wins: 1 }] }
        ]);

        // Contraste (la fuite qu'on interdit) : avec la game testée, le lineup
        // désignerait Rookie (égalité 1-1 → le plus récent gagne).
        const lineupLeaky = currentLineup([trainGame, testedGame], 'NOUS');
        expect(lineupLeaky.get(Role.Top)).toBe('Rookie');
        expect(fitPlayerHistory([trainGame, testedGame]).byPlayer.has('Rookie')).toBe(true);
    });
});

// ---- équivalence OBLIGATOIRE : chaîne runner ↔ recommendNext (ctx v2) -------------
// État synthétique sur clés réelles du fichier de tags, rôles COMMITTÉS sur nos
// picks. Évaluateur jouet : 0,5 + Σ poids alliés − Σ poids ennemis (patron v1).

const WEIGHTS: Record<string, number> = {
    '54': 0.1, // Malphite
    '103': 0.05, // Ahri
    '18': 0.04, // Tristana
    '13': 0.03, // Ryze
    '60': 0.02, // Elise
    '412': 0.01, // Thresh
    '111': 0.06, // Nautilus (range adverse)
    '117': 0.02 // Lulu (range adverse)
};
const toyEvaluate = (allyKeys: string[], enemyKeys: string[]): number =>
    0.5 +
    allyKeys.reduce((acc, key) => acc + (WEIGHTS[key] ?? 0), 0) -
    enemyKeys.reduce((acc, key) => acc + (WEIGHTS[key] ?? 0), 0);

/** Record d'historique adverse : red P6 varie (cellule de tendance non vide). */
function tableRecord(gameId: string, redThirdPick: string): DraftRecord {
    const { actions } = buildDraftActions({
        blue: { bans: [], picks: ['13', '60', '412'] },
        red: { bans: [], picks: ['145', '68', redThirdPick] },
        firstPickSide: 'blue',
        resolveKey: (key) => key
    });
    return {
        gameId,
        date: '2026-06-01',
        blueTeam: 'NOUS',
        redTeam: 'EUX',
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-01T00:00:00Z' }
    };
}

/**
 * État : 6 bans + picks 54(B, rôle top), 145(R), 68(R), 103(B, rôle jungle)
 * → seq 11, pick bleu. Nos rôles top et jungle sont COMMITTÉS (action.role).
 */
function equivalenceState() {
    const { actions } = buildDraftActions({
        blue: { bans: ['86', '23', '36'], picks: ['54', '103'], roles: [Role.Top, Role.Jungle] },
        red: { bans: ['75', '77', '106'], picks: ['145', '68'] },
        firstPickSide: 'blue',
        resolveKey: (key) => key
    });
    return draftStateFromActions(actions);
}

/** Priors posés : '120' volontairement ABSENT (inconnu des priors ⇒ conservé). */
const POSED_PRIORS: Record<string, Partial<Record<Role, number>>> = {
    '54': { [Role.Top]: 1 },
    '103': { [Role.Jungle]: 1 },
    '13': { [Role.Middle]: 1 },
    '18': { [Role.Bottom]: 1 },
    '412': { [Role.Support]: 1 },
    '60': { [Role.Jungle]: 1 }, // rôle committé ⇒ retranché
    '122': { [Role.Top]: 1 }, // rôle committé ⇒ retranché
    '11': { [Role.Jungle]: 1 } // rôle committé ⇒ retranché
};
const posedPriors: RolePriors = (key) => POSED_PRIORS[key] ?? {};

/** Pools joueurs posés : tiers distincts (strongest / match-ready / learning). */
const posedAllyPlayers = (): ProPlayer[] => [
    { id: 'MID', name: 'MID', role: Role.Middle, pool: [{ championKey: '13', games: 25, wins: 15 }] },
    { id: 'BOT', name: 'BOT', role: Role.Bottom, pool: [{ championKey: '18', games: 12, wins: 6 }] },
    { id: 'SUP', name: 'SUP', role: Role.Support, pool: [{ championKey: '412', games: 2, wins: 1 }] }
];

function equivalenceCtx(withInjections: boolean): CoachContext {
    const history = [tableRecord('e1', '111'), tableRecord('e2', '117')];
    return {
        ourSide: 'blue',
        evaluate: toyEvaluate,
        table: buildTendencyTable(history, history, { now: '2026-06-10T00:00:00Z', team: 'EUX' }),
        fallbackCandidates: ['18', '13', '60', '412', '120', '122', '11'],
        ...(withInjections ? { allyPlayers: posedAllyPlayers(), rolePriors: posedPriors } : {}),
        depth: 2,
        topK: 4,
        candidateCount: 6
    };
}

describe('équivalence chaîne shippée PILOTÉE (ctx v2 : allyPlayers + rolePriors)', () => {
    it('navigate piloté par rankOurCandidates ≡ recommendNext (clés, valeurs, enemyExpectation)', () => {
        const state = equivalenceState();
        const ctx = equivalenceCtx(true);
        const advice = recommendNext(state, ctx);

        // La chaîne du runner : mêmes fonctions shippées importées + navigate.
        const slot = nextSlotOf(state);
        expect(slot).toMatchObject({ seq: 11, type: 'pick', side: 'blue' });
        const shipped6 = rankOurCandidates(ctx, state, 6);
        // Pools d'abord (tiers : 13 strongest, 18 match-ready, 412 learning),
        // puis repli (60, 120, 122, 11) ; filtre de rôle (top+jungle committés,
        // ouverts = mid/bot/sup) : 60/122/11 retranchés, 120 inconnu conservé.
        expect(shipped6).toEqual(['13', '18', '412', '120']);
        const manual = navigate(state, {
            ourSide: 'blue',
            ourCandidates: () => shipped6,
            enemyDistribution: (s, enemySlot) => enemyDistributionOf(ctx, s, enemySlot),
            evaluate: toyEvaluate,
            depth: 2,
            topK: 4
        });

        // Équivalence exacte clé par clé, valeur par valeur — l'ORDRE est PAR
        // VALEUR : c'est navigate qui classe, pas la chaîne (A7).
        expect(manual.candidates.map((c) => c.championKey)).toEqual(
            advice.candidates.map((c) => c.championKey)
        );
        manual.candidates.forEach((candidate, index) => {
            expect(candidate.value).toBe(advice.candidates[index].winAfter);
        });
        expect(enemyDistributionOf(ctx, state, slot!).slice(0, 5)).toEqual(advice.enemyExpectation);

        // Nombres attendus, à la main : v(x) = 0,5 + (0,15 + poids(x)) − 0,04
        // (E[poids adverse P6] = ½·0,06 + ½·0,02) → 18: 0,65 ; 13: 0,64 ;
        // 412: 0,62 ; 120: 0,61.
        expect(advice.candidates.map((c) => c.championKey)).toEqual(['18', '13', '412', '120']);
        expect(advice.candidates[0].winAfter).toBeCloseTo(0.65, 10);
        expect(advice.candidates[1].winAfter).toBeCloseTo(0.64, 10);
        expect(advice.candidates[2].winAfter).toBeCloseTo(0.62, 10);
        expect(advice.candidates[3].winAfter).toBeCloseTo(0.61, 10);
        // P4-5|blue du train adverse : {60, 412}, p = ½ chacun, clé asc.
        expect(advice.enemyExpectation).toEqual([
            { championKey: '412', p: 0.5 },
            { championKey: '60', p: 0.5 }
        ]);
    });

    it('équivalence chain v1 : sans allyPlayers/rolePriors, C_t v1 — filtre de rôle INERTE', () => {
        const state = equivalenceState();
        const ctx = equivalenceCtx(false);
        // Les rôles de NOS picks sont committés dans S_t, mais sans rolePriors
        // injectés le filtre n'existe pas : C_t = repli présence pur, l'exact
        // C_t v1 du run #2 (le ctx `--chain v1` de la porte de validité).
        expect(rankOurCandidates(ctx, state, 6)).toEqual(['18', '13', '60', '412', '120', '122']);
    });
});

// ---- filtre de rôle : mécanique exportée (fonctions shippées seules, A5) ----------

describe('filterByOpenRoles (S_t à rôle committé)', () => {
    /** État : notre pick 54 au rôle TOP committé (action.role porté). */
    const committedState = () => {
        const { actions } = buildDraftActions({
            blue: { bans: [], picks: ['54'], roles: [Role.Top] },
            red: { bans: [], picks: [] },
            firstPickSide: 'blue',
            resolveKey: (key) => key
        });
        return draftStateFromActions(actions);
    };
    const priors: RolePriors = (key) =>
        ({
            topOnly: { [Role.Top]: 1 },
            midOnly: { [Role.Middle]: 1 }
        })[key] ?? {};

    it('retranche le candidat mono-rôle fermé ; priors vides ⇒ conservé', () => {
        const state = committedState();
        // 'topOnly' : 100 % de masse sur top (fermé) ⇒ retranché ;
        // 'inconnu' : priors {} ⇒ viabilité null ⇒ conservé ;
        // 'midOnly' : mid ouvert ⇒ conservé.
        expect(filterByOpenRoles(['topOnly', 'inconnu', 'midOnly'], state, 'blue', priors)).toEqual([
            'inconnu',
            'midOnly'
        ]);
        // Sans aucun rôle committé (état vide) : rien à contraindre.
        const empty = draftStateFromActions([]);
        const candidates = ['topOnly', 'midOnly'];
        expect(filterByOpenRoles(candidates, empty, 'blue', priors)).toBe(candidates);
    });

    it('garde-fou : liste vidée ⇒ liste NON filtrée retournée', () => {
        const state = committedState();
        const candidates = ['topOnly'];
        expect(filterByOpenRoles(candidates, state, 'blue', priors)).toBe(candidates);
    });
});

// ---- repli top-up : pools maigres complétés, jamais remplacés ---------------------

describe('repli top-up (rankOurCandidates)', () => {
    it('pool maigre complété par fallbackCandidates dans l\'ordre présence', () => {
        const ctx: CoachContext = {
            ourSide: 'blue',
            evaluate: toyEvaluate,
            allyPlayers: [
                { id: 'P1', name: 'P1', role: Role.Bottom, pool: [{ championKey: '18', games: 2, wins: 1 }] }
            ],
            fallbackCandidates: ['13', '60', '412']
        };
        const state = draftStateFromActions([]);
        // Pool d'abord ('18'), puis le repli DANS L'ORDRE présence — complété,
        // jamais remplacé.
        expect(rankOurCandidates(ctx, state, 6)).toEqual(['18', '13', '60', '412']);
    });
});

// ---- runner scripts/backtest/coachGateV2.ts (fixtures synthétiques) ---------------

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..');
const runnerScript = resolve(repoRoot, 'scripts', 'backtest', 'coachGateV2.ts');
const v1Corpus = 'tests/fixtures/coachgate/corpus.json';
const v2Corpus = 'tests/fixtures/coachgate/corpus-v2.json';
const fixtureDataset = 'tests/fixtures/coachgate/dataset.json';

const runnerArgs = (corpus: string, chain: string | null, extra: string[]): string[] => [
    '--experimental-transform-types',
    '--no-warnings',
    runnerScript,
    corpus,
    ...(chain !== null ? ['--chain', chain] : []),
    '--dataset',
    fixtureDataset,
    '--full-dataset',
    fixtureDataset,
    '--seed',
    '42',
    '--generated-at',
    '2026-06-11T00:00:00.000Z',
    ...extra
];

describe('runner scripts/backtest/coachGateV2.ts (mini-corpus synthétiques)', () => {
    it('--chain est OBLIGATOIRE (pas de défaut) : sortie en erreur sans lui', () => {
        expect(() =>
            execFileSync(process.execPath, runnerArgs(v1Corpus, null, []), {
                cwd: repoRoot,
                stdio: 'pipe'
            })
        ).toThrow();
    });

    it(
        '--chain v1 : ctx v1 EXACT + writer v1 à l\'octet près — rapport gelé reproduit byte-identique ; --credits-out mécanique',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'coachgate-v2-replay-'));
            const out = join(dir, 'replay-v1.md');
            const credits = join(dir, 'credits-v1.json');
            execFileSync(
                process.execPath,
                runnerArgs(v1Corpus, 'v1', ['--out', out, '--credits-out', credits]),
                { cwd: repoRoot, stdio: 'pipe' }
            );
            // Porte de validité (version fixture) : le rapport gelé du runner
            // v1 (`expected-report.md`, porte W2) est reproduit à l'octet.
            const expected = readFileSync(
                resolve(repoRoot, 'tests', 'fixtures', 'coachgate', 'expected-report.md'),
                'utf8'
            );
            expect(readFileSync(out, 'utf8')).toBe(expected);

            // Crédits par game : {corpus, gameId, cluster, credit, creditB1,
            // creditB2}, appariement S6 par `${corpus}::${gameId}`.
            const rows = JSON.parse(readFileSync(credits, 'utf8')) as Record<string, unknown>[];
            expect(rows).toHaveLength(4); // CG-G1, CG-G2, CG-G3, CG-G6 scorées
            expect(rows.map((r) => r.gameId).sort()).toEqual(['CG-G1', 'CG-G2', 'CG-G3', 'CG-G6']);
            const g3 = rows.find((r) => r.gameId === 'CG-G3')!;
            expect(g3.corpus).toBe(v1Corpus);
            expect(g3.cluster).toBe(`${v1Corpus}::CG-G3`); // sans série : son propre id
            for (const row of rows) {
                expect(Object.keys(row).sort()).toEqual([
                    'cluster',
                    'corpus',
                    'credit',
                    'creditB1',
                    'creditB2',
                    'gameId'
                ]);
                expect([0, 0.5, 1]).toContain(row.credit);
            }
        },
        240000
    );

    it(
        '--chain v2 : rendu byte-stable, couverture §1.2 calculée à la main, S6 sur l\'intersection',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'coachgate-v2-run-'));
            // Crédits v1 sur le MÊME corpus v2 (même préfixe ⇒ intersection pleine).
            const creditsV1 = join(dir, 'credits-v1.json');
            execFileSync(
                process.execPath,
                runnerArgs(v2Corpus, 'v1', ['--out', join(dir, 'v1-on-v2.md'), '--credits-out', creditsV1]),
                { cwd: repoRoot, stdio: 'pipe' }
            );

            const out1 = join(dir, 'rapport-v2-1.md');
            const out2 = join(dir, 'rapport-v2-2.md');
            execFileSync(
                process.execPath,
                runnerArgs(v2Corpus, 'v2', ['--out', out1, '--v1-credits', creditsV1]),
                { cwd: repoRoot, stdio: 'pipe' }
            );
            execFileSync(
                process.execPath,
                runnerArgs(v2Corpus, 'v2', ['--out', out2, '--v1-credits', creditsV1]),
                { cwd: repoRoot, stdio: 'pipe' }
            );
            const report1 = readFileSync(out1, 'utf8');
            const report2 = readFileSync(out2, 'utf8');
            expect(report1).toBe(report2); // byte-stable à seed/horodatage fixés

            // Structure v2 = patron v1 + sections nouvelles.
            expect(report1).toContain('# Gate COACH v2 — candidats par pools joueurs réels (run #3, chantier A3)');
            expect(report1).toContain('## Verdict (critères gelés §1.5)');
            expect(report1).toContain('## Baseline B1 — coach-présence (baseline ACTIVE)');
            expect(report1).toContain('### S5 — TD poolé sous IC bootstrap clusterisé par série');
            expect(report1).toContain('### S6 — delta apparié v2 − v1 (descriptive, §1.6 — AUCUN pouvoir de verdict)');
            expect(report1).toContain('## Couverture v2 — pools joueurs (§1.2, descriptive, AUCUN pouvoir)');
            expect(report1).toContain('## Notes honnêtes');
            expect(report1).toContain('seed 42');
            expect(report1).toContain('sha256');

            // S6 : intersection pleine (mêmes 4 games scorées par les deux chaînes).
            expect(report1).toContain('4 games appariées sur 4 scorées v2, 1000 resamples, seed 42');

            // Couverture héritée v1, comptes à la main (corpus-v2 = corpus v1
            // + role/playerId) : 9 records, 4 éligibles, 4 scorées, 39 tours
            // (1 template-mismatch), C_t ⊂ train (901-917, 941-950) ⇒ pick
            // réel (921-940) jamais dans C_t ; sonde adverse inchangée (19).
            expect(report1).toContain('| TOUS corpus | 4 |');
            expect(report1).toContain('9 records → 4 éligibles (1 sans vainqueur, 1 avec picks non résolus, 3 sans fold)');
            expect(report1).toContain('39 tours scorés');
            expect(report1).toContain('écartés : 1 template-mismatch, 0 too-few-comparators');
            expect(report1).toContain('distribution adverse active 19/39 tours');
            expect(report1).toContain('pick réel déjà dans C_t 0/39');
            expect(report1).toContain('0/10 → lockouts ON');
            expect(report1).toContain('(3 clusters, 4 games, 1000 resamples, seed 42)');

            // Couverture v2, comptes à la main :
            //  - joueur connu : Azur et Carmin (lineups 5/5, pools train non
            //    vides) couvrent G1 (10), G2 (10), G6 (9) + le side bleu de
            //    G3 (5) = 34 ; le side Topaze de G3 (lineup vide) = 5 tours
            //    inconnus → 34/39 ;
            //  - sides scorés (2 × 4 games) : Azur ×4 + Carmin ×3 = 7 complets,
            //    Topaze ×1 vide → 7 / 0 / 1 ;
            //  - pool-share : sides Azur/Carmin à 5 tours = 4+4+4+4+2 = 18
            //    candidats de pool (le 5ᵉ tour n'a que 2 pools rôle-viables),
            //    G6 Carmin (4 tours) = 14 → 4×18 + 2×18 + 14 = 122 sur
            //    39 × 4 = 156 ; tours 100 % repli = les 5 tours Topaze ;
            //  - filtre de rôle : retranche dès qu'un rôle est committé — tous
            //    les tours sauf les 7 premiers-de-side scorés → 32/39 ;
            //    garde-fou jamais déclenché (préFiltre jamais vidé) ;
            //  - pick-sans-role : 0 (fixture v2 entièrement attribuée).
            expect(report1).toContain('tours avec ≥ 1 joueur du lineup à pool train non vide 34/39');
            expect(report1).toContain('lineup 5/5 7, partiel (1-4) 0, vide 1');
            expect(report1).toContain('pool-share de C_t : 122/156');
            expect(report1).toContain('tours 100 % repli 5/39');
            expect(report1).toContain('retranché ≥ 1 candidat 32/39');
            expect(report1).toContain('garde-fou (liste vidée) 0/39');
            expect(report1).toContain('pick-sans-role 0.');
            expect(report1).toContain('Sonde anti-inertie (§1.2-4) : pick-sans-role total 0 — OK (0 exigé).');
            // Le diagnostic v1 publié EN REGARD (18,4 % ; 5,7 %).
            expect(report1).toContain('en regard du v1 (18,4 % poolé ; S1 v1 : 5,7 %');
        },
        240000
    );

    it(
        '--smoke --chain v2 aveugle : couverture en comptes, aucun taux, aucun rapport écrit',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'coachgate-v2-smoke-'));
            const out = join(dir, 'rapport-smoke.md');
            const stdout = execFileSync(
                process.execPath,
                runnerArgs(v2Corpus, 'v2', ['--out', out, '--smoke']),
                { cwd: repoRoot, encoding: 'utf8' }
            );
            expect(stdout).toContain('[smoke] corpus tests/fixtures/coachgate/corpus-v2.json');
            expect(stdout).toContain('lockouts ON');
            expect(stdout).toContain('records 9');
            expect(stdout).toContain('games éligibles 4 · scorées 4 · tours scorés 39');
            expect(stdout).toContain('template-mismatch 1');
            // Couverture v2 en COMPTES (calculés à la main, cf. test précédent).
            expect(stdout).toContain('pick-sans-role 0');
            expect(stdout).toContain('tours joueur connu 34/39');
            expect(stdout).toContain('sides lineup 5/5 7 · partiel 0 · vide 1');
            expect(stdout).toContain('candidats C_t issus des pools 122/156');
            expect(stdout).toContain('tours intégralement repli 5');
            expect(stdout).toContain('retranché 32 · garde-fou 0');
            expect(stdout).toContain('durée');
            // Aveugle : aucun taux, aucun pourcentage, aucun TD, rien d'écrit.
            expect(stdout).not.toMatch(/TD/);
            expect(stdout).not.toMatch(/%/);
            expect(existsSync(out)).toBe(false);
        },
        240000
    );
});
