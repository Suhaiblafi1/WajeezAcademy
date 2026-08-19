/* لقطة: تبويب مستحقات المدربين بقسمي القواعد والتوليد مفتوحين */
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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 2 })
await ctx.addCookies([{ name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: 'localhost', path: '/' }])
const page = await ctx.newPage()
await page.goto(`${WEB}/admin/trainers`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'مستحقات المدربين' }).click()
await page.waitForTimeout(1000)
await page.getByRole('button', { name: /قواعد الأتعاب/ }).click()
await page.getByRole('button', { name: /توليد تلقائي/ }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: 'audit/shot-admin-payouts-rules.png', fullPage: true })
await browser.close()
console.log('done')
