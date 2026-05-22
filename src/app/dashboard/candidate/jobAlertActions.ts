'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { setJobAlerts } from '@/lib/services/jobAlertService';

/** Turns the current candidate's job alerts on or off. */
export async function setJobAlertsAction(enabled: boolean): Promise<{ ok: boolean }> {
  const user = requireRole(await getSessionUser(), 'CANDIDATE');
  await setJobAlerts({ candidateUserId: user.id, enabled });
  revalidatePath('/dashboard/candidate');
  return { ok: true };
}
