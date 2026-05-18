# ItsNotTechy Careers — Design Spec

**Date:** 2026-05-17
**Status:** Draft for review
**Domain:** `career.itsnottechy.com`

---

## 1. Overview

ItsNotTechy Careers is a multi-role hiring management portal modeled functionally after Workday/Greenhouse but scoped lean for MVP deployment on a single Ubuntu VPS.

It serves five user roles:

- **SUPER_ADMIN** — full system control, only role that can create other Super Admins, sees audit log
- **HR_MANAGER** — runs hiring (jobs, ATS, interviews, referral oversight, final promotion decisions)
- **MANAGER** — Employee + reviews promotion requests from direct reports
- **EMPLOYEE** — refers candidates, submits promotion requests
- **CANDIDATE** — applies to jobs, tracks application status

It is built as a single Next.js 14 application backed by Postgres.

### Success criteria for MVP launch
- HR can post a job, candidate can apply, HR can move them through the pipeline, candidate is emailed at each stage.
- Employee can refer a candidate; that candidate becomes an application; the referring employee sees status updates.
- HR can schedule an interview; both parties get an email with a calendar invite.
- Employee can request a promotion; their manager approves/rejects; HR makes the final call; emails fire at each step.
- Super Admin can audit who did what.

### Out of scope (defer to v2)
- Custom interview scorecards or feedback forms
- Multi-stage interview loops with multiple interviewers per stage
- Offer letter generation / e-signature
- Onboarding workflows after hire
- Public-facing employer brand pages, blog, etc.
- Job alerts / saved searches for candidates
- Bulk candidate import or resume parsing
- Google Calendar / Outlook OAuth (we send .ics attachments, no two-way sync)
- Internationalization
- Two-factor authentication
- Mobile native app

---

## 2. Tech stack

| Layer        | Choice                                            |
|--------------|---------------------------------------------------|
| Framework    | Next.js 14 (App Router), TypeScript                |
| Styling      | Tailwind CSS                                       |
| Database     | PostgreSQL 16 (Docker in dev, native on VPS)       |
| ORM          | Prisma                                             |
| Auth         | NextAuth.js with Credentials provider              |
| Forms        | React Hook Form + Zod schemas (shared client/server) |
| Email        | Nodemailer over Hostinger SMTP (`smtp.hostinger.com:465`, SSL) |
| File storage | Local VPS disk, served through auth-checked API route |
| Process      | PM2 on VPS, Nginx reverse proxy, Certbot for TLS  |
| Local dev    | docker-compose (Postgres only)                     |

### Tech decisions made
- **Monolithic Next.js.** Mutations use server actions; API routes only for file upload, authenticated file serving, and anything that may need a non-React client later.
- **Business logic in `/lib`**, not in routes. Keeps logic testable and portable if we ever split out the API.
- **Single Postgres database.** No read replicas, no caching layer for MVP.
- **No Redis / queue.** Email sends happen inline; failures are logged in `EmailLog` for retry. If volume grows, swap in BullMQ later.

---

## 3. Architecture

```
Browser
  │
  ▼
Nginx (TLS terminator, reverse proxy)  ─── Certbot for SSL renewals
  │
  ▼
PM2 → Node.js → Next.js 14 (port 3000)
  │       │
  │       ├── App Router (RSC + server actions + API routes)
  │       ├── /lib (business logic, validation, email, file storage)
  │       └── /prisma (schema + migrations)
  │
  ▼
PostgreSQL (port 5432, local Unix socket on VPS)

File uploads → /var/itsnottechy/uploads/<entityType>/<entityId>/<filename>
Served via GET /api/files/[...path] with role + ownership checks.
```

### Directory layout (target)

