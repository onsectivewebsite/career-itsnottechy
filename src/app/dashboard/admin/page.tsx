import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';

export default async function AdminDashboard() {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name.split(' ')[0]}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>User management</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/dashboard/admin/users" className="text-brand-600 hover:underline">All users</Link>
          </p>
        </Card>
        <Card>
          <CardTitle>Audit log</CardTitle>
          <p className="mt-2 text-sm text-slate-600">Full viewer in Phase 7. Entries are being recorded now.</p>
        </Card>
        <Card>
          <CardTitle>Invite staff</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/dashboard/hr/invite" className="text-brand-600 hover:underline">
              Send a new invitation
            </Link>
          </p>
        </Card>
        <Card>
          <CardTitle>System settings</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/dashboard/admin/settings" className="text-brand-600 hover:underline">Edit settings</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
