'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { sendCustomEmail } from '@/lib/email/sendCustom';
import { recordAudit } from '@/lib/audit';

type FormState = { error?: string; ok?: true };

export async function sendCustomEmailComposeAction(
  _prev: FormState | undefined,
  fd: FormData,
): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);

  const candidateUserId  = String(fd.get('candidateUserId') ?? '').trim();
  const subject          = String(fd.get('subject') ?? '').trim();
  const body             = String(fd.get('body') ?? '');
  const sourceTemplateId = String(fd.get('sourceTemplateId') ?? '').trim() || undefined;

  if (!candidateUserId) return { error: 'Pick a candidate.' };
  if (!subject)         return { error: 'Subject is required.' };
  if (!body)            return { error: 'Body is required.' };

  const candidate = await prisma.user.findFirst({
    where: { id: candidateUserId, role: 'CANDIDATE' },
    select: { id: true, name: true, email: true },
  });
  if (!candidate) return { error: 'Candidate not found.' };

  await sendCustomEmail({
    to: candidate.email,
    subject,
    html: body,
    sourceTemplateId,
  });

  await recordAudit({
    actorUserId: user.id,
    action: 'HR_EMAIL_SENT',
    entityType: 'User',
    entityId: candidate.id,
    metadata: { subject, sourceTemplateId: sourceTemplateId ?? null },
  });

  revalidatePath('/dashboard/hr/compose');
  return { ok: true };
}
