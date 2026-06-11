/**
 * Chantier F — extension par-joueur de F-a : playerPockets (directive Alain
 * 2026-06-11). Fixture synthétique 3 joueurs d'intérêt / 2 équipes / 2 ligues
 * (LFL 2025 + LEC 2026) — JAMAIS un corpus réel.
 *
 * Nombre de tests DÉRIVÉ À LA MAIN :
 *  - fitPlayerHistory : agrégation/dédoublonnage (games/wins/lastDate/teams,
 *    cellules séparées par rôle), picks ignorés (sans playerId, irrésolu,
 *    sans rôle, ban) .................................................. 2 tests
 *  - currentLineup : majorité sur 10 récentes (remplaçant ancien hors
 *    fenêtre), égalité → le plus récent + side adverse jamais compté ;
 *    fenêtre N injectable + canonicalisation du nom ; équipe inconnue
 *    → Map vide ....................................................... 3 tests
 *  - playerReservoir : bits exacts à la main (−log₂, cap, transfert
 *    LFL→LEC) ; tri bits/games/lastDate ; minGames + cap custom + P=1
 *    ⇒ 0 exact (jamais −0) ; parité avec un VRAI fitPublicSelfModel .... 4 tests
 *  - roleDeceptions : multi-rôle ⇒ entrée du rôle minoritaire flaggée
 *    (mono-rôle jamais) ; majorité par games puis récence .............. 2 tests
 *  - anticipateEnemyPockets : par rôle du lineup, réservoir + deceptions,
 *    joueur sans carrière ⇒ entrées vides ............................. 1 test
 *  TOTAL ............................................................. 12 tests
 *
 * Arithmétique à la main (records LEC datés ⇒ le test « bits exacts » injecte
 * une masse synthétique ; le test de parité au VRAI modèle ne lit que les
 * valeurs structurelles — P = 0 ⇒ cap exact, main quotidienne ⇒ bits < 1) :
 *   masse injectée : P(leeSin, jungle) = 0,8 ⇒ bits = −log₂(0,8) ≈ 0,3219 ;
 *   P(nasus, jungle) = 0 ⇒ bits = −log₂(2^−10) = 10 (cap défaut) ; cap 6 ⇒ 6 ;
 *   P(sylas, mid) = 0,25 ⇒ bits = 2 exact ; P = 1 ⇒ bits = 0 exact (pas −0).
 */
import { describe, expect, it } from 'vitest';
import {
    anticipateEnemyPockets,
    currentLineup,
    fitPlayerHistory,
    playerReservoir,
    publicMassOf,
    roleDeceptions
} from '$lib/estimators/playerPockets';
import { fitPublicSelfModel } from '$lib/estimators/publicSelfModel';
import type { DraftAction, DraftRecord, DraftSide } from '$lib/data/types';
import { Role } from '$lib/types';

// ---- fixture synthétique ----------------------------------------------------------

interface PickSpec {
    championKey: string;
    role?: Role;
    playerId?: string;
}

function rec(opts: {
    gameId: string;
    blueTeam: string;
    redTeam: string;
    date?: string;
    winner?: DraftSide;
    league?: string;
    blue?: PickSpec[];
    red?: PickSpec[];
}): DraftRecord {
    const actions: DraftAction[] = [];
    let seq = 7;
    for (const side of ['blue', 'red'] as const) {
        for (const pick of (side === 'blue' ? opts.blue : opts.red) ?? []) {
            actions.push({
                seq: seq++,
                type: 'pick',
                phase: 'pick1',
                side,
                championKey: pick.championKey,
                championName: pick.championKey,
                ...(pick.role !== undefined ? { role: pick.role } : {}),
                ...(pick.playerId !== undefined ? { playerId: pick.playerId } : {})
            });
        }
    }
    return {
        gameId: opts.gameId,
        ...(opts.league !== undefined ? { league: opts.league } : {}),
        ...(opts.date !== undefined ? { date: opts.date } : {}),
        ...(opts.winner !== undefined ? { winner: opts.winner } : {}),
        blueTeam: opts.blueTeam,
        redTeam: opts.redTeam,
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions,
        warnings: [],
        provenance: { source: 'manual', fetchedAt: '2026-06-11T00:00:00Z' }
    };
}

