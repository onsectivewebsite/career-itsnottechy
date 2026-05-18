import { z } from 'zod';
import { emailSchema, nameSchema } from './common';

export const referralInputSchema = z.object({
  jobId: z.string().min(1),
  candidateName: nameSchema,
  candidateEmail: emailSchema,
  relationship: z.string().trim().min(1, 'How do you know this candidate?').max(200),
  resumeUrl: z.string().min(1).optional(),
});
export type ReferralInput = z.infer<typeof referralInputSchema>;
