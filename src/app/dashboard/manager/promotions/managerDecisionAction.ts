'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { managerDecision } from '@/lib/services/promotionService';
import { decisionInputSchema } from '@/lib/validation/promotions';

export type DecisionFormState = { error?: string; ok?: true };

export async function managerDecisionAction(
  _prev: DecisionFormState | undefined,
  fd: FormData,
): Promise<DecisionFormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'MANAGER']);
  const promotionId = String(fd.get('promotionId') ?? '');
  const parsed = decisionInputSchema.safeParse({
    decision: fd.get('decision'),
    notes: (fd.get('notes') as string | null) || undefined,
  });
  if (!parsed.success) return { error: 'Pick Approved or Rejected.' };

  const r = await managerDecision({
    promotionId, actorUserId: user.id,
    decision: parsed.data.decision, notes: parsed.data.notes,
  });
  if (!r.ok) {
    return {
      error:
        r.reason === 'NOT_FOUND'    ? 'Request no longer exists.' :
        r.reason === 'NOT_MANAGER'  ? 'You are not the assigned manager for this request.' :
        r.reason === 'WRONG_STATUS' ? 'This request has already been decided.' :
                                       'Could not record decision.',
    };
  }
  revalidatePath('/dashboard/manager/promotions');
  return { ok: true };
}
