/**
 * Chantier F (F-b) — Le conseiller offensif de pocket picks
 * (docs/run2/F-pocket-picks.md §2 F-b, gelé).
 *
 * Candidats = surprises élevées (F-a, `publicSelfModel`)
 *           ∩ `counterThreat > 0` vs leur compo/tendances révélées
 *           ∩ `pairPrior` cohérent avec notre noyau (résidu pondéré ≥ 0,
 *             évidence nulle = neutre, jamais éliminatoire)
 *           ∩ viable au patch (SEAM injecté `viableOnPatch`).
 *
 * CHECKLIST D'ACTIVATION : générée DEPUIS les tags réels du schéma M4.1
 * (`$lib/tags/types.ts`) — chaque item porte ses dimensions sources dans le
 * type, JAMAIS inventées. Les trois items dérivables de la spec :
 *   1. candidat sans outil de désengage propre ⇒ exige un peel allié
 *      (disengageTools.peel) OU un knockback (disengageTools.knockback) ;
 *   2. saturation de dégâts : pas ≥ 2 picks alliés du même damageType ;
 *   3. scalingWindow = 'late' ⇒ en Fearless, leur jungle early
 *      (scalingWindow = 'early' au rôle jungle de la lecture courante) déjà
 *      consommée.
 * « Setup mur » et « top autonome » NE SONT PAS des tags : jamais émis.
 *
 * GARDER / DÉPENSER : composants SÉPARÉS (DA-V2-12), chacun badgé
 * Expérimental (DA-V2-11), AUCUNE fusion (la composite n'est validée par
 * aucune métrique — C §1.2) :
 *   - prix de série γ·ΔS : `seriesTermOf` (chantier C) + `wantProbability`
 *     mesurée. CHEMIN C-ROUGE : si `wantProbability` est ABSENTE du contexte,
 *     le prix de série est MASQUÉ et le composant le dit (champ explicite
 *     `masked` + `reasonFr`) ;
 *   - coût de révélation I2 : `revelationCost` (FogEvalContext injecté :
 *     enemyBestResponse / enemyBestResponseUnderUncertainty) ;
 *   - appât I2 : `baitLedger` (BaitContext injecté : takeProbability /
 *     theirEquityIfTaken / ourPreparedAnswerEquity / optionValue —
 *     `defaultOptionValue = 0` commité tant que I4 n'injecte pas).
 *
 * Économie d'apprentissage (adjacence de tags au pool d'Alain) : axe MASQUÉ
 * tant que l'option produit « mon pool » (saisie + store IndexedDB) n'existe
 * pas — aucune demi-implémentation ici.
 *
 * Module pur : zéro I/O, zéro horloge ; toutes les évaluations sont injectées.
 */
import { counterThreat, pairPrior, type TagPairFit } from '$lib/estimators/tagPairs';
import { PUBLIC_SURPRISE_LABEL_FR, type PublicSurpriseEntry } from '$lib/estimators/publicSelfModel';
import {
    baitLedger,
    revelationCost,
    type BaitContext,
    type BaitEntry,
    type FogEvalContext,
    type FogState,
    type RevelationCostReport
} from '$lib/strategic/fogReveal';
import { DEFAULT_RANGE_MODEL_CONFIG } from '$lib/strategic/rangeModelConfig';
import {
    DEFAULT_SERIES_KNAPSACK_CONFIG,
    seriesTermOf,
    type SeriesKnapsackConfig,
    type SeriesTermComponents
} from '$lib/strategic/seriesKnapsack';
import type { SeriesState } from '$lib/strategic/seriesSolver';
import type { ChampionTag, ChampionTagsFile } from '$lib/tags/types';

// ---- checklist d'activation -----------------------------------------------------

/** Dimensions de tag citables — le schéma RÉEL de $lib/tags/types.ts. */
export type TagDimensionRef =
    | 'damageType'
    | 'range'
    | 'engageTool'
    | 'disengageTools.peel'
    | 'disengageTools.knockback'
    | 'mobility'
    | 'scalingWindow'
    | 'hyperCarry';

export interface ActivationItem {
    /** Dimensions sources de l'item (jamais une notion hors-schéma). */
    sources: readonly TagDimensionRef[];
    textFr: string;
    /** true/false si évaluable sur l'état courant ; undefined = à vérifier. */
    satisfied?: boolean;
}

