import { cn } from '@/lib/cn';
import type { HTMLAttributes } from 'react';

type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red';

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  blue:    'bg-blue-100 text-blue-700',
  green:   'bg-green-100 text-green-700',
  amber:   'bg-amber-100 text-amber-800',
  red:     'bg-red-100 text-red-700',
};

export function Badge({
  className, tone = 'neutral', ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}
      {...rest}
    />
  );
}
