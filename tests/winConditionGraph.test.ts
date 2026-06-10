import { describe, it, expect } from 'vitest';
import { analyzeWinConditions, type WinConditionReport, type WinConditionAxis } from '$lib/strategic/winConditionGraph';
import {
    DEFAULT_WIN_CONDITION_CONFIG,
    WIN_CONDITION_AXIS_IDS,
    collisionCellKey,
    type WinConditionAxisId
} from '$lib/strategic/winConditionAxes';
import { loadDefaultTags } from '$lib/tags';
import { Role, defaultChampionRoleData, type ChampionData, type Dataset, type Stats } from '$lib/types';
import type { ChampionTag, ChampionTagsFile } from '$lib/tags/types';

/*
 * Default weights used in every hand computation below (winConditionAxes.ts):
 *   γ (counterWeight) 0.6 · engage {hardAoe 2, softSingle 1, peel 1, knockback 1}
 *   dive {hardAoeDiver 2.5, softSingleDiver 1.75, peel 1, knockback 0.5}
 *   poke {rangedLong 1, siegeHint 0.5, hardAoeCounter 1}
 *   split {classifierShare 3, splitHint 1, meleeHighMobility 0.5, waveclear 1, earlyTempo 0.5}
 *   scaling {late 1, early 1, lateHyperBonus 0.5, datasetEdgeWeight 10}
 *   snowball {earlyLane 1.5, lateOppositionBonus 0.5, earlyJungle 0.75}
 *   objectives {rangedLong 1, siegeHint 0.5, hardAoe 1} · pick {softSingle 1, highMobilityBonus 0.5, peel 1, knockback 0.5}
 *   planMinScore 0.25 · planTopK 3 · statementMinScore 1
 * Raw per-side counts are projected ×5/n (n recognized champions); clash axes
 * score max(0, threat − 0.6·counter) per direction, ally minus enemy.
 */

// ---- synthetic tag helpers (same pattern as gamePlanClassifier.test.ts) ----

function tag(over: Partial<ChampionTag> & { id: string }): ChampionTag {
    return {
        name: over.id,
        damageType: 'AD',
        range: 'melee',
        engageTool: 'none',
        disengageTools: [],
        mobility: 'low',
        scalingWindow: 'mid',
        hyperCarry: false,
        confidence: 'high',
        taggedBy: 'user',
        ...over
    };
}

function fileOf(tags: ChampionTag[]): ChampionTagsFile {
    const champions: Record<string, ChampionTag> = {};
    tags.forEach((t, i) => (champions[String(i + 1)] = t));
    return { version: '1.0', schemaVersion: 1, patchTagged: 'test', lastUpdated: 'test', champions };
}

function axisOf(report: WinConditionReport, id: WinConditionAxisId): WinConditionAxis {
    const axis = report.axes.find((a) => a.id === id);
    if (!axis) throw new Error(`axis not found: ${id}`);
    return axis;
}

// ---- real championTags.json comps ----

const real = loadDefaultTags();
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function key(nameOrId: string): string {
    const target = norm(nameOrId);
    const entry = Object.entries(real.champions).find(([, t]) => norm(t.name) === target || norm(t.id) === target);
    if (!entry) throw new Error(`champion not found: ${nameOrId}`);
    return entry[0];
}

// Protect (Kog'Maw AD/short/none/low/late/hyper[protect] · Lulu + Janna AP/short/
// none/[peel,knockback]/low/late[protect]) vs dive (Vi AD/melee/hard-aoe/[kb]/high/
// mid · Camille AD/melee/soft/[peel]/high/mid[split] · Akali AP/melee/soft/[]/high/mid[pick]).
const PROTECT = [key('KogMaw'), key('Lulu'), key('Janna')];
const DIVE = [key('Vi'), key('Camille'), key('Akali')];

// Poke/siege, role-ordered: Jayce(AD/short/soft/[kb]/med/early[siege]) Nidalee(AP/
// short/none/high/mid) Ziggs(AP/long/soft/[kb]/low/late[siege]) Caitlyn(AD/long/
// none/low/late[siege]) Karma(AP/short/soft/[peel]/low/late[protect]).
const POKE = [key('Jayce'), key('Nidalee'), key('Ziggs'), key('Caitlyn'), key('Karma')];
// Engage, role-ordered: Malphite/Sejuani/Galio/Leona all melee hard-aoe medium mid
// [engage] (Galio has [knockback]); MissFortune AD/short/none/low/mid.
const ENGAGE = [key('Malphite'), key('Sejuani'), key('Galio'), key('MissFortune'), key('Leona')];

