/* الرحلاتُ التفاعليّة العشر — لقطاتٌ قبل/بعد، وعدُّ الضغطات، وتسجيلُ ما شُوهد فعلا.

   تكمّل `tour.mjs` (الذي يصوّر الشاشات ساكنةً): هنا نضغط ونكتب ونرسل، ونسجّل
   ما حدث كما ظهر للمستخدم — لا كما تقول الشيفرة. كلُّ خطوةٍ محاطةٌ بـtry:
   إخفاقُ خطوةٍ نتيجةٌ تُدوَّن لا خطأٌ يوقف الجولة.

   الاستعمال (الخادم 7101، الواجهة 3000، الديمو مبذور مع البذر الإضافيّ):
     PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/tour/journeys.mjs
   خيار: TOUR_ONLY=J1,J5 */

import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const API = process.env.TOUR_API ?? 'http://localhost:7101'
const WEB = process.env.TOUR_WEB ?? 'http://localhost:3000'
const OUT = process.env.TOUR_OUT ?? 'docs/audit-2026-09/tour/journeys'
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Wajeez-Demo-2026'
const ONLY = process.env.TOUR_ONLY?.split(',').map((s) => s.trim()).filter(Boolean)
const ACC = {
  student: 'student.demo@wajeez.local', trainer: 'trainer.demo@wajeez.local', consultant: 'consultant.demo@wajeez.local',
  academic: 'admin.demo@wajeez.local', superadmin: 'superadmin.demo@wajeez.local',
  operations: 'operations.demo@wajeez.local', diagnostics: 'diagnostics.demo@wajeez.local', finance: 'finance.demo@wajeez.local', support: 'support.demo@wajeez.local',
}

mkdirSync(OUT, { recursive: true })
/* لا شيءَ يخرج من المتصفّح إلى الإنترنت: الخطوطُ وخدماتُ Google تُوقَف عند
   الحدّ، وإلّا انتظرت كلُّ صفحةٍ وكيلَ الشبكة في هذه البيئة عشراتَ الثواني. */
const browser = await chromium.launch({ executablePath: process.env.TOUR_CHROME ?? '/opt/pw-browsers/chromium', args: ['--no-proxy-server', '--disable-background-networking', '--disable-component-update'] })
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//
async function sealContext(ctx) { await ctx.route('**/*', (route) => (LOCAL.test(route.request().url()) ? route.continue() : route.abort('blockedbyclient'))) }
const log = []
let shotNo = 0

