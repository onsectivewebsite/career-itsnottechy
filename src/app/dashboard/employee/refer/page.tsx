import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listPublicJobs } from '@/lib/services/jobService';
import { Card, CardTitle } from '@/components/ui/Card';
import { ReferForm } from './ReferForm';

export const metadata = { title: 'Refer a candidate · ItsNotTechy Careers' };

export default async function ReferPage() {
  requireAnyRole(await getSessionUser(), ['MANAGER', 'EMPLOYEE']);
  const openJobs = (await listPublicJobs({})).map((j) => ({
    id: j.id, title: j.title, department: j.department,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Refer a candidate</h1>
      <Card>
        <CardTitle>About this referral</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Know someone who&apos;d be a great fit? Tell us about them and we&apos;ll reach out.
          You can track your referrals from your dashboard.
        </p>
        <div className="mt-4">
          <ReferForm openJobs={openJobs} />
        </div>
      </Card>
    </div>
  );
}
