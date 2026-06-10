<!--
/**
 * M2 Ping 3 — Blue/Red side toggle for the ally team.
 *
 * Both teams' side win-rates are shown inline under each side button so the
 * choice is informed (e.g. "Allié 63% · Adverse 38%"). Pure: records come in
 * by props, the chosen side goes up via `onChange`.
 */
-->
<script lang="ts">
    import type { SideRecord, TeamSideStats } from '$lib/pro/types';

    interface Props {
        value: 'blue' | 'red';
        onChange: (side: 'blue' | 'red') => void;
        /** Ally team side records (optional until a team is synced). */
        allyStats?: TeamSideStats | null;
        /** Enemy team side records. */
        enemyStats?: TeamSideStats | null;
    }

    let { value, onChange, allyStats = null, enemyStats = null }: Props = $props();

    /** "5W-3L (63%)" or em-dash when the team has no games on that side. */
    function recordLabel(record: SideRecord | undefined): string {
        if (!record || record.games === 0) return '—';
        const losses = record.games - record.wins;
        return `${record.wins}W-${losses}L (${Math.round((record.wins / record.games) * 100)}%)`;
    }

    const SIDES: readonly { side: 'blue' | 'red'; label: string; active: string }[] = [
        { side: 'blue', label: 'Side Bleu', active: 'bg-blue-500/20 text-blue-300 border-blue-500/60' },
        { side: 'red', label: 'Side Rouge', active: 'bg-red-500/20 text-red-300 border-red-500/60' }
    ];
</script>

<div class="rounded-lg border border-slate-800 bg-slate-900 p-3">
    <p class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">Side allié</p>
    <div class="grid grid-cols-2 gap-2">
        {#each SIDES as entry (entry.side)}
            <button
                type="button"
                onclick={() => onChange(entry.side)}
                aria-pressed={value === entry.side}
                class="rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors {value ===
                entry.side
                    ? entry.active
                    : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'}"
            >
                <span class="block">{entry.label}</span>
                <span class="mt-1 block text-[11px] font-normal text-slate-400">
                    Allié {recordLabel(entry.side === 'blue' ? allyStats?.blue : allyStats?.red)}
                </span>
                <span class="block text-[11px] font-normal text-slate-500">
                    Adverse {recordLabel(entry.side === 'blue' ? enemyStats?.red : enemyStats?.blue)}
                </span>
            </button>
        {/each}
    </div>
    <p class="pt-2 text-[11px] text-slate-600">
        L'adversaire joue automatiquement le side opposé.
    </p>
</div>
