# 04 · Infrastructure Migration Plan — Vercel + Neon → Hetzner + self-hosted PostgreSQL

> Status: **proposal, awaiting owner approval. Nothing in this document has been executed.**
> Scope: how to move Wajeez Academy off Vercel/Neon onto Hetzner with zero data loss and a rollback path, while the current production stays online throughout.
> Companion docs: [01 audit](01-PLATFORM-AUDIT.md) · [02 capabilities](02-CAPABILITIES-DESIGN.md) · [03 architecture](03-ARCHITECTURE.md)

---

## 0 · Executive summary

| Question | Answer |
|---|---|
| Where does production run today? | **Vercel**: static Vite build + a single serverless function (`api/index.js`, 13 MB, committed to git). Database: **Neon** serverless PostgreSQL. Domain: the `*.vercel.app` project URL; `academy.wajeez.com` is reserved but not yet pointed. |
| Is PostgreSQL a good target? | Yes, and it is not a migration of engine at all: the platform is **already PostgreSQL** (Prisma 7 + `pg` adapter, 53 migrations). Moving to Hetzner is a **hosting move**, not a database re-platform. Schema changes are not required for the move itself. |
| Is Hetzner a good target? | Yes, with two caveats: (1) no Middle-East region, so pick Falkenstein/Nuremberg and put a CDN in front of static assets later if latency matters; (2) you take on operations (patching, backups, monitoring) that Vercel/Neon did for you. The repo's `deploy/` folder already contains a complete single-server Docker + Caddy design that was built for exactly this and has never been used in production. |
| Biggest risks | Not the move itself. The real risks are three pre-existing conditions that the move exposes: **no background job runner**, **no staging environment**, and **Vercel preview builds running database migrations against the production Neon database**. All three should be fixed before or during the move. |
| Estimated effort | About 2–3 working weeks of one developer including staging, rehearsal, and cutover. Monthly hosting cost after move: roughly €30–45 for production + staging + backups + object storage, versus Vercel Pro + Neon paid tiers. |
| Downtime | One planned maintenance window of 30–60 minutes for the final data sync and DNS switch. Users stay logged in (sessions are database rows, not signed cookies). |

---

## 1 · Current infrastructure — as verified from the repository

### 1.1 Hosting and runtime

| Component | Today | Evidence |
|---|---|---|
| Frontend | Vite static build served by Vercel CDN; SPA rewrite to `index.html` | `vercel.json` rewrites; `scripts/vercel-build.sh` |
| API | Entire Fastify app wrapped as **one** Vercel Node function, 30 s max duration, 1 GB memory | `server/http/vercel-handler.ts`; `vercel.json` `functions` |
| API bundle | `api/index.js` is an **esbuild output committed to git** (13 MB). It must be rebuilt by hand before every push; a CI gate (`ci:bundle`) exists because it went stale twice and left routes dead in production | `scripts/bundle-api.mjs` header comment; `.github/workflows/ci.yml` |
| Bundle content | The serverless bundle imports `embedded-postgres` (a full local PostgreSQL launcher) even though it is never used on Vercel | first line of `api/index.js` |
| Database | Neon serverless PostgreSQL; connection via `DATABASE_URL`; pool max 5 per warm instance to avoid exhausting Neon's connection limit | `server/db/client.ts`; `vercel-handler.ts` comments |
| Migrations | `prisma migrate deploy` runs **inside the Vercel build**, with a 4-attempt retry because production and preview builds race for the advisory lock on the **same database** | `scripts/vercel-build.sh` lines 1–25 |
| Catalog | On production builds only: `catalog:import` then `catalog:publish` write to the live DB during the build | `scripts/vercel-build.sh` |
| Sessions | Server-side rows (`Session.tokenHash`), 30-day TTL | `prisma/schema.prisma` `model Session` |
| File storage | Applicant documents stored as `Bytes` **inside PostgreSQL**, 4 MB cap (Vercel body limit). No S3 in production. `storage/private/` on disk is dev-only. MinIO is wired for local dev only | `server/services/storage.service.ts`; `docs/PLATFORM_UX_PRODUCT_TASKS_AR.md` §1ب |
| Signed-URL secret | Derived from `DATABASE_URL` when `STORAGE_SECRET` is unset. **Changing the database URL therefore silently rotates the signing key** | `storage.service.ts` `secret()` |
| Email | SMTP via nodemailer; configured through env or `/admin/integrations`. As of 31 Aug the channel was **not connected** in production | `.env.example`; `docs/HANDOVER_2026-08-31.md` |
| Payments | Stripe or Moyasar via `PAYMENT_*` env or DB settings; webhook at `/api/webhooks/payments/stripe`. Docs disagree on whether live keys are set ("driver: test" on 31 Aug vs "payments live" in `DECISIONS_PENDING_AR.md`) — **must be verified in the Vercel dashboard before cutover** | `docs/CONNECT_AR.md`; `docs/DECISIONS_PENDING_AR.md` §6 |
| Zoom | Manual provider only (admin pastes a join link). API provider is a stub that throws | `server/services/zoom/provider.ts` |
| Background jobs | **None.** Fields such as `scheduledPublishAt`, `nextFollowUpAt`, `nextDueAt` are written but nothing executes them. No reminders are ever sent | `deploy/README.md` "ما بقي بلا حلّ"; grep of `server/` for cron/queue |
| Monitoring / alerting | None beyond Vercel's dashboard. No error tracker, no uptime check | repo-wide |
| Staging | **None.** Vercel preview deployments share the production database | `scripts/vercel-build.sh` comment |
| CI | GitHub Actions: type-check, lint-baseline, browser tests, catalog gates, a11y, build, server e2e (~6 min on embedded PG) | `.github/workflows/ci.yml` |
| CD | `deploy.yml` exists for SSH-to-server deploys but is **manual-dispatch only** because no server exists yet | `.github/workflows/deploy.yml` |

