# Showroom Omnichannel Sales System

A single inbox + lightweight sales CRM for a multi-section showroom. All customer messages
from **WhatsApp, Instagram, and Facebook** land in one place; a **manager** routes them to
**sections** (tools, ceramic, tile, …); **employees see only their own section's
conversations** and reply from inside the system. Ad-driven messages auto-route to the
right section; direct messages are assigned manually. Every conversation is owned by the
employee who replies, carries a sales status, and shows the customer's full history.

The full design lives in the approved plan:
`C:\Users\baraa\.claude\plans\i-have-a-showroom-precious-squirrel.md`.

## Approach

We **extend self-hosted [Chatwoot](https://github.com/chatwoot/chatwoot)** (MIT Community
Edition) for the generic 80% (unified inboxes, teams, contacts CRM, labels, reports,
automation) and build only the showroom-specific parts ourselves:

| Custom build | Where |
|---|---|
| Team-scoped conversation visibility (employees see only their section) | Chatwoot fork patches → `docs/chatwoot-customizations.md` |
| Ad-referral capture → auto-assign to section | Chatwoot fork patch + `services/ai-kb-service` |
| Product knowledge base + Claude AI-draft replies + Copilot sidebar | `services/ai-kb-service` |
| Auto follow-up scheduler (24h-window / template aware) | `services/followup-scheduler` |

## Repository layout

```
.
├── docker-compose.yml          # Chatwoot + Postgres(pgvector) + Redis + Caddy + our services
├── Caddyfile                   # TLS reverse proxy (Meta requires HTTPS webhooks)
├── .env.example                # copy to .env and fill in
├── docs/
│   ├── meta-setup.md           # WhatsApp Cloud API / Instagram / Facebook onboarding
│   └── chatwoot-customizations.md  # the Ruby/Vue patches to apply to the Chatwoot fork
├── services/
│   ├── ai-kb-service/          # Claude drafts + product KB (RAG) + ad routing + sidebar
│   └── followup-scheduler/     # idle-conversation follow-ups
└── chatwoot/                   # (added later) git submodule/clone of the Chatwoot fork
```

## 👉 Start here

**[NEXT-STEPS.md](NEXT-STEPS.md)** is the exact, ordered, copy-paste runbook to take this
from scaffold to a live system. Follow it top to bottom. The overview below is just context.

## Getting started (high level)

1. **Read the plan** and `docs/meta-setup.md`.
2. `cp .env.example .env` and fill in secrets (Chatwoot, Anthropic, embeddings).
3. Bring up the base stack: `docker compose up -d postgres redis chatwoot chatwoot-sidekiq caddy`.
4. Finish Meta onboarding and add the WhatsApp / Instagram / Facebook inboxes in the
   Chatwoot UI (`docs/meta-setup.md`).
5. Create **Teams** (one per section), users, labels, and automation rules
   (`docs/chatwoot-customizations.md`, "Native configuration").
6. Bring up the custom services: `docker compose up -d ai-kb-service followup-scheduler`.
7. Apply the Chatwoot fork patches for section isolation + referral capture
   (`docs/chatwoot-customizations.md`) and rebuild the `chatwoot` image.

> **Status:** Phase 0 scaffolding. The Chatwoot fork + patches and live Meta credentials
> are the next steps (they require Docker, a domain with TLS, and a verified Meta Business
> account).

## Key constraints (do not forget)

- Moving your number to the **WhatsApp Cloud API** removes it from the WhatsApp Business
  *phone app*. **One business number = one WhatsApp inbox**, which is why section isolation
  must be **team-based**, not inbox-based.
- WhatsApp has a **24-hour customer-service window**: free-form replies only within 24h of
  the customer's last message; outside it you must send a **pre-approved template**. Meta
  bills per conversation.
- A customer on WhatsApp vs Instagram are **separate contacts** until merged.
