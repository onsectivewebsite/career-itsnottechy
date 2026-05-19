export function ipFromRequestHeaders(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')?.trim()
      ?? '0.0.0.0';
}

/** For server actions — uses next/headers. Imported only from server contexts. */
export async function ipFromServerActionHeaders(): Promise<string> {
  const { headers } = await import('next/headers');
  const h = headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? h.get('x-real-ip')?.trim()
      ?? '0.0.0.0';
}
