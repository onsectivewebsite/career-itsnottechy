import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { saveUploadedFile, MIME_BY_PURPOSE, type Purpose } from '@/lib/storage';

const purposeSchema = z.enum(['resume', 'supporting-doc']);

export async function POST(req: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

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
