'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { updateSettings } from '@/lib/services/systemSettings';
import { z } from 'zod';

const schema = z.object({
  companyName:       z.string().trim().min(1).max(200),
  defaultSenderName: z.string().trim().min(1).max(200),
});

export type SettingsFormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: true };

export async function updateSettingsAction(
  _prev: SettingsFormState | undefined,
  fd: FormData,
): Promise<SettingsFormState> {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const parsed = schema.safeParse({
    companyName: fd.get('companyName'),
    defaultSenderName: fd.get('defaultSenderName'),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  await updateSettings({ input: parsed.data, actorUserId: user.id });
  revalidatePath('/dashboard/admin/settings');
  return { ok: true };
}
