import { cn } from '@/lib/cn';
import type { HTMLAttributes } from 'react';

type Tone = 'info' | 'success' | 'warning' | 'error';
const tones: Record<Tone, string> = {
  info:    'bg-blue-50 text-blue-900 border-blue-200',
  success: 'bg-green-50 text-green-900 border-green-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
  error:   'bg-red-50 text-red-900 border-red-200',
};

export function Alert({
  className, tone = 'info', ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return (
    <div className={cn('rounded-md border px-4 py-3 text-sm', tones[tone], className)} {...rest} />
  );
}
