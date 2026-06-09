# What to do now — step by step (Basics, on Railway)

This is the **basics-only** path to a working system: Chatwoot deployed on Railway, all
three Meta channels connected, sections + employees set up, manager triages messages, each
employee sees only the conversations assigned to them. **No custom code, no patches, no AI
in this phase.** You can be answering real customers in a day or two of clock time.

> **What basics gives you (and what it doesn't):**
> ✅ All WhatsApp + IG + FB messages in one inbox.
> ✅ Manager assigns each conversation to a specific employee (in their section).
> ✅ Each employee sees only their own assigned conversations.
> ✅ Conversation status, sales pipeline stage, customer history, canned replies, auto-reply
>    greeting, per-employee + per-section + showroom reports.
> ❌ Employees can't see their teammates' conversations in the same section (needs patch B1).
> ❌ Ad messages don't auto-route to a section — manager assigns them manually (needs patch B2).
> ❌ No AI-suggested drafts, no product knowledge base, no auto follow-ups.
> Those land in the **"Upgrades" section at the bottom**, when you're ready.

> **Time note:** Step 1.2 (Meta Business Verification) can take **1–3 days**. **Start it
> first**, then do everything else while you wait.

---

## Phase 1 — Accounts & secrets (start today)

- [ ] **1.1 Sign up for [Railway](https://railway.app)** and add a payment method
  (~$5–20/month for the Chatwoot stack).
- [ ] **1.2 Meta Business setup** — start this first, it takes the longest:
  - **Meta Business Manager** account with **Business Verification** submitted.
  - A **Meta App** of type **Business** at <https://developers.facebook.com/>, with
    **WhatsApp**, **Messenger**, and **Instagram** products added.
  - A **Facebook Page** for the showroom; an **Instagram Professional** account linked to it.
  - Decide **which WhatsApp number** you'll move to the Cloud API. ⚠️ Once moved it leaves
    the WhatsApp Business *phone app*.
- [ ] **1.3 Create a GitHub account** if you don't have one.

**Pre-generate two secrets** (PowerShell):
```powershell
# 128-hex SECRET_KEY_BASE for Chatwoot:
-join ((1..128) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
# Long random Postgres password (only if you want to override the managed one):
-join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

✅ **Done when:** Meta Business Verification is *submitted* and you've saved the
`SECRET_KEY_BASE` somewhere safe.

---

## Phase 2 — Push the project to GitHub

In PowerShell, inside `d:\marketing-system`:

```powershell
git init
git add .
git commit -m "Initial scaffold"
```

Create an **empty private repo** on GitHub called `marketing-system`, then:

```powershell
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/marketing-system.git
git branch -M main
git push -u origin main
```

(You won't actually deploy any of the code from this repo in the basics phase — we're using
Chatwoot's prebuilt image. The repo is here so the upgrades later are a one-click switch.)

✅ **Done when:** the code is visible at `https://github.com/YOUR_GITHUB_USERNAME/marketing-system`.

---

## Phase 3 — Create the Railway project & 4 services

In Railway, **New Project → Empty Project**. Inside that one project, add the services
**in this order**. Wait for each to finish deploying before moving on.

### 3.1  Postgres (managed)
- **+ New → Database → Add PostgreSQL**.
- Railway exposes a `DATABASE_URL` and `PG*` variables you'll reference below.

### 3.2  Redis (managed)
- **+ New → Database → Add Redis**.

### 3.3  Chatwoot Web
- **+ New → Empty Service** → **Settings → Source → Image** = `chatwoot/chatwoot:v4.0.0`.
- **Settings → Deploy → Start Command** (overrides the image CMD):
  ```
  bundle exec rails db:chatwoot_prepare && bundle exec rails s -p $PORT -b 0.0.0.0
  ```
- **Settings → Networking → Generate Domain** (gives you `https://chatwoot-production-xxxx.up.railway.app`).
- **Variables** (use the **Reference** picker for the `${{...}}` ones — don't paste raw URLs):
  ```
  SECRET_KEY_BASE     = <your 128-hex value>
  RAILS_ENV           = production
  NODE_ENV            = production
  RAILS_LOG_TO_STDOUT = true
  DEFAULT_LOCALE      = ar
  FRONTEND_URL        = https://<paste this service's generated domain>
  POSTGRES_HOST       = ${{Postgres.PGHOST}}
  POSTGRES_PORT       = ${{Postgres.PGPORT}}
  POSTGRES_USERNAME   = ${{Postgres.PGUSER}}
  POSTGRES_PASSWORD   = ${{Postgres.PGPASSWORD}}
  POSTGRES_DATABASE   = ${{Postgres.PGDATABASE}}
  REDIS_URL           = ${{Redis.REDIS_URL}}
  # Optional SMTP (for agent invites / password resets):
  MAILER_SENDER_EMAIL = showroom <noreply@example.com>
  SMTP_ADDRESS        =
  SMTP_PORT           = 587
  SMTP_USERNAME       =
  SMTP_PASSWORD       =
  ```
- Rename the service `chatwoot-web`.
- ✅ **It worked when:** deploy logs end with `Listening on http://0.0.0.0:PORT`, and the
  generated HTTPS domain shows the Chatwoot "Create new account" page.

### 3.4  Chatwoot Sidekiq (background jobs)
- **+ New → Empty Service** → **Image** = `chatwoot/chatwoot:v4.0.0`.
- **Start Command**: `bundle exec sidekiq -C config/sidekiq.yml`
- **No public domain** (workers don't need one).
- **Variables**: same block as `chatwoot-web` (right-click `chatwoot-web` → Copy
  Variables). You can omit `FRONTEND_URL` — not needed for Sidekiq.
- Rename `chatwoot-sidekiq`.
- ✅ **It worked when:** logs show `Sidekiq … started`.

> **All 4 services should now be Active.** If a service crashes, check its **Deploy Logs**
> tab — almost always a missing/wrong env var.

---

## Phase 4 — Create your Chatwoot admin

- [ ] **4.1** Open the `chatwoot-web` generated domain → fill in **Create new account** →
  this first user is your **Administrator** (the manager).
- [ ] **4.2** Click your avatar → **Profile Settings → My Profile** → set the language to
  **Arabic** if you want the dashboard in Arabic (RTL).

✅ **Done when:** you can log in to Chatwoot at the public HTTPS URL.

---

## Phase 5 — Connect WhatsApp, Facebook, Instagram

Follow **[docs/meta-setup.md](docs/meta-setup.md)** precisely (it has the exact fields).
Wherever it says *"Chatwoot's callback URL"*, that URL is on your **chatwoot-web** Railway
domain.

- [ ] **5.1 WhatsApp Cloud:** add the inbox in Chatwoot, paste the callback URL + verify
  token back into Meta App → WhatsApp → Configuration → Webhook → subscribe to `messages`.
- [ ] **5.2 Facebook:** Chatwoot → Add Inbox → Facebook → log in, pick the Page.
- [ ] **5.3 Instagram:** Chatwoot → Add Inbox → Instagram → authorize, pick the account.

✅ **Done when:** a test message to each of the three channels appears in Chatwoot, and your
reply from Chatwoot lands on the test phone natively.

---

## Phase 6 — Set up sections, employees, and the workflow

This is all in Chatwoot's UI. **No code.**

### 6.1  Sections → Teams
- **Settings → Teams → Add Team:** create one team per section (`Tools`, `Ceramic`, `Tile`,
  …) plus a **Triage** team you'll use for the unsorted incoming pool.
- Enable **Auto-assignment** on each section team (so once you assign a conversation to a
  team, Chatwoot round-robins it to one of that team's members).

### 6.2  Employees → Agents (with "Mine only" access)
- **Settings → Agents → Add Agent** for each employee. Role = **Agent**.
- For each employee, **Settings → Inboxes → (each inbox) → Collaborators**: add them as a
  collaborator on every channel inbox (WhatsApp/IG/FB). Set their access level to
  **"Conversations assigned to me only"** (the dropdown next to their name).
- Add each employee to their **section's Team** (Settings → Teams → … → Members).

> 🔑 **This is what makes basics work without the patch:** because each employee's access
> is **"assigned to me only,"** they don't see other conversations even though all WhatsApp
> messages land in one shared inbox. The trade-off is they also don't see their teammates'
> assignments. Acceptable for v1.

### 6.3  Sales pipeline stage
- **Settings → Custom Attributes → Conversation → Add:**
  - Name: `sales_stage`, Type: **List**, options:
    `new, contacted, quoted, negotiating, won, lost`.
- It now shows in the right-side panel of every conversation; agents change it as the deal
  progresses. Your win-rate report is `won` ÷ all closed.

### 6.4  Ownership on reply
- **Settings → Inboxes → (each inbox) → Configuration → Auto assignment:** turn ON. When an
  unassigned message gets a team assigned, Chatwoot picks an available member; the assignee
  is shown on every conversation as "followed up by X."

### 6.5  Auto-reply greeting & canned responses
- **Settings → Inboxes → (each inbox) → Configuration → Greeting message:** turn ON and
  write your bilingual greeting.
- **Settings → Canned Responses → Add:** one per section (e.g. `/price-ceramic`,
  `/hours`, `/visit`). Agents type the shortcut and Chatwoot expands it.

### 6.6  The triage workflow you (the manager) will use
1. New customer message arrives in Chatwoot (you can see all of them as Administrator).
2. You read it, **assign the conversation to the section's team** — Chatwoot auto-assigns
   to an available employee in that team.
3. The employee gets the conversation in their "Mine" view and handles it.
4. They update the `sales_stage` as the deal progresses, label, etc.

> **Optional automation rule for ads now (no patch needed):** if you're disciplined about
> naming Meta campaigns (e.g. always include the section name in the campaign name), you
> can sometimes match on the message body or referral text via a Chatwoot **Automation
> Rule** — *Event: Conversation Created → Condition: Content contains "ceramic" → Action:
> Assign team Ceramic*. It's hit-or-miss for ads (Meta's ad metadata isn't on the
> conversation until patch B2 lands), but it's free to try.

✅ **Done when:** you assign a test conversation to Ceramic, the Ceramic employee sees it in
their "Mine" view, they reply (customer gets it on WhatsApp/IG/FB), they set
`sales_stage = won`, and the conversation shows them as assignee.

---

## Phase 7 — Verify

- [ ] Send test messages from a real phone to each of the three channels → all three appear
      in Chatwoot.
- [ ] Reply from Chatwoot in Arabic → customer receives it natively in their app.
- [ ] As manager, assign a conversation to a section team → the employee sees it in **Mine**,
      another section's employee does **not**.
- [ ] Walk a conversation through `new → contacted → quoted → won`.
- [ ] Open **Reports → Overview / Agent / Team / Label** and confirm numbers populate.

When all six tick: **the showroom can go live on this system.**

---

## Daily Railway ops

- **Read logs:** Railway → service → **Deployments → View Logs**.
- **Restart a service:** Railway → service → **⋯ → Restart**.
- **Update Chatwoot version:** change the image tag in `chatwoot-web` and `chatwoot-sidekiq`
  to a newer release, **Deploy**. (Read Chatwoot's release notes first.)
- **Cost:** Chatwoot Web + Sidekiq dominate RAM. Tune **Settings → Memory Limit** if needed.

---

## Upgrades (when you're ready — pick any, in any order)

Each is independent. None requires throwing away your basics setup.

### 🅐  Section-shared visibility (Chatwoot fork patch **B1**)
**What you get:** an employee sees **every** conversation in their section (teammates'
included), not just their own — useful so people can cover each other. See
[docs/chatwoot-customizations.md](docs/chatwoot-customizations.md) → "B1".

### 🅑  Ad → section auto-routing (Chatwoot fork patch **B2** + Chatwoot automation rule)
**What you get:** Click-to-WhatsApp / Click-to-Messenger / Instagram-ads messages
automatically land in the right section. Manager only triages direct (non-ad) messages.
See [docs/chatwoot-customizations.md](docs/chatwoot-customizations.md) → "B2".

### 🅒  AI-drafted replies + product knowledge base + Copilot sidebar
**What you get:** Claude reads the conversation + your product catalog and drops a draft
reply into the conversation as a private note; the employee reviews/edits/sends. Plus an
in-chat product lookup sidebar. The whole service is scaffolded in
[services/ai-kb-service/](services/ai-kb-service/) — add it as two more Railway services
(a custom `pgvector/pgvector:pg16` for embeddings + `ai-kb-service` from this repo) and add
the Anthropic + Voyage API keys.

### 🅓  Auto follow-ups for silent customers
**What you get:** if you replied and the customer went quiet for >24h, the system sends a
nudge (free text inside the WhatsApp 24h window, an approved template after). Scaffolded in
[services/followup-scheduler/](services/followup-scheduler/) — add it as one Railway
service.

---

### What I can do for you right now

You drive Phases 1–7 yourself with this runbook + the docs. Without server access, the
useful thing I can do is **write the actual Chatwoot fork patch files (B1 + B2) so when you
want upgrade 🅐 or 🅑 it's just a `git push` away**. Want me to start that?
