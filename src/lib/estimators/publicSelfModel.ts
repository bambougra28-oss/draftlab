/**
 * Chantier F (F-a) — Modèle public de soi : « surprise vs données publiques »
 * (docs/run2/F-pocket-picks.md §2 F-a, gelé).
 *
 * NOTRE pipeline de tendances retourné sur une équipe X : la surface de
 * demande du chantier C (`fitTeamDemand`, α = 5, λ = 0,9 — défauts commités,
 * AUCUNE constante recodée ici) ajustée sur les games corpus VISIBLES de X
 * est le MODÈLE PUBLIC de X — ce que tout adversaire préparé voit.
 *
 * Sortie V1 (la seule revendiquée) : par équipe et par rôle, les champions à
 * surprise élevée en bits, `bits = −log₂(P_modèlePublic)`, où P est la MASSE
 * RENORMALISÉE PAR RÔLE sur les candidats non consommés — exactement la
 * sémantique de `wantProbabilityOf` (même surface, même renormalisation),
 * vérifiée par test de parité.
 *
 * ÉTIQUETTE OBLIGATOIRE : « surprise vs données publiques » — ceci est une
 * LECTURE du modèle public, JAMAIS une prétention de connaître le pool privé
 * (aucune source interne n'existe : pas de scrims, pas de store de pool).
 * Le « réservoir » = « ce qui serait une surprise », pas « ce que l'équipe
 * sait jouer » (claim interdit).
 *
 * Périmètre déclaré : seuls les champions OBSERVÉS dans le rôle au train
 * (candidats de la surface C) sont quantifiables — un champion jamais vu dans
 * le rôle n'a pas de P public et relève de la novelté structurelle (F-c),
 * pas de ce modèle.
 *
 * Module pur : zéro I/O, zéro horloge (`now` injecté via les options C).
 */
import {
    fitTeamDemand,
    type DemandSurface,
    type SeriesDemandOptions
} from '$lib/estimators/seriesDemand';
import type { DraftRecord } from '$lib/data/types';
import type { Role } from '$lib/types';

/** Étiquette FR obligatoire du panneau (provenance de la lecture). */
export const PUBLIC_SURPRISE_LABEL_FR = 'surprise vs données publiques';

/** Garde IEEE −0 (convention fogReveal) : P = 1 ⇒ bits = 0, jamais −0. */
const noNegZero = (value: number): number => (value === 0 ? 0 : value);

export interface PublicSurpriseEntry {
    championKey: string;
    role: Role;
    /** P_modèlePublic : masse renormalisée par rôle (sémantique wantProbabilityOf). */
    p: number;
    /** bits = −log₂(P) — « surprise vs données publiques ». */
    bits: number;
    /** Masse brute de la surface C (λ-pondérée + α·P_ligue). */
    mass: number;
    /** Compte brut de picks de l'équipe (évidence affichable). */
    teamRawCount: number;
}

export interface PublicSelfModel {
    team: string;
    /** Par rôle : entrées triées bits DESC (puis clé asc) — le réservoir. */
    byRole: Map<Role, PublicSurpriseEntry[]>;
    /** Surface C sous-jacente (réutilisable par l'appelant, p.ex. F-b). */
    surface: DemandSurface;
    /** Lecture du modèle public — jamais un claim de pool privé (DA-V2-11). */
    experimental: true;
}

/**
 * Retourne le modèle public d'une équipe : surface C + bits par (rôle,
 * champion). `consumed` (Fearless) retire les consommés des candidats ET de
 * la masse de renormalisation — même convention que `wantProbabilityOf`.
 */
export function fitPublicSelfModel(
    train: DraftRecord[],
    options: SeriesDemandOptions,
    consumed: Set<string> = new Set<string>()
): PublicSelfModel {
    const surface = fitTeamDemand(train, options);
    const byRole = new Map<Role, PublicSurpriseEntry[]>();

    for (const [role, entries] of surface.byRole) {
        const remaining = entries.filter((entry) => !consumed.has(entry.championKey));
        let total = 0;
        for (const entry of remaining) total += entry.mass;
        if (total <= 0) continue;

        const scored: PublicSurpriseEntry[] = remaining.map((entry) => {
            const p = entry.mass / total;
            return {
                championKey: entry.championKey,
                role,
                p,
                bits: noNegZero(-Math.log2(p)),
                mass: entry.mass,
                teamRawCount: entry.teamRawCount
            };
        });
        // Réservoir : surprise d'abord — bits desc (⇔ p asc), clé asc en égalité.
        scored.sort((a, b) => {
            if (a.bits !== b.bits) return b.bits - a.bits;
            return a.championKey < b.championKey ? -1 : 1;
        });
        byRole.set(role, scored);
    }

    return { team: options.team, byRole, surface, experimental: true };
}
