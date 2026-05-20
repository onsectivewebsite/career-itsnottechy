import { prisma } from '@/lib/prisma';
import type { RequiredDocument } from '@/types/requiredDocuments';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';

/** Required documents that have no uploaded file in `provided` (keyed by RequiredDocument.id). */
export function missingRequiredDocuments(
  requiredDocuments: RequiredDocument[],
  provided: Record<string, string>,
): RequiredDocument[] {
  return requiredDocuments.filter((d) => {
    const val = provided[d.id];
    return d.required && !(typeof val === 'string' && val.trim() !== '');
  });
}

/** Persist one SUBMITTED ApplicationDocument per provided file at apply time. */
export async function createAppliedDocuments(args: {
  applicationId: string;
  requiredDocuments: RequiredDocument[];
  provided: Record<string, string>;
}): Promise<void> {
  const now = new Date();
  const rows = args.requiredDocuments
    .flatMap((d) => {
      const val = args.provided[d.id];
      if (typeof val !== 'string' || val.trim() === '') return [];
      return [{
        applicationId: args.applicationId,
        label: d.name,
        instructions: d.instructions ?? null,
        fileUrl: val,
        status: 'SUBMITTED' as const,
        submittedAt: now,
      }];
    });
  if (rows.length > 0) {
    await prisma.applicationDocument.createMany({ data: rows });
  }
}

/** All documents for one application, oldest first. */
export async function listApplicationDocuments(applicationId: string) {
  return prisma.applicationDocument.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'asc' },
  });
}

export type RequestDocResult =
  | { ok: true; documentId: string }
  | { ok: false; reason: 'APPLICATION_NOT_FOUND' };

/** HR requests an extra document from an applicant. Creates a PENDING row,
 *  audits it, and emails the candidate. */
export async function requestDocument(args: {
  applicationId: string;
  requestedById: string;
  name: string;
  instructions?: string;
}): Promise<RequestDocResult> {
  const app = await prisma.application.findUnique({
    where: { id: args.applicationId },
    include: {
      candidate: { select: { name: true, email: true } },
      job: { select: { title: true } },
    },
  });
  if (!app) return { ok: false, reason: 'APPLICATION_NOT_FOUND' };

  const doc = await prisma.applicationDocument.create({
    data: {
      applicationId: args.applicationId,
      label: args.name,
      instructions: args.instructions ?? null,
      status: 'PENDING',
      requestedById: args.requestedById,
    },
  });

  await recordAudit({
    actorUserId: args.requestedById,
    action: 'DOCUMENT_REQUESTED',
    entityType: 'ApplicationDocument',
    entityId: doc.id,
    metadata: { applicationId: args.applicationId, label: args.name },
  });

  await sendEmail({
    to: app.candidate.email,
    template: 'document-requested',
    data: {
      name: app.candidate.name,
      jobTitle: app.job.title,
      documentName: args.name,
      instructionsBlock: args.instructions ? `<p><em>${args.instructions}</em></p>` : '',
      dashboardUrl: `${process.env.APP_URL ?? ''}/dashboard/candidate`,
    },
  });

  return { ok: true, documentId: doc.id };
}

export type FulfilResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'FORBIDDEN' | 'ALREADY_SUBMITTED' };

/** The owning candidate uploads a file against a PENDING request. */
export async function fulfilDocumentRequest(args: {
  documentId: string;
  candidateUserId: string;
  fileUrl: string;
}): Promise<FulfilResult> {
  const doc = await prisma.applicationDocument.findUnique({
    where: { id: args.documentId },
    include: { application: { select: { candidateUserId: true } } },
  });
  if (!doc) return { ok: false, reason: 'NOT_FOUND' };
  if (doc.application.candidateUserId !== args.candidateUserId) {
    return { ok: false, reason: 'FORBIDDEN' };
  }
  if (doc.status === 'SUBMITTED') return { ok: false, reason: 'ALREADY_SUBMITTED' };

  await prisma.applicationDocument.update({
    where: { id: args.documentId },
    data: { fileUrl: args.fileUrl, status: 'SUBMITTED', submittedAt: new Date() },
  });
  await recordAudit({
    actorUserId: args.candidateUserId,
    action: 'DOCUMENT_SUBMITTED',
    entityType: 'ApplicationDocument',
    entityId: args.documentId,
  });
  return { ok: true };
}

/** Every PENDING document across all of a candidate's applications. */
export async function listPendingDocumentsForCandidate(candidateUserId: string) {
  return prisma.applicationDocument.findMany({
    where: { status: 'PENDING', application: { candidateUserId } },
    orderBy: { createdAt: 'asc' },
    include: {
      application: { include: { job: { select: { id: true, title: true } } } },
    },
  });
}
