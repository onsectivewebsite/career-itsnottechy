import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

export type Settings = {
  companyName: string;
  defaultSenderName: string;
};

const DEFAULTS: Settings = {
  companyName: 'ItsNotTechy',
  defaultSenderName: 'ItsNotTechy Careers',
};

let cache: { value: Settings; expiresAt: number } | null = null;
const CACHE_MS = 30_000;

export async function getSettings(): Promise<Settings> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  const row = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  const value: Settings = row
    ? { companyName: row.companyName, defaultSenderName: row.defaultSenderName }
    : DEFAULTS;

  cache = { value, expiresAt: now + CACHE_MS };
  return value;
}

export async function updateSettings(args: { input: Partial<Settings>; actorUserId: string }): Promise<Settings> {
  const next = {
    companyName: args.input.companyName ?? DEFAULTS.companyName,
    defaultSenderName: args.input.defaultSenderName ?? DEFAULTS.defaultSenderName,
  };
  const row = await prisma.systemSettings.upsert({
    where: { id: 'global' },
    create: { id: 'global', ...next, updatedBy: args.actorUserId },
    update: { ...next, updatedBy: args.actorUserId },
  });
  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'SETTINGS_UPDATED',
    entityType: 'SystemSettings',
    entityId: 'global',
    metadata: { ...args.input },
  });
  cache = null;
  return { companyName: row.companyName, defaultSenderName: row.defaultSenderName };
}

export function __resetSettingsCacheForTests(): void { cache = null; }