async function apiLogin(email) {
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) })
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`)
  const [pair] = (res.headers.get('set-cookie') ?? '').split(';'); const eq = pair.indexOf('=')
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: 'localhost', path: '/' }
}
async function apiAs(cookie, method, path, body) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', cookie: `${cookie.name}=${cookie.value}` }, body: body ? JSON.stringify(body) : undefined })
  let json = null; try { json = await res.json() } catch {}
  return { status: res.status, json }
}
async function ctxAs(role, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, locale: 'ar' })
  await sealContext(ctx)
  let cookie = null
  if (role) { cookie = await apiLogin(ACC[role]); await ctx.addCookies([cookie]) }
  return { ctx, cookie }
}
const T = (s) => (s ?? '').replace(/\s+/g, ' ').trim()

/* الخطوة: تُنفَّذ، تُصوَّر، تُدوَّن — بلا أن توقف ما بعدها */
function journey(id, titleAr) {
  const rec = { id, titleAr, steps: [], clicks: 0, startedAt: Date.now() }
  log.push(rec)
  return {
    rec,
    async step(page, name, fn) {
      const s = { name, ok: true, note: '', shot: null, consoleErrs: [], api: [] }
      const onConsole = (m) => { if (m.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT/.test(m.text())) s.consoleErrs.push(m.text().slice(0, 160)) }
      const onResp = (r) => { if (r.url().includes('/api/') && r.request().method() !== 'GET') s.api.push(`${r.request().method()} ${r.url().replace(API, '').replace(WEB, '')} → ${r.status()}`) }
      page.on('console', onConsole); page.on('response', onResp)
      try { const out = await fn(); if (typeof out === 'string') s.note = out; else if (out && typeof out === 'object') Object.assign(s, out) }
      catch (e) { s.ok = false; s.note = `✗ ${String(e?.message ?? e).slice(0, 220)}` }
      finally {
        page.off('console', onConsole); page.off('response', onResp)
        await page.waitForTimeout(500)
        const file = join(OUT, `${id}-${String(++shotNo).padStart(2, '0')}-${name.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40)}.jpg`)
        await page.screenshot({ path: file, type: 'jpeg', quality: 68 }).catch(() => {})
        s.shot = file
        rec.steps.push(s)
        console.log(`${s.ok ? '  ✓' : '  ✗'} ${id} ${name}${s.note ? ' — ' + T(s.note).slice(0, 120) : ''}`)
      }
    },
    click: () => { rec.clicks++ },
  }
}
const want = (id) => !ONLY || ONLY.includes(id)

/* ───────── J1 · الزائر: تشخيصٌ كامل → المسار → لوحُ الشراء → دفعٌ تجريبيّ ───────── */
if (want('J1')) {
  const J = journey('J1', 'من التشخيص إلى الشراء التجريبيّ')
  const { ctx } = await ctxAs(null)
  const page = await ctx.newPage()
  await J.step(page, 'فتح التشخيص', async () => { await page.goto(`${WEB}/diagnostic`, { waitUntil: 'networkidle' }); await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle' }); return T(await page.locator('h1').first().innerText().catch(() => '')) })
  await J.step(page, 'بدء الحديث', async () => {
    const b = page.getByRole('button', { name: /ابدأ/ }).first(); await b.click(); J.click(); await page.waitForTimeout(800)
    return T(await page.locator('body').innerText()).slice(0, 160)
  })
  let steps = 0, ended = false, sawPathway = false
  await J.step(page, 'الإجابة حتّى النهاية', async () => {
    for (; steps < 30 && !ended; steps++) {
      await page.waitForTimeout(400)
      const body = T(await page.locator('body').innerText())
      if (/مسارك|المسار المقترح|توصيتنا|نرشّح|رشّحنا|خطّتك/.test(body) && !/السؤال/.test(body.slice(0, 400))) { ended = true; sawPathway = true; break }
      const skip = page.getByRole('button', { name: /تخطَّ/ })
      if (await skip.isVisible().catch(() => false)) { await skip.click(); J.click(); continue }
      const rating = page.locator('button[aria-label*="مستوى 3"]')
      if (await rating.first().isVisible().catch(() => false)) { const n = await rating.count(); for (let j = 0; j < n; j++) { await rating.nth(j).click(); J.click() } const nx = page.getByRole('button', { name: /متابعة/ }); if (await nx.isVisible().catch(() => false)) { await nx.click(); J.click() } continue }
      const opts = page.locator('div.grid.gap-3 > button')
      if (await opts.first().isVisible().catch(() => false)) {
        const n = await opts.count(); let picked = 0
        for (let j = 0; j < n; j++) { const t = (await opts.nth(j).textContent()) ?? ''; if (t.includes('من 25 إلى 34')) { picked = j; break } }
        await opts.nth(picked).click(); J.click(); await page.waitForTimeout(250)
        const nx = page.getByRole('button', { name: /متابعة/ })
        if ((await nx.isVisible().catch(() => false)) && (await nx.isEnabled().catch(() => false))) { await nx.click(); J.click() }
        continue
      }
      const any = page.getByRole('button', { name: /متابعة|التالي|أظهر|اعرض/ }).first()
      if (await any.isVisible().catch(() => false)) { await any.click(); J.click(); continue }
      break
    }
    return `أسئلة/خطوات: ${steps} · انتهى؟ ${ended} · ظهرت التوصية؟ ${sawPathway}`
  })
  await J.step(page, 'شاشة النتيجة', async () => T(await page.locator('body').innerText()).slice(0, 300))
  await J.step(page, 'الوصول إلى لوح الشراء', async () => {
    const link = page.getByRole('link', { name: /المسار|افتح|اعرض|ابدأ|التفاصيل/ }).first()
    if (await link.isVisible().catch(() => false)) { await link.click(); J.click(); await page.waitForLoadState('networkidle') }
    const buy = page.getByRole('button', { name: /ادفع الآن|اشتر|سجّل الآن|اطلب/ }).first()
    const seen = await buy.isVisible().catch(() => false)
    return `${page.url().replace(WEB, '')} · زرُّ الشراء ظاهر؟ ${seen}${seen ? ' «' + T(await buy.innerText()) + '»' : ''}`
  })
  await J.step(page, 'ضغطُ الشراء بلا حساب', async () => {
    const buy = page.getByRole('button', { name: /ادفع الآن|اشتر|سجّل الآن|اطلب/ }).first()
    if (!(await buy.isVisible().catch(() => false))) return 'لا زرَّ شراء في هذه الصفحة'
    await buy.click(); J.click(); await page.waitForTimeout(1200)
    return `${page.url().replace(WEB, '')} · ${T(await page.locator('body').innerText()).slice(0, 200)}`
  })
  await ctx.close()
  /* الشراءُ نفسُه بحساب الطالب عبر الواجهة البرمجيّة (المزوّد test) — لقياس ما يحدث بعد «الدفع» */
  const { ctx: c2, cookie } = await ctxAs('student')
  const p2 = await c2.newPage()
  await J.step(p2, 'الشراء بحساب الطالب (test)', async () => {
    const cohorts = await apiAs(cookie, 'GET', '/api/public/cohorts')
    const list = Array.isArray(cohorts.json) ? cohorts.json : (cohorts.json?.cohorts ?? [])
    const open = list.find((c) => c.status === 'open' || c.registrationOpen)
    if (!open) return `لا شعبةً مفتوحةً للشراء (${list.length} شعبة في القائمة)`
    const q = await apiAs(cookie, 'POST', '/api/learner/checkout/quote', { cohortIds: [open.id] })
    const co = await apiAs(cookie, 'POST', '/api/learner/checkout', { cohortIds: [open.id] })
    let pay = null
    if (co.json?.orderId) pay = await apiAs(cookie, 'POST', `/api/learner/orders/${co.json.orderId}/pay`, {})
    await p2.goto(`${WEB}/student/learning?paid=1`, { waitUntil: 'networkidle' }); await p2.waitForTimeout(1200)
    return `quote ${q.status} · checkout ${co.status} ${co.json?.orderId ? 'order ✓' : JSON.stringify(co.json).slice(0, 120)} · pay ${pay?.status ?? '-'} ${JSON.stringify(pay?.json ?? '').slice(0, 160)}`
  })
  await c2.close()
}

/* ───────── J2 · الطالب: الوحدةُ ذات المتن والفيديو والتفتيش ───────── */
if (want('J2')) {
  const J = journey('J2', 'الوحدة: المتن والفيديو داخل الصفحة')
  const { ctx } = await ctxAs('student'); const page = await ctx.newPage()
  await J.step(page, 'فتح الوحدة الأولى', async () => { await page.goto(`${WEB}/student/course/C-AUT-101/module/C-AUT-101-M1`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); return `${page.url().replace(WEB, '')} · «${T(await page.locator('h1').first().innerText().catch(() => ''))}»` })
  await J.step(page, 'هل الفيديو مُدمَج؟', async () => { const n = await page.locator('iframe').count(); const src = n ? await page.locator('iframe').first().getAttribute('src') : null; return `iframes: ${n}${src ? ' · ' + src.slice(0, 80) : ''}` })
  await J.step(page, 'فتح فصلٍ من الفيديو', async () => { const ch = page.locator('ol button').first(); if (!(await ch.isVisible().catch(() => false))) return 'لا فصولَ ظاهرة'; await ch.click(); J.click(); return 'ضُغط الفصل' })
  await J.step(page, 'تفتيشٌ بعد الفصل', async () => { const b = page.getByRole('button', { name: /تفتيش/ }).first(); if (!(await b.isVisible().catch(() => false))) return 'لا زرَّ تفتيش'; await b.click(); J.click(); await page.waitForTimeout(400); const opt = page.locator('button:has-text("أ)"), [role=radio], fieldset button').first(); if (await opt.isVisible().catch(() => false)) { await opt.click(); J.click() } return T(await page.locator('body').innerText()).slice(0, 160) })
  await J.step(page, 'المتن والتمارين — طولُ الصفحة', async () => { const h = await page.evaluate(() => document.documentElement.scrollHeight); const words = T(await page.locator('main').innerText().catch(() => '')).split(' ').length; return `ارتفاع ${h}px · ${words} كلمة` })
  await ctx.close()
}

/* ───────── J3 · الطالب: «ادخل الجلسة» ───────── */
if (want('J3')) {
  const J = journey('J3', 'الجلسة القادمة ورابطُ الدخول')
  const { ctx } = await ctxAs('student'); const page = await ctx.newPage()
  await J.step(page, 'لوحة الطالب — التالي الآن', async () => { await page.goto(`${WEB}/student`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); const n = page.getByText(/التالي الآن/).first(); return (await n.isVisible().catch(() => false)) ? 'بطاقةُ «التالي الآن» ظاهرة' : 'لا بطاقةَ «التالي الآن»' })
  await J.step(page, 'رابط الانضمام', async () => { const a = page.getByRole('link', { name: /انضم الآن|ادخل الجلسة/ }).first(); if (!(await a.isVisible().catch(() => false))) return 'لا رابطَ جلسةٍ في اللوحة'; return `href=${await a.getAttribute('href')} target=${await a.getAttribute('target')}` })
  await J.step(page, 'رحلة التعلّم — الجلسات', async () => { await page.goto(`${WEB}/student/learning`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); const a = page.getByRole('link', { name: /ادخل الجلسة|انضم/ }).first(); const vis = await a.isVisible().catch(() => false); return `${vis ? 'زرُّ الجلسة ظاهر · ' + (await a.getAttribute('href')) : 'لا زرَّ جلسة'} · رمزُ مرورٍ ظاهر؟ ${/رمز المرور/.test(await page.locator('body').innerText())}` })
  await ctx.close()
}

/* ───────── J4 · الطالب: تذكرةُ دعم + طلبُ شهادة ───────── */
if (want('J4')) {
  const J = journey('J4', 'تذكرةُ دعم وطلبُ شهادة')
  const { ctx } = await ctxAs('student'); const page = await ctx.newPage()
  await J.step(page, 'فتح الدعم', async () => { await page.goto(`${WEB}/student/support`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800); return T(await page.locator('h1').first().innerText().catch(() => '')) })
  await J.step(page, 'فتح نموذج التذكرة', async () => { await page.getByRole('button', { name: /تذكرة جديدة|أنشئ|جديدة/ }).first().click(); J.click(); await page.waitForTimeout(300); return 'فُتح' })
  await J.step(page, 'تعبئةٌ وإرسال', async () => {
    await page.getByPlaceholder('الموضوع').fill('زرُّ الجلسة لا يعمل على هاتفي — تذكرةُ الجولة'); J.click()
    await page.locator('select').first().selectOption('technical'); J.click()
    await page.getByPlaceholder(/اشرح المشكلة/).fill('حين أضغط «ادخل الجلسة» على هاتفي لا يحدث شيء. جرّبتُ مرّتين.'); J.click()
    await page.getByRole('button', { name: /أرسل|إرسال|افتح التذكرة/ }).first().click(); J.click(); await page.waitForTimeout(1500)
    return T(await page.locator('body').innerText()).slice(0, 220)
  })
  await J.step(page, 'طلبُ شهادة من الرحلة', async () => {
    await page.goto(`${WEB}/student/learning`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
    const b = page.getByRole('button', { name: /اطلب شهادة|اطلب التوصية/ }).first()
    if (!(await b.isVisible().catch(() => false))) return 'لا زرَّ طلبِ شهادةٍ ظاهر في هذه المرحلة'
    const label = T(await b.innerText()); await b.click(); J.click(); await page.waitForTimeout(1500)
    return `«${label}» → ${T(await page.locator('body').innerText()).slice(0, 200)}`
  })
  await ctx.close()
}

/* ───────── J5 · المدرّب: حضورٌ، اقتراحُ تأجيل، رفعُ تسجيل ───────── */
if (want('J5')) {
  const J = journey('J5', 'لوحُ الشعبة: حضور وتأجيل ورفع تسجيل')
  const { ctx } = await ctxAs('trainer'); const page = await ctx.newPage()
  await J.step(page, 'فتح لوح الشعبة', async () => { await page.goto(`${WEB}/trainer/board`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); const first = page.locator('button.flex.w-full').first(); if (await first.isVisible().catch(() => false)) { await first.click(); J.click(); await page.waitForTimeout(800) } return T(await page.locator('h1').first().innerText().catch(() => '')) })
  await J.step(page, 'تسجيل حضور', async () => { const b = page.getByRole('button', { name: /^حاضر$|حضر/ }).first(); if (!(await b.isVisible().catch(() => false))) return 'لا شبكةَ حضورٍ ظاهرة'; await b.click(); J.click(); await page.waitForTimeout(900); return T(await page.locator('body').innerText()).match(/سُجل الحضور[^\n]*/)?.[0] ?? 'ضُغط — بلا رسالة تأكيد ظاهرة' })
  await J.step(page, 'اقتراح موعد', async () => {
    const b = page.getByRole('button', { name: /اقترح موعدا/ }).first(); if (!(await b.isVisible().catch(() => false))) return 'لا زرَّ اقتراحٍ (كلُّ الجلسات منتهية؟)'
    await b.click(); J.click(); await page.waitForTimeout(300)
    const dt = page.locator('input[type="datetime-local"]').first(); if (await dt.isVisible().catch(() => false)) { const d = new Date(Date.now() + 9 * 86400_000); await dt.fill(d.toISOString().slice(0, 16)); J.click() }
    await page.getByPlaceholder(/سفر في موعد الجلسة/).fill('تعارضٌ مع دورةٍ أخرى في التاريخ نفسه — اقتراحُ الجولة'); J.click()
    await page.getByRole('button', { name: /أرسل الاقتراح|اقترح|إرسال/ }).first().click(); J.click(); await page.waitForTimeout(1200)
    return T(await page.locator('body').innerText()).match(/(أُرسل|اقتراح)[^\n]{0,120}/)?.[0] ?? T(await page.locator('body').innerText()).slice(0, 160)
  })
  await J.step(page, 'رفعُ تسجيل (ملفّ صغير)', async () => {
    const input = page.locator('input[type="file"][accept="video/*"]').first()
    if (!(await input.count())) return 'لا حقلَ رفعٍ'
    await input.setInputFiles({ name: 'demo-recording.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(64 * 1024, 1) }); J.click()
    await page.waitForTimeout(2500)
    const body = T(await page.locator('body').innerText())
    return body.match(/(سُجل التسجيل|تعذر رفع|خطأ|فشل)[^\n]{0,140}/)?.[0] ?? 'لا رسالةَ نتيجةٍ ظاهرة'
  })
  await J.step(page, 'رفعُ مادّةٍ (رابط)', async () => {
    const t = page.getByLabel('عنوان الرابط').first(); if (!(await t.isVisible().catch(() => false))) return 'لا نموذجَ موادّ ظاهرا'
    await t.fill('مرجعٌ خارجيّ — الجولة'); await page.getByLabel('رابط المادة').fill('https://example.org/ref.pdf'); J.click(); J.click()
    await page.getByRole('button', { name: /أضف الرابط|أضف/ }).first().click(); J.click(); await page.waitForTimeout(1000)
    return T(await page.locator('body').innerText()).match(/(أُضيف|تعذر|خطأ)[^\n]{0,120}/)?.[0] ?? 'بلا رسالة'
  })
  await ctx.close()
}

/* ───────── J6 · المدرّب: طابورُ التصحيح ───────── */
if (want('J6')) {
  const J = journey('J6', 'تصحيحُ تسليمٍ منتظر')
  const { ctx } = await ctxAs('trainer'); const page = await ctx.newPage()
  await J.step(page, 'فتح طابور التصحيح', async () => { await page.goto(`${WEB}/trainer/grading`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); return T(await page.locator('body').innerText()).slice(0, 200) })
  await J.step(page, 'بدءُ المراجعة', async () => { const b = page.getByRole('button', { name: /ابدأ المراجعة|بدء/ }).first(); if (!(await b.isVisible().catch(() => false))) return 'لا تسليمَ منتظرا'; await b.click(); J.click(); await page.waitForTimeout(900); return 'بدأت' })
  await J.step(page, 'درجةٌ وقبول', async () => {
    const g = page.locator('input[placeholder^="من "]').first(); if (await g.isVisible().catch(() => false)) { await g.fill('17'); J.click(); const gb = page.getByRole('button', { name: /سجّل الدرجة|احفظ الدرجة|الدرجة/ }).first(); if (await gb.isVisible().catch(() => false)) { await gb.click(); J.click(); await page.waitForTimeout(800) } }
    const note = page.getByPlaceholder(/ملاحظة للمتعلم/).first(); if (await note.isVisible().catch(() => false)) { await note.fill('تقديرٌ واقعيّ، أحسنت.'); J.click() }
    const acc = page.getByRole('button', { name: /^قبول$|اقبل|قبول/ }).first(); if (await acc.isVisible().catch(() => false)) { await acc.click(); J.click(); await page.waitForTimeout(1000) }
    return T(await page.locator('body').innerText()).match(/(قُبل|خطأ|تعذر)[^\n]{0,120}/)?.[0] ?? T(await page.locator('body').innerText()).slice(0, 160)
  })
  await ctx.close()
}

/* ───────── J7 · الأكاديميّ: إنشاءُ شعبةٍ وجلسةٍ وتسجيلٌ وربطُ Zoom ───────── */
if (want('J7')) {
  const J = journey('J7', 'إنشاء شعبة: الحقول والمعرّفات')
  const { ctx, cookie } = await ctxAs('academic'); const page = await ctx.newPage()
  let studentId = null
  await J.step(page, 'فتح الشعب وعدُّ حقول النموذج', async () => {
    await page.goto(`${WEB}/admin/cohorts`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
    await page.getByRole('button', { name: /شعبة جديدة/ }).first().click(); J.click(); await page.waitForTimeout(400)
    const form = page.locator('div.mt-4.grid')
    const inputs = await form.locator('input, select').count(); const labels = await form.locator('label').allInnerTexts()
    return `حقول: ${inputs} · التسميات: ${labels.map((l) => T(l).split(' ').slice(0, 3).join(' ')).join(' | ')}`
  })
  await J.step(page, 'تعبئةُ النموذج وإنشاءُ المسودة', async () => {
    const sel = page.locator('div.mt-4.grid select').first(); const opts = await sel.locator('option').allTextContents()
    await sel.selectOption({ index: 1 }); J.click()
    await page.getByPlaceholder(/شعبة أكتوبر/).fill('شعبةُ الجولة — مسائية'); J.click()
    const nums = page.locator('div.mt-4.grid input[type="number"]'); await nums.nth(0).fill('20'); J.click(); await nums.nth(1).fill('180'); J.click()
    const days = page.locator('div.mt-4.grid button').filter({ hasText: /^(الأحد|الثلاثاء|الاثنين)$/ }); const dn = await days.count(); for (let i = 0; i < Math.min(2, dn); i++) { await days.nth(i).click(); J.click() }
    const time = page.locator('div.mt-4.grid input[type="time"]').first(); if (await time.isVisible().catch(() => false)) { await time.fill('18:00'); J.click() }
    await page.getByRole('button', { name: /أنشئ المسودة/ }).click(); J.click(); await page.waitForTimeout(1500)
    return `دورات في القائمة: ${opts.length - 1} · ${T(await page.locator('body').innerText()).match(/(أُنشئت|أُنشئ|خطأ|تعذر)[^\n]{0,120}/)?.[0] ?? 'بلا رسالة'}`
  })
  await J.step(page, 'فتح الشعبة الجديدة وإضافةُ جلسة', async () => {
    const row = page.getByRole('button', { name: /شعبةُ الجولة/ }).first(); if (!(await row.isVisible().catch(() => false))) return 'الشعبةُ الجديدة غيرُ ظاهرة في القائمة'
    await row.click(); J.click(); await page.waitForTimeout(800)
    await page.getByPlaceholder('عنوان الجلسة').first().fill('الجلسة الأولى — الجولة'); J.click()
    const d = page.locator('input[type="datetime-local"], input[type="date"]').first(); if (await d.isVisible().catch(() => false)) { const dt = new Date(Date.now() + 5 * 86400_000); await d.fill((await d.getAttribute('type')) === 'date' ? dt.toISOString().slice(0, 10) : dt.toISOString().slice(0, 16)); J.click() }
    const add = page.getByRole('button', { name: /أضف الجلسة|أضِف جلسة|إضافة/ }).first(); if (await add.isVisible().catch(() => false)) { await add.click(); J.click(); await page.waitForTimeout(1000) }
    return T(await page.locator('body').innerText()).match(/(أُضيفت|أُنشئت|خطأ|تعذر)[^\n]{0,100}/)?.[0] ?? 'بلا رسالة تأكيد'
  })
  await J.step(page, 'تسجيلُ طالبٍ — الحقلُ يطلب UUID', async () => {
    const users = await apiAs(cookie, 'GET', '/api/admin/users'); const st = (users.json ?? []).find?.((u) => u.email === ACC.student); studentId = st?.id ?? null
    const inp = page.getByPlaceholder(/معرف المستخدم/).first(); if (!(await inp.isVisible().catch(() => false))) return 'لا حقلَ تسجيلٍ ظاهرا'
    await inp.fill(studentId ?? ''); J.click(); await inp.locator('xpath=following::button[1]').click().catch(() => {}); J.click(); await page.waitForTimeout(1200)
    return `الحقل يطلب UUID (placeholder «معرف المستخدم (UUID)») · ${T(await page.locator('body').innerText()).match(/(سُجل|سُجِّل|خطأ|تعذر|مسجَّل)[^\n]{0,120}/)?.[0] ?? 'بلا رسالة'}`
  })
  await J.step(page, 'ربطُ Zoom — الحقلُ يطلب معرّف الجلسة', async () => {
    const sid = page.getByPlaceholder(/معرف الجلسة/).first(); if (!(await sid.isVisible().catch(() => false))) return 'نموذجُ Zoom غيرُ ظاهر'
    const cohorts = await apiAs(cookie, 'GET', '/api/admin/cohorts'); const list = Array.isArray(cohorts.json) ? cohorts.json : (cohorts.json?.cohorts ?? [])
    const mine = list.find((c) => /الجولة/.test(c.title)); const sessionId = mine?.sessions?.[0]?.id ?? ''
    await sid.fill(sessionId); await page.getByPlaceholder(/رابط الانضمام/).fill('https://zoom.us/j/99999999999?pwd=tour'); await page.getByPlaceholder('رمز المرور').fill('123456'); J.click(); J.click(); J.click()
    await page.getByRole('button', { name: /احفظ|اربط|أضف/ }).last().click().catch(() => {}); J.click(); await page.waitForTimeout(1200)
    return `معرّفُ الجلسة ${sessionId ? 'وُجد عبر الواجهة البرمجيّة' : 'غيرُ متاح على الشاشة'} · ${T(await page.locator('body').innerText()).match(/(رُبط|حُفظ|خطأ|تعذر|أُضيف)[^\n]{0,100}/)?.[0] ?? 'بلا رسالة'}`
  })
  await ctx.close()
}

/* ───────── J8 · الأكاديميّ: اعتمادُ التأجيل وطلبُ الشهادة ───────── */
if (want('J8')) {
  const J = journey('J8', 'الاعتمادات: تأجيلٌ وشهادة')
  const { ctx } = await ctxAs('academic'); const page = await ctx.newPage()
  await J.step(page, 'اقتراحاتُ التأجيل في الشعب', async () => { await page.goto(`${WEB}/admin/cohorts`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); const n = await page.getByLabel(/تعليق على اقتراح/).count(); return `اقتراحاتٌ معلّقة: ${n}` })
  await J.step(page, 'اعتمادُ اقتراح', async () => { const c = page.getByLabel(/تعليق على اقتراح/).first(); if (!(await c.isVisible().catch(() => false))) return 'لا اقتراحَ معلّقا'; await c.fill('موافق — بلّغ الطلبة'); J.click(); await page.getByRole('button', { name: /اعتمد|موافقة|قبول/ }).first().click(); J.click(); await page.waitForTimeout(1200); return T(await page.locator('body').innerText()).match(/(اعتُمد|حُرِّك|أُبلغ|خطأ|تعذر)[^\n]{0,120}/)?.[0] ?? 'بلا رسالة' })
  await J.step(page, 'طلباتُ المتعلّمين', async () => { await page.goto(`${WEB}/admin/learner-requests`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); return T(await page.locator('body').innerText()).slice(0, 240) })
  await J.step(page, 'البتّ في طلب', async () => { const b = page.getByRole('button', { name: /أصدر|نفّذ|وافق|اقبل/ }).first(); if (!(await b.isVisible().catch(() => false))) return 'لا طلبَ يُبتّ فيه'; await b.click(); J.click(); await page.waitForTimeout(1200); return T(await page.locator('body').innerText()).match(/(نُفِّذ|صدرت|أُصدرت|خطأ|تعذر)[^\n]{0,120}/)?.[0] ?? 'بلا رسالة' })
  await ctx.close()
}

/* ───────── J9 · مديرُ النظام: حسابٌ جديد، صلاحيّة، إيقاف، حذف ───────── */
if (want('J9')) {
  const J = journey('J9', 'المستخدمون: دعوةٌ وصلاحيّةٌ وإيقافٌ وحذف')
  const { ctx } = await ctxAs('superadmin'); const page = await ctx.newPage()
  const email = `tour.${Date.now()}@wajeez.local`
  await J.step(page, 'فتح المستخدمين', async () => { await page.goto(`${WEB}/admin/users`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); return T(await page.locator('h1').first().innerText().catch(() => '')) })
  await J.step(page, 'إنشاءُ حساب — ما تقوله الرسالة', async () => {
    const open = page.getByRole('button', { name: /أنشئ حسابا|حساب جديد/ }).first(); if (await open.isVisible().catch(() => false)) { await open.click(); J.click(); await page.waitForTimeout(300) }
    await page.getByLabel('اسم المستخدم الجديد').fill('موظّفُ الجولة'); await page.getByLabel('بريد المستخدم الجديد').fill(email); await page.getByLabel('دور المستخدم الجديد').selectOption({ index: 1 }); J.click(); J.click(); J.click()
    await page.getByRole('button', { name: /أنشئ|إنشاء/ }).last().click(); J.click(); await page.waitForTimeout(1500)
    return T(await page.locator('body').innerText()).match(/(أُنشئ الحساب[^\n]{0,160})/)?.[0] ?? T(await page.locator('body').innerText()).slice(0, 200)
  })
  await J.step(page, 'منحُ صلاحيّةٍ بسبب', async () => {
    await page.getByPlaceholder(/ابحث باسمٍ/).fill('الجولة'); J.click(); await page.waitForTimeout(600)
    const perms = page.getByRole('button', { name: /الصلاحيات|صلاحيّات/ }).first(); if (!(await perms.isVisible().catch(() => false))) return 'لا زرَّ صلاحيّات'
    await perms.click(); J.click(); await page.waitForTimeout(600)
    await page.getByLabel('ابحث في الصلاحيات').fill('reports.view'); await page.getByLabel(/سبب الاستثناء/).fill('تجربةُ الجولة — يُنزع بعدها'); J.click(); J.click()
    const grant = page.getByRole('button', { name: /^منح$|منح/ }).first(); if (await grant.isVisible().catch(() => false)) { await grant.click(); J.click(); await page.waitForTimeout(1000) }
    return T(await page.locator('body').innerText()).match(/(مُنحت|أُضيفت|خطأ|تعذر)[^\n]{0,120}/)?.[0] ?? 'بلا رسالة'
  })
  await J.step(page, 'إيقافٌ ثمّ إعادة', async () => {
    const stop = page.getByRole('button', { name: /^إيقاف$|أوقف|إيقاف الحساب/ }).first(); if (!(await stop.isVisible().catch(() => false))) return 'لا زرَّ إيقاف'
    page.once('dialog', (d) => d.accept()); await stop.click(); J.click(); await page.waitForTimeout(1000)
    const a = T(await page.locator('body').innerText()).match(/(أُوقف|موقوف|خطأ)[^\n]{0,80}/)?.[0] ?? ''
    const back = page.getByRole('button', { name: /رفع الإيقاف|إعادة|أعد/ }).first(); if (await back.isVisible().catch(() => false)) { page.once('dialog', (d) => d.accept()); await back.click(); J.click(); await page.waitForTimeout(1000) }
    return `${a} → ${T(await page.locator('body').innerText()).match(/(أُعيد|نشط|خطأ)[^\n]{0,80}/)?.[0] ?? ''}`
  })
  await J.step(page, 'محاولةُ حذفِ حسابٍ له سجلّ', async () => {
    await page.getByPlaceholder(/ابحث باسمٍ/).fill('student.demo'); J.click(); await page.waitForTimeout(600)
    const del = page.getByRole('button', { name: /حذف نهائي|حذفٌ نهائيّ|حذف/ }).first(); if (!(await del.isVisible().catch(() => false))) return 'لا زرَّ حذف'
    let dialog = ''; page.on('dialog', (d) => { dialog += T(d.message()).slice(0, 200) + ' | '; d.dismiss().catch(() => {}) })
    await del.click(); J.click(); await page.waitForTimeout(1500)
    return `حوار: ${dialog || '—'} · ${T(await page.locator('body').innerText()).match(/(يُرفض|له سجلّ|لا يُحذف|بصمة|خطأ)[^\n]{0,140}/)?.[0] ?? ''}`
  })
  await ctx.close()
}

/* ───────── J10 · الأدوارُ الأربعة: أوّلُ ما يراه كلٌّ منها ───────── */
if (want('J10')) {
  const J = journey('J10', 'الأدوار الإداريّة الأربعة — أوّل شاشة')
  for (const role of ['operations', 'diagnostics', 'finance', 'support']) {
    const { ctx } = await ctxAs(role); const page = await ctx.newPage()
    await J.step(page, `${role}: /admin`, async () => {
      await page.goto(`${WEB}/admin`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
      const body = T(await page.locator('body').innerText())
      const nav = await page.locator('nav a, aside a').allInnerTexts().catch(() => [])
      return `${/لا صلاحيات مفعّلة/.test(body) ? '⛔ «لا صلاحيات مفعّلة»' : 'لوحةٌ ظاهرة'} · بنودُ القائمة: ${nav.map(T).filter(Boolean).slice(0, 12).join(' · ')}`
    })
    await ctx.close()
  }
}

await browser.close()
for (const r of log) r.durationMs = Date.now() - r.startedAt
writeFileSync(join(OUT, 'journeys.json'), JSON.stringify({ generatedAt: new Date().toISOString(), journeys: log }, null, 2))
console.log(`\n═══ ${log.length} رحلات · ${log.reduce((n, r) => n + r.steps.length, 0)} خطوة · ${log.reduce((n, r) => n + r.steps.filter((s) => !s.ok).length, 0)} خطوة متعذّرة ═══`)