### 1.2 What already exists for the target

The `deploy/` directory is a complete, thoughtfully written single-VPS design:

| File | Purpose | Verdict |
|---|---|---|
| `compose.prod.yml` | PostgreSQL 16 + app + Caddy; DB and app publish **no** host ports; named volumes | Good. Needs a `worker` service and log rotation added. |
| `Caddyfile` | Auto-TLS, security headers, static + `/api` proxy, raw body pass-through for Stripe | Good. `/docs` is public (close it); CSP uses `'unsafe-inline'` where `vercel.json` uses hashes (align). |
| `deploy.sh` | Build image → pre-migration backup → migrate → swap containers → health check | Good ordering. Builds the image **on the production host** (CPU/RAM spike at every deploy). |
| `backup.sh` | `pg_dump` → rclone to an **off-server** remote; refuses to run without one; `--verify` restores into a scratch DB and counts rows | Excellent. This is the backup strategy; keep it. |
| `wajeez-backup.timer/.service` | Nightly systemd timer | Good. Add a dead-man's-switch ping (see §5). |
| `docker-entrypoint.sh` | Copies built frontend into a shared volume for Caddy | Fine. |
| `.env.production.example` | Secrets template | Fine. Add `ZOOM_*`, `CALENDLY_*`, `SENTRY_DSN`, `S3_*` when those land. |
| `README.md` | Server bootstrap, Neon data import, Stripe webhook switch, daily ops, rollback | Largely correct; this plan supersedes and extends it. |

**Conclusion:** the heavy lifting of "how to run this on a server" is done. What is missing is: a staging environment, a worker process, monitoring, a rehearsal, and a disciplined cutover.

### 1.3 Environment variables inventory (from code and docs)

| Variable | Used by | Migration note |
|---|---|---|
| `DATABASE_URL` | Prisma | New value on Hetzner (compose derives it from `POSTGRES_*`) |
| `SESSION_SECRET`, `SESSION_TTL_DAYS` | auth | Verify whether `SESSION_SECRET` is actually read; sessions are DB rows, so cookie signing may be unused (see audit 01) |
| `STORAGE_SECRET` | storage signing | **Set explicitly on both environments before cutover**, otherwise the derived key changes and in-flight signed links break |
| `APP_URL`, `WEB_ORIGIN`, `VITE_SITE_ORIGIN` | links in email, CORS, SEO | Set to the final domain |
| `SMTP_*` | mail | Copy or move to DB settings |
| `PAYMENT_DRIVER`, `PAYMENT_PUBLISHABLE_KEY`, `PAYMENT_SECRET_KEY`, `PAYMENT_WEBHOOK_SECRET` | commerce | New webhook endpoint at the new domain → **new** `whsec_` |
| `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_WEBHOOK_SECRET` | zoom (future) | Not yet in use |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | storage (dev only today) | Becomes real on Hetzner Object Storage |
| `DEMO_MODE`, `VITE_DEMO_MODE` | demo | Must be false/absent in production and staging |
| `DB_POOL_MAX` | pg pool | Raise from 5 to ~20 on a long-running server (no more Neon per-instance ceiling) |
| `API_PORT`, `API_HOST`, `NODE_ENV` | server | Set by compose |
| `VERCEL_ENV`, `VERCEL_PROJECT_PRODUCTION_URL` | build script, site origin | Disappear; ensure nothing else depends on them (`src/application/site/origin.ts`) |

---

## 2 · Should you actually do this? — independent assessment

**Yes, and sooner rather than later, for reasons that have little to do with cost:**

