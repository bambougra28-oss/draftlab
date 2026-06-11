<!--
/**
 * Chantier « entraînement de prépa » — drill de répertoire sur l'arbre compilé.
 *
 * Le pendant Chessable du Script de prep (gate D verte) : on rejoue ses lignes
 * PRÉPARÉES jusqu'à les connaître, et l'outil dit où on se trompe. Monté par
 * /plans/[id] sous le résumé d'arbre, UNIQUEMENT quand un arbre compilé existe
 * (la page le garde derrière `{#if tree !== null}` + {#key} sur builtAt :
 * recompiler réinitialise la session).
 *
 * Toute la logique est dans $lib/strategic/planDrill (pur, rng injecté) — le
 * composant ne fait que dérouler : choix du mode (3 radios), défis (« Ils
 * jouent X — 31 %, 4 des 6 dernières » → réponse via ChampionPicker en
 * overlay, pattern de la page), feedback immédiat vert/ambre/rouge, bilan
 * final avec la liste « à retravailler ».
 *
 * Honnêteté : badge « Entraînement » (pas Expérimental — aucun claim, c'est un
 * exerciseur) ; le cadrage rappelle que le drill ne travaille QUE les lignes
 * préparées et que le hors-script reste le rôle du coach live (mesuré, gate D).
 *
 * Rng : mulberry32(session) — le compteur de session re-seed à chaque
 * « Rejouer » : déterministe PAR essai, varié ENTRE essais (mode pondéré).
 *
 * v1 : score de session uniquement, AUCUNE persistance. v2 envisagée :
 * répétition espacée (persister les lignes ratées et les réinterroger en
 * priorité aux sessions suivantes, façon Chessable).
 */
