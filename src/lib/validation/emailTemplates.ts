import { z } from 'zod';

export const emailTemplateInputSchema = z.object({
  name:    z.string().min(1).max(120),
  subject: z.string().min(1).max(200),
  body:    z.string().max(50000),
});

export type EmailTemplateInput = z.infer<typeof emailTemplateInputSchema>;
