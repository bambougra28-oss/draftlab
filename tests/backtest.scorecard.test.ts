import { describe, it, expect } from 'vitest';
import { renderScorecard, verdictOf } from '$lib/backtest/scorecard';
import type { ScorecardInput } from '$lib/backtest/scorecard';

describe('scorecard — verdictOf', () => {
    it('judges point comparisons when no CI is given (higher is better)', () => {
        expect(verdictOf(2.9, 1.8)).toBe('beats');
        expect(verdictOf(1.8, 1.8)).toBe('ties');
        expect(verdictOf(1.2, 1.8)).toBe('loses');
    });

    it('requires the CI to exclude zero before declaring beats/loses', () => {
        // CI of (value − baseline): only an interval fully on one side of
        // zero is a defensible claim; anything touching zero is a tie.
        expect(verdictOf(2.9, 1.8, { lo: 0.4, hi: 1.6 })).toBe('beats');
        expect(verdictOf(2.1, 1.8, { lo: -0.1, hi: 0.5 })).toBe('ties');
        expect(verdictOf(2.1, 1.8, { lo: 0, hi: 0.5 })).toBe('ties'); // touching zero
        expect(verdictOf(1.2, 1.8, { lo: -1.0, hi: -0.2 })).toBe('loses');
    });

    it('flips the good side for lower-is-better metrics (log loss, Brier)', () => {
        // Log loss 0.62 vs baseline 0.69: delta < 0 is an IMPROVEMENT.
        expect(verdictOf(0.62, 0.69, { lo: -0.05, hi: -0.01 }, false)).toBe('beats');
        expect(verdictOf(0.68, 0.69, { lo: -0.02, hi: 0.01 }, false)).toBe('ties');
        expect(verdictOf(0.75, 0.69, { lo: 0.02, hi: 0.1 }, false)).toBe('loses');
        // Point comparisons follow the same direction.
        expect(verdictOf(0.62, 0.69, undefined, false)).toBe('beats');
        expect(verdictOf(0.75, 0.69, undefined, false)).toBe('loses');
    });
});

describe('scorecard — renderScorecard', () => {
    const input: ScorecardInput = {
        title: 'Scorecard Summit Gate',
        patch: '26.10',
        generatedAt: '2026-06-10T18:00:00Z',
        entries: [
            {
                metric: 'ban-hit@5',
                value: 2.9,
                baseline: 1.8,
                deltaCI: { lo: 0.4, hi: 1.6 },
                verdict: 'beats'
            },
            {
                metric: 'log loss (prochain pick)',
                value: 0.6202,
                baseline: 0.6931,
                verdict: 'ties'
            }
        ],
        notes: ['Corpus : 38 drafts LFL, 2 records sans patch exclus.']
    };

    it('renders title, patch and the injected generation date verbatim', () => {
        const md = renderScorecard(input);
        expect(md).toContain('# Scorecard Summit Gate — Patch 26.10');
        expect(md).toContain('Généré le 2026-06-10T18:00:00Z');
    });

    it('renders one table row per entry plus the header row', () => {
        const md = renderScorecard(input);
        // Rows start with '| ' (the |---| separator does not): header + 2 entries.
        const rows = md.split('\n').filter((line) => line.startsWith('| '));
        expect(rows).toHaveLength(3);
    });

    it('formats a row with delta and CI exactly as specified', () => {
        // Hand: delta = 2.9 − 1.8 = 1.1 (float 1.0999…9 → '1.1000' → '1.1');
        // CI ends carry explicit '+' signs; verdict label is French.
        const md = renderScorecard(input);
        expect(md).toContain('| ban-hit@5 | 2.9 | 1.8 | +1.1 [+0.4, +1.6] | bat la baseline |');
    });

    it('omits the CI brackets when no deltaCI is provided', () => {
        // Hand: delta = 0.6202 − 0.6931 = −0.0729; no brackets follow.
        const md = renderScorecard(input);
        expect(md).toContain(
            '| log loss (prochain pick) | 0.6202 | 0.6931 | -0.0729 | à égalité (non significatif) |'
        );
    });

    it('always includes the honesty legend (« cibles fixées après première mesure »)', () => {
        const md = renderScorecard(input);
        expect(md).toContain('## Légende');
        expect(md).toContain('cibles fixées après première mesure');
        // Every verdict label is explained.
        expect(md).toContain('**bat la baseline**');
        expect(md).toContain('**à égalité (non significatif)**');
        expect(md).toContain('**sous la baseline**');
    });

    it('renders the notes section only when notes exist', () => {
        const withNotes = renderScorecard(input);
        expect(withNotes).toContain('## Notes');
        expect(withNotes).toContain('- Corpus : 38 drafts LFL, 2 records sans patch exclus.');

        const without = renderScorecard({ ...input, notes: undefined });
        expect(without).not.toContain('## Notes');
        const emptyNotes = renderScorecard({ ...input, notes: [] });
        expect(emptyNotes).not.toContain('## Notes');
    });

    it('renders NaN values as an em dash (no fake numbers)', () => {
        const md = renderScorecard({
            ...input,
            entries: [{ metric: 'pick-in-range@8', value: NaN, baseline: 0.4, verdict: 'ties' }]
        });
        expect(md).toContain('| pick-in-range@8 | — | 0.4 | — |');
    });

    it('is a pure function of its input (no clock, byte-identical reruns)', () => {
        expect(renderScorecard(input)).toBe(renderScorecard(input));
        expect(renderScorecard(input).endsWith('\n')).toBe(true);
    });
});