/**
 * LFL 2025 — la carrière PASSÉE : Canyon (nasus jungle ×2 chez BK ROG, 1 win,
 * un pick par side pour tester l'attribution d'équipe) ; MidGod chez
 * Vitality.Bee (azir mid ×1 perdu, sylas TOP ×1 gagné — le futur décalage).
 */
const LFL: DraftRecord[] = [
    rec({
        gameId: 'lfl-1',
        league: 'lfl',
        date: '2025-03-01',
        winner: 'blue',
        blueTeam: 'BK ROG Esports',
        redTeam: 'Vitality.Bee',
        blue: [{ championKey: 'nasus', role: Role.Jungle, playerId: 'Canyon' }],
        red: [{ championKey: 'azir', role: Role.Middle, playerId: 'MidGod' }]
    }),
    rec({
        gameId: 'lfl-2',
        league: 'lfl',
        date: '2025-05-01',
        winner: 'blue',
        blueTeam: 'Vitality.Bee',
        redTeam: 'BK ROG Esports',
        blue: [{ championKey: 'sylas', role: Role.Top, playerId: 'MidGod' }],
        red: [{ championKey: 'nasus', role: Role.Jungle, playerId: 'Canyon' }]
    })
];

/**
 * LEC 2026 — l'équipe ACTUELLE (Karmine Corp, 12 games datées 01-01..01-12,
 * toutes gagnées côté KC bleu) : OldSub jungle sur les 2 plus ANCIENNES
 * (graves), Canyon jungle sur les 10 récentes (leeSin) ; mid partagé 5/5 dans
 * la fenêtre de 10 (Veteran azir g3-g7, MidGod sylas g8-g12 ⇒ égalité, le
 * plus récent gagne) ; Caps (G2, side rouge) ne doit JAMAIS compter pour KC.
 */
function kcGame(i: number, jungle: PickSpec, mid: PickSpec): DraftRecord {
    return rec({
        gameId: `lec-${String(i).padStart(2, '0')}`,
        league: 'lec',
        date: `2026-01-${String(i).padStart(2, '0')}`,
        winner: 'blue',
        blueTeam: 'Karmine Corp',
        redTeam: 'G2 Esports',
        blue: [jungle, mid],
        red: [{ championKey: 'viktor', role: Role.Middle, playerId: 'Caps' }]
    });
}

const LEC: DraftRecord[] = [
    kcGame(1, { championKey: 'graves', role: Role.Jungle, playerId: 'OldSub' }, { championKey: 'azir', role: Role.Middle, playerId: 'Veteran' }),
    kcGame(2, { championKey: 'graves', role: Role.Jungle, playerId: 'OldSub' }, { championKey: 'azir', role: Role.Middle, playerId: 'Veteran' }),
    ...[3, 4, 5, 6, 7].map((i) =>
        kcGame(i, { championKey: 'leeSin', role: Role.Jungle, playerId: 'Canyon' }, { championKey: 'azir', role: Role.Middle, playerId: 'Veteran' })
    ),
    ...[8, 9, 10, 11, 12].map((i) =>
        kcGame(i, { championKey: 'leeSin', role: Role.Jungle, playerId: 'Canyon' }, { championKey: 'sylas', role: Role.Middle, playerId: 'MidGod' })
    )
];

/** Carrière cross-ligues : TOUTES les ligues en argument (le contrat). */
const ALL = [...LFL, ...LEC];
const fitAll = fitPlayerHistory(ALL);

/** Masse publique synthétique de KC pour les bits exacts à la main. */
const massKC = (championKey: string, role: Role): number => {
    if (role === Role.Jungle && championKey === 'leeSin') return 0.8;
    if (role === Role.Middle && championKey === 'sylas') return 0.25;
    return 0; // nasus & toute main hors candidats du rôle
};

