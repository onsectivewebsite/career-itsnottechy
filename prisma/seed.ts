import { config } from 'dotenv';
config();
import { PrismaClient, type Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hash(p: string) {
  return bcrypt.hash(p, 12);
}

async function ensureUser(args: {
  email: string;
  name: string;
  role: Role;
  password: string;
  employee?: {
    employeeCode: string;
    department: string;
    title: string;
    managerEmail?: string;
    hireDate: Date;
  };
  candidate?: boolean;
}) {
  const email = args.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  (skip) ${email} already exists`);
    return existing;
  }

  let managerId: string | null = null;
  if (args.employee?.managerEmail) {
    const m = await prisma.user.findUnique({
      where: { email: args.employee.managerEmail.toLowerCase() },
      include: { employee: true },
    });
    managerId = m?.employee?.id ?? null;
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: args.name,
      role: args.role,
      passwordHash: await hash(args.password),
      employee: args.employee
        ? {
            create: {
              employeeCode: args.employee.employeeCode,
              department: args.employee.department,
              title: args.employee.title,
              hireDate: args.employee.hireDate,
              managerId,
            },
          }
        : undefined,
      candidateProfile: args.candidate ? { create: {} } : undefined,
    },
  });
  console.log(`  + ${args.role.padEnd(12)} ${email}`);
  return user;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPass  = process.env.SEED_ADMIN_PASSWORD;
  const adminName  = process.env.SEED_ADMIN_NAME ?? 'Site Administrator';
  if (!adminEmail || !adminPass) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env');
  }

  console.log('Seeding ItsNotTechy Careers…\n');

  // 1. Super Admin
  await ensureUser({
    email: adminEmail,
    name: adminName,
    role: 'SUPER_ADMIN',
    password: adminPass,
  });

  // 2. HR Manager
  await ensureUser({
    email: 'hr@itsnottechy.com',
    name: 'Pat Hernandez',
    role: 'HR_MANAGER',
    password: 'HRpassword!1',
    employee: {
      employeeCode: 'HR001',
      department: 'People',
      title: 'HR Manager',
      hireDate: new Date('2024-01-15'),
    },
  });

  // 3. Manager
  await ensureUser({
    email: 'manager@itsnottechy.com',
    name: 'Jordan Kim',
    role: 'MANAGER',
    password: 'Mgrpassword!1',
    employee: {
      employeeCode: 'ENG001',
      department: 'Engineering',
      title: 'Engineering Manager',
      hireDate: new Date('2024-02-01'),
    },
  });

  // 4. Employee reporting to manager
  await ensureUser({
    email: 'sam@itsnottechy.com',
    name: 'Sam Patel',
    role: 'EMPLOYEE',
    password: 'Emppassword!1',
    employee: {
      employeeCode: 'ENG002',
      department: 'Engineering',
      title: 'Software Engineer',
      managerEmail: 'manager@itsnottechy.com',
      hireDate: new Date('2024-06-12'),
    },
  });

  // 5. Employee with no manager
  await ensureUser({
    email: 'taylor@itsnottechy.com',
    name: 'Taylor Brooks',
    role: 'EMPLOYEE',
    password: 'Emppassword!1',
    employee: {
      employeeCode: 'OPS001',
      department: 'Operations',
      title: 'Operations Lead',
      hireDate: new Date('2024-09-04'),
    },
  });

  // 6 & 7. Sample candidates
  await ensureUser({
    email: 'alice.candidate@example.com',
    name: 'Alice Rivera',
    role: 'CANDIDATE',
    password: 'CandPass!12',
    candidate: true,
  });
  await ensureUser({
    email: 'ben.candidate@example.com',
    name: 'Ben Okafor',
    role: 'CANDIDATE',
    password: 'CandPass!12',
    candidate: true,
  });

  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
