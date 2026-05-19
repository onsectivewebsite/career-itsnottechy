# Phase 7 — Admin polish & hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The final phase — ship Super Admin user-management UI, system settings, audit log viewer, the invite-staff form (used by HR + Super Admin), and a bundle of security/UX hardening: real-time `isActive` enforcement, file ACL entity-scoping, login rate-limit, middleware default-deny, error pages.

**Architecture:**
- **Security hardening first (Task 1)** because it touches `getSessionUser` + middleware — every subsequent task uses those.
- **File ACL (Task 2)** replaces the auth-only `/api/files/[...path]` with entity-aware checks driven by the canonical `resumeUrl`/`supportingDocUrl` foreign references on Application/Referral/PromotionRequest. No new model needed — JOIN the request path against existing FK columns.
- **Rate-limit (Task 3)** uses an in-memory token bucket (per-IP). Stateless servers behind a load balancer would need Redis; for this single-VPS MVP, in-memory is sufficient and clearly documented.
- **Settings (Task 7)** uses a singleton `SystemSettings` row (id='global') consumed by `sendEmail`'s from-address builder and the email layout footer.
- **Audit viewer (Task 8)** is read-only — no service changes, just a paginated query helper with filters.

**Tech Stack:** Same as prior phases.

**Prerequisites:** Phase 6 complete (tag `phase-6-complete`). 224 tests passing.

**End-of-plan state:** Production-ready MVP. ~245 tests total.

---

## Task 1: isActive enforcement at session load + middleware default-deny

**Files:**
- Modify: `src/lib/auth/session.ts` — re-read user on every call; return null if deactivated.
- Modify: `src/middleware.ts` — default-deny any `/dashboard/*` path not matched by `PREFIX_ALLOWED`.
- Modify: `src/lib/auth/session.test.ts` (create if missing).
- Modify: `src/lib/middleware.test.ts` if it exists; otherwise note manual test.

### Why

Today, deactivating a user (setting `isActive: false`) does not invalidate their existing JWT — they retain access until the 30-day expiry. Same problem for role changes. Fix: re-fetch `User` on every `getSessionUser` call and reject if deactivated. ~1ms per request, acceptable for this scale.

Also, middleware today only checks `/dashboard/admin|hr|manager|employee|candidate` prefixes. A future typo path like `/dashboard/other` falls through to Next.js's 404 — but the JWT check is bypassed for the duration of the 404 render. Tighten to default-deny.

### Step 1: Modify `src/lib/auth/session.ts`

```ts
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
```

### Step 2: Modify `src/middleware.ts`

Find the `if (!pathname.startsWith('/dashboard'))` pass-through. After the loop that matches against `PREFIX_ALLOWED`, add a final `return NextResponse.redirect(...)` to /login (or to `/dashboardFor(token.role)`) if NO prefix matched — i.e., it's an unknown /dashboard/X subpath. Read the middleware file first to see the exact existing control-flow.

The expected new behavior:
- `/dashboard` exactly → existing logic redirects to role dashboard ✓ (unchanged)
- `/dashboard/admin/...` (token role=SUPER_ADMIN) → allowed ✓ (unchanged)
- `/dashboard/admin/...` (token role=EMPLOYEE) → redirect to /403 ✓ (unchanged)
- `/dashboard/something-unknown/...` → currently passes through to 404. NEW: redirect to the user's own role dashboard (or /403 if any unrecognized path is considered hostile).

### Step 3: Write tests

`src/lib/auth/session.test.ts` (new file):

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { getSessionUser } from './session';

// Mock next-auth's getServerSession
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from 'next-auth';

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
```

### Step 4: Commit

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm test
git add src/lib/auth/session.ts src/lib/auth/session.test.ts src/middleware.ts
git commit -m "feat(security): real-time isActive enforcement + middleware default-deny"
```

Test count: 224 → 228.

---

## Task 2: File ACL entity-scoping on `/api/files/[...path]`

**Files:**
- Modify: `src/app/api/files/[...path]/route.ts` — replace auth-only check with entity-scoped lookup.
- Create: `src/lib/services/fileAclService.ts` + test.

### Why

Spec §7 says resumes are readable by SUPER_ADMIN, HR_MANAGER, the candidate, the referring employee if linked; promotion docs by SUPER_ADMIN, HR_MANAGER, submitter, manager. Today every authenticated user can fetch any file by path (~64 bits of entropy is practical protection but not policy). Fix without a new model: JOIN the requested path against `Application.resumeUrl`, `Referral.resumeUrl`, `PromotionRequest.supportingDocUrl`.

### Step 1: Create `src/lib/services/fileAclService.ts`

```ts
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type AclResult = { allowed: true } | { allowed: false; reason: 'NOT_FOUND' | 'FORBIDDEN' };

/**
 * Decide whether the given user may read the file at `path`. Path is the
 * relative-to-storage-root form (e.g., "resume/abc/xyz.pdf").
 *
 * SUPER_ADMIN and HR_MANAGER always allowed (HR may review every file).
 * Otherwise we look up which entity references the path and apply spec §7:
 *   - Application.resumeUrl → candidate owner, OR referring employee on its linked Referral
 *   - Referral.resumeUrl    → the referrer; HR-only path (already handled by role check above)
 *   - PromotionRequest.supportingDocUrl → submitter + assigned manager
 *
 * Orphan files (no entity references the path) are NOT_FOUND, treating
 * partially-completed uploads as inaccessible.
 */
export async function checkFileAcl(args: {
  path: string;
  user: { id: string; role: Role };
}): Promise<AclResult> {
  if (args.user.role === 'SUPER_ADMIN' || args.user.role === 'HR_MANAGER') {
    return { allowed: true };
  }

  // Application resumes
  const app = await prisma.application.findFirst({
    where: { resumeUrl: args.path },
    select: { candidateUserId: true, referral: { select: { referringUserId: true } } },
  });
  if (app) {
    if (app.candidateUserId === args.user.id) return { allowed: true };
    if (app.referral?.referringUserId === args.user.id) return { allowed: true };
    return { allowed: false, reason: 'FORBIDDEN' };
  }

  // Referral resumes (only HR-readable; non-HR fail unless they're the referrer)
  const referral = await prisma.referral.findFirst({
    where: { resumeUrl: args.path },
    select: { referringUserId: true },
  });
  if (referral) {
    if (referral.referringUserId === args.user.id) return { allowed: true };
    return { allowed: false, reason: 'FORBIDDEN' };
  }

  // Promotion supporting docs
  const promo = await prisma.promotionRequest.findFirst({
    where: { supportingDocUrl: args.path },
    select: { employeeUserId: true, managerUserId: true },
  });
  if (promo) {
    if (promo.employeeUserId === args.user.id) return { allowed: true };
    if (promo.managerUserId === args.user.id)  return { allowed: true };
    return { allowed: false, reason: 'FORBIDDEN' };
  }

  // Path is not referenced by any entity row.
  return { allowed: false, reason: 'NOT_FOUND' };
}
```

