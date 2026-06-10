# Science de la draft — corpus 2026 (LCK + LEC + LFL)

> Généré : 2026-06-10T20:30:00Z · 774 drafts (774 avec vainqueur) ·
> exploratoire/in-sample : des HYPOTHÈSES graduées avec IC, pas des claims prédictifs.

## A. Structure mesurée

| Ligue | Games | Winrate côté bleu | Wilson 95 % |
|---|---|---|---|
| LCK | 337 | 48.7 % | [43.4 ; 54.0] % |
| LEC | 246 | 53.7 % | [47.4 ; 59.8] % |
| LFL | 191 | 50.3 % | [43.2 ; 57.3] % |
| **Total** | 774 | 50.6 % | [47.1 ; 54.2] % |

## B. La prime au counterpick, mesurée

Unité : un duel de rôle (même rôle, deux camps) ; « counter » = le camp qui a pické
ce rôle PLUS TARD dans la séquence (template blue-first — ⚠ approximation ère First
Selection, l'entrelacement exact n'est pas dans la source).

| Rôle | n duels | Winrate du camp qui counter | Wilson 95 % |
|---|---|---|---|
| Top | 774 | 51.9 % | [48.4 ; 55.4] % |
| Jungle | 774 | 51.9 % | [48.4 ; 55.4] % |
| Mid | 774 | 48.1 % | [44.6 ; 51.6] % |
| Bot | 774 | 50.9 % | [47.4 ; 54.4] % |
| Support | 774 | 52.1 % | [48.5 ; 55.6] % |
| **Tous rôles** | 3870 | 51.0 % | [49.4 ; 52.6] % |

## C. Premier pick d'équipe : flex vs mono-rôle

Flex = champion joué dans ≥ 2 rôles sur scène 2026 (flexMap du corpus).

- Premier pick FLEX : 67 équipes-games, winrate 50.7 % [39.1 ; 62.3] %
- Premier pick MONO : 1481 équipes-games, winrate 50.0 % [47.4 ; 52.5] %
- Δ (flex − mono) : 0.8 pp, IC bootstrap par game [-10.8 ; 12.6] pp

## D. Les doubles slots (2-3 et 4-5) servent-ils à packager des duos ?

Duo « nommé » = botlane (Bot+Sup), mid-jungle ou top-jungle. Unité : équipe-game (picks dans l'ordre RÉEL de l'équipe).

| Paire de picks | n | Part en duo nommé | Wilson 95 % |
|---|---|---|---|
| #2-#3 (double slot) | 1548 | 45.9 % | [43.4 ; 48.4] % |
| #4-#5 (double slot) | 1548 | 42.7 % | [40.3 ; 45.2] % |
| #3-#4 (cheval sur 2 phases — baseline) | 1548 | 21.4 % | [19.5 ; 23.6] % |

## E. Les bans de phase 2 visent-ils CET adversaire ?

Mesure : part des bans qui tombent dans le top-10 des champions LES PLUS JOUÉS par
l'adversaire du soir (répertoire corpus). Phase 1 = bans #1-#3, phase 2 = #4-#5.

- Phase 1 : 25.9 % dans le répertoire adverse [24.7 ; 27.2] % (n=4644)
- Phase 2 : 16.5 % dans le répertoire adverse [15.2 ; 17.9] % (n=3094)

## F. Les 12 risk markers face aux résultats réels

Unité : équipe-game (comp complète rôle-ordonnée). Δ = winrate flaggé − non flaggé,
IC bootstrap par game. In-sample : un Δ nul signifie « pas de pénalité mesurable en
2026 », pas « marker inutile » (il peut prévenir un risque que les pros évitent déjà).

| Marker | Équipes flaggées | WR flaggé | WR non flaggé | Δ (pp) | IC 95 % (pp) |
|---|---|---|---|---|---|
| no-frontline | 10 | 70.0 % | 49.9 % | 20.1 | [-10.1 ; 50.2] |
| damage-100-ad | 0 | — | — | — | échantillon < 10 |
| damage-100-ap | 0 | — | — | — | échantillon < 10 |
| no-engage-tool | 0 | — | — | — | échantillon < 10 |
| no-disengage-vs-engage | 20 | 35.0 % | 50.2 % | -15.2 | [-35.5 ; 7.2] |
| homogeneous-scaling | 11 | 36.4 % | 50.1 % | -13.7 | [-42.0 ; 16.8] |
| low-mobility-vs-pick | 130 | 59.2 % | 49.2 % | 10.1 | [1.6 ; 18.5] |
| split-without-waveclear | 29 | 48.3 % | 50.0 % | -1.8 | [-20.7 ; 17.0] |

## G. Diagnostic G1 : le scaling des tags façonne-t-il la durée des games ?

- n = 774 games (durée + comps rôle-complètes).
- Corrélation (nb total de champions tag-late des DEUX comps) ↔ durée : r = 0.006.
- Games COURTES (tiers bas) : le camp le plus « late » gagne 101/178 des games déséquilibrées (56.7 % [49.4 ; 63.8] %).
- Games LONGUES (tiers haut) : le camp le plus « late » gagne 96/182 (52.7 % [45.5 ; 59.9] %).