// Early snowball, role-ordered: Renekton(early/high/soft) LeeSin(early/high/soft/[kb])
// Pantheon(early/med/soft) Draven(early/low/none/[kb]) Thresh(mid/med/soft/[peel,kb][pick]).
const SNOWBALL = [key('Renekton'), key('LeeSin'), key('Pantheon'), key('Draven'), key('Thresh')];
// Late scalers, role-ordered: Jax(late/hyper) Sejuani(mid) Kassadin(late/hyper/high/
// soft/[peel]) Smolder(late/hyper) Soraka(late/[peel][protect]).
const SCALE = [key('Jax'), key('Sejuani'), key('Kassadin'), key('Smolder'), key('Soraka')];

// 1-3-1 split, role-ordered: Fiora(melee/none/med/mid[split]) Trundle(melee/none/
// [peel]/low/late[split]) Ryze(short/soft/[peel]/low/late[split]) Sivir(short/none/
// [peel]/low/mid) Braum(AP/short/soft/[peel,kb]/med/mid[protect]).
const SPLIT = [key('Fiora'), key('Trundle'), key('Ryze'), key('Sivir'), key('Braum')];

describe('winConditionAxes — config integrity', () => {
    it('declares exactly 8 distinct axes', () => {
        expect(WIN_CONDITION_AXIS_IDS.length).toBe(8);
        expect(new Set<string>(WIN_CONDITION_AXIS_IDS).size).toBe(8);
    });

    it('provides a complete narrative for every axis', () => {
        for (const id of WIN_CONDITION_AXIS_IDS) {
            const n = DEFAULT_WIN_CONDITION_CONFIG.narratives[id];
            expect(n.labelFr.length).toBeGreaterThan(0);
            expect(n.allyLeverFr.length).toBeGreaterThan(0);
            expect(n.enemyLeverFr.length).toBeGreaterThan(0);
            expect(n.triggersAlly.length).toBeGreaterThan(0);
            expect(n.triggersEnemy.length).toBeGreaterThan(0);
        }
    });

    it('keys every collision override on two valid, distinct axis ids', () => {
        const ids = new Set<string>(WIN_CONDITION_AXIS_IDS);
        for (const cell of Object.keys(DEFAULT_WIN_CONDITION_CONFIG.collisionOverridesFr)) {
            const [ally, enemy] = cell.split('|');
            expect(ids.has(ally)).toBe(true);
            expect(ids.has(enemy)).toBe(true);
            expect(ally).not.toBe(enemy);
        }
    });
});

