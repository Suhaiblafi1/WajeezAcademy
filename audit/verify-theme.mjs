/* تحقق المظهر الفاتح: تبديل + ثبات عبر إعادة التحميل + لقطات للمظهرين */
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
await page.waitForTimeout(1200)

const themeOf = () => page.evaluate(() => document.documentElement.dataset.theme ?? 'dark')
console.log('initial theme:', await themeOf())

/* تبديل للفاتح */
await page.getByTitle('المظهر الفاتح').click()
await page.waitForTimeout(400)
console.log('after toggle:', await themeOf())
console.log('saved:', await page.evaluate(() => localStorage.getItem('wajeez_theme')))
await page.screenshot({ path: 'audit/shot-light-admin.png' })

/* الثبات عبر إعادة التحميل */
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)
console.log('after reload:', await themeOf())

/* بوابة الطالب بالفاتح أيضا (نفس الاختيار المحفوظ) */
await page.goto(`${WEB}/student`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
console.log('student theme follows:', await themeOf())
await page.screenshot({ path: 'audit/shot-light-student.png' })

/* عودة للداكن ولقطة مرجعية */
await page.getByTitle('المظهر الداكن').click()
await page.waitForTimeout(400)
console.log('back to:', await themeOf())
await page.goto(`${WEB}/admin`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await page.screenshot({ path: 'audit/shot-dark-admin-after.png' })

await browser.close()
console.log('DONE')
