/* تحقق سريع: الدخول الحقيقي يتجاوز منتقيات «من أنت؟» في بوابات المستشار والمدرب والأدمن */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = 'http://localhost:7100'
mkdirSync('audit/shots', { recursive: true })

const CASES = [
  ['advisor', 'consultant.demo@wajeez.local', '/advisor'],
  ['advisor-cases', 'consultant.demo@wajeez.local', '/advisor/cases'],
  ['trainer', 'trainer.demo@wajeez.local', '/trainer'],
  ['admin', 'superadmin.demo@wajeez.local', '/admin'],
  ['admin-users', 'superadmin.demo@wajeez.local', '/admin/users'],
  ['admin-quality', 'superadmin.demo@wajeez.local', '/admin/quality'],
  ['student', 'student.demo@wajeez.local', '/student'],
]
const PASS = 'Wajeez-Demo-2026'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.new_page ? await ctx.newPage() : await ctx.newPage()
let fail = 0

for (const [tag, email, route] of CASES) {
  await ctx.clearCookies()
  const res = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email, password: PASS } })
  const loginOk = res.ok()
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const body = await page.evaluate(() => document.body.innerText)
  const picker = body.includes('من أنت؟') || body.includes('اختر حساب')
  const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim() ?? '')
  await page.screenshot({ path: `audit/shots/session-${tag}.png` })
  const status = !loginOk ? '❌ فشل الدخول' : picker ? '❌ ظهر منتقي الهوية' : '✅'
  if (status !== '✅') fail++
  console.log(`${status}  ${tag}  h1=«${h1.slice(0, 50)}»`)
}

await browser.close()
process.exit(fail ? 1 : 0)
