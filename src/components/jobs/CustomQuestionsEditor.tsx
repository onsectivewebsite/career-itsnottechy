'use client';

import { useState } from 'react';
import type { CustomQuestion } from '@/types/customQuestions';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';

let nextId = 1;
const newId = () => `q${Date.now()}-${nextId++}`;

const TYPE_LABEL: Record<CustomQuestion['type'], string> = {
  SHORT_TEXT: 'Short text',
  LONG_TEXT: 'Long text',
  YES_NO: 'Yes / No',
  SINGLE_CHOICE: 'Single choice',
};

export function CustomQuestionsEditor({
  initialQuestions = [],
}: {
  initialQuestions?: CustomQuestion[];
}) {
  const [questions, setQuestions] = useState<CustomQuestion[]>(initialQuestions);

  function add(type: CustomQuestion['type']) {
    const base = { id: newId(), label: '', required: false };
    if (type === 'SINGLE_CHOICE') {
      setQuestions([...questions, { ...base, type, options: ['Option A', 'Option B'] }]);
    } else {
      setQuestions([...questions, { ...base, type }]);
    }
  }

  function update(idx: number, patch: Partial<CustomQuestion>) {
    setQuestions(questions.map((q, i) => (i === idx ? { ...q, ...patch } as CustomQuestion : q)));
  }

  function remove(idx: number) {
    setQuestions(questions.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="customQuestionsJson" value={JSON.stringify(questions)} />
      {questions.map((q, idx) => (
        <div key={q.id} className="rounded-md border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-slate-500">{TYPE_LABEL[q.type]}</span>
            <button type="button" onClick={() => remove(idx)} className="text-xs text-red-600 hover:underline">
              Remove
            </button>
          </div>
          <div className="mt-2">
            <Label htmlFor={`label-${q.id}`}>Question</Label>
            <Input id={`label-${q.id}`} value={q.label} onChange={(e) => update(idx, { label: e.target.value })} className="mt-1" />
          </div>
          {q.type === 'SINGLE_CHOICE' && (
            <div className="mt-2">
              <Label>Options (one per line)</Label>
              <textarea
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                value={q.options.join('\n')}
                onChange={(e) => update(idx, { options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input id={`req-${q.id}`} type="checkbox" checked={q.required} onChange={(e) => update(idx, { required: e.target.checked })} />
            <Label htmlFor={`req-${q.id}`} className="!font-normal">Required</Label>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => add('SHORT_TEXT')}>+ Short text</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => add('LONG_TEXT')}>+ Long text</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => add('YES_NO')}>+ Yes/No</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => add('SINGLE_CHOICE')}>+ Single choice</Button>
      </div>
    </div>
  );
}