### Step 2: Tests `src/lib/services/fileAclService.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { createJob, publishJob } from './jobService';
import { submitApplication } from './applicationService';
import { checkFileAcl } from './fileAclService';

const baseJob = {
  title: 'Software Engineer', department: 'Engineering', locationType: 'REMOTE' as const,
  type: 'FULL_TIME' as const, description: 'long description here', requirements: 'Requirements here',
  customQuestions: [], currency: 'USD',
};

async function setupApp() {
  const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
  const j = await createJob({ input: baseJob, postedByUserId: hr.id });
  if (!j.ok) throw new Error();
  await publishJob({ jobId: j.jobId, actorUserId: hr.id });
  const cand = await prisma.user.create({
    data: { email: 'c@x.com', name: 'Cand', role: 'CANDIDATE', candidateProfile: { create: {} } },
  });
  const a = await submitApplication({
    jobId: j.jobId, candidateUserId: cand.id,
    input: { jobId: j.jobId, resumeUrl: 'resume/app/cand-resume.pdf', customAnswers: {} },
  });
  if (!a.ok) throw new Error();
  return { hr, cand, applicationId: a.applicationId };
}

describe('checkFileAcl', () => {
  beforeEach(() => resetDb());

  it('SUPER_ADMIN may read any path', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    expect(await checkFileAcl({ path: 'resume/x/y.pdf', user: { id: admin.id, role: 'SUPER_ADMIN' } }))
      .toEqual({ allowed: true });
  });

  it('HR_MANAGER may read any path', async () => {
    const hr = await prisma.user.create({ data: { email: 'h@x.com', name: 'H', role: 'HR_MANAGER' } });
    expect(await checkFileAcl({ path: 'resume/x/y.pdf', user: { id: hr.id, role: 'HR_MANAGER' } }))
      .toEqual({ allowed: true });
  });

  it('candidate may read THEIR resume but not others\'', async () => {
    const { cand } = await setupApp();
    expect(await checkFileAcl({ path: 'resume/app/cand-resume.pdf', user: { id: cand.id, role: 'CANDIDATE' } }))
      .toEqual({ allowed: true });

    const other = await prisma.user.create({ data: { email: 'o@x.com', name: 'O', role: 'CANDIDATE', candidateProfile: { create: {} } } });
    expect(await checkFileAcl({ path: 'resume/app/cand-resume.pdf', user: { id: other.id, role: 'CANDIDATE' } }))
      .toEqual({ allowed: false, reason: 'FORBIDDEN' });
  });

  it('referring employee may read the resume on a linked referral', async () => {
    const { applicationId, cand } = await setupApp();
    const emp = await prisma.user.create({ data: { email: 'e@x.com', name: 'E', role: 'EMPLOYEE' } });
    const job = await prisma.application.findUniqueOrThrow({ where: { id: applicationId }, select: { jobId: true } });
    const ref = await prisma.referral.create({
      data: { referringUserId: emp.id, jobId: job.jobId, candidateName: 'Cand', candidateEmail: cand.email, relationship: 'colleague', status: 'CONVERTED' },
    });
    await prisma.application.update({ where: { id: applicationId }, data: { referralId: ref.id } });
    await prisma.referral.update({ where: { id: ref.id }, data: { applicationId } });

    expect(await checkFileAcl({ path: 'resume/app/cand-resume.pdf', user: { id: emp.id, role: 'EMPLOYEE' } }))
      .toEqual({ allowed: true });
  });

  it('promotion submitter and assigned manager may read the supporting doc', async () => {
    const hr = await prisma.user.create({ data: { email: 'h@x.com', name: 'H', role: 'HR_MANAGER' } });
    const mgrUser = await prisma.user.create({ data: { email: 'm@x.com', name: 'M', role: 'MANAGER' } });
    const mgrEmp = await prisma.employee.create({
      data: { userId: mgrUser.id, employeeCode: 'M01', department: 'X', title: 'M', hireDate: new Date() },
    });
    const empUser = await prisma.user.create({ data: { email: 'e@x.com', name: 'E', role: 'EMPLOYEE' } });
    await prisma.employee.create({
      data: { userId: empUser.id, employeeCode: 'E01', department: 'X', title: 'E2', hireDate: new Date(), managerId: mgrEmp.id },
    });
    await prisma.promotionRequest.create({
      data: {
        employeeUserId: empUser.id, managerUserId: mgrUser.id,
        currentTitle: 'A', targetTitle: 'B', justification: 'long enough justification text',
        supportingDocUrl: 'supporting-doc/promotion/doc.pdf', finalStatus: 'PENDING_MANAGER',
      },
    });

    expect(await checkFileAcl({ path: 'supporting-doc/promotion/doc.pdf', user: { id: empUser.id, role: 'EMPLOYEE' } }))
      .toEqual({ allowed: true });
    expect(await checkFileAcl({ path: 'supporting-doc/promotion/doc.pdf', user: { id: mgrUser.id, role: 'MANAGER' } }))
      .toEqual({ allowed: true });

    const stranger = await prisma.user.create({ data: { email: 's@x.com', name: 'S', role: 'EMPLOYEE' } });
    expect(await checkFileAcl({ path: 'supporting-doc/promotion/doc.pdf', user: { id: stranger.id, role: 'EMPLOYEE' } }))
      .toEqual({ allowed: false, reason: 'FORBIDDEN' });

    void hr;
  });

  it('orphan path returns NOT_FOUND for non-HR/admin users', async () => {
    const u = await prisma.user.create({ data: { email: 'x@x.com', name: 'X', role: 'EMPLOYEE' } });
    expect(await checkFileAcl({ path: 'resume/nobody.pdf', user: { id: u.id, role: 'EMPLOYEE' } }))
      .toEqual({ allowed: false, reason: 'NOT_FOUND' });
  });
});
```

### Step 3: Wire into `src/app/api/files/[...path]/route.ts`

Read the existing file first. Then replace the auth check + serve flow with:

```ts
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { checkFileAcl } from '@/lib/services/fileAclService';
import { readStoredFile } from '@/lib/storage';

