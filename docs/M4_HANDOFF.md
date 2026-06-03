# M4 Handoff — Sprint Recap (2026-05-01)

## TL;DR pour Alain (2 minutes)

J'ai exécuté le sprint M4 autonome. Tout est commité, testé, et démontrable.
Pour voir tourner :

```bash
pnpm dev
# puis http://localhost:5173/prototype
```

5 sample drafts dans le selector, chaque draft affiche : identité comp ally
+ enemy (avec distribution sur 5 archétypes), power curves early/mid/late,
risk markers severity-triés.

236 tests verts, typecheck/lint clean, coverage tags 100%.

## Ce qui marche et a été testé

- ✅ **M4.1.1** : 172/172 champions taggés, 16 tests schema, validateur strict
- ✅ **M4.2** : classifier Game Plan, 16 tests (rule mechanics + 5 smoke pro-comps)
- ✅ **M4.3** : power curve calc + Svelte component, 12 tests + live-data smoke
- ✅ **M4.4** : 9 risk markers détectés, 22 tests (un par marker + edge cases + tri)
- ✅ **Prototype** : route `/prototype`, build OK, dev server 200, pipeline e2e
  validé sur les 5 sample drafts
- ✅ **Suite complète** : 236/246 tests, 10 skipped sont les tests live-data
  (CI-friendly, gated par presence du dataset sample)

## Ce qui ne marche pas ou est partiel

### Risk markers : 3/12 différés
- `side-disadvantage-unmitigated`, `pool-overlap`, `pocket-pick-risk-enemy`
- Réservés dans le type union `RiskMarkerId` (forward-compatible)
- Skipped silencieusement quand `sideStats`/`playerPools` absents
- À réimplémenter en M5+ quand le data layer scout sera plumbé

### Sample drafts : illustratifs, pas historiques
- 5 drafts plausibles 2025-2026 dans `data/sampleDrafts.json`
- Pas validés contre des matchs spécifiques (Worlds finale exact, etc.)
- Le prototype les présente comme "illustrative" dans le contexte

### Confidence des tags
- 15 champions à `confidence:high` (calibration M4.1, validés par toi)
- 154 champions à `confidence:medium` (batch claude, jamais validés humain)
- 3 champions à `confidence:low` : Mel, Yunara, Zaahen (post-cutoff, web search)

→ La classification M4.2 fonctionne sur tout, mais les 154 medium gagneraient
à passer en `user` après revue.

### Pas de champion icons sur le prototype
- Names only. Icons via ddragon URL nécessitent la version du patch + composition
- Polish item, pas bloquant pour la démo

### Pas de manual draft picker sur `/prototype`
- Sample selector seulement (5 drafts). Pas de saisie manuelle (out of scope M4)
- Le `/` (route principale) garde le draft analyzer M2 complet — disponible
  en parallèle

## Décisions de design qui méritent revisit en M5+

### 1. Bucket boundaries du Power Curve
**Spec** : 0-15 / 15-25 / 25+ min.
**Réalité** : DraftGap dataset bucketise à 25/30/35/40. J'ai mappé en 3 :
early (<25), mid (25-35), late (35+).
**À revisiter** si une distinction early plus fine est nécessaire — il faudra
sourcer une autre dataset ou compute from match logs.

### 2. `disengageTools 'self'` rule
**Spec D4** demandait un bonus Split pour `disengageTools includes 'self'`.
**Schema M4.1** ne contient pas `'self'` (replacé par `mobility`). Rule skipped.
**À revisiter** si Split classification s'avère sous-tunée — soit ajouter un
`selfEscape: boolean`, soit étendre `disengageTools`.

### 3. Sort order vs distribution clarity
Les markers `no-engage-tool` à severity `info` peuvent perturber dans des
comps Pick/Protect où c'est *attendu*. Le user pourrait préférer les filtrer
visuellement par severity dans la UI. Out of scope M4.4, à voir en polish.

