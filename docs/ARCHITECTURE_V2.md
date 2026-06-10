# DraftLab — Architecture V2 : le niveau professionnel

> Statut : **proposé** — rédigé le 2026-06-10 par l'architecte (session Claude), sur la base
> (a) d'une étude complète du code et des specs survivantes, (b) de trois rapports de
> recherche web frais (concurrence, données, méthodologie — voir `docs/research/`),
> (c) des verdicts empiriques M3.3-M3.5. Succède à `ARCHITECTURE_V1.md` (perdu dans la
> réinstallation Windows ; son scope M5→V1.0 est aujourd'hui reconstruit et vert).
>
> Convention : les décisions sont numérotées **DA-V2-n** et les jalons **R0…R7**.
> Tout changement de comportement passe par `docs/STEP_UP.md` (sign-off Alain).

---

## 0. TL;DR

DraftLab a survécu à la perte de son code : toute la logique M1-M7 est reconstruite et
verte (210 tests). Ce qui manque pour être *réellement* compétitif au niveau pro n'est
pas un algorithme magique — c'est : **(1)** une colonne vertébrale de données pro
multi-sources avec l'ordre de draft, des snapshots datés et de la provenance ;
**(2)** l'UI (perdue) reconstruite en deux modes Prep/Match ; **(3)** un harnais de
validation permanent qui calibre chaque heuristique au lieu de la deviner ;
**(4)** trois features que personne n'a : le **planificateur de series-pool Fearless**,
les **tendances adverses par rotation** productisées, et l'**export prep pack**
(Slides/Sheets/PDF). Le tout en restant local-first — qui est un différenciateur de
confiance, pas une contrainte.

Les trois paris assumés : la donnée avant les modèles ; l'incertitude affichée comme
feature de confiance ; Fearless/First Selection comme terrain de jeu principal
(2026 le confirme : format permanent, « First Selection » nouvelle règle de janvier).

---

## 1. Mission et critères de succès

**Mission** (inchangée depuis le dossier fondateur) : le constructeur stratégique de
drafts pour staffs **externes** — coach freelance, analyste, équipe ERL/T2 sans accès
GRID — sur données publiques, workflow d'un coach top-niveau, du lundi de prep au
27-secondes du match.

« Compétitif au plus haut niveau professionnel » se mesure. Critères d'acceptation V2 :

| # | Critère | Mesure |
|---|---|---|
| S1 | Un analyste peut préparer une vraie semaine de match | Workflow complet LFL/LEC/LCK : scout adverse → tendances → plans A/B/C → série Fearless → export, sans quitter l'outil |
| S2 | Données fraîches et fiables | Drafts d'hier disponibles ; ≥2 sources croisées ; divergences signalées, jamais silencieuses |
| S3 | L'ordre de draft est un objet de première classe | Rotations B1/R1-2/…, tendances par slot et par side, First Selection encodé |
| S4 | Chaque nombre affiché est défendable | Posterior + intervalle + taille d'échantillon + couche de provenance (« league prior / team / H2H ») visibles |
| S5 | Chaque heuristique a un score de backtest versionné | Harnais walk-forward par patch, métriques par module (ex. « top-5 bans : 2,9/5 retrouvés, baseline 1,8 ») |
| S6 | Fearless : l'outil planifie, ne tracke pas seulement | Simulation de déplétion Bo5, valeur de rétention/déni par pick, what-if multi-games |

---

## 2. État des lieux (vérifié le 2026-06-10)

### 2.1 Ce qui existe et tourne

`pnpm test` → **210 verts / 1 skipped**, svelte-check 0 erreur, lint clean (vérifié ce jour).

| Couche | Modules | État |
|---|---|---|
| Moteur M1 | `engine/{ratings,bayesian,getStats,analyzer}` + `dataset/` | ✅ parité DraftGap 0,00pp (10 drafts cross-checkés) |
| Pro M2 | `pro/{championLookup,contextBuilder,comfortDefaults,types}` + blend comfort/side | ✅ nombres M2_PING2 exacts |
| Tags M4.1 | `tags/` + `data/championTags.json` (172/172) | ✅ |
| Stratégique M4-M6 | gamePlan, powerCurve, riskMarkers (12), adversaryPlan, inferRoles, poolTier, pocketPick, pickSuggester, banPriority | ✅ logique ; ⚠️ heuristiques reconstruites « behaviour-faithful », jamais calibrées |
| Storage M6-M7 | `storage/{idb,draftPlans,series}` (plans A/B/C, séries Fearless) | ✅ |

### 2.2 Ce qui manque (perdu ou jamais construit)

1. **Scraper gol.gg** (`pro/golgg.ts` + `/api/golgg` proxy) — la pièce la moins fidèle à reconstruire (fixtures perdues). Spec de référence : `M2_PING1.md` + `M2_PING1_ZYB.json`.
2. **Runner de calibration M3** (corpus + walk-forward) — les corpus JSON survivent.
3. **Toute l'UI Svelte** (routes `/`, `/prototype`, `/plans`, `/series`, `/live`, `/help` + ~12 composants). La capture d'écran du 2026-05-09 à la racine documente le layout V1.
4. **`pnpm build` final** + activation CI (repo jamais poussé sur GitHub — **aucun backup externe**).

### 2.3 Trouvailles d'audit de cette session

- **Seuils Pool Tier divergents** : code reconstruit 20/10/3 vs dossier fondateur §2.2 (iTero) 14/5/1 → STEP_UP #9.
- **`LEAGUES` n'active que la LFL** alors que M3.5 scrapait déjà LCK/LEC/LPL → STEP_UP #10.
- **gol.gg injoignable depuis cette machine ce jour** (timeout HEAD/GET/curl), pendant que le CDN DraftGap (200) et l'API Cargo Leaguepedia (200) répondent. L'agent de recherche (egress datacenter) constate le même drop réseau — gol.gg bloque les plages datacenter ; les tests live résidentiels passaient encore au 2026-05-01 → vérifier au navigateur (action A3). Démonstration en conditions réelles de la fragilité mono-source → DA-V2-2.
- Worktree fantôme `.claude/worktrees/relaxed-franklin-094e85` : snapshot docs ancien, rien d'unique, supprimable.
- `draftlab-frameworks-research.md` (dossier fondateur) est **gitignoré volontairement** → à sauvegarder hors repo (cf. §10).

---

## 3. Verdicts empiriques fondateurs

Ces résultats contraignent tout ce qui suit. Ne jamais les re-litiger sans nouveau corpus.

1. **La prédiction de vainqueur par la draft ne bat pas la force des équipes.**
   M3.3-3.5 (N=320, walk-forward) : side-only ~73 % d'accuracy vs M3 59-70 % selon le
   corpus ; side-only gagne 17/26 des désaccords. M3 ne gagne que sur le **log loss**
   (probabilités mieux calibrées). → Le produit vend des **plans, du scouting et des
   probabilités calibrées**, jamais « on prédit le vainqueur ».
2. **La littérature confirme le plafond** (recherche 2026-06) : draft seule ≈ 55-58 %
   d'accuracy (DraftRec 55,35 % ; LoLDraftAI 56,7 %) ; identité d'équipe seule 63-65 % ;
   iTero estime la draft à **~7,5 % de l'outcome** ; le confort joueur-champion domine
   la composition (75,1 % pré-game avec features de mastery). Le signal qui monte avec
   le niveau de jeu **décroît** (FM : AUC 0,706 → 0,660 en très haut skill).
3. **Les matchups SoloQ ne transfèrent pas au pro** (pivot M3.5, « Suite B ») — le
   SoloQ sert de **prior**, pas de vérité.
4. **Le leakage temporel est réel** : les pools scrapés « au présent » contaminent le
   backtest (limitation documentée M3.3-3.5). → snapshots datés obligatoires (DA-V2-3).

---

## 4. Positionnement 2026 (synthèse de l'étude concurrentielle)

Détails et sources : `docs/research/2026-06_paysage_concurrentiel.md`.

**Le marché est en trois tiers qui ne se recouvrent pas** : (a) recommenders stat
consumer (DraftGap, iTero/GIANTX, LoLDraftAI, ProComps) ; (b) simulateurs/workflow
gratuits de l'ère Fearless (Drafter.lol en tête : séries en un lien, OBS, calendrier
scrims, First Selection) ; (c) plateformes data pro B2B (GRID — désormais monopole
officiel après l'insolvabilité de Bayes — gol.gg, Oracle's Elixir, outils internes
type Team Liquid×SAP). **Personne ne combine les trois. Personne ne fait de
planification de series-pool Fearless** — les coachs disent la faire de tête.