## H. Cellules de synergie par traits — premier fit pro (§6.3 construit)

15480 observations de paires (10 par game et par camp), baseline 50.0 %,
shrinkage EB priorN=400. Résidu = winrate shrunk de la cellule − baseline.

| Cellule (trait + trait) | Games | WR shrunk | Résidu (pp) |
|---|---|---|---|
| peel+peel | 1004 | 54.4 % | 4.42 |
| peel+ranged-long | 1048 | 54.3 % | 4.28 |
| late+peel | 2922 | 53.7 % | 3.73 |
| late+ranged-long | 1173 | 53.7 % | 3.66 |
| knockback+ranged-long | 1213 | 53.6 % | 3.56 |
| knockback+peel | 2610 | 53.3 % | 3.32 |
| engage-soft+peel | 3582 | 52.8 % | 2.84 |
| ad+peel | 5527 | 52.5 % | 2.45 |
| ap+melee | 7977 | 48.8 % | -1.19 |
| ad+melee | 5640 | 48.8 % | -1.19 |
| ap+ap | 3961 | 48.8 % | -1.23 |
| knockback+melee | 3368 | 48.7 % | -1.30 |
| early+engage-hard | 698 | 48.5 % | -1.55 |
| ap+early | 1356 | 48.1 % | -1.94 |
| melee+melee | 2188 | 48.0 % | -1.97 |
| early+melee | 619 | 47.2 % | -2.80 |

> Lecture : in-sample, cellules corrélées entre elles (un même duo active plusieurs
> cellules) — c'est un PRIOR structurel pour les paires jamais vues, pas un classement causal.

## I. Synthèse — ce que j'en retiens, et ce que ça change

1. **Le side est équilibré en 2026** (50,6 % bleu, IC traverse 50) — First Selection
   fait son travail ; cohérent avec le scorecard (side-only ≈ pile-ou-face).
2. **La prime au counterpick est minuscule** : +1,0 pp tous rôles (et négative au mid).
   Même en tenant compte du bruit d'entrelacement de l'ère FS (qui DILUE l'effet vers
   50 %), une grosse prime (≥ 5 pp) serait visible — elle n'existe pas. Le folklore
   surévalue le counter ; les pros paient peu leur blind. → Le coach ne doit pas
   surpondérer l'axe counter ; cohérent avec la littérature (lane counters réels mais petits).
3. **Les doubles slots packagent vraiment des duos** : 45,9 % (#2-#3) et 42,7 % (#4-#5)
   de duos nommés contre 21,4 % sur la paire à cheval #3-#4 — plus du double. La
   théorie des trades est un comportement réel mesuré. → Feature coach : proposer des
   PAIRES (pas des picks isolés) quand on entre dans un double slot.
4. **Les bans changent de nature entre les phases** : phase 1 = 25,9 % dans le top-10
   adverse, phase 2 = 16,5 % SEULEMENT. La phase 2 ne vise pas le répertoire du joueur
   mais la COMPO révélée (contres situationnels). → Le banEV doit avoir deux régimes :
   demande/répertoire en phase 1, contre-composition en phase 2 — ça précise la
   trouvaille « demande contrefactuelle » du scorecard.
5. **Les pros n'enfreignent jamais nos règles absolues** : 0 comp 100 % AD/AP, 0 comp
   sans engage, 10 sans frontline (qui gagnent !). Les markers d'hygiène sont de la
   PÉDAGOGIE (ne fais pas ce que les pros ne font jamais), pas de la discrimination.
6. **Un marker est empiriquement INVERSÉ** : low-mobility-vs-pick = +10,1 pp [1,6 ; 18,5]
   pour les équipes flaggées (n=130). Affronter une « comp Pick » avec une comp posée
   GAGNE en 2026 — les comps pick vivent des écarts que les pros ne donnent pas.
   → STEP_UP : réviser ce marker (contextualiser ou inverser). no-disengage-vs-engage
   reste directionnel (−15 pp, n=20, non significatif — à surveiller).
7. **La racine de l'échec G1 est identifiée** : r = 0,006 entre le scaling des tags et
   la durée réelle — la dimension scalingWindow ne décrit PAS le tempo des games pro
   (et le camp « late » gagne plutôt les games COURTES, 56,7 %). Refitter des poids sur
   une feature morte ne servira à rien : l'axe scaling doit consommer des données
   temporelles (statsByTime SoloQ / profils de durée corpus), le tag en simple fallback.
8. **Le pont de synergies par traits est né et parle déjà** : ad+peel **+2,45 pp** sur
   5 527 games (le pattern protect est réel), early+melee **−2,80**, melee+melee −1,97.
   → Brancher pairPrior dans les raisons du coach (« paire portée par +2,4 pp sur
   5 527 games ») et comme prior mean du terme duo pro de l'évaluateur.

