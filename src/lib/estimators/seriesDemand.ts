/**
 * Chantier C — Surface de demande série Fearless (docs/run2/C-fearless-g3.md
 * §2.2 ; règle gelée §1.1 « MODÈLE M / BASELINE B1 / BASELINE B0 ») — ET
 * l'adaptateur `wantProbability` que `seriesSolver.denialValue` exige en
 * injection (jamais deviné, contrat du module).
 *
 * Formule gelée (constantes = défauts doctrine §6.5, identiques à
 * `$lib/aggregates/tendency.ts`) :
 *
 *   masse_T(c, r) = Σ_{picks de T, rôle r, train} λ^(âge_semaines)
 *                 + α · P_ligue(c | r)
 *   P_ligue(c | r) = picks(c, r, train toutes équipes) / picks(·, r, train)
 *
 * La décroissance temporelle RÉUTILISE `recencyWeight` de
 * `$lib/aggregates/tendency.ts` (même clamp âge ≥ 0, poids 1 si non daté) —
 * zéro réimplémentation de la pondération. Modèle et baselines partagent le
 * même objet ajusté : aucune asymétrie d'accès aux données.
 *
 * Conventions de comptage :
 *  - seuls les picks RÉSOLUS (championKey ≠ '') comptent ;
 *  - les masses par rôle exigent un rôle connu sur le pick (100 % au corpus) ;
 *  - les comptes bruts équipe (B1) et ligue (B0) comptent TOUS les picks
 *    résolus, tous rôles confondus (rôle absent inclus) — « compte brut de
 *    picks », pas « compte par rôle » ;
 *  - « compte ligue » des tie-breaks = le compte brut ligue tous rôles
 *    (`leagueCounts`), seul compte capable de départager deux candidats d'un
 *    même rôle à masses égales (à rôle fixé, des masses égales sans évidence
 *    équipe impliquent des comptes de rôle égaux).
 *
 * Module pur : zéro I/O, zéro horloge (`now` injecté).
 */
import { recencyWeight } from '$lib/aggregates/tendency';
import type { DraftRecord, DraftSide } from '$lib/data/types';
import { ROLES, type Role } from '$lib/types';

export interface SeriesDemandOptions {
    team: string;
    /** Horloge injectée (date de la game à prédire) pour la décroissance λ. */
    now: string;
    /** Défaut 5 — identique à $lib/aggregates/tendency.ts (doctrine §6.5). */
    alpha?: number;
    /** Défaut 0,9/semaine — identique à $lib/aggregates/tendency.ts. */
    lambdaPerWeek?: number;
}

export interface DemandEntry {
    championKey: string;
    role: Role;
    /** λ-pondéré via recencyWeight + α·P_ligue — la masse de la règle gelée. */
    mass: number;
    teamRawCount: number;
    leaguePrior: number;
}

export interface DemandSurface {
    /** Entrées par rôle, triées masse desc (tie-breaks gelés §1.1). */
    byRole: Map<Role, DemandEntry[]>;
    /** Comptes bruts équipe tous rôles (B1) et ligue (B0/tie-breaks). */
    teamCounts: Map<string, number>;
    leagueCounts: Map<string, number>;
}

/** Équipe agissant côté `side` dans ce record. */
function actingTeam(record: DraftRecord, side: DraftSide): string {
    return side === 'blue' ? record.blueTeam : record.redTeam;
}

/** Tri gelé §1.1 d'un rôle : masse desc → compte brut équipe desc → compte ligue desc → clé asc. */
function compareEntries(a: DemandEntry, b: DemandEntry, leagueCounts: Map<string, number>): number {
    if (a.mass !== b.mass) return b.mass - a.mass;
    if (a.teamRawCount !== b.teamRawCount) return b.teamRawCount - a.teamRawCount;
    const leagueA = leagueCounts.get(a.championKey) ?? 0;
    const leagueB = leagueCounts.get(b.championKey) ?? 0;
    if (leagueA !== leagueB) return leagueB - leagueA;
    return a.championKey < b.championKey ? -1 : 1;
}

