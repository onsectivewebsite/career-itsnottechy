'use client';

import { useState } from 'react';
import type { RequiredDocument } from '@/types/requiredDocuments';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';

let nextId = 1;
const newId = () => `doc${Date.now()}-${nextId++}`;

export function RequiredDocumentsEditor({
  initialDocuments = [],
}: {
  initialDocuments?: RequiredDocument[];
}) {
  const [docs, setDocs] = useState<RequiredDocument[]>(initialDocuments);

  function add() {
    setDocs([...docs, { id: newId(), name: '', required: true }]);
  }
  function update(idx: number, patch: Partial<RequiredDocument>) {
    setDocs(docs.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }
  function remove(idx: number) {
    setDocs(docs.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="requiredDocumentsJson" value={JSON.stringify(docs)} />
      {docs.map((d, idx) => (
        <div key={d.id} className="rounded-md border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-slate-500">Document</span>
            <button type="button" onClick={() => remove(idx)} className="text-xs text-red-600 hover:underline">
              Remove
            </button>
          </div>
          <div className="mt-2">
            <Label htmlFor={`docname-${d.id}`}>Document name</Label>
            <Input
              id={`docname-${d.id}`}
              value={d.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="mt-2">
            <Label htmlFor={`docinstr-${d.id}`}>Instructions (optional)</Label>
            <textarea
              id={`docinstr-${d.id}`}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              rows={2}
              value={d.instructions ?? ''}
              onChange={(e) => update(idx, { instructions: e.target.value })}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              id={`docreq-${d.id}`}
              type="checkbox"
              checked={d.required}
              onChange={(e) => update(idx, { required: e.target.checked })}
            />
            <Label htmlFor={`docreq-${d.id}`} className="!font-normal">Required to apply</Label>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={add}>+ Add document</Button>
    </div>
  );
}
