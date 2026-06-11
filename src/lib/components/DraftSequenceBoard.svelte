<!--
/**
 * Draft séquentielle — the exact tournament format as a broadcast board.
 *
 * Twenty template cells in true order (diamonds = bans, rounds = picks),
 * the cursor pulsing gold; below, the two sides face each other: ban rows
 * in grayscale, pick cards in slot order with the FLEX mechanism — a pick
 * lands role-less, role chips commit it later (committing a teammate's
 * role flips that teammate back to flex, like a real swap call). The
 * board never creates holes: you fill the cursor, edit a past cell in
 * place, or undo the tail.
 *
 * Pure: the sequence comes in by prop, every change goes up by callback;
 * the optional roleHint paints « ~MID 82 % » on flex picks (corpus read).
 */
-->
<script module lang="ts">
    import { slotsFor, type DraftFormat, type SequenceSlot } from '$lib/draft/sequence';
    import type { DraftSide } from '$lib/data/types';

    export interface BoardSlotView extends SequenceSlot {
        /** Broadcast label: B1…B5 / R1…R5 picks, BB1…BB5 / RB1…RB5 bans. */
        label: string;
    }

    function buildBoardSlots(format: DraftFormat, firstPickSide: DraftSide): readonly BoardSlotView[] {
        const counters: Record<string, number> = {};
        return slotsFor(format, firstPickSide).map((slot) => {
            const group = `${slot.side}-${slot.type}`;
            counters[group] = (counters[group] ?? 0) + 1;
            const prefix = slot.side === 'blue' ? 'B' : 'R';
            return { ...slot, label: `${prefix}${slot.type === 'ban' ? 'B' : ''}${counters[group]}` };
        });
    }

    // SoloQ ignores the First Selection (simultaneous bans, fixed snake).
    const BOARD_SLOTS_BY_KEY: Record<string, readonly BoardSlotView[]> = {
        'pro:blue': buildBoardSlots('pro', 'blue'),
        'pro:red': buildBoardSlots('pro', 'red'),
        'soloq:blue': buildBoardSlots('soloq', 'blue'),
        'soloq:red': buildBoardSlots('soloq', 'blue')
    };

    /** The format's walk slots with broadcast labels, First Selection applied. */
    export function boardSlotsFor(
        format: DraftFormat,
        firstPickSide: DraftSide = 'blue'
    ): readonly BoardSlotView[] {
        return BOARD_SLOTS_BY_KEY[`${format}:${firstPickSide}`];
    }
</script>