```
careeritsnottechy/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx                  # landing
│   │   │   ├── jobs/page.tsx             # job board
│   │   │   └── jobs/[id]/page.tsx        # job detail + apply
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx         # candidate self-register
│   │   │   ├── invite/[token]/page.tsx   # staff password setup
│   │   │   └── reset/[token]/page.tsx
│   │   ├── dashboard/
│   │   │   ├── candidate/...
│   │   │   ├── employee/...
│   │   │   ├── manager/...
│   │   │   ├── hr/...
│   │   │   └── admin/...
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── upload/route.ts
│   │       └── files/[...path]/route.ts
│   ├── components/
│   │   ├── ui/                # Button, Input, Modal, Badge, etc.
│   │   ├── jobs/              # JobCard, JobFilters, etc.
│   │   ├── ats/               # PipelineBoard, StageColumn, etc.
│   │   └── forms/             # DynamicQuestionsForm, etc.
│   ├── lib/
│   │   ├── auth.ts            # NextAuth options
│   │   ├── rbac.ts            # role checks, requireRole()
│   │   ├── prisma.ts          # singleton client
│   │   ├── email.ts           # sendEmail() + template registry
│   │   ├── storage.ts         # file upload/serve helpers
│   │   ├── validation/        # Zod schemas per entity
│   │   └── services/          # business logic (applicationService, etc.)
│   ├── emails/
│   │   ├── layouts/base.html
│   │   └── templates/*.html   # one per email event
│   ├── types/
│   ├── hooks/
│   └── middleware.ts          # route protection
├── public/
├── docs/
├── docker-compose.yml
├── .env.example
├── README.md
└── package.json
```

---

## 4. Data model

Eleven Prisma models. Postgres-specific types used where helpful (`@db.Text`, `Json`).

```prisma
// ============ ENUMS ============

enum Role {
  SUPER_ADMIN
  HR_MANAGER
  MANAGER
  EMPLOYEE
  CANDIDATE
}

enum JobStatus { DRAFT  OPEN  CLOSED }
enum JobType   { FULL_TIME  PART_TIME  CONTRACT  INTERN }
enum LocationType { REMOTE  ONSITE  HYBRID }

enum AppStage {
  APPLIED
  SCREENING
  INTERVIEW
  OFFER
  HIRED
  REJECTED
}

enum ReferralStatus { SUBMITTED  CONTACTED  CONVERTED  REJECTED }

enum InterviewFormat { VIDEO  PHONE  IN_PERSON }
enum InterviewStatus { SCHEDULED  COMPLETED  CANCELLED  NO_SHOW }

enum Decision { APPROVED  REJECTED }
enum PromotionStatus { PENDING_MANAGER  PENDING_HR  APPROVED  REJECTED }

enum EmailStatus { QUEUED  SENT  FAILED }

// ============ MODELS ============

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String?           // null until invite-token consumed
  name          String
  role          Role
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  employee          Employee?
  candidateProfile  CandidateProfile?
  applications      Application[]        @relation("CandidateApplications")
  notesAuthored     ApplicationNote[]
  referralsMade     Referral[]           @relation("ReferringEmployee")
  interviewsAsInterviewer Interview[]    @relation("Interviewer")
  promotionRequests       PromotionRequest[] @relation("Submitter")
  promotionsAsManager     PromotionRequest[] @relation("ApprovingManager")
  auditEntries     AuditLog[]
  inviteTokens     InviteToken[]
  passwordResets   PasswordResetToken[]

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
  id           String   @id @default(cuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  phone        String?
  location     String?
  linkedinUrl  String?
  resumeUrl    String?           // default resume; per-application resume on Application
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Job {
  id              String     @id @default(cuid())
  title           String
  department      String
  locationType    LocationType
  locationCity    String?
  type            JobType
  description     String     @db.Text
  requirements    String     @db.Text
  salaryMin       Int?
  salaryMax       Int?
  currency        String     @default("USD")
  deadline        DateTime?
  status          JobStatus  @default(DRAFT)
  customQuestions Json       @default("[]")  // [{id, label, type, required, options?}]
  postedById      String
  postedBy        User       @relation("JobsPosted", fields: [postedById], references: [id])
  createdAt       DateTime   @default(now())
  closedAt        DateTime?
  updatedAt       DateTime   @updatedAt

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

  @@unique([jobId, candidateUserId])   // one application per candidate per job
  @@index([stage])
  @@index([candidateUserId])
}

model ApplicationNote {
  id            String   @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  authorUserId  String
  author        User     @relation(fields: [authorUserId], references: [id])
  body          String   @db.Text
  createdAt     DateTime @default(now())

  @@index([applicationId, createdAt])
}

model Referral {
  id                  String   @id @default(cuid())
  referringUserId     String
  referringUser       User     @relation("ReferringEmployee", fields: [referringUserId], references: [id])
  jobId               String
  job                 Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  candidateEmail      String
  candidateName       String
  relationship        String
  resumeUrl           String?
  status              ReferralStatus @default(SUBMITTED)
  applicationId       String?  @unique        // set when candidate registers + applies
  application         Application?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([referringUserId])
  @@index([candidateEmail, jobId])
}

model Interview {
  id                 String   @id @default(cuid())
  applicationId      String
  application        Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  scheduledAt        DateTime
  durationMinutes    Int      @default(45)
  format             InterviewFormat
  interviewerUserId  String
  interviewer        User     @relation("Interviewer", fields: [interviewerUserId], references: [id])
  locationOrLink     String                  // physical address OR meeting URL
  status             InterviewStatus @default(SCHEDULED)
  notes              String?  @db.Text
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([interviewerUserId, scheduledAt])  // for availability check
  @@index([applicationId])
}

model PromotionRequest {
  id                String   @id @default(cuid())
  employeeUserId    String
  employee          User     @relation("Submitter", fields: [employeeUserId], references: [id])
  currentTitle      String
  targetTitle       String
  justification     String   @db.Text
  supportingDocUrl  String?
  managerUserId     String
  manager           User     @relation("ApprovingManager", fields: [managerUserId], references: [id])
  managerDecision   Decision?
  managerNotes      String?  @db.Text
  managerDecidedAt  DateTime?
  hrDecision        Decision?
  hrNotes           String?  @db.Text
  hrDecidedAt       DateTime?
  finalStatus       PromotionStatus @default(PENDING_MANAGER)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([managerUserId, finalStatus])
  @@index([employeeUserId])
}

model EmailLog {
  id        String   @id @default(cuid())
  toEmail   String
  subject   String
  template  String
  payload   Json
  status    EmailStatus @default(QUEUED)
  error     String?  @db.Text
  sentAt    DateTime?
  createdAt DateTime @default(now())

  @@index([status, createdAt])
  @@index([toEmail])
}

model AuditLog {
  id           String   @id @default(cuid())
  actorUserId  String?
  actor        User?    @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  action       String                 // e.g. "JOB_CREATED", "APP_STAGE_CHANGED"
  entityType   String                 // e.g. "Job", "Application"
  entityId     String
  metadata     Json     @default("{}")
  createdAt    DateTime @default(now())

  @@index([entityType, entityId])
  @@index([actorUserId, createdAt])
}

model InviteToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([token])
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([token])
}
```

