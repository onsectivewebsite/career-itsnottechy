# Phase 1A — Scaffold, Database, Core Libs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js 14 project with TypeScript, Tailwind, Prisma, Postgres (via docker-compose), and the core utility libraries (prisma client, password hashing, token generation, RBAC helpers). Everything testable and committed by the end of this plan.

**Architecture:** Monolithic Next.js 14 App Router app. Prisma against Postgres 16 (Docker in dev). Vitest for unit/integration tests. Business logic isolated in `src/lib`. No application code yet — auth flows, UI, and email come in plans 1B and 1C.

**Tech Stack:** Next.js 14, TypeScript 5, Tailwind 3, Prisma 5, PostgreSQL 16, Vitest 1, bcryptjs, zod, dotenv.

**Prerequisites on your machine:** Node 20 LTS, Docker Desktop running, git available.

**End-of-plan state:** `npm run dev` boots Next.js on http://localhost:3000; `npm test` runs and passes ~30 unit/integration tests; `npx prisma studio` opens against a running Postgres; git has 13+ small commits on `main`.

---

## Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.eslintrc.json`, `next-env.d.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `postcss.config.mjs`, `tailwind.config.ts`, `public/.gitkeep`

The repo currently contains only `.gitignore`, `docs/`, and `.git/`. We bootstrap Next.js by hand (not `create-next-app`) so every file is intentional and committed in a single, reviewable step.

- [ ] **Step 1: Create `package.json`**

Create `/Users/recallrishabh/Downloads/careeritsnottechy/package.json`:

```json
{
  "name": "itsnottechy-careers",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/node": "20.14.10",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "autoprefixer": "10.4.19",
    "eslint": "8.57.0",
    "eslint-config-next": "14.2.5",
    "postcss": "8.4.39",
    "tailwindcss": "3.4.6",
    "typescript": "5.5.3"
  }
}
```

- [ ] **Step 2: Install**

Run: `cd /Users/recallrishabh/Downloads/careeritsnottechy && npm install`
Expected: completes without errors; creates `node_modules/` and `package-lock.json`.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 5: Create `.eslintrc.json`**

```json
{
  "extends": "next/core-web-vitals",
  "rules": {
    "@next/next/no-html-link-for-pages": "off"
  }
}
```

- [ ] **Step 6: Create `next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 7: Create Tailwind config files**

`postcss.config.mjs`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 8: Create the App Router root files**

`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: light; }
html, body { height: 100%; }
body { @apply bg-white text-slate-900 font-sans antialiased; }
```

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ItsNotTechy Careers',
  description: 'Join the ItsNotTechy team.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-3xl font-bold text-slate-900">ItsNotTechy Careers</h1>
      <p className="mt-4 text-slate-600">Foundation scaffold. Real landing page lands in plan 1C.</p>
    </main>
  );
}
```

`public/.gitkeep`: empty file.

- [ ] **Step 9: Verify the app boots**

Run: `npm run dev`
Expected: console prints `▲ Next.js 14.2.5` and "Local: http://localhost:3000". Visit http://localhost:3000 — you should see the placeholder page. Stop the server with `Ctrl+C`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 14 + TypeScript + Tailwind"
```

---

## Task 2: Add Postgres docker-compose for local dev

**Files:**
- Create: `docker-compose.yml`, `.env.example`, `.env`

We run Postgres in Docker locally; production uses native Postgres on the VPS. A separate `careers_test` database (same Postgres instance) backs integration tests.

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: itsnottechy-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: careers
      POSTGRES_PASSWORD: careers_dev_only
      POSTGRES_DB: careers
    ports:
      - "5433:5432"   # host 5433 → container 5432 (avoid clash with other local postgres on 5432)
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro

volumes:
  postgres-data:
```

- [ ] **Step 2: Create `docker/postgres/init.sql`**

```sql
CREATE DATABASE careers_test;
GRANT ALL PRIVILEGES ON DATABASE careers_test TO careers;
```

- [ ] **Step 3: Create `.env.example`**

