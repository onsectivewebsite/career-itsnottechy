import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listForHr } from '@/lib/services/promotionService';
import { Card, CardTitle } from '@/components/ui/Card';
import { HrDecisionForm } from './HrDecisionForm';

export const metadata = { title: 'Promotion final-decision queue · ItsNotTechy Careers' };

export default async function HrPromotionsPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const list = await listForHr();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/hr" className="text-sm text-brand-600 hover:underline">&larr; Dashboard</Link>
      <h1 className="text-2xl font-bold text-slate-900">Promotion final decisions</h1>
      <p className="text-sm text-slate-500">{list.length} request{list.length === 1 ? '' : 's'} awaiting HR sign-off.</p>

      {list.length === 0 ? (
        <Card><p className="text-sm text-slate-600">No requests in the HR queue.</p></Card>
      ) : (
        <div className="space-y-4">
          {list.map((p) => (
            <Card key={p.id}>
              <CardTitle>{p.employee.name} — {p.currentTitle} → {p.targetTitle}</CardTitle>
              <dl className="mt-3 space-y-1 text-sm text-slate-700">
                <div>
                  <dt className="inline font-medium">Manager: </dt>
                  <dd className="inline">{p.manager.name} ({p.manager.email})</dd>
                </div>
                {p.managerNotes && (
                  <div><dt className="block font-medium">Manager notes</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{p.managerNotes}</dd></div>
                )}
                <div><dt className="block font-medium">Justification</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{p.justification}</dd></div>
                {p.supportingDocUrl && (
                  <div>
                    <a className="text-brand-600 hover:underline" href={`/api/files/${p.supportingDocUrl}`} target="_blank" rel="noreferrer">
                      Supporting document
                    </a>
                  </div>
                )}
              </dl>
              <HrDecisionForm promotionId={p.id} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
