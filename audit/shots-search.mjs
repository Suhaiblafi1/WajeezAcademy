/* لقطة لوحة البحث: فتح بـ Ctrl+K وكتابة استعلام حقيقي */
import { chromium } from 'playwright'

const API = 'http://localhost:7101'
const WEB = 'http://localhost:7100'

const res = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'superadmin.demo@wajeez.local', password: 'Wajeez-Demo-2026' }),
})
if (!res.ok) throw new Error(`login ${res.status}`)
const [pair] = res.headers.get('set-cookie').split(';')
const eq = pair.indexOf('=')

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
await ctx.addCookies([{ name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: 'localhost', path: '/' }])
const page = await ctx.newPage()
await page.goto(`${WEB}/admin`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.keyboard.press('Control+k')
await page.waitForTimeout(500)
await page.keyboard.type('رامي', { delay: 60 })
// انتظار شرطي: ظهور صف نتيجة فعلي بدل مهلة ثابتة
await page.getByText('رامي العبداللات').first().waitFor({ timeout: 6000 })
await page.waitForTimeout(300)
await page.screenshot({ path: 'audit/shot-search-palette.png' })
const visible = await page.getByPlaceholder(/ابحث/).isVisible()
console.log(visible ? '✅ اللوحة ظاهرة بنتائج' : '❌ اللوحة لم تظهر')
await browser.close()
