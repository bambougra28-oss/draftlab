<!--
/**
 * Chantier F — Panneau « Tes pockets » (docs/run2/F-pocket-picks.md §4, gelé).
 *
 * Trois blocs, props PURES (tout est calculé par l'appelant) :
 *  1. RÉSERVOIR : surprises en bits — étiquette OBLIGATOIRE « surprise vs
 *     données publiques » (lecture du modèle public, JAMAIS un claim de pool
 *     privé) + checklist d'activation dont chaque item CITE sa dimension de
 *     tag source ;
 *  2. GARDER / DÉPENSER : composants SÉPARÉS (DA-V2-12), chacun badgé
 *     Expérimental (DA-V2-11) — prix de série γ·ΔS (masqué si wantProbability
 *     absente : chemin C-ROUGE, le composant le dit), coût de révélation I2,
 *     appât I2 ;
 *  3. CÔTÉ ADVERSE : dark pool (lecture pondérée par rôle) + alerte
 *     pick-préparé badgée « Expérimental — F2 non verte ».
 *
 * Badge Expérimental GLOBAL tant que F1 n'est pas VERTE. Caveat permanent :
 * corrélation, jamais causalité. « Comment lire ? » pédagogique avec le cas
 * fondateur G2-Nasus (Skewmond, finale LEC 2026, G5, séquence corrigée
 * KC-G2-KC-G2-G2).
 */
-->
<script module lang="ts">
    import type { PocketCandidate } from '$lib/strategic/pocketAdvisor';
    import type { Role } from '$lib/types';

    /** Lecture du dark pool adverse : viable au patch − pool montré, pondéré par rôle. */
    export interface DarkPoolEntry {
        championKey: string;
        /** Rôle de la lecture courante ; null = indéterminé. */
        role: Role | null;
        /** Poids relatif de lecture (0..1). */
        weight: number;
    }

    /** Alerte F-c (lecture seulement — le mécanisme reste débranché). */
    export interface PreparedPickAlertView {
        championKey: string;
        /** surpriseOf(pick).bits du slot réellement joué. */
        bits: number;
        /** Rôle-novelté structurelle (compte train équipe+ligue = 0). */
        roleNoveltyStructural: boolean;
    }
</script>

