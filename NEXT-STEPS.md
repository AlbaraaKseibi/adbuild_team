# What to do now — step by step

This is the exact order to take the project from "scaffolded on your laptop" to "live
system answering real customers." Do the steps top to bottom. Each step says **what to do**
and **how you know it worked (✅)**.

> **Where things run:** Chatwoot + our services run in **Docker** on a **Linux server with a
> public domain** (Meta requires a public HTTPS address for webhooks). Your Windows PC is
> only used to edit files and run commands over SSH. A cheap cloud VPS is enough.

> **Time note:** Step 1.2 (Meta Business Verification) can take **1–3 days** to be approved.
> **Start it first**, then do everything else while you wait.

---

## Phase 1 — Accounts & things to gather (start today, no server needed)

- [ ] **1.1 Buy a domain** (or use a subdomain you own), e.g. `chat.yourshowroom.com`.
- [ ] **1.2 Meta Business setup** — start this first, it takes the longest:
  - Create/confirm a **Meta Business Manager** account and complete **Business
    Verification** (Business Settings → Security Center).
  - Create a **Meta App** of type **Business** at <https://developers.facebook.com/>.
  - Add the **WhatsApp**, **Messenger**, and **Instagram** products to the app.
  - Make sure you have a **Facebook Page** for the showroom and an **Instagram
    Professional** account **linked to that Page**.
  - Decide **which WhatsApp number** you'll move to the Cloud API. ⚠️ Once moved it leaves
    the WhatsApp Business *phone app*.
- [ ] **1.3 Get API keys:**
  - **Anthropic (Claude):** <https://console.anthropic.com/> → API key (`sk-ant-...`).
  - **Voyage AI (embeddings, multilingual):** <https://www.voyageai.com/> → API key
    (`pa-...`). *(Optional: use OpenAI embeddings instead — see `.env`.)*

**Collect these values in one place — you'll paste them into `.env` in Phase 3:**

```
DOMAIN              = chat.yourshowroom.com
ACME_EMAIL          = you@yourshowroom.com
ANTHROPIC_API_KEY   = sk-ant-...
VOYAGE_API_KEY      = pa-...
WhatsApp Phone Number ID, WABA ID, System User token   (from Phase 4)
Facebook Page Access Token                              (from Phase 4)
```

✅ **Done when:** Meta Business Verification is *submitted* (approval can come later) and you
have your domain + Claude + Voyage keys.

---

## Phase 2 — Provision the server

- [ ] **2.1 Create a VPS** (e.g. Hetzner, DigitalOcean, AWS Lightsail):
  - **Ubuntu 22.04 / 24.04**, **4 GB RAM minimum** (8 GB comfortable), 2 vCPU, 40 GB disk.
- [ ] **2.2 Point your domain at it:** add a DNS **A record** for `chat.yourshowroom.com` →
  the server's public IP. Wait for it to resolve (`ping chat.yourshowroom.com`).
- [ ] **2.3 Open firewall ports 80 and 443** (and 22 for SSH) on the VPS.
- [ ] **2.4 SSH into the server** and install Docker:
  ```bash
  ssh root@YOUR_SERVER_IP
  curl -fsSL https://get.docker.com | sh
  docker --version && docker compose version   # confirm both work
  ```

✅ **Done when:** `docker compose version` prints a version, and your domain resolves to the
server IP.

---

## Phase 3 — Get the project onto the server & configure it

- [ ] **3.1 Copy this project to the server.** Easiest is git. From your Windows PC inside
  `d:\marketing-system` (in PowerShell):
  ```powershell
  git init
  git add .
  git commit -m "Initial scaffold"
  # create an empty private repo on GitHub, then:
  git remote add origin https://github.com/YOURNAME/marketing-system.git
  git push -u origin main
  ```
  Then on the server:
  ```bash
  apt-get install -y git
  git clone https://github.com/YOURNAME/marketing-system.git
  cd marketing-system
  ```
  *(No GitHub? Use `scp -r d:\marketing-system root@SERVER_IP:/root/` from PowerShell.)*

- [ ] **3.2 Create your `.env`:**
  ```bash
  cp .env.example .env
  ```
- [ ] **3.3 Generate the two strong secrets** and note them:
  ```bash
  openssl rand -hex 64    # -> paste as SECRET_KEY_BASE
  openssl rand -hex 24    # -> use for POSTGRES_PASSWORD / tokens
  ```
