import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { Card, CardTitle } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { InviteForm } from './InviteForm';

export const metadata = { title: 'Invite staff · ItsNotTechy Careers' };

export default async function InviteStaffPage({
  searchParams,
}: { searchParams: { sent?: string } }) {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const managerCandidates = await prisma.employee.findMany({
    where: { user: { role: { in: ['HR_MANAGER', 'MANAGER'] }, isActive: true } },
    select: { id: true, user: { select: { name: true } } },
    orderBy: { user: { name: 'asc' } },
  });
  const managers = managerCandidates.map((e) => ({ id: e.id, name: e.user.name }));

  return (
    <div className="space-y-6">
      <Link href="/dashboard/hr" className="text-sm text-brand-600 hover:underline">&larr; Dashboard</Link>
      <h1 className="text-2xl font-bold text-slate-900">Invite staff</h1>

      {searchParams.sent === '1' && (
        <Alert tone="success">Invitation sent. They&apos;ll receive an email with a setup link.</Alert>
      )}

      <Card>
        <CardTitle>New staff member</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          The invitee receives an email; the link is valid for 7 days. After accepting, they set their own password.
        </p>
        <div className="mt-4">
          <InviteForm managers={managers} />
        </div>
      </Card>
    </div>
  );
}
