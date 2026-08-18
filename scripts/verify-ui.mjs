/* فحص واجهة فعلي بـ Playwright — يعمل على خادم معاينة مؤقت ثم يُقتل الخادم.
   يشغَّل بـ: node scripts/verify-ui.mjs   (يتطلب: npm i --no-save playwright) */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const OUT = new URL('../verification/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

/* رصد أخطاء console المؤثرة — يتجاهل الضجيج المعروف، ويسجل عنوان المورد الفاشل */
const consoleErrors = []
const watchConsole = (page, tag) => {
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`${tag}: ${msg.text()} :: ${msg.location()?.url ?? ''}`) })
  page.on('pageerror', (err) => consoleErrors.push(`${tag}: ${String(err)}`))
  page.on('response', (res) => { if (res.status() >= 500) consoleErrors.push(`${tag}: HTTP ${res.status()} ${res.url()}`) })
}
const ignorable = (e) => e.includes('favicon') || e.includes('DevTools')

const results = []
const note = (name, ok, extra = '') => {
  results.push({ name, ok, extra })
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function noHScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
}

/* يجيب عن السؤال الظاهر — يتجنب خيار القاصر ليكمل التشخيص فعليا */
async function answerCurrent(page) {
  const skip = page.getByRole('button', { name: 'تخطَّ هذا السؤال' })
  if (await skip.isVisible().catch(() => false)) { await skip.click(); return 'skip' }
  const rating = page.locator('button[aria-label*="مستوى 3"]')
  if (await rating.first().isVisible().catch(() => false)) {
    const n = await rating.count()
    for (let j = 0; j < n; j++) await rating.nth(j).click()
    await page.getByRole('button', { name: 'متابعة' }).click()
    return 'ratings'
  }
  const opts = page.locator('div.grid.gap-3 > button')
  if (await opts.first().isVisible().catch(() => false)) {
    const n = await opts.count()
    let picked = 0
    for (let j = 0; j < n; j++) {
      const t = (await opts.nth(j).textContent()) ?? ''
      if (t.includes('من 25 إلى 34')) { picked = j; break }
      if (t.includes('أقل من 16') || t.includes('من 16 إلى 18')) picked = Math.min(picked + 1, n - 1)
    }
    await opts.nth(picked).click()
    await page.waitForTimeout(300)
    const next = page.getByRole('button', { name: 'متابعة' })
    const nextUsable =
      (await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))
    if (nextUsable) await next.click().catch(() => {})
    return 'option'
  }
  return null
}

/* جلسة تشخيص كاملة — ترصد أيضا أي تسريب لاسم مسار أثناء الأسئلة */
async function completeDiagnostic(page) {
  await page.goto(`${BASE}/diagnostic`, { waitUntil: 'networkidle' })
  await page.evaluate(() => window.localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'ابدأ الحديث' }).click()
  let steps = 0
  let nameLeak = false
  while (steps < 30) {
    steps++
    await page.waitForTimeout(500)
    if (await page.getByText('اكتمل التشخيص').first().isVisible().catch(() => false)) break
    if (await page.getByText('التطابق الأولي').first().isVisible().catch(() => false)) nameLeak = true
    const acted = await answerCurrent(page)
    if (!acted) break
  }
  return { steps, nameLeak }
}

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())

/* ── سطح المكتب ── */
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const d = await desktop.newPage()
watchConsole(d, 'سطح-المكتب')

await d.goto(`${BASE}/`, { waitUntil: 'networkidle' })
note('الرئيسية تفتح على سطح المكتب', true)
note('الرئيسية بلا تمرير أفقي (سطح مكتب)', await noHScroll(d))
await d.screenshot({ path: `${OUT}/home-desktop.png`, fullPage: false })

await d.goto(`${BASE}/methodology`, { waitUntil: 'networkidle' })
note('صفحة المنهجية تفتح', await d.getByText('منهجية').first().isVisible().catch(() => false))
note('المنهجية بلا تمرير أفقي (سطح مكتب)', await noHScroll(d))
await d.screenshot({ path: `${OUT}/methodology-desktop.png` })

/* جلسة تشخيص كاملة حتى النتيجة */
const { steps, nameLeak } = await completeDiagnostic(d)
const resultVisible = await d.getByText('اكتمل التشخيص').first().isVisible().catch(() => false)
note('اكتملت جلسة التشخيص وظهرت النتيجة', resultVisible, `${steps} خطوة`)
note('الجلسة لم تتجاوز السقف الصارم (14 سؤالا)', steps <= 15, `${steps} خطوة فعلية`)
note('اسم المسار لا يظهر أثناء الأسئلة', !nameLeak)
const guardrailHit = await d.getByText('المتعلم قاصر').first().isVisible().catch(() => false)
note('الجلسة لم تُوقف بقيد حماية (إجابات بالغة)', !guardrailHit)
await d.screenshot({ path: `${OUT}/result-desktop.png`, fullPage: true })

