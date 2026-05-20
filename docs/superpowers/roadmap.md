# ItsNotTechy Careers — Feature Roadmap

A prioritised backlog of post-Phase-9 work. Reference only — nothing here is committed
until brainstormed and planned. Updated 2026-05-20.

## P0 — next up

- **Saved jobs & job alerts** — let candidates save roles and opt into email alerts for new matching postings. Drives return visits and applications.
- **HR bulk stage actions** — move/reject multiple applicants at once from the applicants list. Removes the biggest repetitive-click cost for HR.
- **Reusable HR email templates** — canned messages (rejection, interview invite, offer) HR can pick and personalise instead of writing each time.
- **Application withdrawal** — let a candidate withdraw an application from their dashboard, keeping pipeline data honest.

## P1 — soon after

- **Interview scorecards** — structured per-interview feedback (criteria + rating + notes) so hiring decisions are evidence-based.
- **Analytics dashboard** — time-to-hire, pipeline funnel conversion, and source breakdown for HR and admins.
- **Reusable candidate profile** — skills, links, and a default resume stored once and reused across applications.
- **Job templates / clone** — start a new posting from an existing one to cut HR setup time.
- **Offer-letter generation + e-acceptance** — generate an offer document and let the candidate accept online.

## P2 — later

- **Job SEO** — sitemap entries and JobPosting structured data so roles surface in search and job aggregators.
- **Calendar integration** — push scheduled interviews to Google/Outlook calendars.
- **Embeddable careers widget** — a snippet that shows open roles on the main itsnottechy.com site.
- **Staff SSO** — single sign-on for internal users.
- **Talent pool** — re-engage strong past candidates when a matching role opens.

## Platform hardening

- **Redis-backed rate limiting** — replace the in-memory limiter so limits hold across multiple app instances.
- **Background job queue for email** — decouple sending from the request path; retry failures.
- **Audit-log retention & export** — scheduled archival/export of `AuditLog` rows.
- **Automated database backups** — replace the manual cron suggestion with an installed, monitored backup job.
