'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { submitReferral } from '@/lib/services/referralService';
import { referralInputSchema } from '@/lib/validation/referrals';

type FormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: true };

export async function submitReferralAction(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['MANAGER', 'EMPLOYEE']);
  const parsed = referralInputSchema.safeParse({
    jobId: fd.get('jobId'),
    candidateName: fd.get('candidateName'),
    candidateEmail: fd.get('candidateEmail'),
    relationship: fd.get('relationship'),
    resumeUrl: fd.get('resumeUrl') || undefined,
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const r = await submitReferral({ referringUserId: user.id, input: parsed.data });
  if (!r.ok) {
    return {
      error:
        r.reason === 'JOB_NOT_OPEN' ? 'That job is no longer accepting referrals.' :
        r.reason === 'DUPLICATE'    ? "You've already referred that candidate for this role." :
                                       'Something went wrong with this referral.',
    };
  }
  revalidatePath('/dashboard/employee/referrals');
  redirect('/dashboard/employee/referrals?submitted=1');
}
