/* التمديدُ مرّتان لا مرّة — وسقفُ المهلة تسعةُ أيّامٍ جارية.
 *
 * قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «المهلةُ لكافّة دوراته، ويحقّ له طلبُ
 * تمديدٍ ليومين **مرّتين**، أي النتيجةُ ٩ أيّامٍ لو مدّد».
 *
 * ── ولمَ عدّادٌ لا تاريخ ──
 *
 * كان الحارسُ `conditionExtendedAt` وحدَه: وجودُه يعني «مُدّد» ولا يقول كم
 * مرّة. فيصدُق على المرّة الواحدة ويعمى عن الثانية.
 *
 * ── و«في مجموعها» لا «من تاريخ التوقيع» ──
 *
 * المهلةُ تتوقّف عن الجريان مدّةَ بقاء الموادّ عند الأكاديميّة (البند 2-9
 * نفسُه). فمن سلّم في يومه الثالث وبقيت موادُّه عندنا أسبوعا يجاوز تسعةَ
 * أيّامٍ تقويميّةً بلا ذنب. فالسقفُ على ما **جرى** منها.
 */

import { describe, expect, it } from 'vitest'
import {
  EXTENSION_DAYS, MATERIALS_WINDOW_DAYS, MAX_EXTENSIONS, MAX_TOTAL_WINDOW_DAYS,
  canAskExtension, extendProblemAr, extensionsLeft,
} from '@/application/trainer/conditional-offer'
import { renderContractBodyAr, type ContractBodyInput } from '@/application/trainer/contract-body'
import { DEFAULT_REQUIRED_DOCUMENTS } from '@/application/trainer/contract-documents'

const DAY = 86_400_000
const running = (over: Record<string, unknown> = {}) => ({
  conditionDeadlineAt: new Date(Date.now() + 2 * DAY),
  now: new Date(),
  ...over,
})

describe('① مرّتان — والعددُ من العدّاد', () => {
  it('السقفُ مرّتان، والمجموعُ تسعةٌ', () => {
    expect(MAX_EXTENSIONS).toBe(2)
    /* والمجموعُ يُشتقّ ولا يُكتب: ٥ + (٢ × ٢) */
    expect(MAX_TOTAL_WINDOW_DAYS).toBe(MATERIALS_WINDOW_DAYS + MAX_EXTENSIONS * EXTENSION_DAYS)
    expect(MAX_TOTAL_WINDOW_DAYS).toBe(9)
  })

  it('من لم يمدّدْ له مرّتان، ومن مدّد مرّةً له واحدة، ومن مدّد مرّتين فلا', () => {
    expect(extensionsLeft({ conditionExtensionsUsed: 0 })).toBe(2)
    expect(extensionsLeft({ conditionExtensionsUsed: 1 })).toBe(1)
    expect(extensionsLeft({ conditionExtensionsUsed: 2 })).toBe(0)
    /* والغائبُ صفرٌ — فصفٌّ لم يُكتب عدّادُه بعدُ له مرّتاه */
    expect(extensionsLeft({})).toBe(MAX_EXTENSIONS)
  })

  /* ═══ وهذا هو الحارسُ الذي كان يعمى ═══

     المرّةُ الثانيةُ كانت تُردّ لأنّ `conditionExtendedAt` مكتوب. فيُقاس هنا
     أنّها تُقبَل — وأنّ الثالثةَ وحدَها تُردّ. */
  it('والثانيةُ تُقبَل والثالثةُ تُردّ', () => {
    expect(extendProblemAr(running({ conditionExtensionsUsed: 0 })), 'رُدّت الأولى').toBeNull()
    expect(extendProblemAr(running({ conditionExtensionsUsed: 1 })), 'رُدّت الثانية').toBeNull()
    const third = extendProblemAr(running({ conditionExtensionsUsed: 2 }))
    expect(third, 'قُبلت الثالثة').not.toBeNull()
    expect(third, 'الردُّ لا يقول كم مرّةً مُنح').toContain(`${MAX_EXTENSIONS}`)
  })

  it('ولا يُستنتَج الإنفاقُ من تاريخ التمديد وحدَه', () => {
    /* صفٌّ مُدّد مرّةً: تاريخُه مكتوبٌ وعدّادُه واحد — فله ثانيةٌ بعدُ */
    expect(extendProblemAr(running({
      conditionExtendedAt: new Date(Date.now() - DAY), conditionExtensionsUsed: 1,
    })), 'رُدّ من له تمديدٌ ثانٍ لأنّ تاريخَ الأوّل مكتوب').toBeNull()
  })

  it('والزرُّ يتبع المِحَكَّ لا ينفرد به', () => {
    expect(canAskExtension(running({ conditionExtensionsUsed: 1 }))).toBe(true)
    expect(canAskExtension(running({ conditionExtensionsUsed: 2 }))).toBe(false)
  })
})

