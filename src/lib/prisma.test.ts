import { describe, expect, it } from 'vitest';
import { prisma } from './prisma';

describe('prisma singleton', () => {
  it('exports a PrismaClient instance', () => {
    expect(prisma).toBeDefined();
    expect(typeof prisma.user.findMany).toBe('function');
  });

  it('reuses the same instance across imports', async () => {
    const a = (await import('./prisma')).prisma;
    const b = (await import('./prisma')).prisma;
    expect(a).toBe(b);
  });

  it('can execute a trivial query against the test database', async () => {
    const rows = await prisma.$queryRaw<Array<{ one: number }>>`SELECT 1::int as one`;
    expect(rows[0]?.one).toBe(1);
  });
});
