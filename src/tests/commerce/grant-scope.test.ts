/* دوراتُ كلّ منحة — القاعدةُ الواحدة (١٥ نوفمبر ٢٠٢٦). والعلّةُ في رأس `src/application/commerce/grant-scope.ts`،
   والحسابُ في `cart-pricing.ts`. وما على الخادم في `server/tests/commerce/grant-course-choice.test.ts`. */

import { describe, expect, it } from 'vitest'
import { frozenScopeData, grantCodeScope, inScope, liveGrantScope, scopeOfIds } from '@/application/commerce/grant-scope'
import { priceCart } from '@/application/commerce/cart-pricing'

const ids = (s: ReadonlySet<string> | null) => (s === null ? null : [...s].sort())

describe('النطاق', () => {
  it('⚠️ القائمة الفارغة تلقائية — والمؤثر داخل حملته لا يزيد عليها', () => {
    expect(scopeOfIds([])).toBeNull()
    expect(ids(liveGrantScope([], ['A']))).toEqual(['A'])
    expect(ids(liveGrantScope(['A', 'B'], []))).toEqual(['A', 'B'])
    expect(ids(liveGrantScope(['A', 'B'], ['B', 'C'])), 'زاد المؤثر على قائمة حملته').toEqual(['B'])
    /* وتقاطعٌ فارغٌ لا يعود إلى القائمة كلّها */
    expect(ids(liveGrantScope(['A'], ['C']))).toEqual([])
    expect(inScope(null, 'X')).toBe(true)
  })

  it('⚠️ الكود الذي دفع به يثبت — والتلقائي يثبت تلقائيا', () => {
    const live = { campaignCourseIds: ['A'], influencerCourseIds: null }
    expect(ids(grantCodeScope(live))).toEqual(['A'])
    expect(ids(grantCodeScope({ ...live, firstPaidAt: new Date(), ...frozenScopeData(new Set(['A', 'B'])) }))).toEqual(['A', 'B'])
    expect(grantCodeScope({ ...live, firstPaidAt: new Date(), ...frozenScopeData(null) })).toBeNull()
  })
})

describe('الحساب', () => {
  const lines = [
    { cohortId: 'a', courseId: 'A', titleAr: 'أ', listPrice: 100 },
    { cohortId: 'b', courseId: 'B', titleAr: 'ب', listPrice: 200 },
  ]
  it('⚠️ المنحة على دوراتها وحدها — وما سواها بسعره كاملا بلا سلم', () => {
    const p = priceCart(lines, null, { percentOff: 60, amountOff: null, replacesBundle: true, cohortIds: ['a'] })
    expect(p.couponDiscount).toBe(60)
    expect(p.bundleDiscount).toBe(0)
    expect(p.total).toBe(240)
    expect(p.couponLines).toBe(1)
  })

  it('بلا نطاق كما كانت', () => {
    const p = priceCart(lines, null, { percentOff: 60, amountOff: null, replacesBundle: true })
    expect(p.couponDiscount).toBe(180)
    expect(p.total).toBe(120)
  })
})
