/* ساعاتُ الدورة في العقد: منفصلةً لا مخصومة، ولقطةً لا إحالة.
 *
 * ── الطلبُ الذي وُلد منه ──
 *
 * صاحبُ المنصّة (٢٦ سبتمبر ٢٠٢٦): «هل عددُ الساعات للدورة موجودٌ بالعقد؟
 * أعتقد أنّه مهمّ… أقترح أن نضع لهم ما بين وبين للدورة، ويختلف بوجود ساعاتٍ
 * مسجّلة». ثمّ وافق على أن تُذكر منفصلةً، وبندِ تسامحٍ واحدٍ لا رقمَين لكلّ
 * دورة.
 *
 * وكان الملحقُ (أ) يعدّد العناوينَ وحدَها، فيوقّع المدرّبُ على تأهيلٍ لدورةٍ
 * لا يعرف حجمَها.
 *
 * ── وأدقُّ ما يُقاس: أنّ ما وُقّع قبلَ اليوم لا يتبدّل ──
 *
 * لقطاتُ العقود القديمة (`qualifiedSnapshot`) بلا ساعات. فوثيقةٌ تُعرَض
 * اليومَ وقّعها صاحبُها أمسِ **لا يُزاد فيها رقمٌ ولا بند**: تُطبَع عنوانا
 * كما وُقّعت. ولو أُضيف لها لَاختلف المعروضُ عن الموقَّع — وهو نقضُ القاعدة
 * التي بُني عليها المتنُ كلُّه.
 */

import { describe, expect, it } from 'vitest'
import {
  courseHoursLineAr, hoursProblemAr, liveHours, HOURS_TOLERANCE_PERCENT,
} from '@/application/catalog/course-hours'
import {
  renderContractBodyAr, readContractCourses, CONTRACT_BODY_VERSION,
} from '@/application/trainer/contract-body'

const body = (courses: Parameters<typeof renderContractBodyAr>[0]['courses']) =>
  renderContractBodyAr({
    academyPartyLineAr: 'س', academyLegalNameAr: 'س', academyTradingNameAr: 'وجيز',
    governingLawAr: 'ق', disputeVenueAr: 'ج', trainerFullName: 'م', trainerEmail: 'a@b.c',
    applicationReference: 'R', issuedOnAr: 'اليوم', courses,
    compensation: null, rateWaivedReasonAr: null, hoursNoteAr: null,
    requiredDocuments: [], conditional: null,
  })

/** الملحقُ (أ) وحدَه — لا ذكرُه في الخلاصة والمعجم */
const annexOf = (text: string) => {
  const at = text.indexOf('الملحق (أ) — الدورات المؤهل لها')
  return text.slice(at, text.indexOf('الملحق (ب)', at))
}

describe('السطرُ يقول المباشرَ والمسجَّلَ معا', () => {
  it('بساعاتٍ مسجَّلة: الإجماليُّ ثمّ تفصيلُه', () => {
    expect(courseHoursLineAr({ totalHours: 20, recordedHours: 4 }))
      .toBe('20 ساعة (16 مباشرة + 4 مسجَّلة)')
  })

  it('وبلا مسجَّلة: الإجماليُّ وحدَه — ولا يُكتب صفرٌ في وثيقة', () => {
    /* «٢٠ مباشرة + ٠ مسجَّلة» يجعل القارئَ يبحث عمّا لا وجودَ له. */
    expect(courseHoursLineAr({ totalHours: 20, recordedHours: null })).toBe('20 ساعة')
    expect(courseHoursLineAr({ totalHours: 20, recordedHours: 0 })).toBe('20 ساعة')
  })

  it('والعربيّةُ تُثنّي وتُفرد', () => {
    expect(courseHoursLineAr({ totalHours: 1 })).toBe('ساعة واحدة')
    expect(courseHoursLineAr({ totalHours: 2 })).toBe('ساعتان')
  })

  it('والمباشرةُ هي الإجماليُّ ناقصَ المسجَّل', () => {
    expect(liveHours({ totalHours: 20, recordedHours: 4 })).toBe(16)
    expect(liveHours({ totalHours: 20 })).toBe(20)
  })
})

