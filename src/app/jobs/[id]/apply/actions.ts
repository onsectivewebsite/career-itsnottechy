'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { submitApplication } from '@/lib/services/applicationService';

type FormState = { error?: string; ok?: true };

export async function submitApplicationAction(
  jobId: string,
  _prev: FormState | undefined,
  fd: FormData,
): Promise<FormState> {
  const user = requireRole(await getSessionUser(), 'CANDIDATE');

  const resumeUrl = String(fd.get('resumeUrl') ?? '');
  if (!resumeUrl) return { error: 'Please upload your resume first.' };

  const coverLetterRaw = fd.get('coverLetter');
  const coverLetter = typeof coverLetterRaw === 'string' && coverLetterRaw.trim().length > 0
    ? coverLetterRaw : undefined;

  const customAnswersRaw = String(fd.get('customAnswersJson') ?? '{}');
  let customAnswers: Record<string, string> = {};
  try {
    const parsed = JSON.parse(customAnswersRaw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      customAnswers = parsed as Record<string, string>;
    }
  } catch {
    return { error: 'Could not read your answers. Try again.' };
  }

  const documentsRaw = String(fd.get('documentsJson') ?? '{}');
  let documents: Record<string, string> = {};
  try {
    const parsedDocs = JSON.parse(documentsRaw);
    if (parsedDocs && typeof parsedDocs === 'object' && !Array.isArray(parsedDocs)) {
      documents = parsedDocs as Record<string, string>;
    }
  } catch {
    return { error: 'Could not read your uploaded documents. Try again.' };
  }

  const r = await submitApplication({
    jobId,
    candidateUserId: user.id,
    input: { jobId, resumeUrl, coverLetter, customAnswers },
    documents,
  });

  if (!r.ok) {
    const msg =
      r.reason === 'JOB_NOT_OPEN'        ? 'This role is no longer accepting applications.' :
      r.reason === 'DEADLINE_PASSED'     ? 'The deadline for this role has passed.' :
      r.reason === 'ALREADY_APPLIED'     ? "You've already applied to this role." :
      r.reason === 'CANDIDATE_NOT_FOUND' ? 'Could not load your account. Please sign in again.' :
      r.reason === 'MISSING_DOCUMENTS'   ? 'Please upload all required documents.' :
                                           'Some answers are missing or invalid.';
    return { error: msg };
  }

  revalidatePath('/dashboard/candidate');
  redirect('/dashboard/candidate?applied=1');
}