describe('② والمتنُ يقول المرّاتِ والسقفَ معا', () => {
  const body = renderContractBodyAr({
    academyPartyLineAr: 'أكاديمية وجيز للتدريب', academyLegalNameAr: 'أكاديمية وجيز للتدريب',
    academyTradingNameAr: 'أكاديمية وجيز', governingLawAr: 'القانون الأردني', disputeVenueAr: 'محاكم عمّان',
    trainerFullName: 'سعادُ المدرّبة', trainerEmail: 't@example.com',
    applicationReference: 'WJ-TR-2026-00042', issuedOnAr: '27 سبتمبر 2026',
    courses: [{ courseId: 'C-ACC-101', titleAr: 'أساسيات المحاسبة' }],
    compensation: { type: 'per_seat', rate: '15', referralRate: '25', minSeats: 5, currency: 'USD' },
    rateWaivedReasonAr: null, hoursNoteAr: null, requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
    conditional: {
      orientationOnAr: null, deadlineOnAr: null,
      windowDays: MATERIALS_WINDOW_DAYS, extensionDays: EXTENSION_DAYS,
    },
  } satisfies ContractBodyInput)

  const clauseExtend = () => /^2-10 .*$/m.exec(body)![0]

  it('البند 2-10 يقول «مرتين» ويقول السقف', () => {
    expect(clauseExtend(), 'ما زال يَعِد بمرّةٍ واحدة').not.toContain('مرة واحدة')
    expect(clauseExtend()).toContain('مرتين')
    expect(clauseExtend(), 'السقفُ غيرُ مذكورٍ — فيحسبه صاحبُه ويحتجّ بحسابه')
      .toContain(`${MAX_TOTAL_WINDOW_DAYS} أيام`)
  })

  /* ═══ والسقفُ على ما جرى لا على التقويم ═══

     الفقرةُ نفسُها تقول إنّ المهلةَ تتوقّف مدّةَ التقييم. فسقفٌ يُقاس «من
     تاريخ التوقيع» يناقضها في السطر الواحد. */
  it('ولا يقول «من تاريخ التوقيع» — فالمهلةُ تتوقّف مدّةَ التقييم', () => {
    expect(clauseExtend(), 'سقفٌ تقويميٌّ يناقض التوقّفَ المنصوصَ في الفقرة نفسِها')
      .not.toMatch(/فلا تجاوز.*من تاريخ التوقيع/)
    expect(clauseExtend()).toContain('في مجموعها')
    expect(clauseExtend(), 'سقط نصُّ التوقّف').toContain('وتتوقف عن الجريان مدة بقاء مواده')
  })

  it('والخلاصةُ تقول ما يقوله البند — لا مرّةً واحدة', () => {
    const line = body.split('\n').find((l) => l.startsWith('· وما يلزمك الآن:'))!
    expect(line).toContain('مرتين')
    expect(line).toContain(`${MAX_TOTAL_WINDOW_DAYS} أيام`)
    expect(line, 'الخلاصةُ تَعِد بمرّةٍ والبندُ بمرّتين').not.toContain('مرة واحدة')
  })
})