1. **The serverless shape is fighting the product.** Reminders, scheduled publishing, Zoom sync, recording ingest, email retries — every feature on the Part Two list needs a process that runs when no user is clicking. Vercel functions cannot do that without bolting on external cron and a queue. A long-running server can run a worker with zero new infrastructure.
2. **The 4 MB upload ceiling and "files in the database" are Vercel workarounds**, not design choices. Learning materials and recordings need object storage and a server that can stream.
3. **Cold starts and Neon connection limits are already causing the login slowness the owner reported** (documented in `vercel-handler.ts`). A warm server with a 20-connection pool removes the whole class of problem.
4. **Preview builds mutating the production database** is a live risk today (§1.1). A staging server fixes it structurally.
5. The 13 MB hand-built `api/index.js` committed to git is a fragile artefact that exists only because of the Vercel packaging model. It goes away.

**What you give up:** zero-ops deploys, automatic preview URLs per pull request, Neon branching. Those are real conveniences, but every one of them is replaced in this plan (staging server, CI-driven deploy, nightly backups with verified restore).

**What I would *not* do:** move to Kubernetes, a managed PaaS on Hetzner, or a separate database server on day one. One well-run VPS with Docker Compose is the right size for this platform for a long time. Triggers for splitting are given in §4.5.

---

## 3 · Target architecture on Hetzner

Full reasoning in [03-ARCHITECTURE.md](03-ARCHITECTURE.md); the infrastructure decisions are summarised here.

### 3.1 Servers

| Environment | Hetzner product | Spec | Location | Approx. cost |
|---|---|---|---|---|
| **Production** | Cloud Server **CPX31** (or CX32 if budget is tight) | 4 vCPU, 8 GB RAM, 160 GB NVMe | Falkenstein (fsn1) or Nuremberg (nbg1) | ~€15/mo (CX32 ~€7) |
| **Staging** | Cloud Server **CX22** | 2 vCPU, 4 GB RAM, 40 GB | same location | ~€4/mo |
| Backups (server images) | Hetzner "Backups" add-on on production | 7 rolling daily snapshots | — | +20 % of server price (~€3) |
| Database dumps (off-server) | **Storage Box BX11** (1 TB, SFTP/rclone) **or** Hetzner Object Storage bucket | nightly `pg_dump` via existing `backup.sh` | — | ~€4/mo |
| Files (materials, uploads) | **Hetzner Object Storage** (S3-compatible) | 1 TB included tier | fsn1/nbg1/hel1 | ~€5/mo |
| Video | **Not on Hetzner** — a video platform with signed embeds (see 02 §3) | — | global CDN | usage-based, low |

Why 8 GB and not the 4 GB minimum in `deploy/README.md`: `deploy.sh` builds the Docker image (npm ci + Vite build of a 64 k-line frontend + Prisma generate) **on the production host**. On 4 GB that competes with PostgreSQL and the running app. 8 GB gives headroom; alternatively build in CI and pull the image (recommended follow-up, §6).

Why not a dedicated database server: at this scale the database is small (a few thousand users, no analytics firehose). Co-location with nightly off-server dumps plus daily server snapshots is simpler and safer than a second machine you have to patch and replicate. Revisit when triggers in §4.5 fire.

### 3.2 Software stack on each server

```
Ubuntu 24.04 LTS · Docker Engine + Compose plugin · ufw · unattended-upgrades · rclone
└── docker compose (deploy/compose.prod.yml)
    ├── caddy    :80/:443  auto-TLS, static frontend, /api reverse proxy
    ├── app      Fastify API (server/index.ts)            ← exists
    ├── worker   same image, runs the job runner (pg-boss) ← NEW (see 02 §8)
    └── db       postgres:17-alpine (match Neon's major)  ← exists as :16, verify version
```

Network: Hetzner Cloud Firewall allowing inbound 80, 443, and 22 only from the developers' IPs. `ufw` as a second layer. Database and app never publish host ports (already true in the compose file).

### 3.3 Staging

Identical compose stack on the CX22 with its own `.env.production` (call the file `.env.staging` in practice), its own domain (`staging.academy.wajeez.com` or similar), Let's Encrypt staging-free (Caddy handles real certs fine for a low-traffic host), and an **anonymised** copy of production data refreshed on demand by a script that dumps production, scrubs emails/names/phone numbers, and restores. Payment driver on staging is `test`; SMTP points at a sink (Mailpit container or a Resend test domain).

Deployment flow becomes: developer merges to `main` → CI green → `deploy.yml` deploys to **staging automatically** → human smoke test → the same workflow with `environment: production` deploys to production on manual approval.

---

## 4 · Migration process — step by step

