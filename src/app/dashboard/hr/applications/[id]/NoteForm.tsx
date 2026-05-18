'use client';

import { useFormState } from 'react-dom';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { addNoteAction } from '../actions';

type FormState = { error?: string; ok?: true };

export function NoteForm({ applicationId }: { applicationId: string }) {
  const boundAction = addNoteAction.bind(null, applicationId);
  const [state, formAction] = useFormState(boundAction, {} as FormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <textarea
        name="body"
        rows={3}
        placeholder="Add an internal note..."
        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        required
      />
      <Button type="submit" size="sm">Post note</Button>
    </form>
  );
}