export async function GET(req: Request, ctx: { params: { path: string[] } }): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

  const relativePath = ctx.params.path.join('/');
  const acl = await checkFileAcl({ path: relativePath, user });
  if (!acl.allowed) {
    const status = acl.reason === 'NOT_FOUND' ? 404 : 403;
    return NextResponse.json({ error: acl.reason }, { status });
  }

  const file = await readStoredFile(relativePath);
  if (!file.ok) return NextResponse.json({ error: file.reason }, { status: 404 });
  return new Response(file.buffer, { headers: { 'Content-Type': file.contentType } });
}
```

(If `readStoredFile` doesn't exist in `src/lib/storage.ts`, add it — small wrapper that reads the file from `storageRoot()` with directory-traversal guard. Read storage.ts first to see what's there.)

### Step 4: Commit

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm test
git add src/lib/services/fileAclService.ts src/lib/services/fileAclService.test.ts "src/app/api/files/[...path]/route.ts" src/lib/storage.ts
git commit -m "feat(security): entity-scoped ACL on /api/files per spec §7"
```

Test count: 228 → 234.

---

## Task 3: Login rate-limit + file-type re-validation

**Files:**
- Create: `src/lib/security/rateLimit.ts` + test
- Modify: `src/app/api/auth/[...nextauth]/route.ts` (or wherever the credentials handler lives — find it) — apply per-IP rate-limit on the POST.
- Modify: `src/lib/storage.ts` — add a magic-byte sanity check on upload to catch e.g. a `.pdf`-renamed `.exe`.

### Step 1: Rate-limit utility

`src/lib/security/rateLimit.ts`:
```ts
type Bucket = { tokens: number; lastRefillMs: number };

const buckets = new Map<string, Bucket>();

export type RateLimitInput = {
  key: string;            // e.g., "login:1.2.3.4"
  capacity: number;       // max tokens
  refillPerSec: number;   // tokens added per second (steady-state rate)
  cost?: number;          // tokens this hit consumes (default 1)
};

export type RateLimitResult = { allowed: true; remaining: number } | { allowed: false; retryAfterMs: number };

export function checkRateLimit(args: RateLimitInput, nowMs = Date.now()): RateLimitResult {
  const cost = args.cost ?? 1;
  let b = buckets.get(args.key);
  if (!b) {
    b = { tokens: args.capacity, lastRefillMs: nowMs };
    buckets.set(args.key, b);
  } else {
    const elapsed = (nowMs - b.lastRefillMs) / 1000;
    b.tokens = Math.min(args.capacity, b.tokens + elapsed * args.refillPerSec);
    b.lastRefillMs = nowMs;
  }
  if (b.tokens < cost) {
    const deficit = cost - b.tokens;
    return { allowed: false, retryAfterMs: Math.ceil((deficit / args.refillPerSec) * 1000) };
  }
  b.tokens -= cost;
  return { allowed: true, remaining: Math.floor(b.tokens) };
}

// Test-only helper to clear state between tests.
export function __resetRateLimitsForTests(): void {
  buckets.clear();
}
```

`src/lib/security/rateLimit.test.ts`:
```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { checkRateLimit, __resetRateLimitsForTests } from './rateLimit';

beforeEach(() => __resetRateLimitsForTests());

describe('checkRateLimit', () => {
  it('allows up to capacity then blocks', () => {
    const args = { key: 'k', capacity: 3, refillPerSec: 1 };
    expect(checkRateLimit(args, 0).allowed).toBe(true);
    expect(checkRateLimit(args, 0).allowed).toBe(true);
    expect(checkRateLimit(args, 0).allowed).toBe(true);
    const r4 = checkRateLimit(args, 0);
    expect(r4.allowed).toBe(false);
    if (!r4.allowed) expect(r4.retryAfterMs).toBe(1000);
  });

  it('refills over time', () => {
    const args = { key: 'k2', capacity: 2, refillPerSec: 1 };
    expect(checkRateLimit(args, 0).allowed).toBe(true);
    expect(checkRateLimit(args, 0).allowed).toBe(true);
    expect(checkRateLimit(args, 0).allowed).toBe(false);
    expect(checkRateLimit(args, 1500).allowed).toBe(true);   // 1.5s later, +1.5 tokens
    expect(checkRateLimit(args, 1500).allowed).toBe(false);
  });

  it('per-key isolation', () => {
    const args = (k: string) => ({ key: k, capacity: 1, refillPerSec: 1 });
    expect(checkRateLimit(args('a'), 0).allowed).toBe(true);
    expect(checkRateLimit(args('a'), 0).allowed).toBe(false);
    expect(checkRateLimit(args('b'), 0).allowed).toBe(true);
  });
});
```

### Step 2: Apply to login + password-reset request

Find the NextAuth credentials handler — usually `src/app/api/auth/[...nextauth]/route.ts`. Wrap the POST handler so that a per-IP key (`login:${ip}`) consumes 1 token from a bucket of capacity 5, refill 1/min. Same for `/api/auth/request-password-reset` if a dedicated endpoint exists; if password reset is invoked via a server action, add the check at the top of the action.