### Constraint and cascade summary
- `User` cascades to `Employee` and `CandidateProfile` (deleting a user removes their profile rows).
- Deleting a `Job` cascades to its `Application`s, `Referral`s, and `ApplicationNote`s / `Interview`s under those applications.
- Removing a manager from `Employee.managerId` is `SetNull` — direct reports become unassigned, not deleted. HR is notified in the UI to reassign.
- One `Application` per `(jobId, candidateUserId)` enforced by composite unique. **A candidate cannot re-apply to a job they previously applied to**, regardless of stage outcome. Re-application after rejection is out of scope for MVP.
- `Referral.applicationId` is unique — a referral converts to exactly one application.

### Which roles have an Employee row?
`Employee` rows are created for every user with role `HR_MANAGER`, `MANAGER`, or `EMPLOYEE`. This is what lets an HR_MANAGER also appear as someone's direct manager in `Employee.managerId`, and lets HR users be considered as interviewers. `SUPER_ADMIN` does NOT have an `Employee` row by default (it's an operations role, not a hiring participant), but they can be granted one via the user-management UI in Phase 7 if they need to interview or be referred. `CANDIDATE` never has an `Employee` row.

### `customQuestions` JSON schema (Job)

```ts
type CustomQuestion =
  | { id: string; type: 'SHORT_TEXT';  label: string; required: boolean }
  | { id: string; type: 'LONG_TEXT';   label: string; required: boolean }
  | { id: string; type: 'SINGLE_CHOICE'; label: string; required: boolean; options: string[] }
  | { id: string; type: 'YES_NO';      label: string; required: boolean };
```

