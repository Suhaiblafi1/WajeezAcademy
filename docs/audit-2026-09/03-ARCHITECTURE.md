# 03 · Recommended Architecture

> ⚠️ **سجلٌّ مؤرَّخٌ — لا يوصف الواقعَ الحاليّ.**
> كُتبت هذه الوثيقةُ حين كان الإنتاجُ على **Vercel** والنطاقُ المقصودُ
> `academy.wajeez.com`. والمنصّةُ اليوم على **Cloudways** والنطاقُ
> `www.wajeezacademy.com`، والـAPI عمليّةُ Node على الخادم نفسِه.
> **المرجعُ للواقع الحاليّ: [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md).**
> وما دون ذلك يُقرأ سجلَّ قرارٍ لا تعليماتِ تنفيذ.

> Status: **proposal, awaiting owner approval.**
> Principle: technically sophisticated inside, radically simple outside. Every choice below is the simplest option that is reliable at 10× today's usage. Where the current code already makes the right choice, this document says "keep".
> Companion docs: [01 audit](01-PLATFORM-AUDIT.md) · [02 capabilities](02-CAPABILITIES-DESIGN.md) · [04 migration](04-MIGRATION-PLAN.md)

---

## 1 · One picture

```
                         Internet
                            │
              ┌─────────────┴──────────────┐
              │  Caddy (TLS, headers, gzip) │  :443
              │  static SPA  ·  /api → app  │
              └─────────────┬──────────────┘
                            │ docker network
      ┌──────────────┬──────┴───────┬──────────────────┐
      │  app         │  worker      │  db              │
      │  Fastify API │  pg-boss     │  PostgreSQL 16/17│
      │  (Node 22)   │  jobs        │  named volume    │
      └──────┬───────┴──────┬───────┴────────┬─────────┘
             │              │                │  nightly pg_dump ──▶ Storage Box / Object Storage (rclone)
             │              │                └─ daily server snapshot (Hetzner Backups)
             ▼              ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ External services (all behind provider interfaces)          │
   │  Stripe/Moyasar · SMTP (Resend/Postmark) · Zoom S2S OAuth   │
   │  Bunny Stream (video) · Calendly (booking)                  │
   │  Hetzner Object Storage (materials, documents, exports)     │
   │  Sentry (errors) · Uptime Kuma (uptime) · Healthchecks.io   │
   └─────────────────────────────────────────────────────────────┘

   Staging: identical stack on a small second server, anonymised data.
```