```bash
# === Database ===
DATABASE_URL="postgresql://careers:careers_dev_only@localhost:5433/careers?schema=public"
TEST_DATABASE_URL="postgresql://careers:careers_dev_only@localhost:5433/careers_test?schema=public"

# === NextAuth ===
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# === SMTP (Hostinger) ===
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="info@itsnottechy.com"
SMTP_PASS="set-locally-do-not-commit"
SMTP_FROM_NAME="ItsNotTechy Careers"
SMTP_FROM_EMAIL="info@itsnottechy.com"

# Set to "true" in dev/test to skip actual sends; emails are logged to DB only.
EMAIL_TEST_MODE="true"

# === File storage ===
STORAGE_ROOT="./uploads"

# === Seed (Phase 1C) ===
SEED_ADMIN_EMAIL="admin@itsnottechy.com"
SEED_ADMIN_PASSWORD="ChangeMe!Now123"
SEED_ADMIN_NAME="Site Administrator"

# === App ===
APP_URL="http://localhost:3000"
```

- [ ] **Step 4: Create local `.env`**

Copy `.env.example` to `.env` and replace placeholders:
```bash
cp .env.example .env
```
Then edit `.env`:
- `NEXTAUTH_SECRET` → run `openssl rand -base64 32` and paste the output
- `SMTP_PASS` → set to the real Hostinger mailbox password (only in `.env`, never in `.env.example` or git)

Verify `.env` is ignored: `git status` should show only `.env.example` and `docker-compose.yml`, not `.env`.

- [ ] **Step 5: Boot Postgres**

Run: `docker compose up -d postgres`
Expected: prints `Container itsnottechy-postgres Started`. Verify with `docker compose ps` — status `running`.

- [ ] **Step 6: Verify both databases exist**

Run: `docker exec itsnottechy-postgres psql -U careers -d postgres -c "\l"`
Expected: output lists `careers` and `careers_test` databases.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml docker/ .env.example
git commit -m "chore: add Postgres docker-compose and env template"
```

---

## Task 3: Install runtime + dev dependencies

**Files:**
- Modify: `package.json`

Add Prisma, auth, validation, email, and testing dependencies in one pass. We pin versions to keep migrations predictable.

- [ ] **Step 1: Install runtime dependencies**

Run:
```bash
npm install \
  @prisma/client@5.17.0 \
  next-auth@4.24.7 \
  bcryptjs@2.4.3 \
  zod@3.23.8 \
  nodemailer@6.9.14 \
  react-hook-form@7.52.1 \
  @hookform/resolvers@3.9.0 \
  clsx@2.1.1
```

- [ ] **Step 2: Install dev dependencies**

Run:
```bash
npm install -D \
  prisma@5.17.0 \
  @types/bcryptjs@2.4.6 \
  @types/nodemailer@6.4.15 \
  vitest@1.6.0 \
  @vitest/coverage-v8@1.6.0 \
  dotenv@16.4.5 \
  tsx@4.16.2
```

- [ ] **Step 3: Verify install**

Run: `npm ls --depth=0`
Expected: all packages listed without `UNMET DEPENDENCY` errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install runtime and dev dependencies"
```

---

## Task 4: Set up Vitest

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `src/lib/test/example.test.ts` (sanity)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```ts
import { config } from 'dotenv';
import path from 'node:path';

// Tests read .env.test if present, otherwise .env. .env.test overrides DATABASE_URL
// to point at the test database.
config({ path: path.resolve(process.cwd(), '.env'), override: false });
config({ path: path.resolve(process.cwd(), '.env.test'), override: true });

// Ensure tests never accidentally send real email.
process.env.EMAIL_TEST_MODE = 'true';
```

- [ ] **Step 3: Create `.env.test`**

```bash
DATABASE_URL="postgresql://careers:careers_dev_only@localhost:5433/careers_test?schema=public"
NEXTAUTH_SECRET="test-secret-do-not-use-in-prod"
NEXTAUTH_URL="http://localhost:3000"
EMAIL_TEST_MODE="true"
STORAGE_ROOT="./uploads-test"
APP_URL="http://localhost:3000"
SMTP_HOST="smtp.localhost"
SMTP_PORT="1025"
SMTP_SECURE="false"
SMTP_USER="test"
SMTP_PASS="test"
SMTP_FROM_NAME="ItsNotTechy Careers (TEST)"
SMTP_FROM_EMAIL="test@itsnottechy.com"
```

Add `.env.test` to `.gitignore` — append this line:
```
.env.test
```

- [ ] **Step 4: Write a sanity test**

