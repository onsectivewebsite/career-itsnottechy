'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { fulfilDocumentRequest } from '@/lib/services/documentService';

type FormState = { error?: string; ok?: true };

export async function uploadDocumentAction(
  documentId: string,
  _prev: FormState | undefined,
  fd: FormData,
): Promise<FormState> {
  const user = requireRole(await getSessionUser(), 'CANDIDATE');

  const fileUrl = String(fd.get('fileUrl') ?? '');
  if (!fileUrl) return { error: 'Please choose a file to upload.' };

  const r = await fulfilDocumentRequest({ documentId, candidateUserId: user.id, fileUrl });
  if (!r.ok) {
    const msg =
      r.reason === 'FORBIDDEN'         ? 'You cannot upload to this request.' :
      r.reason === 'ALREADY_SUBMITTED' ? 'This document was already submitted.' :
                                         'Document request not found.';
    return { error: msg };
  }

  revalidatePath('/dashboard/candidate');
  return { ok: true };
}
