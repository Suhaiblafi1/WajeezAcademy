/* ═══ `v22` — رسومُ مصرف الأكاديميّة عليها (4-5) ═══
 *
 * قرارُ صاحب المنصّة (١ أكتوبر ٢٠٢٦) في جواب المدرّب: «رسوم مصرفنا فقط، ولا
 * نتحمّل رسوم فرق العملة التي يعتمدها البنك للمستلم»، و«في حالة اتّفقت
 * الأكاديمية مع المدرّب لطريقة تحويلٍ أخرى يتحمّل المدرّب كافّة الرسوم».
 *
 * فالبندُ ثلاثةُ أقسامٍ، ولكلٍّ فحص — فإن سقط قسمٌ عرف القارئُ أيَّها:
 *   رسومُ مصرفنا علينا ولا تُقتطع · والوسيطُ ومصرفُ المدرّب وفرقُ العملة
 *   تُقتطع في طريقها · والطريقةُ الأخرى المتّفَقُ عليها رسومُها كلُّها من المبلغ.
 *
 * وتُقاس على المتن المصيَّر لا على ملفّ المصدر — على نمط `contract-v20-amendments`.
 */

import { describe, expect, it } from 'vitest'
import {
  renderContractBodyAr, CONTRACT_BODY_VERSION, type ContractBodyInput,
} from '@/application/trainer/contract-body'
import { CONTRACT_CHANGELOG } from '@/application/trainer/contract-changelog'
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

const clause = (no: string): string => {
  const l = body.split('\n').find((x) => x.trimStart().startsWith(`${no} `))
  if (!l) throw new Error(`لا بندَ بالرقم «${no}» في المتن`)
  return l
}

describe('4-5 — من يتحمّل رسومَ الحوالة', () => {
  it('⚠️ رسومُ مصرف الأكاديميّة عليها، ولا تُقتطع من الحوالة', () => {
    const c = clause('4-5')
    expect(c, 'لا يُقال إنّ رسومَ مصرفنا علينا').toContain('وتتحمل الأكاديمية رسوم مصرفها على الحوالة')
    expect(c, 'لا يُقال إنّها لا تُقتطع من المبلغ').toContain('فلا تقتطع من المبلغ المحول')
  })

  /* وكان `v20` يقتطع «رسومَ المصارف والجهات الوسيطة» جملةً — ومصرفُنا منها.
     فلو عادت تلك الجملةُ لَتناقض البندُ في سطرٍ واحد. */
  it('⚠️ ولا تعود صيغةُ `v20` التي تقتطع رسومَ المصارف كلَّها', () => {
    expect(clause('4-5'), 'عادت «رسوم وعمولات تتقاضاها المصارف والجهات المالية الوسيطة» جملةً')
      .not.toContain('تتقاضاها المصارف والجهات المالية الوسيطة')
  })

  it('⚠️ وما يأخذه الوسيطُ ومصرفُ المدرّب وفرقُ العملة يُقتطع في طريقه', () => {
    const c = clause('4-5')
    expect(c, 'لا يُسمّى الوسيطُ ولا مصرفُ المدرّب').toContain('مصرف وسيط أو مصرف المدرب')
    expect(c, 'لا يُقال حكمُ فرق العملة').toContain('وما ينشأ من فرق عملة إن حول مصرف المدرب المبلغ إلى عملة أخرى')
    expect(c, 'لا يُقال إنّها تُقتطع من الحوالة').toContain('يقتطع من المبلغ المحول على ما جرى به العمل')
  })

  it('⚠️ والطريقةُ الأخرى باتّفاقٍ، ورسومُها كلُّها من المبلغ', () => {
    const c = clause('4-5')
    expect(c, 'الطريقةُ الأخرى بلا اتّفاق').toContain('وإن اتفق المدرب مع الأكاديمية على الصرف بطريقة غير التحويل البنكي')
    expect(c, 'لا يُقال إنّ رسومَها كلَّها عليه').toContain('فرسومها وفروق عملتها كلها تقتطع من المبلغ')
  })

  /* والفاعلُ في الاقتطاع المصارفُ لا الأكاديميّة — وإلّا اصطدم بالبند 4-6 */
  it('ولا تُجعل الأكاديميّةُ فاعلَ الاقتطاع', () => {
    expect(clause('4-5')).not.toMatch(/تحسم(ها)? الأكاديمية|تقتطع(ها)? الأكاديمية/)
  })
})

describe('ونقاطُ `v22` تصل المدرّب', () => {
  it('الإصدارُ الحاليّ، ونقاطُه تقول إنّ رسومَ مصرفنا علينا', () => {
    expect(CONTRACT_BODY_VERSION).toBe('v22-2026-10-01')
    const v = CONTRACT_CHANGELOG.find((x) => x.version === CONTRACT_BODY_VERSION)
    expect(v, 'إصدارٌ بلا نقاط').toBeDefined()
    expect(v!.points.map((p) => p.textAr).join(' '), 'النقاطُ لا تقول حكمَ رسوم مصرفنا').toContain('رسومُ مصرفنا')
  })
})
