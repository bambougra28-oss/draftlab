import { describe, it, expect } from 'vitest';
import { analyzeDraft, blendedPriorWinrate } from '$lib/engine/analyzer';
import { buildMockDataset, makeTeam } from '$lib/dataset/mock';
import { Role, type AnalyzeDraftConfig, type PlayerContext } from '$lib/types';
import {
    COMFORT_STORAGE_KEY,
    clearComfortTags,
    getComfortTag,
    readComfortTags,
    setComfortTag,
    subscribeComfort
} from '$lib/comfort';

// Closed-form targets from M2 Ping 2 (baseline 0.51).
describe('comfort — blendedPriorWinrate (closed form)', () => {
    const B = 0.51;

    it('comfort 1g @ 100% → 511/1001', () => {
        expect(blendedPriorWinrate(B, { playerStats: { games: 1, winrate: 1 }, comfortMode: 'comfort' })).toBeCloseTo(511 / 1001, 9);
    });

    it('comfort 50g @ 60% → 540/1050', () => {
        expect(blendedPriorWinrate(B, { playerStats: { games: 50, winrate: 0.6 }, comfortMode: 'comfort' })).toBeCloseTo(540 / 1050, 9);
    });

    it('comfort 200g @ 60% → 0.525', () => {
        expect(blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'comfort' })).toBeCloseTo(0.525, 9);
    });

    it('cheese 200g @ 60% → 570/1100 (attenuated)', () => {
        expect(blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'cheese' })).toBeCloseTo(570 / 1100, 9);
    });

    it('"none" mode behaves exactly like "comfort"', () => {
        const none = blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'none' });
        const comfort = blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'comfort' });
        expect(none).toBeCloseTo(comfort, 12);
    });

    it('unavailable falls back to the baseline', () => {
        expect(blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'unavailable' })).toBe(B);
    });

    it('null player stats fall back to the baseline', () => {
        expect(blendedPriorWinrate(B, { playerStats: null, comfortMode: 'comfort' })).toBe(B);
    });

    it('zero games falls back to the baseline', () => {
        expect(blendedPriorWinrate(B, { playerStats: { games: 0, winrate: 1 }, comfortMode: 'comfort' })).toBe(B);
    });

    it('no slot at all falls back to the baseline', () => {
        expect(blendedPriorWinrate(B, undefined)).toBe(B);
    });

    it('honours a defaultPriorGames override', () => {
        // (200*0.6 + 500*0.51) / 700
        expect(
            blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'comfort' }, { defaultPriorGames: 500 })
        ).toBeCloseTo(375 / 700, 9);
    });

    it('honours a cheeseAttenuationFactor override', () => {
        // effGames 140 → (140*0.6 + 1000*0.51) / 1140
        expect(
            blendedPriorWinrate(B, { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'cheese' }, { cheeseAttenuationFactor: 0.7 })
        ).toBeCloseTo(594 / 1140, 9);
    });
});

describe('comfort — integration through analyzeDraft', () => {
    const dataset = buildMockDataset([
        { key: '1', roles: { [Role.Top]: { wins: 500, games: 1000 } } },
        { key: '2', roles: { [Role.Jungle]: { wins: 500, games: 1000 } } },
        { key: '3', roles: { [Role.Middle]: { wins: 500, games: 1000 } } },
        { key: '4', roles: { [Role.Bottom]: { wins: 500, games: 1000 } } },
        { key: '5', roles: { [Role.Support]: { wins: 500, games: 1000 } } }
    ]);
    const team = makeTeam([
        [Role.Top, '1'],
        [Role.Jungle, '2'],
        [Role.Middle, '3'],
        [Role.Bottom, '4'],
        [Role.Support, '5']
    ]);
    const base: AnalyzeDraftConfig = { ignoreChampionWinrates: false, riskLevel: 'medium', minGames: 0 };

    it('a comfort signal on an ally lifts the winrate above the mirror baseline', () => {
        const playerContext: PlayerContext = {
            [Role.Top]: { playerStats: { games: 200, winrate: 0.6 }, comfortMode: 'comfort' }
        };
        const lifted = analyzeDraft(dataset, team, team, { ...base, playerContext }).winrate;
        expect(lifted).toBeGreaterThan(0.5);
    });

    it('an all-empty context collapses to the M1 path (no regression)', () => {
        const emptyContext: PlayerContext = {
            [Role.Top]: { playerStats: null, comfortMode: 'none' },
            [Role.Jungle]: { playerStats: null, comfortMode: 'none' },
            [Role.Middle]: { playerStats: null, comfortMode: 'none' },
            [Role.Bottom]: { playerStats: null, comfortMode: 'none' },
            [Role.Support]: { playerStats: null, comfortMode: 'none' }
        };
        const withEmpty = analyzeDraft(dataset, team, team, { ...base, playerContext: emptyContext }).winrate;
        const without = analyzeDraft(dataset, team, team, base).winrate;
        expect(withEmpty).toBeCloseTo(without, 12);
        expect(without).toBeCloseTo(0.5, 10);
    });
});

