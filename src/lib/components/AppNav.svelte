<!--
/**
 * Sprint D — Global navigation bar (Prep / Match mode split).
 *
 * Five typed routes; the Live (match-day) link is highlighted in amber to make
 * the mode switch obvious at a glance, plus a discreet help link on the right.
 * Pure: the active path comes in by prop (the layout passes
 * `page.url.pathname`), so the component stays testable and SSR-agnostic.
 *
 * Plain hrefs (not `resolve()`): the app deploys at the domain root (no
 * `paths.base`), and `resolve()`'s generated Pathname type would not compile
 * until the target routes exist — revisit once the routes land.
 */
-->
<script lang="ts">
    /* eslint-disable svelte/no-navigation-without-resolve -- static internal
       routes at domain root; see module comment. */
    interface NavRoute {
        href: string;
        label: string;
        /** Match-day route — rendered with the amber accent. */
        live?: boolean;
    }

    interface Props {
        /** Current pathname, e.g. "/plans/abc". */
        currentPath: string;
    }

    let { currentPath }: Props = $props();

    const ROUTES: readonly NavRoute[] = [
        { href: '/', label: 'Draft' },
        { href: '/prototype', label: 'Stratégie' },
        { href: '/plans', label: 'Plans' },
        { href: '/series', label: 'Séries' },
        { href: '/review', label: 'Revue' },
        { href: '/live', label: 'Live', live: true }
    ];

    /** Exact match for the root, prefix match for section routes (/plans/[id]…). */
    function isActive(route: NavRoute): boolean {
        if (route.href === '/') return currentPath === '/';
        return currentPath === route.href || currentPath.startsWith(`${route.href}/`);
    }

    function linkClass(route: NavRoute): string {
        const active = isActive(route);
        if (route.live) {
            return active
                ? 'border-amber-400/60 bg-amber-500/10 text-amber-300'
                : 'border-transparent text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300';
        }
        return active
            ? 'border-gold-500/70 bg-gold-500/10 text-gold-200'
            : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200';
    }
</script>

<nav
    class="sticky top-0 z-40 flex items-center gap-1 border-b border-gold-700/25 bg-abyss-950/85 px-4 py-2 backdrop-blur-md"
>
    <a href="/" class="group mr-5 flex items-baseline gap-0.5 select-none">
        <span class="font-display text-base tracking-[0.22em] text-slate-100 uppercase">Draft</span>
        <span
            class="font-display bg-gradient-to-b from-gold-200 to-gold-500 bg-clip-text text-base tracking-[0.22em] text-transparent uppercase"
        >
            Lab
        </span>
    </a>

    {#each ROUTES as route (route.href)}
        <a
            href={route.href}
            class="rounded-md border-b-2 px-3 py-1.5 text-sm font-medium transition-colors {linkClass(route)}"
            aria-current={isActive(route) ? 'page' : undefined}
        >
            {route.label}
        </a>
    {/each}

    <a
        href="/help"
        class="ml-auto rounded-md px-3 py-1.5 text-sm {currentPath === '/help'
            ? 'bg-slate-800 text-white'
            : 'text-slate-500 hover:text-slate-300'}"
        aria-current={currentPath === '/help' ? 'page' : undefined}
    >
        Aide
    </a>
</nav>
