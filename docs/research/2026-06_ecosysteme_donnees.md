# Recherche 2026-06 — Écosystème de données pro & workflow analyste

> Rapport de recherche produit le 2026-06-10 (agent de recherche web, 25+ recherches,
> ~25 sources, **sondes API live** contre Leaguepedia Cargo et lolesports persisted).
> Synthèse architecte : voir `docs/ARCHITECTURE_V2.md` §5. Ce fichier est la référence détaillée.

## Executive summary (verdicts up front)

| Source | Drafts w/ pick-ban ORDER | Side | Patch | Game # in series | Access | Cost | Verdict for DraftLab |
|---|---|---|---|---|---|---|---|
| **Leaguepedia Cargo API** | ✅ full (Ban1-5, Pick1-5 per side) | ✅ (Team1=blue) | ✅ | ✅ (`N_GameInMatch`) | SQL-ish HTTP API | Free (login required in practice) | **Primary source — adopt** |
| **gol.gg** | ✅ on game pages | ✅ | ✅ | ✅ | Scraping only | Free | **Secondary/cross-check**; blocks datacenter IPs, residential OK; local-first scraping only |
| **Oracle's Elixir** | ✅ since Feb 2024 (ban1-5 + pick1-5 in order) | ✅ | ✅ | ✅ (`game`) | CSV download | Free, non-commercial | **Best bulk backfill** (2014→2026, updated daily) |
| **GRID (official)** | ✅ (full series state) | ✅ | ✅ | ✅ | GraphQL/REST | Teams ERL1+: free; community: **LoL NOT in Open Access** | Only viable if a client team sponsors access |
| **Bayes Esports** | — | — | — | — | **Defunct** | — | Insolvent May 2025; assets → GRID Sept 2025. Remove |
| **lolesports persisted API** | ❌ | partial | ❌ | ✅ | Unofficial REST + public key | Free, unsupported | Schedule/league metadata only; alive 2026-06-10 |
| **Riot Match-v5** | ❌ for pro tournament-realm games | — | — | — | — | — | **Soloq features only** |

