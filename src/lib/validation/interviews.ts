import { z } from 'zod';

export const interviewInputSchema = z.object({
  applicationId: z.string().min(1),
  scheduledAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: 'Interview must be scheduled in the future.',
  }),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  format: z.enum(['VIDEO', 'PHONE', 'IN_PERSON']),
  interviewerUserId: z.string().min(1),
  locationOrLink: z.string().trim().min(1).max(500),
  notes: z.string().trim().max(2000).optional(),
});

export type InterviewInput = z.infer<typeof interviewInputSchema>;