`src/lib/test/example.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

describe('vitest sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });

  it('reads env from setup', () => {
    expect(process.env.EMAIL_TEST_MODE).toBe('true');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: 2 passed, 0 failed. If `EMAIL_TEST_MODE` is undefined the setup file isn't loaded — fix `vitest.setup.ts` path before continuing.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts vitest.setup.ts .env.test .gitignore src/lib/test/
git commit -m "chore: configure Vitest with env loader and sanity test"
```

---

## Task 5: Add the full Prisma schema

**Files:**
- Create: `prisma/schema.prisma`, `src/types/customQuestions.ts`

The schema below is copied verbatim from the spec (Section 4). No models, fields, or enums diverge — if the spec changes, this file changes.

- [ ] **Step 1: Create `prisma/schema.prisma`**

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============ ENUMS ============

enum Role {
  SUPER_ADMIN
  HR_MANAGER
  MANAGER
  EMPLOYEE
  CANDIDATE
}

enum JobStatus    { DRAFT  OPEN  CLOSED }
enum JobType      { FULL_TIME  PART_TIME  CONTRACT  INTERN }
enum LocationType { REMOTE  ONSITE  HYBRID }

enum AppStage {
  APPLIED
  SCREENING
  INTERVIEW
  OFFER
  HIRED
  REJECTED
}

enum ReferralStatus  { SUBMITTED  CONTACTED  CONVERTED  REJECTED }
enum InterviewFormat { VIDEO  PHONE  IN_PERSON }
enum InterviewStatus { SCHEDULED  COMPLETED  CANCELLED  NO_SHOW }
enum Decision        { APPROVED  REJECTED }
enum PromotionStatus { PENDING_MANAGER  PENDING_HR  APPROVED  REJECTED }
enum EmailStatus     { QUEUED  SENT  FAILED }

// ============ MODELS ============

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String?
  name         String
  role         Role
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  employee               Employee?
  candidateProfile       CandidateProfile?
  applications           Application[]        @relation("CandidateApplications")
  notesAuthored          ApplicationNote[]
  referralsMade          Referral[]           @relation("ReferringEmployee")
  interviewsAsInterviewer Interview[]         @relation("Interviewer")
  promotionRequests      PromotionRequest[]   @relation("Submitter")
  promotionsAsManager    PromotionRequest[]   @relation("ApprovingManager")
  jobsPosted             Job[]                @relation("JobsPosted")
  auditEntries           AuditLog[]
  inviteTokens           InviteToken[]
  passwordResets         PasswordResetToken[]

  @@index([role, isActive])
}

