/* شريطُ الإدارة — ولا شاشةَ تختفي بصمت.

   ═══ العطبُ الذي كُتب له (٢٠ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «لا أرى صحّةَ النظام في صفحة الأدمن»، ثمّ: «هناك
   فقراتٌ مفقودة.. مثل المستخدمين والأدوار».

   ولم تكن مفقودةً ولا معطوبة: `sectionsFor` تُخفي البندَ الذي لا يملك
   الداخلُ صلاحيّتَه، **وتُخفي المجموعةَ بعنوانها حين تفرغ بنودُها**. وذاك
   صوابٌ في نفسه — من لا يملك شيئا لا يُعرض له عنوانٌ فارغ. غير أنّ أثرَه
   حين تُنزَع حبّةٌ أنّ شاشةً تخرج من الشريط **ولا يقول ذلك أحد**: لا
   خطأَ، ولا تحذير، ولا سطرَ في سجلّ.

   ═══ وما يُحرَس هنا ═══

   ① **من ملك الكلَّ رأى الكلّ** — أيُّ بندٍ يُحرَس بحبّةٍ لا وجودَ لها في
      `PERMISSIONS` يختفي عن **كلّ** حساب، والمديرُ الأعلى يأخذ الحبّاتِ
      كلَّها. فلو اختفى عنه بندٌ فالحبّةُ خطأٌ إملائيٌّ أو حبّةٌ حُذفت.
      وهذا هو الحارسُ الذي كان يمسك الشكوى قبل أن تُرفَع.
   ② **ولكلّ بندٍ طريقٌ مسجَّل** — بندٌ يُعرض ويُنقر فيُفتح فراغٌ أسوأُ من
      بندٍ لا يُعرض.
   ③ **ولا مجموعةَ بلا بنود** — مجموعةٌ فارغةٌ في المصدر عنوانٌ لا يُفتح. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { allSections, sectionsFor } from '@/pages/admin/nav-map'
import { PERMISSIONS } from '../../../server/auth/permissions'

const ALL_KEYS: string[] = PERMISSIONS.map((p) => p.key)

/** كلُّ بندٍ في الشريط، مقرونا بعنوان مجموعته */
const everyItem = allSections.flatMap((s) => s.items.map((it) => ({ ...it, section: s.title })))

describe('① من ملك الصلاحيّاتِ كلَّها رأى الشاشاتِ كلَّها', () => {
  it('ولا يسقط بندٌ عن المديرِ الأعلى — فسقوطُه يعني حبّةً لا وجودَ لها', () => {
    const seen = sectionsFor(ALL_KEYS).flatMap((s) => s.items.map((it) => it.to))
    const missing = everyItem.filter((it) => !seen.includes(it.to))
    expect(
      missing.map((m) => `${m.section} › ${m.label} (${String(m.need)})`),
      'بنودٌ تختفي عن المديرِ الأعلى — وحبّةُ حراستها ليست في `PERMISSIONS`',
    ).toEqual([])
  })

  it('ولا تسقط مجموعةٌ بعنوانها', () => {
    const titles = sectionsFor(ALL_KEYS).map((s) => s.title)
    expect(titles, 'مجموعةٌ كاملةٌ اختفت عن المديرِ الأعلى')
      .toEqual(allSections.map((s) => s.title))
  })

  /* ═══ وكلُّ حبّةِ حراسةٍ اسمُها اسمٌ حقيقيّ ═══

     وهذا يقول **أيُّها** أخطأ، لا «بندٌ اختفى» وسكوت — فمن قرأه عرف
     الحبّةَ بعينها ولم يبحث عنها في تسعٍ وستّين. */
  it('وكلُّ حبّةٍ يُحرَس بها بندٌ موجودةٌ في `PERMISSIONS`', () => {
    const unknown: string[] = []
    for (const it of everyItem) {
      for (const need of Array.isArray(it.need) ? it.need : it.need ? [it.need] : []) {
        if (!ALL_KEYS.includes(need)) unknown.push(`${it.label} → ${need}`)
      }
    }
    expect(unknown, 'حبّاتٌ يُحرَس بها الشريطُ ولا وجودَ لها — فالبندُ يختفي عن الجميع')
      .toEqual([])
  })
})

describe('② ولكلّ بندٍ طريقٌ يفتحه', () => {
  const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8')

  it('ولا بندَ يُنقر فيُفتح فراغ', () => {
    const orphans = everyItem.filter((it) => !app.includes(`path="${it.to}"`))
    expect(
      orphans.map((o) => `${o.section} › ${o.label} (${o.to})`),
      'بنودٌ في الشريط بلا طريقٍ مسجَّلٍ في `App.tsx`',
    ).toEqual([])
  })
})

describe('③ ولا مجموعةَ بلا بنود', () => {
  it('فعنوانٌ لا يُفتح ليس عنوانا', () => {
    const empty = allSections.filter((s) => s.items.length === 0).map((s) => s.title)
    expect(empty, 'مجموعاتٌ بلا بنودٍ في المصدر').toEqual([])
  })
})

/* ═══ وما يراه من لا يملك شيئا ═══

   الترشيحُ صوابٌ ولا يُنقض هنا — إنّما يُثبَت أنّه يرشّح فعلا، فلو عاد
   يعرض كلَّ شيءٍ لكلّ أحدٍ لَصار الشريطُ بابا مفتوحا على شاشاتٍ تردّ
   ٤٠٣ عند أوّل نقرة. */
describe('والترشيحُ يرشّح — فليس الشريطُ بابا مفتوحا', () => {
  it('ومن لا حبّةَ عنده لا يرى إلّا المفتوحَ بلا صلاحيّة', () => {
    const open = everyItem.filter((it) => !it.need).length
    const seen = sectionsFor([]).flatMap((s) => s.items)
    expect(seen).toHaveLength(open)
    expect(seen.every((it) => !it.need), 'بندٌ محروسٌ ظهر لمن لا يملك شيئا').toBe(true)
  })
})