Pattern:
```ts
import { checkRateLimit } from '@/lib/security/rateLimit';

function ipFromRequest(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
}

// At the top of the POST handler:
const ip = ipFromRequest(req);
const limit = checkRateLimit({ key: `login:${ip}`, capacity: 5, refillPerSec: 1 / 60 });
if (!limit.allowed) {
  return new Response('Too many requests', { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } });
}
```

The implementer should read the existing route handler to find the actual extension point (NextAuth's exported `handler` may wrap the POST in a way that requires a `wrapped` shim).

### Step 3: File magic-byte sanity check

In `src/lib/storage.ts`, add a magic-byte check to the existing `saveUploadedFile` validation:
```ts
function looksLike(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  // PDFs start with %PDF
  if (mimeType === 'application/pdf')
    return buffer.slice(0, 4).toString('ascii') === '%PDF';
  // PNG signature
  if (mimeType === 'image/png')
    return buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  // JPEG
  if (mimeType === 'image/jpeg')
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // DOC / DOCX are not magic-byte-checked here — both have varying compound headers,
  // and our MIME allowlist already restricts them. Accept on declared MIME.
  return true;
}
```

In `saveUploadedFile`, after the existing MIME allowlist check, add:
```ts
if (!looksLike(input.buffer, input.mimeType)) {
  return { ok: false, reason: 'MIME_MISMATCH' };
}
```

Update `SaveResult` type to include `'MIME_MISMATCH'`. Update the API route at `/api/upload/route.ts` to surface it as 415 (same as MIME_NOT_ALLOWED).

Add a test in `src/lib/storage.test.ts` (or create one):
```ts
it('rejects a file whose declared MIME does not match its magic bytes', async () => {
  const fakeJpeg = Buffer.from('definitely-not-an-image');
  const r = await saveUploadedFile({
    buffer: fakeJpeg, originalFilename: 'x.jpg', mimeType: 'image/jpeg',
    purpose: 'supporting-doc', entityId: 'test',
  });
  expect(r).toEqual({ ok: false, reason: 'MIME_MISMATCH' });
});
```

### Step 4: Commit

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm test
git add src/lib/security/ src/lib/storage.ts src/app/api/auth/ src/app/api/upload/route.ts
git commit -m "feat(security): in-memory login rate-limit + upload magic-byte validation"
```

Test count: 234 → ~240.

---

## Task 4: Error pages

**Files:**
- Create: `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/403/page.tsx`

### Step 1: 404 page

`src/app/not-found.tsx`:
```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="rounded-lg bg-white p-8 shadow-sm text-center">
        <p className="text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">The page you were looking for doesn't exist.</p>
        <Link href="/" className="mt-6 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Go home
        </Link>
      </div>
    </div>
  );
}
```

### Step 2: Global error boundary

`src/app/error.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="rounded-lg bg-white p-8 shadow-sm text-center max-w-md">
        <p className="text-sm font-semibold text-red-600">500</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">An unexpected error occurred. We've logged it for follow-up.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Try again
          </button>
          <Link href="/" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### Step 3: 403 page

If `/403` doesn't already exist (the middleware redirects to `/403` on RBAC fail), create it.

`src/app/403/page.tsx`:
```tsx
import Link from 'next/link';

export const metadata = { title: 'Forbidden · ItsNotTechy Careers' };

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="rounded-lg bg-white p-8 shadow-sm text-center max-w-md">
        <p className="text-sm font-semibold text-red-600">403</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Access denied</h1>
        <p className="mt-2 text-sm text-slate-600">You don't have permission to view that page.</p>
        <Link href="/" className="mt-6 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Go home
        </Link>
      </div>
    </div>
  );
}
```

(Check whether `/403` already exists before creating — if it does, skip this and just confirm.)

### Step 4: Commit

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build
git add src/app/not-found.tsx src/app/error.tsx src/app/403/
git commit -m "feat(ui): 404 / 500 / 403 error pages"
```

No new tests in this task (UI plumbing).

---

## Task 5: Invite-staff form for HR + Super Admin

**Files:**
- Create: `src/app/dashboard/hr/invite/page.tsx`, `actions.ts`, `InviteForm.tsx`
- Modify: `src/app/dashboard/hr/page.tsx` and `src/app/dashboard/admin/page.tsx` — link to `/dashboard/hr/invite`

### Why

The `inviteStaff` service exists (Phase 1, `src/lib/services/userService.ts:69`). Spec capability matrix row 473 says both SUPER_ADMIN and HR_MANAGER can invite. We just need to wire the UI.

### Step 1: Server action

`src/app/dashboard/hr/invite/actions.ts`:
```ts
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
```

### Step 2: Client form

`src/app/dashboard/hr/invite/InviteForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { inviteStaffAction } from './actions';

type FormState = { error?: string; fieldErrors?: Record<string, string[]> };

type Mgr = { id: string; name: string };

export function InviteForm({ managers }: { managers: Mgr[] }) {
  const [state, formAction] = useFormState(inviteStaffAction, {} as FormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required className="mt-1" />
          {state.fieldErrors?.email && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.email[0]}</p>}
        </div>
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <select id="role" name="role" required defaultValue="EMPLOYEE"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="HR_MANAGER">HR Manager</option>
          </select>
        </div>
        <div>
          <Label htmlFor="employeeCode">Employee code</Label>
          <Input id="employeeCode" name="employeeCode" required className="mt-1" placeholder="e.g., E2026-0042" />
          {state.fieldErrors?.employeeCode && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.employeeCode[0]}</p>}
        </div>
        <div>
          <Label htmlFor="department">Department</Label>
          <Input id="department" name="department" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="hireDate">Hire date</Label>
          <Input id="hireDate" name="hireDate" type="date" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="managerEmployeeId">Manager (optional)</Label>
          <select id="managerEmployeeId" name="managerEmployeeId"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">No manager</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <Button type="submit">Send invitation</Button>
    </form>
  );
}
```

### Step 3: Page

`src/app/dashboard/hr/invite/page.tsx`:
```tsx
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { Card, CardTitle } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { InviteForm } from './InviteForm';

