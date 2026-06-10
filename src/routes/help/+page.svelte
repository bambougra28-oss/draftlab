<!--
/**
 * Route /help — quick navigation guide (Sprint D).
 *
 * Static coach-facing page: what each route does, the prep-week workflow
 * (S1: scout → tendances → plans A/B/C → série Fearless → match day), the
 * data sources with their caveats (DA-V2-4 spirit: say where numbers come
 * from), and the badge legend (comfort tags, pool tiers, First Selection).
 */
-->
<script lang="ts">
    import { resolve } from '$app/paths';

    // Route ids (resolved in the template so the navigation lint rule sees
    // the resolve() call at the link site).
    const ROUTES = [
        {
            id: '/',
            label: 'Draft',
            mode: 'Prep',
            desc: "Scout d'équipes (gol.gg) + analyseur bayésien M1/M2 : slots par rôle, contexte joueur (pool, confort), side, win % estimé, pool tiers."
        },
        {
            id: '/prototype',
            label: 'Stratégie',
            mode: 'Prep',
            desc: 'Lecture stratégique d’une draft : plans de jeu (5 archétypes), power curves early/mid/late, marqueurs de risque, lecture adverse pick par pick.'
        },
        {
            id: '/plans',
            label: 'Plans',
            mode: 'Prep',
            desc: 'Constructeur de plans A/B/C : 5 bans + 5 picks (principal + fallback + justification), liés aux games d’une série.'
        },
        {
            id: '/series',
            label: 'Séries',
            mode: 'Prep',
            desc: 'Séries Bo1/Bo3/Bo5 : saisie game par game, First Selection (règle 2026), suivi de consommation Fearless, application des plans.'
        },
        {
            id: '/live',
            label: 'Live',
            mode: 'Match',
            desc: 'Vue match-day épurée en lecture seule : score, game en cours, picks/bans, champions verrouillés. Affinage M8.1 à venir.'
        }
    ] as const;
</script>

