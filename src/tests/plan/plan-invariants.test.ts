/* حارس الخطّة المعتمَدة — نصّي على المستودع لا على التصيير.

   لا اختبارات واجهة في هذا المستودع (لا jsdom ولا testing-library)، فالأعطال
   التي أصابت الرحلة وصلت الإنتاج بلا أن يحمرّ شيء. وحتى يوجد إطارٌ للتصيير،
   هذا الحارس يمنع **عودة الأنماط بعينها** التي كسرتها — كما يفعل حارس «لا
   محاكاة» القائم. أرخص من لا شيء، وأصدق من ادّعاء تغطيةٍ لا توجد. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')
const read = (p: string) => readFileSync(join(SRC, p), 'utf8')

const PATHWAY = read('pages/Pathway.tsx')
const DIAGNOSTIC = read('pages/Diagnostic.tsx')

describe('مصدر واحد للخطّة المعتمَدة', () => {
  it('لا كتابة إلى المفتاح القديم wajeez_custom', () => {
    /* كان يُكتب بشكلين مختلفين ويُقرأ بحارس لا يطابق أحدهما، فتُستبدل الخطّة بصمت */
    for (const [name, body] of [['Pathway.tsx', PATHWAY], ['Diagnostic.tsx', DIAGNOSTIC]] as const) {
      expect(body, `${name} يكتب المفتاح القديم`).not.toMatch(/setItem\(\s*["']wajeez_custom["']/)
    }
  })

  it('صفحة المسار لا تقرأ المفتاح القديم أصلا', () => {
    /* الحارس القديم كان `c.pathwayId === pathway.id` على سجلٍّ مقروء من
       wajeez_custom. والمقارنة نفسها بريئة (ترتيب المقترحات يستعملها)، فالحدّ
       الحقيقيّ هو **قراءة المفتاح القديم**. */
    expect(PATHWAY).not.toMatch(/getItem\(\s*["']wajeez_custom["']/)
  })

  it('الكتابة تمرّ بالوحدة وحدها — لا setItem مباشر لمفتاح الخطّة', () => {
    for (const [name, body] of [['Pathway.tsx', PATHWAY], ['Diagnostic.tsx', DIAGNOSTIC]] as const) {
      expect(body, `${name} يكتب مفتاح الخطّة مباشرة`).not.toMatch(/setItem\(\s*["']wajeez_adopted_plan["']/)
    }
    expect(PATHWAY).toMatch(/saveAdoptedPlan/)
    expect(DIAGNOSTIC).toMatch(/saveAdoptedPlan/)
  })

  it('العنوان من الخطّة المعتمَدة لا من المسار المضيف وحده', () => {
    /* `{pathway.name}` عاريا في h1 هو ما جعل الخطّة تُقرأ مُعادةَ التسمية */
    expect(PATHWAY).toMatch(/adopted\?\.nameAr\s*\?\?\s*pathway\.name/)
  })

  /* كان هنا حارسٌ على زرّ «عد لنتيجتك لإعادة التخصيص» في صفحة المسار: يتأكّد
     أنّه يقصد `?view=result` لا فهرس التشخيص. وقد حُذف الزرّ وشارته كلّها
     بقرار صاحب المنصّة — التخصيص كلّه متاح في صفحة المسار نفسها (استبدال
     وحذف وإضافة وهديّة في رحلة الدورات)، فإعادةُ المتعلّم إلى صفحةٍ سابقة
     لينال ما بين يديه خطوةٌ تُضيع لا تُفيد.

     والحارس يبقى على الطرف الذي لم يُحذف: صفحة التشخيص ما زالت تفتح على
     النتيجة حين يُطلب ذلك — يستعملها المتعلّم من روابط أخرى، وكسرُها صامتا
     يُعيده إلى المقدّمة ليجيب من جديد. وحذفُ الزرّ نفسه يحرسه
     src/tests/commerce/pathway-offer.test.ts. */
  it('صفحة التشخيص تفتح على النتيجة حين تُطلب — لا على المقدّمة', () => {
    expect(DIAGNOSTIC).toMatch(/searchParams\.get\("view"\)\s*===\s*"result"/)
  })
})

describe('عرض السعر — مرحلة الإقناع', () => {
  /* انقلب القرار: «سعر المسار يجب أن يظهر كاملا، ليس تبدأ من — فهذا أمرٌ
     قديم تراجعتُ عنه». و«تبدأ من» وُضعت يوم كانت أكثرُ الشعب بلا سعر، فصارت
     تُخفي الرقمَ الذي يُقتطع فعلا. فالحارسُ ينقلب معه: يمنعها بدل أن يطلبها. */
  it('الصدارة سعرُ المسار كاملا — و«تبدأ من» لا تعود', () => {
    expect(PATHWAY).toMatch(/المسار كاملا/)
    expect(PATHWAY, '«تبدأ من» عادت إلى صدارة السعر').not.toMatch(/">تبدأ من</)
  })

  it('الخصمان معروضان: المسار كاملا وأوّل شراء', () => {
    expect(PATHWAY).toMatch(/على المسار كاملا/)
    expect(PATHWAY).toMatch(/FIRST_TIME_PROMO\.code/)
  })

  /* وسقط معه «السعر يُحدَّد بعد أن تعتمده»: صار محدَّدا قبلَه ومعروضا. */
  it('السعر معلومٌ قبل الضغط لا بعده', () => {
    expect(PATHWAY, 'ما زال يؤجّل السعر إلى ما بعد الاعتماد').not.toMatch(/يُحدَّد بعد أن تعتمده/)
    expect(PATHWAY).toMatch(/وهو ما تُصدره الفاتورة/)
  })

  it('الرقمُ مجموعُ شعبٍ حقيقيّة لا مشتقّ — فلا تقريبَ يُخفض الوعد', () => {
    /* النيّةُ لم تتغيّر: الرقمُ يُقرأ من شعبٍ قائمة لا يُشتقّ من تسعيرةٍ
       مُختلَقة. وقد انتقل من `cheapestOf` إلى `totalOf` — وهي تجمع أسعارَ
       الشعب كما هي، وتعيد null إن نقص سعرُ دورةٍ واحدة فلا يُعرض مجموعٌ
       ناقصٌ يُقرأ كاملا. */
    expect(PATHWAY).toMatch(/totalOf\(courseIds, prices\)/)
    expect(PATHWAY).toMatch(/formatCohortPrice\(fullPrice\)/)
    expect(PATHWAY, 'لا تحويلَ عملةٍ على سطحٍ يقبض المال').not.toMatch(/usePriceFormatter/)
  })

  it('بلا شعبةٍ مسعَّرة لا رقم — يُقال ذلك نصّا', () => {
    expect(PATHWAY).toMatch(/يُعلن السعر مع فتح الشعبة/)
    expect(DIAGNOSTIC).toMatch(/يُعلن السعر مع فتح الشعبة/)
  })
})

describe('حدود التخصيص', () => {
  it('الحدّان من مصدر الكتالوج لا أرقاما مكتوبة في الصفحة', () => {
    expect(PATHWAY).toMatch(/MIN_PATHWAY_COURSES/)
    expect(PATHWAY).toMatch(/MAX_PATHWAY_COURSES/)
    expect(PATHWAY).toMatch(/minReached:\s*courseIds\.length\s*<=\s*MIN_PATHWAY_COURSES/)
    expect(PATHWAY).toMatch(/maxReached:\s*courseIds\.length\s*>=\s*MAX_PATHWAY_COURSES/)
  })

  it('الحذف والإضافة يحترمان الحدّ داخل المعالج أيضا — لا في التعطيل وحده', () => {
    /* زرٌّ معطَّل ليس حارسا: لوحة المفاتيح وأدوات المطوّر تتجاوزه */
    expect(PATHWAY).toMatch(/if \(courseIds\.length <= MIN_PATHWAY_COURSES\) return/)
    expect(PATHWAY).toMatch(/if \(courseIds\.length >= MAX_PATHWAY_COURSES\) return/)
  })
})
