/**
 * Sanitize a returnTo query-string value before passing it to a client-side
 * navigation. NextAuth's signIn `callbackUrl` enforces same-origin, but our
 * own UI may use router.push(returnTo) directly — that path would be
 * vulnerable to open-redirect (`?returnTo=https://evil.com` or `?returnTo=//evil.com`).
 *
 * Accepts only same-origin paths starting with a single `/`.
 */
export function sanitizeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;     // must be a path
  if (raw.startsWith('//')) return null;     // protocol-relative escapes origin
  if (raw.startsWith('/\\')) return null;    // backslash trick some routers honor
  return raw;
}
