import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { sanitizeRichHtml } from '@/lib/richText';
import { emailTemplateInputSchema, type EmailTemplateInput } from '@/lib/validation/emailTemplates';

export type CreateResult = { ok: true; id: string } | { ok: false; reason: 'INVALID' | 'NAME_TAKEN' };
export type UpdateResult = { ok: true } | { ok: false; reason: 'INVALID' | 'NAME_TAKEN' | 'NOT_FOUND' };
export type DeleteResult = { ok: true } | { ok: false; reason: 'NOT_FOUND' };

export async function createTemplate(args: {
  input: EmailTemplateInput;
  actorUserId: string;
}): Promise<CreateResult> {
  const parsed = emailTemplateInputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID' };

  try {
    const t = await prisma.emailTemplate.create({
      data: {
        name: parsed.data.name,
        subject: parsed.data.subject,
        body: sanitizeRichHtml(parsed.data.body),
        createdById: args.actorUserId,
      },
    });
    await recordAudit({
      actorUserId: args.actorUserId,
      action: 'EMAIL_TEMPLATE_CREATED',
      entityType: 'EmailTemplate',
      entityId: t.id,
      metadata: { name: t.name },
    });
    return { ok: true, id: t.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, reason: 'NAME_TAKEN' };
    }
    throw err;
  }
}

export async function updateTemplate(args: {
  id: string;
  input: EmailTemplateInput;
  actorUserId: string;
}): Promise<UpdateResult> {
  const parsed = emailTemplateInputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID' };

  const existing = await prisma.emailTemplate.findUnique({ where: { id: args.id } });
  if (!existing) return { ok: false, reason: 'NOT_FOUND' };

  try {
    await prisma.emailTemplate.update({
      where: { id: args.id },
      data: {
        name: parsed.data.name,
        subject: parsed.data.subject,
        body: sanitizeRichHtml(parsed.data.body),
      },
    });
    await recordAudit({
      actorUserId: args.actorUserId,
      action: 'EMAIL_TEMPLATE_UPDATED',
      entityType: 'EmailTemplate',
      entityId: args.id,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, reason: 'NAME_TAKEN' };
    }
    throw err;
  }
}

export async function deleteTemplate(args: {
  id: string;
  actorUserId: string;
}): Promise<DeleteResult> {
  const r = await prisma.emailTemplate.deleteMany({ where: { id: args.id } });
  if (r.count !== 1) return { ok: false, reason: 'NOT_FOUND' };
  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'EMAIL_TEMPLATE_DELETED',
    entityType: 'EmailTemplate',
    entityId: args.id,
  });
  return { ok: true };
}

export async function listTemplates() {
  return prisma.emailTemplate.findMany({ orderBy: { updatedAt: 'desc' } });
}

export async function getTemplate(id: string) {
  return prisma.emailTemplate.findUnique({ where: { id } });
}
