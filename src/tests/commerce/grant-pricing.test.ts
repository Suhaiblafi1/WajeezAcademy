/* كودُ المنحة في `priceCart` — بدلُ الباقة لا فوقها (٢٠ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة («A»): «منحة أعضاء وجيز» نسبةٌ من سعر القائمة لا تجتمع مع سلّم الباقة.
   والمقيسُ ثلاثة:
   ① **تحلّ محلَّ الباقة** — بنودُ الباقة الثلاثة صفر، والمنحةُ على المجموع كلِّه.
   ② **ويدفع الأقلّ** — حيث يغلب سعرُ الباقة (سقفُ المبلغ، أو نسبةُ منحةٍ صغيرة) يُدفع هو، ويقال ذلك.
   ③ **فلا يدفع أحدٌ بكود المنحة أكثرَ ممّا بلا كود** — على مدى الأعداد والأسعار والنسب. */

import { describe, expect, it } from 'vitest'
import { priceCart, type CartLine } from '@/application/commerce/cart-pricing'
import { grantPrice } from '@/application/commerce/grant'

const lines = (n: number, price: number): CartLine[] =>
  Array.from({ length: n }, (_, i) => ({ cohortId: `c${i}`, courseId: `k${i}`, titleAr: `دورة ${i}`, listPrice: price }))
const grant = (percentOff: number) => ({ percentOff, amountOff: null, replacesBundle: true })

describe('① تحل محل الباقة', () => {
  it('⚠️ أربع دورات بـ١٥٠: ستون بالمئة من ٦٠٠ — لا سلم ٢٨٪ ثم ستون فوقه', () => {
    const p = priceCart(lines(4, 150), null, grant(60))
    expect(p.bundlePct).toBe(0)
    expect(p.bundleDiscount, 'اجتمعت المنحة مع خصم الباقة').toBe(0)
    expect(p.capDiscount).toBe(0)
    expect(p.couponDiscount).toBe(360)
    expect(p.total).toBe(240)
    expect(p.grantBeaten).toBe(false)
    expect(p.total).toBe(grantPrice(600, 60))
  })

  it('وخصم إكمال الخطة يصفر معها — المنحة بدله أيضا', () => {
    const carry = { planCourseIds: ['k0', 'k1', 'k2', 'k3'], boughtCount: 2, boughtList: 300, boughtReceived: 24 }
    const p = priceCart(lines(2, 150).map((l, i) => ({ ...l, courseId: `k${i + 2}` })), null, grant(60), 'USD', carry)
    expect(p.planCredit).toBe(0)
    expect(p.total).toBe(120)
  })
})

describe('② ويدفع الأقل', () => {
  it('⚠️ سلة كبيرة يبلغها السقف: سعر الباقة أقل فيدفعه — ويقال', () => {
    /* خمسٌ بأربعمئة: الباقةُ ٣٠٪ ثمّ سقفُ ٧٥٠، والمنحةُ ٨٠٠ */
    const p = priceCart(lines(5, 400), null, grant(60))
    expect(p.grantBeaten, 'لم يقل إن الباقة أقل').toBe(true)
    expect(p.couponDiscount).toBe(0)
    expect(p.total).toBe(750)
  })

  it('⚠️ ونسبة منحة أصغر من سلم الباقة: كذلك', () => {
    const p = priceCart(lines(4, 150), null, grant(20))
    expect(p.grantBeaten).toBe(true)
    expect(p.total).toBe(432)
  })
})

describe('③ فلا يدفع أحد بالمنحة أكثر مما بلا كود', () => {
  it('⚠️ على مدى الأعداد والأسعار والنسب', () => {
    for (let n = 1; n <= 6; n++) {
      for (const price of [60, 120, 175, 225, 400]) {
        for (const pct of [1, 10, 20, 28, 30, 45, 60, 80, 100]) {
          const without = priceCart(lines(n, price), null, null)
          const withGrant = priceCart(lines(n, price), null, grant(pct))
          expect(withGrant.total, `${n} × ${price} بـ${pct}٪`).toBeLessThanOrEqual(without.total)
          expect(withGrant.total).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})
