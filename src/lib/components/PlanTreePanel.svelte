<!--
/**
 * Chantier D (run #2) — Lecture de l'arbre de prep en mode séquence (§2.6).
 *
 * Trois blocs verticaux : 1. la ligne de vie (chips des actions adverses vues,
 * statut en clair), 2. « Maintenant » (notre réponse préparée OU les branches
 * attendues, avec l'évidence à un clic — comptes bruts, jamais de logits),
 * 3. la bannière de déviation (handover explicite vers le coach en direct +
 * « Recompiler le script d'ici », proposé dès our-deviation).
 *
 * DEUX NOMBRES, JAMAIS CONFONDUS :
 *  - la couverture du MODÈLE, mesurée par la gate pré-enregistrée (K = 4) —
 *    la seule autorisée à se formuler « le script tient en moyenne X actions
 *    adverses » ; tant qu'elle n'est pas publiée (gateCoverage null), AUCUN
 *    chiffre n'est inventé et le badge reste Expérimental ;
 *  - la masse couverte par CET arbre par profondeur adverse (Σ pathMass des
 *    nœuds étendus) — propriété du compile (budget, plancher), jamais
 *    formulée en « tenue moyenne ».
 * Partout où un chiffre de couverture s'affiche, la ligne de caveat blue-first
 * l'accompagne (§3 risque 9).
 *
 * Après un our-deviation (branchesAuthoritative === false), le bloc « Attendu
 * chez eux » passe en « indicatif » et ne cite plus AUCUN chiffre de la gate ;
 * une their-deviation postérieure garde le wording neutre du tracker (§2.3).
 *
 * Monté par la page draft UNIQUEMENT en entryMode 'sequence' + format 'pro'
 * (les bans SoloQ sont des exclusions simultanées, pas des actions ordonnées
 * — §2.7 : le panneau est masqué en soloq avec une ligne d'explication côté
 * page). Composant pur affichage : tree + track injectés, recompile déléguée.
 */
