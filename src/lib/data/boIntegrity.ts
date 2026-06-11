/**
 * G — Intégrité structurelle des Bo + doctrine de quarantaine fraîcheur
 * (leçon Nasus, run #2 ; spec architecte gelée post-revue adversariale).
 *
 * POURQUOI : le pull lec-2026 du 10 juin 2026 portait des erreurs de saisie
 * wiki fraîches sur la finale LEC (vainqueurs G1/G5 + colonnes d'équipe G5
 * inversés). Résultat dans le corpus : une série pliée 3-1 après la G4 PUIS
 * une G5 jouée dont le vainqueur n'est pas le vainqueur de série — séquence
 * IMPOSSIBLE dans un BoN (la série s'arrête au clinch). Ce module détecte ces
 * impossibilités STRUCTURELLES, sans aucune métrique d'outcome : c'est de la
 * géométrie de série, pas de l'évaluation de modèle.
 *
 * RÈGLE GELÉE :
 *  - groupement par `series.matchId`, tri par `series.gameNumber` (les records
 *    sans matchId sont hors périmètre : aucune série à vérifier) ;
 *  - 'duplicate-game-number' : un numéro de game porté deux fois ;
 *  - 'gap' : numéros distincts non contigus 1..L ;
 *  - 'teams-changed' : la série ne met pas en jeu EXACTEMENT 2 équipes
 *    (l'alternance de side blue/red entre games est normale et ignorée) ;
 *  - 'game-after-clinch' : format inférable par maxWins final ∈ {2, 3}
 *    (⇒ bo3/bo5) ET une game existe APRÈS que la cible de victoires est
 *    atteinte ;
 *  - 'decider-winner-mismatch' : série où maxWins est atteint, mais le
 *    vainqueur de la DERNIÈRE game n'est pas l'équipe au maxWins ;
 *  - 'winner-unknown' : descriptif, non bloquant.
 *
 * PRUDENCE (gelée) — on ne conclut clinch/decider QUE quand le format est
 * inférable ET la cible atteinte :
 *  - Bo2 1-1 légitimes (LCK/LEC/LPL 2026 en ont) : maxWins = 1 ∉ {2, 3}
 *    ⇒ aucune conclusion ;
 *  - séries 2-2 abandonnées : DEUX équipes au maxWins ⇒ le format « décidé »
 *    n'est pas inférable ⇒ aucune conclusion (d'où l'exigence d'un détenteur
 *    UNIQUE du maxWins) ;
 *  - séquence non saine (doublon, gap, ≠ 2 équipes, vainqueur inconnu) : les
 *    comptes de victoires ne sont plus fiables (ex. : un Bo5 3-1 légitime
 *    amputé de sa G4 ressemblerait à un bo3 corrompu) ⇒ on rapporte les
 *    violations structurelles de séquence mais AUCUNE conclusion clinch/decider.
 *
 * Tout est pur et déterministe : l'ordre de sortie suit la première apparition
 * du matchId dans `records`, puis l'ordre des games dans la série.
 */
import type { DraftRecord } from '$lib/data/types';

export type BoViolationKind =
    | 'duplicate-game-number'
    | 'gap'
    | 'teams-changed'
    | 'game-after-clinch'
    | 'decider-winner-mismatch'
    | 'winner-unknown';

export interface BoViolation {
    /** `series.matchId` de la série concernée. */
    matchId: string;
    /** `gameId` de la game fautive (pour 'gap' : première game après le trou). */
    gameId: string;
    kind: BoViolationKind;
    /** Explication en français : le pourquoi de l'impossibilité, pour apprendre. */
    detailFr: string;
}

/**
 * Kinds STRUCTURELS : leur présence rend le corpus impropre à un run de gate
 * (exit code 1 de scripts/data/validateCorpus.ts). 'winner-unknown' est
 * descriptif : il signale un manque, pas une impossibilité.
 */
export const STRUCTURAL_BO_VIOLATION_KINDS: readonly BoViolationKind[] = [
    'duplicate-game-number',
    'gap',
    'teams-changed',
    'game-after-clinch',
    'decider-winner-mismatch'
];

export function isStructuralBoViolation(kind: BoViolationKind): boolean {
    return STRUCTURAL_BO_VIOLATION_KINDS.includes(kind);
}

/** Équipe victorieuse d'une game (les sides changent entre les games d'une série). */
function winnerTeam(record: DraftRecord): string | undefined {
    if (record.winner === 'blue') return record.blueTeam;
    if (record.winner === 'red') return record.redTeam;
    return undefined;
}

