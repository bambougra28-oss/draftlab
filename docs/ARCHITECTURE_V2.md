# DraftLab — Architecture V2.1 « Sommet » : le niveau professionnel, puis l'inédit

> Statut : **proposé** — V2 rédigée le 2026-06-10 par l'architecte (session Claude) ;
> **révision V2.1 « Sommet » le même jour** sur directive d'Alain (« on vise l'inédit »),
> ajoutant la couche des moteurs inédits (§6 bis) et élevant la roadmap (R0…R9).
> Base : (a) étude complète du code et des specs survivantes, (b) quatre rapports de
> recherche web frais (concurrence, données, méthodologie, formalismes/prior-art —
> voir `docs/research/`), (c) verdicts empiriques M3.3-M3.5. Succède à
> `ARCHITECTURE_V1.md` (perdu dans la réinstallation Windows ; son scope M5→V1.0 est
> aujourd'hui reconstruit et vert).
>
> Convention : les décisions sont numérotées **DA-V2-n** et les jalons **R0…R9**.
> Tout changement de comportement passe par `docs/STEP_UP.md` (sign-off Alain).

---

## 0. TL;DR

DraftLab a survécu à la perte de son code : toute la logique M1-M7 est reconstruite et
verte (210 tests). Le chemin vers le sommet a deux étages.

**Étage 1 — le niveau pro (R1-R3)** : une colonne vertébrale de données multi-sources
avec l'ordre de draft, des snapshots datés et de la provenance ; l'UI reconstruite en
deux modes Prep/Match ; un harnais de validation permanent qui calibre chaque
heuristique au lieu de la deviner.

**Étage 2 — l'inédit (R4-R9)**, six moteurs qu'aucun outil au monde ne livre (§6 bis) :
le **modèle de ranges adverses** (lire l'adversaire comme un solver de poker lit une
main — y compris l'information négative de ce qu'il n'a PAS pris) ; le **jeu
d'information** (l'ambiguïté des flex quantifiée comme une ressource — fog value,
coût de révélation, registre de baits) ; le **graphe de win conditions bilatéral**
(des conditions de victoire relationnelles et falsifiables, pas des étiquettes) ; le
**solveur de série Fearless** (budget de champions, inventaire de combinaisons, prix
du déni, stratégie de must-win — la guerre de ressources que les coachs disent mener
« de tête ») ; le **sparring + la revue annotée** (le moteur d'échecs du draft :
« ?! −1,8 %, meilleure était Rell ») ; le **Patch Oracle** (courbes de réponse aux
buffs estimées sur 12 ans d'historique). Le tout local-first, incertitude affichée,
et un **Summit Gate** : des scorecards publics rejouant les drafts tier-1 réelles —
on ne se déclare jamais « au sommet » à l'intuition, on le mesure.

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
| S7 | **Summit Gate** : la prétention au sommet est mesurée, publiquement | Scorecard par patch (R9) rejouant les drafts tier-1 réelles : ban-hit@5, pick-in-range@8, postdiction des win conditions, corrélation de rétention — chaque métrique bat sa baseline naïve avec IC bootstrap |

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

## 6 bis. Les moteurs inédits — la couche sommet (V2.1)

> Directive d'Alain (2026-06-10) : « on vise l'inédit ». Six moteurs, chacun avec sa
> formalisation, ses données requises, sa surface UI et **sa métrique de validation**
> (un moteur sans métrique ne ship pas — DA-V2-11).
> Principe transversal hérité du marché : **des composantes affichées séparément,
> jamais un méga-score opaque** — le coach décide, l'outil instrumente.

**Statut d'inédit — vérifié par prior-art check** (~30 recherches, détail et sources
dans `docs/research/2026-06_formalismes_prior_art.md`) :

| Moteur | Verdict | La tranche revendicable |
|---|---|---|
| I1 Ranges adverses | **PARTIEL** | la prédiction de picks existe (AIIDE 2016, DraftRec) ; **première présentation en ranges façon poker + premier updating par information négative** (restricted choice) |
| I2 Jeu d'information | **NOVEL (B2)** / PARTIEL (B1) | la valuation équité+dissimulation−révélation n'existe nulle part ; la fog value = **première quantification** d'un concept que tout le monde n'évoque que qualitativement |
| I3 Win conditions bilatéral | **NOVEL** | tout l'existant est unilatéral (archétypes) ; la dérivation relationnelle + postdiction n'existent pas |
| I4 Series Solver hard-fearless | **NOVEL** | JueWuDraft = lockout par équipe seulement, **sans bans ni déni** (cité texto) ; aucun solveur hard-fearless publié à mi-2026 |
| I5 Revue annotée | PARTIEL | concept publié par iTero (jamais shippé, pas d'annotation par décision) ; le pattern est commodity aux échecs/poker — **premier ship MOBA** |
| I6 Patch Oracle | PARTIEL | iTero a shippé des tier-forecasts ; **les courbes de réponse aux buffs utilisées prospectivement sont introuvables** |

Règle de communication : I2/I3/I4 se revendiquent comme *systèmes* inédits (pas comme
idées) ; I1/I5/I6 se revendiquent par leur tranche précise, en créditant l'existant.

### I1 — Modèle de ranges adverses (« Range Drafting »)

**L'idée.** Les solvers de poker ont remplacé « quelle main a-t-il ? » par « quelle
est sa *range* ? ». Transfert : à chaque slot de draft adverse non résolu, maintenir
une distribution de probabilité sur (champion, rôle), mise à jour bayésienne après
chaque action — y compris l'**information négative** : un champion laissé ouvert
pendant deux rotations par une équipe qui le first-picke d'habitude, c'est un signal
(pas dans le pool ce soir, ou un piège).

**Formalisation.** Pour un slot adverse au state `s` :
```
P(c, r | s) ∝ exp[ w_t·log T(c | slot, side, phase, gameN)   // tendances (R4, Dirichlet)
                 + w_p·log Pool(c | joueur_r)                 // tiers + profondeur
                 + w_m·log Meta(c | patch)                    // presence patch
                 + w_s·Syn(c | leur comp partielle)           // cohérence de plan
                 + w_n·Neg(c | s) ]                           // décote hazard si « passé sur c »
```
Poids `w` calibrés par le harnais (log loss du prochain pick réel). `Neg` est la
nouveauté : une décote multiplicative apprise sur corpus (« quand une équipe passe
sur son champion de priorité P au slot t, la probabilité qu'elle le prenne plus tard
chute de x % »). Formalisme importé : **capped ranges** (poker — une ligne qui
contourne une action disponible exclut logiquement les holdings forts) et **principe
de restricted choice** (bridge — l'absence d'une alternative attractive déplace le
posterior, facteur d'update en odds-form Bayes) ; précédent algorithmique :
Richards & Amir (IJCAI 2007) infèrent le rack adverse au Scrabble en conditionnant
sur les coups *non joués*. Convention UX importée des solvers : **le blanc pour les
choix proches, la couleur pour les préférences nettes** — jamais de fausse précision.

**Sortie UI.** Ranges top-k par slot avec les comptes d'évidence (« Rell : 31 % —
first-pickée 4/6 séries côté rouge ») ; **alarme de surprise** en live quand le pick
réel sort de la range (signal de re-lecture).

**Validation.** `pick-in-range@k` et log loss du prochain pick vs baseline fréquence
brute, walk-forward. **Dépend de** : R1 (ordre), R4 (tendances).

### I2 — Le jeu d'information (« Fog & Reveal »)

**L'idée.** L'étage le plus profond du draft pro : les flex picks cachent
l'assignation des rôles, le séquencement cache les intentions, certains bans/non-bans
sont des appâts. Personne ne *quantifie* ça. Nous : l'ambiguïté devient une ressource
mesurable.

**Formalisation.** Soit `H(A)` l'ensemble des hypothèses d'assignation rôle→champion
de MA comp partielle, vu par l'adversaire (priors de rôle par champion × pools de mes
joueurs), avec `P(h)`. La **fog value** d'un candidat `x` :
```
Φ(x) = E[ équité de leur meilleure réponse | assignation connue ]
     − E_h~P(·|A+x)[ équité de leur meilleure réponse | incertitude h ]
```
les « meilleures réponses » étant les top-k de leur range (I1) évaluées par
l'évaluateur (§6.2). S'y ajoutent le **coût de révélation** (perte d'entropie de
`H` + équité des counter-picks que `x` débloque pour eux) et le **registre de baits** :
`EV(laisser c ouvert) = P(ils le prennent)·[équité de notre réponse préparée − équité de leur c] + P(non)·valeur d'option conservée`.

**Cadre théorique & implémentation.** Le cadre formel est le trade-off de révélation
d'**Aumann–Maschler** (jeux répétés à information incomplète : la valeur est la
concavification Cav(u) sur les croyances — l'optimal révèle parfois délibérément) :
c'est aussi LE cadre de « quand brûler sa prep de poche dans un Bo5 » (lien I4).
Implémentation : **déterminisation sur les assignations de rôles** (échantillonner
des role-maps depuis les priors plutôt que résoudre un jeu à information imparfaite
— verdict du rapport : CFR est overkill, le draft a ses 20 actions publiques) ; le
cas du last-pick à assignation simultanée se résout en **petit jeu matriciel (LP)**.
Profondeur de contre-raisonnement plafonnée à k≈1-2 (cognitive hierarchy : les
adversaires réels raisonnent ~1,5 niveaux — inutile de creuser plus).

**Sortie UI.** Quatre composantes séparées par candidat — équité | brouillard |
déni | révélation — plus « ambiguïté restante : 2,3 bits ; leurs counters perdent
~1,1 % d'équité tant que top/mid restent permutables ». Badge **expérimental**
jusqu'à validation.

**Validation.** Corrélation rétrospective fog × counter-picks effectivement subis ;
revue qualitative sur des drafts tier-1 célèbres pour lecture de plausibilité
(ex. les drafts à double flex de G2). **Dépend de** : I1 mûr.

### I3 — Graphe de win conditions bilatéral

**L'idée.** Au sommet, l'identité d'une comp est *relative* : « on gagne le
front-to-back si on survit à leur dive ; eux gagnent s'ils snowballent notre weak
side ». Remplacer l'étiquette 5-archétypes (qui reste la vue pédagogique) par un
calcul de **collision de plans**.

**Formalisation.** ~8 axes de conflit mesurables depuis tags + data :
engage↔disengage, dive↔peel, poke↔sustain/engage, split↔cross-map, différentiel de
scaling par fenêtre, vecteurs de snowball par lane (exposition weak-side), profil
d'objectifs, menace de pick↔sécurité groupée. Chaque axe : `score_k(A,B) ∈ ℝ` avec
intervalle (posteriors §6.1). `plan(A)` = axes dominants ; la **collision**
(plan A × plan B) sélectionne un narratif + des triggers + les risk markers
pertinents (les 12 existants sont mappés sur les cellules de collision).

**Sortie UI.** « Votre condition primaire : forcer le 5v5 avant 25 min (edge engage
+2,3 ±0,9 ; scaling −1,8). La leur : side pressure par la top (split +2,1). Collision :
course au tempo — fenêtres de fight pendant leurs side-pushes. » Statements datés,
falsifiables.

**Validation (postdiction).** Les statements sont testables sur données réelles
(durée de game, objectifs — colonnes OE/Leaguepedia déjà prévues en R1) : les games
« fenêtre early prédite » gagnées le sont-elles effectivement plus court ? Brier sur
les statements. **Dépend de** : tags (présents), R1 ; s'améliore avec R4.

### I4 — Solveur de série Fearless (« Series Solver »)

**L'idée.** Le hard Fearless est une guerre de ressources sur 5 games que les coachs
mènent « de tête » (kkOma : improvisation dès la G4 ; Goldenglue : denial drafting).
Formaliser la totalité : budget, combinaisons, déni, must-win.

**Formalisation.** État de série `σ = (game#, score, détenteur FS, pools restants par
joueur, consommés)`. Valeur `V(σ)` par récursion : le draft de la game courante est
résolu par le navigator (expectimax §6.6, ranges I1) → probabilité `p` ;
`V = p·V(σ⁺) + (1−p)·V(σ⁻)`. Trois objets neufs :
- **Inventaire de combinaisons** : les assets d'une équipe ne sont pas des champions
  mais des *combinaisons prouvées* (duo bot, paire mid-jungle, package top-side)
  minées de l'historique (+ scrims saisis). Consommer un champion endommage chaque
  asset qui le contient → **dommage structurel** d'un pick, des deux côtés.
- **Intégrité de pool** : % de comps complètes cohérentes restantes (Monte-Carlo sur
  pools × seuil de synergie), par équipe, projetée par game — la jauge de « qui
  s'essouffle en G5 ».
- **Prix du déni** (hard fearless) : `valeur(c) += Σ_{games futures} P(ils voudraient c)
  × (équité de c − équité de leur remplacement)` — P depuis I1, remplacement depuis
  la courbe de profondeur du pool du joueur.
Plus la **stratégie de must-win** (mené 1-2 : dépenser ou garder ? — arbitrage
quantifié) et **First Selection par game** (le perdant obtient FS → choix side/pick
intégré à l'arbre).

Formalismes importés : le critère du déni vient de **Benoît & Krishna** (enchères
séquentielles à budget contraint, REStud 2001) — épuiser stratégiquement la capacité
future du rival est profitable **exactement quand le coût de remplacement de l'actif
est plus élevé pour lui** (notre formule du prix du déni en est l'instanciation) ;
les mixes de bans/picks d'ouverture peuvent s'appuyer sur des **équilibres de Nash
de matrices de matchup** (théorie du counter-pick des jeux de combat — petits LPs),
avec l'avertissement documenté : le Nash brut sur-élague sans termes de skill
par joueur → toujours pondéré par le confort (ce que DraftLab encode déjà).
Précision du créneau : JueWuDraft (l'unique précédent multi-game) verrouille les
héros *par équipe seulement* et déclare texto ne pas modéliser les bans — le
hard-fearless à déni croisé est vierge.

**Sortie UI.** War room de série : jauges d'intégrité des deux pools par game
projetée, arbitrages dépense/rétention chiffrés (« jouer Azir G2 : +1,9 % cette game,
−1,1 % d'option G4-G5, déni +0,8 % → net +1,6 % »), what-if interactif.

**Validation.** Rejeu des Bo5 fearless 2025-2026 réels : corrélation entre nos
valeurs de rétention et les champions effectivement gardés pour G4/G5 par les
équipes gagnantes ; la jauge d'intégrité prédit-elle quelle équipe « craque » en
fin de série ? **Dépend de** : I1, évaluateur, R1.

### I5 — Sparring & revue annotée (« le moteur d'échecs du draft »)

**L'idée.** Ce que Stockfish a fait à la préparation d'échecs : l'adversaire
simulé + l'analyse annotée a posteriori. iTero en a publié le concept (blog) ;
personne ne l'a shippé.

**Formalisation.** (a) **Sparring** : bot adverse = échantillonneur du range model
(température réglable : strictement fidèle aux tendances ↔ adaptatif). Le coach
drafte N fois contre l'adversaire modélisé ; rapport de fuites agrégé (« vous
perdez systématiquement la fenêtre counter bot quand ils flexent en R2 »).
(b) **Revue annotée** d'une draft réelle : par décision, perte d'équité vs la
meilleure ligne du navigator + commentaire informationnel (révélation prématurée,
ban gaspillé sur un champion consommé...). Conventions importées des références du
genre (Lichess, GTO Wizard Hand History Analyzer) : **noter en espace de probabilité
de victoire, pas en éval brute** ; seuils larges type ?!/?/?? (≈ −1/−2/−3 pp, à
calibrer) ; **suppression des remarques quand plusieurs choix sont quasi égaux**
(notre évaluateur est un oracle bruité, pas un Stockfish — les bandes de confiance
sont la condition d'honnêteté) ; « meilleure était Rell : votre range l'annonçait à
31 % » seulement quand l'écart franchit le seuil de confiance ; agrégation en
rapports de fuites triés par coût.

**Sortie UI.** Mode sparring chronométré 27 s/décision ; rapport de revue
imprimable ; report card de tendances par équipe (auto-scouting : tournez-le sur
vous-même pour découvrir VOS fuites avant l'adversaire).

**Validation.** Taux d'accord du navigator avec les choix des équipes gagnantes,
stratifié par force d'équipe (les meilleures équipes devraient « blunder » moins
selon notre échelle — sinon c'est notre échelle qui blunder) ; test utilisateur.

### I6 — Patch Oracle (anticipation de méta)

**L'idée.** Un outil purement statistique est structurellement en retard d'un patch.
Les équipes draftent sur des *lectures*. Assister la lecture, quantitativement.

**Formalisation.** Diff des patch notes (CDragon) → champions touchés + magnitude
classifiée → (a) inflation d'incertitude des priors concernés (state-space) ;
(b) nudge directionnel par **courbes de réponse aux buffs estimées sur l'historique
OE 2014-2026** (« après un buff de classe X sur un champion de tag Y, la presence
pro monte en moyenne de Z pp sous 2 patchs ») — estimables dès le backfill R1 ;
(c) croisement soloq des pros (comptes mappés, clé Riot perso) → watchlist pocket
picks (élévation du M5.4 existant avec de vraies données).

**Sortie UI.** Briefing de patch : « à surveiller », avec raisonnement et historique
de courbes. Cadré honnêtement : *briefing assisté*, pas prédiction. Précédent à
créditer : iTero a shippé des tier-forecasts par patch (2022, validés) — notre
tranche inédite est l'estimation et l'usage prospectif des **courbes de réponse**
historiques, pas l'idée de prévoir le patch.

**Validation.** Backtest des courbes de réponse (walk-forward sur les patchs passés) ;
hit rate de la watchlist (champions flaggés qui apparaissent effectivement sur scène
sous 2 patchs vs base rate).

### Décisions ajoutées

| # | Décision | Justification |
|---|---|---|
| DA-V2-11 | **Un moteur sans métrique de validation ne ship pas** ; tout moteur expérimental porte un badge UI jusqu'à sa porte de validation | anti-« plausible mais faux » ; crédibilité sommet |
| DA-V2-12 | Les valuations multi-composantes (équité/brouillard/déni/révélation) sont **affichées séparément**, jamais collapsées en un score unique | les poids relatifs ne sont pas calibrables proprement à notre échelle ; le coach arbitre |
| DA-V2-13 | Le 5-archétypes devient une *vue* pédagogique au-dessus du graphe de win conditions (I3), pas le modèle de vérité | profondeur relationnelle requise au sommet |

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
│ PLANNERS & MOTEURS SOMMET (§6 bis)                                   │
│   seriesSolver I4 (budget/combinaisons/déni/must-win) ·              │
│   draftNavigator (expectimax + ranges) · fogReveal I2 (info game) ·  │
│   banEV (best-response) · sparring/annotator I5 · patchOracle I6 ·   │
│   plan triggers / arbre de répertoire                                │
├──────────────────────────────────────────────────────────────────────┤
│ STRATEGIC (existant, à recalibrer en R3)                             │
│   winConditionGraph I3 (⊃ gamePlanClassifier en vue simplifiée) ·    │
│   adversaryPlanDetector · riskMarkers · poolTier · pocketPick ·      │
│   pickSuggester · banPriority                                        │
├──────────────────────────────────────────────────────────────────────┤
│ ESTIMATORS (nouveau, central)                                        │
│   EB shrinkage + cascade hiérarchique · tagPairPriors ·              │
│   tendencyTables (Dirichlet) · rangeModel I1 (+ info négative) ·     │
│   calibration (Platt) · provenance                                   │
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

## 8. Roadmap R0 → R9 — l'ascension

Deux étages : **R0-R3 construisent le niveau pro** (données, UI, harnais — rien
d'inédit ne tient sans eux), **R4-R9 construisent l'inédit** (un moteur §6 bis par
jalon, chacun gardé par sa métrique). Chaque jalon = livrable testable + critères
d'acceptation + commit/tag. Estimations en sessions de travail (≈ une demi-journée).

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

### R3 — Harnais de validation + recalibrage + Win-Condition Graph v1 (4-5 sessions)
- `scripts/backtest/` : rejeu walk-forward par patch sur snapshots ; métriques par module ; rapports versionnés `docs/calibration/`.
- Corpus M3 reconstruit + étendu avec l'ordre (Leaguepedia) ; corpus de drafts annotées game-plan (~100, annotation assistée — action Alain ~2h) pour scorer M4.2/M5.1.
- Recalibrage : seuils pool tier (STEP_UP #9), vote table M4.2, poids ban/pick suggesters → configs data-driven (DA-V2-6) ; priors N₀ pro (10-50) ; Platt par phase.
- **I3 — Win-Condition Graph v1** : les 8 axes de conflit + collision de plans, mappés sur les 12 risk markers ; le 5-archétypes devient une vue (DA-V2-13). Postdiction durée/objectifs branchée sur le harnais dès le premier jour.
- **Acceptation (porte G1)** : chaque module stratégique a un score versionné vs baseline ; les configs calibrées remplacent les valeurs devinées avec delta documenté ; ≥ 60 % des statements de win condition postdictés mieux que le hasard (Brier, bootstrap).

### R4 — Tendances, rotations & Range Model v1 (4-5 sessions)
- Agrégats par équipe/joueur : presence, priorité par rotation, flex map, blind/counter, par side, par ordre de pick et patch-window. Extraction de l'**inventaire de combinaisons** (paires/triples prouvés — préparation I4).
- `tendencyTables` Dirichlet (§6.5) ; intégration ban priority v2 (ban EV best-response) et adversary detector v2 (priors par séquence).
- **I1 — Range Model v1** : le log-linéaire complet (tendances × pool × meta × cohérence × **information négative**), calibré au harnais ; alarme de surprise.
- UI : panneau « tendances adverses » avec comptes et exemples cliquables (gameIds) ; ranges par slot.
- **Acceptation (porte G2)** : top-5 bans suggérés retrouvent significativement plus de bans réels que la baseline fréquence brute (bootstrap) ; `pick-in-range@8` et log loss du prochain pick publiés, meilleurs que la baseline ; fiche tendances exportable.

### R5 — Series Solver Fearless (5-6 sessions)
- **I4 complet** : récursion de valeur de série `V(σ)` avec First Selection par game, **prix du déni** hard-fearless, **dommage structurel** sur l'inventaire de combinaisons, **jauge d'intégrité de pool** (Monte-Carlo), **stratégie de must-win** (arbitrage dépense/rétention selon le score).
- `draftNavigator` expectimax (§6.6) branché sur les ranges I1, mode série (feuilles = équité game + γ·valeur de série).
- UI War Room : jauges d'intégrité projetées par game, arbitrages chiffrés, what-if interactif (« si on dépense Azir G2… »).
- **Acceptation (porte G3-demande)** *(amendée 2026-06-11, run #2 — l'opérationnalisation pré-enregistrée vit dans `docs/run2/C-fearless-g3.md`)* : sur les séries réelles reconstituées par matchId (rejeu walk-forward), le modèle de demande par rôle bat la baseline présence-équipe au hit@5 des picks de la game suivante — IC bootstrap 95 % apparié, clusterisé par série, excluant 0 en sa faveur. **S3 (rétention)** opérationnalise l'ancien critère « champions gardés G4/G5 » : AUC de l'ordre de rétention du seriesSolver, enjeu = badge Expérimental du panneau (pas la porte). La **jauge d'intégrité** (« l'équipe qui craque ») est explicitement REPORTÉE vers une porte future G3b, à pré-enregistrer avant toute mesure. L'exigence d'ingénierie < 200 ms par évaluation de nœud demeure.

### R6 — Le jeu d'information (4-5 sessions)
- **I2 complet** : hypothèses d'assignation `H(A)`, **fog value**, coût de révélation, **registre de baits** (EV de laisser un champion ouvert), affichage en composantes séparées (DA-V2-12), badge expérimental (DA-V2-11).
- Navigator final : équité + brouillard + déni + révélation par candidat, en série.
- **Arbre de répertoire conditionnel** (l'évolution sommet de M6.3 Plan A/B/C) : lignes préparées par état (side/FS/leurs ouvertures), compilables pour impression — l'analogue du répertoire d'ouvertures aux échecs (template : le ChessBase Opening Report — arbre adverse par side/slot scoré résultat/récence, branches minces = cibles de prep, tracking de nouveautés vs le corpus de référence).
- **Acceptation (porte G4)** : étude rétrospective fog × counter-picks subis sur corpus (corrélation dans le bon sens, IC bootstrap) ; lecture de plausibilité sur 10 drafts tier-1 célèbres à double flex documentée ; le répertoire imprimé d'un vrai match tient sur 2 pages A4.

### R7 — Livrables, Mode Match & le moteur d'échecs du draft (4-5 sessions)
- Export prep pack : markdown/PDF **optimisé impression** (plans/répertoire, pages bans par rotation, grilles de pool, feuille de champion-budget, tendances, ranges) — les coachs n'ont pas droit aux appareils sur scène. Export Sheets (CSV structuré d'abord).
- **Mode « re-plan entre les games »** (LE moment analyste critique en Fearless) : en 45-90 s, re-ranker les pools restants, recalculer plans/bans/ranges pour la game suivante.
- Mode Match 27 s : raccourcis clavier, triggers de plan, notes par pick (M8.2).
- **I5 — Sparring + revue annotée** : bot adverse (sampler de ranges, température), revue façon moteur d'échecs (« R3 Azir ?! −1,8 % — meilleure était Rell »), rapport de fuites par équipe (à tourner sur soi-même d'abord).
- i18n EN.
- **Acceptation (porte G5)** : prep pack + revue annotée d'un vrai Bo5 récent montrables à un staff ; re-plan < 90 s ; saisie d'un pick < 3 s ; taux d'accord navigator/équipes gagnantes stratifié publié.

### R8 — Patch Oracle & opérations (2-3 sessions, puis continu)
- **I6** : diff de patch → inflation d'incertitude + nudge par **courbes de réponse aux buffs** (estimées sur le backfill OE 2014-2026) ; watchlist pocket picks croisée soloq pros (clé Riot perso).
- Durcissement : contract-tests scraping planifiés (CI hebdo), playbook patch-day (re-tag, refresh, MAJ configs), monitoring des sources, revue des 154 tags confidence:medium (action Alain, étalée).
- **Acceptation (porte G6)** : courbes de réponse backtestées (walk-forward sur patchs passés) ; hit rate de watchlist > base rate.

### R9 — Summit Gate (continu, démarre dès G2)
- **Scorecard public versionné par patch** (`docs/calibration/scorecard-<patch>.md`) : ban-hit@5, pick-in-range@8, postdiction win conditions, corrélation de rétention, accord navigator stratifié — chaque fois vs baselines naïves avec IC bootstrap.
- Cibles chiffrées fixées **après la première mesure** (pas de chiffres inventés avant d'avoir les baselines) ; ensuite chaque patch doit tenir ou expliquer.
- C'est la définition opérationnelle du sommet : **le jour où le scorecard rejoue les drafts tier-1 mieux que toute baseline publique, on y est — et on peut le prouver.**

**Dépendances** : R1 → R3 → R4 → {R5, R6} ; R2 parallélisable après R1 ; R7 après R2+R4 (I5 après R6) ; R8 après R1 ; R9 dès G2 ; R0 immédiat.
**Total estimé : ~30-38 sessions.** C'est le prix du sommet — le rythme historique du projet (V1 ≈ 18-20 sprints autonomes tenus) le rend crédible ; chaque porte G1-G6 est un point d'arrêt légitime avec un produit cohérent.

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
7. **Risques propres à la couche inédit (§6 bis)** : (a) *complexity creep* — un
   moteur élégant qui ne change pas une décision de coach est un coût, pas une
   feature ; garde-fou : DA-V2-11 (pas de ship sans métrique) + chaque moteur doit
   apparaître dans le prep pack imprimé, sinon il n'existe pas ; (b) les poids
   inter-composantes (équité/brouillard/déni) ne sont pas calibrables à notre échelle
   — assumé par DA-V2-12 (affichage séparé, le coach arbitre) ; (c) le fog/bait
   modélise un adversaire *rationnel et informé* — contre une équipe erratique, la
   valeur d'information chute ; afficher la confiance du range model comme préalable ;
   (d) sur-ajustement aux tendances : une équipe qui sait qu'on la modélise peut
   jouer contre le modèle (niveau méta) — c'est un problème de riche, mais le badge
   « tendance cassée » (alarme de surprise I1) en est la première défense.

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
- `docs/research/2026-06_formalismes_prior_art.md` — formalismes des jeux à information cachée (poker solvers, IS-MCTS, signaling, prep d'échecs, sideboarding) + **vérification du caractère inédit** des moteurs I1-I6.
- `draftlab-frameworks-research.md` (racine, non versionné) — dossier fondateur : frameworks coachs LCK/LPL/EU, les 8 modules, le positionnement d'origine.
