# DraftLab — Déploiement (Cloudflare Pages)

L'app est prête à déployer. Build vérifié (`vite build` exit 0, adapter
Cloudflare). Client-only : **aucun secret n'est nécessaire à l'exécution** —
les secrets ci-dessous servent uniquement à la CI pour pousser le build.

## Ce qui marche / dégrade en production

| Fonction | En prod | Note |
|---|---|---|
| Draft board, plans, séries, review, prototype, prep-trees, pockets | ✅ | Tout le cœur produit, 100 % client. |
| **Corpus pro** (lck/lec/lfl/lpl 2026) | ✅ | Servi depuis `static/corpus/` (assets statiques). |
| **Dataset DraftGap** (winrates SoloQ) | ✅ | Fetch runtime `bucket.draftgap.com` (~50 Mo, cache IndexedDB 24 h). |
| **Scouting gol.gg** (sync Équipe A/B) | ⚠️ dégrade | gol.gg bloque les IP datacenter ⇒ le proxy `/api/golgg` reçoit 403. Message honnête affiché (« indisponible depuis ce serveur — utilise le corpus pro importé, ou synchronise en local »). Le reste du produit ne dépend pas de gol.gg. |

## Setup une seule fois (Alain)

1. **Cloudflare → Pages → créer un projet** nommé `draftlab` (Direct
   Upload / connect to Git, peu importe — le workflow pousse en Direct Upload).
   Si tu choisis un autre nom, mets-le dans la variable repo
   `CLOUDFLARE_PROJECT_NAME`.
2. **Token API** : Cloudflare → My Profile → API Tokens → Create Token →
   template « Edit Cloudflare Workers » (ou permission `Account · Cloudflare
   Pages · Edit`). Copie le token.
3. **Account ID** : visible dans l'URL du dashboard ou Workers & Pages →
   Overview (colonne droite).
4. **GitHub → repo `bambougra28-oss/draftlab` → Settings → Secrets and
   variables → Actions → New repository secret** :
   - `CLOUDFLARE_API_TOKEN` = le token de l'étape 2
   - `CLOUDFLARE_ACCOUNT_ID` = l'account id de l'étape 3
5. **Activer le workflow** si désactivé : GitHub → onglet Actions →
   « Deploy (Cloudflare Pages) » → Enable. (Ou `gh workflow enable
   deploy.yml`.)

## Déployer

```bash
git push origin main        # déclenche .github/workflows/deploy.yml
```

Ou manuellement : Actions → Deploy (Cloudflare Pages) → Run workflow.

Le workflow (`.github/workflows/deploy.yml`) : `pnpm install --frozen-lockfile`
→ `pnpm build` → `wrangler pages deploy .svelte-kit/cloudflare`. L'URL de
déploiement apparaît dans le résumé du job (`environment: production`).

## Notes

- Le merge run #4 est sur `main` **en local** (8 commits d'avance sur
  `origin/main`) — `git push origin main` les envoie ET déclenche le déploiement.
- `adapter.emulate` désactivé sur win32 (workerd#4668) ne concerne QUE le
  `vite preview` local sur cette machine Windows ; la CI Linux et le build
  Cloudflare ne sont pas affectés.
- Aucune base de données ni état serveur : persistance 100 % IndexedDB côté
  client (plans, séries, cache dataset/corpus).
