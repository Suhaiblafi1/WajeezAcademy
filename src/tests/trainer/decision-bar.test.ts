/* شريطُ القرار — يمضي على الهاتف، ويلصق صفُّ أزراره وحدَه على الحاسوب.

   ═══ الهاتف (٣٠ سبتمبر ٢٠٢٦) ═══

   بلّغ صاحبُ المنصّة من هاتفه: «الخانة المكتوب فيها بالأصفر لا تتحرك وثابتة على
   الهاتف… لأستطيع أن أرى الصفحة كاملة». كان شريطُ القرار `sticky top-0` على كلّ
   عرض، وعلى الهاتف تنكسر أزرارُه أسطرا ومعها ما ينقص قبل الاعتماد، فيغطّي نصفَ
   الشاشة. فصار يمضي مع التمرير هناك، بطاقةً واحدةً كما كان.

   وما ينقص يُكتب بحبرٍ ينقلب مع المظهر (`text-gold-ink`). كان `text-amber-200/90`،
   وتجاوزُ المظهر الفاتح مكتوبٌ لـ`text-amber-200` وحدَه — والصنفُ ذو الشفافيّة صنفٌ
   آخرُ لا يبلغه التجاوز، فظهر أصفرَ باهتا على الورق. ومعه سطرا «التجهيز» اللذان
   يفتحهما الشريط.

   ═══ الحاسوب (١ أكتوبر ٢٠٢٦) ═══

   ثمّ قِيس على الحاسوب، وأمر صاحبُ المنصّة بإصلاحه:
   · كان الشريطُ كلُّه يلصق — الاسمُ والأزرارُ وما ينقص — فكان أكثرَ من نصف الشاشة
     عند ١٢٨٠×٨٠٠ و١٣٦٦×٧٦٨.
   · ولصق عند `top-0` والترويسةُ لاصقةٌ هناك فوقه، فغاب تحتها رأسُه.
   · وغطّى شريطَ «أقسام الملفّ» اللاصقَ تحته، فلم يُرَ مع التمرير قطّ.

   فصفُّ الأزرار وحدَه يلصق، تحت الترويسة لا تحتها؛ وما ينقص بطاقةٌ تمضي؛
   والفهرسُ لا يلصق (الثلاثةُ معا ٤٠–٥٠٪ من نافذة حاسوبٍ محمول)؛ ومن قفز إلى قسمٍ
   وقع عنوانُه تحت الصفّ لا خلفه. قِيس في متصفّحٍ حقيقيّ: ما يلصق بعد التمرير
   ١٧–٣٣٪ من النافذة بعد أن كان فوق نصفها.

   والفحصُ على **أصناف العنصر نفسِه** وعلى **حدود وسمه**: يُقتطع الوسمُ ثمّ تُقرأ
   أصنافُه كلمةً كلمة، ويُتتبَّع إغلاقُه بعدّ ما يُفتح ويُغلق — فلا يُخدَع بورود
   «sticky» في تعليق، ولا بصنفٍ يحمل الكلمةَ جزءا من اسمه. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const APPS = read('src/pages/admin/TrainerApplications.tsx')
const PREP = read('src/pages/admin/PreparationSteps.tsx')
const LAYOUT = read('src/pages/admin/AdminLayout.tsx')

/** موضعُ أقربِ وسمٍ `<tag` مفتوحٍ قبل `anchor` — أي الوسمِ الذي يحمله.
    والحدُّ بعد اسم الوسم مقصود: `<p` لا يُطابق `<path` ولا `<pre`. */
function openBefore(src: string, anchor: string, tag: string, from = src.indexOf(anchor)): number {
  expect(from, `لا موضعَ لـ«${anchor}»`).toBeGreaterThan(-1)
  let open = -1
  for (const m of src.slice(0, from + anchor.length).matchAll(new RegExp(`<${tag}\\b`, 'g'))) open = m.index!
  expect(open, `لا <${tag}> يحمل «${anchor}»`).toBeGreaterThan(-1)
  return open
}

/** أصنافُ الوسم المفتوح عند `open` كلمةً كلمة — وفراغٌ إن لم يحمل أصنافا */
function classesAt(src: string, open: number): string[] {
  const tag = /^<[^>]*?>/.exec(src.slice(open))?.[0] ?? ''
  const cls = /className="([^"]*)"/.exec(tag)
  return cls ? cls[1].split(/\s+/).filter(Boolean) : []
}

