'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { inviteStaff } from '@/lib/services/userService';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email().toLowerCase(),
  name:  z.string().trim().min(1).max(200),
  role:  z.enum(['HR_MANAGER', 'MANAGER', 'EMPLOYEE']),
  employeeCode: z.string().trim().min(1).max(50),
  department:   z.string().trim().min(1).max(100),
  title:        z.string().trim().min(1).max(200),
  hireDate:     z.coerce.date(),
  managerEmployeeId: z.string().optional().transform((v) => (v === '' ? null : v ?? null)),
});

type FormState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function inviteStaffAction(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const parsed = schema.safeParse({
    email: fd.get('email'),
    name: fd.get('name'),
    role: fd.get('role'),
    employeeCode: fd.get('employeeCode'),
    department: fd.get('department'),
    title: fd.get('title'),
    hireDate: fd.get('hireDate'),
    managerEmployeeId: fd.get('managerEmployeeId') ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const r = await inviteStaff({
    email: parsed.data.email,
    name: parsed.data.name,
    role: parsed.data.role,
    employeeData: {
      employeeCode: parsed.data.employeeCode,
      department: parsed.data.department,
      title: parsed.data.title,
      hireDate: parsed.data.hireDate,
      managerId: parsed.data.managerEmployeeId,
    },
    invitedByUserId: user.id,
  });
  if (!r.ok) {
    return {
      error:
        r.reason === 'EMAIL_TAKEN'         ? 'A user with that email already exists.' :
        r.reason === 'EMPLOYEE_CODE_TAKEN' ? 'That employee code is already in use.' :
                                              'Could not send invitation.',
    };
  }
  revalidatePath('/dashboard/admin/users');
  redirect('/dashboard/hr/invite?sent=1');
}
