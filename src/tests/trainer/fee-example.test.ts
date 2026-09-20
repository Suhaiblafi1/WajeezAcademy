/* المثالُ الحسابيُّ الذي يرافق رابطَ التوقيع — ولا يدخل العقد.

   والمقيسُ هنا ما يجعله آمنا وصادقا في آنٍ واحد:

   · **المعادلةُ واحدة** — المثالُ يحسب بما يحسب به الكشف، وإلّا وعدنا برقمٍ
     ثمّ دفعنا غيرَه.
   · **ولا يُسمّى المقعدُ العامُّ «من تسويق الأكاديميّة»** — فالمحرّكُ لا يعرف
     ذلك: `general = total − referred`، ويدخله ما جاء به المدرّبُ نفسُه بلا
     رابطه، وما يُكمِّله الحدُّ الأدنى ولا يقابله مسجَّلٌ أصلا.
   · **ولا مثالَ حيث لا يصحّ** — بلا قاعدةٍ، أو بنسبةٍ من الإيراد (رقمُها دالّةٌ
     في سعرٍ نملكه نحن)، أو بلا سعرِ إحالةٍ (فلا يُوعَد بقناةٍ لا تُحتسب).
   · **والعملةُ من القاعدة** لا كلمةٌ مكتوبة. */

import { describe, expect, it } from 'vitest'
import { buildFeeExampleAr, feeExampleFactsAr } from '@/application/trainer/fee-example'
import { perSeatBreakdown } from '@/application/trainer/seat-fee'
import type { ContractCompensation } from '@/application/trainer/contract-body'

const perSeat = (over: Partial<ContractCompensation> = {}): ContractCompensation => ({
  type: 'per_seat', rate: '25.00', currency: 'USD', minSeats: 8, referralRate: '30.00', ...over,
})

describe('معادلةُ المقاعد — تطبيقٌ واحدٌ يقرؤه الكشفُ والشاشةُ والمثال', () => {
  it('الحدُّ الأدنى يُكمَّل من العامّ ولا يُضاف إلى المجموع', () => {
    const b = perSeatBreakdown({ general: 3, referred: 2, rate: 25, referralRate: 30, minSeats: 8 })
    expect(b.generalSeats, 'لم يُكمَّل العامُّ إلى الحدّ').toBe(6)
    expect(b.billedSeats, 'المحتسَبُ ليس الحدَّ الأدنى').toBe(8)
    expect(b.total).toBe(210)
    expect(b.floorApplied).toBe(true)
  })

  it('ومن بلغ الحدَّ بإحالاته لا يُضاعَف له العامّ', () => {
    const b = perSeatBreakdown({ general: 10, referred: 10, rate: 25, referralRate: 30, minSeats: 8 })
    expect(b.generalSeats).toBe(10)
    expect(b.floorApplied).toBe(false)
    expect(b.total).toBe(550)
  })

  it('وبلا سعرِ إحالةٍ يُحتسب المقعدُ المحال بالسعر العامّ', () => {
    const b = perSeatBreakdown({ general: 4, referred: 2, rate: 25, referralRate: null, minSeats: 0 })
    expect(b.referralAmount).toBe(50)
    expect(b.total).toBe(150)
  })

  /* وهذا ما يُغري بالمبالغة في مادّةٍ تسويقيّة: تحت الحدّ الأدنى، المقعدُ
     المحالُ **يزيح** مقعدا عامّا كان سيُحتسب — فقيمتُه الحدّيّةُ فرقُ
     السعرَين لا سعرُه كاملا. */
  it('وتحت الحدّ الأدنى تكون قيمةُ المقعد المحال الحدّيّةُ فرقَ السعرَين لا سعرَه', () => {
    const before = perSeatBreakdown({ general: 3, referred: 1, rate: 25, referralRate: 30, minSeats: 8 })
    const after = perSeatBreakdown({ general: 3, referred: 2, rate: 25, referralRate: 30, minSeats: 8 })
    expect(after.total - before.total).toBe(5)
  })
})

