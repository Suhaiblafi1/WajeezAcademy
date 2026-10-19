/* صفحةُ المدرّبين — الاسمُ ومعه ما يقدّمه.

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): «كلُّ مدرّبٍ تظهر له نبذةٌ بنصٍّ
   منسدل، وفيها كلُّ الدورات التي سيقدّمها وأُسندت له، ليتمكّن الأشخاصُ من
   الوصول لدوراته أو مساره إن كان له مسارٌ خاصّ، فيشتري المشتري مباشرةً من
   هناك.»

   وما كان: `assignedCourseIds` تصل من الخادم في كلّ مدرّبٍ ولا تُعرض لأحد —
   والبطاقةُ نبذةٌ ومهاراتٌ بلا بابٍ إلى شيءٍ يُشترى. وأسماءُ المدرّبين تصل في
   `/api/public/cohorts` ولا يقرؤها منتقي الشعبة، فيختار المشتري بين شعبتين
   بموعدهما وحدَه.

   والفحصُ على البنية لا على ورود حرف: أنّ المعرّفاتِ تُفكّ بدالّة الكتالوج،
   وأنّ الرابطَ يقصد صفحةَ الدورة التي تُشترى منها، وأنّ الطيَّ معلَنٌ لقارئ
   الشاشة. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('صفحة المدرّبين — نبذة منسدلة ودورات تشترى', () => {
  const page = read('src/pages/Trainers.tsx')

  it('الدورات المسندة تفكّ من الكتالوج وتربط بصفحة الشراء', () => {
    expect(page, 'المعرّفات تصل ولا تفكّ').toMatch(/assignedCourseIds[\s\S]*courseById\(/)
    expect(page, 'لا رابط إلى صفحة الدورة').toContain('to={`/build/${')
  })

  /* ⚠️ انقلب (١٩ أكتوبر ٢٠٢٦): كان يشترط سطرَ «يقدّم في مسارات» مشتقّا من دوراته وبرابطه. ثمّ قال صاحبُ
     المنصّة: «الغِ قسم "ما يقدّم من مسارات"» — فالبطاقةُ دوراتُه بمواسمها وحدَها. ورُئي ساقطا على البطاقة
     التي فيها السطر. */
  it('⚠️ ولا سطر «يقدّم في مسارات» في البطاقة', () => {
    expect(page, 'عاد اشتقاق المسار في البطاقة').not.toMatch(/pathwayById\(/)
    expect(page, 'عاد رابط المسار').not.toContain('to={`/pathways/${')
    /* النصُّ يُفحص في الشيفرة لا في التعليق الذي يشرح رفعَه */
    const code = page.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code, 'عاد نص السطر').not.toMatch(/يقدّم في مسار/)
  })

  it('والطيّ معلن: زرّ بـaria-expanded يفتح نبذة لها معرّفها', () => {
    expect(page).toMatch(/aria-expanded=\{/)
    expect(page).toMatch(/aria-controls=\{/)
  })
})

describe('اسم المدرّب في اختيار الشعبة', () => {
  it('المصدر يحمل أسماء المدرّبين من الخادم', () => {
    const src = read('src/services/cohort-prices.ts')
    expect(src, 'الحقل يصل ولا يقرأ').toMatch(/trainers:\s*Array\.isArray\(c\.trainers\)/)
    expect(src).toMatch(/interface CohortOption[\s\S]*trainers: string\[\]/)
  })

  it('والمنتقي ولوح الشراء يعرضانه', () => {
    expect(read('src/components/CohortPicker.tsx')).toMatch(/c\.trainers/)
    expect(read('src/components/BuyPanel.tsx')).toMatch(/o\.trainers/)
  })
})

describe('بوّابة الظهور العامّ واحدة في الخادم', () => {
  it('بطاقة الدورة والشعب العامّة تقرآن البوّابة نفسها — لا نسخة لكلّ', () => {
    const gate = read('server/services/trainer-visibility.ts')
    expect(gate).toMatch(/publishApprovedAt !== null/)
    expect(gate).toMatch(/suspendedAt === null/)
    expect(read('server/services/trainer-review.service.ts')).toMatch(/trainerPubliclyVisible\(/)
    expect(read('server/services/public-catalog.service.ts')).toMatch(/trainerPubliclyVisible\(/)
  })

  it('ورفع الإيقاف يعيد الظهور لمن كان نشره معتمدا', () => {
    const review = read('server/services/trainer-review.service.ts')
    const block = review.slice(review.indexOf("action === 'reinstate'"), review.indexOf("action === 'conditionally_approve'"))
    expect(block, 'رفع الإيقاف لا يعيد publicVisibility').toMatch(/publicVisibility:\s*profile\.publishApprovedAt !== null/)
  })
})