describe('winConditionGraph — axis micro-mechanics (synthetic tags)', () => {
    it('axis 1: hard-AoE engage vs peel+knockback — exact clash value', () => {
        // Ally '1' hard-aoe: engage 2 ×5 (1v1 projection) = 10. Enemy '2'
        // peel+knockback: disengage (1+1) ×5 = 10. Ally clash = max(0, 10 −
        // 0.6×10) = 4; enemy has no engage → enemy clash 0 → score +4.
        const file = fileOf([tag({ id: 'A', engageTool: 'hard-aoe' }), tag({ id: 'B', disengageTools: ['peel', 'knockback'] })]);
        const r = analyzeWinConditions(['1'], ['2'], { tagsFile: file });
        expect(axisOf(r, 'engage-vs-disengage').score).toBeCloseTo(4, 10);
    });

    it('axis 1: counters neutralize a threat, they never reverse it (clamp at 0)', () => {
        // Ally has no engage at all (threat 0): max(0, 0 − 0.6×10) clamps to 0
        // instead of going negative; the enemy has no engage either → score 0.
        const file = fileOf([tag({ id: 'A' }), tag({ id: 'B', disengageTools: ['peel', 'knockback'] })]);
        const r = analyzeWinConditions(['1'], ['2'], { tagsFile: file });
        expect(axisOf(r, 'engage-vs-disengage').score).toBe(0);
    });

    it('axis 2: a diver requires high mobility AND an engage tool', () => {
        // Low-mobility hard-aoe is a teamfight engager, not a diver → dive
        // threat 0 on both sides → score 0.
        const file = fileOf([tag({ id: 'A', engageTool: 'hard-aoe', mobility: 'low' }), tag({ id: 'B' })]);
        const r = analyzeWinConditions(['1'], ['2'], { tagsFile: file });
        expect(axisOf(r, 'dive-vs-peel').score).toBe(0);
    });

    it('axis 2: peel attenuates the dive threat — exact values', () => {
        // Diver '1' (high + hard-aoe): 2.5 ×5 = 12.5. Vs a peeler (peel 1 ×5 =
        // 5): 12.5 − 0.6×5 = 9.5. Vs no peel: 12.5 stays whole.
        const peeler = fileOf([tag({ id: 'A', engageTool: 'hard-aoe', mobility: 'high' }), tag({ id: 'B', disengageTools: ['peel'] })]);
        const noPeel = fileOf([tag({ id: 'A', engageTool: 'hard-aoe', mobility: 'high' }), tag({ id: 'B' })]);
        const vsPeel = axisOf(analyzeWinConditions(['1'], ['2'], { tagsFile: peeler }), 'dive-vs-peel').score;
        const vsNone = axisOf(analyzeWinConditions(['1'], ['2'], { tagsFile: noPeel }), 'dive-vs-peel').score;
        expect(vsPeel).toBeCloseTo(9.5, 10);
        expect(vsNone).toBeCloseTo(12.5, 10);
        expect(vsPeel).toBeLessThan(vsNone);
    });

    it('axis 3: long-range poke + siege signature vs hard-AoE punish — exact value', () => {
        // Poker '1' (ranged-long 1 + siege hint 0.5) ×5 = 7.5; enemy hard-aoe
        // counter 1 ×5 = 5 → ally clash = 7.5 − 3 = 4.5; enemy poke 0 → +4.5.
        const file = fileOf([
            tag({ id: 'A', range: 'ranged-long', gamePlanHints: ['siege'] }),
            tag({ id: 'B', engageTool: 'hard-aoe' })
        ]);
        const r = analyzeWinConditions(['1'], ['2'], { tagsFile: file });
        expect(axisOf(r, 'poke-vs-engage').score).toBeCloseTo(4.5, 10);
    });

    it('axis 5: late hyper-carry vs early scaler — exact differential', () => {
        // Ally late+hyper: (1 + 0.5) ×5 = 7.5. Enemy early: −1 ×5 = −5.
        // Differential = 7.5 − (−5) = 12.5.
        const file = fileOf([
            tag({ id: 'A', scalingWindow: 'late', hyperCarry: true }),
            tag({ id: 'B', scalingWindow: 'early' })
        ]);
        const r = analyzeWinConditions(['1'], ['2'], { tagsFile: file });
        expect(axisOf(r, 'scaling-differential').score).toBeCloseTo(12.5, 10);
    });

    it('axis 6: early top/bot lanes + jungle, amplified vs late lane opponents; mid is excluded', () => {
        // Ally lanes (role-ordered): top early, jungle early, mid early, bot
        // early, sup mid. Enemy: top late, bot late, others mid. Pressure =
        // top (1.5 + 0.5 vs late) + bot (1.5 + 0.5) + jungle 0.75 = 4.75; the
        // early MID scaler adds nothing (spec: top/bot lanes + jungle only).
        // Enemy has no early lane → score +4.75. No projection on this axis.
        const file = fileOf([
            tag({ id: 'a-top', scalingWindow: 'early' }),
            tag({ id: 'a-jg', scalingWindow: 'early' }),
            tag({ id: 'a-mid', scalingWindow: 'early' }),
            tag({ id: 'a-bot', scalingWindow: 'early' }),
            tag({ id: 'a-sup' }),
            tag({ id: 'e-top', scalingWindow: 'late' }),
            tag({ id: 'e-jg' }),
            tag({ id: 'e-mid' }),
            tag({ id: 'e-bot', scalingWindow: 'late' }),
            tag({ id: 'e-sup' })
        ]);
        const r = analyzeWinConditions(['1', '2', '3', '4', '5'], ['6', '7', '8', '9', '10'], { tagsFile: file });
        expect(axisOf(r, 'snowball-weakside').score).toBeCloseTo(4.75, 10);
    });

    it('axis 7: objective profile differential (fight AoE vs zone control) — exact value', () => {
        // Ally hard-aoe: fight 1 ×5 = 5. Enemy ranged-long + siege hint: zone
        // (1 + 0.5) ×5 = 7.5. Differential = 5 − 7.5 = −2.5.
        const file = fileOf([
            tag({ id: 'A', engageTool: 'hard-aoe' }),
            tag({ id: 'B', range: 'ranged-long', gamePlanHints: ['siege'] })
        ]);
        const r = analyzeWinConditions(['1'], ['2'], { tagsFile: file });
        expect(axisOf(r, 'objective-control').score).toBeCloseTo(-2.5, 10);
    });

    it('axis 8: mobile catcher vs peel+knockback safety — exact value', () => {
        // Catcher '1' (soft-single 1 + high mobility 0.5) ×5 = 7.5. Safety of
        // '2' (peel 1 + knockback 0.5) ×5 = 7.5 → clash = 7.5 − 0.6×7.5 = 3.
        const file = fileOf([
            tag({ id: 'A', engageTool: 'soft-single', mobility: 'high' }),
            tag({ id: 'B', disengageTools: ['peel', 'knockback'] })
        ]);
        const r = analyzeWinConditions(['1'], ['2'], { tagsFile: file });
        expect(axisOf(r, 'pick-vs-grouped').score).toBeCloseTo(3, 10);
    });

    it('projection: a 1v1 and the same champions duplicated 5v5 score identically', () => {
        // Raw counts scale ×5 via duplication on one side, ×5/5 = ×1 projection
        // on the other — both paths land on the same full-comp scale; the
        // classifier share is size-invariant for a duplicated comp.
        const file = fileOf([tag({ id: 'A', engageTool: 'hard-aoe' }), tag({ id: 'B', disengageTools: ['peel', 'knockback'] })]);
        const small = analyzeWinConditions(['1'], ['2'], { tagsFile: file });
        const big = analyzeWinConditions(['1', '1', '1', '1', '1'], ['2', '2', '2', '2', '2'], { tagsFile: file });
        for (const id of WIN_CONDITION_AXIS_IDS) {
            expect(axisOf(big, id).score).toBeCloseTo(axisOf(small, id).score, 10);
        }
    });
});

