import { cn } from '@/lib/cn';
import type { LabelHTMLAttributes } from 'react';

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('block text-sm font-medium text-slate-700', className)} {...rest} />;
}
