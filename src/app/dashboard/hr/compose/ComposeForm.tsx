'use client';

import { useFormState } from 'react-dom';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { interpolate } from '@/lib/email/interpolate';
import { sendCustomEmailComposeAction } from './actions';

type FormState = { error?: string; ok?: true };

export type CandidateOption = { id: string; name: string; email: string };
export type JobOption       = { id: string; title: string };
export type TemplateOption  = { id: string; name: string; subject: string; body: string };

export function ComposeForm({
  candidates,
  jobs,
  templates,
  appUrl,
}: {
  candidates: CandidateOption[];
  jobs: JobOption[];
  templates: TemplateOption[];
  appUrl: string;
}) {
  const [state, formAction] = useFormState(sendCustomEmailComposeAction, {} as FormState);

  const [candidateId, setCandidateId] = useState('');
  const [jobId, setJobId]             = useState('');
  const [selectedId, setSelectedId]   = useState('');

  const vars = useMemo(() => {
    const c = candidates.find((x) => x.id === candidateId);
    const j = jobs.find((x) => x.id === jobId);
    return {
      candidateName: c?.name ?? '',
      jobTitle:      j?.title ?? '',
      stageLabel:    '',
      dashboardUrl:  `${appUrl}/dashboard/candidate`,
    };
  }, [candidateId, jobId, candidates, jobs, appUrl]);

  const selected = templates.find((t) => t.id === selectedId);
  const interpolatedSubject = selected ? interpolate(selected.subject, vars) : '';
  const interpolatedBody    = selected ? interpolate(selected.body,    vars) : '';

  const [subject, setSubject] = useState('');

  function onTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedId(id);
    const t = templates.find((x) => x.id === id);
    setSubject(t ? interpolate(t.subject, vars) : '');
  }

  // When the candidate/job changes after a template is chosen, re-fill the subject too.
  function onCandidateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setCandidateId(e.target.value);
    if (selected) setSubject(interpolate(selected.subject, {
      ...vars,
      candidateName: candidates.find((x) => x.id === e.target.value)?.name ?? '',
    }));
  }
  function onJobChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setJobId(e.target.value);
    if (selected) setSubject(interpolate(selected.subject, {
      ...vars,
      jobTitle: jobs.find((x) => x.id === e.target.value)?.title ?? '',
    }));
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok  && <Alert tone="success">Email sent.</Alert>}

      <div>
        <Label htmlFor="candidateUserId">Candidate</Label>
        <select
          id="candidateUserId"
          name="candidateUserId"
          value={candidateId}
          onChange={onCandidateChange}
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">— Pick a candidate —</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.name} · {c.email}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="jobId">Job (optional)</Label>
        <select
          id="jobId"
          value={jobId}
          onChange={onJobChange}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">— None —</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
      </div>

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
        <div className="mt-1">
          <RichTextEditor
            key={`${selectedId}-${candidateId}-${jobId}` || 'blank'}
            name="body"
            initialHtml={interpolatedBody}
          />
        </div>
      </div>

      <Button type="submit">Send email</Button>
    </form>
  );
}
