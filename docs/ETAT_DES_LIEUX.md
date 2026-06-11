# DraftLab — État des lieux (2026-06-11)

> Document d'entrée de la **run d'architecture/recherche #2**. Tout y est posé
> à plat : ce qui est validé, ce qui est construit sans preuve, la data, les
> trous produit, et les cibles proposées. Référence : `ARCHITECTURE_V2.md`
> (V2.1, DA-V2-1..13), `STATUS.md`, `STEP_UP.md`, `docs/calibration/`.

## A. Validé — claims mesurés, gates vertes

| Claim | Mesure | Où |
|---|---|---|
| Ranges de picks (tendances) | pick-in-range@8 **bat la baseline 4/4 ligues** (0,29-0,35 vs 0,25-0,30) | scorecards |
| Bans phase 2 = contre-compo | **3 beats + 1 tie**, jamais perdant (×2,6 à ×7,3) | scorecards, piste 5 |
| Inférence des rôles adverses | **95,0 %** à 3 picks révélés, 93,4 % à 5 (bat l'argmax naïf) | role-inference-2026.md |
| Concordance des sources | 95,2 % critique gol.gg ⇄ Leaguepedia | concordance |
| Side-only ≈ pile-ou-face | confirmé 4 ligues (honnêteté de base) | scorecards |

## B. Construit mais NON validé (expérimental — métrique en attente)

| Moteur / pièce | État | Métrique manquante |
|---|---|---|
| **Coach navigator (recommandations)** | branché, profondeur 2 | **LA grande absente : aucune mesure de la qualité des recommandations** (« si l'équipe avait suivi le coach, gagnait-elle plus ? ») |
| banEV phase 1 (répertoire) | **rouge mesuré** (loses 3/4) | terme de demande contrefactuelle ban-history à construire, puis re-passer |
| Axe scaling / durée (G1) | 3 pistes au hasard ; compo-niveau 52,1 % [49,1;55,1] | réplication gelée sur 8 corpus — **bloquée par le seul LCK 2025** |
| I2 au-delà des rôles (fogValue, revelationCost, baitLedger) | moteurs purs testés | gate G4 (fog × counter-picks subis) jamais écrite |
| I4 seriesSolver (déni Fearless, First Selection) | moteur + UI /series | gate G3 (rejeu Bo5 rétention) jamais écrite |
| I6 patchOracle | construit | aucune validation |
| Poids winConditionGraph | posés à la main | calibration contre la postdiction G1 |
| Priors N₀ / poids des ranges I1 | hérités | recalibration sur corpus (R4) |
| Calibration des probabilités affichées | aucune | Platt par position de séquence (recherche §6, plan prêt) |

## C. Data — possédée, manquante, non exploitée

**Possédée** : 2 661 drafts (2026 : LCK 337, LEC 246, LFL 191, LPL 445 ·
2025 : LEC 308, LFL 317, LPL 817) — vainqueur, durée, rôles, patch à 100 % ;
fixtures gol.gg ; dataset SoloQ (DraftGap) ; 172 champions tagués main.

**Manquante / bloquée** :
- **LCK 2025** (~500 drafts) — throttle serveur Leaguepedia sur la jointure
  PB⋈SG aux heures de pointe ; commande prête dans STATUS, passera en heures
  creuses. Débloque la réplication G1.
- **Attribution par joueur** — script `enrichPlayers.ts` prêt, même throttle.
  Débloque les ranges par joueur (« CE joueur sort X à ce slot »).
- **Scrims** — inaccessibles par nature ; doctrine source-tag + poids réduit
  déjà écrite (recherche §5) si un jour Alain en a.
- **Le contexte d'Alain** — où drafte-t-il réellement ? (voir E)

**Non exploitée** :
- `series`/`gameNumber` présents sur chaque record → la data Fearless réelle
  pour G3 existe, le harnais ne la lit pas encore.
- Tags mécaniques fins (airborne, follow-up, self-escape #5) — enrichissement
  candidat pour les cellules de traits.
- #14 Malphite tagué AD (faux) + 154 tags confidence:medium à réviser.

## D. Produit / UX

**Fait** : mode draft séquentielle exacte (bans + ordre réel + FLEX, le coach
lit la vraie draft) · système visuel arène (abysse/or/arcane, art des
champions, Marcellus/Plex, grain) · lecture des rôles avec alertes ·
axes paire + contre-compo expliqués en français · prep pack/CSV exports.

**Manque** :
1. **Persistance des drafts saisies** (IndexedDB) — une draft tapée en
   séquence disparaît au refresh ; il faut l'historique local + reprise.
2. **Plans à branches (prep → live)** — les Plans A/B/C sont des blueprints
   statiques ; il faut l'arbre pré-calculé contre CET adversaire + détection
   de déviation (« ils sont sortis du script »).
3. **Fearless inline** — les exclusions vivent sur /series ; le mode séquence
   devrait consommer la série active (lockouts visibles sur le board).
4. **/live (war room)** — pas encore l'UI arène ni le mode séquence.
5. **Timer de draft** (30 s/tour) pour le réalisme en customs/Clash.
6. **Onboarding apprenant** — le « Comment lire ? » existe par panneau ; il
   manque un parcours guidé première-draft.

## E. Questions ouvertes pour Alain

1. ~~Où draftes-tu ?~~ **RÉPONDU (2026-06-11) : draft SoloQ + draft format
   pro 2026, en Bo1/Bo3/Bo5, avec et sans Fearless.** → Les DEUX formats
   sont des cibles produit de premier rang (faits le jour même : mode
   séquence pro + SoloQ, sélecteur Bo1/3/5, lockouts Fearless inline).
   Conséquence calibration : le corpus pro reste la vérité d'entraînement ;
   la SoloQ est un contexte d'USAGE (bans simultanés = exclusions, coach
   picksOnly) — pas de données SoloQ-drafts à collecter pour l'instant.
2. ~~Bo1 ou séries Fearless ?~~ **RÉPONDU : les deux** → G3 (rejeu Bo5) et
   la valeur série long-terme (JueWuDraft hard-fearless) montent d'un cran
   dans les priorités de la run #2.
3. **Session d'annotation ~2 h** (~100 drafts game-plan) → vérité terrain du
   classifieur M4.2 et des plans. (toujours ouverte)

## F. Cibles proposées pour la run #2 (priorisées)

1. **La gate produit : mesurer le COACH.** Postdiction « conseil suivi » :
   sur le corpus, aux tours où le coach aurait parlé, son top-1 recoupe-t-il
   les picks des équipes GAGNANTES plus que des perdantes ? + valeur de draft
   marginale (delta win% du pick réel vs pick conseillé, évaluateur fixé).
   C'est LE claim qui manque à l'outil entier.
2. **Terme ban-history dans I1/banEV phase 1** — rouge bien posé, data prête.
3. **Réplication G1** (dès LCK 2025) → si verte, brancher compDurationAffinity
   dans l'axe I3 ; si rouge, retirer la piste et documenter.
4. **Plans à branches + déviation** (D.2) — le pont prep→live des vrais staffs.
5. **Per-player ranges** (dès enrichissement) + piste harnais dédiée.
6. **G3 Fearless** (rejeu Bo5 sur `series`/`gameNumber`) + valeur long-terme
   façon JueWuDraft (hard-fearless inédit — premier public).
6 bis. **Pocket picks — maîtrise et au-delà** (directive d'Alain 2026-06-11,
   design complet : `docs/run2/F-pocket-picks.md`) : réservoir de surprises
   (modèle public retourné sur soi), conseiller GARDER/DÉPENSER branché sur
   la valeur de série + le coût de révélation I2, défense anti-pocket
   (dégrader les priors de rôle sur pick surprise — le trou Nasus), et
   l'AU-DELÀ : le **solveur de fin de série Fearless** (recherche exhaustive
   quand G4/G5 rétrécit l'espace — jamais publié). Gates F1/F2 mesurables
   immédiatement. S'exécute après C (son substrat).
7. **Calibration** : Platt par position + poids WC vs G1 + N₀ (R4 complet).
8. **G4 fog** : valeur d'ambiguïté × counter-picks subis (I2 complet).
9. Recherche ciblée si G1 réplique mal : où vit le signal de durée ?
   (interactions plus riches que les paires de traits ; durée comme cible
   de régression plutôt que classification long/court).

— Généré le 2026-06-11, session « carte blanche » nuit 2. Tout commit à jour
sur `main`, CI verte.