export const metadata = { title: 'Invite staff · ItsNotTechy Careers' };

export default async function InviteStaffPage({
  searchParams,
}: { searchParams: { sent?: string } }) {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const managerCandidates = await prisma.employee.findMany({
    where: { user: { role: { in: ['HR_MANAGER', 'MANAGER'] }, isActive: true } },
    select: { id: true, user: { select: { name: true } } },
    orderBy: { user: { name: 'asc' } },
  });
  const managers = managerCandidates.map((e) => ({ id: e.id, name: e.user.name }));

  return (
    <div className="space-y-6">
      <Link href="/dashboard/hr" className="text-sm text-brand-600 hover:underline">&larr; Dashboard</Link>
      <h1 className="text-2xl font-bold text-slate-900">Invite staff</h1>

      {searchParams.sent === '1' && (
        <Alert tone="success">Invitation sent. They'll receive an email with a setup link.</Alert>
      )}

      <Card>
        <CardTitle>New staff member</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          The invitee receives an email; the link is valid for 7 days. After accepting, they set their own password.
        </p>
        <div className="mt-4">
          <InviteForm managers={managers} />
        </div>
      </Card>
    </div>
  );
}
```

### Step 4: Link from HR + admin dashboards

In `src/app/dashboard/hr/page.tsx`, find the placeholder "Invite staff" card and replace its body with a real link:
```tsx
        <Card>
          <CardTitle>Invite staff</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/dashboard/hr/invite" className="text-brand-600 hover:underline">
              Send a new invitation
            </Link>
          </p>
        </Card>
```

Same on `src/app/dashboard/admin/page.tsx` — add a new card or extend the existing one.

### Step 5: Commit

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build && npm test
git add src/app/dashboard/hr/invite/ src/app/dashboard/hr/page.tsx src/app/dashboard/admin/page.tsx
git commit -m "feat(admin): invite-staff form for HR + Super Admin"
```

---

## Task 6: Super Admin user-management UI

**Files:**
- Create: `src/lib/services/adminUserService.ts` + test (`listUsers`, `setRole`, `setActive`)
- Create: `src/app/dashboard/admin/users/page.tsx`, `actions.ts`, `UserRowActions.tsx`
- Modify: `src/app/dashboard/admin/page.tsx` — link to `/dashboard/admin/users`

### Service

`src/lib/services/adminUserService.ts`:
```ts
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select: {
      id: true, email: true, name: true, role: true, isActive: true, createdAt: true,
      employee: { select: { employeeCode: true, department: true, title: true } },
    },
  });
}

export type SetRoleResult = { ok: true } | { ok: false; reason: 'NOT_FOUND' | 'LAST_ADMIN' };

export async function setUserRole(args: {
  userId: string; newRole: Role; actorUserId: string;
}): Promise<SetRoleResult> {
  const user = await prisma.user.findUnique({ where: { id: args.userId }, select: { id: true, role: true } });
  if (!user) return { ok: false, reason: 'NOT_FOUND' };

  // Refuse to demote the last remaining SUPER_ADMIN.
  if (user.role === 'SUPER_ADMIN' && args.newRole !== 'SUPER_ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
    if (admins <= 1) return { ok: false, reason: 'LAST_ADMIN' };
  }

  await prisma.user.update({ where: { id: args.userId }, data: { role: args.newRole } });
  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'USER_ROLE_CHANGED',
    entityType: 'User',
    entityId: args.userId,
    metadata: { from: user.role, to: args.newRole },
  });
  return { ok: true };
}

export type SetActiveResult = { ok: true } | { ok: false; reason: 'NOT_FOUND' | 'LAST_ADMIN' | 'SELF' };

export async function setUserActive(args: {
  userId: string; active: boolean; actorUserId: string;
}): Promise<SetActiveResult> {
  if (args.userId === args.actorUserId && args.active === false) {
    return { ok: false, reason: 'SELF' };
  }
  const user = await prisma.user.findUnique({ where: { id: args.userId }, select: { role: true, isActive: true } });
  if (!user) return { ok: false, reason: 'NOT_FOUND' };

  if (!args.active && user.role === 'SUPER_ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
    if (admins <= 1) return { ok: false, reason: 'LAST_ADMIN' };
  }

  await prisma.user.update({ where: { id: args.userId }, data: { isActive: args.active } });
  await recordAudit({
    actorUserId: args.actorUserId,
    action: args.active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
    entityType: 'User',
    entityId: args.userId,
  });
  return { ok: true };
}
```

### Service test