### 4. Vote table tuning
La table de votes D4 est défensive mais pas calibrée empiriquement contre des
drafts pro réels. Sur les 5 smoke tests, 4/5 produisent le primary archétype
attendu, mais Draft 3 enemy ("Split" labellisé) classifie protect 25% / split
22% — close. Si on veut +confidence en M5, on calibre les poids contre un
corpus de drafts annotés.

## Cas dans `docs/unresolved.md`

- **M4.2** : règle `disengageTools 'self'` non appliquée (schema mismatch documenté)
- **M4.3** : bucket boundaries différents du spec (mapping documenté)
- **Tags** : Mel, Yunara, Zaahen à confidence:low — review humain recommandé

## Recommandation pour la prochaine session

**Option A — Polish M4.1.1 (1-2h)**
Review les 154 confidence:medium tags par batch. Validation rapide ou
correction. Permet d'avoir un corpus full-`taggedBy:user` avant M5.

**Option B — M5.1 Adversary Plan Detector (3-4h)**
Le plus gros saut de valeur produit. Réutilise le classifier M4.2 mais sur
des comps partielles (1-3 picks) avec mise à jour pick-by-pick. Voir
`draftlab-frameworks-research.md` §2.6 et §4.2.

**Option C — Prototype polish + manual draft picker (2-3h)**
Wirer un picker pour saisir des drafts manuellement (et pas juste les 5
samples), connecter au scout M2/M3 pour charger des drafts gol.gg directs.
Vraie utilisabilité de la couche stratégique.

**Ma reco** : **B** (M5.1) si tu veux progresser sur la roadmap, **A** sinon
(quick win qualité). C est moins prioritaire — la démo `/prototype` suffit
à valider le concept stratégique pour l'instant.

## Commits du sprint M4

```
76b5663 feat(m4.1):    champion tagging foundation + 15 champions calibration
14c3657 feat(m4.1.1):  tag remaining 157 champions — 172/172 coverage
<X>     feat(m4.2):    Game Plan Classifier — 5 archetypes from champion tags
<Y>     feat(m4.3):    Power Curve Visualizer + statsByTime aggregation
39d9cc3 feat(m4.4):    Risk Markers — 9 detected, 3 deferred to M5
<Z>     feat(m4):      /prototype route — Game Plan + Power Curves + Risk Markers
<final> docs(m4):      handoff + status + journal
```

(Hashes <X>/<Y>/<Z>/<final> à compléter avec le `git log` final.)

Tag : `M4-prototype` (à poser après le commit de docs).

## Files créés / modifiés au cours du sprint

```
data/championTags.json                                 (15 → 172 entries)
data/sampleDrafts.json                                 (new — 5 drafts)
docs/M4_1_1.md                                         (new)
docs/M4_2.md                                           (new)
docs/M4_3.md                                           (new)
docs/M4_4.md                                           (new)
docs/M4_PROTOTYPE.md                                   (new)
docs/M4_HANDOFF.md                                     (new — this file)
docs/STATUS.md                                         (new)
docs/unresolved.md                                     (new)
journal.txt                                            (new)
src/lib/strategic/gamePlanClassifier.ts                (new)
src/lib/strategic/powerCurveCalculator.ts              (new)
src/lib/strategic/riskMarkerDetector.ts                (new)
src/lib/components/PowerCurveVisualizer.svelte         (new)
src/lib/types/index.ts                                 (extended: statsByTime, damageProfile)
src/routes/prototype/+page.ts                          (new)
src/routes/prototype/+page.svelte                      (new)
tests/championTags.test.ts                             (M4.1, unchanged)
tests/gamePlanClassifier.test.ts                       (new — 16 tests)
tests/powerCurveCalculator.test.ts                     (new — 12 tests)
tests/riskMarkerDetector.test.ts                       (new — 22 tests)
```

Total : ~5500 LoC ajoutés (code + tests + docs).
