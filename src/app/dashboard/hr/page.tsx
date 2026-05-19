import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';
import { MyInterviewsWidget } from '@/components/MyInterviewsWidget';

export default async function HRDashboard() {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name.split(' ')[0]}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card><CardTitle>Job postings</CardTitle><p className="mt-2 text-sm text-slate-600">Phase 2.</p></Card>
        <Card><CardTitle>Applicants</CardTitle><p className="mt-2 text-sm text-slate-600">Phase 3.</p></Card>
        <Card><CardTitle>Referrals</CardTitle><p className="mt-2 text-sm text-slate-600">Phase 4.</p></Card>
        <MyInterviewsWidget userId={user.id} canSeeHrApplication />
        <Card><CardTitle>Promotions</CardTitle><p className="mt-2 text-sm text-slate-600">Phase 6.</p></Card>
        <Card><CardTitle>Invite staff</CardTitle><p className="mt-2 text-sm text-slate-600">UI in Phase 7.</p></Card>
      </div>
    </div>
  );
}
