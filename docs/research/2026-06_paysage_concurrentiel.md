# Recherche 2026-06 — Paysage concurrentiel : outils de draft LoL (2025-2026)

> Rapport de recherche produit le 2026-06-10 (agent de recherche web, 28 recherches, ~25 sources primaires fetchées).
> Synthèse architecte : voir `docs/ARCHITECTURE_V2.md` §4. Ce fichier est la référence détaillée.

## 0. Executive summary & critical corrections

1. **iTero was NOT acquired by Team Liquid.** It was acquired by **GIANTX** in a multi-million deal announced **July 24, 2024**; founder Jack J. Williams became GIANTX's Head of Gaming Technology ([GIANTX announcement](https://giantx.gg/en/blogs/news/giantx-acquires-league-of-legends-ai-coaching-start-up-itero-gaming)). The product survived and was relaunched as **iTero Standalone** in **November 2025**, off Overwolf, free, 500k+ downloads ([GIANTX](https://giantx.gg/en/blogs/news/giantx-lanza-itero-standalone-la-version-renovada-de-su-herramienta-de-entrenamiento-con-ia), [Esports Insider](https://esportsinsider.com/2025/11/giantx-itero-standalone-launch-ai-coaching)). The probable source of the confusion: **Team Liquid built an internal AI draft tool with SAP**, debuted around **MSI 2024** ([GamesBeat](https://gamesbeat.com/team-liquid-deploys-sap-ai-tool-to-optimize-league-of-legends-drafts/)).
2. **The pro data layer consolidated violently in 2025.** Riot's long-time data partner **Bayes Esports went insolvent** (bankruptcy filed May 2025, insolvency proceedings Aug 2025) and **GRID acquired its assets in Sept 2025**, after GRID had already taken Riot's official LoL/VALORANT data partnership (Riot holds an equity stake in GRID since Nov 2023) ([Esports Insider](https://esportsinsider.com/2025/09/grid-bayes-esports-asset-acquisition), [The Esports Advocate](https://esportsadvocate.net/2025/09/grid-acquires-bayes-esports-intellectual-property-assets/)). GRID now effectively controls official pro+scrim data ([esports.net](https://www.esports.net/news/bayes-esports-insolvency-leaves-grid-dominant-in-esports-data/)).
3. **Fearless draft is now the permanent global format.** Hard Fearless ran across LCK/LPL/LEC/LTA/LCP + First Stand + MSI + Worlds in 2025 and returns for 2026; T1 won Worlds 2025 under it ([esports.gg](https://esports.gg/news/league-of-legends/fearless-draft-in-lol-esports-explained/)). **New for Jan 2026: the "First Selection" rule** — the team with selection priority chooses *either* side *or* first/second pick; the opponent gets the other. Riot explicitly frames it as rewarding "preparation, champion pools, and opponent scouting" ([GosuGamers](https://www.gosugamers.net/lol/news/77812-lol-esports-2026-introduces-new-draft-rule-first-selection-and-a-bo5-heavy-first-stand)). Several community tools (Drafter.lol, DraftCore, scoutahead.pro) already advertise First Selection support — DraftLab must support it.
4. **DraftGap's methodology is fully recoverable from source** (MIT, actively maintained — v3.2.1 released Feb 1, 2026) ([GitHub](https://github.com/vigovlugt/draftgap)).
5. The market splits into three tiers that almost never overlap: **(a)** consumer stat-recommenders (DraftGap, iTero, LoLDraftAI, ProComps), **(b)** free draft *simulators* with fearless/series/OBS workflow (Drafter.lol, draftlol, DraftCore, …), and **(c)** pro B2B data/scouting platforms (GRID, Shadow, gol.gg, Oracle's Elixir, internal tools). **Nobody combines all three**, and nobody does fearless *series-pool planning* — that's DraftLab's lane (see §5).

---

## 1. Stat-driven draft recommenders

### 1.1 DraftGap — draftgap.com

- **Features:** Web + desktop drafting companion; desktop app auto-syncs with the League client during champ select. Suggests picks/bans per role based on meta winrates, matchups, duos; computes draft win probability; "unopinionated... only statistics".
- **Methodology (from source):** Elo/logit rating space (`ratingToWinrate: 1/(1+10^(-d/400))`, `winrateToRating: -400·log10(1/w−1)`); total draft rating = Σ ally champions + ally duos − enemy champions − enemy duos ± matchups; Bayesian shrinkage with `priorGames` pseudo-games at the champion-role 30-day base WR; risk dial = prior strength (`{very-low: 3000, low: 2000, medium: 1000, high: 500, very-high: 250}`); matchup symmetrization `wins=(matchupStats.wins+enemyLosses)/2`; duo synergy = deviation from independence; suggestion loop simulates every (champion × open role) and ranks; filter `(games/30)*7 < minGames`.
- **Data:** Daily GitHub Actions pipeline pulling **Lolalytics at `tier=emerald_plus`** + Riot API metadata; versioned datasets; "rank bias removal" in pipeline.
- **Access:** Free, MIT, in-browser. **Adoption:** soloq/amateur; no pro evidence (57 stars; fork: draftgap-plus).
- **Weaknesses:** pairwise "bag of champion pairs" — no composition identity (adversarial example: all-AP comp rated 64.9% by DraftGap vs 40.2% by LoLDraftAI's NN; holdout 32,750 games: DraftGap log loss 0.6869/acc 54.66% vs LoLDraftAI 0.6829/55.88% — vendor-run benchmark); soloq emerald+ ≠ pro; no fearless/series; no opponent modeling.
- https://draftgap.com/ · https://github.com/vigovlugt/draftgap

### 1.2 iTero / iTero Standalone (GIANTX) — itero.gg

- **Features:** Real-time drafting coach (both teams, match history, champion pools), ban suggestions, drafting simulator, champion pool builder, post-game "AI macro coach", overlays; "Smart Champion Select" in Standalone.
- **Methodology (public, candid):** Ensemble linear + GBT; time-split validation on pro matches; ~67% post-draft accuracy on pro games vs bookmakers ~62-65%, 70-73% with draft data; estimates **draft ≈ 7.5% of game outcome**; openly questions soloq→pro transfer ([The iTero AI Drafting Model](https://www.itero.gg/articles/the-draft-model), [Draft Review Model](https://medium.com/the-esports-analyst-club-by-itero-gaming/the-draft-review-model-lol-57aeef1de89a), [1M+ soloq drafts study](https://www.itero.gg/articles/draft-sq) — lane counters strongest signal).
- **Status:** consumer pivot; pro features now GIANTX-internal; 500k+ installs; free + paid tier.
- https://www.itero.gg/

### 1.3 LoLDraftAI — loldraftai.com

Full-draft win probability NN (all 10 picks jointly), counterpick-aware + flex-safe suggestion modes, rune AI; retrained every patch; claims 56.7% draft-only accuracy (57.7% with runes), emphasizes **calibration**; soloq only, "Silver to Challenger", black box, no fearless/series/team features. https://loldraftai.com/

### 1.4 ProComps — procomps.gg

Live draft assistant + tactical alerts, ban recommendations, enemy lane prediction, comp builder, pre-game plans, **champion pool management with four tiers (Strongest / Match Ready / Scrim Ready / Learning)**, shareable pools, multi-team management with roles (coach/analyst/captain/shotcaller), analyst-set tier lists syncing the team's recommendations, mock draft sim, **Draftlol + ProDraft integrations**, League client integration, "100% Vanguard compliant". Free + Pro premium; 245k+ Overwolf downloads; testimonial = GM amateur team (no tier-1 evidence). Proprietary curated heuristics; no fearless series planning; Overwolf dependency. https://procomps.gg/

### 1.5 Smaller/indie recommenders

METAsrc Counter Picker · LoLTheory Team Comp Analyzer · LoL Brain · GankPls · lolcompbuilder.com · Baron Buff · Coachless.gg · swainBot (old OSS ML).
**Hackathon-tier but instructive:**
- **DraftMind AI** (Cloud9×JetBrains hackathon, Feb 2026): GRID API, 2,282 pro matches/941 series/56 teams; **hierarchical model** (league baseline → team layer ≥10 games → head-to-head ≥3 games), XGBoost 40 features, **temperature scaling**, surfaced sample sizes ("23 matches" vs "3 matches") to build trust ([Medium](https://medium.com/@aniketkumar6256/i-built-an-ai-draft-coach-for-league-of-legends-in-2-weeks-heres-what-i-learned-35438782f2da)).
- **OpponentIQ** (GRID Central Data + Series State APIs): auto-generated opponent scouting reports — pools, ban priorities, comp patterns, target bans, **PDF/JSON export**; lesson: "display Unknown rather than fabricated data" ([dev.to](https://dev.to/dhani_dzulkarnain/building-opponentiq-automating-esports-scouting-with-grid-api-kp3)).

---

## 2. Draft simulators & series-workflow tools (the fearless wave)

### 2.1 Drafter.lol — the current category leader

"One link per series" — full draft + scrim block + series tracking in a single link; **Fearless, Ironman & First Selection modes**; professional broadcast layouts; **deep OBS integration**; team workspace: **scouting, scenarios, live collaboration, team calendar (availability + scrim bookings), custom champion pools with categories**. No analytics/recommendations; user-entered drafts; free core + pricing page (freemium); "approved by amateur teams to LEC coaches" (vendor claim). https://drafter.lol/

### 2.2 Autres simulateurs

- **draftlol.dawe.gg** — vénérable sim; liens blue/red/spectateur; désactivation de champions, timers custom, restrictions; jugé meilleur sim tournoi par ProComps; intégré par ProComps. https://draftlol.dawe.gg/
- **prodraft.leagueoflegends.com** — outil Riot historique, interface datée.
- **Cluster fearless 2025-2026** (tous gratuits, deltas faibles) : scoutahead.pro (fearless 10 bans/10 picks) · DraftCore/fearlessdraft.com (Fearless & First Selection, dashboard) · fearlessdraft.net · EzDraft · DraftVision (tier-list + dessin sur map) · Draftedlol (draft puzzle quotidien) · uDrafter (liens spectateur temps réel) · Pick Ban Pro (timers + **browse des drafts pro complétées toutes régions**) · PickBan web app.
- **drafting.gg (LS)** — sim + versus + tier lists; remplaçant d'un outil antérieur "used by professional teams"; LS & Nemesis co-owners de Mobalytics. https://drafting.gg/
- **RCVolus/lol-pick-ban-ui** — UI broadcast open source (OBS parity reference). https://github.com/RCVolus/lol-pick-ban-ui

---

## 3. Pro/B2B analytics platforms & data layer

### 3.1 GRID — the official data chokepoint

LoL Esports Data Portal (built Riot+Bayes, **now operated by GRID**): 150+ teams/partners, UI + API; **teams from ERL1 upward access their own scrim data + all Riot match data second-by-second**. Pricing: free tier for professional teams, premium beyond; paid for commercial users. GRID Central Data / Series State APIs suffice for automated opponent scouting (proven by OpponentIQ, DraftMind). Bayes-era docs/SDKs = legacy. https://grid.gg/get-league-of-legends/ · https://riotesportsdata.com/

### 3.2 Shadow (shadow.gg) — feature benchmark, statut incertain

Player scouting soloq+scrims+pro unifié (champion pools), match review VOD + 2D replays, **scrim tracking avec capture computer-vision**, "20+ top-tier pro teams" (claim), construit avec Team Liquid + Tim "Magic" Sevenhuysen (Oracle's Elixir). Unité de DOJO Madness → Bayes Holding ; vu l'insolvabilité Bayes 2025, statut opérationnel 2026 **incertain** (site stale). Benchmark de features, pas forcément une menace active.

### 3.3 Mobalytics

Géant consumer; lineage pro 2017-2021 (TL, T1, GG, Scouting Grounds); LS+Nemesis co-owners; pas de SKU équipe/coach actuel.

### 3.4 Pro-stats sites analysts actually use

- **gol.gg** — Picks & Bans par tournoi (patch/semaine/side/phase de ban), stats équipe/joueur/champion toutes ligues majeures; LCK 2026 + First Stand 2026 déjà servis; gratuit + Patreon premium.
- **Oracle's Elixir** — CSV téléchargeables (daily, 12 lignes/game, colonnes pick/ban 1-5), standard de facto des analystes. https://oracleselixir.com/tools/downloads
- **OP.GG Esports** — pick/ban rankings, stats champions/équipes par ligue. https://esports.op.gg/banpick
- **LoLalytics** — stats soloq les plus profondes (Emerald+ par défaut), upstream de DraftGap.
- **Leaguepedia API** — accès programmatique gratuit aux picks/bans/rosters pro; cité par une analyste LEC comme fallback des équipes sans Bayes/GRID ([poro client](https://github.com/pacexy/poro)).
- **Factor.gg** — plateforme gratuite lancée par Evil Geniuses (2021), v2 couvre ERL/ligues locales.
- **PandaScore** (API commerciale, utilisée par au moins une analyste LEC) · **dpm.lol** · **bo3.gg**.

### 3.5 Scrim/team-management SaaS (adjacent)

- **ScrimStats.gg** — scrim analytics, 14-day trial (paid SaaS), open alpha mi-2025, "coaches, teams & managers".
- **ProStaff.gg + scrims.lol** — scrim finding + auto-tracking (W/L par adversaire, VOD links, champion winrates, **pick/ban trend monitoring**).
- **HexCore.gg** — gestion d'équipe : scrims, calendrier, champion pools, compositions.
- wecoach.gg (marketplace coachs) · Curry.gg (listings).

### 3.6 Team-internal tooling (tier-1)

- **Team Liquid × SAP** : assistant draft IA générative sur SAP AI Core, **1.6M matchs amateurs + 6,000+ matchs pro** (Riot esports API); tendances joueur/équipe; surface **plusieurs options, pas une réponse**; debut ~MSI 2024; ~10,000 heures-analyste/an économisées (claim); **simulation de draft contre un adversaire spécifique** ("sparring partner").
- **GIANTX** : modèles iTero pour l'entraînement interne.
- **Workflow analyste documenté** (Flora "Arailla" Parmentier, LEC) : (1) collecte — tracking de comptes soloq, picks/bans manuels + PandaScore/Leaguepedia, Riot API → **Google Docs/Sheets templates**; (2) analyse — **Tableau**, gol.gg, graphs custom; (3) VOD review pour valider; livrable final = **Google Slides, une slide par tendance avec deux exemples VOD timestampés**. Outillage rêvé : rotations map / jungle proximity automatisés.
- **Inégalité d'accès aux données** : un coach GameWard (ERL) — seules les orgs affiliées LEC avaient l'accès Bayes; les autres "ne peuvent simplement pas analyser leurs propres matchs et scrims" ([laurentcazanove.com](https://laurentcazanove.com/blog/why-league-of-legends-needs-to-step-up-its-data-game)).

### 3.7 Ghosts

"Pentanex", "ScrimOS", "RUNES", "NoesisGG" — aucun produit LoL trouvé sous ces noms (Noesis.gg = CS2). Pistes mortes.

---

## 4. Fearless context every feature decision should assume

- Hard Fearless partout en 2025 (LCK/LPL/LEC/LTA/LCP + First Stand + MSI + Worlds), reconduit 2026; T1 champion du monde 2025 sous ce format.
- **Témoignages coachs** (Dot Esports, Worlds 2025, cinq régions) : kkOma — improvisation constante en fin de série; les coachs planifient des **"series pools", pas des pools par game**, et pensent en **combinaisons réassemblables** (synergies mid-jungle, duos bot) à mesure que le pool s'épuise; couleurs régionales — improvisation LCK, profondeur LPL, créativité LEC.
- **Impact mesuré après un an** : taux d'apparition de nouveaux champions inchangé, mais **concentration des top picks divisée par deux** (champion le plus pické : 48 picks Worlds 2024 → 27 Worlds 2025); profondeur de pool "obligatoire, plus optionnelle"; un Bo5 brûle jusqu'à ~50 champions; "you must literally know 10 tanks".
- **First Selection (janv. 2026)** : l'équipe prioritaire choisit *side* OU *first pick*; l'adversaire prend l'autre. Riot le cadre comme récompensant "preparation, champion pools, and opponent scouting". Le modèle side/plan de DraftLab doit encoder ce choix par game.

---

## 5. Synthesis

### 5.1 Feature matrix — table stakes vs differentiators

**Table stakes** : sim standard + fearless · liens partageables blue/red/spectateur · tracking de série Bo3/Bo5 avec lockouts · gratuit · timers/restrictions · **First Selection mode** (devient table stakes).

**Parité compétitive** : OBS overlay (Drafter.lol) · recommandations stat soloq (DraftGap/LoLDraftAI/iTero/ProComps) · pools à 4 tiers (ProComps) · browse stats pro (gol.gg, OP.GG) · scrim logging (ProStaff, ScrimStats, GRID portal) · sync client League.

**Vrais différenciateurs (≤2 implémentations crédibles, surtout internes)** :

| Capability | Evidence |
|---|---|
| Opponent tendency models feeding draft suggestions | TL×SAP (interne), DraftMind/OpponentIQ (hackathons) — **aucun produit shipping** |
| Fearless **series-pool planning/optimization** (allouer les pools sur G1-G5, simuler la déplétion adverse) | **personne** — les coachs décrivent le faire mentalement |
| Draft prep → **Slides/Sheets/PDF export** | OpponentIQ (hackathon); les analystes le font à la main |
| Post-draft review/grading | concept iTero publié uniquement |
| Soloq+scrim+pro unifiés | Shadow (statut incertain) |
| Local-first / data-private | **personne** — tout est SaaS; les équipes sont secrètes |

### 5.2 White space (avec preuves)

1. **La planification de series-pool Fearless n'appartient à personne.** Les coachs décrivent planifier des "series pools" et des combinaisons réassemblables; un Bo5 consomme ~50 champions. Tous les outils existants *trackent* les lockouts; aucun n'optimise "quels champions dépenser en G1 vs garder pour G4, étant donné la profondeur adverse par rôle". → Étendre le tracking DraftLab vers **planning/what-if**.
2. **Le modèle de tendances adverses est interne-only.** TL×SAP prouve la demande tier-1; les hackathons prouvent que GRID/Leaguepedia suffisent. Aucun produit achetable n'offre "cette équipe first-picke X, a ban Y 80% côté rouge, le pool de leur jungler fait 6 de profondeur".
3. **Le livrable analyste = slides+sheets, et aucun outil n'exporte vers ça.** Workflow LEC documenté finit en Google Slides. Un "export prep pack (plans A/B/C, pages bans, grilles de pool) en Slides/Sheets/PDF" en un clic n'a **zéro concurrence**.
4. **Les équipes sub-tier-1 sont affamées de données et price-sensitive.** GRID ne couvre les scrims qu'à partir d'ERL1. Un outil local-first qui ingère Leaguepedia/gol.gg/OE/saisie manuelle sert des milliers de staffs semi-pro ignorés par les SaaS.
5. **Confiance/privacy non adressées.** Culture du secret documentée; tous les concurrents sont cloud. **Le local-first est en soi un différenciateur** — le marketer ainsi.

### 5.3 Five lessons DraftLab should steal

1. **Garder le cœur additif transparent de DraftGap** — espace logit/Elo, shrinkage pseudo-games, symétrisation matchup, synergie=déviation, risk slider = force du prior. Prouvé, explicable, client-side.
2. **Blending hiérarchique pour survivre à la sparsité pro** — league baseline → team (≥10 games) → head-to-head (≥3) [DraftMind]; ou base amateur + couche pro [TL×SAP]. **Montrer quelle couche a produit chaque nombre.**
3. **Afficher les tailles d'échantillon et l'incertitude; ne jamais fabriquer.** Badges "23 matches vs 3 matches" (DraftMind); "Unknown plutôt que données fabriquées" (OpponentIQ); calibration en claim de tête (LoLDraftAI); temperature scaling.
4. **Recommander des options, pas des réponses** — TL×SAP surface plusieurs lignes candidates; ProComps synchronise des tier lists décidées par l'analyste. Plan A/B/C est la bonne forme : le moteur annote les plans, ne les dicte pas.
5. **Gagner le workflow, pas seulement les maths.** Drafter.lol gagne sur "one link per series", OBS natif, calendrier scrims, pools par catégories; les analystes vivent dans Sheets/Slides. Series-link sharing + export Slides/Sheets/PDF tôt — moins cher que le travail modèle, adoption plus forte.

### 5.4 Three traps to avoid

1. **Le piège pairwise-soloq.** Les modèles matchup-pair ratent l'identité de comp (all-AP 64.9% vs 40.2%); les priors soloq transfèrent mal au pro (iTero : draft ≈ 7,5% de l'outcome). Ne pas vendre des win-probs précises à des staffs pro qui trouveront les contre-exemples; cadrer en *résumés de preuves avec incertitude*; ajouter les features comp-level au-dessus du cœur pairwise.
2. **Le piège du business B2B esports.** Cimetière : Bayes insolvable malgré l'exclusivité Riot; iTero pivoté consumer puis exit vers une org; Shadow stagnant; Mobalytics survit sur le consumer. ~50-60 orgs tier-1/2 seulement. Le local-first évite le burn SaaS; viser la distribution vers les **milliers** de staffs semi-pro/ERL/collégiaux, pas un sales motion tier-1.
3. **Le piège dépendance/compliance.** DraftGap dépend du scraping Lolalytics; Overwolf = compliance plateforme; la donnée officielle = monopole GRID gated; le format mute chaque année (soft→hard fearless 2025, First Selection 2026). **Ingestion pluggable** (Leaguepedia / gol.gg / OE CSV / GRID / manuel), **rules-engine data-driven**, jamais de feature porteuse sur une source scrapée unique ni sur une intégration client que Riot peut casser.

---

### Appendix: full URL index

Voir le rapport source pour l'index complet des ~60 URLs (produits, code, news/analyses).
Principales : draftgap.com · drafter.lol · itero.gg · loldraftai.com · procomps.gg · draftlol.dawe.gg · pickban.pro · scoutahead.pro · lol.draftcore.net · drafting.gg · shadow.gg · grid.gg/get-league-of-legends · gol.gg · oracleselixir.com/tools/downloads · esports.op.gg/banpick · lolalytics.com · factor.gg · scrimstats.gg · prostaff.gg · hexcore.gg · github.com/vigovlugt/draftgap · github.com/RCVolus/lol-pick-ban-ui · gamesbeat.com (TL×SAP) · medium.com/@arailla (workflow analyste LEC) · laurentcazanove.com (data gap ERL) · dotesports.com (coachs × fearless) · gosugamers.net (First Selection 2026).
