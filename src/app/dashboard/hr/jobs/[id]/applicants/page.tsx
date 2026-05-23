import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { listApplicationsForJob } from '@/lib/services/atsService';
import { BulkApplicantsByStage, type AppRow } from './BulkApplicantsByStage';

export default async function ApplicantsPage({ params }: { params: { id: string } }) {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) notFound();

  const apps = await listApplicationsForJob(params.id);

  const rows: AppRow[] = apps.map((a) => ({
    id: a.id,
    stage: a.stage,
    createdAt: a.createdAt,
    candidate: { name: a.candidate.name, email: a.candidate.email },
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/hr/jobs" className="text-sm text-brand-600 hover:underline">&larr; All jobs</Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Applicants: {job.title}</h1>
          <p className="text-sm text-slate-500">{apps.length} application{apps.length === 1 ? '' : 's'} total</p>
        </div>
        <Link href={`/dashboard/hr/jobs/${params.id}`} className="text-sm text-slate-600 hover:text-slate-900">Edit job</Link>
      </div>

      <BulkApplicantsByStage apps={rows} />
    </div>
  );
}
