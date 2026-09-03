/* موعد الشعبة حيث يقع القرار — لا في صفحةٍ مستقلّة.

   كانت «الشعب المفتوحة» صفحةً عامّةً تُعرض فيها كلُّ الشعب مسطّحةً، بعيدةً عن
   الدورة التي يفكّر فيها القارئ. وكانت تعرض عليه شعبا **اشتراها فعلا** —
   لا ترشيح لما سُجّل فيه — وتطبع أيّامها بالإنجليزية (`tue, thu`) في واجهةٍ
   عربية، وتاريخها هجريّا لأنّ `ar-SA` يحمل التقويم الهجريّ في المتصفّحات.

   وبقرار صاحب المنتج حُذفت، وانتقل الموعد إلى موضع القرار: صفحة المسار
   العامّة، و«مساري». */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dayLabelAr, daysLabelAr, fmtDateAr, untilLabelAr } from '@/utils/format'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('حذف صفحة الشعب المفتوحة', () => {
  it('١) الصفحة نفسها زالت', () => {
    expect(existsSync(join(process.cwd(), 'src/pages/student/OpenCohorts.tsx'))).toBe(false)
  })

  it('٢) ولا رابط إليها في المشروع كلّه — رابطٌ ميّت أسوأ من تبويبٍ زائد', () => {
    for (const f of [
      'src/App.tsx', 'src/pages/student/PortalLayout.tsx', 'src/pages/student/Dashboard.tsx',
      'src/pages/student/Inbox.tsx', 'src/pages/student/MyPathway.tsx',
      'src/pages/student/CourseMilestones.tsx', 'src/pages/student/RateMyLearning.tsx',
      /* كان هنا `EnrollRequest.tsx` — وقد حُذف الملفّ حين صار الدفعُ مباشرا،
         فقراءتُه تُسقط المجموعةَ كلَّها بـENOENT. ومكانُه `BuyPanel.tsx`. */
      'src/components/BuyPanel.tsx',
    ]) {
      expect(read(f), `${f} ما زال يشير إلى الصفحة المحذوفة`).not.toContain('/student/cohorts')
    }
  })
})

describe('الموعد في موضع القرار', () => {
  it('٣) صفحة المسار العامّة تعرض جدول الدورات', () => {
    expect(read('src/pages/Pathway.tsx')).toContain('showSchedule')
  })

  it('٤) و«مساري» تعرضه للدورات غير المسجَّلة في عرضَيها معا', () => {
    const src = read('src/pages/student/MyPathway.tsx')
    /* حدُّ الكلمة مقصود: العدُّ بـ`split('<CohortPicker')` يطابق أيضا اسما
       مشتقّا مثل `<CohortPickerX`، فتمرّ طفرةُ إعادة تسميةٍ خضراء. */
    expect(src.match(/<CohortPicker\b/g)?.length ?? 0, 'العرضان: الخطّة المعتمَدة والمسار الجاهز').toBe(2)
    expect(src.match(/<BuyCohort\b/g)?.length ?? 0).toBe(2)
    expect(src, 'الزرّ القديم ما زال').not.toContain('اطلب شعبة')
  })

  /* وصفحةُ شراء الدورة المفردة كانت الموضعَ الغائب: يقرأ الدورةَ ويرى سعرَها
     ويشتري — بلا أن يعرف متى تبدأ ولا أن يختار موعدا يناسبه. وقرارُ صاحب
     المنصّة: «أضف أنّه يختار الشعب المفتوحة للدورة حسب التوفّر». */
  it('٤ب) وصفحةُ شراء الدورة المفردة تعرض المواعيد وتحمل المختار إلى اللوح', () => {
    const src = read('src/pages/CoursePath.tsx')
    expect(src.match(/<CohortPicker\b/g)?.length ?? 0, 'مُنتقي الموعد في صفّ كلّ دورة').toBe(1)
    /* السعرُ من الشعبة المختارة لا من أقربِها دائما — وإلّا قال الصفُّ رقما
       وقُبض غيرُه حين يبدّل الموعد */
    expect(src, 'المصدرُ القديم يعطي أقربَ شعبةٍ وحدها').not.toMatch(/useCoursePrices/)
    expect(src).toMatch(/useCourseCohorts/)
    /* والمختارُ يُحمل إلى لوح الشراء: بلا حمله يُفوتَر بموعدٍ غير الذي رآه */
    expect(src).toMatch(/cohortId:/)
  })

  it('٤ج) ولوحُ الشراء يحترم ما اختاره في الصفحة ولا يدهسه', () => {
    const panel = read('src/components/BuyPanel.tsx')
    expect(panel, 'حقلُ الشعبة المختارة في سطر الشراء').toMatch(/cohortId\?: string/)
    expect(panel, 'الاختيارُ التلقائيّ يفضّل ما جاء من الصفحة').toMatch(/line\.cohortId/)
  })

  it('٥) والشراء مباشر: checkout ثمّ pay، بلا طلبٍ ينتظر موافقة', () => {
    const buy = read('src/components/BuyCohort.tsx')
    expect(buy).toContain('/api/learner/checkout')
    expect(buy).toContain('/pay')
    /* رجوع المتصفّح ليس دليل دفع — لا نقول «تمّ» عند التحويل */
    expect(buy).toContain('redirectUrl')
  })
})

