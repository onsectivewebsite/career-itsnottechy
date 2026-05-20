# Phase 9 — Content Polish, WYSIWYG Job Editor & Roadmap — Design Spec

**Date:** 2026-05-20
**Status:** Approved for planning
**Builds on:** Phase 8 (`2026-05-20-phase-8-public-pages-and-documents-design.md`), all merged to `main` and deployed.

## 1. Overview

Phase 9 has three parts:

- **Part A — Content & branding.** Correct the company founding year, add a Leadership & Departments page, expand the footer into a multi-column layout, and enrich the Home page.
- **Part B — WYSIWYG job editor.** Replace the plain `<textarea>` for a job's Description and Requirements with a rich-text editor (bold, headings, lists, links). Content is stored as sanitized HTML.
- **Part C — Roadmap.** Commit a prioritized feature backlog so future work can be picked deliberately.

Parts A and C carry no risk and no new dependencies. Part B adds an editor library and an HTML sanitisation path. One implementation plan; Part A first, then B, then C.

### Success criteria

- No "2024" founding-year text remains; the site says the company was formed in 2026.
- A `/leadership` page exists, linked from nav and footer.
- The footer is a multi-column layout with Explore, candidate, and contact columns.
- HR can format a job's Description and Requirements with bold, headings, and lists; the formatting renders on the public job page; stored HTML is sanitised.
- `docs/superpowers/roadmap.md` exists with a prioritised backlog.
- `npm test` green; `npm run build` succeeds.

### Out of scope

- Rich text for any field other than `Job.description` and `Job.requirements`.
- Migrating existing plain-text job descriptions — they render acceptably as plain paragraphs.
- Images / tables / embeds in the editor — text formatting only.
- Named individuals on the Leadership page (no real executive data exists).
- Implementing any roadmap item — Part C only writes the document.

## 2. Part A — Content & branding

All pages are React Server Components reusing the existing brand pattern (`PublicNav`, `PublicFooter`, teal/ink theme). No data-model changes.

### 2.1 Founding year

In `src/app/page.tsx`: change "Founded in 2024" (About paragraph) to "Founded in 2026", and the `<Stat value="2024" label="Founded" />` to `value="2026"`. These are the only two occurrences in the codebase.

### 2.2 New `/leadership` page

Create `src/app/leadership/page.tsx` — "Leadership & Departments":

- Hero (dark band) — "Leadership & Departments".
- **How we lead** — 3–4 cards on the management approach: senior practitioners own outcomes; flat, transparent decision-making; accountability by pipeline and revenue; managers coach rather than gate.
- **Our departments** — a card grid of the functional departments: Web Design & Development, SEO, Social Media, Video Production, Brand Design, Performance Marketing, Marketing Platforms, AI Marketing.
- CTA to `/jobs`.
- No named individuals.

### 2.3 Expanded footer

Replace the current single-row `PublicFooter` with a multi-column layout:

- **Column 1** — logo + tagline ("Digital marketing that speaks human.").
- **Column 2 — Explore** — Culture, Benefits, Resources, Life, Leadership.
- **Column 3 — For candidates** — Open roles, Sign in, Create account.
- **Column 4 — Contact** — Toronto HQ: `1111 Albion Rd, Etobicoke, ON M9V 2X3, Canada`; phone `+1 672-673-7900`; email `info@itsnottechy.com`.
- Copyright row beneath, unchanged.

Because every public page already renders `<PublicFooter />`, this change propagates everywhere automatically.

### 2.4 Expanded Home

In `src/app/page.tsx`, add two sections (existing hero / why-apply / About / Explore kept):

- **How hiring works** — a 4-step strip (Apply → Review → Interview → Offer), consistent with the `/resources` page content.
- **Leadership teaser** — a short band on the senior-practitioner leadership model with a link to `/leadership`.

`PublicNav` gains a "Leadership" link.

## 3. Part B — WYSIWYG job editor

### 3.1 Approach

TipTap WYSIWYG editor; job Description and Requirements are stored as **sanitised HTML** in the existing `Job.description` / `Job.requirements` text columns. **No database migration.** Rejected alternatives: storing TipTap JSON (less portable, still needs HTML rendering) and storing Markdown (needless conversion layer once HTML is chosen).

### 3.2 Dependencies

`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-link` (editor); `sanitize-html` (server-side sanitisation); `html-react-parser` (renders an HTML string as React elements rather than via a raw-HTML injection prop).

### 3.3 Components and helpers

