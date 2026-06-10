<!--
/**
 * M5.3 — Player pool tiers panel.
 *
 * Classifies a player's champion-pool entries into the four readiness tiers
 * (strongest / match-ready / scrim-ready / learning) via the M5.3 classifier
 * (recency-derated game counts) and renders them grouped, strongest first.
 * Pure: entries come in by props; the classifier runs in `$derived`.
 */
-->
<script lang="ts">
    import { classifyPoolTier, type PoolTier } from '$lib/strategic/poolTierClassifier';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';
    import { championNameByKey } from '$lib/dataDragon/version';

    interface PoolTierEntry {
        championKey: string;
        games: number;
        wins: number;
        /** Days since last played — feeds the recency derate. */
        daysSinceLastPlayed?: number;
    }

    interface Props {
        entries: PoolTierEntry[];
        /** e.g. the assigned player's name; shown in the header. */
        playerName?: string | null;
        title?: string;
    }

    let { entries, playerName = null, title = 'Pool tiers' }: Props = $props();

    const TIER_ORDER: readonly PoolTier[] = ['strongest', 'match-ready', 'scrim-ready', 'learning'];

    const TIER_META: Record<PoolTier, { label: string; accent: string }> = {
        strongest: { label: 'Maîtrisés', accent: 'text-emerald-400' },
        'match-ready': { label: 'Prêts match', accent: 'text-sky-400' },
        'scrim-ready': { label: 'Prêts scrim', accent: 'text-slate-300' },
        learning: { label: 'En apprentissage', accent: 'text-amber-400' }
    };

    const grouped = $derived.by(() => {
        const groups: Record<PoolTier, PoolTierEntry[]> = {
            strongest: [],
            'match-ready': [],
            'scrim-ready': [],
            learning: []
        };
        for (const entry of entries) {
            groups[classifyPoolTier(entry)].push(entry);
        }
        for (const tier of TIER_ORDER) {
            groups[tier].sort((a, b) => b.games - a.games);
        }
        return groups;
    });

    function statsLabel(entry: PoolTierEntry): string {
        const wr = entry.games > 0 ? Math.round((entry.wins / entry.games) * 100) : 0;
        return `${entry.games}g · ${wr}%`;
    }
</script>

<section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
    <h2 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
        {title}{playerName !== null ? ` — ${playerName}` : ''}
    </h2>

    {#if entries.length === 0}
        <p class="text-xs text-slate-600">Aucune donnée de pool — synchronisez une équipe.</p>
    {:else}
        {#each TIER_ORDER as tier (tier)}
            <div class="pb-2">
                <p class="pb-1 text-xs font-semibold {TIER_META[tier].accent}">
                    {TIER_META[tier].label}
                    <span class="font-normal text-slate-600">({grouped[tier].length})</span>
                </p>
                {#if grouped[tier].length === 0}
                    <p class="text-[11px] text-slate-700">—</p>
                {:else}
                    <div class="flex flex-wrap gap-1.5">
                        {#each grouped[tier] as entry (entry.championKey)}
                            <span
                                class="flex items-center gap-1.5 rounded-md bg-slate-800/70 py-0.5 pr-2 pl-0.5"
                                title="{championNameByKey(entry.championKey) ?? entry.championKey} — {statsLabel(entry)}"
                            >
                                <ChampionIcon championKey={entry.championKey} size={22} />
                                <span class="text-xs text-slate-300">
                                    {championNameByKey(entry.championKey) ?? entry.championKey}
                                </span>
                                <span class="text-[10px] text-slate-500">{statsLabel(entry)}</span>
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    {/if}
</section>
