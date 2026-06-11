/**
 * R7 — Printable prep pack, between-games re-plan sheet and CSV exports
 * (ARCHITECTURE_V2 §8 R7; DA-V2-8: exports are first-class artefacts).
 *
 * Coaches have NO devices on stage, so the pack is print-first A4 markdown:
 * compact tables, explicit page breaks ('\n\n---\n\n' between MAJOR sections
 * only), no emoji, champion names resolved through the tags file with the raw
 * key as fallback. Every section is OPTIONAL and rendered only when its input
 * is present and non-empty — an absent input produces NO section, nothing is
 * invented. `generatedAt` is INJECTED (never read from the system clock) and
 * the uncalibrated badge is always printed (ARCHITECTURE_V2 §9.6).
 *
 * The re-plan sheet is the 45-90 s Fearless between-games artefact: ONE page
 * — same building blocks, no page break inside.
 *
 * CSVs follow RFC 4180 — the Oracle's Elixir parser's grammar, inverted:
 * fields containing comma, quote or newline are double-quoted with embedded
 * quotes doubled; rows end in CRLF.
 *
 * Inputs are deliberately structural so the engine modules plug in directly:
 * BanPageEntry ⊇ BanEvEntry, RangeBlockEntry ⊇ RangeEntry/TendencyPrediction,
 * SeriesBudgetEntry ⊇ SpendVsSaveEntry (seriesSolver), DraftPlan verbatim.
 */
import { evidenceString } from '$lib/aggregates/tendency';
import type { TendencyPrediction } from '$lib/aggregates/tendency';
import { championNameByKey } from '$lib/dataDragon/version';
import { loadDefaultTags } from '$lib/tags';
import type { ChampionTagsFile } from '$lib/tags/types';
import type { DraftPlan } from '$lib/storage/draftPlans';
import type { PlannedAction, PlanTree, PlanTreeNode } from '$lib/strategic/planTree';
import type { PoolTier } from '$lib/strategic/poolTierClassifier';
import type { DenialValueResult, PoolIntegrityResult, RetentionValueResult } from '$lib/strategic/seriesSolver';
import type { WinConditionConfidence, WinConditionReport } from '$lib/strategic/winConditionGraph';
import { Role } from '$lib/types';

// ---- input shapes -------------------------------------------------------------

export interface PrepPackHeader {
    title: string;
    opponent: string;
    /** Injected display timestamp — the renderer never reads the clock. */
    generatedAt: string;
}

/** Ban-page line — structurally a BanEvEntry (extra fields welcome). */
export interface BanPageEntry {
    championKey: string;
    rationaleFr: string[];
}

export interface BanPage {
    /** e.g. 'B1-B3' or 'B4-B5' (rotation labels from $lib/aggregates/rotations). */
    rotationLabel: string;
    entries: BanPageEntry[];
}

export interface PoolGridEntry {
    championKey: string;
    tier: PoolTier;
    games: number;
}

export interface PoolGridPlayer {
    playerName: string;
    roleLabel?: string;
    entries: PoolGridEntry[];
}

export interface TendencyBlock {
    /** e.g. 'P1 — côté bleu' (cellKey rendered for coaches). */
    contextLabel: string;
    predictions: TendencyPrediction[];
}

/** Range line — structurally a RangeEntry or TendencyPrediction. */
export interface RangeBlockEntry {
    championKey: string;
    p: number;
}

export interface RangeBlock {
    slotLabel: string;
    entries: RangeBlockEntry[];
}

/** Series-budget line — structurally a seriesSolver SpendVsSaveEntry. */
export interface SeriesBudgetEntry {
    championKey: string;
    role?: Role;
    retention: RetentionValueResult;
    /** Null = denial not priced (no want model) — rendered as such, never 0. */
    denial: DenialValueResult | null;
    verdictFr?: string;
}

export interface PrepPackInput {
    header: PrepPackHeader;
    plans?: DraftPlan[];
    /** Compiled opponent plan tree → printable repertoire section (R6). */
    planTree?: PlanTree;
    banPages?: BanPage[];
    poolGrids?: PoolGridPlayer[];
    tendencies?: TendencyBlock[];
    ranges?: RangeBlock[];
    winConditions?: WinConditionReport;
    seriesBudget?: SeriesBudgetEntry[];
    notesFr?: string[];
    /** Injected name resolver source; defaults to the bundled tags file. */
    tagsFile?: ChampionTagsFile;
}

// ---- shared rendering helpers ---------------------------------------------------

const PAGE_BREAK = '\n\n---\n\n';
const BADGE_FR = 'Non calibré — outil d\'aide, pas oracle.';

