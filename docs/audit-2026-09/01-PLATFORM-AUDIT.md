# 01 · Wajeez Academy — Full Platform Audit

> Date: 3 September 2026 · Branch: `claude/wajeez-academy-audit-9d910f` (from `main` at `fe806fa`)
> Status: **audit complete; branch merged with `main` (`9a00445`), all gates green; four safe fixes applied (A1, A10, A11, A13); corrections in §0.5; browser tour in [05](05-BROWSER-TOUR-AR.md). No production data or infrastructure touched.**
>
> **Owner context (3 Sep):** the site is in a testing phase with no public users. By the owner's decision: the payment driver stays `test` until the last step before launch; prices, cohorts and all data are left untouched; the domain is deferred; connecting email is a launch item, not a today item. §J's roadmap is re-ordered accordingly.
> Companion docs: [02 capabilities](02-CAPABILITIES-DESIGN.md) · [03 architecture](03-ARCHITECTURE.md) · [04 migration](04-MIGRATION-PLAN.md)

---

## 0 · How this audit was done, and its limits

**Evidence base**
- Full read of: deployment configuration (`Dockerfile`, `vercel.json`, `deploy/*`, `.github/workflows/*`, `scripts/vercel-build.sh`, `scripts/bundle-api.mjs`), server bootstrap and security layer (`server/index.ts`, `server/http/app.ts`, `auth-plugin.ts`, `errors.ts`, `auth.service.ts`, `permissions.ts`, `audit.ts`, `storage.service.ts`, `zoom/provider.ts`, `calendar/*`, `integrations.service.ts`), the academic core of `prisma/schema.prisma` (User, Session, Cohort, CohortSession, ZoomMeeting, Recording, Attendance, Enrollment, LearningMaterial, AuditEvent, Notification, UserPermission, TrainerInterview, AdvisorRequest), the React router and guards (`src/App.tsx`, `RequireRole.tsx`, `AdminLayout.tsx`), the video pipeline (`module-video.ts`, `ModuleVideo.tsx`), and every planning document in `docs/` that describes state rather than diagnostic methodology.
- Repository-wide measurements (route counts, guard coverage, schema statistics, terminology frequency, locale calls, bundle sizes, dependency audit).
- **All project quality gates were executed on this branch**:

| Gate | Result |
|---|---|
| `tsc --noEmit` (app and server projects) | clean |
| ESLint | 0 errors, 4 warnings (equals committed baseline) |
| Browser/engine tests (`vitest run src/tests`) | 91 files, **861 tests pass** |
| `ci:migrations` | 139 models, each has a creating migration |
| `ci:bundle` | committed `api/index.js` matches source |
| `npm run build` | succeeds; sizes in §E.3 |
| Server e2e (`server/tests`, embedded PostgreSQL) | 82 files, **612 tests pass** (837 s) |
| `npm audit` | 0 critical · 20 high · 7 moderate · 2 low (§E.4) |

The server suite needed the embedded PostgreSQL data directory to be owned by the `postgres` OS user in this sandbox; that is an environment quirk, not a code defect (the library refuses to run `initdb` as root). After that adjustment the full suite passed.

**Limits — stated plainly**
- No access to the Vercel dashboard, Neon console, Stripe, or the production URL. Anything about *live configuration* (payment driver, SMTP, env vars) is taken from the repo's own dated documents and flagged "verify".
- Persona walkthroughs are **code-level**: every screen, route, guard and API was read, but no browser session was run with real accounts. `docs/ROLE_AUDIT_TOUR_AR.md` confirms that the repo's own authors also never completed that tour for trainer, advisor, and four staff roles.
- The four parallel layer-audit agents launched at the start were cancelled by the session interruption before reporting; the audit below was completed directly and is therefore tighter on the security, data, and infrastructure layers than on pixel-level UI detail.

---

## 1 · Executive summary — ten things the owner should know

1. **The engineering quality is higher than a platform of this age usually has.** Typed end to end, 861 green browser tests, 84 server test files, fine-grained RBAC with delegation limits, maker-checker content flow, deterministic diagnostic engine with regression gates, thoughtful comments on every hard-won bug. This is a codebase worth investing in, not rewriting.
2. **The platform cannot currently do the thing an academy does daily: run a class with a live link, remind people, and show the recording afterwards.** Zoom is a pasted link, no reminder has ever been sent (there is no background worker), recordings and materials cannot be uploaded in production, and email is disconnected. These are the highest-value fixes and they are mostly plumbing, not product design.
3. **Production is running on a shape that fights every one of those fixes**: a single Vercel serverless function (13 MB bundle committed to git) over Neon. Cold starts already cause the login slowness the owner reported. Moving to a long-running server (doc 04) is a prerequisite for reminders, uploads and integrations, not a nice-to-have.
4. **One live risk needs fixing this week regardless of anything else**: Vercel *preview* builds run database migrations against the *production* database (`scripts/vercel-build.sh`). An unmerged branch can alter the live schema.
5. **The owner's own operational to-do list is the real blocker.** SMTP not connected, payment driver possibly still `test`, 77 courses without price, 392 of 404 modules without content. No architecture fixes these; they need decisions and a few clicks in `/admin/integrations` and `/admin/cohorts`.
6. **The academic model is already right.** Pathway → Course → Cohort → Session → Enrollment maps exactly to Program → Course → Section → Live session → Student. Don't add a "Program" table; fix vocabulary and add automation (doc 02 §4).
7. **RBAC is over-engineered for the staff you have and under-tested for the roles you defined**: 10 roles, 79 permissions, 5 roles never logged into. Collapse to the roles real people hold, add one "academic coordinator" for daily operations (doc 02 §6).
8. **Admins type UUIDs.** Enrolling a learner means pasting a user UUID; attaching a Zoom link means pasting a session UUID (`AdminCohorts.tsx:472,527`). This is the clearest example of "technically correct, hostile to humans" and it is cheap to fix.
9. **Documentation is abundant, Arabic-first, and partly stale** (three hosting targets described, "11 migrations" where 53 exist, a route name that no longer exists). A new developer needs a two-page current-state guide, which doc 04 §7 specifies.
10. **Migration to Hetzner + self-hosted PostgreSQL is the right call** and is 80 % already designed in `deploy/`. The database engine does not change; the risks are operational discipline (staging, backups, monitoring), and the plan in doc 04 addresses each.

---

## 0.5 · Corrections after merging `main` — what this audit got wrong or was overtaken by

