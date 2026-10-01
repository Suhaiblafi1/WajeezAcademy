/* ═══ `v20` — استردادُ المتعلّمين والحضور (4-15)، وطريقةُ الصرف ورسومُه (4-5) ═══
 *
 * جوابان على ملاحظات مدرّبٍ أقرّهما صاحبُ المنصّة في ١ أكتوبر ٢٠٢٦.
 *
 * ── ① 4-15: المقعدُ يُحفَظ بالحضور ──
 *
 * طلب المدرّبُ «ألّا تنقص أتعاب المقعد بما تردّه الأكاديمية إلى متعلّمٍ بعد
 * انعقاد الجلسة الأولى، وأن يُبيَّن أثرُ الاسترداد قبل ذلك». والحكمُ في
 * `counted-seat.ts`، وهنا يُقاس **الحكمُ** على بيّنته و**النصُّ** في الوثيقة.
 *
 * ── ② 4-5: الرسومُ تقتطعها المصارف ──
 *
 * قرارُ صاحب المنصّة بعد أن عاد فيه: الرسومُ على المدرّب، والصيغةُ «كأنّه أمرٌ
 * اعتياديّ… لا نأخذ منك». فالفاعلُ في النصّ المصارفُ لا الأكاديميّة — وبذلك لا
 * يدخل في حكم 4-6 الذي يمنع حسما *تُجريه الأكاديميّة*. ولو قيل «يتحمّل
 * المدرّب» أو «تحسم الأكاديمية» لَعاد الحسمُ إليها فاصطدم بالبند 4-6.
 *
 * ── وتُقاس على المتن المصيَّر لا على الشيفرة ──
 *
 * على نمط `contract-v18-amendments`: فحصٌ يطابق سطرا في ملفّ مصدرٍ يخضرّ ولو
 * لم يبلغ ذلك السطرُ الوثيقة.
 */

import { describe, expect, it } from 'vitest'
import {
  renderContractBodyAr, type ContractBodyInput,
} from '@/application/trainer/contract-body'
import { seatCounts, type SeatEvidence } from '@/application/trainer/counted-seat'
import { ACADEMY_LEGAL, academyPartyLineAr } from '@/data/academy-legal'

const BASE: ContractBodyInput = {
  academyPartyLineAr: academyPartyLineAr(),
  academyLegalNameAr: ACADEMY_LEGAL.legalNameAr,
  academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr,
  governingLawAr: ACADEMY_LEGAL.governingLawAr,
  disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr,
  trainerFullName: 'اسمٌ قانونيّ',
  trainerEmail: 'trainer@example.com',
  applicationReference: 'WJ-TR-2026-00000',
  issuedOnAr: '١ أكتوبر ٢٠٢٦',
  courses: [{ courseId: 'C-1', titleAr: 'دورةٌ أولى' }],
  compensation: { type: 'per_seat', rate: '15', currency: 'USD', minSeats: 15, referralRate: '25' },
  rateWaivedReasonAr: null,
  hoursNoteAr: null,
  requiredDocuments: [{ kind: 'id', labelAr: 'الهوية', required: true }],
  conditional: null,
}
const body = renderContractBodyAr(BASE)
const withHours = renderContractBodyAr({ ...BASE, hoursNoteAr: 'نحو 16 ساعة' })

const clause = (no: string, src = body): string => {
  const l = src.split('\n').find((x) => x.trimStart().startsWith(`${no} `))
  if (!l) throw new Error(`لا بندَ بالرقم «${no}» في المتن`)
  return l
}
const numbersOf = (src: string): string[] => src.split('\n')
  .map((l) => l.trimStart().match(/^(4-\d+) /)?.[1])
  .filter((x): x is string => !!x)

/** مقعدٌ مسجَّلٌ لم يحضر الأولى ولا طلبَ له — ثمّ يُغيَّر منه ما يُقاس */
const seat = (over: Partial<SeatEvidence> = {}): SeatEvidence => ({
  status: 'enrolled', attendedFirstSession: false, fundingOrderStatuses: [], ...over,
})

describe('① 4-15 — أيُحتسب المقعد؟', () => {
  it('⚠️ لم يحضر الأولى ورُدّ إليه ثمنُه كاملا — لا يُحتسب', () => {
    expect(seatCounts(seat({ fundingOrderStatuses: ['refunded'] })),
      'مقعدٌ رُدّ ثمنُه قبل أن يُقدَّم له شيءٌ يُدفَع عنه').toBe(false)
  })

  it('⚠️ وحضر الأولى ثمّ رُدّ إليه — يُحتسب «في كل حال»', () => {
    expect(seatCounts(seat({ attendedFirstSession: true, fundingOrderStatuses: ['refunded'] })),
      'نقصت أتعابُ المقعد بما رُددناه بعد الجلسة الأولى').toBe(true)
  })

  it('والردُّ الجزئيُّ لا يُخرجه', () => {
    expect(seatCounts(seat({ fundingOrderStatuses: ['partially_refunded'] }))).toBe(true)
  })

  it('ومقعدٌ بلا طلبٍ — سجّلته الإدارةُ — يُحتسب', () => {
    expect(seatCounts(seat())).toBe(true)
  })

  /* ومن اشترى فاستردّ فعاد فاشترى: طلبُه الثاني قائمٌ فالمقعدُ ممَوَّل */
  it('ومن اشترى فاستردّ فعاد فاشترى — يُحتسب', () => {
    expect(seatCounts(seat({ fundingOrderStatuses: ['refunded', 'paid'] })),
      'أُخرج مقعدٌ له طلبٌ مدفوعٌ قائم').toBe(true)
  })

  /* ═══ والمُسقَطُ بعد الحضور — وهو ما كان يضيع ═══
     كان المحرّكُ لا يعدّ `dropped` أبدا، فمن حضر الأولى ثمّ أُسقط بعد ردّ
     ثمنه خرج من الحساب — وذلك عينُ ما يمنعه «في كل حال». */
  it('⚠️ وأُسقط بعد أن حضر الأولى — يُحتسب', () => {
    expect(seatCounts(seat({ status: 'dropped', attendedFirstSession: true })),
      'ضاع مقعدُ من حضر الأولى لأنّه أُسقط بعدها').toBe(true)
  })

  it('وأُسقط قبل أن يحضر — لا يُحتسب', () => {
    expect(seatCounts(seat({ status: 'dropped' }))).toBe(false)
  })

  it('وقائمةُ الانتظار ليست مقعدا — ولو حضر', () => {
    expect(seatCounts(seat({ status: 'waitlisted', attendedFirstSession: true }))).toBe(false)
  })
})

