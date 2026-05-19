'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { scheduleInterviewAction, type ScheduleFormState } from './scheduleInterviewAction';

type Staff = { id: string; name: string; email: string };

export function ScheduleInterviewForm({
  applicationId,
  staffUsers,
}: {
  applicationId: string;
  staffUsers: Staff[];
}) {
  const [state, formAction] = useFormState(scheduleInterviewAction, {} as ScheduleFormState);
  const [scheduledAtIso, setScheduledAtIso] = useState('');

  const ok = 'ok' in state && state.ok === true;
  const error = 'error' in state ? state.error : undefined;
  const conflicts = 'conflicts' in state ? state.conflicts : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="applicationId" value={applicationId} />

      {ok && <Alert tone="success">Interview scheduled. Emails are out.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {conflicts && conflicts.length > 0 && (
        <Alert tone="warning">
          <div className="font-medium">Conflicting interviews:</div>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {conflicts.map((c) => (
              <li key={c.id}>
                {new Date(c.scheduledAt).toUTCString()} · {c.durationMinutes} min
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="scheduledAt">When (your local time)</Label>
          <Input
            id="scheduledAt"
            type="datetime-local"
            required
            className="mt-1"
            onChange={(e) => {
              const v = e.target.value;
              setScheduledAtIso(v ? new Date(v).toISOString() : '');
            }}
          />
          <input type="hidden" name="scheduledAt" value={scheduledAtIso} />
        </div>
        <div>
          <Label htmlFor="durationMinutes">Duration (minutes)</Label>
          <Input id="durationMinutes" name="durationMinutes" type="number" min={15} max={240} defaultValue={45} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="format">Format</Label>
          <select id="format" name="format" required defaultValue="VIDEO"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="VIDEO">Video</option>
            <option value="PHONE">Phone</option>
            <option value="IN_PERSON">In person</option>
          </select>
        </div>
        <div>
          <Label htmlFor="interviewerUserId">Interviewer</Label>
          <select id="interviewerUserId" name="interviewerUserId" required
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select…</option>
            {staffUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="locationOrLink">Location or meeting link</Label>
          <Input id="locationOrLink" name="locationOrLink" required placeholder="https://meet.example.com/abc OR 123 Main St"
                 className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <textarea id="notes" name="notes" rows={3}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" name="force" value="0">
          {conflicts && conflicts.length > 0 ? 'Re-check' : 'Schedule interview'}
        </Button>
        {conflicts && conflicts.length > 0 && (
          <Button type="submit" name="force" value="1" variant="secondary">
            Schedule anyway
          </Button>
        )}
      </div>
    </form>
  );
}