**Admission.** This audit was performed on `fe806fa`. At that moment `main` was already **nine commits ahead** (PR #13, merged as `9a00445`: 90 files, +6,015/−3,105). I did not compare the branch to `main` before auditing; that was my error. The branch has since been merged with `main` (`800fd0a`) and every gate re-run green (879 browser tests, 630 server tests). The table below is the honest ledger of which findings survive.

| Finding | What `main` already did | Verdict |
|---|---|---|
| **A14** — five roles without demo accounts, therefore never exercised | `951b999` adds demo accounts for diagnostics/operations/finance/support (nine in total); `trainer_applicant` is defined as an application *state*, tested from `/join-trainer`. But `docs/ROLE_AUDIT_TOUR_AR.md` §4 ("what was actually tested") was **not** updated: the accounts exist, nobody has logged in with them | **Half withdrawn, half kept.** Re-worded: accounts exist; the tour was never run — the browser tour in doc 05 runs it |
| **F.1** — "two student homes" (`/student` vs `/student/learning`) | `5af08a4` unifies the learner journey into `Journey` (`/student/learning` with `?stage=`); `MyLearning`, `MyPathway`, `CourseMilestones` and the pathway map are deleted; old URLs redirect | **Withdrawn.** Moved to "fixed before review". The new `Journey` is examined in doc 05 instead |
| **A12** — hard delete with no alternative | `account-purge.service.ts`: computes an account *footprint* first, refuses deletion of accounts with history, allows a forced purge only for the top super-admin with a written reason and an audit fingerprint, behind a separate permission `admin.users.purge_history` | **Amended.** Deletion is now disciplined. The missing piece is narrower: an `archived` state for people who *left* but whose records must stay |
| **A11** — learner routes unguarded on the client | Still true on `main` (`App.tsx` learner block had no `RequireRole`). This branch's fix survives the merge and now also covers `Journey` | **Kept — fixed on this branch** |
| **B5** — invitation token valid 1 hour | Unchanged on `main` | **Kept** |
| **F.3/B4** — cohort form "~12–15 raw fields" | Counted in the browser (journey J7): the create form has **5 inputs** (course, title, capacity, price, start time) plus weekday toggle buttons; sessions, enrolment-by-UUID and Zoom-by-UUID are separate sub-forms that appear only on an *open* cohort's card | **Corrected.** The number was wrong; the UUID inputs (the real complaint) are confirmed in `AdminCohorts.tsx:472,527` and by screenshot in doc 05 |
| — | New on `main`, not covered by this audit: `LearnerRequest` + `/admin/learner-requests` (certificate/recommendation queue), `scripts/promote-super-admin.ts` (bootstrapping the first admin), rebuilt trainer application with email verification and a guarded `/join-trainer/status`, `Order`-level pathway discount ladder | **Added to the tour's scope** |

Rule applied throughout: a finding is withdrawn only when its evidence no longer exists in the code under review; one whose evidence half-remains is re-worded, not deleted.

## 0.6 · What the browser tour added (doc 05) — observed, not inferred

382 screenshots (191 screens × desktop and mobile, ten identities) and ten click-through journeys against a full local stack. Everything below was **seen**, with a screenshot path in doc 05.

| # | Observed | Status |
|---|---|---|
| T1 | A logged-in learner opening `/admin` (or a trainer opening `/student`) is redirected to their portal and gets a **blank black page** — the sibling `RequireRole` guards share one React instance and the stale `forbidden` state kept rendering a no-op `<Navigate>` | ✅ **fixed on this branch** (+ regression test) |
| T2 | The global 300 req/min per-IP limit includes `/api/auth/me`; a fast user (or a shared office IP) sees «تعذّر التحقّق من صلاحيّاتك» instead of "busy, retry" | `RATE_LIMIT_MAX` knob added; exemption of `/api/auth/me` and a clearer guard message remain in Phase A1 |
| T3 | **No upload outside the trainer-application flow has ever worked, in any environment.** Two independent causes, both seen in journey J5: (1) the trainer board PUTs the file with its real MIME (`video/mp4`, `application/pdf`) while the upload endpoint only parses `application/octet-stream` → HTTP 415; (2) once past that, the endpoint and `writeDocumentContent` look the storage key up **only** in `TrainerApplicationDocument` — the sole model with a `content Bytes?` column. `LearningMaterial`, `Recording`, `AssignmentSubmission` and `CvSubmission` issue signed upload URLs for keys that can never be found → HTTP 404 «الوثيقة غير مسجلة». A6 was right about the symptom and wrong about the cause: it is not a Vercel limit, the storage layer was only ever built for one model | (1) ✅ client fixed on this branch; (2) **open** — needs the object-storage design of doc 02 §5 (or, as a stopgap, a generic content table); until then the upload buttons promise what the platform cannot do |
| T4 | The academic manager's **own** Publishing page shows «هذه الصفحة تتطلب صلاحية «مدير النظام»» because it fetches quality regression runs the role lacks | ✅ fixed (panel degrades silently) |
| T5 | Admin home leaks schema vocabulary to the owner: `attachedAt`, `Enrollment.status=completed`, `Invoice where status=paid`, and bar labels `enrolled` / `completed` | ✅ fixed (Arabic captions and labels) |
| T6 | Ratings moderation identifies the rated trainer by **UUID** | ✅ fixed (name resolved server-side, rater stays anonymous) |
| T7 | Staff opening an admin page outside their role get an honest "requires super admin" screen — but the wording is wrong for pages that need *another* role (finance, support), and each such page fires the same 403 request three times | logged (Phase A1: per-page required-permission message; dedupe fetch) |
| T8 | `super_admin` is admitted into the trainer and advisor portals by the guard, then every screen says «لا ملف مدرب مرتبطا بهذا الحساب» (404 `/api/trainer/me`) | logged (either hide the portals for accounts without a profile, or show a single explanatory page) |
| T9 | Login is limited to **10 attempts per 5 minutes per IP**; the journey script itself was locked out on its 11th login. A classroom behind one NAT hits this on day one | logged — auth-sensitive; recommendation: key by IP+email, keep the per-IP cap as a wider net (owner decision) |
| T10 | With the email channel disconnected (A3, deferred by owner) the learner banner says verification is required for **buying a cohort and receiving a certificate** and offers no other path («قناة البريد غير مفعّلة — تواصل مع الأكاديمية») | **blocks the test phase's purchase flow**, not only launch — needs either SMTP now or a staff action "mark email verified" (see doc 05 §4) |
| T11 | Cohort creation: 5 inputs + weekday toggles; learner enrolment and Zoom attachment require pasting UUIDs (`AdminCohorts.tsx:472,527`) | confirms B4 |
| T12 | The rest of the sweep is clean: no horizontal overflow on 390 px, no console errors other than one Vite HMR notice caused by the fix in T1 landing mid-run, every public page and every learner page renders with content | — |
| ~~T13~~ | **Withdrawn on re-verification.** I claimed pending reschedule proposals had no list-level indicator and that the cohort list hid running cohorts by default. Both were artefacts of my own journey script: `AdminCohorts.tsx:197` renders a top-of-page panel «اقتراحات تأجيل تنتظر قرارك (n)», and the filters initialise empty (`:72`) — the date I saw in «تبدأ بعد» was typed there by the script. The real adjacent gap (only staff who open that screen ever see the panel) is what the task inbox addresses | withdrawn; inbox shipped |

---

## A · Critical issues (fix before scaling or migrating)

| # | Problem | Why it matters | Impact | Recommended solution | Priority |
|---|---|---|---|---|---|
| A1 | **Preview deployments migrate the production database.** `scripts/vercel-build.sh` runs `prisma migrate deploy` for every build; the comment explains the retry exists because prod and preview race for the same Neon lock. | A migration on any pushed branch changes the live schema before review or merge. A destructive migration in a PR = production incident. | Data integrity of the live system | Run migrations only when `VERCEL_ENV=production`; long-term, staging with its own DB (doc 04 Phase 0.1/1) | ✅ **fixed on this branch** |
| A2 | **No background job runner.** `deploy/README.md` "لا مجدول يعمل"; grep of `server/` finds no cron/queue. `Notification.status = queued` rows, `scheduledPublishAt`, `nextFollowUpAt`, `nextDueAt` are written and never acted upon. | Every promise the UI makes about "we will notify you" is false. No session reminders, no scheduled publishing, no follow-ups, no email retry. | Learner no-shows, staff manual chasing, broken trust | pg-boss worker container (doc 02 §0); requires the long-running server (doc 04) | **P0** |
| A3 | **Email channel not connected in production** (as of `HANDOVER_2026-08-31.md`; verify today). `.env.example` explains the consequence: no verification, no password reset, invitations not sent. | A learner who forgets a password is locked out permanently. Purchases are blocked by unverifiable email. Admin-created accounts receive "لم تُرسل الدعوة". | Direct revenue and support load | Connect Resend/Postmark in `/admin/integrations`, add SPF/DKIM/DMARC. Zero code. | 🕓 **deferred to launch by owner** — no public users today |
| A4 | **Payment driver state is ambiguous and the fallback is silent.** `HANDOVER_2026-08-31.md` says `driver: "test"` ("نجاح بلا مال"); `DECISIONS_PENDING_AR.md` §6 says payments are live. `.env.example`: without a secret key the system "falls back to the test provider **silently**". | Either real customers are getting free enrolments, or the docs are wrong. A silent fallback in the money path is a defect in itself. | Revenue | Owner's decision: driver stays `test` through the testing phase. The silent-fallback fix (a hosted driver with a missing key must **refuse to start**) moves to the pre-launch checklist. | 🕓 **deferred to launch by owner** |
| A5 | **No staging environment; no maintenance mode.** Previews share the production DB (A1). Nothing can be rehearsed. | Every change is tested in production or not at all; the migration cannot be rehearsed safely. | Change risk | Staging server + `MAINTENANCE_MODE` flag (doc 04 Phase 0/1) | **P0 before migration** |
| A6 | **Files live in the database (4 MB cap) and only for trainer-application documents; every other upload (materials, recordings, assignment files, CVs) has never worked anywhere** (tour T3: HTTP 415 then 404 — the first cause fixed on this branch, the second needs the storage design). `storage.service.ts` header; `PLATFORM_UX_PRODUCT_TASKS_AR.md` §1ب "معطّل". Trainer board still shows «ارفع التسجيل» and «ارفع ملفا» buttons (`CohortBoard.tsx:324,513`). | Trainers click upload and it fails; recordings cannot exist; the DB backup carries binary blobs. | Core teaching workflow non-functional | Object storage with pre-signed URLs (doc 02 §5, doc 03 §2.2); hide the buttons until then | **P0** |
| A7 | **Secrets entered through the admin UI are stored in plaintext JSON** (`IntegrationSetting.config`, acknowledged in `CONNECT_AR.md` §4 and `DECISIONS_PENDING_AR.md` §6). | A database dump or a read-only DB role leaks Stripe/SMTP secrets. | Financial and account security | Env-only for secrets on the server (doc 03 §2.2); if DB storage stays, encrypt with a key from env. Rotate the Stripe test keys the handover says were pasted into a chat. | **P1** |
| A8 | **Hand-built 13 MB API bundle committed to git** (`api/index.js`). Went stale twice and left routes dead in production (`bundle-api.mjs` header). Also bundles `embedded-postgres`. | A class of outage that tests cannot catch; a merge-conflict magnet; a 13 MB diff on every server change. | Reliability, developer friction | Disappears with the hosting move; until then keep the `ci:bundle` gate required on PRs | **P1** |
| A9 | **Storage signing key derived from `DATABASE_URL`** when `STORAGE_SECRET` is unset (`storage.service.ts`). | Changing the database URL (the migration!) silently rotates the key. | Broken document links at cutover | Set `STORAGE_SECRET` explicitly now (doc 04 Phase 0.2) | **P1** |
| A10 | **Swagger UI (`/docs`) is public in production** (`deploy/README.md`, Caddyfile comment). Helmet CSP for the API allows `unsafe-inline` to keep it working. | Full API surface enumerable by anyone; helps attackers map 298 routes. | Security posture | Swagger UI now registers only outside production, or with `ENABLE_API_DOCS=true`; the OpenAPI spec is still generated | ✅ **fixed on this branch** |
| A11 | **Learner portal routes are not role-guarded on the client** — all `/student/*` plus `/trainer/ratings` and `/admin/ratings` sit outside `RequireRole` (`App.tsx:165–188`). Server APIs are guarded (learning-portal: 33 of 34 routes have a `preHandler`; the one without is the public certificate verifier), so this is a UX/exposure issue, not data leakage. | Wrong-role users see empty shells and confusing errors; `/admin/ratings` renders admin chrome for anyone logged in. | Confusion, minor information exposure | `/student/*` now sits inside `RequireRole allow={LEARNER_ROLES}`; `/trainer/ratings` and `/admin/ratings` moved into their own portals | ✅ **fixed on this branch** |
| A12 | **Hard delete of user accounts** (`admin.users.purge`) with no archive/anonymise alternative; 16 models cascade on user delete, 9 on enrollment delete (incl. Attendance, Certificate, Grade history). | Deleting a learner destroys academic records the academy may be legally required to keep. | Compliance and history | `archived` + `anonymised` states; purge only for accounts with no history (doc 02 §6) | **P1** |
| A13 | **No request logging or error tracking in production.** `Fastify({ logger: false })` in `app.ts`; only `console.error` on 5xx in `errors.ts`; no Sentry. | Incidents are diagnosed from user complaints. The owner's "login is slow and fails" report took code archaeology instead of a dashboard. | Time-to-detect | pino logger enabled with cookie/signature redaction, silent under tests ✅ **on this branch**; Sentry and uptime checks stay **P1** and land with the server move |
| A14 | **Five of ten roles have never been exercised.** (`main` has since seeded accounts for all of them — `951b999` — but nobody logged in with them: `ROLE_AUDIT_TOUR_AR.md` §4 is unchanged.) | Unknown breakage in operations/diagnostic/finance/support screens. | Hidden defects | Run the tour — done in doc 05 with all nine accounts | ✅ **exercised in doc 05** |

---

## B · High-value improvements

| # | Improvement | Value | Evidence |
|---|---|---|---|
| B1 | **Zoom API provider + attendance sync + reminders + ICS feed** (doc 02 §2) | Turns the platform from "a page with a pasted link" into an academy operations system; removes the largest manual chore (marking attendance, sending links) | `zoom/provider.ts` stub throws; `Attendance.markedBy` manual; `AdminCohorts.tsx:527–534` paste form |
| B2 | **Recording review workflow + managed video with signed embeds** (doc 02 §3) | Paid content stops being an unlisted YouTube link; first honest watch-progress data | `module-video.ts` whitelist; `ModuleVideo.tsx` disclaims progress |
| B3 | **Cohort wizard with session generation, status automation, "duplicate cohort"** (doc 02 §4) | Cuts cohort setup from ~15 raw fields + manual sessions to 5 guided steps; eliminates the two-sources-of-truth schedule | `schema.prisma` Cohort vs CohortSession; `AdminCohorts.tsx` form |
| B4 | **Replace UUID inputs with search-and-pick** (learners by email/name, sessions by title/date) | The single most visible "built for developers" smell | `AdminCohorts.tsx:472` «معرف المستخدم (UUID)», `:527` «معرف الجلسة (UUID)» |
| B5 | **Invitations that last 7 days, `invited` state, resend, bulk CSV** (doc 02 §6) | Current invite is a 1-hour reset token; staff onboarding fails on first try | `account-mail.ts:105` |
| B6 | **Academic coordinator role; retire `operations_manager`; applicant becomes a state** (doc 02 §6) | Roles that match real jobs are roles people can be trained on | `permissions.ts` ROLE_PERMISSIONS |
| B7 | **Per-entity audit timeline tabs + coverage test** (doc 02 §7) | Admins see "who changed this cohort" where they work | `/admin/audit` global only |
| B8 | **Consultation booking via Calendly behind a provider interface** (doc 02 §1) | Advisors get bookings inside the platform instead of WhatsApp threads | no booking model exists |
| B9 | **Staff "next action" inbox** — surface failed jobs, pending reviews, cohorts blocked on trainer/price as tasks | Removes the need to know which of 20 admin screens to open | `StaffTask` exists; `/admin` dashboard |
| B10 | **Fix date locales**: 8 remaining `ar-SA`/`ar-JO` calls show Hijri or Levantine months to some users while others see Gregorian | Small, embarrassing, quick | grep: 8 occurrences in `src/` |
| B11 | **Rename or split `commerce.service.ts`** (1 191 lines) and the 489-line `operations.routes.ts` | The two files most likely to hide the next money bug | `wc -l` |
| B12 | **Reduce the front page and diagnostic component sizes** (`Diagnostic.tsx` 2 493 lines, `Home.tsx` 1 559, `JoinTrainer.tsx` 1 246) | Maintainability; these are the three screens every visitor touches | `wc -l` |
| B13 | **Documentation reset**: one current-state architecture page, one runbook, one env reference; archive the rest under `docs/history/` | Onboarding time from days to an hour | `RUNBOOK_AR.md` says 11 migrations (53 exist); `DEPLOYMENT.md` targets Replit; `CONNECT_AR.md` names a route that no longer exists |

---

## C · Missing features (beyond the brief's list)

| Feature | Who needs it | Why it matters | Note |
|---|---|---|---|
| **Session reminders and "join" flow** | learners, trainers | Attendance | A2, B1 |
| **Recording pipeline** | trainers, learners, admins | Core promise of a live academy | B2 |
| **Booking of consultations / interviews** | learners, advisors, admins | Today off-platform | B8 |
| **Invitation management** (pending list, resend, revoke, bulk) | admins | Onboarding | B5 |
| **Archive / anonymise account** | admins, compliance | Legal retention vs erasure | A12 |
| **Cohort duplication and session generation** | academic staff | Term setup is repetitive | B3 |
| **Drip release / scheduled availability that actually fires** | academic staff | Field exists, no executor | A2 |
| **Learner calendar feed (webcal)** | learners | "Where is my next class" in their own calendar | doc 02 §2 |
| **Watch-progress and completion evidence for video** | learners, admins | Progress is currently module-open based for video | B2 |
| **Staff task inbox fed by system events** (failed job, pending review, blocked cohort) | all staff | Replaces knowing where to look | B9 |
| **Health/ops dashboard**: jobs status, email failures, webhook failures | super admin | "Is the system healthy?" is unanswerable today | A13 |
| **Per-user notification preferences** | learners | Later, after volume | — |
| **Corporate/B2B group enrollment** (`/for-business` redirects to a contact form) | companies | Revenue channel; the model supports it (cohort capacity, CSV add) | later |
| **Trainer availability & qualification view** (`docs/PLATFORM_UX_PRODUCT_TASKS_AR.md` batch 4 not started) | trainers | "Which courses am I qualified for" | later |
| **Learner-facing deadlines list** across cohorts | learners | Deadlines exist per assignment; no unified view | later |

---

## D · Unnecessary complexity (simplify)

| Area | Complexity today | Simplification |
|---|---|---|
| **Three hosting targets in one repo** | Vercel function + hand bundle, Replit static config, VPS compose | Keep the VPS path only after migration; delete `.replit`, `vercel-handler.ts`, `api/`, `bundle-api.mjs`, `ci:bundle` (doc 04 Phase 4.5) |
| **Ten roles, six of them "manager/staff" variants** | 79 permissions across 10 bundles; delegation rules; five roles unstaffed | 8 roles that map to job titles (doc 02 §6). Keep the permission engine; simplify the bundles and the UI role picker |
| **Admin navigation: 20 screens, several near-duplicates** | `/admin/learners` vs `/admin/exceptions` vs `/admin/cohorts` enrollment; `/admin/trainers` vs `/admin/advisors`; `/admin/tasks` + `/admin/notifications` | Group into 5 areas: **الأكاديمية** (catalog, authoring, publishing, cohorts, learners) · **الأشخاص** (users, trainers, advisors) · **العمليات** (tasks, support, exceptions, requests) · **المال** (finance, reports) · **النظام** (integrations, audit, quality). Same screens, fewer decisions |
| **Cohort schedule stored twice** | weekly pattern fields + explicit sessions | Sessions are truth; pattern is a generator (doc 02 §4) |
| **Two upload mechanisms** | DB `Bytes` for applicant docs (works), signed URL to disk for materials (broken) | One: object storage with pre-signed URLs |
| **Integration secrets in two places with precedence rules** | env overrides DB, masks, "save ignores masked values" logic | Env only on the server; DB keeps toggles and non-secret settings |
| **67 npm scripts** in `package.json` | Many are one-off audits or historical (`cohorts:open-all`, `roles:restore-learner`, `demo:purge`, `simulate:*`) | Move one-offs to `scripts/README.md` with `npx tsx …` invocations; keep ~15 scripts developers run weekly |
| **Diagnostic documentation volume** | `QUESTION_DECISION_CARDS_AR.md` 237 KB, `personas-report.json` 1.3 MB, `audit/` 13 MB committed | Generated artefacts belong in CI artifacts or a release, not the working tree |
| **Stray root files** | `tmp_offers.txt`, `tmp_offers_miner.txt` (51 KB each, scraped marketing text), `tmp_tech.txt`, `cp.mts` (an ad-hoc engine script), `template-info.md` | Delete or move under `scripts/tmp/` (already git-ignored) |
| **Learner terminology** | مسار (479) · شعبة (215) · جلسة (108) · وحدة (71) · درس (33) · مادة (14) · مجموعة (7) · برنامج (1) — mostly consistent, but «درس» vs «وحدة» and «مجموعة» vs «شعبة» coexist | Glossary + lint test on UI strings (doc 02 §9) |

---

## E · Technical debt and architecture risks

### E.1 Backend (`server/`, 30 495 lines, 298 routes, 84 test files)

| Finding | Evidence | Severity |
|---|---|---|
| Authentication is sound: bcrypt cost 10, session tokens stored as SHA-256 hashes, `httpOnly` + `SameSite=Lax` + `secure` in production cookie, 15-minute lockout via `LoginAttempt`, reset tokens single-use, sessions revoked on password change and permission change | `auth.service.ts:61–172`, `auth.routes.ts:50–52` | ✅ keep |
| Authorisation is per-route: 27 route files, 298 routes; every route without `preHandler` is intentionally public (catalog, leads, auth, webhook, certificate verify, applicant flows by reference+email token) | route scan (§0) | ✅ keep; add a test that fails when a new `/api/admin/*` or `/api/learner/*` route lacks a guard |
| Request scoping uses `req.auth.userId` densely (38 uses across 34 learner routes); the "spread overwrites scope" bug class is documented and fixed once already | `learning-portal.routes.ts`; `ROLE_AUDIT_TOUR_AR.md` §5.1 | Medium — add a regression test per portal for cross-user IDs |
| **No structured logging** (`logger: false`), no request IDs, no error tracker | `app.ts:46`, `errors.ts` | High (A13) |
| CORS default origin `http://localhost:7100` when `WEB_ORIGIN` unset — safe failure mode, but the port does not match the dev port 3000/7101 used elsewhere | `app.ts:65` | Low |
| Global rate limit 300/min per IP; tighter on identity routes. Public POST endpoints (`/api/leads/discount-email`, `/api/v1/trainer-applications`, `/api/events`, `/api/path-drafts`) rely on the global limit only | `app.ts:82`, route scan | Medium — add per-route limits and a honeypot field to public forms |
| `process.on('uncaughtException')` swallows any error whose text contains "terminat" | `server/index.ts:23` | Medium — too broad; log and exit on unknown errors |
| Webhook signature for payments verified on raw body (correct); Zoom verifier exists but no route; Calendly absent | `app.ts:49–59`, `zoom/provider.ts:64` | — |
| Largest services: `commerce.service.ts` 1 191 lines, `trainer-review.service.ts` 765, `catalog-admin.service.ts` 583 | `wc -l` | Medium |
| TODO/FIXME count: 13; raw SQL: 1 (`SELECT 1` health check) | grep | ✅ |
| `embedded-postgres` reachable from the production import graph (`db/client.ts` → `embedded.ts`) | `client.ts:56` | Low on Docker, wasteful on Vercel |

### E.2 Database (`prisma/schema.prisma`, 2 499 lines, 139 models, 53 migrations)

| Finding | Evidence | Severity |
|---|---|---|
| **Zero Prisma enums; 55 `status String` fields with the allowed values in comments** | `grep -c "^enum "` = 0 | Medium — no DB-level constraint; a typo becomes a new status. Introduce enums for the ~10 hottest status fields (User, Cohort, CohortSession, Enrollment, Recording, Order, Notification) via additive migrations |
| **64 `Json` columns.** Some are legitimate (audit before/after, webhook payloads, snapshots); others hold structured operational data (`CohortDeliveryPlan.content`, `IntegrationSetting.config`) | grep | Medium — review each; move queryable fields to columns |
| Money is `Decimal(10,2)` (20 fields) — correct. The 6 `Float`s are weights and a rating average — acceptable | grep | ✅ |
| **113 `onDelete: Cascade`**; 9 models cascade from `Enrollment` (Attendance, AssessmentAttempt, AssignmentSubmission, CourseProgress, ModuleProgress, SkillRemeasure, **Certificate**, Rating, CohortMessage) and 16 from `User` (incl. **Order**, Subscription, ConsentRecord) | grep | High — deleting an enrollment or user erases financial and academic history. Change to `Restrict` on history tables and use archive states (A12) |
| `Cohort.courseId`, `CohortSession.moduleId`, `LearningMaterial.moduleId` are untyped `String` references to catalog codes (e.g. `C-AI-101`) without FKs | schema | Medium — intentional (catalog is versioned/imported), but document it and add a validation test |
| Two migrations share the timestamp `20260901220000` (`audit_log_index`, `day_codes_normalize`) | `ls prisma/migrations` | Low — independent today; rename one to avoid ordering ambiguity |
| Unbounded growth tables without retention: `AuditEvent`, `Notification`, `AnalyticsEvent`, `LoginAttempt`, `PaymentWebhookEvent` | schema | Medium — retention jobs once the worker exists |
| PostgreSQL compatibility for the move: standard types only, no extensions required, Prisma 7 + `pg` adapter, `_prisma_migrations` travels with the dump | schema, `prisma.config.ts` | ✅ |
| `embedded-postgres` dev experience is good but fails when run as root (sandbox finding) | this audit | Low — document `chown` or run as non-root |

### E.3 Frontend (`src/`, 64 102 lines, 60 pages, 58 lazy routes)

| Finding | Evidence | Severity |
|---|---|---|
| Route-level code splitting is in place (58 `lazy()`); first load is `index` 132 KB gzip + `vendor-react` 18 KB — reasonable | build output | ✅ |
| The 3.95 MB `core-catalog.v2.json` (921 KB gzip) is a **lazy fallback** loaded only when the published snapshot cannot be fetched; the 898 KB `catalog` chunk (115 KB gzip) loads on the diagnostic path | `core-catalog-source.ts:136`, build output | Medium — acceptable as a fallback, but the fallback should be the 134 KB slim file, not the full one |
| `RequireRole` verifies the session server-side with retries and an explicit "unreachable" state — good pattern | `RequireRole.tsx` | ✅ |
| Learner and two ratings routes outside guards | `App.tsx:165–188` | Medium (A11) |
| Components >500 lines: `Diagnostic.tsx` 2 493, `Home.tsx` 1 559, `JoinTrainer.tsx` 1 246, `TrainerOps.tsx` 886, `Pathway.tsx` 849, `CoursePath.tsx` 714, `CohortBoard.tsx` 710, `TrainerApplications.tsx` 688, `AuthGate.tsx` 629 | `wc -l` | Medium |
| Loading/empty/error states are present in volume (82 / 49 / 106 occurrences in `src/pages`) but **toast/success feedback is used in only 5 files**; most success is a status line inside the card | grep | Medium — one feedback pattern |
| Forms: 247 inputs, 101 labels, 54 `required`, **3 `aria-invalid`** — inline validation is rare; errors appear after submit | grep | Medium |
| Locale: 8 `ar-SA`/`ar-JO` calls remain (Hijri calendar or Levantine month names for some users) | grep | Low but visible (B10) |
| Mobile: 482 responsive utilities, 14 fixed pixel widths, 4 `<table>` with 15 `overflow-x-auto` wrappers — mobile was considered | grep | ✅ verify on device |
| Accessibility: an automated gate runs on 9 pages (5 public in CI, 4 authenticated locally) with a zero-incident baseline; `dangerouslySetInnerHTML` used once (outside module rendering, which uses a constrained Markdown renderer) | `a11y-audit.ts:59–68`, grep | ✅ keep; extend to admin cohorts and trainer board |
| No hardcoded API hosts, no `console.log` in app code | grep | ✅ |
| `src/services/zoom.ts` is a mock adapter generating fake `zoom.us` links — dead code from the pre-backend era | file header | Low — delete |

### E.4 Dependencies

`npm audit`: 0 critical, 20 high, 7 moderate. The highs are almost entirely in **build/dev tooling** pulled in by `@vercel/node` (its `@vercel/build-utils` → `js-yaml`, `lodash`, `path-to-regexp`, `mysql2`…), `vite`, `rollup`, `postcss`, and `prisma`'s `deepmerge-ts`. Two runtime-relevant items: `fastify` (schema-validation coercion bypass — update to the patched minor) and `exceljs` via `uuid` (moderate). Action: `npm update` on the direct dependencies, then drop `@vercel/node` entirely after the migration, which removes most of the list.

Notable: `nodemailer` 9, `fastify` 5, `react` 19, `prisma` 7, `zod`, `exceljs` (reports), `bcryptjs`. No ORM/HTTP/UI duplication. Dev dependencies are used in production (`tsx`, `prisma`) by design of the Dockerfile — acceptable but see doc 04 §7.

### E.5 Server e2e suite (this run)

82 test files, 612 tests, all passing, 837 s on the embedded PostgreSQL. CI runs the same suite on every push (`.github/workflows/ci.yml` job `server`). Note for developers: the suite cannot run as `root` because `embedded-postgres` hands `initdb` to the `postgres` OS user; on a root shell, pre-create `server/.pgdata` owned by that user.

### E.6 Infrastructure (summary; full analysis in doc 04 §1)

Vercel function + committed bundle (A8) · Neon with a 5-connection pool per instance and documented connection-ceiling symptoms · migrations at build time (A1) · no worker (A2) · no staging (A5) · no monitoring (A13) · files in DB (A6) · `/docs` public (A10) · `deploy/` VPS design complete but unused · GitHub deploy workflow exists but manual · backups designed with verified restore but not yet running anywhere.

---

## F · Multi-persona walkthroughs (code-level)

### F.1 Student
| Question | Finding |
|---|---|
| Can I understand what to do? | **Yes, unusually well.** `/student` has a real "التالي الآن" card computed from data: next session → next assignment → continue first cohort (`Dashboard.tsx:217–228`). This is the pattern the whole platform should follow |
| Find my courses / next class? | Yes: "جدولي — الجلسات القادمة" with per-session join link when a Zoom row exists; honest empty state when none (`Dashboard.tsx:335–357`) |
| Join a live session easily? | One click — **if** an admin pasted a link. Passcode shown in the UI (`MyLearning.tsx:415`). No reminders arrive (A2) |
| Watch recordings without leaving? | Module videos play in an iframe inside the page (YouTube/Vimeo). Cohort session recordings cannot exist (A6) |
| See my progress? | Module progress yes; video progress impossible today; certificates screen exists |
| Understand deadlines? | Per-assignment in the cohort view; no unified deadlines list (C) |
| Contact the right person? | `/student/support` tickets and `/student/inbox` cohort messages exist; no consultation booking (B8) |
| Confusing? | 19 screens in the student nav is a lot (`/student/vault`, `/student/skills`, `/student/remeasure`, `/student/rate`, `/student/cv`…). Terminology mostly consistent. Passcode + link in two places (dashboard vs learning) |
| Unnecessary clicks? | Two homes: `/student` and `/student/learning` overlap heavily (both list sessions and cohorts) |

### F.2 Instructor / trainer
| Question | Finding |
|---|---|
| Manage my courses, see my students? | `/trainer` summary + `/trainer/board` "cockpit" with attendance grid, materials, assignments, grading (`CohortBoard.tsx`). Scope enforced per cohort by `assertCohortTrainer` |
| Schedule sessions? | Propose a reschedule with a reason; admin approves (agreed decision). Cannot create sessions — appropriate |
| Upload materials / recordings? | Buttons exist, **upload fails in production** (A6) |
| Assignments? | Create assignment, grade submissions in a queue — yes |
| Understand my schedule? | List within each cohort; no cross-cohort calendar or ICS for trainers |
| Workflow complexity? | Reasonable. Two pain points: `/trainer` vs `/trainer/board` split (already noted by the repo's authors), and no host link for Zoom (trainer joins as a participant with the same link as students) |

### F.3 Academic administrator / F.5 Academic manager
| Question | Finding |
|---|---|
| Create programs / courses? | Pathways and courses are created via catalog import + `/admin/catalog` with maker-checker; module content via `/admin/authoring` (good editor with live preview and queue) |
| Create sections/cohorts, assign instructors, students, schedules, dates? | All possible in `/admin/cohorts` — but as **raw forms**: ~12 fields for a cohort, sessions added one by one, learners enrolled by **pasting a UUID**, Zoom attached by **pasting a session UUID and a URL** (`AdminCohorts.tsx:431–534`) |
| Manage content? | Yes (authoring). Materials per cohort: upload broken (A6) |
| Track activity? | `/admin/reports`, `/admin/audit` (global), `/admin/tasks`. No cohort health view ("session tomorrow without trainer/link") |
| Approvals / exceptions? | Reschedule approvals, enrollment requests (`/admin/exceptions`), advisor requests, content review — all exist, spread over 4 screens |
| Bottlenecks | Everything that should be automatic is manual: session creation, Zoom links, reminders, attendance, recording publication, cohort status changes, price alignment (there are literally admin buttons to run former shell scripts) |

### F.4 Super admin
| Area | Finding |
|---|---|
| Users, roles, permissions | Strong: create (with invite), roles with rank checks, per-user grant/deny with reason, suspend/reinstate with session revocation, purge. Missing: `invited`/`archived` states, resend invite, bulk |
| Audit logs | Present, sanitised, indexed, read-only UI |
| Data access | Everything through RBAC; secrets masked in UI but plaintext in DB (A7) |
| Platform settings / integrations | `/admin/integrations` with live connection tests for payment and email — good. Zoom/Calendly/video not yet there |
| Security | Good fundamentals; A7, A10, A13 are the gaps |
| System health | **Nothing.** No jobs view, no email failure view beyond `/admin/notifications`, no uptime, no error feed (A13) |
| Complexity | 20 screens in three groups; the sidebar filters by permission (good). Regroup into 5 areas (D) |

### F.6 First-time non-technical user
| Would confuse them | Where |
|---|---|
| **UUID inputs** | admin cohort enrolment, Zoom attach |
| A "shell" page that then redirects or shows "no permission" | unguarded routes (A11) |
| An invitation link that has expired by the time they open the email | 1-hour token (B5) |
| "Upload" buttons that fail without saying why | A6 |
| A verification bar with a button that does nothing when email is not connected | A3 (`.env.example` describes this exactly) |
| Two student homes with overlapping content | `/student` vs `/student/learning` |
| Nineteen student menu items; internal terms like «القبو» (vault), «إعادة القياس» (remeasure), «مراجعتي» | student nav |
| Hijri dates on one screen, Gregorian on the next | B10 |
| Success messages as small status lines rather than a consistent confirmation | E.3 |
| Where the system guides well | the diagnostic flow, the "التالي الآن" card, the authoring editor's inline errors, the trainer application's shrinking "what's missing" list (`PLATFORM_UX_PRODUCT_TASKS_AR.md` §1) — these are the house style to generalise |

---

## G · UX/UI system review

| Dimension | Assessment |
|---|---|
| Visual hierarchy & consistency | Tailwind design tokens, one dark visual language, shadcn-style primitives; consistent card/rounded style. Dense text sizes (`text-[11px]`, `text-xs`) are frequent in admin screens — small for Arabic script on laptops |
| Navigation / IA | Four portals, permission-filtered sidebars — good. Admin has 20 items in 3 groups (regroup to 5 areas); student has 19 items (trim to ~8 with a "more" section) |
| Typography | Arabic web fonts via Google Fonts; a licensed Avenir Arabic face is missing from the repo by necessity (owner action). Line-height and size are fine in learner content; small in admin tables |
| Spacing / buttons / forms | Consistent primitives; forms lack inline validation (3 `aria-invalid`); destructive actions confirmed inconsistently (2 `confirm()` calls) |
| Empty / loading / error / success states | Empty and error states are thoughtful and frequent; success feedback inconsistent (5 toast files) |
| Mobile | Responsive utilities everywhere; tables wrapped; verify trainer board and admin cohorts on a phone — they are dense |
| RTL & Arabic | Native RTL throughout; `dir="ltr"` on codes/URLs; locale mismatches remain (B10) |
| Accessibility | Automated gate with zero baseline on 9 pages; focus rings, names, heading order enforced; extend coverage to admin/trainer |
| Cognitive load | Highest in `/admin/cohorts` (creation + sessions + enrol + Zoom + reschedules on one page) and in the student nav breadth |
| Dark mode | Dark is the primary theme; a light theme exists via `theme.ts` — check contrast baseline on both |

---

## H · Manual work elimination — automation register

| Manual today | Automate | Trigger | Value |
|---|---|---|---|
| Creating each session by hand | Generate from weekly pattern | cohort wizard step 2 | high |
| Pasting Zoom links | Zoom API create/update/delete | session create/change | high |
| Sending session links | Personal registrant links in portal + ICS email | enrolment/session change | high |
| Reminding learners and trainers | Worker jobs T‑24 h / T‑1 h | schedule | high |
| Marking attendance | Zoom participants report → Attendance, trainer overrides | meeting ended | high |
| Publishing recordings | Zoom → video platform → review queue → publish to cohort | recording completed / approval | high |
| Changing cohort status (open/active/completed) | Date-driven job | hourly | medium |
| Aligning prices / opening cohorts (today: buttons that run scripts) | Defaults at creation (price from course list price) | wizard | medium |
| Chasing unactivated invitations | Auto-resend at day 3, expire at day 7, admin sees pending list | worker | medium |
| Follow-ups (`nextFollowUpAt`) for advisors | Task creation when due | worker | medium |
| Publishing content at a date | `scheduledPublishAt` executor | worker | medium |
| Verifying backups monthly | Healthchecks ping + calendar task | timer | high (risk) |
| Answering "is the deploy live / in sync" | `/api/version` already answers; surface it in the admin health card | — | low |
| Interview scheduling by email ping-pong | Calendly link + webhook → interview row | applicant decision | medium |
| Templates/bulk | Duplicate cohort; CSV learner import | admin action | medium |

---

## I · Notes on `docs/ROLE_AUDIT_TOUR_AR.md`

The document is accurate on structure (10 roles, 79 permissions, 4 portals, 51 screens, which roles were tested) and its five "recurring defect classes" are genuinely useful review heuristics. Points where this audit differs or adds:

- It records that `/student/*` is unguarded on the client and asks a tester to check it; this audit confirms it and adds `/trainer/ratings` and `/admin/ratings` (A11).
- Its recommendation to create accounts for untested roles and then use "forgot password" is a workaround for the 1-hour invitation token (B5), not a process to keep.
- It states the last tag is `v9-learner-experience` while `HANDOVER_AR.md` says `v12-production-hardening`; both documents are stale relative to `main` and should be replaced by the two-page current-state guide (B13).
- Its §5.1 (scope written with spread instead of AND) is the single most important security review rule for this codebase and should become an automated test rather than a reminder.
- It does not mention infrastructure at all; the risks in §A1–A9 are outside its scope and were not known to its authors.

---

## J · Recommended roadmap

> **Re-ordered 3 Sep on the owner's instruction.** The site is in testing with no public users, so nothing is urgent *because it touches money or a learner*. Work therefore starts with what the internal team sees on screen; server-dependent capabilities are built ready and wait for the server; everything that needs an owner account or decision is deferred to its own moment.

### Phase A0 — Done on this branch (needed no owner input)
A1 preview-migration fix · A11 learner-portal guards · A10 `/docs` closed in production · A13 pino logging with redaction. All gates re-run green.

### Phase A1 — Team-facing work that needs no new infrastructure (~3–4 weeks)
1. B3 cohort wizard + session generation from the weekly pattern; cohort status automation
2. B3 duplicate-cohort
3. B4 search-and-pick everywhere a UUID is typed
4. D admin IA regroup (5 areas) · B6 `academic_coordinator` role, applicant becomes a state
5. B9 staff task inbox fed by system events
6. B5 invitations (7-day tokens, `invited` state, resend, bulk) · A12 archive/anonymise instead of purge
7. A14 demo accounts for the five unexercised roles, then run the role tour
8. The worker (02 §0) written and tested locally — **runs only on the new server**
9. A9 `STORAGE_SECRET` set explicitly (10 min, before any data move)

### Phase A2 — The hosting move (~2.5 weeks; starts when the Hetzner account exists)
Staging + production on Hetzner running **in parallel** with Vercel on a temporary hostname · verified backups · monitoring · full rehearsal · **cutover only when the owner picks the domain** (doc 04 Phases 1–3). A7 secrets-to-env and test-key rotation land here.

### Phase A3 — What the server unblocks (~4 weeks)
A2 reminders and scheduled work actually running · A6 object storage, uploads fixed · B1 Zoom API, per-learner join links, attendance sync, ICS/webcal · B2 video platform + recording review workflow

### Pre-launch checklist (owner's items, deferred by decision)
A3 connect email · A4 real payment keys and make the silent fallback fail loudly · prices and cohorts · domain and DNS cutover · Sentry alerting reviewed

### Phase B — Quality and consistency (folded into A1/A3 above where dependencies allow)
1. B7 audit coverage test + per-entity timelines
2. B10 locale fixes (8 remaining `ar-SA`/`ar-JO` calls)
3. E.3 one success-feedback pattern; inline validation on the five most-used forms
4. Student nav trim (19 items → ~8 plus a "more" section)
5. E.2 enums for hot status fields; `Restrict` on history cascades; retention jobs for `AuditEvent`/`Notification`
6. B11/B12 split `commerce.service.ts`, `Diagnostic.tsx`, `Home.tsx`, `JoinTrainer.tsx`
7. B13 documentation reset (one architecture page, one runbook, one env reference)

### Phase C — Future
1. B8 Calendly consultations and interview booking (doc 02 §1); Cal.com if Arabic UX demands it
2. Block editor for module authoring emitting the same constrained Markdown
3. B2B group enrolment and corporate reporting
4. Trainer qualification/profile screens (batch 4 in the repo's own plan)
5. Per-user notification preferences; learner deadlines view; trainer cross-cohort calendar
6. Split `commerce.service.ts`, `Diagnostic.tsx`, `Home.tsx`, `JoinTrainer.tsx`
7. CDN for static assets if Gulf latency is measured as a problem; separate DB server only on the triggers in doc 04 §4.5

---

## K · What I would push back on in the brief

- **"Programs, Courses, Sections" as a new structure** — it already exists under different Arabic names. Renaming is a UI decision; re-modelling would be a mistake.
- **"Gmail or relevant email calendar integration"** — read as OAuth write-back this is expensive and fragile; ICS attachments and a webcal feed deliver the outcome (doc 02 §2).
- **"Student watches inside the platform"** for live sessions — for video yes; for Zoom, opening the Zoom app is the better experience and the in-page SDK should not be built (doc 02 §2).
- **Calendly as a given** — right for now, but only behind an interface and only after checking its Arabic booking page (doc 02 §1).
- **"Audit logs — evaluate whether needed"** — they exist and are good; the work is coverage and retention, not design.
- **Hetzner + PostgreSQL as the destination** — agreed, and it is not a database migration at all; the value is the server shape (worker, uploads, staging), and the risk is operational discipline, which doc 04 turns into checklists.
