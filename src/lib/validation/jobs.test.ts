import { describe, expect, it } from 'vitest';
import { jobInputSchema, customQuestionsSchema, applicationInputSchema, requiredDocumentsSchema } from './jobs';

describe('customQuestionsSchema', () => {
  it('accepts empty array', () => {
    expect(customQuestionsSchema.parse([])).toEqual([]);
  });

  it('accepts SHORT_TEXT + LONG_TEXT + YES_NO', () => {
    const r = customQuestionsSchema.parse([
      { id: 'q1', type: 'SHORT_TEXT', label: 'Where are you based?', required: true },
      { id: 'q2', type: 'LONG_TEXT',  label: 'Why this role?',       required: false },
      { id: 'q3', type: 'YES_NO',     label: 'Can you relocate?',    required: true },
    ]);
    expect(r).toHaveLength(3);
  });

  it('requires options for SINGLE_CHOICE', () => {
    expect(() => customQuestionsSchema.parse([
      { id: 'q1', type: 'SINGLE_CHOICE', label: 'Pick one', required: true },
    ])).toThrow();
    const ok = customQuestionsSchema.parse([
      { id: 'q1', type: 'SINGLE_CHOICE', label: 'Pick one', required: true, options: ['A', 'B'] },
    ]);
    expect(ok).toHaveLength(1);
  });

  it('rejects duplicate question ids', () => {
    expect(() => customQuestionsSchema.parse([
      { id: 'q1', type: 'SHORT_TEXT', label: 'A', required: false },
      { id: 'q1', type: 'SHORT_TEXT', label: 'B', required: false },
    ])).toThrow(/duplicate/i);
  });
});

describe('jobInputSchema', () => {
  it('accepts a minimal valid job', () => {
    const r = jobInputSchema.parse({
      title: 'Software Engineer',
      department: 'Engineering',
      locationType: 'REMOTE',
      type: 'FULL_TIME',
      description: 'Long description of the role and what we do.',
      requirements: 'Requirements list.',
      customQuestions: [],
    });
    expect(r.title).toBe('Software Engineer');
  });

  it('rejects salary range where min > max', () => {
    expect(() => jobInputSchema.parse({
      title: 'X', department: 'X', locationType: 'REMOTE', type: 'FULL_TIME',
      description: 'long enough description here', requirements: 'reqs here',
      customQuestions: [],
      salaryMin: 200000, salaryMax: 100000,
    })).toThrow(/salary/i);
  });

  it('requires locationCity when locationType is ONSITE or HYBRID', () => {
    expect(() => jobInputSchema.parse({
      title: 'X', department: 'X', locationType: 'ONSITE', type: 'FULL_TIME',
      description: 'long enough description here', requirements: 'reqs here',
      customQuestions: [],
    })).toThrow(/locationCity/i);
  });
});

describe('applicationInputSchema', () => {
  it('validates answers against a question list', () => {
    const questions = [
      { id: 'q1', type: 'SHORT_TEXT' as const, label: 'Where?', required: true },
    ];
    const ok = applicationInputSchema(questions).parse({
      jobId: 'job-1',
      resumeUrl: 'resume/job-1/abc-r.pdf',
      coverLetter: 'Hi',
      customAnswers: { q1: 'Berlin' },
    });
    expect(ok.customAnswers.q1).toBe('Berlin');
  });

  it('rejects when a required answer is missing', () => {
    const questions = [
      { id: 'q1', type: 'SHORT_TEXT' as const, label: 'Where?', required: true },
    ];
    expect(() => applicationInputSchema(questions).parse({
      jobId: 'job-1',
      resumeUrl: 'resume/job-1/r.pdf',
      customAnswers: {},
    })).toThrow(/required/i);
  });

  it('drops answers to unknown question ids silently', () => {
    const ok = applicationInputSchema([]).parse({
      jobId: 'job-1',
      resumeUrl: 'r.pdf',
      customAnswers: { unknown: 'value' },
    });
    expect(ok.customAnswers).toEqual({});
  });

  it('validates YES_NO values', () => {
    const questions = [{ id: 'q1', type: 'YES_NO' as const, label: 'Relocate?', required: true }];
    expect(() => applicationInputSchema(questions).parse({
      jobId: 'j', resumeUrl: 'r', customAnswers: { q1: 'maybe' },
    })).toThrow(/YES or NO/);
    expect(applicationInputSchema(questions).parse({
      jobId: 'j', resumeUrl: 'r', customAnswers: { q1: 'YES' },
    }).customAnswers.q1).toBe('YES');
  });

  it('validates SINGLE_CHOICE against options', () => {
    const questions = [{ id: 'q1', type: 'SINGLE_CHOICE' as const, label: 'Pick', required: true, options: ['A', 'B'] }];
    expect(() => applicationInputSchema(questions).parse({
      jobId: 'j', resumeUrl: 'r', customAnswers: { q1: 'C' },
    })).toThrow(/valid option/);
  });
});

describe('jobInputSchema rich-text length', () => {
  const base = {
    title: 'Engineer', department: 'Engineering', locationType: 'REMOTE' as const,
    type: 'FULL_TIME' as const, currency: 'USD', customQuestions: [],
  };

  it('accepts HTML whose text content is long enough', () => {
    const r = jobInputSchema.safeParse({
      ...base,
      description: '<p>We build practical software for working teams.</p>',
      requirements: '<p>Three years backend.</p>',
    });
    expect(r.success).toBe(true);
  });

  it('rejects rich text with enough raw characters but no real text', () => {
    // 28 raw characters (passes the old min(20)) but zero text content.
    const r = jobInputSchema.safeParse({
      ...base,
      description: '<p></p><p></p><p></p><p></p>',
      requirements: '<p>Three years backend.</p>',
    });
    expect(r.success).toBe(false);
  });
});

describe('requiredDocumentsSchema', () => {
  it('accepts a valid list', () => {
    const r = requiredDocumentsSchema.safeParse([
      { id: 'd1', name: 'Portfolio', required: true },
      { id: 'd2', name: 'Government ID', required: false, instructions: 'PDF or photo' },
    ]);
    expect(r.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const r = requiredDocumentsSchema.safeParse([{ id: 'd1', name: '', required: true }]);
    expect(r.success).toBe(false);
  });

  it('rejects duplicate ids', () => {
    const r = requiredDocumentsSchema.safeParse([
      { id: 'dup', name: 'A', required: true },
      { id: 'dup', name: 'B', required: false },
    ]);
    expect(r.success).toBe(false);
  });

  it('defaults to an empty array when omitted from a job', () => {
    const parsed = jobInputSchema.safeParse({
      title: 'Engineer', department: 'Engineering', locationType: 'REMOTE',
      type: 'FULL_TIME', description: 'A long enough description here.',
      requirements: 'Some reqs.', currency: 'USD', customQuestions: [],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.requiredDocuments).toEqual([]);
  });
});
