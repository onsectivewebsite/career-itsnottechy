import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listActiveApplicationsForHr } from '@/lib/services/atsService';
import { STAGE_LABEL, STAGE_TONE } from '@/lib/ats/stages';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default async function HrApplicantsPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const apps = await listActiveApplicationsForHr();

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
                <div className="flex items-center gap-2">
                  {app.referral && <Badge tone="blue">Referred</Badge>}
                  <Badge tone={STAGE_TONE[app.stage]}>{STAGE_LABEL[app.stage]}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
