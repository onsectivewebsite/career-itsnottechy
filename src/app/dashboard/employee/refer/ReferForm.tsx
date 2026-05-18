'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { submitReferralAction } from './actions';

type FormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: true };

export function ReferForm({
  openJobs,
}: {
  openJobs: { id: string; title: string; department: string }[];
}) {
  const [state, formAction] = useFormState(submitReferralAction, {} as FormState);
  const [resumeUrl, setResumeUrl] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('purpose', 'supporting-doc');
    fd.append('entityId', 'referral');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setUploadError(json.error ?? 'Upload failed.');
        return;
      }
      setResumeUrl(json.relativePath);
    } catch {
      setUploadError('Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <div>
        <Label htmlFor="jobId">Role</Label>
        <select
          id="jobId" name="jobId" required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select an open role…</option>
          {openJobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title} ({j.department})</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="candidateName">Candidate name</Label>
        <Input id="candidateName" name="candidateName" required className="mt-1" />
        {state.fieldErrors?.candidateName && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.candidateName[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="candidateEmail">Candidate email</Label>
        <Input id="candidateEmail" name="candidateEmail" type="email" required className="mt-1" />
        {state.fieldErrors?.candidateEmail && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.candidateEmail[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="relationship">How do you know them?</Label>
        <Input id="relationship" name="relationship" required placeholder="Former colleague at Acme, friend from school, etc."
               className="mt-1" />
        {state.fieldErrors?.relationship && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.relationship[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="resume">Resume (optional)</Label>
        <input
          id="resume"
          type="file"
          accept=".pdf,application/pdf"
          onChange={onFileChange}
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 hover:file:bg-brand-100"
        />
        {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
        {resumeUrl && <p className="mt-1 text-xs text-green-700">Uploaded.</p>}
        {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
        <input type="hidden" name="resumeUrl" value={resumeUrl} />
      </div>

      <Button type="submit" disabled={uploading}>Submit referral</Button>
    </form>
  );
}
