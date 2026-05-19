'use client';

import { useFormState } from 'react-dom';
import { managerDecisionAction, type DecisionFormState } from './managerDecisionAction';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

export function ManagerDecisionForm({ promotionId }: { promotionId: string }) {
  const [state, formAction] = useFormState(managerDecisionAction, {} as DecisionFormState);
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="promotionId" value={promotionId} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">Decision recorded.</Alert>}
      <textarea
        name="notes" rows={2} placeholder="Notes (optional)"
        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" name="decision" value="APPROVED" variant="primary">Approve</Button>
        <Button type="submit" name="decision" value="REJECTED" variant="danger">Reject</Button>
      </div>
    </form>
  );
}
