# Amendement d'architecte — état de corpus UNIQUE de la run #2

> Requis par les préconditions §0 du chantier F (et par C §4-étape-4 / A §1.2 /
> B §1.4). Commité AVANT tout run de validation. UN SEUL état de corpus pour
> toute la run #2 : les pulls du **2026-06-11 ~13h47-13h52** (heure locale),
> chemin `Special:CargoExport`, provider corrigé.

## 1. Ce qui a été corrigé (la leçon Nasus, menée au bout)

**Cause racine prouvée (pas le wiki — notre provider)** : `PicksAndBansS7.Team1`
est l'équipe 1 **du match** (constante sur la série), `ScoreboardGames.Team1`
le côté **bleu** de la game. Saisies 2025 side-keyed (toujours alignées) ; en
2026 (ère First Selection) les deux divergent quand l'équipe-1 du match joue
côté rouge : colonnes picks/bans/roles ET l'index `PB.Winner` atterrissaient
sur le mauvais side. Vérifié live sur la finale LEC (le wiki est cohérent :
`PB.Winner=2` = G2 = `WinTeam` ; notre lecture l'inversait et attribuait le
Nasus de Skewmond à KC). Le re-pull sur l'API corrigée reproduisait les mêmes
violations — c'est ce qui a discriminé provider vs wiki.

Trois fixes provider (commits `0819b9d`, suivants) :
1. **Réalignement par noms d'équipe** des colonnes PB sur bleu/rouge
   (+ inversion de l'index Winner), warning compté par game réalignée.
2. **Patches flottants CargoExport** : `26.10` arrivait `26.1` (≠ pour
   `parsePatch`) — zéro de fin restauré sur les minorations à un chiffre.
3. **Entités HTML amont** (`Nunu &amp; Willump`, édition wiki du jour sur
   lfl-2025) : décodage minimal avant lookup champion.

## 2. Dégâts quantifiés (diff old → new, `scripts/data/diffCorpus.ts`)

| Corpus | Games réalignées (winner + 20 actions) | Part |
|---|---|---|
| lck-2026 | 239 / 337 | 71 % |
| lec-2026 | 103 / 246 | 42 % |
| lfl-2026 | 0 / 191 (saisie restée side-keyed) | 0 % |
| lpl-2026 | 335 / 445 | 75 % |
| lck-2025 (nouveau) | 13 / 555 | 2 % |
| lec-2025 / lpl-2025 | 0 | 0 % |
| lfl-2025 | 1 action (seq 20, entité HTML) | — |

**Conséquence déclarée** : tous les claims mesurés sur les corpus 2026 publiés
le 2026-06-10 (scorecards pick-in-range/ban-hit, rôle-inférence 95 %, étude
science-de-la-draft) reposaient sur des winners et des attributions par équipe
corrompus à hauteur du tableau ci-dessus — ils sont invalidés et re-mesurés en
vague 3 sur cet état. Les corpora 2025 étaient sains (hors 13 games lck-2025 et
1 action lfl-2025).

## 3. Re-gel des comptes d'audit (vérifié sur l'état corrigé)

- **C §1.0 / §4-étape-4 : REPRODUIT AU CHIFFRE PRÈS** (`--audit-only`,
  2026-06-11) : **1 189 séries valides · 836 multi-games · 14 720 picks
  games 2+ · 46 re-picks (tous LFL 2025 Promotion) · 2 944 événements bruts →
  2 928 après TEST 0 · anomalie Ambessa citée (LPL/2025 Split 1_Week 2_5_3)**.
  Le réalignement déplace des champions ENTRE sides sans changer les unions
  par game — les comptes structurels side-agnostiques sont invariants, comme
  attendu.
- **A §1.2** : les 7 corpus du run comptent toujours **2 661 drafts**
  (337+246+191+445+308+317+817 — contenus corrigés, effectifs inchangés).
- **B §1.4** : les constantes `PUBLISHED`/`PUBLISHED_GENERATED_AT` réfèrent
  aux scorecards du 2026-06-10 calculés sur l'état corrompu — elles seront
  amendées par un commit daté APRÈS régénération des scorecards sur cet état
  (et AVANT le run B). La porte de validité garde tout son rôle anti-bug : ce
  qui change est la donnée, pas la règle.
- **Snapshots DraftGap** (gates A/E) : INCHANGÉS — `data/datasets/SNAPSHOT.md`
  reste la référence (les corpora et les datasets champions sont des objets
  distincts).
- **lck-2025.json (555 drafts, 0 violation, 100 % résolus)** rejoint
  `data/corpus/` : réservé au run de RÉPLICATION G1 et aux réplications
  étiquetées (il ne rejoint PAS les runs A-E, règle A §1.2 / C §1.1).

## 4. Validation de l'état

`scripts/data/validateCorpus.ts` sur les 8 fichiers : **0 violation
structurelle, 0 descriptive** (exit 0). Quarantaine fraîcheur : 0 record
< 3 jours. Manifestes `index.json` (static + data) portent `integrity` et
`freshness` par fichier, `pulledAt` du 2026-06-11.
