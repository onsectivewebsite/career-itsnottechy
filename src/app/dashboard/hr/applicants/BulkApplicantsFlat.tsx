'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import Link from 'next/link';
import type { AppStage } from '@prisma/client';
import { STAGE_LABEL, STAGE_TONE } from '@/lib/ats/stages';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { BulkActionsBar } from '@/components/applicants/BulkActionsBar';
import { bulkStageAction, type BulkStageFormState } from '@/app/dashboard/hr/_actions/bulkStageAction';

export type AppFlatRow = {
  id: string;
  stage: AppStage;
  hasReferral: boolean;
  candidate: { name: string; email: string };
  job: { id: string; title: string };
};

export function BulkApplicantsFlat({ apps }: { apps: AppFlatRow[] }) {
  const [state, formAction] = useFormState(bulkStageAction, {} as BulkStageFormState);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <BulkActionsBar selectedCount={selected.size} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok    && <Alert tone="success">{state.summary}</Alert>}

      <Card>
        {apps.length === 0 ? (
          <p className="text-sm text-slate-600">No active applications.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {apps.map((app) => (
              <li key={app.id} className="flex items-center gap-3 py-3">
                <input
                  type="checkbox"
                  name="applicationIds"
                  value={app.id}
                  checked={selected.has(app.id)}
                  onChange={() => toggle(app.id)}
                  aria-label={`Select ${app.candidate.name}`}
                />
                <div className="flex-1">
                  <Link href={`/dashboard/hr/applications/${app.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {app.candidate.name}
                  </Link>
                  <div className="text-sm text-slate-500">
                    {app.candidate.email} · for{' '}
                    <Link href={`/dashboard/hr/jobs/${app.job.id}/applicants`} className="hover:underline">
                      {app.job.title}
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {app.hasReferral && <Badge tone="blue">Referred</Badge>}
                  <Badge tone={STAGE_TONE[app.stage]}>{STAGE_LABEL[app.stage]}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </form>
  );
}