- [ ] **3.4 Edit `.env`** (`nano .env`) and fill in **at least** these:
  ```
  PUBLIC_HOSTNAME=chat.yourshowroom.com
  FRONTEND_URL=https://chat.yourshowroom.com
  ACME_EMAIL=you@yourshowroom.com
  POSTGRES_PASSWORD=<the rand-hex-24 value>
  SECRET_KEY_BASE=<the rand-hex-64 value>
  CHATWOOT_WEBHOOK_SECRET=<another rand-hex-24>
  AI_KB_ADMIN_TOKEN=<another rand-hex-24>
  ANTHROPIC_API_KEY=sk-ant-...
  VOYAGE_API_KEY=pa-...
  ```
  Leave `CHATWOOT_API_ACCESS_TOKEN=paste-after-first-boot` for now — you'll set it in Phase 6.

✅ **Done when:** `.env` exists on the server with the secrets above filled in.

---

## Phase 4 — Boot the base stack (Chatwoot)

- [ ] **4.1 Start the database and cache:**
  ```bash
  docker compose up -d postgres redis
  ```
- [ ] **4.2 Prepare the Chatwoot database (first run only):**
  ```bash
  docker compose run --rm chatwoot bundle exec rails db:chatwoot_prepare
  ```
- [ ] **4.3 Start Chatwoot + the reverse proxy:**
  ```bash
  docker compose up -d chatwoot chatwoot-sidekiq caddy
  docker compose logs -f caddy      # watch it obtain the TLS certificate, then Ctrl+C
  ```
- [ ] **4.4 Open `https://chat.yourshowroom.com`** in a browser → create the **admin
  account** (this first user is your manager/admin).

✅ **Done when:** the Chatwoot login page loads over **HTTPS** (padlock) and you can log in.

---

## Phase 5 — Connect WhatsApp, Facebook, Instagram

Follow **[docs/meta-setup.md](docs/meta-setup.md)** precisely (it has the exact fields). In short:

- [ ] **5.1 WhatsApp:** in Meta App → WhatsApp → get Phone Number ID, WABA ID, a permanent
  System User token. In Chatwoot → **Inboxes → Add Inbox → WhatsApp → WhatsApp Cloud**,
  enter them + a verify token. Paste Chatwoot's callback URL + verify token back into Meta
  and subscribe to `messages`.
- [ ] **5.2 Facebook:** Chatwoot → **Add Inbox → Facebook** → log in, pick your Page.
- [ ] **5.3 Instagram:** Chatwoot → **Add Inbox → Instagram** → authorize, pick the account.

✅ **Done when:** you message each channel from a test phone and the message **appears in
Chatwoot**, and your reply from Chatwoot **arrives on the test phone**.

---

## Phase 6 — Create the API token & start the custom services

- [ ] **6.1** In Chatwoot → your **Profile → Access Token** → copy it.
- [ ] **6.2** Put it in `.env` on the server:
  ```
  CHATWOOT_API_ACCESS_TOKEN=<the token>
  ```
- [ ] **6.3** Start the AI + scheduler services:
  ```bash
  docker compose up -d --build ai-kb-service followup-scheduler
  docker compose logs -f ai-kb-service     # should say "listening on :4000"
  ```
- [ ] **6.4** Check it's reachable: open `https://chat.yourshowroom.com/ai/health` → should
  return `{"status":"ok"}`.

✅ **Done when:** `/ai/health` returns ok and the logs show both services running.

---

## Phase 7 — Set up your sections, staff, and rules (in Chatwoot, no code)

Follow **[docs/chatwoot-customizations.md](docs/chatwoot-customizations.md) → "A. Native
configuration"**. In order:

- [ ] **7.1 Teams = sections:** Settings → Teams → create **Tools, Ceramic, Tile, …** plus a
  **Triage** team. Enable **auto-assign** on each.
- [ ] **7.2 Agents:** Settings → Agents → add each employee; add them to their section's
  **Team** and to the WhatsApp/IG/FB **inboxes**. Make yourself/managers **Administrator**.
- [ ] **7.3 Sales stage:** Settings → Custom Attributes → Conversation → add `sales_stage`
  (list: new, contacted, quoted, negotiating, won, lost).
- [ ] **7.4 Ownership on reply:** Settings → Inbox → enable auto-assignment, or add the
  "assign to me on reply" automation (see the doc).
- [ ] **7.5 Canned responses + auto-reply greeting** (Settings → Canned Responses /
  Automation).

✅ **Done when:** you can assign a test conversation to a section, set its `sales_stage`, and
the assignee shows who replied.

---

## Phase 8 — Wire the AI service & load products

- [ ] **8.1 Webhook:** Chatwoot → Settings → Integrations → **Webhooks** → add
  `https://chat.yourshowroom.com/ai/webhooks/chatwoot?token=YOUR_CHATWOOT_WEBHOOK_SECRET`
  and subscribe to **Conversation Created** and **Message Created**.
