/* حقولُ المتعلّم في صفحةٍ يتقاسمها الجميع (ج-٢).

   شكوى ١٣ سبتمبر ٢٠٢٦: «إعدادات الحساب» عند المدرّب تسأله عن مؤهّله العلميّ
   وجامعته وتخصّصه ووظيفته وسنوات خبرته واهتماماته — وهي حقولُ قياسٍ يقرؤها
   مؤشّرُ وجيز ليوصي بمسار، لا حقولُ حساب. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { showsLearnerFields } from '@/application/site/account-fields'

describe('من تُعرض له حقولُ المتعلّم', () => {
  it('المتعلّمُ يراها، والمدرّبُ والمديرُ لا', () => {
    expect(showsLearnerFields(['learner'])).toBe(true)
    expect(showsLearnerFields(['trainer'])).toBe(false)
    expect(showsLearnerFields(['super_admin'])).toBe(false)
    expect(showsLearnerFields(['advisor'])).toBe(false)
  })

  it('⚠️ ومن حمل الدورَين يراها — فهي تعنيه بصفته متعلّما', () => {
    /* مدرّبٌ يتعلّم عندنا كذلك: إخفاؤها عنه يسلبه ملفَّه هو. */
    expect(showsLearnerFields(['trainer', 'learner'])).toBe(true)
    expect(showsLearnerFields(['learner', 'super_admin'])).toBe(true)
  })

  it('⚠️ وقبل أن تصل الجلسةُ لا تُعرض — فالغيابُ ليس إذنا', () => {
    /* لو عُرضت عند `null` ثمّ اختفت بعد جوابِ الخادم لرأى المستخدمُ ارتجافا
       يقرؤه عطبا — والعكسُ (تظهر متأخّرةً) أهونُ وأصدق. */
    expect(showsLearnerFields(null)).toBe(false)
    expect(showsLearnerFields(undefined)).toBe(false)
    expect(showsLearnerFields([])).toBe(false)
  })

  it('وما ليس مصفوفةً لا يكسرها', () => {
    expect(showsLearnerFields('learner' as unknown as string[])).toBe(false)
  })
})

/* ═══ وأنّ الشاشةَ تستعمل القرارَ فعلا ═══

   قاعدةٌ نقيّةٌ صحيحةٌ لا تنفع إن لم تُنادَ، أو نودِيت على نصف الحقول.
   فالفحصُ على **الوقوع**: أيُّ الحقول داخلَ الشرط وأيُّها خارجَه. */
describe('صفحةُ الحساب تُنزل القرارَ على الحقول', () => {
  const src = readFileSync(join(process.cwd(), 'src/pages/student/Account.tsx'), 'utf8')
  const code = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

  /** أداخلَ كتلةِ `learnerFields && (<> … </>)` يقع هذا النصّ؟ */
  const gated = (needle: string): boolean => {
    const at = code.indexOf(needle)
    if (at < 0) return false
    const open = code.lastIndexOf('{learnerFields && (<>', at)
    if (open < 0) return false
    const close = code.indexOf('</>)}', open)
    return close > at
  }

  it('⚠️ تنادي القرارَ المشترك ولا تعيد اشتقاقَه بشرطٍ في مكانه', () => {
    expect(code, 'القرارُ أُعيد اشتقاقُه في الشاشة').toContain('showsLearnerFields(roles)')
    expect(code, 'الأدوارُ من نداءٍ ثالثٍ لا من الجلسة المشتركة').toContain('fetchMe()')
  })

  it('⚠️ وحقولُ القياس كلُّها داخلَ الشرط — لا بعضُها', () => {
    /* نصفُ ترحيلٍ أسوأُ من لا ترحيل: يرى المدرّبُ «الجنس» ولا يرى «التعليم» */
    for (const field of ['تاريخ الميلاد', 'الجنس', 'المؤهل العلمي', 'الوظيفة الحالية', 'اهتماماتك', 'هدفك المهني']) {
      expect(gated(field), `«${field}» يُعرض لمن ليس متعلّما`).toBe(true)
    }
  })

  it('⚠️ وحقولُ الحساب تبقى للجميع — وإلّا صار الإخفاءُ تجريدا', () => {
    /* الاسمُ والهاتفُ والدولةُ حقولُ حسابٍ لا قياس: من أخفاها عن المدرّب
       سلبه صفحتَه بدل أن يُنظّفها. */
    for (const field of ['الاسم الكامل', 'رقم الهاتف', 'الدولة', 'المدينة']) {
      expect(gated(field), `«${field}» اختفى عمّن ليس متعلّما`).toBe(false)
    }
  })
})
