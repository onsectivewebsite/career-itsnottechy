import { cn } from '@/lib/cn';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-400',
  ghost:     'bg-transparent text-slate-700 hover:bg-slate-100',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...rest} />
  );
});
