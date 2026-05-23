'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { interpolate } from '@/lib/email/interpolate';
import { sendCustomEmailAction } from './sendEmailAction';

type FormState = { error?: string; ok?: true };

export type TemplateOption = { id: string; name: string; subject: string; body: string };
export type EmailVars = {
  candidateName: string;
  jobTitle: string;
  stageLabel: string;
  dashboardUrl: string;
};

export function SendEmailForm({
  applicationId,
  templates,
  vars,
}: {
  applicationId: string;
  templates: TemplateOption[];
  vars: EmailVars;
}) {
  const bound = sendCustomEmailAction.bind(null, applicationId);
  const [state, formAction] = useFormState(bound, {} as FormState);

  const [selectedId, setSelectedId] = useState<string>('');
  const selected = templates.find((t) => t.id === selectedId);
  const initialSubject = selected ? interpolate(selected.subject, vars as unknown as Record<string, string>) : '';
  const initialBody    = selected ? interpolate(selected.body,    vars as unknown as Record<string, string>) : '';
  const [subject, setSubject] = useState(initialSubject);

  function onTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedId(id);
    const t = templates.find((x) => x.id === id);
    setSubject(t ? interpolate(t.subject, vars as unknown as Record<string, string>) : '');
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok  && <Alert tone="success">Email sent.</Alert>}

      <div>
        <Label htmlFor="template">Template</Label>
        <select
          id="template"
          value={selectedId}
          onChange={onTemplateChange}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">— Blank —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input type="hidden" name="sourceTemplateId" value={selectedId} />
      </div>

      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label>Body</Label>
        {/* Keyed by selected template id so picking a new template re-mounts
            the editor with the interpolated body. */}
        <div className="mt-1">
          <RichTextEditor key={selectedId || 'blank'} name="body" initialHtml={initialBody} />
        </div>
      </div>

      <Button type="submit">Send email</Button>
    </form>
  );
}