if (resultVisible && !guardrailHit) {
  /* زر بطاقة الطباعة حُذف عمدا بطلب المالك (دفعة تبسيط النتيجة) — نتحقق من غيابه ومن إغلاق الأكورديونات */
  const cardBtn = await d.getByRole('button', { name: 'حمّل نتيجتك بطاقة مصممة' }).isVisible().catch(() => false)
  note('زر بطاقة الطباعة القديم أزيل من النتيجة', !cardBtn)
  const whyOpen = await d.locator('details:has-text("لماذا هذا المسار؟")').first().evaluate((el) => el.open).catch(() => null)
  note('أكورديون «لماذا هذا المسار؟» مغلق افتراضيا', whyOpen === false)
  const deepenBtn = d.getByRole('button', { name: 'لديك دقيقة أخرى لنتأكد أكثر؟' })
  const canDeepen = await deepenBtn.isVisible().catch(() => false)
  const deepenNote = await d.getByText('صورتك مكتملة بما يكفي').first().isVisible().catch(() => false)
  note('جولة التدقيق متاحة أو مفسَّرة بعدم الحاجة', canDeepen || deepenNote)
  if (canDeepen) {
    await deepenBtn.click()
    /* انتظر انتقال الواجهة لمرحلة أسئلة التدقيق فعليا */
    const barShown = await d.getByText('جولة تدقيق خطتك').first().waitFor({ timeout: 3000 }).then(() => true).catch(() => false)
    note('شريط «جولة تدقيق خطتك» ظهر بعد النقر', barShown)
    if (barShown) {
      const reasonShown = await d.getByText('لماذا هذا السؤال؟').first().isVisible().catch(() => false)
      note('سبب «لماذا هذا السؤال؟» يظهر مع سؤال التدقيق', reasonShown)
      await d.screenshot({ path: `${OUT}/deepening-question-desktop.png` })
      let dq = 0
      while (dq < 10) {
        dq++
        await d.waitForTimeout(500)
        if (await d.getByText('اكتمل التشخيص').first().isVisible().catch(() => false)) break
        const acted = await answerCurrent(d)
        if (!acted) break
      }
      const cmpShown = await d.getByText(/دعمت إجاباتك|ظهرت معلومات إضافية|بقي مسارك هو نفسه/).first().isVisible().catch(() => false)
      note('نتيجة التدقيق ظهرت (مقارنة أو طمأنة بثبات المسار)', cmpShown, `${dq - 1} سؤال تدقيق`)
      await d.screenshot({ path: `${OUT}/deepening-comparison-desktop.png`, fullPage: true })
    }
  }
  const journey = await d.locator('#learning-plan').count()
  note('قسم «ماذا ستحقق من خلال خطتك؟» موجود في النتيجة', journey > 0)
}
note('النتيجة بلا تمرير أفقي (سطح مكتب)', await noHScroll(d))
await desktop.close()

/* ── الجوال ── */
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const m = await mobile.newPage()
watchConsole(m, 'الجوال')
await m.goto(`${BASE}/`, { waitUntil: 'networkidle' })
note('الرئيسية بلا تمرير أفقي (جوال)', await noHScroll(m))
await m.screenshot({ path: `${OUT}/home-mobile.png` })
const mRun = await completeDiagnostic(m)
const mResult = await m.getByText('اكتمل التشخيص').first().isVisible().catch(() => false)
note('اكتملت جلسة التشخيص على الجوال', mResult, `${mRun.steps} خطوة`)
note('النتيجة بلا تمرير أفقي (جوال)', await noHScroll(m))
await m.screenshot({ path: `${OUT}/result-mobile.png`, fullPage: true })
await mobile.close()

/* ── ترحيل النتائج القديمة: نتيجة بمسار محذوف يجب أن تُرفض برسالة واضحة ── */
const stale = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const s = await stale.newPage()
await s.goto(`${BASE}/diagnostic`, { waitUntil: 'networkidle' })
await s.evaluate(() => {
  window.localStorage.clear()
  /* نتيجة قديمة بلا غلاف مخطط وبمرجع مسار لم يعد موجودا في الكتالوج */
  window.localStorage.setItem('wajeez_diag_v2_last_full', JSON.stringify({
    top: { id: 'PW-OLD-REMOVED', name: 'مسار قديم محذوف' },
    confidence: 0.8, reasons: [], gaps: [], changeMakers: [], gapDetails: [],
    resultJson: { kind: 'pathway' },
  }))
})
await s.reload({ waitUntil: 'networkidle' })
const staleNotice = await s.getByText('نتيجتك السابقة لم تعد صالحة').first().isVisible().catch(() => false)
note('نتيجة قديمة غير صالحة تُرفض برسالة واضحة بدل شاشة مكسورة', staleNotice)
await s.screenshot({ path: `${OUT}/stale-result-notice.png` })