`src/lib/services/adminUserService.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { listUsers, setUserRole, setUserActive } from './adminUserService';

describe('listUsers', () => {
  beforeEach(() => resetDb());

  it('returns users with their employee details when present', async () => {
    const u = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'EMPLOYEE' } });
    await prisma.employee.create({ data: { userId: u.id, employeeCode: 'E1', department: 'X', title: 'T', hireDate: new Date() } });
    const list = await listUsers();
    expect(list).toHaveLength(1);
    expect(list[0]?.employee?.employeeCode).toBe('E1');
  });
});

describe('setUserRole', () => {
  beforeEach(() => resetDb());

  it('changes role + writes audit', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const u = await prisma.user.create({ data: { email: 'e@x.com', name: 'E', role: 'EMPLOYEE' } });
    const r = await setUserRole({ userId: u.id, newRole: 'MANAGER', actorUserId: admin.id });
    expect(r.ok).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe('MANAGER');
    expect(await prisma.auditLog.count({ where: { action: 'USER_ROLE_CHANGED' } })).toBe(1);
  });

  it('refuses to demote the last active SUPER_ADMIN', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const r = await setUserRole({ userId: admin.id, newRole: 'EMPLOYEE', actorUserId: admin.id });
    expect(r).toEqual({ ok: false, reason: 'LAST_ADMIN' });
  });

  it('allows demoting a SUPER_ADMIN when another exists', async () => {
    const a1 = await prisma.user.create({ data: { email: 'a1@x.com', name: 'A1', role: 'SUPER_ADMIN' } });
    const a2 = await prisma.user.create({ data: { email: 'a2@x.com', name: 'A2', role: 'SUPER_ADMIN' } });
    const r = await setUserRole({ userId: a2.id, newRole: 'EMPLOYEE', actorUserId: a1.id });
    expect(r.ok).toBe(true);
  });
});

describe('setUserActive', () => {
  beforeEach(() => resetDb());

  it('deactivates a user + audits', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const u = await prisma.user.create({ data: { email: 'e@x.com', name: 'E', role: 'EMPLOYEE' } });
    const r = await setUserActive({ userId: u.id, active: false, actorUserId: admin.id });
    expect(r.ok).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).isActive).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: 'USER_DEACTIVATED' } })).toBe(1);
  });

  it('refuses to deactivate self', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const r = await setUserActive({ userId: admin.id, active: false, actorUserId: admin.id });
    expect(r).toEqual({ ok: false, reason: 'SELF' });
  });

  it('refuses to deactivate the last active SUPER_ADMIN', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const other = await prisma.user.create({ data: { email: 'o@x.com', name: 'O', role: 'SUPER_ADMIN' } });
    // Other admin tries to deactivate admin — would leave 1, allowed
    // Wait — count of active ADMINs is 2; deactivating one leaves 1 → allowed.
    // To exercise LAST_ADMIN we need only 1 admin total and someone else tries to deactivate them.
    // Since the SELF check fires first when admin acts on admin, we need a non-admin actor.
    // But non-admins can't reach this service via the action layer. Test the service guard directly with two admins where one is already deactivated:
    await prisma.user.update({ where: { id: other.id }, data: { isActive: false } });
    const r = await setUserActive({ userId: admin.id, active: false, actorUserId: other.id });
    expect(r).toEqual({ ok: false, reason: 'LAST_ADMIN' });
  });
});
```

### Action

`src/app/dashboard/admin/users/actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { setUserRole, setUserActive } from '@/lib/services/adminUserService';
import type { Role } from '@prisma/client';

const ROLES: Role[] = ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE', 'CANDIDATE'];

export async function changeRoleAction(fd: FormData): Promise<void> {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const userId = String(fd.get('userId') ?? '');
  const newRole = String(fd.get('newRole') ?? '');
  if (!ROLES.includes(newRole as Role)) return;
  await setUserRole({ userId, newRole: newRole as Role, actorUserId: user.id });
  revalidatePath('/dashboard/admin/users');
}

export async function toggleActiveAction(fd: FormData): Promise<void> {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const userId = String(fd.get('userId') ?? '');
  const active = fd.get('active') === '1';
  await setUserActive({ userId, active, actorUserId: user.id });
  revalidatePath('/dashboard/admin/users');
}
```

### Page

`src/app/dashboard/admin/users/page.tsx`:
```tsx
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { listUsers } from '@/lib/services/adminUserService';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { UserRowActions } from './UserRowActions';

export const metadata = { title: 'Users · ItsNotTechy Careers' };

const ROLE_TONE = {
  SUPER_ADMIN: 'red', HR_MANAGER: 'blue', MANAGER: 'amber',
  EMPLOYEE: 'neutral', CANDIDATE: 'green',
} as const;

export default async function UsersPage() {
  requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const users = await listUsers();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin" className="text-sm text-brand-600 hover:underline">&larr; Dashboard</Link>
      <h1 className="text-2xl font-bold text-slate-900">Users</h1>
      <p className="text-sm text-slate-500">{users.length} total.</p>

      <Card>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Department</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? '' : 'opacity-50'}>
                <td className="py-3 pr-4 font-medium text-slate-900">{u.name}</td>
                <td className="py-3 pr-4 text-slate-600">{u.email}</td>
                <td className="py-3 pr-4"><Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge></td>
                <td className="py-3 pr-4">{u.isActive ? 'Active' : 'Deactivated'}</td>
                <td className="py-3 pr-4 text-slate-600">{u.employee?.department ?? '—'}</td>
                <td className="py-3 pr-4"><UserRowActions userId={u.id} role={u.role} isActive={u.isActive} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
```

### Row actions component

`src/app/dashboard/admin/users/UserRowActions.tsx`:
```tsx
'use client';

import type { Role } from '@prisma/client';
import { changeRoleAction, toggleActiveAction } from './actions';

const ROLES: Role[] = ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE', 'CANDIDATE'];

export function UserRowActions({
  userId, role, isActive,
}: { userId: string; role: Role; isActive: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <form action={changeRoleAction}>
        <input type="hidden" name="userId" value={userId} />
        <select name="newRole" defaultValue={role}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs">
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </form>
      <form action={toggleActiveAction}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="active" value={isActive ? '0' : '1'} />
        <button className={`rounded-md px-2 py-1 text-xs ${isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
          {isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      </form>
    </div>
  );
}
```

### Update admin dashboard

In `src/app/dashboard/admin/page.tsx`, replace the placeholder "User management" card body:
```tsx
        <Card>
          <CardTitle>User management</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/dashboard/admin/users" className="text-brand-600 hover:underline">All users</Link>
          </p>
        </Card>
```

Add `import Link from 'next/link';` if needed.

### Commit

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm test && npm run build
git add src/lib/services/adminUserService.ts src/lib/services/adminUserService.test.ts src/app/dashboard/admin/
git commit -m "feat(admin): user-management UI with role-change + deactivate"
```

Test count: 240 → ~248.

---

## Task 7: System settings page

**Files:**
- Modify: `prisma/schema.prisma` — add `SystemSettings` model (singleton with id='global').
- Run a Prisma migration named `add_system_settings`.
- Create: `src/lib/services/systemSettings.ts` (`getSettings`, `updateSettings`) + test
- Create: `src/app/dashboard/admin/settings/page.tsx`, `actions.ts`, `SettingsForm.tsx`
- Modify: `src/lib/email/send.ts` — pull `defaultSenderName` from settings (with a sane fallback for cold-start).
- Modify: `src/app/dashboard/admin/page.tsx` — link to settings