-->
<script lang="ts">
    import { evidenceString } from '$lib/aggregates/tendency';
    import { championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';
    import ChampionPicker from '$lib/components/ChampionPicker.svelte';
    import { mulberry32 } from '$lib/backtest/metrics';
    import {
        answer as drillAnswer,
        currentChallenge,
        drillSummary,
        hasChallenges,
        startDrill,
        type AnswerResult,
        type DrillMode,
        type DrillState,
        type DrillStep
    } from '$lib/strategic/planDrill';
    import type { PlanTree } from '$lib/strategic/planTree';

    interface Props {
        tree: PlanTree;
        /** Nom du plan source (« Plan A contre KOI »). */
        planName?: string;
    }
    let { tree, planName }: Props = $props();

    let mode = $state<DrillMode>('principale');
    /** Compteur de session : passé au seed mulberry32 à chaque démarrage. */
    let session = $state(0);
    let drill = $state<DrillState | null>(null);
    let lastResult = $state<AnswerResult | null>(null);
    let pickerOpen = $state(false);

    const nameOf = (key: string): string => championNameByKey(key) ?? key;
    const pct = (p: number): string => `${Math.round(p * 100)} %`;

    const MODES: { value: DrillMode; label: string; hint: string }[] = [
        {
            value: 'principale',
            label: 'Ligne principale',
            hint: 'À chaque tour adverse, leur réponse la plus probable — la ligne principale du répertoire.'
        },
        {
            value: 'pondere',
            label: 'Pondéré',
            hint: 'Leur réponse est tirée selon les probabilités du modèle — varié à chaque essai, comme en match.'
        },
        {
            value: 'exhaustif',
            label: 'Exhaustif',
            hint: 'Toutes les lignes de l’arbre, l’une après l’autre — pour les connaître encore et encore.'
        }
    ];

    const challenge = $derived(drill === null ? null : currentChallenge(drill));
    const summary = $derived(drill === null ? null : drillSummary(drill));

    /**
     * Détection AVANT de démarrer : un arbre sans AUCUNE réponse préparée
     * (plan vide compilé sans évaluateur) donnerait « Session terminée —
     * 0 ligne jouée » ; on affiche l'état vide honnête à la place.
     */
    const drillable = $derived(hasChallenges(tree));

    function start(onlyLines?: number[]): void {
        session += 1;
        drill = startDrill(tree, {
            mode,
            rng: mulberry32(session),
            ...(onlyLines !== undefined ? { onlyLines } : {})
        });
        lastResult = null;
        pickerOpen = false;
    }

    function respond(championKey: string): void {
        if (drill === null || drill.done) return;
        lastResult = drillAnswer(drill, championKey);
        drill = lastResult.state;
        pickerOpen = false;
    }

    /** Re-drill restreint aux lignes fautées (identités DFS stables de la lib). */
    function replayMisses(): void {
        const failed = summary?.failedLineIndexes ?? [];
        if (failed.length === 0) return;
        start(failed);
    }

    function stop(): void {
        drill = null;
        lastResult = null;
        pickerOpen = false;
    }

    /** Indisponibles au picker : exclusions + chemin joué + branches révélées. */
    const disabledKeys = $derived.by((): string[] => {
        if (challenge === null) return [];
        return [
            ...tree.excludedKeys,
            ...challenge.pathSoFar.map((s) => s.championKey),
            ...challenge.enemyMovesJustPlayed.map((m) => m.championKey)
        ];
    });

    const VERDICT_MARK: Record<string, string> = { primaire: '✓', fallback: '≈', faux: '✗' };
    const VERDICT_CLS: Record<string, string> = {
        primaire: 'text-emerald-400',
        fallback: 'text-amber-400',
        faux: 'text-rose-400'
    };

    const feedback = $derived.by((): { cls: string; text: string } | null => {
        const result = lastResult;
        if (result === null) return null;
        const expected = result.expected;
        if (result.correct === 'primaire') {
            return { cls: 'border-emerald-700/40 bg-emerald-950/30 text-emerald-300', text: 'Exact (primaire).' };
        }
        if (result.correct === 'fallback') {
            return {
                cls: 'border-amber-700/40 bg-amber-950/30 text-amber-300',
                text: `C'était le fallback — primaire : ${nameOf(expected.championKey)}.`
            };
        }
        const why =
            expected.reasonsFr !== undefined && expected.reasonsFr.length > 0
                ? ` — pourquoi : ${expected.reasonsFr.join(' · ')}`
                : '';
        const repli = expected.fallback !== undefined ? ` (fallback ${nameOf(expected.fallback)})` : '';
        return {
            cls: 'border-rose-700/40 bg-rose-950/30 text-rose-300',
            text: `La prépa disait ${nameOf(expected.championKey)}${repli}${why}.`
        };
    });
</script>

{#snippet stepIcons(steps: readonly DrillStep[])}
    <div class="flex flex-wrap items-center gap-1">
        {#each steps as step, i (i)}
            <span class="flex flex-col items-center" title={`${step.by === 'nous' ? 'Nous' : 'Eux'} — ${step.type === 'ban' ? 'ban' : 'pick'} ${nameOf(step.championKey)}`}>
                <span class="relative flex items-center justify-center">
                    <ChampionIcon
                        championKey={step.championKey}
                        size={26}
                        grayscale={step.type === 'ban'}
                        ring={step.by === 'nous' ? tree.ourSide : tree.ourSide === 'blue' ? 'red' : 'blue'}
                    />
                    {#if step.type === 'ban'}
                        <span class="absolute text-sm font-bold text-slate-200/90">×</span>
                    {/if}
                </span>
                <span class="h-3 text-[9px] leading-3 {step.verdict !== undefined ? VERDICT_CLS[step.verdict] : 'text-slate-600'}">
                    {step.verdict !== undefined ? VERDICT_MARK[step.verdict] : step.by === 'eux' ? 'eux' : ''}
                </span>
            </span>
        {/each}
    </div>
{/snippet}

<section class="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
    <h2 class="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
        S'entraîner sur ce script{planName !== undefined ? ` — ${planName}` : ''} contre {tree.opponent}
        <span class="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold tracking-normal text-slate-300 normal-case">
            Entraînement
        </span>
    </h2>

    <!-- Cadrage honnête : le drill travaille les lignes PRÉPARÉES, point. -->
    <p class="text-[11px] leading-relaxed text-slate-500">
        Le drill travaille les lignes <span class="font-semibold text-slate-400">préparées</span> de l'arbre
        (couverture mesurée par la gate : à 4 branches, le script tient 0,725 en profondeur moyenne contre
        0,588 pour un arbre ligue). Hors script en match réel, le coach en direct reprend la main — c'est
        mesuré aussi.
    </p>

    {#if drill === null}
        {#if !drillable}
            <!-- ── État vide honnête : rien à driller, on le dit AVANT de démarrer ── -->
            <div class="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-3 text-xs leading-relaxed text-slate-400">
                Cet arbre n'a aucune réponse préparée à driller — votre plan n'a pas de picks/bans
                renseignés (ou l'arbre a été compilé sans évaluateur). Générez la prépa ou remplissez le
                plan, puis recompilez.
            </div>
        {:else}
        <!-- ── Choix du mode + Démarrer ─────────────────────────────────── -->
        <fieldset class="space-y-1.5">
            <legend class="sr-only">Mode d'entraînement</legend>
            {#each MODES as m (m.value)}
                <label
                    class="flex cursor-pointer items-baseline gap-2 rounded-md px-2 py-1.5 {mode === m.value
                        ? 'bg-blue-500/10 ring-1 ring-blue-700/40'
                        : 'hover:bg-slate-800/60'}"
                >
                    <input type="radio" name="drill-mode" value={m.value} bind:group={mode} class="accent-blue-500" />
                    <span class="text-xs font-semibold text-slate-200">{m.label}</span>
                    <span class="text-[11px] text-slate-500">{m.hint}</span>
                </label>
            {/each}
        </fieldset>
        <button
            type="button"
            onclick={() => start()}
            class="rounded-md bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-300 ring-1 ring-blue-600/50 hover:bg-blue-500/25"
        >
            Démarrer le drill
        </button>
        {/if}
    {:else}
        <!-- ── Feedback immédiat (persiste jusqu'à la réponse suivante) ──── -->
        {#if feedback !== null}
            <div class="rounded-lg border p-2 text-xs {feedback.cls}">{feedback.text}</div>
        {/if}

        {#if lastResult !== null && lastResult.lineComplete && lastResult.completedLineSteps !== undefined}
            <div class="rounded-lg border border-slate-700/60 bg-slate-950/40 p-2">
                <p class="pb-1 text-[11px] font-semibold text-slate-400">
                    {lastResult.done ? 'Dernière ligne terminée.' : 'Ligne terminée — ligne suivante.'}
                </p>
                {@render stepIcons(lastResult.completedLineSteps)}
            </div>
        {/if}

        {#if challenge !== null}
            <!-- ── Le défi courant ──────────────────────────────────────── -->
            <div class="flex items-center justify-between">
                <p class="text-[11px] text-slate-500">
                    {#if challenge.lineCount > 1}
                        Ligne {challenge.lineIndex + 1} sur {challenge.lineCount} ·
                    {/if}
                    ✓ {drill.counts.primaire} · ≈ {drill.counts.fallback} · ✗ {drill.counts.faux}
                </p>
                <button
                    type="button"
                    onclick={stop}
                    class="rounded px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-800 hover:text-slate-300"
                >
                    Arrêter
                </button>
            </div>

            {#if challenge.pathSoFar.length > 0}
                <div>
                    <p class="pb-1 text-[10px] font-semibold tracking-widest text-slate-600 uppercase">Le chemin joué</p>
                    {@render stepIcons(challenge.pathSoFar)}
                </div>
            {/if}

            {#if challenge.enemyMovesJustPlayed.length === 0}
                <p class="text-xs text-slate-400">
                    L'ouverture : aucune action adverse encore — votre premier coup préparé.
                </p>
            {:else}
                {#each challenge.enemyMovesJustPlayed as move (move.seq)}
                    <div class="flex items-center gap-2 rounded-md bg-slate-800/50 px-2 py-1.5">
                        <ChampionIcon championKey={move.championKey} size={26} grayscale={move.type === 'ban'} />
                        <p class="text-sm text-slate-200">
                            Ils {move.type === 'ban' ? 'bannissent' : 'jouent'}
                            <span class="font-semibold">{nameOf(move.championKey)}</span>
                            <span class="text-xs text-slate-400">— {pct(move.p)}, {evidenceString(move)}</span>
                        </p>
                    </div>
                {/each}
            {/if}

            <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold text-slate-100">Votre réponse préparée ?</p>
                <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {challenge.type === 'ban' ? 'ban' : 'pick'}
                </span>
                <button
                    type="button"
                    onclick={() => (pickerOpen = true)}
                    class="rounded-md bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-300 ring-1 ring-blue-600/50 hover:bg-blue-500/25"
                >
                    Choisir le champion…
                </button>
            </div>
        {:else if summary !== null}
            <!-- ── Bilan de fin de session ──────────────────────────────── -->
            <div class="rounded-lg border border-slate-700/60 bg-slate-950/40 p-2.5">
                <p class="text-sm font-semibold text-slate-100">
                    Session terminée — {summary.linesPlayed} ligne{summary.linesPlayed > 1 ? 's' : ''} jouée{summary.linesPlayed > 1 ? 's' : ''}.
                </p>
                <p class="pt-1 text-xs text-slate-300">
                    <span class="text-emerald-400">✓ {summary.counts.primaire} primaire{summary.counts.primaire > 1 ? 's' : ''}</span>
                    · <span class="text-amber-400">≈ {summary.counts.fallback} fallback{summary.counts.fallback > 1 ? 's' : ''}</span>
                    · <span class="text-rose-400">✗ {summary.counts.faux} faute{summary.counts.faux > 1 ? 's' : ''}</span>
                </p>
            </div>

            {#if summary.misses.length > 0}
                <div>
                    <p class="pb-1 text-[10px] font-semibold tracking-widest text-rose-400/80 uppercase">
                        Lignes à retravailler
                    </p>
                    <ol class="space-y-2">
                        {#each summary.misses as miss, i (i)}
                            <li class="rounded-md border border-rose-900/40 bg-rose-950/20 p-2">
                                {@render stepIcons(miss.pathSteps)}
                                <p class="pt-1 text-[11px] text-slate-300">
                                    Eux : {miss.enemyPath.length > 0
                                        ? miss.enemyPath.map(nameOf).join(' → ')
                                        : '(ouverture, aucune action adverse)'}
                                    · vous : <span class="font-semibold text-rose-300">{nameOf(miss.answered)}</span>
                                    · la prépa : <span class="font-semibold text-emerald-300">{nameOf(miss.expected.championKey)}</span>{miss.expected.fallback !== undefined
                                        ? ` (fallback ${nameOf(miss.expected.fallback)})`
                                        : ''}
                                </p>
                                {#if miss.expected.reasonsFr !== undefined && miss.expected.reasonsFr.length > 0}
                                    <p class="pt-0.5 text-[11px] text-slate-500 italic">
                                        pourquoi : {miss.expected.reasonsFr.join(' · ')}
                                    </p>
                                {/if}
                            </li>
                        {/each}
                    </ol>
                </div>
            {:else}
                <p class="text-xs text-emerald-300">Aucune faute — le script est connu sur ces lignes.</p>
            {/if}

            <div class="flex flex-wrap gap-2">
                <button
                    type="button"
                    onclick={() => start()}
                    class="rounded-md bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-300 ring-1 ring-blue-600/50 hover:bg-blue-500/25"
                >
                    Rejouer
                </button>
                {#if summary.mode === 'exhaustif' && summary.failedLineIndexes.length > 0}
                    <button
                        type="button"
                        onclick={replayMisses}
                        class="rounded-md bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-600/50 hover:bg-rose-500/25"
                    >
                        Rejouer seulement les ratés ({summary.failedLineIndexes.length})
                    </button>
                {/if}
                <button
                    type="button"
                    onclick={stop}
                    class="rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                >
                    Changer de mode
                </button>
            </div>
        {/if}
    {/if}

    <p class="text-[10px] text-slate-600">
        Score de session uniquement — rien n'est enregistré. (v2 envisagée : répétition espacée des
        lignes ratées entre sessions.)
    </p>

    <!-- ── Overlay de réponse (ChampionPicker, pattern de la page) ───────── -->
    {#if pickerOpen && challenge !== null}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
                type="button"
                onclick={() => (pickerOpen = false)}
                class="absolute inset-0 bg-black/60"
                aria-label="Fermer le sélecteur"
            ></button>
            <div class="relative w-full max-w-md">
                <div class="flex items-center justify-between rounded-t-lg border border-b-0 border-slate-700 bg-slate-900 px-3 py-2">
                    <p class="text-sm font-semibold text-slate-200">
                        Votre {challenge.type === 'ban' ? 'ban' : 'pick'} préparé (seq {challenge.seq})
                    </p>
                    <button
                        type="button"
                        onclick={() => (pickerOpen = false)}
                        class="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                    >
                        Fermer
                    </button>
                </div>
                <ChampionPicker {disabledKeys} onSelect={(key) => respond(key)} />
            </div>
        </div>
    {/if}
</section>