describe('winConditionGraph — protect vs dive (mission flagship, 3v3)', () => {
    // All raw counts are projected ×5/3 (3 recognized champions per side).
    const report = analyzeWinConditions(PROTECT, DIVE);

    it('dive↔peel is the enemy-dominant axis, negative sign', () => {
        // Enemy dive threat: Vi (high+hard-aoe) 2.5 + Camille (high+soft) 1.75
        // + Akali 1.75 = 6 ×5/3 = 10. Ally carry peel: Lulu (peel 1 + kb 0.5)
        // 1.5 + Janna 1.5 = 3 ×5/3 = 5. Enemy clash = 10 − 0.6×5 = 7; the
        // protect side has zero divers → score −7, their biggest lever.
        expect(axisOf(report, 'dive-vs-peel').score).toBeCloseTo(-7, 10);
        expect(report.enemyPlan[0]).toBe('dive-vs-peel');
    });

    it('scaling is the ally primary lever', () => {
        // Ally lateness: Kog'Maw late+hyper 1.5 + Lulu 1 + Janna 1 = 3.5 ×5/3
        // = 35/6 ≈ 5.8333; the dive side is all mid-window → 0. allyPlan keeps
        // only axes ≥ 0.25 — scaling is the single positive axis here.
        expect(axisOf(report, 'scaling-differential').score).toBeCloseTo(35 / 6, 10);
        expect(report.allyPlan).toEqual(['scaling-differential']);
    });

    it('scores the secondary axes as hand-computed', () => {
        // engage: enemy tools (Vi 2 + Camille 1 + Akali 1) = 4 ×5/3 = 20/3;
        //   ally disengage (Lulu 2 + Janna 2) = 4 ×5/3 = 20/3; enemy clash =
        //   20/3 − 0.6×20/3 = 8/3; ally engage 0 → score −8/3 ≈ −2.667.
        expect(axisOf(report, 'engage-vs-disengage').score).toBeCloseTo(-8 / 3, 10);
        // split: enemy classifier votes — Vi {split 3, pick 1, engage 3.5} =
        //   7.5, Camille {split 4 (2+1+hint), pick 3, engage 1.5, protect 2
        //   (peel)} = 10.5, Akali {siege 0.5 (AP), split 3, pick 4 (incl.
        //   hint), engage 1.5} = 9 → split share 10/27; threat = (10/27)×3 +
        //   (Camille split hint 1)×5/3 + (3 melee-high ×0.5)×5/3 = 10/9 + 5/3
        //   + 5/2 = 95/18; the protect side has no waveclear (all ranged-
        //   short) nor early tempo → counter 0 → score −95/18 ≈ −5.278.
        expect(axisOf(report, 'split-vs-crossmap').score).toBeCloseTo(-95 / 18, 10);
        // pick: enemy catchers Camille 1.5 + Akali 1.5 = 3 ×5/3 = 5; ally
        //   safety (Lulu 1.5 + Janna 1.5) = 3 ×5/3 = 5 → clash 5 − 3 = 2;
        //   ally has no soft-single → score −2.
        expect(axisOf(report, 'pick-vs-grouped').score).toBeCloseTo(-2, 10);
        // objectives: enemy fight AoE (Vi) 1 ×5/3 = 5/3; ally zone 0 → −5/3.
        expect(axisOf(report, 'objective-control').score).toBeCloseTo(-5 / 3, 10);
        // poke: neither side has a ranged-long champion → 0. snowball: no
        //   early scaler anywhere → 0.
        expect(axisOf(report, 'poke-vs-engage').score).toBe(0);
        expect(axisOf(report, 'snowball-weakside').score).toBe(0);
    });

    it('ranks the enemy plan dive > split > engage (top 3 of 5 negatives)', () => {
        // |−7| > |−5.2987| > |−8/3| > |−2| > |−5/3| — planTopK caps at 3.
        expect(report.enemyPlan).toEqual(['dive-vs-peel', 'split-vs-crossmap', 'engage-vs-disengage']);
    });

    it('collides scaling (ours) with dive (theirs) and uses the bespoke cell narrative', () => {
        expect(report.collision?.allyAxisId).toBe('scaling-differential');
        expect(report.collision?.enemyAxisId).toBe('dive-vs-peel');
        const cell = collisionCellKey('scaling-differential', 'dive-vs-peel');
        expect(report.collision?.narrativeFr).toBe(DEFAULT_WIN_CONDITION_CONFIG.collisionOverridesFr[cell]);
        // Triggers: 2 ally-lever (scaling) + 2 enemy-lever (dive) observables.
        expect(report.collision?.triggers).toEqual([
            ...DEFAULT_WIN_CONDITION_CONFIG.narratives['scaling-differential'].triggersAlly,
            ...DEFAULT_WIN_CONDITION_CONFIG.narratives['dive-vs-peel'].triggersEnemy
        ]);
    });

    it('maps the collision onto the existing risk-marker ids', () => {
        // riskWhenAlly(scaling) = [homogeneous-scaling, no-frontline] ∪
        // riskWhenEnemy(dive) = [no-disengage-vs-engage, no-frontline], deduped.
        expect(report.collision?.riskMarkerIds).toEqual([
            'homogeneous-scaling',
            'no-frontline',
            'no-disengage-vs-engage'
        ]);
    });

    it('emits 3 postdictable statements: collision, late-game window, objectives', () => {
        // scaling +5.83 ≥ 1 → late/gameLength; objectives −5/3 ≤ −1 →
        // mid/objectives; snowball 0 → nothing; + the axis collision statement.
        expect(report.statements).toHaveLength(3);
        expect(report.statements[0]).toMatchObject({ direction: 'axis', falsifiableVia: 'none' });
        expect(report.statements[1]).toMatchObject({ direction: 'late', falsifiableVia: 'gameLength' });
        expect(report.statements[2]).toMatchObject({ direction: 'mid', falsifiableVia: 'objectives' });
    });

    it('degrades confidence: medium for 3v3 comps, low for the lane-based snowball axis', () => {
        for (const axis of report.axes) {
            expect(axis.confidence).toBe(axis.id === 'snowball-weakside' ? 'low' : 'medium');
        }
    });
});