describe('المثالُ يُبنى من أرقامه هو، ولا يُبنى حيث لا يصحّ', () => {
  it('يخرج ثلاثةَ صفوفٍ ومجموعا، والأرقامُ من المعادلة لا من حسابٍ ثانٍ', () => {
    const ex = buildFeeExampleAr(perSeat())!
    expect(ex, 'لا مثالَ أصلا').toBeTruthy()
    expect(ex.rows).toHaveLength(3)
    const expected = [
      perSeatBreakdown({ general: 10, referred: 10, rate: 25, referralRate: 30, minSeats: 8 }).total,
      perSeatBreakdown({ general: 9, referred: 3, rate: 25, referralRate: 30, minSeats: 8 }).total,
      perSeatBreakdown({ general: 3, referred: 2, rate: 25, referralRate: 30, minSeats: 8 }).total,
    ]
    expect(ex.rows.map((r) => r.amount)).toEqual(expected)
    expect(ex.total).toBe(expected.reduce((a, b) => a + b, 0))
  })

  it('ولا يسمّي المقعدَ العامَّ «من تسويق الأكاديميّة» — فذاك وصفٌ لا يحسبه المحرّك', () => {
    const ex = buildFeeExampleAr(perSeat())!
    const all = [...ex.rows.map((r) => r.labelAr), ex.noteAr].join(' ')
    expect(all, 'العامُّ نُسب إلى حملةٍ تسويقيّة').not.toMatch(/تسويق|حمل(ة|ات)|إعلان/)
    expect(all, 'لم يُعرَّف العامُّ بما هو عليه فعلا').toMatch(/لم يسجّل عبر رابطك/)
  })

  it('ويقول إنّ الأعداد افتراضٌ ولا تَعِد بشيء، وإنّ الاتفاقيةَ هي الملزِمة', () => {
    const note = buildFeeExampleAr(perSeat())!.noteAr
    expect(note, 'لا تنويهَ بأنّ الأعداد افتراض').toMatch(/مفترضة/)
    expect(note, 'لا نفيَ للوعد بعددِ مسجّلين').toMatch(/لا تعِد/)
    expect(note, 'لم يُقل إنّ الاتفاقيةَ هي الملزِمة').toMatch(/الاتفاقيةُ وملاحقُها/)
  })

  it('والعملةُ من القاعدة لا كلمةً مكتوبة', () => {
    const ex = buildFeeExampleAr(perSeat({ currency: 'JOD' }))!
    const facts = feeExampleFactsAr(ex)
    expect(facts.every((f) => f.value.endsWith('JOD')), 'عملةٌ غيرُ عملة القاعدة').toBe(true)
    expect(facts.map((f) => f.label).join(' '), 'لا مجموعَ للمثال').toMatch(/مجموعُ هذا المثال/)
    expect(JSON.stringify(ex), 'اسمُ عملةٍ مكتوبٌ حرفا في المولِّد').not.toMatch(/دولار/)
  })

  it('وبلا سعرِ إحالةٍ لا يُذكر الرابطُ أصلا — فلا يُوعَد بقناةٍ لا تُحتسب', () => {
    const ex = buildFeeExampleAr(perSeat({ referralRate: null }))!
    const all = [...ex.rows.map((r) => r.labelAr), ex.noteAr].join(' ')
    expect(all).not.toMatch(/رابط/)
  })

  it('وثلاثةٌ لا مثالَ لها: بلا قاعدةٍ، ونسبةُ الإيراد، وسعرٌ غيرُ صالح', () => {
    expect(buildFeeExampleAr(null)).toBeNull()
    expect(buildFeeExampleAr(perSeat({ type: 'revenue_share', rate: '40' }))).toBeNull()
    expect(buildFeeExampleAr(perSeat({ rate: '0' }))).toBeNull()
  })

  it('والثابتُ لكلّ شعبةٍ يخرج بلا افتراضِ مسجّلين أصلا', () => {
    const ex = buildFeeExampleAr(perSeat({ type: 'fixed_per_cohort', rate: '400', referralRate: null }))!
    expect(ex.total).toBe(1200)
    const all = [...ex.rows.map((r) => r.labelAr), ex.noteAr].join(' ')
    expect(all, 'ثابتٌ لكلّ شعبةٍ ومع ذلك افترض عددَ مسجّلين').not.toMatch(/مسجّلا:|عبر رابط/)
  })
})
