'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { hrDecision } from '@/lib/services/promotionService';
import { decisionInputSchema } from '@/lib/validation/promotions';

export type DecisionFormState = { error?: string; ok?: true };

export async function hrDecisionAction(
  _prev: DecisionFormState | undefined,
  fd: FormData,
): Promise<DecisionFormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const promotionId = String(fd.get('promotionId') ?? '');
  const parsed = decisionInputSchema.safeParse({
    decision: fd.get('decision'),
    notes: (fd.get('notes') as string | null) || undefined,
  });
  if (!parsed.success) return { error: 'Pick Approved or Rejected.' };

  const r = await hrDecision({
    promotionId, actorUserId: user.id,
    decision: parsed.data.decision, notes: parsed.data.notes,
  });
  if (!r.ok) {
    return {
      error:
        r.reason === 'NOT_FOUND'    ? 'Request no longer exists.' :
        r.reason === 'WRONG_STATUS' ? 'This request is not awaiting HR.' :
                                       'Could not record decision.',
    };
  }
  revalidatePath('/dashboard/hr/promotions');
  return { ok: true };
}
