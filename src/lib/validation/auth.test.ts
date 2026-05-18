import { describe, expect, it } from 'vitest';
import {
  registerCandidateSchema,
  loginSchema,
  acceptInviteSchema,
  requestResetSchema,
  resetPasswordSchema,
} from './auth';

describe('registerCandidateSchema', () => {
  it('accepts valid input', () => {
    expect(
      registerCandidateSchema.parse({ email: 'a@x.com', password: 'Hunter2pass', name: 'A' }),
    ).toEqual({ email: 'a@x.com', password: 'Hunter2pass', name: 'A' });
  });
  it('rejects invalid email', () => {
    expect(() =>
      registerCandidateSchema.parse({ email: 'no', password: 'Hunter2pass', name: 'A' }),
    ).toThrow();
  });
});

describe('loginSchema', () => {
  it('lowercases email and allows any password length', () => {
    expect(loginSchema.parse({ email: 'A@X.com', password: 'x' })).toEqual({
      email: 'a@x.com', password: 'x',
    });
  });
});

describe('acceptInviteSchema', () => {
  it('requires a non-empty token and a valid password', () => {
    expect(() => acceptInviteSchema.parse({ token: '', password: 'Hunter2pass' })).toThrow();
    expect(() => acceptInviteSchema.parse({ token: 't', password: 'short' })).toThrow();
    expect(acceptInviteSchema.parse({ token: 't', password: 'Hunter2pass' })).toEqual({
      token: 't', password: 'Hunter2pass',
    });
  });
});

describe('requestResetSchema', () => {
  it('lowercases email', () => {
    expect(requestResetSchema.parse({ email: 'A@X.com' })).toEqual({ email: 'a@x.com' });
  });
});

describe('resetPasswordSchema', () => {
  it('requires token and valid password', () => {
    expect(resetPasswordSchema.parse({ token: 't', password: 'Hunter2pass' })).toEqual({
      token: 't', password: 'Hunter2pass',
    });
  });
});