describe('winConditionGraph — poke/siege vs hard engage (5v5)', () => {
    const report = analyzeWinConditions(POKE, ENGAGE);

    it('the engage axis is the enemy primary lever — exact value', () => {
        // Enemy engage: 4 hard-aoe ×2 = 8; ally disengage: Jayce kb 1 + Ziggs
        // kb 1 + Karma peel 1 = 3 → enemy clash = 8 − 1.8 = 6.2. Ally engage:
        // 3 soft-single = 3; enemy disengage: Galio kb 1 → ally clash = 3 −
        // 0.6 = 2.4. Score = 2.4 − 6.2 = −3.8 (full comps: projection ×1).
        expect(axisOf(report, 'engage-vs-disengage').score).toBeCloseTo(-3.8, 10);
        expect(report.enemyPlan[0]).toBe('engage-vs-disengage');
    });

    it('the poke axis favors the siege side even after the engage attenuation', () => {
        // Ally poke: ranged-long (Ziggs, Caitlyn) 2 + siege hints (Jayce,
        // Ziggs, Caitlyn) 1.5 = 3.5; enemy hard-aoe counter 4 → ally clash =
        // 3.5 − 2.4 = 1.1; the engage side has zero poke → +1.1. (The pick
        // lens scores higher — Jayce/Ziggs/Karma are also catch threats — so
        // poke is a lever, not necessarily THE primary.)
        expect(axisOf(report, 'poke-vs-engage').score).toBeCloseTo(1.1, 10);
    });

    it('emits both duration statements and the pick|engage bespoke collision', () => {
        // scaling: Ziggs+Caitlyn+Karma late 3 − Jayce early 1 = +2 ≥ 1 →
        // late/gameLength. snowball: Jayce early top ×1.5 (Malphite is mid, no
        // bonus) = +1.5 ≥ 1 → early/gameLength. objectives: ally 3.5 vs enemy
        // 4 → −0.5, below threshold. allyPlan[0] is pick-vs-grouped (3 soft-
        // single catchers vs Galio's lone knockback: 3 − 0.3 = +2.7).
        const vias = report.statements.map((s) => `${s.direction}/${s.falsifiableVia}`);
        expect(vias).toEqual(['axis/none', 'late/gameLength', 'early/gameLength']);
        expect(report.collision?.allyAxisId).toBe('pick-vs-grouped');
        const cell = collisionCellKey('pick-vs-grouped', 'engage-vs-disengage');
        expect(report.collision?.narrativeFr).toBe(DEFAULT_WIN_CONDITION_CONFIG.collisionOverridesFr[cell]);
    });

    it('reads full comps at high confidence (including the lane axis)', () => {
        for (const axis of report.axes) expect(axis.confidence).toBe('high');
    });
});

