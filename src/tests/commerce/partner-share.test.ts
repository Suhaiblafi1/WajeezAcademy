/* حصّةُ الشريك ممّا يُدفع (١٦ نوفمبر ٢٠٢٦) — «% of what the student paid»، والمردودُ ينقص منها بنسبته.
   والخادمُ يحرسها في `server/tests/commerce/partner-revenue.test.ts`. */

import { describe, expect, it } from 'vitest'
import { PARTNER_DEFAULTS, partnerShare, partnerShareLineAr, partnerShareStateAr } from '@/application/commerce/partner-grant'
import { plainAr } from '@/application/text/plain-ar'

describe('حصة الشريك', () => {
  it('⚠️ نسبة مما دفع — وما رد ينقص منها بنسبته، والمردود كله بلا حصة', () => {
    expect(partnerShare(50, 50)).toBe(25)
    expect(partnerShare(75, 50, 0.5), 'رد نصفه').toBe(18.75)
    expect(partnerShare(75, 50, 1), 'رد كله').toBe(0)
    expect(partnerShare(80, 0)).toBe(0)
    expect(partnerShare(99.99, 50)).toBe(50)
  })

  it('⚠️ والقيم الأولى خصم 50% وحصة 50% — والنصوص بلا تشكيل', () => {
    expect(PARTNER_DEFAULTS).toMatchObject({ percentOff: 50, sharePercent: 50 })
    expect(partnerShareLineAr(null)).toBe('بلا حصة من الإيراد بعد')
    for (const t of [partnerShareLineAr(50), partnerShareStateAr('refunded'), partnerShareStateAr('partially_refunded'), partnerShareStateAr('paid')]) {
      expect(t).toBe(plainAr(t))
    }
  })
})
