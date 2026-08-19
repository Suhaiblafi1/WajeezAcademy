/* لقطات تحقق بصري: شاشة «مستحقاتي» للمدرب + تبويب «مستحقات المدربين» للأدمن */
import { chromium } from 'playwright'

const API = 'http://localhost:7101'
const WEB = 'http://localhost:7100'
const PASS = 'Wajeez-Demo-2026'

async function loginCookie(email) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  })
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`)
  const setCookie = res.headers.get('set-cookie')
  const [pair] = setCookie.split(';')
  const eq = pair.indexOf('=')
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: 'localhost', path: '/' }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
await ctx.addCookies([await loginCookie('trainer.demo@wajeez.local')])
const page = await ctx.newPage()
await page.goto(`${WEB}/trainer/earnings`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.screenshot({ path: 'audit/shot-trainer-earnings.png', fullPage: true })
console.log('trainer earnings:', await page.title())

await ctx.clearCookies()
await ctx.addCookies([await loginCookie('superadmin.demo@wajeez.local')])
await page.goto(`${WEB}/admin/trainers`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const tab = page.getByRole('button', { name: 'مستحقات المدربين' })
await tab.click()
await page.waitForTimeout(1200)
await page.screenshot({ path: 'audit/shot-admin-payouts.png', fullPage: true })

await browser.close()
console.log('done')
