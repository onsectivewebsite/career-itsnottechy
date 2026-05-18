import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AppStage } from '@prisma/client';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { listApplicationsForJob } from '@/lib/services/atsService';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const STAGE_ORDER: AppStage[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

const STAGE_LABEL: Record<AppStage, string> = {
  APPLIED: 'Applied', SCREENING: 'Screening', INTERVIEW: 'Interview',
  OFFER: 'Offer', HIRED: 'Hired', REJECTED: 'Rejected',
};

const STAGE_TONE: Record<AppStage, 'neutral' | 'blue' | 'amber' | 'green' | 'red'> = {
  APPLIED: 'neutral', SCREENING: 'blue', INTERVIEW: 'blue',
  OFFER: 'amber', HIRED: 'green', REJECTED: 'red',
};

export default async function ApplicantsPage({ params }: { params: { id: string } }) {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) notFound();

  const apps = await listApplicationsForJob(params.id);

  const byStage: Record<AppStage, typeof apps> = {
    APPLIED: [], SCREENING: [], INTERVIEW: [], OFFER: [], HIRED: [], REJECTED: [],
  };
  for (const a of apps) byStage[a.stage].push(a);

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {STAGE_ORDER.map((stage) => (
          <Card key={stage}>
            <div className="flex items-center justify-between">
              <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>
              <span className="text-xs text-slate-500">{byStage[stage].length}</span>
            </div>
            <ul className="mt-3 space-y-2">
              {byStage[stage].map((app) => (
                <li key={app.id}>
                  <Link
                    href={`/dashboard/hr/applications/${app.id}`}
                    className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:border-brand-300 hover:bg-slate-50"
                  >
                    <div className="font-medium text-slate-900">{app.candidate.name}</div>
                    <div className="text-xs text-slate-500">{app.candidate.email}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Applied {app.createdAt.toISOString().slice(0, 10)}
                    </div>
                  </Link>
                </li>
              ))}
              {byStage[stage].length === 0 && (
                <li className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400">
                  No one here.
                </li>
              )}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