describe('winConditionGraph — early snowball vs late scaling (5v5)', () => {
    const report = analyzeWinConditions(SNOWBALL, SCALE);

    it('opposes our snowball lanes to their scaling — exact dominant scores', () => {
        // snowball: top Renekton early 1.5 + 0.5 (Jax late opposite) + bot
        //   Draven early 1.5 + 0.5 (Smolder late) + jungle Lee Sin early 0.75
        //   = +4.75 (Pantheon mid-lane early is excluded by spec).
        // scaling: ally 4 early = −4; enemy Jax/Kassadin/Smolder late+hyper
        //   1.5×3 + Soraka late 1 = 5.5 → −4 − 5.5 = −9.5.
        expect(axisOf(report, 'snowball-weakside').score).toBeCloseTo(4.75, 10);
        expect(axisOf(report, 'scaling-differential').score).toBeCloseTo(-9.5, 10);
        expect(report.allyPlan[0]).toBe('snowball-weakside');
        expect(report.enemyPlan[0]).toBe('scaling-differential');
    });

    it('states the closing window: early own-side statements + enemy objectives', () => {
        // scaling −9.5 → early/gameLength ("conclude before late game");
        // snowball +4.75 → early/gameLength; objectives: ally 0 vs Sejuani
        // hard-aoe 1 → −1 ≤ −1 → mid/objectives. + collision = 4 statements.
        const vias = report.statements.map((s) => `${s.direction}/${s.falsifiableVia}`);
        expect(vias).toEqual(['axis/none', 'early/gameLength', 'early/gameLength', 'mid/objectives']);
    });

    it('uses the bespoke snowball|scaling collision cell and flags the scaling risk', () => {
        const cell = collisionCellKey('snowball-weakside', 'scaling-differential');
        expect(report.collision?.narrativeFr).toBe(DEFAULT_WIN_CONDITION_CONFIG.collisionOverridesFr[cell]);
        // riskWhenAlly(snowball) ∪ riskWhenEnemy(scaling) = [homogeneous-scaling]
        // both sides → deduped to a single entry.
        expect(report.collision?.riskMarkerIds).toEqual(['homogeneous-scaling']);
    });
});

