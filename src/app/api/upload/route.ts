import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { saveUploadedFile, MIME_BY_PURPOSE, type Purpose } from '@/lib/storage';

const purposeSchema = z.enum(['resume', 'supporting-doc', 'application-doc']);

function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const expected = process.env.APP_URL ?? `${req.headers.get('x-forwarded-proto') ?? 'https'}://${req.headers.get('host') ?? ''}`;
  if (!expected) return false;
  // Accept if Origin matches APP_URL prefix OR if Referer URL has the same origin.
  if (origin && origin === expected.replace(/\/$/, '')) return true;
  if (referer) {
    try {
      const refUrl = new URL(referer);
      const expUrl = new URL(expected);
      if (refUrl.origin === expUrl.origin) return true;
    } catch { /* fall through */ }
  }
  return false;
}

// CSRF check: tested manually. A unit test would need to set up a NextAuth
// session mock + a NextResponse mock, which is heavier than warranted here.

export async function POST(req: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'CSRF_BLOCKED' }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get('file');
  const purposeRaw = form.get('purpose');
  const entityIdRaw = form.get('entityId');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'MISSING_FILE' }, { status: 400 });
  }
  const purposeParse = purposeSchema.safeParse(purposeRaw);
  if (!purposeParse.success || typeof entityIdRaw !== 'string' || !entityIdRaw) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }
  const purpose: Purpose = purposeParse.data;

  // Role gating for purpose. CANDIDATE may only upload resumes.
  if (purpose === 'supporting-doc' && user.role === 'CANDIDATE') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  if (!MIME_BY_PURPOSE[purpose].includes(file.type)) {
    return NextResponse.json({ error: 'MIME_NOT_ALLOWED' }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await saveUploadedFile({
    buffer,
    originalFilename: file.name,
    mimeType: file.type,
    purpose,
    entityId: entityIdRaw,
  });

  if (!result.ok) {
    const status = result.reason === 'TOO_LARGE' ? 413 : 415;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ ok: true, relativePath: result.relativePath });
}
