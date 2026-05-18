'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export function JobFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(key, value); else params.delete(key);
      router.push(`/jobs?${params.toString()}`);
    },
    [router, sp],
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-slate-500">Search</label>
        <input
          defaultValue={sp.get('q') ?? ''}
          onBlur={(e) => update('q', e.target.value)}
          placeholder="Title or keyword"
          className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Department</label>
        <input
          defaultValue={sp.get('department') ?? ''}
          onBlur={(e) => update('department', e.target.value)}
          className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Location</label>
        <select
          defaultValue={sp.get('locationType') ?? ''}
          onChange={(e) => update('locationType', e.target.value)}
          className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Any</option>
          <option value="REMOTE">Remote</option>
          <option value="ONSITE">Onsite</option>
          <option value="HYBRID">Hybrid</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500">Type</label>
        <select
          defaultValue={sp.get('type') ?? ''}
          onChange={(e) => update('type', e.target.value)}
          className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Any</option>
          <option value="FULL_TIME">Full-time</option>
          <option value="PART_TIME">Part-time</option>
          <option value="CONTRACT">Contract</option>
          <option value="INTERN">Intern</option>
        </select>
      </div>
    </div>
  );
}
