import { z } from 'zod';
import type { CustomQuestion } from '@/types/customQuestions';

const baseQuestion = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  required: z.boolean(),
});

const shortText    = baseQuestion.extend({ type: z.literal('SHORT_TEXT')  });
const longText     = baseQuestion.extend({ type: z.literal('LONG_TEXT')   });
const yesNo        = baseQuestion.extend({ type: z.literal('YES_NO')      });
const singleChoice = baseQuestion.extend({
  type: z.literal('SINGLE_CHOICE'),
  options: z.array(z.string().min(1)).min(2).max(20),
});

const customQuestion = z.discriminatedUnion('type', [shortText, longText, yesNo, singleChoice]);

export const customQuestionsSchema = z.array(customQuestion).max(20).superRefine((arr, ctx) => {
  const seen = new Set<string>();
  for (const q of arr) {
    if (seen.has(q.id)) {
      ctx.addIssue({ code: 'custom', message: `duplicate question id: ${q.id}` });
      return;
    }
    seen.add(q.id);
  }
});

export const jobInputSchema = z.object({
  title:        z.string().min(1).max(200),
  department:   z.string().min(1).max(120),
  locationType: z.enum(['REMOTE', 'ONSITE', 'HYBRID']),
  locationCity: z.string().max(120).optional(),
  type:         z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']),
  description:  z.string().min(20).max(20000),
  requirements: z.string().min(10).max(20000),
  salaryMin:    z.number().int().positive().optional(),
  salaryMax:    z.number().int().positive().optional(),
  currency:     z.string().length(3).default('USD'),
  deadline:     z.coerce.date().optional(),
  customQuestions: customQuestionsSchema,
}).superRefine((data, ctx) => {
  if (data.salaryMin && data.salaryMax && data.salaryMin > data.salaryMax) {
    ctx.addIssue({ code: 'custom', path: ['salaryMin'], message: 'salaryMin must be <= salaryMax' });
  }
  if ((data.locationType === 'ONSITE' || data.locationType === 'HYBRID') && !data.locationCity) {
    ctx.addIssue({ code: 'custom', path: ['locationCity'], message: 'locationCity required for ONSITE/HYBRID' });
  }
});
export type JobInput = z.infer<typeof jobInputSchema>;

export function applicationInputSchema(questions: CustomQuestion[]) {
  const known = new Set(questions.map((q) => q.id));
  return z.object({
    jobId: z.string().min(1),
    resumeUrl: z.string().min(1),
    coverLetter: z.string().max(20000).optional(),
    customAnswers: z.record(z.string()),
  }).transform((data) => {
    // Drop unknown answer ids silently
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.customAnswers)) {
      if (known.has(k)) filtered[k] = v;
    }
    return { ...data, customAnswers: filtered };
  }).superRefine((data, ctx) => {
    for (const q of questions) {
      const ans = data.customAnswers[q.id];
      if (q.required && (!ans || ans.trim() === '')) {
        ctx.addIssue({ code: 'custom', path: ['customAnswers', q.id], message: `${q.label} is required` });
      }
      if (q.type === 'YES_NO' && ans !== undefined && ans !== 'YES' && ans !== 'NO') {
        ctx.addIssue({ code: 'custom', path: ['customAnswers', q.id], message: 'Must be YES or NO' });
      }
      if (q.type === 'SINGLE_CHOICE' && ans !== undefined && !q.options.includes(ans)) {
        ctx.addIssue({ code: 'custom', path: ['customAnswers', q.id], message: 'Not a valid option' });
      }
    }
  });
}
