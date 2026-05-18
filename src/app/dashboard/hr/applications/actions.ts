'use server';

import { revalidatePath } from 'next/cache';
import type { AppStage } from '@prisma/client';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { moveStage } from '@/lib/services/atsService';
import { addApplicationNote } from '@/lib/services/notesService';

type FormState = { error?: string; ok?: true };

const VALID_STAGES: readonly AppStage[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] as const;

function narrowStage(raw: unknown): AppStage | null {
  return typeof raw === 'string' && (VALID_STAGES as readonly string[]).includes(raw) ? (raw as AppStage) : null;
}

export async function moveStageAction(
  applicationId: string,
  jobId: string,
  _prev: FormState | undefined,
  fd: FormData,
): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const toStage = narrowStage(fd.get('toStage'));
  if (!toStage) return { error: 'Invalid stage.' };

  const r = await moveStage({ applicationId, toStage, actorUserId: user.id });
  if (!r.ok) {
    return {
      error: r.reason === 'NOT_FOUND'
        ? 'Application not found.'
        : 'That stage transition is not allowed from the current stage.',
    };
  }
  revalidatePath(`/dashboard/hr/jobs/${jobId}/applicants`);
  revalidatePath(`/dashboard/hr/applications/${applicationId}`);
  revalidatePath(`/dashboard/hr/applicants`);
  return { ok: true };
}

export async function addNoteAction(
  applicationId: string,
  _prev: FormState | undefined,
  fd: FormData,
): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const body = String(fd.get('body') ?? '');
  const r = await addApplicationNote({
    applicationId, authorUserId: user.id, body,
  });
  if (!r.ok) return { error: 'Note cannot be empty.' };
  revalidatePath(`/dashboard/hr/applications/${applicationId}`);
  return { ok: true };
}
