import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listActiveApplicationsForHr } from '@/lib/services/atsService';
import { BulkApplicantsFlat, type AppFlatRow } from './BulkApplicantsFlat';

export default async function HrApplicantsPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const apps = await listActiveApplicationsForHr();

  const rows: AppFlatRow[] = apps.map((a) => ({
    id: a.id,
    stage: a.stage,
    hasReferral: a.referral !== null,
    candidate: { name: a.candidate.name, email: a.candidate.email },
    job: { id: a.job.id, title: a.job.title },
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Active applicants</h1>
      <p className="text-sm text-slate-500">{apps.length} active application{apps.length === 1 ? '' : 's'} across all open jobs.</p>

      <BulkApplicantsFlat apps={rows} />
    </div>
  );
}
