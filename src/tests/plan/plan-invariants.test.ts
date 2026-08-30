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

  it('«عد لنتيجتك» تقصد النتيجة لا فهرس التشخيص', () => {
    expect(PATHWAY).toMatch(/to="\/diagnostic\?view=result"/)
    expect(PATHWAY).not.toMatch(/to="\/diagnostic"\s*\n\s*className[^>]*>\s*<ArrowRight/)
    expect(DIAGNOSTIC).toMatch(/searchParams\.get\("view"\)\s*===\s*"result"/)
  })
})

describe('عرض السعر — مرحلة الإقناع', () => {
  it('الصدارة «تبدأ من … للدورة» لا سعر الخطّة كاملة', () => {
    expect(PATHWAY).toMatch(/تبدأ من/)
    expect(PATHWAY).toMatch(/للدورة/)
    expect(PATHWAY).toMatch(/perCourse/)
  })

  it('الخصمان معروضان: المسار كاملا وأوّل شراء', () => {
    expect(PATHWAY).toMatch(/على المسار كاملا/)
    expect(PATHWAY).toMatch(/FIRST_TIME_PROMO\.code/)
  })

  it('السعر النهائي مؤجَّل إلى ما بعد الاعتماد — العدد بيد المتعلّم', () => {
    expect(PATHWAY).toMatch(/يُحدَّد بعد أن تعتمده/)
  })

  it('«تبدأ من» تُقرَّب لأعلى — لا نَعِد بأقلّ مما يُدفع', () => {
    expect(PATHWAY).toMatch(/Math\.ceil\(pathwayTotal/)
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
