/* أتعابُ العقد الجديد بنوع القاعدة السارية، ولا تُرسَل إن لم يتغيّر رقم (`contract-fee.ts`، ٢٤ أكتوبر ٢٠٢٦).

   كانت الشاشةُ تملأ خاناتِ المقعد من قاعدةٍ أيًّا كان نوعُها وترسلها `per_seat` دائما: «ثابتٌ لكلّ شعبة: 400»
   يصير «400 لكلّ متعلّم» إن تُركت الخاناتُ كما مُلئت. */

import { describe, expect, it } from 'vitest'
import {
  composerFeeInput, FEE_FIELDS_AR, feeFormOf, feeTypeChangeAr, sameFeeAsRule, type FeeRuleLike,
} from '../../application/trainer/contract-fee'

const cohortRule: FeeRuleLike = { type: 'fixed_per_cohort', rate: '400', minSeats: 6, referralRate: null }
const shareRule: FeeRuleLike = { type: 'revenue_share', rate: '30', minSeats: null, referralRate: null }
const seatRule: FeeRuleLike = { type: 'per_seat', rate: '25', minSeats: 8, referralRate: '40' }

describe('الخانات كما ملئت لا ترسل شيئا', () => {
  it('⚠️ أجر ثابت لكل شعبة لا يصير أجرا بالمقعد', () => {
    expect(composerFeeInput(cohortRule, feeFormOf(cohortRule)), 'كتبت قاعدة بالمقعد من أجر الشعبة').toBeNull()
  })
  it('⚠️ ولا نسبة من الإيراد', () => {
    expect(composerFeeInput(shareRule, feeFormOf(shareRule))).toBeNull()
  })
  it('⚠️ ولا قاعدة ثانية بأرقام المقعد نفسها', () => {
    expect(composerFeeInput(seatRule, feeFormOf(seatRule))).toBeNull()
  })
})

describe('وما تغير يرسل بنوع القاعدة السارية', () => {
  it('⚠️ أجر الشعبة الجديد يبقى أجر شعبة', () => {
    const typed = composerFeeInput(cohortRule, { ...feeFormOf(cohortRule), rate: '450' })
    expect(typed).toEqual({ type: 'fixed_per_cohort', rate: 450, minSeats: 6, referralRate: null })
  })
  it('ومقعد الرابط للمقعد وحده — يسقط من غيره ولو كتب', () => {
    const typed = composerFeeInput(shareRule, { rate: '35', referralRate: '50', minSeats: '' })
    expect(typed).toEqual({ type: 'revenue_share', rate: 35, minSeats: undefined, referralRate: null })
  })
  it('ومن لا قاعدة له فبالمقعد كما كان', () => {
    expect(composerFeeInput(null, { rate: '30', referralRate: '45', minSeats: '8' }))
      .toEqual({ type: 'per_seat', rate: 30, minSeats: 8, referralRate: 45 })
  })
  it('والسعر الفارغ أو الصفر يترك القاعدة كما هي', () => {
    expect(composerFeeInput(seatRule, { ...feeFormOf(seatRule), rate: '' })).toBeNull()
    expect(composerFeeInput(null, { rate: '0', referralRate: '', minSeats: '' })).toBeNull()
  })
})

describe('الخادم يقيس بالمقياس نفسه', () => {
  it('⚠️ تبديل النوع من العقد يرد ويقال أين يبدل', () => {
    const ar = feeTypeChangeAr(cohortRule, { type: 'per_seat' })
    expect(ar).toContain('ثابت لكل شعبة')
    expect(ar).toContain('أتعاب المدربين')
    expect(feeTypeChangeAr(cohortRule, { type: 'fixed_per_cohort' })).toBeNull()
    expect(feeTypeChangeAr(null, { type: 'per_seat' })).toBeNull()
  })
  it('والحد الغائب صفر كما يكتبه setRule', () => {
    expect(sameFeeAsRule({ type: 'per_seat', rate: '25', minSeats: 0, referralRate: null }, { type: 'per_seat', rate: 25 })).toBe(true)
    expect(sameFeeAsRule({ type: 'per_seat', rate: '25', minSeats: 8, referralRate: null }, { type: 'per_seat', rate: 25 })).toBe(false)
  })
  it('ولكل نوع أسماء خاناته', () => {
    expect(Object.keys(FEE_FIELDS_AR).sort()).toEqual(['fixed_per_cohort', 'per_seat', 'revenue_share'])
    expect(FEE_FIELDS_AR.fixed_per_cohort.referral).toBeNull()
  })
})
