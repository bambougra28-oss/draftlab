/**
 * R1 — bridge from scraped gol.gg drafts (ProTeam.recentDrafts) to the
 * normalized DraftRecord schema.
 *
 * Two structural limits of the source, surfaced as warnings rather than
 * hidden:
 *  - the team-draft page only exposes the scraped team's own picks/bans
 *    (RecentDraft mirrors that), so records are ONE-SIDED — the opponent's
 *    columns are empty and produce the standard "missing <side> pick"
 *    warnings from buildDraftActions;
 *  - per-team action order is exact but the global interleave is rebuilt
 *    from the blue-first template, so records carry
 *    `orderConfidence: 'assumed-blue-first'` (gol.gg page-game pages expose
 *    true order; the divergence detector is the cross-check), plus the
 *    standard first-selection-era warning for 2026+ games.
 *
 * RecentDraft stores resolved champion KEYS; DraftAction wants the raw
 * display name for diagnostics, so keys round-trip through the bundled tag
 * file (key → display name → resolveChampionKey → same key).
 */
import type { DraftRecord, DraftSide, TeamDraftColumns } from '$lib/data/types';
import { buildDraftActions, inFirstSelectionEra } from '$lib/data/draftRecord';
import { resolveChampionKey } from '$lib/data/normalize';
import { loadDefaultTags } from '$lib/tags';
import type { ProTeam, RecentDraft } from '$lib/pro/types';

export const GOLGG_SOURCE = 'golgg';

export interface GolggBridgeOptions {
    /** Provenance timestamp (ISO). Injectable; system clock only at the edge. */
    fetchedAt?: string;
}

function displayName(championKey: string): string {
    return loadDefaultTags().champions[championKey]?.name ?? championKey;
}

const EMPTY_COLUMNS: TeamDraftColumns = {
    bans: [undefined, undefined, undefined, undefined, undefined],
    picks: [undefined, undefined, undefined, undefined, undefined]
};

/** Convert one scraped draft into a (one-sided) DraftRecord. */
export function recentDraftToDraftRecord(
    team: ProTeam,
    draft: RecentDraft,
    fetchedAt: string
): DraftRecord {
    const ourColumns: TeamDraftColumns = {
        bans: draft.bans.map((b) => displayName(b.championKey)),
        picks: draft.picks.map((p) => displayName(p.championKey)),
        roles: draft.picks.map((p) => p.role)
    };

    const { actions, warnings } = buildDraftActions({
        blue: draft.side === 'blue' ? ourColumns : EMPTY_COLUMNS,
        red: draft.side === 'red' ? ourColumns : EMPTY_COLUMNS,
        firstPickSide: 'blue',
        resolveKey: resolveChampionKey
    });
    warnings.unshift('golgg: one-sided record (source only lists the scraped team\'s actions)');
    if (inFirstSelectionEra(draft.playedAt)) {
        warnings.push('first-selection era: pick order assumed blue-first, cross-check pending');
    }

    const enemySide: DraftSide = draft.side === 'blue' ? 'red' : 'blue';
    const opponent = draft.opponent ?? '';

    const record: DraftRecord = {
        gameId: draft.gameId,
        blueTeam: draft.side === 'blue' ? team.name : opponent,
        redTeam: draft.side === 'red' ? team.name : opponent,
        firstPickSide: 'blue',
        orderConfidence: 'assumed-blue-first',
        actions,
        warnings,
        provenance: { source: GOLGG_SOURCE, fetchedAt }
    };
    if (draft.result === 'W') record.winner = draft.side;
    else if (draft.result === 'L') record.winner = enemySide;
    if (draft.playedAt !== undefined) record.date = draft.playedAt;
    if (team.league !== '') record.league = team.league;
    if (team.tournament !== undefined) record.tournament = team.tournament;
    return record;
}

/** Convert every scraped draft of a team, in page order (most recent first). */
export function recentDraftsToDraftRecords(
    team: ProTeam,
    opts: GolggBridgeOptions = {}
): DraftRecord[] {
    const fetchedAt = opts.fetchedAt ?? new Date().toISOString();
    return team.recentDrafts.map((draft) => recentDraftToDraftRecord(team, draft, fetchedAt));
}
