import { describe, it, expect } from 'vitest';
import {
    exportPoolGridCsv,
    exportTendenciesCsv,
    renderPrepPackMarkdown,
    renderRePlanSheet,
    type PrepPackInput,
    type RePlanInput,
    type SeriesBudgetEntry
} from '$lib/exports/prepPack';
import type { DraftPlan } from '$lib/storage/draftPlans';
import type { PoolIntegrityResult } from '$lib/strategic/seriesSolver';
import type { WinConditionReport } from '$lib/strategic/winConditionGraph';
import { Role } from '$lib/types';

const PAGE_BREAK = '\n\n---\n\n';

// Real bundled tags resolve '157' → Yasuo and '103' → Ahri; 'zzz' is unknown
// on purpose to exercise the raw-key fallback.
const header = { title: 'Prep — vs KC', opponent: 'Karmine Corp', generatedAt: '2026-06-10 14:00' };

const planA: DraftPlan = {
    id: 'p1',
    name: 'Plan A — poke',
    side: 'blue',
    bans: [
        { championKey: '157', rationale: 'priorité' },
        { championKey: null },
        { championKey: null },
        { championKey: null },
        { championKey: null }
    ],
    picks: [
        { role: Role.Top, primary: '157', fallback: null, rationale: 'confort' },
        { role: Role.Jungle, primary: null, fallback: null },
        { role: Role.Middle, primary: null, fallback: '103' },
        { role: Role.Bottom, primary: null, fallback: null },
        { role: Role.Support, primary: null, fallback: null }
    ],
    applicableGames: [1, 3],
    notes: 'jouer safe',
    createdAt: 0,
    updatedAt: 0
};

const winConditions: WinConditionReport = {
    axes: [
        {
            id: 'engage-vs-disengage',
            labelFr: 'Engage contre désengage',
            score: 2.3,
            components: [
                { reason: 'Menace engage alliée', value: 3.1 },
                { reason: 'Menace adverse', value: -0.8 }
            ],
            confidence: 'high'
        }
    ],
    allyPlan: ['engage-vs-disengage'],
    enemyPlan: [],
    collision: {
        allyAxisId: 'engage-vs-disengage',
        enemyAxisId: 'scaling-differential',
        narrativeFr: 'Course au tempo.',
        triggers: ['fenêtre 5v5 avant 25 min'],
        riskMarkerIds: []
    },
    statements: [{ textFr: 'Conclure avant 25 min.', direction: 'early', falsifiableVia: 'gameLength' }]
};

const seriesBudget: SeriesBudgetEntry[] = [
    {
        championKey: '157',
        role: Role.Middle,
        // nowGain +0.015 → '+1.5 pp', futureLoss −0.03 → '-3.0 pp', net −0.015.
        retention: { championKey: '157', valueSpend: 0.62, valueSave: 0.635, nowGain: 0.015, futureLoss: -0.03, net: -0.015 },
        denial: { championKey: '157', perGame: [], total: 0.008 },
        verdictFr: 'Gardez pour la suite.'
    },
    {
        championKey: 'zzz',
        retention: { championKey: 'zzz', valueSpend: 0.6, valueSave: 0.58, nowGain: 0.02, futureLoss: 0, net: 0.02 },
        denial: null
    }
];

function fullInput(): PrepPackInput {
    return {
        header,
        plans: [planA],
        banPages: [{ rotationLabel: 'B1-B3', entries: [{ championKey: 'zzz', rationaleFr: ['raison A', 'raison B'] }] }],
        poolGrids: [
            {
                playerName: 'Faker',
                roleLabel: 'Mid',
                entries: [
                    { championKey: '157', tier: 'strongest', games: 24 },
                    { championKey: 'zzz', tier: 'learning', games: 2 }
                ]
            }
        ],
        tendencies: [
            {
                contextLabel: 'P1 — côté bleu',
                predictions: [{ championKey: '157', p: 0.31, count: 3.2, rawCount: 4, total: 6 }]
            }
        ],
        ranges: [
            {
                slotLabel: 'P1 (bleu)',
                entries: [
                    { championKey: '157', p: 0.31 },
                    { championKey: 'zzz', p: 0.22 }
                ]
            }
        ],
        winConditions,
        seriesBudget,
        notesFr: ['Attention au side select']
    };
}

