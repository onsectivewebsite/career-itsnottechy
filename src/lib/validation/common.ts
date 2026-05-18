import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .refine((s) => /[A-Z]/.test(s), 'Password must contain an uppercase letter')
  .refine((s) => /[a-z]/.test(s), 'Password must contain a lowercase letter')
  .refine((s) => /[0-9]/.test(s), 'Password must contain a number');

export const nameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, 'Name is required').max(120, 'Name too long'));

export const optionalPhoneSchema = z
  .string()
  .optional()
  .transform((s) => (s && s.trim().length > 0 ? s.trim() : undefined))
  .refine(
    (s) => s === undefined || /^[+0-9 ()\-]{5,30}$/.test(s),
    'Phone may contain digits, spaces, +, -, ( )',
  );
