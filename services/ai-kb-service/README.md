# ai-kb-service

The custom AI + knowledge-base service for the showroom system. It:

- **Drafts replies with Claude**, grounded in the product knowledge base (RAG) and the
  customer's conversation history, and posts them as **private notes** in Chatwoot
  (employee reviews and sends — never sent to the customer automatically).
- **Auto-routes ad-driven conversations** to the right section (Chatwoot team) using the ad
  referral captured by the Chatwoot fork patch.
- Serves the **Copilot sidebar** (a Chatwoot Dashboard App) for on-demand drafts,
  translation, and live product lookup.
- Exposes **admin CRUD** for the product catalog and the ad→section routing rules.

## Run (dev)

```bash
cp .env.example .env        # fill in secrets
npm install
npm run migrate             # idempotent schema (products, ad_routing) + pgvector
npm run dev
```

Needs a Postgres with the `vector` extension (use the `pgvector/pgvector` image, or the
`postgres` service in the root `docker-compose.yml`).

## Endpoints

All paths are reachable externally under `/ai/*` (Caddy strips the prefix).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/health`, `/ready` | – | liveness / readiness |
| POST | `/webhooks/chatwoot` | webhook token | Chatwoot events: ad-route + draft |
| POST | `/copilot/draft` | (session) | on-demand draft (returned, not posted) |
| POST | `/copilot/translate` | (session) | translate text AR↔EN |
| GET  | `/copilot/products` | (session) | product lookup for the sidebar |
| GET/POST/PUT/DELETE | `/products[...]` | `x-admin-token` | product catalog CRUD |
| GET/POST/DELETE | `/admin/ad-routing[...]` | `x-admin-token` | ad→section rules |
| GET | `/sidebar.html` | – | Copilot Dashboard App UI |

## Wiring into Chatwoot

1. **Webhook / Agent Bot** → URL `https://$HOST/ai/webhooks/chatwoot?token=$CHATWOOT_WEBHOOK_SECRET`,
   events `conversation_created`, `message_created`.
2. **Dashboard App** (Settings → Integrations → Dashboard Apps) → URL
   `https://$HOST/ai/sidebar.html`. It appears as a tab in the conversation view.
3. Create a Chatwoot **Access Token** for this service → `.env` `CHATWOOT_API_ACCESS_TOKEN`.

## Notes / next steps

- `/copilot/*` is called from the agent browser; secure it behind the Chatwoot session or a
  short-lived token before production (see comment in `src/routes/copilot.ts`).
- Switch embeddings provider via `EMBEDDINGS_PROVIDER` (keep the pgvector column dim in sync;
  re-run a reindex if you change models/dimensions).
