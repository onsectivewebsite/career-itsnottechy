'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { submitPromotion } from '@/lib/services/promotionService';
import { promotionInputSchema } from '@/lib/validation/promotions';

type FormState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function submitPromotionAction(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['MANAGER', 'EMPLOYEE']);
  const parsed = promotionInputSchema.safeParse({
    currentTitle:  fd.get('currentTitle'),
    targetTitle:   fd.get('targetTitle'),
    justification: fd.get('justification'),
    supportingDocUrl: fd.get('supportingDocUrl') || undefined,
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const r = await submitPromotion({ employeeUserId: user.id, input: parsed.data });
  if (!r.ok) {
    return {
      error:
        r.reason === 'NO_MANAGER'      ? 'You don\'t have a manager assigned. Ask HR to set one before submitting.' :
        r.reason === 'NO_EMPLOYEE_ROW' ? 'Your account does not have an employee record.' :
                                          'Could not submit this request.',
    };
  }
  revalidatePath('/dashboard/employee/promotions');
  redirect('/dashboard/employee/promotions?submitted=1');
}
