import { z } from 'zod';

export const promotionInputSchema = z.object({
  currentTitle: z.string().trim().min(1).max(200),
  targetTitle:  z.string().trim().min(1).max(200),
  justification: z.string().trim().min(20, 'Justification must be at least 20 characters.').max(5000),
  // Must match the path our upload endpoint hands out (purpose='supporting-doc'),
  // not an arbitrary string — otherwise a submitter could point at any stored file.
  supportingDocUrl: z.string().regex(/^supporting-doc\//, 'Invalid supporting document path.').optional(),
});
export type PromotionInput = z.infer<typeof promotionInputSchema>;

export const decisionInputSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  notes:    z.string().trim().max(2000).optional(),
});
export type DecisionInput = z.infer<typeof decisionInputSchema>;
