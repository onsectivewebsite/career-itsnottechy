'use client';

import { useFormState } from 'react-dom';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { acceptInviteAction } from '../../actions';

const initial: { error?: string; fieldErrors?: Record<string, string[]>; ok?: true } = {};

export function AcceptForm({ token }: { token: string }) {
  const [state, formAction] = useFormState(acceptInviteAction, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.replace('/login?accepted=1');
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required
               className="mt-1" invalid={!!state.fieldErrors?.password} />
        {state.fieldErrors?.password && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.password[0]}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">At least 10 characters, with upper, lower, and a number.</p>
      </div>
      <Button type="submit" className="w-full">Activate account</Button>
    </form>
  );
}
