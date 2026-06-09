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

## Deploy target

**Production: [Railway](https://railway.app)**. The step-by-step runbook is
[NEXT-STEPS.md](NEXT-STEPS.md).

**Local dev: Docker Compose** — the included [docker-compose.yml](docker-compose.yml) +
[Caddyfile](Caddyfile) bring the whole stack up on your laptop for testing.

## Current scope: basics first

The first phase ships **just Chatwoot + Meta channels + native config** on Railway (4
services, zero custom code, zero patches). Manager triages every incoming conversation and
assigns it to an employee; each employee sees only their own assignments using Chatwoot's
"Conversations assigned to me only" access level. See [NEXT-STEPS.md](NEXT-STEPS.md).

The four upgrades — section-shared visibility (patch B1), ad → section auto-routing
(patch B2), Claude AI drafts + product KB ([services/ai-kb-service/](services/ai-kb-service/)),
auto follow-ups ([services/followup-scheduler/](services/followup-scheduler/)) — are
**already scaffolded** in this repo and can be turned on one at a time when ready.

## Key constraints (do not forget)

- Moving your number to the **WhatsApp Cloud API** removes it from the WhatsApp Business
  *phone app*. **One business number = one WhatsApp inbox**, which is why section isolation
  must be **team-based**, not inbox-based.
- WhatsApp has a **24-hour customer-service window**: free-form replies only within 24h of
  the customer's last message; outside it you must send a **pre-approved template**. Meta
  bills per conversation.
- A customer on WhatsApp vs Instagram are **separate contacts** until merged.
