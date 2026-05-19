'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { submitPromotionAction } from './actions';

type FormState = { error?: string; fieldErrors?: Record<string, string[]> };

export function PromotionForm({ defaultCurrentTitle }: { defaultCurrentTitle: string }) {
  const [state, formAction] = useFormState(submitPromotionAction, {} as FormState);
  const [supportingDocUrl, setSupportingDocUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('purpose', 'supporting-doc');
    fd.append('entityId', 'promotion');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) { setUploadError(json.error ?? 'Upload failed.'); return; }
      setSupportingDocUrl(json.relativePath);
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
        <Label htmlFor="currentTitle">Current title</Label>
        <Input id="currentTitle" name="currentTitle" required defaultValue={defaultCurrentTitle} className="mt-1" />
        {state.fieldErrors?.currentTitle && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.currentTitle[0]}</p>}
      </div>

      <div>
        <Label htmlFor="targetTitle">Target title</Label>
        <Input id="targetTitle" name="targetTitle" required className="mt-1" placeholder="e.g. Senior Engineer" />
        {state.fieldErrors?.targetTitle && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.targetTitle[0]}</p>}
      </div>

      <div>
        <Label htmlFor="justification">Justification</Label>
        <textarea id="justification" name="justification" rows={6} required minLength={20}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="What have you done? What impact have you had? Why is this the right next step?" />
        {state.fieldErrors?.justification && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.justification[0]}</p>}
      </div>

      <div>
        <Label htmlFor="supportingDoc">Supporting document (optional, PDF)</Label>
        <input
          id="supportingDoc" type="file" accept=".pdf,application/pdf"
          onChange={onFileChange}
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 hover:file:bg-brand-100"
        />
        {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
        {supportingDocUrl && <p className="mt-1 text-xs text-green-700">Uploaded.</p>}
        {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
        <input type="hidden" name="supportingDocUrl" value={supportingDocUrl} />
      </div>

      <Button type="submit" disabled={uploading}>Submit request</Button>
    </form>
  );
}