describe('winConditionGraph — split pressure is bilateral (5v5)', () => {
    it('a 1-3-1 comp owns the split axis against a no-waveclear engage comp', () => {
        // Ally split: classifier votes Fiora 3 / Trundle 4 / Ryze 1 of a 33
        // total (Fiora 4, Trundle 8.5, Ryze 9, Sivir 3.5, Braum 8 incl. its
        // protect hint) → share 8/33 ×3 = 8/11, + 3 split hints (Fiora,
        // Trundle, Ryze) = 41/11; engage comp has no waveclear (no ranged-long
        // AP) nor early tempo → ally clash 41/11. Enemy split share 8/29 ×3 =
        // 24/29 (4 melee-mid tanks vote split 2 each over a 29 total), no
        // hints, no high-mobility melee; our counter is 0 → enemy clash 24/29.
        // Score = 41/11 − 24/29 = 925/319 ≈ +2.900.
        const report = analyzeWinConditions(SPLIT, ENGAGE);
        const split = axisOf(report, 'split-vs-crossmap');
        expect(split.score).toBeCloseTo(925 / 319, 10);
        expect(report.allyPlan[0]).toBe('split-vs-crossmap');
        // Collision = split (ours) × objective-control (theirs: 4 hard-aoe →
        // profile −4, ahead of engage −3.6). No bespoke cell → compositional
        // narrative = ally lever sentence + enemy lever sentence.
        expect(report.collision?.enemyAxisId).toBe('objective-control');
        expect(report.collision?.narrativeFr).toBe(
            `${DEFAULT_WIN_CONDITION_CONFIG.narratives['split-vs-crossmap'].allyLeverFr} ` +
                `${DEFAULT_WIN_CONDITION_CONFIG.narratives['objective-control'].enemyLeverFr}`
        );
    });

    it('waveclear + early tempo on the other side attenuates the split edge', () => {
        // Vs [Renekton, LeeSin, Ziggs, Draven, Thresh]: counter = Ziggs
        // waveclear (ranged-long AP) 1 + 3 early scalers ×0.5 = 2.5 → ally
        // clash = 41/11 − 0.6×2.5 = 2.2273; their own split threat = share
        // 2/28.5 ×3 (Renekton+LeeSin high-melee votes, totals 5.5/5.5/8/1.5/8
        // — Thresh's AP adds 0.5 siege) + 2 melee-high ×0.5 = 1.2105 → score
        // = +1.0167 < +2.900 vs the engage comp.
        const vsCounter = analyzeWinConditions(SPLIT, [key('Renekton'), key('LeeSin'), key('Ziggs'), key('Draven'), key('Thresh')]);
        const vsEngage = analyzeWinConditions(SPLIT, ENGAGE);
        const attenuated = axisOf(vsCounter, 'split-vs-crossmap').score;
        expect(attenuated).toBeCloseTo(1.0167, 3);
        expect(attenuated).toBeLessThan(axisOf(vsEngage, 'split-vs-crossmap').score);
    });
});