<svelte:head>
    <title>DraftLab — Aide</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-4">
    <section class="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h1 class="text-base font-bold text-slate-100">
            Draft<span class="text-blue-400">Lab</span> — guide rapide
        </h1>
        <p class="pt-1 text-sm text-slate-400">
            Constructeur stratégique de drafts pour staffs externes (coach freelance, analyste, ERL) sur
            données publiques. Tout est <strong class="text-slate-200">local-first</strong> : vos plans et
            séries restent dans ce navigateur (IndexedDB), aucun compte, aucun cloud.
        </p>
    </section>

    <!-- Routes -->
    <section class="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">Les vues</h2>
        <ul class="space-y-3">
            {#each ROUTES as route (route.id)}
                <li class="flex gap-3">
                    <a
                        href={resolve(route.id)}
                        class="w-24 shrink-0 pt-0.5 text-sm font-semibold {route.mode === 'Match'
                            ? 'text-amber-400'
                            : 'text-blue-400'} hover:underline"
                    >
                        {route.label}
                    </a>
                    <div>
                        <span class="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold {route.mode ===
                        'Match'
                            ? 'text-amber-400'
                            : 'text-slate-400'}">
                            {route.mode}
                        </span>
                        <p class="pt-1 text-sm text-slate-400">{route.desc}</p>
                    </div>
                </li>
            {/each}
        </ul>
    </section>

    <!-- Workflow -->
    <section class="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
            Workflow d'une semaine de match
        </h2>
        <ol class="list-decimal space-y-2 pl-5 text-sm text-slate-400">
            <li>
                <strong class="text-slate-200">Lundi — scout.</strong> Sur
                <a href={resolve('/')} class="text-blue-400 hover:underline">Draft</a>, chargez la ligue,
                synchronisez votre équipe (A) et l'adversaire (B), activez « Appliquer le contexte équipe ».
                Les pools joueurs, sides et drafts récentes arrivent de gol.gg (≈ 1 requête/s, patience sur le
                premier sync).
            </li>
            <li>
                <strong class="text-slate-200">Mardi/mercredi — hypothèses.</strong> Rejouez leurs drafts
                récentes (clic dans la barre latérale), testez vos comps sur
                <a href={resolve('/prototype')} class="text-blue-400 hover:underline">Stratégie</a> : plan de
                jeu, fenêtre de puissance, risques.
            </li>
            <li>
                <strong class="text-slate-200">Jeudi — plans A/B/C.</strong> Figez vos
                <a href={resolve('/plans')} class="text-blue-400 hover:underline">Plans</a> (bans, picks
                principaux + fallbacks, justifications) et cochez les games visés (G1…G5).
            </li>
            <li>
                <strong class="text-slate-200">Veille de match — série.</strong> Créez la
                <a href={resolve('/series')} class="text-blue-400 hover:underline">Série</a> (Bo3/Bo5,
                Fearless), renseignez la First Selection de chaque game, appliquez vos plans.
            </li>
            <li>
                <strong class="text-slate-200">Jour J — match.</strong> Ouvrez
                <a href={resolve('/live')} class="text-amber-400 hover:underline">Live</a> sur un second
                écran ; saisissez les picks dans l'éditeur de série entre les games — le Fearless verrouille
                automatiquement les champions consommés.
            </li>
        </ol>
    </section>

    <!-- Legend -->
    <section class="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">Légende</h2>
        <dl class="space-y-2 text-sm">
            <div>
                <dt class="font-semibold text-slate-200">Tags de confort (slots alliés)</dt>
                <dd class="text-slate-400">
                    <span class="font-semibold text-emerald-400">Comfort</span> (≥ 5 games),
                    <span class="font-semibold text-amber-400">Cheese</span> (1–4 games),
                    <span class="font-semibold text-red-400">Indispo</span> (0 game) — pré-remplis depuis le
                    pool gol.gg, modifiables au clic (persistés localement). Ils pondèrent le prior bayésien
                    du moteur quand le contexte équipe est actif.
                </dd>
            </div>
            <div>
                <dt class="font-semibold text-slate-200">Pool tiers</dt>
                <dd class="text-slate-400">
                    Maîtrisés / Prêts match / Prêts scrim / En apprentissage — classement du pool d'un joueur
                    par volume de games (avec décote de récence).
                </dd>
            </div>
            <div>
                <dt class="font-semibold text-slate-200">First Selection (règle 2026)</dt>
                <dd class="text-slate-400">
                    L'équipe qui détient la FS choisit <em>soit</em> son side, <em>soit</em> le first pick —
                    side bleu ≠ first pick désormais. Renseignez-la par game dans l'éditeur de série.
                </dd>
            </div>
            <div>
                <dt class="font-semibold text-slate-200">Fearless</dt>
                <dd class="text-slate-400">
                    Un champion pické (par l'une ou l'autre équipe) est verrouillé pour le reste de la série.
                    Le tracker de consommation et les sélecteurs grisés suivent la règle automatiquement.
                </dd>
            </div>
        </dl>
    </section>

    <!-- Data sources -->
    <section class="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
            Données et limites
        </h2>
        <ul class="list-disc space-y-1.5 pl-5 text-sm text-slate-400">
            <li>
                <strong class="text-slate-200">DraftGap (SoloQ)</strong> : winrates champions/duos/matchups.
                ~50 Mo téléchargés au premier chargement, puis cache 24 h (IndexedDB). Les badges sous les
                chiffres rappellent la source et l'échantillon.
            </li>
            <li>
                <strong class="text-slate-200">gol.gg (pro)</strong> : rosters, pools, sides, drafts
                récentes. Scraping poli (1 req/s, cache 24 h) via le proxy local — un sync d'équipe prend
                quelques secondes. « Données partielles » signale un sous-fetch en échec, jamais masqué.
            </li>
            <li>
                <strong class="text-slate-200">Data Dragon (Riot)</strong> : icônes champions (fallback
                hors-ligne en initiales).
            </li>
            <li>
                Le win % estimé reste un signal SoloQ contextualisé — les matchups coordonnés pro divergent
                (verdict M3.5) ; utilisez-le comme garde-fou, pas comme oracle.
            </li>
        </ul>
    </section>
</div>
