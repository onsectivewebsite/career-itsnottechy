import type { Decision } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { promotionInputSchema, type PromotionInput } from '@/lib/validation/promotions';

export type SubmitResult =
  | { ok: true; promotionId: string }
  | { ok: false; reason: 'INVALID' | 'NO_EMPLOYEE_ROW' | 'NO_MANAGER' };

const DECISION_LABEL: Record<Decision, string> = { APPROVED: 'Approved', REJECTED: 'Rejected' };

const APP_URL = () => process.env.APP_URL ?? '';
const EMPLOYEE_DASH = () => `${APP_URL()}/dashboard/employee/promotions`;
const MANAGER_DASH  = () => `${APP_URL()}/dashboard/manager/promotions`;
const HR_DASH       = () => `${APP_URL()}/dashboard/hr/promotions`;

export async function submitPromotion(args: {
  employeeUserId: string;
  input: PromotionInput | Record<string, unknown>;
}): Promise<SubmitResult> {
  const parsed = promotionInputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID' };

  const employee = await prisma.employee.findUnique({
    where: { userId: args.employeeUserId },
    include: { user: true, manager: { include: { user: true } } },
  });
  if (!employee) return { ok: false, reason: 'NO_EMPLOYEE_ROW' };
  if (!employee.manager) return { ok: false, reason: 'NO_MANAGER' };
  const managerUser = employee.manager.user;

  const row = await prisma.promotionRequest.create({
    data: {
      employeeUserId: args.employeeUserId,
      currentTitle: parsed.data.currentTitle,
      targetTitle: parsed.data.targetTitle,
      justification: parsed.data.justification,
      supportingDocUrl: parsed.data.supportingDocUrl ?? null,
      managerUserId: managerUser.id,
      finalStatus: 'PENDING_MANAGER',
    },
  });

  await recordAudit({
    actorUserId: args.employeeUserId,
    action: 'PROMOTION_SUBMITTED',
    entityType: 'PromotionRequest',
    entityId: row.id,
    metadata: { managerUserId: managerUser.id },
  });

  await sendEmail({
    to: employee.user.email,
    template: 'promotion-submitted',
    data: {
      recipientName: employee.user.name,
      employeeName: employee.user.name,
      currentTitle: parsed.data.currentTitle,
      targetTitle: parsed.data.targetTitle,
      contextLine: 'You submitted this request. We\'ll email you as it progresses.',
      dashboardUrl: EMPLOYEE_DASH(),
    },
  });

  await sendEmail({
    to: managerUser.email,
    template: 'promotion-submitted',
    data: {
      recipientName: managerUser.name,
      employeeName: employee.user.name,
      currentTitle: parsed.data.currentTitle,
      targetTitle: parsed.data.targetTitle,
      contextLine: 'Please review this request and approve or reject.',
      dashboardUrl: MANAGER_DASH(),
    },
  });

  return { ok: true, promotionId: row.id };
}

export type DecisionResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_MANAGER' | 'WRONG_STATUS' };

