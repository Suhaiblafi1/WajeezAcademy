/* لقطاتُ «دليل المدرّب» — تُولَّد من البوّابة نفسِها بحسابَي البذر.

   ═══ التشغيل ═══

     npm run guide:seed      يبذر الحسابين (مرّةً، ويُعيد مهلةَ الأوّل إلى أوّلها)
     npm run guide:shots     يصوّر ويكتب `public/guides/trainer/*.webp`
                             ويكتب أبعادَها في `src/data/trainer-guide/shots.ts`

   ويلزمه الخادمُ والواجهةُ قائمَين (`npm run dev`) — يصوّر ما يُخدَم فعلا.
   و`--only a,b` يصوّر ما سُمّي وحدَه ويُبقي أبعادَ غيره كما هي.

   ═══ وما يُرى في الصورة ═══

   · **الرقمُ على الصورة رقمُ الخطوة في النصّ** — فمن قرأ «٣ اضغط …» وجد
     الدائرةَ «٣» على الزرّ نفسِه. فلا يُغيَّر ترتيبُ `marks` بلا نصّه.
   · **والصورُ الشخصيّةُ مرسومةٌ لا ملتقَطة**: ملصقُ الدورة وصورةُ المدرّب في
     «التسويق» تُرسَم هنا خيالا بلا وجه، وتُخدَم لروابطها — فلا وجهَ إنسانٍ
     في دليلٍ يُرسَل إلى كلّ مدرّب. */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Locator, Page } from 'playwright'
import { open, settle, shoot, signIn, startEngine, type Engine } from './engine'
import { GUIDE_ACCOUNTS, GUIDE_ASSET_HOST, GUIDE_PASSWORD } from './accounts'

const ROOT = process.cwd()
const OUT = join(ROOT, 'public/guides/trainer')
const MANIFEST = join(ROOT, 'src/data/trainer-guide/shots.ts')
const BASE = process.env.GUIDE_BASE_URL ?? 'http://localhost:3000'

const only = (() => {
  const i = process.argv.indexOf('--only')
  return i > -1 ? new Set(process.argv[i + 1].split(',')) : null
})()
const wanted = (name: string) => !only || only.has(name)

/* ═══ الصورُ المرسومة — ملصقٌ وصورةٌ بلا وجه ═══ */

const POSTER_HTML = `<!doctype html><html dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">
<style>
  body{margin:0;width:800px;height:1000px;font-family:'IBM Plex Sans Arabic',sans-serif;background:#1A5C64;color:#F6F4EF;display:flex;flex-direction:column}
  .top{padding:64px 64px 0;flex:1}
  .kicker{font-size:26px;color:#FABC05;font-weight:700}
  h1{font-size:86px;line-height:1.15;margin:18px 0 0;font-weight:700}
  p{font-size:30px;line-height:1.6;margin:22px 0 0;opacity:.9;max-width:600px}
  .who{display:flex;align-items:center;gap:22px;margin-top:56px}
  .face{width:120px;height:120px;border-radius:999px;background:#F6F4EF;display:grid;place-items:end center;overflow:hidden}
  .face svg{width:100px;height:100px}
  .name{font-size:32px;font-weight:700}.role{font-size:24px;opacity:.8}
  .band{background:#FABC05;color:#162220;padding:34px 64px;font-size:32px;font-weight:700;display:flex;justify-content:space-between}
</style></head><body>
<div class="top"><div class="kicker">دورةٌ مباشرة عن بُعد</div>
<h1>التحضيرُ للتفاوض</h1>
<p>تدخل تفاوضَك القادم ومعك بديلُك الأفضل وحدُّك الأدنى مكتوبَين.</p>
<div class="who"><div class="face"><svg viewBox="0 0 100 100"><circle cx="50" cy="38" r="20" fill="#9FB8BA"/><path d="M12 100c4-24 20-36 38-36s34 12 38 36z" fill="#9FB8BA"/></svg></div>
<div><div class="name">مدرّب وجيز</div><div class="role">مدرّبُ تواصلٍ وتفاوض</div></div></div></div>
<div class="band"><span>دفعةُ أكتوبر</span><span>ثمانيةُ لقاءاتٍ مسائيّة</span></div>
</body></html>`

const PORTRAIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#E3ECEA"/>
<circle cx="200" cy="160" r="72" fill="#9FB8BA"/><path d="M60 400c12-96 72-150 140-150s128 54 140 150z" fill="#9FB8BA"/></svg>`

async function drawAssets(e: Engine): Promise<Record<string, { type: string; body: Buffer }>> {
  const page = await e.context.newPage()
  await page.setViewportSize({ width: 800, height: 1000 })
  await page.setContent(POSTER_HTML, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const poster = await page.screenshot({ type: 'png' })
  await page.close()
  return {
    '/poster-negotiation.png': { type: 'image/png', body: poster },
    '/portrait.jpg': { type: 'image/svg+xml', body: Buffer.from(PORTRAIT_SVG) },
  }
}

/* ═══ أدواتٌ صغيرة ═══ */

const btn = (scope: Page | Locator, name: string | RegExp) => scope.getByRole('button', { name }).first()
const link = (scope: Page | Locator, name: string | RegExp) => scope.getByRole('link', { name }).first()
/** أعمقُ عنصرٍ يحمل النصَّ ويحمل ما بعده — فالإطارُ الذي يضمّهما معا لا الصفحةُ كلُّها */
function around(p: Page, text: string | RegExp, ...alsoHas: Locator[]) {
  let loc = p.locator('div, section, article, li, form').filter({ has: p.getByText(text).first() })
  for (const h of alsoHas) loc = loc.filter({ has: h })
  return loc.last()
}
/** بطاقةٌ تحمل عنوانا بعينه — أقربُ سلفٍ مدوَّرٍ لعنوانها */
const cardOf = (p: Page, title: string | RegExp) =>
  p.locator('h2, h3, h4').filter({ hasText: title }).first()
    .locator('xpath=ancestor::*[contains(@class,"rounded")][1]')
const pageBody = (p: Page) => p.locator('h1').first().locator('xpath=..')

/** أقربُ إطارٍ مرئيٍّ حول الهدف — بطاقةٌ أو لوحٌ له حوافُّ مدوَّرةٌ وخلفيّةٌ أو حدّ.
    يُقاس في الصفحة لا يُخمَّن باسم صنف: الأصنافُ تتبدّل، والإطارُ يُرى. */
let panelSeq = 0
async function panel(target: Locator, minWidth = 0): Promise<Locator> {
  const id = `g${++panelSeq}`
  await target.first().waitFor()
  await target.first().evaluate((el, a) => {
    /* يبدأ من أبيه: الحقلُ نفسُه مدوَّرٌ بحدّ، وليس هو الإطارَ المقصود */
    let n = (el as HTMLElement).parentElement
    while (n && n !== document.body) {
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'LABEL'].includes(n.tagName)) { n = n.parentElement; continue }
      const cs = getComputedStyle(n)
      const radius = parseFloat(cs.borderTopLeftRadius) || 0
      const framed = parseFloat(cs.borderTopWidth) > 0
        || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent')
      const w = n.getBoundingClientRect().width
      if (radius >= 8 && framed && w >= a.minWidth && w < document.documentElement.clientWidth * 0.97) {
        n.setAttribute('data-guide-panel', a.id)
        return
      }
      n = n.parentElement
    }
  }, { id, minWidth })
  return target.page().locator(`[data-guide-panel="${id}"]`)
}

/** عرضٌ أضيق للّقطة وحدَها — شريطٌ عريضٌ بسطرٍ واحدٍ يصغر في الهاتف حتّى لا يُقرأ */
async function narrow<T>(e: Engine, width: number, fn: () => Promise<T>): Promise<T> {
  const before = e.page.viewportSize()!
  await e.page.setViewportSize({ width, height: before.height })
  await e.page.waitForTimeout(500)
  try { return await fn() } finally {
    await e.page.setViewportSize(before)
    await e.page.waitForTimeout(300)
  }
}

async function api<T>(e: Engine, path: string): Promise<T> {
  const res = await e.page.request.get(`${e.base}${path}`)
  if (!res.ok()) throw new Error(`${path} → ${res.status()}`)
  return (await res.json()) as T
}

/** معرّفُ شعبةٍ من شعبه بجزءٍ من اسمها */
async function cohortId(e: Engine, titlePart: string): Promise<string> {
  const rows = await api<{ cohort: { id: string; title: string } }[]>(e, '/api/trainer/my-cohorts')
  const hit = rows.find((r) => r.cohort.title.includes(titlePart))
  if (!hit) throw new Error(`لا شعبةَ باسمٍ فيه «${titlePart}» — شغّل npm run guide:seed`)
  return hit.cohort.id
}

async function step(e: Engine, n: number) {
  await e.page.getByRole('button', { name: new RegExp(`^الخطوة ${n} من 6`) }).click()
  await settle(e)
  await e.page.evaluate(() => window.scrollTo(0, 0))
}

type Shot = { name: string; run: (e: Engine) => Promise<void> }

/* ═══ ① من اعتُمد توقيعُه الآن ═══ */

const FRESH: Shot[] = [
  {
    name: 'first-login',
    async run(e) {
      const p = e.page
      await open(e, '/trainer')
      await shoot(e, {
        name: 'first-login', clip: 'viewport',
        marks: [
          { target: p.getByRole('navigation', { name: 'تبويبات بوّابة المدرّب' }), n: 1, pad: 2 },
          { target: around(p, /مشروطة — أمامك/, btn(p, /^امنحني/)), n: 2, pad: 4 },
          { target: link(p, 'دليلُ المدرّب'), n: 3, pad: 3 },
        ],
      })
    },
  },
  {
    name: 'condition-strip',
    async run(e) {
      const p = e.page
      await narrow(e, 900, async () => {
        await open(e, '/trainer')
        await shoot(e, {
          name: 'condition-strip', clip: await panel(p.getByText(/مشروطة — أمامك/)), clipPad: 16,
          marks: [
            { target: p.getByText(/مشروطة — أمامك/).first(), n: 1, pad: 4 },
            { target: btn(p, /^امنحني/), n: 2, pad: 4 },
          ],
        })
      })
    },
  },
]

/* ═══ دوراتُك قيد الإعداد — وشعبةُ إعدادها (٢ أكتوبر ٢٠٢٦) ═══
   حلّت محلَّ «موادُّ دوراتك» ومحرّرِها: يقبل الدورةَ فتُعَدّ في «شعبي». فتُقبَل
   أولى دوراته هنا قبل التصوير — لتُرى دورةٌ قبِلها ودورةٌ تنتظر قرارَه معا —
   ثمّ تُصوَّر شعبتُها. والبذرُ يُعيدها (`npm run guide:seed`). */
FRESH.push({
  name: 'prep-panel',
  async run(e) {
    const p = e.page
    const rows = await (await p.request.get(`${e.base}/api/trainer/prep`)).json() as { courseId: string; state: string }[]
    const first = rows.find((r) => r.state === 'to_decide')
    if (first && rows.filter((r) => r.state === 'to_decide').length > 1) {
      await p.request.post(`${e.base}/api/trainer/prep/${encodeURIComponent(first.courseId)}/accept`, { data: {} })
    }
    await open(e, '/trainer/qualifications')
    const section = p.locator('section').filter({ has: p.getByRole('heading', { name: 'دوراتُك قيد الإعداد' }) }).first()
    await shoot(e, {
      name: 'prep-panel', clip: section, clipPad: 12, maxHeight: 1500,
      marks: [
        { target: section.getByText(/^قرّرتَ في \d+ من \d+/).first(), n: 1, pad: 4 },
        { target: btn(section, 'اقبلها وابدأ إعدادها'), n: 2, pad: 4 },
        { target: btn(section, 'اعتذرْ عنها'), n: 3, pad: 4 },
        { target: link(section, /افتح شعبتَها/), n: 4, pad: 4 },
      ],
    })
  },
})
FRESH.push({
  name: 'prep-notice',
  async run(e) {
    const p = e.page
    const rows = await (await p.request.get(`${e.base}/api/trainer/prep`)).json() as { cohortId: string | null }[]
    const id = rows.find((r) => r.cohortId)?.cohortId
    if (!id) throw new Error('لا شعبةَ إعدادٍ للحساب — صوِّر «prep-panel» أوّلا')
    await narrow(e, 1100, async () => {
      await open(e, `/trainer/cohort/${id}`)
      const notice = p.getByText(/^شعبةُ إعداد — /).first()
      await shoot(e, {
        name: 'prep-notice', clip: pageBody(p), clipPad: 6, maxHeight: 560,
        marks: [{ target: notice, n: 1, pad: 5 }],
      })
    })
  },
})

/* ═══ «عقدي» تُصوَّر من هنا لا من النشط (١ أكتوبر ٢٠٢٦) ═══
   قارئُ الدليل في طور الموادّ: اعتمدنا توقيعَه ولم نوقّع العرض. وكانت
   اللقطةُ من النشط وعليها «فهي نافذةٌ بين الطرفين» — فيرى في دليله غيرَ ما
   يراه في بوّابته، وهو بعينه ما قرّر صاحبُ المنصّة نقضَه: لا نوقّع قبل أن
   نعتمد دوراته. */
FRESH.push({
  name: 'contract',
  async run(e) {
    const p = e.page
    await open(e, '/trainer/contract')
    await shoot(e, {
      name: 'contract', clip: pageBody(p), clipPad: 6, maxHeight: 760,
      marks: [
        { target: p.getByText(/ونوقّعها من جهتنا حين نعتمد دوراتك/).first(), n: 1, pad: 5 },
        { target: btn(p, /احفظ PDF/), n: 2, pad: 5 },
      ],
    })
  },
})

/* ═══ ② المدرّبُ النشط ═══ */

const ACTIVE: Shot[] = [
  {
    name: 'portal-map',
    async run(e) {
      const p = e.page
      await narrow(e, 1000, async () => {
        await open(e, '/trainer')
        const header = p.locator('header').first()
        await shoot(e, {
          name: 'portal-map', clip: header, clipPad: 0, spotlight: false,
          marks: [
            { target: p.getByRole('navigation', { name: 'تبويبات بوّابة المدرّب' }), n: 1, pad: 2 },
            { target: btn(header, /^ابحث في شعبك/), n: 2, pad: 3 },
            { target: link(header, 'دليلُ المدرّب'), n: 3, pad: 3 },
            { target: btn(header, /^الإشعارات/), n: 4, pad: 3 },
            { target: btn(header, /^التبديل إلى المظهر/), n: 5, pad: 3 },
            { target: btn(header, 'قائمة الحساب'), n: 6, pad: 3 },
          ],
        })
      })
    },
  },
  {
    name: 'home-queue',
    async run(e) {
      const p = e.page
      await open(e, '/trainer')
      const head = p.getByText(/(تنتظرك|ينتظرك|ينتظرانك) الآن/).first()
      await shoot(e, {
        name: 'home-queue', clip: await panel(await panel(head)), clipPad: 10, maxHeight: 640,
        marks: [
          { target: head, n: 1, pad: 6 },
          { target: link(p, 'اقرأه وأجِبْ'), n: 2, pad: 4 },
          { target: link(p, 'قيّم الآن'), n: 3, pad: 4 },
        ],
      })
    },
  },
  {
    name: 'board',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/board')
      const card = cardOf(p, 'الدفعةُ الأولى')
      await shoot(e, {
        name: 'board', clip: pageBody(p), clipPad: 8,
        marks: [
          { target: card.getByText('في التجهيز').first(), n: 1, pad: 4 },
          { target: card.getByText(/^التالي:|التجهيزُ مكتمل/).first(), n: 2, pad: 4 },
          { target: link(card, 'افتح الشعبة').or(btn(card, 'افتح الشعبة')).first(), n: 3, pad: 4 },
        ],
      })
    },
  },
  {
    name: 'ws-basics',
    async run(e) {
      const p = e.page
      await open(e, `/trainer/cohort/${await cohortId(e, 'الدفعةُ الأولى')}`)
      await step(e, 1)
      await shoot(e, {
        name: 'ws-basics', clip: pageBody(p), clipPad: 6, maxHeight: 980,
        marks: [
          { target: p.getByRole('button', { name: /^الخطوة 1 من 6/ }).locator('xpath=..'), n: 1, pad: 4 },
          { target: p.getByRole('textbox', { name: /^اسم الشعبة/ }), n: 2, pad: 6 },
          { target: p.getByRole('textbox', { name: /^نبذةٌ عن الشعبة/ }), n: 3, pad: 6 },
          { target: p.getByRole('textbox', { name: 'تاريخُ بدء الشعبة' }).locator('xpath=../..'), n: 4, pad: 4 },
          { target: btn(p, 'احفظ وتابِع'), n: 5, pad: 4 },
        ],
      })
    },
  },
  {
    name: 'ws-modules',
    async run(e) {
      const p = e.page
      await open(e, `/trainer/cohort/${await cohortId(e, 'الدفعةُ الأولى')}`)
      await step(e, 2)
      const slot = p.getByRole('listitem').filter({ has: p.getByText('الموعد 1 · المحور 1', { exact: true }) }).first()
      await btn(slot, /^المحور 1 —/).click()
      await settle(e)
      await shoot(e, {
        name: 'ws-modules', clip: slot, clipPad: 14, maxHeight: 1450,
        marks: [
          { target: slot.getByRole('textbox', { name: 'بدايةُ الموعد 1' }), n: 1, pad: 5 },
          { target: slot.getByRole('textbox', { name: 'عنوان المحور 1' }), n: 2, pad: 5 },
          { target: slot.getByRole('textbox', { name: 'مخرج المحور 1' }), n: 3, pad: 5 },
          { target: slot.getByRole('textbox', { name: 'المحتوى النظريّ للمحور 1' }), n: 4, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'ws-workbooks',
    async run(e) {
      const p = e.page
      await open(e, `/trainer/cohort/${await cohortId(e, 'الدفعةُ الأولى')}`)
      await step(e, 3)
      /* كرّاسةٌ واحدةٌ للدورة وخريطتُها (٣٠ سبتمبر ٢٠٢٦) — تُملأ في المحرّر
         ولا تُحفظ، فالشعبةُ المزروعةُ قبل التحوّل تُصوَّر كما يراها صاحبُها */
      const url = p.getByRole('textbox', { name: 'رابطُ الكرّاسة' })
      if (!(await url.inputValue())) await url.fill('https://drive.google.com/file/d/guide-workbook')
      for (let i = 1; i <= 4; i++) {
        const where = p.getByRole('textbox', { name: `أين يبدأ المحور ${i} في الكرّاسة` })
        if (await where.count() && !(await where.inputValue())) await where.fill(`ص ${(i - 1) * 6 + 1}`)
      }
      await settle(e)
      const section = p.locator('section').filter({ has: p.getByRole('textbox', { name: 'رابطُ الكرّاسة' }) }).first()
      await shoot(e, {
        name: 'ws-workbooks', clip: section, clipPad: 14, maxHeight: 1500,
        marks: [
          { target: p.getByRole('textbox', { name: 'رابطُ الكرّاسة' }), n: 1, pad: 5 },
          { target: p.getByRole('textbox', { name: 'أين يبدأ المحور 1 في الكرّاسة' }), n: 2, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'ws-meetings',
    async run(e) {
      const p = e.page
      await open(e, `/trainer/cohort/${await cohortId(e, 'الدفعةُ الأولى')}`)
      await step(e, 4)
      const slot = p.getByRole('listitem').filter({ has: p.getByText('الموعد 1 · المحور 1', { exact: true }) }).first()
      await shoot(e, {
        name: 'ws-meetings', clip: slot, clipPad: 14,
        marks: [
          { target: slot.getByText(/بانتظار اعتماد الإدارة/).first(), n: 1, pad: 5 },
          { target: btn(slot, /لقاءٌ مباشر/), n: 2, pad: 5 },
          { target: btn(slot, /جلسةٌ مسجّلة/), n: 3, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'ws-live-form',
    async run(e) {
      const p = e.page
      await open(e, `/trainer/cohort/${await cohortId(e, 'الدفعةُ الأولى')}`)
      await step(e, 4)
      const slot = p.getByRole('listitem').filter({ has: p.getByText('الموعد 2 · المحور 2', { exact: true }) }).first()
      await btn(slot, /لقاءٌ مباشر/).click()
      await settle(e)
      const send = btn(slot, /أرسِلْه للاعتماد/)
      await shoot(e, {
        name: 'ws-live-form', clip: await panel(send, 500), clipPad: 14,
        marks: [{ target: send, n: 1, pad: 5 }],
      })
    },
  },
  {
    name: 'ws-tasks',
    async run(e) {
      const p = e.page
      await open(e, `/trainer/cohort/${await cohortId(e, 'الدفعةُ الأولى')}`)
      await step(e, 5)
      const task = p.getByText('خريطةُ رسالةٍ لعرضٍ تقدّمه هذا الشهر', { exact: true }).first()
      await shoot(e, {
        name: 'ws-tasks', clip: await panel(btn(p, /مهمّةٌ عمليّة/), 600), clipPad: 12,
        marks: [
          { target: await panel(task), n: 1, pad: 3 },
          { target: btn(p, /مهمّةٌ عمليّة/), n: 2, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'ws-sources',
    async run(e) {
      const p = e.page
      await open(e, `/trainer/cohort/${await cohortId(e, 'الدفعةُ الأولى')}`)
      await step(e, 5)
      /* والمصادرُ صارت لسانا ثانيا (٣٠ سبتمبر ٢٠٢٦) */
      await p.getByRole('tablist', { name: 'أقسامُ المهامّ والمصادر' }).getByRole('tab', { name: /المصادر/ }).click()
      await settle(e)
      const first = p.getByRole('textbox', { name: 'اسم المصدر 1' })
      await shoot(e, {
        name: 'ws-sources', clip: await panel(first, 600), clipPad: 12, maxHeight: 1000,
        marks: [
          { target: first, n: 1, pad: 5 },
          { target: p.getByRole('combobox', { name: 'محورُ المصدر 1' }), n: 2, pad: 5 },
          { target: p.getByRole('checkbox', { name: /^قراءةٌ مسبقة/ }).first().locator('xpath=..'), n: 3, pad: 5 },
        ],
      })
    },
  },
  /* ═══ ألسنةُ «المهامّ والمصادر» الثلاثة (٣٠ سبتمبر ٢٠٢٦) ═══ */
  ...(['tasks', 'resources', 'project'] as const).map((tab): Shot => ({
    name: `ws-tab-${tab}`,
    async run(e) {
      const p = e.page
      await open(e, `/trainer/cohort/${await cohortId(e, 'الدفعةُ الأولى')}`)
      await step(e, 5)
      const label = { tasks: 'المهامّ العمليّة', resources: 'المصادر', project: 'مشروع التخرّج' }[tab]
      const bar = p.getByRole('tablist', { name: 'أقسامُ المهامّ والمصادر' })
      await bar.getByRole('tab', { name: new RegExp(label) }).click()
      await settle(e)
      /* ولسانُ المهامّ يُصوَّر ونموذجُه مفتوحٌ ومرفقُه «ملفّ» — ليُرى الرفعُ حيث طُلب */
      if (tab !== 'resources') {
        await btn(p, tab === 'project' ? '+ مشروعُ التخرّج' : '+ مهمّةٌ عمليّة').click()
        await settle(e)
        if (tab === 'tasks') {
          await btn(p, '+ مرفق').click()
          await p.getByRole('textbox', { name: 'اسم المرفق 1' }).fill('نموذجُ التسليم')
          await settle(e)
        }
      }
      const stage = p.locator('div.space-y-5').filter({ has: bar }).first()
      await shoot(e, {
        name: `ws-tab-${tab}`, clip: stage, clipPad: 10, maxHeight: 3600,
        marks: [
          { target: bar.getByRole('tab', { name: new RegExp(label) }), n: 1, pad: 4 },
          { target: p.locator('p', { hasText: 'تعليماتٌ وتوصيات' }).first().locator('xpath=..'), n: 2, pad: 4 },
          ...(tab === 'tasks' ? [{ target: p.getByRole('combobox', { name: 'نوع المرفق 1' }), n: 3, pad: 4 }] : []),
        ],
      })
    },
  })),
  {
    name: 'ws-submit',
    async run(e) {
      const p = e.page
      await open(e, `/trainer/cohort/${await cohortId(e, 'الدفعةُ الأولى')}`)
      await step(e, 6)
      const check = p.getByRole('checkbox', { name: /^أوافق على كلّ ما في هذه الشعبة/ })
      await check.scrollIntoViewIfNeeded()
      await p.evaluate(() => window.scrollBy(0, 240))
      await shoot(e, {
        name: 'ws-submit', clip: 'viewport',
        marks: [{ target: check.locator('xpath=..'), n: 1, pad: 6 }],
      })
    },
  },
  {
    name: 'sessions-host',
    async run(e) {
      const p = e.page
      await open(e, `/trainer/cohort/${await cohortId(e, 'دفعةُ أكتوبر')}`)
      await settle(e)
      await step(e, 4)
      const host = btn(p, 'ابدأ اللقاء مضيفا')
      await host.scrollIntoViewIfNeeded()
      await shoot(e, {
        name: 'sessions-host', clip: host.locator('xpath=ancestor::*[contains(@class,"rounded")][1]'), clipPad: 16,
        marks: [
          { target: host, n: 1, pad: 5 },
          { target: btn(p, 'انقل الموعد'), n: 2, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'learners',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/learners')
      await shoot(e, {
        name: 'learners', clip: pageBody(p), clipPad: 6, maxHeight: 820,
        marks: [
          { target: p.getByRole('textbox').first(), n: 1, pad: 5 },
          { target: p.getByText('عبر رابطك').first(), n: 2, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'learners-talk',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/learners')
      await btn(p, 'خاطِبه').click()
      await settle(e)
      await p.getByRole('textbox', { name: 'نصّ الرسالة' }).fill('تذكيرٌ: لقاءُ الغد يبدأ في موعده، وجهّزوا مذكّرةَ التحضير.')
      await settle(e)
      const section = p.locator('section').filter({ has: p.getByRole('heading', { name: 'مركز التواصل' }) }).first()
      await shoot(e, {
        name: 'learners-talk', clip: section, clipPad: 10, maxHeight: 1400,
        marks: [
          { target: p.getByRole('combobox', { name: 'إلى من' }), n: 1, pad: 5 },
          { target: p.getByRole('textbox', { name: 'نصّ الرسالة' }), n: 2, pad: 5 },
          { target: btn(section, /أرسِل|أرسل/), n: 3, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'grading',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/grading')
      const score = p.getByRole('spinbutton').and(p.locator(':enabled')).first()
      await score.fill('17')
      await settle(e)
      const card = await panel(score, 600)
      await shoot(e, {
        name: 'grading', clip: card, clipPad: 12,
        marks: [
          { target: score, n: 1, pad: 5 },
          { target: btn(card, 'سجّل الدرجة'), n: 2, pad: 5 },
          { target: btn(card, 'قبول'), n: 3, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'schedule',
    async run(e) {
      await open(e, '/trainer/schedule')
      await shoot(e, { name: 'schedule', clip: 'viewport', spotlight: false })
    },
  },
  {
    name: 'qualifications',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/qualifications')
      const card = p.getByRole('listitem').filter({ has: p.getByRole('heading', { name: /الإقناع والتواصل/ }) }).first()
      await shoot(e, {
        name: 'qualifications', clip: pageBody(p), clipPad: 6, maxHeight: 1550,
        marks: [
          { target: p.getByRole('tablist', { name: 'حالُ مؤهّلاتي' }), n: 1, pad: 4 },
          { target: card.getByText(/متاحةٌ لك — قرّر/).first(), n: 2, pad: 4 },
          { target: btn(card, 'أوافق على تقديمها'), n: 3, pad: 4 },
          { target: btn(card, 'أعتذر عنها'), n: 4, pad: 4 },
        ],
      })
    },
  },
  {
    name: 'decline-merge',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/qualifications')
      const card = p.getByRole('listitem').filter({ has: p.getByRole('heading', { name: /الإقناع والتواصل/ }) }).first()
      await btn(card, 'أعتذر عنها').click()
      const reason = card.getByRole('textbox').first()
      await reason.fill('أقترح دمجَها مع «تصميم الرسالة والعرض التنفيذيّ» — محاورُهما متقاربة، فتكون دورةً واحدةً أقوى.')
      await settle(e)
      await shoot(e, {
        name: 'decline-merge', clip: card, clipPad: 12,
        marks: [
          { target: reason, n: 1, pad: 5 },
          { target: btn(card, 'أرسِل اعتذاري'), n: 2, pad: 5 },
        ],
      })
      await btn(card, 'تراجعْ').click()
    },
  },
  {
    name: 'qual-accepted',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/qualifications')
      await p.getByRole('tab', { name: /^قبِلتَها/ }).click()
      await settle(e)
      const card = p.getByRole('listitem').filter({ has: p.getByRole('heading', { name: /تصميم الرسالة/ }) }).first()
      await shoot(e, {
        name: 'qual-accepted', clip: card, clipPad: 12,
        marks: [
          { target: card.getByText(/أُضيفت إلى دوراتك/).first(), n: 1, pad: 4 },
          { target: card.getByText(/أجلُ إعدادك/).first(), n: 2, pad: 5 },
          { target: btn(card, 'أقِرّ بجاهزيّتي'), n: 3, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'proposal-form',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/course-proposals')
      await p.getByRole('textbox', { name: /عنوانُ الدورة/ }).first().fill('إدارةُ الاجتماعات القصيرة')
      await settle(e)
      const form = await panel(p.getByRole('heading', { name: 'أضِف دورةً تقترحها' }), 700)
      await shoot(e, {
        name: 'proposal-form', clip: form, clipPad: 10, maxWidth: 1800, maxHeight: 2400,
        marks: [
          { target: p.getByRole('textbox', { name: /عنوانُ الدورة/ }).first(), n: 1, pad: 5 },
          { target: p.getByRole('textbox', { name: /المحاورُ الرئيسة/ }).first(), n: 2, pad: 5 },
          { target: p.getByText('لم أدرّسها بعد', { exact: true }).first(), n: 3, pad: 14 },
          { target: btn(p, 'أرسِلها للإدارة'), n: 4, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'proposal-card',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/course-proposals')
      const title = p.getByText('التفاوضُ على العرض الوظيفيّ والراتب', { exact: true }).first()
      const card = await panel(title, 500)
      await shoot(e, {
        name: 'proposal-card', clip: card, clipPad: 12, maxHeight: 900,
        marks: [
          { target: card.getByText(/^عند الإدارة/).first(), n: 1, pad: 4 },
          /* زرُّ هذه البطاقة لا أوّلُ «عدّل» في قسمها — فالبطاقاتُ صارت في قسمٍ واحد */
          { target: btn(title.locator('xpath=ancestor::div[.//button][1]'), 'عدّل'), n: 2, pad: 4 },
        ],
      })
    },
  },
  {
    name: 'paths',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/paths')
      const card = await panel(btn(p, 'أرسِله للمراجعة'), 600)
      await shoot(e, {
        name: 'paths', clip: card, clipPad: 12,
        marks: [
          { target: card.getByText(/مسودّة عندك/).first(), n: 1, pad: 4 },
          { target: card.getByText(/لم يُعتمد ظهورُ اسمك/).first(), n: 2, pad: 4 },
          { target: btn(card, 'عدّل'), n: 3, pad: 4 },
          { target: btn(card, 'أرسِله للمراجعة'), n: 4, pad: 4 },
        ],
      })
    },
  },
  {
    name: 'path-form',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/paths')
      await btn(p, 'عدّل').click()
      await settle(e)
      const title = p.getByRole('textbox', { name: /اسمُ المسار/ })
      await shoot(e, {
        name: 'path-form', clip: await panel(title, 600), clipPad: 12, maxWidth: 1800, maxHeight: 1100,
        marks: [
          { target: title, n: 1, pad: 5 },
          { target: p.getByRole('textbox', { name: /نبذةٌ قصيرة/ }), n: 2, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'marketing-poster',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/marketing')
      const head = p.getByRole('heading', { name: /ملصقاتٌ تنتظر موافقتك/ })
      const panel = head.locator('xpath=ancestor::*[contains(@class,"rounded")][1]')
      await p.locator('img').filter({ has: p.locator('xpath=self::img') }).first().waitFor().catch(() => undefined)
      await settle(e)
      await shoot(e, {
        name: 'marketing-poster', clip: panel, clipPad: 12,
        marks: [
          { target: btn(panel, 'أوافق عليه'), n: 1, pad: 5 },
          { target: btn(panel, 'أطلب تعديلا'), n: 2, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'marketing-video',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/marketing')
      const head = p.getByRole('heading', { name: /فيديو تعريفيٌّ بك/ })
      await head.scrollIntoViewIfNeeded()
      await shoot(e, {
        name: 'marketing-video', clip: 'viewport',
        marks: [
          { target: head.locator('xpath=ancestor::*[contains(@class,"rounded")][1]'), n: 1, pad: 4 },
          { target: p.getByRole('heading', { name: /صوري للملصقات/ }).locator('xpath=ancestor::*[contains(@class,"rounded")][1]'), n: 2, pad: 4 },
        ],
      })
    },
  },
  {
    name: 'earnings',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/earnings')
      /* لوحُ الحساب البنكيّ يصل بعد غيره فيدفع ما تحته — يُنتظر قبل القياس */
      await btn(p, /أدخِلْ حسابك|بدّلْه/).waitFor()
      await settle(e)
      await shoot(e, {
        name: 'earnings', clip: pageBody(p), clipPad: 6, maxWidth: 1800,
        marks: [
          { target: await panel(p.getByText('اتفاقُك المسبق', { exact: true })), n: 1, pad: 3 },
          { target: p.getByRole('table').first(), n: 2, pad: 6 },
          { target: await panel(p.getByText(/^كشف فترة/).first(), 500), n: 3, pad: 3 },
        ],
      })
    },
  },
  {
    name: 'bank-form',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/earnings')
      await btn(p, /أدخِلْ حسابك/).click()
      await settle(e)
      const decl = p.getByText(/أُقرّ أنّ هذا الحسابَ باسمي/).first()
      await shoot(e, {
        name: 'bank-form', clip: await panel(btn(p, /احفظْ حسابي/), 600), clipPad: 12, maxWidth: 1800,
        marks: [
          { target: p.getByText('دولةُ المصرف').first().locator('xpath=..'), n: 1, pad: 4 },
          { target: decl, n: 2, pad: 4 },
          { target: btn(p, /احفظْ حسابي/), n: 3, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'mobile-portal',
    async run(e) {
      const p = e.page
      const before = p.viewportSize()!
      await p.setViewportSize({ width: 390, height: 780 })
      try {
        await open(e, '/trainer')
        await shoot(e, {
          name: 'mobile-portal', clip: 'viewport',
          marks: [{ target: p.getByRole('navigation', { name: 'تبويبات بوّابة المدرّب' }), n: 1, pad: 2 }],
        })
      } finally { await p.setViewportSize(before) }
    },
  },
  {
    name: 'ratings',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/ratings')
      await shoot(e, { name: 'ratings', clip: pageBody(p), clipPad: 6, spotlight: false, maxWidth: 1800 })
    },
  },
  {
    name: 'referral',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/referral')
      const wide = p.getByRole('textbox', { name: 'رابطي العامّ' })
      await shoot(e, {
        name: 'referral', clip: await panel(wide, 600), clipPad: 12,
        marks: [
          { target: wide, n: 1, pad: 5 },
          { target: btn(p, 'انسخ الرابط'), n: 2, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'account',
    async run(e) {
      const p = e.page
      await open(e, '/trainer/account')
      const up = btn(p, 'ارفع صورة من جهازك')
      await shoot(e, {
        name: 'account', clip: await panel(up, 600), clipPad: 12,
        marks: [
          { target: p.getByRole('textbox').first(), n: 1, pad: 5 },
          { target: up, n: 2, pad: 5 },
        ],
      })
      /* وعنوانُه ونبذتُه في «المدربون» — تحت صورته (٣ أكتوبر ٢٠٢٦) */
      const card = p.locator('section[aria-labelledby="public-text-h"]')
      await card.scrollIntoViewIfNeeded()
      await shoot(e, {
        name: 'account-bio', clip: card, clipPad: 12,
        marks: [
          { target: card.getByRole('textbox').nth(0), n: 1, pad: 5 },
          { target: card.getByRole('textbox').nth(1), n: 2, pad: 5 },
          { target: card.getByRole('button', { name: /أرسِل/ }), n: 3, pad: 5 },
        ],
      })
    },
  },
  {
    name: 'bell',
    async run(e) {
      const p = e.page
      await open(e, '/trainer')
      await btn(p.locator('header'), /^الإشعارات/).click()
      await settle(e)
      const panel = p.getByText('تعليم الكل كمقروء').first().locator('xpath=ancestor::*[contains(@class,"rounded")][1]')
      await shoot(e, {
        name: 'bell', clip: panel, clipPad: 10,
        marks: [{ target: p.getByText('تعليم الكل كمقروء').first(), n: 1, pad: 4 }],
      })
      await p.keyboard.press('Escape')
    },
  },
  {
    name: 'search',
    async run(e) {
      const p = e.page
      await open(e, '/trainer')
      await btn(p.locator('header'), /^ابحث في شعبك/).click()
      const box = p.getByRole('textbox', { name: 'ابحث في شعبك وطلابك…' })
      await box.fill('سارة')
      await p.waitForTimeout(900)
      await settle(e)
      await shoot(e, { name: 'search', clip: await panel(box, 400), clipPad: 14, spotlight: false })
      await p.keyboard.press('Escape')
    },
  },
]

async function main_() {
  const e = await startEngine({
    base: BASE, outDir: OUT,
    chrome: process.env.GUIDE_CHROME ?? '/opt/pw-browsers/chromium',
    fontCache: process.env.GUIDE_FONT_CACHE,
  })
  e.page.setDefaultTimeout(10_000)
  const assets = await drawAssets(e)
  await e.context.route(`${GUIDE_ASSET_HOST}/**`, (route) => {
    const a = assets[new URL(route.request().url()).pathname]
    return a ? route.fulfill({ status: 200, contentType: a.type, body: a.body }) : route.fulfill({ status: 404, body: '' })
  })

  const run = async (list: Shot[], email: string) => {
    const todo = list.filter((x) => wanted(x.name))
    if (!todo.length) return
    await signIn(e, email, GUIDE_PASSWORD)
    for (const shot of todo) {
      try { await shot.run(e) } catch (err) {
        failed.push(shot.name)
        console.error(`   ✗ ${shot.name}: ${(err as Error).message.split('\n')[0]}`)
      }
    }
  }
  const failed: string[] = []
  console.log('① من اعتُمد توقيعُه الآن')
  await run(FRESH, GUIDE_ACCOUNTS.fresh.email)
  console.log('② المدرّبُ النشط')
  await run(ACTIVE, GUIDE_ACCOUNTS.active.email)
  await e.browser.close()

  /* البيانُ يُدمَج بما قبله: `--only` يصوّر بعضا ويُبقي أبعادَ غيره */
  const prev = (() => {
    try {
      const src = readFileSync(MANIFEST, 'utf8')
      const json = src.slice(src.indexOf('= {') + 2, src.lastIndexOf('}') + 1)
      return JSON.parse(json) as Record<string, { w: number; h: number }>
    } catch { return {} }
  })()
  const all = { ...prev, ...e.shots }
  const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]))
  const head = readFileSync(MANIFEST, 'utf8').split('export const')[0]
  writeFileSync(MANIFEST, `${head}export const GUIDE_SHOTS: Record<string, { w: number; h: number }> = ${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`✅ ${Object.keys(e.shots).length} لقطة — والبيانُ ${Object.keys(sorted).length}`)
  if (failed.length) {
    console.error(`✗ لم تُلتقط: ${failed.join('، ')}`)
    process.exitCode = 1
  }
}

await main_()