describe('fitPlayerHistory — carrière corpus cross-ligues par (champion, rôle)', () => {
    it('agrège games/wins/lastDate/teams par cellule, rôles séparés, déduplication', () => {
        const canyon = fitAll.byPlayer.get('Canyon');
        expect(canyon?.size).toBe(2); // nasus|jungle (dédupliqué sur 2 games) + leeSin|jungle
        const nasus = canyon?.get(`nasus|${Role.Jungle}`);
        expect(nasus?.games).toBe(2);
        expect(nasus?.wins).toBe(1); // lfl-1 gagnée côté bleu, lfl-2 perdue côté rouge
        expect(nasus?.lastDate).toBe('2025-05-01');
        expect([...(nasus?.teams ?? [])]).toEqual(['BK ROG Esports']); // side bleu PUIS rouge → même équipe
        const leeSin = canyon?.get(`leeSin|${Role.Jungle}`);
        expect(leeSin?.games).toBe(10);
        expect(leeSin?.wins).toBe(10);
        // MidGod : le MÊME champion dans 2 rôles = 2 cellules distinctes.
        const midgod = fitAll.byPlayer.get('MidGod');
        expect(midgod?.get(`sylas|${Role.Top}`)?.games).toBe(1);
        expect(midgod?.get(`sylas|${Role.Top}`)?.wins).toBe(1);
        expect(midgod?.get(`sylas|${Role.Middle}`)?.games).toBe(5);
        expect(midgod?.get(`azir|${Role.Middle}`)?.wins).toBe(0); // lfl-1 perdue côté rouge
    });

    it('ignore : pick sans playerId, pick irrésolu, pick sans rôle, action de ban', () => {
        const dirty = rec({
            gameId: 'dirty',
            date: '2026-01-01',
            winner: 'blue',
            blueTeam: 'X',
            redTeam: 'Y',
            blue: [
                { championKey: 'ahri', role: Role.Middle }, // sans playerId
                { championKey: '', role: Role.Top, playerId: 'Ghost' }, // irrésolu
                { championKey: 'gnar', playerId: 'NoRole' } // sans rôle
            ]
        });
        dirty.actions.push({
            seq: 1,
            type: 'ban',
            phase: 'ban1',
            side: 'blue',
            championKey: 'zed',
            championName: 'zed',
            role: Role.Middle,
            playerId: 'Banner'
        });
        expect(fitPlayerHistory([dirty]).byPlayer.size).toBe(0);
    });
});

describe('currentLineup — la compo actuelle lue du corpus seul', () => {
    it('majoritaire sur les 10 games les plus récentes : le remplaçant ancien (hors fenêtre) disparaît', () => {
        const lineup = currentLineup(LEC, 'Karmine Corp');
        expect(lineup.get(Role.Jungle)).toBe('Canyon'); // OldSub (g1-g2) hors fenêtre g3..g12
        expect(lineup.get(Role.Middle)).toBe('MidGod'); // 5-5 vs Veteran → le plus récent (g12)
        expect(lineup.size).toBe(2); // top/bot/support : aucune attribution ⇒ absents ; Caps (side G2) jamais compté
    });

    it('fenêtre N injectable + nom d’équipe canonicalisé (gol.gg vs corpus)', () => {
        // N = 12 : OldSub entre dans la fenêtre mais reste minoritaire (2 vs 10).
        expect(currentLineup(LEC, 'KARMINE-CORP', 12).get(Role.Jungle)).toBe('Canyon');
        // N = 2 : seules g12-g11 comptent.
        const tight = currentLineup(LEC, 'karmine corp', 2);
        expect(tight.get(Role.Jungle)).toBe('Canyon');
        expect(tight.get(Role.Middle)).toBe('MidGod');
    });

    it('équipe inconnue du corpus ⇒ Map vide ; picks sans rôle/playerId ignorés', () => {
        expect(currentLineup(LEC, 'Fnatic').size).toBe(0);
        const anonymous = rec({
            gameId: 'anon',
            date: '2026-02-01',
            blueTeam: 'Karmine Corp',
            redTeam: 'G2 Esports',
            blue: [
                { championKey: 'gnar', role: Role.Top }, // sans playerId
                { championKey: 'ahri', playerId: 'SansRole' } // sans rôle
            ]
        });
        expect(currentLineup([anonymous], 'Karmine Corp').size).toBe(0);
    });
});

