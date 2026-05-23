'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import Link from 'next/link';
import type { AppStage } from '@prisma/client';
import { STAGE_ORDER, STAGE_LABEL, STAGE_TONE } from '@/lib/ats/stages';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { BulkActionsBar } from '@/components/applicants/BulkActionsBar';
import { bulkStageAction, type BulkStageFormState } from '@/app/dashboard/hr/_actions/bulkStageAction';

export type AppRow = {
  id: string;
  stage: AppStage;
  createdAt: Date;
  candidate: { name: string; email: string };
};

export function BulkApplicantsByStage({ apps }: { apps: AppRow[] }) {
  const [state, formAction] = useFormState(bulkStageAction, {} as BulkStageFormState);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const byStage: Record<AppStage, AppRow[]> = {
    APPLIED: [], SCREENING: [], INTERVIEW: [], OFFER: [], HIRED: [], REJECTED: [],
  };
  for (const a of apps) byStage[a.stage].push(a);

  return (
    <form action={formAction} className="space-y-4">
      <BulkActionsBar selectedCount={selected.size} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok    && <Alert tone="success">{state.summary}</Alert>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {STAGE_ORDER.map((stage) => (
          <Card key={stage}>
            <div className="flex items-center justify-between">
              <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>
              <span className="text-xs text-slate-500">{byStage[stage].length}</span>
            </div>
            <ul className="mt-3 space-y-2">
              {byStage[stage].map((app) => (
                <li
                  key={app.id}
                  className="flex gap-2 rounded-md border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    name="applicationIds"
                    value={app.id}
                    checked={selected.has(app.id)}
                    onChange={() => toggle(app.id)}
                    aria-label={`Select ${app.candidate.name}`}
                    className="mt-1"
                  />
                  <Link href={`/dashboard/hr/applications/${app.id}`} className="flex-1 text-sm">
                    <div className="font-medium text-slate-900">{app.candidate.name}</div>
                    <div className="text-xs text-slate-500">{app.candidate.email}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Applied {new Date(app.createdAt).toISOString().slice(0, 10)}
                    </div>
                  </Link>
                </li>
              ))}
              {byStage[stage].length === 0 && (
                <li className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400">
                  No one here.
                </li>
              )}
            </ul>
          </Card>
        ))}
      </div>
    </form>
  );
}
