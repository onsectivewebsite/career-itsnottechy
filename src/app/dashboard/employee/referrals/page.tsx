import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listMyReferrals } from '@/lib/services/referralService';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { STAGE_LABEL } from '@/lib/ats/stages';

const REFERRAL_TONE = {
  SUBMITTED: 'neutral', CONTACTED: 'blue', CONVERTED: 'green', REJECTED: 'red',
} as const;

const REFERRAL_LABEL = {
  SUBMITTED: 'Sent invite', CONTACTED: 'Candidate registered',
  CONVERTED: 'Hiring in progress', REJECTED: 'Closed',
} as const;

export default async function MyReferralsPage({
  searchParams,
}: {
  searchParams: { submitted?: string };
}) {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE']);
  const refs = await listMyReferrals(user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My referrals</h1>
        <Link href="/dashboard/employee/refer" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          + Refer a candidate
        </Link>
      </div>

      {searchParams.submitted === '1' && (
        <Alert tone="success">Referral submitted. We&apos;ll keep you posted as it progresses.</Alert>
      )}

      <Card>
        <CardTitle>{refs.length} referral{refs.length === 1 ? '' : 's'}</CardTitle>
        {refs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No referrals yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {refs.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-slate-900">{r.candidateName}</div>
                  <div className="text-sm text-slate-500">
                    {r.candidateEmail} · for {r.job.title} ({r.job.department})
                  </div>
                  {r.application && (
                    <div className="mt-1 text-xs text-slate-500">
                      Application stage: <span className="font-medium">{STAGE_LABEL[r.application.stage]}</span>
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
