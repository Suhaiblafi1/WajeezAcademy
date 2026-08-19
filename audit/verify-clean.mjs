/* تحقق حي — مرحلة التبسيط: لا شريط تجريبي ولا بيانات وهمية للجلسات الحقيقية */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = 'http://localhost:7100'
mkdirSync('audit/shots', { recursive: true })

const CASES = [
  ['advisor', 'consultant.demo@wajeez.local', '/advisor', ['نموذج تجريبي', 'من أنت؟']],
  ['advisor-cases', 'consultant.demo@wajeez.local', '/advisor/cases', ['نموذج تجريبي']],
  ['trainer', 'trainer.demo@wajeez.local', '/trainer', ['نموذج تجريبي', 'من أنت؟']],
  ['trainer-grading', 'trainer.demo@wajeez.local', '/trainer/grading', ['نموذج تجريبي']],
  ['trainer-earnings', 'trainer.demo@wajeez.local', '/trainer/earnings', ['نموذج تجريبي', 'قيد التراكم']],
  ['admin', 'superadmin.demo@wajeez.local', '/admin', ['نموذج تجريبي', 'من أنت؟', 'Gross', '21.4']],
  ['student', 'student.demo@wajeez.local', '/student', ['نموذج تجريبي']],
]
const PASS = 'Wajeez-Demo-2026'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
let fail = 0

for (const [tag, email, route, forbidden] of CASES) {
  await ctx.clearCookies()
  const res = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email, password: PASS } })
  if (!res.ok()) { console.log(`❌ فشل الدخول ${tag}`); fail++; continue }
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const body = await page.evaluate(() => document.body.innerText)
  const found = forbidden.filter((f) => body.includes(f))
  const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim() ?? '')
  await page.screenshot({ path: `audit/shots/clean-${tag}.png` })
  if (found.length) { console.log(`❌ ${tag} — تسرب: ${found.join('، ')} | h1=«${h1.slice(0, 40)}»`); fail++ }
  else console.log(`✅ ${tag} | h1=«${h1.slice(0, 40)}»`)
}

await browser.close()
process.exit(fail ? 1 : 0)