**Two architectural red flags:**
1. **2026 "First Selection" decouples side from pick order.** Since Jan 2026, blue side ≠ first pick in pro play. Any model keyed on "blue = B1 first pick" is wrong for 2026 data ([esports.gg](https://esports.gg/news/league-of-legends/first-selection-explained/), [escharts](https://escharts.com/news/first-selection-lol-esports-2026)).
2. **Hard fearless is universal.** Champion stats need fearless-aware interpretation — condition on `N_GameInMatch` (a champ's WR depends on which game of the series it appeared in).

---

# PART 1 — Data sources

## 1.1 gol.gg (Games of Legends)

**Page families** (confirmées par recherche + scraper DraftLab historique) :
- `gol.gg/tournament/tournament-picksandbans/<Tournament Name>/` — tables picks & bans par tournoi (existe pour les splits 2026 → couverture courante).
- `gol.gg/tournament/tournament-matchlist/<slug>/` — liste des games **avec dates** (`YYYY-MM-DD`, sans heure) — seul endroit où vivent les dates (validé M3_1, 8/8 matchés).
- Pages équipe : `team-stats`, `team-matchlist`, `team-draft` ; liste équipes `gol.gg/teams/list/season-SXX/split-ALL/tournament-ALL/`.
- Méta par patch : `gol.gg/stats/patches-by-patches/season-SXX/split-X/`.
- Pages de game (`gol.gg/game/stats/<id>/page-game/`) : draft complète avec ordre, side, patch, game N de la série.

**Stabilité HTML / pièges (validés first-party)** : l'équipe alliée apparaît indifféremment à gauche/droite dans « X vs Y » — parser le side depuis l'index de cellule, jamais la position du nom (M3_1 §3) ; les picks sont en **ordre de phase, pas de rôle** → attribution par pool-match (M3_1 §1). HTML server-rendered statique (scrapers communautaires en JSoup/BS4 sans JS : [PaburoTC](https://github.com/PaburoTC/GamesOfLegends-Scrapper)).

**Anti-bot (testé le 2026-06-10)** : depuis un egress datacenter, gol.gg est **injoignable** (ECONNREFUSED / curl timeout, avec ou sans UA navigateur) → gol.gg droppe le trafic datacenter au niveau réseau. Les tests live résidentiels de DraftLab passaient au 2026-05-01. **Verdict : scraping local-first uniquement (machine du coach), jamais server-side/CI.** Pas d'API, pas de ToS publiés — site de fan gratuit, fragile ; parsers « layout-drift resilient » (détection par nom d'en-tête).

**Latence & profondeur** : pages disponibles en heures ; historique ~S5+.

## 1.2 Leaguepedia (lol.fandom.com) Cargo API — **primaire recommandée**

**Endpoint** : `https://lol.fandom.com/api.php?action=cargoquery&format=json&...` — MediaWiki action API + Cargo SQL. Docs officielles : [Help:Leaguepedia API](https://lol.fandom.com/wiki/Help:Leaguepedia_API) — *« The API works by you making SQL queries to our database »* ; *« This is not an official Riot resource. »*

**Tables/champs exacts (extraits live des `Module:CargoDeclare/*`)** :
- **`PicksAndBansS7`** : `Team1Ban1..5`, `Team1Pick1..5` (ordre de draft), `Team1Role1..5` (*« Role of the first-picked blue-side champion »* → **Team1 = blue, Team2 = red**), idem Team2, `Team1PicksByRoleOrder`/`Team2PicksByRoleOrder`, `Winner`, `Phase`, `Tab`, `N_GameInMatch`, `GameId` (*« OverviewPage_Tab_MatchInTab_GameInMatch »*), `MatchId`, `IsComplete`, `IsFilled`.
- **`ScoreboardGames`** : `OverviewPage`, `Tournament`, `Team1`, `Team2`, `WinTeam`, `DateTime_UTC`, `Team1Bans`/`Team2Bans`/`Team1Picks`/`Team2Picks` (agrégats), `Patch`, `PatchSort`, `N_GameInMatch`, `GameId`, `MatchId`, `RiotPlatformGameId`, objectifs (`Team1VoidGrubs`, `Team1Atakhans`, …).
- Aussi : `ScoreboardPlayers`, `ScoreboardTeams`, `MatchSchedule`, `MatchScheduleGame` — jointures sur `GameId`/`MatchId` (le wiki joint `MS.MatchId=MSG.MatchId, MSG.GameId=PB.GameId` dans [Module:PickBanScore](https://lol.fandom.com/wiki/Module:PickBanScore)).

**Syntaxe** : `tables`, `fields` (pas de `*`), `where`, `join_on`, `limit` (max **500/query**), `offset`, `order_by`. Test live OK ce jour.

**Rate limits — brutaux en anonyme (constaté : 3 requêtes sur 5 `ratelimited`).** Docs en rouge : *« it is really important **to log in with a Bot Password and have your email address confirmed first** »*. Client recommandé : [`mwrogue`](https://github.com/RheingoldRiver/mwrogue) (ou répliquer son login flow). Les *pages* wiki sont derrière un challenge Cloudflare ; `api.php` non.

**Licence** : `CC BY-SA 3.0` (vérifié live via `siteinfo`). Attribution + share-alike — OK pour un outil local-first qui attribue.

**Caveats stabilité** : ne pas utiliser les row IDs ni `_pageName` comme clés (utiliser `OverviewPage`) ; API « as a courtesy » ; wiki communautairement actif jusqu'à fin 2025 au moins, données 2026 courantes.

**Latence & profondeur** : minutes-heures après les games officielles ; historique jusqu'à ~2011. **Verdict : source structurée primaire — ordre complet + side + patch + game number, gratuit, requêtable, licencié.**

## 1.3 Oracle's Elixir — **meilleur backfill**

- **Ordre pick/ban : depuis février 2024**, les lignes équipe incluent bans 1-5 et picks 1-5 *« in the order they were made »* ([annonce officielle](https://lol.timsevenhuysen.com/2024/02/void-grubs-and-pick-order-in-the-csvs/)) — breaking change pour les parsers par index de colonne.
- **Accès** : un CSV par année via [oracleselixir.com/tools/downloads](https://oracleselixir.com/tools/downloads) (SPA JS ; fichiers sur Google Drive) ; « 2014–2026, updated daily » ; dictionnaire de données publié.
- **Légitimité** : OE est alimenté par les **feeds officiels GRID** ; usage communautaire reconnu par Riot/Bayes dès 2022.
- **Terms** : gratuit, attribution « Oracle's Elixir », attente non-commerciale.
- **Caveats** : lignes par-joueur + lignes équipe ; LPL historiquement partiel ; cadence quotidienne, pas temps réel. Vérifier les colonnes du CSV 2026 au premier import.

## 1.4 GRID (partenaire data exclusif de Riot)

- Tiers d'accès ([grid.gg/get-access](https://grid.gg/get-access/), fetché ce jour) : (1) **Open Access non-commercial — gratuit — Dota 2 + CS uniquement** ; (2) **Équipes pro — gratuit** (ERL1+) — scrims + data tournoi seconde-par-seconde (GraphQL Series State / Central Data) ; (3) Betting & Fantasy — payant ; (4) Custom — payant.
- **Correction de croyance commune : LoL n'est PAS dans GRID Open Access** pour les devs communautaires. Riot développe un « LoL Esports Data Portal (LDP) for non-commercial use cases » — pas GA à ce jour. Des clés temporaires existent via hackathons.
- Note (page possiblement stale) : data live LCK « restricted to media purposes only ».
- **Verdict** : seul tuyau sanctionné pour les scrims et les drafts full-fidelity. Adapter « bring your own key » derrière l'interface DataProvider, gaté sur l'accès portail du client. Re-vérifier trimestriellement le statut du LDP communautaire.

## 1.5 Bayes Esports — **mort (2025)**

Insolvabilité mai 2025 ; actifs rachetés par GRID septembre 2025 ; bayesesports.com sert le site GRID. À retirer de l'architecture.

## 1.6 Riot / lolesports APIs

- **Endpoints persisted non-officiels — vivants ce jour** (`esports-api.lolesports.com/persisted/gw/...` avec la clé publique historique) : schedules/leagues (First Stand id confirmé). *« Not a public API… no intention of making it backwards compatible. »* → métadonnées de calendrier uniquement, jamais l'ingestion cœur.
- **Riot Developer API (officielle)** : les games pro (tournament realm) ne sont **pas** exposées ; pertinence = features soloq uniquement. Clés : dev (24h), personal, production. Pour un outil local-first : chaque coach avec sa personal key.

## 1.7 Agrégateurs / tracking de pros

- **dpm.lol** — pages pro avec comptes soloq liés, champions récents, stats esports (`dpm.lol/pro/<Name>`) ; leaderboard soloq par équipe. Pas d'API publique ; SPA fragile.
- **deeplol.gg** — leaderboards pro/streamer, pools par patch. UI only.
- **trackingthepros.com** — le mapping canonique pro↔soloq + bootcamp tracker. Seed de mapping ; pas d'API/ToS publiés.
- **esports.op.gg** — pages pro. UI only.
- « runeforge » / « lol.theshrimp » — pas des sources de draft (pistes mortes).
- **Faisabilité « pool soloq »** : mapping trackingthepros/dpm.lol → Riot `account-v1`/`match-v5` avec personal key = la route pratique et légale. Attention : comptes bootcamp temporaires ; couverture dépendante des mappings communautaires.

## 1.8 Scrim data

- **Sanctionné** : portail GRID (GraphQL, JSON, automatisé — pipeline publié de MAD Lions : [MADLionsEC/lol-data-solution](https://github.com/MADLionsEC/lol-data-solution)).
- **DIY** : parsing ROFL — [fraxiinus/roflxd](https://github.com/fraxiinus/roflxd) (ROFL pré-14.9 + ROFL2 14.11+), métadonnées faciles (joueurs, champions, résultat) **mais l'ordre de draft n'est PAS dans le header ROFL** ; Vanguard freine l'outillage replay depuis 2024.
- **Réalité de terrain** : beaucoup d'équipes draftent les scrims sur des sites tiers (drafter.lol, draftlol, prodraft) + sheets manuels ; « Some teams actually don't ban in scrims » (analyste G2, 2026).
- **Légalité** : politique Riot third-party — interdit ce qui expose de l'info volontairement obfusquée ; parser **ses propres** ROFLs localement = pratiqué et toléré ; redistribuer la data scrim adverse = no-go.
- **Réponse pratique DraftLab** : saisie manuelle/CSV de drafts de scrims (canal universel) + import ROFL métadonnées (optionnel) + adapter GRID pour les équipes portail.

## 1.9 Static data : Data Dragon vs CommunityDragon

- **Data Dragon** : officiel, versionné (`ddragon.leagueoflegends.com/api/versions.json`) ; MAJ manuelle post-patch (lag heures-jours).
- **CommunityDragon** : `raw.communitydragon.org/latest/` — observé à jour **le matin même du patch 26.11 (2026-06-10)**. CDragon pour les assets same-day, DDragon pour la liste stable versionnée.
- **Cadence patch 2026** : ~bimensuelle le mercredi ; 12 patchs du 8 janv au 10 juin (`V26.01`…`V26.12`) ; splits saisonniers (26.01 « For Demacia », 26.09 « Pandemonium » + ladder reset) ; ~24 patchs/an attendus. L'esport tourne 1-2 patchs derrière le live ; le patch par game vient de Leaguepedia `Patch` / pages de game gol.gg.

---

# PART 2 — Workflow de prep professionnel

## 2.1 Artefacts réellement produits

- **Scouting de tendances adverses** : drafts passées + comptes soloq — champions non joués, off-meta, fréquence de counterpick, priorité de champions, patterns de rôle en première phase ([Esportsheaven, "The Art of the Draft"](https://www.esportsheaven.com/features/the-art-of-the-draft-an-in-depth-look-into-drafting-from-a-coachs-perspective/)).
- **Rapports/présentations custom + résumés de scrims par bloc/jour**, rapports de faiblesses adverses ([TL Head Analyst job post](https://teamliquid.com/news/2019/10/30/were-hiring-league-of-legends-head-analyst)) ; outils : sheets, bases de données, stats, dataviz slides/charts/vidéos.
- **Plans de draft par game sous fearless** : Goldenglue — *« I almost needed to make a draft plan for every game »* ; **tier lists consommées séquentiellement** : Homme — *« you really just go down your tier list »* ([Dot Esports, mars 2026](https://dotesports.com/league-of-legends/news/coaches-from-five-regions-explain-how-fearless-draft-transformed-lol-esports)).
- **Logiciel interne sur mesure** : analyste G2 — *« We have internal systems and software designed specifically for this [Fearless] »* — les top teams construisent déjà des outils de la forme DraftLab en interne.

## 2.2 Métriques standard

- **Presence % = pick rate + ban rate** (ex. Yunara Worlds 2025 : 68,7 % — 54 bans + 14 picks).
- **Structure de rotation** : Ban phase 1 (blue d'abord, ×3 alternés) ; picks **B1 → R1,R2 → B2,B3 → R3** ; ban phase 2 (red d'abord, ×2) ; picks **R4 → B4,B5 → R5**. Edge bleu = first pick ; edge rouge = counter/last pick — **mais First Selection 2026 rend side et pick order indépendants**.
- **Confort/pool** : courbe de mastery ~0-14 games de stage avec *« very fast diminishing returns »* après ([iTero](https://www.itero.gg/articles/draft-pro)) ; profondeur de pool par joueur/rôle = stat cœur de l'ère fearless.
- **Caveat fearless sur toutes les stats champion** : *« It might just mean it was picked in game three or four when the draft is already very different »* (analyste G2) → **conditionner sur `N_GameInMatch`**.

## 2.3 Fearless 2026 — règles et périmètre (vérifié)

- **Variante : hard fearless.** Game 1 = draft classique (5 bans/équipe). Dès la game 2, **tout champion *joué* dans une game précédente de la série est indisponible pour LES DEUX équipes** ; chaque game a des bans frais (les bans ne persistent pas). En game 5 d'un Bo5, jusqu'à 40 champions retirés avant les bans.
- **Où** : standard dans toutes les ligues tier-1 depuis 2025 (LCK, LPL, LEC, LCS/LTA, LCP) ; First Stand, MSI, **Worlds 2025** ; **reconduit pour toute la saison 2026** (First Stand 2026 São Paulo 16-22 mars all-Bo5 ; MSI 2026 Daejeon 28 juin-12 juil ; Worlds 2026 Texas + finale NY). Note ligues : **LTA dissoute ; LCS et CBLOL redeviennent des ligues séparées en 2026** → le registre de ligues doit être config-driven.
- **Effet méta (chiffres)** : MSI 2024 → 2025 : 87-88 → 108-109 champions uniques ; top pick K'Sante ×49 → Aurora ×16 ; Worlds 2025 : 93-100 uniques projetés.
- **Effet prep (« champion budget »)** : kkOma — 3 premières games standard, *« from games four and five… you always end up improvising »* ; Homme — avantage aux pools profonds, tier list descendue top-down ; Chawy (CFO) — double toplaner comme edge fearless ; Goldenglue — les équipes asiatiques *« high-prio the enemy's best picks »* = **denial drafting** ; les comps scrims G4/G5 n'apparaissent souvent jamais sur scène (G2).

## 2.4 First Selection (nouveau 2026)

- L'équipe qui aurait eu le choix de side a désormais **First Selection** : choisir **soit** le side **soit** l'ordre de draft (first/last pick) ; l'adversaire prend l'autre. Obtenu par : **seed supérieur (game 1), défaite de la game précédente, ou coin toss**. Exemple First Stand 2026 : Gen.G (FS) prend first pick ; G2 choisit blue side.
- Déployé league-wide : LCK/LPL 14 janv 2026 → LCS 24 janv, toutes régions + internationaux. Objectif Riot : adresser la variance de side win-rate par « player and team agency ».
- **Implication DraftLab** : nouvelle tendance à scouter — *que choisit cette équipe avec FS (side vs pick order), dans quels états de série ?* — et tous les records 2026+ portent `side` et `pickOrder` comme **champs indépendants** (la convention Team1=blue de Leaguepedia tient ; le first pick se dérive de la séquence, pas du side).

## 2.5 Comment les drafts sont jouées en temps réel

- **Sur scène** : les règlements imposent le coach sur scène pour le pick/ban ; **appareils sans fil interdits** dans la match area (rulebooks LCS/Worlds). Le coach monte avec **sa prep mémorisée + notes papier** — « ten hours of preparation compressed into their brains… 27 seconds per draft decision ».
- **Backstage** : les analystes preppent **entre les games** — fearless fait de la fenêtre inter-games LE moment analyste critique (plans par game).
- **Takeaway produit DraftLab** : le livrable qui survit au contact de la scène est un **plan par game imprimable/mémorisable** (arbres Plan A/B/C, cibles de ban par rotation, feuille de champion-budget) — pas un overlay live. Un mode explicite **« re-plan entre les games » (45-90 s pour re-ranker les pools restants)** refléterait exactement le workflow réel.

---

## Cross-source verification notes & open risks

1. **GRID Open Access ≠ LoL** — vérifié sur trois pages GRID. Risque : le LDP communautaire Riot peut sortir à tout moment ; re-check trimestriel.
2. **Blocage datacenter gol.gg** observé depuis l'egress cloud (deux méthodes) ; scraping résidentiel validé au 2026-05-01 par les tests live du repo. « Works locally, never from cloud ».
3. **Rate limits anonymes Leaguepedia** confirmés empiriquement — **bot password = prérequis dur** pour toute ingestion réelle.
4. **MAJ quotidiennes OE 2026** = confirmation secondaire ; vérifier les colonnes du CSV 2026 au premier import.
5. **Restriction « media only » de la data live LCK** : page possiblement stale, non vérifiée pour 2026.
6. Une source basse qualité (connectioncafe.com) exclue comme probable contenu SEO généré.

**Architecture d'ingestion recommandée** : Leaguepedia Cargo (authentifié, `PicksAndBansS7 ⋈ ScoreboardGames` sur `GameId`) en canonique → OE CSV annuel en backfill/validation croisée → scraper gol.gg en secondaire local-only → DDragon/CDragon statique → adapter GRID optionnel (équipes portail, scrims) → saisie manuelle scrims en fallback universel. Modéliser `side`, `pickOrder`, `gameInSeries`, `patch` comme **quatre dimensions indépendantes** de chaque draft record.
