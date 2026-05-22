'use client';

import { useState, useTransition } from 'react';
import { toggleSavedJobAction } from '@/app/jobs/savedJobActions';

export function SaveJobButton({ jobId, initialSaved }: { jobId: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const r = await toggleSavedJobAction(jobId);
      if (r.ok) setSaved(r.saved);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      className={`shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        saved
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {saved ? '★ Saved' : '☆ Save'}
    </button>
  );
}
