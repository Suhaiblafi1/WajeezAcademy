/* جولةُ الأدوار بالمتصفّح — كلُّ شاشةٍ بكلّ دورٍ يراها، بلقطتَين وسجلٍّ لكلّ صفحة.

   لماذا هذا الملفّ: تدقيقُ سبتمبر ٢٠٢٦ كان قراءةَ شيفرةٍ لا استخدامَ منصّة،
   ووثيقةُ الأدوار نفسُها (`docs/ROLE_AUDIT_TOUR_AR.md` §4) تُقرّ أنّ الجولةَ
   لم تكتمل قطّ. فهذا السكربت يفعلها كلَّها: يدخل بكلّ حسابٍ من التسعة
   (والزائر بلا دخول)، يفتح كلَّ مسارٍ يراه ذاك الدور، ينتظر محتوى حقيقيّا
   لا هيكلا، يصوّر على حاسوبٍ وهاتف، ويسجّل ما لا تراه العين وحدها: أخطاءُ
   الكونسول، نداءاتُ `/api` الفاشلة، الانسيابُ الأفقيّ، النصوصُ المسرَّبة
   (UUID/ISO/undefined/حالاتٌ إنجليزيّة)، العنوانُ الأوّل، وحالةُ الفراغ.

   الأساسُ `audit/full-audit.mjs` (كعكةُ الجلسة من `/api/auth/login`) مع
   `waitForContent` من `scripts/a11y-audit.ts`. الصورُ JPEG لا PNG — كي يبقى
   المجموعُ ملتزَما في المستودع دون بضعة ميغابايتات.

   الاستعمال (الخادمُ على 7101 والواجهةُ على 3000 والديمو مبذور):
     PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/tour/tour.mjs
   خيارات: TOUR_ROLES=student,trainer  TOUR_OUT=docs/audit-2026-09/tour */

import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const API = process.env.TOUR_API ?? 'http://localhost:7101'
const WEB = process.env.TOUR_WEB ?? 'http://localhost:3000'
const OUT = process.env.TOUR_OUT ?? 'docs/audit-2026-09/tour'
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Wajeez-Demo-2026'
const ONLY = process.env.TOUR_ROLES?.split(',').map((s) => s.trim()).filter(Boolean)

const ADMIN_ALL = [
  '/admin', '/admin/catalog', '/admin/authoring', '/admin/publishing', '/admin/cohorts',
  '/admin/learners', '/admin/learner-requests', '/admin/trainers', '/admin/advisor-requests',
  '/admin/advisors', '/admin/exceptions', '/admin/quality', '/admin/ratings', '/admin/finance',
  '/admin/reports', '/admin/support', '/admin/notifications', '/admin/tasks',
  '/admin/integrations', '/admin/users', '/admin/audit',
]
const STUDENT_ALL = [
  '/student', '/student/learning', '/student/learning?stage=C-AUT-101',
  '/student/course/C-AUT-101/module/C-AUT-101-M1', '/student/review', '/student/skills',
  '/student/certificates', '/student/billing', '/student/support', '/student/inbox',
  '/student/notifications', '/student/account', '/student/cv', '/student/vault',
  '/student/library', '/student/rate', '/student/pathway',
]
const TRAINER_ALL = ['/trainer', '/trainer/board', '/trainer/grading', '/trainer/learners', '/trainer/proposals', '/trainer/earnings', '/trainer/ratings']
const ADVISOR_ALL = ['/advisor', '/advisor/learners', '/advisor/ratings', '/advisor/earnings']
const PUBLIC = ['/', '/methodology', '/pathways', '/courses', '/diagnostic', '/trainers', '/join-trainer', '/contact', '/auth', '/verify', '/stories']

/* الأدوارُ التسعة + الزائر. `pages` هي ما يُفترض أن يراه الدور؛ ومسارُ
   دورٍ آخر يُفتح عمدا مرّةً واحدة لكلّ بوّابة كي يُرى سلوكُ الحارس. */
const ROLES = {
  visitor:     { email: null, pages: [...PUBLIC, '/student', '/trainer', '/admin'] },
  student:     { email: 'student.demo@wajeez.local',     pages: [...STUDENT_ALL, '/admin', '/trainer'] },
  trainer:     { email: 'trainer.demo@wajeez.local',     pages: [...TRAINER_ALL, '/student', '/admin'] },
  advisor:     { email: 'consultant.demo@wajeez.local',  pages: [...ADVISOR_ALL, '/student', '/admin'] },
  academic:    { email: 'admin.demo@wajeez.local',       pages: ADMIN_ALL },
  operations:  { email: 'operations.demo@wajeez.local',  pages: ADMIN_ALL },
  diagnostics: { email: 'diagnostics.demo@wajeez.local', pages: ADMIN_ALL },
  finance:     { email: 'finance.demo@wajeez.local',     pages: ADMIN_ALL },
  support:     { email: 'support.demo@wajeez.local',     pages: ADMIN_ALL },
  superadmin:  { email: 'superadmin.demo@wajeez.local',  pages: [...ADMIN_ALL, ...TRAINER_ALL, ...ADVISOR_ALL, ...STUDENT_ALL.slice(0, 6)] },
}

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 } }

