# Recherche 2026-06 — Formalismes des jeux à information cachée & vérification d'inédit

> Rapport de recherche produit le 2026-06-10 (agent web, ~30 recherches + fetches ciblés).
> Commandé pour la couche « sommet » (V2.1) : (A) formalismes transférables au pick/ban,
> (B) prior-art check des moteurs I1-I6 de `docs/ARCHITECTURE_V2.md` §6 bis.
> Les verdicts distinguent « idée mentionnée » de « construit/formalisé ».

---

## PART A — Transferable Formalisms

### A1. Poker solver concepts

**Core ideas.** (a) *Range-based reasoning*: you never assign the opponent one hand; you maintain a probability distribution over all hands consistent with their actions, and every action prunes/reweights it. (b) *Capped vs uncapped ranges*: a line that bypasses an available aggressive action logically removes the strongest holdings from the range ([Thinking Poker](https://www.thinkingpoker.net/articles/capped-ranges/), [GTO Wizard Range Morphology](https://blog.gtowizard.com/range-morphology/)). This is the cleanest existing formalism of **negative information**. (c) *Blockers/card removal*: holding a card reduces the combinatorial count of opponent holdings containing it ([GTO Wizard blockers](https://blog.gtowizard.com/understanding-blockers-in-poker/)) — the direct analog of "picking/banning champion X removes all opponent comps containing X." (d) *GTO vs exploitative*: equilibrium play is unexploitable but forfeits EV against flawed opponents — Chen & Ankenman, *The Mathematics of Poker* (2006).

**Solver UX that transfers.** GTO Wizard: range grid color-coded by action mix; *EV comparison* coloring each holding by which action is higher-EV, **near-zero differences rendered neutral** ([EV Comparison](https://blog.gtowizard.com/how-to-leverage-gto-wizards-ev-comparison-tool/)); equity-distribution graphs (range advantage/polarization); **Hand History Analyzer** assigning an EV loss to every decision, sorting by biggest blunders, aggregating into leak reports ([Analyzer guide](https://help.gtowizard.com/how-to-use-the-hand-history-analyzer/)).

**Transfer verdict: HIGH.** Ranges-over-picks, capped-range logic for bypassed picks, blocker logic for denial, EV-loss/leak-report UX transfer almost one-to-one; ranges degrade gracefully with tiny data (elicitable from coach priors). The "white = close, color = clear preference" convention is the right way to avoid false precision.

### A2. Imperfect-information game search

*Determinization/PIMC* (sample hidden state, solve perfect-info game, vote; [Long, Sturtevant, Buro & Furtak, AAAI 2010](https://webdocs.cs.ualberta.ca/~nathanst/papers/pimc.pdf)), *IS-MCTS* ([Cowling, Powley & Whitehouse 2012](https://eprints.whiterose.ac.uk/id/eprint/75048/1/CowlingPowleyWhitehouse2012.pdf)), *CFR* ([Zinkevich et al., NIPS 2007](https://poker.cs.ualberta.ca/publications/NIPS07-cfr.pdf)).

**Feasibility at draft scale.** A LoL draft's 20 actions are *public*; the hidden information is (i) role assignment of flex picks and (ii) the opponent's private evaluation/preparation. Full CFR over the action tree is overkill. The right import: **determinization over role assignments and opponent pools** — sample (role map, candidate set) from the opponent model, run shallow expectimax/MCTS over a pruned candidate set (10–20 plausible champions per slot), aggregate. PIMC's failure modes (strategy fusion) matter little here. JueWuDraft showed PUCT handles the raw tree at scale.

**Transfer verdict: MEDIUM-HIGH for determinization + pruned search; LOW for CFR** (exception: last-pick simultaneous role assignment = tiny matrix game, solvable directly with an LP).

### A3. Signaling & opponent modeling (incl. negative information)

- **Aumann–Maschler repeated games with incomplete information** : an informed player facing repeated zero-sum play trades off exploiting private information against revealing it; the value is the *concavification* (Cav u) of the one-shot value over beliefs — optimal play often means deliberate partial revelation ([Renault's survey](https://www.tse-fr.eu/sites/default/files/TSE/documents/doc/by/renault/renault2018_referenceworkentry_repeatedgameswithincompleteinf.pdf)). **The formal skeleton for "how much pocket prep do I burn in game 1 of a Bo5."** In zero-sum drafting, early picks are *costly commitments*, closer to costly signaling than cheap talk.
- **Level-k / cognitive hierarchy**: real opponents reason finitely; Poisson-CH fits mean reasoning depth ~1.5 steps ([Camerer, Ho & Chong, QJE 2004](https://ideas.repec.org/a/oup/qjecon/v119y2004i3p861-898..html)). Practical implication: model opposing coaches at k≈1–2, capping counter-reasoning depth.
- **Negative information, formal treatments**: poker capped ranges (A1); bridge's **principle of restricted choice** (Bayesian updating where the *absence* of an alternative play shifts posteriors — [Wikipedia](https://en.wikipedia.org/wiki/Principle_of_restricted_choice)); **Richards & Amir, IJCAI 2007 (Scrabble)**: infer opponent rack by conditioning on moves *not* made ([PDF](https://www.ijcai.org/Proceedings/07/Papers/239.pdf)); Bayesian opponent posteriors ([Bayes' Bluff, UAI 2005](https://www.researchgate.net/publication/228333638_Bayes'_Bluff_Opponent_Modelling_in_Poker)).

**Transfer verdict: HIGH.** "Team A had Azir available through two rotations and passed" is exactly a restricted-choice/capped-range update — likelihood weighting in a tiny Bayesian model, well-suited to small data.

### A4. Chess preparation practice

- *Post-hoc decision grading*: Lichess classifies inaccuracy/mistake/blunder by thresholded **win-probability deltas** (≈0.1/0.2/0.3 winning-chance loss), caps evals to avoid penalizing safe play in won positions, renders "Best was X" inline ([thresholds](https://lichess.org/forum/game-analysis/computer-analysis-inaccuracies-mistakes-blunders)). Lesson: **grade in win-probability space, not raw eval; suppress nags when many moves are near-equal.**
- *Opponent-specific prep*: ChessBase **Opening Report** (lines scored by results, recency, elite adoption) + player-prep workflow — filter opponent's games by color, build their statistical opening tree, find low-scoring/thin branches ([Openings report](http://help.chessbase.com/Reader/12/Eng/openings_report.htm), [player guide](https://en.chessbase.com/post/chessbase-2026-a-players-guide-4)). *Novelty hunting* = mass engine analysis with automatic novelty annotation vs the reference DB.
- *Leak reports as product*: Aimchess ([aimchess.com](https://aimchess.com/)).

**Transfer verdict: HIGH (UX), MEDIUM (statistics).** Caveat: chess grading rests on a near-perfect oracle; with a noisy draft evaluator, thresholds must be wide and confidence-banded. "Draft repertoire planning" is structurally identical to ChessBase player prep: opponent pick-tree by side/slot, scored branches, thin branches flagged as prep targets.

### A5. Bo3/Bo5 adaptation in card/fighting games

- *MTG sideboarding*: rich practitioner theory, hypergeometric deck math, **no formal sideboarding-equilibrium paper found**. The transferable concept: "games 2+ are a different game; pre-planned transformation per matchup" = Plan A/B/C.
- *Fighting-game counter-pick theory*: character select as a matrix game over the matchup chart; **Nash mixtures computed and published** (Schmitz on Melee: [play rates via game theory](https://quantimschmitzcom.wordpress.com/2024/03/14/finding-super-smash-bros-melees-ideal-character-play-rates-with-game-theory/); [AIIDE Melee metagame paper](https://cdn.aaai.org/ojs/18884/18884-52-22650-1-2-20211004.pdf)). Known caveat: **raw Nash over-prunes viable picks and ignores player-specific skill** — exactly the comfort-vs-matchup blend DraftLab encodes. Sirlin's yomi layers for the qualitative ladder ([Designing Yomi](https://www.sirlin.net/articles/designing-yomi)).
- *Best-of-N veto*: CS map-veto analyses (HLTV: teams lose their own pick 53% of the time) + a bandit model of map selection ([arXiv 2106.08888](https://arxiv.org/pdf/2106.08888)).

**Transfer verdict: HIGH for matchup-matrix Nash (tiny LPs, perfect for tiny data); MEDIUM for sideboarding/veto (concepts and priors).**

### A6. Multi-round resource-depletion competition

- *Colonel Blotto* + dynamic variants ([Roberson 2006](https://www.researchgate.net/publication/24057221_The_Colonel_Blotto_Game); [budget-constrained multi-battle contests, arXiv 1602.04000](https://arxiv.org/pdf/1602.04000); [adversarial knapsack, arXiv 2504.16752](https://arxiv.org/pdf/2504.16752)).
- **Sequential auctions with budget-constrained bidders** ([Benoît & Krishna, REStud 2001](https://academic.oup.com/restud/article-abstract/68/1/155/1568591)): order effects + **strategic budget depletion** — formal "denial": spending to degrade the rival's future capacity. Hard-Fearless mirror: consuming a shared asset is profitable exactly when **the asset's replacement cost is higher for the opponent**.

**Transfer verdict: MEDIUM.** No off-the-shelf theorem for both-team depletion of heterogeneous, role-constrained assets; import (i) the asymmetric-replacement-cost criterion for denial value, (ii) multi-battle budget framing for must-win/punt (concentrate inventory where marginal win probability per asset is highest — the Aumann–Maschler revelation question in disguise).

---

## PART B — Prior-Art Verdicts (moteurs I1-I6)

| # | Claim (moteur) | Verdict | Key evidence |
|---|-------|---------|--------------|
| B1 | Flex-pick role-ambiguity entropy as information asset — fog value (I2) | **PARTIAL** | Concept ubiquitous qualitatively ([LoL Wiki Team drafting](https://wiki.leagueoflegends.com/en-us/Team_drafting), [ESTNN](https://estnn.com/league-of-legends-the-power-of-flex-picks/)) ; un prototype « flex-conscious » ([Draft AI](https://alexzander-stone.pages.dev/projects/draft-ai/)) ; **aucune quantification entropie/équité trouvée** |
| B2 | Information-cost pick valuation : equity + concealment − revelation (I2) | **NOVEL** | Rien de formel ; seulement du qualitatif ([Cornell INFO2040 Dota](https://blogs.cornell.edu/info2040/2018/09/19/game-theory-in-dota2-drafting/)) ; la théorie sous-jacente (Aumann–Maschler) existe — claim = *application/système*, pas théorie |
| B3 | Bayesian pick **ranges** per slot incl. negative information (I1) | **PARTIAL** | La *prédiction* de picks existe ([Summerville AIIDE 2016](https://ojs.aaai.org/index.php/AIIDE/article/view/12899), [DraftRec](https://arxiv.org/abs/2204.12750), [dr4ft.lol](https://dr4ft.lol/)) ; **la range-UX façon poker + l'updating par information négative (restricted choice) : introuvables** |
| B4 | Hard-Fearless series solver with cross-game **denial** (I4) | **NOVEL** | [JueWuDraft](https://arxiv.org/abs/2012.10171) = lockout *par équipe seulement*, **pas de bans** (« we have not considered about banning heroes yet »), pas de déni ; l'écosystème LoL n'a que des *simulateurs* ([FearlessDraft GitHub](https://github.com/ColinLi33/FearlessDraft), [drafter.lol](https://drafter.lol/post/fearless-draft)) ; rien sur arXiv jusqu'à mi-2026 |
| B5 | **Bilateral** win-condition graph + postdiction validation (I3) | **NOVEL** | Tout l'existant est unilatéral : archétypes ([ProComps gamestyles](https://hub.procomps.gg/2022/07/engagecomp-a-complete-guide-to-league-of-legends-team-gamestyles/)), comp builder génétique ([ResearchGate 2019](https://www.researchgate.net/publication/337260793_An_Approach_for_Team_Composition_in_League_of_Legends_using_Genetic_Algorithm)) ; aucune dérivation relationnelle ni postdiction |
| B6 | Chess-style **annotated draft review** product (I5) | **PARTIAL** | iTero a publié le *concept* ([Draft Review Model](https://medium.com/the-esports-analyst-club-by-itero-gaming/the-draft-review-model-lol-57aeef1de89a) — modèle de prédiction, PAS d'annotation par décision, non shippé en produit de revue) ; STRATZ+ fait du live win-prob Dota ; le pattern exact est commodity ailleurs (GTO Wizard, Aimchess) mais **aucun outil MOBA ne le ship** |
| B7 | Patch-anticipation briefing with quantified **buff-response curves** (I6) | **PARTIAL** | iTero a shippé des tier-forecasts par patch validés ([challenge](https://medium.com/the-esports-analyst-club-by-itero-gaming/the-champion-tier-list-challenge-dbde51e882b5)) ; estimation causale rétrospective académique ([arXiv 2110.14632](https://arxiv.org/abs/2110.14632)) ; **les courbes de réponse historiques utilisées prospectivement : introuvables** |

---

## Top 5 formalisms to import, ranked

1. **Capped ranges / restricted choice (Bayesian negative information)** — the only formalism that directly operationalizes "they didn't take it, so downweight it"; engine behind I1, works at coach-prior scale.
2. **EV-loss decision grading with close-move suppression (GTO Wizard + Lichess)** — the proven UX grammar for I5: grade in win-prob space, wide bands, "better was X" only when the gap clears a confidence threshold.
3. **Aumann–Maschler revelation trade-off (Cav u)** — the correct frame for I2 and Bo5 prep-burning: information has series-level option value; optimal play sometimes reveals deliberately.
4. **Matchup-matrix Nash with comfort-adjusted payoffs (FGC counter-pick theory)** — tiny LPs over matchup matrices give principled ban priorities and pick mixes; warning: raw Nash over-prunes without per-player skill terms.
5. **ChessBase-style opponent repertoire reports** — the workflow template for the conditional draft repertoire (R6): opponent pick-tree by side/slot scored by result/recency, thin branches = prep targets, novelty tracking.

Honorable mention: **determinization over role assignments** (A2) — the cheap way to make any evaluator flex-aware: sample role maps instead of solving an imperfect-information game.

## Novelty-claim guidance (à respecter dans toute communication)

- **B2, B4, B5** : défendables comme inédits **en tant que systèmes/formalisations** (pas comme idées).
- **B1, B3** : à formuler « première quantification » / « première présentation en ranges », en citant l'existant qualitatif et prédictif.
- **B6, B7** : ne pas revendiquer le concept — revendiquer la *tranche* précise (annotation par décision shippée ; courbes de réponse prospectives), en créditant les concepts publiés d'iTero.
