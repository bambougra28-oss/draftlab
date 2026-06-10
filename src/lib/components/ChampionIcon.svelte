<!--
/**
 * M5.2 — Champion icon from the Data Dragon CDN.
 *
 * Documented exception to the "pure components" rule: this component resolves
 * the ddragon version itself (24h localStorage cache + offline fallback, see
 * $lib/dataDragon/version) so that every consumer doesn't have to plumb a
 * version prop through the tree. The version is fetched ONCE per page load and
 * shared by all instances via a module-level promise.
 *
 * Offline / unknown-key fallback: a slate block showing the champion's
 * initials, so layouts keep their shape without the network.
 */
-->
<script module lang="ts">
    import { championIconUrl, championNameByKey, fetchDataDragonVersion } from '$lib/dataDragon/version';

    let versionPromise: Promise<string> | null = null;

    /** Shared one-shot version resolution for every icon on the page. */
    function resolveVersionOnce(): Promise<string> {
        versionPromise ??= fetchDataDragonVersion();
        return versionPromise;
    }
</script>

<script lang="ts">
    interface Props {
        /** Numeric Data Dragon key as a string (e.g. "157" = Yasuo). */
        championKey: string;
        /** Square size in px. */
        size?: number;
        /** Side accent ring around the icon. */
        ring?: 'blue' | 'red' | 'none';
        /** Greyscale render (bans / Fearless-consumed champions). */
        grayscale?: boolean;
    }

    let { championKey, size = 40, ring = 'none', grayscale = false }: Props = $props();

    let version = $state<string | null>(null);
    /** Key whose image failed to load — shows the fallback for that key only. */
    let failedKey = $state<string | null>(null);

    $effect(() => {
        let cancelled = false;
        resolveVersionOnce().then((v) => {
            if (!cancelled) version = v;
        });
        return () => {
            cancelled = true;
        };
    });

    const name = $derived(championNameByKey(championKey) ?? championKey);
    const url = $derived(version === null ? null : championIconUrl(championKey, version));
    const initials = $derived(name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || '?');

    const RING_CLASS: Record<'blue' | 'red' | 'none', string> = {
        blue: 'ring-2 ring-blue-500/70',
        red: 'ring-2 ring-red-500/70',
        none: ''
    };
</script>

{#if url !== null && failedKey !== championKey}
    <img
        src={url}
        alt={name}
        title={name}
        width={size}
        height={size}
        loading="lazy"
        draggable="false"
        class="rounded-md bg-slate-800 object-cover select-none {RING_CLASS[ring]} {grayscale
            ? 'opacity-60 grayscale'
            : ''}"
        style="width: {size}px; height: {size}px;"
        onerror={() => {
            failedKey = championKey;
        }}
    />
{:else}
    <span
        title={name}
        class="flex items-center justify-center rounded-md bg-slate-800 font-semibold text-slate-400 select-none {RING_CLASS[
            ring
        ]}"
        style="width: {size}px; height: {size}px; font-size: {Math.max(10, size * 0.32)}px;"
    >
        {initials}
    </span>
{/if}
