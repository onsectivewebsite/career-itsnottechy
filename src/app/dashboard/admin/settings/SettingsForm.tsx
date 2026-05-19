'use client';

import { useFormState } from 'react-dom';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { updateSettingsAction, type SettingsFormState } from './actions';

export function SettingsForm({ initial }: { initial: { companyName: string; defaultSenderName: string } }) {
  const [state, formAction] = useFormState(updateSettingsAction, {} as SettingsFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.ok && <Alert tone="success">Settings saved.</Alert>}
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <div>
        <Label htmlFor="companyName">Company name</Label>
        <Input id="companyName" name="companyName" required defaultValue={initial.companyName} className="mt-1" />
        {state.fieldErrors?.companyName && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.companyName[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="defaultSenderName">Default email sender name</Label>
        <Input id="defaultSenderName" name="defaultSenderName" required defaultValue={initial.defaultSenderName} className="mt-1" />
        <p className="mt-1 text-xs text-slate-500">
          The display name on outgoing emails (overridable by the SMTP_FROM_NAME env var if set).
        </p>
        {state.fieldErrors?.defaultSenderName && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.defaultSenderName[0]}</p>
        )}
      </div>

      <Button type="submit">Save</Button>
    </form>
  );
}
