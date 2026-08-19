/* تحقق توحيد بوابة الطالب: حقيقي (ليان) + ديمو (معاينة) */
import { chromium } from 'playwright'

const API = 'http://localhost:7101'
const WEB = 'http://localhost:7100'

const res = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'student.demo@wajeez.local', password: 'Wajeez-Demo-2026' }),
})
if (!res.ok) throw new Error(`login ${res.status}`)
const [pair] = res.headers.get('set-cookie').split(';')
const eq = pair.indexOf('=')

const browser = await chromium.launch()

/* ── 1) الطالب الحقيقي: لوحتي يجب أن تعرض بيانات الخادم ── */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
await ctx.addCookies([{ name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: 'localhost', path: '/' }])
const page = await ctx.newPage()
await page.goto(`${WEB}/student`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const dashText = await page.locator('#main-content main').innerText()
console.log('REAL-DASH has real name:', dashText.includes('ليان') || (await page.locator('h1').innerText()).includes('ليان'))
console.log('REAL-DASH has real cohort:', dashText.includes('الأتمتة'))
console.log('REAL-DASH no fake advisor:', !dashText.includes('العتيبي'))
console.log('REAL-DASH header:', await page.locator('h1').first().innerText())
await page.getByText('رحلتك الحقيقية').waitFor({ timeout: 5000 })
await page.screenshot({ path: 'audit/shot-portal-real-dash.png', fullPage: false })

/* ── 2) تعلّمي داخل إطار البوابة ── */
await page.goto(`${WEB}/student/learning`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const learnText = await page.locator('body').innerText()
console.log('LEARNING has portal nav (لوحتي):', learnText.includes('لوحتي'))
console.log('LEARNING has real cohort:', learnText.includes('شعبة اختبار إشعارات الطالب') || learnText.includes('الأتمتة'))
await page.screenshot({ path: 'audit/shot-portal-real-learning.png' })
await ctx.close()

/* ── 3) وضع الديمو/المعاينة: المحاكاة ما زالت تعمل ── */
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
const page2 = await ctx2.newPage()
await page2.goto(`${WEB}/student?preview=owner`, { waitUntil: 'networkidle' })
await page2.waitForTimeout(1200)
const demoText = await page2.locator('#main-content main').innerText()
console.log('DEMO-DASH simulated:', demoText.includes('مسارك النشط'))
console.log('DEMO-DASH preview badge:', demoText.includes('وضع المعاينة'))
await page2.screenshot({ path: 'audit/shot-portal-demo-dash.png' })
await ctx2.close()

await browser.close()
console.log('DONE')

/* ── تحقق إضافي: المعاينة تستمر عبر التنقل ── */
const b2 = await chromium.launch()
const c3 = await b2.newContext()
const p3 = await c3.newPage()
await p3.goto(`${WEB}/student?preview=owner`, { waitUntil: 'networkidle' })
await p3.waitForTimeout(800)
await p3.goto(`${WEB}/student/learning`, { waitUntil: 'networkidle' })
await p3.waitForTimeout(800)
const t3 = await p3.locator('body').innerText()
console.log('PREVIEW persists across nav (no lock):', !t3.includes('تُفتح بعد أول دفع'))
console.log('PREVIEW learning shows honest state:', t3.includes('سجّل دخولك') || t3.includes('لا شعب مسجلة'))
await b2.close()
