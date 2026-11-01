/* موسمُ البيع — فصلُ أقرب شعبةٍ معروضةٍ لم تبدأ (١ نوفمبر ٢٠٢٦، `sellingSeason` في `application/terms/start-term.ts`).
   فيه تُعرض المساراتُ العامّة، فلا تغيب كلُّها حين ينتهي الشتاء. */

import { describe, expect, it } from 'vitest'
import { sellingSeason } from '@/application/terms/start-term'

const at = (iso: string) => new Date(iso)

describe('موسمُ البيع', () => {
  it('⚠️ في أكتوبر وشعبُ الشتاء قادمةٌ: الشتاء', () => {
    const now = at('2026-10-28T09:00:00Z')
    expect(sellingSeason([at('2027-03-01T08:00:00Z'), at('2026-11-30T21:00:00Z'), null], now)).toBe('2026-nov_jan')
  })

  it('⚠️ وحين تبدأ آخرُ شعب الشتاء: الربيع — الجاريةُ لا تُبقيه', () => {
    const now = at('2027-01-10T09:00:00Z')
    expect(sellingSeason([at('2026-12-01T08:00:00Z'), at('2027-01-09T08:00:00Z'), at('2027-02-15T08:00:00Z')], now)).toBe('2027-feb_apr')
  })

  it('وبتوقيت عمّان: منتصفُ ليل أوّل نوفمبر شتاء', () => {
    expect(sellingSeason([at('2030-10-31T21:00:00Z')], at('2030-10-01T00:00:00Z'))).toBe('2030-nov_jan')
  })

  it('وبلا شعبةٍ قادمةٍ ففصلُ اليوم', () => {
    expect(sellingSeason([at('2026-12-01T08:00:00Z')], at('2027-01-20T09:00:00Z'))).toBe('2026-nov_jan')
    expect(sellingSeason([], at('2027-03-05T09:00:00Z'))).toBe('2027-feb_apr')
  })
})