### Schema

In `prisma/schema.prisma`, add at the end:
```prisma
model SystemSettings {
  id                String   @id @default("global")
  companyName       String   @default("ItsNotTechy")
  defaultSenderName String   @default("ItsNotTechy Careers")
  updatedAt         DateTime @updatedAt
  updatedBy         String?
}
```

The `@default("global")` literal enforces singleton: every create attempts id="global", and the PK collision prevents duplicates. The service helper enforces this in code (upsert pattern).

### Migration

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npx prisma migrate dev --name add_system_settings
```

If the dev DB has existing data and `migrate dev` complains, fall back to `prisma migrate reset --force --skip-seed`.

### Service

`src/lib/services/systemSettings.ts`:
```ts
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
  cache = null;   // invalidate
  return { companyName: row.companyName, defaultSenderName: row.defaultSenderName };
}

// Test-only helper
export function __resetSettingsCacheForTests(): void { cache = null; }
```

### Service test

`src/lib/services/systemSettings.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { getSettings, updateSettings, __resetSettingsCacheForTests } from './systemSettings';

describe('systemSettings', () => {
  beforeEach(async () => {
    await resetDb();
    __resetSettingsCacheForTests();
  });

  it('returns defaults when no row exists', async () => {
    const s = await getSettings();
    expect(s.companyName).toBe('ItsNotTechy');
  });

  it('upsert updates and invalidates cache', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const before = await getSettings();
    expect(before.companyName).toBe('ItsNotTechy');

    await updateSettings({ input: { companyName: 'Acme Corp' }, actorUserId: admin.id });
    const after = await getSettings();
    expect(after.companyName).toBe('Acme Corp');
    expect(await prisma.auditLog.count({ where: { action: 'SETTINGS_UPDATED' } })).toBe(1);
  });
});
```

### Use settings in email

In `src/lib/email/send.ts`, change `fromAddress()` so it reads `defaultSenderName` from settings:
```ts
import { getSettings } from '@/lib/services/systemSettings';

async function fromAddress(): Promise<string> {
  const s = await getSettings();
  const name = process.env.SMTP_FROM_NAME ?? s.defaultSenderName;
  const email = process.env.SMTP_FROM_EMAIL ?? 'info@itsnottechy.com';
  return `${name} <${email}>`;
}
```

And update the call site of `fromAddress()` to `await fromAddress()`.

### Settings UI

Read existing form patterns (`InviteForm.tsx`) and build:
- `src/app/dashboard/admin/settings/actions.ts` — `updateSettingsAction(_prev, fd)`
- `src/app/dashboard/admin/settings/SettingsForm.tsx` — two `<Input>` fields (companyName, defaultSenderName)
- `src/app/dashboard/admin/settings/page.tsx` — server component, reads settings, renders form

Standard `useFormState` pattern. Action gates on `requireRole('SUPER_ADMIN')`.

### Update admin dashboard

Add a new card or extend existing:
```tsx
        <Card>
          <CardTitle>System settings</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/dashboard/admin/settings" className="text-brand-600 hover:underline">Edit settings</Link>
          </p>
        </Card>
```

### Commit

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm test && npm run build
git add prisma/schema.prisma prisma/migrations/*_add_system_settings/ src/lib/services/systemSettings.ts src/lib/services/systemSettings.test.ts src/lib/email/send.ts src/app/dashboard/admin/settings/ src/app/dashboard/admin/page.tsx
git commit -m "feat(admin): system settings page (singleton) + email from-name wiring"
```

Test count: ~248 → ~252.

---

## Task 8: Audit log viewer with filters

**Files:**
- Create: `src/lib/services/auditService.ts` (paginated query with filters) + test
- Create: `src/app/dashboard/admin/audit/page.tsx`
- Modify: `src/app/dashboard/admin/page.tsx` — link

### Service

`src/lib/services/auditService.ts`:
```ts
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type AuditFilters = {
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  since?: Date;
  until?: Date;
  page?: number;        // 1-indexed
  pageSize?: number;    // default 50, max 200
};

export async function listAudit(filters: AuditFilters) {
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
    ...(filters.action      ? { action: filters.action } : {}),
    ...(filters.entityType  ? { entityType: filters.entityType } : {}),
    ...(filters.entityId    ? { entityId: filters.entityId } : {}),
    ...(filters.since || filters.until ? {
      createdAt: {
        ...(filters.since ? { gte: filters.since } : {}),
        ...(filters.until ? { lte: filters.until } : {}),
      },
    } : {}),
  };
  const pageSize = Math.min(Math.max(filters.pageSize ?? 50, 1), 200);
  const page = Math.max(filters.page ?? 1, 1);
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize, take: pageSize,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  return { total, page, pageSize, rows };
}

/** Distinct action strings for the filter dropdown. */
export async function listAuditActions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({ select: { action: true }, distinct: ['action'], orderBy: { action: 'asc' } });
  return rows.map((r) => r.action);
}
```

### Service test

`src/lib/services/auditService.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { listAudit, listAuditActions } from './auditService';

async function seed() {
  const u = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
  await prisma.auditLog.createMany({
    data: [
      { actorUserId: u.id, action: 'JOB_CREATED',         entityType: 'Job', entityId: 'j1' },
      { actorUserId: u.id, action: 'JOB_PUBLISHED',       entityType: 'Job', entityId: 'j1' },
      { actorUserId: u.id, action: 'APP_STAGE_CHANGED',   entityType: 'Application', entityId: 'a1' },
    ],
  });
  return u;
}

describe('listAudit', () => {
  beforeEach(() => resetDb());

  it('returns paginated rows desc by createdAt', async () => {
    await seed();
    const r = await listAudit({ page: 1, pageSize: 10 });
    expect(r.total).toBe(3);
    expect(r.rows).toHaveLength(3);
  });

  it('filters by action', async () => {
    await seed();
    const r = await listAudit({ action: 'JOB_PUBLISHED' });
    expect(r.total).toBe(1);
    expect(r.rows[0]?.action).toBe('JOB_PUBLISHED');
  });

  it('filters by entity', async () => {
    await seed();
    const r = await listAudit({ entityType: 'Application' });
    expect(r.total).toBe(1);
  });
});

describe('listAuditActions', () => {
  beforeEach(() => resetDb());
  it('returns distinct action strings', async () => {
    await seed();
    const actions = await listAuditActions();
    expect(actions.sort()).toEqual(['APP_STAGE_CHANGED', 'JOB_CREATED', 'JOB_PUBLISHED']);
  });
});
```

