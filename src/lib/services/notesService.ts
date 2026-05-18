import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

export type AddNoteResult = { ok: true; noteId: string } | { ok: false; reason: 'EMPTY' };

export async function addApplicationNote(args: {
  applicationId: string; authorUserId: string; body: string;
}): Promise<AddNoteResult> {
  const trimmed = args.body.trim();
  if (trimmed === '') return { ok: false, reason: 'EMPTY' };

  const note = await prisma.applicationNote.create({
    data: {
      applicationId: args.applicationId,
      authorUserId: args.authorUserId,
      body: trimmed,
    },
  });
  await recordAudit({
    actorUserId: args.authorUserId,
    action: 'APP_NOTE_ADDED',
    entityType: 'Application',
    entityId: args.applicationId,
    metadata: { noteId: note.id },
  });
  return { ok: true, noteId: note.id };
}

export async function listApplicationNotes(applicationId: string) {
  return prisma.applicationNote.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { id: true, name: true } } },
  });
}
