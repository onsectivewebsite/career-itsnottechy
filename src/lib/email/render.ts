import fs from 'node:fs';
import path from 'node:path';

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

let cachedLayout: string | null = null;

function loadLayout(): string {
  if (cachedLayout !== null) return cachedLayout;
  const p = path.resolve(process.cwd(), 'src/emails/layouts/base.html');
  cachedLayout = fs.readFileSync(p, 'utf8');
  return cachedLayout;
}

export function wrapInLayout(innerHtml: string, vars: Record<string, string> = {}): string {
  const withBody = loadLayout().replace('{{{body}}}', innerHtml);
  return interpolate(withBody, vars);
}
