'use client';

import { STAGE_LABEL, STAGE_ORDER } from '@/lib/ats/stages';
import { Button } from '@/components/ui/Button';

/**
 * The bulk-action controls rendered inside the per-page <form>.
 * Buttons submit the surrounding form with name=bulkAction value=<advance|reject|set>.
 * Reject is gated by window.confirm to prevent accidents.
 */
export function BulkActionsBar({ selectedCount }: { selectedCount: number }) {
  const disabled = selectedCount === 0;

  function confirmReject(e: React.MouseEvent<HTMLButtonElement>) {
    const ok = window.confirm(
      `Reject ${selectedCount} application${selectedCount === 1 ? '' : 's'}? This can only be reversed by moving them back to another stage manually.`,
    );
    if (!ok) e.preventDefault();
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-sm font-medium text-slate-900">
        {selectedCount === 0 ? 'Select applicants to act on them' : `${selectedCount} selected`}
      </span>

      <Button type="submit" name="bulkAction" value="advance" size="sm" disabled={disabled}>
        Advance
      </Button>

      <Button
        type="submit"
        name="bulkAction"
        value="reject"
        size="sm"
        variant="danger"
        disabled={disabled}
        onClick={confirmReject}
      >
        Reject
      </Button>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Move to:</span>
        <select
          name="toStage"
          defaultValue=""
          disabled={disabled}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
        >
          <option value="" disabled>— pick stage —</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>{STAGE_LABEL[s]}</option>
          ))}
        </select>
        <Button type="submit" name="bulkAction" value="set" size="sm" variant="secondary" disabled={disabled}>
          Move
        </Button>
      </div>
    </div>
  );
}
