# 02 · Core Platform Capabilities — evaluation and recommended design

> Status: **design proposal, awaiting owner approval. No code has been changed.**
> Every section answers: what exists today (verified in code), what is missing, the options, and one recommendation with its reasoning. Data-model changes are listed as deltas to `prisma/schema.prisma`, not as a rewrite.
> Companion docs: [01 audit](01-PLATFORM-AUDIT.md) · [03 architecture](03-ARCHITECTURE.md) · [04 migration](04-MIGRATION-PLAN.md)

---

## 0 · The one prerequisite everything else depends on: a background worker

Six of the seven capabilities below need something to happen **when no user is clicking**: send a reminder at T‑24 h, create a Zoom meeting when a session is scheduled, pull attendance after a meeting ends, ingest a recording, publish a module at its scheduled time, retry a failed email.

**Today the platform has no such mechanism.** The schema already carries `scheduledPublishAt`, `nextFollowUpAt`, `nextDueAt`, and a `Notification` table with `status = queued`, `attempts`, `lastError` — the shape of a queue — but nothing drains it. `deploy/README.md` says so plainly: "لا مجدول يعمل".

**Recommendation:** add [pg-boss](https://github.com/timgit/pg-boss) — a job queue that lives inside the existing PostgreSQL database (no Redis, no extra server). Run it in a second container from the same Docker image (`node server/worker.ts`). Jobs are plain functions in `server/jobs/*.ts`. This is a one-to-two-day task and it unblocks everything below. It also works locally with the embedded PostgreSQL.

On Vercel this is not possible without external cron and a separate queue service, which is one of the reasons the hosting move in doc 04 should come first or in parallel.

Initial job list:

| Job | Trigger | What it does |
|---|---|---|
| `notifications.deliver` | every minute | Drains `Notification` rows with `status = queued`, sends email/in-app, sets `sent`/`failed` with backoff |
| `sessions.remind` | every 15 min | For sessions starting in 24 h ± 15 min and 1 h ± 15 min: enqueue learner + trainer reminders (idempotent per session/window) |
| `sessions.zoom.sync` | on session create/update/cancel | Create/update/delete the Zoom meeting; register enrolled learners |
| `zoom.meeting.ended` | webhook | Fetch participants report, write `Attendance`, update actual times |
| `zoom.recording.completed` | webhook | Download recording, push to the video platform, create `Recording` in `pending_review`, notify reviewers |
| `catalog.scheduledPublish` | every 5 min | Publishes items whose `scheduledPublishAt` has passed |
| `cohorts.transition` | hourly | `open → active` on `startsAt`, `active → completed` on `endsAt` |
| `backups.verify.reminder` | monthly | Creates a `StaffTask` for the named backup owner |

---

## 1 · Scheduling: instructor interviews and student consultations (the "Calendly" question)

### What exists
- `TrainerInterview` (`scheduledAt`, `mode`, `interviewerId`, `outcome`) — an admin types a date by hand.
- `CalendarService.trainerInterviewIcs()` produces an `.ics` for the applicant.
- `AdvisorCase` / `AdvisorAssignment` — advisors have assigned learners, but there is **no booking of any kind**; contact happens off-platform.

### Is Calendly the best solution?

| Option | Fit | Cost | Trade-offs |
|---|---|---|---|
| **Calendly** (embedded widget + webhooks) | High for both use cases | ~US$10–16 per seat/month, one seat per person who *receives* bookings (interviewers, advisors); webhooks require Standard plan or above | Mature availability engine, personal Google/Outlook calendar sync, automatic reminders and rescheduling. Booking page runs in Calendly's UI inside our iframe; Arabic/RTL quality of that page must be verified before committing. Data lives outside; we mirror it via webhooks. |
| **Cal.com self-hosted** | High | Free software; ~1 GB RAM and one more database on the Hetzner server | Same feature set including Arabic locale and embed; you own the data. One more system to patch and back up. Reasonable second choice **after** the Hetzner move, not before. |
| **Native booking** (advisor sets weekly slots, learner picks) | Medium | 2–3 developer weeks | Fully inside the platform and fully Arabic. No personal-calendar sync unless the advisor subscribes to an ICS feed. Reinvents reminders and rescheduling. |

**Recommendation: Calendly now, behind a provider interface, mirrored into a local `Appointment` table.** It is the fastest way to give students a real "book a consultation" button and to stop admins hand-typing interview dates. The interface keeps the door open to Cal.com (or native) later with no UI change. **Do not** use Calendly for cohort sessions — those are scheduled by the academy, not booked by learners.

Condition: verify the Arabic booking page with a real Arabic-speaking non-technical user. If the embedded page reads poorly in RTL, switch the recommendation to Cal.com self-hosted (same interface, same data model).

### Recommended design

```
Learner  ──"احجز استشارة"──▶  /student/consultation
                                └─ Calendly inline embed (event type of the assigned advisor,
                                   or a round-robin "استشارة أكاديمية" type)
                                   prefill: name, email · utm_source=wajeez · utm_content=<userId>

Calendly ──webhook invitee.created / invitee.canceled──▶  POST /api/webhooks/scheduling/calendly
                                                              ├─ verify Calendly-Webhook-Signature (HMAC)
                                                              ├─ match by utm_content, fall back to email
                                                              └─ upsert Appointment

Admin    ──"أرسل رابط المقابلة"──▶ one click on /admin/trainers/:id sends the applicant the interview
                                    event link by email; webhook creates TrainerInterview automatically
```

- Bookings **appear inside the platform**: "مواعيدي" card on the student home and in the advisor's case view; the interview shows on the trainer application timeline.
- **Notifications**: Calendly sends its own reminders; we additionally push an in-app notification and log the appointment to the audit trail. Avoid double email reminders — turn off ours for Calendly-sourced appointments.
- **Calendar sync**: handled by Calendly for the host; for the learner, our email includes the `.ics` (already have `buildIcs`).
- **Meeting link**: use Calendly's Zoom integration on the event type so the location is a Zoom link generated per booking — no code needed.

### Data model delta

```prisma
model Appointment {
  id            String   @id @default(uuid()) @db.Uuid
  kind          String   // consultation | trainer_interview
  provider      String   // calendly | calcom | native
  externalId    String?  @unique          // Calendly event URI
  hostUserId    String?  @db.Uuid          // advisor or interviewer
  guestUserId   String?  @db.Uuid          // learner (null for applicants without accounts)
  guestEmail    String
  caseId        String?  @db.Uuid          // AdvisorCase
  applicationId String?  @db.Uuid          // TrainerApplication
  startsAt      DateTime
  endsAt        DateTime
  timezone      String
  joinUrl       String?
  status        String   @default("scheduled") // scheduled | cancelled | completed | no_show
  rescheduleUrl String?
  cancelUrl     String?
  raw           Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([hostUserId, startsAt])
  @@index([guestUserId, startsAt])
}
```

`TrainerInterview` remains and gains `appointmentId String? @unique` so existing screens keep working.

Secrets: `CALENDLY_TOKEN` (personal access token or OAuth app), `CALENDLY_WEBHOOK_SIGNING_KEY` — env or `/admin/integrations`, same pattern as SMTP.

---

## 2 · Zoom live sessions

### What exists
- `CohortSession` (start/end/timezone/status) · `ZoomMeeting` (manual `joinUrl`, `meetingId`, encrypted passcode) · `Attendance` (marked by trainer by hand) · `SessionRescheduleRequest` (trainer proposes, admin approves — good) · ICS per session.
- `ApiZoomProvider` is a **stub that throws**; only the manual provider works. `verifyZoomWebhook()` exists but no webhook route uses it.

### Recommended design

**Auth:** Zoom Server-to-Server OAuth app (account-level; no per-user login). Scopes: `meeting:write:admin`, `meeting:read:admin`, `report:read:admin`, `recording:read:admin`, `user:read:admin`. Credentials in env (`ZOOM_ACCOUNT_ID/CLIENT_ID/CLIENT_SECRET/WEBHOOK_SECRET`) — the provider file already reads these names.

**Host:** one licensed "Academy" Zoom user hosts all meetings. The trainer receives the **start URL** (host) only inside the trainer portal, never by email. If the academy later licenses trainers individually, `ZoomMeeting.hostProfileId` already exists to map them.

**Lifecycle (all via worker jobs, so admin screens never wait on Zoom):**

| Event in Wajeez | Zoom action |
|---|---|
| Session created with a future `startsAt` | `POST /users/{host}/meetings` with: registration required, `approval_type = 0` (auto-approve), `join_before_host = false`, `waiting_room = false`, `mute_upon_entry = true`, `auto_recording = cloud`, `alternative_hosts` empty. Store `meetingId`, `joinUrl`, `startUrl` (encrypted), `passcode` |
| Learner enrolled (or session created for an existing cohort) | `POST /meetings/{id}/registrants` per learner → **unique join URL per learner**, stored in `SessionJoinLink`. This is what makes attendance reliable: Zoom reports participants by registrant email, not by whatever display name they typed |
| Reschedule approved | `PATCH /meetings/{id}`; re-send ICS with the same UID (updates calendars instead of duplicating) |
| Session cancelled | `DELETE /meetings/{id}`; ICS with `METHOD:CANCEL` |

**Student experience — stays inside Wajeez until the last click:**
- Course home shows "الجلسة القادمة" with a countdown and one button **«ادخل الجلسة»**, enabled from 15 minutes before start. It calls `GET /api/learner/sessions/:id/join` which logs the click and redirects to the learner's personal join URL. Zoom then opens in the app or browser.
- Embedding Zoom *inside* our page (Zoom Meeting SDK, component view) is technically possible but heavy (large SDK, licensing, degraded audio/video in-browser, poor mobile). **Not recommended now.** Revisit only if a clear need appears.

**Data synchronisation (what happened in each session):**

| Data | Source | Where stored |
|---|---|---|
| Actual start / end, duration | webhooks `meeting.started`, `meeting.ended` | `ZoomMeeting.actualStartAt / actualEndAt / durationMin` |
| Participants, join/leave times, total minutes | after `meeting.ended`: `GET /past_meetings/{uuid}/participants` (report API, paged) — more reliable than stitching `participant_joined/left` webhooks | `SessionParticipation` rows (raw), then derived `Attendance` (`present` ≥ 50 % of duration, `late` if joined > 10 min after start, else `absent`); trainer can still override with a note |
| Recording ready | webhook `recording.completed` with `download_token` | worker downloads → uploads to the video platform (§3) → `Recording` in `pending_review` |
| Host joined | `participant_joined` where `participant.email = host` | `ZoomMeeting.hostJoinedAt` — lets admins see "trainer was late" |

Webhook endpoint: `POST /api/webhooks/zoom` — validate `x-zm-signature` (already implemented), answer the `endpoint.url_validation` challenge, enqueue a job, return 200 fast.

**Reminders and calendar — the "Gmail integration" answer:**
- Email with an **`.ics` attachment** (`METHOD:REQUEST`, stable UID) on enrolment and on every schedule change. Gmail, Outlook and Apple Calendar all add/update the event automatically. This is what "calendar integration" means for 95 % of users and needs **no OAuth app review**.
- A private, per-user **subscribable calendar feed** `webcal://…/api/calendar/feed/<token>.ics` listing all their sessions. Learners add it once to Google Calendar ("From URL") and every future change flows in. Cheap, robust, no consent screens.
- Full Google Calendar write-back via OAuth is **not recommended**: it requires Google app verification, per-user consent, token refresh handling, and buys nothing over the two mechanisms above.
- Reminder schedule (worker): learners at T‑24 h and T‑1 h (email + in-app); trainer at T‑24 h and T‑1 h (with the start link in-portal, not in email); "recording available" when a recording is published.

**Legal/consent:** attendance and participation data are legitimate academic records; state it in the terms and show a one-line notice on the join button ("تُسجَّل الجلسة ويُحتسب حضورك"). Zoom already shows its own recording disclaimer.

### Data model delta

```prisma
// extend ZoomMeeting
actualStartAt  DateTime?
actualEndAt    DateTime?
durationMin    Int?
hostJoinedAt   DateTime?
startUrlEnc    String?     // host link, encrypted at rest, exposed only to the assigned trainer
participantCount Int?
syncStatus     String @default("pending") // pending | synced | failed
syncError      String?

model SessionJoinLink {          // one per learner per session
  id           String @id @default(uuid()) @db.Uuid
  sessionId    String @db.Uuid
  enrollmentId String @db.Uuid
  registrantId String
  joinUrl      String
  createdAt    DateTime @default(now())
  @@unique([sessionId, enrollmentId])
}

model SessionParticipation {     // raw facts from Zoom; Attendance is the judgement
  id           String @id @default(uuid()) @db.Uuid
  sessionId    String @db.Uuid
  enrollmentId String? @db.Uuid  // null if unmatched (guest / trainer)
  email        String?
  displayName  String
  joinedAt     DateTime
  leftAt       DateTime?
  minutes      Int
  @@index([sessionId])
}

// extend Attendance
source  String @default("manual") // manual | zoom
```

---

## 3 · Recorded video management

### What exists
- Module video = a **YouTube or Vimeo URL** with chapter timestamps, embedded in an iframe (`src/components/ModuleVideo.tsx`, `module-video.ts`). Access control is whatever YouTube "unlisted" gives you (none: anyone with the link). Watch progress is not measurable.
- `Recording` model exists (`storageKey`, `mime`, `sizeBytes`) but the upload path for cohort materials/recordings is documented as **broken** ("معطّل"), and the only working file store is `Bytes` columns in PostgreSQL with a 4 MB cap — impossible for video.
- Module authoring has a clean **maker-checker** flow (`draft → in_review → published` + final approval, reviewer ≠ author). Recordings have no such flow.

### Video delivery architecture — options

| Option | Security | Cost (200 h library, ~1 000 views/month) | Ops | Quality / reach | Verdict |
|---|---|---|---|---|---|
| YouTube unlisted / Vimeo (current) | Weak: link = access; downloadable via tools; Vimeo privacy controls need Pro+ | Free / Vimeo Pro ~€20/mo | none | Good, global | Keep **only** for public marketing/free content |
| **Bunny Stream** | Token-authenticated embeds (per-view signed URL with expiry), referrer allow-list, optional DRM tier | Storage ~US$0.01/GB/mo → ~US$5; delivery ~US$0.005/GB → ~US$5–10 | none (managed transcoding to HLS) | PoPs in the Gulf; Player.js API gives `timeupdate` → we can record watch progress | **Recommended** |
| Cloudflare Stream | Signed URLs, domain allow-list | US$5 per 1 000 min stored + US$1 per 1 000 min delivered → ~US$60 + ~US$10/mo | none | Excellent, simplest API | Runner-up (cleaner API, ~5× the cost at this scale) |
| Mux | Signed playback, great analytics | Higher (per-minute encode + storage + delivery) | none | Excellent | Over-budget for the need |
| Self-hosted on Hetzner (ffmpeg → HLS → Object Storage → Caddy/CDN) | Fully in our hands; signed URLs we generate | Object storage ~€5/mo + bandwidth | **High**: build and babysit a transcoding pipeline, CDN for Gulf latency, player, DRM none | Depends on the CDN you add | Not worth building; revisit only if a data-residency rule forbids third-party video hosts |

**Recommendation: Bunny Stream as the video platform**, via a `VideoProvider` interface so Cloudflare Stream can replace it if needed. Learners watch **inside the Wajeez page** in an iframe from the provider, with a short-lived signed token minted by our server per view — a leaked page URL is useless to outsiders. Keep the YouTube/Vimeo whitelist for free public content only.

### Workflow (improved over the one in the brief)

```
Source ──▶ Ingest ──▶ pending_review ──▶ approved ──▶ published (visible to the right learners)
                                     └──▶ rejected (reason, back to instructor)
Any published recording can be ──▶ archived (hidden, kept for records)
```

Sources: **A.** Zoom cloud recording, automatic (§2) · **B.** instructor uploads a file from the trainer portal (direct browser → Bunny via resumable TUS upload, never through our server; our server only creates the video entry and signs the upload) · **C.** external link (YouTube/Vimeo) for public content, no review needed for `visibility = public` if the trainer has `catalog.course.edit`; otherwise same review.

Improvements to the brief's flow:
1. **Reviewer ≠ uploader**, exactly like module authoring. An academic manager who also teaches cannot approve their own recording.
2. **Approve ≠ publish.** Approval is a quality decision; publishing is a visibility decision with a target: this cohort (default), the whole course (evergreen), or attached to a module version (becomes *the* module video). Approve-and-publish is one click when the target is the default.
3. **Auto-suggested title and target**: a Zoom recording arrives already linked to its session, cohort, course and module — the reviewer only confirms.
4. **Rejection needs a reason** the instructor sees; re-upload keeps the same entry (versioned), so the cohort never sees two copies.
5. **Availability window** (`availableFrom/Until`) optional, defaults open.
6. **Watch progress** recorded from the player (Player.js events) into `RecordingView` — first time the platform can say "شاهد ٧٠٪" honestly (today `ModuleVideo.tsx` explicitly disclaims it).

Who reviews: anyone with the new `material.review` permission (academic manager, academic coordinator). Trainers see status and reason in their portal. Reviews and publications are audit-logged.

### Data model delta

```prisma
// Recording — evolve, don't replace
source          String  @default("upload")        // zoom_cloud | upload | external
provider        String? // bunny | cloudflare | youtube | vimeo
providerVideoId String? @unique
storageKey      String? @unique                   // was required; now optional
status          String  @default("pending_review") // uploading | processing | pending_review | approved | published | rejected | archived
visibility      String  @default("cohort")         // cohort | course | module | public
courseId        String?
moduleVersionId String? @db.Uuid
reviewedBy      String? @db.Uuid
reviewedAt      DateTime?
rejectReasonAr  String?
publishedAt     DateTime?
availableFrom   DateTime?
availableUntil  DateTime?
sessionId       String? @db.Uuid                   // was required; uploads may not belong to a live session

model RecordingView {
  recordingId   String @db.Uuid
  userId        String @db.Uuid
  watchedSec    Int    @default(0)
  lastPosSec    Int    @default(0)
  completedAt   DateTime?
  updatedAt     DateTime @updatedAt
  @@id([recordingId, userId])
}
```

---

## 4 · Programs, courses and sections — the academic model

### What exists (and it is closer to right than the brief assumes)

```
Pathway (مسار)  ──────────────  a curated sequence of Courses for an audience/domain; drives the diagnostic
   └── Course (دورة)  ─────────  the central entity; versioned modules with body/checks/video/scenario/practice/rubric
          └── Cohort (شعبة)  ──  a run of a course: dates, weekly days + start time + timezone, capacity,
                 │               price, trainers (CohortTrainer), enrollments, materials, assessments, completion rules
                 ├── CohortSession (جلسة) ── ZoomMeeting · Recording[] · Attendance[] · reschedule requests
                 └── Enrollment ── ModuleProgress · submissions · certificate

LearnerPlan / EnrollmentRequest / Order  ── how a learner gets into a cohort
```

Mapping to the brief's vocabulary: **Program = Pathway**, **Section/Cohort/Student group = Cohort**, **Schedule = Cohort weekly pattern + CohortSession rows**, **Live sessions = CohortSession + ZoomMeeting**, **Recorded sessions = Recording**, **Learning content = CourseModuleVersion + LearningMaterial**.

**Recommendation: do not introduce a new "Program" entity.** The Pathway *is* the program, and the diagnostic engine, catalog importer, publishing gates, and 20+ audit scripts are built around it. Adding a parallel hierarchy would double the admin's vocabulary and every gate. What the brief actually needs is consistency and automation, not a new table.

### What is wrong or missing — and the fix

| Gap | Evidence | Fix |
|---|---|---|
| **Two sources of truth for the schedule**: `Cohort.daysOfWeek/startTime/timezone` and the `CohortSession` rows | `schema.prisma` `model Cohort`, `model CohortSession` | Treat sessions as the truth. Add a "generate sessions from the weekly pattern" step in the cohort wizard (preview, then create). The pattern fields become a *template*, never read by learners |
| `CohortSession.endsAt` nullable | schema | Make required; default `startsAt + Cohort.sessionDurationMin` (new field, default 90) |
| No `Cohort.status` automation | status is set by hand | Worker job: `open → active` at `startsAt`, `active → completed` at `endsAt`; admin can override |
| Vocabulary drift in UI (مسار/برنامج, شعبة/كوهورت/مجموعة, جلسة/لقاء/محاضرة) | frontend strings (see 01 §UX) | One glossary, enforced by a test: **مسار · دورة · شعبة · جلسة · وحدة · مادة · تسجيل** |
| Creating a cohort is a form dump of ~15 fields | `/admin/cohorts` | **Wizard in 5 steps**: (1) which course → (2) dates + weekly pattern → preview of generated sessions → (3) trainer(s) → (4) capacity + price (prefilled from course list price) → (5) review & open. Zoom meetings and calendar invites happen automatically after step 5 |
| Enrolling a student manually requires knowing IDs | admin learners screen | "Add learner to cohort" by email search; CSV bulk add for corporate groups |
| No per-cohort "what's next" for the admin | — | Cohort page header shows the next action: *needs trainer · needs 3 more learners to open · session in 2 days without a recording · 4 assignments to grade* |

No new tables are needed for this section beyond `Cohort.sessionDurationMin`. The rest is UX and automation.

---

## 5 · Learning content management

### What exists
- A real editorial system for **module content**: constrained Markdown body, checks, video, scenario, practice, rubric; a single draft per module copied from the published version; `draft → in_review → published` with a separate final approval; per-version history; live preview with the learner's own renderer; format errors shown while typing (`/admin/authoring`). This is good and should be kept.
- **Cohort materials** (`LearningMaterial`: file or link) — file upload is broken in production because files cannot be stored on Vercel and the 4 MB database path only serves applicant documents.

### Gaps and recommendations

| Need from the brief | Status | Recommendation |
|---|---|---|
| Create / edit / replace content | ✅ modules · ❌ materials (upload broken) | Materials to **Hetzner Object Storage** through the existing signed-URL pattern in `storage.service.ts` (the `S3_*` env and MinIO dev setup already exist). Browser uploads directly to a pre-signed URL; server never proxies bytes |
| Organise content | ✅ module order in course · ❌ materials are a flat list | Add `LearningMaterial.moduleId` grouping in the UI (field exists) and drag-to-reorder (`sortOrder` new field) |
| Publishing status | ✅ modules · ⚠️ materials have `active/archived/disabled` but no draft | Add `draft` to materials; default visible on publish |
| Scheduled availability | ⚠️ `scheduledPublishAt` written, never executed | Worker job (§0). Add `availableFrom` to `LearningMaterial` and per-cohort module release dates (`CohortModuleRelease {cohortId, moduleId, availableFrom}`) for drip release |
| Access permissions | ✅ cohort-scoped materials · ✅ RBAC | Add `visibility` (`cohort | course | public`) as with recordings |
| Easy editing for non-technical staff | ⚠️ Markdown with preview | Good enough for the current staff; for the next cohort of academic writers add a block editor (Tiptap) that **emits the same constrained Markdown**, so the server validators and the learner renderer stay unchanged. Not urgent |
| Replace a file without breaking links | ❌ | Versioned `storageKey`; the material `id` stays stable |
| Templates | ❌ | "Duplicate cohort" (copies sessions pattern, materials, trainers, not learners) — removes the biggest repetitive task each term |

---

## 6 · Users, roles, invitations and account lifecycle

### What exists (stronger than the brief assumes)
- **Fine-grained RBAC**: 79 permissions, 10 roles as bundles, per-user grant/deny overrides with a mandatory reason, rank-based delegation (nobody manages a peer or superior), sessions invalidated on permission change, everything audit-logged. Enforcement is per route on the server. This is a well-designed core.
- **Staff invitation exists**: `POST /api/admin/users` creates the account with a random password and emails a set-password link (`sendStaffInviteEmail`).
- **Suspend / reinstate** exist and revoke sessions immediately. **Purge** (hard delete) exists as a separate permission.
- **Trainer onboarding**: application → review/interview → decision → `trainer.invite` → account.

### Problems found

| Problem | Evidence | Impact |
|---|---|---|
| Invitation link is a **password-reset token valid for 1 hour** | `sendStaffInviteEmail`: "الرابط صالحٌ لساعة واحدة" | Most invitees open email later than an hour; they land on an expired link and must guess to use "forgot password". Invitations should live 7 days and be resendable |
| No `invited` state on `User.status` (`active | suspended` only) | schema | Admin cannot see who has never activated; no "resend invitation" button |
| No `archived` state; the only alternative to suspension is **hard delete** | `admin.users.purge` | Deleting a learner with orders/enrollments either fails on foreign keys or destroys history. The owner's stated policy ("إمّا إزالةٌ كاملة وإمّا إيقاف") needs a third option |
| Five of ten roles have no demo account and were never exercised end to end | `docs/ROLE_AUDIT_TOUR_AR.md` §4 | Unknown breakage in operations/diagnostic/finance/support screens |
| `trainer_applicant` is a role but behaves as an account state | `permissions.ts` | Appears in role pickers; confusing for admins |
| Bulk operations absent | — | Adding 30 corporate learners = 30 forms |

### Recommended role architecture

Keep the permission system; adjust the bundles. Principle: **a role exists only if a real person holds it**; everything else is a permission override with a reason.

| Role | Rank | One-line job description (this text should appear in the UI) | Change |
|---|---|---|---|
| `super_admin` مدير النظام | 100 | Everything, including secrets, purge, roles | keep |
| `academic_manager` المدير الأكاديمي | 80 | Owns the catalog and quality: approves/publishes courses, modules, recordings; qualifies and assigns trainers | keep |
| **`academic_coordinator` المنسّق الأكاديمي** | 60 | Runs the term: creates cohorts and sessions, enrolls learners, uploads materials, reviews materials/recordings, handles reschedules and support escalations. **No** publish/approve of catalog | **new** — replaces `operations_manager`, whose 11 permissions are this job |
| `finance` المالية | 70 | Payments, refunds, trainer compensation, finance reports | keep |
| `diagnostic_manager` مدير التشخيص | 70 | Diagnostic questions, scoring, simulator | keep (specialised, low-frequency) |
| `support` الدعم | 60 | Tickets | keep |
| `advisor` المستشار | 40 | Assigned learners, consultations, discount requests | keep |
| `trainer` المدرّب | 30 | Own cohorts: sessions, attendance, grading, materials, recordings (submit), messages | keep; add `material.submit`, `recording.submit` |
| `learner` المتعلّم | 10 | Learn | keep |
| `content_editor` محرّر المحتوى | 50 | Writes module drafts and materials, cannot publish | **add only when a dedicated writer is hired**; until then grant `catalog.course.edit` by override |
| `trainer_applicant` | — | — | **convert to `TrainerApplication.status`** and drop the role from pickers (keep permission `trainer.application.own` attached to the applicant account state) |

New permissions: `material.review` (approve/reject materials and recordings), `material.submit`, `recording.submit`, `appointments.manage`.

### Invitation workflow (target)

```
Admin: /admin/users → «دعوة مستخدم» → email + name + role (+ optional cohort for learners)
   → User created with status = invited, no password
   → Invitation token, 7-day expiry, single use (new model or PasswordResetToken with purpose = invite)
   → Email: who invited you, your role in plain words, what you can do, one button «فعّل حسابك»
Invitee: sets password → emailVerifiedAt = now (the link proves the mailbox) → status = active → lands on their portal
Admin sees: "invited 3 days ago · not activated" with «أعد الإرسال» and «ألغِ الدعوة»
Bulk: CSV of emails + role + cohort → preview → send
```

### Account lifecycle (target)

| State | Meaning | Reversible | Login | Data |
|---|---|---|---|---|
| `invited` | Created, never activated | yes (resend/cancel) | no | none |
| `active` | Normal | — | yes | full |
| `suspended` | Temporarily blocked (dispute, non-payment, investigation) | yes (`reinstate`) | no, sessions revoked | full |
| `archived` | Left the academy; history preserved | yes (rare) | no | full, hidden from lists by default |
| `anonymised` | Erasure request honoured | **no** | no | PII replaced (`deleted-<id>@…`, name «مستخدم محذوف»), orders/enrollments/attendance/certificates kept as records |

Hard delete (`purge`) should be allowed **only** for accounts with no orders, enrollments, or authored content — enforce in the service. Role changes remain as today (rank-checked, audited, sessions revoked).

---

## 7 · Audit log

### What exists
`AuditEvent` with actor, action, entity, `before/after`, reason, IP; written by services via `recordAudit`; read-only screen `/admin/audit` behind `audit.view`; indexed by entity and actor. **This is the right design already.** The brief's requirement ("who, what, when") is met for the actions that are logged.

### What to add (small)

| Item | Why |
|---|---|
| **Coverage checklist** enforced by a test: login success/failure, logout, password reset, role change, permission override, suspend/reinstate/archive/anonymise, invitation sent/accepted, enrollment add/remove/transfer, cohort schedule change, session reschedule decision, recording approve/reject/publish, material publish, integration secret change, purge | Today's coverage is by convention; a missing `recordAudit` call is invisible |
| **Per-entity timeline tab** on the user, cohort and course screens | Admins look for history where they work, not in a global log |
| **Retention & export**: keep 24 months hot; monthly job archives older rows as CSV to Object Storage; CSV export from the screen | The table grows without bound; auditors ask for exports |
| **Immutability**: no update/delete routes on `AuditEvent` (verify), database role for the app has no `DELETE` on the table | An audit log you can edit is not one |

Do not build alerting or SIEM integration; the platform's size does not justify it.

---

## 8 · Notifications and email (cross-cutting)

- `Notification` (queued/sent/failed/read, per-audience) and `NotificationTemplate` exist. The missing piece is the worker (§0) and a **connected SMTP provider** — as of 31 Aug the production platform sent **no email at all**, which blocks invitations, password reset, verification, reminders, certificates. Connecting Resend or Postmark with SPF/DKIM/DMARC on the sending domain is the single highest-leverage operational task and needs no code.
- Add a **per-user notification preference** (email on/off per category) only after the first complaints; default everything on except marketing.

---

## 9 · Simplicity principles applied (what the user should feel)

| Principle | Concrete application |
|---|---|
| The system knows what's next | Every portal home starts with one card: **«التالي»** — the next session with a join button, the assignment due, the recording to review, the cohort waiting for a trainer |
| No re-typing | Cohort wizard prefills price from the course, duration from the pattern, trainer from the last cohort of the same course; Zoom recordings arrive pre-linked |
| One word per thing | Glossary test (مسار · دورة · شعبة · جلسة · وحدة · مادة · تسجيل) |
| Humans approve, machines do the rest | Approve a reschedule → Zoom updated, calendar invites re-sent, learners notified. Approve a recording → published to the cohort, learners notified |
| Nothing silently fails | Every automated action leaves a row (job status, notification status, audit event) and the admin sees failures as a task, not in a log file |
| Reversible by default | Archive instead of delete; unpublish instead of remove; suspend instead of purge |

---

## 10 · Order of work (feeds the roadmap in 01)

1. Worker + connected email (unblocks everything) — 1 week
2. Invitations with 7-day tokens, `invited/archived` states, resend — 3 days
3. Cohort wizard with session generation + status automation — 1 week
4. Zoom API provider, registrants, webhooks, attendance sync, reminders, ICS feed — 2 weeks
5. Object Storage for materials; fix uploads — 3 days
6. Video platform + recording review workflow + auto-ingest from Zoom — 2 weeks
7. Calendly provider + `Appointment` + consultations and interview booking — 1 week
8. Role adjustments (`academic_coordinator`, applicant state, `material.review`) — 3 days
9. Audit coverage test, entity timelines, export — 3 days
