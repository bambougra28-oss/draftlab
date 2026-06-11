/**
 * Chantier W2, étape 1 — harnais extrait du runner A (`coachGateHarness`).
 *
 *  - PORTE D'ÉQUIVALENCE OBLIGATOIRE : le runner `scripts/backtest/coachGate.ts`
 *    refactoré sur le harnais re-rend BYTE-IDENTIQUE le rapport gelé AVANT
 *    refactor (`tests/fixtures/coachgate/expected-report.md`, généré par le
 *    runner v1 monolithique sur la fixture synthétique, sha256
 *    a2cfe10d5457f2a01be0bfada471ddcdadcfe4550c520e0446bc55b8d526b574) ;
 *  - unités calculées à la main sur les pièces extraites : détecteur Fearless
 *    (réutilisation ⇒ OFF, lockedFor = picks des games antérieures), folds
 *    (premier patch ⇒ null, tri présence desc/clé asc, now_k = plus ancienne
 *    date du patch testé + repli injecté, WR train à vainqueur connu),
 *    moteur par game (univers − lockouts, C_t = shipped6 tronqué à 4, sondes).
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildFearlessDetector,
    makeCoachTurnEngine,
    makeFoldProvider
} from '$lib/backtest/coachGateHarness';
import { buildDraftActions } from '$lib/data/draftRecord';
import type { DraftRecord, DraftSide } from '$lib/data/types';
import type { ProPlayer } from '$lib/pro/types';
import type { RolePriors } from '$lib/strategic/fogReveal';
import { nextSlotOf, type DraftState } from '$lib/strategic/draftNavigator';
import { Role } from '$lib/types';

// ---- fabrique de records synthétiques (template tournoi, blue first) -----------

interface Cols {
    picks: (string | undefined)[];
    bans: (string | undefined)[];
}

interface RecOpts {
    patch?: string;
    date?: string;
    winner?: DraftSide;
    series?: { matchId: string; gameNumber: number };
    blueTeam?: string;
    redTeam?: string;
}

function rec(gameId: string, blue: Cols, red: Cols, opts: RecOpts = {}): DraftRecord {
    const { actions } = buildDraftActions({
        blue: { picks: blue.picks, bans: blue.bans },
        red: { picks: red.picks, bans: red.bans },
        firstPickSide: 'blue',
        resolveKey: (key) => key
    });
    const record: DraftRecord = {
        gameId,
        blueTeam: opts.blueTeam ?? 'NOUS',
        redTeam: opts.redTeam ?? 'EUX',
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-11T00:00:00Z' }
    };
    if (opts.patch !== undefined) record.patch = opts.patch;
    if (opts.date !== undefined) record.date = opts.date;
    if (opts.winner !== undefined) record.winner = opts.winner;
    if (opts.series !== undefined) record.series = opts.series;
    return record;
}

const picks5 = (prefix: string): string[] => [1, 2, 3, 4, 5].map((i) => `${prefix}${i}`);
const cols = (pickPrefix: string, banPrefix: string): Cols => ({
    picks: picks5(pickPrefix),
    bans: picks5(banPrefix)
});

// ---- détecteur Fearless ---------------------------------------------------------

describe('buildFearlessDetector', () => {
    it('série sans réutilisation : ON, lockedFor = picks des games antérieures', () => {
        const g1 = rec('S1-G1', cols('a', 'xa'), cols('b', 'xb'), {
            series: { matchId: 'S1', gameNumber: 1 }
        });
        const g2 = rec('S1-G2', cols('c', 'xc'), cols('d', 'xd'), {
            series: { matchId: 'S1', gameNumber: 2 }
        });
        const seul = rec('SEUL', cols('e', 'xe'), cols('f', 'xf'));
        const detector = buildFearlessDetector([g2, g1, seul]); // ordre brouillé exprès

        expect(detector.reused).toBe(0);
        expect(detector.examined).toBe(10); // les 10 picks de la game 2
        expect(detector.lockoutsOn).toBe(true);
        expect(detector.lockedFor(g1)).toEqual(new Set());
        expect(detector.lockedFor(g2)).toEqual(new Set([...picks5('a'), ...picks5('b')]));
        expect(detector.lockedFor(seul)).toEqual(new Set()); // sans série
    });

    it('une seule réutilisation : OFF — lockedFor vide partout', () => {
        const g1 = rec('S2-G1', cols('a', 'xa'), cols('b', 'xb'), {
            series: { matchId: 'S2', gameNumber: 1 }
        });
        // 'a1' rejoué en game 2 : détecteur = 1 ⇒ lockouts OFF (règle §1.2).
        const g2 = rec(
            'S2-G2',
            { picks: ['a1', 'c2', 'c3', 'c4', 'c5'], bans: picks5('xc') },
            cols('d', 'xd'),
            { series: { matchId: 'S2', gameNumber: 2 } }
        );
        const detector = buildFearlessDetector([g1, g2]);
        expect(detector.reused).toBe(1);
        expect(detector.examined).toBe(10);
        expect(detector.lockoutsOn).toBe(false);
        expect(detector.lockedFor(g2)).toEqual(new Set());
    });
});

// ---- folds (walk-forward par patch) ---------------------------------------------

const trainT1 = rec('T1', cols('p', 'x'), cols('q', 'y'), {
    patch: '1.1',
    date: '2026-01-05',
    winner: 'blue',
    blueTeam: 'NOUS',
    redTeam: 'EUX'
});
// EUX rejoue p1/p2 : présence 2/2 pour p1, p2 SEULS — tête du tri (desc, clé
// asc) ; tous les bans de T2 sont uniques (w/z) pour ne pas polluer la tête.
const trainT2 = rec(
    'T2',
    { picks: ['p1', 'p2', 'r3', 'r4', 'r5'], bans: picks5('w') },
    cols('s', 'z'),
    { patch: '1.1', date: '2026-01-06', winner: 'red', blueTeam: 'EUX', redTeam: 'NOUS' }
);
const testG1 = rec('G1', cols('g', 'u'), cols('h', 'v'), {
    patch: '1.2',
    date: '2026-02-01',
    winner: 'blue'
});

describe('makeFoldProvider', () => {
    it('premier patch : null ; patch testé : présence, now_k, WR train à la main', () => {
        const foldFor = makeFoldProvider([trainT1, trainT2, testG1], '2099-01-01T00:00:00Z');
        expect(foldFor('1.1')).toBeNull(); // aucun patch strictement antérieur

        const fold = foldFor('1.2');
        expect(fold).not.toBeNull();
        // Tri : présence desc (p1, p2 joués 2/2) puis clé asc parmi les 0,5.
        expect(fold!.presenceOrder.slice(0, 3)).toEqual(['p1', 'p2', 'p3']);
        expect(fold!.top15).toHaveLength(15);
        expect(fold!.presenceValue.get('p1')).toBe(-0); // v = −index (−0 au rang 0)
        expect(fold!.presenceValue.get('p2')).toBe(-1);
        // now_k = plus ancienne date du patch TESTÉ (pas du train).
        expect(fold!.nowK).toBe('2026-02-01');
        // WR train : NOUS 2/2 (blue T1, red T2), EUX 0/2 — vainqueur connu requis.
        expect(fold!.wrTrain.get('NOUS')).toEqual({ wins: 2, games: 2 });
        expect(fold!.wrTrain.get('EUX')).toEqual({ wins: 0, games: 2 });
        // trainKeys = toutes les clés résolues du train.
        expect(fold!.trainKeys.has('p1')).toBe(true);
        expect(fold!.trainKeys.has('y3')).toBe(true); // un ban du train
        expect(fold!.trainKeys.has('g1')).toBe(false); // clé du patch testé
    });

    it('patch testé sans date : now_k retombe sur le repli injecté', () => {
        const sansDate = rec('G2', cols('g', 'u'), cols('h', 'v'), { patch: '1.2' });
        const foldFor = makeFoldProvider([trainT1, trainT2, sansDate], '2099-01-01T00:00:00Z');
        expect(foldFor('1.2')!.nowK).toBe('2099-01-01T00:00:00Z');
    });
});

// ---- moteur par game --------------------------------------------------------------

describe('makeCoachTurnEngine', () => {
    const toyEvaluate = (): number => 0.5;
    const foldFor = makeFoldProvider([trainT1, trainT2, testG1], '2099-01-01T00:00:00Z');

    const engineOf = (locked: Set<string>) =>
        makeCoachTurnEngine(testG1, {
            fold: foldFor('1.2')!,
            locked,
            tagsKeys: ['tag1', 'tag2'],
            evaluate: toyEvaluate
        });

    /** État après les 6 bans de testG1 : prochain slot = seq 7, pick blue. */
    const stateAfterBans = (engine: ReturnType<typeof makeCoachTurnEngine>): DraftState => {
        const actions = testG1.actions.filter((a) => a.seq <= 6);
        return {
            actions,
            firstPickSide: 'blue',
            available: new Set([...engine.universe].filter((k) => !actions.some((a) => a.championKey === k)))
        };
    };

    it('univers = clés tags ∪ train ∪ game − lockouts', () => {
        const engine = engineOf(new Set(['p3', 'g1']));
        expect(engine.universe.has('tag1')).toBe(true); // clé tags injectée
        expect(engine.universe.has('p1')).toBe(true); // clé du train
        expect(engine.universe.has('h4')).toBe(true); // clé de la game
        expect(engine.universe.has('p3')).toBe(false); // lockout
        expect(engine.universe.has('g1')).toBe(false); // lockout (pick réel : anomalie comptée par la lib)
        expect(engine.availableOf(new Set())).toBe(engine.universe);
    });

    it('C_t = présence-top-15 → disponibilité → 6 → tronqué à 4 ; sondes par seq', () => {
        const engine = engineOf(new Set(['p3'])); // p3 verrouillé : sauté par la chaîne
        const state = stateAfterBans(engine);
        const slot = nextSlotOf(state);
        expect(slot).toMatchObject({ seq: 7, type: 'pick', side: 'blue' });

        expect(engine.ctOf(7)).toBeUndefined(); // tour jamais visité
        const ct = engine.candidatesOf(state, slot!);
        expect(ct).toEqual(['p1', 'p2', 'p4', 'p5']); // p3 absent, tronqué à 4
        expect(engine.ctOf(7)).toEqual(ct);

        // Pick réel par seq : seq 7 = premier pick bleu de testG1 ; seq 1 = ban.
        expect(engine.realPickKeyAt(7)).toBe('g1');
        expect(engine.realPickKeyAt(1)).toBeUndefined();

        // valueOf modèle : navigate racine-forcée, nœuds comptés.
        expect(engine.evaluatedNodes).toBe(0);
        const value = engine.modelDeps.valueOf(state, slot!, 'p1');
        expect(Number.isFinite(value)).toBe(true);
        expect(engine.evaluatedNodes).toBeGreaterThan(0);
    });
});