`Application.customAnswers` shape: `{ [questionId: string]: string }`. Validated server-side against the job's current `customQuestions` at submit time.

---

## 5. RBAC

Enforced in three places, in order:

1. **`src/middleware.ts`** — coarse path-level checks. Redirects unauthenticated users to `/login`, and users to the wrong dashboard prefix (`/dashboard/hr/*` reachable only by HR_MANAGER / SUPER_ADMIN, etc.) get a 403 page.
2. **`requireRole(...roles)` helper in `src/lib/rbac.ts`** — called at the top of every server action and protected page's RSC. Throws `AuthorizationError`.
3. **Service layer** — per-record ownership checks (e.g. `EMPLOYEE` can only view their own referrals; `MANAGER` can only decide on promotions where `request.managerUserId === session.userId`).

### Capability matrix

| Capability                                  | SUPER_ADMIN | HR_MANAGER | MANAGER | EMPLOYEE | CANDIDATE |
|---------------------------------------------|:-----------:|:----------:|:-------:|:--------:|:---------:|
| View public job board / job detail          | ✓           | ✓          | ✓       | ✓        | ✓         |
| Apply to a job                              | —           | —          | —       | —        | ✓         |
| Create/edit/close jobs                      | ✓           | ✓          | —       | —        | —         |
| View all applications                       | ✓           | ✓          | —       | —        | —         |
| View own applications                       | —           | —          | —       | —        | ✓ own     |
| Move stage / add notes                      | ✓           | ✓          | —       | —        | —         |
| Schedule interview                          | ✓           | ✓          | —       | —        | —         |
| View interviews assigned to me              | ✓           | ✓          | ✓       | ✓        | ✓ own     |
| Submit referral                             | —           | —          | ✓       | ✓        | —         |
| View own referrals                          | —           | —          | ✓ own   | ✓ own    | —         |
| View all referrals                          | ✓           | ✓          | —       | —        | —         |
| Submit promotion request                    | —           | —          | ✓       | ✓        | —         |
| Approve/reject direct reports' promo        | —           | —          | ✓       | —        | —         |
| Final HR decision on promotion              | ✓           | ✓          | —       | —        | —         |
| Invite/create Employee + Manager + HR       | ✓           | ✓          | —       | —        | —         |
| Create another SUPER_ADMIN                  | ✓           | —          | —       | —        | —         |
| View audit log                              | ✓           | —          | —       | —        | —         |
| Edit system settings                        | ✓           | —          | —       | —        | —         |

### Dashboard routing

| Role           | Lands at                  |
|----------------|---------------------------|
| SUPER_ADMIN    | `/dashboard/admin`        |
| HR_MANAGER     | `/dashboard/hr`           |
| MANAGER        | `/dashboard/manager`      |
| EMPLOYEE       | `/dashboard/employee`     |
| CANDIDATE      | `/dashboard/candidate`    |

`/dashboard` itself is a server-side redirect based on session role.

---

## 6. Email events catalog

12 transactional templates. Every send writes an `EmailLog` row (`QUEUED` → `SENT`/`FAILED`).

| #  | Trigger                                            | Recipients                                | Template                       |
|----|----------------------------------------------------|-------------------------------------------|--------------------------------|
| 1  | HR invites a staff user (Employee/Manager/HR)      | Invitee                                   | `invite-staff`                 |
| 2  | Candidate self-registers                           | Candidate                                 | `welcome-candidate`            |
| 3  | Password reset requested                           | Requester                                 | `password-reset`               |
| 4  | Candidate submits application                      | Candidate                                 | `application-received`         |
| 5  | HR moves application stage                         | Candidate                                 | `application-status-changed`   |
| 6  | HR schedules interview                             | Candidate + interviewer (separate sends)  | `interview-scheduled` (+ .ics) |
| 7  | HR moves stage to OFFER                            | Candidate                                 | `offer-sent`                   |
| 8  | Employee submits referral                          | Referring employee + HR distribution      | `referral-submitted`           |
| 9  | Referred candidate's application stage changes     | Referring employee                        | `referral-status-update`       |
| 10 | Employee submits promotion request                 | Submitter + assigned manager              | `promotion-submitted`          |
| 11 | Manager approves or rejects promotion              | Submitter + HR distribution               | `promotion-manager-decision`   |
| 12 | HR makes final promotion decision                  | Submitter + manager                       | `promotion-final-decision`     |

