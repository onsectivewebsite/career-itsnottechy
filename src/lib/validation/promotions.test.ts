import { describe, expect, it } from 'vitest';
import { promotionInputSchema, decisionInputSchema } from './promotions';

describe('promotionInputSchema', () => {
  it('accepts a minimal valid promotion', () => {
    const r = promotionInputSchema.parse({
      currentTitle: 'Engineer II',
      targetTitle: 'Senior Engineer',
      justification: 'I led the migration project for six months and shipped on time.',
    });
    expect(r.supportingDocUrl).toBeUndefined();
    expect(r.currentTitle).toBe('Engineer II');
  });

  it('trims and lowercases nothing structural; just trims', () => {
    const r = promotionInputSchema.parse({
      currentTitle: '  Engineer II  ',
      targetTitle: '  Senior Engineer  ',
      justification: '  done lots of work over six months consistently  ',
    });
    expect(r.currentTitle).toBe('Engineer II');
    expect(r.targetTitle).toBe('Senior Engineer');
    expect(r.justification).toBe('done lots of work over six months consistently');
  });

  it('rejects an empty currentTitle / targetTitle', () => {
    expect(() => promotionInputSchema.parse({
      currentTitle: '', targetTitle: 'X', justification: 'long enough justification text',
    })).toThrow();
    expect(() => promotionInputSchema.parse({
      currentTitle: 'X', targetTitle: '', justification: 'long enough justification text',
    })).toThrow();
  });

  it('rejects justification shorter than 20 chars', () => {
    expect(() => promotionInputSchema.parse({
      currentTitle: 'A', targetTitle: 'B', justification: 'too short',
    })).toThrow();
  });

  it('accepts optional supportingDocUrl with the supporting-doc/ prefix', () => {
    const r = promotionInputSchema.parse({
      currentTitle: 'A', targetTitle: 'B',
      justification: 'long enough justification text here',
      supportingDocUrl: 'supporting-doc/promotion/x.pdf',
    });
    expect(r.supportingDocUrl).toBe('supporting-doc/promotion/x.pdf');
  });

  it('rejects a supportingDocUrl that does NOT start with supporting-doc/', () => {
    expect(() => promotionInputSchema.parse({
      currentTitle: 'A', targetTitle: 'B',
      justification: 'long enough justification text here',
      supportingDocUrl: 'resume/abc.pdf',
    })).toThrow();
    expect(() => promotionInputSchema.parse({
      currentTitle: 'A', targetTitle: 'B',
      justification: 'long enough justification text here',
      supportingDocUrl: '../etc/passwd',
    })).toThrow();
  });
});

describe('decisionInputSchema', () => {
  it('accepts APPROVED with optional notes', () => {
    const r = decisionInputSchema.parse({ decision: 'APPROVED' });
    expect(r.decision).toBe('APPROVED');
    expect(r.notes).toBeUndefined();
  });

  it('accepts REJECTED with notes', () => {
    const r = decisionInputSchema.parse({ decision: 'REJECTED', notes: '  not yet ready  ' });
    expect(r.notes).toBe('not yet ready');
  });

  it('rejects an unknown decision', () => {
    expect(() => decisionInputSchema.parse({ decision: 'MAYBE' })).toThrow();
  });
});
