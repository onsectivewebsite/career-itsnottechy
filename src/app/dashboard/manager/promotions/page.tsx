import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listForManager } from '@/lib/services/promotionService';
import { Card, CardTitle } from '@/components/ui/Card';
import { ManagerDecisionForm } from './ManagerDecisionForm';

export const metadata = { title: 'Promotion inbox · ItsNotTechy Careers' };

export default async function ManagerPromotionsPage() {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'MANAGER']);
  const list = await listForManager(user.id);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/manager" className="text-sm text-brand-600 hover:underline">&larr; Dashboard</Link>
      <h1 className="text-2xl font-bold text-slate-900">Promotion inbox</h1>
      <p className="text-sm text-slate-500">{list.length} awaiting your decision.</p>

      {list.length === 0 ? (
        <Card><p className="text-sm text-slate-600">No requests awaiting your decision.</p></Card>
      ) : (
        <div className="space-y-4">
          {list.map((p) => (
            <Card key={p.id}>
              <CardTitle>{p.employee.name} — {p.currentTitle} → {p.targetTitle}</CardTitle>
              <dl className="mt-3 space-y-1 text-sm text-slate-700">
                <div><dt className="inline font-medium">Submitted: </dt><dd className="inline">{p.createdAt.toISOString().slice(0, 10)}</dd></div>
                <div><dt className="block font-medium">Justification</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{p.justification}</dd></div>
                {p.supportingDocUrl && (
                  <div>
                    <a className="text-brand-600 hover:underline" href={`/api/files/${p.supportingDocUrl}`} target="_blank" rel="noreferrer">
                      Supporting document
                    </a>
                  </div>
                )}
              </dl>
              <ManagerDecisionForm promotionId={p.id} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
