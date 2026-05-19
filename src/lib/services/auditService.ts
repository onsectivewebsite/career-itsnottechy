import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type AuditFilters = {
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  since?: Date;
  until?: Date;
  page?: number;        // 1-indexed
  pageSize?: number;    // default 50, max 200
};

export async function listAudit(filters: AuditFilters) {
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
    ...(filters.action      ? { action: filters.action } : {}),
    ...(filters.entityType  ? { entityType: filters.entityType } : {}),
    ...(filters.entityId    ? { entityId: filters.entityId } : {}),
    ...(filters.since || filters.until ? {
      createdAt: {
        ...(filters.since ? { gte: filters.since } : {}),
        ...(filters.until ? { lte: filters.until } : {}),
      },
    } : {}),
  };
  const pageSize = Math.min(Math.max(filters.pageSize ?? 50, 1), 200);
  const page = Math.max(filters.page ?? 1, 1);
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize, take: pageSize,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  return { total, page, pageSize, rows };
}

/** Distinct action strings for the filter dropdown. */
export async function listAuditActions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    select: { action: true }, distinct: ['action'], orderBy: { action: 'asc' },
  });
  return rows.map((r) => r.action);
}
