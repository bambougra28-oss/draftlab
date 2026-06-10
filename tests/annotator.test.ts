import { describe, it, expect } from 'vitest';
import {
    annotateDraft,
    leakReport,
    type ActionAnnotation,
    type AnnotationGrade,
    type AnnotationNoteTag,
    type BetterAlternative,
    type DraftAnnotation
} from '$lib/review/annotator';
import { DEFAULT_ANNOTATOR_CONFIG, type AnnotatorConfig } from '$lib/review/annotatorConfig';
import type { DraftAction, DraftPhase, DraftRecord, DraftSide } from '$lib/data/types';
import type { DraftState, NavigatorSlot } from '$lib/strategic/draftNavigator';

// ---- factories ------------------------------------------------------------------

function phaseOf(seq: number): DraftPhase {
    if (seq <= 6) return 'ban1';
    if (seq <= 12) return 'pick1';
    if (seq <= 16) return 'ban2';
    return 'pick2';
}

function pick(seq: number, side: DraftSide, championKey: string, championName = championKey): DraftAction {
    return { seq, type: 'pick', phase: phaseOf(seq), side, championKey, championName };
}

function ban(seq: number, side: DraftSide, championKey: string, championName = championKey): DraftAction {
    return { seq, type: 'ban', phase: phaseOf(seq), side, championKey, championName };
}

function record(gameId: string, actions: DraftAction[]): DraftRecord {
    return {
        gameId,
        blueTeam: 'T1',
        redTeam: 'XEN',
        firstPickSide: 'blue',
        orderConfidence: 'exact',
        actions,
        warnings: [],
        provenance: { source: 'test', fetchedAt: '2026-06-10T00:00:00Z' }
    };
}

/**
 * Table-stub oracles: `bestAlternative` answers from a queue (annotation
 * order), `valueOf` from a per-seq table. Both capture their inputs so the
 * state bookkeeping can be asserted.
 */
function tableOracles(bestQueue: BetterAlternative[], chosenBySeq: Record<number, number>) {
    const valueStates: DraftState[] = [];
    const valueActions: DraftAction[] = [];
    const bestSides: DraftSide[] = [];
    let bestIndex = 0;
    return {
        valueStates,
        valueActions,
        bestSides,
        valueOf: (state: DraftState, candidate: DraftAction): number => {
            valueStates.push(state);
            valueActions.push(candidate);
            const value = chosenBySeq[candidate.seq];
            if (value === undefined) throw new Error(`no stubbed value for seq ${candidate.seq}`);
            return value;
        },
        bestAlternative: (_state: DraftState, side: DraftSide): BetterAlternative => {
            bestSides.push(side);
            const best = bestQueue[bestIndex];
            bestIndex += 1;
            if (best === undefined) throw new Error('bestAlternative queue exhausted');
            return best;
        }
    };
}

/**
 * Scenario A — blue reviewed, 4 decisions engineered one per grade band
 * (thresholds 1/2/3 pp, suppression < 1 pp):
 *   seq 1  : best .520, chosen .511 → loss 0.9 pp → ''  (suppressed)
 *   seq 7  : best .500, chosen .485 → loss 1.5 pp → '?!'
 *   seq 10 : best .600, chosen .575 → loss 2.5 pp → '?'
 *   seq 18 : best .470, chosen .435 → loss 3.5 pp → '??'
 * total loss = 0.9 + 1.5 + 2.5 + 3.5 = 8.4 pp ; worst = seq 18.
 */
const scenarioA = () => ({
    rec: record('g1', [
        ban(1, 'blue', 'b1'),
        ban(2, 'red', 'e1'),
        pick(7, 'blue', 'a1'),
        pick(8, 'red', 'o1'),
        pick(9, 'red', 'o2'),
        pick(10, 'blue', 'a2'),
        pick(17, 'red', 'o3'),
        pick(18, 'blue', 'a3')
    ]),
    bestQueue: [
        { championKey: 'bX', value: 0.52 },
        { championKey: 'aBest', value: 0.5 },
        { championKey: 'aBest2', value: 0.6 },
        { championKey: 'aBest3', value: 0.47 }
    ],
    chosen: { 1: 0.511, 7: 0.485, 10: 0.575, 18: 0.435 }
});

