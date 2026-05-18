import Link from 'next/link';
import type { AppStage } from '@prisma/client';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const STAGE_LABEL: Record<AppStage, string> = {
  APPLIED: 'Applied', SCREENING: 'Screening', INTERVIEW: 'Interview',
  OFFER: 'Offer', HIRED: 'Hired', REJECTED: 'Rejected',
};
const STAGE_TONE: Record<AppStage, 'neutral' | 'blue' | 'amber' | 'green' | 'red'> = {
  APPLIED: 'neutral', SCREENING: 'blue', INTERVIEW: 'blue',
  OFFER: 'amber', HIRED: 'green', REJECTED: 'red',
};

export default async function HrApplicantsPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const apps = await prisma.application.findMany({
    where: { stage: { notIn: ['HIRED', 'REJECTED'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      job: { select: { id: true, title: true } },
      candidate: { select: { id: true, name: true, email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Active applicants</h1>
      <p className="text-sm text-slate-500">{apps.length} active application{apps.length === 1 ? '' : 's'} across all open jobs.</p>

      <Card>
        {apps.length === 0 ? (
          <p className="text-sm text-slate-600">No active applications.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {apps.map((app) => (
              <li key={app.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/dashboard/hr/applications/${app.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {app.candidate.name}
                  </Link>
                  <div className="text-sm text-slate-500">
                    {app.candidate.email} · for{' '}
                    <Link href={`/dashboard/hr/jobs/${app.job.id}/applicants`} className="hover:underline">
                      {app.job.title}
                    </Link>
                  </div>
                </div>
                <Badge tone={STAGE_TONE[app.stage]}>{STAGE_LABEL[app.stage]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
