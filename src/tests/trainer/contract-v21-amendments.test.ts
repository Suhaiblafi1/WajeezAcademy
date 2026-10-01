/* ═══ `v21` — الكودُ نسبةٌ أو مبلغ (4-10)، والتسجيلاتُ لمتعلّمي الشعبة (10-4) ═══
 *
 * جوابان على ملاحظات مدرّبٍ أقرّهما صاحبُ المنصّة في ١ أكتوبر ٢٠٢٦.
 *
 * ── ① الكودُ نسبةٌ أو مبلغ، وسقفُ الثلاثين على الوجهين ──
 *
 * «يحقّ للمدرّب أن يختار إمّا نسبةً أو رقما». والمبلغُ كان يتخطّى سقفَ ٢٧
 * سبتمبر: خمسون دولارا على دورةٍ بستّين خصمُ ٨٣٪. فيُقاس هنا أنّ السقفَ يسري
 * على الوجهين — **وأنّ الرقمَ الذي يراه المدرّبُ في «دعوتي» هو الذي تقتطعه
 * السلّةُ بعينه**: `codeValueFor` تُقابَل بـ`priceCart`، لا بتوقّعٍ يُكتب هنا.
 *
 * ── ② 10-4: التسجيلاتُ لمتعلّمي الشعبة وحدهم ──
 *
 * وكان «ولمن تراه الأكاديمية من متعلميها». ويُقاس على المتن المصيَّر لا على
 * الشيفرة — فحصٌ يطابق سطرا في ملفّ مصدرٍ يخضرّ ولو لم يبلغ الوثيقة.
 */

import { describe, expect, it } from 'vitest'
import { renderContractBodyAr, type ContractBodyInput } from '@/application/trainer/contract-body'
import { priceCart } from '@/application/commerce/cart-pricing'
import {
  codeBlockerAr, codeFaceAr, codeQuoteFor, codeValueFor, codeValueRows,
  MAX_TRAINER_CODE_AMOUNT, MAX_TRAINER_CODE_PERCENT, type CodeFace,
} from '@/application/trainer/trainer-code'
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

const pct = (p: number): CodeFace => ({ percentOff: p, amountOff: null })
const amt = (a: number): CodeFace => ({ percentOff: null, amountOff: a })
const LABEL = { labelAr: 'متابعو القناة' }

/** ما تقتطعه السلّةُ فعلا من شراء دورةٍ واحدةٍ بهذا الكود — كما يسعّرها `cart.service` */
const charged = (face: CodeFace, price: number): number => priceCart(
  [{ cohortId: 'H-1', courseId: 'C-1', titleAr: 'دورة', listPrice: price }],
  null,
  { ...face, cohortIds: ['H-1'], maxPercentOfBase: MAX_TRAINER_CODE_PERCENT },
).couponDiscount

describe('① الكودُ نسبةٌ أو مبلغ — حاجزُ الإصدار', () => {
  it('⚠️ أحدُ الوجهين لا كلاهما ولا لا شيء', () => {
    expect(codeBlockerAr({ percentOff: 10, amountOff: 20, ...LABEL }), 'قُبل كودٌ بوجهين').toMatch(/أحدَهما/)
    expect(codeBlockerAr({ ...LABEL }), 'قُبل كودٌ بلا وجه').toMatch(/أحدَهما/)
  })

  it('والمبلغُ بين الواحد والحدّ، بمنزلتين على الأكثر', () => {
    expect(codeBlockerAr({ amountOff: 20, ...LABEL })).toBeNull()
    expect(codeBlockerAr({ amountOff: 19.99, ...LABEL })).toBeNull()
    expect(codeBlockerAr({ amountOff: 0, ...LABEL })).not.toBeNull()
    expect(codeBlockerAr({ amountOff: MAX_TRAINER_CODE_AMOUNT + 1, ...LABEL })).not.toBeNull()
    expect(codeBlockerAr({ amountOff: 10.005, ...LABEL }), 'قُبلت ثلاثُ منازل').not.toBeNull()
  })

  it('والنسبةُ كما كانت: حتّى السقف', () => {
    expect(codeBlockerAr({ percentOff: MAX_TRAINER_CODE_PERCENT, ...LABEL })).toBeNull()
    expect(codeBlockerAr({ percentOff: MAX_TRAINER_CODE_PERCENT + 1, ...LABEL })).not.toBeNull()
  })
})

