/* أغطّت الشعبةُ حقَّ مدرّبها؟ — الحكمُ وحدَه، بلا قاعدة (٢٢ أكتوبر ٢٠٢٦).

   «أحتاج لافتةً تقول كم الحدُّ الأدنى الذي سنعطيه للمدرّب، وكم حصّلنا» (صاحب المنصّة). والرقمان من
   معادلة الكشف نفسِها (`perSeatBreakdown`)، فيُحرس أن «لو انعقدت الآن» هو ما يُدفع فعلا بعد البدء —
   لا رقمٌ ثالث. */

import { describe, expect, it } from 'vitest'
import { cohortEconomics, lineNet } from '@/application/trainer/cohort-economics'
import { perSeatBreakdown } from '@/application/trainer/seat-fee'

const perSeat = { type: 'per_seat', rate: 15, minSeats: 15, referralRate: null }

describe('الحد الأدنى وما حصل', () => {
  it('⚠️ بالمقعد: الحد الأدنى مقاعد × أجر، و«لو انعقدت» أكبر الاثنين', () => {
    const e = cohortEconomics({ hasTrainer: true, rule: perSeat, seats: { general: 8, referred: 0 }, collected: 1200, started: false })
    expect(e.minimum).toBe(225)
    expect(e.minimumBasisAr).toBe('15 مقعدا × 15')
    /* ثمانيةٌ × ١٥ = ١٢٠ أقلّ من الأرضيّة — فلو انعقدت دفعنا الأرضيّة */
    expect(e.costIfRun).toBe(225)
    expect(e.margin).toBe(975)
    expect(e.verdict).toBe('covered')
  })

  it('⚠️ وما لا يغطي يقال بنقصه', () => {
    const e = cohortEconomics({ hasTrainer: true, rule: perSeat, seats: { general: 1, referred: 0 }, collected: 100, started: false })
    expect(e.verdict).toBe('short')
    expect(e.margin).toBe(-125)
  })

  it('⚠️ و«لو انعقدت» هو ما يدفعه الكشف بعد البدء — لا رقم ثالث', () => {
    const seats = { general: 20, referred: 3 }
    const rule = { ...perSeat, referralRate: 25 }
    const e = cohortEconomics({ hasTrainer: true, rule, seats, collected: 0, started: false })
    expect(e.costIfRun).toBe(perSeatBreakdown({ ...seats, rate: 15, referralRate: 25, minSeats: 15, cohortStarted: true }).total)
  })

  it('بلا حد أدنى يقال ذلك — وأجر المقعد وحده', () => {
    const e = cohortEconomics({ hasTrainer: true, rule: { ...perSeat, minSeats: 0 }, seats: { general: 2, referred: 0 }, collected: 0, started: false })
    expect(e.minimum).toBe(0)
    expect(e.minimumBasisAr).toBe('بلا حد أدنى — 15 لكل مقعد')
    expect(e.costIfRun).toBe(30)
  })

  it('الأجر الثابت هو الحد وهو الكلفة، ونسبة الإيراد تغطى دائما', () => {
    const fixed = cohortEconomics({ hasTrainer: true, rule: { type: 'fixed_per_cohort', rate: 400, minSeats: 0, referralRate: null }, seats: { general: 0, referred: 0 }, collected: 300, started: false })
    expect([fixed.minimum, fixed.costIfRun, fixed.verdict]).toEqual([400, 400, 'short'])
    const share = cohortEconomics({ hasTrainer: true, rule: { type: 'revenue_share', rate: 40, minSeats: 0, referralRate: null }, seats: { general: 0, referred: 0 }, collected: 500, started: false })
    expect([share.minimum, share.costIfRun, share.verdict]).toEqual([0, 200, 'covered'])
  })

  it('بلا مدرب أو بلا قاعدة لا رقم يخترع', () => {
    expect(cohortEconomics({ hasTrainer: false, rule: perSeat, seats: { general: 0, referred: 0 }, collected: 0, started: false }))
      .toMatchObject({ verdict: 'no_trainer', minimum: null, costIfRun: null })
    expect(cohortEconomics({ hasTrainer: true, rule: null, seats: { general: 0, referred: 0 }, collected: 0, started: false }))
      .toMatchObject({ verdict: 'no_rule', minimum: null, costIfRun: null })
  })
})

describe('حصة البند من صافي طلبه', () => {
  it('⚠️ الخصم والمردود يقسمان بنسبة البند', () => {
    /* طلبٌ بشعبتين (١٠٠ و٣٠٠)، خُصم منه ٤٠ ورُدّ ٦٠: الصافي ٣٠٠، وحصّة الأولى ربعه */
    expect(lineNet({ unitPrice: 100, quantity: 1 }, { subtotal: 400, total: 360, refunded: 60 })).toBe(75)
    expect(lineNet({ unitPrice: 100, quantity: 1 }, { subtotal: 0, total: 0, refunded: 0 })).toBe(0)
    expect(lineNet({ unitPrice: 100, quantity: 1 }, { subtotal: 100, total: 100, refunded: 100 })).toBe(0)
  })
})