Each step lists the risk level, what proves it succeeded, and who does it. **Steps 1–7 touch nothing in current production.**

### Phase 0 — Preconditions (in the current codebase, before any server exists)

| # | Step | Risk | Validation |
|---|---|---|---|
| 0.1 | **Stop preview builds from migrating production.** In `scripts/vercel-build.sh`, run `prisma migrate deploy` only when `VERCEL_ENV=production` (or, better, point previews at a throwaway Neon branch). | Low, high value | A preview deploy no longer touches `_prisma_migrations` on prod |
| 0.2 | Set `STORAGE_SECRET` explicitly in Vercel production env (random 32 bytes). | Low | Existing links keep working (they are short-lived anyway) |
| 0.3 | Add a `MAINTENANCE_MODE=1` env flag to the API that returns HTTP 503 with an Arabic message for all mutating routes and a banner in the SPA. Needed for a clean final sync. | Low | Toggle on staging, observe |
| 0.4 | Add a `worker` entry point (`server/worker.ts`) and a `worker` service to `compose.prod.yml`. Even if the first job is only "send session reminders", the plumbing must exist before cutover. | Medium | Job runs on staging |
| 0.5 | Add Docker log rotation (`logging: json-file, max-size 20m, max-file 5`) and memory limits to compose. Close `/docs` in Caddy or restrict by IP. Align CSP with `vercel.json`. | Low | `docker inspect` shows limits |
| 0.6 | Pin PostgreSQL image to the **same or newer major** as Neon reports (`SELECT version()` on Neon). `pg_dump` must be ≥ server major. | Low | Version string recorded |
| 0.7 | Write `scripts/migration/verify-counts.sql` (row count + checksum per critical table) and `scripts/migration/anonymise.sql` for staging refreshes. | Low | Runs against local DB |

### Phase 1 — Provision and prove staging (no production impact)

| # | Step | Risk | Validation |
|---|---|---|---|
| 1.1 | Owner creates Hetzner project, adds developers with limited roles, creates the CX22 (staging) and CPX31 (production) servers, Cloud Firewall, Storage Box/Object Storage bucket. Enable Backups add-on on production. | Low | Servers reachable by SSH key only |
| 1.2 | Bootstrap both servers per `deploy/README.md` §1 (non-root user, Docker, ufw, unattended-upgrades, rclone, SSH keys only, password auth off). | Low | `ufw status`, `sshd -T` |
| 1.3 | Configure DNS for `staging.<domain>` → staging IP. TTL 300. | Low | `dig` |
| 1.4 | Deploy `main` to staging with `deploy/deploy.sh`. Caddy obtains a certificate. | Medium (first real run of the stack) | `https://staging…/api/version` returns the commit; `/api/health` OK |
| 1.5 | Take a **read-only** `pg_dump -Fc` of Neon from a developer laptop (never store the Neon URL in the repo), anonymise, restore into staging. | Low | `verify-counts.sql` matches (before anonymisation) |
| 1.6 | Run the full server test suite **against staging's stack** and a manual tour of the four portals (student, trainer, advisor, admin) using demo accounts. | Medium | Test report attached to the migration ticket |
| 1.7 | Configure `backup.sh` on staging against the off-server remote; run `--verify`. | Low | "✓ استُرجعت النسخة" line seen once |
| 1.8 | Enable `deploy.yml` → staging on every green `main`. | Low | One automatic deploy observed |

### Phase 2 — Production rehearsal (still no production impact)

| # | Step | Risk | Validation |
|---|---|---|---|
| 2.1 | Deploy to the production server with `SITE_DOMAIN` set to the **final** domain but DNS **not yet pointed**. Use a temporary hostname or `/etc/hosts` override on the tester's machine, or configure Caddy with a temporary sub-domain (`new.<domain>`). | Medium | TLS issued for the temp name; app responds |
| 2.2 | Restore a fresh, **non-anonymised** Neon dump into production Postgres. Run `prisma migrate status` — it must report "database schema is up to date" (the `_prisma_migrations` table travels with the dump). | Medium | `verify-counts.sql` equal on both sides |
| 2.3 | Full manual and automated verification on the new host (login as each role, purchase in Stripe **test** mode, email test send, ICS download, admin screens, audit log, catalog snapshot hash equal to production). | Medium | Checklist in §7 all green |
| 2.4 | Time the restore. This number defines the maintenance window length in Phase 3. | — | Minutes recorded |
| 2.5 | Configure nightly backups + verify on production server. Configure monitoring (§5). | Low | Alerts fire on a deliberate test outage |
| 2.6 | Register a **second** Stripe webhook endpoint for the new domain (Stripe allows several). Record its new `whsec_` in the production `.env`. Send a test event from Stripe → 200. Keep the Vercel endpoint active. | Medium (money path) | Stripe dashboard shows 200 on the new endpoint |
| 2.7 | Rehearse the **rollback**: point `/etc/hosts` back, confirm Vercel still serves. Nothing to undo because nothing was changed there. | Low | — |
| 2.8 | Owner sign-off on staging and rehearsal results. **No cutover without this.** | — | Written approval |