/**
 * Ajuste la surface de demande de l'équipe sur le train : masses par
 * (rôle, champion), comptes bruts équipe et ligue. Les candidats d'un rôle
 * sont les champions observés dans ce rôle dans le train (toutes équipes) —
 * un champion jamais vu dans le rôle a une masse nulle et n'est pas candidat.
 */
export function fitTeamDemand(train: DraftRecord[], options: SeriesDemandOptions): DemandSurface {
    const alpha = options.alpha ?? 5;
    const lambdaPerWeek = options.lambdaPerWeek ?? 0.9;

    const teamCounts = new Map<string, number>();
    const leagueCounts = new Map<string, number>();
    /** Par rôle : compte ligue par champion (numérateur de P_ligue) + total. */
    const leagueByRole = new Map<Role, { counts: Map<string, number>; total: number }>();
    /** Par rôle : évidence équipe par champion (Σ poids λ + compte brut). */
    const teamByRole = new Map<Role, Map<string, { weighted: number; raw: number }>>();

    for (const record of train) {
        const weight = recencyWeight(record.date, options.now, lambdaPerWeek);
        for (const action of record.actions) {
            if (action.type !== 'pick' || action.championKey === '') continue;
            const team = actingTeam(record, action.side);
            const isTeam = team === options.team;

            // Comptes bruts tous rôles (B1 équipe / B0 ligue / tie-breaks).
            leagueCounts.set(action.championKey, (leagueCounts.get(action.championKey) ?? 0) + 1);
            if (isTeam) teamCounts.set(action.championKey, (teamCounts.get(action.championKey) ?? 0) + 1);

            // Masses par rôle (rôle requis).
            const role = action.role;
            if (role === undefined) continue;
            let league = leagueByRole.get(role);
            if (league === undefined) {
                league = { counts: new Map<string, number>(), total: 0 };
                leagueByRole.set(role, league);
            }
            league.counts.set(action.championKey, (league.counts.get(action.championKey) ?? 0) + 1);
            league.total += 1;

            if (isTeam) {
                let evidence = teamByRole.get(role);
                if (evidence === undefined) {
                    evidence = new Map<string, { weighted: number; raw: number }>();
                    teamByRole.set(role, evidence);
                }
                const cell = evidence.get(action.championKey) ?? { weighted: 0, raw: 0 };
                cell.weighted += weight;
                cell.raw += 1;
                evidence.set(action.championKey, cell);
            }
        }
    }

    const byRole = new Map<Role, DemandEntry[]>();
    for (const [role, league] of leagueByRole) {
        if (league.total === 0) continue;
        const evidence = teamByRole.get(role);
        const entries: DemandEntry[] = [];
        for (const [championKey, count] of league.counts) {
            const prior = count / league.total;
            const cell = evidence?.get(championKey);
            entries.push({
                championKey,
                role,
                mass: (cell?.weighted ?? 0) + alpha * prior,
                teamRawCount: cell?.raw ?? 0,
                leaguePrior: prior
            });
        }
        entries.sort((a, b) => compareEntries(a, b, leagueCounts));
        byRole.set(role, entries);
    }

    return { byRole, teamCounts, leagueCounts };
}

/**
 * Modèle M : 5 champions distincts, un par rôle (greedy gelé §1.1).
 * Rôles traités par masse de tête décroissante — masse de tête = masse du
 * meilleur candidat NON CONSOMMÉ du rôle, calculée UNE FOIS avant le greedy ;
 * les retenus des rôles précédents ne réordonnent pas les rôles ; égalité de
 * masses de tête : ordre canonique ROLES. Dans un rôle : argmax masse sur les
 * candidats non consommés et non déjà retenus (égalités : compte brut équipe
 * desc → compte ligue desc → clé asc) ; rôle sans candidat ⇒ emplacement vide
 * (la prédiction émet alors moins de 5 clés — le hit reste divisé par 5).
 */