export async function managerDecision(args: {
  promotionId: string;
  actorUserId: string;
  decision: Decision;
  notes?: string;
}): Promise<DecisionResult> {
  const existing = await prisma.promotionRequest.findUnique({
    where: { id: args.promotionId },
    include: { employee: true, manager: true },
  });
  if (!existing) return { ok: false, reason: 'NOT_FOUND' };
  if (existing.managerUserId !== args.actorUserId) return { ok: false, reason: 'NOT_MANAGER' };

  const newStatus = args.decision === 'APPROVED' ? 'PENDING_HR' : 'REJECTED';
  const claim = await prisma.promotionRequest.updateMany({
    where: { id: args.promotionId, finalStatus: 'PENDING_MANAGER' },
    data: {
      managerDecision: args.decision,
      managerNotes: args.notes ?? null,
      managerDecidedAt: new Date(),
      finalStatus: newStatus,
    },
  });
  if (claim.count === 0) return { ok: false, reason: 'WRONG_STATUS' };

  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'PROMOTION_MANAGER_DECIDED',
    entityType: 'PromotionRequest',
    entityId: args.promotionId,
    metadata: { decision: args.decision, newStatus },
  });

  const notesBlock = args.notes
    ? `<p><strong>Manager notes:</strong> ${escapeHtml(args.notes)}</p>`
    : '';
  const nextStepLine = args.decision === 'APPROVED'
    ? 'Forwarded to HR for final decision.'
    : 'This request is now closed.';

  await sendEmail({
    to: existing.employee.email,
    template: 'promotion-manager-decision',
    data: {
      recipientName: existing.employee.name,
      employeeName: existing.employee.name,
      currentTitle: existing.currentTitle,
      targetTitle: existing.targetTitle,
      decisionLabel: DECISION_LABEL[args.decision],
      notesBlock,
      nextStepLine,
      dashboardUrl: EMPLOYEE_DASH(),
    },
  });

  const hrGroup = await prisma.user.findMany({ where: { role: 'HR_MANAGER', isActive: true } });
  for (const hr of hrGroup) {
    await sendEmail({
      to: hr.email,
      template: 'promotion-manager-decision',
      data: {
        recipientName: hr.name,
        employeeName: existing.employee.name,
        currentTitle: existing.currentTitle,
        targetTitle: existing.targetTitle,
        decisionLabel: DECISION_LABEL[args.decision],
        notesBlock,
        nextStepLine,
        dashboardUrl: HR_DASH(),
      },
    });
  }

  return { ok: true };
}

export async function hrDecision(args: {
  promotionId: string;
  actorUserId: string;
  decision: Decision;
  notes?: string;
}): Promise<DecisionResult> {
  const existing = await prisma.promotionRequest.findUnique({
    where: { id: args.promotionId },
    include: { employee: true, manager: true },
  });
  if (!existing) return { ok: false, reason: 'NOT_FOUND' };

  const claim = await prisma.promotionRequest.updateMany({
    where: { id: args.promotionId, finalStatus: 'PENDING_HR' },
    data: {
      hrDecision: args.decision,
      hrNotes: args.notes ?? null,
      hrDecidedAt: new Date(),
      finalStatus: args.decision,
    },
  });
  if (claim.count === 0) return { ok: false, reason: 'WRONG_STATUS' };

  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'PROMOTION_HR_DECIDED',
    entityType: 'PromotionRequest',
    entityId: args.promotionId,
    metadata: { decision: args.decision },
  });

  const notesBlock = args.notes
    ? `<p><strong>HR notes:</strong> ${escapeHtml(args.notes)}</p>`
    : '';

  await sendEmail({
    to: existing.employee.email,
    template: 'promotion-final-decision',
    data: {
      recipientName: existing.employee.name,
      employeeName: existing.employee.name,
      currentTitle: existing.currentTitle,
      targetTitle: existing.targetTitle,
      decisionLabel: DECISION_LABEL[args.decision],
      notesBlock,
      dashboardUrl: EMPLOYEE_DASH(),
    },
  });

  await sendEmail({
    to: existing.manager.email,
    template: 'promotion-final-decision',
    data: {
      recipientName: existing.manager.name,
      employeeName: existing.employee.name,
      currentTitle: existing.currentTitle,
      targetTitle: existing.targetTitle,
      decisionLabel: DECISION_LABEL[args.decision],
      notesBlock,
      dashboardUrl: MANAGER_DASH(),
    },
  });

  return { ok: true };
}

export async function listMine(employeeUserId: string) {
  return prisma.promotionRequest.findMany({
    where: { employeeUserId },
    orderBy: { createdAt: 'desc' },
    include: { manager: { select: { id: true, name: true, email: true } } },
  });
}

export async function listForManager(managerUserId: string) {
  return prisma.promotionRequest.findMany({
    where: { managerUserId, finalStatus: 'PENDING_MANAGER' },
    orderBy: { createdAt: 'asc' },
    include: { employee: { select: { id: true, name: true, email: true } } },
  });
}

export async function listForHr() {
  return prisma.promotionRequest.findMany({
    where: { finalStatus: 'PENDING_HR' },
    orderBy: { createdAt: 'asc' },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      manager:  { select: { id: true, name: true, email: true } },
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
