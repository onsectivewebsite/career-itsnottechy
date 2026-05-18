'use client';

import { useFormState } from 'react-dom';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { registerCandidateAction } from '../actions';

const initial: { error?: string; fieldErrors?: Record<string, string[]>; ok?: true } = {};

export function RegisterForm() {
  const [state, formAction] = useFormState(registerCandidateAction, initial);
  const router = useRouter();

  useEffect(() => {
    if (!state.ok) return;
    // Auto-sign-in using the values still in the form, then route to dashboard.
    const form = document.querySelector<HTMLFormElement>('form#register-form');
    if (!form) return;
    const fd = new FormData(form);
    void signIn('credentials', {
      email: String(fd.get('email')),
      password: String(fd.get('password')),
      redirect: false,
    }).then((res) => {
      if (res && !res.error) {
        router.replace('/dashboard/candidate');
        router.refresh();
      }
    });
  }, [state, router]);

  return (
    <form id="register-form" action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" required className="mt-1"
               invalid={!!state.fieldErrors?.name} />
        {state.fieldErrors?.name && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.name[0]}</p>
        )}
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="mt-1"
               invalid={!!state.fieldErrors?.email} />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.email[0]}</p>
        )}
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required className="mt-1"
               invalid={!!state.fieldErrors?.password} />
        {state.fieldErrors?.password && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.password[0]}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">At least 10 characters, with upper, lower, and a number.</p>
      </div>
      <Button type="submit" className="w-full">Create account</Button>
    </form>
  );
}
