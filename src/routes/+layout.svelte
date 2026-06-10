<!--
/**
 * Global app shell (Sprint D — Prep / Match mode split).
 *
 * Mounts the AppNav above every route and wraps the page in the dark slate
 * theme shell (bg-slate-950). The active path is passed down as a prop so the
 * nav component stays pure (`page` from $app/state is the only global read).
 */
-->
<script lang="ts">
    import '../app.css';
    import { page } from '$app/state';
    import AppNav from '$lib/components/AppNav.svelte';
    import type { LayoutProps } from './$types';

    let { children }: LayoutProps = $props();
</script>

<div class="min-h-screen bg-slate-950 text-slate-200">
    <AppNav currentPath={page.url.pathname} />
    <main class="mx-auto max-w-[1700px] p-4">
        {@render children()}
    </main>
</div>
