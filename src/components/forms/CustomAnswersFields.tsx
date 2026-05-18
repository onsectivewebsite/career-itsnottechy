'use client';

import { useState } from 'react';
import type { CustomQuestion } from '@/types/customQuestions';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

export function CustomAnswersFields({ questions }: { questions: CustomQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  function update(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  if (questions.length === 0) {
    return <input type="hidden" name="customAnswersJson" value="{}" />;
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="customAnswersJson" value={JSON.stringify(answers)} />
      {questions.map((q) => (
        <div key={q.id}>
          <Label htmlFor={`q-${q.id}`}>
            {q.label}
            {q.required && <span className="text-red-600"> *</span>}
          </Label>
          {q.type === 'SHORT_TEXT' && (
            <Input
              id={`q-${q.id}`}
              required={q.required}
              value={answers[q.id] ?? ''}
              onChange={(e) => update(q.id, e.target.value)}
              className="mt-1"
            />
          )}
          {q.type === 'LONG_TEXT' && (
            <textarea
              id={`q-${q.id}`}
              required={q.required}
              rows={4}
              value={answers[q.id] ?? ''}
              onChange={(e) => update(q.id, e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          )}
          {q.type === 'YES_NO' && (
            <select
              id={`q-${q.id}`}
              required={q.required}
              value={answers[q.id] ?? ''}
              onChange={(e) => update(q.id, e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              <option value="YES">Yes</option>
              <option value="NO">No</option>
            </select>
          )}
          {q.type === 'SINGLE_CHOICE' && (
            <select
              id={`q-${q.id}`}
              required={q.required}
              value={answers[q.id] ?? ''}
              onChange={(e) => update(q.id, e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {q.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}
