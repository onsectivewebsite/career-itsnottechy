'use client';

import { useState, useTransition } from 'react';
import { setJobAlertsAction } from './jobAlertActions';

export function JobAlertsToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    startTransition(async () => {
      const r = await setJobAlertsAction(next);
      if (r.ok) setEnabled(next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={enabled}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        enabled
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {enabled ? 'Alerts on' : 'Alerts off'}
    </button>
  );
}
