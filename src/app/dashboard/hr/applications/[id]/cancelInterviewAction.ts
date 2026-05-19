'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { cancelInterview } from '@/lib/services/interviewService';

export async function cancelInterviewAction(fd: FormData): Promise<void> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const interviewId = String(fd.get('interviewId') ?? '');
  const applicationId = String(fd.get('applicationId') ?? '');
  if (!interviewId || !applicationId) return;
  await cancelInterview({ interviewId, actorUserId: user.id });
  revalidatePath(`/dashboard/hr/applications/${applicationId}`);
}
