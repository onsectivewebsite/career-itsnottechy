'use client';

import { useFormState } from 'react-dom';
import type { AppStage } from '@prisma/client';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { FORWARD, STAGE_ACTION_LABEL } from '@/lib/ats/stages';
import { moveStageAction } from '../actions';

type FormState = { error?: string; ok?: true };

export function StageActions({
  applicationId, jobId, currentStage,
}: { applicationId: string; jobId: string; currentStage: AppStage }) {
  const boundAction = moveStageAction.bind(null, applicationId, jobId);
  const [state, formAction] = useFormState(boundAction, {} as FormState);
  const next = FORWARD[currentStage];

  if (next.length === 0) {
    return <p className="text-sm text-slate-500">No further transitions from this stage.</p>;
  }

  return (
    <div className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {next.map((stage) => (
          <form key={stage} action={formAction}>
            <input type="hidden" name="toStage" value={stage} />
            <Button
              type="submit"
              variant={stage === 'REJECTED' ? 'danger' : 'primary'}
              size="sm"
            >
              {STAGE_ACTION_LABEL[stage]}
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}
