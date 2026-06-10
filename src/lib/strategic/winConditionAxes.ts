/**
 * I3 — Win-condition axes CONFIG (data-driven, DA-V2-6).
 *
 * Everything tunable about the bilateral win-condition graph lives here, NOT
 * in the engine: per-axis weights and thresholds, the FR narrative fragments,
 * the observable in-game triggers and the mapping of each axis onto the 12
 * existing risk-marker ids. The R3 calibration harness can re-fit any number
 * in this file without touching `winConditionGraph.ts`.
 *
 * Weight scale convention: one champion contributes O(1) point per axis lens,
 * and the engine projects raw counts to a full-comp scale (×5/n), so scores
 * across axes are directly comparable; `planMinScore`/`statementMinScore`
 * are expressed on that same scale.
 *
 * Collision narratives are compositional by default (ally lever sentence +
 * enemy lever sentence = ~2 concrete coach sentences for every one of the
 * 8×8 cells); `collisionOverridesFr` holds bespoke text for the most
 * archetypal cells, keyed by `collisionCellKey(allyAxisId, enemyAxisId)`.
 */
import type { RiskMarkerId } from '$lib/strategic/riskMarkerDetector';

/** The 8 bilateral conflict axes, in canonical display order (§6 bis I3). */
export const WIN_CONDITION_AXIS_IDS = [
    'engage-vs-disengage',
    'dive-vs-peel',
    'poke-vs-engage',
    'split-vs-crossmap',
    'scaling-differential',
    'snowball-weakside',
    'objective-control',
    'pick-vs-grouped'
] as const;

export type WinConditionAxisId = (typeof WIN_CONDITION_AXIS_IDS)[number];

/** FR narrative material attached to one axis (levers, triggers, risk map). */
export interface AxisNarrative {
    labelFr: string;
    /** One coach sentence when this axis is OUR primary lever. */
    allyLeverFr: string;
    /** One coach sentence when this axis is THEIR primary lever. */
    enemyLeverFr: string;
    /** Observable in-game switch conditions when we own the axis. */
    triggersAlly: string[];
    /** Observable in-game switch conditions when they own the axis. */
    triggersEnemy: string[];
    /** Existing risk-marker ids to watch when this axis is OUR lever. */
    riskWhenAlly: RiskMarkerId[];
    /** Existing risk-marker ids to watch when this axis is THEIR lever. */
    riskWhenEnemy: RiskMarkerId[];
}

export interface WinConditionAxesConfig {
    /**
     * γ — attenuation of counter tools in clash axes. Counters dampen a
     * threat (max(0, threat − γ·counter)), they never reverse it.
     */
    counterWeight: number;
    /** An axis joins a side's plan when |score| reaches this. */
    planMinScore: number;
    /** Plans keep at most this many axes. */
    planTopK: number;
    /** Falsifiable statements are emitted when |score| reaches this. */
    statementMinScore: number;
    /** Minute boundaries used in statement wording (power-curve buckets). */
    earlyGameMinute: number;
    lateGameMinute: number;
    /** Axis 1 — engage tools vs disengage tools. */
    engage: { hardAoe: number; softSingle: number; peel: number; knockback: number };
    /** Axis 2 — divers (high mobility + engage) vs carry peel. */
    dive: { hardAoeDiver: number; softSingleDiver: number; peel: number; knockback: number };
    /** Axis 3 — long-range poke (+ siege signatures) vs hard-AoE punish. */
    poke: { rangedLong: number; siegeHint: number; hardAoeCounter: number };
    /**
     * Axis 4 — split pressure (classifier share is a 0..1 VIEW reused as-is,
     * DA-V2-13; hints/mobility are structural markers) vs waveclear + tempo.
     */
    split: { classifierShare: number; splitHint: number; meleeHighMobility: number; waveclear: number; earlyTempo: number };
    /**
     * Axis 5 — scaling windows (late − early; hyper bonus applies to late
     * scalers only) refined by the observed power curve when a dataset is
     * provided and both comps are full.
     */
    scaling: { lateWindow: number; earlyWindow: number; lateHyperCarryBonus: number; datasetEdgeWeight: number };
    /** Axis 6 — early scalers on top/bot (+ jungle), amplified vs a late opponent in lane. */
    snowball: { earlyLane: number; lateOppositionBonus: number; earlyJungle: number };
    /** Axis 7 — objective profile: zone control (poke range) + forced-fight power (hard AoE). */
    objectives: { rangedLong: number; siegeHint: number; hardAoe: number };
    /** Axis 8 — pick threat (soft-single catch, mobility reach) vs grouped safety. */
    pick: { softSingle: number; highMobilityBonus: number; peel: number; knockback: number };
    narratives: Record<WinConditionAxisId, AxisNarrative>;
    /** Bespoke ~2-sentence narratives for archetypal collision cells. */
    collisionOverridesFr: Record<string, string>;
}

