'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { uploadDocumentAction } from '@/app/dashboard/candidate/uploadDocumentAction';

type FormState = { error?: string; ok?: true };

export function PendingDocumentUpload({
  documentId, label, instructions, jobTitle,
}: { documentId: string; label: string; instructions: string | null; jobTitle: string }) {
  const bound = uploadDocumentAction.bind(null, documentId);
  const [state, formAction] = useFormState(bound, {} as FormState);
  const [fileUrl, setFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('purpose', 'application-doc');
    fd.append('entityId', documentId);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setUploadError(json.error ?? 'Upload failed.');
        return;
      }
      setFileUrl(json.relativePath);
    } catch {
      setUploadError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      <p className="text-xs text-slate-500">For your application to {jobTitle}</p>
      {instructions && <p className="mt-1 text-xs text-slate-600">{instructions}</p>}
      {state.error && <div className="mt-2"><Alert tone="error">{state.error}</Alert></div>}
      <div className="mt-2">
        <Label htmlFor={`file-${documentId}`}>Choose file</Label>
        <input
          id={`file-${documentId}`}
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
          onChange={onFileChange}
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 hover:file:bg-brand-100"
        />
        {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
        {fileUrl && <p className="mt-1 text-xs text-green-700">Ready to submit.</p>}
        {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
        <input type="hidden" name="fileUrl" value={fileUrl} />
      </div>
      <div className="mt-2">
        <Button type="submit" size="sm" disabled={!fileUrl || uploading}>Submit document</Button>
      </div>
    </form>
  );
}
