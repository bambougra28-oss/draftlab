/**
 * Live smoke against the real Leaguepedia Cargo API.
 *
 * Gated twice: DRAFTLAB_LIVE=1 to opt in at all, and anonymous rate limits
 * make unauthenticated runs flaky — set DRAFTLAB_LP_USER / DRAFTLAB_LP_PASS
 * (a free bot password from Special:BotPasswords) for a reliable run.
 * A rate-limited anonymous attempt is reported as skipped-equivalent, not red.
 */
import { describe, it, expect } from 'vitest';
import {
    buildCargoUrl,
    fetchDraftRecords,
    MwSession,
    CargoRateLimitError
} from '$lib/data/providers/leaguepediaCargo';

const live = process.env.DRAFTLAB_LIVE === '1';

describe.skipIf(!live)('leaguepedia live', () => {
    it('fetches and normalizes at least one 2026 LCK draft', async () => {
        const user = process.env.DRAFTLAB_LP_USER;
        const pass = process.env.DRAFTLAB_LP_PASS;
        const transport = user && pass
            ? (await MwSession.login({ username: user, password: pass })).transport
            : undefined;

        try {
            const records = await fetchDraftRecords(
                { where: "SG.OverviewPage LIKE 'LCK/2026%'", orderBy: 'SG.DateTime_UTC DESC' },
                { transport, maxPages: 1, pageDelayMs: 0 }
            );
            expect(records.length).toBeGreaterThan(0);
            const record = records[0];
            expect(record.blueTeam).not.toBe('');
            expect(record.actions.filter((a) => a.type === 'pick')).toHaveLength(10);
            expect(record.actions.every((a) => a.seq >= 1 && a.seq <= 20)).toBe(true);
            // 2026 game → the order-assumption warning must be present.
            expect(record.warnings.some((w) => w.includes('first-selection era'))).toBe(true);
            const unresolved = record.actions.filter((a) => a.championKey === '');
            expect(unresolved).toHaveLength(0);
        } catch (error) {
            if (error instanceof CargoRateLimitError && !transport) {
                console.warn('[live] anonymous rate limit hit — configure DRAFTLAB_LP_USER/PASS for a reliable run');
                return; // inconclusive, not a failure
            }
            throw error;
        }
    }, 60_000);

    it('builds a valid query url (sanity)', () => {
        expect(buildCargoUrl({ where: '1=1', limit: 1 })).toContain('action=cargoquery');
    });
});
