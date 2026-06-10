<!--
/**
 * C1 — Annotated draft review board (I5 annotator).
 *
 * Renders one DraftAnnotation in the chess-review grammar: a seq-ordered
 * timeline of the reviewed side's decisions with the wide-band grades
 * ('' / ?! / ? / ??), EV losses in win-probability pp, "mieux était X" only
 * when the annotator emitted it, the gated informational notes, then the team
 * summary (total loss + costliest seq) and the cross-game leak report.
 * Suppressed near-equal choices keep their numbers but carry no nag (the
 * genre's honesty convention). Badged « Expérimental » (DA-V2-11: the oracle
 * is a noisy evaluator — wide bands ARE the honesty condition). Pure display.
 */
-->
<script lang="ts">
    import type { AnnotationGrade, DraftAnnotation, LeakEntry } from '$lib/review/annotator';
    import { championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';

    interface Props {
        annotation: DraftAnnotation;
        leaks?: LeakEntry[];
        title?: string;
    }

    let { annotation, leaks = [], title = 'Revue annotée' }: Props = $props();

    const GRADE_META: Record<Exclude<AnnotationGrade, ''>, { label: string; cls: string }> = {
        '?!': { label: '?! imprécision', cls: 'bg-amber-500/15 text-amber-400' },
        '?': { label: '? erreur', cls: 'bg-orange-500/15 text-orange-400' },
        '??': { label: '?? blunder', cls: 'bg-red-500/20 text-red-300' }
    };

    const PHASE_LABELS: Record<string, string> = {
        ban1: 'Bans 1',
        pick1: 'Picks 1',
        ban2: 'Bans 2',
        pick2: 'Picks 2'
    };

    const fmtPp = (value: number): string => value.toFixed(1).replace('.', ',');

    const nameOf = (key: string, fallback: string): string => championNameByKey(key) ?? fallback;

    const sideLabel = $derived(annotation.teamSummary.side === 'blue' ? 'bleu' : 'rouge');
</script>

<section class="panel p-3">
    <h2 class="flex items-center gap-2 pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
        {title}
        <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 normal-case tracking-normal">
            Expérimental
        </span>
        <span class="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400 normal-case tracking-normal">
            côté {sideLabel}
        </span>
    </h2>

    {#if annotation.actions.length === 0}
        <p class="text-xs text-slate-600">Aucune action résolue à annoter pour ce côté.</p>
    {:else}
        <!-- Team summary -->
        <p class="pb-2 text-sm text-slate-300">
            Perte totale :
            <span class="font-mono font-semibold {annotation.teamSummary.totalLossPp > 0 ? 'text-red-300' : 'text-slate-200'}">
                −{fmtPp(annotation.teamSummary.totalLossPp)} pp
            </span>
            {#if annotation.teamSummary.worstSeq !== null}
                <span class="pl-2 text-xs text-slate-500">
                    décision la plus coûteuse : seq {annotation.teamSummary.worstSeq}
                </span>
            {/if}
        </p>

        <!-- Seq-ordered decision timeline -->
        <ol class="space-y-1">
            {#each annotation.actions as action (action.seq)}
                <li class="rounded-md bg-slate-800/40 px-2 py-1.5">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="w-12 shrink-0 font-mono text-[10px] text-slate-600">seq {action.seq}</span>
                        <span class="w-14 shrink-0 text-[10px] text-slate-500">
                            {PHASE_LABELS[action.phase] ?? action.phase}
                        </span>
                        <ChampionIcon
                            championKey={action.championKey}
                            size={24}
                            grayscale={action.actionType === 'ban'}
                        />
                        <span class="text-xs text-slate-200">
                            {action.actionType === 'ban' ? 'Ban' : 'Pick'}
                            {nameOf(action.championKey, action.championName)}
                        </span>
                        {#if action.grade !== ''}
                            <span class="rounded-full px-2 py-0.5 text-[10px] font-bold {GRADE_META[action.grade].cls}">
                                {GRADE_META[action.grade].label}
                            </span>
                        {/if}
                        <span class="ml-auto font-mono text-[11px] {action.evLossPp > 0 ? 'text-red-300' : 'text-slate-500'}">
                            −{fmtPp(action.evLossPp)} pp
                        </span>
                        {#if action.suppressed}
                            <span class="text-[10px] text-slate-600" title="Choix quasi équivalents — aucun reproche affiché">
                                ≈ équivalent
                            </span>
                        {/if}
                    </div>
                    {#if action.betterWas !== undefined}
                        <p class="pt-1 pl-12 text-[11px] text-slate-400">
                            Mieux était
                            <span class="font-semibold text-slate-200">
                                {nameOf(action.betterWas.championKey, action.betterWas.championKey)}
                            </span>
                            (+{fmtPp(action.betterWas.gainPp)} pp récupérables).
                        </p>
                    {/if}
                    {#each action.notesFr as note, i (i)}
                        <p class="pt-0.5 pl-12 text-[11px] text-slate-500">ⓘ {note}</p>
                    {/each}
                </li>
            {/each}
        </ol>

        <!-- Leak report -->
        {#if leaks.length > 0}
            <div class="pt-3">
                <p class="pb-1 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
                    Fuites récurrentes (leak report)
                </p>
                <ul class="space-y-1">
                    {#each leaks as leak (leak.patternFr)}
                        <li class="rounded-md border-l-2 border-amber-500/40 bg-slate-800/40 px-2 py-1.5 text-xs">
                            <span class="text-slate-200">{leak.patternFr}</span>
                            <span class="pl-2 text-slate-500">
                                ×{leak.occurrences} · −{fmtPp(leak.totalCostPp)} pp ·
                                games {leak.exampleGameIds.join(', ')}
                            </span>
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}

        <p class="pt-2 text-[10px] text-slate-600">
            Grades en points de win % (bandes larges ?!/?/?? ≈ −1/−2/−3 pp) — oracle bruité : les choix
            quasi équivalents ne sont jamais reprochés.
        </p>
    {/if}
</section>