**Différenciateurs DraftLab confirmés** (≤2 implémentations crédibles au monde, aucune achetable) :

1. **Planification Fearless multi-games** (dépense/rétention/déni de pool sur G1-G5) ;
2. **Tendances adverses par rotation productisées** (« first-picke X, ban Y 80 % côté rouge, jungler 6 de profondeur ») — n'existe qu'en interne tier-1 ;
3. **Export prep pack** Slides/Sheets/PDF — zéro concurrence, et c'est le livrable réel des analystes ;
4. **Local-first / privacy** — tout le marché est SaaS, la culture des équipes est secrète ;
5. **Multi-source publique pour les sub-tier-1** — GRID ne couvre les scrims qu'à partir d'ERL1 ; les staffs ERL/T2 sont affamés de données.

**Table stakes à atteindre** (sinon disqualifié) : sim fluide standard+Fearless,
**mode First Selection** (règle 2026 : side OU first pick), tracking de série avec
lockouts, gratuité du cœur. (OBS/broadcast : non prioritaire — créneau différent,
Drafter.lol l'occupe bien.)

**Pièges actés** : ne pas vendre du win% à des pros (piège pairwise-soloq) ; ne pas
faire un business B2B tier-1 (~50 orgs, cimetière : Bayes, iTero, Shadow) — viser les
milliers de staffs ERL/semi-pro ; ne jamais poser une feature porteuse sur une source
scrapée unique ni sur une intégration client cassable par Riot.

---

## 5. Stratégie données — « la donnée est le produit »

Détails d'accès et structures : `docs/research/2026-06_ecosysteme_donnees.md`.

### 5.1 Principes

- **DA-V2-2 — Multi-source pluggable.** Une interface `DataProvider` unique ; au moins
  deux sources indépendantes pour toute donnée porteuse ; détecteur de divergence
  (mismatch → warning visible, jamais de moyenne silencieuse). La panne gol.gg du
  2026-06-10 est l'argument vivant.
- **DA-V2-3 — Snapshots immuables datés.** Chaque sync écrit un snapshot versionné
  (IndexedDB) : `{fetchedAt, patch, source, payload}`. Le « pool as-of-date » devient
  trivial → backtests honnêtes, rejeu d'une prep, diff entre deux semaines.
- **DA-V2-4 — Provenance par couche.** Tout agrégat porte sa couche d'origine
  (global → ligue → équipe → joueur → H2H) et sa taille d'échantillon ; l'UI les affiche.

### 5.2 Sources et rôles

| Source | Rôle | Notes d'architecture |
|---|---|---|
| **Leaguepedia Cargo API** | **Primaire structuré** : `PicksAndBansS7` (ordre complet Ban1-5/Pick1-5 + rôles + `N_GameInMatch`) ⋈ `ScoreboardGames` (date UTC, patch, vainqueur) sur `GameId` | Vérifiée up ce jour ; ⚠️ **bot password requis** (rate-limit anonyme rédhibitoire, constaté) ; max 500 lignes/requête ; CC BY-SA 3.0 (attribuer) ; clés stables = `OverviewPage`/`GameId`, jamais les row IDs |
| **gol.gg** | Secondaire chaud : pools joueurs, side stats, drafts récentes, picks & bans par tournoi | Scraper à reconstruire (spec M2_PING1) **avec fixtures HTML commitées** + contract-tests ; **bloque les IP datacenter** (constaté) → scraping local-first uniquement, jamais server-side/CI ; proxy durci en spec |
| **Oracle's Elixir CSV** | Backfill historique 2014→2026 + validation croisée | **Contient l'ordre pick/ban depuis fév 2024** (ban1-5/pick1-5) ; MAJ quotidienne ; non-commercial, attribuer ; vérifier les colonnes 2026 au premier import |
| **Data Dragon / CommunityDragon** | Statique : champions, patchs, icônes | DDragon = liste versionnée stable ; CDragon = assets same-day (à jour le matin du patch 26.11, constaté) |
| **CDN DraftGap (lolalytics emerald+)** | Prior SoloQ du moteur M1 | Conservé court terme ; pipeline propre = step-up moyen terme (BACKLOG) |
| **Saisie manuelle scrims (+ ROFL metadata optionnel)** | Pools/tendances internes pour le coach qui en dispose | Canal séparé avec **dial scrim/stage** (poids ~0,2-0,4 sur les résultats, plein poids sur l'existence de pool) — cf. §6 ; l'ordre de draft n'est PAS dans le header ROFL → la saisie/CSV est le canal universel |
| **GRID** | Optionnel : scrims + drafts full-fidelity | ⚠️ **Open Access n'inclut PAS LoL** (vérifié) — gratuit pour les équipes ERL1+ seulement → adapter « bring your own key », jamais une dépendance porteuse ; re-vérifier trimestriellement le LDP communautaire Riot |
| **Riot API (personal key)** | Features soloq des pros (mapping comptes via trackingthepros/dpm.lol) | Les games pro (tournament realm) ne sont **pas** dans match-v5 ; soloq only |

### 5.3 Schéma interne normalisé (versionné)

Nouveau type pivot `DraftRecord` (remplace progressivement `RecentDraft`) :

```
DraftRecord {
  gameId, date, patch, league, tournament,
  blueTeamId, redTeamId, winner,
  series: { seriesId, gameNumber, mode: standard|fearless },
  firstSelection?: { holder: teamId, choice: 'side' | 'pick' },   // règle 2026
  actions: [ { seq: 1..20, type: pick|ban, side, championKey,
               role?, playerId?, phase: ban1|pick1|ban2|pick2 } ],
  provenance: { source, fetchedAt, snapshotId }
}
```

Deux contraintes de modélisation issues de la recherche (rapport données §2.4, §2.2) :

- **`side` et l'ordre de pick sont quatre dimensions indépendantes** (`side`,
  `pickOrder` dérivé de `actions`, `gameNumber`, `patch`) — depuis First Selection
  (janv. 2026), bleu ≠ first pick. Tout agrégat « par side » doit pouvoir être
  recoupé « par ordre de pick ».
- **Toute stat champion en contexte Fearless se conditionne sur `gameNumber`**
  (un champion pické en G4 l'est dans une méta de série déjà amputée de ~30 champions).

L'**ordre (`seq`)** est la donnée qui débloque R4 (tendances par rotation) et R5
(arbre de draft). Les agrégats pro calculés localement à partir des `DraftRecord` :
presence %, priorité par rotation (B1, R1-2, …), flex map (champion → rôles joués),
blind/counter rate, par side, par ordre de pick et par patch-window.

---

## 6. Doctrine méthodologique

Détails, formules et sources : `docs/research/2026-06_methodologie_draft.md` (Top-10 complet).
Ce qui est **adopté** comme doctrine V2 :

1. **Shrinkage Empirical-Bayes universel** (béta-binomial, method-of-moments) — chaque
   stat affichée est un posterior avec intervalle, jamais une fréquence brute.
   Cascade hiérarchique : global → ligue → équipe → joueur (~50 lignes de TS, module
   central `lib/estimators/`).
2. **L'évaluateur additif M1 est conservé** (squelette prouvé, parité DraftGap), mais
   les signaux purement pro utilisent des priors **N₀ ≈ 10-50** (pas 1000) avec le
   SoloQ/cross-ligue comme *prior mean* ; les termes de paire estimés sur <10 games
   sont plafonnés (la somme de résidus bruités gonfle la variance).
3. **Tag-bridged pair priors** — les 172 tags deviennent le substitut small-data des
   embeddings : résidus synergie/counter agrégés par paire de tags → prior mean des
   paires de champions sans données pro. C'est l'usage le plus rentable du système de tags.
4. **Le harnais de backtest passe AVANT tout nouveau tuning** (walk-forward par patch,
   log loss + Brier + reliability, baselines 50/50 et team-Elo, bootstrap des deltas).
   À 55-58 % de plafond, toute « amélioration » non backtestée est du bruit.
5. **Tendances adverses = tables de fréquence conditionnelles Dirichlet-smoothées**
   (α≈3-8 pseudo-games de prior ligue, décroissance λ≈0,8-0,95/semaine, backoff
   joueur→équipe→ligue). Pas de sequence model à cette échelle. Sortie UI : des
   comptes (« 4 des 6 dernières séries »), pas des logits.
6. **Expectimax probabiliste sur arbre élagué** (top-k 8-15 candidats issus des
   tendances, profondeur 2-4, feuilles = évaluateur) — l'adversaire est modélisé par
   sa distribution de tendances, pas en minimax paranoïaque. Millisecondes, local.
7. **Couche series-value Fearless façon JueWuDraft** : valeur d'un pick =
   `valeur(game courante) + γ·E[valeur de pool restante sur la série]`, avec **terme
   de déni** propre au hard Fearless (mon pick prive aussi l'adversaire). Seule
   évidence publiée du multi-game : +4,9pp en Bo5. Personne ne l'a shippé pour LoL.
8. **Calibration Platt par phase de draft** (après bans / après 3 picks / draft
   complète), refittée par fenêtre de patch. Pas d'isotonic (overfit à notre n).
9. **UX incertitude d'abord** : tiers pilotés par quantiles de posterior, « pourrait
   être neutre » quand l'intervalle traverse zéro, précision décimale supprimée quand
   l'échantillon ne la soutient pas, badge de taille d'échantillon partout.
10. **Ban EV = best-response-to-a-field** (valeur d'un ban = dommage attendu contre la
    distribution de tendances adverse) + **séparation scrim/stage** (deux canaux, dial).

**Explicitement écartés** : transformers/embeddings appris sur données pro, GBT
pro-only, RL/deep-MCTS, isotonic — tous data-starved à notre échelle (justification
dans le rapport).

---

## 7. Architecture cible

### 7.1 Couches

```
┌──────────────────────────────────────────────────────────────────────┐
│ UI (SvelteKit, 2 modes)                                              │
│   Mode Prep : scout, tendances, plans A/B/C, war room série          │
│   Mode Match : vue 27s, triggers de plan, notes                      │
│   Exports : prep pack MD/PDF/Sheets                                  │
├──────────────────────────────────────────────────────────────────────┤
│ PLANNERS                                                             │
│   seriesPlanner (Fearless budget/déni/what-if) · draftNavigator      │
│   (expectimax) · banEV (best-response) · plan triggers               │
├──────────────────────────────────────────────────────────────────────┤
│ STRATEGIC (existant, à recalibrer en R3)                             │
│   gamePlanClassifier · adversaryPlanDetector · riskMarkers ·         │
│   poolTier · pocketPick · pickSuggester · banPriority                │
├──────────────────────────────────────────────────────────────────────┤
│ ESTIMATORS (nouveau, central)                                        │
│   EB shrinkage + cascade hiérarchique · tagPairPriors ·              │
│   tendencyTables (Dirichlet) · calibration (Platt) · provenance      │
├──────────────────────────────────────────────────────────────────────┤
│ EVALUATOR (M1 conservé)                                              │
│   additive log-odds : champions + duos + matchups + comfort + side   │
├──────────────────────────────────────────────────────────────────────┤
│ AGGREGATES (nouveau)                                                 │
│   presence/priority par rotation · flex map · blind/counter ·        │
│   par side/patch-window — calculés depuis les DraftRecord            │
├──────────────────────────────────────────────────────────────────────┤
│ DATA (refondu)                                                       │
│   DataProvider : golgg · leaguepediaCargo · oraclesElixir ·          │
│   dataDragon · draftgapCdn · manualScrims · (grid)                   │
│   → normalisation DraftRecord → snapshots immuables (IndexedDB)      │
│   → détecteur de divergence inter-sources                            │
├──────────────────────────────────────────────────────────────────────┤
│ VALIDATION (nouveau, transversal, CI)                                │
│   scripts/backtest : walk-forward par patch, métriques par module,   │
│   rapports versionnés docs/calibration/                              │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 Décisions d'architecture V2

| # | Décision | Justification |
|---|---|---|
| DA-V2-1 | **Stack inchangée** : SvelteKit 2 + Svelte 5 + TS + Tailwind 4, Cloudflare Pages, IndexedDB, pas d'auth ni de backend utilisateur | Local-first = différenciateur de confiance documenté ; pas de coût d'infra ; Tauri reconsidéré seulement si l'ingestion de replays locaux (.rofl) devient un besoin |
| DA-V2-2 | Multi-source pluggable + divergence detector | §5.1 ; panne gol.gg constatée ce jour |
| DA-V2-3 | Snapshots immuables datés | tue le leakage M3.x ; permet rejeu/diff |
| DA-V2-4 | Provenance + taille d'échantillon sur chaque nombre | leçon DraftMind/OpponentIQ ; condition de confiance pro |
| DA-V2-5 | Module `estimators/` central — un seul endroit pour le shrinkage/posteriors | cohérence ; tout module qui affiche une stat le traverse |
| DA-V2-6 | Heuristiques stratégiques paramétrées par des **configs data-driven** (poids/vote tables/seuils en JSON versionné), pas en dur | recalibrables par le harnais sans toucher au code ; le format mute chaque année |
| DA-V2-7 | Fearless + **First Selection** = machine d'état de série de première classe (`side OU first pick` par game, ironman variant prévu) | règle 2026 ; table stakes |
| DA-V2-8 | Exports (MD/PDF/Sheets) = artefacts de première classe, pas un afterthought | le livrable analyste réel ; zéro concurrence |
| DA-V2-9 | Le harnais de validation est un livrable au même rang que les features | S5 ; crédibilité |
| DA-V2-10 | FR d'abord, i18n EN en R6 ; MIT + ATTRIBUTION inchangés | continuité |

---

## 8. Roadmap R0 → R7

Chaque jalon = livrable testable + critères d'acceptation + commit/tag. Estimations en
sessions de travail (≈ une demi-journée équivalent).

### R0 — Filets de sécurité (immédiat, ~1 session, dont actions Alain)
- Push GitHub privé + CI active (`gh repo create draftlab --private --source=. --push`) — **le projet n'a toujours aucun backup externe**.
- Backup hors-repo du dossier fondateur gitignoré (`draftlab-frameworks-research.md`).
- Suppression du worktree fantôme ; tag `recovery-complete`.
- **Acceptation** : CI verte sur GitHub ; deuxième copie du dossier fondateur existante.

### R1 — Colonne vertébrale données (3-5 sessions)
- Provider `leaguepediaCargo.ts` en **primaire** : login bot-password (compte wiki gratuit, config in-app), requêtes `PicksAndBansS7 ⋈ ScoreboardGames`, pagination 500.
- Provider `oraclesElixir.ts` : import CSV annuel (backfill historique + refresh quotidien optionnel), validation des colonnes 2026.
- Rebuild `pro/golgg.ts` + `/api/golgg` en **secondaire** (spec M2_PING1) **avec fixtures HTML commitées** et contract-tests ; validation live depuis la machine d'Alain (gol.gg bloque les IP datacenter — jamais de scraping CI).
- Schéma `DraftRecord` + normalisation + snapshots IndexedDB + divergence detector.
- Cache datasets localStorage → IndexedDB (STEP_UP #3) ; registre de ligues config-driven (LCS/CBLOL séparées en 2026, LTA dissoute) et toutes activées (STEP_UP #10).
- **Acceptation** : sync d'une équipe LFL/LEC/LCK < 60 s ; 20 matchs récents avec ordre complet des 20 actions ; concordance inter-sources ≥ 95 % avec rapport de divergences ; pools as-of-date rejouables.

### R2 — UI v1 reconstruite (4-6 sessions)
- Routes `/`, `/prototype`, `/plans(+id)`, `/series(+id)`, `/live`, `/help` + composants (AppNav, ChampionPicker, ManualDraftPicker, PowerCurveVisualizer, PoolTierPanel, AdversaryPlanEvolution, ConsumptionTrackerPanel, TeamContextPanel, SidePicker, RecentDraftsSidebar…) — parité V1.0-beta (capture d'écran de référence à la racine + specs M2_PING3, M4_PROTOTYPE, journal).
- First Selection dans la création de série/game ; badges échantillon/provenance partout (DA-V2-4).
- **Acceptation** : workflow S1 cliquable de bout en bout ; `pnpm build` Cloudflare vert ; déploiement Pages (secrets = action Alain).

### R3 — Harnais de validation + recalibrage (3-4 sessions)
- `scripts/backtest/` : rejeu walk-forward par patch sur snapshots ; métriques par module ; rapports versionnés `docs/calibration/`.
- Corpus M3 reconstruit + étendu avec l'ordre (Leaguepedia) ; corpus de drafts annotées game-plan (~100, annotation assistée — action Alain ~2h) pour scorer M4.2/M5.1.
- Recalibrage : seuils pool tier (STEP_UP #9), vote table M4.2, poids ban/pick suggesters → configs data-driven (DA-V2-6) ; priors N₀ pro (10-50) ; Platt par phase.
- **Acceptation** : chaque module stratégique a un score versionné vs baseline ; les configs calibrées remplacent les valeurs devinées avec delta documenté.

### R4 — Moteur de tendances & rotations (3-4 sessions)
- Agrégats par équipe/joueur : presence, priorité par rotation, flex map, blind/counter, par side et patch-window.
- `tendencyTables` Dirichlet (§6.5) ; intégration ban priority v2 (ban EV best-response) et adversary detector v2 (priors par séquence).
- UI : panneau « tendances adverses » avec comptes et exemples cliquables (gameIds).
- **Acceptation** : backtest « le top-5 bans suggéré retrouve ≥ X bans réels » au-dessus de la baseline fréquence brute ; fiche tendances exportable.

### R5 — Fearless War Room (3-4 sessions)
- `seriesPlanner` : valeur de rétention/déni par pick (§6.7), simulation de déplétion des pools des deux équipes sur la série, what-if (« si on dépense Azir G2, que reste-t-il pour G4-G5 ? »), profondeur adverse par rôle projetée.
- `draftNavigator` expectimax (§6.6) branché sur les tendances R4, mode série.
- **Acceptation** : démo Bo5 hard-fearless complète ; le planner propose des arbitrages dépense/rétention chiffrés avec incertitude ; perf < 200 ms par évaluation de nœud.

### R6 — Livrables & Mode Match final (2-3 sessions)
- Export prep pack : markdown/PDF **optimisé impression** (plans A/B/C, pages bans par rotation, grilles de pool, feuille de champion-budget, tendances) — les coachs n'ont pas le droit aux appareils sur scène : le livrable qui survit au contact de la scène est imprimable/mémorisable. Export Sheets (CSV structuré d'abord).
- **Mode « re-plan entre les games »** (la fenêtre inter-games est LE moment analyste critique en Fearless) : en 45-90 s, re-ranker les pools restants, recalculer plans et bans pour la game suivante.
- Mode Match 27 s : raccourcis clavier, triggers de plan (arbre A/B/C de M6.3), notes par pick (M8.2).
- i18n EN.
- **Acceptation** : un prep pack généré sur un vrai match récent est montrable à un staff ; re-plan complet d'une game N+1 < 90 s ; saisie d'un pick < 3 s au clavier.

### R7 — Durcissement & opérations (continu)
- Contract-tests scraping planifiés (CI hebdo), playbook patch-day (re-tag nouveaux champions, refresh datasets, MAJ configs), monitoring des sources, revue des 154 tags confidence:medium (action Alain, étalée).

**Dépendances** : R1 → R3 → R4 → R5 ; R2 parallélisable après R1 ; R6 après R2+R4 ; R0 immédiat.
**Total estimé : ~20-27 sessions** (cohérent avec le rythme historique du projet : V1 ≈ 18-20 sprints réalisés en autonome).

---

## 9. Risques et limites honnêtes

1. **Épistémique** : la draft ≈ 7,5 % de l'outcome ; l'outil informe des décisions
   marginales, il ne gagne pas des matchs. Toute la communication produit doit le porter.
2. **Fragilité des sources** : gol.gg KO le jour même de cet audit ; Leaguepedia peut
   changer ses ToS ; le CDN DraftGap est la bonne volonté d'un projet OSS. Mitigation :
   DA-V2-2/3 + fixtures + contract-tests + canal manuel.
3. **Maintenance récurrente** : tags par patch (nouveaux champions, reworks), configs
   par mutation de format (le format a changé deux fois en 18 mois). Mitigation :
   DA-V2-6 (configs data-driven) + playbook R7.
4. **Marché niche, monétisation incertaine** : assumé — le projet vise d'abord
   l'excellence d'usage (profil freelance/ERL d'Alain), pas un SaaS tier-1. Décision
   de pricing repoussée post-R6 (piège B2B documenté).
5. **Bus factor = 1, backup = 0** tant que R0 n'est pas fait. C'est le risque n°1 du
   projet aujourd'hui, avant tout risque technique.
6. **Heuristiques reconstruites non validées** : tant que R3 n'est pas livré, les
   sorties stratégiques sont des opinions structurées, pas des mesures. Les présenter
   comme telles dans l'UI (« non calibré » badge) jusqu'à R3.

---

## 10. Actions immédiates côté Alain (bloquantes ou à fort levier)

| # | Action | Durée | Référence |
|---|---|---|---|
| A1 | Installer GitHub CLI puis pousser le repo : `winget install GitHub.cli` → `gh auth login` → `gh repo create draftlab --private --source=. --push` | 10 min | R0 ; README §CI |
| A2 | Sauvegarder `draftlab-frameworks-research.md` hors machine (il est gitignoré, donc PAS dans le futur push) — ou décider de le commiter | 2 min | §2.3 |
| A3 | Vérifier que gol.gg répond depuis le navigateur (panne constatée le 2026-06-10) — si oui, le problème est côté stack TLS des scripts et le futur proxy/fetch navigateur fonctionnera | 2 min | §2.3, R1 |
| A4 | Valider/amender ce document (les DA-V2 et la roadmap) et les step-ups #9/#10 | 30 min | STEP_UP.md |
| A5 | (Pour R3) Annoter ~100 drafts en game-plan (assisté, formulaire préparé) | ~2 h, plus tard | R3 |

---

## Annexe — Index des recherches versionnées

- `docs/research/2026-06_paysage_concurrentiel.md` — 28 recherches, ~60 sources : qui fait quoi en 2026, white space, leçons, pièges.
- `docs/research/2026-06_ecosysteme_donnees.md` — sources de données pro (accès, schémas exacts, sondes live), workflow analyste, règles Fearless/First Selection 2026.
- `docs/research/2026-06_methodologie_draft.md` — état de l'art méthodologique + Top-10 d'investissements, formules incluses.
- `draftlab-frameworks-research.md` (racine, non versionné) — dossier fondateur : frameworks coachs LCK/LPL/EU, les 8 modules, le positionnement d'origine.