Two Hetzner Cloud servers, one Docker Compose file, no Kubernetes, no message broker, no separate database host. Details and sizing in [04 §3](04-MIGRATION-PLAN.md#3--target-architecture-on-hetzner).

---

## 2 · Application architecture

### 2.1 Keep

| Decision | Why it is right |
|---|---|
| **Single TypeScript codebase**: React/Vite SPA in `src/`, Fastify API in `server/`, shared domain code in `src/domain` and `src/application` | One language, one test runner, shared validators (the module editor already reuses the server's parsers). Do not split into microservices |
| **Fastify + zod + OpenAPI** | Fast, typed, schema-first; `/docs` is a free API reference for developers (close it to the public) |
| **Prisma 7 with the `pg` adapter** | Already on PostgreSQL; migrations are versioned; 139 models each have a migration (verified by `ci:migrations`) |
| **Server-side sessions in the database** (`Session.tokenHash`) | Revocable per device, survive a hosting move, no JWT footguns. Keep |
| **Permission-based RBAC with per-user overrides and rank-limited delegation** | Better than most commercial LMSs; keep the model, adjust the bundles (02 §6) |
| **Deterministic diagnostic engine, snapshot-published catalog** | A product differentiator with real regression gates; keep untouched |
| **Maker-checker on content** | Extend to recordings and materials rather than inventing a new flow |
| **CI gates that fail loudly** (types, lint-baseline, 861 browser tests, catalog gates, a11y, migrations, bundle) | All green on this branch as of this audit. Keep; add the server suite to the required checks |

### 2.2 Change

| Decision | From | To | Why |
|---|---|---|---|
| **Runtime shape** | Whole API as one Vercel function + hand-bundled `api/index.js` committed to git | Long-running Node process in Docker (`server/index.ts`), image built in CI, no committed bundle | Removes cold starts, the 13 MB artefact, the 4 MB upload cap, the 30 s limit, and the class of "stale bundle" outages the `ci:bundle` gate exists to catch |
| **Background work** | None | `worker` container running pg-boss jobs (02 §0) | Reminders, Zoom sync, scheduled publish, email retry |
| **File storage** | `Bytes` columns in PostgreSQL (4 MB cap), broken material uploads | Object Storage (S3 API) with pre-signed upload/download URLs; the `storage.service.ts` signing pattern stays, the byte store moves | Videos and materials cannot live in the database; the database backup should not carry binary blobs |
| **Video** | YouTube/Vimeo iframe | Managed video platform with signed embeds (02 §3), YouTube/Vimeo only for public content | Access control and watch-progress |
| **Integrations config** | Env **or** plaintext JSON in `IntegrationSetting` | Env for secrets on the server; `IntegrationSetting` keeps non-secret toggles and masked display; encrypt at rest any secret that must live in the DB (`DECISIONS_PENDING_AR.md` §6 already flags this) | Secrets in a database dump are a liability; a server `.env` with `chmod 600` and a vault is simpler |
| **Environment split** | Production only; previews share the production DB | dev → staging → production, each with its own DB | Structural fix for the migration-on-preview risk |
| **Error visibility** | Console logs in Vercel | Sentry (server + browser) with PII scrubbing, structured pino logs with rotation | You cannot fix what you cannot see |
| **Maintenance mode** | None | `MAINTENANCE_MODE` env → 503 on writes + banner | Needed for clean cutovers and emergency freezes |
| **Server code compiled** | `tsx` interprets TypeScript at runtime in production | `tsc`/esbuild to `dist/server` in the Dockerfile | Faster boot, smaller image, fails at build not at first request |

### 2.3 Module boundaries (target, mostly already true)

```
server/
  http/routes/*        thin: parse (zod) → authorise → call service → shape response
  services/*           business rules; one file per aggregate (cohort, enrollment, recording…)
  jobs/*               worker handlers; call the same services
  integrations/        provider interfaces + adapters
    payments/          Stripe · Moyasar · test           (exists)
    mail/              SMTP                              (exists)
    zoom/              manual · api                      (interface exists, api to implement)
    video/             bunny · cloudflare · external     (new)
    scheduling/        calendly · calcom · native        (new)
    storage/           s3 · db-bytes(legacy)             (evolve)
  auth/                permissions, rank, delegation     (exists)
```

Rule: routes never import a provider directly; services never import `process.env` directly (a `config.ts` does). This keeps every integration swappable and testable.

---

## 3 · Database architecture

- **Engine**: PostgreSQL 16 or 17 (match Neon's major at dump time), single primary, in Docker with a named volume on the production server. No replica until the triggers in 04 §4.5 fire.
- **Schema**: keep the current Prisma schema; apply the deltas from 02 (Appointment, SessionJoinLink, SessionParticipation, Recording evolution, RecordingView, CohortModuleRelease, User states, invitation tokens). Findings on integrity, indexes and JSON usage are in 01 §E; fix them incrementally, never in one big rewrite.
- **Connection pooling**: raise `DB_POOL_MAX` to ~20 for the app and ~5 for the worker; no PgBouncer needed at this scale.
- **Backups**: nightly logical dump off-server with monthly verified restore (the existing `backup.sh`), daily server snapshots, pre-deploy dump. RPO 24 h (acceptable now; add WAL archiving with `pgBackRest` if RPO must drop to minutes).
- **Growth tables**: `AuditEvent`, `Notification`, `AnalyticsEvent`-style tables get a retention job (archive to Object Storage as CSV after 24 months / 90 days respectively).
- **Locale**: `--encoding=UTF8 --locale=C` as in `compose.prod.yml`, with `COLLATE "ar-x-icu"` only on columns that are sorted for display — verify current sorting behaviour on Neon before choosing.

---

## 4 · Hosting architecture

Summarised from 04 §3:

| Layer | Choice | Alternative considered | Why not |
|---|---|---|---|
| Provider | Hetzner Cloud (fsn1/nbg1) | Hetzner dedicated | Overkill; cloud servers resize in minutes |
| Compute | 1 × CPX31 prod + 1 × CX22 staging | Separate DB server | Adds a machine to patch and replicate for no current benefit |
| Orchestration | Docker Compose (existing) | Kubernetes / Coolify / Dokku | Complexity or another moving part for one team |
| Edge | Caddy (existing) | nginx + certbot | Manual certificate renewal is the classic silent failure |
| Object storage | Hetzner Object Storage | Backblaze B2, AWS S3 | Same S3 API; keeping one vendor and one invoice |
| CDN | None now; Cloudflare/Bunny for `/assets/*` if Gulf latency becomes an issue | — | API must stay direct (Stripe raw body) |
| Deploy | GitHub Actions → SSH → `deploy.sh` (staging automatic, production approved) | Watchtower, ArgoCD | Existing script already does the right ordering |
| Secrets | `.env` on server (600), vault for humans | Vault server, SOPS | Ceremony without benefit at this size |

---

## 5 · Integration architecture

| Integration | Pattern | Direction | Failure behaviour |
|---|---|---|---|
| **Stripe / Moyasar** | Hosted checkout + signed webhook + idempotency table (exists) | out: create session · in: webhook | Webhook retried by Stripe for 3 days; order stays `pending` until settled; admin sees pending orders |
| **Email** | SMTP via nodemailer, queued in `Notification`, drained by worker | out | Retries with backoff; failures visible in `/admin/notifications` |
| **Zoom** | S2S OAuth; worker creates/updates meetings; webhooks enqueue jobs; report API for attendance | both | Meeting creation failure → session shows "رابط قيد الإنشاء" and a staff task; attendance sync failure → retried, trainer can mark manually |
| **Video (Bunny)** | Direct browser upload (TUS) to provider; server signs per-view tokens; webhook/poll for "processed" | both | If token minting fails, player shows a retry; no video bytes ever cross our server |
| **Calendly** | Embedded widget with prefill; signed webhooks mirror bookings into `Appointment` | in | Missed webhook → nightly reconciliation job lists scheduled events via API |
| **Calendar for humans** | ICS attachments + per-user webcal feed | out | Stateless; nothing to fail |
| **Object Storage** | Pre-signed PUT/GET URLs; server never proxies bytes | both | Signed URL expiry 15 min; keys namespaced per entity |

Every integration lives behind an interface with a `manual`/`test` implementation so the platform runs fully without any external account (as it does today for Zoom and payments). This is a strength of the current code; keep it as a rule.

---

## 6 · Video architecture (decision record)

**Decision:** managed video platform with signed embeds (Bunny Stream first choice, Cloudflare Stream second), learner watches inside the Wajeez page, provider-agnostic `VideoProvider` interface, YouTube/Vimeo retained for public content only.

**Rejected:** self-hosting HLS on Hetzner (transcoding pipeline + CDN + player + no DRM = weeks of work and permanent ops burden for a cost saving measured in tens of euros); Zoom cloud as the long-term store (30-day-ish retention, poor player, no access control tied to enrollment); keeping YouTube unlisted for paid content (no real access control, no progress data).

**Consequences:** a new monthly line item (tens of US dollars), a `Recording` review workflow (02 §3), and the first honest "watched" signal in learner progress.

---

## 7 · Security architecture (summary; findings in 01 §A)

- TLS everywhere via Caddy; HSTS; CSP with hashes (align Caddy with `vercel.json`).
- Sessions: httpOnly, secure, SameSite=Lax cookies mapped to DB rows; revoke on suspend/role change (exists).
- Passwords: bcrypt (exists); add rate limiting per IP+email on login and reset (verify current `LoginAttempt` usage).
- Secrets: never in git (existing rule), env on server, encrypt-at-rest for any DB-stored secret.
- Webhooks: signature verification for Stripe (exists), Zoom (helper exists), Calendly (new).
- Least privilege in the database: app role without `DROP`/`DELETE` on audit tables.
- Uploads: pre-signed, MIME/size validated server-side before signing, virus scan not required for the current file types (documents, video) but worth a ClamAV container if arbitrary files are ever accepted.
- Public surface: close `/docs`, disable demo routes in production (gated by `DEMO_MODE`, verify unset), rate-limit public POSTs (leads, applications).

---

## 8 · What we deliberately do not build

| Not building | Because |
|---|---|
| Custom video player or streaming stack | Buy it (§6) |
| Native booking engine (now) | Calendly behind an interface covers it; revisit with usage data |
| Google/Microsoft calendar OAuth write-back | ICS + webcal feed give 95 % of the value with 5 % of the effort and no app review |
| Zoom in-page SDK | Heavy, licensed, worse experience than the Zoom app |
| Microservices, Kubernetes, Redis, message broker | One team, one server, PostgreSQL does the queue |
| Multi-region | Audience is regional; a CDN for assets is the right lever if latency is felt |
| Real-time chat | `CohortMessage` (logged announcements/messages) matches the "recorded, not chat" decision already made by the owner |
| LLM in the diagnostic | Owner's standing rule; the engine's determinism is a feature |
