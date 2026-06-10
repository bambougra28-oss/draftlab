/**
 * Tag-pair synergy priors (doctrine §6.3 — the small-data substitute for
 * embeddings, designed in ARCHITECTURE_V2 and finally built here).
 *
 * Every champion is projected onto a small set of binary TRAITS derived from
 * its hand tags; a same-team champion pair activates the trait-pair CELLS of
 * its two members (unordered, e.g. 'engage-hard+hyper-carry'). Cells are
 * fitted on real records — wins/games pooled over every same-team pair whose
 * traits match — and shrunk toward the corpus mean (EB), so a cell only
 * speaks when thousands of pooled games back it. The fitted table then gives
 * any champion pair — including pairs never seen together — a structured
 * prior: the mean residual of its active cells, weighted by their evidence.
 *
 * This is deliberately interpretable: a cell IS an explanation ("engage AoE
 * + hyper-carry: +1.8 pp over 1 400 games"), which is what the coach needs
 * to teach, and what raw embeddings can never say.
 */
import { shrinkWinrate, type BetaPosterior } from './posterior';
import type { DraftRecord, DraftSide } from '$lib/data/types';
import type { ChampionTag, ChampionTagsFile } from '$lib/tags/types';
import { loadDefaultTags } from '$lib/tags';

/** Binary traits a champion can carry (projection of the M4.1 tags). */
export const PAIR_TRAITS = [
    'engage-hard',
    'engage-soft',
    'peel',
    'knockback',
    'ranged-long',
    'melee',
    'ap',
    'ad',
    'early',
    'late',
    'hyper-carry',
    'mobile'
] as const;
export type PairTrait = (typeof PAIR_TRAITS)[number];

/** Project a champion tag onto its active traits. */
export function traitsOf(tag: ChampionTag): PairTrait[] {
    const traits: PairTrait[] = [];
    if (tag.engageTool === 'hard-aoe') traits.push('engage-hard');
    if (tag.engageTool === 'soft-single') traits.push('engage-soft');
    if (tag.disengageTools.includes('peel')) traits.push('peel');
    if (tag.disengageTools.includes('knockback')) traits.push('knockback');
    if (tag.range === 'ranged-long') traits.push('ranged-long');
    if (tag.range === 'melee') traits.push('melee');
    if (tag.damageType === 'AP' || tag.secondaryDamageType === 'AP') traits.push('ap');
    if (tag.damageType === 'AD' || tag.secondaryDamageType === 'AD') traits.push('ad');
    if (tag.scalingWindow === 'early') traits.push('early');
    if (tag.scalingWindow === 'late') traits.push('late');
    if (tag.hyperCarry) traits.push('hyper-carry');
    if (tag.mobility === 'high') traits.push('mobile');
    return traits;
}

/** Canonical unordered cell key for two traits ('a+b', sorted). */
export function cellKey(a: PairTrait, b: PairTrait): string {
    return a <= b ? `${a}+${b}` : `${b}+${a}`;
}

export interface TagPairCell {
    key: string;
    games: number;
    wins: number;
    /** Shrunk winrate (EB toward the corpus-wide pair mean). */
    posterior: BetaPosterior;
    /** posterior.mean − corpus mean: the cell's synergy residual. */
    residual: number;
}

export interface TagPairFit {
    cells: Map<string, TagPairCell>;
    /** Corpus-wide same-team pair winrate (the shrink target). */
    baseline: number;
    /** Total pair observations pooled. */
    pairObservations: number;
    /** EB prior strength used for every cell. */
    priorN: number;
}

export interface FitTagPairOptions {
    tagsFile?: ChampionTagsFile;
    /** EB pseudo-games per cell (doctrine: structure speaks, noise doesn't). */
    priorN?: number;
}

/**
 * Fit the trait-pair cells from records: every same-team champion pair of
 * every decided game contributes one observation (win = that side won) to
 * every cell its two members' trait sets activate (cross product, unordered,
 * self-cells included when both carry the trait).
 */
export function fitTagPairCells(records: DraftRecord[], options: FitTagPairOptions = {}): TagPairFit {
    const tagsFile = options.tagsFile ?? loadDefaultTags();
    const priorN = options.priorN ?? 400;

    const tally = new Map<string, { games: number; wins: number }>();
    let pairObservations = 0;
    let totalWins = 0;

    for (const record of records) {
        if (record.winner === undefined) continue;
        for (const side of ['blue', 'red'] as const satisfies readonly DraftSide[]) {
            const picks = record.actions.filter(
                (a) => a.type === 'pick' && a.side === side && a.championKey !== ''
            );
            const won = record.winner === side;
            for (let i = 0; i < picks.length; i++) {
                for (let j = i + 1; j < picks.length; j++) {
                    const tagA = tagsFile.champions[picks[i].championKey];
                    const tagB = tagsFile.champions[picks[j].championKey];
                    if (tagA === undefined || tagB === undefined) continue;
                    pairObservations++;
                    if (won) totalWins++;
                    const traitsA = traitsOf(tagA);
                    const traitsB = traitsOf(tagB);
                    const seen = new Set<string>();
                    for (const a of traitsA) {
                        for (const b of traitsB) {
                            const key = cellKey(a, b);
                            if (seen.has(key)) continue; // one observation per cell per pair
                            seen.add(key);
                            const cell = tally.get(key) ?? { games: 0, wins: 0 };
                            cell.games++;
                            if (won) cell.wins++;
                            tally.set(key, cell);
                        }
                    }
                }
            }
        }
    }

    const baseline = pairObservations === 0 ? 0.5 : totalWins / pairObservations;
    const cells = new Map<string, TagPairCell>();
    for (const [key, { games, wins }] of tally) {
        const posterior = shrinkWinrate(wins, games, baseline, priorN);
        cells.set(key, { key, games, wins, posterior, residual: posterior.mean - baseline });
    }
    return { cells, baseline, pairObservations, priorN };
}

export interface PairPrior {
    /** Evidence-weighted mean residual of the pair's active cells. */
    residual: number;
    /** Cells that actually fired, residual-sorted — the explanation. */
    cells: TagPairCell[];
    /** Total pooled games behind the active cells (evidence badge). */
    evidence: number;
}

/**
 * Structured prior for ANY champion pair (seen together or not): the active
 * trait-pair cells of the two champions, combined by evidence weight.
 */
export function pairPrior(tagA: ChampionTag, tagB: ChampionTag, fit: TagPairFit): PairPrior {
    const active: TagPairCell[] = [];
    const seen = new Set<string>();
    for (const a of traitsOf(tagA)) {
        for (const b of traitsOf(tagB)) {
            const key = cellKey(a, b);
            if (seen.has(key)) continue;
            seen.add(key);
            const cell = fit.cells.get(key);
            if (cell !== undefined) active.push(cell);
        }
    }
    if (active.length === 0) return { residual: 0, cells: [], evidence: 0 };

    let weight = 0;
    let weighted = 0;
    let evidence = 0;
    for (const cell of active) {
        weight += cell.games;
        weighted += cell.residual * cell.games;
        evidence += cell.games;
    }
    return {
        residual: weight === 0 ? 0 : weighted / weight,
        cells: [...active].sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual)),
        evidence
    };
}