-->
<script lang="ts">
    import { evidenceString } from '$lib/aggregates/tendency';
    import { championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';
    import { massByEnemyDepth, type PlanTree } from '$lib/strategic/planTree';
    import type { PlanTrackState } from '$lib/strategic/planTracker';

    interface Props {
        tree: PlanTree;
        track: PlanTrackState;
        /** Nom du plan source (affichage « Plan A contre KOI »). */
        planName?: string;
        /** Relance compilePlanTree depuis l'état courant (« Recompiler d'ici »). */
        onRecompile?: () => void;
        recompiling?: boolean;
        /**
         * Verdict de la gate pré-enregistrée (docs/calibration) — null tant
         * que le run n'est pas publié → badge Expérimental, aucun chiffre.
         */
        gateVerdict?: 'vert' | 'rouge' | null;
        /**
         * Profondeur moyenne tenue MESURÉE (gate, K = 4) : modèle vs ligue.
         * Null tant que la courbe n'est pas publiée — rien d'inventé.
         */
        gateCoverage?: { model: number; baseline: number } | null;
    }

    let {
        tree,
        track,
        planName,
        onRecompile,
        recompiling = false,
        gateVerdict = null,
        gateCoverage = null
    }: Props = $props();

    const nameOf = (key: string): string => championNameByKey(key) ?? key;
    const pct = (p: number): string => `${Math.round(p * 100)} %`;

    const CAVEAT =
        'Mesuré sous entrelacement supposé blue-first : ordre intra-équipe exact, alternance entre ' +
        'équipes conventionnelle — biais partagé par les deux bras, noté dans le rapport.';

    /** Masse couverte par CET arbre, par profondeur adverse (Σ pathMass). */
    const depthMass = $derived(massByEnemyDepth(tree.root));

    /** Chips de la ligne de vie : une par action adverse vue (✓ ou ✗). */
    const chips = $derived.by(() => {
        const out: { label: string; ok: boolean }[] = [];
        for (let i = 0; i < track.enemyMatched; i++) out.push({ label: `${i + 1}`, ok: true });
        if (track.breakingAction !== undefined && !track.breakingAction.byUs) {
            out.push({ label: nameOf(track.breakingAction.championKey), ok: false });
        }
        return out;
    });

    const deviated = $derived(track.status === 'our-deviation' || track.status === 'their-deviation');
    const indicatif = $derived(!track.branchesAuthoritative);

    /** Blanc pour les choix proches (convention solver) : favori net seulement. */
    const clearFavorite = $derived.by(() => {
        const [first, second] = track.expectedBranches;
        if (first === undefined) return false;
        return first.p - (second?.p ?? 0) >= 0.05;
    });

    const badge = $derived.by(() => {
        if (gateVerdict === 'vert')
            return { label: 'Couverture adverse mesurée', cls: 'bg-emerald-500/15 text-emerald-300' };
        if (gateVerdict === 'rouge')
            return { label: 'Répertoire de ligue — claim équipe non validé', cls: 'bg-rose-500/15 text-rose-300' };
        return { label: 'Expérimental — gate non publiée', cls: 'bg-amber-500/15 text-amber-400' };
    });

    const statusLabel = $derived.by((): string => {
        switch (track.status) {
            case 'not-started':
                return 'Script prêt';
            case 'on-script':
                return 'Dans le script';
            case 'our-deviation':
                return 'Vous avez quitté votre ligne';
            case 'their-deviation':
                return 'Ils ont dévié';
            case 'beyond-prep':
                return 'Fin de la prep — le coach continue';
            case 'complete':
                return 'Draft terminée';
        }
    });

    const provenance = $derived.by(() => {
        const p = tree.modelProvenance;
        const patch = p.latestPatch !== undefined ? `, patch ≤ ${p.latestPatch}` : '';
        const league = p.league !== undefined ? ` (${p.league.toUpperCase()})` : '';
        return `modèle : ${p.records} games ${tree.opponent}${league}${patch}`;
    });
</script>

<section class="panel space-y-3 p-3">
    <!-- ── Bloc 1 : la ligne de vie ─────────────────────────────────────── -->
    <div>
        <h2 class="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
            Script de prep — {planName ?? 'plan'} contre {tree.opponent}
            <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal {badge.cls}">
                {badge.label}
            </span>
        </h2>
        <div class="flex flex-wrap items-center gap-1.5 pt-2">
            <span
                class="rounded-md px-2 py-0.5 text-xs font-semibold {track.status === 'on-script' ||
                track.status === 'not-started'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : deviated
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-slate-800 text-slate-300'}"
            >
                {statusLabel}
            </span>
            {#each chips as chip, i (i)}
                <span
                    class="rounded px-1.5 py-0.5 text-[11px] font-semibold {chip.ok
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-rose-500/15 text-rose-300'}"
                    title={chip.ok ? `Leur action n°${chip.label} : dans les branches` : 'Hors des branches'}
                >
                    {chip.ok ? `✓ ${chip.label}` : `✗ ${chip.label}`}
                </span>
            {/each}
        </div>
        <p class="pt-1.5 text-xs text-slate-400">{track.headlineFr}</p>
        <p class="pt-0.5 text-[10px] text-slate-600">Provenance — {provenance}.</p>
    </div>

    <!-- ── Bloc 3 (prioritaire visuellement) : bannière de déviation ───────── -->
    {#if deviated}
        <div class="rounded-lg border border-amber-700/40 bg-amber-950/30 p-2.5">
            <p class="text-xs text-amber-200">
                {track.headlineFr}
                {#if track.status === 'their-deviation'}
                    Le coach en direct (panneau ci-dessous) reprend la main sur l'état réel.
                {/if}
            </p>
            {#if track.status === 'their-deviation' && track.branchesAuthoritative && gateCoverage !== null}
                <p class="pt-1 text-[10px] text-amber-300/70">
                    Sortir du script n'est pas un échec de prep : sur les drafts pro mesurées, le script
                    tient en moyenne {gateCoverage.model.toFixed(1).replace('.', ',')} actions adverses
                    (vs {gateCoverage.baseline.toFixed(1).replace('.', ',')} pour un arbre ligue) — casser
                    fait partie du jeu, l'alarme vous dit QUAND réfléchir à neuf.
                </p>
                <p class="pt-0.5 text-[10px] text-amber-300/50">{CAVEAT}</p>
            {/if}
            {#if onRecompile !== undefined}
                <button
                    type="button"
                    onclick={onRecompile}
                    disabled={recompiling}
                    class="mt-2 rounded-md bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-600/50 hover:bg-amber-500/25 disabled:opacity-50"
                >
                    {recompiling ? 'Recompilation…' : 'Recompiler le script d’ici'}
                </button>
                <span class="pl-2 text-[10px] text-amber-300/60">
                    Recompiler depuis l'état réel est la seule façon de rendre les branches à nouveau garanties.
                </span>
            {/if}
        </div>
    {:else if track.status === 'beyond-prep'}
        <div class="rounded-lg border border-slate-700/60 bg-slate-900/60 p-2.5">
            <p class="text-xs text-slate-300">
                Fin de la prep — l'horizon de l'arbre est atteint sans casse (normal en phase 2 : elle est
                réactive par nature). Le coach en direct continue ci-dessous.
            </p>
        </div>
    {/if}

    <!-- ── Bloc 2 : Maintenant ──────────────────────────────────────────── -->
    {#if track.status !== 'complete'}
        <div>
            {#if track.nextPrepared !== null}
                <p class="pb-1 text-xs font-semibold text-slate-300">Votre réponse préparée</p>
                <div class="flex items-center gap-2 rounded-md bg-slate-800/50 px-2 py-1.5">
                    <ChampionIcon championKey={track.nextPrepared.championKey} size={26} />
                    <span class="text-sm font-semibold text-slate-100">
                        {nameOf(track.nextPrepared.championKey)}
                    </span>
                    <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {track.nextPrepared.type === 'ban' ? 'ban' : 'pick'}
                    </span>
                    {#if track.nextPrepared.fallback !== undefined}
                        <span class="text-[11px] text-slate-500">
                            repli : {nameOf(track.nextPrepared.fallback)}
                        </span>
                    {/if}
                </div>
                {#if track.nextPrepared.reasonsFr !== undefined && track.nextPrepared.reasonsFr.length > 0}
                    <p class="pt-1 pl-1 text-[11px] text-slate-500 italic">
                        {track.nextPrepared.reasonsFr.join(' · ')}
                    </p>
                {/if}
            {/if}

            {#if track.expectedBranches.length > 0}
                <p class="pt-2 pb-1 text-xs font-semibold text-slate-300">
                    {#if track.status === 'their-deviation'}
                        Branches qui étaient préparées à ce tour
                    {:else if indicatif}
                        Attendu chez eux (indicatif — vous avez quitté le script)
                    {:else}
                        Attendu chez eux
                    {/if}
                </p>
                <ol class="space-y-1">
                    {#each track.expectedBranches as branch, i (branch.championKey)}
                        <li
                            class="flex flex-wrap items-center gap-2 rounded-md px-2 py-1 {i === 0 && clearFavorite && !indicatif
                                ? 'bg-blue-500/10 ring-1 ring-blue-700/40'
                                : 'bg-slate-800/40'}"
                        >
                            <span class="w-4 text-right font-mono text-[11px] text-slate-500">{i + 1}.</span>
                            <ChampionIcon championKey={branch.championKey} size={22} />
                            <span class="text-xs text-slate-200">{nameOf(branch.championKey)}</span>
                            <span class="font-mono text-[11px] text-slate-300">{pct(branch.p)}</span>
                            <span class="text-[10px] text-slate-500 italic">{evidenceString(branch)}</span>
                            {#if branch.exampleGameIds !== undefined && branch.exampleGameIds.length > 0}
                                <span
                                    class="cursor-help text-[10px] text-blue-400/80 underline decoration-dotted"
                                    title={`Games d'exemple : ${branch.exampleGameIds.join(', ')}`}
                                >
                                    voir les games
                                </span>
                            {/if}
                        </li>
                    {/each}
                </ol>
                {#if !clearFavorite && track.expectedBranches.length > 1 && !indicatif}
                    <p class="pt-1 text-[10px] text-slate-600">
                        Choix proches chez eux — pas de favori net, préparez les {track.expectedBranches.length} réponses.
                    </p>
                {/if}
            {/if}
        </div>
    {/if}

    <!-- ── Les DEUX nombres, jamais confondus ───────────────────────────── -->
    <div class="border-t border-slate-800/60 pt-2">
        <p class="pb-1 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
            Masse couverte par CET arbre (Σ pathMass par profondeur adverse)
        </p>
        <div class="flex flex-wrap items-center gap-1.5">
            {#each depthMass as mass, depth (depth)}
                <span class="rounded bg-slate-800/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                    a{depth + 1} : {pct(mass)}
                </span>
            {/each}
        </div>
        <p class="pt-1 text-[10px] text-slate-600">
            Propriété du compile (budget {tree.config.maxNodes} nœuds, plancher {pct(tree.config.minPathMass)},
            K = {tree.config.branchK}) — ce n'est PAS une couverture mesurée.
        </p>
        <p class="pt-1 text-[10px] text-slate-500">
            {#if gateCoverage !== null}
                Couverture du MODÈLE (gate, K = 4) : le script tient en moyenne
                {gateCoverage.model.toFixed(1).replace('.', ',')} actions adverses, contre
                {gateCoverage.baseline.toFixed(1).replace('.', ',')} pour un arbre ligue.
            {:else}
                Couverture du modèle : pas encore mesurée — la gate pré-enregistrée doit tourner avant
                d'afficher le moindre chiffre de tenue (badge Expérimental).
            {/if}
        </p>
        <p class="pt-0.5 text-[10px] text-slate-600 italic">{CAVEAT}</p>
    </div>

    <!-- ── Pédagogie ─────────────────────────────────────────────────────── -->
    <details class="text-xs text-slate-400">
        <summary class="cursor-pointer text-[11px] font-semibold text-slate-500 select-none">Comment lire ?</summary>
        <div class="space-y-1.5 pt-2 text-[11px] leading-relaxed text-slate-500">
            <p>
                Un script qui casse n'est PAS une prep ratée — une part des drafts pro sort aussi du script
                à cette profondeur{gateCoverage !== null
                    ? ' (la courbe publiée de la gate donne le chiffre exact par profondeur)'
                    : ' (chiffre à venir : la gate pré-enregistrée publiera la courbe)'}. L'arbre sert à
                répondre VITE tant qu'il tient, et à voir le MOMENT où il faut réfléchir à neuf.
            </p>
            <p>
                « 31 % · 4 des 6 dernières » : le pourcentage est la masse du modèle de tendances, le
                compte brut est l'évidence réelle — fiez-vous aux comptes (et aux games d'exemple, à un
                clic), pas aux pourcentages seuls.
            </p>
            <p>
                Deux nombres distincts : la masse couverte par CET arbre (propriété de compilation,
                ci-dessus) et la couverture du MODÈLE (mesurée par la gate sur corpus réels) — le panneau
                ne les mélange jamais.
            </p>
            <p>
                Limite assumée : une équipe qui se sait lue peut casser ses habitudes — la première défense
                est l'alarme elle-même (vous savez immédiatement que la prep ne s'applique plus).
            </p>
            <p>Arbre disponible en draft tournoi uniquement (les bans SoloQ sont simultanés, sans ordre).</p>
        </div>
    </details>
</section>
