'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import {
  createTemplate, updateTemplate, deleteTemplate,
} from '@/lib/services/emailTemplateService';
import type { EmailTemplateInput } from '@/lib/validation/emailTemplates';

type FormState = { error?: string; ok?: true };

function parseInput(fd: FormData): EmailTemplateInput {
  return {
    name:    String(fd.get('name') ?? ''),
    subject: String(fd.get('subject') ?? ''),
    body:    String(fd.get('body') ?? ''),
  };
}

export async function createTemplateAction(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const r = await createTemplate({ input: parseInput(fd), actorUserId: user.id });
  if (!r.ok) {
    return { error: r.reason === 'NAME_TAKEN' ? 'A template with that name already exists.' : 'Some fields are invalid.' };
  }
  revalidatePath('/dashboard/admin/email-templates');
  redirect(`/dashboard/admin/email-templates/${r.id}`);
}

export async function updateTemplateAction(id: string, _prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const r = await updateTemplate({ id, input: parseInput(fd), actorUserId: user.id });
  if (!r.ok) {
    const msg =
      r.reason === 'NAME_TAKEN' ? 'A template with that name already exists.' :
      r.reason === 'NOT_FOUND'  ? 'Template not found.' :
                                  'Some fields are invalid.';
    return { error: msg };
  }
  revalidatePath('/dashboard/admin/email-templates');
  revalidatePath(`/dashboard/admin/email-templates/${id}`);
  return { ok: true };
}

export async function deleteTemplateAction(id: string): Promise<void> {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  await deleteTemplate({ id, actorUserId: user.id });
  revalidatePath('/dashboard/admin/email-templates');
  redirect('/dashboard/admin/email-templates');
}