### Phase 3 — Cutover (the only step with user-visible downtime)

Schedule at the lowest-traffic hour (e.g., Friday 03:00 Riyadh time). Announce in-app 48 hours earlier. Lower DNS TTL of the target records to 300 s at least 48 hours before.

| # | Step | Duration | Risk | Validation / go–no-go |
|---|---|---|---|---|
| 3.1 | Turn on `MAINTENANCE_MODE=1` on Vercel (env change + redeploy, ~2 min). Writes are blocked; reads and the banner still work. | 3 min | Low | Banner visible; POST returns 503 |
| 3.2 | Wait for in-flight Stripe webhooks to settle (check Stripe → Webhooks → recent deliveries, all 200). | 5 min | Low | No pending deliveries |
| 3.3 | Final `pg_dump -Fc` from Neon. Copy to production server over SSH. | 5–10 min | Low | Checksum of the dump file |
| 3.4 | On production server: stop `app`/`worker`, drop and recreate the database, `pg_restore`, start `app`/`worker`. | ~restore time from 2.4 | **Medium** — this is the point of no return for data on the new side; old side is untouched | `verify-counts.sql` identical to Neon; `prisma migrate status` clean |
| 3.5 | Switch DNS: `A`/`AAAA` for the final domain → Hetzner IP. Caddy obtains the certificate for the final name on first request (or already has it if 2.1 used the final name). | 1–5 min propagation | Medium | `curl -I https://<domain>` from two networks shows Caddy's headers and the new commit at `/api/version` |
| 3.6 | Set the Vercel project to **redirect** (301) all paths to the new domain (`vercel.json` `redirects`, or Vercel dashboard domain redirect). Users with old `*.vercel.app` bookmarks land on the new site. Keep this redirect forever — it costs nothing. | 3 min | Low | Old URL redirects |
| 3.7 | In Stripe: make the new webhook endpoint the only active one for `checkout.session.completed` (disable, don't delete, the Vercel one). | 2 min | Medium (money) | Test event → 200 on new endpoint |
| 3.8 | Turn `MAINTENANCE_MODE` off on the **new** server. | 1 min | Low | POST succeeds |
| 3.9 | Run the §7 verification checklist end to end with real accounts (owner + one trainer + one student). | 20 min | — | All green → announce completion |

Expected total window: **30–60 minutes**, of which users see a maintenance banner for most of it.

### Phase 4 — Post-cutover

| # | Step | When |
|---|---|---|
| 4.1 | Watch error tracker and uptime monitor closely; keep Neon and Vercel **fully intact** as the rollback target. | first 72 h |
| 4.2 | Confirm first nightly backup ran and `--verify` passes on the new server. | day 1 |
| 4.3 | Move applicant documents from `Bytes` columns to Object Storage (optional, can wait; the current approach still works on the new host). | week 2+ |
| 4.4 | Downgrade Neon to free tier / pause compute (do **not** delete). Keep the final dump file in the backup remote permanently, labelled `neon-final-<date>`. | after 14 days clean |
| 4.5 | Remove Vercel serverless function; leave the project as a redirect-only site. Delete `api/index.js`, `scripts/bundle-api.mjs`, the `ci:bundle` gate, `vercel-handler.ts`, and the `embedded-postgres` import path from production code (keep it for local dev). | after 30 days clean |
| 4.6 | Delete Neon project. | after 90 days, with the owner's explicit approval, after a restore test of the archived final dump |

### 4.5 · When to grow the architecture (triggers, not dates)

| Signal | Action |
|---|---|
| p95 API latency > 800 ms sustained, or CPU > 70 % for hours | Move to CPX41 (vertical) first; it is a reboot, not a migration |
| Database > 40 GB or restore time > 30 min | Separate database server + streaming replica; consider Hetzner's larger volumes |
| Need for zero-downtime deploys | Two app containers behind Caddy with health-based rotation (Compose supports this); still one server |
| Regular traffic from Gulf countries and static assets feel slow | Put a CDN (Cloudflare free or Bunny) in front of Caddy for `/assets/*` only; API stays direct so Stripe raw bodies are untouched |
| Multiple developers deploying daily | Build the Docker image in GitHub Actions, push to GHCR, and have `deploy.sh` pull instead of build |

---

## 5 · Backup, monitoring, rollback

### 5.1 Backups (three layers, two of them already designed)

1. **Nightly logical dump** — `deploy/backup.sh` via systemd timer to an off-server remote (Storage Box or Object Storage). Retention `BACKUP_KEEP_DAYS=30`. **Monthly `--verify`** is mandatory and should be a calendar reminder for a named person.
2. **Pre-deploy dump** — already performed by `deploy.sh` before every migration.
3. **Server snapshots** — Hetzner Backups add-on, 7 daily images. Restores the whole machine including Caddy certificates and Object-Storage-independent volumes.

Add a dead-man's switch: the timer's service should `curl` a Healthchecks.io (free) URL on success; you get an email if the backup **didn't** run, which is the failure nobody notices otherwise.

### 5.2 Monitoring (minimum viable, no new servers)

| Concern | Tool | Cost |
|---|---|---|
| Is the site up? | Uptime Kuma container on the **staging** box pinging `https://<domain>/api/health` every minute; alerts to email/Telegram | free |
| Are there errors? | Sentry (free tier) SDK in `server/` and `src/` with PII scrubbing; or self-hosted GlitchTip later | free |
| Are resources healthy? | Hetzner Cloud console graphs; `docker stats`; alert rule on disk > 80 % (a full disk is what kills Postgres) | free |
| Did the backup run? | Healthchecks.io ping | free |
| Certificate | Caddy renews automatically; Uptime Kuma also checks expiry | free |

### 5.3 Rollback plan

Principle: **the old environment is never modified during cutover except for the maintenance flag and the Stripe endpoint toggle.** Rollback is therefore always possible.

| Situation | Action | Data considerations |
|---|---|---|
| Problem found **before 3.5 (DNS)** | Stop. Turn `MAINTENANCE_MODE` off on Vercel. Nothing changed for users. | None |
| Problem found **within the maintenance window** after DNS switch | Point DNS back to Vercel (TTL 300 → live in ~5 min). Re-enable the Vercel Stripe endpoint, disable the Hetzner one. Turn maintenance off on Vercel. | Writes on Hetzner during the window were blocked by maintenance mode until 3.8, so **no divergence** unless 3.8 was reached |
| Problem found **hours or days later** with real traffic on Hetzner | Announce a second window. Reverse the procedure: maintenance on Hetzner → `pg_dump` Hetzner → restore into Neon (same schema, same procedure) → DNS back → Stripe toggle → maintenance off. | Full data preserved; Neon must not have been downgraded yet (hence the 14-day hold in 4.4) |
| Stripe webhook misrouted | Both endpoints are registered; Stripe retries failed deliveries for 3 days. Re-enable the correct one and use "Resend" in the Stripe dashboard for any failed events. `PaymentWebhookEvent` idempotency prevents double-crediting | Check `Order` rows against Stripe's payments list |

---

## 6 · What I need from you (owner) — and how to hand it over safely

Nothing sensitive should be pasted into chat, a GitHub issue, or a document. Use a shared vault (Bitwarden/1Password shared collection) or set the values yourself in the destination UI. The list says **what** and **where it goes**, never the value.

| # | Item | Why | Secure handling |
|---|---|---|---|
| 1 | **Hetzner account** with a project named `wajeez-academy`; invite the developer with the "Member" role (not Owner). Billing stays with you. | Servers, firewall, backups, object storage | Invitation by email through Hetzner console |
| 2 | **Domain & DNS access** for `wajeez.com`/`wajeez.co` (or delegate the `academy` sub-zone). Decision needed: final hostname is `academy.wajeez.com` per docs — confirm. Consider moving DNS to Cloudflare (free) for fast TTL changes and future CDN. | Cutover step 3.5 | Grant DNS-only role at the registrar/Cloudflare; never share the registrar password |
| 3 | **Vercel project** access (Member role) | Read env vars, set maintenance flag, configure redirect, verify payment driver status | Vercel team invite; env values pulled with `vercel env pull` by the developer onto their machine only |
| 4 | **Neon** — a **read-only** database role or a temporary connection string for dumps | Steps 1.5, 2.2, 3.3 | Create a role in Neon console; paste the URL into the vault; rotate/delete after cutover |
| 5 | **Stripe** dashboard access (Developer role) | Add the second webhook endpoint, read the new signing secret, verify live vs test keys | Stripe team invite; the developer sets `PAYMENT_WEBHOOK_SECRET` directly in the server `.env` |
| 6 | **SMTP / email provider** decision and account (Resend or Postmark recommended, as the existing docs say) plus permission to add SPF/DKIM/DMARC records on the sending domain | Email has been disconnected in production; reminders, invitations, password reset all depend on it | Provider API key goes straight into `/admin/integrations` or the vault |
| 7 | **Zoom** — a Zoom account that will host the meetings (Pro or Business; cloud recording requires a paid plan) and permission to create a Server-to-Server OAuth app in the Zoom Marketplace | Part Two, Zoom integration | Developer creates the app under your account while screen-sharing, or you paste the three credentials into the vault |
| 8 | **Calendly** (or the alternative recommended in 02 §1) account on a plan with webhooks (Standard or above), one seat per person who receives bookings | Part Two, Calendly | Personal access token into the vault |
| 9 | **Video platform** account (Bunny Stream or Cloudflare Stream; see 02 §3) | Recorded video delivery | API key into the vault |
| 10 | **Google Workspace** admin only if you want calendar write-back via OAuth. **My recommendation is to not do this now**: ICS attachments + a subscribable calendar feed cover the need without OAuth review. | Calendar sync | Not needed if the recommendation is accepted |
| 11 | **GitHub** repository admin to add Actions secrets (`SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_KNOWN_HOSTS`) and create the `production` environment with required reviewers | Automated deploys | You add them in Settings → Secrets; the developer generates the SSH key pair and gives you the **public** half only |
| 12 | **Decisions**: final domain; maintenance window date/time; go/no-go sign-off after Phase 2; who is the named owner of the monthly backup verification | Plan cannot proceed past 2.8 without them | Written in the migration ticket |
| 13 | Confirmation of **existing backups** of Neon (Neon keeps point-in-time history on paid plans — how many days?) | Rollback safety | Read from Neon console |
| 14 | A **test payment card** and permission to make one small real payment on the new host after cutover (refunded) | Money path verification | — |

---

## 7 · What the developers must prepare (technical handover checklist)

Everything below is a deliverable that must exist in the repository **before** Phase 3. Items marked ✅ exist today.

### Repository and documentation
- [ ] `docs/ops/ARCHITECTURE.md` — one diagram, one page: containers, ports, volumes, external services (can be lifted from 03)
- [ ] `docs/ops/RUNBOOK.md` — deploy, rollback, restore, rotate a secret, add an admin, check logs; supersedes `deploy/README.md` and the relevant parts of `docs/RUNBOOK_AR.md` (currently stale: says "11 migrations", there are 53)
- [ ] `docs/ops/ENVIRONMENT.md` — every variable from §1.3 with owner, where it lives, how to rotate
- [ ] `docs/ops/INTEGRATIONS.md` — Stripe, SMTP, Zoom, Calendly, video, object storage: endpoints, webhooks, who owns the account, how to verify each in 1 minute
- [ ] Remove or move to `audit/` the stray root files (`tmp_offers.txt`, `tmp_offers_miner.txt`, `tmp_tech.txt`, `cp.mts`, `template-info.md`) — they confuse a new developer and two of them are 50 KB of scraped text

### Database
- ✅ Prisma schema and 53 migrations
- [ ] `ci:migrations` gate stays green; fix the two migrations sharing timestamp `20260901220000` (Prisma orders them lexically; they happen to be independent but it is a trap)
- [ ] `scripts/migration/verify-counts.sql` and `anonymise.sql` (Phase 0.7)
- [ ] Documented PostgreSQL major version and `pg_dump` compatibility note
- [ ] Documented restore procedure tested at least twice (staging and rehearsal)

### Application
- [ ] `MAINTENANCE_MODE` flag (Phase 0.3)
- [ ] `worker` entry point and compose service (Phase 0.4)
- [ ] `/api/health` checks DB connectivity and returns commit + migration status (verify current behaviour)
- [ ] `STORAGE_SECRET` explicit everywhere; document rotation
- [ ] `DB_POOL_MAX` default raised for server mode
- [ ] Site-origin logic (`src/application/site/origin.ts`) no longer depends on `VERCEL_PROJECT_PRODUCTION_URL` in the server build path

### Deployment
- ✅ `Dockerfile`, `compose.prod.yml`, `Caddyfile`, `deploy.sh`, `backup.sh`, systemd timer
- [ ] Compose: `worker` service, log rotation, memory limits
- [ ] Caddy: `/docs` closed, CSP aligned with hashes from `scripts/audit-csp.ts`
- [ ] `deploy.yml`: staging job on green `main`, production job gated by GitHub environment approval
- [ ] Healthchecks.io ping in the backup service
- [ ] Sentry DSN wiring with PII scrubbing (or a documented decision not to)

### Dependencies and runtime
- [ ] Decide: keep running TypeScript with `tsx` in production (current, simple) or compile with `tsc`/esbuild in the Dockerfile (faster boot, smaller image). Recommendation: compile; the Dockerfile comment's concern about esbuild not being declared is solved by adding it to `devDependencies` explicitly.
- [ ] `embedded-postgres` must not be imported in the production entry path (it is today via `db/client.ts` → `embedded.ts`); guard behind `NODE_ENV !== 'production'` or a dynamic import
- [ ] `npm audit` clean or documented exceptions

### Integrations inventory (see 02 for designs)
- [ ] Stripe: both endpoints listed, which is active, `whsec_` location
- [ ] SMTP: provider, DNS records added, test send screenshot
- [ ] Zoom, Calendly, video: credentials location, webhook URLs, verification steps

---

## 8 · Production cutover checklist (print this)

**T‑48 h**
- [ ] DNS TTL lowered to 300 s on the final hostname
- [ ] In-app banner announcing the window
- [ ] Phase 2 sign-off recorded (2.8)
- [ ] Rollback contacts and steps printed; Neon and Vercel access confirmed working

**T‑0 (window opens)**
1. [ ] Final backup: Neon `pg_dump -Fc` → checksum recorded → copied to server **and** to the backup remote
2. [ ] Maintenance mode ON at Vercel; banner visible; POST returns 503
3. [ ] Stripe recent deliveries all 200; no pending
4. [ ] Restore into Hetzner Postgres; `verify-counts.sql` identical; `prisma migrate status` clean
5. [ ] Deployment verification: `/api/version` shows the intended commit; `/api/health` OK; worker container running
6. [ ] DNS switched; propagation confirmed from two networks
7. [ ] SSL: `https://<domain>` valid certificate, HSTS header present, HTTP → HTTPS redirect
8. [ ] Authentication: login as super admin, academic manager, trainer, advisor, student — existing sessions still valid (no forced logout)
9. [ ] Integrations: `/admin/integrations` "live connection test" for payment and email both green
10. [ ] Zoom: (manual provider today) open a session with a join link; if API provider is live by then, create a test meeting
11. [ ] Email: test send from `/admin/integrations`; trigger a password reset and receive it
12. [ ] Student access: open a course, module body, video embed, ICS download, support ticket
13. [ ] Instructor access: cohort board, grading, message a cohort
14. [ ] Admin access: users, roles, audit log shows the cutover-time actions, catalog snapshot hash equals pre-cutover value
15. [ ] Monitoring: Uptime Kuma green, Sentry receiving a deliberate test event, Healthchecks pending until first nightly
16. [ ] Stripe: new endpoint active, old disabled, test event 200; one small real payment → order settled → refunded
17. [ ] Maintenance mode OFF on Hetzner; Vercel set to 301 redirect
18. [ ] Announcement sent; window closed; timestamp recorded

**T+24 h**
- [ ] First nightly backup ran; `backup.sh --verify` passes
- [ ] No new Sentry error classes; uptime 100 %

**T+14 d** — Neon compute paused (not deleted). **T+30 d** — remove Vercel function code. **T+90 d** — delete Neon with owner approval after archived-dump restore test.

---

## 9 · Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Neon major version newer than the Postgres image → `pg_dump` incompatibility | Medium | Blocks restore | Phase 0.6: check version first; use `postgres:17` if needed |
| Stripe webhook events lost during the switch | Low | Paid orders not enrolled | Two endpoints registered; Stripe retries 3 days; idempotency table; manual "Resend" |
| Signed-URL secret changes silently with `DATABASE_URL` | High if unaddressed | Broken document links | Phase 0.2 sets `STORAGE_SECRET` explicitly on both sides |
| Email links still point at the old domain | Medium | Confusion, failed verification | `APP_URL` set on new host before 3.8; Vercel 301 catches stragglers |
| Building the image on the production host starves Postgres | Medium | Slow site during deploys | 8 GB server now; build-in-CI later |
| Nobody runs the monthly restore test | High | Backups silently useless | Named owner in §6 item 12; Healthchecks for the run itself |
| Server compromised via exposed SSH | Low | Total | Keys only, Cloud Firewall limited to developer IPs, unattended-upgrades |
| Disk fills up (logs, Docker images) | Medium | Postgres crash | Log rotation, `docker system prune` in deploy script, disk alert at 80 % |
| Preview builds keep migrating prod until 0.1 lands | High today | Schema drift in production from an unmerged branch | Do 0.1 **this week**, independent of the migration |

---

## 10 · Timeline (indicative, one developer)

| Week | Work |
|---|---|
| 1 | Phase 0 code changes (0.1–0.7), Hetzner provisioning, staging up, first anonymised restore, automated staging deploys |
| 2 | Production rehearsal (Phase 2), monitoring, backup verify, Stripe second endpoint, owner sign-off |
| 3 | Cutover window, 72-hour watch, documentation handover |

The migration itself is the smallest part. The lasting value is a staging environment, a worker process, verified backups, and monitoring — none of which the platform has today.