model Employee {
  id           String   @id @default(cuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  employeeCode String   @unique
  department   String
  title        String
  managerId    String?
  manager      Employee?  @relation("EmployeeReports", fields: [managerId], references: [id], onDelete: SetNull)
  reports      Employee[] @relation("EmployeeReports")
  hireDate     DateTime
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  @@index([managerId])
  @@index([department])
}

model CandidateProfile {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  phone       String?
  location    String?
  linkedinUrl String?
  resumeUrl   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Job {
  id              String       @id @default(cuid())
  title           String
  department      String
  locationType    LocationType
  locationCity    String?
  type            JobType
  description     String       @db.Text
  requirements    String       @db.Text
  salaryMin       Int?
  salaryMax       Int?
  currency        String       @default("USD")
  deadline        DateTime?
  status          JobStatus    @default(DRAFT)
  customQuestions Json         @default("[]")
  postedById      String
  postedBy        User         @relation("JobsPosted", fields: [postedById], references: [id])
  createdAt       DateTime     @default(now())
  closedAt        DateTime?
  updatedAt       DateTime     @updatedAt

  applications Application[]
  referrals    Referral[]

  @@index([status, createdAt])
  @@index([department])
}

model Application {
  id              String   @id @default(cuid())
  jobId           String
  job             Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  candidateUserId String
  candidate       User     @relation("CandidateApplications", fields: [candidateUserId], references: [id], onDelete: Cascade)
  stage           AppStage @default(APPLIED)
  resumeUrl       String
  coverLetter     String?  @db.Text
  customAnswers   Json     @default("{}")
  referralId      String?  @unique
  referral        Referral? @relation(fields: [referralId], references: [id])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  notes      ApplicationNote[]
  interviews Interview[]

  @@unique([jobId, candidateUserId])
  @@index([stage])
  @@index([candidateUserId])
}

model ApplicationNote {
  id            String      @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  authorUserId  String
  author        User        @relation(fields: [authorUserId], references: [id])
  body          String      @db.Text
  createdAt     DateTime    @default(now())

  @@index([applicationId, createdAt])
}

model Referral {
  id              String         @id @default(cuid())
  referringUserId String
  referringUser   User           @relation("ReferringEmployee", fields: [referringUserId], references: [id])
  jobId           String
  job             Job            @relation(fields: [jobId], references: [id], onDelete: Cascade)
  candidateEmail  String
  candidateName   String
  relationship    String
  resumeUrl       String?
  status          ReferralStatus @default(SUBMITTED)
  applicationId   String?        @unique
  application     Application?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([referringUserId])
  @@index([candidateEmail, jobId])
}

model Interview {
  id                String          @id @default(cuid())
  applicationId     String
  application       Application     @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  scheduledAt       DateTime
  durationMinutes   Int             @default(45)
  format            InterviewFormat
  interviewerUserId String
  interviewer       User            @relation("Interviewer", fields: [interviewerUserId], references: [id])
  locationOrLink    String
  status            InterviewStatus @default(SCHEDULED)
  notes             String?         @db.Text
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([interviewerUserId, scheduledAt])
  @@index([applicationId])
}

model PromotionRequest {
  id               String          @id @default(cuid())
  employeeUserId   String
  employee         User            @relation("Submitter", fields: [employeeUserId], references: [id])
  currentTitle     String
  targetTitle      String
  justification    String          @db.Text
  supportingDocUrl String?
  managerUserId    String
  manager          User            @relation("ApprovingManager", fields: [managerUserId], references: [id])
  managerDecision  Decision?
  managerNotes     String?         @db.Text
  managerDecidedAt DateTime?
  hrDecision       Decision?
  hrNotes          String?         @db.Text
  hrDecidedAt      DateTime?
  finalStatus      PromotionStatus @default(PENDING_MANAGER)
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  @@index([managerUserId, finalStatus])
  @@index([employeeUserId])
}

model EmailLog {
  id        String      @id @default(cuid())
  toEmail   String
  subject   String
  template  String
  payload   Json
  status    EmailStatus @default(QUEUED)
  error     String?     @db.Text
  sentAt    DateTime?
  createdAt DateTime    @default(now())

  @@index([status, createdAt])
  @@index([toEmail])
}

model AuditLog {
  id          String   @id @default(cuid())
  actorUserId String?
  actor       User?    @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  action      String
  entityType  String
  entityId    String
  metadata    Json     @default("{}")
  createdAt   DateTime @default(now())

  @@index([entityType, entityId])
  @@index([actorUserId, createdAt])
}

model InviteToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([token])
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([token])
}
```

- [ ] **Step 2: Add the CustomQuestion type (used by Job.customQuestions JSON)**

`src/types/customQuestions.ts`:
```ts
export type CustomQuestion =
  | { id: string; type: 'SHORT_TEXT';    label: string; required: boolean }
  | { id: string; type: 'LONG_TEXT';     label: string; required: boolean }
  | { id: string; type: 'SINGLE_CHOICE'; label: string; required: boolean; options: string[] }
  | { id: string; type: 'YES_NO';        label: string; required: boolean };

export type CustomAnswers = Record<string, string>;
```

- [ ] **Step 3: Generate the Prisma client**

Run: `npx prisma generate`
Expected: prints `✔ Generated Prisma Client (v5.17.0)`.

- [ ] **Step 4: Create the first migration against dev DB**

Run: `npx prisma migrate dev --name init`
Expected: prints `Applying migration '20250517XXXXXX_init'` and `Your database is now in sync with your schema.` Creates `prisma/migrations/<timestamp>_init/migration.sql`.

- [ ] **Step 5: Apply migration to test DB**

Run:
```bash
TEST_URL=$(grep TEST_DATABASE_URL .env | cut -d= -f2- | tr -d '"')
DATABASE_URL="$TEST_URL" npx prisma migrate deploy
```
Expected: `No pending migrations to apply.` would be wrong; first run says `Applying migration ... init`.

- [ ] **Step 6: Verify in Prisma Studio**

Run: `npx prisma studio` (opens http://localhost:5555). Expected: sidebar lists all 13 tables (`User`, `Employee`, `CandidateProfile`, `Job`, `Application`, `ApplicationNote`, `Referral`, `Interview`, `PromotionRequest`, `EmailLog`, `AuditLog`, `InviteToken`, `PasswordResetToken`). Close it with `Ctrl+C`.

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/types/
git commit -m "feat(db): add Prisma schema for all 13 models and run initial migration"
```

---

## Task 6: Prisma client singleton

**Files:**
- Create: `src/lib/prisma.ts`, `src/lib/prisma.test.ts`

Next.js dev hot-reload creates multiple `PrismaClient` instances if we don't memoize on `globalThis`. This is the canonical pattern.

- [ ] **Step 1: Write the failing test**

`src/lib/prisma.test.ts`:
```ts
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
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/prisma.test.ts`
Expected: FAIL, `Cannot find module './prisma'`.

- [ ] **Step 3: Implement**

`src/lib/prisma.ts`:
```ts
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- src/lib/prisma.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prisma.ts src/lib/prisma.test.ts
git commit -m "feat(lib): add Prisma client singleton with HMR-safe global cache"
```

---

## Task 7: Test helpers — DB reset between tests

**Files:**
- Create: `src/lib/test/db.ts`

DB-touching tests need a clean slate. This helper truncates every table in dependency-safe order (or via TRUNCATE ... CASCADE).

- [ ] **Step 1: Implement**

`src/lib/test/db.ts`:
```ts
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

  // Order matters only without CASCADE; with CASCADE we can list all tables.
  const tables = [
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
```

- [ ] **Step 2: Write a smoke test**

`src/lib/test/db.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from './db';

describe('resetDb', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('starts with an empty User table', async () => {
    expect(await prisma.user.count()).toBe(0);
  });

  it('clears records inserted by a previous test', async () => {
    await prisma.user.create({
      data: { email: 'a@b.com', name: 'A', role: 'CANDIDATE' },
    });
    expect(await prisma.user.count()).toBe(1);
    await resetDb();
    expect(await prisma.user.count()).toBe(0);
  });

  it('refuses to run against a non-test DB', async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://x:y@z/careers?schema=public';
    await expect(resetDb()).rejects.toThrow(/refused/);
    process.env.DATABASE_URL = original;
  });
});
```

- [ ] **Step 3: Run**

Run: `npm test -- src/lib/test/db.test.ts`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/test/db.ts src/lib/test/db.test.ts
git commit -m "test: add resetDb helper for DB-touching tests"
```

---

## Task 8: Password hashing

**Files:**
- Create: `src/lib/password.ts`, `src/lib/password.test.ts`

Wraps bcryptjs with a fixed cost factor. We expose two functions: `hashPassword` and `verifyPassword`.

- [ ] **Step 1: Write failing tests**

`src/lib/password.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hashes a password to a non-empty string different from the input', async () => {
    const hash = await hashPassword('hunter2');
    expect(hash).toBeTypeOf('string');
    expect(hash.length).toBeGreaterThan(20);
    expect(hash).not.toBe('hunter2');
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('hunter2');
    expect(await verifyPassword('hunter2', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('hunter2');
    expect(await verifyPassword('hunter3', hash)).toBe(false);
  });

  it('rejects when hash is null or empty', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', '')).toBe(false);
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/password.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/lib/password.ts`:
```ts
import bcrypt from 'bcryptjs';

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- src/lib/password.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/password.ts src/lib/password.test.ts
git commit -m "feat(lib): add password hashing helpers (bcrypt cost 12)"
```

---

## Task 9: Token utilities (invite + password reset)

**Files:**
- Create: `src/lib/tokens.ts`, `src/lib/tokens.test.ts`

Generates URL-safe random tokens and centralises the issue/consume flow for `InviteToken` and `PasswordResetToken`. Uses `node:crypto` (no third-party dep).

- [ ] **Step 1: Write failing tests**

`src/lib/tokens.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import {
  generateTokenString,
  issueInviteToken,
  consumeInviteToken,
  issuePasswordResetToken,
  consumePasswordResetToken,
} from './tokens';

async function makeUser(email = 'u@example.com') {
  return prisma.user.create({
    data: { email, name: 'U', role: 'CANDIDATE' },
  });
}

describe('generateTokenString', () => {
  it('returns a URL-safe string of expected length', () => {
    const t = generateTokenString();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(40);
  });

  it('produces unique values across calls', () => {
    const a = generateTokenString();
    const b = generateTokenString();
    expect(a).not.toBe(b);
  });
});

describe('invite token lifecycle', () => {
  beforeEach(() => resetDb());

  it('issues a token tied to a user with a future expiry', async () => {
    const user = await makeUser();
    const token = await issueInviteToken(user.id);

    const row = await prisma.inviteToken.findUnique({ where: { token } });
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(user.id);
    expect(row!.usedAt).toBeNull();
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('consume returns the userId for a valid unused token', async () => {
    const user = await makeUser();
    const token = await issueInviteToken(user.id);

    const result = await consumeInviteToken(token);
    expect(result).toEqual({ ok: true, userId: user.id });

    const row = await prisma.inviteToken.findUnique({ where: { token } });
    expect(row!.usedAt).not.toBeNull();
  });

  it('consume rejects an unknown token', async () => {
    const r = await consumeInviteToken('nonsense');
    expect(r).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('consume rejects an already-used token', async () => {
    const user = await makeUser();
    const token = await issueInviteToken(user.id);
    await consumeInviteToken(token);

    const r = await consumeInviteToken(token);
    expect(r).toEqual({ ok: false, reason: 'ALREADY_USED' });
  });

  it('consume rejects an expired token', async () => {
    const user = await makeUser();
    const token = generateTokenString();
    await prisma.inviteToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const r = await consumeInviteToken(token);
    expect(r).toEqual({ ok: false, reason: 'EXPIRED' });
  });
});

describe('password reset token lifecycle', () => {
  beforeEach(() => resetDb());

  it('issue + consume round-trip', async () => {
    const user = await makeUser();
    const token = await issuePasswordResetToken(user.id);
    const r = await consumePasswordResetToken(token);
    expect(r).toEqual({ ok: true, userId: user.id });
  });

  it('rejects expired reset token', async () => {
    const user = await makeUser();
    const token = generateTokenString();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() - 1) },
    });
    const r = await consumePasswordResetToken(token);
    expect(r).toEqual({ ok: false, reason: 'EXPIRED' });
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/tokens.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/lib/tokens.ts`:
```ts
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';

const INVITE_TTL_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days
const RESET_TTL_MS   =     60 * 60 * 1000;       // 1 hour

export type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'NOT_FOUND' | 'ALREADY_USED' | 'EXPIRED' };

export function generateTokenString(): string {
  // 32 random bytes → 43-char base64url string
  return crypto.randomBytes(32).toString('base64url');
}

export async function issueInviteToken(userId: string): Promise<string> {
  const token = generateTokenString();
  await prisma.inviteToken.create({
    data: { userId, token, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });
  return token;
}

export async function consumeInviteToken(token: string): Promise<ConsumeResult> {
  const row = await prisma.inviteToken.findUnique({ where: { token } });
  if (!row) return { ok: false, reason: 'NOT_FOUND' };
  if (row.usedAt) return { ok: false, reason: 'ALREADY_USED' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'EXPIRED' };
  await prisma.inviteToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return { ok: true, userId: row.userId };
}

export async function issuePasswordResetToken(userId: string): Promise<string> {
  const token = generateTokenString();
  await prisma.passwordResetToken.create({
    data: { userId, token, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });
  return token;
}

export async function consumePasswordResetToken(token: string): Promise<ConsumeResult> {
  const row = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!row) return { ok: false, reason: 'NOT_FOUND' };
  if (row.usedAt) return { ok: false, reason: 'ALREADY_USED' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'EXPIRED' };
  await prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return { ok: true, userId: row.userId };
}
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- src/lib/tokens.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tokens.ts src/lib/tokens.test.ts
git commit -m "feat(lib): add invite and password-reset token issuance/consumption"
```

---

## Task 10: RBAC helpers

**Files:**
- Create: `src/lib/rbac.ts`, `src/lib/rbac.test.ts`

Pure functions over role values. `requireRole` / `requireAnyRole` throw `AuthorizationError`; UI/middleware layers translate that to redirects or 403s. NextAuth session integration happens in plan 1B; for now these helpers operate over a `SessionUser` shape we define here.

- [ ] **Step 1: Write failing tests**

`src/lib/rbac.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import {
  AuthorizationError,
  hasRole,
  requireRole,
  requireAnyRole,
  dashboardPathForRole,
  type SessionUser,
} from './rbac';

const make = (role: Role): SessionUser => ({
  id: 'u1',
  email: 'u@x.com',
  name: 'U',
  role,
});

describe('hasRole', () => {
  it('true when user has one of the allowed roles', () => {
    expect(hasRole(make('HR_MANAGER'), ['HR_MANAGER', 'SUPER_ADMIN'])).toBe(true);
  });
  it('false when not', () => {
    expect(hasRole(make('EMPLOYEE'), ['HR_MANAGER'])).toBe(false);
  });
  it('false when user is null', () => {
    expect(hasRole(null, ['HR_MANAGER'])).toBe(false);
  });
});

describe('requireRole', () => {
  it('returns the user when role matches', () => {
    const u = make('SUPER_ADMIN');
    expect(requireRole(u, 'SUPER_ADMIN')).toBe(u);
  });
  it('throws AuthorizationError when role does not match', () => {
    expect(() => requireRole(make('EMPLOYEE'), 'HR_MANAGER')).toThrow(AuthorizationError);
  });
  it('throws when user is null', () => {
    expect(() => requireRole(null, 'EMPLOYEE')).toThrow(AuthorizationError);
  });
});

describe('requireAnyRole', () => {
  it('returns user when any role matches', () => {
    const u = make('MANAGER');
    expect(requireAnyRole(u, ['MANAGER', 'EMPLOYEE'])).toBe(u);
  });
  it('throws when none match', () => {
    expect(() => requireAnyRole(make('CANDIDATE'), ['MANAGER', 'EMPLOYEE'])).toThrow(AuthorizationError);
  });
});

describe('dashboardPathForRole', () => {
  it.each([
    ['SUPER_ADMIN', '/dashboard/admin'],
    ['HR_MANAGER', '/dashboard/hr'],
    ['MANAGER', '/dashboard/manager'],
    ['EMPLOYEE', '/dashboard/employee'],
    ['CANDIDATE', '/dashboard/candidate'],
  ] as const)('routes %s to %s', (role, path) => {
    expect(dashboardPathForRole(role)).toBe(path);
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/rbac.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/rbac.ts`:
```ts
import { Role } from '@prisma/client';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export class AuthorizationError extends Error {
  constructor(message = 'Not authorized') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function hasRole(user: SessionUser | null | undefined, allowed: Role[]): boolean {
  if (!user) return false;
  return allowed.includes(user.role);
}

export function requireRole(user: SessionUser | null | undefined, role: Role): SessionUser {
  if (!user || user.role !== role) throw new AuthorizationError();
  return user;
}

export function requireAnyRole(
  user: SessionUser | null | undefined,
  roles: Role[],
): SessionUser {
  if (!user || !roles.includes(user.role)) throw new AuthorizationError();
  return user;
}

export function dashboardPathForRole(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN': return '/dashboard/admin';
    case 'HR_MANAGER':  return '/dashboard/hr';
    case 'MANAGER':     return '/dashboard/manager';
    case 'EMPLOYEE':    return '/dashboard/employee';
    case 'CANDIDATE':   return '/dashboard/candidate';
  }
}
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- src/lib/rbac.test.ts`
Expected: 9 passed (counting the parameterised `dashboardPathForRole`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rbac.ts src/lib/rbac.test.ts
git commit -m "feat(lib): add RBAC helpers (hasRole, requireRole, dashboardPathForRole)"
```

---

## Task 11: Validation primitives

**Files:**
- Create: `src/lib/validation/common.ts`, `src/lib/validation/common.test.ts`

Reusable Zod schemas: email, password rules, name, optional phone. Domain-specific schemas (job, application, etc.) come in their own phase plans.

- [ ] **Step 1: Write failing tests**

`src/lib/validation/common.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  nameSchema,
  optionalPhoneSchema,
} from './common';

describe('emailSchema', () => {
  it('accepts valid emails (lowercased)', () => {
    expect(emailSchema.parse('Hi@Example.com')).toBe('hi@example.com');
  });
  it('rejects invalid emails', () => {
    expect(() => emailSchema.parse('not-an-email')).toThrow();
  });
});

describe('passwordSchema', () => {
  it('accepts min 10 chars with upper/lower/number', () => {
    expect(passwordSchema.parse('Hunter2pass')).toBe('Hunter2pass');
  });
  it('rejects short passwords', () => {
    expect(() => passwordSchema.parse('Aa1aaaaa')).toThrow(/at least 10/);
  });
  it('rejects missing upper case', () => {
    expect(() => passwordSchema.parse('lowercase1!')).toThrow(/uppercase/);
  });
  it('rejects missing digit', () => {
    expect(() => passwordSchema.parse('NoDigitsHere!')).toThrow(/number/);
  });
});

describe('nameSchema', () => {
  it('trims and accepts a normal name', () => {
    expect(nameSchema.parse('  Alice Doe  ')).toBe('Alice Doe');
  });
  it('rejects empty', () => {
    expect(() => nameSchema.parse('   ')).toThrow();
  });
});

describe('optionalPhoneSchema', () => {
  it('accepts undefined and empty as undefined', () => {
    expect(optionalPhoneSchema.parse(undefined)).toBeUndefined();
    expect(optionalPhoneSchema.parse('')).toBeUndefined();
  });
  it('accepts E.164-ish formats', () => {
    expect(optionalPhoneSchema.parse('+1-415-555-2671')).toBe('+1-415-555-2671');
  });
  it('rejects letters', () => {
    expect(() => optionalPhoneSchema.parse('call-me')).toThrow();
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/validation/common.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/validation/common.ts`:
```ts
import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .refine((s) => /[A-Z]/.test(s), 'Password must contain an uppercase letter')
  .refine((s) => /[a-z]/.test(s), 'Password must contain a lowercase letter')
  .refine((s) => /[0-9]/.test(s), 'Password must contain a number');

export const nameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, 'Name is required').max(120, 'Name too long'));

export const optionalPhoneSchema = z
  .string()
  .optional()
  .transform((s) => (s && s.trim().length > 0 ? s.trim() : undefined))
  .refine(
    (s) => s === undefined || /^[+0-9 ()\-]{5,30}$/.test(s),
    'Phone may contain digits, spaces, +, -, ( )',
  );
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- src/lib/validation/common.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/
git commit -m "feat(lib): add common Zod validators (email, password, name, phone)"
```

---

## Task 12: Audit log helper

**Files:**
- Create: `src/lib/audit.ts`, `src/lib/audit.test.ts`

One function: `recordAudit({ actorUserId, action, entityType, entityId, metadata })`. Future tasks call it after any state-changing operation; the Phase 7 admin UI reads from `AuditLog`.

- [ ] **Step 1: Write failing tests**

`src/lib/audit.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { recordAudit } from './audit';

describe('recordAudit', () => {
  beforeEach(() => resetDb());

  it('inserts an AuditLog row with the given fields', async () => {
    const user = await prisma.user.create({
      data: { email: 'a@x.com', name: 'A', role: 'HR_MANAGER' },
    });
    await recordAudit({
      actorUserId: user.id,
      action: 'JOB_CREATED',
      entityType: 'Job',
      entityId: 'job-1',
      metadata: { title: 'Engineer' },
    });
    const rows = await prisma.auditLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorUserId: user.id,
      action: 'JOB_CREATED',
      entityType: 'Job',
      entityId: 'job-1',
    });
    expect(rows[0]!.metadata).toEqual({ title: 'Engineer' });
  });

  it('allows a null actor (system-triggered events)', async () => {
    await recordAudit({
      actorUserId: null,
      action: 'SYSTEM_TASK_RAN',
      entityType: 'System',
      entityId: 'cron-1',
    });
    const rows = await prisma.auditLog.findMany();
    expect(rows[0]!.actorUserId).toBeNull();
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/audit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/audit.ts`:
```ts
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type AuditInput = {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.JsonObject;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- src/lib/audit.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit.ts src/lib/audit.test.ts
git commit -m "feat(lib): add recordAudit() for AuditLog writes"
```

---

## Task 13: Full test sweep + dependency lockdown

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: all tests across all files pass (~30 tests).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors (warnings OK).

- [ ] **Step 4: Confirm migrations are committed**

Run: `git status`
Expected: clean working tree. If `prisma/migrations/...` is showing as untracked, `git add` and commit it as `chore(db): track initial migration`.

- [ ] **Step 5: Final commit if needed, then stop**

If `git status` was clean, you're done with plan 1A. Move on to plan 1B (auth, NextAuth, email infra, middleware).

---

## Self-review notes (informational)

- Every test creates its own test data via `resetDb` in `beforeEach`; no test depends on prior state.
- Every code file with logic has a colocated `.test.ts` file.
- No `any` types used.
- Secrets touched: SMTP password only documented in `.env.example` as a placeholder; never written into source or migrations.
- After this plan you have: working scaffold, DB schema deployed, and 6 tested utility modules (`prisma`, `password`, `tokens`, `rbac`, `validation/common`, `audit`). No HTTP surface yet — that arrives in 1B.