describe('① وسقفُ الثلاثين على الوجهين', () => {
  /* الحالةُ التي جاء بها القرار: مبلغٌ على دورةٍ رخيصةٍ يتخطّى السقف */
  it('⚠️ المبلغُ يُسقَف بثلاثين بالمئة من السعر — خمسون على ستّين تصير ثمانيةَ عشر', () => {
    expect(codeValueFor(amt(50), 60), 'مرّ مبلغٌ فوق السقف').toBe(18)
    expect(charged(amt(50), 60), 'السلّةُ اقتطعت فوق السقف').toBe(18)
  })

  it('وما دون السقف يُمنح كما كُتب', () => {
    expect(codeValueFor(amt(20), 200)).toBe(20)
    expect(codeValueFor(pct(20), 200)).toBe(40)
  })

  /* ═══ وسقفُ سعر المسار يسبق الكود — وكان الجدولُ يفوته ═══
     كانت `codeValueFor` معادلةً بجانب السلّة، فقابلها فحصٌ بها فافترقتا: دورةٌ
     بألفٍ ومئتين عُرضت بخصمِ اثني عشر وتقتطع السلّةُ ستّة، لأنّ السلّةَ تُنزل
     السعرَ إلى سقف المسار (`MAX_BUNDLE_TOTAL`) قبل الكود. فصارت تُنادي السلّةَ
     نفسَها. والحارسُ الذي يقابل المعروضَ بما يقتطعه الطلبُ فعلا — بوسائط
     `cart.service` لا بنسخةٍ منها هنا — في `server/tests/trainer/trainer-code-amount.test.ts`،
     فمقابلةُ `priceCart` بنفسها هنا دائرةٌ لا حارس. */
  it('⚠️ ويقع الكودُ على ما بعد سقف المسار — لا على سعر القائمة', () => {
    expect(codeValueFor(pct(1), 1200), 'وقع الكودُ على سعر القائمة فوق سقف المسار').toBe(6)
    expect(codeQuoteFor(pct(1), 1200).pays, 'ما يدفعه المتعلّمُ ليس ما بعد السقف والكود').toBe(594)
  })

  /* والسقفُ لكود المدرّب وحدَه: كوبوناتُ الأكاديميّة لا تمرّ بالحدّ نفسِه */
  it('ولا يُسقَف كوبونُ الأكاديميّة — السقفُ حقلٌ يُمرَّر لا قاعدةٌ عامّة', () => {
    const general = priceCart(
      [{ cohortId: 'H-1', courseId: 'C-1', titleAr: 'دورة', listPrice: 60 }],
      null,
      { percentOff: null, amountOff: 50 },
    ).couponDiscount
    expect(general, 'سُقف كوبونٌ عامٌّ بسقف كود المدرّب').toBe(50)
  })
})

describe('① وجدولُ «ما يمنحه كودُك»', () => {
  const course = { cohortId: 'H-1', titleAr: 'دورة', price: 100, currency: 'USD', seatFee: 15, referralSeatFee: 25 }

  /* شكوى المدرّب نفسُها: «يأخذ ١٥ عن هذا الشخص ويعطيه خصما بعشرين، فيخسر خمسة» */
  it('⚠️ يُنبَّه حين يزيد الخصمُ على أجر المقعد العامّ — ولا يُنبَّه حين لا يزيد', () => {
    expect(codeValueRows(amt(20), [course])[0].exceedsSeatFee, 'لم يُنبَّه وخصمُه فوق أجره').toBe(true)
    expect(codeValueRows(amt(10), [course])[0].exceedsSeatFee).toBe(false)
  })

  it('ويقول إنّ المبلغَ سُقف — فلا يظنّ أنّه يمنح ما كتب', () => {
    const [row] = codeValueRows(amt(50), [{ ...course, price: 60 }])
    expect(row.capped).toBe(true)
    expect(row.value).toBe(18)
    expect(row.pays, 'ما يدفعه المتعلّمُ ليس السعرَ ناقصا الخصم').toBe(42)
  })

  it('ووجهُ الكود يُطبع كما أُصدر', () => {
    expect(codeFaceAr(pct(20), () => '—')).toBe('20٪')
    expect(codeFaceAr(amt(20), (a) => `$${a}`)).toBe('$20')
  })
})

describe('① البند 4-10 في الوثيقة', () => {
  it('⚠️ يقول الوجهين والسقفَ عليهما والقيمةَ قبل الإصدار', () => {
    const c = clause('4-10')
    expect(c, 'لا يقول إنّ الكودَ قد يكون مبلغا').toContain('أو مبلغ معلوم يختاره المدرب')
    expect(c, 'لا يقول إنّ السقفَ على الوجهين')
      .toContain(`ولا يتجاوز ما يمنحه بأي منهما ${MAX_TRAINER_CODE_PERCENT}% من سعر الشعبة`)
    expect(c, 'لا يَعِد بالقيمة قبل الإصدار').toContain('وتبين له المنصة قيمته على كل دورة من دوراته قبل أن يصدره')
  })
})

describe('② البند 10-4 — التسجيلاتُ لمتعلّمي الشعبة وحدهم', () => {
  it('⚠️ لمتعلّمي الشعبة نفسها — وذهب «ولمن تراه الأكاديمية»', () => {
    const c = clause('10-4')
    expect(c, 'لا يُقصَر على الشعبة').toContain('لمتعلمي الشعبة نفسها وحدهم')
    expect(c, 'بقي البابُ الذي طلب المدرّبُ إغلاقه').not.toContain('ولمن تراه الأكاديمية من متعلميها')
  })

  it('وما خرج عنها بموافقته المكتوبة ومقابلٍ يُحدَّد — ولا يمسّ 10-3', () => {
    const c = clause('10-4')
    expect(c).toContain('ولا تتيحه الأكاديمية لغيرهم من متعلميها، ولا تبيعه منتجا مسجلا قائما بذاته، إلا بموافقة المدرب المكتوبة يحدد فيها مقابله')
    expect(c, 'قد يُقرأ مانعا لإعادة مادّته المسجَّلة في شعبها').toContain('فحكمها في البند 10-3')
    expect(clause('10-3'), 'مُسّ ترخيصُ المادّة المسجَّلة').toContain('ترخيصا غير حصري ودائما')
  })
})
