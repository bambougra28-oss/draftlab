/**
 * I1/§6.10 — Ban EV: best-response-to-a-field (ARCHITECTURE_V2 §6 point 10).
 *
 * The value of a ban is the expected damage against the enemy's tendency
 * DISTRIBUTION, not against a single guessed pick:
 *
 *   ev(c) = takeProbability(c) · (damage(c) + structuralPp·structural(c))
 *
 *   takeProbability = Σ over the upcoming enemy slot groups of P(they take c
 *                     there), P read from the injected I1 ranges;
 *   damage          = equity drop (pp) from c to their replacement —
 *                     injected curve, or the config default;
 *   structural      = share of their prepared-pair weight (mineCombinations
 *                     assets) destroyed if c disappears, normalized by the
 *                     total asset weight (1 ⇔ c touches every prepared look).
 *
 * TWO REGIMES (draft-science 2026-06 §E: phase-1 bans hit the opponent's
 * top-10 repertoire 25.9 %, phase-2 only 16.5 % — phase 2 counters the
 * REVEALED composition, not the player):
 *   'repertoire'  (default) — the formula above: deny what they want to take;
 *   'composition' — ev(c) = (floor + (1−floor)·min(1, takeProbability)) ·
 *                   threatPp(c), threat injected (counterThreat of the
 *                   tagPairs estimator, or a matchup table): remove the
 *                   champions whose PROFILE historically beats OUR revealed
 *                   comp; take-probability only gates plausibility.
 *
 * DA-V2-12: every component is reported separately; `ev` is only the
 * sort key, never a hidden mega-score. Fearless: a champion already consumed
 * cannot be re-picked, so banning it buys nothing — ev = 0, zeroed
 * components and a dedicated FR rationale (same doctrine as M6.1's forced
 * `skip` tier; banPrioritySuggester is reused in spirit, not modified).
 * Tunables live in the exported injectable config (DA-V2-6).
 */
import { structuralDamage, type CombinationAsset } from '$lib/aggregates/combinations';
import type { SlotGroup } from '$lib/aggregates/tendency';
import type { RangeEntry } from '$lib/strategic/rangeModel';

export interface BanEvConfig {
    /**
     * Default equity drop (percentage points) from a champion to the enemy's
     * replacement when no per-champion curve is injected. Behaviour default
     * — the R4 harness calibrates it (pool-depth curves are the I4 upgrade).
     */
    defaultReplacementDropPp: number;
    /** pp value of a FULL structural hit (structural = 1). */
    structuralPp: number;
}

export const DEFAULT_BAN_EV_CONFIG: BanEvConfig = {
    defaultReplacementDropPp: 1.5,
    structuralPp: 1
};

/** Plausibility floor of the composition regime (a zero-tendency champion
 *  can still be the situational counter the enemy reaches for). */
export const COMPOSITION_TAKE_FLOOR = 0.3;

export type BanEvRegime = 'repertoire' | 'composition';

export interface BanEvContext {
    /** Enemy slot groups still to come, in draft order. */
    upcomingSlotGroups: SlotGroup[];
    /** Injected I1 range provider for each upcoming slot group. */
    rangeFor: (slotGroup: SlotGroup) => RangeEntry[];
    /** Enemy prepared-pair assets (mineCombinations) for structural damage. */
    structuralAssets?: CombinationAsset[];
    /** Champions already consumed this Fearless series (either team). */
    fearlessConsumed?: Set<string>;
    /** Per-champion equity drop (pp) to their replacement; default from config. */
    replacementDrop?: (championKey: string) => number;
    /** Ban phase nature — see the module header. Default: 'repertoire'. */
    regime?: BanEvRegime;
    /**
     * Composition regime only: threat (pp) of the candidate against OUR
     * revealed comp (e.g. counterThreat × 100 from $lib/estimators/tagPairs).
     */
    threatPp?: (championKey: string) => number;
    config?: BanEvConfig;
}

/** The separated value components (DA-V2-12). */
export interface BanEvComponents {
    /** Σ P(they take it) over the upcoming slots — expected exits, may exceed 1. */
    takeProbability: number;
    /** pp drop to their replacement if they would have taken it. */
    damage: number;
    /** Normalized structural damage in [0, 1] (share of asset weight touched). */
    structural: number;
    /** Composition regime: candidate's threat (pp) vs our revealed comp. */
    threat: number;
}

