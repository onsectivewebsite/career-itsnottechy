import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  nameSchema,
  optionalPhoneSchema,
} from './common';

describe('emailSchema', () => {
  it('accepts valid emails (lowercased)', () => {
    expect(emailSchema.parse('Hi@Example.com')).toBe('hi@example.com');
  });
  it('rejects invalid emails', () => {
    expect(() => emailSchema.parse('not-an-email')).toThrow();
  });
});

describe('passwordSchema', () => {
  it('accepts min 10 chars with upper/lower/number', () => {
    expect(passwordSchema.parse('Hunter2pass')).toBe('Hunter2pass');
  });
  it('rejects short passwords', () => {
    expect(() => passwordSchema.parse('Aa1aaaaa')).toThrow(/at least 10/);
  });
  it('rejects missing upper case', () => {
    expect(() => passwordSchema.parse('lowercase1!')).toThrow(/uppercase/);
  });
  it('rejects missing digit', () => {
    expect(() => passwordSchema.parse('NoDigitsHere!')).toThrow(/number/);
  });
});

describe('nameSchema', () => {
  it('trims and accepts a normal name', () => {
    expect(nameSchema.parse('  Alice Doe  ')).toBe('Alice Doe');
  });
  it('rejects empty', () => {
    expect(() => nameSchema.parse('   ')).toThrow();
  });
});

describe('optionalPhoneSchema', () => {
  it('accepts undefined and empty as undefined', () => {
    expect(optionalPhoneSchema.parse(undefined)).toBeUndefined();
    expect(optionalPhoneSchema.parse('')).toBeUndefined();
  });
  it('accepts E.164-ish formats', () => {
    expect(optionalPhoneSchema.parse('+1-415-555-2671')).toBe('+1-415-555-2671');
  });
  it('rejects letters', () => {
    expect(() => optionalPhoneSchema.parse('call-me')).toThrow();
  });
});