<script lang="ts">
    import { PUBLIC_SURPRISE_LABEL_FR } from '$lib/estimators/publicSelfModel';
    import { championNameByKey } from '$lib/dataDragon/version';
    import ChampionIcon from '$lib/components/ChampionIcon.svelte';

    interface Props {
        /** Sortie d'advisePocketPicks (réservoir filtré + composants). */
        candidates: PocketCandidate[];
        darkPool?: DarkPoolEntry[];
        preparedAlert?: PreparedPickAlertView | null;
        title?: string;
    }

    let { candidates, darkPool = [], preparedAlert = null, title = 'Tes pockets' }: Props = $props();

    const ROLE_FR: readonly string[] = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];

    const nameOf = (key: string): string => championNameByKey(key) ?? key;
    const fmtBits = (bits: number): string => `${bits.toFixed(1).replace('.', ',')} bits`;
    const fmtPp = (x: number): string => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1).replace('.', ',')} pp`;
    const fmtNum = (x: number, digits = 2): string => x.toFixed(digits).replace('.', ',');
</script>

<section class="panel p-3">
    <h2 class="flex items-center gap-2 pb-1 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
        {title}
        <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 normal-case tracking-normal">
            Expérimental — F1 non verte
        </span>
    </h2>
    <p class="pb-2 text-[10px] text-slate-600">
        Lecture du modèle PUBLIC (corpus visible) — jamais une connaissance du pool privé. Toute association
        mesurée ici est une corrélation, jamais une causalité.
    </p>

    <!-- Bloc 1 — réservoir -->
    <h3 class="pb-1 text-xs font-semibold text-slate-300">Réservoir — {PUBLIC_SURPRISE_LABEL_FR}</h3>
    {#if candidates.length === 0}
        <p class="pb-2 text-xs text-slate-600">
            Aucun candidat : pas de surprise élevée qui contre leur compo, cohérente avec le noyau et viable au
            patch.
        </p>
    {:else}
        <ul class="space-y-2 pb-2">
            {#each candidates as candidate (candidate.championKey)}
                {@const seriesPrice = candidate.holdOrSpend.seriesPrice}
                {@const revelation = candidate.holdOrSpend.revelation}
                {@const bait = candidate.holdOrSpend.bait}
                <li class="rounded-md border border-slate-800 p-2">
                    <p class="flex items-center gap-2 text-xs text-slate-200">
                        <ChampionIcon championKey={candidate.championKey} size={22} />
                        <span class="font-semibold">{nameOf(candidate.championKey)}</span>
                        <span class="text-slate-500">{ROLE_FR[candidate.role]}</span>
                        <span class="rounded bg-violet-500/15 px-1.5 py-0.5 font-mono text-[10px] text-violet-300">
                            {fmtBits(candidate.bits)}
                        </span>
                        <span class="text-[10px] text-slate-500">({PUBLIC_SURPRISE_LABEL_FR})</span>
                    </p>
                    <p class="pt-1 text-[10px] text-slate-500">
                        Contre leur compo : {fmtPp(candidate.counter.threat)} ({candidate.counter.evidence} games de
                        même profil) · cohérence noyau : {fmtPp(candidate.coherence.residual)}
                        ({candidate.coherence.evidence} games).
                    </p>
                    {#if candidate.checklist.length > 0}
                        <ul class="space-y-0.5 pt-1">
                            {#each candidate.checklist as item (item.textFr)}
                                <li class="flex items-start gap-1.5 text-[11px]">
                                    <span
                                        class={item.satisfied === true
                                            ? 'text-emerald-400'
                                            : item.satisfied === false
                                              ? 'text-red-400'
                                              : 'text-slate-500'}
                                    >
                                        {item.satisfied === true ? '✓' : item.satisfied === false ? '✗' : '?'}
                                    </span>
                                    <span class="text-slate-400">
                                        {item.textFr}
                                        <span class="text-[9px] text-slate-600">
                                            [{item.sources.join(', ')}]
                                        </span>
                                    </span>
                                </li>
                            {/each}
                        </ul>
                    {/if}

                    <!-- Bloc 2 — GARDER / DÉPENSER : composants séparés, jamais fusionnés -->
                    <div class="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-3">
                        <div class="rounded border border-slate-800 bg-slate-900/40 p-1.5">
                            <p class="flex items-center gap-1 text-[10px] font-semibold text-slate-300">
                                Prix de série (γ·ΔS)
                                <span class="rounded-full bg-amber-500/15 px-1.5 text-[9px] text-amber-400">Expérimental</span>
                            </p>
                            {#if seriesPrice.masked}
                                <p class="pt-0.5 text-[10px] text-slate-500">
                                    {seriesPrice.reasonFr}
                                </p>
                            {:else}
                                <p class="pt-0.5 font-mono text-[10px] text-slate-400">
                                    γ·Δ = {fmtNum(seriesPrice.term.gammaWeighted, 3)}
                                    (coût propre {fmtNum(seriesPrice.term.selfCost, 3)}
                                    + déni {fmtNum(seriesPrice.term.denialGain, 3)})
                                </p>
                                <p class="text-[10px] text-slate-500">
                                    Demande mesurée P(want) = {fmtNum(seriesPrice.wantProbability)}
                                </p>
                            {/if}
                        </div>
                        <div class="rounded border border-slate-800 bg-slate-900/40 p-1.5">
                            <p class="flex items-center gap-1 text-[10px] font-semibold text-slate-300">
                                Coût de révélation (I2)
                                <span class="rounded-full bg-amber-500/15 px-1.5 text-[9px] text-amber-400">Expérimental</span>
                            </p>
                            {#if revelation !== undefined}
                                <p class="pt-0.5 font-mono text-[10px] text-slate-400">
                                    {fmtNum(revelation.entropyLossBits, 2)} bits révélés ·
                                    réponses débloquées {fmtPp(revelation.unlockedCounterGain)}
                                </p>
                                <p class="text-[10px] text-slate-600">bits et équité : jamais sommés.</p>
                            {:else}
                                <p class="pt-0.5 text-[10px] text-slate-600">Non évalué (évaluateur non injecté).</p>
                            {/if}
                        </div>
                        <div class="rounded border border-slate-800 bg-slate-900/40 p-1.5">
                            <p class="flex items-center gap-1 text-[10px] font-semibold text-slate-300">
                                Appât (laisser ouvert)
                                <span class="rounded-full bg-amber-500/15 px-1.5 text-[9px] text-amber-400">Expérimental</span>
                            </p>
                            {#if bait !== undefined}
                                <p class="pt-0.5 font-mono text-[10px] text-slate-400">
                                    EV {fmtPp(bait.ev)} — {bait.verdictFr}
                                </p>
                            {:else}
                                <p class="pt-0.5 text-[10px] text-slate-600">Non évalué (range non injectée).</p>
                            {/if}
                        </div>
                    </div>
                </li>
            {/each}
        </ul>
    {/if}

    <!-- Bloc 3 — côté adverse -->
    <h3 class="pt-1 pb-1 text-xs font-semibold text-slate-300">Côté adverse</h3>
    {#if preparedAlert !== null}
        <p class="mb-1 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
            ⚠ Pick préparé — leur prep est profonde : {nameOf(preparedAlert.championKey)}
            ({fmtBits(preparedAlert.bits)}{preparedAlert.roleNoveltyStructural
                ? ', rôle jamais vu au corpus'
                : ''}). Lecture de rôles à élargir.
            <span class="rounded-full bg-amber-500/15 px-1.5 text-[9px] font-semibold text-amber-400">
                Expérimental — F2 non verte
            </span>
        </p>
    {/if}
    {#if darkPool.length === 0}
        <p class="text-xs text-slate-600">Dark pool : aucune lecture (pools et patch non injectés).</p>
    {:else}
        <ul class="space-y-0.5">
            {#each darkPool as entry (entry.championKey)}
                <li class="flex items-center gap-2 text-[11px]">
                    <ChampionIcon championKey={entry.championKey} size={18} />
                    <span class="w-24 truncate text-slate-400">{nameOf(entry.championKey)}</span>
                    <span class="w-14 text-[10px] text-slate-600">
                        {entry.role === null ? '—' : ROLE_FR[entry.role]}
                    </span>
                    <span class="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-800">
                        <span
                            class="block h-full rounded-full bg-violet-500/50"
                            style="width: {Math.max(2, entry.weight * 100)}%"
                        ></span>
                    </span>
                </li>
            {/each}
        </ul>
        <p class="pt-1 text-[10px] text-slate-600">
            Dark pool = champions viables au patch − leur pool montré, pondérés par rôle. C'est une LECTURE de ce
            que les données publiques ne montrent pas — pas une connaissance de leur prep.
        </p>
    {/if}

    <!-- pédagogie -->
    <details class="mt-2">
        <summary class="cursor-pointer text-[11px] font-semibold text-slate-400 select-none">Comment lire ?</summary>
        <div class="space-y-1 pt-1 text-[11px] text-slate-500">
            <p>
                Le réservoir liste ce qui serait une <strong>surprise vs données publiques</strong> : plus les bits
                sont hauts, moins le modèle public (le tien, appliqué à ta propre équipe) attend ce pick. Ce n'est
                PAS « ce que ton équipe sait jouer » — aucune donnée privée n'existe ici.
            </p>
            <p>
                Cas fondateur — <strong>G2-Nasus (Skewmond)</strong>, finale LEC 2026, game 5 d'une série accrochée
                (séquence corrigée KC-G2-KC-G2-G2, 2-2 avant la G5) : Nasus JUNGLE en seq 17, premier Nasus jungle
                au plus haut niveau en 9 ans — 1 seul Nasus sur les 1 219 games 2026. Surprise maximale, MAIS compo
                construite pour lui (Anivia, Alistar, Senna, Kled) : la checklist d'activation formalise exactement
                ce « surprise × cohérence ». Sans le fit, un pocket n'est qu'un coin flip.
            </p>
            <p>
                GARDER / DÉPENSER : les composants restent séparés — le prix de série dit ce que tu brûles pour la
                suite, la révélation dit ce que l'adversaire apprend, l'appât dit ce que rapporte le laisser ouvert.
                Aucun score fusionné : c'est à toi d'arbitrer, comme un staff le fait.
            </p>
            <p>
                Rappel : le premium du pocket n'est pas encore mesuré (gate F1) — d'ici là, tout ce panneau est une
                aide de lecture corrélationnelle, jamais une promesse de victoire.
            </p>
        </div>
    </details>
</section>
