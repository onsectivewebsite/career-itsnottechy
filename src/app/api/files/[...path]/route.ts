import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { resolveStoredFilePath } from '@/lib/storage';
import { checkFileAcl } from '@/lib/services/fileAclService';

const EXT_TO_MIME: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } },
): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

  const relative = params.path.join('/');

  const acl = await checkFileAcl({ path: relative, user });
  if (!acl.allowed) {
    const status = acl.reason === 'NOT_FOUND' ? 404 : 403;
    return NextResponse.json({ error: acl.reason }, { status });
  }

  const absolute = resolveStoredFilePath(relative);
  if (!absolute) return NextResponse.json({ error: 'BAD_PATH' }, { status: 400 });
  if (!fs.existsSync(absolute)) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const ext = path.extname(absolute).toLowerCase();
  const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream';

  const data = await fs.promises.readFile(absolute);
  return new Response(data, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${path.basename(absolute)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
