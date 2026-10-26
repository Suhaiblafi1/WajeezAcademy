/* أتعابُ العقد بنوع القاعدة السارية، ولا قاعدةَ ثانيةً بأرقامها (`contract-fee.ts`، ٢٤ أكتوبر ٢٠٢٦).

   كانت شاشةُ التركيب تملأ خاناتِ المقعد من قاعدةٍ أيًّا كان نوعُها وترسلها `per_seat` دائما: «ثابتٌ لكلّ شعبة: 400»
   يصير «400 لكلّ متعلّم». ثمّ ذهبت خاناتُ الأجر من التركيب والإعادة كلّها (قرارُ «a»، ٢٦ أكتوبر ٢٠٢٦): الأجرُ يُضبط
   في «الاتفاقية» وحدَها — ويحرس ذلك `contract-fee-from-agreement.test.ts`. وبقي هنا ما يقيس به الخادمُ أجرا يصله
   مكتوبا من غير الشاشات، وسطرُ الأجر الذي تقرؤه نافذةُ الإعادة. */

import { describe, expect, it } from 'vitest'
import { feeLineAr, feeTypeChangeAr, sameFeeAsRule, type FeeRuleLike } from '../../application/trainer/contract-fee'

const cohortRule: FeeRuleLike = { type: 'fixed_per_cohort', rate: '400', minSeats: 6, referralRate: null }

describe('الخادم يقيس بالمقياس نفسه', () => {
  it('⚠️ تبديل النوع من العقد يرد ويقال أين يبدل — في «الاتفاقية»', () => {
    const ar = feeTypeChangeAr(cohortRule, { type: 'per_seat' })
    expect(ar).toContain('ثابت لكل شعبة')
    expect(ar).toContain('«الاتفاقية»')
    expect(ar, 'يدل على باب ذهب').not.toContain('أتعاب المدربين')
    expect(feeTypeChangeAr(cohortRule, { type: 'fixed_per_cohort' })).toBeNull()
    expect(feeTypeChangeAr(null, { type: 'per_seat' })).toBeNull()
  })
  it('والحد الغائب صفر كما يكتبه setRule', () => {
    expect(sameFeeAsRule({ type: 'per_seat', rate: '25', minSeats: 0, referralRate: null }, { type: 'per_seat', rate: 25 })).toBe(true)
    expect(sameFeeAsRule({ type: 'per_seat', rate: '25', minSeats: 8, referralRate: null }, { type: 'per_seat', rate: 25 })).toBe(false)
  })
})

describe('وسطر الأجر في نافذة الإعادة', () => {
  it('⚠️ نوعه ورقمه، والحد ومقعد الرابط إن كانا', () => {
    expect(feeLineAr({ type: 'per_seat', rate: '25', currency: 'JOD', minSeats: 8, referralRate: '35' }))
      .toBe('لكل متعلم 25 JOD · حد أدنى 8 مقعدا · بالإحالة 35')
    expect(feeLineAr({ type: 'revenue_share', rate: '40', currency: 'JOD', minSeats: 0, referralRate: null }))
      .toBe('نسبة من الإيراد 40 %')
    /* ومقعدُ الرابط للمقعد وحدَه — لا يُقال في أجر الشعبة ولو وصل */
    expect(feeLineAr({ type: 'fixed_per_cohort', rate: '400', currency: 'JOD', minSeats: null, referralRate: '50' }))
      .toBe('ثابت لكل شعبة 400 JOD')
    expect(feeLineAr(null)).toBe('بلا أجر')
  })
})
