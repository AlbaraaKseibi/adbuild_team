# followup-scheduler

Sends automatic follow-ups to conversations that have gone quiet, so leads don't slip.

## What it does

On a cron schedule (`FOLLOWUP_CRON`, default every 30 min) it scans Chatwoot conversations
in the configured statuses and, for each one where **we replied last and the customer has
been silent** longer than `FOLLOWUP_IDLE_HOURS`:

- Sends a **free-form** bilingual nudge if within the **WhatsApp 24-hour window**.
- Sends an **approved template** if the window has closed (required by WhatsApp).
- Caps follow-ups per conversation (`MAX_FOLLOWUPS`, default 2) and records
  `followup_count` / `last_followup_at` as conversation custom attributes so it never spams.

Conversations where the **customer** messaged last are skipped — those need a human reply,
not an automated nudge.

## Run (dev)

```bash
cp .env.example .env   # fill in Chatwoot token
npm install
npm run dev
```

## Before production

- Approve a real WhatsApp follow-up **template** in WhatsApp Manager and update
  `src/templates.ts` (`templateFollowup()` name + params) to match it exactly.
- Tune `freeFormFollowup()` copy per section/language if desired.
- Consider per-section idle thresholds and follow-up sequences (currently one global rule).