describe('renderPrepPackMarkdown — header and structure', () => {
    it('always renders title, opponent, injected timestamp and the uncalibrated badge', () => {
        const out = renderPrepPackMarkdown({ header });
        expect(out).toContain('# Prep — vs KC');
        expect(out).toContain('Adversaire : Karmine Corp — généré le 2026-06-10 14:00');
        expect(out).toContain("> Non calibré — outil d'aide, pas oracle.");
    });

    it('renders no section and no page break when only the header is given', () => {
        const out = renderPrepPackMarkdown({ header });
        expect(out).not.toContain(PAGE_BREAK);
        expect(out).not.toContain('## ');
    });

    it('treats empty arrays as absent sections', () => {
        const out = renderPrepPackMarkdown({
            header,
            plans: [],
            banPages: [],
            poolGrids: [],
            tendencies: [],
            ranges: [],
            seriesBudget: [],
            notesFr: []
        });
        expect(out).toBe(renderPrepPackMarkdown({ header }));
    });

    it('separates the header and all 8 sections with exactly 8 page breaks', () => {
        const out = renderPrepPackMarkdown(fullInput());
        expect(out.split(PAGE_BREAK)).toHaveLength(9);
    });
});

describe('renderPrepPackMarkdown — sections', () => {
    const out = renderPrepPackMarkdown(fullInput());

    it('renders plans with side, games, resolved bans and the picks table', () => {
        expect(out).toContain('## Plans de draft');
        expect(out).toContain('### Plan A — poke (côté bleu — games 1, 3)');
        expect(out).toContain('Bans : Yasuo (priorité), —, —, —, —');
        expect(out).toContain('| Rôle | Principal | Repli | Justification |');
        expect(out).toContain('| Top | Yasuo | — | confort |');
        expect(out).toContain('| Mid | — | Ahri |  |');
        expect(out).toContain('Notes : jouer safe');
    });

    it('renders ban pages per rotation with the unknown key kept as fallback', () => {
        expect(out).toContain('## Pages de bans');
        expect(out).toContain('### B1-B3');
        expect(out).toContain('| zzz | raison A ; raison B |');
    });

    it('renders pool grids grouped by tier, silent on empty tiers', () => {
        expect(out).toContain('## Pools par joueur');
        expect(out).toContain('### Faker (Mid)');
        expect(out).toContain('- Maîtrisés : Yasuo (24 g)');
        expect(out).toContain('- En apprentissage : zzz (2 g)');
        expect(out).not.toContain('Prêts match');
    });

    it('renders tendencies with whole-percent probabilities and count evidence', () => {
        expect(out).toContain('### P1 — côté bleu');
        expect(out).toContain('| Yasuo | 31 % | 4 des 6 dernières |');
    });

    it('renders ranges as one compact line per slot', () => {
        expect(out).toContain('## Ranges par slot');
        expect(out).toContain('- P1 (bleu) : Yasuo 31 %, zzz 22 %');
    });

    it('renders win conditions as components + collision + triggers + statements', () => {
        expect(out).toContain('## Conditions de victoire');
        expect(out).toContain('- Engage contre désengage : +2.3 (confiance haute)');
        expect(out).toContain('  - Menace engage alliée → +3.1');
        expect(out).toContain('  - Menace adverse → -0.8');
        expect(out).toContain('Collision : Course au tempo.');
        expect(out).toContain('- fenêtre 5v5 avant 25 min');
        expect(out).toContain('- Conclure avant 25 min.');
    });

    it('renders the series budget with separated pp components and honest null denial', () => {
        expect(out).toContain('## Budget de série (Fearless)');
        expect(out).toContain('| Mid | Yasuo | +1.5 pp | -3.0 pp | -1.5 pp | +0.8 pp | Gardez pour la suite. |');
        expect(out).toContain('| — | zzz | +2.0 pp | +0.0 pp | +2.0 pp | non chiffré |  |');
        expect(out).toContain('composantes affichées séparément');
    });

    it('renders free notes as bullets', () => {
        expect(out).toContain('## Notes');
        expect(out).toContain('- Attention au side select');
    });

    it('escapes pipes inside table cells so rows never break', () => {
        const piped = renderPrepPackMarkdown({
            header,
            banPages: [{ rotationLabel: 'B1-B3', entries: [{ championKey: 'zzz', rationaleFr: ['avec | pipe'] }] }]
        });
        expect(piped).toContain('avec \\| pipe');
    });
});