describe('صياغة الموعد', () => {
  it('٦) الأيّام بالعربية — لا `tue, thu` في واجهةٍ عربية', () => {
    expect(dayLabelAr('tue')).toBe('الثلاثاء')
    expect(dayLabelAr('THU')).toBe('الخميس')
    expect(daysLabelAr(['tue', 'thu'])).toBe('الثلاثاء والخميس')
    expect(daysLabelAr(['sun', 'tue', 'thu'])).toBe('الأحد، الثلاثاء والخميس')
    expect(daysLabelAr([])).toBe('')
    /* ما لا يُعرف يُعرض كما هو — الإخفاء يكذب */
    expect(dayLabelAr('zzz')).toBe('zzz')
  })

  it('٧) والتاريخ ميلاديّ صراحةً — `ar-SA` يعطي الهجريّ في المتصفّحات', () => {
    const out = fmtDateAr('2026-10-12T15:00:00Z')
    expect(out).toContain('2026')
    expect(out).toContain('أكتوبر')
    /* لا أثر للتقويم الهجريّ */
    expect(out).not.toMatch(/هـ|ربيع|جمادى|رمضان|محرم/)
    expect(fmtDateAr(null)).toBe('—')
    expect(fmtDateAr('ليس تاريخا')).toBe('—')
  })

  it('٨) وبُعد الموعد يُقال بالكلمات — التاريخ وحده لا يُقرّر', () => {
    const day = 86_400_000
    expect(untilLabelAr(new Date(Date.now() + 21 * day).toISOString())).toBe('بعد 3 أسابيع')
    expect(untilLabelAr(new Date(Date.now() + 14 * day).toISOString())).toBe('بعد أسبوعين')
    expect(untilLabelAr(new Date(Date.now() - day).toISOString())).toBe('بدأت')
    expect(untilLabelAr(null)).toBe('')
  })
})

/* حجمُ الصندوق يتبع المعلومة لا العكس.

   كان لوحُ شراء الدورة المفردة ضِعفَ ما يحتاج: حشوةٌ من ٢٤ نقطة، وعنوانٌ
   بحجم عنوان الصفحة، و«سعر الدورة ١٢٥» فوق «ما تدفعه ١٢٥» — رقمٌ واحدٌ في
   سطرين. وقولُ صاحب المنصّة: «هذا البوكس كبير جدا ولا معنى لتكبيره لهذا
   الحد». فالحارسُ هنا يمنع رجوعَ الحشو والتكرار. */
describe('لوحُ شراء الدورة — بحجم ما يقوله', () => {
  const src = read('src/pages/CoursePath.tsx')
  /* حارسُ الأحجام على قسم الشراء وحدَه — لا على الصفحة كلّها: عنوانُ الدورة
     يجوز أن يكبر، وإنّما الصندوقُ الذي يقع فيه القرار هو الذي كبر بلا داع.
     والفاصلُ علامةُ القسم لا نصُّه: النصُّ يتكرّر في تعليقٍ أعلى الصفحة. */
  const box = src.slice(src.indexOf('══ مسارك حتى الآن'), src.indexOf('══ مرحلتك التالية'))

  it('٩) التفصيلُ مشروطٌ بوجود ما يُفصَّل — لا سطرٌ يكرّر رقمَه', () => {
    expect(src).toMatch(/const hasBreakdown = /)
    expect(src, 'التفصيلُ يظهر بشرطه').toMatch(/\{hasBreakdown && \(/)
  })

  it('١٠) ونسبةُ الوفر مشتقّةٌ من الرقمين المعروضين لا مذكورةً بيدها', () => {
    expect(src).toMatch(/const savedPct = /)
    expect(src).toMatch(/finalPayable \/ pricing\.separate/)
  })

  it('١١) ولا حشوةَ الصندوق القديمة ولا حجمُ سعرِه', () => {
    expect(box.length, 'قسمُ الشراء لم يُعثَر عليه').toBeGreaterThan(500)
    expect(src, 'حشوةُ ٢٤ نقطة عادت').not.toMatch(/p-5 md:p-6/)
    expect(box, 'السعرُ بحجم ٣٠ نقطة عاد').not.toMatch(/text-3xl/)
    expect(box, 'سعرُ «ما تدفعه» بحجمٍ يُقرأ بلا إسراف').toMatch(/text-\[26px\]/)
  })

  it('١٢) ودعوةُ الفئات بصياغة صفحة المسار نفسِها — سطرٌ يُنقر لا سؤالٌ ثمّ رابط', () => {
    for (const f of ['src/pages/Pathway.tsx', 'src/pages/CoursePath.tsx']) {
      const p = read(f)
      expect(p, f).toContain('اطّلع على الفئات وتحقّق من أهليتك')
      expect(p, `${f}: السؤالُ الطويل عاد`).not.toContain('هل قد تكون مؤهلا لخصم فئة')
    }
  })
})
