'use client';

import { useFormState } from 'react-dom';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { requestResetAction } from '../actions';

const initial: { error?: string; fieldErrors?: Record<string, string[]>; ok?: true } = {};

export function RequestForm() {
  const [state, formAction] = useFormState(requestResetAction, initial);

  if (state.ok) {
    return (
      <Alert tone="success">
        If an account exists with that email, a reset link is on the way. Check your inbox.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required
               className="mt-1" invalid={!!state.fieldErrors?.email} />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.email[0]}</p>
        )}
      </div>
      <Button type="submit" className="w-full">Send reset link</Button>
    </form>
  );
}