describe('winConditionGraph — invariants & edges', () => {
    it('returns the 8 axes in canonical order', () => {
        const report = analyzeWinConditions(PROTECT, DIVE);
        expect(report.axes.map((a) => a.id)).toEqual([...WIN_CONDITION_AXIS_IDS]);
    });

    it('is antisymmetric: score(A,B) = −score(B,A) on every axis', () => {
        const forward = analyzeWinConditions(PROTECT, DIVE);
        const backward = analyzeWinConditions(DIVE, PROTECT);
        for (const id of WIN_CONDITION_AXIS_IDS) {
            expect(axisOf(forward, id).score).toBeCloseTo(-axisOf(backward, id).score, 10);
        }
    });

    it('decomposes every score into components that sum to it exactly', () => {
        for (const report of [analyzeWinConditions(PROTECT, DIVE), analyzeWinConditions(POKE, ENGAGE)]) {
            for (const axis of report.axes) {
                const sum = axis.components.reduce((s, c) => s + c.value, 0);
                expect(sum).toBeCloseTo(axis.score, 10);
            }
        }
    });

    it('degenerates gracefully when one side is empty: no collision, no statements, low confidence', () => {
        const report = analyzeWinConditions(PROTECT, []);
        expect(report.collision).toBeNull();
        expect(report.statements).toEqual([]);
        for (const axis of report.axes) expect(axis.confidence).toBe('low');
    });

    it('ignores unknown champion keys without disturbing the scores', () => {
        const withGhost = analyzeWinConditions([PROTECT[0], '999999', PROTECT[1], PROTECT[2]], DIVE);
        const clean = analyzeWinConditions(PROTECT, DIVE);
        for (const id of WIN_CONDITION_AXIS_IDS) {
            expect(axisOf(withGhost, id).score).toBeCloseTo(axisOf(clean, id).score, 10);
        }
    });

    // Minimal dataset: only the two botlaners carry time-bucket stats, on the
    // Bottom role (index 3 of the role-ordered comps). Buckets fold early=[0],
    // mid=[1,2], late=[3,4] (M4.3 mapping).
    function datasetFor(buckets: Record<string, Stats[]>): Dataset {
        const championData: Record<string, ChampionData> = {};
        for (const [championKey, statsByTime] of Object.entries(buckets)) {
            const statsByRole = {
                [Role.Top]: defaultChampionRoleData(),
                [Role.Jungle]: defaultChampionRoleData(),
                [Role.Middle]: defaultChampionRoleData(),
                [Role.Bottom]: defaultChampionRoleData(),
                [Role.Support]: defaultChampionRoleData()
            };
            statsByRole[Role.Bottom].statsByTime = statsByTime;
            championData[championKey] = { key: championKey, name: championKey, statsByRole };
        }
        return { version: 'test', date: 'test', championData };
    }
    const zero: Stats = { wins: 0, games: 0 };
    const dataset = datasetFor({
        // Caitlyn: early 20/50 = 0.40 · late 30/50 = 0.60.
        [key('Caitlyn')]: [{ wins: 20, games: 50 }, zero, zero, { wins: 30, games: 50 }, zero],
        // Miss Fortune: early 30/50 = 0.60 · late 20/50 = 0.40.
        [key('MissFortune')]: [{ wins: 30, games: 50 }, zero, zero, { wins: 20, games: 50 }, zero]
    });

    it('refines the scaling axis with the observed power curve on full comps', () => {
        // Team bucket winrates average only champions with data → ally late
        // 0.60 / early 0.40, enemy late 0.40 / early 0.60. Edge = (0.60−0.40)
        // − (0.40−0.60) = 0.40 ×10 = +4 on top of the tag differential +2
        // (poke comp: 3 late − 1 early vs all-mid) → 6, in a third component.
        const report = analyzeWinConditions(POKE, ENGAGE, { dataset });
        const scaling = axisOf(report, 'scaling-differential');
        expect(scaling.score).toBeCloseTo(6, 10);
        expect(scaling.components).toHaveLength(3);
    });

    it('ignores the dataset on partial comps (lane order untrustworthy)', () => {
        // The 3v3 flagship keeps its pure tag reading (35/6) even when a
        // dataset is supplied — refinement is gated on 5 recognized per side.
        const report = analyzeWinConditions(PROTECT, DIVE, { dataset });
        const scaling = axisOf(report, 'scaling-differential');
        expect(scaling.score).toBeCloseTo(35 / 6, 10);
        expect(scaling.components).toHaveLength(2);
    });
});