const ROLE_LABELS_FR: Record<Role, string> = {
    [Role.Top]: 'Top',
    [Role.Jungle]: 'Jungle',
    [Role.Middle]: 'Mid',
    [Role.Bottom]: 'ADC',
    [Role.Support]: 'Support'
};

const TIER_ORDER: readonly PoolTier[] = ['strongest', 'match-ready', 'scrim-ready', 'learning'];

/** Print labels mirroring the PoolTierPanel UI wording. */
const TIER_LABELS_FR: Record<PoolTier, string> = {
    strongest: 'Maîtrisés',
    'match-ready': 'Prêts match',
    'scrim-ready': 'Prêts scrim',
    learning: 'En apprentissage'
};

const CONFIDENCE_LABELS_FR: Record<WinConditionConfidence, string> = {
    low: 'faible',
    medium: 'moyenne',
    high: 'haute'
};

/** Resolved display name with the raw key as honest fallback. */
function nameOf(championKey: string, tags: ChampionTagsFile): string {
    return championNameByKey(championKey, tags) ?? championKey;
}

const mdCell = (text: string): string => text.replace(/\|/g, '\\|');

/** Compact pipe table; cell pipes are escaped so rows never break. */
function mdTable(headers: string[], rows: string[][]): string {
    const lines = [
        `| ${headers.map(mdCell).join(' | ')} |`,
        `|${headers.map(() => ' --- ').join('|')}|`,
        ...rows.map((row) => `| ${row.map(mdCell).join(' | ')} |`)
    ];
    return lines.join('\n');
}

/** Probability as a whole percentage — no fake decimal precision (§6.9). */
const pct = (p: number): string => `${Math.round(p * 100)} %`;

/** Signed pp rendering of a probability-space value (0.015 → '+1.5'). */
const signedPp = (value: number): string => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}`;

/** Signed 1-decimal rendering of a raw axis score. */
const signed = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;

// ---- prep pack sections -----------------------------------------------------------

function renderHeader(header: PrepPackHeader): string {
    return (
        `# ${header.title}\n\n` +
        `Adversaire : ${header.opponent} — généré le ${header.generatedAt}\n\n` +
        `> ${BADGE_FR}`
    );
}

function renderPlan(plan: DraftPlan, tags: ChampionTagsFile): string {
    const suffixParts: string[] = [];
    if (plan.side !== undefined) suffixParts.push(plan.side === 'blue' ? 'côté bleu' : 'côté rouge');
    if (plan.applicableGames !== undefined && plan.applicableGames.length > 0) {
        suffixParts.push(`games ${plan.applicableGames.join(', ')}`);
    }
    const suffix = suffixParts.length > 0 ? ` (${suffixParts.join(' — ')})` : '';

    const bans = plan.bans
        .map((ban) => {
            if (ban.championKey === null) return '—';
            const name = nameOf(ban.championKey, tags);
            return ban.rationale !== undefined && ban.rationale !== '' ? `${name} (${ban.rationale})` : name;
        })
        .join(', ');

    const picksTable = mdTable(
        ['Rôle', 'Principal', 'Repli', 'Justification'],
        plan.picks.map((pick) => [
            ROLE_LABELS_FR[pick.role],
            pick.primary === null ? '—' : nameOf(pick.primary, tags),
            pick.fallback === null ? '—' : nameOf(pick.fallback, tags),
            pick.rationale ?? ''
        ])
    );

    const parts = [`### ${plan.name}${suffix}`, `Bans : ${bans}`, picksTable];
    if (plan.notes !== undefined && plan.notes !== '') parts.push(`Notes : ${plan.notes}`);
    return parts.join('\n\n');
}

function renderPlans(plans: DraftPlan[], tags: ChampionTagsFile): string {
    return ['## Plans de draft', ...plans.map((plan) => renderPlan(plan, tags))].join('\n\n');
}

function renderBanPages(pages: BanPage[], tags: ChampionTagsFile): string {
    const blocks = pages.map((page) => {
        const table = mdTable(
            ['Champion', 'Justification'],
            page.entries.map((entry) => [nameOf(entry.championKey, tags), entry.rationaleFr.join(' ; ')])
        );
        return `### ${page.rotationLabel}\n\n${table}`;
    });
    return ['## Pages de bans', ...blocks].join('\n\n');
}

