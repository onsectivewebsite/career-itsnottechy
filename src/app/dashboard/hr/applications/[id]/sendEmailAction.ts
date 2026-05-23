'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { sendCustomEmail } from '@/lib/email/sendCustom';
import { recordAudit } from '@/lib/audit';

type FormState = { error?: string; ok?: true };

export async function sendCustomEmailAction(
  applicationId: string,
  _prev: FormState | undefined,
  fd: FormData,
): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);

  const subject = String(fd.get('subject') ?? '').trim();
  const body    = String(fd.get('body')    ?? '');
  const sourceTemplateId = String(fd.get('sourceTemplateId') ?? '').trim() || undefined;

  if (!subject) return { error: 'Subject is required.' };
  if (!body)    return { error: 'Body is required.' };

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { candidate: { select: { name: true, email: true } } },
  });
  if (!app) return { error: 'Application not found.' };

  await sendCustomEmail({
    to: app.candidate.email,
    subject,
    html: body,
    sourceTemplateId,
  });

  await recordAudit({
    actorUserId: user.id,
    action: 'HR_EMAIL_SENT',
    entityType: 'Application',
    entityId: applicationId,
    metadata: { subject, sourceTemplateId: sourceTemplateId ?? null },
  });

  revalidatePath(`/dashboard/hr/applications/${applicationId}`);
  return { ok: true };
}
