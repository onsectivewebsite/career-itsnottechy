'use client';

import { useFormState } from 'react-dom';
import type { CustomQuestion } from '@/types/customQuestions';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CustomQuestionsEditor } from './CustomQuestionsEditor';

type Defaults = {
  title: string;
  department: string;
  locationType: string;
  locationCity: string;
  type: string;
  description: string;
  requirements: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  deadline: string;
  customQuestions: CustomQuestion[];
};

const blank: Defaults = {
  title: '', department: '', locationType: 'REMOTE', locationCity: '',
  type: 'FULL_TIME', description: '', requirements: '',
  salaryMin: '', salaryMax: '', currency: 'USD', deadline: '',
  customQuestions: [],
};

type FormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: true };

export function JobForm({
  defaults = blank,
  action,
  submitLabel,
}: {
  defaults?: Defaults;
  action: (prev: FormState | undefined, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, {} as FormState);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok  && <Alert tone="success">Saved.</Alert>}

      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={defaults.title} required className="mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="department">Department</Label>
          <Input id="department" name="department" defaultValue={defaults.department} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="type">Job type</Label>
          <select id="type" name="type" defaultValue={defaults.type} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="FULL_TIME">Full-time</option>
            <option value="PART_TIME">Part-time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERN">Intern</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="locationType">Location type</Label>
          <select id="locationType" name="locationType" defaultValue={defaults.locationType} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="REMOTE">Remote</option>
            <option value="ONSITE">Onsite</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>
        <div>
          <Label htmlFor="locationCity">City (for Onsite/Hybrid)</Label>
          <Input id="locationCity" name="locationCity" defaultValue={defaults.locationCity} className="mt-1" />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <textarea id="description" name="description" defaultValue={defaults.description} required rows={6}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div>
        <Label htmlFor="requirements">Requirements</Label>
        <textarea id="requirements" name="requirements" defaultValue={defaults.requirements} required rows={4}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="salaryMin">Salary min (optional)</Label>
          <Input id="salaryMin" name="salaryMin" type="number" defaultValue={defaults.salaryMin} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="salaryMax">Salary max (optional)</Label>
          <Input id="salaryMax" name="salaryMax" type="number" defaultValue={defaults.salaryMax} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" name="currency" maxLength={3} defaultValue={defaults.currency} className="mt-1" />
        </div>
      </div>

      <div>
        <Label htmlFor="deadline">Application deadline (optional)</Label>
        <Input id="deadline" name="deadline" type="date" defaultValue={defaults.deadline} className="mt-1" />
      </div>

      <div>
        <Label>Custom questions</Label>
        <p className="mt-1 text-xs text-slate-500">Optional &mdash; additional questions candidates must answer for this role.</p>
        <div className="mt-2">
          <CustomQuestionsEditor initialQuestions={defaults.customQuestions} />
        </div>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