/** الوسمُ نفسُه من فتحه إلى إغلاقه المقابل — يُعدّ ما يُفتح من اسمه وما يُغلق */
function extentAt(src: string, open: number, tag: string): string {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'g')
  re.lastIndex = open
  let depth = 0
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m[1]) depth -= 1
    else if (!m[2]) depth += 1
    if (depth === 0) return src.slice(open, m.index + m[0].length)
  }
  throw new Error(`<${tag}> بلا إغلاق`)
}

const tokens = (classes: string[], re: RegExp) => classes.filter((c) => re.test(c))

/* الصفُّ هو البطاقةُ التي تحمل أزرارَ القرار — لا ما يليه تعليقٌ باسمه.
   والحاضنةُ أقربُ بطاقةٍ قبله تحيط به. */
const STRIP_OPEN = openBefore(APPS, 'barActions.map(', 'Card')
const STRIP = extentAt(APPS, STRIP_OPEN, 'Card')
const STRIP_CLS = classesAt(APPS, STRIP_OPEN)
const OUTER_OPEN = [...APPS.slice(0, STRIP_OPEN).matchAll(/<Card\b/g)].at(-1)?.index ?? -1
const OUTER = extentAt(APPS, OUTER_OPEN, 'Card')
const OUTER_CLS = classesAt(APPS, OUTER_OPEN)
const NOTE_TEXT = 'لا يُعتمَد اعتمادا كاملا قبل أن يتمّ تجهيزُه'
const NOTE_CARD_CLS = classesAt(APPS, openBefore(APPS, NOTE_TEXT, 'Card'))

describe('شريطُ القرار على الهاتف', () => {
  it('⚠️ لا يلصق — يمضي مع التمرير ولا يغطّي الملفّ', () => {
    expect(STRIP_CLS, 'لاصقٌ على الهاتف — يغطّي الملفَّ ولا يتحرّك').not.toContain('sticky')
    expect(STRIP_CLS).not.toContain('fixed')
    expect(tokens(STRIP_CLS, /^(sm|md):(sticky|fixed)$/), 'لاصقٌ على شاشةٍ صغيرة').toEqual([])
  })

  it('وهو بطاقةٌ واحدةٌ هناك كما كانت — القطعتان بلا صندوقٍ تحت `lg`', () => {
    expect(OUTER.includes(STRIP) && OUTER.includes(NOTE_TEXT), 'القطعتان خرجتا من البطاقة الحاضنة').toBe(true)
    expect(STRIP_CLS, 'صفُّ الأزرار بطاقةٌ ثانيةٌ على الهاتف').toContain('max-lg:contents')
    expect(NOTE_CARD_CLS, 'ما ينقص بطاقةٌ ثانيةٌ على الهاتف').toContain('max-lg:contents')
    expect(OUTER_CLS, 'الحاضنةُ بلا صندوقٍ على الهاتف — فلا بطاقةَ أصلا').not.toContain('max-lg:contents')
  })
})

describe('شريطُ القرار على الحاسوب', () => {
  it('⚠️ صفُّ الأزرار يلصق تحت الترويسة لا تحتها', () => {
    expect(STRIP_CLS, 'فقد لصوقَه على الحاسوب — والفعلُ في متناول اليد قرارٌ قائم').toContain('lg:sticky')
    /* والإزاحةُ ارتفاعُ الترويسة نفسُها: لو تبدّل أحدُهما وحدَه عاد الصفُّ يغيب تحتها
       أو يترك فرجةً يمرّ فيها المتن */
    const headerRow = /<header\b[^>]*>\s*<div className="([^"]*)"/.exec(LAYOUT)?.[1] ?? ''
    const headerH = /(?:^|\s)h-(\d+)(?:\s|$)/.exec(headerRow)?.[1]
    expect(headerH, 'لا ارتفاعَ مكتوبا لترويسة الإدارة').toBeDefined()
    expect(tokens(STRIP_CLS, /^lg:top-/), 'الصفُّ لا يلصق عند حافّة الترويسة').toEqual([`lg:top-${headerH}`])
  })

  it('⚠️ والبطاقةُ الحاضنةُ بلا صندوقٍ على الحاسوب — وإلّا حبست الملتصقَ فيها', () => {
    /* الملتصقُ يلتصق داخلَ صندوق أبيه وحدَه: لو بقيت الحاضنةُ صندوقا لمضى معها
       الصفُّ بعد بضع مئاتٍ من البكسلات */
    expect(OUTER_CLS).toContain('lg:contents')
  })

  it('⚠️ وما ينقص ليس في الصفّ اللاصق — يمضي مع التمرير', () => {
    expect(STRIP, 'ما ينقص عاد إلى الصفّ اللاصق — فيطول ويأكل الشاشة').not.toContain(NOTE_TEXT)
  })

  it('والاسمُ يغيب عن الصفّ على الحاسوب — دربُ الوصول يحمله، وبقاؤه يكسر الصفَّ سطرَين', () => {
    expect(STRIP, 'الاسمُ خرج من الشريط — والهاتفُ يقرؤه فيه').toContain('{a.fullName}</p>')
    const nameDiv = classesAt(APPS, openBefore(APPS, '{a.fullName}</p>', 'div', STRIP_OPEN + STRIP.indexOf('{a.fullName}</p>')))
    expect(nameDiv).toContain('lg:hidden')
  })

  it('ونغمتُه صلبة — يمرّ تحته متنٌ يُقرأ', () => {
    expect(/^<Card\b[^>]*\btone="solid"/.test(STRIP), 'صفٌّ لاصقٌ بأرضيّةٍ شفّافة').toBe(true)
  })
})