export interface PocketAdvisorContext {
    /** Réservoir F-a (sortie de fitPublicSelfModel, déjà trié bits desc). */
    surprises: PublicSurpriseEntry[];
    /**
     * Seuil « surprise élevée » en bits — défaut : surpriseAlarmBits = 5, la
     * SEULE borne de surprise commitée du système (rangeModelConfig).
     */
    minSurpriseBits?: number;
    tagsFile: ChampionTagsFile;
    /** Notre noyau déjà pické (clés champions). */
    allyCompKeys: string[];
    /** Leur compo révélée / tendances (clés champions). */
    enemyCompKeys: string[];
    /** Cellules counter ORDONNÉES (fitTagCounterCells). */
    counterFit: TagPairFit;
    /** Cellules same-team (fitTagPairCells) pour la cohérence du noyau. */
    pairFit: TagPairFit;
    /** SEAM patch : viabilité au patch courant (jamais deviné ici). */
    viableOnPatch: (championKey: string) => boolean;
    /** Champions consommés (Fearless) — jamais candidats. */
    consumed: Set<string>;
    /**
     * Lecture courante du rôle jungle ADVERSE (clés champions) pour l'item
     * Fearless de la checklist ; absente ⇒ item « à vérifier ».
     */
    enemyJungleCandidates?: string[];
    // ---- GARDER/DÉPENSER : composant prix de série (C) ----
    seriesState?: SeriesState;
    knapsackConfig?: SeriesKnapsackConfig;
    /** wantProbability MESURÉE (C) — ABSENTE ⇒ chemin C-ROUGE, prix masqué. */
    wantProbability?: (championKey: string) => number;
    // ---- GARDER/DÉPENSER : composants I2 (injections NOMMÉES fogReveal) ----
    /** Évaluateur de meilleure réponse adverse (FogEvalContext réel). */
    fogEval?: FogEvalContext;
    /** État d'information avant/après par candidat (FogState réel). */
    fogStateOf?: (championKey: string) => FogState;
    /** BaitContext réel — defaultOptionValue = 0 commité tant que I4 n'injecte pas. */
    baitContext?: BaitContext;
}

export type SeriesPriceComponent =
    | {
          /** CHEMIN C-ROUGE (ou σ absent) : le composant LE DIT, champ explicite. */
          masked: true;
          reasonFr: string;
          experimental: true;
      }
    | {
          masked: false;
          /** γ·ΔS décomposé (seriesTermOf — DA-V2-12, additivité exacte). */
          term: SeriesTermComponents;
          /** wantProbability mesurée du candidat (C). */
          wantProbability: number;
          experimental: true;
      };

export interface HoldOrSpendComponents {
    /** Composant 1 — prix de série γ·ΔS (C), masquable. */
    seriesPrice: SeriesPriceComponent;
    /** Composant 2 — coût de révélation I2 (absent si injections absentes). */
    revelation?: RevelationCostReport;
    /** Composant 3 — appât I2 (absent si BaitContext absent). */
    bait?: BaitEntry;
}

export interface PocketCandidate {
    championKey: string;
    role: PublicSurpriseEntry['role'];
    /** Surprise vs données publiques (étiquette PUBLIC_SURPRISE_LABEL_FR). */
    bits: number;
    p: number;
    /** counterThreat > 0 (filtre) — résidu pondéré + évidence affichables. */
    counter: { threat: number; evidence: number };
    /** Cohérence pairPrior vs noyau (résidu pondéré par évidence). */
    coherence: { residual: number; evidence: number };
    checklist: ActivationItem[];
    holdOrSpend: HoldOrSpendComponents;
    experimental: true;
}

const MASKED_NO_WANT_FR =
    'Prix de série masqué — wantProbability indisponible (G3-demande non verte, chemin C-ROUGE) : ' +
    'seuls les composants de révélation I2 sont affichés.';
const MASKED_NO_STATE_FR = 'Prix de série masqué — aucun état de série σ fourni au contexte.';

/** Cohérence du noyau : moyenne des résidus pairPrior pondérée par évidence. */
function coherenceWithCore(
    candidate: ChampionTag,
    allyKeys: string[],
    fit: TagPairFit,
    tagsFile: ChampionTagsFile
): { residual: number; evidence: number } {
    let weighted = 0;
    let evidence = 0;
    for (const allyKey of allyKeys) {
        const allyTag = tagsFile.champions[allyKey];
        if (allyTag === undefined) continue;
        const prior = pairPrior(candidate, allyTag, fit);
        weighted += prior.residual * prior.evidence;
        evidence += prior.evidence;
    }
    return { residual: evidence === 0 ? 0 : weighted / evidence, evidence };
}

const DAMAGE_FR: Record<ChampionTag['damageType'], string> = { AD: 'AD', AP: 'AP' };