export interface BanEvEntry {
    championKey: string;
    /** takeProbability · (damage + structuralPp·structural); 0 if consumed. */
    ev: number;
    components: BanEvComponents;
    rationaleFr: string[];
}

/**
 * Expected value of banning each candidate, sorted ev desc (ties:
 * takeProbability desc, then champion key asc). Duplicated candidates are
 * evaluated once. The range provider is called once per upcoming slot group.
 */
export function banEV(candidates: string[], ctx: BanEvContext): BanEvEntry[] {
    const config = ctx.config ?? DEFAULT_BAN_EV_CONFIG;

    // One probability lookup per slot group (provider invoked exactly once each).
    const slotProbs = ctx.upcomingSlotGroups.map((slotGroup) => {
        const probs = new Map<string, number>();
        for (const entry of ctx.rangeFor(slotGroup)) probs.set(entry.championKey, entry.p);
        return probs;
    });

    const assets = ctx.structuralAssets ?? [];
    let totalAssetWeight = 0;
    for (const asset of assets) totalAssetWeight += asset.games;

    const entries: BanEvEntry[] = [];
    const seen = new Set<string>();
    for (const championKey of candidates) {
        if (seen.has(championKey)) continue;
        seen.add(championKey);

        if (ctx.fearlessConsumed?.has(championKey)) {
            // A consumed champion cannot come back: the ban buys nothing and
            // showing would-be values for an impossible pick would mislead.
            entries.push({
                championKey,
                ev: 0,
                components: { takeProbability: 0, damage: 0, structural: 0, threat: 0 },
                rationaleFr: ['Déjà consommé en Fearless — un ban serait gaspillé']
            });
            continue;
        }

        let takeProbability = 0;
        for (const probs of slotProbs) takeProbability += probs.get(championKey) ?? 0;

        const rationaleFr: string[] = [];
        let ev: number;
        let damage = 0;
        let structural = 0;
        let threat = 0;

        if (ctx.regime === 'composition') {
            // Phase-2 nature (draft science §E): remove what BEATS our
            // revealed comp; tendency only gates plausibility.
            threat = ctx.threatPp?.(championKey) ?? 0;
            const plausibility = COMPOSITION_TAKE_FLOOR + (1 - COMPOSITION_TAKE_FLOOR) * Math.min(1, takeProbability);
            ev = plausibility * Math.max(0, threat);
            if (threat > 0) {
                rationaleFr.push(`Profil qui contre votre compo : +${threat.toFixed(1)} pp historiques`);
            } else {
                rationaleFr.push('Aucune menace mesurée contre votre compo révélée');
            }
            if (takeProbability > 0) {
                rationaleFr.push(`Plausible chez eux (${Math.round(takeProbability * 100)} % de tendance cumulée)`);
            }
        } else {
            damage = ctx.replacementDrop?.(championKey) ?? config.defaultReplacementDropPp;
            const report = structuralDamage(assets, championKey);
            structural = totalAssetWeight > 0 ? report.weight / totalAssetWeight : 0;
            ev = takeProbability * (damage + config.structuralPp * structural);

            if (takeProbability > 0) {
                rationaleFr.push(
                    `Sortie attendue : ${Math.round(takeProbability * 100)} % cumulés sur les slots à venir`
                );
                rationaleFr.push(`Si pris : −${damage.toFixed(1)} pp vers leur remplaçant`);
            } else {
                rationaleFr.push('Aucune sortie attendue sur les slots à venir');
            }
            if (structural > 0) {
                rationaleFr.push(
                    `Détruit ${report.assets.length} combinaison(s) préparée(s) (poids ${report.weight} games)`
                );
            }
        }

        entries.push({ championKey, ev, components: { takeProbability, damage, structural, threat }, rationaleFr });
    }

    return entries.sort((a, b) => {
        if (a.ev !== b.ev) return b.ev - a.ev;
        if (a.components.takeProbability !== b.components.takeProbability) {
            return b.components.takeProbability - a.components.takeProbability;
        }
        return a.championKey < b.championKey ? -1 : 1;
    });
}