function renderPoolGrid(player: PoolGridPlayer, tags: ChampionTagsFile): string {
    const heading = player.roleLabel !== undefined ? `### ${player.playerName} (${player.roleLabel})` : `### ${player.playerName}`;
    const lines: string[] = [];
    for (const tier of TIER_ORDER) {
        const inTier = player.entries.filter((entry) => entry.tier === tier);
        if (inTier.length === 0) continue; // empty tiers stay silent — compact print
        const champions = inTier.map((entry) => `${nameOf(entry.championKey, tags)} (${entry.games} g)`).join(', ');
        lines.push(`- ${TIER_LABELS_FR[tier]} : ${champions}`);
    }
    return [heading, lines.join('\n')].join('\n\n');
}

function renderPoolGrids(players: PoolGridPlayer[], tags: ChampionTagsFile): string {
    return ['## Pools par joueur', ...players.map((player) => renderPoolGrid(player, tags))].join('\n\n');
}

function renderTendencies(blocks: TendencyBlock[], tags: ChampionTagsFile): string {
    const sections = blocks.map((block) => {
        const table = mdTable(
            ['Champion', 'P', 'Évidence'],
            block.predictions.map((prediction) => [
                nameOf(prediction.championKey, tags),
                pct(prediction.p),
                evidenceString(prediction)
            ])
        );
        return `### ${block.contextLabel}\n\n${table}`;
    });
    return ['## Tendances adverses', ...sections].join('\n\n');
}

function renderRanges(blocks: RangeBlock[], tags: ChampionTagsFile): string {
    const lines = blocks.map((block) => {
        const entries = block.entries.map((entry) => `${nameOf(entry.championKey, tags)} ${pct(entry.p)}`).join(', ');
        return `- ${block.slotLabel} : ${entries}`;
    });
    return ['## Ranges par slot', lines.join('\n')].join('\n\n');
}

function renderWinConditions(report: WinConditionReport): string {
    const parts: string[] = ['## Conditions de victoire'];

    // Axes WITH their components — never a fused hidden score (DA-V2-12).
    const axisLines: string[] = [];
    for (const axis of report.axes) {
        axisLines.push(`- ${axis.labelFr} : ${signed(axis.score)} (confiance ${CONFIDENCE_LABELS_FR[axis.confidence]})`);
        for (const component of axis.components) {
            axisLines.push(`  - ${component.reason} → ${signed(component.value)}`);
        }
    }
    if (axisLines.length > 0) parts.push(axisLines.join('\n'));

    if (report.collision !== null) {
        parts.push(`Collision : ${report.collision.narrativeFr}`);
        if (report.collision.triggers.length > 0) {
            parts.push(['Triggers :', ...report.collision.triggers.map((t) => `- ${t}`)].join('\n'));
        }
    }

    if (report.statements.length > 0) {
        parts.push(['Conditions falsifiables :', ...report.statements.map((s) => `- ${s.textFr}`)].join('\n'));
    }

    return parts.join('\n\n');
}

function renderSeriesBudget(entries: SeriesBudgetEntry[], tags: ChampionTagsFile): string {
    const table = mdTable(
        ['Rôle', 'Champion', 'Maintenant', 'Option future', 'Net', 'Déni', 'Verdict'],
        entries.map((entry) => [
            entry.role !== undefined ? ROLE_LABELS_FR[entry.role] : '—',
            nameOf(entry.championKey, tags),
            `${signedPp(entry.retention.nowGain)} pp`,
            `${signedPp(entry.retention.futureLoss)} pp`,
            `${signedPp(entry.retention.net)} pp`,
            entry.denial === null ? 'non chiffré' : `${signedPp(entry.denial.total)} pp`,
            entry.verdictFr ?? ''
        ])
    );
    const legend =
        'Maintenant = gain d\'équité sur la game courante ; Option future = valeur d\'option de série ; ' +
        'Net = somme des deux (composantes affichées séparément).';
    return ['## Budget de série (Fearless)', table, legend].join('\n\n');
}

function renderNotes(notes: string[]): string {
    return ['## Notes', notes.map((note) => `- ${note}`).join('\n')].join('\n\n');
}

// ---- repertoire (chantier D — arbre de prep imprimable) -----------------------------

/**
 * Print budget of the repertoire: ~35 lines per A4 page in compact print —
 * the section TARGETS two pages (R6), the mass floor does the real pruning.
 */
const REPERTOIRE_MAX_LINES = 70;

/** « ban Rell, pick Vi (repli Sejuani) » — one prepared reply line. */
function repertoireReply(actions: PlannedAction[], tags: ChampionTagsFile): string {
    return actions
        .map((action) => {
            const fallback = action.fallback !== undefined ? ` (repli ${nameOf(action.fallback, tags)})` : '';
            return `${action.type === 'ban' ? 'ban' : 'pick'} ${nameOf(action.championKey, tags)}${fallback}`;
        })
        .join(', ');
}