describe('annotateDraft — grading in win-probability space', () => {
    const { rec, bestQueue, chosen } = scenarioA();
    const oracles = tableOracles(bestQueue, chosen);
    const result = annotateDraft(rec, { side: 'blue', valueOf: oracles.valueOf, bestAlternative: oracles.bestAlternative });

    it('annotates only the reviewed side, in seq order', () => {
        expect(result.gameId).toBe('g1');
        expect(result.actions.map((a) => a.seq)).toEqual([1, 7, 10, 18]);
        expect(result.actions.map((a) => a.actionType)).toEqual(['ban', 'pick', 'pick', 'pick']);
        expect(result.actions.map((a) => a.phase)).toEqual(['ban1', 'pick1', 'pick1', 'pick2']);
        expect(result.actions.every((a) => a.side === 'blue')).toBe(true);
    });

    it('computes exact evBefore/evAfter/evLoss in pp from the stub table', () => {
        const a1 = result.actions[0];
        // 0.520·100 − 0.511·100 = 52.0 − 51.1 = 0.9 pp.
        expect(a1.evBeforePp).toBeCloseTo(52, 9);
        expect(a1.evAfterPp).toBeCloseTo(51.1, 9);
        expect(a1.evLossPp).toBeCloseTo(0.9, 9);
        // seq 7: 50 − 48.5 = 1.5 pp; seq 10: 60 − 57.5 = 2.5; seq 18: 47 − 43.5 = 3.5.
        expect(result.actions[1].evLossPp).toBeCloseTo(1.5, 9);
        expect(result.actions[2].evLossPp).toBeCloseTo(2.5, 9);
        expect(result.actions[3].evLossPp).toBeCloseTo(3.5, 9);
    });

    it('grades with the wide Lichess-style bands: 0.9→``, 1.5→?!, 2.5→?, 3.5→??', () => {
        expect(result.actions.map((a) => a.grade)).toEqual(['', '?!', '?', '??'] as AnnotationGrade[]);
    });

    it('suppresses the near-equal choice (gap < 1 pp) and only that one', () => {
        expect(result.actions.map((a) => a.suppressed)).toEqual([true, false, false, false]);
    });

    it('names "better was X" with the recoverable gain, never on suppressed entries', () => {
        expect(result.actions[0].betterWas).toBeUndefined(); // suppressed despite a different best key
        expect(result.actions[1].betterWas?.championKey).toBe('aBest');
        expect(result.actions[1].betterWas?.gainPp).toBeCloseTo(1.5, 9);
        expect(result.actions[3].betterWas?.championKey).toBe('aBest3');
    });

    it('sums the team loss and points at the costliest seq', () => {
        // 0.9 + 1.5 + 2.5 + 3.5 = 8.4 pp, worst is the 3.5 pp blunder at seq 18.
        expect(result.teamSummary.side).toBe('blue');
        expect(result.teamSummary.totalLossPp).toBeCloseTo(8.4, 9);
        expect(result.teamSummary.worstSeq).toBe(18);
    });

    it('emits no note when no note context is injected', () => {
        expect(result.actions.every((a) => a.notesFr.length === 0 && a.noteTags.length === 0)).toBe(true);
    });

    it('walks states truthfully: prior actions of BOTH sides, pool decremented', () => {
        // Prior action counts before seq 1/7/10/18: 0 / 2 / 5 / 7.
        expect(oracles.valueStates.map((s) => s.actions.length)).toEqual([0, 2, 5, 7]);
        // Default universe = the 8 record keys; b1+e1 are gone before seq 7.
        expect(oracles.valueStates[0].available.size).toBe(8);
        expect(oracles.valueStates[1].available.size).toBe(6);
        expect(oracles.valueStates[1].available.has('b1')).toBe(false);
        expect(oracles.valueStates[1].available.has('e1')).toBe(false);
        expect(oracles.valueStates[0].firstPickSide).toBe('blue');
        expect(oracles.bestSides.every((side) => side === 'blue')).toBe(true);
    });
});

