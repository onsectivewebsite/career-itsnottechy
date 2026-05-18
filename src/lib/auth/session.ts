import { getServerSession } from 'next-auth';
import { authOptions } from './options';
import type { SessionUser } from '@/lib/rbac';

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}