/**
 * Chess-style printable repertoire: depth-first walk of the compiled tree,
 * keeping only lines of pathMass ≥ replyMassFloor (the thick mainlines).
 * Numbering 1 / 1.1 / 1.1.2 mirrors opening books; every branch line carries
 * the model mass, the raw evidence and OUR prepared reply.
 */
function renderRepertoire(tree: PlanTree, tags: ChampionTagsFile): string {
    const floor = tree.config.replyMassFloor;
    const lines: string[] = [];
    let truncated = false;

    const walk = (node: PlanTreeNode, label: string, depth: number): void => {
        let shown = 0;
        for (const branch of node.branches) {
            if (branch.child.pathMass < floor) continue;
            if (lines.length >= REPERTOIRE_MAX_LINES) {
                truncated = true;
                return;
            }
            shown += 1;
            const num = label === '' ? `${shown}` : `${label}.${shown}`;
            const indent = '  '.repeat(depth);
            const reply =
                branch.child.ourLine.length > 0
                    ? ` → nous : ${repertoireReply(branch.child.ourLine, tags)}`
                    : '';
            lines.push(
                `${indent}- ${num}. ${nameOf(branch.championKey, tags)} ${pct(branch.p)} ` +
                    `(${evidenceString(branch)})${reply}`
            );
            walk(branch.child, num, depth + 1);
        }
    };
    walk(tree.root, '', 0);

    const provenance = tree.modelProvenance;
    const parts: string[] = [
        `## Répertoire — script contre ${tree.opponent}`,
        `> Lignes de masse ≥ ${pct(floor)} (plancher \`replyMassFloor\` du compile) — cible : 2 pages A4. ` +
            `Modèle : ${provenance.records} games${provenance.latestPatch !== undefined ? `, patch ≤ ${provenance.latestPatch}` : ''}. ` +
            'Les % sont la masse du MODÈLE à la compilation, pas une couverture mesurée.',
        tree.root.ourLine.length > 0
            ? `Ouverture préparée — nous : ${repertoireReply(tree.root.ourLine, tags)}.`
            : 'Ouverture chez l’adversaire.'
    ];
    parts.push(lines.length > 0 ? lines.join('\n') : 'Aucune ligne au-dessus du plancher de masse.');
    if (truncated) {
        parts.push(`(Tronqué à ${REPERTOIRE_MAX_LINES} lignes — resserrez le plancher pour tenir les 2 pages.)`);
    }
    return parts.join('\n\n');
}

/** Non-empty array or undefined — empty sections are never rendered. */
function present<T>(items: T[] | undefined): T[] | undefined {
    return items !== undefined && items.length > 0 ? items : undefined;
}

// ---- public API: prep pack ---------------------------------------------------------

/**
 * Render the full printable prep pack. Sections appear only when their input
 * is present and non-empty, separated by page breaks for A4 printing.
 */
export function renderPrepPackMarkdown(input: PrepPackInput): string {
    const tags = input.tagsFile ?? loadDefaultTags();
    const blocks: string[] = [renderHeader(input.header)];

    const plans = present(input.plans);
    if (plans !== undefined) blocks.push(renderPlans(plans, tags));
    if (input.planTree !== undefined) blocks.push(renderRepertoire(input.planTree, tags));
    const banPages = present(input.banPages);
    if (banPages !== undefined) blocks.push(renderBanPages(banPages, tags));
    const poolGrids = present(input.poolGrids);
    if (poolGrids !== undefined) blocks.push(renderPoolGrids(poolGrids, tags));
    const tendencies = present(input.tendencies);
    if (tendencies !== undefined) blocks.push(renderTendencies(tendencies, tags));
    const ranges = present(input.ranges);
    if (ranges !== undefined) blocks.push(renderRanges(ranges, tags));
    if (input.winConditions !== undefined) blocks.push(renderWinConditions(input.winConditions));
    const budget = present(input.seriesBudget);
    if (budget !== undefined) blocks.push(renderSeriesBudget(budget, tags));
    const notes = present(input.notesFr);
    if (notes !== undefined) blocks.push(renderNotes(notes));

    return blocks.join(PAGE_BREAK) + '\n';
}

// ---- public API: re-plan sheet -------------------------------------------------------

