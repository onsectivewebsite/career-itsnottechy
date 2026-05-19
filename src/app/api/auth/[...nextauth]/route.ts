import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { ipFromRequestHeaders } from '@/lib/security/clientIp';

const nextAuthHandler = NextAuth(authOptions);

export async function GET(req: Request, ctx: { params: { nextauth: string[] } }): Promise<Response> {
  return nextAuthHandler(req as unknown as Request & { nextauth?: string[] }, ctx as never) as Promise<Response>;
}

export async function POST(req: Request, ctx: { params: { nextauth: string[] } }): Promise<Response> {
  // Only rate-limit the credentials sign-in callback, not e.g. session refresh.
  const isCallback = ctx.params.nextauth?.[0] === 'callback';
  if (isCallback) {
    const ip = ipFromRequestHeaders(req);
    const rl = checkRateLimit({ key: `login:${ip}`, capacity: 5, refillPerSec: 1 / 60 });
    if (!rl.allowed) {
      return new Response('Too many requests', {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      });
    }
  }
  return nextAuthHandler(req as unknown as Request & { nextauth?: string[] }, ctx as never) as Promise<Response>;
}
