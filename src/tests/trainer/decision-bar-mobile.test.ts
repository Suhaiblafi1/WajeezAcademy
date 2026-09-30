/* شريطُ القرار على الهاتف — يمضي مع التمرير ولا يغطّي الملفّ (٣٠ سبتمبر ٢٠٢٦).

   بلّغ صاحبُ المنصّة من هاتفه: «الخانة المكتوب فيها بالأصفر لا تتحرك وثابتة على
   الهاتف… لأستطيع أن أرى الصفحة كاملة». كان شريطُ القرار `sticky top-0` على كلّ
   عرض، وعلى الهاتف تنكسر أزرارُه أسطرا ومعها ما ينقص قبل الاعتماد، فيغطّي نصفَ
   الشاشة. وتحته شريطُ «أقسام الملفّ» لاصقٌ كذلك.

   ① لا يلصقان إلّا من `lg` — والشاشةُ الواسعةُ تبقى على قرار صاحب المنصّة: الفعلُ
      في متناول اليد دائما.
   ② وما ينقص يُكتب بحبرٍ ينقلب مع المظهر (`text-gold-ink`). كان `text-amber-200/90`،
      وتجاوزُ المظهر الفاتح مكتوبٌ لـ`text-amber-200` وحدَه — والصنفُ ذو الشفافيّة صنفٌ
      آخرُ لا يبلغه التجاوز، فظهر أصفرَ باهتا على الورق. ومعه سطرا «التجهيز» اللذان
      يفتحهما الشريط.

   والفحصُ على **أصناف العنصر نفسِه**: يُقتطع وسمُه ثمّ تُقرأ أصنافُه كلمةً كلمة —
   فلا يُخدَع بورود «sticky» في تعليق، ولا بصنفٍ يحمل الكلمةَ جزءا من اسمه. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const APPS = read('src/pages/admin/TrainerApplications.tsx')
const PREP = read('src/pages/admin/PreparationSteps.tsx')

/** أصنافُ أقربِ وسمٍ `<tag` مفتوحٍ قبل `anchor` — أي الوسمِ الذي يحمله — كلمةً كلمة.
    والحدُّ بعد اسم الوسم مقصود: `<p` لا يُطابق `<path` ولا `<pre`. */
function classesOf(src: string, anchor: string, tag: string): string[] {
  const at = src.indexOf(anchor)
  expect(at, `لا موضعَ لـ«${anchor}»`).toBeGreaterThan(-1)
  let open = -1
  for (const m of src.slice(0, at + anchor.length).matchAll(new RegExp(`<${tag}\\b`, 'g'))) open = m.index!
  expect(open, `لا <${tag}> يحمل «${anchor}»`).toBeGreaterThan(-1)
  const cls = /^[^>]*?className="([^"]*)"/.exec(src.slice(open))
  expect(cls, `<${tag}> بلا أصناف`).not.toBeNull()
  return cls![1].split(/\s+/).filter(Boolean)
}

/** يلصق على الشاشة الواسعة وحدَها */
function stickyOnlyWide(classes: string[]) {
  expect(classes, 'لاصقٌ على الهاتف — يغطّي الملفَّ ولا يتحرّك').not.toContain('sticky')
  expect(classes).not.toContain('fixed')
  expect(classes.filter((c) => /^(sm|md):(sticky|fixed)$/.test(c)), 'لاصقٌ على شاشةٍ صغيرة').toEqual([])
  expect(classes, 'فقد لصوقَه على الشاشة الواسعة — والفعلُ في متناول اليد قرارٌ قائم').toContain('lg:sticky')
}

/** حبرٌ ينقلب مع المظهر — لا درجةٌ ذاتُ شفافيّةٍ لا يبلغها تجاوزُ الورق */
function readableInk(classes: string[]) {
  expect(classes, 'ما ينقص يُكتب بحبرٍ لا يُقرأ على الورق').toContain('text-gold-ink')
  expect(classes.filter((c) => /^text-[a-z]+-\d{2,3}\/\d+$/.test(c))).toEqual([])
}

describe('شريطُ القرار على الهاتف', () => {
  it('⚠️ يمضي مع التمرير على الهاتف — ويلصق على الشاشة الواسعة وحدَها', () => {
    /* الشريطُ هو البطاقةُ التي تحمل أزرارَ القرار — لا ما يليه تعليقٌ باسمه */
    stickyOnlyWide(classesOf(APPS, 'barActions.map(', 'Card'))
  })

  it('⚠️ وشريطُ «أقسام الملفّ» تحته كذلك', () => {
    stickyOnlyWide(classesOf(APPS, 'aria-label="أقسام الملفّ"', 'nav'))
  })
})

describe('وما ينقص يُقرأ على الورق', () => {
  it('⚠️ في شريط القرار', () => {
    readableInk(classesOf(APPS, 'لا يُعتمَد اعتمادا كاملا قبل أن يتمّ تجهيزُه', 'span'))
  })

  it('وفي «التجهيز» الذي يفتحه — ما ينقص كلَّ خطوة، وسببُ الاعتذار عن العقد', () => {
    readableInk(classesOf(PREP, '{blockerAr}</p>', 'p'))
    readableInk(classesOf(PREP, 'اعتذر: {c.declineReasonAr}', 'p'))
  })
})