/** Key of one collision cell in `collisionOverridesFr`. */
export function collisionCellKey(allyAxisId: WinConditionAxisId, enemyAxisId: WinConditionAxisId): string {
    return `${allyAxisId}|${enemyAxisId}`;
}

export const DEFAULT_WIN_CONDITION_CONFIG: WinConditionAxesConfig = {
    counterWeight: 0.6,
    planMinScore: 0.25,
    planTopK: 3,
    statementMinScore: 1,
    earlyGameMinute: 15,
    lateGameMinute: 35,
    engage: { hardAoe: 2, softSingle: 1, peel: 1, knockback: 1 },
    dive: { hardAoeDiver: 2.5, softSingleDiver: 1.75, peel: 1, knockback: 0.5 },
    poke: { rangedLong: 1, siegeHint: 0.5, hardAoeCounter: 1 },
    split: { classifierShare: 3, splitHint: 1, meleeHighMobility: 0.5, waveclear: 1, earlyTempo: 0.5 },
    scaling: { lateWindow: 1, earlyWindow: 1, lateHyperCarryBonus: 0.5, datasetEdgeWeight: 10 },
    snowball: { earlyLane: 1.5, lateOppositionBonus: 0.5, earlyJungle: 0.75 },
    objectives: { rangedLong: 1, siegeHint: 0.5, hardAoe: 1 },
    pick: { softSingle: 1, highMobilityBonus: 0.5, peel: 1, knockback: 0.5 },
    narratives: {
        'engage-vs-disengage': {
            labelFr: 'Engage ↔ Désengage',
            allyLeverFr:
                "Votre levier : forcer le 5v5 — votre engage domine dès que l'adversaire groupe sans sort de désengage disponible.",
            enemyLeverFr:
                "Leur levier : l'engage — chaque regroupement sans désengage disponible de votre côté est une fenêtre de fight pour eux.",
            triggersAlly: [
                'Sort de désengage adverse utilisé ou en cooldown',
                'Adversaires groupés à 5 dans une zone fermée (pit, jungle)'
            ],
            triggersEnemy: [
                'Votre sort de désengage clé utilisé ou en cooldown',
                "Regroupement forcé autour d'un objectif sans tempo pour reculer"
            ],
            riskWhenAlly: ['no-frontline', 'no-engage-tool'],
            riskWhenEnemy: ['no-disengage-vs-engage']
        },
        'dive-vs-peel': {
            labelFr: 'Dive ↔ Peel',
            allyLeverFr:
                'Votre levier : la plongée backline — chaque assaut force leurs carries à brûler leurs sorts défensifs.',
            enemyLeverFr:
                'Leur levier : la plongée sur vos carries — peel discipliné et positions reculées obligatoires tant que leurs outils de dive sont disponibles.',
            triggersAlly: [
                'Carry adverse isolé de son peel',
                'Sorts défensifs adverses (shields, heal, exhaust) brûlés'
            ],
            triggersEnemy: [
                'Peel allié en cooldown (sorts défensifs brûlés)',
                'Carry allié exposé hors de portée du peel'
            ],
            riskWhenAlly: ['no-frontline'],
            riskWhenEnemy: ['no-disengage-vs-engage', 'no-frontline']
        },
        'poke-vs-engage': {
            labelFr: 'Poke ↔ Engage-sustain',
            allyLeverFr:
                'Votre levier : le poke — grignoter les PV avant chaque objectif pour interdire le combat frontal.',
            enemyLeverFr:
                "Leur levier : le poke — interdisez les sièges gratuits en menaçant l'engage sur chaque skillshot raté.",
            triggersAlly: [
                "Adversaires sous ~70% PV avant le spawn d'un objectif",
                "Siège de tourelle sans menace d'engage adverse"
            ],
            triggersEnemy: [
                'Votre équipe sous ~70% PV avant un objectif',
                "Siège adverse sans fenêtre d'engage de votre côté"
            ],
            riskWhenAlly: ['no-disengage-vs-engage'],
            riskWhenEnemy: ['no-engage-tool']
        },
        'split-vs-crossmap': {
            labelFr: 'Split ↔ Cross-map',
            allyLeverFr:
                'Votre levier : la pression de side — étirer la carte en 1-3-1 et punir cross-map chaque rotation adverse.',
            enemyLeverFr:
                'Leur levier : le split — gardez le waveclear en face et échangez cross-map plutôt que de courir après le side-laner.',
            triggersAlly: [
                'Side-laner adverse mort ou en base (fenêtre de push)',
                'Rotation adverse à 4-5 sur votre side-laner'
            ],
            triggersEnemy: [
                'Side-laner adverse au-delà de la première tourelle',
                'Mid poussé sans réponse cross-map disponible'
            ],
            riskWhenAlly: ['split-without-waveclear', 'difficult-lane-matchup'],
            riskWhenEnemy: ['difficult-lane-matchup']
        },
        'scaling-differential': {
            labelFr: 'Différentiel de scaling',
            allyLeverFr:
                "Votre levier : le temps — chaque minute sans casse rapproche vos carries de leur pic d'objets.",
            enemyLeverFr:
                "Leur levier : le scaling — chaque partie qui s'allonge penche vers eux, il faut convertir votre avance avant leur pic.",
            triggersAlly: [
                'Égalité ou avance de golds après 25 min',
                '2-3 objets complétés sur vos carries'
            ],
            triggersEnemy: [
                'La partie passe 25-30 min sans avance nette',
                'Leurs carries atteignent 2-3 objets complétés'
            ],
            riskWhenAlly: ['homogeneous-scaling', 'no-frontline'],
            riskWhenEnemy: ['homogeneous-scaling']
        },
        'snowball-weakside': {
            labelFr: 'Snowball / Weak-side',
            allyLeverFr:
                "Votre levier : le snowball early — vos lanes fortes (top/bot) doivent créer l'écart avant le mid game.",
            enemyLeverFr:
                'Leur levier : le snowball early — protégez votre weak side dans les 15 premières minutes, leurs lanes fortes sont leur moteur.',
            triggersAlly: [
                'First blood ou premier Herald converti en plates',
                'Avance de 1000+ golds à 10 min'
            ],
            triggersEnemy: [
                'Retard de golds à 10 min',
                'Première tourelle perdue tôt côté weak side'
            ],
            riskWhenAlly: ['homogeneous-scaling'],
            riskWhenEnemy: ['difficult-lane-matchup']
        },
        'objective-control': {
            labelFr: "Profil d'objectifs",
            allyLeverFr:
                'Votre levier : les objectifs — votre profil contrôle la zone autour des dragons et du Nashor (poke long ou fight AoE).',
            enemyLeverFr:
                "Leur levier : les objectifs — arrivez en premier sur la zone avec la vision, ou cédez l'objectif plutôt qu'un 5v5 perdant.",
            triggersAlly: [
                "Contrôle de vision posé 60s avant le spawn de l'objectif",
                'Priorité botlane/midlane au spawn du dragon'
            ],
            triggersEnemy: [
                "Vision adverse installée autour de l'objectif avant vous",
                'Perte de priorité botlane avant un dragon'
            ],
            riskWhenAlly: ['no-engage-tool'],
            riskWhenEnemy: ['no-engage-tool']
        },
        'pick-vs-grouped': {
            labelFr: 'Menace de pick ↔ Sécurité groupée',
            allyLeverFr:
                'Votre levier : le pick — une cible isolée attrapée se convertit en objectif gratuit derrière.',
            enemyLeverFr:
                'Leur levier : le pick — déplacements à deux minimum et vision profonde tant que leurs outils de catch sont disponibles.',
            triggersAlly: [
                'Cible adverse isolée dans le brouillard',
                'Vision adverse nettoyée (sweep réussi) avant un setup'
            ],
            triggersEnemy: [
                'Allié isolé face à leur outil de catch',
                'Votre vision profonde expirée avant un objectif'
            ],
            riskWhenAlly: ['no-disengage-vs-engage'],
            riskWhenEnemy: ['low-mobility-vs-pick']
        }
    },
    collisionOverridesFr: {
        'scaling-differential|dive-vs-peel':
            'Vous gagnez le front-to-back si vos carries survivent à leur plongée : chaque teamfight propre après 30 min penche vers vous. ' +
            'Eux gagnent en cassant la partie avant — attendez-vous à des dives répétées sur votre backline dès le mid game.',
        'snowball-weakside|scaling-differential':
            "Course contre la montre : vos lanes fortes doivent convertir l'early en tourelles et objectifs avant que leurs carries n'atteignent leurs objets. " +
            'Chaque minute au-delà de 30 sans avance nette joue contre vous.',
        'poke-vs-engage|engage-vs-disengage':
            'Guerre de position : votre poke doit saigner leur frontline avant chaque objectif, sans jamais offrir ' +
            "l'angle d'engage. Eux gagnent sur un seul flanc réussi — gardez les sorts de désengage pour leur initiation.",
        'pick-vs-grouped|engage-vs-disengage':
            "Votre catch contre leur 5v5 : une cible attrapée avant l'objectif et le combat ne se joue jamais. " +
            "S'ils initient à 5 en premier, le fight est pour eux — restez introuvables jusqu'au pick."
    }
};
