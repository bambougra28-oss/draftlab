# DraftLab — Déploiement (GitHub Pages, sans compte tiers)

L'app est un **SPA 100 % statique** (`adapter-static`, `ssr=false` partout) :
aucun serveur, aucun compte Cloudflare/Netlify/Vercel, **aucun secret**. Le
déploiement GitHub Pages utilise le `GITHUB_TOKEN` automatique.

> Pourquoi pas de serveur ? Le seul endpoint serveur était le proxy
> `/api/golgg` (scouting), or gol.gg bloque les IP datacenter : il ne marchait
> **déjà pas** en prod. On l'a donc retiré du build statique — le scouting
> gol.gg reste dispo en local (`pnpm dev`), et en prod l'app affiche un message
> honnête et s'appuie sur le **corpus pro bundlé** (entièrement hors-ligne).

## Ce qui marche en prod

| Fonction | Prod | Note |
|---|---|---|
| Draft board, plans, séries, review, prototype, prep-trees, pockets, live | ✅ | Tout le cœur produit, 100 % client (IndexedDB). |
| Corpus pro (lck/lec/lfl/lpl 2026) | ✅ | Assets statiques `static/corpus/`, base-aware. |
| Dataset DraftGap (winrates SoloQ) | ✅ | Fetch runtime `bucket.draftgap.com`, cache 24 h. |
| Scouting gol.gg | ⚠️ local seulement | Pas de proxy serveur en statique → message « indisponible depuis ce serveur ». |

## Déployer (≈ 1 minute, une seule fois)

Le workflow `.github/workflows/pages.yml` build et déploie à chaque push sur
`main`. Il faut juste **activer GitHub Pages en mode Actions** une fois :

- GitHub → repo `bambougra28-oss/draftlab` → **Settings → Pages** → *Build and
  deployment* → **Source : GitHub Actions**.
  (Ou en CLI : `gh api -X POST repos/bambougra28-oss/draftlab/pages -f build_type=workflow`.)

Puis :

```bash
git push origin main      # déclenche pages.yml → build statique → deploy-pages
```

L'URL apparaît dans le résumé du job (environment `github-pages`). Pour ce repo :
**https://bambougra28-oss.github.io/draftlab/**

## Détails techniques

- `BASE_PATH=/draftlab` est injecté par le workflow (site projet servi sous
  `/<repo>`). En local ou sur un host à la racine, `BASE_PATH` vide ⇒ racine.
  Config portable : `svelte.config.js` lit `process.env.BASE_PATH`.
- `adapter-static` écrit le shell SPA dans `404.html` ; le workflow le copie en
  `index.html` pour que la racine réponde 200 et que les liens profonds
  (`/draftlab/plans`) bootent via `404.html`.
- Déploiement via `actions/deploy-pages` (pas de Jekyll → `_app/` servi tel
  quel, pas besoin de `.nojekyll`).
- Persistance 100 % IndexedDB côté client ; aucune base ni état serveur.

## Portabilité

La sortie `build/` est du statique pur : déployable aussi sur Cloudflare Pages,
Netlify, S3, etc. (mettre `BASE_PATH` vide pour un host à la racine). GitHub
Pages est juste le chemin sans compte ni secret.
