'use client';

import { useFormState } from 'react-dom';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { requestDocumentAction } from './requestDocumentAction';

type FormState = { error?: string; ok?: true };

export function RequestDocumentForm({ applicationId }: { applicationId: string }) {
  const bound = requestDocumentAction.bind(null, applicationId);
  const [state, formAction] = useFormState(bound, {} as FormState);

  return (
    <form action={formAction} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">Document requested. The candidate has been emailed.</Alert>}
      <div>
        <Label htmlFor="documentName">Document name</Label>
        <Input id="documentName" name="documentName" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="instructions">Instructions (optional)</Label>
        <textarea
          id="instructions"
          name="instructions"
          rows={2}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <Button type="submit" size="sm">Request document</Button>
    </form>
  );
}
