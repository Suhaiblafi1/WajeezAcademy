/* أيّامُ الشعبة وساعتُها خلاصةُ لقاءاتها المعتمَدة (١٢ أكتوبر ٢٠٢٦، `session-pattern.ts`).
   «sessions or any other details could be filled here» (صاحب المنصّة). */

import { describe, expect, it } from 'vitest'
import { sessionPattern } from '@/application/schedule/session-pattern'

const AMMAN = 'Asia/Amman'
/* عمّان +3 بغرينتش في نوفمبر ٢٠٢٦ — فالسادسةُ مساءً هناك الثالثةُ بغرينتش */
const at = (iso: string) => new Date(iso)

describe('أيّام الشعبة وساعتها من لقاءاتها', () => {
  it('⚠️ الأيّام كلّ يوم وقع فيه لقاء، بترتيب الأسبوع — والساعة بتوقيت الشعبة', () => {
    expect(sessionPattern([at('2026-11-03T15:00:00Z'), at('2026-11-01T15:00:00Z'), at('2026-11-08T15:00:00Z')], AMMAN))
      .toEqual({ daysOfWeek: ['sun', 'tue'], startTime: '18:00' })
  })

  it('⚠️ والساعة أكثر ساعات البدء ورودا — وعند التساوي أبكرها', () => {
    expect(sessionPattern([at('2026-11-01T16:30:00Z'), at('2026-11-03T15:00:00Z'), at('2026-11-08T16:30:00Z')], AMMAN)?.startTime).toBe('19:30')
    expect(sessionPattern([at('2026-11-01T16:30:00Z'), at('2026-11-03T15:00:00Z')], AMMAN)?.startTime).toBe('18:00')
  })

  it('⚠️ ولقاء بعد منتصف الليل في عمّان يومه اليوم التالي — لا يوم غرينتش', () => {
    /* السبت 22:30 بغرينتش = الأحد 01:30 في عمّان */
    expect(sessionPattern([at('2026-11-07T22:30:00Z')], AMMAN)).toEqual({ daysOfWeek: ['sun'], startTime: '01:30' })
  })

  it('ولا لقاء: لا خلاصة', () => {
    expect(sessionPattern([], AMMAN)).toBeNull()
  })
})
