/* تحقق النبضة التلقائية: عد طلبات /api/admin/invoices خلال 100 ثانية على لوحة الإدارة */
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

let invoiceCalls = 0
page.on('request', (r) => { if (r.url().includes('/api/admin/invoices')) invoiceCalls++ })

await page.goto(`${WEB}/admin`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
console.log('calls after load:', invoiceCalls)

/* اللقطة تُظهر سطر «آخر تحديث» */
await page.getByText(/آخر تحديث/).waitFor({ timeout: 8000 })
console.log('timestamp line: ظاهر ✅')
await page.screenshot({ path: 'audit/shot-admin-autorefresh.png' })

/* انتظر نبضتين تقريبا (45ث + هامش) */
await page.waitForTimeout(48_000)
console.log('calls after ~48s:', invoiceCalls)
await page.waitForTimeout(47_000)
console.log('calls after ~95s:', invoiceCalls)
console.log(invoiceCalls >= 3 ? '✅ النبضة تعمل (أولي + خلفيتان على الأقل)' : '⚠️ طلبات أقل من المتوقع')

/* لقطة ثانية: الطابع الزمني يجب أن يتجدد */
await page.screenshot({ path: 'audit/shot-admin-autorefresh-2.png' })
await browser.close()
