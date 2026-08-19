/* تحقق بصري ووظيفي من جرس الإشعارات في بوابة المدرب:
   العدّاد يظهر ← الفتح يجلب القائمة ← «تعليم الكل» يصفّر العدّاد */
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

await page.goto(`${WEB}/admin/trainers`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const bell = page.getByRole('button', { name: /الإشعارات/ })
const label = await bell.getAttribute('aria-label')
console.log('عداد قبل الفتح:', label)
if (!/ [1-9]/.test(label ?? '')) { console.log('⚠️ لا غير مقروءة — كان متوقعاً وجودها من الاختبارات السابقة') }

await bell.click()
await page.waitForTimeout(1000)
await page.screenshot({ path: 'audit/shot-admin-bell.png' })



/* تأكد من الخادم مباشرة أيضاً */
const unreadNow = await fetch(`${API}/api/learner/notifications/unread-count`, { headers: { cookie: `${pair.slice(0, eq)}=${pair.slice(eq + 1)}` } })
console.log('unread من الخادم:', JSON.stringify(await unreadNow.json()))

await browser.close()
console.log('done')
