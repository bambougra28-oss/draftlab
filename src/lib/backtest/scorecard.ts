/**
 * R9 — Summit Gate scorecard renderer (ARCHITECTURE_V2 §8 R9, S7, DA-V2-9).
 *
 * Produces the versioned markdown published as
 * `docs/calibration/scorecard-<patch>.md`: one row per metric, ALWAYS next to
 * its naive baseline and the bootstrap CI of the delta — a claim without a
 * baseline and an interval does not ship. The honesty legend (« cibles fixées
 * après première mesure ») is part of the format itself, per R9: no invented
 * target before the first measurement exists.
 *
 * `generatedAt` is an injected parameter — this module NEVER reads the system
 * clock, so rendering is a pure function of its input and scorecards are
 * byte-for-byte reproducible. Document strings are French (project rule);
 * code and comments are English.
 */
import type { Interval } from './metrics';

/** Outcome of a metric-vs-baseline comparison. */
export type Verdict = 'beats' | 'ties' | 'loses';

export interface ScorecardEntry {
    /** Metric name as published, e.g. 'ban-hit@5'. */
    metric: string;
    /** Measured value of the module under test. */
    value: number;
    /** Naive baseline value (frequency, p = 0.5, team-Elo…). */
    baseline: number;
    /** Bootstrap 95% CI of (value − baseline), in metric units. */
    deltaCI?: Interval;
    verdict: Verdict;
}

export interface ScorecardInput {
    /** Document title, e.g. 'Scorecard Summit Gate'. */
    title: string;
    /** Patch the corpus was scored on, e.g. '26.10'. */
    patch: string;
    /** ISO date of generation — INJECTED by the caller, never the clock. */
    generatedAt: string;
    entries: ScorecardEntry[];
    /** Free-form caveats (corpus size, dropped records, known biases…). */
    notes?: string[];
}

/**
 * Verdict from a value, its baseline and (optionally) the bootstrap CI of the
 * delta. With a CI, significance rules: 'beats' only when the whole interval
 * sits on the good side of zero, 'loses' when it sits entirely on the bad
 * side, 'ties' otherwise (including a CI touching zero). Without a CI it
 * degrades to a point comparison — only acceptable for provisional cards.
 *
 * `higherIsBetter` (default true) flips the good side for loss-like metrics
 * (log loss, Brier). Optional 4th parameter — deviation from the 3-argument
 * spec, justified: without it every log-loss row would need hand-negated
 * inputs, the exact kind of silent sign error the harness exists to prevent.
 */
export function verdictOf(
    value: number,
    baseline: number,
    ci?: Interval,
    higherIsBetter = true
): Verdict {
    const sign = higherIsBetter ? 1 : -1;
    if (ci) {
        if (sign * ci.lo > 0 && sign * ci.hi > 0) return 'beats';
        if (sign * ci.lo < 0 && sign * ci.hi < 0) return 'loses';
        return 'ties';
    }
    const delta = sign * (value - baseline);
    if (delta > 0) return 'beats';
    if (delta < 0) return 'loses';
    return 'ties';
}

/** French verdict labels shown in the published table. */
const VERDICT_LABELS: Record<Verdict, string> = {
    beats: 'bat la baseline',
    ties: 'à égalité (non significatif)',
    loses: 'sous la baseline'
};

/**
 * Format a number for the table: integers verbatim, otherwise at most 4
 * decimals with trailing zeros trimmed (no false precision), NaN as '—'.
 */
function fmt(n: number): string {
    if (Number.isNaN(n)) return '—';
    if (Number.isInteger(n)) return String(n);
    const fixed = n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    return fixed === '-0' ? '0' : fixed;
}

/** Signed variant: explicit '+' on positive deltas. */
function fmtSigned(n: number): string {
    return n > 0 ? `+${fmt(n)}` : fmt(n);
}

/** Escape pipes so a metric name cannot break the markdown table. */
function escapeCell(text: string): string {
    return text.replace(/\|/g, '\\|');
}

/**
 * Render the scorecard markdown (`docs/calibration/scorecard-<patch>.md`).
 * Layout: title + provenance line, metric table (value | baseline | delta
 * with CI | verdict), optional notes, then the fixed honesty legend.
 */
export function renderScorecard(input: ScorecardInput): string {
    const lines: string[] = [];

    lines.push(`# ${input.title} — Patch ${input.patch}`);
    lines.push('');
    lines.push(
        `> Généré le ${input.generatedAt} par le harnais de backtest ` +
            '(walk-forward par patch, IC bootstrap 95 %).'
    );
    lines.push('');
    lines.push('| Métrique | Valeur | Baseline | Δ (IC 95 %) | Verdict |');
    lines.push('|---|---:|---:|---:|---|');
    for (const entry of input.entries) {
        const delta = entry.value - entry.baseline;
        const ci = entry.deltaCI
            ? ` [${fmtSigned(entry.deltaCI.lo)}, ${fmtSigned(entry.deltaCI.hi)}]`
            : '';
        lines.push(
            `| ${escapeCell(entry.metric)} | ${fmt(entry.value)} | ${fmt(entry.baseline)} ` +
                `| ${fmtSigned(delta)}${ci} | ${VERDICT_LABELS[entry.verdict]} |`
        );
    }

    if (input.notes !== undefined && input.notes.length > 0) {
        lines.push('');
        lines.push('## Notes');
        lines.push('');
        for (const note of input.notes) {
            lines.push(`- ${note}`);
        }
    }

    lines.push('');
    lines.push('## Légende');
    lines.push('');
    lines.push(
        "- **bat la baseline** : l'IC bootstrap 95 % du delta exclut zéro en faveur du modèle."
    );
    lines.push(
        "- **à égalité (non significatif)** : l'IC traverse zéro — aucune différence " +
            "défendable à cette taille d'échantillon."
    );
    lines.push("- **sous la baseline** : l'IC exclut zéro en défaveur du modèle.");
    lines.push(
        '- Honnêteté : cibles fixées après première mesure — aucune cible chiffrée ' +
            "n'est inventée avant d'avoir les baselines (R9)."
    );

    return lines.join('\n') + '\n';
}
