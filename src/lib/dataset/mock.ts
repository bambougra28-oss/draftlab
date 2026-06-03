/**
 * Mock dataset builder for unit tests.
 *
 * Lets a test describe just the champion-roles it cares about; every other
 * field is filled with empty defaults. Matchups/synergies are given as flat
 * lists and folded into the nested `matchup[role][key]` / `synergy[role][key]`
 * maps the analyzer expects.
 */
import {
    Role,
    defaultChampionRoleData,
    type ChampionData,
    type ChampionDamageProfile,
    type ChampionRoleData,
    type Dataset,
    type Stats,
    type Team
} from '$lib/types';

export interface MockPairStat {
    role: Role;
    key: string;
    wins: number;
    games: number;
}

export interface MockRoleStat {
    wins: number;
    games: number;
    matchups?: MockPairStat[];
    synergies?: MockPairStat[];
    statsByTime?: Stats[];
    damageProfile?: ChampionDamageProfile;
}

export interface MockChampion {
    key: string;
    name?: string;
    roles: Partial<Record<Role, MockRoleStat>>;
}

const ALL_ROLES = [Role.Top, Role.Jungle, Role.Middle, Role.Bottom, Role.Support] as const;

export function buildMockDataset(
    champions: MockChampion[],
    opts: { version?: string; date?: string } = {}
): Dataset {
    const championData: Record<string, ChampionData> = {};

    for (const champ of champions) {
        const statsByRole = {} as Record<Role, ChampionRoleData>;

        for (const role of ALL_ROLES) {
            const data = defaultChampionRoleData();
            const spec = champ.roles[role];
            if (spec) {
                data.wins = spec.wins;
                data.games = spec.games;
                if (spec.statsByTime) data.statsByTime = spec.statsByTime.map((s) => ({ ...s }));
                if (spec.damageProfile) data.damageProfile = { ...spec.damageProfile };
                for (const m of spec.matchups ?? []) {
                    data.matchup[m.role][m.key] = { wins: m.wins, games: m.games };
                }
                for (const s of spec.synergies ?? []) {
                    data.synergy[s.role][s.key] = { wins: s.wins, games: s.games };
                }
            }
            statsByRole[role] = data;
        }

        championData[champ.key] = {
            key: champ.key,
            name: champ.name ?? champ.key,
            statsByRole
        };
    }

    return {
        version: opts.version ?? 'mock-5',
        date: opts.date ?? '2026-01-01T00:00:00.000Z',
        championData
    };
}

/** Convenience: build a Team map from [role, key] pairs. */
export function makeTeam(pairs: [Role, string][]): Team {
    return new Map(pairs);
}
