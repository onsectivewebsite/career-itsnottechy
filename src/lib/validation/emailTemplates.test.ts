import { describe, expect, it } from 'vitest';
import { emailTemplateInputSchema } from './emailTemplates';

describe('emailTemplateInputSchema', () => {
  const ok = { name: 'Rejection', subject: 'About your application', body: '<p>Hi {{candidateName}}</p>' };

  it('accepts a well-formed template', () => {
    expect(emailTemplateInputSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(emailTemplateInputSchema.safeParse({ ...ok, name: '' }).success).toBe(false);
  });

  it('rejects empty subject', () => {
    expect(emailTemplateInputSchema.safeParse({ ...ok, subject: '' }).success).toBe(false);
  });

  it('rejects body over the max size', () => {
    expect(emailTemplateInputSchema.safeParse({ ...ok, body: 'x'.repeat(50001) }).success).toBe(false);
  });
});
