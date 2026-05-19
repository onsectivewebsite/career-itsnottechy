import { prisma } from '@/lib/prisma';

/**
 * Truncates all application tables. Call in a `beforeEach` of any
 * DB-touching test. Safe only against the test database — the helper
 * refuses to run unless DATABASE_URL contains "careers_test".
 */
export async function resetDb(): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('careers_test')) {
    throw new Error(`resetDb refused: DATABASE_URL must target the test database. Got: ${url}`);
  }

  const tables = [
    'SystemSettings',
    'PasswordResetToken',
    'InviteToken',
    'AuditLog',
    'EmailLog',
    'PromotionRequest',
    'Interview',
    'ApplicationNote',
    'Application',
    'Referral',
    'Job',
    'CandidateProfile',
    'Employee',
    'User',
  ];

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`
  );
}
