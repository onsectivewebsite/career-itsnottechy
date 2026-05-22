'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { toggleSavedJob } from '@/lib/services/savedJobService';

/** Toggles a job's saved state for the current candidate. Returns the new state. */
export async function toggleSavedJobAction(jobId: string): Promise<{ ok: boolean; saved: boolean }> {
  const user = requireRole(await getSessionUser(), 'CANDIDATE');
  const r = await toggleSavedJob({ candidateUserId: user.id, jobId });
  revalidatePath('/jobs');
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/dashboard/candidate');
  return r.ok ? { ok: true, saved: r.saved } : { ok: false, saved: false };
}
