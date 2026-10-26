/* كودُ أوّل شراء على الدورة الأعلى سعرا وحدَها — قرارُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦):
   «يخصم من الدورة الأعلى سعرا فقط» إن اختار أكثر من دورة، ويُجمع مع خصم الباقة.

   والمقيسُ أربعة:
   ① **على أغلى دورة وحدَها** — لا على السلّة كلِّها كما كان.
   ② **فوق الباقة** — على حصّتها ممّا بقي بعد خصم الباقة، لا على سعر القائمة.
   ③ **دورةٌ واحدة كما كانت** — النسبةُ على سعرها كاملا.
   ④ **والصفحةُ تَعِد بما تخصمه الفوترة** — `promoDiscountOn` يساوي `couponDiscount`. */

import { describe, expect, it } from 'vitest'
import { priceCart, type CartCoupon, type CartLine } from '@/application/commerce/cart-pricing'
import { FIRST_TIME_PROMO, promoDiscountOn } from '@/application/commerce/first-time-promo'

const line = (cohortId: string, listPrice: number, courseId = `C-${cohortId}`): CartLine => ({
  cohortId, courseId, titleAr: `دورة ${cohortId}`, listPrice,
})
const promo: CartCoupon = { percentOff: FIRST_TIME_PROMO.percentOff, amountOff: null, topLineOnly: true }

describe('① على الدورة الأعلى سعرا وحدَها', () => {
  it('⚠️ دورتان: الخصم على حصّة الأغلى لا على السلّة', () => {
    /* ٣٥٠ ← الباقةُ ٨٪ = ٢٨ ← يبقى ٣٢٢. حصّةُ الأغلى (٢٠٠ من ٣٥٠) منه ١٨٤، وعُشرُها ١٨٫٤٠
       — لا ٣٢٫٢٠ (عُشرُ الباقي كلِّه). */
    const p = priceCart([line('a', 150), line('b', 200)], null, promo)
    expect(p.bundleDiscount).toBe(28)
    expect(p.couponDiscount, 'الكود وقع على السلّة كلّها').toBe(18.4)
    expect(p.lines.filter((l) => l.couponApplies).map((l) => l.cohortId)).toEqual(['b'])
    expect(p.total).toBe(303.6)
  })

  it('عند التساوي: دورةٌ واحدة لا اثنتان', () => {
    const p = priceCart([line('a', 150), line('b', 150)], null, promo)
    expect(p.couponLines).toBe(1)
  })

  it('والهديّةُ لا تُعدّ أغلى دورة — سعرُها صفر', () => {
    const p = priceCart([line('a', 150), line('gift', 200, 'G')], 'G', promo)
    expect(p.lines.filter((l) => l.couponApplies).map((l) => l.cohortId)).toEqual(['a'])
    expect(p.couponDiscount).toBe(15)
  })
})

describe('② ③ فوق الباقة، ودورةٌ واحدة كما كانت', () => {
  it('دورةٌ واحدة: عُشرُ سعرها كاملا', () => {
    const p = priceCart([line('a', 180)], null, promo)
    expect(p.couponDiscount).toBe(18)
    expect(p.total).toBe(162)
  })

  it('وكوبونٌ عامٌّ بلا الراية يبقى على السلّة كلِّها', () => {
    const p = priceCart([line('a', 150), line('b', 200)], null, { percentOff: 10, amountOff: null })
    expect(p.couponDiscount).toBe(32.2)
  })
})

describe('④ الصفحةُ والفوترة رقمٌ واحد', () => {
  it.each([
    [[150, 200]],
    [[120, 225, 180]],
    [[200, 200, 150, 120]],
    [[175]],
  ])('سلّة %j', (prices) => {
    const p = priceCart(prices.map((x, i) => line(`c${i}`, x)), null, promo)
    const afterBundle = p.subtotal - p.bundleDiscount - p.capDiscount
    expect(promoDiscountOn(afterBundle, prices)).toBeCloseTo(p.couponDiscount, 2)
  })
})
