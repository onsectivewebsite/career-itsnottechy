'use client';

import { useFormState } from 'react-dom';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { RichTextEditor } from '@/components/ui/RichTextEditor';

type FormState = { error?: string; ok?: true };

export function EmailTemplateForm({
  defaults,
  action,
  submitLabel,
}: {
  defaults: { name: string; subject: string; body: string };
  action: (prev: FormState | undefined, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, {} as FormState);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok  && <Alert tone="success">Saved.</Alert>}

      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={defaults.name} required className="mt-1" />
        <p className="mt-1 text-xs text-slate-500">Shown in the picker on the send form. Must be unique.</p>
      </div>

      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" defaultValue={defaults.subject} required className="mt-1" />
        <p className="mt-1 text-xs text-slate-500">
          Supports variables: <code>{'{{candidateName}}'}</code>, <code>{'{{jobTitle}}'}</code>, <code>{'{{stageLabel}}'}</code>.
        </p>
      </div>

      <div>
        <Label>Body</Label>
        <div className="mt-1">
          <RichTextEditor name="body" initialHtml={defaults.body} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Same variables work in the body. <code>{'{{dashboardUrl}}'}</code> is also available.
        </p>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