describe('playerReservoir — surprise carrière vs masse publique injectée', () => {
    it('bits exacts à la main : la main LFL transférée sature au cap, la main quotidienne reste basse', () => {
        const reservoir = playerReservoir(fitAll, 'Canyon', massKC);
        expect(reservoir.map((e) => e.championKey)).toEqual(['nasus', 'leeSin']);
        expect(reservoir[0].bits).toBe(10); // P = 0 ⇒ −log₂(2^−10) = cap défaut, EXACT
        expect(reservoir[0].games).toBe(2);
        expect(reservoir[0].wins).toBe(1);
        expect(reservoir[0].lastDate).toBe('2025-05-01');
        expect(reservoir[0].teams).toEqual(['BK ROG Esports']); // la main vient d'ailleurs — le point
        expect(reservoir[0].offRole).toBeUndefined();
        expect(reservoir[1].bits).toBeCloseTo(-Math.log2(0.8), 12); // ≈ 0,3219
    });

    it('tri : bits desc, puis games desc, puis lastDate desc', () => {
        const tri = fitPlayerHistory([
            rec({ gameId: 't1', date: '2026-01-01', blueTeam: 'T', redTeam: 'U', blue: [{ championKey: 'c1', role: Role.Top, playerId: 'Tri' }] }),
            rec({ gameId: 't2', date: '2026-03-01', blueTeam: 'T', redTeam: 'U', blue: [{ championKey: 'c1', role: Role.Top, playerId: 'Tri' }] }),
            rec({ gameId: 't3', date: '2026-02-01', blueTeam: 'T', redTeam: 'U', blue: [{ championKey: 'c2', role: Role.Top, playerId: 'Tri' }] }),
            rec({ gameId: 't4', date: '2026-04-01', blueTeam: 'T', redTeam: 'U', blue: [{ championKey: 'c2', role: Role.Top, playerId: 'Tri' }] }),
            rec({ gameId: 't5', date: '2026-05-01', blueTeam: 'T', redTeam: 'U', blue: [{ championKey: 'c3', role: Role.Top, playerId: 'Tri' }] }),
            rec({ gameId: 't6', date: '2026-05-02', blueTeam: 'T', redTeam: 'U', blue: [{ championKey: 'c3', role: Role.Top, playerId: 'Tri' }] }),
            rec({ gameId: 't7', date: '2026-05-03', blueTeam: 'T', redTeam: 'U', blue: [{ championKey: 'c3', role: Role.Top, playerId: 'Tri' }] })
        ]);
        // P = 0 partout ⇒ bits égaux (cap) ⇒ games desc : c3 (3) avant c1/c2 (2) ;
        // c1 vs c2 à 2 games : lastDate desc ⇒ c2 (04-01) avant c1 (03-01).
        const order = playerReservoir(tri, 'Tri', () => 0).map((e) => e.championKey);
        expect(order).toEqual(['c3', 'c2', 'c1']);
    });

    it('minGames filtre, maxBitsCap plafonne, P = 1 ⇒ bits 0 exact (jamais −0)', () => {
        // MidGod : azir (1 game) et sylas top (1 game) tombent à minGames = 2.
        const filtered = playerReservoir(fitAll, 'MidGod', massKC, { minGames: 2 });
        expect(filtered.map((e) => `${e.championKey}|${e.role}`)).toEqual([`sylas|${Role.Middle}`]);
        expect(filtered[0].bits).toBe(2); // −log₂(0,25) exact
        // Cap custom : P = 0 ⇒ bits = 6.
        const capped = playerReservoir(fitAll, 'Canyon', () => 0, { maxBitsCap: 6 });
        expect(capped[0].bits).toBe(6);
        // P = 1 ⇒ −log₂(1) = −0 ⇒ garde IEEE : 0 exact.
        const certain = playerReservoir(fitAll, 'Canyon', () => 1);
        expect(Object.is(certain[0].bits, 0)).toBe(true);
        // Joueur inconnu ⇒ réservoir vide, jamais une invention.
        expect(playerReservoir(fitAll, 'Inconnu', massKC)).toEqual([]);
    });

    it('parité d’intégration : un VRAI fitPublicSelfModel de la NOUVELLE équipe via publicMassOf', () => {
        // Modèle public de KC sur le corpus LEC seul (la ligue courante du câblage).
        const model = fitPublicSelfModel(LEC, { team: 'Karmine Corp', now: '2026-06-01' });
        const reservoir = playerReservoir(fitAll, 'Canyon', publicMassOf(model));
        // nasus : jamais vu JUNGLE en LEC ⇒ hors candidats ⇒ P = 0 ⇒ cap exact —
        // la main LFL apparaît au sommet du réservoir LEC (transfert).
        expect(reservoir[0].championKey).toBe('nasus');
        expect(reservoir[0].bits).toBe(10);
        // leeSin : la main quotidienne de KC ⇒ P ≈ 1 ⇒ bits ≪ 1.
        expect(reservoir[1].championKey).toBe('leeSin');
        expect(reservoir[1].bits).toBeLessThan(1);
    });
});

