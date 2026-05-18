import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listAllReferrals } from '@/lib/services/referralService';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { STAGE_LABEL } from '@/lib/ats/stages';

const REFERRAL_TONE = {
  SUBMITTED: 'neutral', CONTACTED: 'blue', CONVERTED: 'green', REJECTED: 'red',
} as const;

const REFERRAL_LABEL = {
  SUBMITTED: 'Awaiting candidate', CONTACTED: 'Registered',
  CONVERTED: 'Application active', REJECTED: 'Closed',
} as const;

export default async function HrReferralsPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const refs = await listAllReferrals();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Referrals</h1>
      <p className="text-sm text-slate-500">{refs.length} total · auto-link runs when the candidate signs up + applies.</p>

      <Card>
        {refs.length === 0 ? (
          <p className="text-sm text-slate-600">No referrals yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {refs.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-slate-900">
                    {r.candidateName}{' '}
                    <span className="text-sm font-normal text-slate-500">({r.candidateEmail})</span>
                  </div>
                  <div className="text-sm text-slate-500">
                    Referred by {r.referringUser.name} ({r.referringUser.email}) · for{' '}
                    <Link href={`/dashboard/hr/jobs/${r.job.id}/applicants`} className="hover:underline">{r.job.title}</Link>
                  </div>
                  {r.application && (
                    <div className="mt-1 text-xs text-slate-500">
                      <Link href={`/dashboard/hr/applications/${r.application.id}`} className="text-brand-600 hover:underline">
                        Open application
                      </Link>
                      {' '}— stage: <span className="font-medium">{STAGE_LABEL[r.application.stage]}</span>
                    </div>
                  )}
                </div>
                <Badge tone={REFERRAL_TONE[r.status]}>{REFERRAL_LABEL[r.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