describe('① 4-15 — في الوثيقة', () => {
  it('⚠️ يُطبَع أبدا، وبعد 4-14 بلا قفز', () => {
    const nos = numbersOf(body)
    expect(nos, 'غاب 4-15 عن عقدٍ بلا بيانِ ساعات').toContain('4-15')
    expect(nos.indexOf('4-15'), '4-15 لا يلي 4-14').toBe(nos.indexOf('4-14') + 1)
    expect(nos, 'حديثُ الساعات طُبع ولا ساعاتَ في العقد').not.toContain('4-16')
  })

  it('ويقول الحكمَ بوجهَيه', () => {
    const c = clause('4-15')
    expect(c, 'لا يُقال إنّ من حضر الأولى محفوظ').toContain('ومن حضر الجلسة الأولى احتسب مقعده في كل حال')
    expect(c, 'لا يُقال متى يخرج المقعد').toContain('لم يحضر الجلسة الأولى من الشعبة ورد إليه ثمنه كاملا')
    expect(c, 'لا يُقال حكمُ الردّ الجزئيّ').toContain('والرد الجزئي لا يخرج المقعد')
    expect(c, 'لا يُعرَّف الحضور — فيُختلَف فيه').toContain('ويعتد في الحضور بما تسجله المنصة')
  })

  /* وصدرُه يقصره على أجر المقعد: عقدٌ بنسبةٍ من الإيراد يستبعد المستردَّ
     بقاعدته، ولو قرأ هذا البندَ لَطالب بأتعابٍ عن مالٍ رُدّ. */
  it('ومقصورٌ على الأتعاب بعدد المقاعد — فلا يُقرأ في عقدٍ بنسبة', () => {
    expect(clause('4-15')).toMatch(/^4-15 وحيث تحتسب الأتعاب بعدد المقاعد،/)
  })
})

describe('② 4-5 — طريقةُ الصرف ورسومُه', () => {
  it('⚠️ التحويلُ البنكيّ بمبلغ الكشف المعتمد، والرسومُ تقتطعها المصارف', () => {
    const c = clause('4-5')
    expect(c, 'لا يُقال كيف يُصرَف').toContain('وتصرف الأتعاب بتحويل بنكي')
    expect(c, 'لا يُقال بأيّ مبلغ').toContain('بالمبلغ المعتمد في كشفه')
    expect(c, 'لا يُقال إنّ الرسومَ تُقتطع من الحوالة')
      .toContain('يقتطع من المبلغ المحول على ما جرى به العمل في التحويلات المصرفية')
    expect(c, 'لا حكمَ لطريقةٍ غيرِ التحويل البنكيّ').toContain('على الصرف بطريقة غير التحويل البنكي')
  })

  /* ═══ والفاعلُ المصارفُ — وهذا ما يُبقيه خارج البند 4-6 ═══
     «يتحمّل المدرّب» نبرةٌ رفضها صاحبُ المنصّة («لا نأخذ منك»)، و«تحسم
     الأكاديمية» تجعل الحسمَ حسمَها فيصطدم بالبند 4-6. */
  it('⚠️ ولا تُجعل الأكاديميّةُ فاعلَ الاقتطاع، ولا يُقال «يتحمّل المدرّب»', () => {
    const c = clause('4-5')
    expect(c, 'صار الاقتطاعُ فعلَ الأكاديميّة — فيصطدم بالبند 4-6').not.toMatch(/تحسم(ها)? الأكاديمية/)
    expect(c, 'عادت النبرةُ التي رُدّت: «يتحمّل المدرّب»').not.toContain('يتحمل المدرب')
  })
})

describe('وحديثُ الساعات بعده — لا يتكرّر رقم', () => {
  it('مع بيان الساعات: 4-15 ثمّ 4-16، ولكلٍّ رقمُه', () => {
    const nos = numbersOf(withHours)
    expect(nos.indexOf('4-16'), '4-16 لا يلي 4-15').toBe(nos.indexOf('4-15') + 1)
    expect(clause('4-16', withHours)).toContain('حجم العمل المتوقع')
    expect(new Set(nos).size, 'تكرّر رقمُ بندٍ في البند 4').toBe(nos.length)
  })
})
