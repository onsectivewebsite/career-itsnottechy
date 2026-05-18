import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export type Purpose = 'resume' | 'supporting-doc';

export const MIME_BY_PURPOSE: Record<Purpose, readonly string[]> = {
  resume: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  'supporting-doc': [
    'application/pdf',
    'image/png',
    'image/jpeg',
  ],
};

function storageRoot(): string {
  return path.resolve(process.cwd(), process.env.STORAGE_ROOT ?? './uploads');
}

function sanitizeFilename(original: string): string {
  const base = path.basename(original).replace(/[^A-Za-z0-9._-]/g, '_');
  return base.replace(/^\.+/, '') || 'file';
}

export type SaveResult =
  | { ok: true; relativePath: string }
  | { ok: false; reason: 'TOO_LARGE' | 'MIME_NOT_ALLOWED' };

export async function saveUploadedFile(input: {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  purpose: Purpose;
  entityId: string;
}): Promise<SaveResult> {
  if (input.buffer.byteLength > MAX_SIZE) return { ok: false, reason: 'TOO_LARGE' };
  if (!MIME_BY_PURPOSE[input.purpose].includes(input.mimeType)) {
    return { ok: false, reason: 'MIME_NOT_ALLOWED' };
  }

  const safeEntity = input.entityId.replace(/[^A-Za-z0-9_-]/g, '');
  const safeName = sanitizeFilename(input.originalFilename);
  const random = crypto.randomBytes(8).toString('hex');
  const relativePath = path.posix.join(input.purpose, safeEntity, `${random}-${safeName}`);
  const absolute = path.resolve(storageRoot(), relativePath);

  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, input.buffer);
  return { ok: true, relativePath };
}

export function resolveStoredFilePath(relativePath: string): string | null {
  if (relativePath.startsWith('/') || relativePath.includes('..')) return null;
  const root = storageRoot();
  const absolute = path.resolve(root, relativePath);
  if (!absolute.startsWith(root + path.sep) && absolute !== root) return null;
  return absolute;
}
