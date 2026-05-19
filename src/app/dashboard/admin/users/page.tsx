import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { listUsers } from '@/lib/services/adminUserService';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { UserRowActions } from './UserRowActions';

export const metadata = { title: 'Users · ItsNotTechy Careers' };

const ROLE_TONE = {
  SUPER_ADMIN: 'red', HR_MANAGER: 'blue', MANAGER: 'amber',
  EMPLOYEE: 'neutral', CANDIDATE: 'green',
} as const;

export default async function UsersPage() {
  requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const users = await listUsers();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin" className="text-sm text-brand-600 hover:underline">&larr; Dashboard</Link>
      <h1 className="text-2xl font-bold text-slate-900">Users</h1>
      <p className="text-sm text-slate-500">{users.length} total.</p>

      <Card>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Department</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? '' : 'opacity-50'}>
                <td className="py-3 pr-4 font-medium text-slate-900">{u.name}</td>
                <td className="py-3 pr-4 text-slate-600">{u.email}</td>
                <td className="py-3 pr-4"><Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge></td>
                <td className="py-3 pr-4">{u.isActive ? 'Active' : 'Deactivated'}</td>
                <td className="py-3 pr-4 text-slate-600">{u.employee?.department ?? '—'}</td>
                <td className="py-3 pr-4"><UserRowActions userId={u.id} role={u.role} isActive={u.isActive} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
