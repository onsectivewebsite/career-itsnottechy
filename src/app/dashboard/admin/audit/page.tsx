import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { listAudit, listAuditActions } from '@/lib/services/auditService';
import { Card } from '@/components/ui/Card';

export const metadata = { title: 'Audit log · ItsNotTechy Careers' };

export default async function AuditPage({
  searchParams,
}: { searchParams: { action?: string; entityType?: string; page?: string } }) {
  requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const actions = await listAuditActions();
  const page = Math.max(parseInt(searchParams.page ?? '1', 10) || 1, 1);
  const result = await listAudit({
    action: searchParams.action || undefined,
    entityType: searchParams.entityType || undefined,
    page,
    pageSize: 50,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const baseParams: Record<string, string> = {};
  if (searchParams.action) baseParams.action = searchParams.action;
  if (searchParams.entityType) baseParams.entityType = searchParams.entityType;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin" className="text-sm text-brand-600 hover:underline">&larr; Dashboard</Link>
      <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>

      <form className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Action</label>
          <select name="action" defaultValue={searchParams.action ?? ''}
                  className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm">
            <option value="">All</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Entity</label>
          <input name="entityType" defaultValue={searchParams.entityType ?? ''}
                 className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm" placeholder="e.g., Job" />
        </div>
        <button className="rounded-md bg-brand-600 px-3 py-1 text-sm font-medium text-white">Filter</button>
        <Link href="/dashboard/admin/audit" className="text-sm text-slate-600 hover:underline">Clear</Link>
      </form>

      <Card>
        <p className="text-sm text-slate-500">{result.total} total · page {page} of {totalPages}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Actor</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Entity</th>
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-4 text-xs text-slate-500">{r.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
                  <td className="py-2 pr-4">{r.actor?.name ?? 'system'}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{r.action}</td>
                  <td className="py-2 pr-4">{r.entityType}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-500">{r.entityId.slice(0, 12)}…</td>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-500">{JSON.stringify(r.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`?${new URLSearchParams({ ...baseParams, page: String(page - 1) }).toString()}`}
                  className="text-brand-600 hover:underline">&larr; Prev</Link>
          ) : <span />}
          {page < totalPages ? (
            <Link href={`?${new URLSearchParams({ ...baseParams, page: String(page + 1) }).toString()}`}
                  className="text-brand-600 hover:underline">Next &rarr;</Link>
          ) : <span />}
        </div>
      </Card>
    </div>
  );
}