/**
 * Valide la cohérence Bo d'un corpus entier. Voir l'en-tête du module pour la
 * règle gelée et les garde-fous de prudence.
 */
export function validateBoIntegrity(records: DraftRecord[]): BoViolation[] {
    const bySeries = new Map<string, DraftRecord[]>();
    for (const record of records) {
        const matchId = record.series?.matchId;
        if (matchId === undefined || matchId === '') continue;
        const group = bySeries.get(matchId);
        if (group === undefined) bySeries.set(matchId, [record]);
        else group.push(record);
    }

    const violations: BoViolation[] = [];
    for (const [matchId, group] of bySeries) {
        // Tri stable par gameNumber ; un gameNumber non fini est relégué en fin
        // de série (il fera échouer la contiguïté 1..L, donc 'gap').
        const games = [...group].sort(
            (a, b) =>
                (Number.isFinite(a.series?.gameNumber) ? a.series!.gameNumber : Infinity) -
                (Number.isFinite(b.series?.gameNumber) ? b.series!.gameNumber : Infinity)
        );

        // -- doublons de numéro de game ---------------------------------------
        let hasDuplicate = false;
        const firstByNumber = new Map<number, DraftRecord>();
        for (const game of games) {
            const n = game.series!.gameNumber;
            const first = firstByNumber.get(n);
            if (first === undefined) {
                firstByNumber.set(n, game);
                continue;
            }
            hasDuplicate = true;
            violations.push({
                matchId,
                gameId: game.gameId,
                kind: 'duplicate-game-number',
                detailFr:
                    `Le numéro de game ${n} est porté deux fois dans la série (déjà porté par ` +
                    `${first.gameId}). Deux games ne peuvent pas occuper le même rang d'un Bo : ` +
                    `doublon d'import ou numérotation erronée côté source.`
            });
        }

        // -- contiguïté 1..L des numéros distincts -----------------------------
        const distinct = [...firstByNumber.keys()].sort((a, b) => a - b);
        let gapAt = -1;
        for (let i = 0; i < distinct.length; i++) {
            if (distinct[i] !== i + 1) {
                gapAt = i;
                break;
            }
        }
        const hasGap = gapAt !== -1;
        if (hasGap) {
            const offending = firstByNumber.get(distinct[gapAt])!;
            const maxN = distinct[distinct.length - 1];
            const missing: number[] = [];
            if (Number.isFinite(maxN)) {
                for (let n = 1; n <= maxN; n++) if (!firstByNumber.has(n)) missing.push(n);
            }
            violations.push({
                matchId,
                gameId: offending.gameId,
                kind: 'gap',
                detailFr:
                    `Numéros de game non contigus : observés [${distinct.join(', ')}], attendus ` +
                    `1..${distinct.length}${missing.length > 0 ? ` (manquants : ${missing.join(', ')})` : ''}. ` +
                    `Un trou dans la séquence signifie une game manquante ou mal numérotée : la ` +
                    `série ne peut pas être relue comme un Bo complet.`
            });
        }

        // -- exactement 2 équipes sur la série ---------------------------------
        let teamsOk = true;
        const teams = new Set<string>();
        for (const game of games) {
            teams.add(game.blueTeam);
            teams.add(game.redTeam);
            if (teams.size > 2) {
                teamsOk = false;
                violations.push({
                    matchId,
                    gameId: game.gameId,
                    kind: 'teams-changed',
                    detailFr:
                        `Plus de 2 équipes apparaissent dans la série (${[...teams].join(', ')}). ` +
                        `Un Bo oppose toujours les 2 mêmes équipes (seuls les sides alternent) : ` +
                        `renommage en cours de série ou colonnes d'équipe corrompues.`
                });
                break;
            }
        }
        if (teamsOk && teams.size < 2) {
            teamsOk = false;
            violations.push({
                matchId,
                gameId: games[0].gameId,
                kind: 'teams-changed',
                detailFr:
                    `Une seule équipe (${[...teams].join(', ')}) apparaît sur les deux sides de la ` +
                    `série : colonnes d'équipe dupliquées ou corrompues à la saisie.`
            });
        }

        // -- vainqueurs connus ? -----------------------------------------------
        let winnersKnown = true;
        for (const game of games) {
            if (winnerTeam(game) !== undefined) continue;
            winnersKnown = false;
            violations.push({
                matchId,
                gameId: game.gameId,
                kind: 'winner-unknown',
                detailFr:
                    `Vainqueur absent du record (game ${game.series!.gameNumber}). Descriptif, non ` +
                    `bloquant — mais sans tous les vainqueurs, la structure BoN de la série ne peut ` +
                    `pas être vérifiée (aucune conclusion clinch/decider ne sera tirée).`
            });
        }

        // -- clinch & decider : uniquement sur séquence saine (prudence gelée) --
        if (hasDuplicate || hasGap || !teamsOk || !winnersKnown || games.length === 0) continue;

        const tally = new Map<string, number>();
        for (const game of games) {
            const team = winnerTeam(game)!;
            tally.set(team, (tally.get(team) ?? 0) + 1);
        }
        let maxWins = 0;
        for (const wins of tally.values()) maxWins = Math.max(maxWins, wins);
        const leaders = [...tally.entries()].filter(([, wins]) => wins === maxWins);
        // Format inférable : maxWins final ∈ {2, 3} (⇒ bo3/bo5) ET détenteur
        // unique (sinon : Bo2 1-1, 2-2 abandonné… — aucune conclusion).
        if ((maxWins !== 2 && maxWins !== 3) || leaders.length !== 1) continue;

        const leader = leaders[0][0];
        const target = maxWins;
        const boLabel = target === 2 ? 'Bo3' : 'Bo5';
        const scoreline = `${maxWins}-${games.length - maxWins}`;

        let clinchIndex = -1;
        let leaderWins = 0;
        for (let i = 0; i < games.length; i++) {
            if (winnerTeam(games[i]) !== leader) continue;
            leaderWins++;
            if (leaderWins === target) {
                clinchIndex = i;
                break;
            }
        }
        // maxWins ∈ {2, 3} avec vainqueurs tous connus ⇒ la cible est atteinte.
        const clinchGame = games[clinchIndex];
        for (let i = clinchIndex + 1; i < games.length; i++) {
            violations.push({
                matchId,
                gameId: games[i].gameId,
                kind: 'game-after-clinch',
                detailFr:
                    `${boLabel} inféré (score final ${scoreline}) : ${leader} atteint ${target} ` +
                    `victoires dès la game ${clinchGame.series!.gameNumber} — la série est pliée, ` +
                    `la game ${games[i].series!.gameNumber} ne devrait pas exister. Séquence ` +
                    `${boLabel} impossible : erreur de saisie probable (vainqueurs ou colonnes ` +
                    `d'équipe inversés côté source).`
            });
        }

        const last = games[games.length - 1];
        const lastWinner = winnerTeam(last)!;
        if (lastWinner !== leader) {
            violations.push({
                matchId,
                gameId: last.gameId,
                kind: 'decider-winner-mismatch',
                detailFr:
                    `Le vainqueur de la dernière game (${lastWinner}, game ` +
                    `${last.series!.gameNumber}) n'est pas l'équipe au maxWins (${leader}, ` +
                    `${maxWins} victoires). En ${boLabel}, la série s'arrête quand ${leader} ` +
                    `gagne sa ${target}e game : une dernière game perdue par le vainqueur de ` +
                    `série est structurellement impossible — c'est le cas Nasus (finale LEC, ` +
                    `pull du 10 juin 2026).`
            });
        }
    }

    return violations;
}

const DAY_MS = 86_400_000;

/**
 * Doctrine de quarantaine fraîcheur : compte les records dont la date est à
 * moins de `withinDays` jours de `nowMs` (strictement). Les saisies wiki
 * fraîches sont les plus exposées aux erreurs humaines (leçon Nasus) — un
 * re-pull est recommandé avant tout run de gate tant que ce compte est > 0.
 *
 * Déterministe : `nowMs` est injecté (règle projet : pas d'horloge ambiante
 * dans la logique pure). Les records sans date ou à date illisible ne sont pas
 * comptés ; une date FUTURE est comptée (donnée suspecte ⇒ côté quarantaine).
 */
export function countFreshRecords(
    records: DraftRecord[],
    withinDays: number,
    nowMs: number
): number {
    let count = 0;
    for (const record of records) {
        if (record.date === undefined) continue;
        const dateMs = Date.parse(record.date);
        if (Number.isNaN(dateMs)) continue;
        if (nowMs - dateMs < withinDays * DAY_MS) count++;
    }
    return count;
}