describe('فهرسُ الأقسام', () => {
  it('⚠️ لا يلصق على أيّ عرض — والثلاثةُ معا نصفُ نافذة حاسوبٍ محمول', () => {
    const nav = classesAt(APPS, openBefore(APPS, 'aria-label="أقسام الملفّ"', 'nav'))
    expect(tokens(nav, /(?:^|:)(sticky|fixed)$/), 'الفهرسُ لاصقٌ').toEqual([])
  })

  it('⚠️ ومن قفز إلى قسمٍ وقع عنوانُه تحت الصفّ اللاصق لا خلفه', () => {
    /* يلصق فوق القسم ١٧٩ بكسلا في أسوأ حال: الترويسةُ ٦٥ وصفّا أزرارٍ ١١٤ (تحت
       ١٣٦٦). فالهامشُ لا يقلّ عن ٤٥ (×٤ بكسل) — وكان `scroll-mt-28` وحدَه */
    const first = APPS.indexOf('id="sec-profile"')
    const last = APPS.indexOf('id="sec-rubric"')
    expect(first, 'لا مرساةَ لأوّل قسم').toBeGreaterThan(-1)
    let found = false
    for (const m of APPS.slice(0, first).matchAll(/<div\b/g)) {
      const scroll = classesAt(APPS, m.index!).map((c) => /^lg:\[&_\[id\^=sec-\]\]:scroll-mt-(\d+)$/.exec(c)?.[1]).find(Boolean)
      if (!scroll) continue
      const box = extentAt(APPS, m.index!, 'div')
      expect(box.includes('id="sec-profile"') && box.includes('id="sec-rubric"') && last > first, 'الهامشُ لا يحيط بالأقسام كلِّها').toBe(true)
      expect(Number(scroll), 'الهامشُ أقصرُ ممّا يلصق فوقه').toBeGreaterThanOrEqual(45)
      found = true
    }
    expect(found, 'لا هامشَ وصولٍ للأقسام على الحاسوب').toBe(true)
  })
})

describe('وما ينقص يُقرأ على الورق', () => {
  const readableInk = (classes: string[]) => {
    expect(classes, 'ما ينقص يُكتب بحبرٍ لا يُقرأ على الورق').toContain('text-gold-ink')
    expect(tokens(classes, /^text-[a-z]+-\d{2,3}\/\d+$/)).toEqual([])
  }

  it('⚠️ في شريط القرار', () => {
    readableInk(classesAt(APPS, openBefore(APPS, NOTE_TEXT, 'span')))
  })

  it('وفاصلُه عن الأزرار يُرى على الهاتف — لونُه بلا بادئة يبلغها تجاوزُ الورق', () => {
    /* `max-lg:border-white/10` صنفٌ غيرُ `border-white/10`، وتجاوزُ المظهر الفاتح
       مكتوبٌ للثاني وحدَه — فغاب الفاصلُ على الورق أوّلَ ما كُتب */
    const divider = classesAt(APPS, openBefore(APPS, NOTE_TEXT, 'div'))
    expect(divider).toContain('max-lg:border-t')
    expect(divider).toContain('border-white/10')
    expect(tokens(divider, /^[\w-]+:border-white\//)).toEqual([])
  })

  it('وفي «التجهيز» الذي يفتحه — ما ينقص كلَّ خطوة، وسببُ الاعتذار عن العقد', () => {
    readableInk(classesAt(PREP, openBefore(PREP, '{blockerAr}</p>', 'p')))
    readableInk(classesAt(PREP, openBefore(PREP, 'اعتذر: {c.declineReasonAr}', 'p')))
  })
})
