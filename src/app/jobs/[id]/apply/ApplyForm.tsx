'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import type { CustomQuestion } from '@/types/customQuestions';
import type { RequiredDocument } from '@/types/requiredDocuments';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CustomAnswersFields } from '@/components/forms/CustomAnswersFields';
import { submitApplicationAction } from './actions';

type FormState = { error?: string; ok?: true };

export function ApplyForm({
  jobId, questions, requiredDocuments,
}: { jobId: string; questions: CustomQuestion[]; requiredDocuments: RequiredDocument[] }) {
  const boundAction = submitApplicationAction.bind(null, jobId);
  const [state, formAction] = useFormState(boundAction, {} as FormState);
  const [resumeUrl, setResumeUrl] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});

  async function onDocChange(docId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('purpose', 'application-doc');
    fd.append('entityId', jobId);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setUploadError(json.error ?? 'Upload failed.');
        return;
      }
      setDocUrls((prev) => ({ ...prev, [docId]: json.relativePath }));
    } catch {
      setUploadError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  const missingRequired = requiredDocuments.some((d) => d.required && !docUrls[d.id]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('purpose', 'resume');
    fd.append('entityId', jobId);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setUploadError(json.error ?? 'Upload failed.');
        return;
      }
      setResumeUrl(json.relativePath);
    } catch {
      setUploadError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <div>
        <Label htmlFor="resume">Resume (PDF or DOC)</Label>
        <input
          id="resume"
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={onFileChange}
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 hover:file:bg-brand-100"
          required
        />
        {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
        {resumeUrl && <p className="mt-1 text-xs text-green-700">Uploaded.</p>}
        {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
        <input type="hidden" name="resumeUrl" value={resumeUrl} />
      </div>

      <div>
        <Label htmlFor="coverLetter">Cover letter (optional)</Label>
        <textarea
          id="coverLetter"
          name="coverLetter"
          rows={5}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {requiredDocuments.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-slate-900">Required documents</p>
          {requiredDocuments.map((d) => (
            <div key={d.id}>
              <Label htmlFor={`doc-${d.id}`}>
                {d.name}{d.required ? '' : ' (optional)'}
              </Label>
              {d.instructions && <p className="text-xs text-slate-500">{d.instructions}</p>}
              <input
                id={`doc-${d.id}`}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
                onChange={(e) => onDocChange(d.id, e)}
                className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 hover:file:bg-brand-100"
              />
              {docUrls[d.id] && <p className="mt-1 text-xs text-green-700">Uploaded.</p>}
            </div>
          ))}
        </div>
      )}
      <input type="hidden" name="documentsJson" value={JSON.stringify(docUrls)} />

      <CustomAnswersFields questions={questions} />

      <Button type="submit" disabled={!resumeUrl || uploading || missingRequired}>
        {uploading ? 'Uploading…' : 'Submit application'}
      </Button>
    </form>
  );
}
