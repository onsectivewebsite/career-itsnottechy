'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { requestDocument } from '@/lib/services/documentService';

type FormState = { error?: string; ok?: true };

export async function requestDocumentAction(
  applicationId: string,
  _prev: FormState | undefined,
  fd: FormData,
): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);

  const name = String(fd.get('documentName') ?? '').trim();
  if (!name) return { error: 'Enter a document name.' };
  const instructionsRaw = String(fd.get('instructions') ?? '').trim();

  const r = await requestDocument({
    applicationId,
    requestedById: user.id,
    name,
    instructions: instructionsRaw || undefined,
  });
  if (!r.ok) return { error: 'Could not request the document.' };

  revalidatePath(`/dashboard/hr/applications/${applicationId}`);
  return { ok: true };
}