- **`src/components/ui/RichTextEditor.tsx`** (client component) — a TipTap editor with a toolbar: bold, italic, H2, H3, bullet list, numbered list, link, undo, redo. Props: `name`, `initialHtml`. It keeps a hidden `<input name={name}>` synchronised with `editor.getHTML()` so the value submits with the surrounding `<form>` — the same hidden-input pattern already used by `CustomQuestionsEditor` and `RequiredDocumentsEditor`. StarterKit configured for heading levels 2 and 3 only.
- **`src/lib/richText.ts`** — two pure helpers:
  - `sanitizeRichHtml(html: string): string` — `sanitize-html` with an allowlist: tags `h2, h3, p, strong, em, ul, ol, li, a, br`; `a` allows `href` only, schemes `http/https/mailto`, and is forced to `rel="noopener noreferrer"` `target="_blank"`. All other tags/attributes stripped.
  - `htmlToText(html: string): string` — strips tags to a plain-text string (for list excerpts and length validation).
- **`src/components/RichText.tsx`** (server component) — takes an HTML string, runs `sanitizeRichHtml`, renders it with `html-react-parser` inside a `prose` wrapper. Used wherever stored job HTML is displayed.

### 3.4 Form, validation, persistence

- **`JobForm`** — the two `<textarea>` elements for `description` and `requirements` are replaced with `<RichTextEditor name="description" initialHtml={defaults.description} />` and the same for `requirements`.
- **Validation** (`src/lib/validation/jobs.ts`) — `jobInputSchema` keeps `description` / `requirements` as `z.string()`, but the min-length checks run against `htmlToText(value).trim().length` (description ≥ 20, requirements ≥ 10) so a visually empty rich field (`<p></p>`) is still rejected. Max length is checked on the raw string.
- **Persistence** (`jobService.createJob` / `updateJob`) — `description` and `requirements` are passed through `sanitizeRichHtml` immediately before the Prisma write. Stored data is always clean HTML.

### 3.5 Rendering

- **Public job detail** (`src/app/jobs/[id]/page.tsx`) — the two `<p className="whitespace-pre-wrap">{job.description}</p>` blocks become `<RichText html={job.description} />` and `<RichText html={job.requirements} />`.
- **Jobs list** (`src/app/jobs/page.tsx`) — the `line-clamp-2` excerpt uses `htmlToText(job.description)` so tags never show.
- **HR job detail** — uses `JobForm` (now with `RichTextEditor`); `initialHtml` receives the stored HTML.
- **Legacy jobs** — existing plain-text descriptions (seed data) contain no tags; `RichText` renders them as a single paragraph. Acceptable; no backfill.

### 3.6 Security

Stored HTML is sanitised on save; `RichText` sanitises again on render (defence in depth). `html-react-parser` produces React elements directly, so no raw-HTML injection prop is used anywhere. The allowlist permits no `script`, `style`, `iframe`, event-handler attributes, or inline styles. HR is a trusted role, but the public job page is unauthenticated, so sanitisation is mandatory.

### 3.7 Tests

`src/lib/richText.test.ts` — `sanitizeRichHtml` strips `<script>` / `onclick` / disallowed tags and keeps allowed ones; `htmlToText` removes tags. Existing `jobService` / `jobs` validation tests are updated so their fixtures use HTML and still pass (the `htmlToText`-based length check accepts `<p>...</p>` wrapped text).

## 4. Part C — Roadmap

Create `docs/superpowers/roadmap.md`: a prioritised backlog grouped P0 (next) / P1 / P2 / platform hardening.

- **P0** — saved jobs & job alerts for candidates; HR bulk stage actions on the applicants list; reusable HR email templates / canned messages; candidate-initiated application withdrawal.
- **P1** — interview scorecards / structured feedback; analytics dashboard (time-to-hire, pipeline funnel, source breakdown); reusable candidate profile (skills, links); job templates / clone-a-job; offer-letter generation + e-acceptance.
- **P2** — job SEO (sitemap, structured data); calendar integration for interviews; embeddable careers widget; staff SSO; talent pool / re-engagement of past candidates.
- **Platform hardening** — Redis-backed rate limiting for multi-node; background job queue for email; audit-log retention/export; automated database backups.

Each entry is one line: what it is and why it matters. The document is reference only — Phase 9 implements none of it.

## 5. Sequencing

1. **Part A** — founding-year fix, `/leadership` page, expanded footer, expanded Home, nav link. No dependencies.
2. **Part B** — add dependencies → `richText.ts` helpers (TDD) → `RichTextEditor` + `RichText` components → JobForm wiring → validation → `jobService` sanitisation → rendering on public job page and jobs list.
3. **Part C** — write `roadmap.md`.

Each step keeps the app deployable.
