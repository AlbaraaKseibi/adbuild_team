// Thin Chatwoot Application API client: read conversations, post draft private notes,
// and assign teams. Docs: https://www.chatwoot.com/developers/api/
import { config } from '../config.js';

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
  private: boolean;
  sender?: { type?: string; name?: string };
}

export interface CwConversation {
  id: number;
  meta?: { sender?: { id: number; name?: string } };
  additional_attributes?: Record<string, unknown>;
  custom_attributes?: Record<string, unknown>;
}

export async function getConversation(conversationId: number): Promise<CwConversation> {
  return cw<CwConversation>(`/conversations/${conversationId}`);
}

export async function getMessages(conversationId: number): Promise<CwMessage[]> {
  const data = await cw<{ payload: CwMessage[] }>(`/conversations/${conversationId}/messages`);
  return data.payload ?? [];
}

/** Post an internal note (never shown to the customer) — used for AI draft suggestions. */
export async function postPrivateNote(conversationId: number, content: string): Promise<void> {
  await cw(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, private: true, message_type: 'outgoing' }),
  });
}

/** Assign a conversation to a team (section) for ad-driven auto-routing. */
export async function assignTeam(conversationId: number, teamId: number): Promise<void> {
  await cw(`/conversations/${conversationId}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ team_id: teamId }),
  });
}

/** Fetch a contact's prior conversations to summarise customer history. */
export async function getContactConversations(contactId: number): Promise<unknown[]> {
  const data = await cw<{ payload: unknown[] }>(`/contacts/${contactId}/conversations`);
  return data.payload ?? [];
}