### Page

`src/app/dashboard/admin/audit/page.tsx`:
```tsx
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { listAudit, listAuditActions } from '@/lib/services/auditService';
import { Card } from '@/components/ui/Card';

export const metadata = { title: 'Audit log · ItsNotTechy Careers' };

export default async function AuditPage({
  searchParams,
}: { searchParams: { action?: string; entityType?: string; page?: string } }) {
  requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const actions = await listAuditActions();
  const page = Math.max(parseInt(searchParams.page ?? '1', 10) || 1, 1);
  const result = await listAudit({
    action: searchParams.action || undefined,
    entityType: searchParams.entityType || undefined,
    page,
    pageSize: 50,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin" className="text-sm text-brand-600 hover:underline">&larr; Dashboard</Link>
      <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>

      <form className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Action</label>
          <select name="action" defaultValue={searchParams.action ?? ''}
                  className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm">
            <option value="">All</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Entity</label>
          <input name="entityType" defaultValue={searchParams.entityType ?? ''}
                 className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm" placeholder="e.g., Job" />
        </div>
        <button className="rounded-md bg-brand-600 px-3 py-1 text-sm font-medium text-white">Filter</button>
        <Link href="/dashboard/admin/audit" className="text-sm text-slate-600 hover:underline">Clear</Link>
      </form>

      <Card>
        <p className="text-sm text-slate-500">{result.total} total · page {page} of {totalPages}</p>
        <table className="mt-3 min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Actor</th>
              <th className="py-2 pr-4">Action</th>
              <th className="py-2 pr-4">Entity</th>
              <th className="py-2 pr-4">ID</th>
              <th className="py-2 pr-4">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-4 text-xs text-slate-500">{r.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
                <td className="py-2 pr-4">{r.actor?.name ?? 'system'}</td>
                <td className="py-2 pr-4 font-mono text-xs">{r.action}</td>
                <td className="py-2 pr-4">{r.entityType}</td>
                <td className="py-2 pr-4 font-mono text-xs text-slate-500">{r.entityId.slice(0, 12)}…</td>
                <td className="py-2 pr-4 font-mono text-xs text-slate-500">{JSON.stringify(r.metadata)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`?${new URLSearchParams({ ...(searchParams.action ? { action: searchParams.action } : {}), ...(searchParams.entityType ? { entityType: searchParams.entityType } : {}), page: String(page - 1) }).toString()}`}
                  className="text-brand-600 hover:underline">&larr; Prev</Link>
          ) : <span />}
          {page < totalPages ? (
            <Link href={`?${new URLSearchParams({ ...(searchParams.action ? { action: searchParams.action } : {}), ...(searchParams.entityType ? { entityType: searchParams.entityType } : {}), page: String(page + 1) }).toString()}`}
                  className="text-brand-600 hover:underline">Next &rarr;</Link>
          ) : <span />}
        </div>
      </Card>
    </div>
  );
}
```

### Update admin dashboard

Replace "Audit log" placeholder body:
```tsx
        <Card>
          <CardTitle>Audit log</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/dashboard/admin/audit" className="text-brand-600 hover:underline">View</Link>
          </p>
        </Card>
```

### Commit

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm test && npm run build
git add src/lib/services/auditService.ts src/lib/services/auditService.test.ts src/app/dashboard/admin/audit/ src/app/dashboard/admin/page.tsx
git commit -m "feat(admin): audit log viewer with filters"
```

Test count: ~252 → ~256.

---

## Task 9: Phase 7 sweep + final review + tag + merge

- [ ] **Step 1: Full sweep**

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && \
  npm test && \
  npx tsc --noEmit && \
  npm run lint && \
  npm run build
```

All four must be green.

- [ ] **Step 2: Dispatch final opus code review.** Scope: `phase-6-complete..HEAD`. Spec sections to verify: §5 (capability matrix, last few rows including audit + settings), §7 (file ACL spec), §13 (audit log spec). Tech-debt items from `project_itsnottechy_careers.md` should now be resolved or explicitly carried.

- [ ] **Step 3: Fix anything substantive** (separate fix commits).

- [ ] **Step 4: Tag + ff-merge to main**

```bash
git tag phase-7-complete
git tag v1.0.0    # First production-ready tag — MVP complete
git checkout main
git merge --ff-only phase-7-admin-polish
git checkout phase-7-admin-polish
```

---

## End-of-plan state

- Full Super Admin user management (list / role-change / deactivate / reactivate)
- System settings (companyName, defaultSenderName) read by email sender
- Audit log viewer with action + entity-type filters and pagination
- Invite-staff form for SUPER_ADMIN + HR_MANAGER
- Real-time `isActive` enforcement + middleware default-deny
- Entity-scoped file ACL on `/api/files`
- Login rate-limit + upload magic-byte validation
- 404 / 500 / 403 error pages
- ~256 tests passing
- **Tagged `v1.0.0` — MVP complete**

## Out of scope (defer to v2)

- Multi-tenant settings (per-team logos, etc.)
- Per-user notification preferences
- HR ability to override a manager's promotion rejection
- LDAP/SSO integration
- Audit log export (CSV/JSON)
- Real distributed rate-limiter (Redis)
- Per-request CSP headers
- Automated security scanning in CI
