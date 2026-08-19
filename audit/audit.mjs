/* تدقيق خارجي آلي — جولة بصرية + أخطاء console + أداء + وصولية أساسية
   يزور كل مسارات الموقع العامة والبوابات الخمس بحسابات الديمو ويلتقط أدلة */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'

const BASE = 'http://localhost:7100'
const OUT = 'audit'
mkdirSync(`${OUT}/shots`, { recursive: true })

const PUBLIC = ['/', '/methodology', '/diagnostic', '/pathways', '/courses', '/stories',
  '/trainers', '/join-trainer', '/for-business', '/for-government', '/contact', '/auth', '/p/privacy']

const PORTALS = {
  student: { email: 'student.demo@wajeez.local', routes: ['/student', '/student/learning', '/student/pathway', '/student/notifications', '/student/support', '/student/cohorts', '/student/billing', '/student/cv', '/student/certificates'] },
  trainer: { email: 'trainer.demo@wajeez.local', routes: ['/trainer', '/trainer/grading', '/trainer/earnings', '/trainer/proposals', '/trainer/board'] },
  advisor: { email: 'consultant.demo@wajeez.local', routes: ['/advisor', '/advisor/cases', '/advisor/reviews'] },
  admin: { email: 'admin.demo@wajeez.local', routes: ['/admin', '/admin/cohorts', '/admin/catalog', '/admin/quality', '/admin/users', '/admin/finance', '/admin/reports', '/admin/support', '/admin/notifications', '/admin/trainers', '/admin/publishing', '/admin/content', '/admin/exceptions'] },
}
const PASS = 'Wajeez-Demo-2026'

const report = { pages: [], consoleErrors: [], pageErrors: [], failedRequests: [], a11y: [], perf: [] }

async function visit(page, url, tag, shot = true, mobile = false) {
  const errs = [], fails = []
  const onConsole = (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) }
  const onPageErr = (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 200))
  const onReqFail = (r) => fails.push(`${r.method()} ${r.url().slice(0, 120)} — ${r.failure()?.errorText ?? ''}`)
  const onResponse = (r) => { if (r.status() >= 400) fails.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`) }
  page.on('console', onConsole); page.on('pageerror', onPageErr)
  page.on('requestfailed', onReqFail); page.on('response', onResponse)
  const t0 = Date.now()
  try {
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 20000 })
  } catch { try { await page.goto(BASE + url, { waitUntil: 'load', timeout: 15000 }) } catch (e) { errs.push('NAV: ' + String(e).slice(0, 120)) } }
  await page.waitForTimeout(900)
  const ms = Date.now() - t0

  const a11y = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')].filter((i) => !i.alt).length
    const buttonsNoName = [...document.querySelectorAll('button')].filter((b) => !b.textContent?.trim() && !b.getAttribute('aria-label')).length
    return {
      lang: document.documentElement.lang, dir: document.documentElement.dir,
      title: document.title, h1: document.querySelectorAll('h1').length,
      imgsNoAlt: imgs, buttonsNoName,
      bodyText: document.body?.innerText?.slice(0, 80).replace(/\n/g, ' | '),
    }
  })
  const slug = (tag + url).replace(/[^a-z0-9\u0600-\u06FF]+/gi, '_')
  if (shot) await page.screenshot({ path: `${OUT}/shots/${slug}${mobile ? '_m' : ''}.png`, fullPage: false })

  report.pages.push({ url, tag, mobile, ms })
  report.perf.push({ url, tag, ms })
  if (errs.length) { report.consoleErrors.push({ url, tag, errs }); }
  if (fails.length) report.failedRequests.push({ url, tag, fails })
  if (a11y.imgsNoAlt || a11y.buttonsNoName || a11y.h1 === 0 || !a11y.lang) report.a11y.push({ url, tag, ...a11y, bodyText: undefined })
  if (!mobile) report.pages[report.pages.length - 1].title = a11y.title
  report.pages[report.pages.length - 1].preview = a11y.bodyText

  page.off('console', onConsole); page.off('pageerror', onPageErr)
  page.off('requestfailed', onReqFail); page.off('response', onResponse)
}

const browser = await chromium.launch()

/* ── الجولة العامة — سطح المكتب + جوال للصفحات المحورية ── */
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const dp = await desktop.newPage()
for (const r of PUBLIC) await visit(dp, r, 'public')
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const mp = await mobile.newPage()
for (const r of ['/', '/diagnostic', '/pathways', '/auth', '/join-trainer']) await visit(mp, r, 'public', true, true)

/* ── جولات البوابات — دخول عبر API ثم زيارة الصفحات ── */
for (const [role, cfg] of Object.entries(PORTALS)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const login = await ctx.request.post(`${BASE}/api/auth/login`, {
    data: { email: cfg.email, password: PASS },
  })
  report.pages.push({ url: '/api/auth/login', tag: `${role}-LOGIN`, ms: 0, status: login.status() })
  const p = await ctx.newPage()
  for (const r of cfg.routes) await visit(p, r, role)
  await ctx.close()
}

await browser.close()
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
console.log(`pages: ${report.pages.length} | consoleErr: ${report.consoleErrors.length} | failedReq: ${report.failedRequests.length} | a11y: ${report.a11y.length}`)
