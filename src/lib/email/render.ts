import fs from 'node:fs';
import path from 'node:path';
export { escapeHtml, interpolate } from './interpolate';
import { interpolate } from './interpolate';

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
