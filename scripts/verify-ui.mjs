/* فحص واجهة فعلي بـ Playwright — يعمل على خادم معاينة مؤقت ثم يُقتل الخادم.
   يشغَّل بـ: node scripts/verify-ui.mjs   (يتطلب: npm i --no-save playwright) */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const OUT = new URL('../verification/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

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
  const planBtn = await d.getByRole('button', { name: 'استعرض خطتي التعليمية' }).isVisible().catch(() => false)
  note('زر «استعرض خطتي التعليمية» موجود', planBtn)
  const deepenBtn = d.getByRole('button', { name: 'دقّق خطتك أكثر' })
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
      const cmpShown = await d.getByText(/دعمت إجاباتك|ظهرت معلومات إضافية/).first().isVisible().catch(() => false)
      note('بطاقة مقارنة التدقيق قبل/بعد ظهرت', cmpShown, `${dq - 1} سؤال تدقيق`)
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
const specCount = await s.locator('#jt-spec option').count()
note('قائمة التخصصات الحقيقية موجودة (12 تخصصا)', specCount === 13, `${specCount - 1} تخصصا`)
note('حقل خبرة التدريب منفصل عن سنوات الخبرة', (await s.locator('#jt-training').count()) === 1 && (await s.locator('#jt-years').count()) === 1)
await s.screenshot({ path: `${OUT}/join-trainer.png`, fullPage: true })

/* ── وسم البوابات الداخلية كنماذج تجريبية ── */
await s.goto(`${BASE}/trainer`, { waitUntil: 'networkidle' })
note('بوابة المدرب موسومة «نسخة تجريبية»', await s.getByText('نسخة تجريبية').first().isVisible().catch(() => false))
await s.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
note('لوحة الإدارة موسومة «نسخة تجريبية»', await s.getByText('نسخة تجريبية').first().isVisible().catch(() => false))
await stale.close()

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} فحصا ناجحا — اللقطات في verification/`)
if (failed.length > 0) process.exit(1)