// ---- seam additif v2 (run #3, chantier A3) : allyPlayersFor / rolePriors ----------

describe('seam additif v2 — allyPlayersFor / rolePriors (chantier A3, §2.1)', () => {
    const toyEvaluate = (): number => 0.5;
    const foldFor = makeFoldProvider([trainT1, trainT2, testG1], '2099-01-01T00:00:00Z');

    /** État après les 6 bans de testG1 : prochain slot = seq 7, pick blue. */
    const stateAfterBansOf = (engine: ReturnType<typeof makeCoachTurnEngine>): DraftState => {
        const actions = testG1.actions.filter((a) => a.seq <= 6);
        return {
            actions,
            firstPickSide: 'blue',
            available: new Set([...engine.universe].filter((k) => !actions.some((a) => a.championKey === k)))
        };
    };

    it('options absentes : le ctx du tour est le ctx v1 byte-identique (aucune clé ajoutée)', () => {
        const engine = makeCoachTurnEngine(testG1, {
            fold: foldFor('1.2')!,
            locked: new Set(),
            tagsKeys: ['tag1', 'tag2'],
            evaluate: toyEvaluate
        });
        const state = stateAfterBansOf(engine);
        const slot = nextSlotOf(state)!;
        const entry = engine.turnEntryOf(state, slot);
        // Aucune clé `allyPlayers` ni `rolePriors` — pas même `undefined` :
        // le chemin `--chain v1` de la porte de validité en dépend.
        expect('allyPlayers' in entry.ctx).toBe(false);
        expect('rolePriors' in entry.ctx).toBe(false);
        // C_t v1 inchangé : présence-top-15 → disponibilité → 6 → tronqué à 4.
        expect(engine.candidatesOf(state, slot)).toEqual(['p1', 'p2', 'p3', 'p4']);
    });

    it('options posées : recopiées TELLES QUELLES dans le ctx ; pools en tête de C_t', () => {
        const pool: ProPlayer[] = [
            { id: 'J1', name: 'J1', role: Role.Top, pool: [{ championKey: 'tag1', games: 5, wins: 3 }] }
        ];
        const priors: RolePriors = () => ({});
        const sides: DraftSide[] = [];
        const engine = makeCoachTurnEngine(testG1, {
            fold: foldFor('1.2')!,
            locked: new Set(),
            tagsKeys: ['tag1', 'tag2'],
            evaluate: toyEvaluate,
            allyPlayersFor: (side) => {
                sides.push(side);
                return pool;
            },
            rolePriors: priors
        });
        const state = stateAfterBansOf(engine);
        const slot = nextSlotOf(state)!;
        const entry = engine.turnEntryOf(state, slot);
        // Recopiés tels quels (mêmes références — aucune transformation).
        expect(entry.ctx.allyPlayers).toBe(pool);
        expect(entry.ctx.rolePriors).toBe(priors);
        // `allyPlayersFor` reçoit le side du slot (seq 7 = pick blue).
        expect(sides).toEqual(['blue']);
        // C_t : pool d'abord ('tag1', 5 games), puis repli présence. Les
        // actions de testG1 ne portent aucun rôle ⇒ 5 rôles ouverts ⇒ le
        // filtre de rôle ne contraint rien ; priors vides ⇒ candidats
        // inconnus conservés de toute façon.
        expect(engine.candidatesOf(state, slot)).toEqual(['tag1', 'p1', 'p2', 'p3']);
    });
});

// ---- PORTE W2 : équivalence byte-identique avant/après refactor -------------------

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..');

describe('PORTE W2 — équivalence du runner refactoré (fixture synthétique)', () => {
    it(
        'le runner re-rend EXACTEMENT le rapport gelé pré-refactor (byte-identique)',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'coachgate-equiv-'));
            const out = join(dir, 'rapport.md');
            execFileSync(
                process.execPath,
                [
                    '--experimental-transform-types',
                    '--no-warnings',
                    resolve(repoRoot, 'scripts', 'backtest', 'coachGate.ts'),
                    'tests/fixtures/coachgate/corpus.json',
                    '--dataset',
                    'tests/fixtures/coachgate/dataset.json',
                    '--full-dataset',
                    'tests/fixtures/coachgate/dataset.json',
                    '--seed',
                    '42',
                    '--generated-at',
                    '2026-06-11T00:00:00.000Z',
                    '--out',
                    out
                ],
                { cwd: repoRoot, stdio: 'pipe' }
            );
            const expected = readFileSync(
                resolve(repoRoot, 'tests', 'fixtures', 'coachgate', 'expected-report.md'),
                'utf8'
            );
            expect(readFileSync(out, 'utf8')).toBe(expected);
        },
        240000
    );
});
