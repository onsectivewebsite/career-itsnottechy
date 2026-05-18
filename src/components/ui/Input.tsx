import { cn } from '@/lib/cn';
import { forwardRef, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, invalid, ...rest }, ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
        invalid ? 'border-red-400' : 'border-slate-300',
        className,
      )}
      {...rest}
    />
  );
});
