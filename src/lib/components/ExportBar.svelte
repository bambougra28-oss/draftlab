<!--
/**
 * C1 — Export bar: client-side file downloads (DA-V2-8, exports first-class).
 *
 * Renders one button per export action; content is built LAZILY at click time
 * (the builder closes over the route's current state, so the file always
 * reflects what is on screen) and downloaded through a Blob + object URL,
 * revoked right after the click. Pure beyond the DOM download edge: actions
 * come in by prop, no fetch, no storage.
 */
-->
<script module lang="ts">
    export interface ExportAction {
        /** Button label, e.g. 'Prep pack .md'. */
        label: string;
        /** Download filename, e.g. 'prep-pack-kc.md'. */
        filename: string;
        /** Content builder, invoked at click time. */
        build: () => string;
        /** MIME type (defaults to text/plain UTF-8). */
        mime?: string;
        /** Disabled with this FR reason as tooltip. */
        disabledReason?: string;
    }
</script>

<script lang="ts">
    interface Props {
        actions: ExportAction[];
        title?: string;
        /** Optional FR footnote under the buttons. */
        note?: string;
    }

    let { actions, title = 'Exports', note }: Props = $props();

    function download(action: ExportAction): void {
        const blob = new Blob([action.build()], { type: action.mime ?? 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = action.filename;
        anchor.click();
        URL.revokeObjectURL(url);
    }
</script>

<section class="rounded-lg border border-slate-800 bg-slate-900 p-3">
    <h2 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">{title}</h2>
    <div class="flex flex-wrap gap-2">
        {#each actions as action (action.label)}
            <button
                type="button"
                onclick={() => download(action)}
                disabled={action.disabledReason !== undefined}
                title={action.disabledReason ?? action.filename}
                class="rounded-md bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {action.label}
            </button>
        {/each}
    </div>
    {#if note !== undefined}
        <p class="pt-2 text-[10px] text-slate-600">{note}</p>
    {/if}
</section>