describe('annotateDraft — config dials', () => {
    it('a wider suppression gap silences an otherwise-graded inaccuracy', () => {
        const { rec, bestQueue, chosen } = scenarioA();
        const oracles = tableOracles(bestQueue, chosen);
        const config: AnnotatorConfig = { ...DEFAULT_ANNOTATOR_CONFIG, suppressionGapPp: 2 };
        const result = annotateDraft(rec, {
            side: 'blue',
            valueOf: oracles.valueOf,
            bestAlternative: oracles.bestAlternative,
            config
        });
        // seq 7 (1.5 pp < 2): suppressed, no grade, no betterWas; seq 10 (2.5 pp ≥ 2) untouched.
        expect(result.actions[1].suppressed).toBe(true);
        expect(result.actions[1].grade).toBe('');
        expect(result.actions[1].betterWas).toBeUndefined();
        expect(result.actions[2].grade).toBe('?');
        expect(result.actions[2].betterWas?.championKey).toBe('aBest2');
    });

    it('betterWas needs its own confidence threshold', () => {
        const { rec, bestQueue, chosen } = scenarioA();
        const oracles = tableOracles(bestQueue, chosen);
        const config: AnnotatorConfig = { ...DEFAULT_ANNOTATOR_CONFIG, betterWasMinGainPp: 2 };
        const result = annotateDraft(rec, {
            side: 'blue',
            valueOf: oracles.valueOf,
            bestAlternative: oracles.bestAlternative,
            config
        });
        expect(result.actions[1].grade).toBe('?!'); // still graded…
        expect(result.actions[1].betterWas).toBeUndefined(); // …but 1.5 < 2 pp: no name-dropping
        expect(result.actions[2].betterWas?.gainPp).toBeCloseTo(2.5, 9);
    });

    it('suppression and grading are independent dials (graded `` yet not suppressed)', () => {
        const rec = record('g1b', [pick(7, 'blue', 'a1')]);
        // loss = 75.5 − 75.0 = 0.5 pp: ≥ 0.25 (not suppressed) but < 1 (no grade).
        const oracles = tableOracles([{ championKey: 'aBest', value: 0.755 }], { 7: 0.75 });
        const config: AnnotatorConfig = { ...DEFAULT_ANNOTATOR_CONFIG, suppressionGapPp: 0.25 };
        const result = annotateDraft(rec, {
            side: 'blue',
            valueOf: oracles.valueOf,
            bestAlternative: oracles.bestAlternative,
            config
        });
        expect(result.actions[0].suppressed).toBe(false);
        expect(result.actions[0].grade).toBe('');
        expect(result.actions[0].evLossPp).toBeCloseTo(0.5, 9);
        expect(result.actions[0].betterWas).toBeUndefined(); // 0.5 < betterWasMinGainPp 1
    });
});