### Infrastructure (`src/lib/email.ts`)

```ts
type TemplateName =
  | 'invite-staff' | 'welcome-candidate' | 'password-reset'
  | 'application-received' | 'application-status-changed'
  | 'interview-scheduled' | 'offer-sent'
  | 'referral-submitted' | 'referral-status-update'
  | 'promotion-submitted' | 'promotion-manager-decision' | 'promotion-final-decision';

export async function sendEmail<T extends TemplateName>(args: {
  to: string;
  template: T;
  data: TemplateData[T];
  attachments?: { filename: string; content: Buffer | string; contentType: string }[];
}): Promise<void>;
```

- Templates live in `src/emails/templates/<name>.html` with `{{handlebars}}` interpolation wrapped by `src/emails/layouts/base.html` (brand header, footer, unsubscribe note for marketing emails — N/A for MVP since all are transactional).
- `EMAIL_TEST_MODE=true` env var: skip Nodemailer call, log to console + write `EmailLog` row with status `QUEUED`. Useful for seed scripts.
- Failures don't throw to callers — they're logged with `status=FAILED, error=...`. Caller behavior continues (e.g. an application still saves if its confirmation email fails). A future admin retry button can re-fire `FAILED` rows.
- Distribution lists (e.g. "HR distribution" for referral-submitted) resolve at send time to all active `HR_MANAGER` users; each receives a separate `EmailLog` row.

---

## 7. File storage

- Files saved to `STORAGE_ROOT` (default `/var/itsnottechy/uploads` on VPS; `./uploads` in dev).
- Path scheme: `<entityType>/<entityId>/<random-hex>-<original-filename>`.
- Upload: `POST /api/upload` (multipart). Validates content-type against a whitelist (`pdf`, `doc`, `docx` for resumes; `pdf`, `png`, `jpg` for supporting docs) and size (`<= 5 MB`). Returns the stored relative path.
- Serving: `GET /api/files/[...path]` — checks session, looks up the related entity, enforces:
  - Resume on an Application → readable by SUPER_ADMIN, HR_MANAGER, the candidate themselves, the referring employee if linked.
  - Promotion supporting doc → readable by SUPER_ADMIN, HR_MANAGER, the employee themselves, their direct manager.
- Streams via `fs.createReadStream` with `Content-Disposition: inline` for PDFs.
- Files are NOT publicly accessible via Nginx static serving — Nginx forwards `/api/files/*` straight to Node so auth checks always run.

---

## 8. Key feature flows

### 8.1 Candidate apply flow
1. Candidate visits `/jobs/[id]`. Sees job + dynamic form built from `Job.customQuestions`.
2. If not logged in, "Apply" button takes them to `/register?returnTo=/jobs/[id]/apply` then back.
3. Submits form: uploads resume → `/api/upload`, posts answers via server action `submitApplication`.
4. Action validates with Zod, checks `(jobId, candidateUserId)` uniqueness, creates `Application`, fires email #4.
5. If a `Referral` row exists with matching `candidateEmail + jobId`, link it: set `Application.referralId` and `Referral.applicationId`, mark `Referral.status = CONVERTED`, fire email #9 to referrer.
6. Redirect to `/dashboard/candidate` with success toast.

### 8.2 ATS pipeline move
1. HR opens `/dashboard/hr/jobs/[id]/pipeline` — Kanban with 6 columns (one per `AppStage`).
2. Drag-and-drop or "Move to..." action fires server action `moveApplicationStage(applicationId, newStage)`.
3. Validates that transition is allowed (no skipping from APPLIED straight to HIRED, etc. — defined in `lib/services/atsService.ts`).
4. Writes new `stage`, writes `AuditLog`, fires email #5 (with stage-specific copy); if new stage is OFFER, fires email #7 instead.
5. If candidate has a linked `Referral`, fires email #9.
6. Returns updated record; client re-renders the board.

