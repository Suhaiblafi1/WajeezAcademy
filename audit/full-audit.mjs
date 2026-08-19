/* ═══ التدقيق الشامل للبوابات الأربع ═══
   لكل صفحة: أخطاء الكونسول، طلبات API الفاشلة، آثار تقنية في النص المرئي
   (إنجليزية خام/UUID/ISO/undefined)، فيض أفقي، ولقطة. */
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

const API = 'http://localhost:7101'
const WEB = 'http://localhost:7100'

const ROLES = {
  admin:   { email: 'superadmin.demo@wajeez.local', pages: [
    '/admin', '/admin/catalog', '/admin/publishing', '/admin/cohorts', '/admin/content',
    '/admin/quality', '/admin/users', '/admin/trainers', '/admin/exceptions',
    '/admin/finance', '/admin/reports', '/admin/support', '/admin/notifications',
  ]},
  student: { email: 'student.demo@wajeez.local', pages: [
    '/student', '/student/learning', '/student/pathway', '/student/project', '/student/cohorts',
    '/student/certificates', '/student/billing', '/student/cv', '/student/account',
    '/student/notifications', '/student/support',
  ]},
  trainer: { email: 'trainer.demo@wajeez.local', pages: [
    '/trainer', '/trainer/grading', '/trainer/earnings', '/trainer/proposals', '/trainer/board',
  ]},
  advisor: { email: 'consultant.demo@wajeez.local', pages: [
    '/advisor', '/advisor/cases', '/advisor/reviews',
  ]},
}

/* أنماط الآثار التقنية — إنجليزية حالة خام ومعرفات وصيغ آلات */
const PATTERNS = [
  { name: 'undefined/null/NaN', re: /\b(undefined|NaN|\[object Object\])\b/ },
  { name: 'UUID ظاهر', re: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ },
  { name: 'تاريخ ISO خام', re: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/ },
  { name: 'حالة إنجليزية خام', re: /(?<![A-Za-z])(pending|enrolled|waitlisted|dropped|under_review|resubmit_requested|submitted|accepted|rejected|succeeded|issued|partially_refunded|draft|archived|published|locked|available|in_progress|needs_action|cancelled|paid|void|refunded|full|running|closed|approved|revision|present|absent|excused|assignment|quiz|remote|onsite|hybrid|active|completed|open|late)(?![A-Za-z])/ },
]

const results = []
const browser = await chromium.launch()

for (const [role, cfg] of Object.entries(ROLES)) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: cfg.email, password: 'Wajeez-Demo-2026' }),
  })
  if (!res.ok) { console.log(`❌ login ${role}: ${res.status}`); continue }
  const [pair] = res.headers.get('set-cookie').split(';')
  const eq = pair.indexOf('=')
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  await ctx.addCookies([{ name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: 'localhost', path: '/' }])

  for (const path of cfg.pages) {
    const page = await ctx.newPage()
    const consoleErrs = []
    const failedReqs = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 160)) })
    page.on('pageerror', (e) => consoleErrs.push(`PAGEERROR: ${String(e).slice(0, 160)}`))
    page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) failedReqs.push(`${r.status()} ${r.url().replace(API, '')}`) })

    try {
      await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle', timeout: 30_000 })
      await page.waitForTimeout(1400)
    } catch (e) { consoleErrs.push(`NAV: ${String(e).slice(0, 120)}`) }

    const text = await page.locator('body').innerText().catch(() => '')
    const artifacts = []
    for (const p of PATTERNS) {
      const m = text.match(p.re)
      if (m) {
        const idx = text.indexOf(m[0])
        artifacts.push(`${p.name}: «${text.slice(Math.max(0, idx - 40), idx + 60).replace(/\n/g, ' ⏎ ')}»`)
      }
    }
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
    const title = await page.locator('h1').first().innerText().catch(() => '(لا h1)')

    results.push({ role, path, title, consoleErrs, failedReqs, artifacts, overflowX })
    await page.screenshot({ path: `audit/pages/${role}${path.replace(/\//g, '_')}.png` })
    console.log(`${consoleErrs.length || failedReqs.length || artifacts.length || overflowX ? '⚠️' : '✅'} ${role}${path} — ${title}`)
    await page.waitForTimeout(250) // تهدئة للـ rate limit
    await page.close()
  }
  await ctx.close()
}

await browser.close()
writeFileSync('audit/audit-results.json', JSON.stringify(results, null, 2))
const flagged = results.filter((r) => r.consoleErrs.length || r.failedReqs.length || r.artifacts.length || r.overflowX)
console.log(`\n═══ ${results.length} صفحة — ${flagged.length} عليها ملاحظات ═══`)
for (const f of flagged) {
  console.log(`\n■ ${f.role}${f.path}`)
  f.consoleErrs.slice(0, 2).forEach((e) => console.log(`  console: ${e}`))
  f.failedReqs.slice(0, 3).forEach((e) => console.log(`  api: ${e}`))
  f.artifacts.slice(0, 3).forEach((e) => console.log(`  أثر: ${e}`))
  if (f.overflowX) console.log('  فيض أفقي!')
}