describe('annotateDraft — oracle edge cases', () => {
    it('clamps the loss at 0 when the played move beats the oracle best (no praise marks)', () => {
        const rec = record('g1c', [pick(7, 'blue', 'a1')]);
        const oracles = tableOracles([{ championKey: 'bX', value: 0.5 }], { 7: 0.52 });
        const result = annotateDraft(rec, { side: 'blue', valueOf: oracles.valueOf, bestAlternative: oracles.bestAlternative });
        const a = result.actions[0];
        expect(a.evBeforePp).toBeCloseTo(50, 9);
        expect(a.evAfterPp).toBeCloseTo(52, 9);
        expect(a.evLossPp).toBe(0);
        expect(a.grade).toBe('');
        expect(a.suppressed).toBe(true);
        expect(result.teamSummary.worstSeq).toBeNull(); // nothing was lost
    });

    it('never says "better was X" when X is the champion actually played', () => {
        const rec = record('g1d', [pick(7, 'blue', 'a1')]);
        // Same key, diverging values (noisy oracle): graded but no betterWas.
        const oracles = tableOracles([{ championKey: 'a1', value: 0.52 }], { 7: 0.5 });
        const result = annotateDraft(rec, { side: 'blue', valueOf: oracles.valueOf, bestAlternative: oracles.bestAlternative });
        expect(result.actions[0].grade).toBe('?');
        expect(result.actions[0].betterWas).toBeUndefined();
    });

    it('skips unresolved actions ("" key) but still advances the replay state', () => {
        const rec = record('g1e', [pick(7, 'blue', ''), pick(8, 'red', 'o1'), pick(10, 'blue', 'a2')]);
        const oracles = tableOracles([{ championKey: 'bX', value: 0.5 }], { 10: 0.5 });
        const result = annotateDraft(rec, { side: 'blue', valueOf: oracles.valueOf, bestAlternative: oracles.bestAlternative });
        expect(result.actions.map((a) => a.seq)).toEqual([10]);
        // The sentinel and the enemy pick both advanced the state.
        expect(oracles.valueStates[0].actions.length).toBe(2);
        // Default universe ignores '' keys: {o1, a2}, o1 consumed before seq 10.
        expect(oracles.valueStates[0].available.size).toBe(1);
    });

    it('honours an injected availableAtStart pool', () => {
        const { rec, bestQueue, chosen } = scenarioA();
        const oracles = tableOracles(bestQueue, chosen);
        annotateDraft(rec, {
            side: 'blue',
            valueOf: oracles.valueOf,
            bestAlternative: oracles.bestAlternative,
            availableAtStart: new Set(['a1', 'zz', 'b1'])
        });
        expect(oracles.valueStates[0].available.size).toBe(3);
        // b1 banned at seq 1; e1 was never in the injected pool.
        expect([...oracles.valueStates[1].available].sort()).toEqual(['a1', 'zz']);
    });

    it('reviews the red side when asked', () => {
        const { rec } = scenarioA();
        const oracles = tableOracles(
            Array.from({ length: 4 }, () => ({ championKey: 'x', value: 0.5 })),
            { 2: 0.5, 8: 0.5, 9: 0.5, 17: 0.5 }
        );
        const result = annotateDraft(rec, { side: 'red', valueOf: oracles.valueOf, bestAlternative: oracles.bestAlternative });
        expect(result.actions.map((a) => a.seq)).toEqual([2, 8, 9, 17]);
        expect(result.teamSummary.side).toBe('red');
    });

    it('returns an empty, null-worst summary when the reviewed side never acted', () => {
        const rec = record('g1f', [pick(7, 'blue', 'a1')]);
        const oracles = tableOracles([], {});
        const result = annotateDraft(rec, { side: 'red', valueOf: oracles.valueOf, bestAlternative: oracles.bestAlternative });
        expect(result.actions).toEqual([]);
        expect(result.teamSummary).toEqual({ side: 'red', totalLossPp: 0, worstSeq: null });
    });
});