### 8.3 Interview scheduling
1. HR opens candidate profile, clicks "Schedule Interview".
2. Form: date+time, duration, format, interviewer (typeahead User search filtered to staff roles), location-or-link, notes.
3. On submit, server action checks `Interview` where `interviewerUserId = X AND scheduledAt overlaps`. If conflict, return a warning that HR must explicitly confirm to proceed.
4. Creates `Interview`, generates an `.ics` blob, fires email #6 once to candidate and once to interviewer (each with the .ics as attachment).
5. Interview shows on candidate profile, on interviewer's `/dashboard/*/interviews` widget, and on candidate's `/dashboard/candidate`.

### 8.4 Promotion request workflow
1. Employee at `/dashboard/employee/promotions/new` fills form. `managerUserId` auto-populated from `Employee.managerId` (their user record). Blocked from submitting if no manager assigned.
2. Server action creates `PromotionRequest` with `finalStatus = PENDING_MANAGER`, fires email #10.
3. Manager sees it in `/dashboard/manager/promotions`. Approves or rejects with notes.
4. If approved: `managerDecision = APPROVED`, `finalStatus = PENDING_HR`, fires email #11 to submitter + HR group.
5. If rejected: `managerDecision = REJECTED`, `finalStatus = REJECTED`, fires email #11.
6. For `PENDING_HR` requests, HR sees them in `/dashboard/hr/promotions`. Makes final decision.
7. `finalStatus` becomes `APPROVED` or `REJECTED`. Email #12 fires.

---

## 9. Authentication flows

### 9.1 Candidate self-register
- `/register` → form (name, email, password). Creates `User{role:CANDIDATE, passwordHash}` + empty `CandidateProfile`. Fires email #2. Signs them in. Redirects to `/dashboard/candidate`.

### 9.2 Staff invite
- HR at `/dashboard/hr/invite` enters name + email + role (EMPLOYEE / MANAGER / HR_MANAGER) + employee details (department, title, optional manager). Server action:
  - Creates `User{passwordHash:null, isActive:true}` + linked `Employee` row.
  - Creates `InviteToken` with 7-day expiry.
  - Fires email #1 with link `https://career.itsnottechy.com/invite/<token>`.
- Invitee clicks → `/invite/[token]` form, sets password. Token marked used, user signs in, redirected to their role dashboard.

### 9.3 Password reset
- `/login` has "Forgot password" link → form, enter email. Creates `PasswordResetToken` (1-hour expiry), fires email #3. (Always returns success regardless of whether email exists, to avoid account enumeration.)
- `/reset/[token]` → set new password.

### 9.4 Session model
- NextAuth with Credentials provider, JWT strategy (no DB sessions — simpler for single-server MVP).
- JWT carries `userId, role`. Extended via NextAuth callbacks.
- 30-day rolling session.
- bcrypt cost factor 12.

---

## 10. Deployment outline

### VPS prerequisites
- Ubuntu 22.04+, sudo user, ports 80/443 open.
- Node.js 20 LTS, npm.
- PostgreSQL 16 (native install, not Docker on prod).
- Nginx + Certbot.
- PM2 (`npm i -g pm2`).

### Steps (covered in README in implementation)
1. Clone repo into `/opt/itsnottechy-careers`.
2. `npm ci && npm run build`.
3. Configure `/etc/postgresql/.../postgresql.conf` + create DB and user.
4. `cp .env.example .env`, fill in `DATABASE_URL`, `NEXTAUTH_SECRET`, `SMTP_*`, `STORAGE_ROOT`, etc.
5. `npx prisma migrate deploy`.
6. `npm run seed` (creates first Super Admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).
7. `pm2 start ecosystem.config.js --env production`, `pm2 save`, `pm2 startup`.
8. Nginx config: reverse proxy `career.itsnottechy.com` → `localhost:3000` with sensible headers.
9. `certbot --nginx -d career.itsnottechy.com` for TLS.
10. Create `/var/itsnottechy/uploads`, `chown` to the PM2 user.

