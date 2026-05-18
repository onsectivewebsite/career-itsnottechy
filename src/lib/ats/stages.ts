import type { AppStage } from '@prisma/client';

/**
 * Canonical pipeline order. Use for display + iteration, NEVER trust
 * Prisma's `orderBy: { stage: 'asc' }` (alphabetical, not pipeline).
 */
export const STAGE_ORDER: readonly AppStage[] = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
] as const;

/**
 * Allowed forward transitions from each stage. Used by both the service
 * (server-side validation in atsService.moveStage) and the UI
 * (StageActions to render only valid buttons). Single source of truth.
 *
 * HIRED and REJECTED are terminal.
 */
export const FORWARD: Record<AppStage, AppStage[]> = {
  APPLIED:   ['SCREENING', 'REJECTED'],
  SCREENING: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['OFFER',     'REJECTED'],
  OFFER:     ['HIRED',     'REJECTED'],
  HIRED:     [],
  REJECTED:  [],
};

export const STAGE_LABEL: Record<AppStage, string> = {
  APPLIED:   'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER:     'Offer',
  HIRED:     'Hired',
  REJECTED:  'Rejected',
};

export type StageTone = 'neutral' | 'blue' | 'amber' | 'green' | 'red';

export const STAGE_TONE: Record<AppStage, StageTone> = {
  APPLIED:   'neutral',
  SCREENING: 'blue',
  INTERVIEW: 'blue',
  OFFER:     'amber',
  HIRED:     'green',
  REJECTED:  'red',
};

export const STAGE_ACTION_LABEL: Record<AppStage, string> = {
  APPLIED:   'Move to Applied',
  SCREENING: 'Advance to Screening',
  INTERVIEW: 'Advance to Interview',
  OFFER:     'Extend Offer',
  HIRED:     'Mark as Hired',
  REJECTED:  'Reject',
};

export function isValidTransition(from: AppStage, to: AppStage): boolean {
  if (from === to) return false;
  return FORWARD[from].includes(to);
}
