<!--
/**
 * M2 Ping 3 — Draft slot for one role of one team (side-panel row).
 *
 * Layout follows the V1 capture: role label (+ assigned player's name under it
 * when team context is on) · champion icon with the side's accent ring ·
 * champion name with a pool subtitle. The subtitle shows "4g · 75% WR" when
 * the pick is in the assigned player's pool, or an amber "hors pool" when it
 * is not (spec wording "outside pool", rendered in French per UI conventions).
 * An optional 3-state comfort toggle mirrors the persisted comfort tag.
 *
 * Pure: stats/comfort come in by props; the route resolves them (contextBuilder
 * + $lib/comfort) and receives changes via callbacks.
 */
-->
<script module lang="ts">
    /** Short role labels in canonical Role order (Top…Support) — matches the V1 capture. */
    export const ROLE_LABELS = ['TOP', 'JG', 'MID', 'ADC', 'SUP'] as const;
</script>

<script lang="ts">
    import type { ComfortMode, PlayerStats, Role } from '$lib/types';
    import { championLoadingUrl, championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';

    interface Props {
        role: Role;
        championKey: string | null;
        side?: 'ally' | 'enemy';
        /** Assigned player's name — shown under the role when context is on. */
        playerName?: string | null;
        /** Pool stats of the picked champion for the assigned player. */
        playerStats?: PlayerStats | null;
        /** True when the picked champion is outside the player's pool. */
        outsidePool?: boolean;
        /** Current comfort tag; omit to hide the toggle entirely. */
        comfortMode?: ComfortMode;
        onComfortChange?: (mode: ComfortMode) => void;
        /** Open the picker for this slot. */
        onSelect?: () => void;
        onClear?: () => void;
    }

    let {
        role,
        championKey,
        side = 'ally',
        playerName = null,
        playerStats = null,
        outsidePool = false,
        comfortMode,
        onComfortChange,
        onSelect,
        onClear
    }: Props = $props();

    const championName = $derived(championKey === null ? null : (championNameByKey(championKey) ?? championKey));

    /** Loading-screen art behind the picked slot; per-key failure fallback. */
    let artFailedKey = $state<string | null>(null);
    const artUrl = $derived(championKey === null ? null : championLoadingUrl(championKey));
    const showArt = $derived(artUrl !== null && artFailedKey !== championKey);

    /** "4g · 75% WR" subtitle when the pick is in the assigned player's pool. */
    const poolSubtitle = $derived(
        playerStats === null ? null : `${playerStats.games}g · ${Math.round(playerStats.winrate * 100)}% WR`
    );

    const COMFORT_OPTIONS: readonly { mode: ComfortMode; label: string; active: string }[] = [
        { mode: 'comfort', label: 'Comfort', active: 'bg-emerald-500/20 text-emerald-300' },
        { mode: 'cheese', label: 'Cheese', active: 'bg-amber-500/20 text-amber-300' },
        { mode: 'unavailable', label: 'Indispo', active: 'bg-red-500/20 text-red-300' }
    ];

    /** Clicking the active mode untoggles it back to 'none'. */
    function toggleComfort(mode: ComfortMode): void {
        onComfortChange?.(comfortMode === mode ? 'none' : mode);
    }
</script>

<div
    class="group relative overflow-hidden rounded-xl border bg-abyss-900/85 p-2 transition-colors {championKey !==
    null
        ? side === 'ally'
            ? 'border-blue-500/30'
            : 'border-red-500/30'
        : 'border-slate-800'}"
>
    {#if championKey !== null && showArt}
        <!-- Art de chargement en fond, fondu vers le côté texte. -->
        <img
            src={artUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            draggable="false"
            onerror={() => (artFailedKey = championKey)}
            class="absolute inset-y-0 right-0 h-full w-2/3 object-cover object-[center_18%] opacity-40 transition-opacity duration-300 select-none group-hover:opacity-55"
        />
        <div class="absolute inset-0 bg-gradient-to-r from-abyss-900 via-abyss-900/80 to-abyss-900/10"></div>
        <div
            class="absolute inset-y-0 left-0 w-1 {side === 'ally' ? 'bg-blue-500/70' : 'bg-red-500/70'}"
        ></div>
    {/if}

    <div class="relative flex items-center gap-3">
    <div class="w-10 shrink-0">
        <p class="text-xs font-bold tracking-wide text-slate-300">{ROLE_LABELS[role]}</p>
        <p class="truncate text-[11px] text-slate-500" title={playerName ?? undefined}>
            {playerName ?? '—'}
        </p>
    </div>

    {#if championKey !== null}
        <button
            type="button"
            onclick={() => onSelect?.()}
            class="shrink-0 rounded-md focus:outline-none {onSelect ? 'cursor-pointer' : 'cursor-default'}"
            title="Changer de champion"
        >
            <ChampionIcon {championKey} size={48} ring={side === 'ally' ? 'blue' : 'red'} />
        </button>
        <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-slate-100">{championName}</p>
            {#if outsidePool}
                <p class="text-xs font-medium text-amber-400">hors pool</p>
            {:else if poolSubtitle !== null}
                <p class="text-xs text-slate-400">{poolSubtitle}</p>
            {/if}
            {#if comfortMode !== undefined}
                <div class="mt-1 flex gap-1">
                    {#each COMFORT_OPTIONS as option (option.mode)}
                        <button
                            type="button"
                            onclick={() => toggleComfort(option.mode)}
                            class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase {comfortMode ===
                            option.mode
                                ? option.active
                                : 'bg-slate-800 text-slate-500 hover:text-slate-300'}"
                        >
                            {option.label}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
        {#if onClear}
            <button
                type="button"
                onclick={() => onClear?.()}
                class="shrink-0 rounded-md px-1.5 text-slate-600 hover:bg-slate-800 hover:text-slate-300"
                title="Retirer ce pick"
                aria-label="Retirer ce pick"
            >
                ×
            </button>
        {/if}
    {:else}
        <button
            type="button"
            onclick={() => onSelect?.()}
            class="flex h-12 flex-1 items-center justify-center rounded-md border border-dashed border-slate-700 text-xs text-slate-500 transition-colors hover:border-gold-600/60 hover:text-gold-300"
        >
            Choisir un champion
        </button>
    {/if}
    </div>
</div>
