// Orchestrates an AI draft for a conversation: pull history + customer context from
// Chatwoot, retrieve product knowledge, ask Claude, and post the result as a private note.
import {
  getConversation,
  getMessages,
  postPrivateNote,
  type CwMessage,
} from '../clients/chatwoot.js';
import { draftReply } from '../clients/claude.js';
import { searchProducts, renderProductContext } from './rag.js';

function toHistory(messages: CwMessage[]) {
  return messages
    .filter((m) => !m.private && m.content && m.message_type <= 1) // skip notes/activity/templates
    .map((m) => ({
      role: m.message_type === 0 ? ('user' as const) : ('assistant' as const),
      content: m.content as string,
    }));
}

/** The latest customer (incoming) message text, used as the retrieval query. */
function latestCustomerText(messages: CwMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.message_type === 0 && m.content) return m.content;
  }
  return '';
}

export interface DraftResult {
  draft: string;
  productsUsed: number;
}

/**
 * Generate a draft and (optionally) post it as a private note on the conversation.
 * `section` may come from the conversation's assigned team; if absent, search is unscoped.
 */
export async function generateDraft(
  conversationId: number,
  opts: { section?: string; post?: boolean; customerContext?: string } = {},
): Promise<DraftResult> {
  const [conversation, messages] = await Promise.all([
    getConversation(conversationId),
    getMessages(conversationId),
  ]);

  const history = toHistory(messages);
  if (history.length === 0) return { draft: '', productsUsed: 0 };

  const queryText = latestCustomerText(messages) || history.at(-1)!.content;
  const hits = await searchProducts(queryText, { section: opts.section, limit: 5 });

  const customerName = conversation.meta?.sender?.name ?? '';
  const customerContext =
    opts.customerContext ?? (customerName ? `Name: ${customerName}.` : '');

  const draft = await draftReply({
    history,
    productContext: renderProductContext(hits),
    customerContext,
    section: opts.section ?? 'showroom',
  });

  if (opts.post && draft) {
    await postPrivateNote(conversationId, `🤖 Suggested reply:\n\n${draft}`);
  }

  return { draft, productsUsed: hits.length };
}
