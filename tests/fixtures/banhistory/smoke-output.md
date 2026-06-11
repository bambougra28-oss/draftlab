# banEV phase 1 — terme de demande ban-history (run pré-enregistré)

> Règle gelée : `docs/run2/B-ban-history.md` §1, recopiée verbatim dans
> l'en-tête de `scripts/backtest/banHistory.ts`. UNE règle, UN run.
> Reproductibilité : seed 42, 1000 resamples, flux mulberry32 UNIQUE
> consommé dans l'ordre argv — par corpus : IC (nouveau − baseline) puis (nouveau − ancien).
> Horloges gelées (« Généré le » publiés) : lck `2026-06-10T19:33:00.590Z` · lec `2026-06-10T19:33:01.965Z` · lfl `2026-06-10T19:33:03.024Z` · lpl `2026-06-10T21:02:11.514Z`.

## Porte de validité du run (§1.4)

**RUN INVALIDE** — la baseline et/ou le modèle ancien ne reproduisent pas les paires publiées : bug de réplication de piste. Le run s’arrête là (§1.4) ; la correction mécanique est autorisée UNIQUEMENT pour retrouver les valeurs gelées, jamais jugée sur la ligne du nouveau modèle (qui n’est pas publiée ci-dessous).

| Corpus | Baseline recalculée | Baseline publiée | Ancien recalculé | Ancien publié | Reproduit |
|---|---:|---:|---:|---:|---|
| lck-2026.json | — | 1.3007 | — | 0.9388 | NON — corpus absent du run |
| lec-2026.json | — | 1.2039 | — | 1.1096 | NON — corpus absent du run |
| lfl-2026.json | — | 1.067 | — | 1.2598 | NON — corpus absent du run |
| lpl-2026.json | — | 1.2459 | — | 1.0408 | NON — corpus absent du run |

> Boucle bornée §1.4 : corriger la réplication de piste (baseline, modèle ancien), re-runner,
> documenter chaque tentative. La ligne du nouveau modèle reste non publiée tant que la porte est rouge.