export interface RePlanInput {
    /** Upcoming game number (the sheet preps THIS game). */
    gameNumber: number;
    /** Series score before the upcoming game (ally first). */
    score?: { ally: number; enemy: number };
    /** Injected display timestamp. */
    generatedAt: string;
    /** Remaining pools, re-ranked by the caller. */
    pools?: PoolGridPlayer[];
    /** Recomputed ban candidates for the upcoming game. */
    bans?: BanPageEntry[];
    /** I4 pool-integrity gauges for both teams. */
    integrity?: { ally: PoolIntegrityResult; enemy: PoolIntegrityResult };
    notesFr?: string[];
    tagsFile?: ChampionTagsFile;
}

function renderIntegrityLine(labelFr: string, result: PoolIntegrityResult): string {
    const roles = result.byRole
        .map((entry) => {
            let cell = `${ROLE_LABELS_FR[entry.role]} ${entry.remaining}`;
            if (entry.role === result.bottleneckRole) cell += ' (goulot)';
            if (entry.belowMinimum) cell += ' (sous min)';
            return cell;
        })
        .join(', ');
    return `- ${labelFr} : ${pct(result.integrity)} (${result.samples} tirages) — rôles : ${roles}`;
}

/**
 * Render the ONE-PAGE between-games re-plan sheet (the 45-90 s Fearless
 * moment): remaining pools re-ranked, recomputed bans, both pools' integrity.
 * No page break inside — it must stay a single A4 page.
 */
export function renderRePlanSheet(input: RePlanInput): string {
    const tags = input.tagsFile ?? loadDefaultTags();
    const score = input.score !== undefined ? ` (score ${input.score.ally}-${input.score.enemy})` : '';
    const blocks: string[] = [
        `# Re-plan — Game ${input.gameNumber}${score}`,
        `Généré le ${input.generatedAt} — ${BADGE_FR}`
    ];

    if (input.integrity !== undefined) {
        blocks.push(
            [
                '## Intégrité des pools',
                [
                    renderIntegrityLine('Allié', input.integrity.ally),
                    renderIntegrityLine('Adverse', input.integrity.enemy)
                ].join('\n')
            ].join('\n\n')
        );
    }

    const bans = present(input.bans);
    if (bans !== undefined) {
        const table = mdTable(
            ['Champion', 'Justification'],
            bans.map((entry) => [nameOf(entry.championKey, tags), entry.rationaleFr.join(' ; ')])
        );
        blocks.push(['## Bans recalculés', table].join('\n\n'));
    }

    const pools = present(input.pools);
    if (pools !== undefined) {
        blocks.push(['## Pools restants (re-rankés)', ...pools.map((player) => renderPoolGrid(player, tags))].join('\n\n'));
    }

    const notes = present(input.notesFr);
    if (notes !== undefined) blocks.push(renderNotes(notes));

    return blocks.join('\n\n') + '\n';
}

// ---- public API: CSV exports ----------------------------------------------------------

/** RFC 4180 field: quote when needed, double embedded quotes. */
function csvField(raw: string | number): string {
    const text = String(raw);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csvRow = (cells: (string | number)[]): string => cells.map(csvField).join(',');

const CRLF = '\r\n';

/**
 * Tendency blocks as an RFC 4180 CSV (Sheets-ready): one row per prediction
 * with its context label, resolved name, probability and raw evidence.
 */
export function exportTendenciesCsv(blocks: TendencyBlock[], tagsFile?: ChampionTagsFile): string {
    const tags = tagsFile ?? loadDefaultTags();
    const rows = [csvRow(['contexte', 'champion', 'cle', 'probabilite', 'compte_brut', 'total', 'evidence'])];
    for (const block of blocks) {
        for (const prediction of block.predictions) {
            rows.push(
                csvRow([
                    block.contextLabel,
                    nameOf(prediction.championKey, tags),
                    prediction.championKey,
                    prediction.p.toFixed(4),
                    prediction.rawCount,
                    prediction.total,
                    evidenceString(prediction)
                ])
            );
        }
    }
    return rows.join(CRLF) + CRLF;
}

/** Pool grids as an RFC 4180 CSV: one row per (player, champion) entry. */
export function exportPoolGridCsv(players: PoolGridPlayer[], tagsFile?: ChampionTagsFile): string {
    const tags = tagsFile ?? loadDefaultTags();
    const rows = [csvRow(['joueur', 'role', 'champion', 'cle', 'tier', 'games'])];
    for (const player of players) {
        for (const entry of player.entries) {
            rows.push(
                csvRow([
                    player.playerName,
                    player.roleLabel ?? '',
                    nameOf(entry.championKey, tags),
                    entry.championKey,
                    entry.tier,
                    entry.games
                ])
            );
        }
    }
    return rows.join(CRLF) + CRLF;
}