// ---- src/lib/comfort.ts — localStorage-backed comfort tag store ----

/** Minimal in-memory Storage so the store logic runs in Node. */
function fakeStorage(initial: Record<string, string> = {}): Storage {
    const map = new Map<string, string>(Object.entries(initial));
    return {
        get length() {
            return map.size;
        },
        clear: () => map.clear(),
        getItem: (key: string) => map.get(key) ?? null,
        key: (index: number) => [...map.keys()][index] ?? null,
        removeItem: (key: string) => {
            map.delete(key);
        },
        setItem: (key: string, value: string) => {
            map.set(key, value);
        }
    };
}

describe('comfort store — defaults (no override)', () => {
    it('returns "none" without an override or pool signal', () => {
        expect(getComfortTag('157', { storage: fakeStorage() })).toBe('none');
    });

    it('derives the default from pool size via POOL_COMFORT_THRESHOLDS', () => {
        const storage = fakeStorage();
        // Thresholds from $lib/pro/comfortDefaults: comfort=5, cheese=1.
        expect(getComfortTag('157', { storage, poolGames: 5 })).toBe('comfort'); // 5 ≥ 5
        expect(getComfortTag('157', { storage, poolGames: 4 })).toBe('cheese'); // 1 ≤ 4 < 5
        expect(getComfortTag('157', { storage, poolGames: 1 })).toBe('cheese'); // lower cheese bound
        expect(getComfortTag('157', { storage, poolGames: 0 })).toBe('unavailable'); // 0 < 1
    });
});

describe('comfort store — overrides + persistence', () => {
    it('round-trips an override and lets it win over the pool default', () => {
        const storage = fakeStorage();
        setComfortTag('157', 'cheese', storage);
        // Pool says comfort (10g ≥ 5) but the explicit override wins.
        expect(getComfortTag('157', { storage, poolGames: 10 })).toBe('cheese');
        // Persisted shape: one JSON map under the single storage key.
        expect(storage.getItem(COMFORT_STORAGE_KEY)).toBe('{"157":"cheese"}');
    });

    it('setting "none" clears the override and restores the default path', () => {
        const storage = fakeStorage();
        setComfortTag('157', 'unavailable', storage);
        setComfortTag('157', 'none', storage);
        expect(readComfortTags(storage)).toEqual({});
        expect(getComfortTag('157', { storage, poolGames: 10 })).toBe('comfort');
    });

    it('keeps independent champions side by side', () => {
        const storage = fakeStorage();
        setComfortTag('157', 'comfort', storage);
        setComfortTag('103', 'unavailable', storage);
        expect(readComfortTags(storage)).toEqual({ '157': 'comfort', '103': 'unavailable' });
    });

    it('clearComfortTags drops every override', () => {
        const storage = fakeStorage();
        setComfortTag('157', 'comfort', storage);
        clearComfortTags(storage);
        expect(readComfortTags(storage)).toEqual({});
    });
});

describe('comfort store — robustness', () => {
    it('ignores corrupt JSON and unknown stored values', () => {
        expect(readComfortTags(fakeStorage({ [COMFORT_STORAGE_KEY]: 'not json{{' }))).toEqual({});
        // 'banana' is not a storable mode; '103' keeps its valid entry.
        const mixed = fakeStorage({
            [COMFORT_STORAGE_KEY]: '{"157":"banana","103":"cheese"}'
        });
        expect(readComfortTags(mixed)).toEqual({ '103': 'cheese' });
        // 'none' is never persisted, so a stored 'none' is also dropped.
        expect(
            readComfortTags(fakeStorage({ [COMFORT_STORAGE_KEY]: '{"157":"none"}' }))
        ).toEqual({});
    });

    it('survives a quota-throwing storage and still notifies', () => {
        const broken = fakeStorage();
        broken.setItem = () => {
            throw new Error('QuotaExceededError');
        };
        const seen: string[] = [];
        const unsubscribe = subscribeComfort((key, mode) => seen.push(`${key}:${mode}`));
        setComfortTag('157', 'comfort', broken);
        unsubscribe();
        expect(seen).toEqual(['157:comfort']);
    });
});

describe('comfort store — subscriptions', () => {
    it('notifies subscribers on every write and stops after unsubscribe', () => {
        const storage = fakeStorage();
        const seen: [string, string][] = [];
        const unsubscribe = subscribeComfort((key, mode) => seen.push([key, mode]));

        setComfortTag('157', 'comfort', storage);
        setComfortTag('157', 'none', storage);
        expect(seen).toEqual([
            ['157', 'comfort'],
            ['157', 'none']
        ]);

        unsubscribe();
        setComfortTag('103', 'cheese', storage);
        expect(seen).toHaveLength(2); // no notification after unsubscribe
    });
});
