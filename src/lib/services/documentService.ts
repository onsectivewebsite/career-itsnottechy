import { prisma } from '@/lib/prisma';
import type { RequiredDocument } from '@/types/requiredDocuments';

/** Required documents that have no uploaded file in `provided` (keyed by RequiredDocument.id). */
export function missingRequiredDocuments(
  requiredDocuments: RequiredDocument[],
  provided: Record<string, string>,
): RequiredDocument[] {
  return requiredDocuments.filter(
    (d) => d.required && !(typeof provided[d.id] === 'string' && provided[d.id].trim() !== ''),
  );
}

/** Persist one SUBMITTED ApplicationDocument per provided file at apply time. */
export async function createAppliedDocuments(args: {
  applicationId: string;
  requiredDocuments: RequiredDocument[];
  provided: Record<string, string>;
}): Promise<void> {
  const now = new Date();
  const rows = args.requiredDocuments
    .filter((d) => typeof args.provided[d.id] === 'string' && args.provided[d.id].trim() !== '')
    .map((d) => ({
      applicationId: args.applicationId,
      label: d.name,
      instructions: d.instructions ?? null,
      fileUrl: args.provided[d.id],
      status: 'SUBMITTED' as const,
      submittedAt: now,
    }));
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