- [ ] **8.2 Copilot sidebar:** Settings → Integrations → **Dashboard Apps** → add
  `https://chat.yourshowroom.com/ai/sidebar.html`. It appears as a tab inside conversations.
- [ ] **8.3 Find your team IDs** (needed for ad routing). Easiest:
  ```bash
  curl -s https://chat.yourshowroom.com/api/v1/accounts/1/teams \
    -H "api_access_token: YOUR_CHATWOOT_API_ACCESS_TOKEN"
  ```
  Note the `id` for each section (e.g. Ceramic = 3).
- [ ] **8.4 Add ad→section rules** so ad messages auto-route. Example (Ceramic = team 3):
  ```bash
  curl -X POST https://chat.yourshowroom.com/ai/admin/ad-routing \
    -H "x-admin-token: YOUR_AI_KB_ADMIN_TOKEN" -H "Content-Type: application/json" \
    -d '{"match_type":"ad_id","match_value":"PASTE_META_AD_ID","team_id":3,"section":"ceramic"}'
  ```
  *(Tip: name your Meta campaigns with the section, then use `match_type":"campaign_regex"`
  with `"match_value":"ceramic|سيراميك"` to route by name instead of per-ad.)*
- [ ] **8.5 Load a few products** to test the knowledge base:
  ```bash
  curl -X POST https://chat.yourshowroom.com/ai/products \
    -H "x-admin-token: YOUR_AI_KB_ADMIN_TOKEN" -H "Content-Type: application/json" \
    -d '{"section":"ceramic","name":"White Glazed Wall Tile 30x60","sku":"CER-3060-W",
         "price":12.5,"currency":"USD","in_stock":true,
         "specs":{"size":"30x60cm","finish":"glossy"},
         "description":"بلاط حائط سيراميك أبيض لامع 30×60 — White glossy ceramic wall tile."}'
  ```

✅ **Done when:** sending a product question to a test conversation makes a 🤖 **draft note**
appear, and the Copilot sidebar's product search returns your product.

---

## Phase 9 — The two developer patches (section isolation + ad capture)

This is the only part that needs editing Chatwoot's source. Follow
**[docs/chatwoot-customizations.md](docs/chatwoot-customizations.md) → "B. Fork patches"**.
If you have a developer, hand them that doc. High level:

- [ ] **9.1** Clone the Chatwoot fork and check out the matching version:
  ```bash
  git clone https://github.com/chatwoot/chatwoot.git
  cd chatwoot && git checkout v4.0.0
  ```
- [ ] **9.2 Patch B1 — team-scoped visibility** (employees see only their section), across
  list, **search**, filters, and reports.
- [ ] **9.3 Patch B2 — ad-referral capture** (store the ad id on the conversation).
- [ ] **9.4** Point `docker-compose.yml` `chatwoot` + `chatwoot-sidekiq` at
  `build: ./chatwoot`, then:
  ```bash
  docker compose up -d --build chatwoot chatwoot-sidekiq
  ```

> 🔔 **Tell me when you reach this step** — I can write the actual patch files against the
> cloned fork for you.

✅ **Done when:** logged in as a Tools employee you **cannot** see Ceramic conversations
(list/search/filter), and an ad message lands in the correct section automatically.

---

## Phase 10 — Final end-to-end test

Run the checklist in the plan's **Verification** section
(`C:\Users\baraa\.claude\plans\i-have-a-showroom-precious-squirrel.md`):

- [ ] Messages from all 3 channels arrive and replies go back natively.
- [ ] Ad message auto-routes to its section; direct message lands in Triage.
- [ ] Employees see only their section (incl. search/filters); manager sees all.
- [ ] Reply sets the owner; `sales_stage` can be moved to `won`.
- [ ] AI draft note appears and is only sent when the employee sends it; Arabic works.
- [ ] An idle conversation gets a follow-up (template after 24h); replying stops it.
- [ ] Manager reports show per-employee, per-section, and showroom numbers.

---

## Quick reference — daily/ops commands (on the server)

```bash
docker compose ps                      # what's running
docker compose logs -f ai-kb-service   # tail a service
docker compose up -d --build SERVICE   # rebuild & restart one service after changes
docker compose down                    # stop everything (data is kept in volumes)
docker compose pull && docker compose up -d   # update images
```

---

### The shortest path if you want help

You can do Phases 1–8 yourself with the docs. The two things I can do **for** you right now
without server access are: **(a)** write the Phase 9 Chatwoot patch files, and **(b)** build a
small web admin page for managing products/ad-rules instead of using `curl`. Tell me which
and I'll start.
