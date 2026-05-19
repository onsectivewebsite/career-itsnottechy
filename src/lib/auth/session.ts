import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from './options';
import type { SessionUser } from '@/lib/rbac';

/**
 * Returns the authenticated user, or null if no session, if the user has been
 * deactivated, or if the JWT references a user that no longer exists.
 *
 * Re-reads the database on every call so deactivation + role changes take
 * effect on the next request (JWT itself isn't revoked).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
