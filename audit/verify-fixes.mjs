import { chromium } from 'playwright'
const API = 'http://localhost:7101', WEB = 'http://localhost:7100'
const login = async (email) => {
  const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Wajeez-Demo-2026' }) })
  const [pair] = r.headers.get('set-cookie').split(';'); const eq = pair.indexOf('=')
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1) }
}
const browser = await chromium.launch()
const check = async (email, path, bad, good) => {
  const c = await login(email)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  await ctx.addCookies([{ ...c, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage()
  await p.goto(`${WEB}${path}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200)
  const t = await p.locator('body').innerText()
  console.log(`${path}: لا «${bad}»=${!t.includes(bad)} | فيها «${good}»=${t.includes(good)}`)
  await p.screenshot({ path: `audit/pages/fixed${path.replace(/\//g, '_')}.png` })
  await ctx.close()
}
await check('trainer.demo@wajeez.local', '/trainer/earnings', 'cohort:', 'متعلماً ×')
await check('student.demo@wajeez.local', '/student/cohorts', 'remote', 'عن بعد')
await check('superadmin.demo@wajeez.local', '/admin/catalog', 'pending_academic_review', 'بانتظار مراجعة أكاديمية')
await browser.close()