/** Checklist d'activation — items dérivés des tags présents, sources citées. */
export function activationChecklist(
    candidate: ChampionTag,
    allyKeys: string[],
    tagsFile: ChampionTagsFile,
    consumed: Set<string>,
    enemyJungleCandidates?: string[]
): ActivationItem[] {
    const items: ActivationItem[] = [];
    const allyTags = allyKeys
        .map((key) => tagsFile.champions[key])
        .filter((tag): tag is ChampionTag => tag !== undefined);

    // 1. Pas d'outil de désengage propre ⇒ exige peel OU knockback allié.
    if (candidate.disengageTools.length === 0) {
        const satisfied = allyTags.some(
            (tag) => tag.disengageTools.includes('peel') || tag.disengageTools.includes('knockback')
        );
        items.push({
            sources: ['disengageTools.peel', 'disengageTools.knockback'],
            textFr:
                'Exige : un peel allié (disengageTools.peel) OU un knockback (disengageTools.knockback) — ' +
                'le candidat n’a pas d’outil de désengage propre.',
            satisfied
        });
    }

    // 2. Saturation de dégâts (toujours émis : damageType est toujours posé).
    const sameType = allyTags.filter(
        (tag) => tag.damageType === candidate.damageType || tag.secondaryDamageType === candidate.damageType
    ).length;
    items.push({
        sources: ['damageType'],
        textFr: `Pas de saturation ${DAMAGE_FR[candidate.damageType]} : éviter ≥ 2 picks ${DAMAGE_FR[candidate.damageType]} déjà posés chez nous (damageType).`,
        satisfied: sameType < 2
    });

    // 3. Fenêtre Fearless pour un scaling tardif.
    if (candidate.scalingWindow === 'late') {
        const item: ActivationItem = {
            sources: ['scalingWindow'],
            textFr:
                'En Fearless : leur jungle early (scalingWindow = early au rôle jungle de la lecture courante) ' +
                'déjà consommée avant de le sortir.'
        };
        if (enemyJungleCandidates !== undefined) {
            item.satisfied = enemyJungleCandidates.every((key) => {
                const tag = tagsFile.champions[key];
                return tag === undefined || tag.scalingWindow !== 'early' || consumed.has(key);
            });
        }
        items.push(item);
    }

    return items;
}

/** Composants GARDER/DÉPENSER d'un candidat — jamais fusionnés (DA-V2-12). */
function holdOrSpendOf(championKey: string, ctx: PocketAdvisorContext): HoldOrSpendComponents {
    let seriesPrice: SeriesPriceComponent;
    if (ctx.wantProbability === undefined) {
        seriesPrice = { masked: true, reasonFr: MASKED_NO_WANT_FR, experimental: true };
    } else if (ctx.seriesState === undefined) {
        seriesPrice = { masked: true, reasonFr: MASKED_NO_STATE_FR, experimental: true };
    } else {
        seriesPrice = {
            masked: false,
            term: seriesTermOf(championKey, ctx.seriesState, ctx.knapsackConfig ?? DEFAULT_SERIES_KNAPSACK_CONFIG),
            wantProbability: ctx.wantProbability(championKey),
            experimental: true
        };
    }

    const components: HoldOrSpendComponents = { seriesPrice };
    if (ctx.fogEval !== undefined && ctx.fogStateOf !== undefined) {
        const state = ctx.fogStateOf(championKey);
        components.revelation = revelationCost(championKey, state.before, state.after, ctx.fogEval);
    }
    if (ctx.baitContext !== undefined) {
        components.bait = baitLedger([championKey], ctx.baitContext)[0];
    }
    return components;
}

/**
 * Le conseiller : filtre le réservoir F-a par les quatre conditions gelées et
 * attache checklist + composants GARDER/DÉPENSER. Tri : bits desc (l'ordre du
 * réservoir), clé asc en égalité. Étiquette de provenance :
 * PUBLIC_SURPRISE_LABEL_FR (« surprise vs données publiques »).
 */
export function advisePocketPicks(ctx: PocketAdvisorContext): PocketCandidate[] {
    const minBits = ctx.minSurpriseBits ?? DEFAULT_RANGE_MODEL_CONFIG.surpriseAlarmBits;
    const enemyTags = ctx.enemyCompKeys
        .map((key) => ctx.tagsFile.champions[key])
        .filter((tag): tag is ChampionTag => tag !== undefined);

    const out: PocketCandidate[] = [];
    for (const entry of ctx.surprises) {
        if (entry.bits < minBits) continue;
        if (ctx.consumed.has(entry.championKey)) continue;
        if (!ctx.viableOnPatch(entry.championKey)) continue;
        const tag = ctx.tagsFile.champions[entry.championKey];
        if (tag === undefined) continue; // sans tag, ni counter ni checklist : hors périmètre

        const counter = counterThreat(tag, enemyTags, ctx.counterFit);
        if (!(counter.threat > 0)) continue; // filtre gelé : strictement > 0

        const coherence = coherenceWithCore(tag, ctx.allyCompKeys, ctx.pairFit, ctx.tagsFile);
        if (coherence.evidence > 0 && coherence.residual < 0) continue; // incohérent mesuré

        out.push({
            championKey: entry.championKey,
            role: entry.role,
            bits: entry.bits,
            p: entry.p,
            counter: { threat: counter.threat, evidence: counter.evidence },
            coherence,
            checklist: activationChecklist(
                tag,
                ctx.allyCompKeys,
                ctx.tagsFile,
                ctx.consumed,
                ctx.enemyJungleCandidates
            ),
            holdOrSpend: holdOrSpendOf(entry.championKey, ctx),
            experimental: true
        });
    }

    out.sort((a, b) => {
        if (a.bits !== b.bits) return b.bits - a.bits;
        return a.championKey < b.championKey ? -1 : 1;
    });
    return out;
}

export { PUBLIC_SURPRISE_LABEL_FR };