describe('annotateDraft — gated informational notes', () => {
    const flatOracles = (n: number, table: Record<number, number>) =>
        tableOracles(Array.from({ length: n }, () => ({ championKey: 'best', value: 0.5 })), table);

    it('flags a Fearless-wasted ban only when `consumed` is injected', () => {
        const rec = record('g2', [ban(1, 'blue', 'x9', 'Azir'), pick(7, 'blue', 'x8')]);
        const table = { 1: 0.5, 7: 0.5 };

        const withCtx = flatOracles(2, table);
        const annotated = annotateDraft(rec, {
            side: 'blue',
            valueOf: withCtx.valueOf,
            bestAlternative: withCtx.bestAlternative,
            consumed: new Set(['x9'])
        });
        expect(annotated.actions[0].notesFr.some((n) => n.includes('déjà consommé'))).toBe(true);
        expect(annotated.actions[0].notesFr.some((n) => n.includes('Azir'))).toBe(true);
        expect(annotated.actions[0].noteTags).toEqual(['consumed-ban'] as AnnotationNoteTag[]);
        expect(annotated.actions[1].notesFr).toEqual([]); // a pick is never a wasted ban
        // The consumed champion is excluded from the default starting pool.
        expect(withCtx.valueStates[0].available.has('x9')).toBe(false);
        expect(withCtx.valueStates[0].available.has('x8')).toBe(true);

        const withoutCtx = flatOracles(2, table);
        const silent = annotateDraft(rec, {
            side: 'blue',
            valueOf: withoutCtx.valueOf,
            bestAlternative: withoutCtx.bestAlternative
        });
        expect(silent.actions.every((a) => a.notesFr.length === 0)).toBe(true);
    });

    it('flags an out-of-top-k pick only when `ranges` is injected and non-empty', () => {
        const rec = record('g3', [ban(1, 'blue', 'b1'), pick(7, 'blue', 'a1')]);
        const table = { 1: 0.5, 7: 0.5 };

        // In range (a1 within the returned top-8): no note.
        const inRange = flatOracles(2, table);
        const ok = annotateDraft(rec, {
            side: 'blue',
            valueOf: inRange.valueOf,
            bestAlternative: inRange.bestAlternative,
            ranges: () => [
                { championKey: 'r1', p: 0.4 },
                { championKey: 'r2', p: 0.3 },
                { championKey: 'a1', p: 0.3 }
            ]
        });
        expect(ok.actions[1].notesFr).toEqual([]);

        // Out of range: note + tag, and bans are never queried.
        const seenSlots: NavigatorSlot[] = [];
        const outRange = flatOracles(2, table);
        const flagged = annotateDraft(rec, {
            side: 'blue',
            valueOf: outRange.valueOf,
            bestAlternative: outRange.bestAlternative,
            ranges: (_state, slot) => {
                seenSlots.push(slot);
                return [
                    { championKey: 'r1', p: 0.7 },
                    { championKey: 'r2', p: 0.3 }
                ];
            }
        });
        expect(flagged.actions[1].notesFr.some((n) => n.includes('hors de la range top-8'))).toBe(true);
        expect(flagged.actions[1].noteTags).toEqual(['out-of-range'] as AnnotationNoteTag[]);
        expect(seenSlots.map((s) => s.type)).toEqual(['pick']); // ban slot never queried
        expect(seenSlots[0].seq).toBe(7);

        // Empty range: gated out — nothing is invented.
        const empty = flatOracles(2, table);
        const silent = annotateDraft(rec, {
            side: 'blue',
            valueOf: empty.valueOf,
            bestAlternative: empty.bestAlternative,
            ranges: () => []
        });
        expect(silent.actions[1].notesFr).toEqual([]);
    });

    it('applies the configured top-k window to the range note', () => {
        const rec = record('g3b', [pick(7, 'blue', 'a1')]);
        const entries = [
            { championKey: 'r1', p: 0.6 },
            { championKey: 'a1', p: 0.4 }
        ];
        const narrow = flatOracles(1, { 7: 0.5 });
        const flagged = annotateDraft(rec, {
            side: 'blue',
            valueOf: narrow.valueOf,
            bestAlternative: narrow.bestAlternative,
            ranges: () => entries,
            config: { ...DEFAULT_ANNOTATOR_CONFIG, rangeTopK: 1 } // top-1 = r1 → a1 is out
        });
        expect(flagged.actions[0].noteTags).toEqual(['out-of-range'] as AnnotationNoteTag[]);
        expect(flagged.actions[0].notesFr[0]).toContain('top-1');

        const wide = flatOracles(1, { 7: 0.5 });
        const ok = annotateDraft(rec, {
            side: 'blue',
            valueOf: wide.valueOf,
            bestAlternative: wide.bestAlternative,
            ranges: () => entries,
            config: { ...DEFAULT_ANNOTATOR_CONFIG, rangeTopK: 2 }
        });
        expect(ok.actions[0].notesFr).toEqual([]);
    });

    it('relays the early-reveal cost only when fogContext is injected and above threshold', () => {
        const rec = record('g3c', [ban(1, 'blue', 'b1'), pick(7, 'blue', 'a1')]);
        const table = { 1: 0.5, 7: 0.5 };

        const seen: DraftAction[] = [];
        const oracles = flatOracles(2, table);
        const flagged = annotateDraft(rec, {
            side: 'blue',
            valueOf: oracles.valueOf,
            bestAlternative: oracles.bestAlternative,
            fogContext: {
                revealCostPp: (_state, action) => {
                    seen.push(action);
                    return 1.2;
                }
            }
        });
        expect(flagged.actions[1].notesFr.some((n) => n.includes('Révélation précoce') && n.includes('1.2 pp'))).toBe(true);
        expect(flagged.actions[1].noteTags).toEqual(['early-reveal'] as AnnotationNoteTag[]);
        expect(seen.map((a) => a.type)).toEqual(['pick']); // bans never queried
        expect(flagged.actions[0].notesFr).toEqual([]);

        // Below the 0.5 pp floor or a null read: silent.
        const low = flatOracles(2, table);
        const quiet = annotateDraft(rec, {
            side: 'blue',
            valueOf: low.valueOf,
            bestAlternative: low.bestAlternative,
            fogContext: { revealCostPp: () => 0.3 }
        });
        expect(quiet.actions[1].notesFr).toEqual([]);

        const none = flatOracles(2, table);
        const noRead = annotateDraft(rec, {
            side: 'blue',
            valueOf: none.valueOf,
            bestAlternative: none.bestAlternative,
            fogContext: { revealCostPp: () => null }
        });
        expect(noRead.actions[1].notesFr).toEqual([]);
    });
});

