import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Import AFTER mock is set up
import { getServerSession } from 'next-auth';
import { getSessionUser } from './session';

describe('getSessionUser', () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  it('returns null when no session', async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await getSessionUser()).toBeNull();
  });

  it('returns null when the user has been deactivated since the JWT was issued', async () => {
    const u = await prisma.user.create({
      data: { email: 'x@x.com', name: 'X', role: 'EMPLOYEE', isActive: false },
    });
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name, role: u.role },
    });
    expect(await getSessionUser()).toBeNull();
  });

  it('returns null when the user no longer exists', async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'ghost', email: 'g@g.com', name: 'Ghost', role: 'EMPLOYEE' },
    });
    expect(await getSessionUser()).toBeNull();
  });

  it('returns a fresh user payload (catches role change made after JWT issue)', async () => {
    const u = await prisma.user.create({
      data: { email: 'a@x.com', name: 'A', role: 'EMPLOYEE', isActive: true },
    });
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: u.id, email: 'stale@x.com', name: 'Stale', role: 'CANDIDATE' },
    });
    const fresh = await getSessionUser();
    expect(fresh?.role).toBe('EMPLOYEE');
    expect(fresh?.email).toBe('a@x.com');
  });
});
