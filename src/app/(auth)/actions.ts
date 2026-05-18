'use server';

import {
  registerCandidate,
  acceptInvite,
  requestPasswordReset,
  setNewPasswordWithResetToken,
} from '@/lib/services/userService';
import {
  registerCandidateSchema,
  acceptInviteSchema,
  requestResetSchema,
  resetPasswordSchema,
} from '@/lib/validation/auth';

type FormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: true };

export async function registerCandidateAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerCandidateSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const r = await registerCandidate(parsed.data);
  if (!r.ok) {
    return { error: r.reason === 'EMAIL_TAKEN' ? 'That email is already in use.' : 'Registration failed.' };
  }
  return { ok: true };
}

export async function acceptInviteAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const r = await acceptInvite(parsed.data);
  if (!r.ok) {
    return {
      error:
        r.reason === 'EXPIRED'      ? 'This invite link has expired.' :
        r.reason === 'ALREADY_USED' ? 'This invite link has already been used.' :
                                      'This invite link is invalid.',
    };
  }
  return { ok: true };
}

export async function requestResetAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const parsed = requestResetSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  await requestPasswordReset(parsed.data.email);
  // Always return success — don't reveal whether the address exists.
  return { ok: true };
}

export async function resetPasswordAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const r = await setNewPasswordWithResetToken(parsed.data);
  if (!r.ok) {
    return {
      error:
        r.reason === 'EXPIRED'      ? 'This reset link has expired.' :
        r.reason === 'ALREADY_USED' ? 'This reset link has already been used.' :
                                      'This reset link is invalid.',
    };
  }
  return { ok: true };
}