// ---- leakReport -------------------------------------------------------------------

function aa(input: {
    seq: number;
    actionType: 'pick' | 'ban';
    phase: DraftPhase;
    grade?: AnnotationGrade;
    evLossPp?: number;
    noteTags?: AnnotationNoteTag[];
    championKey?: string;
    championName?: string;
}): ActionAnnotation {
    return {
        seq: input.seq,
        actionType: input.actionType,
        phase: input.phase,
        side: 'blue',
        championKey: input.championKey ?? 'c',
        championName: input.championName ?? 'C',
        evBeforePp: 0,
        evAfterPp: 0,
        evLossPp: input.evLossPp ?? 0,
        grade: input.grade ?? '',
        suppressed: false,
        notesFr: [],
        noteTags: input.noteTags ?? []
    };
}

function annotation(gameId: string, actions: ActionAnnotation[]): DraftAnnotation {
    const totalLossPp = actions.reduce((sum, a) => sum + a.evLossPp, 0);
    return { gameId, actions, teamSummary: { side: 'blue', totalLossPp, worstSeq: actions[0]?.seq ?? null } };
}

describe('leakReport', () => {
    it('aggregates repeated graded mistakes on the same rotation, exactly', () => {
        const annotations = [
            annotation('g1', [
                aa({ seq: 1, actionType: 'ban', phase: 'ban1', grade: '?', evLossPp: 2 }),
                aa({ seq: 5, actionType: 'ban', phase: 'ban1', evLossPp: 0.5 }), // ungraded — ignored
                aa({ seq: 7, actionType: 'pick', phase: 'pick1', grade: '?!', evLossPp: 1 }) // P1 ×1 — under min
            ]),
            annotation('g2', [aa({ seq: 3, actionType: 'ban', phase: 'ban1', grade: '?', evLossPp: 2.5 })])
        ];
        const report = leakReport(annotations);
        // Only B1-B3 reaches 2 occurrences; no phase-2 hit exists.
        expect(report).toEqual([
            {
                patternFr: 'Erreurs répétées en B1-B3',
                occurrences: 2,
                totalCostPp: 4.5,
                exampleGameIds: ['g1', 'g2']
            }
        ]);
    });

    it('aggregates repeated wasted bans on the same consumed champion (tag-based, grade-free)', () => {
        const annotations = [
            annotation('g1', [
                aa({ seq: 1, actionType: 'ban', phase: 'ban1', noteTags: ['consumed-ban'], championKey: 'x9', championName: 'Azir' })
            ]),
            annotation('g2', [
                aa({
                    seq: 3,
                    actionType: 'ban',
                    phase: 'ban1',
                    evLossPp: 1.2,
                    noteTags: ['consumed-ban'],
                    championKey: 'x9',
                    championName: 'Azir'
                })
            ])
        ];
        const report = leakReport(annotations);
        expect(report).toEqual([
            {
                patternFr: 'Bans gaspillés sur Azir (déjà consommé en Fearless)',
                occurrences: 2,
                totalCostPp: 1.2,
                exampleGameIds: ['g1', 'g2']
            }
        ]);
    });

    it('flags losses concentrated in phase 2 with the exact share', () => {
        const annotations = [
            annotation('g1', [
                aa({ seq: 7, actionType: 'pick', phase: 'pick1', grade: '?!', evLossPp: 1 }),
                aa({ seq: 17, actionType: 'pick', phase: 'pick2', grade: '??', evLossPp: 3 })
            ]),
            annotation('g2', [aa({ seq: 18, actionType: 'pick', phase: 'pick2', grade: '?', evLossPp: 2 })])
        ];
        // phase-2 hits = 2 (cost 5) over total 6 → share 83.33 % ≥ 50 %.
        const report = leakReport(annotations);
        expect(report).toEqual([
            {
                patternFr: 'Pertes concentrées en phase 2 (83 % du coût total)',
                occurrences: 2,
                totalCostPp: 5,
                exampleGameIds: ['g1', 'g2']
            }
        ]);
        // A stricter share threshold removes it.
        expect(leakReport(annotations, { phase2ShareMin: 0.9 })).toEqual([]);
    });

    it('sorts by total cost desc and breaks ties on patternFr asc', () => {
        // Two rotation leaks: P1 costs 4.6, B1-B3 costs 4.5 → P1 first.
        const costSorted = leakReport([
            annotation('g1', [
                aa({ seq: 1, actionType: 'ban', phase: 'ban1', grade: '?', evLossPp: 2 }),
                aa({ seq: 7, actionType: 'pick', phase: 'pick1', grade: '?', evLossPp: 2.2 })
            ]),
            annotation('g2', [
                aa({ seq: 3, actionType: 'ban', phase: 'ban1', grade: '?', evLossPp: 2.5 }),
                aa({ seq: 7, actionType: 'pick', phase: 'pick1', grade: '?', evLossPp: 2.4 })
            ])
        ]);
        expect(costSorted.map((e) => e.patternFr)).toEqual(['Erreurs répétées en P1', 'Erreurs répétées en B1-B3']);
        expect(costSorted[0].totalCostPp).toBeCloseTo(4.6, 9);

        // Same B4-B5 bans feed BOTH the rotation and the phase-2 patterns:
        // equal cost (4.5) and occurrences (2) → alphabetical patternFr.
        const tie = leakReport([
            annotation('g1', [aa({ seq: 13, actionType: 'ban', phase: 'ban2', grade: '?', evLossPp: 2 })]),
            annotation('g2', [aa({ seq: 14, actionType: 'ban', phase: 'ban2', grade: '?', evLossPp: 2.5 })])
        ]);
        expect(tie.map((e) => e.patternFr)).toEqual([
            'Erreurs répétées en B4-B5',
            'Pertes concentrées en phase 2 (100 % du coût total)'
        ]);
    });

    it('respects minOccurrences and stays silent on clean games', () => {
        const annotations = [
            annotation('g1', [aa({ seq: 1, actionType: 'ban', phase: 'ban1', grade: '?', evLossPp: 2 })]),
            annotation('g2', [aa({ seq: 3, actionType: 'ban', phase: 'ban1', grade: '?', evLossPp: 2.5 })])
        ];
        expect(leakReport(annotations, { minOccurrences: 3 })).toEqual([]);
        expect(leakReport([annotation('g3', [aa({ seq: 1, actionType: 'ban', phase: 'ban1' })])])).toEqual([]);
    });

    it('deduplicates example game ids within a pattern', () => {
        const report = leakReport([
            annotation('g1', [
                aa({ seq: 1, actionType: 'ban', phase: 'ban1', grade: '?', evLossPp: 2 }),
                aa({ seq: 3, actionType: 'ban', phase: 'ban1', grade: '?', evLossPp: 2 })
            ])
        ]);
        expect(report[0].exampleGameIds).toEqual(['g1']);
        expect(report[0].occurrences).toBe(2);
    });
});
