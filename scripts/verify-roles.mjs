/* فحص End-to-End لأدوار الديمو الخمسة — Playwright.
   المتطلبات قبل التشغيل:
   - خادم API على 7101 مع DEMO_MODE=true و WEB_ORIGIN يشمل منفذ المعاينة.
   - واجهة مبنية بـ VITE_DEMO_MODE=true وتُعرض على 4173 (npm run preview).
   يتحقق: شريط الديمو يظهر ويعمل، كل دور يدخل بوابته بلا أخطاء console مؤثرة،
   عزل الصلاحيات (طالب لا يفتح /api/admin/users)، وصفحة حساب الطالب تحفظ وتسترجع.
   كل اللقطات في verification/roles/ */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const WEB = process.env.BASE_URL ?? 'http://localhost:4173'
const API = process.env.API_URL ?? 'http://localhost:7101'
const OUT = new URL('../verification/roles/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const consoleErrors = []
const watch = (page, tag) => {
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${tag}: ${m.text()} :: ${m.location()?.url ?? ''}`) })
  page.on('pageerror', (e) => consoleErrors.push(`${tag}: ${String(e)}`))
  page.on('response', (r) => { if (r.status() >= 400) consoleErrors.push(`${tag}: HTTP ${r.status()} ${r.url()}`) })
}
const ignorable = (e) => e.includes('favicon') || e.includes('DevTools')

const results = []
const note = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const ROLES = [
  { key: 'student', label: 'طالب', portal: '/student', expectText: 'لوحتي' },
  { key: 'consultant', label: 'مستشار', portal: '/advisor', expectText: 'طلبةي' },
  { key: 'trainer', label: 'مدرب', portal: '/trainer', expectText: 'شعبي' },
  { key: 'admin', label: 'إدارة', portal: '/admin', expectText: 'اللوحة العليا' },
  { key: 'superadmin', label: 'النظام', portal: '/admin', expectText: 'اللوحة العليا' },
]

const browser = await chromium.launch()

/* ١) شريط الديمو يظهر في الواجهة ويؤكد الخادم التفعيل */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  watch(page, 'switcher')
  await page.goto(WEB, { waitUntil: 'networkidle' })
  const bar = page.getByRole('region', { name: 'مبدل أدوار الديمو' })
  note('شريط مبدل الأدوار ظاهر في بناء الديمو', await bar.isVisible().catch(() => false))
  await page.screenshot({ path: `${OUT}/00-switcher-bar.png` })
  await ctx.close()
}

/* ٢) كل دور: تبديل عبر API (كوكي حقيقي) ثم فتح البوابة ولقطة.
      البوابات النموذجية لها بوابات هوية محلية: طالب (علم معاينة) والبقية (بطاقة «من أنت؟») */
for (const role of ROLES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const login = await ctx.request.post(`${API}/api/demo/switch-role`, { data: { role: role.key } })
  note(`تبديل ${role.label} عبر API`, login.ok())
  const page = await ctx.newPage()
  watch(page, role.key)
  if (role.key === 'student') await page.addInitScript(() => localStorage.setItem('wajeez_portal_preview', '1'))
  await page.goto(`${WEB}${role.portal}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  /* بطاقة اختيار الهوية في بوابات المستشار/المدرب/الإدارة */
  const picker = page.getByText(/من أنت؟/).first()
  if (await picker.isVisible().catch(() => false)) {
    await page.locator('main button').first().click()
    await page.waitForTimeout(800)
  }
  const hasError = await page.getByText(/خطأ غير متوقع|صفحة غير موجودة/i).first().isVisible().catch(() => false)
  const hasContent = await page.getByText(role.expectText).first().isVisible().catch(() => false)
  note(`بوابة ${role.label} تفتح بلا صفحة خطأ وتعرض محتواها`, !hasError && hasContent, hasContent ? '' : `لم يظهر النص المتوقع «${role.expectText}»`)
  await page.screenshot({ path: `${OUT}/role-${role.key}.png`, fullPage: false })
  await ctx.close()
}

/* ٣) عزل الصلاحيات: جلسة طالب ديمو لا تفتح قائمة مستخدمي الإدارة */
{
  const ctx = await browser.newContext()
  await ctx.request.post(`${API}/api/demo/switch-role`, { data: { role: 'student' } })
  const forbidden = await ctx.request.get(`${API}/api/admin/users`)
  note('طالب الديمو ممنوع من /api/admin/users', forbidden.status() === 403 || forbidden.status() === 401, `HTTP ${forbidden.status()}`)
  await ctx.close()
}

/* ٤) صفحة حساب الطالب: تحميل من القاعدة ثم حفظ واسترجاع */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.request.post(`${API}/api/demo/switch-role`, { data: { role: 'student' } })
  const page = await ctx.newPage()
  watch(page, 'account')
  await page.addInitScript(() => localStorage.setItem('wajeez_portal_preview', '1'))
  await page.goto(`${WEB}/student/account`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const cityField = page.getByLabel('المدينة')
  const loaded = await cityField.inputValue().catch(() => '')
  note('حساب الطالب يحمّل المدينة من القاعدة', loaded === 'عمّان', `القيمة: «${loaded}»`)
  if (loaded) {
    await cityField.fill('إربد')
    await page.getByRole('button', { name: /احفظ ملفي/ }).first().click()
    await page.waitForTimeout(1200)
    await page.reload({ waitUntil: 'networkidle' })
    const after = await page.getByLabel('المدينة').inputValue().catch(() => '')
    note('الحفظ يسترجع بعد إعادة التحميل', after === 'إربد', `القيمة: «${after}»`)
    /* إعادة القيمة الأصلية */
    await page.getByLabel('المدينة').fill('عمّان')
    await page.getByRole('button', { name: /احفظ ملفي/ }).first().click()
    await page.waitForTimeout(800)
  }
  await page.screenshot({ path: `${OUT}/student-account.png` })
  await ctx.close()
}

await browser.close()

const blocking = consoleErrors.filter((e) => !ignorable(e))
if (blocking.length) { console.log('\nأخطاء console مؤثرة:'); blocking.forEach((e) => console.log('  ✗', e)) }
const failed = results.filter((r) => !r.ok)
console.log(`\n${failed.length === 0 && blocking.length === 0 ? '✅ فحص الأدوار ناجح' : '✗ فشل'} — ${results.length - failed.length}/${results.length} ناجحة، أخطاء console: ${blocking.length}`)
process.exit(failed.length === 0 && blocking.length === 0 ? 0 : 1)
