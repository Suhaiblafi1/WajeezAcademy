import { chromium } from 'playwright'
const API = 'http://localhost:7101', WEB = 'http://localhost:7100'
const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'student.demo@wajeez.local', password: 'Wajeez-Demo-2026' }) })
const [pair] = res.headers.get('set-cookie').split(';'); const eq = pair.indexOf('=')
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await ctx.addCookies([{ name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: 'localhost', path: '/' }])
const page = await ctx.newPage()
for (const p of ['/student', '/student/learning', '/student/cohorts']) {
  await page.goto(`${WEB}${p}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
  const ov = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
  console.log(`${ov ? '⚠️ فيض' : '✅'} mobile ${p}`)
  await page.screenshot({ path: `audit/pages/mobile${p.replace(/\//g, '_')}.png` })
}
await browser.close()
