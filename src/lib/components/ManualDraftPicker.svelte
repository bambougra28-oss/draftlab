<!--
/**
 * M5.2 — Manual draft input: side toggle + 20-step order timeline + slots.
 *
 * The timeline mirrors the V1 capture ("Séquence du draft"): the tournament
 * order BB1…R5 with diamonds for bans and circles for picks, the phase-2 block
 * visually grouped, and a "Draft terminé." status once all 10 picks are in.
 * Picks are entered by ROLE (Top…Sup) per team — the manual flow doesn't know
 * the true pick order, so timeline completion is derived from per-team counts
 * (documented approximation; real ordered records come from the data layer).
 *
 * Champion choice goes through the pool-first ChampionPicker; champions
 * already picked/banned (plus `excludedKeys`, e.g. Fearless-consumed) are
 * disabled. Pure: all draft state lives in the route, changes go up via
 * `onPickChange` / `onBanChange` / `onAllySideChange`.
 */
-->
<script lang="ts">
    import { ROLES, type Role } from '$lib/types';
    import type { ChampionPoolEntry } from '$lib/pro/types';
    import { championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';
    import ChampionPicker from '$lib/components/ChampionPicker.svelte';
    import { ROLE_LABELS } from '$lib/components/ChampionSlot.svelte';

    interface Props {
        allySide?: 'blue' | 'red';
        /** Champion keys by role (0=Top … 4=Support); null = empty slot. */
        allyPicks: (string | null)[];
        enemyPicks: (string | null)[];
        allyBans?: (string | null)[];
        enemyBans?: (string | null)[];
        /** Ally player pools per role — feeds the pool-first picker section. */
        poolEntriesByRole?: Partial<Record<Role, ChampionPoolEntry[]>>;
        /** Pool header per role, e.g. "Pool de Manaty". */
        poolLabelByRole?: Partial<Record<Role, string>>;
        /** Additionally unavailable keys (Fearless-consumed champions). */
        excludedKeys?: string[];
        onAllySideChange?: (side: 'blue' | 'red') => void;
        onPickChange: (team: 'ally' | 'enemy', role: Role, championKey: string | null) => void;
        onBanChange?: (team: 'ally' | 'enemy', banIndex: number, championKey: string | null) => void;
    }

    let {
        allySide = 'blue',
        allyPicks,
        enemyPicks,
        allyBans = [null, null, null, null, null],
        enemyBans = [null, null, null, null, null],
        poolEntriesByRole = {},
        poolLabelByRole = {},
        excludedKeys = [],
        onAllySideChange,
        onPickChange,
        onBanChange
    }: Props = $props();

    interface SequenceStep {
        label: string;
        side: 'blue' | 'red';
        type: 'ban' | 'pick';
        /** How many same (side, type) steps precede it — fill-order mapping. */
        nth: number;
    }

    /** Tournament draft order, blue first pick (labels match the V1 capture). */
    const SEQUENCE: readonly SequenceStep[] = [
        { label: 'BB1', side: 'blue', type: 'ban', nth: 0 },
        { label: 'RB1', side: 'red', type: 'ban', nth: 0 },
        { label: 'BB2', side: 'blue', type: 'ban', nth: 1 },
        { label: 'RB2', side: 'red', type: 'ban', nth: 1 },
        { label: 'BB3', side: 'blue', type: 'ban', nth: 2 },
        { label: 'RB3', side: 'red', type: 'ban', nth: 2 },
        { label: 'B1', side: 'blue', type: 'pick', nth: 0 },
        { label: 'R1', side: 'red', type: 'pick', nth: 0 },
        { label: 'R2', side: 'red', type: 'pick', nth: 1 },
        { label: 'B2', side: 'blue', type: 'pick', nth: 1 },
        { label: 'B3', side: 'blue', type: 'pick', nth: 2 },
        { label: 'R3', side: 'red', type: 'pick', nth: 2 },
        { label: 'RB4', side: 'red', type: 'ban', nth: 3 },
        { label: 'BB4', side: 'blue', type: 'ban', nth: 3 },
        { label: 'RB5', side: 'red', type: 'ban', nth: 4 },
        { label: 'BB5', side: 'blue', type: 'ban', nth: 4 },
        { label: 'R4', side: 'red', type: 'pick', nth: 3 },
        { label: 'B4', side: 'blue', type: 'pick', nth: 3 },
        { label: 'B5', side: 'blue', type: 'pick', nth: 4 },
        { label: 'R5', side: 'red', type: 'pick', nth: 4 }
    ];

    /** Slot currently being edited via the picker. */
    type Target = { kind: 'pick'; team: 'ally' | 'enemy'; role: Role } | { kind: 'ban'; team: 'ally' | 'enemy'; index: number };
    let target = $state<Target | null>(null);

    const count = (slots: (string | null)[]): number => slots.filter((k) => k !== null).length;

    const teamOf = (side: 'blue' | 'red'): 'ally' | 'enemy' => (side === allySide ? 'ally' : 'enemy');

    function stepDone(step: SequenceStep): boolean {
        const team = teamOf(step.side);
        const filled =
            step.type === 'pick' ? count(team === 'ally' ? allyPicks : enemyPicks) : count(team === 'ally' ? allyBans : enemyBans);
        return filled > step.nth;
    }

    const nextStep = $derived(SEQUENCE.find((step) => !stepDone(step)) ?? null);
    const draftComplete = $derived(count(allyPicks) === 5 && count(enemyPicks) === 5);

    /** Already used in this draft (picked or banned by either team) + Fearless. */
    const disabledKeys = $derived([
        ...[...allyPicks, ...enemyPicks, ...allyBans, ...enemyBans].filter((k): k is string => k !== null),
        ...excludedKeys
    ]);

    const targetKey = $derived.by((): string | null => {
        if (target === null) return null;
        if (target.kind === 'pick') return (target.team === 'ally' ? allyPicks : enemyPicks)[target.role] ?? null;
        return (target.team === 'ally' ? allyBans : enemyBans)[target.index] ?? null;
    });

    const targetTitle = $derived.by((): string => {
        if (target === null) return '';
        const teamLabel = target.team === 'ally' ? 'allié' : 'adverse';
        return target.kind === 'pick'
            ? `Pick ${teamLabel} — ${ROLE_LABELS[target.role]}`
            : `Ban ${teamLabel} — slot ${target.index + 1}`;
    });

    function applySelection(championKey: string | null): void {
        if (target === null) return;
        if (target.kind === 'pick') {
            onPickChange(target.team, target.role, championKey);
        } else {
            onBanChange?.(target.team, target.index, championKey);
        }
        target = null;
    }

    function dotClass(step: SequenceStep): string {
        const done = stepDone(step);
        const isNext = nextStep !== null && nextStep.label === step.label;
        const color =
            step.side === 'blue'
                ? done
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-blue-500/50'
                : done
                  ? 'bg-red-500 border-red-500'
                  : 'border-red-500/50';
        return `${color} ${isNext ? 'ring-2 ring-amber-400/80' : ''}`;
    }

    const sideBadge = (team: 'ally' | 'enemy'): { label: string; cls: string } => {
        const side = team === 'ally' ? allySide : allySide === 'blue' ? 'red' : 'blue';
        return side === 'blue'
            ? { label: 'BLUE', cls: 'bg-blue-500/15 text-blue-400' }
            : { label: 'RED', cls: 'bg-red-500/15 text-red-400' };
    };
</script>

{#snippet timelineGroup(steps: readonly SequenceStep[])}
    <div class="flex items-start gap-2 rounded-md px-2 py-1.5">
        {#each steps as step (step.label)}
            <div class="flex w-7 flex-col items-center gap-1">
                {#if step.type === 'ban'}
                    <span class="mt-0.5 h-2.5 w-2.5 rotate-45 border-2 {dotClass(step)}"></span>
                {:else}
                    <span class="h-3.5 w-3.5 rounded-full border-2 {dotClass(step)}"></span>
                {/if}
                <span class="text-[9px] text-slate-500">{step.label}</span>
            </div>
        {/each}
    </div>
{/snippet}

{#snippet teamColumn(team: 'ally' | 'enemy', picks: (string | null)[], bans: (string | null)[])}
    <div class="flex-1 rounded-lg border bg-slate-900 p-2 {team === 'ally' ? 'border-blue-900/50' : 'border-red-900/50'}">
        <div class="flex items-center gap-2 pb-2">
            <span class="rounded-full px-2 py-0.5 text-[10px] font-bold {sideBadge(team).cls}">
                {sideBadge(team).label}
            </span>
            <span class="text-sm font-semibold text-slate-200">{team === 'ally' ? 'Allié' : 'Adverse'}</span>
        </div>

        {#each ROLES as role (role)}
            {@const key = picks[role] ?? null}
            <div class="flex items-center gap-2 border-t border-slate-800/60 py-1">
                <span class="w-9 shrink-0 text-[11px] font-bold text-slate-400">{ROLE_LABELS[role]}</span>
                <button
                    type="button"
                    onclick={() => (target = { kind: 'pick', team, role })}
                    class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-slate-800"
                >
                    {#if key !== null}
                        <ChampionIcon championKey={key} size={28} ring={team === 'ally' ? (allySide === 'blue' ? 'blue' : 'red') : allySide === 'blue' ? 'red' : 'blue'} />
                        <span class="truncate text-sm text-slate-200">{championNameByKey(key) ?? key}</span>
                    {:else}
                        <span class="text-xs text-slate-600">Choisir…</span>
                    {/if}
                </button>
                {#if key !== null}
                    <button
                        type="button"
                        onclick={() => onPickChange(team, role, null)}
                        class="shrink-0 rounded px-1 text-slate-600 hover:bg-slate-800 hover:text-slate-300"
                        title="Retirer ce pick"
                        aria-label="Retirer le pick {ROLE_LABELS[role]}"
                    >
                        ×
                    </button>
                {/if}
            </div>
        {/each}

        <p class="pt-2 pb-1 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Bans</p>
        <div class="flex gap-1.5">
            {#each bans as ban, index (index)}
                <button
                    type="button"
                    onclick={() => (target = { kind: 'ban', team, index })}
                    class="relative flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-800/60 hover:border-slate-500"
                    title={ban !== null ? `Ban : ${championNameByKey(ban) ?? ban}` : `Ban ${index + 1}`}
                >
                    {#if ban !== null}
                        <ChampionIcon championKey={ban} size={28} grayscale />
                        <span class="absolute text-sm font-bold text-slate-200/90">×</span>
                    {:else}
                        <span class="text-slate-600">·</span>
                    {/if}
                </button>
            {/each}
        </div>
    </div>
{/snippet}

<section class="panel p-3">
    <!-- Header: title + side toggle + completion state -->
    <div class="flex items-center justify-between pb-2">
        <h2 class="text-[11px] font-semibold tracking-widest text-slate-500 uppercase">Séquence du draft</h2>
        <div class="flex items-center gap-3">
            {#if onAllySideChange}
                <div class="flex overflow-hidden rounded-md border border-slate-700">
                    <button
                        type="button"
                        onclick={() => onAllySideChange?.('blue')}
                        class="px-2 py-0.5 text-xs font-semibold {allySide === 'blue'
                            ? 'bg-blue-500/25 text-blue-300'
                            : 'text-slate-500 hover:text-slate-300'}"
                    >
                        Allié bleu
                    </button>
                    <button
                        type="button"
                        onclick={() => onAllySideChange?.('red')}
                        class="px-2 py-0.5 text-xs font-semibold {allySide === 'red'
                            ? 'bg-red-500/25 text-red-300'
                            : 'text-slate-500 hover:text-slate-300'}"
                    >
                        Allié rouge
                    </button>
                </div>
            {/if}
            {#if draftComplete}
                <span class="text-[11px] font-semibold tracking-widest text-slate-300 uppercase">Draft complète</span>
            {/if}
        </div>
    </div>

    <!-- 20-step order timeline; phase 2 grouped like the capture -->
    <div class="flex flex-wrap items-start rounded-lg bg-slate-950/60 p-1">
        {@render timelineGroup(SEQUENCE.slice(0, 12))}
        <div class="rounded-md bg-slate-800/50">
            {@render timelineGroup(SEQUENCE.slice(12))}
        </div>
    </div>

    <p class="py-2 text-sm text-slate-400">
        {#if draftComplete}
            ◆ Draft terminé.
        {:else if nextStep !== null}
            Prochain : <span class="font-semibold text-slate-200">{nextStep.label}</span>
            — {nextStep.type === 'ban' ? 'ban' : 'pick'}
            {teamOf(nextStep.side) === 'ally' ? 'allié' : 'adverse'}
            <span class="text-slate-600">(ordre indicatif — saisie par rôle)</span>
        {/if}
    </p>

    <!-- Two team columns -->
    <div class="flex gap-3">
        {@render teamColumn('ally', allyPicks, allyBans)}
        {@render teamColumn('enemy', enemyPicks, enemyBans)}
    </div>

    <!-- Inline picker for the targeted slot -->
    {#if target !== null}
        <div class="mt-3">
            <div class="flex items-center justify-between pb-1">
                <p class="text-sm font-semibold text-slate-200">{targetTitle}</p>
                <div class="flex gap-2">
                    {#if targetKey !== null}
                        <button
                            type="button"
                            onclick={() => applySelection(null)}
                            class="rounded-md bg-slate-800 px-2 py-1 text-xs text-amber-300 hover:bg-slate-700"
                        >
                            Retirer
                        </button>
                    {/if}
                    <button
                        type="button"
                        onclick={() => (target = null)}
                        class="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                    >
                        Fermer
                    </button>
                </div>
            </div>
            <ChampionPicker
                poolEntries={target.kind === 'pick' && target.team === 'ally' ? (poolEntriesByRole[target.role] ?? []) : []}
                poolLabel={target.kind === 'pick' && target.team === 'ally'
                    ? (poolLabelByRole[target.role] ?? 'Pool du joueur')
                    : 'Pool du joueur'}
                {disabledKeys}
                onSelect={(championKey) => applySelection(championKey)}
            />
        </div>
    {/if}
</section>
