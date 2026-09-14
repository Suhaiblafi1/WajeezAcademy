/* بابُ البحث في البوّابات (ب-٤).

   شكوى ١٣ سبتمبر ٢٠٢٦: «شكل الsearch غبي». وكان زرّا نصّيّا صرفا — «بحث…»
   ثمّ `Ctrl K` — مكتوبا **بيده مرّتين**: في `AdminLayout` وفي
   `TrainerLayout`. فصار مكوّنا واحدا يناديانه.

   وهذا ثالثُ موضعٍ في هذه الجولة يتكرّر فيه شيءٌ واحدٌ في مكانين (رأسا
   الموقع، وسقفا المتن، وهذا) — ولذلك يُحرَس التكرارُ نفسُه لا شكلُ الزرّ:
   من عاد فكتبه بيده في شاشةٍ ثالثةٍ سقط هذا الحارس. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const LAYOUTS = ['src/pages/admin/AdminLayout.tsx', 'src/pages/trainer/TrainerLayout.tsx']

describe('بابُ البحث مكوّنٌ واحدٌ لا نسختان', () => {
  for (const f of LAYOUTS) {
    it(`⚠️ ${f.split('/').pop()} تنادي المكوّنَ ولا تكتب زرّا بيدها`, () => {
      const src = code(f)
      expect(src, 'لا نداءَ للمكوّن المشترك').toMatch(/<SearchChip\b/)
      expect(src, 'زرُّ بحثٍ مكتوبٌ بيده عاد إلى الشاشة')
        .not.toMatch(/wajeez:open-search[\s\S]{0,400}?<kbd/)
    })
  }

  it('⚠️ والعدسةُ فيه — وغيابُها نصفُ الشكوى', () => {
    /* بحثُ الزائر في الموقع العامّ له عدسةٌ تقول ما هو بلا قراءة، وبحثُ
       البوّابات كان بلا شيءٍ فيُقرأ لصيقةً شاردةً لا زرّا. */
    const chip = code('src/components/SearchChip.tsx')
    expect(chip, 'لا عدسةَ في الزرّ').toMatch(/<Search\b/)
  })

  it('⚠️ ولا يُبتر نصُّه — فالنصُّ المبتورُ هو «الشكلُ الغبيّ» بعينه', () => {
    /* `flex-1 truncate` كان يقصّ «ابحث في شعبك وط…» حين يضيق الشريط. */
    const chip = code('src/components/SearchChip.tsx')
    expect(chip, 'عاد القصُّ إلى نصّ الزرّ').not.toMatch(/truncate/)
    expect(chip, 'النصُّ يُلَفّ فيكسر ارتفاعَ الشريط').toMatch(/whitespace-nowrap/)
  })

  it('⚠️ وكلُّ بوّابةٍ تقول أين تبحث — لا «بحث…» مجرّدةً', () => {
    /* نصفُ فائدة الحقل أن يقول نطاقَه: المدرّبُ يبحث في شعبه، والمديرُ في
       الحسابات — ولصيقةٌ واحدةٌ للاثنين تُضيّع ذلك. */
    const hints = LAYOUTS.map((f) => /hintAr="([^"]+)"/.exec(code(f))?.[1] ?? '')
    for (const h of hints) expect(h.length, 'بوّابةٌ بلا نصٍّ يقول أين تبحث').toBeGreaterThan(8)
    expect(new Set(hints).size, 'البوّابتان على نصٍّ واحدٍ فلا يُعرف نطاقُ أيّهما').toBe(2)
  })

  it('والمفتاحُ يبقى معلَنا — هو أسرعُ طريقٍ إليه', () => {
    expect(code('src/components/SearchChip.tsx')).toMatch(/Ctrl K/)
    expect(code('src/components/SearchChip.tsx')).toMatch(/wajeez:open-search/)
  })
})
