// One sweep: find conversations idle past the threshold where we're waiting on the
// customer, and send a follow-up — free text inside the WhatsApp 24h window, an approved
// template outside it. Caps follow-ups per conversation and records what it sent.
import { config } from './config.js';
import {
  listConversations,
  getMessages,
  sendText,
  sendTemplate,
  stampAttribute,
  type CwConversation,
  type CwMessage,
} from './chatwoot.js';
import { MAX_FOLLOWUPS, freeFormFollowup, templateFollowup } from './templates.js';

const HOUR_MS = 3600 * 1000;

function realMessages(messages: CwMessage[]): CwMessage[] {
  return messages.filter((m) => !m.private && m.message_type <= 1 && m.content);
}

function lastOf(messages: CwMessage[], type?: number): CwMessage | undefined {
  const pool = type === undefined ? messages : messages.filter((m) => m.message_type === type);
  return pool.sort((a, b) => b.created_at - a.created_at)[0];
}

async function processConversation(conv: CwConversation): Promise<'sent' | 'skipped'> {
  const messages = realMessages(await getMessages(conv.id));
  if (messages.length === 0) return 'skipped';

  const last = lastOf(messages)!;
  const lastCustomer = lastOf(messages, 0); // incoming
  const now = Date.now();

  // Only nudge when WE replied last (customer went quiet). If the customer messaged last,
  // it's a pending reply for an agent — not an auto follow-up.
  if (last.message_type !== 1) return 'skipped';

  const idleMs = now - last.created_at * 1000;
  if (idleMs < config.FOLLOWUP_IDLE_HOURS * HOUR_MS) return 'skipped';

  // Respect the per-conversation cap and avoid re-sending for the same idle period.
  const attrs = conv.custom_attributes ?? {};
  const count = Number(attrs.followup_count ?? 0);
  if (count >= MAX_FOLLOWUPS) return 'skipped';
  const lastFollowupAt = Number(attrs.last_followup_at ?? 0);
  if (lastFollowupAt && lastFollowupAt >= last.created_at) return 'skipped'; // already nudged since last reply

  // WhatsApp window: free text within 24h of the customer's last inbound, else template.
  const hoursSinceCustomer = lastCustomer
    ? (now - lastCustomer.created_at * 1000) / HOUR_MS
    : Infinity;

  if (hoursSinceCustomer <= 24) {
    await sendText(conv.id, freeFormFollowup());
  } else {
    await sendTemplate(conv.id, templateFollowup());
  }

  await stampAttribute(conv.id, 'followup_count', count + 1);
  await stampAttribute(conv.id, 'last_followup_at', Math.floor(now / 1000));
  return 'sent';
}

export async function runSweep(log: (msg: string) => void = console.log): Promise<void> {
  let sent = 0;
  let scanned = 0;
  for (const status of config.statuses) {
    // Page through until an empty page (defensive cap to avoid runaway loops).
    for (let page = 1; page <= 50; page++) {
      const convs = await listConversations(status, page);
      if (convs.length === 0) break;
      for (const conv of convs) {
        scanned++;
        try {
          if ((await processConversation(conv)) === 'sent') sent++;
        } catch (err) {
          log(`[followup] conversation ${conv.id} failed: ${(err as Error).message}`);
        }
      }
    }
  }
  log(`[followup] sweep done — scanned ${scanned}, sent ${sent}`);
}
