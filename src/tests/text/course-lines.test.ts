/* الدوراتُ في رسائل واتساب مرقّمةٌ بعناوينها القصيرة — والعلّةُ في رأس `application/text/course-lines.ts` */
import { describe, expect, it } from 'vitest'
import { courseLinesAr, shortCourseTitleAr } from '@/application/text/course-lines'
import { advisorBriefTextAr } from '@/application/advisor/brief-message'
import { grantAdvisorTextAr } from '@/application/commerce/grant-landing'

const LONG = 'دورة اكتشاف العملاء وعرض القيمة: إثبات المشكلة بأدلّة سلوك لا بآراء'

describe('أسطر الدورات في الرسالة', () => {
  it('⚠️ العنوان وحده: بلا «دورة» قبله ولا الشرح بعد النقطتين', () => {
    expect(shortCourseTitleAr(LONG)).toBe('اكتشاف العملاء وعرض القيمة')
    expect(shortCourseTitleAr('تحليل البيانات بإكسل')).toBe('تحليل البيانات بإكسل')
    /* «دورات» ليست «دورة»، وما لا يبقى منه شيء يكتب كما هو */
    expect(shortCourseTitleAr('دورات التعلم السريع')).toBe('دورات التعلم السريع')
    expect(shortCourseTitleAr(': شرح وحده')).toBe(': شرح وحده')
  })

  it('⚠️ مرقمة سطرا لكل دورة', () => {
    expect(courseLinesAr([LONG, 'دورة استراتيجية التسعير: بناء النطاق'])).toBe('1. اكتشاف العملاء وعرض القيمة\n2. استراتيجية التسعير')
  })

  it('⚠️ رسالتا المسار والمنحة تكتبانها هكذا', () => {
    expect(advisorBriefTextAr({ message: 'م', pathwayUrl: 'u', courseNames: [LONG], attachNote: 'ن' })).toContain('الدورات في خطتي:\n1. اكتشاف العملاء وعرض القيمة\n\nن')
    expect(grantAdvisorTextAr('سارة', null, [LONG])).toContain('الدورات التي اخترتها:\n1. اكتشاف العملاء وعرض القيمة')
  })
})
