/* شعبٌ بلا فصل: ما يتحدّد وحدَه وما يحتاجك (١٩ أكتوبر ٢٠٢٦).

   «لماذا يجب أن أعيد التوزيع والمدرّبُ هو من حدّد وأنا اعتمدت.. هذا فعلٌ مكرّر» (صاحب المنصّة).
   ① ما له مدرّبٌ ولم تُعتمَد خطّتُه يتحدّد فصلُه وحدَه — لا يُطلب منك.
   ② وما لا مدرّبَ له، أو اعتُمد ولم يُعرف موسمُه، يحتاجك — بسببه.
   ③ والنصُّ أبيضُ بلا تشكيل. */

import { describe, expect, it } from 'vitest'
import { termlessAutoAr, termlessKindOf, termlessWaitAr } from '@/application/terms/termless'

const day = (d: string) => d
const TASHKEEL = /[ً-ِْ]/

describe('① يتحدد وحده', () => {
  it('له مدرب ولم تعتمد خطته — مهما كانت حالها', () => {
    expect(termlessKindOf({ trainers: 1, approvedOnce: false })).toEqual({ kind: 'auto', whyAr: null })
  })

  it('وسطره يقول أين خطته ومتى يبدأ', () => {
    expect(termlessWaitAr({ plan: 'submitted', startsOn: '2026-12-01' }, day)).toBe('الخطة تنتظر اعتمادك · يبدأ 2026-12-01 حسب خطته')
    expect(termlessWaitAr({ plan: 'draft', startsOn: null }, day)).toBe('الخطة عند المدرب')
    expect(termlessWaitAr({ plan: null, startsOn: null }, day)).toBe('لم يكتب المدرب خطته بعد')
  })

  it('ورأس المطوي يعد ويقول لا شيء عليك', () => {
    expect(termlessAutoAr(20)).toBe('20 شعبة يتحدد فصلها وحده عند اعتماد خطة مدربها. لا شيء عليك الآن.')
    expect(termlessAutoAr(2)).toMatch(/^شعبتان /)
  })
})

describe('② يحتاجك — بسببه', () => {
  it('لا مدرب لها', () => {
    expect(termlessKindOf({ trainers: 0, approvedOnce: false })).toEqual({ kind: 'needs', whyAr: 'لا مدرب لها' })
  })

  it('واعتمدت ولم يعرف موسمها', () => {
    expect(termlessKindOf({ trainers: 1, approvedOnce: true }).kind).toBe('needs')
  })
})

describe('③ بلا تشكيل', () => {
  it('كل ما يخرج للشاشة', () => {
    const out = [
      termlessAutoAr(3), termlessKindOf({ trainers: 0, approvedOnce: false }).whyAr!,
      termlessKindOf({ trainers: 1, approvedOnce: true }).whyAr!,
      ...['draft', 'submitted', 'changes_requested', null].map((plan) => termlessWaitAr({ plan, startsOn: '2026-12-01' }, day)),
    ]
    for (const s of out) expect(s, s).not.toMatch(TASHKEEL)
  })
})
