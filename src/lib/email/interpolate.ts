/** Pure string helpers — no Node.js built-ins, safe to import in client components. */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function interpolate(template: string, vars: Record<string, string>): string {
  // {{{x}}} is raw, {{x}} is escaped. Process triple-brace first.
  return template
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, k: string) => vars[k] ?? '')
    .replace(/\{\{(\w+)\}\}/g, (_, k: string) => escapeHtml(vars[k] ?? ''));
}
