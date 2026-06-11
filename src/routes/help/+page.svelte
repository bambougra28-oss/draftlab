<!--
/**
 * Route /help — quick navigation guide (Sprint D).
 *
 * Static coach-facing page: what each route does, the prep-week workflow
 * (S1: scout → tendances → plans A/B/C → série Fearless → match day), the
 * data sources with their caveats (DA-V2-4 spirit: say where numbers come
 * from), and the badge legend (comfort tags, pool tiers, First Selection).
 * C1 adds the summit-engine sections: opponent intel, war room, annotated
 * review and the print/CSV exports, plus the Expérimental/Non calibré badge
 * doctrine (DA-V2-11).
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
            desc: 'Séries Bo1/Bo3/Bo5 : saisie game par game, First Selection (règle 2026), suivi de consommation Fearless, application des plans, war room (intégrité des pools, dépenser/garder).'
        },
        {
            id: '/review',
            label: 'Revue',
            mode: 'Prep',
            desc: 'Revue annotée façon moteur d’échecs : chaque décision d’une game (série sauvée ou exemple) graduée en points de win % (?! / ? / ??), « mieux était », leak report.'
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

    <!-- C1: summit engines -->
    <section class="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 class="pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
            Intel adverse, war room, revue & exports
        </h2>
        <dl class="space-y-2 text-sm">
            <div>
                <dt class="font-semibold text-slate-200">Intel adverse (Draft, équipe B synchronisée)</dt>
                <dd class="text-slate-400">
                    Tendances conditionnelles par rotation et par side (« 4 des 6 dernières » — des comptes,
                    jamais des logits), ranges par slot (B1-B3 / P1 / P2-3) avec composantes dépliables —
                    blanc = choix proches —, et pages de bans : EV = sortie attendue × (dégât + valeur
                    structurelle), composantes affichées séparément.
                </dd>
            </div>
            <div>
                <dt class="font-semibold text-slate-200">Conditions de victoire (Draft & Stratégie)</dt>
                <dd class="text-slate-400">
                    8 axes de conflit bilatéraux (engage/désengage, dive/peel, poke, split, scaling,
                    snowball, objectifs, pick) — score positif = avantage allié, composantes auditables par
                    axe, collision des plans en « vue 27 secondes » et conditions falsifiables (durée de
                    partie, objectifs).
                </dd>
            </div>
            <div>
                <dt class="font-semibold text-slate-200">War room (éditeur de série, Fearless Bo3/Bo5)</dt>
                <dd class="text-slate-400">
                    Saisissez les pools par rôle (une ligne par rôle) : jauges d'intégrité Monte-Carlo des
                    deux pools (rôle goulot, sous-minimum), valeur de série, conseil First Selection
                    (side <em>ou</em> first pick) et table dépenser/garder — Maintenant / Option future /
                    Net / Déni séparés ; le déni reste « non chiffré » sans modèle de tendances.
                </dd>
            </div>
            <div>
                <dt class="font-semibold text-slate-200">Revue annotée</dt>
                <dd class="text-slate-400">
                    Rejoue une game contre l'oracle navigator : grades larges ?! / ? / ?? (≈ −1/−2/−3 points
                    de win %), « mieux était X » seulement au-dessus du seuil de confiance, choix quasi
                    équivalents jamais reprochés, notes (ban gaspillé en Fearless…) et leak report
                    multi-games.
                </dd>
            </div>
            <div>
                <dt class="font-semibold text-slate-200">Exports (sans appareil sur scène)</dt>
                <dd class="text-slate-400">
                    Prep pack A4 imprimable (.md : plans, pages de bans, pools, tendances, ranges,
                    conditions de victoire), feuille re-plan une page entre les games (intégrité + pools
                    restants), tendances et pools en .csv (RFC 4180, prêts pour Sheets). Générés au clic,
                    téléchargés localement.
                </dd>
            </div>
            <div>
                <dt class="font-semibold text-slate-200">
                    Badges « Expérimental » / « Non calibré » / « Calibré sur N games »
                </dt>
                <dd class="space-y-1.5 text-slate-400">
                    <p>
                        Tout affichage d'un moteur non calibré porte le badge « Non calibré » : poids des
                        ranges, EV de bans, axes de victoire, solveur de série et oracle de revue sont des
                        défauts de comportement en attente de calibration — des aides à la décision, pas des
                        oracles.
                    </p>
                    <p>
                        <span class="font-semibold text-emerald-400">« Calibré sur N games »</span> (barre de
                        win % et % du coach, sans contexte équipe actif) signifie exactement ceci : quand
                        l'outil affiche X %, la fréquence observée sur corpus pro walk-forward tombe dans le
                        bac correspondant — il ne prédit toujours pas le vainqueur. La carte de calibration
                        (méthode de Platt, un couple (a, b) par position de draft, mesurée sur N games de
                        7 corpus pros) redresse le % brut sans changer l'ordre des candidats ; elle ne
                        s'applique que si sa position a passé son verdict chiffré, sinon le % brut reste
                        affiché avec « Non calibré ».
                    </p>
                    <p>
                        Deux approximations d'application, déclarées avec la mesure : (a) la calibration est
                        mesurée à trois ancres — 0, 3 et 10 picks verrouillés — et une position intermédiaire
                        reçoit la carte de l'ancre que la partition lui assigne (0 pick → après bans ; 1 à 6
                        → après 3 picks ; 7 à 10 → draft complète), jamais une interpolation ; (b) le % du
                        coach passe par des rôles inférés (en mode séquence, le rôle le plus probable d'après
                        les priors de rôle), alors que la mesure utilise les rôles réels du corpus — l'écart
                        d'attribution de rôles n'est pas couvert par la mesure.
                    </p>
                </dd>
            </div>
        </dl>
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
