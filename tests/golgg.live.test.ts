/**
 * Live smoke against the real gol.gg, env-gated (DRAFTLAB_LIVE=1).
 *
 * Uses directTransport (gol.gg blocks datacenter IPs — run this from a
 * residential connection only, never CI). Assertions are structural and
 * tolerant of value drift: rosters, pools and standings move every week.
 */
import { describe, it, expect } from 'vitest';
import { directTransport, fetchTeam, fetchTeamList } from '$lib/pro/golgg';

const live = process.env.DRAFTLAB_LIVE === '1';

describe.skipIf(!live)('golgg live', () => {
    it('fetches the S16 team list (structural smoke)', async () => {
        const { teams, warnings } = await fetchTeamList({ transport: directTransport });
        expect(warnings).toEqual([]);
        expect(teams.length).toBeGreaterThan(50);
        expect(teams.every((t) => /^\d+$/.test(t.id) && t.name.length > 0)).toBe(true);
        expect(teams.some((t) => t.region === 'KR')).toBe(true);
    }, 60_000);

    it('scrapes ZYB Esport (2924) end to end, best-effort contract holds', async () => {
        const team = await fetchTeam('2924', { transport: directTransport, league: 'lfl' });

        expect(team.id).toBe('2924');
        expect(team.name.length).toBeGreaterThan(0);
        // Mains roster: gol.gg renders one row per role; tolerate sub shuffles.
        expect(team.players.length).toBeGreaterThanOrEqual(4);
        expect(team.players.length).toBeLessThanOrEqual(8);
        expect(team.sideStats.blue.games + team.sideStats.red.games).toBeGreaterThan(0);
        expect(team.recentDrafts.length).toBeGreaterThan(0);
        // Drafts carry ≤5 picks/bans each, keys resolved.
        for (const draft of team.recentDrafts) {
            expect(draft.picks.length).toBeLessThanOrEqual(5);
            expect(draft.bans.length).toBeLessThanOrEqual(5);
            expect(draft.picks.every((p) => /^\d+$/.test(p.championKey))).toBe(true);
        }
        // M3.1 acceptance: most drafts should be dated via the matchlists.
        const dated = team.recentDrafts.filter((d) => d.playedAt !== undefined).length;
        expect(dated / team.recentDrafts.length).toBeGreaterThanOrEqual(0.5);
        // The contract: either clean, or incomplete with explanatory warnings.
        if (team.incomplete) {
            expect(team.warnings.length).toBeGreaterThan(0);
        }
    }, 120_000);
});
