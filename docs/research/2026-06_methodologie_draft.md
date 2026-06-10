# Recherche 2026-06 — État de l'art : méthodes d'analytique de draft

> Rapport de recherche produit le 2026-06-10 (agent de recherche web, sources vérifiées en ligne).
> Synthèse architecte : voir `docs/ARCHITECTURE_V2.md` §6. Ce fichier est la référence détaillée.

**Framing constraint (governs every verdict below):** DraftLab operates on professional data at tiny scale — hundreds of games per league per split, tens per team, 5–20 per player per patch — locally, in TypeScript, with no GPU and no telemetry pipeline. Nearly all published MOBA draft ML is trained on 10⁵–10⁷ solo-queue games. The recurring conclusion of this survey: **the high-capacity methods (transformers, embeddings, deep MCTS value nets) are scientifically interesting but data-starved at pro scale; the winning playbook for DraftLab is Bayesian shrinkage everywhere, structure-based priors (tags) where data is absent, shallow search with honest evaluation, and rigorous walk-forward calibration.** Verified accuracy ceilings (below) also cap what the product may honestly claim.

---

## 1. Champion strength estimation from sparse data

### 1.1 DraftGap's exact public methodology (verified from source, June 2026)

Read directly from [vigovlugt/draftgap](https://github.com/vigovlugt/draftgap), `packages/core/src/rating/ratings.ts`, `draft/analysis.ts`, `risk/risk-level.ts`, `draft/suggestions.ts`:

- **Scale:** everything lives on an Elo-400 log-odds scale.
  - `winrateToRating(w) = -400 * log10(1/w - 1)`
  - `ratingToWinrate(d) = 1 / (1 + 10^(-d/400))`
  (This is just `logit(w)` rescaled by `400/ln 10` — i.e., a Bradley-Terry/logistic model.)
- **Champion rating with shrinkage:** current-patch role stats are blended with pseudo-games whose winrate is the champion's full 30-day winrate in that role:
  `finalWR = (wins + N₀·priorWR) / (games + N₀)` — beta-binomial shrinkage with prior strength N₀.
- **Exact prior strengths** (`priorGamesByRiskLevel`): very-low = 3000, low = 2000, medium = 1000, high = 500, very-high = 250 pseudo-games. The user-facing "risk level" knob is literally the prior count — more risk = trust small samples more.
- **Matchups:** expected matchup winrate from independence: `m̂ = ratingToWinrate(rating₁ − rating₂)`. Observed matchup stats (averaged from both champions' tables) are shrunk toward that expectation with the same pseudo-game mechanism; the **matchup rating is the residual** `winrateToRating(adjustedWR) − expectedRating`. So only deviation-from-independence counts.
- **Duos:** same pattern with `rating₁ + rating₂` as the additive expectation; synergy = residual vs. independence.
- **Total draft rating** = Σ ally champion ratings + Σ ally duo residuals + Σ matchup residuals − Σ enemy champion ratings − Σ enemy duo residuals → `ratingToWinrate(total)`. Suggestions = simulate every legal (champion, role), rank by resulting winrate; champions below a games threshold are skipped.

**Fit for DraftLab: excellent (and largely already aligned).** This is the right skeleton: additive log-odds, residual-vs-independence synergy/counter terms, pseudo-game shrinkage. Two caveats for pro data: (a) DraftGap's N₀ values are tuned for solo-queue volumes — with 20 pro games and N₀ = 1000 the data is mute; for pro-only signals use N₀ ≈ 10–50 (see 1.2) and let solo-queue/cross-league data form the prior mean; (b) summing many noisy residual terms inflates variance — cap or down-weight pair terms estimated from <10 games.

### 1.2 Empirical-Bayes beta-binomial (the canonical small-n tool)

The classic treatment is David Robinson's empirical-Bayes-on-batting-averages series/book (*Introduction to Empirical Bayes: Examples from Baseball Statistics*, varianceexplained.org). Math:

- Prior Beta(α, β) fit on the population of champion winrates (method of moments: from population mean μ and variance σ² of stabilized winrates, `α+β = μ(1−μ)/σ² − 1`, `α = μ(α+β)`).
- Posterior point estimate: `ŵ = (wins + α)/(games + α + β)`; posterior is Beta(wins+α, losses+β), giving **free credible intervals** for the UI.

**Fit: excellent.** ~15 lines of TypeScript, no dependencies, exact uncertainty quantification. This should be the default estimator for every count statistic in DraftLab (champion WR, player-champion WR, pair WR, tendency frequencies).

### 1.3 Hierarchical priors pooling leagues/patches/regions

Full hierarchical Bayes (Gelman-style partial pooling) on logit scale:

```
logit(p_champ,league,patch) = μ_global + a_champ + b_champ,league + c_champ,patch
a ~ N(0, τ_champ²), b ~ N(0, τ_league²), c ~ N(0, τ_patch²)
```

MCMC is overkill locally, but the **two-level shortcut** is trivial and captures most of the value — estimate each level with EB shrinkage toward the level above:

```
ŵ_pro_league = shrink(league data, toward ŵ_global_pro, N₀_league)
ŵ_team       = shrink(team data,   toward ŵ_pro_league, N₀_team)
ŵ_player     = shrink(player data, toward ŵ_team_or_role, N₀_player)
```

with N₀ fit by method of moments per level or just set to ~10–30 (tens of games of trust). **Fit: excellent — this cascade (global meta → league → team → player) is arguably DraftLab's single most important estimation pattern.**

### 1.4 Bradley-Terry / Elo / Glicko variants

Bradley-Terry: `P(i beats j) = π_i/(π_i+π_j)`; MAP fit with a Gaussian prior on log π (regularized logistic regression) is robust at hundreds of games and handles unbalanced schedules — better than raw winrate for **team strength**, which DraftLab needs as a context variable (opponent quality adjustment for the tiny per-team samples). A 2024 paper applies Bradley-Terry + vector quantization to composition counter analysis across LoL/Hearthstone/Brawl Stars ([arXiv 2408.17180](https://arxiv.org/pdf/2408.17180)). Glicko (Glickman) adds a per-entity rating deviation — a cheap way to carry uncertainty for teams. **Fit: good** (for team/player strength; champion strength is better served by 1.2–1.3 since champions don't play 1v1).

### 1.5 LoLalytics-style adjustments & time decay

LoLalytics ([lolalytics.com](https://lolalytics.com/)) publishes only qualitative methodology: per-player-tier filtering (their "winrate delta" is individual-tier vs game-average-tier composition), and a tier score that mixes winrate with pick rate to correct the specialist bias — low-pick-rate champions are played by specialists and over-index, high-pick-rate ones drag in average players. Lesson for DraftLab: **a champion's solo-queue WR is a biased prior for a pro player who is a specialist on it** — DraftLab's comfort blend already addresses this; keep the pick-rate de-bias in mind when importing solo-queue priors.

Time decay across patches: standard practice is exponential weighting, `w(g) = λ^(Δpatch)` with λ ≈ 0.7–0.9 per patch (effective sample = Σλ^k), applied to both wins and games before shrinkage. Escalate decay when patch notes touch the champion (DraftLab's tags can flag affected archetypes). A state-space/Glicko-style alternative (inflate prior variance per patch boundary) is equivalent in practice. **Fit: excellent, trivial to implement.**

---

## 2. Synergy & counter modeling

### 2.1 Pairwise tables with shrinkage toward independence (DraftGap pattern)

As in 1.1: model the pair on log-odds, expected value = sum/difference of individual ratings, and shrink the observed pair residual toward zero with pseudo-games. Equivalent formulation: hierarchical prior `synergy_ij ~ N(0, τ²)` — most pairs have no real synergy beyond their parts; only persistent deviations survive shrinkage. **Fit: excellent — already proven in a shipped tool; the residual framing is the key idea.**

### 2.2 Low-rank factorization / champion embeddings

The reference formulation is the Game Avatar Embedding bilinear model ([arXiv 1803.10402](https://arxiv.org/abs/1803.10402)):

```
synergy(i,j)   = aᵢᵀ P aⱼ      (P ∈ ℝ^{K×K}, intra-team)
counter(i,j)   = aᵢᵀ Q aⱼ      (Q ∈ ℝ^{K×K}, inter-team)
P(win) = σ( Σ biases + Σ_pairs synergy − Σ_cross counter-differences )
```

trained by SGD on match outcomes. Results: AUC 0.62–0.71 — but on **1.1M–3.1M matches per game**; expert-correlation r ≈ 0.85 (synergy), 0.74 (counter). Semenov et al.'s factorization machines ([Springer](https://link.springer.com/chapter/10.1007/978-3-319-52920-2_3)) are the same idea order-2; AUC 0.706 (normal skill) **decaying to 0.660 (very high skill)** — a crucial honest data point: the better the players, the less the draft-composition signal. **Fit: poor as a learned model on pro data** (10⁴× too little data), **good as a concept** — see 2.3 for how to get the generalization benefit without the data appetite.

### 2.3 Tag/attribute-based generalization (DraftLab's structural edge)

When pair (i,j) has no data, back off to tag-pair aggregates: estimate synergy/counter residuals between **archetype pairs** (e.g., "engage + wombo follow-up", "poke vs hard-engage") by pooling all champion pairs sharing those tags, then use the tag-level estimate as the prior mean for the champion pair:

```
prior_mean(i,j) = Σ_t1∈tags(i), t2∈tags(j) w_t1,t2 · tagPairResidual(t1,t2)
pairEstimate(i,j) = shrink(observed pair data, toward prior_mean, N₀≈20)
```

This is a hand-crafted, interpretable low-rank factorization — tags play the role of embedding dimensions, with ~10² tag-pair cells estimated from thousands of pooled games instead of ~15k champion-pair cells from a handful each. Two supporting findings: a 2026 attributed-graph LoL synergy paper recovers strategic clusters like "front-to-back" and "dive" from data ([SciTePress](https://www.scitepress.org/Papers/2026/147388/147388.pdf)) — i.e., data-driven methods rediscover tag structure; and the TechLabs Aachen experiment ([Medium](https://techlabs-aachen.medium.com/determining-win-percentage-from-draft-phase-in-a-professional-league-of-legends-game-59ea4e4d5c55)) found raw champion-attribute/tag features **hurt** accuracy at 20k games via overfitting — tags belong in the **prior**, not as free model features. **Fit: excellent — this is the highest-leverage use of DraftLab's 172-champion tag system.**

### 2.4 Role-aware matchup tables

Lane matchups (top vs top, mid vs mid, bot 2v2) carry most counter signal; cross-role counters are weaker and noisier. Maintain matchup tables keyed by role pair, weight lane-opponent matchups ~2–3× cross-map ones (DraftGap implicitly does this via data availability). **Fit: excellent, near-free given role inference already exists.**

---

## 3. Draft win-probability models

### 3.1 What the literature honestly achieves (verified numbers)

| Source | Data | Method | Result |
|---|---|---|---|
| [DraftRec, WWW 2022](https://arxiv.org/abs/2204.12750) ([code](https://github.com/dojeon-ai/DraftRec)) | 280k LoL matches | hierarchical player+match transformers | **55.35% accuracy** from draft (their best on LoL) |
| [LoLDraftAI](https://loldraftai.com/) (live tool, 2025-26) | millions of ranked games, retrained per patch | custom NN | **56.7% from draft alone** (57.7% with runes); claims good calibration |
| [Semenov et al. 2016](https://link.springer.com/chapter/10.1007/978-3-319-52920-2_3) | Dota 2 | factorization machines | AUC 0.706 → **0.660 as skill rises** |
| [GAE](https://arxiv.org/abs/1803.10402) | 1–3M matches | bilinear embeddings | AUC 0.62–0.71 |
| [TechLabs Aachen](https://techlabs-aachen.medium.com/determining-win-percentage-from-draft-phase-in-a-professional-league-of-legends-game-59ea4e4d5c55) | 20k GM-tier games | classic ML, WR+synergy features | 62% (high-elo solo queue; attribute features overfit) |
| [iTero Gaming draft model](https://medium.com/the-esports-analyst-club-by-itero-gaming/the-draft-review-model-lol-57aeef1de89a) (pro LoL, industry) | pro + solo queue | layered linear + GBT | bookmakers 63–65% (team identity); **+draft → 70–73%**, i.e. draft adds ~7.5pp on top of team-strength priors; time-based train/test splits |
| [Player-champion experience, arXiv 2108.02799](https://arxiv.org/abs/2108.02799) | solo queue | DNN with player-champion mastery features | 75.1% pre-game — **player comfort/identity dwarfs composition** |

Synthesis: **draft composition alone is worth ~55–58% accuracy.** Team identity/strength is worth more (63–65% by itself), and player-champion comfort is the single richest pre-game feature family. The implication for product claims: DraftLab should never market "predict the winner"; it should market *marginal* draft quality — "this pick moves your estimated win probability +2.1% ± 1.5%" — and the decomposition (comfort, synergy, counter, curve), which is where coaches act.

### 3.2 Model class recommendation for tiny data

- **Logistic regression on aggregate differential features** (sum of blue minus red: champion ratings, comfort scores, synergy residuals, counter residuals, scaling/power-curve score, side indicator): with ~10 features and L2 regularization it is trainable on a few hundred pro games, calibratable, and inspectable. This is effectively learning the *weights* of DraftLab's existing additive engine instead of hand-setting them. **Fit: excellent.**
- Gradient boosting: viable at ≥10⁴ games; on hundreds it overfits and loses calibration. **Fit: poor** (pro-data-only), acceptable if trained on solo-queue and used as a prior signal.
- Neural/transformer (DraftRec-class): needs 10⁵+ matches; local training in TS impractical. **Fit: poor.** (Option: ship a small ONNX model pre-trained offline on public solo-queue data as one input feature — "good", but a big pipeline investment for ~1pp.)

---

## 4. Sequential draft optimization (pick-ban tree)

### 4.1 MCTS for drafting — DraftArtist and JueWuDraft

- **DraftArtist** ("The Art of Drafting", Chen et al., [arXiv 1806.10130](https://arxiv.org/pdf/1806.10130), [code](https://github.com/czxttkl/DraftArtist)): MCTS (UCT) over the remaining pick sequence, leaf value = learned win-rate predictor over completed lineups. Single-game only; random rollouts need many iterations.
- **JueWuDraft** (Tencent, [arXiv 2012.10171](https://arxiv.org/abs/2012.10171)): the important one for DraftLab. Formulates **best-of-N drafting with cross-game hero-unavailability** (*soft-fearless*) as a two-player zero-sum perfect-information game over the whole series. Verified math:
  - Series reward `r = Σ_{i=0}^{D−1} φ(lineup_i¹, lineup_i²)` where φ is a win-rate predictor.
  - PUCT selection: `a_t = argmax_a [Q(s,a) + c_puct·P(s,a)·√(Σ_a' C(s,a'))/C(s,a) − VL(s,a)/C(s,a)]`.
  - **Long-term value backup** (the Fearless-relevant mechanism): node values at round d include future rounds — `v_new(s_t^d) = v(s_t^d) + v(s_t^D) + Σ_{i∈[d,D)} z_i`, training target `z = Σ_{i≥d} z_i` with `z_i = (φ−0.5)×2`. I.e., a pick is valued not just for this game but for the pool state it leaves for the rest of the series.
  - Results: vs DraftArtist 54.8% (Bo1) → 58.0% (Bo3) → **60.1% (Bo5)** — the long-term mechanism is worth +4.9pp and its edge *grows with series length*. ~1s per pick.

**Fit: the formulation is excellent; the implementation is good in reduced form.** No GPU value net is needed: DraftLab's additive evaluator (Sections 1–2) is a perfectly serviceable φ. As of June 2026 there is **no published treatment of LoL's Fearless specifically** (searched; only rules journalism, e.g. [esportsinsider](https://esportsinsider.com/2025/11/fearless-draft-returns-league-of-legends-2026), [esports.net on Worlds 2025](https://www.esports.net/wiki/tournaments/worlds-2025-fearless-draft/) — note LoL 2025-26 uses the *hard* variant: champions **picked by either team** are gone **for both teams**, so game 5 of a Bo5 starts with 40 picks + 10 bans removed). JueWuDraft's soft-fearless math ports with one twist that actually *simplifies* planning: under hard Fearless, playing a champion also **denies it to the opponent**, adding a denial term to pick value. DraftLab can be first-to-market with a principled treatment.

### 4.2 What to implement locally: expectimax over a pruned tree

Full-width minimax over ~170 champions × 20 draft slots is hopeless, but is also unnecessary: restrict each node to the top-k (k ≈ 8–15) *plausible* candidates from the opponent-tendency model (Section 5) and own-pool tiers, and search 2–4 plies with the additive evaluator at leaves:

```
function expectimax(state, depth):
  if depth == 0 or draftComplete(state): return evaluate(state)        // Sections 1–2 engine
  if ourTurn(state):
      return max over a ∈ topK(ourCandidates(state)) of expectimax(apply(state,a), depth−1)
  else:
      // opponent modeled probabilistically, not adversarially:
      return Σ_a P̂(a | state, tendencies) · expectimax(apply(state,a), depth−1)
```

Expectimax with a learned opponent distribution beats paranoid minimax here because pro opponents are predictable-ish and minimax over-fears never-played picks. For Fearless, `evaluate` becomes `evaluate(thisGame) + γ·E[seriesValue(poolState)]` where seriesValue is a cheap heuristic: sum of each team's remaining top-N champions-per-role comfort ratings (a knapsack-flavored "pool budget" — treat remaining comfort picks as a budget to spend across remaining games, and value denial under hard Fearless). **Fit: excellent — milliseconds of compute, fully local, uses every existing DraftLab module.** MCTS instead of expectimax only becomes worth it if branching is kept wide; same evaluator either way. RL approaches (policy learning over drafts) — **poor fit**: nothing to train on locally.

### 4.3 Opponent picks inside the tree

Summerville et al., "Draft-Analysis of the Ancients" ([AIIDE 2016](https://ojs.aaai.org/index.php/AIIDE/article/view/12899)): LSTM sequence model over pro Captain's-Mode draft sequences predicting the next pick — the proof-of-concept that next-pick prediction works. An LSTM needs far more drafts than one team provides; the same predictive structure at tiny scale is a smoothed conditional table (Section 5). **Fit of sequence NNs: poor; of the probabilistic-opponent idea: excellent.**

---

## 5. Opponent tendency modeling from tiny samples (5–20 games)

**Verdict up front: Dirichlet-smoothed conditional frequency tables with recency weighting beat any sequence model at this scale. This is the chess-prep model (Section 7), not the deep-learning model.**

```
P̂(pick = c | team, role, phase, context) =
   (Σ_g λ^{age(g)} · 1[g has pick c in context] + α·P_league(c | role, phase))
 / (Σ_g λ^{age(g)} · 1[context]                + α)
```

- α ≈ 3–8 pseudo-games of league-level prior (what *any* team in this league does in that slot); λ ≈ 0.8–0.95 per week or per patch.
- Context features worth conditioning on (one at a time — never jointly, the table shatters): first-rotation vs counter-pick slot; side; champion flexed or one-tricked; "their jungler's 3-deep pool".
- Back off hierarchically: player → team → league → global, exactly the 1.3 cascade. An n-gram/Markov layer (`P(pick | previous two picks)`) is worth it only at league level where counts permit; per-team, first-order context is the ceiling.
- Output for the UI and the expectimax tree: a top-k distribution with counts shown ("Has first-picked Rumble 4 of last 6 series on red side") — coaches trust counts, not logits.

**Scrim-vs-stage divergence:** no rigorous published study exists (verified by search). Practitioner commentary ([Sheep Esports on G2's 69% scrim winrate](https://www.sheepesports.com/en/articles/lol-lec-g2-holds-a-69-winrate-in-scrims-according-to-romain-bigeard-s-data/en), [zleague](https://www.zleague.gg/theportal/league-of-legends-g2-and-fnc-scrim-results-reveal-surprising-insights/), and the existence of [scrimstats.gg](https://scrimstats.gg/)) consistently says scrim results are noisy and intentionally distorted (teams test, hide, and sandbag). Recommendation: if DraftLab ingests scrim data, keep a **separate source tag and a divergence dial** — use scrims for *pool existence* evidence (who can play what) at near-full weight, and for *winrate/tendency* evidence at heavily discounted weight (e.g., 0.2–0.4 games of stage-equivalent weight), never pooled silently with stage data. **Fit: excellent and differentiating; almost no competitor handles this explicitly.**

---

## 6. Calibration & honest uncertainty

- **Temperature/Platt scaling on the log-odds output:** `p_cal = σ(a + b·logit(p_raw))` — two parameters, fittable on a few hundred walk-forward predictions; isotonic regression needs thousands and **overfits at DraftLab's scale** (per [scikit-learn's calibration docs](https://scikit-learn.org/stable/modules/calibration.html)). Use Platt; refit each patch-window. A refinement relevant to in-draft predictions: calibration conditioned on sequence position (how many picks are locked) — formalized in [Temporal Probability Calibration, arXiv 2002.02644](https://arxiv.org/pdf/2002.02644). Practically: fit separate (a,b) for "after bans", "after 3 picks", "full draft". **Fit: excellent.**
- **Backtesting protocol — walk-forward by patch:** train/fit on patches 1..k, predict patch k+1, roll forward; report log loss, Brier score, and a 10-bin reliability diagram, never accuracy alone (at 55–58% accuracy, calibration *is* the product). Always compare against two baselines: p = 0.5, and team-Elo-only — **draft features must beat team identity to justify any claim.** Budget: a full season of one league gives only ~300–900 predictions, so confidence intervals on Brier/log-loss differences (bootstrap) are mandatory before believing any "improvement".
- **Communicating uncertainty to coaches:** (a) carry the Beta posterior from Section 1.2 and show Jeffreys/credible intervals ("62% WR, but 8 games: 38–81%"); (b) **tiers instead of points** when intervals are wide — drive pool tiers from posterior quantiles, e.g. tier by P(WR > 50%); (c) suppress decimal places the data cannot support — "+2.3%" on 12 games is false precision; render "+2% (low confidence)"; (d) for pick deltas, show the interval crossing zero explicitly ("could be neutral"). LoLDraftAI's public "when we predict 55%, games end up around 55%" framing is the right kind of product claim — verifiable and modest.

---

## 7. Transfers from chess, card games, and sports analytics

- **Chess opening prep (strongest analogy for Section 5):** ChessBase's opponent dossiers ("Identify Player", Style Report) and the [Lichess per-player opening explorer](https://lichess.org/forum/general-chess-discussion/how-to-prepare-for-my-opponents) / [database-prep workflows](https://chessify.me/blog/how-to-use-chess-databases-for-opening-preparation) are exactly DraftLab's opponent module: frequency tables over an opponent's recent repertoire, recency-weighted, mined for exploitable habits — plus *novelty preparation* (prepare a line the opponent hasn't seen = pocket pick with surprise value; chess prep also weighs "sharp but unfamiliar to *us* too"). The transferable design insight: chess tools won by making the *evidence* (games, counts, dates) one click away from every recommendation.
- **Card-game metagaming:** Hearthstone/MTG research models the *meta itself* as a game — compute the field's deck distribution, then best-respond; at equilibrium the meta is a mixed Nash ([Evolving the Hearthstone Meta, arXiv 1907.01623](https://arxiv.org/pdf/1907.01623); [meta-shift prediction after balance patches, arXiv 2409.07340](https://arxiv.org/pdf/2409.07340)). Transfer: **ban priority and comp selection are best-response-to-a-field problems** — expected value of a ban = Σ_opponents-likely-strategies P(strategy)·damage(ban, strategy), using Section 5's tendency distribution as the field. A tiny LP for a mixed "game-plan portfolio" across a Bo5 (don't show the same look five times) is a natural Fearless-era feature.
- **Sports analytics:** the two workhorses that transfer wholesale are empirical-Bayes shrinkage (Section 1.2 — invented for baseball batting averages) and opponent-adjusted ratings (Bradley-Terry/SRS — adjust every team/player stat for schedule strength, since a 60% WR in scrims vs weak teams ≠ 60% vs LCK). Also from sports: present win-probability *added* (per-decision deltas) rather than absolute forecasts — coaches act on deltas.

---

# TOP-10 methodological investments for a pro-grade DraftLab

1. **Empirical-Bayes shrinkage as the universal estimator** (beta-binomial with method-of-moments priors, hierarchical cascade global → league → team → player). Every number DraftLab shows — champion WR, comfort, pair residuals, tendencies — should be a posterior, not a raw frequency; at 5–20 games this is the difference between a tool coaches trust and one they catch lying within a week. It is ~50 lines of TS and yields intervals for free.

2. **DraftGap-style additive log-odds evaluator with residual synergy/counter terms** — keep/finish this as the single `evaluate(draftState)` function: Elo-400 conversions, pseudo-game shrinkage (recalibrated to pro scale, N₀ ≈ 10–50 on pro signals), pair terms as deviations from independence. It is the proven shipped architecture, fully local, and every other investment (search, calibration, ban EV) composes on top of it.

3. **Tag-bridged pair priors** — pool synergy/counter residuals at tag-pair level and use them as prior means for champion pairs with no pro data. This converts DraftLab's hand-tagged 172 champions into the small-data substitute for embedding methods that need millions of games, and it answers the question competitors can't: "we've never seen this pair — why do you think it works?" with an explanation ("engage + follow-up pattern: +1.8% across 1,400 league games").

4. **Walk-forward-by-patch backtesting harness with Brier/log-loss + reliability diagrams, against a team-Elo baseline** — built *before* further model features. At a 55–58% draft-only ceiling, every claimed improvement is within noise unless evaluated this way; the harness is also the only honest basis for product claims and for tuning every λ, N₀ and weight in items 1–3.

5. **Opponent tendency model: recency-weighted, Dirichlet-smoothed conditional tables with hierarchical backoff** (player → team → league), keyed by draft slot/side/phase. This is the chess-prep workflow formalized, feeds items 6 and 7, and at 5–20 games per team it provably cannot be beaten by sequence models — simplicity is optimal here, not a compromise.

6. **Probabilistic expectimax over a pruned pick-ban tree** (top-k candidates from item 5, depth 2–4, leaf = item 2's evaluator). This turns DraftLab from a static rater into a *draft navigator* ("if you take Vi now, expect their Azir flex, then your best line is…") at millisecond cost; expectimax with a learned opponent distribution is the right adversary model for predictable pro opponents.

7. **Fearless series-value layer à la JueWuDraft** — value every pick as `thisGameValue + E[remaining-series pool value]`, where pool value is a cheap comfort-budget heuristic per role per team, with a denial term for hard Fearless (your pick removes it from *their* future games too). JueWuDraft's +4.9pp from exactly this mechanism, growing with series length, is the only published evidence on multi-game drafting — and no LoL tool has shipped a principled version, so this is DraftLab's clearest differentiation opportunity for the 2026 Fearless era.

8. **Platt/temperature calibration layered per draft phase, refit per patch window** — two parameters, fittable on one split of league data, conditioned on picks-locked count. It makes the displayed probabilities mean what they say (the entire credibility of a 55–58%-signal product) and quantifies patch drift as a side effect (watch the fitted slope b collapse after big patches).

9. **Uncertainty-first UX: posterior intervals, tier rendering, and suppressed false precision** — drive pool tiers from posterior quantiles, show "could be neutral" on pick deltas whose intervals cross zero, and surface evidence counts ("4 of last 6 series") next to every tendency claim. This costs almost nothing given item 1 and is, per the chess-tool lesson, what makes professional staff adopt a tool rather than screenshot-dunk it.

10. **Ban/plan EV as best-response-to-a-field, plus scrim/stage source separation** — compute ban value as expected damage against the opponent's tendency distribution (card-game meta logic), and keep scrim evidence in a separately weighted channel (full weight for pool-existence, ~0.2–0.4× for results/tendencies). Both are small composition layers over items 2 and 5 that match how coaching staffs actually reason about preparation — and the scrim dial addresses a real divergence that practitioners acknowledge but no published tool models.

**Explicitly de-prioritized** (poor fit despite literature prominence): transformer draft recommenders (DraftRec — 280k-game appetite, 55.35% ceiling anyway), learned champion embeddings/factorization machines on pro data (needs 10⁶ games; tags substitute), gradient boosting on pro-only data (uncalibratable at n≈10²–10³), RL/deep-MCTS drafting (no training substrate locally), isotonic calibration (overfits at this n). If extra accuracy is ever wanted, the cheapest legitimate add is a one-time offline-trained solo-queue model exported to ONNX as a *prior feature* — but items 1–10 come first.
