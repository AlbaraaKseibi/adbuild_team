# Meta channel setup (WhatsApp Cloud API · Instagram · Facebook)

This connects your three sales channels to Chatwoot using the **official Meta APIs**. Do
this once, in order. You need a **verified Meta Business account** and a publicly reachable
HTTPS hostname (Caddy provides this — see `Caddyfile` / `PUBLIC_HOSTNAME`).

> ⚠️ **One-way door:** moving your number to the WhatsApp Cloud API removes it from the
> WhatsApp Business *phone app*. Decide which number to migrate before you start. If staff
> still need a phone app for something else, use a different number there.

---

## 0. Prerequisites

- [ ] Meta Business Manager account, **Business Verification** completed.
- [ ] A [Meta App](https://developers.facebook.com/) (type: *Business*) with **WhatsApp**,
      **Messenger**, and **Instagram** products added.
- [ ] A **Facebook Page** for the showroom.
- [ ] An **Instagram Professional/Business** account, **linked to that Facebook Page**.
- [ ] The stack running with a real domain + TLS (`docker compose up -d caddy chatwoot ...`).
- [ ] Chatwoot reachable at `https://$PUBLIC_HOSTNAME` and an admin account created.

---

## 1. WhatsApp Cloud API

1. In the Meta App → **WhatsApp → API Setup**: add/verify your **phone number**, note the
   **Phone Number ID** and **WhatsApp Business Account (WABA) ID**.
2. Create a **permanent System User access token** (Business Settings → Users → System
   Users) with `whatsapp_business_messaging` + `whatsapp_business_management` scopes.
3. In Chatwoot: **Inboxes → Add Inbox → WhatsApp → WhatsApp Cloud**. Enter:
   - Phone number, Phone Number ID, WABA ID, the System User token,
   - a **Webhook Verify Token** (any string you choose — you'll paste it into Meta).
4. Back in Meta App → **WhatsApp → Configuration → Webhook**: set the **Callback URL** to
   the value Chatwoot shows for this inbox (e.g.
   `https://$PUBLIC_HOSTNAME/webhooks/whatsapp/<PHONE_NUMBER>`), paste the same Verify
   Token, and **subscribe to the `messages` field**.
5. Send a test message to the number → it should appear in the Chatwoot inbox. Reply from
   Chatwoot → it should arrive on the customer's WhatsApp.

### Message templates (required for proactive / >24h messages)
- Free-form replies are allowed only within **24h** of the customer's last message.
- Create templates in **WhatsApp Manager → Message Templates** (e.g. a follow-up template
  per language). The follow-up scheduler references these by name — keep
  `services/followup-scheduler` template names in sync once approved.

### Click-to-WhatsApp ad attribution
Inbound messages from Click-to-WhatsApp ads include a `referral` object
(`source_id` = **ad id**, `headline`, `body`, `ctwa_clid`, `source_url`). Chatwoot does not
surface this by default — the fork patch in `docs/chatwoot-customizations.md` stores it on
the conversation so we can auto-route to the right section.

---

## 2. Facebook Messenger

1. Meta App → **Messenger → Settings**: connect the **Facebook Page** and generate a
   **Page Access Token**.
2. In Chatwoot: **Inboxes → Add Inbox → Facebook** → log in and pick the Page. Chatwoot
   wires up the Messenger webhook subscription automatically (`messages`,
   `messaging_postbacks`, `message_echoes`, `messaging_referrals`).
3. Send a test message to the Page → confirm it appears and you can reply.

### Ad attribution (Messenger)
Click-to-Messenger ads deliver a `referral` / `messaging_referrals` event and inbound
messages carry `referral.ad_id` (plus `ads_context_data`). Captured by the same fork patch.

---

## 3. Instagram

1. Ensure the IG **Professional** account is **linked to the Facebook Page** above.
2. Meta App → **Instagram → API setup with Instagram login** (or via the Page) and grant
   `instagram_manage_messages`.
3. In Chatwoot: **Inboxes → Add Inbox → Instagram** → authorize → select the account.
   Confirm DM webhook subscription.
4. Send a test DM → confirm it appears and you can reply.

### Ad attribution (Instagram)
Inbound DMs originating from ads include a `referral` object with `ad_id`. Captured by the
same fork patch.

---

## 4. After all three inboxes work

- Create **Teams** = sections (Tools, Ceramic, Tile, …) and a **Triage** team for
  unmatched/direct messages.
- Add employees as **agents** and assign each to their section's Team.
- Configure the **ad → section mapping** in the AI service (`/ai/admin/ad-routing`) and the
  Chatwoot **automation rules** — see `docs/chatwoot-customizations.md`.
- Create a Chatwoot **Access Token** (Profile → Access Token) for the AI + scheduler
  services and put it in `.env` (`CHATWOOT_API_ACCESS_TOKEN`), then restart those services.

---

## Reference

- WhatsApp Cloud API webhooks (referral fields): Meta for Developers → *Business Messaging
  → WhatsApp → Webhooks → messages reference*.
- Messenger Platform → *Webhooks → messaging_referrals*.
- Instagram Messaging → *Webhooks*.
- Chatwoot channel docs: <https://www.chatwoot.com/docs/product/channels/>