/* أنماطُ الآثار التقنيّة في النصّ المرئيّ — من `audit/full-audit.mjs` */
const PATTERNS = [
  { name: 'undefined/NaN', re: /\b(undefined|NaN|\[object Object\])\b/ },
  { name: 'UUID ظاهر', re: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ },
  { name: 'تاريخ ISO خام', re: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/ },
  { name: 'حالة إنجليزية خام', re: /(?<![A-Za-z/_-])(pending|enrolled|waitlisted|under_review|resubmit_requested|submitted|succeeded|partially_refunded|in_progress|needs_action|cancelled|refunded|present|absent|excused)(?![A-Za-z_-])/ },
]
const DEAD_END = /لا صلاحيات مفعّلة|لا تملك الصلاحية|سجّل الدخول أولا/

const MIN_TEXT = 200
async function waitForContent(page) {
  try {
    await page.waitForFunction((min) => (document.body?.innerText ?? '').trim().length >= min, MIN_TEXT, { timeout: 20_000 })
  } catch { /* الصفحةُ الفارغة نتيجةٌ تُسجَّل لا خطأٌ يوقف */ }
  await page.waitForTimeout(700)
}

function slug(path) { return path.replace(/^\//, '').replace(/[/?=&:]+/g, '_') || 'home' }

async function loginCookie(email) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`login ${email}: HTTP ${res.status} ${await res.text()}`)
  const [pair] = (res.headers.get('set-cookie') ?? '').split(';')
  const eq = pair.indexOf('=')
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: 'localhost', path: '/' }
}

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const results = []
const started = Date.now()

for (const [role, cfg] of Object.entries(ROLES)) {
  if (ONLY && !ONLY.includes(role)) continue
  let cookie = null
  if (cfg.email) {
    try { cookie = await loginCookie(cfg.email) }
    catch (e) { console.log(`❌ ${role}: ${e.message}`); results.push({ role, path: '(login)', error: String(e.message) }); continue }
  }
  mkdirSync(join(OUT, role), { recursive: true })

  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile ?? false, deviceScaleFactor: vp.deviceScaleFactor ?? 1, locale: 'ar' })
    if (cookie) await ctx.addCookies([cookie])

    for (const path of cfg.pages) {
      const page = await ctx.newPage()
      const consoleErrs = []
      const failedReqs = []
      page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 200)) })
      page.on('pageerror', (e) => consoleErrs.push(`PAGEERROR: ${String(e).slice(0, 200)}`))
      page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) failedReqs.push(`${r.status()} ${r.url().replace(API, '').replace(WEB, '')}`) })

      const t0 = Date.now()
      let navError = null
      try {
        await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        await waitForContent(page)
      } catch (e) { navError = String(e).slice(0, 160) }
      const loadMs = Date.now() - t0

      const text = await page.locator('body').innerText().catch(() => '')
      const finalUrl = page.url().replace(WEB, '')
      const artifacts = []
      for (const p of PATTERNS) {
        const m = text.match(p.re)
        if (m) { const i = text.indexOf(m[0]); artifacts.push(`${p.name}: «${text.slice(Math.max(0, i - 40), i + 60).replace(/\n/g, ' ⏎ ')}»`) }
      }
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2).catch(() => null)
      const h1 = await page.locator('h1').first().innerText({ timeout: 1500 }).catch(() => '')
      const deadEnd = DEAD_END.test(text)
      const redirected = finalUrl.split('?')[0] !== path.split('?')[0]
      const thin = text.trim().length < MIN_TEXT

      const file = join(OUT, role, `${slug(path)}.${vpName}.jpg`)
      await page.screenshot({ path: file, type: 'jpeg', quality: 68 }).catch(() => {})

      const rec = { role, viewport: vpName, path, finalUrl, redirected, h1: h1.slice(0, 120), textLen: text.trim().length, thin, deadEnd, loadMs, consoleErrs, failedReqs, artifacts, overflowX, navError, file }
      results.push(rec)
      const flag = navError || consoleErrs.length || failedReqs.length || artifacts.length || overflowX ? '⚠️' : (thin || deadEnd ? '⬜' : '✅')
      console.log(`${flag} ${role.padEnd(11)} ${vpName.padEnd(7)} ${path.padEnd(48)} → ${redirected ? finalUrl + ' ' : ''}${h1 ? '«' + h1.slice(0, 40) + '»' : ''} ${loadMs}ms`)
      await page.waitForTimeout(300) // تهدئةٌ لمحدّد المعدّل (٣٠٠/دقيقة)
      await page.close()
    }
    await ctx.close()
  }
}

await browser.close()
writeFileSync(join(OUT, 'findings.json'), JSON.stringify({ generatedAt: new Date().toISOString(), durationMs: Date.now() - started, results }, null, 2))

const flagged = results.filter((r) => r.navError || r.consoleErrs?.length || r.failedReqs?.length || r.artifacts?.length || r.overflowX)
const thin = results.filter((r) => r.thin || r.deadEnd)
console.log(`\n═══ ${results.length} لقطة · ${flagged.length} عليها ملاحظات · ${thin.length} فارغة/مسدودة · ${Math.round((Date.now() - started) / 1000)} ث ═══`)
for (const f of flagged) {
  console.log(`\n■ ${f.role} ${f.viewport} ${f.path}${f.redirected ? ' → ' + f.finalUrl : ''}`)
  if (f.navError) console.log(`  nav: ${f.navError}`)
  f.consoleErrs?.slice(0, 2).forEach((e) => console.log(`  console: ${e}`))
  f.failedReqs?.slice(0, 3).forEach((e) => console.log(`  api: ${e}`))
  f.artifacts?.slice(0, 3).forEach((e) => console.log(`  أثر: ${e}`))
  if (f.overflowX) console.log('  فيض أفقي!')
}
