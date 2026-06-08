// Follow-up content. Within the WhatsApp 24h window we can send free text; outside it we
// MUST use an approved template. Keep template names in sync with WhatsApp Manager
// (see docs/meta-setup.md). These are sensible defaults — tailor per section/language.

export const MAX_FOLLOWUPS = 2;

// Free-form nudge used inside the 24h window (bilingual).
export function freeFormFollowup(): string {
  return [
    'مرحباً 👋 هل ما زلت مهتماً؟ يسعدنا مساعدتك بأي استفسار عن المنتجات أو الأسعار.',
    '',
    "Hi 👋 are you still interested? We're happy to help with any product or pricing questions.",
  ].join('\n');
}

// Approved-template payload used outside the 24h window. The `name` and parameter layout
// MUST match a template approved in WhatsApp Manager. Replace with your real template.
export function templateFollowup(): Record<string, unknown> {
  return {
    name: 'followup_default', // <-- your approved template name
    language: 'ar',
    // Example body parameters; align with your template's variables.
    processed_params: { 1: 'عميلنا العزيز' },
  };
}
