# Chatwoot: native configuration + fork patches

Two kinds of work live here:

- **A. Native configuration** — done in the Chatwoot UI, no code. Covers sections, statuses,
  ownership labelling, canned replies, auto-reply, contact CRM, and reports.
- **B. Fork patches** — code changes to a **forked** Chatwoot (Community Edition, MIT). Two
  features need them: (1) **team-scoped visibility** so an employee only sees their
  section, and (2) **ad-referral capture** so ad messages can auto-route.

> Pin a release before patching: `git clone https://github.com/chatwoot/chatwoot && cd
> chatwoot && git checkout v4.0.0` (match the image tag in `docker-compose.yml`). Keep all
> changes inside the **MIT** tree — **never** edit `enterprise/` (separate commercial
> license). Re-apply/rebase these patches when you bump versions; track upstream issues
> [#5998](https://github.com/chatwoot/chatwoot/issues/5998) (team visibility),
> [#11885](https://github.com/chatwoot/chatwoot/issues/11885) /
> [#11189](https://github.com/chatwoot/chatwoot/issues/11189) (search/filter leaks).

---

## A. Native configuration (no code)

### A1. Sections → Teams
- **Settings → Teams**: create one team per section (Tools, Ceramic, Tile, …) plus a
  **Triage** team for unmatched/direct messages.
- Enable **Auto-assign** on each team so a conversation routed to a team is distributed
  round-robin to its members.
- **Settings → Agents/Collaborators**: add employees; add each to their section's team and
  to the channel inboxes (WhatsApp/IG/FB).

### A2. Roles: Manager vs Employee
- **Managers**: Administrator role (see all sections + reports).
- **Employees**: Agent role. Native Agent role still sees all conversations in their
  inboxes — the **team-scoped visibility patch (B1)** is what restricts them to their
  section. Until that patch is live, employees will see cross-section conversations.

### A3. Sales statuses
Chatwoot conversation status (open/pending/snoozed/resolved) is the workflow state. Layer a
**sales pipeline** on top with a conversation **custom attribute** `sales_stage`:
- **Settings → Custom Attributes → Conversation**: add `sales_stage`
  (list: `new, contacted, quoted, negotiating, won, lost`).
- Agents set it from the conversation sidebar; it powers close-rate reports.

### A4. Ownership labelling ("followed up by X")
- The conversation **assignee** is the owner. Add an **Automation rule**:
  - Event: *Conversation updated* (or *Message created*),
  - Condition: *Message type is outgoing* AND *Assignee is none*,
  - Action: *Assign agent → (the agent who sent)* — Chatwoot's "assign to me on reply"
    behavior; alternatively enable **Settings → Inbox → Auto assignment** so replying
    self-assigns. Confirm the assignee shows on the conversation.

### A5. Canned responses & auto-reply
- **Settings → Canned Responses**: per-section quick replies (e.g. `/price`, `/hours`).
- **Auto-reply greeting**: Inbox settings → enable a greeting message, or an Automation
  rule (Event: *Conversation created* → Action: *Send message*). Mind the 24h window.

### A6. Contact CRM (customer history)
- Native: each **Contact** shows profile, previous conversations, and notes — this is the
  "have they contacted us before / what happened" view.
- Add contact **custom attributes** (e.g. `last_purchase`, `preferred_section`,
  `lifetime_value`) under **Settings → Custom Attributes → Contact**.
- Merge duplicate contacts (same person on WhatsApp vs IG) via the contact **Merge** action.

### A7. Reports (metrics)
- **Reports → Overview** (whole showroom), **→ Agent** (per employee), **→ Team** (per
  section), **→ Label**. Filter close rate using `sales_stage = won` vs total.
- For ad-ROI and richer cuts, see optional Metabase in the plan (reads the same Postgres).

---

## B. Fork patches (code)

### B1. Team-scoped conversation visibility  *(the critical patch)*

**Goal:** a non-admin agent sees only conversations whose assigned **team** is one of their
teams (plus conversations assigned directly to them). Applies to the list, **search**,
**filters**, counts, and **reports** — every read path.

**Where (verify exact paths against your pinned tag):**

1. `app/finders/conversation_finder.rb` — the main list/filter query. Add a team scope for
   non-admin users:

   ```ruby
   # inside ConversationFinder, after building the base scope
   def set_team_scope
     return if @user.administrator?            # managers see everything
     team_ids = @user.teams.pluck(:id)
     @conversations = @conversations.where(team_id: team_ids)
                                    .or(@conversations.where(assignee_id: @user.id))
   end
   ```
   Call `set_team_scope` in the finder's `perform`/`find_all_conversations` path **before**
   pagination and **before** counts.

2. `app/finders/conversation_finder.rb` filter branch + **search**
   (`app/controllers/api/v1/accounts/conversations_controller.rb#search`,
   `Conversations::SearchService` if present) — apply the **same** team scope so the search
   bar and saved filters cannot leak other sections (fixes the #11885/#11189 class of bug).

3. `app/policies/conversation_policy.rb` — per-record authorization (show/update/assign):

   ```ruby
   def show?
     return true if @account_user.administrator?
     @record.assignee_id == @user.id ||
       @user.team_ids.include?(@record.team_id)
   end
   ```
   Mirror in `update?`, `toggle_status?`, `assign?`, etc.

4. **Reports**: report builders (`app/builders/v2/report_builders/*`,
   `app/services/reports/*`) must restrict an employee's numbers to their teams. Managers
   unaffected. (Employees may not even need report access — hide the Reports nav for the
   Agent role on the frontend.)

5. **Frontend** (`app/javascript/dashboard/`): ensure the conversation list store and any
   client-side filtering reflect the server scope; hide cross-team UI affordances for
   agents. The server scope is the source of truth — frontend is cosmetic.

**Tests:** add request specs proving an Agent in team *Tools* gets 403/empty for a
*Ceramic* conversation via show, list, **search**, and filter endpoints.

### B2. Ad-referral capture → conversation attributes

**Goal:** persist the Meta ad referral on the conversation so automation (or the AI service)
can route ad messages to the right section.

**Where (verify per tag):** the inbound message services per channel —
`app/services/whatsapp/incoming_message_*service.rb`,
`app/services/facebook/...`, `app/services/instagram/...`. When building/finding the
conversation, read the referral from the incoming payload and store it in
`conversation.additional_attributes`:

```ruby
# WhatsApp: payload[:referral] => { source_id, headline, body, ctwa_clid, source_url, ... }
# Messenger/IG: referral.ad_id / ads_context_data
ref = incoming_referral_hash # extract per channel
if ref.present?
  conversation.additional_attributes ||= {}
  conversation.additional_attributes.merge!(
    'is_from_ad'  => true,
    'ad_id'       => ref[:source_id] || ref[:ad_id],
    'ad_headline' => ref[:headline],
    'ctwa_clid'   => ref[:ctwa_clid],
    'ad_source_url' => ref[:source_url]
  )
  conversation.save!
end
```

Notes:
- Set these **only on conversation creation** (first message), not on every message.
- Once stored, routing can be done **either** by a Chatwoot **automation rule** matching the
  `ad_id` custom attribute, **or** by the AI service webhook (B3 below). The AI service
  approach is more flexible (regex on campaign names, central mapping table) — recommended.

### B3. Auto-assign to section (driven by the AI service)

Preferred over a static automation rule because the ad→section map changes as new ads
launch. Flow:

1. Configure a Chatwoot **webhook** (Settings → Integrations → Webhooks) or an **Agent Bot**
   pointed at `https://$PUBLIC_HOSTNAME/ai/webhooks/chatwoot`, subscribed to
   `conversation_created` and `message_created`.
2. On `conversation_created`, the AI service reads `additional_attributes.ad_id`
   (from B2), resolves the section via its **ad-routing table** (`/ai/admin/ad-routing`),
   and calls the Chatwoot API to assign the conversation's **team**. No match → leave in
   **Triage** for the manager.

If you'd rather keep routing inside Chatwoot, create an Automation rule instead:
- Event *Conversation Created* → Condition `ad_id` *is present* and equals a known id →
  Action *Assign Team → Ceramic*. (One rule per ad/section; higher maintenance.)

---

## Build & deploy the fork

1. Point `docker-compose.yml` `chatwoot` + `chatwoot-sidekiq` at `build: ./chatwoot`
   (the fork) instead of the prebuilt image.
2. `docker compose build chatwoot && docker compose up -d`.
3. Run migrations if any were added: `docker compose run --rm chatwoot bundle exec rails db:migrate`.
