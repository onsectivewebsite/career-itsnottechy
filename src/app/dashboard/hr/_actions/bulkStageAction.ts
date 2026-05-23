'use server';

import { revalidatePath } from 'next/cache';
import type { AppStage } from '@prisma/client';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { bulkMoveStage } from '@/lib/services/atsService';

export type BulkStageFormState = {
  error?: string;
  ok?: true;
  summary?: string;
};

const VALID_STAGES: AppStage[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

export async function bulkStageAction(
  _prev: BulkStageFormState | undefined,
  fd: FormData,
): Promise<BulkStageFormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);

  const applicationIds = fd.getAll('applicationIds').map(String).filter(Boolean);
  if (applicationIds.length === 0) {
    return { error: 'Pick at least one applicant.' };
  }

  const bulkAction = String(fd.get('bulkAction') ?? '');
  const toStageRaw = String(fd.get('toStage') ?? '');

  let result;
  if (bulkAction === 'advance') {
    result = await bulkMoveStage({ applicationIds, mode: 'advance', actorUserId: user.id });
  } else if (bulkAction === 'reject') {
    result = await bulkMoveStage({ applicationIds, mode: 'set', toStage: 'REJECTED', actorUserId: user.id });
  } else if (bulkAction === 'set') {
    if (!VALID_STAGES.includes(toStageRaw as AppStage)) {
      return { error: 'Pick a target stage.' };
    }
    result = await bulkMoveStage({
      applicationIds, mode: 'set', toStage: toStageRaw as AppStage, actorUserId: user.id,
    });
  } else {
    return { error: 'Pick an action.' };
  }

  revalidatePath('/dashboard/hr/applicants');
  revalidatePath('/dashboard/hr/jobs/[id]/applicants', 'page');

  const skippedCount = result.skipped.length;
  const summary = skippedCount === 0
    ? `${result.applied} moved.`
    : `${result.applied} moved, ${skippedCount} skipped.`;
  return { ok: true, summary };
}