describe('renderRePlanSheet — one page between games', () => {
    const integrityAlly: PoolIntegrityResult = {
        side: 'ally',
        integrity: 0.78,
        samples: 500,
        byRole: [
            { role: Role.Top, remaining: 4, failures: 0, belowMinimum: false },
            { role: Role.Jungle, remaining: 3, failures: 12, belowMinimum: false },
            { role: Role.Middle, remaining: 2, failures: 110, belowMinimum: false },
            { role: Role.Bottom, remaining: 5, failures: 0, belowMinimum: false },
            { role: Role.Support, remaining: 1, failures: 200, belowMinimum: true }
        ],
        bottleneckRole: Role.Middle
    };
    const integrityEnemy: PoolIntegrityResult = {
        side: 'enemy',
        integrity: 0.42,
        samples: 500,
        byRole: [
            { role: Role.Top, remaining: 1, failures: 290, belowMinimum: true },
            { role: Role.Jungle, remaining: 4, failures: 0, belowMinimum: false }
        ],
        bottleneckRole: Role.Top
    };

    const input: RePlanInput = {
        gameNumber: 3,
        score: { ally: 1, enemy: 1 },
        generatedAt: '2026-06-11 09:30',
        integrity: { ally: integrityAlly, enemy: integrityEnemy },
        bans: [{ championKey: '103', rationaleFr: ['sortie attendue P1'] }],
        pools: [{ playerName: 'Faker', roleLabel: 'Mid', entries: [{ championKey: '157', tier: 'strongest', games: 24 }] }],
        notesFr: ['Si Azir ouvert : le prendre']
    };
    const out = renderRePlanSheet(input);

    it('renders the game header with score, injected timestamp and badge', () => {
        expect(out).toContain('# Re-plan — Game 3 (score 1-1)');
        expect(out).toContain("Généré le 2026-06-11 09:30 — Non calibré — outil d'aide, pas oracle.");
    });

    it('renders both integrity gauges with bottleneck and below-minimum flags', () => {
        expect(out).toContain('## Intégrité des pools');
        expect(out).toContain(
            '- Allié : 78 % (500 tirages) — rôles : Top 4, Jungle 3, Mid 2 (goulot), ADC 5, Support 1 (sous min)'
        );
        expect(out).toContain('- Adverse : 42 % (500 tirages) — rôles : Top 1 (goulot) (sous min), Jungle 4');
    });

    it('renders recomputed bans and re-ranked remaining pools', () => {
        expect(out).toContain('## Bans recalculés');
        expect(out).toContain('| Ahri | sortie attendue P1 |');
        expect(out).toContain('## Pools restants (re-rankés)');
        expect(out).toContain('- Maîtrisés : Yasuo (24 g)');
        expect(out).toContain('- Si Azir ouvert : le prendre');
    });

    it('contains NO page break — it must stay a single A4 page', () => {
        expect(out).not.toContain(PAGE_BREAK);
    });

    it('omits the score and optional sections when absent', () => {
        const bare = renderRePlanSheet({ gameNumber: 2, generatedAt: 'x' });
        expect(bare).toContain('# Re-plan — Game 2\n');
        expect(bare).not.toContain('(score');
        expect(bare).not.toContain('## ');
    });
});

describe('CSV exports — RFC 4180', () => {
    it('exports tendencies with quoted commas and CRLF rows', () => {
        const out = exportTendenciesCsv([
            {
                contextLabel: 'P1, bleu',
                predictions: [{ championKey: '157', p: 0.3125, count: 3.2, rawCount: 4, total: 6 }]
            }
        ]);
        const lines = out.split('\r\n');
        expect(lines[0]).toBe('contexte,champion,cle,probabilite,compte_brut,total,evidence');
        // 'P1, bleu' contains a comma → quoted; p fixed to 4 decimals.
        expect(lines[1]).toBe('"P1, bleu",Yasuo,157,0.3125,4,6,4 des 6 dernières');
        expect(out.endsWith('\r\n')).toBe(true);
    });

    it('doubles embedded quotes', () => {
        const out = exportTendenciesCsv([
            {
                contextLabel: 'le "P1"',
                predictions: [{ championKey: 'zzz', p: 0.5, count: 1, rawCount: 1, total: 1 }]
            }
        ]);
        expect(out.split('\r\n')[1]).toBe('"le ""P1""",zzz,zzz,0.5000,1,1,1 de la dernière');
    });

    it('exports pool grids with quoting on player names and embedded newlines', () => {
        const out = exportPoolGridCsv([
            { playerName: 'Faker, "GOAT"', roleLabel: 'Mid', entries: [{ championKey: '157', tier: 'strongest', games: 24 }] },
            { playerName: 'a\nb', entries: [{ championKey: 'zzz', tier: 'learning', games: 1 }] }
        ]);
        expect(out).toContain('joueur,role,champion,cle,tier,games\r\n');
        expect(out).toContain('"Faker, ""GOAT""",Mid,Yasuo,157,strongest,24\r\n');
        // Missing role label → empty field; newline in name → quoted field.
        expect(out).toContain('"a\nb",,zzz,zzz,learning,1\r\n');
    });

    it('renders a header-only CSV for empty inputs', () => {
        expect(exportTendenciesCsv([])).toBe('contexte,champion,cle,probabilite,compte_brut,total,evidence\r\n');
        expect(exportPoolGridCsv([])).toBe('joueur,role,champion,cle,tier,games\r\n');
    });
});
