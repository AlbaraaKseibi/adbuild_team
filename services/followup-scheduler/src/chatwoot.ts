// Minimal Chatwoot client for the scheduler: list conversations, read messages, send a
// free-form text or an approved WhatsApp template, and stamp custom attributes.
import { config } from './config.js';

const base = `${config.CHATWOOT_BASE_URL}/api/v1/accounts/${config.CHATWOOT_ACCOUNT_ID}`;

async function cw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      api_access_token: config.CHATWOOT_API_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Chatwoot ${init.method ?? 'GET'} ${path} -> ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export interface CwMessage {
  id: number;
  content: string | null;
  message_type: number; // 0 incoming, 1 outgoing, 2 activity, 3 template
  created_at: number; // unix seconds
  private: boolean;
}

export interface CwConversation {
  id: number;
  status: string;
  last_activity_at?: number;
  custom_attributes?: Record<string, unknown>;
  additional_attributes?: Record<string, unknown>;
  messages?: CwMessage[];
}

/** List conversations in a given status (paginated). */
export async function listConversations(status: string, page = 1): Promise<CwConversation[]> {
  const data = await cw<{ data: { payload: CwConversation[] } }>(
    `/conversations?status=${encodeURIComponent(status)}&page=${page}`,
  );
  return data.data?.payload ?? [];
}

export async function getMessages(conversationId: number): Promise<CwMessage[]> {
  const data = await cw<{ payload: CwMessage[] }>(`/conversations/${conversationId}/messages`);
  return data.payload ?? [];
}

export async function sendText(conversationId: number, content: string): Promise<void> {
  await cw(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, message_type: 'outgoing' }),
  });
}

/**
 * Send an approved WhatsApp template (required when the 24h window has closed).
 * `templateParams` shape follows Chatwoot's WhatsApp template message API.
 * Templates must be pre-approved in WhatsApp Manager (see docs/meta-setup.md).
 */
export async function sendTemplate(
  conversationId: number,
  templateParams: Record<string, unknown>,
): Promise<void> {
  await cw(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      message_type: 'outgoing',
      content_type: 'template',
      content_attributes: { template_params: templateParams },
    }),
  });
}

export async function stampAttribute(
  conversationId: number,
  key: string,
  value: unknown,
): Promise<void> {
  await cw(`/conversations/${conversationId}/custom_attributes`, {
    method: 'POST',
    body: JSON.stringify({ custom_attributes: { [key]: value } }),
  });
}