export function predictGamePicks(surface: DemandSurface, consumed: Set<string>): string[] {
    // Masses de tête, figées AVANT le greedy (consommés exclus, retenus ignorés).
    const heads: { role: Role; head: number | undefined }[] = ROLES.map((role) => {
        const entries = surface.byRole.get(role) ?? [];
        const best = entries.find((e) => !consumed.has(e.championKey));
        return { role, head: best?.mass };
    });
    const order = [...heads].sort((a, b) => {
        if (a.head === undefined && b.head === undefined) return ROLES.indexOf(a.role) - ROLES.indexOf(b.role);
        if (a.head === undefined) return 1;
        if (b.head === undefined) return -1;
        if (a.head !== b.head) return b.head - a.head;
        return ROLES.indexOf(a.role) - ROLES.indexOf(b.role); // égalité ⇒ ordre canonique ROLES
    });

    const retained = new Set<string>();
    const picks: string[] = [];
    for (const { role } of order) {
        const entries = surface.byRole.get(role) ?? [];
        const chosen = entries.find((e) => !consumed.has(e.championKey) && !retained.has(e.championKey));
        if (chosen === undefined) continue; // rôle vide ⇒ emplacement vide
        retained.add(chosen.championKey);
        picks.push(chosen.championKey);
    }
    return picks;
}

/** Tri B1 : compte brut équipe desc → compte ligue desc → clé asc. */
function comparePresence(
    a: string,
    b: string,
    teamCounts: Map<string, number>,
    leagueCounts: Map<string, number>
): number {
    const teamA = teamCounts.get(a) ?? 0;
    const teamB = teamCounts.get(b) ?? 0;
    if (teamA !== teamB) return teamB - teamA;
    const leagueA = leagueCounts.get(a) ?? 0;
    const leagueB = leagueCounts.get(b) ?? 0;
    if (leagueA !== leagueB) return leagueB - leagueA;
    return a < b ? -1 : 1;
}

/**
 * Baseline B1 : top-5 par compte BRUT de picks de l'équipe (tous rôles,
 * train), consommés exclus ; égalités : compte ligue desc → clé asc. Équipe
 * inconnue du train ⇒ tous comptes nuls ⇒ B1 dégénère au classement ligue
 * (les deux surfaces émettent toujours 5, aucune asymétrie de miss).
 */
export function presenceTop5(surface: DemandSurface, consumed: Set<string>): string[] {
    const candidates = [...new Set([...surface.teamCounts.keys(), ...surface.leagueCounts.keys()])].filter(
        (key) => !consumed.has(key)
    );
    candidates.sort((a, b) => comparePresence(a, b, surface.teamCounts, surface.leagueCounts));
    return candidates.slice(0, 5);
}

/** Baseline B0 : top-5 par compte de picks du train entier, consommés exclus, clé asc en égalité. */
export function leagueTop5(surface: DemandSurface, consumed: Set<string>): string[] {
    const candidates = [...surface.leagueCounts.keys()].filter((key) => !consumed.has(key));
    candidates.sort((a, b) => {
        const countA = surface.leagueCounts.get(a) ?? 0;
        const countB = surface.leagueCounts.get(b) ?? 0;
        if (countA !== countB) return countB - countA;
        return a < b ? -1 : 1;
    });
    return candidates.slice(0, 5);
}

/**
 * Adaptateur I4 (SeriesContext.wantProbability) : masse de c renormalisée
 * sur les candidats non consommés de son rôle, max sur les rôles où c
 * apparaît. v1 délibérément indépendante de gameNumber (la gate la mesure
 * poolée + tranchée par g) ; 0 si c est consommé ou inconnu.
 */
export function wantProbabilityOf(
    surface: DemandSurface,
    championKey: string,
    consumed: Set<string>
): number {
    if (consumed.has(championKey)) return 0;
    let best = 0;
    for (const entries of surface.byRole.values()) {
        const target = entries.find((e) => e.championKey === championKey);
        if (target === undefined) continue;
        let total = 0;
        for (const entry of entries) {
            if (!consumed.has(entry.championKey)) total += entry.mass;
        }
        if (total > 0) best = Math.max(best, target.mass / total);
    }
    return best;
}
