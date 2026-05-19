'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { scheduleInterview } from '@/lib/services/interviewService';

export type ScheduleFormState =
  | { ok: true }
  | { error?: string; conflicts?: { id: string; scheduledAt: string; durationMinutes: number }[] }
  | Record<string, never>;

export async function scheduleInterviewAction(
  _prev: ScheduleFormState | undefined,
  fd: FormData,
): Promise<ScheduleFormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const applicationId = String(fd.get('applicationId') ?? '');

  const r = await scheduleInterview({
    scheduledByUserId: user.id,
    force: fd.get('force') === '1',
    input: {
      applicationId,
      scheduledAt: String(fd.get('scheduledAt') ?? ''),
      durationMinutes: Number(fd.get('durationMinutes') ?? 45),
      format: String(fd.get('format') ?? 'VIDEO') as 'VIDEO' | 'PHONE' | 'IN_PERSON',
      interviewerUserId: String(fd.get('interviewerUserId') ?? ''),
      locationOrLink: String(fd.get('locationOrLink') ?? ''),
      notes: (fd.get('notes') as string | null) || undefined,
    },
  });

  if (!r.ok) {
    if (r.reason === 'CONFLICT') {
      return {
        conflicts: r.conflicts.map((c) => ({
          id: c.id, scheduledAt: c.scheduledAt.toISOString(), durationMinutes: c.durationMinutes,
        })),
        error: 'This interviewer already has an interview that overlaps. You can schedule anyway, or choose a different time.',
      };
    }
    return {
      error:
        r.reason === 'INVALID'                  ? 'Some fields are missing or invalid.' :
        r.reason === 'NOT_FOUND'                ? 'Application no longer exists.' :
        r.reason === 'INTERVIEWER_NOT_FOUND'    ? 'Selected interviewer does not exist.' :
                                                  'Could not schedule this interview.',
    };
  }
  revalidatePath(`/dashboard/hr/applications/${applicationId}`);
  return { ok: true };
}