### Backups (documented, not automated)
- Daily `pg_dump` to `/var/backups/postgres/`, rotate.
- Daily `tar` of `/var/itsnottechy/uploads`, rotate.
- README explains the rotation cron pattern; we do not install it for MVP.

---

## 11. Phase plan

Each phase ships in a deployable state. Each gets its own implementation plan, written and approved before any code is written.

| Phase | Name           | Scope                                                                                                                                                                                                                                                              | Emails wired | New files (est.) |
|------:|----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------|------------------|
| **1** | Foundation     | Next.js scaffold · Tailwind · full Prisma schema + first migration · NextAuth Credentials · 5-role RBAC middleware + `requireRole` helper · candidate self-register · staff invite flow · password reset · base layout shells for all 5 dashboards · email infra (Hostinger SMTP) · file upload + auth-protected serving · public landing page · docker-compose · seed (admin + sample HR + manager + employees + candidates) · README with VPS deploy guide | 1, 2, 3      | ~45              |
| **2** | Jobs + Apply   | HR job CRUD with custom-question builder · public job board with search + filter · job detail page · candidate application flow with dynamic form · resume + cover letter upload · "My Applications" on candidate dashboard                                            | 4            | ~20              |
| **3** | ATS Pipeline   | HR Kanban view per job · stage-move action with valid-transition rules · application notes thread · status emails · candidate "Application Status" updates                                                                                                              | 5, 7         | ~15              |
| **4** | Referrals      | Employee/Manager referral form · "My Referrals" page · referral badge on HR candidate profile · auto-link referral → application when candidate registers with referred email · HR "All Referrals" view · status update emails                                          | 8, 9         | ~12              |
| **5** | Interviews     | Schedule interview from candidate profile · interviewer conflict warning · .ics-attached emails to candidate and interviewer · interview history on candidate profile · "My Interviews" widget on relevant dashboards                                                  | 6            | ~12              |
| **6** | Promotions     | Employee/Manager submit promotion request with supporting doc · Manager promotion inbox with approve/reject + notes · HR final-decision queue · status emails at each step · employee status tracker                                                                  | 10, 11, 12   | ~14              |
| **7** | Admin polish   | Super Admin user management UI (list, edit, deactivate, role-change) · system settings page (company name, default sender name) · audit log viewer with filters · hardening: login rate-limit, CSRF on actions, file-type validation, error pages                       | —            | ~10              |

**Total estimate: ~128 files.** Ordering preserves "always deployable" — Phase 1 alone is a working invite + auth + dashboard shell on the VPS; each subsequent phase strictly adds.

---

## 12. Open items (handled before each phase begins)

- Exact Tailwind palette + a small handful of reusable UI primitives (`Button`, `Input`, `Card`, `Badge`, `Modal`, `Table`) — decided early in Phase 1.
- Final copy for each of the 12 email templates — drafted with each phase that introduces them.
- Audit log event names (`JOB_CREATED`, `APP_STAGE_CHANGED`, etc.) — added incrementally per phase, listed in Phase 7's plan.
- Distribution list for "HR group" emails — for MVP, all active `HR_MANAGER` users. Settings page in Phase 7 may make this configurable.

---

## 13. Security notes (carry forward)

- All secrets via env vars; `.env` is gitignored, `.env.example` ships with placeholders only.
- bcrypt password hashing (cost 12).
- NextAuth JWT signed with `NEXTAUTH_SECRET` (rotated annually per ops).
- Zod validation on every server action and API route input.
- File uploads: content-type whitelist + size cap; stored outside webroot; served only through authed API.
- Rate-limit on `/api/auth/*` and the password-reset endpoint (token bucket per IP) — added in Phase 7.
- CSRF: server actions are POST + same-origin checked by Next.js automatically; explicit CSRF token added in Phase 7 for the few non-action API routes that mutate state.
- Audit log captures all mutating actions performed by staff roles.
- File-serving route never trusts client-supplied paths — always re-validates entity ownership.

---

End of spec.