describe('ولا رقمَ لا يُقرأ يُحفَظ', () => {
  it('مسجَّلةٌ أكثرُ من الإجماليّ تُردّ — وإلّا خرج رقمٌ سالبٌ في مستند', () => {
    const p = hoursProblemAr({ totalHours: 20, recordedHours: 24 })
    expect(p, 'قُبل رقمٌ يُخرج ساعاتٍ مباشرةً سالبة').not.toBeNull()
    expect(p).toMatch(/أكثرُ من إجمالي/)
  })

  it('ومساويةٌ للإجماليّ تُقبل — دورةٌ كلُّها مسجَّلةٌ حالٌ قائمة', () => {
    expect(hoursProblemAr({ totalHours: 20, recordedHours: 20 })).toBeNull()
    expect(courseHoursLineAr({ totalHours: 20, recordedHours: 20 }))
      .toBe('20 ساعة (0 مباشرة + 20 مسجَّلة)')
  })

  it('وإجماليٌّ صفرٌ أو كسرٌ أو سالبٌ يُردّ', () => {
    for (const totalHours of [0, -3, 2.5]) {
      expect(hoursProblemAr({ totalHours }), `قُبل إجماليٌّ ${totalHours}`).not.toBeNull()
    }
    expect(hoursProblemAr({ totalHours: 20, recordedHours: -1 })).not.toBeNull()
    expect(hoursProblemAr({ totalHours: 20, recordedHours: 1.5 })).not.toBeNull()
  })
})

describe('والملحقُ (أ) يحملها', () => {
  const withHours = annexOf(body([
    { courseId: 'A', titleAr: 'أساسيّاتُ المحاسبة', totalHours: 20, recordedHours: 4 },
    { courseId: 'B', titleAr: 'إدارةُ المشاريع', totalHours: 12 },
  ]))

  it('كلُّ دورةٍ وساعاتُها في سطرها', () => {
    expect(withHours).toContain('أساسيّاتُ المحاسبة — 20 ساعة (16 مباشرة + 4 مسجَّلة)')
    expect(withHours).toContain('إدارةُ المشاريع — 12 ساعة')
  })

  it('وبندُ التسامح بنسبته — من مصدرٍ واحدٍ لا رقما مكتوبا في المتن', () => {
    expect(withHours).toContain(`${HOURS_TOLERANCE_PERCENT}٪`)
    expect(withHours, 'لا يُقال إنّه تقدير').toMatch(/تقدير استرشادي/)
  })

  it('ويُقال الفرقُ بين المسجَّل والمباشر', () => {
    expect(withHours).toMatch(/الساعات المسجلة مادة يعدها المدرب وتعاد/)
  })

  it('ولا يُحيل إلى بندٍ لا يقول ذلك', () => {
    /* أوّلُ صياغةٍ أحالت إلى «البند 8» — وهو «تغيير المواعيد»، لا يفرّق بين
       مسجَّلٍ ومباشرٍ في شيء. وإحالةٌ كاذبةٌ في وثيقةٍ تُوقَّع تُقرأ في نزاع. */
    expect(withHours, 'أُحيل إلى بندٍ لا يحكم في الساعات').not.toMatch(/البند 8/)
  })
})

describe('وما وُقّع قبلَ اليوم لا يتبدّل', () => {
  const noHours = annexOf(body([{ courseId: 'C', titleAr: 'دورةٌ قديمة' }]))

  it('لقطةٌ بلا ساعاتٍ تُطبَع عنوانا كما وُقّعت', () => {
    expect(noHours).toContain('1. دورةٌ قديمة')
    expect(noHours, 'أُلحق بالسطر رقمٌ لم يقرأه صاحبُه').not.toMatch(/دورةٌ قديمة —/)
  })

  it('ولا يُزاد فيها بندُ التسامح', () => {
    /* بندٌ يتحدّث عن أرقامٍ لا وجودَ لها في الوثيقة نصٌّ يُحيّر قارئَه. */
    expect(noHours, 'أُضيف بندٌ إلى وثيقةٍ موقَّعةٍ لا رقمَ فيها')
      .not.toMatch(/تقدير استرشادي/)
  })

  it('والقارئةُ لا تخترع صفرا لما لم يُكتب', () => {
    const [row] = readContractCourses([{ courseId: 'C', titleAr: 'قديمة' }])
    expect(row.totalHours, 'لُفِّق رقمٌ للقطةٍ لا رقمَ فيها').toBeNull()
    expect(row.recordedHours).toBeNull()
  })

  it('وتقرأ ما كُتب حين يُكتب', () => {
    const [row] = readContractCourses([
      { courseId: 'A', titleAr: 'دورة', totalHours: 20, recordedHours: 4 },
    ])
    expect(row.totalHours).toBe(20)
    expect(row.recordedHours).toBe(4)
  })

  it('وتردّ ما ليس عددا', () => {
    const [row] = readContractCourses([
      { courseId: 'A', titleAr: 'دورة', totalHours: '20', recordedHours: NaN },
    ])
    expect(row.totalHours, 'قُرئ نصٌّ رقما').toBeNull()
    expect(row.recordedHours, 'قُرئ NaN رقما').toBeNull()
  })
})

describe('وصياغةُ المتن تُرقَّم', () => {
  it('فما تغيّر متنُه تغيّرت صياغتُه — وإلّا لم يُعرف الموقَّعُ من الموقَّع', () => {
    expect(CONTRACT_BODY_VERSION).toBe('v9-2026-09-26')
  })
})