/* ── صفحة انضم كمدرب: التخصصات الحقيقية وحقول الخبرة المنفصلة ── */
await s.goto(`${BASE}/join-trainer`, { waitUntil: 'networkidle' })
note('صفحة انضم كمدرب تفتح', await s.getByText('درّب ما تتقنه').first().isVisible().catch(() => false))
const specCount = await s.locator('fieldset:has-text("تخصصاتك التدريبية") button[aria-pressed]').count()
note('قائمة التخصصات الحقيقية موجودة (أزرار اختيار متعدد)', specCount >= 8, `${specCount} تخصصا`)
note('حقل خبرة التدريب منفصل عن سنوات الخبرة', (await s.locator('#jt-training').count()) === 1 && (await s.locator('#jt-years').count()) === 1)
await s.screenshot({ path: `${OUT}/join-trainer.png`, fullPage: true })

/* ── وسم البوابات الداخلية كنماذج تجريبية ── */
await s.goto(`${BASE}/trainer`, { waitUntil: 'networkidle' })
note('بوابة المدرب موسومة «نسخة تجريبية»', await s.getByText('نسخة تجريبية').first().isVisible().catch(() => false))
await s.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
note('لوحة الإدارة موسومة «نسخة تجريبية»', await s.getByText('نسخة تجريبية').first().isVisible().catch(() => false))
await stale.close()

/* ── عرض نتيجة «خطة مركبة مخصصة» محفوظة — بذرة حقيقية من المحرك ── */
let compositeSeed = null
try {
  compositeSeed = readFileSync(new URL('../verification/composite-result.seed.json', import.meta.url), 'utf8')
} catch { /* لم تُولد بعد */ }
note('بذرة النتيجة المركبة موجودة (node_modules/tsx scripts/seed-composite-result.ts)', Boolean(compositeSeed))
if (compositeSeed) {
  const comp = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const cp = await comp.newPage()
  watchConsole(cp, 'النتيجة-المركبة')
  await cp.goto(`${BASE}/diagnostic`, { waitUntil: 'networkidle' })
  await cp.evaluate((payload) => {
    window.localStorage.clear()
    window.localStorage.setItem('wajeez_diag_v2_last_full', payload)
  }, compositeSeed)
  await cp.reload({ waitUntil: 'networkidle' })
  const savedCard = await cp.getByText('لديك نتيجة مؤشر محفوظة').first().isVisible().catch(() => false)
  note('بطاقة «لديك نتيجة محفوظة» تظهر للنتيجة المركبة', savedCard)
  if (savedCard) {
    const seedData = JSON.parse(compositeSeed)
    const compName = seedData?.result?.resultJson?.composite?.name_ar ?? ''
    const firstCourseTitle = seedData?.result?.resultJson?.composite?.courses?.[0]?.titleAr ?? ''
    await cp.getByRole('button', { name: 'اعرض نتيجتي المحفوظة' }).click()
    await cp.waitForTimeout(700)
    note('وسم «خطة مركبة مخصصة» يظهر في النتيجة', await cp.getByText('خطة مركبة مخصصة').first().isVisible().catch(() => false))
    note('اسم الخطة المركبة يظهر كاملا', compName ? await cp.getByText(compName).first().isVisible().catch(() => false) : false, compName)
    note('دورات الخطة تُعرض بعناوين الكتالوج المركزي', firstCourseTitle ? (await cp.getByText(firstCourseTitle).count()) > 0 : false, firstCourseTitle)
    note('النتيجة المركبة بلا تمرير أفقي', await noHScroll(cp))
    await cp.screenshot({ path: `${OUT}/composite-result-desktop.png`, fullPage: true })
  }
  await comp.close()
}

/* ── أخطاء console المؤثرة عبر كل الصفحات المفتوحة ── */
const serious = consoleErrors.filter((e) => !ignorable(e))
note('لا أخطاء console مؤثرة في كل الصفحات المفحوصة', serious.length === 0, serious.slice(0, 2).join(' | '))

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} فحصا ناجحا — اللقطات في verification/`)
if (failed.length > 0) process.exit(1)