<script lang="ts">
    import type { DraftSequence } from '$lib/draft/sequence';
    import { lastFilledSeq, nextOpenSeq } from '$lib/draft/sequence';
    import { ROLES, type Role } from '$lib/types';
    import { championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';
    import { ROLE_LABELS } from '$lib/components/ChampionSlot.svelte';

    interface Props {
        sequence: DraftSequence;
        allySide: 'blue' | 'red';
        format?: DraftFormat;
        /** First Selection (2026) : camp qui picke en premier — pro uniquement. */
        firstPickSide?: DraftSide;
        /** Corpus role read for flex chips; null = no hint available. */
        roleHint?: ((championKey: string) => { role: Role; p: number } | null) | undefined;
        onRequestPick: () => void;
        onReplaceAt: (seq: number) => void;
        onAssignRole: (seq: number, role: Role | undefined) => void;
        onUndo: () => void;
        onReset: () => void;
    }

    let {
        sequence,
        allySide,
        format = 'pro',
        firstPickSide = 'blue',
        roleHint,
        onRequestPick,
        onReplaceAt,
        onAssignRole,
        onUndo,
        onReset
    }: Props = $props();

    const boardSlots = $derived(boardSlotsFor(format, firstPickSide));
    const cursor = $derived(nextOpenSeq(sequence, format));
    const lastSeq = $derived(lastFilledSeq(sequence, format));
    const cursorSlot = $derived(cursor === null ? null : boardSlots.find((s) => s.seq === cursor)!);

    const nameOf = (key: string): string => championNameByKey(key) ?? key;
    const sideFr = (side: 'blue' | 'red'): string => (side === 'blue' ? 'bleu' : 'rouge');
    const isAlly = (side: 'blue' | 'red'): boolean => side === allySide;

    const sideSlots = (side: 'blue' | 'red', type: 'ban' | 'pick'): BoardSlotView[] =>
        boardSlots.filter((s) => s.side === side && s.type === type);
</script>

<section class="panel panel-gold p-4">
    <header class="mb-3 flex flex-wrap items-center gap-3">
        <h2
            class="font-display bg-gradient-to-b from-gold-200 to-gold-500 bg-clip-text text-base tracking-[0.16em] text-transparent uppercase"
        >
            {format === 'soloq' ? 'Draft SoloQ' : 'Draft tournoi'}
        </h2>
        {#if format === 'pro' && firstPickSide === 'red'}
            <span
                class="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-300"
                title="Règle 2026 : le droit de picker en premier est découplé du choix de side."
            >
                First Selection : ROUGE
            </span>
        {/if}
        {#if cursorSlot !== null}
            <span class="text-sm text-slate-300">
                Tour : <span class="font-semibold {cursorSlot.side === 'blue' ? 'text-blue-300' : 'text-red-300'}">
                    {cursorSlot.type === 'ban' ? 'BAN' : 'PICK'} {cursorSlot.label} — côté {sideFr(cursorSlot.side)}
                    {isAlly(cursorSlot.side) ? '(vous)' : '(eux)'}
                </span>
            </span>
        {:else}
            <span class="text-sm font-semibold text-gold-300">Draft complète.</span>
        {/if}
        <div class="ml-auto flex gap-2">
            <button
                type="button"
                onclick={onUndo}
                disabled={lastSeq === null}
                class="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
                ↶ Annuler
            </button>
            <button
                type="button"
                onclick={onReset}
                disabled={lastSeq === null}
                class="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-700 hover:text-slate-300 disabled:opacity-40"
            >
                Vider
            </button>
        </div>
    </header>

    <!-- The 20-cell order strip: click the cursor to pick, a filled cell to edit. -->
    <div class="flex flex-wrap items-center gap-1.5 pb-4">
        {#each boardSlots as slot (slot.seq)}
            {@const entry = sequence.entries.get(slot.seq)}
            {@const isCursor = slot.seq === cursor}
            <button
                type="button"
                title="{slot.label} — {slot.type === 'ban' ? 'ban' : 'pick'} {sideFr(slot.side)}{entry
                    ? ` : ${nameOf(entry.championKey)}`
                    : ''}"
                onclick={() => (entry !== undefined ? onReplaceAt(slot.seq) : isCursor ? onRequestPick() : undefined)}
                class="relative flex h-9 w-9 items-center justify-center border transition-all {slot.type === 'ban'
                    ? 'rotate-45 rounded-[4px]'
                    : 'rounded-full'} {slot.side === 'blue'
                    ? 'border-blue-500/40 bg-blue-950/40'
                    : 'border-red-500/40 bg-red-950/40'} {isCursor
                    ? 'scale-110 ring-2 ring-gold-500/90 shadow-[0_0_14px_-2px_rgb(200_170_110/0.9)] animate-pulse-glow'
                    : ''} {entry === undefined && !isCursor ? 'opacity-45' : ''}"
            >
                <span class={slot.type === 'ban' ? '-rotate-45' : ''}>
                    {#if entry !== undefined}
                        <ChampionIcon championKey={entry.championKey} size={26} grayscale={slot.type === 'ban'} />
                    {:else}
                        <span class="text-[9px] font-semibold text-slate-500">{slot.label}</span>
                    {/if}
                </span>
                {#if format === 'pro' ? slot.seq === 13 : slot.seq === 7}
                    <span class="absolute -left-2 inset-y-0 w-px bg-gold-700/40" aria-hidden="true"></span>
                {/if}
            </button>
        {/each}
    </div>

    <!-- Face-off: bans then pick cards, per side, in slot order. -->
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {#each ['blue', 'red'] as const as side (side)}
            <div class="rounded-lg border p-2 {side === 'blue' ? 'border-blue-500/25' : 'border-red-500/25'}">
                <p
                    class="font-display flex items-center gap-2 pb-1.5 text-xs tracking-[0.2em] uppercase {side === 'blue'
                        ? 'text-blue-300'
                        : 'text-red-300'}"
                >
                    Côté {sideFr(side)} {isAlly(side) ? '· vous' : '· eux'}
                </p>
                <div class="flex items-center gap-1.5 pb-2">
                    <span class="text-[10px] text-slate-500 uppercase">Bans</span>
                    {#each sideSlots(side, 'ban') as slot (slot.seq)}
                        {@const entry = sequence.entries.get(slot.seq)}
                        {#if entry !== undefined}
                            <ChampionIcon championKey={entry.championKey} size={24} grayscale />
                        {:else}
                            <span class="h-6 w-6 rotate-45 scale-75 rounded-[3px] border border-slate-700/70"></span>
                        {/if}
                    {/each}
                </div>
                <ul class="space-y-1.5">
                    {#each sideSlots(side, 'pick') as slot (slot.seq)}
                        {@const entry = sequence.entries.get(slot.seq)}
                        <li class="flex items-center gap-2 rounded-md bg-abyss-900/70 p-1.5">
                            <span class="w-7 text-center text-[10px] font-semibold text-slate-500">{slot.label}</span>
                            {#if entry !== undefined}
                                <ChampionIcon
                                    championKey={entry.championKey}
                                    size={34}
                                    ring={side === 'blue' ? 'blue' : 'red'}
                                />
                                <div class="min-w-0 flex-1">
                                    <p class="truncate text-sm font-semibold text-slate-100">
                                        {nameOf(entry.championKey)}
                                    </p>
                                    <div class="mt-0.5 flex flex-wrap items-center gap-1">
                                        {#each ROLES as role (role)}
                                            <button
                                                type="button"
                                                onclick={() => onAssignRole(slot.seq, entry.role === role ? undefined : role)}
                                                class="rounded px-1.5 py-0.5 text-[10px] font-semibold {entry.role === role
                                                    ? 'bg-arcane-500/25 text-arcane-300'
                                                    : 'bg-slate-800 text-slate-500 hover:text-slate-300'}"
                                            >
                                                {ROLE_LABELS[role]}
                                            </button>
                                        {/each}
                                        {#if entry.role === undefined}
                                            {@const hint = roleHint?.(entry.championKey) ?? null}
                                            <span
                                                class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300"
                                            >
                                                FLEX{hint !== null
                                                    ? ` · ~${ROLE_LABELS[hint.role]} ${Math.round(hint.p * 100)} %`
                                                    : ''}
                                            </span>
                                        {/if}
                                    </div>
                                </div>
                            {:else}
                                <span class="flex-1 text-xs text-slate-600">
                                    {slot.seq === cursor ? '→ au tour de ce slot' : '—'}
                                </span>
                            {/if}
                        </li>
                    {/each}
                </ul>
            </div>
        {/each}
    </div>

    <p class="pt-2 text-[10px] text-slate-600">
        Un pick se pose en <span class="font-semibold text-amber-300">FLEX</span> (rôle non engagé) : gardez le
        rôle ouvert — l'adversaire doit couvrir plusieurs hypothèses. Cliquez un rôle pour l'assigner, recliquez
        pour le libérer ; assigner le rôle d'un coéquipier le repasse en flex.
        {#if format === 'soloq'}
            Bans SIMULTANÉS (les deux équipes peuvent bannir le même champion) puis le serpentin de picks —
            le coach traite les bans comme des exclusions, fidèle au client.
        {:else}
            L'ordre est l'ordre RÉEL du tournoi : le coach lit la draft exacte, bans compris.
        {/if}
    </p>
</section>
