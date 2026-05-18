'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { createJob, updateJob, publishJob, closeJob } from '@/lib/services/jobService';
import { jobInputSchema, type JobInput } from '@/lib/validation/jobs';

type FormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: true };

function parseJobFormData(fd: FormData): JobInput | null {
  const customQuestionsRaw = String(fd.get('customQuestionsJson') ?? '[]');
  let customQuestions: unknown = [];
  try {
    customQuestions = JSON.parse(customQuestionsRaw);
  } catch {
    return null;
  }
  const parsed = jobInputSchema.safeParse({
    title: fd.get('title'),
    department: fd.get('department'),
    locationType: fd.get('locationType'),
    locationCity: fd.get('locationCity') || undefined,
    type: fd.get('type'),
    description: fd.get('description'),
    requirements: fd.get('requirements'),
    salaryMin: fd.get('salaryMin') ? Number(fd.get('salaryMin')) : undefined,
    salaryMax: fd.get('salaryMax') ? Number(fd.get('salaryMax')) : undefined,
    currency: fd.get('currency') || 'USD',
    deadline: fd.get('deadline') || undefined,
    customQuestions,
  });
  return parsed.success ? parsed.data : null;
}

export async function createJobAction(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const input = parseJobFormData(fd);
  if (!input) return { error: 'Some fields are invalid. Check the form and try again.' };
  const r = await createJob({ input, postedByUserId: user.id });
  if (!r.ok) return { error: 'Could not create the job.' };
  revalidatePath('/dashboard/hr/jobs');
  redirect(`/dashboard/hr/jobs/${r.jobId}`);
}

export async function updateJobAction(jobId: string, _prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const input = parseJobFormData(fd);
  if (!input) return { error: 'Some fields are invalid.' };
  const r = await updateJob({ jobId, input, actorUserId: user.id });
  if (!r.ok) return { error: r.reason === 'NOT_FOUND' ? 'Job not found.' : 'Some fields are invalid.' };
  revalidatePath('/dashboard/hr/jobs');
  revalidatePath(`/dashboard/hr/jobs/${jobId}`);
  return { ok: true };
}

export async function publishJobAction(jobId: string): Promise<void> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  await publishJob({ jobId, actorUserId: user.id });
  revalidatePath('/dashboard/hr/jobs');
  revalidatePath(`/dashboard/hr/jobs/${jobId}`);
  revalidatePath('/jobs');
}

export async function closeJobAction(jobId: string): Promise<void> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  await closeJob({ jobId, actorUserId: user.id });
  revalidatePath('/dashboard/hr/jobs');
  revalidatePath(`/dashboard/hr/jobs/${jobId}`);
  revalidatePath('/jobs');
}
