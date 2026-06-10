<!--
    Coach en direct — the page's recommendation surface (liveDraft engine).

    Audience: a LEARNING drafter, not a professional coach. Every number is
    explained in plain French, the reasons list only the axes that actually
    fired, and the "Comment lire ?" block defines the vocabulary. Components
    stay separated (DA-V2-12) and the whole panel is badged Expérimental
    (DA-V2-11) until the engines pass their validation gates.
-->
<script lang="ts">
    import type { CoachAdvice, EnemyRoleReport } from '$lib/intel/liveDraft';
    import { championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';

    interface Props {
        advice: CoachAdvice | null;
        /** Why the advice is unavailable (dataset loading, etc.). */
        unavailableReason?: string | null;
        /** Shown under the headline — entry-order approximation note, etc. */
        noteFr?: string | null;
        /** Enemy role read (I2 hypotheses) — mismatch warnings + ambiguity. */
        roleReads?: EnemyRoleReport | null;
        title?: string;
    }

    const {
        advice,
        unavailableReason = null,
        noteFr = null,
        roleReads = null,
        title = 'Coach — prochain coup'
    }: Props = $props();

    const nameOf = (key: string): string => championNameByKey(key) ?? key;
    const pct = (p: number): string => `${(100 * p).toFixed(1).replace('.', ',')} %`;
    const pp = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} pp`;
    const ROLE_FR = ['top', 'jungle', 'mid', 'bot', 'support'] as const;
    const mismatches = $derived(roleReads === null ? [] : roleReads.reads.filter((r) => r.mismatch));
</script>

<section class="panel panel-gold p-4">
    <header class="mb-3 flex flex-wrap items-center gap-2">
        <h2
            class="font-display bg-gradient-to-b from-gold-200 to-gold-500 bg-clip-text text-base tracking-[0.16em] text-transparent uppercase"
        >
            {title}
        </h2>
        <span class="rounded bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
            Expérimental — non calibré
        </span>
        {#if advice !== null && advice.evaluatedNodes > 0}
            <span class="text-[10px] text-slate-500">{advice.evaluatedNodes} positions explorées</span>
        {/if}
    </header>

    {#if advice === null}
        <p class="text-sm text-slate-500">{unavailableReason ?? 'Coach indisponible.'}</p>
    {:else}
        <p class="text-sm text-slate-200">{advice.headlineFr}</p>
        {#if noteFr !== null}
            <p class="mt-1 text-[11px] text-slate-500">{noteFr}</p>
        {/if}

        {#if advice.turn !== null && advice.turn.isOurs && advice.candidates.length > 0}
            <ol class="mt-3 space-y-2">
                {#each advice.candidates.slice(0, 3) as candidate, index (candidate.championKey)}
                    <li
                        class="animate-fade-up rounded-lg border p-3 {index === 0
                            ? 'border-gold-700/40 bg-gradient-to-r from-gold-500/8 to-transparent'
                            : 'border-slate-800 bg-slate-950/60'}"
                        style="animation-delay: {index * 60}ms"
                    >
                        <div class="flex items-center gap-3">
                            <span
                                class="w-5 text-center text-sm font-bold {index === 0
                                    ? 'text-gold-400'
                                    : 'text-slate-500'}">{index + 1}</span
                            >
                            <ChampionIcon championKey={candidate.championKey} size={40} ring={index === 0 ? 'gold' : 'none'} />
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-baseline gap-2">
                                    <span class="font-semibold text-slate-100">{nameOf(candidate.championKey)}</span>
                                    <span class="text-xs text-slate-400">
                                        win estimé après : <span class="font-medium text-slate-200">{pct(candidate.winAfter)}</span>
                                    </span>
                                    {#if index === 0 && candidate.edgeVsNextPp >= 0.05}
                                        <span class="rounded bg-blue-900/50 px-1.5 py-0.5 text-[10px] text-blue-300">
                                            {pp(candidate.edgeVsNextPp)} vs le suivant
                                        </span>
                                    {/if}
                                    {#if candidate.pairWith !== undefined}
                                        <span
                                            class={candidate.pairWith.residualPp > 0
                                                ? 'rounded bg-emerald-900/50 px-1.5 py-0.5 text-[10px] text-emerald-300'
                                                : 'rounded bg-rose-900/50 px-1.5 py-0.5 text-[10px] text-rose-300'}
                                        >
                                            paire {candidate.pairWith.residualPp > 0 ? '+' : '−'} avec {nameOf(
                                                candidate.pairWith.championKey
                                            )}
                                        </span>
                                    {/if}
                                    {#if candidate.counterVs !== undefined}
                                        <span
                                            class={candidate.counterVs.threatPp > 0
                                                ? 'rounded bg-violet-900/50 px-1.5 py-0.5 text-[10px] text-violet-300'
                                                : 'rounded bg-rose-900/50 px-1.5 py-0.5 text-[10px] text-rose-300'}
                                        >
                                            {candidate.counterVs.threatPp > 0 ? 'contre leur compo' : 'contré par leur compo'}
                                            {candidate.counterVs.threatPp >= 0 ? '+' : ''}{candidate.counterVs.threatPp.toFixed(1).replace('.', ',')} pp
                                        </span>
                                    {/if}
                                </div>
                                {#if candidate.reasonsFr.length > 0}
                                    <ul class="mt-1 space-y-0.5 text-xs text-slate-400">
                                        {#each candidate.reasonsFr as reason (reason)}
                                            <li>• {reason}</li>
                                        {/each}
                                    </ul>
                                {/if}
                                {#if candidate.line.length > 1}
                                    <p class="mt-1 truncate text-[11px] text-slate-500">
                                        Suite probable : {candidate.line.slice(1).map(nameOf).join(' → ')}
                                    </p>
                                {/if}
                                <p class="mt-1 text-[10px] text-slate-600">
                                    Immédiat {pp(candidate.components.immediatePp - 50)} · Anticipation {pp(candidate.components.lookaheadPp)}
                                </p>
                            </div>
                        </div>
                    </li>
                {/each}
            </ol>
        {/if}

        {#if mismatches.length > 0}
            <div class="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/30 p-2">
                <p class="text-[11px] uppercase tracking-wide text-amber-400">Lecture des rôles adverses</p>
                <ul class="mt-1 space-y-0.5 text-xs text-amber-200">
                    {#each mismatches as read (read.championKey)}
                        <li>
                            {nameOf(read.championKey)} : {Math.round(read.pTopRole * 100)} %
                            {ROLE_FR[read.topRole ?? 0]} d'après leurs games — vous l'avez slotté
                            {ROLE_FR[read.enteredRole]}.
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}
        {#if roleReads !== null && roleReads.reads.length > 1}
            <p class="mt-2 text-[11px] text-slate-500">
                Ambiguïté de leurs rôles : {roleReads.ambiguityBits.toFixed(1).replace('.', ',')} bit(s) —
                0 = compo entièrement lisible.
            </p>
        {/if}

        {#if advice.enemyExpectation.length > 0}
            <div class="mt-3">
                <p class="text-[11px] uppercase tracking-wide text-slate-500">Attendu côté adverse</p>
                <div class="mt-1 flex flex-wrap gap-2">
                    {#each advice.enemyExpectation as expected (expected.championKey)}
                        <span class="flex items-center gap-1.5 rounded-full border border-red-900/60 bg-red-950/30 px-2 py-1 text-xs text-red-200">
                            <ChampionIcon championKey={expected.championKey} size={18} />
                            {nameOf(expected.championKey)}
                            <span class="text-red-400/80">{Math.round(expected.p * 100)} %</span>
                        </span>
                    {/each}
                </div>
            </div>
        {/if}

        <details class="mt-3 text-xs text-slate-500">
            <summary class="cursor-pointer select-none text-slate-400">Comment lire ?</summary>
            <div class="mt-2 space-y-1">
                <p>
                    <strong class="text-slate-300">Win estimé après</strong> : la probabilité de victoire de
                    votre équipe si vous jouez ce champion puis que les deux camps jouent leurs meilleures
                    suites (moteur statistique SoloQ + confort joueur — indicatif, non calibré sur le pro).
                </p>
                <p>
                    <strong class="text-slate-300">Immédiat / Anticipation</strong> : la part du gain due au
                    pick lui-même vs ce que la suite explorée ajoute ou reprend (une anticipation négative =
                    leur meilleure réponse vous reprend une partie du gain).
                </p>
                <p>
                    <strong class="text-slate-300">Attendu côté adverse</strong> : leur range — ce que cette
                    équipe joue habituellement à ce moment de la draft, d'après ses games réelles (corpus
                    Leaguepedia + gol.gg). Les raisons listées sous chaque candidat ne sont jamais inventées :
                    seuls les axes qui s'appliquent vraiment apparaissent.
                </p>
                <p>
                    <strong class="text-slate-300">Paire</strong> : le signal des duos pros partageant les
                    mêmes profils (engage + hyper-carry, etc.) dans le corpus. Les pros posent leurs duos aux
                    doubles slots — deux picks d'affilée, le 2ᵉ est insaisissable — d'où le rappel « pensez la
                    paire » quand vous ouvrez un double slot.
                </p>
                <p>
                    <strong class="text-slate-300">Contre leur compo</strong> : le face-à-face historique des
                    profils (le vôtre contre chacun des leurs) dans les games pros — le même signal qui guide
                    les bans de phase 2, validé sur 4 ligues. Positif = ce profil bat historiquement ce
                    qu'ils ont montré ; négatif = il se fait punir.
                </p>
            </div>
        </details>
    {/if}
</section>
