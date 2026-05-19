import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listMine } from '@/lib/services/promotionService';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';

const STATUS_TONE = {
  PENDING_MANAGER: 'neutral', PENDING_HR: 'blue', APPROVED: 'green', REJECTED: 'red',
} as const;

const STATUS_LABEL = {
  PENDING_MANAGER: 'Awaiting manager', PENDING_HR: 'Awaiting HR',
  APPROVED: 'Approved', REJECTED: 'Rejected',
} as const;

export default async function MyPromotionsPage({
  searchParams,
}: { searchParams: { submitted?: string } }) {
  const user = requireAnyRole(await getSessionUser(), ['MANAGER', 'EMPLOYEE']);
  const list = await listMine(user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My promotion requests</h1>
        <Link href="/dashboard/employee/promotions/new"
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          + New request
        </Link>
      </div>

      {searchParams.submitted === '1' && (
        <Alert tone="success">Request submitted. Your manager has been notified.</Alert>
      )}

      <Card>
        <CardTitle>{list.length} request{list.length === 1 ? '' : 's'}</CardTitle>
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No promotion requests yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {list.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">
                      {p.currentTitle} → {p.targetTitle}
                    </div>
                    <div className="text-sm text-slate-500">
                      Manager: {p.manager.name} · Submitted {p.createdAt.toISOString().slice(0, 10)}
                    </div>
                    {p.managerNotes && (
                      <div className="mt-1 text-xs text-slate-500">
                        <span className="font-semibold">Manager notes:</span> {p.managerNotes}
                      </div>
                    )}
                    {p.hrNotes && (
                      <div className="mt-1 text-xs text-slate-500">
                        <span className="font-semibold">HR notes:</span> {p.hrNotes}
                      </div>
                    )}
                  </div>
                  <Badge tone={STATUS_TONE[p.finalStatus]}>{STATUS_LABEL[p.finalStatus]}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
