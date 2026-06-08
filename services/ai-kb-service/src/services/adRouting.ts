// Resolves an ad-driven conversation to a section (Chatwoot team) using the ad_routing
// table. Exact ad_id matches win; otherwise regex rules on the ad headline / source URL.
import { query } from '../db/pool.js';

export interface AdContext {
  adId?: string | null;
  headline?: string | null;
  sourceUrl?: string | null;
}

export interface RoutingRule {
  id: number;
  match_type: 'ad_id' | 'campaign_regex';
  match_value: string;
  team_id: number;
  section: string | null;
  priority: number;
}

/** Returns the team_id to assign, or null if no rule matches (→ leave in Triage). */
export async function resolveTeam(ad: AdContext): Promise<RoutingRule | null> {
  // 1) Exact ad_id match (highest confidence).
  if (ad.adId) {
    const { rows } = await query<RoutingRule>(
      `SELECT * FROM ad_routing
        WHERE match_type = 'ad_id' AND match_value = $1
        ORDER BY priority ASC LIMIT 1`,
      [ad.adId],
    );
    if (rows[0]) return rows[0];
  }

  // 2) Regex rules against headline / source URL.
  const haystack = [ad.headline, ad.sourceUrl].filter(Boolean).join(' ');
  if (haystack) {
    const { rows } = await query<RoutingRule>(
      `SELECT * FROM ad_routing WHERE match_type = 'campaign_regex' ORDER BY priority ASC`,
    );
    for (const rule of rows) {
      try {
        if (new RegExp(rule.match_value, 'i').test(haystack)) return rule;
      } catch {
        // ignore invalid regex stored by an admin
      }
    }
  }

  return null;
}

export async function listRules(): Promise<RoutingRule[]> {
  const { rows } = await query<RoutingRule>(`SELECT * FROM ad_routing ORDER BY priority ASC, id ASC`);
  return rows;
}

export async function createRule(
  input: Omit<RoutingRule, 'id'>,
): Promise<RoutingRule> {
  const { rows } = await query<RoutingRule>(
    `INSERT INTO ad_routing (match_type, match_value, team_id, section, priority)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.match_type, input.match_value, input.team_id, input.section, input.priority],
  );
  return rows[0]!;
}

export async function deleteRule(id: number): Promise<void> {
  await query(`DELETE FROM ad_routing WHERE id = $1`, [id]);
}