describe('roleDeceptions — décalages de rôle déjà montrés (cas Nasus jungle)', () => {
    it('multi-rôle ⇒ entrée du rôle minoritaire flaggée offRole ; mono-rôle jamais', () => {
        const deceptions = roleDeceptions(fitAll, 'MidGod');
        // sylas : mid ×5 (majoritaire) vs top ×1 ⇒ l'entrée TOP sort, flaggée.
        expect(deceptions).toHaveLength(1);
        expect(deceptions[0].championKey).toBe('sylas');
        expect(deceptions[0].role).toBe(Role.Top);
        expect(deceptions[0].offRole).toBe(true);
        expect(deceptions[0].games).toBe(1);
        expect(deceptions[0].lastDate).toBe('2025-05-01');
        expect(deceptions[0].teams).toEqual(['Vitality.Bee']);
        expect(deceptions[0].bits).toBe(0); // convention : aucune masse injectée ici
        // Canyon : nasus et leeSin, tous deux jungle ⇒ aucun décalage.
        expect(roleDeceptions(fitAll, 'Canyon')).toEqual([]);
    });

    it('égalité de games ⇒ le rôle le plus RÉCENT est majoritaire, l’autre sort', () => {
        const flex = fitPlayerHistory([
            rec({ gameId: 'f1', date: '2026-02-01', blueTeam: 'T', redTeam: 'U', blue: [{ championKey: 'gnar', role: Role.Top, playerId: 'Flex' }] }),
            rec({ gameId: 'f2', date: '2026-03-01', blueTeam: 'T', redTeam: 'U', blue: [{ championKey: 'gnar', role: Role.Middle, playerId: 'Flex' }] })
        ]);
        const deceptions = roleDeceptions(flex, 'Flex');
        expect(deceptions).toHaveLength(1);
        expect(deceptions[0].role).toBe(Role.Top); // mid (03-01) majoritaire par récence
    });
});

describe('anticipateEnemyPockets — l’application défensive par joueur adverse', () => {
    it('par rôle du lineup : réservoir + deceptions ; joueur sans carrière ⇒ vide', () => {
        const lineup = currentLineup(LEC, 'Karmine Corp');
        const reads = anticipateEnemyPockets(fitAll, lineup, massKC);
        expect(reads.size).toBe(2);
        const jungle = reads.get(Role.Jungle);
        expect(jungle?.playerId).toBe('Canyon');
        expect(jungle?.reservoir[0]?.championKey).toBe('nasus'); // la répétition de pocket anticipée
        expect(jungle?.deceptions).toEqual([]);
        const mid = reads.get(Role.Middle);
        expect(mid?.playerId).toBe('MidGod');
        expect(mid?.deceptions[0]?.championKey).toBe('sylas');
        expect(mid?.deceptions[0]?.role).toBe(Role.Top);
        // Joueur présent au lineup mais inconnu de la carrière corpus.
        const ghost = anticipateEnemyPockets(fitAll, new Map([[Role.Top, 'Nobody']]), massKC);
        expect(ghost.get(Role.Top)).toEqual({ playerId: 'Nobody', reservoir: [], deceptions: [] });
    });
});
