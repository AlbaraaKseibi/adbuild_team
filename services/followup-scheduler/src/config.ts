import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  CHATWOOT_BASE_URL: z.string().url(),
  CHATWOOT_API_ACCESS_TOKEN: z.string().min(1),
  CHATWOOT_ACCOUNT_ID: z.coerce.number(),

  // A conversation with no new message for this many hours becomes a follow-up candidate.
  FOLLOWUP_IDLE_HOURS: z.coerce.number().default(24),
  // Cron expression for the sweep (default every 30 minutes).
  FOLLOWUP_CRON: z.string().default('*/30 * * * *'),
  // Only follow up conversations in these Chatwoot statuses.
  FOLLOWUP_STATUSES: z.string().default('open,pending'),
  // Run a sweep immediately on boot (useful for testing).
  FOLLOWUP_RUN_ON_BOOT: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  statuses: parsed.data.FOLLOWUP_STATUSES.split(',').map((s) => s.trim()).filter(Boolean),
};
