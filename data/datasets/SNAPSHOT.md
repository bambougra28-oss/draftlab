# Snapshots DraftGap gelés — gates run #2 (chantiers A et E)

Tirés UNE fois le 2026-06-11 (avant tout run de gate), depuis le CDN
DraftGap v5. Les fichiers JSON sont gitignorés (52 Mo) ; ces hashes les
gèlent — tout run de gate doit imprimer les mêmes.

| Fichier | Octets | SHA-256 |
|---|---|---|
| `current-patch.json` | 346 466 | `ACA91656AF68DFF5016152E947AAFBCEBFB3DFE320CC2781F8FDBE8983FB8869` |
| `30-days.json` | 52 294 617 | `6933C7C2D107AFD465E7D8F0C44765305FF8747A187ED54C4C1F73E87651A4B1` |

Sources : `https://bucket.draftgap.com/datasets/v5/{current-patch,30-days}.json`.
Re-télécharger NE redonne PAS ces fichiers (le CDN évolue) — pour reproduire
un run publié, il faut ces snapshots exacts.
